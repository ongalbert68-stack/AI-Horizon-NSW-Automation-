"""Turns a finished dot list into a grayscale-looking BGR image.

Two rendering paths, deliberately not unified: almost every defect is a flat
silhouette fill (cheap, vectorised via OpenCV primitives), and only Air
bubble needs the local heightfield+shading patch, because it's the one class
whose signature is internal texture rather than outline. Paying the shading
cost for all 16 other classes would be wasted work for no visual difference.
"""

from __future__ import annotations

import math

import cv2
import numpy as np

from .spec import Dot, Layout

BASE_GRAY = 232
FILL_COLOUR = (70, 70, 75)
GHOST_COLOUR = (200, 190, 185)


def canvas(width: int, height: int, rng: np.random.Generator) -> np.ndarray:
    base = np.full((height, width, 3), BASE_GRAY, np.uint8)
    return cv2.add(base, rng.normal(0, 3, (height, width, 3)).astype(np.int16).clip(-12, 12).astype(np.uint8))


def _irregular_polygon(cx: float, cy: float, r: float, squash: float, rng: np.random.Generator, n: int = 16) -> np.ndarray:
    angles = np.linspace(0, 2 * np.pi, n, endpoint=False)
    noise = rng.uniform(0.65, 1.15, n)
    xs = cx + r * squash * noise * np.cos(angles)
    ys = cy + (r / squash) * noise * np.sin(angles)
    return np.stack([xs, ys], axis=1).astype(np.int32)


def _draw_fill(img: np.ndarray, dot: Dot, rng: np.random.Generator) -> None:
    if dot.ring_only:
        cv2.ellipse(img, (int(dot.cx), int(dot.cy)), (int(dot.r), int(dot.r)), 0, 0, 360, GHOST_COLOUR, 2)
        return

    offsets = [(0.0, 0.0)] if dot.lobes <= 1 else [
        (-dot.lobe_dx / 2, -dot.lobe_dy / 2), (dot.lobe_dx / 2, dot.lobe_dy / 2)
    ]
    for ox, oy in offsets:
        cx, cy = dot.cx + ox, dot.cy + oy
        if dot.irregular:
            poly = _irregular_polygon(cx, cy, dot.r, dot.squash, rng)
            cv2.fillPoly(img, [poly], FILL_COLOUR)
        else:
            cv2.ellipse(img, (int(cx), int(cy)), (int(dot.r * dot.squash), int(dot.r / dot.squash)), 0, 0, 360, FILL_COLOUR, -1)


def _draw_tail(img: np.ndarray, dot: Dot) -> None:
    if dot.tail_dx == 0 and dot.tail_dy == 0:
        return
    length = math.hypot(dot.tail_dx, dot.tail_dy)
    if length < 1:
        return
    ux, uy = dot.tail_dx / length, dot.tail_dy / length
    px, py = -uy, ux  # perpendicular, for tail width

    start_w = dot.r * (1.0 - 0.55 * dot.tail_taper)  # blunt (0) stays wide, pointed (1) narrows fast
    end_w = dot.r * (0.55 if dot.tail_taper < 0.5 else 0.0)
    tip_gap = length * (0.08 if dot.tail_taper >= 0.5 else 0.0)  # stringing can show a break before the tip

    base_l = (dot.cx - px * start_w, dot.cy - py * start_w)
    base_r = (dot.cx + px * start_w, dot.cy + py * start_w)
    tip_x, tip_y = dot.cx + ux * (length - tip_gap), dot.cy + uy * (length - tip_gap)
    tip_l = (tip_x - px * end_w, tip_y - py * end_w)
    tip_r = (tip_x + px * end_w, tip_y + py * end_w)

    poly = np.array([base_l, base_r, tip_r, tip_l], np.int32)
    cv2.fillPoly(img, [poly], FILL_COLOUR)


def _draw_bridge(img: np.ndarray, a: Dot, b: Dot) -> None:
    waist = min(a.r, b.r) * 0.85
    cv2.line(img, (int(a.cx), int(a.cy)), (int(b.cx), int(b.cy)), FILL_COLOUR, int(waist))


def _draw_bubble(img: np.ndarray, dot: Dot, rng: np.random.Generator) -> None:
    """Same flat fill as every other dot -- the bubble must not change the
    dot's overall appearance, only perturb a small patch inside it. A
    previous version shaded the *whole* dot as a dome, which made it look
    like a different material rather than a normal dot with one internal
    anomaly.
    """
    cv2.ellipse(img, (int(dot.cx), int(dot.cy)), (int(dot.r * dot.squash), int(dot.r / dot.squash)), 0, 0, 360, FILL_COLOUR, -1)

    bubble_r = dot.r * 0.3
    # Keep the anomaly patch well inside the fill, whatever the offset was.
    max_off = dot.r * 0.4
    bx = dot.cx + np.clip(dot.bubble_dx * dot.r, -max_off, max_off)
    by = dot.cy + np.clip(dot.bubble_dy * dot.r, -max_off, max_off)

    pad = int(bubble_r) + 2
    x0, y0 = int(bx - pad), int(by - pad)
    size = 2 * pad
    h, w = img.shape[:2]
    x1, y1 = max(0, x0), max(0, y0)
    x2, y2 = min(w, x0 + size), min(h, y0 + size)
    if x2 <= x1 or y2 <= y1:
        return

    yy, xx = np.mgrid[y1 - by:y2 - by, x1 - bx:x2 - bx]
    dist = np.sqrt(xx ** 2 + yy ** 2)
    bubble_mask = dist <= bubble_r
    if not bubble_mask.any():
        return
    # A lighter ring where the surface normal flips over the trapped void,
    # with a slightly darker core -- a specular anomaly, not a shape change.
    # The ring itself is a thin annulus near the patch edge, not half the disc.
    ring_mask = (dist > bubble_r * 0.72) & (dist <= bubble_r * 0.92)
    core_mask = bubble_mask & (dist <= bubble_r * 0.6)

    patch = img[y1:y2, x1:x2].astype(np.float32)
    for c in range(3):
        band = patch[..., c]
        band = np.where(ring_mask, np.clip(band + 42, 0, 255), band)
        band = np.where(core_mask, np.clip(band - 16, 0, 255), band)
        patch[..., c] = band
    img[y1:y2, x1:x2] = patch.astype(np.uint8)
    cv2.GaussianBlur(img[y1:y2, x1:x2], (3, 3), 0, dst=img[y1:y2, x1:x2])


def _contamination_specks(img: np.ndarray, dots: list[Dot], rng: np.random.Generator, count: int) -> None:
    h, w = img.shape[:2]
    for _ in range(count):
        for _try in range(20):
            x, y = rng.uniform(0, w), rng.uniform(0, h)
            if all(math.hypot(x - d.cx, y - d.cy) > d.r * 1.8 for d in dots):
                break
        else:
            continue
        n = rng.integers(5, 8)
        radius = rng.uniform(2, 5)
        angles = np.linspace(0, 2 * np.pi, n, endpoint=False) + rng.uniform(0, 1)
        pts = np.stack([
            x + radius * rng.uniform(0.5, 1.2, n) * np.cos(angles),
            y + radius * rng.uniform(0.5, 1.2, n) * np.sin(angles),
        ], axis=1).astype(np.int32)
        shade = tuple(int(c * rng.uniform(0.6, 1.3)) for c in FILL_COLOUR)
        cv2.fillPoly(img, [pts], shade)


def render(layout: Layout, rng: np.random.Generator, *, contamination: int = 0) -> np.ndarray:
    img = canvas(layout.width, layout.height, rng)

    drawn_bridges: set[frozenset[int]] = set()
    for i, dot in enumerate(layout.dots):
        if dot.merge_with is not None:
            key = frozenset((i, dot.merge_with))
            if key not in drawn_bridges:
                _draw_bridge(img, dot, layout.dots[dot.merge_with])
                drawn_bridges.add(key)

    for dot in layout.dots:
        if not dot.present:
            continue
        if dot.bubble:
            _draw_bubble(img, dot, rng)
        else:
            _draw_fill(img, dot, rng)
        _draw_tail(img, dot)

    if contamination:
        _contamination_specks(img, [d for d in layout.dots if d.present], rng, contamination)

    return img
