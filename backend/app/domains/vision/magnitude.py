"""DESIGN.md W3: "Magnitude is computed from the signals, not asked."
Buckets how far size_cv sits past its spec limit — the operator is never
asked to estimate what the image already measures."""

import re

DEFAULT_SPEC_LIMIT = 0.15  # DESIGN.md's own worked example: "size_cv < 0.15"


def parse_spec_limit(spec_limit: str | None) -> float:
    if not spec_limit:
        return DEFAULT_SPEC_LIMIT
    match = re.search(r"[\d.]+", spec_limit)
    return float(match.group()) if match else DEFAULT_SPEC_LIMIT


def bucket_magnitude(size_cv: float | None, spec_limit: str | None) -> str:
    if size_cv is None:
        return "unknown"

    limit = parse_spec_limit(spec_limit)
    ratio = size_cv / limit if limit else 0.0

    if ratio <= 1.0:
        return "marginal"
    if ratio <= 2.0:
        return "moderate"
    if ratio <= 3.5:
        return "gross"
    return "total-failure"
