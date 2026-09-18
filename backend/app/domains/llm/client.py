"""Thin Groq client. Groq's chat-completions endpoint is OpenAI-compatible,
so a plain httpx POST is enough — no SDK dependency for one call shape.

Every call site is expected to check `is_configured()` first and to have
its own per-case "already used" flag (see cases/model.py's llm_*_used
columns) — this module does not enforce the budget itself, it just makes
one call when asked.
"""

import httpx

from app.core.config import get_settings

GROQ_CHAT_URL = "https://api.groq.com/openai/v1/chat/completions"


def is_configured() -> bool:
    return bool(get_settings().groq_api_key)


def chat(
    messages: list[dict[str, str]], *, temperature: float = 0.2, max_tokens: int = 600
) -> str | None:
    """One chat-completion call. Returns None (never raises) on any
    failure — missing key, network error, bad response — so a caller can
    always fall back to the deterministic, code-written path DESIGN.md
    requires when the LLM step is unavailable.

    openai/gpt-oss-20b is a reasoning model: it spends completion tokens on
    a hidden `reasoning` field before `content`, so a small max_tokens can
    exhaust the budget before any content is written. reasoning_effort
    "low" keeps that overhead small for the short, structured tasks this
    pipeline actually asks of it (map one value, rank 7 causes, write a
    few sentences) — none of them need deep chain-of-thought.
    """
    settings = get_settings()
    if not settings.groq_api_key:
        return None

    try:
        response = httpx.post(
            GROQ_CHAT_URL,
            headers={"Authorization": f"Bearer {settings.groq_api_key}"},
            json={
                "model": settings.groq_model,
                "messages": messages,
                "temperature": temperature,
                "max_tokens": max_tokens,
                "reasoning_effort": "low",
            },
            timeout=20.0,
        )
        response.raise_for_status()
        content = response.json()["choices"][0]["message"]["content"]
        return content or None
    except (httpx.HTTPError, KeyError, IndexError):
        return None
