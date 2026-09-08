"""
AgenticCore.agency — AI Agent Backend
=================================
FastAPI backend that exposes a single /api/task endpoint. A customer request
comes in, the Manager agent decides which specialist agent(s) to call, and
the combined result is returned.

IMPORTANT — why this fixes your earlier "Backend Not Configured" issue:
Replit's Canvas wrapper loads the root URL ("/") looking for a frontend.
Since this is a pure API backend with no frontend, we explicitly define a
root route below so it returns a real response instead of falling through
to Replit's fallback error page.
"""

import os
import logging
import subprocess
import requests
import hashlib
import hmac
from fastapi import FastAPI, HTTPException, BackgroundTasks, Header
from fastapi.middleware.cors import CORSMiddleware
from pydantic import BaseModel

import base64
from agents import run_manager
import db.client as db_client
import db.repository as repo
from jobs.runner import create_and_run_job
import integrations.voice as voice
from integrations.crypto_memory import context_for_owner_query

logging.basicConfig(level=logging.INFO)
logger = logging.getLogger("agenticcore-agency")


def _get_git_commit() -> str:
    """Resolves the commit this running process was started from. This
    exists purely so "is the live deployment actually running the code I
    think it is" is a one-line check (this log, or GET /api/health)
    instead of having to infer it from behavior."""
    try:
        return subprocess.check_output(
            ["git", "rev-parse", "--short", "HEAD"],
            stderr=subprocess.DEVNULL,
            timeout=5,
            cwd=os.path.dirname(os.path.abspath(__file__)),
        ).decode().strip()
    except Exception:
        return "unknown"


GIT_COMMIT = _get_git_commit()
logger.info(f"Starting AgenticCore.agency backend at commit {GIT_COMMIT}")

# Logged once at process start so "why isn't memory working" is answerable
# from the boot log alone: DATABASE_URL is read once at import time (see
# db/client.py), so a Secret added *after* this process started won't take
# effect until the process is restarted.
if db_client.is_configured():
    logger.info("NEXUS_DB_URL is configured — conversation memory and deliverable persistence are enabled.")
else:
    logger.warning(
        "NEXUS_DB_URL is not configured for this running process — conversation memory, "
        "deliverable persistence, and async jobs are disabled. If you just added the "
        "NEXUS_DB_URL secret, restart the app to pick it up."
    )

# Voice (both directions: incoming transcription and outgoing synthesis) is
# the owner's personal channel with the Manager only — never customer-
# facing. It requires BOTH a working Google credential AND a matching
# OWNER_TELEGRAM_CHAT_ID; missing either one disables voice entirely rather
# than falling back to "on for everyone," since accidentally exposing it to
# a customer chat is the one failure mode that isn't acceptable here.
OWNER_TELEGRAM_CHAT_ID = os.environ.get("OWNER_TELEGRAM_CHAT_ID")
_WEBHOOK_SECRET_SOURCE = os.environ.get("AGENCY_JWT_SECRET", "")
TELEGRAM_WEBHOOK_SECRET = (
    hmac.new(
        _WEBHOOK_SECRET_SOURCE.encode("utf-8"),
        b"agenticcore-agency-telegram-webhook",
        hashlib.sha256,
    ).hexdigest()
    if _WEBHOOK_SECRET_SOURCE
    else ""
)


def _is_owner_chat(chat_id) -> bool:
    return OWNER_TELEGRAM_CHAT_ID is not None and str(chat_id) == OWNER_TELEGRAM_CHAT_ID


def _is_valid_telegram_webhook_secret(value: str | None) -> bool:
    return bool(
        TELEGRAM_WEBHOOK_SECRET
        and value
        and hmac.compare_digest(value, TELEGRAM_WEBHOOK_SECRET)
    )


if voice.is_configured() and OWNER_TELEGRAM_CHAT_ID:
    logger.info(
        f"Voice is configured for the owner's Telegram chat ({OWNER_TELEGRAM_CHAT_ID}) — "
        "voice-to-voice, voice-to-text, and text-to-voice are enabled for that chat only. "
        "All other chats remain text-only."
    )
elif voice.is_configured() and not OWNER_TELEGRAM_CHAT_ID:
    logger.warning(
        "GOOGLE_TTS_CREDENTIALS_JSON is set but OWNER_TELEGRAM_CHAT_ID is not — voice stays "
        "fully disabled (fail closed) until both are configured, so it can never accidentally "
        "reach a customer chat."
    )
else:
    logger.info(
        "Voice is not configured for this running process — all Telegram replies are "
        "text-only. If you just added GOOGLE_TTS_CREDENTIALS_JSON or OWNER_TELEGRAM_CHAT_ID, "
        "restart the app to pick them up."
    )


def _resolve_customer_context(external_ref: str):
    """Resolves (customer_id, project_id, history) for a customer. Any DB
    failure here degrades to stateless (returns Nones) rather than crashing
    the caller — a customer should still get an answer even if persistence
    is down — but logs loudly so a broken DB shows up in the logs instead
    of silently looking like "no memory" with no explanation."""
    if not db_client.is_configured():
        return None, None, None
    try:
        customer_id = repo.get_or_create_customer(external_ref)
        project_id = repo.get_or_create_project(customer_id)
        history = repo.get_recent_messages(customer_id)
        logger.info(f"Loaded {len(history)} prior message(s) for customer {external_ref!r}.")
        return customer_id, project_id, history
    except Exception:
        logger.exception(f"Failed to load conversation context for {external_ref!r} — continuing without memory.")
        return None, None, None


def _run_manager_and_persist(customer_request, history, project_id, on_event=None, customer_id=None):
    """Wraps run_manager with conversation persistence — shared by the
    synchronous /api/task path and the background job path so both save
    history the same way."""
    result, agents_used, image_urls, video_urls = run_manager(
        customer_request, history=history, project_id=project_id, on_event=on_event,
    )
    if customer_id:
        try:
            repo.save_message(customer_id, "user", customer_request)
            repo.save_message(customer_id, "assistant", result, agents_used=agents_used)
        except Exception:
            logger.exception(
                f"Failed to persist conversation turn for customer {customer_id!r} — "
                "the reply below was still sent, but this turn won't be remembered next time."
            )
    return {
        "result": result,
        "agents_used": agents_used,
        "image_urls": image_urls,
        "video_urls": video_urls,
    }

app = FastAPI(
    title="AgenticCore.agency AI Agent Backend",
    description="Multi-agent backend: Manager + specialist agents (feasibility, site architecture, development, QA, content, marketing, bookkeeping, image).",
    version="0.1.0",
)

app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)


@app.on_event("startup")
def configure_telegram_webhook_secret() -> None:
    """Attach a secret header to the already-configured Telegram webhook."""
    if not TELEGRAM_BOT_TOKEN or not TELEGRAM_WEBHOOK_SECRET:
        logger.error(
            "Telegram webhook authentication is unavailable; incoming updates will fail closed."
        )
        return
    try:
        current = requests.get(f"{TELEGRAM_API}/getWebhookInfo", timeout=10).json()
        webhook_url = ((current.get("result") or {}).get("url") or "").strip()
        if not webhook_url:
            logger.warning(
                "Telegram has no configured webhook URL; cannot attach the required secret header."
            )
            return
        response = requests.post(
            f"{TELEGRAM_API}/setWebhook",
            json={"url": webhook_url, "secret_token": TELEGRAM_WEBHOOK_SECRET},
            timeout=15,
        )
        if response.status_code != 200 or not response.json().get("ok"):
            logger.error("Failed to configure Telegram webhook authentication.")
        else:
            logger.info("Telegram webhook authentication configured.")
    except Exception:
        logger.exception("Failed to configure Telegram webhook authentication.")


@app.get("/")
def root():
    """Root route — prevents the 'Backend Not Configured' screen.
    This is the first thing to check if you ever see that error again:
    is there a route defined for '/'? If not, that's the whole bug."""
    return {
        "status": "ok",
        "service": "AgenticCore.agency backend",
        "docs": "/docs",
        "task_endpoint": "POST /api/task",
    }


@app.get("/api/health")
def health():
    from agents import MODEL
    return {
        "status": "healthy",
        "commit": GIT_COMMIT,
        "model": MODEL,
        "database": "configured" if db_client.is_configured() else "not configured",
    }


class TaskRequest(BaseModel):
    customer_id: str
    request: str
    async_mode: bool = False


class TaskResponse(BaseModel):
    customer_id: str
    result: str
    agents_used: list[str]
    image_urls: list[str] = []
    video_urls: list[str] = []
    job_id: str | None = None


@app.post("/api/task", response_model=TaskResponse)
def create_task(task: TaskRequest, background_tasks: BackgroundTasks):
    if not os.environ.get("GEMINI_API_KEY"):
        raise HTTPException(
            status_code=500,
            detail="GEMINI_API_KEY is not set. Add it in Replit Secrets (the padlock icon in the sidebar).",
        )

    customer_id, project_id, history = _resolve_customer_context(task.customer_id)

    if task.async_mode:
        if customer_id is None:
            raise HTTPException(
                status_code=400,
                detail="async_mode requires a working DATABASE_URL — use the synchronous request instead. "
                       "Check the server logs for details if DATABASE_URL is set but this still fails.",
            )
        job_id = create_and_run_job(
            background_tasks, customer_id, task.request, _run_manager_and_persist,
            task.request, history, project_id,
            project_id=project_id, fn_kwargs={"customer_id": customer_id},
        )
        return TaskResponse(
            customer_id=task.customer_id,
            result=f"Job created — poll GET /api/jobs/{job_id} for the result.",
            agents_used=[],
            job_id=job_id,
        )

    try:
        outcome = _run_manager_and_persist(task.request, history, project_id, customer_id=customer_id)
        return TaskResponse(
            customer_id=task.customer_id,
            result=outcome["result"],
            agents_used=outcome["agents_used"],
            image_urls=outcome["image_urls"],
            video_urls=outcome["video_urls"],
        )
    except Exception as e:
        logger.exception("Task failed")
        raise HTTPException(status_code=500, detail=str(e))


@app.get("/api/jobs/{job_id}")
def get_job(job_id: str):
    if not db_client.is_configured():
        raise HTTPException(status_code=400, detail="Job tracking requires DATABASE_URL to be configured.")
    job = repo.get_job(job_id)
    if job is None:
        raise HTTPException(status_code=404, detail="Job not found")
    return job


# ------------------------------------------------------------
# Telegram integration
# ------------------------------------------------------------

TELEGRAM_BOT_TOKEN = os.environ.get("NEXUS_TELEGRAM_BOT_TOKEN")
TELEGRAM_API = f"https://api.telegram.org/bot{TELEGRAM_BOT_TOKEN}"
TELEGRAM_MAX_LEN = 4000  # Telegram's real limit is 4096; leaving a safety margin


def send_telegram_message(chat_id, text: str):
    """Sends a message to Telegram, automatically splitting it into multiple
    messages if it's longer than Telegram's per-message character limit."""
    if not text:
        text = "(empty response)"

    chunks = [text[i:i + TELEGRAM_MAX_LEN] for i in range(0, len(text), TELEGRAM_MAX_LEN)]

    for i, chunk in enumerate(chunks):
        label = f" (part {i + 1}/{len(chunks)})" if len(chunks) > 1 else ""
        response = requests.post(f"{TELEGRAM_API}/sendMessage", json={
            "chat_id": chat_id,
            "text": chunk + label
        })
        if response.status_code != 200:
            logger.error(f"Telegram send failed: {response.status_code} {response.text}")


def send_telegram_photo(chat_id, photo_url: str):
    """Downloads the image ourselves, then uploads it directly to Telegram."""
    try:
        img_response = requests.get(photo_url, timeout=30)
        img_response.raise_for_status()
        response = requests.post(
            f"{TELEGRAM_API}/sendPhoto",
            data={"chat_id": chat_id},
            files={"photo": ("image.png", img_response.content, "image/png")}
        )
        if response.status_code != 200:
            logger.error(f"Telegram photo send failed: {response.status_code} {response.text}")
    except Exception as e:
        logger.error(f"Failed to download/send image: {e}")
def send_telegram_video(chat_id, video_url: str):
    """Downloads the Veo-generated video (using the Gemini API key header),
    then uploads it directly to Telegram."""
    try:
        gemini_key = os.environ.get("GEMINI_API_KEY")
        headers = {"x-goog-api-key": gemini_key} if gemini_key else {}
        vid_response = requests.get(video_url, headers=headers, timeout=120)
        vid_response.raise_for_status()
        response = requests.post(
            f"{TELEGRAM_API}/sendVideo",
            data={"chat_id": chat_id},
            files={"video": ("video.mp4", vid_response.content, "video/mp4")}
        )
        if response.status_code != 200:
            logger.error(f"Telegram video send failed: {response.status_code} {response.text}")
    except Exception as e:
        logger.error(f"Failed to download/send video: {e}")


def send_telegram_voice(chat_id, audio_content: bytes):
    """Uploads synthesized speech audio directly to Telegram as a voice
    message (OGG/OPUS, Telegram's native voice-note format)."""
    try:
        response = requests.post(
            f"{TELEGRAM_API}/sendVoice",
            data={"chat_id": chat_id},
            files={"voice": ("voice.ogg", audio_content, "audio/ogg")}
        )
        if response.status_code != 200:
            logger.error(f"Telegram voice send failed: {response.status_code} {response.text}")
    except Exception as e:
        logger.error(f"Failed to send voice message: {e}")

_processed_update_ids: set[int] = set()
_MAX_TRACKED_UPDATES = 2000  # simple cap so this set doesn't grow forever


def _process_telegram_message(chat_id, text: str):
    """The actual work: run the Manager and send results back to Telegram.
    Runs in the background so the webhook can ack Telegram immediately —
    Telegram retries (and resends the same update) if it doesn't get a fast
    response, and Veo video generation is slow enough to trigger that."""
    # Telegram chat_id doubles as the customer's external_ref, so the same
    # person gets the same conversation history and deliverables whether
    # they talk to the bot or hit /api/task directly with a matching
    # customer_id.
    customer_id, project_id, history = _resolve_customer_context(f"telegram:{chat_id}")
    manager_request = text
    if _is_owner_chat(chat_id):
        # The manager receives this only for the configured owner chat. The
        # memory bridge is read-only public-market/paper evidence; it never
        # contains exchange credentials or a live execution capability.
        manager_request += context_for_owner_query(text)

    try:
        outcome = _run_manager_and_persist(
            manager_request, history, project_id, customer_id=customer_id
        )
        reply_text = outcome["result"]
        image_urls = outcome["image_urls"]
        video_urls = outcome["video_urls"]
    except Exception as e:
        logger.exception("Telegram task failed")
        reply_text = f"Sorry, something went wrong: {e}"
        image_urls = []
        video_urls = []

    send_telegram_message(chat_id, reply_text)
    for url in image_urls:
        send_telegram_photo(chat_id, url)
    for url in video_urls:
        send_telegram_video(chat_id, url)

    # Voice replies are the owner's personal channel only — this check is
    # the actual security boundary, not just an optimization. A customer
    # chat must never receive a voice reply even if voice is fully
    # configured for the owner.
    if not reply_text or not _is_owner_chat(chat_id):
        pass
    elif not voice.is_configured():
        logger.info(f"Voice reply skipped for owner chat {chat_id}: voice is not configured for this process.")
    else:
        try:
            logger.info(f"Synthesizing voice reply for owner chat {chat_id}...")
            audio_content = voice.synthesize_speech(reply_text)
            logger.info(f"Sending voice reply ({len(audio_content)} bytes) to owner chat {chat_id}...")
            send_telegram_voice(chat_id, audio_content)
            logger.info(f"Voice reply sent to owner chat {chat_id}.")
        except voice.VoiceError as e:
            logger.error(f"Voice reply skipped for owner chat {chat_id}: {e}")


def _download_telegram_file(file_id: str) -> bytes:
    info_response = requests.get(f"{TELEGRAM_API}/getFile", params={"file_id": file_id}, timeout=30)
    info_response.raise_for_status()
    file_path = info_response.json()["result"]["file_path"]
    file_response = requests.get(f"https://api.telegram.org/file/bot{TELEGRAM_BOT_TOKEN}/{file_path}", timeout=60)
    file_response.raise_for_status()
    return file_response.content


# ---------------------------------------------------------------------------
# Media understanding — Gemini multimodal
# ---------------------------------------------------------------------------

# MIME types Gemini can read directly as inline data
_GEMINI_READABLE_MIMES = {
    "image/jpeg", "image/png", "image/gif", "image/webp",
    "application/pdf",
    "text/plain", "text/html", "text/csv", "text/markdown",
    "application/json",
}


def _describe_with_gemini(content_bytes: bytes, mime_type: str, caption: str = "") -> str:
    """Use Gemini's multimodal capability to understand an image or document.
    Returns a plain-text description / analysis the Manager can act on."""
    api_key = os.environ.get("GEMINI_API_KEY")
    if not api_key:
        return (
            "I can see you sent a file but I can't analyse it right now — "
            "the vision API isn't configured yet. Please describe what's in "
            "the file and I'll help from there."
        )

    try:
        from google import genai
        from google.genai import types as genai_types

        client = genai.Client(api_key=api_key)

        prompt = (
            "The user sent this file to the AgenticCore.agency AI Manager. "
            + (f"Their caption: \"{caption}\". " if caption else "No caption was provided. ")
            + "Describe in detail what you see or read in this file, then explain how it "
            "could be useful for a business services request. Be specific and practical."
        )

        response = client.models.generate_content(
            model="gemini-flash-latest",
            contents=[
                genai_types.Part.from_bytes(data=content_bytes, mime_type=mime_type),
                genai_types.Part.from_text(text=prompt),
            ],
        )
        return response.text or "(Gemini returned an empty analysis.)"
    except Exception as e:
        logger.error(f"Gemini media analysis failed: {e}")
        return f"I received your file but couldn't analyse it automatically ({e}). Please describe what's in it and I'll help."


def _process_telegram_photo(chat_id, photos: list, caption: str = ""):
    """Download the highest-resolution version of a Telegram photo, run
    Gemini vision on it, then feed the analysis into the normal Manager
    pipeline so it can respond intelligently."""
    try:
        # Telegram sends photos as an array ordered low→high resolution.
        best = photos[-1]
        logger.info(f"Downloading photo from chat {chat_id} (file_id={best['file_id']})...")
        file_bytes = _download_telegram_file(best["file_id"])
        logger.info(f"Running Gemini vision on photo ({len(file_bytes)} bytes) from chat {chat_id}...")
        analysis = _describe_with_gemini(file_bytes, "image/jpeg", caption)
        logger.info(f"Gemini vision result for chat {chat_id}: {analysis[:120]}...")

        # Build a natural prompt that gives the Manager full context.
        parts = ["[📷 Image received]"]
        if caption:
            parts.append(f"User caption: {caption}")
        parts.append(f"\nGemini's analysis of the image:\n{analysis}")
        parts.append("\nPlease respond to the user based on this image and their caption.")
        _process_telegram_message(chat_id, "\n".join(parts))
    except Exception as e:
        logger.exception(f"Failed to process photo from chat {chat_id}")
        send_telegram_message(chat_id, f"Sorry, I couldn't process your image: {e}")


def _process_telegram_document(chat_id, document: dict, caption: str = ""):
    """Download a document sent to the bot, analyse it with Gemini if the
    file type is supported, then hand the result to the Manager."""
    mime_type = document.get("mime_type", "application/octet-stream")
    file_name = document.get("file_name", "file")
    file_size = document.get("file_size", 0)

    # Telegram limits bot file downloads to 20 MB; also Gemini inline data
    # works best under 10 MB for documents.
    MAX_BYTES = 10 * 1024 * 1024
    if file_size > MAX_BYTES:
        send_telegram_message(
            chat_id,
            f"📎 I received *{file_name}* but it's too large to analyse directly "
            f"({file_size // (1024*1024)} MB). Please share the key content as text "
            "and I'll help you work with it.",
        )
        return

    try:
        logger.info(f"Downloading document '{file_name}' ({mime_type}) from chat {chat_id}...")
        file_bytes = _download_telegram_file(document["file_id"])

        if mime_type in _GEMINI_READABLE_MIMES:
            logger.info(f"Running Gemini analysis on document ({len(file_bytes)} bytes)...")
            analysis = _describe_with_gemini(file_bytes, mime_type, caption)
            parts = [f"[📎 File received: {file_name}]"]
            if caption:
                parts.append(f"User caption: {caption}")
            parts.append(f"\nGemini's analysis:\n{analysis}")
            parts.append("\nPlease respond based on this file and help the user.")
        else:
            # Unsupported binary (e.g. .zip, .exe) — at least tell the Manager what arrived.
            parts = [f"[📎 File received: {file_name} ({mime_type})]"]
            if caption:
                parts.append(f"User caption: {caption}")
            parts.append(
                f"\nThis file type ({mime_type}) can't be read directly. "
                "Ask the user what they'd like to do with it or what it contains."
            )

        _process_telegram_message(chat_id, "\n".join(parts))
    except Exception as e:
        logger.exception(f"Failed to process document from chat {chat_id}")
        send_telegram_message(chat_id, f"Sorry, I couldn't process your file '{file_name}': {e}")


def _process_telegram_video(chat_id, video: dict, caption: str = ""):
    """Acknowledge a video — Gemini vision works on frames/thumbnails but
    full video understanding needs the Files API (not yet wired). For now
    we tell the user what we received and ask them to describe it."""
    file_name = video.get("file_name", "video")
    duration = video.get("duration", 0)
    # Try to grab the thumbnail if available
    thumb = video.get("thumb") or video.get("thumbnail")
    if thumb:
        try:
            file_bytes = _download_telegram_file(thumb["file_id"])
            analysis = _describe_with_gemini(file_bytes, "image/jpeg", caption or "Video thumbnail")
            parts = [f"[🎥 Video received: {file_name}, {duration}s]"]
            if caption:
                parts.append(f"User caption: {caption}")
            parts.append(f"\nThumbnail analysis: {analysis}")
            parts.append("\nNote: Full video understanding is not yet available — respond based on the thumbnail and caption.")
            _process_telegram_message(chat_id, "\n".join(parts))
            return
        except Exception:
            pass  # Fall through to text-only response

    # No thumbnail — just acknowledge
    parts = [f"[🎥 Video received: {file_name}, {duration}s]"]
    if caption:
        parts.append(f"User caption: {caption}")
    parts.append("Full video analysis is not yet available. Ask the user to describe the video content if they need help with it.")
    _process_telegram_message(chat_id, "\n".join(parts))


def _process_telegram_voice_message(chat_id, telegram_voice: dict):
    """Owner-only: transcribes an incoming voice note, then hands the
    transcript to the normal text pipeline — this is what makes
    voice-to-voice work, it's just voice-to-text followed by the existing
    text-to-voice reply, both already scoped to the owner's chat."""
    try:
        logger.info(f"Downloading voice note from owner chat {chat_id}...")
        audio_content = _download_telegram_file(telegram_voice["file_id"])
        logger.info(f"Transcribing voice note from owner chat {chat_id} ({len(audio_content)} bytes)...")
        transcript = voice.transcribe_speech(audio_content)
        logger.info(f"Transcribed voice note from owner chat {chat_id}: {transcript!r}")
    except voice.VoiceError as e:
        logger.error(f"Voice transcription failed for owner chat {chat_id}: {e}")
        send_telegram_message(chat_id, f"Sorry, I couldn't understand that voice message: {e}")
        return
    except Exception as e:
        logger.exception(f"Failed to download/transcribe voice note for owner chat {chat_id}")
        send_telegram_message(chat_id, f"Sorry, something went wrong processing that voice message: {e}")
        return

    _process_telegram_message(chat_id, transcript)


@app.post("/telegram-webhook")
async def telegram_webhook(
    request: dict,
    background_tasks: BackgroundTasks,
    x_telegram_bot_api_secret_token: str | None = Header(default=None),
):
    if not _is_valid_telegram_webhook_secret(x_telegram_bot_api_secret_token):
        logger.warning("Rejected Telegram update with missing or invalid webhook authentication.")
        raise HTTPException(status_code=403, detail="Invalid Telegram webhook authentication")
    update_id = request.get("update_id")

    # De-dupe: Telegram resends the same update if our response is slow
    # (video generation easily exceeds Telegram's webhook timeout). Without
    # this, a slow request gets processed — and billed — multiple times.
    if update_id is not None:
        if update_id in _processed_update_ids:
            logger.info(f"Ignoring duplicate Telegram update_id={update_id}")
            return {"ok": True}
        _processed_update_ids.add(update_id)
        if len(_processed_update_ids) > _MAX_TRACKED_UPDATES:
            _processed_update_ids.clear()

    message = request.get("message", {})
    chat_id = message.get("chat", {}).get("id")
    text = message.get("text", "")
    caption = message.get("caption", "")  # caption on photos/files
    telegram_voice = message.get("voice")
    telegram_photo = message.get("photo")     # array of PhotoSize objects
    telegram_document = message.get("document")
    telegram_video = message.get("video")
    telegram_sticker = message.get("sticker")

    if not chat_id:
        return {"ok": True}

    if telegram_voice:
        # Voice input is the owner's channel only — a customer sending a
        # voice note gets a helpful nudge instead of silence.
        if _is_owner_chat(chat_id):
            background_tasks.add_task(_process_telegram_voice_message, chat_id, telegram_voice)
        else:
            background_tasks.add_task(
                send_telegram_message, chat_id,
                "Voice messages aren't supported here — please type your message and I'll help right away.",
            )

    elif telegram_photo:
        # Photos — run Gemini vision then route through Manager.
        background_tasks.add_task(_process_telegram_photo, chat_id, telegram_photo, caption)

    elif telegram_document:
        # Documents (PDFs, images sent as files, text files, etc.)
        background_tasks.add_task(_process_telegram_document, chat_id, telegram_document, caption)

    elif telegram_video:
        # Videos — analyse thumbnail; full video parsing not yet available.
        background_tasks.add_task(_process_telegram_video, chat_id, telegram_video, caption)

    elif telegram_sticker:
        # Stickers — just acknowledge with a friendly reply.
        background_tasks.add_task(
            _process_telegram_message, chat_id,
            "[Sticker received] The user sent a sticker. Respond in a friendly, brief way."
        )

    elif text:
        background_tasks.add_task(_process_telegram_message, chat_id, text)

    return {"ok": True}
