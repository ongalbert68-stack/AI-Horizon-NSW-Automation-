"""W7 call-2: writes the final explanation from the top 3 causes' own
evidence (competitors included). A validator checks every citation the
model used was actually among the sources it was given; if it invents one,
the deterministic, code-written explanation is shown instead, labelled as
such — DESIGN.md's forbidden_claims check, promoted from test time to run
time, applied here to citations since there is no separate passage store
to check retrieval against in this prototype."""

import re

from app.domains.llm import client as llm_client


def _citations_in(text: str) -> set[str]:
    return set(re.findall(r"(?:matc82 sec [\d.]+ p\.[\d-]+|brief p\.[\d-]+)", text))


def _code_written_explanation(top3: list[dict]) -> str:
    lines = []
    for rank, cause in enumerate(top3, start=1):
        pct = round(cause["likelihood"] * 100)
        top_evidence = cause["evidence"][:2]
        reasons = "; ".join(f"{e['detail']} ({e['source']})" for e in top_evidence) or "no evidence fired yet"
        lines.append(f"{rank}. {cause['label']} — {pct}%: {reasons}")
    return "Ranked by the deterministic rule engine (no LLM explanation available):\n" + "\n".join(lines)


def write_explanation(top3: list[dict]) -> tuple[str, bool]:
    """Returns (explanation_text, was_llm_generated)."""
    fallback = _code_written_explanation(top3)
    if not llm_client.is_configured():
        return fallback, False

    known_sources = {e["source"] for cause in top3 for e in cause["evidence"]}
    cause_block = "\n\n".join(
        f"{c['label']} ({round(c['likelihood'] * 100)}%):\n"
        + "\n".join(f"- {e['detail']} [{e['source']}]" for e in c["evidence"])
        for c in top3
    )
    reply = llm_client.chat(
        [
            {
                "role": "system",
                "content": (
                    "Write a short, plain-language explanation (3-5 sentences) of why the "
                    "top cause leads, mentioning the runners-up. Only cite sources exactly as "
                    "given in brackets — never invent a section or page number."
                ),
            },
            {"role": "user", "content": cause_block},
        ],
        max_tokens=600,
    )
    if reply is None:
        return fallback, False

    cited = _citations_in(reply)
    if cited and not cited.issubset(known_sources):
        return fallback, False  # invented a citation — validator rejects it

    return reply, True
