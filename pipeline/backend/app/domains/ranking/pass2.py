"""Step 5, pass 2 — the critic. DESIGN.md: "The LLM reasoner over the
complaint and the photo, given no signals... Pass 2 is an error detector,
not a voter — its ranking is never merged into Pass 1's."

llama-3.1-8b-instant is text-only, so "the photo" here means the complaint
text plus station/material metadata only — never fingerprint.axes (pass
1's structured answers) and never fingerprint.signals. That's what makes
this a genuinely different view rather than pass 1 re-read: if a vision-
capable model is swapped in later, the image bytes are the only thing to
add here, not the axis answers.
"""

import json
import re

from app.domains.causes.vocabulary import load_causes
from app.domains.llm import client as llm_client

MIN_TOP_PCT = 25.0
"""Below this, the critic's own top pick isn't an opinion worth vetoing on."""

MIN_LEAD_PCT = 10.0
"""And it has to actually prefer that pick over the next one.

Both are placeholders in exactly the sense DESIGN.md's "Known risks"
means: unmeasured until W10 reports the critic's error rate. They are set
where they are because a veto is the strongest action in the gate — it
collapses the tier to T3/T4 and refuses to name a cause — so the critic
has to have said something before it gets one.
"""


def critic_verdict(pass2_result: list[dict] | None) -> tuple[str | None, str]:
    """Reduce the critic's ranking to (top_cause_id_or_None, note).

    None means *abstained*, not *agreed*: "an error detector, not a voter"
    only makes sense if a detector that found nothing stays silent. A model
    that rates all seven causes at 5% has no view on which is right, and
    reading its argmax as a dissenting vote was throwing away pass 1's
    result on a coin flip — every ranked case in the shipped database
    landed at T4 that way, including one sitting at 97% after a confirmed
    check.
    """
    if not pass2_result:
        return None, "Critic did not run (no LLM key configured) — not counted either way."

    ordered = sorted(pass2_result, key=lambda r: -r["likelihood_pct"])
    top = ordered[0]
    runner_up_pct = ordered[1]["likelihood_pct"] if len(ordered) > 1 else 0.0
    lead = top["likelihood_pct"] - runner_up_pct

    if top["likelihood_pct"] < MIN_TOP_PCT:
        return None, (
            f"Critic's highest cause was only {top['likelihood_pct']:.0f}%, under the "
            f"{MIN_TOP_PCT:.0f}% floor — it has no candidate, so it abstains rather than dissents."
        )
    if lead < MIN_LEAD_PCT:
        return None, (
            f"Critic spread its confidence almost evenly (top {top['likelihood_pct']:.0f}%, "
            f"next {runner_up_pct:.0f}%) — no clear pick, so it abstains rather than dissents."
        )

    return top["cause_id"], (
        f"Critic's own pick: {top['cause_id']} at {top['likelihood_pct']:.0f}% "
        f"(next {runner_up_pct:.0f}%)."
    )


def critic_pass(
    complaint_text: str | None, dispenser_class: str, material_family: str
) -> list[dict] | None:
    """Returns [{cause_id, likelihood_pct}, ...] or None if unavailable."""
    if not llm_client.is_configured():
        return None

    causes = load_causes()
    cause_list = "\n".join(f"- {c['id']}: {c['label']}" for c in causes)
    reply = llm_client.chat(
        [
            {
                "role": "system",
                "content": (
                    "You are a dispensing-defect triage assistant. Given only an "
                    "operator's complaint and basic machine context (no measurements), "
                    "rank how likely each candidate cause is. Reply with strict JSON: "
                    '[{"cause_id": "...", "likelihood_pct": 0-100}, ...] for every '
                    "candidate cause listed, nothing else."
                ),
            },
            {
                "role": "user",
                "content": (
                    f"Dispenser class: {dispenser_class}\nMaterial family: {material_family}\n"
                    f"Complaint: {complaint_text or '(not given)'}\n\nCandidate causes:\n{cause_list}"
                ),
            },
        ],
        max_tokens=700,
    )
    if reply is None:
        return None

    match = re.search(r"\[.*\]", reply, re.DOTALL)
    if not match:
        return None
    try:
        parsed = json.loads(match.group())
    except json.JSONDecodeError:
        return None

    valid_ids = {c["id"] for c in causes}
    out = [
        {"cause_id": item["cause_id"], "likelihood_pct": float(item["likelihood_pct"])}
        for item in parsed
        if isinstance(item, dict) and item.get("cause_id") in valid_ids
    ]
    return out or None
