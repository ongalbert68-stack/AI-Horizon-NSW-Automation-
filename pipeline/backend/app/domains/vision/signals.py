"""Turns a detect() report into the numeric signals step 5 ranks against.

Ported from golden/check_golden.py's derive() — that function is the
already-validated source of truth for what these signals mean (every
golden fixture's signals.json is checked against it), so this mirrors it
rather than inventing a second definition that could quietly drift from it.
"""

import math
import statistics


def derive_signals(cv_output: dict) -> dict[str, float | int]:
    dots = sorted(cv_output.get("dots", []), key=lambda d: d["index"])
    n = len(dots)
    measured = [d for d in dots if "area_ratio" in d]
    if not measured:
        return {}

    ratios = [d["area_ratio"] for d in measured]
    mean = statistics.mean(ratios)

    tags = [d["tags"] for d in dots]
    small = [i for i in range(n - 1) if {"missing", "undersized"} & set(tags[i])]
    hits = [i for i in small if "oversized" in tags[i + 1]]
    share = sum("oversized" in tags[i] for i in range(1, n)) / (n - 1) if n > 1 else 0.0

    out: dict[str, float | int] = {
        "size_cv": statistics.pstdev(ratios) / mean if mean else 0.0,
        "mean_circularity": statistics.mean(d["circularity"] for d in measured),
        "missing_count": sum("missing" in t for t in tags),
        "oversized_count": sum("oversized" in t for t in tags),
        "undersized_count": sum("undersized" in t for t in tags),
        "small_dot_count": len(small),
        "small_then_big_count": len(hits),
        "oversized_share": share,
    }
    if small:
        # Exact binomial upper-tail p-value: chance of seeing >= this many
        # small-then-big hits if "oversized" fired independently at the
        # observed base rate. This *is* Gate A's chance test for the
        # dispense-order signal specifically — see ranking/gates.py.
        out["small_then_big_chance_p"] = sum(
            math.comb(len(small), i) * share**i * (1 - share) ** (len(small) - i)
            for i in range(len(hits), len(small) + 1)
        )
    return out
