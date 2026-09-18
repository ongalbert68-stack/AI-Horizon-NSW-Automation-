from functools import lru_cache
from pathlib import Path

from pydantic_settings import BaseSettings, SettingsConfigDict

BACKEND_ROOT = Path(__file__).resolve().parent.parent.parent


class Settings(BaseSettings):
    """Backend configuration, loaded from environment variables / .env."""

    model_config = SettingsConfigDict(env_file=".env", env_file_encoding="utf-8", extra="ignore")

    app_name: str = "AI Horizon NSW Automation — Troubleshooting Pipeline"
    api_prefix: str = "/api"

    # SQLite: one file, no daemon. "Temporary" in the sense the prototype
    # needs — delete it and the ERD is empty again — while SQLAlchemy still
    # enforces the same foreign keys and relationships as a "real" database.
    sqlite_path: str = "pipeline.db"

    # Next.js falls back to 3001+ if 3000 is already taken by something
    # else on the machine (common in this dev environment) — listing both
    # avoids a CORS failure that looks like a backend bug but isn't one.
    cors_origins: list[str] = ["http://localhost:3000", "http://localhost:3001"]

    # Optional LLM reasoner (pass 2 critic + intake free-text mapping).
    # llama-3.1-8b-instant (DESIGN.md's original pick) was retired from
    # Groq's catalog — confirmed via GET /openai/v1/models, a live 404, not
    # a bug here. openai/gpt-oss-20b is its closest live equivalent: small,
    # fast, cheap. Blank key just means these code paths report
    # "unavailable" — nothing else in the pipeline depends on it.
    groq_api_key: str = ""
    groq_model: str = "openai/gpt-oss-20b"
    llm_calls_per_session: int = 2

    @property
    def database_url(self) -> str:
        return f"sqlite:///{BACKEND_ROOT / self.sqlite_path}"


@lru_cache
def get_settings() -> Settings:
    return Settings()
