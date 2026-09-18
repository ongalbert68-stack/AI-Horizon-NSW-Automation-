"""Match detected blobs against a profile's nominal positions.

Greedy nearest-neighbour matching, not the Hungarian algorithm: with a few
dozen dots per image this is simple, fast enough, and easy for a process
engineer to audit by eye -- "the closest pairs match first, and each blob or
position can only be claimed once" is not a hard claim to check by hand.

Working from a known profile instead of guessing a shape from pixels is
what makes this work for any pattern (perimeter, line, arbitrary shape),
not just rectangular grids -- each profile position is checked against its
own known coordinates, not against a "rows and columns" assumption.
"""

from __future__ import annotations

import math
from dataclasses import dataclass

from .profile import Profile, ProfilePoint


@dataclass
class Match:
    point: ProfilePoint
    blob: dict | None  # None -> nothing landed near this profile position
    deviation: float = 0.0  # distance from nominal to matched blob centroid
    fused_with: int | None = None  # profile index of a neighbour sharing the nearest blob


def align(blobs: list[dict], profile: Profile, capture_factor: float = 1.8) -> tuple[list["Match"], list[dict]]:
    """Returns (one Match per profile point, blobs claimed by none)."""
    pairs: list[tuple[float, int, ProfilePoint]] = []
    for bi, b in enumerate(blobs):
        for p in profile.points:
            d = math.hypot(b["cx"] - p.cx, b["cy"] - p.cy)
            pairs.append((d, bi, p))
    pairs.sort(key=lambda t: t[0])

    claimed_blob: dict[int, int] = {}  # blob index -> profile index
    claimed_point: dict[int, int] = {}  # profile index -> blob index
    for d, bi, p in pairs:
        if bi in claimed_blob or p.index in claimed_point:
            continue
        if d > p.r * capture_factor:
            continue
        claimed_blob[bi] = p.index
        claimed_point[p.index] = bi

    matches: list[Match] = []
    explained_blobs: set[int] = set()  # blobs accounted for via a fused_with hint, not a claim
    for p in profile.points:
        bi = claimed_point.get(p.index)
        if bi is not None:
            b = blobs[bi]
            matches.append(Match(point=p, blob=b, deviation=math.hypot(b["cx"] - p.cx, b["cy"] - p.cy)))
            continue

        # Unmatched: a fused blob (bridging, dragged) typically sits between
        # both original positions, roughly half a pitch from each -- often
        # *too far from either* to satisfy the strict capture_factor above,
        # so it's never "claimed" by anyone in the first pass. Checking only
        # already-claimed blobs missed exactly this case. Instead: find this
        # point's nearest blob regardless of claim status, then check
        # whether some *other still-unmatched* profile point also treats
        # that same blob as its nearest -- two positions sharing one blob,
        # neither claiming it outright, is the actual fingerprint of fusion.
        fused_with = None
        if blobs:
            nearest_i = min(range(len(blobs)), key=lambda i: math.hypot(blobs[i]["cx"] - p.cx, blobs[i]["cy"] - p.cy))
            nd = math.hypot(blobs[nearest_i]["cx"] - p.cx, blobs[nearest_i]["cy"] - p.cy)
            if nd <= p.r * 3.0:
                other_unmatched = [q for q in profile.points if q.index != p.index and q.index not in claimed_point]
                other = min(
                    other_unmatched,
                    key=lambda q: math.hypot(blobs[nearest_i]["cx"] - q.cx, blobs[nearest_i]["cy"] - q.cy),
                    default=None,
                )
                if other is not None:
                    od = math.hypot(blobs[nearest_i]["cx"] - other.cx, blobs[nearest_i]["cy"] - other.cy)
                    if od <= other.r * 3.0:
                        fused_with = other.index
                        explained_blobs.add(nearest_i)
        matches.append(Match(point=p, blob=None, fused_with=fused_with))

    extra = [b for bi, b in enumerate(blobs) if bi not in claimed_blob and bi not in explained_blobs]
    return matches, extra
