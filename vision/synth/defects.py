"""Defect operators: each mutates a subset of dots and tags them with the
ground-truth class name. Composability comes from a shared convention, not a
shared base class:

    def op(layout: Layout, rng: np.random.Generator, touched: set[int], **kw) -> None

`touched` is threaded through a whole image build (see `apply`) so two
operators never silently overwrite the same dot -- each candidate list is
filtered against it, and every dot an operator commits to gets added to it.
Array-level and relational operators are the exception in different
directions: `inconsistent` deliberately claims every remaining dot, and
`satellite`/`contamination_speck` never claim existing indices at all, since
they add new material rather than editing dispensed positions.
"""

from __future__ import annotations

import numpy as np

from .spec import Dot, Layout


def _candidates(layout: Layout, touched: set[int]) -> list[int]:
    return [i for i in layout.order if i not in touched]


def _pick(layout: Layout, touched: set[int], rng: np.random.Generator, count: int) -> list[int]:
    cand = _candidates(layout, touched)
    if not cand:
        return []
    n = min(count, len(cand))
    return [int(i) for i in rng.choice(cand, size=n, replace=False)]


# ---------------------------------------------------------------- per-dot --

def smearing(layout: Layout, rng: np.random.Generator, touched: set[int], count: int = 1) -> None:
    for i in _pick(layout, touched, rng, count):
        d = layout.dots[i]
        ang = rng.uniform(0, 2 * np.pi)
        length = d.r * rng.uniform(1.4, 2.2)
        d.tail_dx, d.tail_dy = length * np.cos(ang), length * np.sin(ang)
        d.tail_taper = 0.0
        d.tag("smearing")
        touched.add(i)


def stringing(layout: Layout, rng: np.random.Generator, touched: set[int], count: int = 1,
              satellite_chance: float = 0.5) -> None:
    for i in _pick(layout, touched, rng, count):
        d = layout.dots[i]
        ang = rng.uniform(0, 2 * np.pi)
        length = d.r * rng.uniform(1.6, 2.6)
        d.tail_dx, d.tail_dy = length * np.cos(ang), length * np.sin(ang)
        d.tail_taper = 1.0
        d.tag("stringing")
        touched.add(i)
        if rng.random() < satellite_chance:
            sx = d.cx + d.tail_dx * rng.uniform(1.05, 1.3)
            sy = d.cy + d.tail_dy * rng.uniform(1.05, 1.3)
            sat = Dot(cx=sx, cy=sy, r=d.r * rng.uniform(0.15, 0.3))
            sat.tag("satellite")
            layout.dots.append(sat)
            layout.order.append(len(layout.dots) - 1)


def satellite(layout: Layout, rng: np.random.Generator, touched: set[int], count: int = 1) -> None:
    if not layout.order:
        return
    for _ in range(count):
        i = int(rng.choice(layout.order))
        d = layout.dots[i]
        ang = rng.uniform(0, 2 * np.pi)
        dist = d.r * rng.uniform(1.5, 3.0)
        sat = Dot(cx=d.cx + dist * np.cos(ang), cy=d.cy + dist * np.sin(ang), r=d.r * rng.uniform(0.15, 0.3))
        sat.tag("satellite")
        layout.dots.append(sat)
        layout.order.append(len(layout.dots) - 1)


def abnormal_shape(layout: Layout, rng: np.random.Generator, touched: set[int], count: int = 1) -> None:
    for i in _pick(layout, touched, rng, count):
        d = layout.dots[i]
        d.irregular = True
        d.tag("abnormal_shape")
        touched.add(i)


def overrun(layout: Layout, rng: np.random.Generator, touched: set[int], count: int = 1) -> None:
    for i in _pick(layout, touched, rng, count):
        d = layout.dots[i]
        d.r *= rng.uniform(1.6, 2.0)
        d.squash *= rng.uniform(1.1, 1.4)
        d.tag("overrun")
        touched.add(i)


def ghost(layout: Layout, rng: np.random.Generator, touched: set[int], count: int = 1) -> None:
    for i in _pick(layout, touched, rng, count):
        d = layout.dots[i]
        d.ring_only = True
        d.tag("ghost")
        touched.add(i)


def air_bubble(layout: Layout, rng: np.random.Generator, touched: set[int], count: int = 1) -> None:
    for i in _pick(layout, touched, rng, count):
        d = layout.dots[i]
        d.bubble = True
        d.bubble_dx = rng.uniform(-0.3, 0.3)
        d.bubble_dy = rng.uniform(-0.3, 0.3)
        d.tag("air_bubble")
        touched.add(i)


def double_dispense(layout: Layout, rng: np.random.Generator, touched: set[int], count: int = 1) -> None:
    for i in _pick(layout, touched, rng, count):
        d = layout.dots[i]
        ang = rng.uniform(0, 2 * np.pi)
        off = d.r * rng.uniform(0.6, 0.75)
        d.lobes = 2
        d.lobe_dx, d.lobe_dy = off * np.cos(ang), off * np.sin(ang)
        d.tag("double_dispense")
        touched.add(i)


# ------------------------------------------------------------- positional --

def misaligned(layout: Layout, rng: np.random.Generator, touched: set[int],
               drift: float = 5.5, mode: str = "drift") -> None:
    cand = _candidates(layout, touched)
    if not cand:
        return
    if mode == "jump":
        i = int(rng.choice(cand))
        d = layout.dots[i]
        d.cx += rng.choice([-1, 1]) * drift * 4
        d.cy += rng.choice([-1, 1]) * drift * 4
        d.tag("misaligned")
        touched.add(i)
        return
    for k, i in enumerate(cand):
        d = layout.dots[i]
        # Growth is capped relative to the dot's own radius: past a point,
        # "drifted this far" stops being distinguishable from "not here at
        # all" even to a human, so letting it grow unbounded with position
        # in the row just produces ambiguous ground truth, not a harder
        # example. Capped below the detector's capture radius (1.8x r).
        dx = np.clip(k * drift * rng.uniform(0.8, 1.2), -d.r * 1.4, d.r * 1.4)
        d.cx += dx
        d.cy += rng.normal(0, drift * 0.7)
        d.tag("misaligned")
        touched.add(i)


# -------------------------------------------------------------- array-wide --

def inconsistent(layout: Layout, rng: np.random.Generator, touched: set[int],
                  scale: tuple[float, float] = (0.55, 1.5)) -> None:
    for i in _candidates(layout, touched):
        d = layout.dots[i]
        d.r *= rng.uniform(*scale)
        d.tag("inconsistent")
        touched.add(i)


# --------------------------------------------------------- sequence-aware --

def missing_carryover(layout: Layout, rng: np.random.Generator, touched: set[int],
                       miss_rate: float = 0.2) -> None:
    """The mechanism matc82 documents: a starved dot leaves its volume on the
    needle tip, which lands on the *next* dispensed dot. Walking dispense
    order and carrying a deficit forward is what produces the alternating
    small-then-big pair, rather than two independently sampled size classes.
    """
    carried = 0.0
    for i in _candidates(layout, touched):
        d = layout.dots[i]
        if carried <= 0 and rng.random() < miss_rate:
            carried = d.r
            d.present = False
            d.tag("missing")
            touched.add(i)
            continue
        if carried > 0:
            d.r += carried * rng.uniform(0.8, 1.1)
            d.tag("carryover_big")
            touched.add(i)
            carried = 0.0


def dragged(layout: Layout, rng: np.random.Generator, touched: set[int], count: int = 1) -> None:
    cand = _candidates(layout, touched)
    if len(cand) < 2:
        return
    n = min(count, len(cand) - 1)
    for pos in rng.choice(len(cand) - 1, size=n, replace=False):
        i, j = cand[pos], cand[pos + 1]
        if i in touched:
            continue
        a, b = layout.dots[i], layout.dots[j]
        a.tail_dx, a.tail_dy = (b.cx - a.cx) * 0.9, (b.cy - a.cy) * 0.9
        a.tail_taper = 0.0
        a.tag("dragged")
        touched.add(i)


def bridging_dots(layout: Layout, rng: np.random.Generator, touched: set[int], pairs: int = 1) -> None:
    order = layout.order
    candidates = [(a, b) for a, b in zip(order, order[1:]) if a not in touched and b not in touched]
    rng.shuffle(candidates)
    for a, b in candidates[:pairs]:
        da, db = layout.dots[a], layout.dots[b]
        da.r *= 1.15
        db.r *= 1.15
        da.merge_with = b
        da.tag("bridging")
        db.tag("bridging")
        touched.add(a)
        touched.add(b)


def line_start_defect(layout: Layout, rng: np.random.Generator, touched: set[int]) -> None:
    if not layout.order:
        return
    i = layout.order[0]
    if i in touched:
        return
    d = layout.dots[i]
    d.present = False
    d.tag("line_start_defect")
    touched.add(i)


def line_end_defect(layout: Layout, rng: np.random.Generator, touched: set[int]) -> None:
    if not layout.order:
        return
    i = layout.order[-1]
    if i in touched:
        return
    d = layout.dots[i]
    d.r *= rng.uniform(1.8, 2.4)
    d.squash *= 1.3
    d.tag("line_end_defect")
    touched.add(i)


# --------------------------------------------------------- free-floating --

def contamination_speck(layout: Layout, rng: np.random.Generator, touched: set[int], count: int = 3) -> None:
    layout.contamination += count


# ---------------------------------------------------------------- registry --

OPERATORS = {
    "smearing": smearing,
    "stringing": stringing,
    "satellite": satellite,
    "missing_carryover": missing_carryover,
    "air_bubble": air_bubble,
    "abnormal_shape": abnormal_shape,
    "overrun": overrun,
    "dragged": dragged,
    "misaligned": misaligned,
    "bridging_dots": bridging_dots,
    "ghost": ghost,
    "inconsistent": inconsistent,
    "line_start_defect": line_start_defect,
    "line_end_defect": line_end_defect,
    "contamination_speck": contamination_speck,
    "double_dispense": double_dispense,
}

# Classes that only make physical sense on the line-tracing pattern.
LAYOUT_ONLY = {
    "line_start_defect": {"line_trace"},
    "line_end_defect": {"line_trace"},
}


def _sym(pairs: dict[str, set[str]]) -> dict[str, set[str]]:
    out: dict[str, set[str]] = {k: set(v) for k, v in pairs.items()}
    for a, bs in pairs.items():
        for b in bs:
            out.setdefault(b, set()).add(a)
    return out


# Operator pairs that contradict each other's semantics rather than just
# competing for the same dot (index overlap is already handled by `touched`).
EXCLUDES = _sym({
    "inconsistent": {"missing_carryover", "overrun"},  # array-wide scatter vs. a deliberate per-dot value
    "missing_carryover": {"ghost"},  # both mean "no material here"; keep ground truth unambiguous
})


def sample_defect_set(pattern: str, rng: np.random.Generator, k_range: tuple[int, int] = (0, 3)) -> list[str]:
    available = [name for name in OPERATORS if pattern in LAYOUT_ONLY.get(name, {pattern})]
    k = int(rng.integers(k_range[0], k_range[1] + 1))
    pool = available.copy()
    rng.shuffle(pool)
    chosen: list[str] = []
    for name in pool:
        if len(chosen) >= k:
            break
        if any(name in EXCLUDES.get(c, set()) for c in chosen):
            continue
        chosen.append(name)
    return chosen


def apply(layout: Layout, names: list[str], rng: np.random.Generator,
          params: dict[str, dict] | None = None) -> None:
    params = params or {}
    touched: set[int] = set()
    for name in names:
        OPERATORS[name](layout, rng, touched, **params.get(name, {}))
