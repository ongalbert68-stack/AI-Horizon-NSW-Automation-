"""Step 3's quality gate (DESIGN.md W6): "too few deposits, low contrast, or
odd polarity means can't measure reliably, and the run continues on
questions only." This is upstream of everything else — a bad measurement
would otherwise fool both ranking passes into agreeing confidently.

detect() deliberately reports only silhouette geometry (see
vision/detect/classify.py's docstring) and no contrast/confidence score of
its own — segment.py already auto-corrects polarity and doesn't say
whether it had to. So this gate works from what *is* there: how many
regions were found at all, and how plausible their shapes are. It is a
proxy for "the image is unreadable," not a pixel-level contrast
measurement — documented here rather than overclaiming precision it
doesn't have.
"""

MIN_BLOBS = 2
MIN_MEAN_CIRCULARITY = 0.30
"""Real deposits, even defective ones, essentially never average below
this. A whole-frame value this low means Otsu most likely segmented noise,
not dots — the odd-polarity/low-contrast case."""


def quality_gate(cv_output: dict) -> tuple[bool, str | None]:
    """Returns (ok, reason). reason is None when ok."""
    if cv_output.get("error"):
        return False, cv_output["error"]

    if not cv_output.get("profile_supplied"):
        blobs = cv_output.get("blobs", [])
        if len(blobs) < MIN_BLOBS:
            return False, f"Only {len(blobs)} region(s) detected — too few to measure reliably."
        circularities = [b["circularity"] for b in blobs]
        mean_circ = sum(circularities) / len(circularities)
        if mean_circ < MIN_MEAN_CIRCULARITY:
            return False, "Detected regions are too irregular to be deposits — check focus/contrast."
        return True, None

    dots, extra = cv_output.get("dots", []), cv_output.get("extra", [])
    found = sum(1 for d in dots if d.get("area_ratio") is not None) + len(extra)
    if found < MIN_BLOBS:
        return False, f"Only {found} deposit(s) actually detected — too few to measure reliably."

    measured = [d for d in dots if "circularity" in d] + [
        {"circularity": 1.0} for _ in extra  # extras have no shape info; don't penalize them here
    ]
    circularities = [d["circularity"] for d in measured if "circularity" in d]
    if circularities:
        mean_circ = sum(circularities) / len(circularities)
        if mean_circ < MIN_MEAN_CIRCULARITY:
            return False, "Matched deposits are too irregular to be real — check focus/contrast/polarity."

    return True, None
