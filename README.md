# AI Horizon — NSW Automation

## Case desk (frontend/ + backend/)

A FastAPI + PostgreSQL backend and a Next.js/shadcn frontend for tracking
dispense-defect investigations, built around this ERD:

```
DispenseStation ──┐          DispenseProfile ──▶ FluidMaterial
  (the machine)    │ ran on    (the job)
                    ▼
                  Case ──1..n──▶ CheckResult
             (one problem)   (the loop log)
```

- **backend/** — FastAPI, SQLAlchemy models for the ERD, Alembic migrations,
  a router per resource under `/api`, interactive docs at `/docs`.
- **frontend/** — Next.js App Router, shadcn/ui (Base UI) components, a
  Cmd/Ctrl+K command palette for keyboard nav, and a TanStack
  Table + Virtual list for cases.

### Quickstart

Three pieces, three terminals — Postgres, then backend, then frontend.

**1. PostgreSQL**

```bash
cp .env.example .env
docker compose up -d      # or: podman compose up -d
```

Runs on **port 5433** (not 5432 — avoids clashing with other local Postgres
containers). Change `POSTGRES_PORT` in `.env` if 5433 is also taken.

**2. Backend** (FastAPI, in `backend/`)

```bash
cd backend
cp .env.example .env      # POSTGRES_* here must match the root .env
uv sync
uv run alembic upgrade head
uv run python -m app.seed          # optional sample data
uv run uvicorn app.main:app --reload
```

→ http://localhost:8000, docs at http://localhost:8000/docs. `backend/.env`'s
`POSTGRES_HOST=localhost` + `POSTGRES_PORT=5433` is what connects it to the
container from step 1.

**3. Frontend** (Next.js, in `frontend/`)

```bash
cd frontend
cp .env.local.example .env.local
pnpm install
pnpm dev
```

→ http://localhost:3000. `NEXT_PUBLIC_API_BASE_URL` in `.env.local` is what
points it at the backend from step 2.

**Check the three are actually talking to each other:**

```bash
curl http://localhost:8000/api/health        # backend is up
curl http://localhost:8000/api/cases          # backend reached Postgres (200 + JSON, even if empty)
```

Then open http://localhost:3000/cases — if the seeded case (or an empty
"no cases yet" state, not an error) shows up, all three are connected.

See `backend/README.md` and `frontend/README.md` for more detail on each
side.

### Optional: LLM reasoner (Groq / llama-3.1-8b-instant)

Nothing above needs this — the API and UI run fully without it. To enable
the LLM reasoner step for case diagnosis:

1. Get a free key at https://console.groq.com/keys.
2. Set `GROQ_API_KEY` in `backend/.env` (`GROQ_MODEL` already defaults to
   `llama-3.1-8b-instant` — the Groq model with the highest free daily
   ceiling, 14,400 requests/day, and the lowest latency).
3. Restart the backend.

A blank `GROQ_API_KEY` just means that code path is unavailable — nothing
else in the API depends on it.

## Existing prototype (App.py, Bridge.py, Memory.py, Retrieval.py)

The Streamlit + ChromaDB + SQLite prototype at the repo root is untouched
by the above — it's a separate, earlier proof of concept for the
retrieval/diagnosis flow and keeps its own `dispensing_history.db` and
`chroma_db/`.
