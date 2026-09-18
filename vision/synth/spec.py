"""The per-dot record every layout, defect operator, and renderer shares.

Keeping this one flat dataclass, rather than a subclass per defect, is what
lets defects compose: each operator only touches the fields it owns, so
applying several to the same dot list stacks cleanly instead of requiring a
bespoke code path per combination.
"""

from __future__ import annotations

from dataclasses import dataclass, field


@dataclass
class Dot:
    cx: float
    cy: float
    r: float
    squash: float = 1.0  # x/y aspect ratio of the fill ellipse

    # Where the recipe actually placed this dot -- frozen at layout time and
    # never touched by a defect operator. `cx`/`cy`/`r` above are the final,
    # possibly-defected values; these are what an inspection profile checks
    # the image against. Without keeping both, "misaligned" would have
    # nothing to compare its own wrong position to.
    nominal_cx: float = 0.0
    nominal_cy: float = 0.0
    nominal_r: float = 0.0

    present: bool = True  # False -> nothing rendered (Missing)
    ring_only: bool = False  # True -> faint low-contrast halo, no fill (Ghost)

    # Smearing / Stringing / Dragged: a tail drawn from the dot's edge.
    tail_dx: float = 0.0
    tail_dy: float = 0.0
    tail_taper: float = 0.0  # 0 = blunt trapezoid (smearing), 1 = pointed (stringing)

    # Air bubble: texture-only, handled by the shading renderer. Silhouette
    # (r, squash) is deliberately left untouched by this flag.
    bubble: bool = False
    bubble_dx: float = 0.0  # offset of the bubble anomaly within the dot, fraction of r
    bubble_dy: float = 0.0

    # Bridging: index of the neighbour this dot's footprint fuses with.
    merge_with: int | None = None

    # Double-dispense: >1 draws overlapping offset copies of the same dot.
    lobes: int = 1
    lobe_dx: float = 0.0
    lobe_dy: float = 0.0

    # Abnormal shape: silhouette edge noise instead of a clean ellipse.
    irregular: bool = False

    tags: list[str] = field(default_factory=list)  # ground truth, in application order

    def tag(self, name: str) -> None:
        if name not in self.tags:
            self.tags.append(name)


@dataclass
class Layout:
    dots: list[Dot]
    order: list[int]  # indices into `dots`, in actual dispense sequence
    pattern: str
    width: int
    height: int
    contamination: int = 0  # free-floating specks, unrelated to any grid index
