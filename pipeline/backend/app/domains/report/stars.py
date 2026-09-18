"""DESIGN.md W2: "Stars come from how much deciding evidence is known and
how far #1 leads #2, not from the raw percentage." """


def compute_stars(top_likelihood: float, runner_up_likelihood: float | None, evidence_count: int) -> int:
    lead = top_likelihood - (runner_up_likelihood or 0.0)
    evidence_score = min(evidence_count, 4) / 4  # saturates once there's clearly "enough" evidence
    raw = (lead * 3) + (evidence_score * 2)
    return max(0, min(5, round(raw)))
