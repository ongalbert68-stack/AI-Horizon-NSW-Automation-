from functools import lru_cache

from pydantic_settings import BaseSettings, SettingsConfigDict


class Settings(BaseSettings):
    """Backend configuration, loaded from environment variables / .env."""

    model_config = SettingsConfigDict(env_file=".env", env_file_encoding="utf-8", extra="ignore")

    app_name: str = "AI Horizon NSW Automation API"
    api_prefix: str = "/api"

    postgres_host: str = "localhost"
    postgres_port: int = 5433
    postgres_user: str = "ai_horizon"
    postgres_password: str = "ai_horizon"
    postgres_db: str = "ai_horizon_nsw"

    cors_origins: list[str] = ["http://localhost:3000"]

    # Optional LLM reasoner. llama-3.1-8b-instant (the original pick) was
    # retired from Groq's catalog — confirmed via a live 404 on GET
    # /openai/v1/models, not a bug here. openai/gpt-oss-20b is its closest
    # live equivalent: small, fast, cheap. Blank key means no LLM step is
    # available; nothing else in this API depends on it.
    groq_api_key: str = ""
    groq_model: str = "openai/gpt-oss-20b"

    @property
    def database_url(self) -> str:
        return (
            f"postgresql+psycopg://{self.postgres_user}:{self.postgres_password}"
            f"@{self.postgres_host}:{self.postgres_port}/{self.postgres_db}"
        )


@lru_cache
def get_settings() -> Settings:
    return Settings()
