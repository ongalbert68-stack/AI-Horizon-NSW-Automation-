"""Step 5, pass 1 — the instrument: deterministic fault tree over signals
and answers. Every weight visible (each RankedCause carries its full
evidence list). Ported from web/core/infer.ts's additive log-odds design,
with DESIGN.md W2's fix: rule weights already come pre-scaled by distance
from baseline (see ranking/rules.py), so this file only ever sums what
fired — it doesn't threshold anything itself."""

import math
from dataclasses import dataclass, field

from app.domains.causes.vocabulary import load_causes
from app.domains.ranking.rules import CAUSE_RULES, Fingerprint

PRIOR = 0.15  # every cause starts equally unlikely; evidence does the rest


def sigmoid(x: float) -> float:
    return 1 / (1 + math.exp(-x))


def to_logit(p: float) -> float:
    safe = min(max(p, 0.001), 0.999)
    return math.log(safe / (1 - safe))


@dataclass
class RuleHit:
    label: str
    detail: str
    source: str
    weight: float
    kind: str


@dataclass
class RankedCause:
    cause_id: str
    label: str
    likelihood: float
    evidence: list[RuleHit] = field(default_factory=list)


def rank_causes(fingerprint: Fingerprint) -> list[RankedCause]:
    """Independent per-cause probabilities — deliberately not normalised
    to sum to 100%, matching the brief's table (DESIGN.md W2)."""
    ranked = []
    for cause in load_causes():
        cause_id = cause["id"]
        logit = to_logit(PRIOR)
        evidence: list[RuleHit] = []

        for rule in CAUSE_RULES.get(cause_id, []):
            weight = rule.evaluate(fingerprint)
            if weight is None:
                continue
            logit += weight
            evidence.append(
                RuleHit(label=rule.label, detail=rule.detail, source=rule.source, weight=weight, kind=rule.kind)
            )

        ranked.append(
            RankedCause(
                cause_id=cause_id, label=cause["label"], likelihood=sigmoid(logit),
                evidence=sorted(evidence, key=lambda e: -abs(e.weight)),
            )
        )

    return sorted(ranked, key=lambda r: -r.likelihood)
