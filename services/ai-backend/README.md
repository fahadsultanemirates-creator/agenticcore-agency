# Nexus Studio — AI Agent Backend

## What this is
A FastAPI backend that exposes `/api/task`: a customer request comes in, the
Manager agent (Gemini) either answers directly or routes to one or more
specialist agents, and the combined result is returned. Work is persisted to
Postgres (Supabase) so it can be looked up and revised instead of
regenerated from scratch, and multi-step/slow work can run as a background
job instead of blocking the request.

**Specialist agents:** feasibility, site architecture, development, QA,
content, marketing, bookkeeping, legal/compliance, SEO, localization,
image, video, deployment, deep business analysis (Gemini Pro-tier), and
live site auditing.

**Voice** is a personal channel between the owner and the Manager only —
never customer-facing. When configured, the single Telegram chat matching
`OWNER_TELEGRAM_CHAT_ID` gets voice-to-voice, voice-to-text, and
text-to-voice; every other chat stays text-only regardless of voice
configuration. See `integrations/voice.py` and the `_is_owner_chat` check
in `main.py` — that check is a security boundary, not a convenience.

## Project layout
```
main.py            FastAPI app: /api/task, /api/jobs/{id}, Telegram webhook
agents.py           Manager + specialist agent definitions (Gemini)
db/                 SQLAlchemy models, session handling, repository functions
db/migrations/      Alembic migrations
jobs/                Background job execution (jobs + job_events tables)
integrations/       Shared external-call helpers (starts with fetch_url)
```

## Required environment variables (Replit Secrets)
| Variable | Required for |
|---|---|
| `GEMINI_API_KEY` | Everything — get one free at [aistudio.google.com](https://aistudio.google.com) |
| `DATABASE_URL` | Persistence: conversation memory, saved/editable deliverables, background jobs. Without it the backend still runs, just stateless (same as before this rebuild). Use your Supabase project's Postgres connection string (Project Settings → Database → Connection string → URI). |
| `IDEOGRAM_API_KEY` | `image_agent` |
| `VERCEL_API_TOKEN` | `deployment_agent` |
| `TELEGRAM_BOT_TOKEN` | Telegram integration |
| `GOOGLE_TTS_CREDENTIALS_JSON` | Voice (both directions). The full Google Cloud service account key **JSON** (not a file path) — paste the whole key as the Secret's value. Grant this service account both the "Cloud Text-to-Speech User" and "Cloud Speech Client" roles. Optional: without it, all Telegram replies are text-only. |
| `OWNER_TELEGRAM_CHAT_ID` | Required alongside `GOOGLE_TTS_CREDENTIALS_JSON` to enable voice at all — voice is disabled (fail closed) unless **both** are set. The numeric Telegram chat ID of the owner's personal 1:1 chat with the bot; this is the only chat that ever gets voice. Find it by messaging the bot and checking the logs, or via a tool like @userinfobot. |

## Setup on Replit

1. Add the Secrets above (at minimum `GEMINI_API_KEY`; add `DATABASE_URL`
   to enable persistence and jobs).
2. Install dependencies:
   ```
   pip install -r requirements.txt
   ```
3. If `DATABASE_URL` is set, apply migrations before first run:
   ```
   alembic upgrade head
   ```
4. Run it:
   ```
   uvicorn main:app --host 0.0.0.0 --port 8000
   ```
5. Test it — open `/docs` for the interactive Swagger UI, or:
   ```json
   POST /api/task
   {"customer_id": "test1", "request": "I want a simple 3-page website for a coffee shop"}
   ```
   Send a follow-up with the same `customer_id` (e.g. "add a pricing
   section") — with `DATABASE_URL` set, the Manager remembers the
   conversation and revises the site instead of starting over.

   For slow/multi-step work (e.g. `deep_analysis_agent`), pass
   `"async_mode": true` in the request body — you get a `job_id` back
   immediately, then poll `GET /api/jobs/{job_id}` for status and result.

## Schema changes
This project uses Alembic. After changing `db/models.py`:
```
alembic revision --autogenerate -m "describe the change"
alembic upgrade head
```

## Adding another specialist agent
Follow the shape of an existing agent in `agents.py`: write the function
(the docstring is what the Manager sees when deciding whether to call it),
add it to `SPECIALIST_TOOLS` and `AGENT_MAP`, add an entry to
`DELIVERABLE_TYPE_MAP` (and `EDITABLE_AGENTS` if revising makes sense for
it), add the corresponding value to `DeliverableType` in `db/models.py`
plus a migration, and mention it in `MANAGER_SYSTEM_PROMPT`.

## If something breaks
1. Is `GEMINI_API_KEY` set? (Most common failure.)
2. If persistence/jobs aren't working: is `DATABASE_URL` set, and has
   `alembic upgrade head` been run against it?
3. Check the Shell for a Python traceback — that's almost always where the
   real problem is.
