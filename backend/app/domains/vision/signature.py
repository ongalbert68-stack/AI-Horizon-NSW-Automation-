"""What the photo already answers about axis 1.

DESIGN.md W3: the signature axis "is filled up to twice from different
sources — by the user at step 1, from memory, and by the image at step 3,
from measurement", and the adaptive rule is to "skip what the photo
already answers". Neither was possible while the photo was asked for
*after* the interview, so this module exists to let step 3 run first and
hand the interview a filled-in answer to confirm rather than a blank one.

What this is not: a replacement for the operator's answer. It proposes,
the operator disposes — DESIGN.md is equally explicit that agreement
between the two sources raises nothing, while *disagreement* is evidence.
Keeping this as a suggestion is what preserves that signal; silently
overwriting axis 1 with the measurement would destroy it.

Every threshold here is the one an existing rule or spec already uses, so
nothing new gets invented to argue about:
  - the profile's own `spec_limit` for size spread (the same limit
    magnitude.py buckets against),
  - 0.80 mean circularity, the baseline ranking/rules.py's
    `_low_circularity` ramps from,
  - a missing deposit is missing at any count.
"""

from app.domains.vision.magnitude import parse_spec_limit

CIRCULARITY_BASELINE = 0.80
MAX_PICKS = 2
"""DESIGN.md W3 caps axis 1 at two picks; the suggestion obeys the same
cap the picker does, strongest first."""


def derive_signature(signals: dict[str, float | int], spec_limit: str | None) -> list[str]:
    """Signature values the measurements support, strongest first.

    Returns at most MAX_PICKS values, all drawn from the picker's own
    option list. `small_then_big` is deliberately absent: it is set by
    vision/service.py only once its chance test passes, and that test
    belongs with the p-value, not here.
    """
    limit = parse_spec_limit(spec_limit)
    candidates: list[tuple[float, str]] = []

    size_cv = signals.get("size_cv")
    if isinstance(size_cv, int | float) and limit > 0 and size_cv > limit:
        # How many times past its own spec limit, so a badly out-of-spec
        # spread outranks a marginal one.
        candidates.append((size_cv / limit, "size_varies"))

    missing = signals.get("missing_count")
    if isinstance(missing, int | float) and missing > 0:
        candidates.append((1.0 + float(missing), "missing"))

    circularity = signals.get("mean_circularity")
    if isinstance(circularity, int | float) and circularity < CIRCULARITY_BASELINE:
        candidates.append(((CIRCULARITY_BASELINE - circularity) / CIRCULARITY_BASELINE, "wrong_shape"))

    candidates.sort(key=lambda c: -c[0])
    return [value for _, value in candidates[:MAX_PICKS]]
