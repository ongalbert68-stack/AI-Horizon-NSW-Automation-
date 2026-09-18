"""Step 5's gates A and B. Both only ever lower confidence, never raise
it — "agreement never raises confidence" is the load-bearing rule DESIGN.md
gives for why precedent can't be allowed to promote a cause."""

from dataclasses import dataclass

from app.domains.ranking.pass1 import RankedCause, sigmoid, to_logit
from app.domains.retrieval.fine import FineMatch

CHANCE_P_THRESHOLD = 0.05
GATE_B_MIN_MATCHES = 3
GATE_B_MAX_ADJUSTMENT = 0.4  # log-odds, per DESIGN.md W5


@dataclass
class GateAResult:
    above_chance: bool
    deciding_signal: str | None
    p_value: float | None
    note: str


@dataclass
class GateBResult:
    applied: bool
    matched_count: int
    contradicting_count: int
    note: str


def gate_a(top: RankedCause, fingerprint: dict) -> GateAResult:
    """"Ask whether the signal that separates the candidates is above its
    chance baseline" — evaluated against the top cause's own strongest
    signal-based evidence. Used in both the agree and disagree branches of
    the tier table (DESIGN.md's own table shows above_chance mattering in
    both T1/T2 and T3/T4), so this makes no assumption about whether the
    passes agree — that's tier.py's job, not this gate's."""
    signal_evidence = [e for e in top.evidence if e.kind == "signal"]
    if not signal_evidence:
        return GateAResult(
            above_chance=False, deciding_signal=None, p_value=None,
            note="The top candidate has no measured signal behind it — only answers.",
        )

    deciding = max(signal_evidence, key=lambda e: abs(e.weight))
    p = fingerprint.get("signals", {}).get("small_then_big_chance_p")

    if "small dot then oversized" in deciding.label.lower() and p is not None:
        return GateAResult(
            above_chance=p < CHANCE_P_THRESHOLD, deciding_signal="small_then_big", p_value=p,
            note=(
                f"Dispense-order pattern at p={p:.3f}: "
                + ("above chance." if p < CHANCE_P_THRESHOLD else "not distinguishable from chance.")
            ),
        )

    # No exact chance test exists for this signal in the current pipeline
    # (only the dispense-order pattern has one) — conservative default per
    # DESIGN.md's own T4 example (size_cv alone, no order data): treat as
    # at-chance rather than claim a test that wasn't actually run.
    return GateAResult(
        above_chance=False, deciding_signal=deciding.label, p_value=None,
        note=f"No chance baseline is computed for '{deciding.label}' yet — treated conservatively as undecided.",
    )


def gate_b(ranked: list[RankedCause], fine_matches: list[FineMatch]) -> tuple[list[RankedCause], GateBResult]:
    if len(fine_matches) < GATE_B_MIN_MATCHES or not ranked:
        return ranked, GateBResult(
            applied=False, matched_count=len(fine_matches), contradicting_count=0,
            note=f"{len(fine_matches)} matching confirmed case(s) — below the floor of {GATE_B_MIN_MATCHES}.",
        )

    top = ranked[0]
    with_cause = [m for m in fine_matches if m.cause_id]
    contradicting = [m for m in with_cause if m.cause_id != top.cause_id]

    if not with_cause or len(contradicting) / len(with_cause) <= 0.5:
        return ranked, GateBResult(
            applied=False, matched_count=len(fine_matches), contradicting_count=len(contradicting),
            note=f"{len(fine_matches)} matching confirmed case(s); precedent agrees or is inconclusive — no adjustment.",
        )

    fraction = len(contradicting) / len(with_cause)
    adjustment = min(GATE_B_MAX_ADJUSTMENT, GATE_B_MAX_ADJUSTMENT * fraction)
    demoted_likelihood = sigmoid(to_logit(top.likelihood) - adjustment)

    adjusted = [
        RankedCause(cause_id=top.cause_id, label=top.label, likelihood=demoted_likelihood, evidence=top.evidence),
        *ranked[1:],
    ]
    adjusted.sort(key=lambda r: -r.likelihood)

    return adjusted, GateBResult(
        applied=True, matched_count=len(fine_matches), contradicting_count=len(contradicting),
        note=(
            f"{len(fine_matches)} matching confirmed cases, {len(contradicting)} caused by something else — "
            f"demoted '{top.label}' by {adjustment:.2f} log-odds."
        ),
    )
