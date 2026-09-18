"""W7 call-1: turn free text ("Other / describe") into one of the fixed
option values for that axis, so the fingerprint never grows an ad-hoc
vocabulary. If the model can't map it, or isn't configured, the caller
keeps the raw text and marks the axis unmapped — this function only ever
returns a value that was already in the question's own option list, never
something invented."""

from app.domains.intake.spec import question_by_id
from app.domains.llm import client as llm_client


def map_free_text(question_id: str, text: str) -> tuple[str | None, bool]:
    """Returns (mapped_value_or_None, used_llm)."""
    question = question_by_id(question_id)
    if question is None:
        return None, False

    if not llm_client.is_configured():
        return None, False

    option_list = "\n".join(
        f"- {o.value}: {o.label}" + (f" ({o.help_text})" if o.help_text else "")
        for o in question.options
    )
    reply = llm_client.chat(
        [
            {
                "role": "system",
                "content": (
                    "You map a free-text description onto exactly one option value "
                    "from a fixed list, or say NONE if nothing fits. Reply with only "
                    "the option value or the word NONE — nothing else."
                ),
            },
            {
                "role": "user",
                "content": f"Question: {question.prompt}\n\nOptions:\n{option_list}\n\nText: {text!r}",
            },
        ],
        max_tokens=80,
    )
    if reply is None:
        return None, False

    candidate = reply.strip().strip(".").lower()
    valid_values = {o.value for o in question.options}
    return (candidate if candidate in valid_values else None), True
