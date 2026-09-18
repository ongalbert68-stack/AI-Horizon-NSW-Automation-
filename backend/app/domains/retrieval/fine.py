"""Step 5b — fine case retrieval, and ranking/gates.py's Gate B. Key: the
full signal vector. CONFIRMED cases only. Can demote, never promote.

Deliberately not sharing anything with retrieval/coarse.py: this matches
by numeric distance over signals, not categorical axis agreement, and a
signal sitting at its chance level carries no weight here for the same
reason it carries none in the ranking gate itself.
"""

import statistics
from dataclasses import dataclass

from sqlalchemy import select
from sqlalchemy.orm import Session

from app.models.case import Case
from app.models.enums import CaseTier

CHANCE_KEYS_SUFFIX = "_chance_p"


@dataclass
class FineMatch:
    case_id: int
    distance: float
    cause_id: str | None


def _signal_spread(values: list[float]) -> float:
    if len(values) < 2:
        return 1.0
    spread = statistics.pstdev(values)
    return spread if spread > 1e-9 else 1.0


def _at_chance(signals: dict, key: str) -> bool:
    p = signals.get(f"{key}{CHANCE_KEYS_SUFFIX}")
    return isinstance(p, int | float) and p >= 0.05


def fine_match(
    db: Session, *, fingerprint: dict, exclude_case_id: int | None = None, limit: int = 10
) -> list[FineMatch]:
    rows = list(db.scalars(select(Case).where(Case.tier == CaseTier.CONFIRMED)))
    # (case, its fingerprint) pairs, fingerprint narrowed to non-None here
    # so nothing downstream has to re-check it.
    confirmed = [(c, c.fingerprint) for c in rows if c.case_id != exclude_case_id and c.fingerprint]
    if not confirmed:
        return []

    my_signals = fingerprint.get("signals", {})
    discriminating_keys = [
        k for k in my_signals
        if isinstance(my_signals[k], int | float)
        and not k.endswith(CHANCE_KEYS_SUFFIX)
        and not _at_chance(my_signals, k)
    ]
    if not discriminating_keys:
        return []

    spreads = {
        key: _signal_spread(
            [fp["signals"][key] for _, fp in confirmed if key in fp.get("signals", {})]
        )
        for key in discriminating_keys
    }

    results: list[FineMatch] = []
    for case, fp in confirmed:
        their_signals = fp.get("signals", {})
        shared = [k for k in discriminating_keys if k in their_signals]
        if not shared:
            continue
        distance = statistics.mean(
            abs(my_signals[k] - their_signals[k]) / spreads[k] for k in shared
        )
        cause_id = (case.diagnosis or {}).get("cause_id")
        results.append(FineMatch(case_id=case.case_id, distance=round(distance, 3), cause_id=cause_id))

    return sorted(results, key=lambda m: m.distance)[:limit]
