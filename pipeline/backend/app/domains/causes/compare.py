"""Step 4: compare causes. Reuses ranking/rules.py's own rule set rather
than a second copy — every rule already carries a label/detail/source, so
"evidence for and against, with manual passages for each" is just that
rule set evaluated and split by sign, not a separate model to keep in sync."""

from dataclasses import dataclass

from app.domains.causes.vocabulary import load_causes
from app.domains.ranking.rules import CAUSE_RULES, Fingerprint


@dataclass
class ComparisonRow:
    label: str
    detail: str
    source: str
    weight: float


@dataclass
class CauseComparison:
    cause_id: str
    label: str
    image_signature: str | None
    supports: list[ComparisonRow]
    contradicts: list[ComparisonRow]


def compare_causes(fingerprint: Fingerprint) -> list[CauseComparison]:
    out = []
    for cause in load_causes():
        supports, contradicts = [], []
        for rule in CAUSE_RULES.get(cause["id"], []):
            weight = rule.evaluate(fingerprint)
            if weight is None:
                continue
            row = ComparisonRow(label=rule.label, detail=rule.detail, source=rule.source, weight=weight)
            (supports if weight > 0 else contradicts).append(row)

        out.append(
            CauseComparison(
                cause_id=cause["id"], label=cause["label"], image_signature=cause.get("image_signature"),
                supports=sorted(supports, key=lambda r: -r.weight),
                contradicts=sorted(contradicts, key=lambda r: r.weight),
            )
        )
    return out
