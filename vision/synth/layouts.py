"""Nominal dot placement for the 5 dispense pattern types in img_type.txt.

Two primitives cover all five, because Area and Custom-grid-landmark are both
just a rectangular grid at different parameterisations, and Perimeter,
Pattern, and Line-tracing are all "dots along a path" with a different path
shape:

    grid(...)       -- Area, Custom grid-based landmark
    along_path(...) -- Perimeter, Pattern, Custom grid-based line-tracing

Each returns a Layout whose `order` is the actual dispense sequence, not
raster order -- sequence-dependent defects (missing/carryover, dragged, line
start/end) need to walk dots in the order a real machine would fire them.
"""

from __future__ import annotations

import math

import numpy as np

from .spec import Dot, Layout

DEFAULT_R = 26.0


def grid(
    rows: int = 3,
    cols: int = 5,
    pitch: float = 130.0,
    margin: float = 110.0,
    r: float = DEFAULT_R,
    *,
    rng: np.random.Generator | None = None,
    jitter: float = 0.6,
    pattern: str = "area",
) -> Layout:
    """Row-major rectangular fill. Dispense order matches raster order, which
    is how most gantry systems actually sweep a grid."""
    rng = rng or np.random.default_rng()
    dots: list[Dot] = []
    order: list[int] = []
    for row in range(rows):
        for col in range(cols):
            cx_ideal = margin + col * pitch
            cy_ideal = margin + row * pitch
            # Jitter belongs to the *actual* position: even a correctly
            # dispensed dot isn't pixel-perfect, so the profile's nominal
            # position stays the clean recipe value, not this run's noise.
            cx, cy = cx_ideal + rng.normal(0, jitter), cy_ideal + rng.normal(0, jitter)
            dots.append(Dot(cx=cx, cy=cy, r=r + rng.normal(0, jitter),
                             nominal_cx=cx_ideal, nominal_cy=cy_ideal, nominal_r=r))
            order.append(len(dots) - 1)
    width = int(margin * 2 + (cols - 1) * pitch)
    height = int(margin * 2 + (rows - 1) * pitch)
    return Layout(dots=dots, order=order, pattern=pattern, width=width, height=height)


def along_path(
    points: list[tuple[float, float]],
    spacing: float = 60.0,
    r: float = DEFAULT_R,
    *,
    rng: np.random.Generator | None = None,
    jitter: float = 0.4,
    closed: bool = False,
    pattern: str = "pattern",
    width: int = 720,
    height: int = 460,
) -> Layout:
    """Evenly-spaced dots walking a piecewise-linear path, in path order --
    this is the shared mechanism behind Perimeter, Pattern, and line-tracing.
    """
    rng = rng or np.random.default_rng()
    pts = list(points) + ([points[0]] if closed and points[0] != points[-1] else [])

    segs = list(zip(pts, pts[1:]))
    seg_lens = [math.hypot(b[0] - a[0], b[1] - a[1]) for a, b in segs]
    total = sum(seg_lens)
    n = max(2, round(total / spacing))

    dots: list[Dot] = []
    order: list[int] = []
    travelled = 0.0
    seg_i = 0
    for step in range(n):
        # Open path: space n points across [0, total] inclusive, so the
        # first and last land exactly on the path's own two endpoints.
        # Closed path: total already includes the closing segment back to
        # the start, so spacing across [0, total] inclusive would place the
        # last point exactly on top of the first -- two profile positions
        # at one identical coordinate, which no real recipe would specify.
        # Space across [0, total) instead, one interval short of closing.
        if closed:
            target = step * (total / n)
        else:
            target = step * (total / (n - 1)) if n > 1 else 0.0
        while seg_i < len(segs) - 1 and travelled + seg_lens[seg_i] < target:
            travelled += seg_lens[seg_i]
            seg_i += 1
        a, b = segs[seg_i]
        seg_len = seg_lens[seg_i] or 1.0
        t = min(1.0, max(0.0, (target - travelled) / seg_len))
        cx_ideal = a[0] + (b[0] - a[0]) * t
        cy_ideal = a[1] + (b[1] - a[1]) * t
        cx, cy = cx_ideal + rng.normal(0, jitter), cy_ideal + rng.normal(0, jitter)
        dots.append(Dot(cx=cx, cy=cy, r=r + rng.normal(0, jitter),
                         nominal_cx=cx_ideal, nominal_cy=cy_ideal, nominal_r=r))
        order.append(len(dots) - 1)

    return Layout(dots=dots, order=order, pattern=pattern, width=width, height=height)


def perimeter(w: float = 500, h: float = 300, spacing: float = 120.0, **kw) -> Layout:
    ox, oy = 110, 110
    pts = [(ox, oy), (ox + w, oy), (ox + w, oy + h), (ox, oy + h)]
    return along_path(pts, spacing=spacing, closed=True, pattern="perimeter",
                       width=int(ox * 2 + w), height=int(oy * 2 + h), **kw)


def custom_grid_landmark(rows: int = 4, cols: int = 4, pitch: float = 100.0, r: float = DEFAULT_R, **kw) -> Layout:
    return grid(rows=rows, cols=cols, pitch=pitch, r=r, pattern="grid_landmark", **kw)


def pattern_shape(shape: str = "zigzag", w: float = 480, h: float = 240, spacing: float = 120.0, **kw) -> Layout:
    ox, oy = 120, 120
    if shape == "zigzag":
        pts = [(ox, oy), (ox + w / 2, oy + h), (ox + w, oy)]
    elif shape == "diamond":
        pts = [(ox + w / 2, oy), (ox + w, oy + h / 2), (ox + w / 2, oy + h), (ox, oy + h / 2)]
    else:
        pts = [(ox, oy), (ox + w, oy)]
    return along_path(pts, spacing=spacing, closed=(shape == "diamond"), pattern="pattern",
                       width=int(ox * 2 + w), height=int(oy * 2 + h), **kw)


def line_trace(length: float = 650, spacing: float = 120.0, r: float = DEFAULT_R, **kw) -> Layout:
    ox, oy = 100, 230
    pts = [(ox, oy), (ox + length, oy)]
    return along_path(pts, spacing=spacing, r=r, pattern="line_trace",
                       width=int(ox * 2 + length), height=int(oy * 2), **kw)


BUILDERS = {
    "area": grid,
    "grid_landmark": custom_grid_landmark,
    "perimeter": perimeter,
    "pattern": pattern_shape,
    "line_trace": line_trace,
}
