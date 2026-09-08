# AgenticCore.agency

AgenticCore.agency is a multi-agent AI business and digital-delivery platform. Its Gemini Manager routes customer requests to 22 specialist agents for business planning, websites, content, SEO, documents, media, smart contracts, analytics, and deployment.

## AI roles

- 1 Manager/orchestrator
- 22 specialist agents
- 23 total AI roles

The authoritative specialist registry is `services/ai-backend/agents.py`.

## Repository layout

- `apps/customer-web` — customer-facing React/Vite application
- `apps/admin-dashboard` — operations dashboard
- `apps/api-server` — shared TypeScript/Express API, including Agency auth, credits, tasks, and AI-backend forwarding
- `services/ai-backend` — Python/FastAPI Manager and specialist framework
- `packages/api-client-react` — generated React Query client
- `packages/api-zod` — generated API validation types
- `packages/db` — PostgreSQL/Drizzle database package and schemas

## Main capabilities

- Gemini Manager with multi-step specialist routing
- 22 registered specialists
- Multi-page website generation and targeted file edits
- Versioned projects and deliverables
- Background jobs and progress events
- Telegram and owner-only multilingual voice flows
- Image generation through Ideogram
- Video generation through Gemini Veo
- Vercel deployment foundation

## Local setup

Requirements: Node.js 20+, pnpm, and Python 3.11+.

```bash
cp .env.example .env
pnpm install
pnpm --filter @workspace/api-server run dev
pnpm --filter @workspace/agenticcore-agency run dev
pnpm --filter @workspace/agenticcore-agency-dashboard run dev
```

In a separate terminal:

```bash
cd services/ai-backend
python3 -m pip install -r requirements.txt
python3 -m uvicorn main:app --host 0.0.0.0 --port 8000
```

Configure required values using environment variables or a secrets manager. Never commit `.env` files or credentials.

## Validation status

The FastAPI service compiles and its health endpoint runs successfully. The Manager registers 22 specialist agents. Database-backed persistence requires a valid PostgreSQL/Supabase connection and should be verified before relying on saved conversations, deliverables, or job state.

## Known limitations

- Full uploaded-video understanding is not complete; current Telegram handling primarily uses thumbnails and supported documents/images.
- Deployment is strongest for self-contained HTML and needs expansion for production-grade multi-file applications.
- Database reliability and complete end-to-end regression coverage require further validation.
- Generated legal and smart-contract materials require qualified human review.

## Security

This export intentionally excludes environment files, credentials, caches, generated builds, local databases, and runtime logs. `.env.example` contains variable names only.
