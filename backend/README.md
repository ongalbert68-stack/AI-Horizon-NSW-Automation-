# Backend

FastAPI + SQLAlchemy + Alembic, backed by PostgreSQL. See the repo-root
README for the full local setup (Postgres via compose, then this).

## Layout

```
app/
  core/     settings (pydantic-settings) and the SQLAlchemy engine/session
  models/   ORM models — the ERD (DispenseStation, DispenseProfile,
            FluidMaterial, Case, CheckResult) and their relationships
  schemas/  Pydantic request/response models
  crud/     DB access functions used by the routers
  routers/  APIRouter per resource — the req/res layer FastAPI documents at /docs
  main.py   app factory: CORS, router registration, OpenAPI metadata
  seed.py   optional sample data for local dev
alembic/    migrations; env.py reads the DB URL from app settings
```

## Commands

```bash
uv sync                                    # install deps
uv run alembic upgrade head                # apply migrations
uv run python -m app.seed                  # optional: sample data
uv run uvicorn app.main:app --reload       # dev server -> http://localhost:8000
```

Interactive API docs: `/docs` (Swagger) and `/redoc`.

## Editor setup (type checking)

`pyrightconfig.json` and `pyrefly.toml` both point at this project's own
`.venv`, not whatever interpreter happens to be active in your shell —
so "go to definition" and import resolution work the same on macOS,
Linux, and Windows without per-developer setup, as long as you've run
`uv sync` at least once. If your editor still shows unresolved imports,
reload its Python/Pyrefly language server after `uv sync` creates `.venv`.

## Changing the schema

Edit the models under `app/models/`, then:

```bash
uv run alembic revision --autogenerate -m "describe the change"
uv run alembic upgrade head
```
