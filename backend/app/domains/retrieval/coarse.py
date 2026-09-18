"""Step 2b — coarse case retrieval. Key: the five axes + material +
dispenser class. Orders the interview and pre-loads likely checks; never
touches ranking (see ranking/gates.py's gate B, which is a completely
separate scorer over signals — the two are kept in different files on
purpose, DESIGN.md is explicit that sharing a scorer here is the bug).
"""

from dataclasses import dataclass

from sqlalchemy import select
from sqlalchemy.orm import Session

from app.models.case import Case
from app.domains.intake.spec import AXIS_WEIGHTS, UNSCORED_AXIS_VALUES
from app.models.fluid_material import FluidMaterial
from app.models.dispense_profile import DispenseProfile
from app.models.dispense_station import DispenseStation

EQUALITY_AXES = ("trajectory", "footprint", "response")
JACCARD_AXES = ("signature", "inputs")
FLOOR_MIN_AXES = 2
FLOOR_REQUIRES_ONE_OF = ("footprint", "response")


@dataclass
class CoarseMatch:
    case_id: int
    score: float
    matched_axes: list[str]


def _jaccard(a: list[str], b: list[str]) -> float:
    sa, sb = set(a), set(b)
    if not sa and not sb:
        return 0.0
    union = sa | sb
    return len(sa & sb) / len(union) if union else 0.0


def _axis_value(fingerprint: dict | None, axis: str):
    """"Don't know" and unmapped free text are dropped here rather than
    scored, so an axis nobody could answer neither matches nor mismatches
    — DESIGN.md W5: "a missing axis is missing evidence, not evidence of
    difference." A list-valued axis keeps whichever picks are real."""
    value = (fingerprint or {}).get("axes", {}).get(axis)
    if isinstance(value, list):
        return [v for v in value if v not in UNSCORED_AXIS_VALUES]
    return None if value in UNSCORED_AXIS_VALUES else value


def _answer_frequencies(cases: list[Case]) -> dict[str, dict[str, float]]:
    """Inverse-frequency weighting, recomputed on read (DESIGN.md W5): an
    answer scores less the more cases already share it."""
    counts: dict[str, dict[str, int]] = {axis: {} for axis in EQUALITY_AXES}
    for case in cases:
        for axis in EQUALITY_AXES:
            value = _axis_value(case.fingerprint, axis)
            if value:
                counts[axis][value] = counts[axis].get(value, 0) + 1

    total = max(len(cases), 1)
    return {
        axis: {value: 1.0 - (n / total) for value, n in values.items()}
        for axis, values in counts.items()
    }


def coarse_match(
    db: Session,
    *,
    dispenser_class: str,
    material_family: str,
    fingerprint: dict,
    exclude_case_id: int | None = None,
    limit: int = 10,
) -> list[CoarseMatch]:
    query = (
        select(Case)
        .join(DispenseStation, Case.station_id == DispenseStation.station_id)
        .join(DispenseProfile, Case.profile_id == DispenseProfile.profile_id)
        .join(FluidMaterial, DispenseProfile.material_id == FluidMaterial.material_id)
        .where(DispenseStation.dispenser_class == dispenser_class)
        .where(FluidMaterial.family == material_family)
    )
    candidates = [c for c in db.scalars(query) if c.case_id != exclude_case_id]
    if not candidates:
        return []

    inverse_freq = _answer_frequencies(candidates)
    results: list[CoarseMatch] = []

    for case in candidates:
        matched_axes: list[str] = []
        score = 0.0

        for axis in EQUALITY_AXES:
            mine = _axis_value(fingerprint, axis)
            theirs = _axis_value(case.fingerprint, axis)
            if mine and theirs and mine == theirs:
                weight = AXIS_WEIGHTS.get(axis, 1.0) * inverse_freq.get(axis, {}).get(theirs, 1.0)
                score += weight
                matched_axes.append(axis)

        for axis in JACCARD_AXES:
            mine = _axis_value(fingerprint, axis) or []
            theirs = _axis_value(case.fingerprint, axis) or []
            similarity = _jaccard(mine, theirs)
            if similarity > 0:
                score += AXIS_WEIGHTS.get(axis, 1.0) * similarity
                matched_axes.append(axis)

        if len(matched_axes) < FLOOR_MIN_AXES:
            continue
        if not any(a in matched_axes for a in FLOOR_REQUIRES_ONE_OF):
            continue

        results.append(CoarseMatch(case_id=case.case_id, score=round(score, 3), matched_axes=matched_axes))

    return sorted(results, key=lambda m: -m.score)[:limit]
