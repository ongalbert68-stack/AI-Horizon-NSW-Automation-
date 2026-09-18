"""Ties layouts, defects, and the renderer together.

Two dataset shapes come out of the same `build_image`:

    canonical -- one clean, single-defect image per class (17 total
                 including a defect-free baseline), deterministic, and the
                 oracle test_metrology.py checks main.py's measurements
                 against
    mixed     -- N images with a randomly sampled, compatibility-checked
                 defect set per image, for training/eval-scale data
"""

from __future__ import annotations

import json
import pathlib

import cv2
import numpy as np

from . import defects, layouts, render
from .spec import Layout

CANONICAL_PATTERN = "area"


def build_image(
    pattern: str,
    defect_names: list[str],
    rng: np.random.Generator,
    layout_kwargs: dict | None = None,
    defect_params: dict[str, dict] | None = None,
) -> tuple[np.ndarray, Layout, int]:
    builder = layouts.BUILDERS[pattern]
    layout = builder(rng=rng, **(layout_kwargs or {}))
    n_profile = len(layout.dots)  # before defects.apply can append satellites
    defects.apply(layout, defect_names, rng, defect_params)
    img = render.render(layout, rng, contamination=layout.contamination)
    return img, layout, n_profile


def _sidecar(layout: Layout, defect_names: list[str], n_profile: int) -> dict:
    return {
        "pattern": layout.pattern,
        "width": layout.width,
        "height": layout.height,
        "defects_applied": defect_names,
        # What the recipe specified -- frozen at layout time, independent of
        # whatever actually got dispensed. This is the input vision/detect/
        # checks an image against; a real machine already has this before it
        # dispenses anything, so it isn't something a detector should guess.
        "profile": [
            {"index": i, "cx": round(d.nominal_cx, 2), "cy": round(d.nominal_cy, 2), "r": round(d.nominal_r, 2)}
            for i, d in enumerate(layout.dots[:n_profile])
        ],
        # What actually got dispensed -- the oracle ground truth.
        "dots": [
            {
                "index": i,
                "cx": round(d.cx, 2),
                "cy": round(d.cy, 2),
                "r": round(d.r, 2),
                "present": d.present,
                "tags": d.tags,
            }
            for i, d in enumerate(layout.dots)
        ],
    }


def _write(out_dir: pathlib.Path, name: str, img: np.ndarray, sidecar: dict) -> None:
    out_dir.mkdir(parents=True, exist_ok=True)
    cv2.imwrite(str(out_dir / f"{name}.png"), img)
    (out_dir / f"{name}.json").write_text(json.dumps(sidecar, indent=2))


def generate_canonical(out_dir: pathlib.Path, seed: int = 7) -> list[str]:
    """One clean, single-defect sample per class -- deterministic, and used
    as the ground truth test_metrology.py checks main.py's measurements
    against."""
    written: list[str] = []

    rng = np.random.default_rng(seed)
    img, layout, n_profile = build_image(CANONICAL_PATTERN, [], rng)
    _write(out_dir, "good", img, _sidecar(layout, [], n_profile))
    written.append("good")

    for name in defects.OPERATORS:
        pattern = CANONICAL_PATTERN
        if name in defects.LAYOUT_ONLY:
            pattern = next(iter(defects.LAYOUT_ONLY[name]))
        rng = np.random.default_rng(seed)
        img, layout, n_profile = build_image(pattern, [name], rng)
        _write(out_dir, name, img, _sidecar(layout, [name], n_profile))
        written.append(name)

    return written


def generate_mixed(
    out_dir: pathlib.Path,
    n: int,
    seed: int = 11,
    k_range: tuple[int, int] = (0, 3),
) -> list[str]:
    """N images, each a random pattern with a random compatible defect set."""
    rng = np.random.default_rng(seed)
    patterns = list(layouts.BUILDERS)
    written: list[str] = []

    for idx in range(n):
        pattern = patterns[int(rng.integers(0, len(patterns)))]
        defect_names = defects.sample_defect_set(pattern, rng, k_range)
        img, layout, n_profile = build_image(pattern, defect_names, rng)
        name = f"mixed_{idx:04d}"
        _write(out_dir, name, img, _sidecar(layout, defect_names, n_profile))
        written.append(name)

    return written
