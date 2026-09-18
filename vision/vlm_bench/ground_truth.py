"""Image-level ground truth for the VLM benchmark, derived from a sample's
sidecar JSON (the same files detect/evaluate.py scores against).

Deliberately reads the union of per-dot `tags` rather than the sidecar's
top-level `defects_applied` list: `defects_applied` records *operator*
names (e.g. "bridging_dots", "missing_carryover"), which don't all match
the tag names those operators actually write onto dots (e.g. "bridging",
"missing" + "carryover_big") -- see ../synth/defects.py. Per-dot tags are
the same vocabulary vocab.py/prompt.py already use, so no name-mapping
layer is needed here the way detect/expected.py needs one for the
geometric detector's different symptom vocabulary.

One exception: "contamination_speck" never tags any dot at all (it adds a
scalar `layout.contamination` count, not a Dot -- see defects.py's
docstring on free-floating operators), so it can only be recovered from
`defects_applied` and is special-cased below.
"""

from __future__ import annotations

import json
import pathlib

from .vocab import GOOD

SAMPLES_DIR = pathlib.Path(__file__).resolve().parents[1] / "samples"


def iter_samples(samples_dir: pathlib.Path = SAMPLES_DIR):
    """Yields (image_path, sidecar_dict) for every canonical + mixed sample."""
    paths = sorted(samples_dir.glob("*.json"))
    mixed = samples_dir / "mixed"
    if mixed.is_dir():
        paths += sorted(mixed.glob("*.json"))
    for json_path in paths:
        img_path = json_path.with_suffix(".png")
        if img_path.exists():
            yield img_path, json.loads(json_path.read_text())


def ground_truth_tags(sidecar: dict) -> set[str]:
    """The set of generator-tag names actually present in this image."""
    tags: set[str] = set()
    for dot in sidecar.get("dots", []):
        tags.update(dot.get("tags", []))
    if "contamination_speck" in sidecar.get("defects_applied", []):
        tags.add("contamination_speck")
    return tags or {GOOD}
