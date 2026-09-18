"""Step 7: report and verify. Compiles what's already on the case — no
new computation except stars and the optional LLM explanation — into the
one view DESIGN.md W9 specifies: description, identified defect with
stars, quality score, causes with evidence and sources, the check log,
confirmed fix, engineer notes, rules version, whether the LLM was used,
and the fixed disclaimer."""

from app.models.case import Case
from app.domains.report.explain import write_explanation
from app.domains.report.stars import compute_stars

DISCLAIMER = "Preliminary triage aid, not a replacement for an engineer."


def compile_report(case: Case, *, use_llm_explanation: bool) -> tuple[dict, bool]:
    ranking = case.ranking or {}
    pass1 = ranking.get("pass1", [])
    top3 = pass1[:3]

    stars = 0
    if pass1:
        stars = compute_stars(
            pass1[0]["likelihood"],
            pass1[1]["likelihood"] if len(pass1) > 1 else None,
            len(pass1[0]["evidence"]),
        )

    explanation, explanation_used_llm = (None, False)
    if top3 and use_llm_explanation and not case.llm_explain_used:
        explanation, explanation_used_llm = write_explanation(top3)

    vision = case.vision_result or {}
    fingerprint = case.fingerprint or {"axes": {}, "signals": {}}

    disagreement_note = None
    if ranking.get("tier") in ("T3", "T4"):
        gate_a = ranking.get("gate_a", {})
        disagreement_note = (
            f"Pass 1 (instrument) and pass 2 (critic) disagree on the top cause. {gate_a.get('note', '')}"
        )

    return {
        "case_id": case.case_id,
        "complaint": case.complaint,
        "complaint_text": case.complaint_text,
        "defect": {
            "signature": fingerprint.get("axes", {}).get("signature", []),
            "magnitude": vision.get("magnitude", "unknown"),
            "stars": stars,
        },
        "quality": {
            "ok": vision.get("quality_ok"),
            "reason": vision.get("quality_reason"),
        },
        "tier": ranking.get("tier"),
        "disagreement_note": disagreement_note,
        "causes": top3,
        "explanation": explanation,
        "explanation_used_llm": explanation_used_llm,
        "check_log": [
            {
                "sequence": cr.sequence, "check_name": cr.check_name, "cause_id": cr.cause_id,
                "outcome": cr.outcome.value if cr.outcome else None, "result_detail": cr.result_detail,
            }
            for cr in case.check_results
        ],
        "diagnosis": case.diagnosis,
        "verification": case.verification,
        "engineer_notes": case.engineer_notes,
        "rules_version": case.rules_version,
        "llm_used": case.llm_map_used or case.llm_critic_used or case.llm_explain_used or explanation_used_llm,
        "disclaimer": DISCLAIMER,
        "action_count": case.action_count,
        "resolved": case.resolved,
        "close_tier": case.tier.value if case.tier else None,
    }, explanation_used_llm
