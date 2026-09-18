"""Step 5, end to end. Called fresh every time step 6 logs a new check
result ("causes re-rank instantly"), but pass 2 (the LLM critic) only ever
runs once per case and its result is cached on the case afterward — it's
one of the two calls DESIGN.md W7 budgets per session, not something to
re-spend on every re-rank.
"""

from dataclasses import asdict

from sqlalchemy.orm import Session

from app.domains.cases.model import Case
from app.domains.ranking import pass2
from app.domains.ranking.gates import gate_a, gate_b
from app.domains.ranking.pass1 import RuleHit, rank_causes, sigmoid, to_logit
from app.domains.ranking.tier import compute_tier, passes_agree
from app.domains.retrieval.fine import fine_match

# A confirmed/ruled-out check is closer to ground truth than any inferred
# rule, so it dominates the logit rather than nudging it — DESIGN.md's
# whole point of step 6 is that the loop *decides*, ranking doesn't just
# advise around what's already been directly tested.
CHECK_CONFIRMS_LOGIT = 3.0
CHECK_RULES_OUT_LOGIT = -3.0


def _apply_check_results(ranked, check_results):
    """Folds step 6's directly-tested outcomes into pass 1's evidence.
    Kept as an explicit layer after rank_causes() rather than inside it, so
    pass 1 stays a pure function of the fingerprint alone."""
    by_id = {r.cause_id: r for r in ranked}
    for check in check_results:
        if not check.cause_id or check.outcome is None or check.cause_id not in by_id:
            continue
        outcome = check.outcome.value if hasattr(check.outcome, "value") else check.outcome
        if outcome == "confirms":
            weight = CHECK_CONFIRMS_LOGIT
        elif outcome == "rules_out":
            weight = CHECK_RULES_OUT_LOGIT
        else:
            continue  # inconclusive: recorded on the case, but moves nothing

        cause = by_id[check.cause_id]
        cause.likelihood = sigmoid(to_logit(cause.likelihood) + weight)
        cause.evidence.insert(
            0,
            RuleHit(
                label=f"Check: {check.check_name}",
                detail=check.result_detail or outcome.replace("_", " "),
                source="troubleshooting loop", weight=weight, kind="check",
            ),
        )
    return sorted(ranked, key=lambda r: -r.likelihood)


def run_ranking(db: Session, case: Case) -> dict:
    fingerprint = case.fingerprint or {"axes": {}, "signals": {}}
    ranked = rank_causes(fingerprint)
    ranked = _apply_check_results(ranked, case.check_results)

    pass2_result = (case.ranking or {}).get("pass2") if case.llm_critic_used else None
    if not case.llm_critic_used:
        fresh = pass2.critic_pass(
            case.complaint_text, case.station.dispenser_class.value, case.profile.material.family.value
        )
        if fresh is not None:
            pass2_result = fresh
            case.llm_critic_used = True

    pass2_top_id, critic_note = pass2.critic_verdict(pass2_result)
    agree = passes_agree(ranked[0].cause_id, pass2_top_id)
    gate_a_result = gate_a(ranked[0], fingerprint)

    matches = fine_match(db, fingerprint=fingerprint, exclude_case_id=case.case_id)
    ranked, gate_b_result = gate_b(ranked, matches)

    tier = compute_tier(agree, gate_a_result, gate_b_result)

    return {
        "pass1": [
            {
                "cause_id": r.cause_id, "label": r.label, "likelihood": round(r.likelihood, 4),
                "evidence": [asdict(e) for e in r.evidence],
            }
            for r in ranked
        ],
        "pass2": pass2_result,
        "agree": agree,
        "critic_top_cause_id": pass2_top_id,
        "critic_note": critic_note,
        "gate_a": asdict(gate_a_result),
        "gate_b": asdict(gate_b_result),
        "tier": tier,
        "top_cause_id": ranked[0].cause_id,
        "runners_up": [r.cause_id for r in ranked[1:3]],
    }
