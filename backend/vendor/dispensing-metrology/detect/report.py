"""The public entry point: detect(image_bytes, profile) -> a structured
report of what's wrong and where.
"""

from __future__ import annotations

from . import classify as _classify
from .align import align
from .profile import load_profile
from .segment import segment_image


def detect(raw: bytes, profile_data: dict | None = None) -> dict:
    decoded = segment_image(raw)
    if decoded is None:
        return {"error": "Could not decode that image."}
    _bgr, blobs = decoded

    if not profile_data or not profile_data.get("profile"):
        # No known recipe to check against -- alignment-dependent symptoms
        # (missing, misaligned, fused) need a nominal position to compare
        # to, which nothing here should guess. Raw measurements only.
        return {
            "profile_supplied": False,
            "blob_count": len(blobs),
            "note": "No profile supplied: returning raw per-blob measurements only, no classification.",
            "blobs": [
                {"cx": round(b["cx"], 2), "cy": round(b["cy"], 2),
                 "area": round(b["area"], 1), "circularity": round(b["circularity"], 3)}
                for b in blobs
            ],
        }

    profile = load_profile(profile_data)
    matches, extra = align(blobs, profile)

    dots = [_classify.classify_point(m) for m in matches]
    _classify.classify_array(dots)  # inconsistent volume: an array-level property
    extras = [_classify.classify_extra(b) for b in extra]

    counts: dict[str, int] = {}
    for d in dots + extras:
        for t in d["tags"]:
            counts[t] = counts.get(t, 0) + 1

    flagged = sum(1 for d in dots if d["tags"])
    return {
        "profile_supplied": True,
        "pattern": profile.pattern,
        # A downstream consumer (dashboard, MES, line-stop signal) usually
        # just needs pass/fail plus a count -- added here so it doesn't have
        # to re-derive that by scanning every dot's tags itself.
        "summary": {
            "status": "fail" if (flagged or extras) else "pass",
            "dot_count": len(dots),
            "flagged_count": flagged,
            "extra_count": len(extras),
        },
        "dots": dots,
        "extra": extras,
        "counts": counts,
    }
