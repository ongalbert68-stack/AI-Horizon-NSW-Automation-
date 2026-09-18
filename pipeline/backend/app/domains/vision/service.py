"""Step 3: analyse symptoms. Orchestrates detect() -> quality gate ->
signal derivation -> magnitude bucketing into the one result the rest of
the pipeline reads (stored on Case.vision_result, folded into
Case.fingerprint.signals)."""

from dataclasses import dataclass

from detect import detect

from app.domains.vision.magnitude import bucket_magnitude
from app.domains.vision.quality import quality_gate
from app.domains.vision.signals import derive_signals
from app.domains.vision.signature import derive_signature

CHANCE_P_THRESHOLD = 0.05


@dataclass
class VisionResult:
    quality_ok: bool
    quality_reason: str | None
    cv_output: dict
    signals: dict[str, float | int]
    magnitude: str
    small_then_big_above_chance: bool
    """The step-8 option-8 signature ('a small dot, then an oversized one')
    fires only above chance — DESIGN.md's fix for the 1-of-4-at-p=0.62
    false-positive. Only vision/detect/ can set this; the picker never
    offers it (DESIGN.md W3)."""
    suggested_signature: list[str]
    """Axis-1 values the measurements support, for the interview to open
    pre-filled on (see vision/signature.py). A suggestion only: it is
    never written into the fingerprint here, because the operator
    disagreeing with the measurement is itself evidence."""


def run_vision(raw_image: bytes, profile_data: dict | None, spec_limit: str | None) -> VisionResult:
    cv_output = detect(raw_image, profile_data)
    ok, reason = quality_gate(cv_output)

    if not ok:
        return VisionResult(
            quality_ok=False, quality_reason=reason, cv_output=cv_output,
            signals={}, magnitude="unknown", small_then_big_above_chance=False,
            suggested_signature=[],
        )

    signals = derive_signals(cv_output)
    if not signals:
        # The gate counts regions it *found*; deriving signals needs
        # regions it could match to the profile's expected positions, and
        # those are not the same test. A photo of the wrong pattern (or
        # the right pattern framed differently) clears the first and fails
        # the second, which used to report quality_ok with an empty signal
        # set — "measured it, deviation unknown". Nothing downstream could
        # tell that apart from a real measurement of a good board.
        return VisionResult(
            quality_ok=False,
            quality_reason=(
                "Found deposits but none line up with this profile's expected pattern, so "
                "nothing could be measured — check the photo covers the dispense area, and "
                "that the case is on the right profile."
            ),
            cv_output=cv_output, signals={}, magnitude="unknown",
            small_then_big_above_chance=False, suggested_signature=[],
        )

    magnitude = bucket_magnitude(signals.get("size_cv"), spec_limit)  # type: ignore[arg-type]

    chance_p = signals.get("small_then_big_chance_p")
    above_chance = (
        signals.get("small_then_big_count", 0) > 0
        and chance_p is not None
        and chance_p < CHANCE_P_THRESHOLD
    )

    return VisionResult(
        quality_ok=True, quality_reason=None, cv_output=cv_output,
        signals=signals, magnitude=magnitude, small_then_big_above_chance=bool(above_chance),
        suggested_signature=derive_signature(signals, spec_limit),
    )
