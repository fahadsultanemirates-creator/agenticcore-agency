"""
Voice, via Google Cloud Text-to-Speech and Speech-to-Text.

This is the owner's personal voice channel with the Manager — never
customer-facing (see main.py's OWNER_TELEGRAM_CHAT_ID gating). Auth for
both directions is loaded from GOOGLE_TTS_CREDENTIALS_JSON — the full
service account key JSON, stored as a Secret (not a file path). The
service account needs both the "Cloud Text-to-Speech User" and "Cloud
Speech Client" roles. Loaded straight from the env var into memory via
from_service_account_info(); the key material is never written to disk.

Language is auto-detected from the text being synthesised so the Manager
always speaks in the same language it replies in (English, Arabic, Urdu,
Hindi, French, Spanish, German, Turkish, Chinese, …). Speech recognition
also accepts all those languages so the owner can send voice notes in any
of them.
"""

import json
import logging
import os

logger = logging.getLogger("agenticcore-agency.voice")

# OGG_OPUS is Telegram's native voice-message format — both what Telegram
# sends us (incoming voice notes) and what sendVoice expects (outgoing), so
# no transcoding is needed in either direction.
_AUDIO_ENCODING_NAME = "OGG_OPUS"
_TELEGRAM_VOICE_SAMPLE_RATE_HZ = 48000

# Google Cloud TTS caps input at 5000 bytes per request; well beyond that,
# voice replies also stop being a reasonable UX (e.g. a full HTML source
# dump read aloud), so this is both a safety margin and a sanity cap.
MAX_TTS_CHARS = 3000

# ---------------------------------------------------------------------------
# Language detection — Unicode-range based, no external deps needed.
# Each entry: (language_code, voice_name)
# We default to en-US if nothing else matches.
# ---------------------------------------------------------------------------
_DEFAULT_VOICE = ("en-US", "en-US-Neural2-F")

# Map from detected script/language to (BCP-47 language_code, voice_name).
# Google Cloud TTS Neural2 / Wavenet voices used where available.
_VOICE_MAP: dict[str, tuple[str, str]] = {
    "ar":  ("ar-XA",  "ar-XA-Neural2-A"),   # Arabic / Urdu (share Unicode block)
    "hi":  ("hi-IN",  "hi-IN-Neural2-A"),   # Hindi (Devanagari)
    "zh":  ("cmn-CN", "cmn-CN-Wavenet-A"),  # Simplified Chinese (CJK block)
    "fr":  ("fr-FR",  "fr-FR-Neural2-A"),   # French
    "es":  ("es-ES",  "es-ES-Neural2-A"),   # Spanish
    "de":  ("de-DE",  "de-DE-Neural2-F"),   # German
    "tr":  ("tr-TR",  "tr-TR-Wavenet-A"),   # Turkish
    "ja":  ("ja-JP",  "ja-JP-Neural2-B"),   # Japanese (Hiragana/Katakana)
    "ko":  ("ko-KR",  "ko-KR-Neural2-A"),   # Korean (Hangul)
    "ru":  ("ru-RU",  "ru-RU-Neural2-A"),   # Russian (Cyrillic)
    "pt":  ("pt-BR",  "pt-BR-Neural2-A"),   # Portuguese
    "it":  ("it-IT",  "it-IT-Neural2-A"),   # Italian
}

# (unicode_start, unicode_end, lang_key) — checked in order; first match wins.
_SCRIPT_RANGES = [
    (0x0600, 0x06FF, "ar"),   # Arabic / Urdu
    (0x0900, 0x097F, "hi"),   # Devanagari (Hindi, Marathi, Sanskrit)
    (0x4E00, 0x9FFF, "zh"),   # CJK Unified Ideographs (Chinese/Japanese)
    (0x3040, 0x30FF, "ja"),   # Hiragana + Katakana
    (0xAC00, 0xD7AF, "ko"),   # Hangul
    (0x0400, 0x04FF, "ru"),   # Cyrillic
]


def _detect_voice_params(text: str) -> tuple[str, str]:
    """Return (language_code, voice_name) by analysing the Unicode content
    of *text*.  Falls back to English if no non-Latin script is dominant."""
    if not text:
        return _DEFAULT_VOICE

    alpha_chars = [c for c in text if c.isalpha()]
    total = max(len(alpha_chars), 1)

    # Count characters in each known script range.
    counts: dict[str, int] = {}
    for ch in alpha_chars:
        cp = ord(ch)
        for (start, end, lang) in _SCRIPT_RANGES:
            if start <= cp <= end:
                counts[lang] = counts.get(lang, 0) + 1
                break

    if counts:
        best_lang, best_count = max(counts.items(), key=lambda x: x[1])
        # Require at least 20 % of alphabetic chars to be in that script.
        if best_count / total >= 0.20:
            return _VOICE_MAP.get(best_lang, _DEFAULT_VOICE)

    # Try a quick Latin-script language guess via common word lists.
    lower = text.lower()
    if any(w in lower for w in ["vous", "nous", "bonjour", "merci", "oui", "est-ce"]):
        return _VOICE_MAP["fr"]
    if any(w in lower for w in ["hola", "gracias", "cómo", "qué", "por favor", "buenos"]):
        return _VOICE_MAP["es"]
    if any(w in lower for w in ["danke", "bitte", "guten", "wie", "nicht", "hallo"]):
        return _VOICE_MAP["de"]
    if any(w in lower for w in ["grazie", "prego", "ciao", "buongiorno", "come"]):
        return _VOICE_MAP["it"]

    return _DEFAULT_VOICE


# Languages accepted by Speech-to-Text (all variants the owner might speak in).
_STT_LANGUAGES = [
    "en-US",   # English (primary)
    "ar-XA",   # Arabic
    "ur-PK",   # Urdu
    "hi-IN",   # Hindi
    "fr-FR",   # French
    "es-ES",   # Spanish
    "de-DE",   # German
    "tr-TR",   # Turkish
    "ru-RU",   # Russian
    "pt-BR",   # Portuguese
    "it-IT",   # Italian
    "zh-CN",   # Simplified Chinese
    "ja-JP",   # Japanese
    "ko-KR",   # Korean
]


class VoiceError(Exception):
    pass


def is_configured() -> bool:
    return bool(os.environ.get("GOOGLE_TTS_CREDENTIALS_JSON"))


def _load_credentials():
    """Shared by synthesize_speech and transcribe_speech. Raises VoiceError
    on any problem; logs the service account email (never the key
    material) so a live run confirms which identity was actually loaded."""
    creds_json = os.environ.get("GOOGLE_TTS_CREDENTIALS_JSON")
    if not creds_json:
        raise VoiceError("GOOGLE_TTS_CREDENTIALS_JSON is not set.")

    try:
        from google.oauth2 import service_account
    except ImportError as e:
        raise VoiceError(f"google-auth is not installed: {e}")

    try:
        creds_info = json.loads(creds_json)
    except json.JSONDecodeError as e:
        raise VoiceError(f"GOOGLE_TTS_CREDENTIALS_JSON is not valid JSON: {e}")

    logger.info(
        f"Loading Google voice credentials for service account "
        f"{creds_info.get('client_email', '<missing client_email>')!r}"
    )
    return service_account.Credentials.from_service_account_info(creds_info)


def synthesize_speech(text: str) -> bytes:
    """Synthesises text to speech, returning OGG/OPUS audio bytes ready to
    hand to Telegram's sendVoice.  Language is auto-detected from the text
    so the Manager speaks in whatever language it replied in.
    Raises VoiceError on any failure."""
    if len(text) > MAX_TTS_CHARS:
        text = text[:MAX_TTS_CHARS] + "... (truncated for voice reply)"

    language_code, voice_name = _detect_voice_params(text)
    logger.info(f"TTS language detected: {language_code} → voice {voice_name} ({len(text)} chars)")

    try:
        from google.cloud import texttospeech
    except ImportError as e:
        raise VoiceError(f"google-cloud-texttospeech is not installed: {e}")

    credentials = _load_credentials()
    try:
        client = texttospeech.TextToSpeechClient(credentials=credentials)
        response = client.synthesize_speech(
            input=texttospeech.SynthesisInput(text=text),
            voice=texttospeech.VoiceSelectionParams(
                language_code=language_code,
                name=voice_name,
            ),
            audio_config=texttospeech.AudioConfig(
                audio_encoding=getattr(texttospeech.AudioEncoding, _AUDIO_ENCODING_NAME),
            ),
        )
        logger.info(f"Cloud Text-to-Speech returned {len(response.audio_content)} bytes of audio.")
        return response.audio_content
    except VoiceError:
        raise
    except Exception as e:
        raise VoiceError(f"Speech synthesis failed: {e}")


def transcribe_speech(audio_content: bytes) -> str:
    """Transcribes OGG/OPUS audio bytes (e.g. a downloaded Telegram voice
    note) to text.  Accepts speech in any of the supported languages —
    Google STT auto-selects the best match.
    Raises VoiceError on any failure, including when no speech is recognized."""
    try:
        from google.cloud import speech
    except ImportError as e:
        raise VoiceError(f"google-cloud-speech is not installed: {e}")

    credentials = _load_credentials()
    try:
        client = speech.SpeechClient(credentials=credentials)
        primary, *alternatives = _STT_LANGUAGES

        logger.info(
            f"Calling Cloud Speech-to-Text recognize ({len(audio_content)} bytes, "
            f"primary={primary}, alternatives={len(alternatives)})..."
        )
        response = client.recognize(
            config=speech.RecognitionConfig(
                encoding=speech.RecognitionConfig.AudioEncoding.OGG_OPUS,
                sample_rate_hertz=_TELEGRAM_VOICE_SAMPLE_RATE_HZ,
                language_code=primary,
                alternative_language_codes=alternatives,
            ),
            audio=speech.RecognitionAudio(content=audio_content),
        )
        transcript = " ".join(
            result.alternatives[0].transcript
            for result in response.results
            if result.alternatives
        ).strip()
        logger.info(f"Cloud Speech-to-Text returned a {len(transcript)}-char transcript.")
        if not transcript:
            raise VoiceError("No speech was recognized in the audio.")
        return transcript
    except VoiceError:
        raise
    except Exception as e:
        raise VoiceError(f"Speech transcription failed: {e}")
