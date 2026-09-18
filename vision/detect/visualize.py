"""Draws what the detector predicted onto the image itself -- colour-coded
right/wrong against that sample's own ground truth, with a text label per
dot showing the predicted tag(s) and, when wrong, the ground-truth tag(s)
too.

    .venv/bin/python -m detect.visualize --sample missing_carryover
    .venv/bin/python -m detect.visualize --all
    .venv/bin/python -m detect.visualize --all --mixed

Writes annotated PNGs to vision/detect/annotated/.

Colour key: green ring = matches expected.py's known-correct behaviour,
red ring = doesn't, teal ring = a class this pipeline can't judge yet
(air_bubble, satellite, contamination_speck -- see expected.py), yellow
dashed-looking ring = a detected blob with no matching profile position at
all (stray material).
"""

from __future__ import annotations

import argparse
import json
import pathlib

import cv2

from . import detect
from .expected import is_plausible

SAMPLES = pathlib.Path(__file__).resolve().parents[1] / "samples"
OUT = pathlib.Path(__file__).resolve().parent / "annotated"

CORRECT = (90, 200, 90)  # BGR: green
WRONG = (60, 60, 230)  # red
UNJUDGED = (180, 170, 60)  # teal
EXTRA = (0, 200, 230)  # yellow

TAG_ABBR = {
    "oversized": "OVER", "undersized": "UNDER", "irregular": "IRR",
    "misaligned": "MISALIGN", "missing": "MISS", "possibly_fused": "FUSED",
    "extra": "EXTRA",
}


def _abbr(tags: list[str]) -> str:
    return "+".join(TAG_ABBR.get(t, t) for t in tags) if tags else "ok"


def annotate(name: str) -> pathlib.Path | None:
    json_path = SAMPLES / f"{name}.json"
    if not json_path.exists():
        json_path = SAMPLES / "mixed" / f"{name}.json"
    img_path = json_path.with_suffix(".png")
    if not json_path.exists() or not img_path.exists():
        print(f"skip {name}: not found")
        return None

    sidecar = json.loads(json_path.read_text())
    result = detect(img_path.read_bytes(), sidecar)
    if "error" in result:
        print(f"skip {name}: {result['error']}")
        return None

    img = cv2.imread(str(img_path))
    if img is None:
        print(f"skip {name}: failed to load image {img_path}")
        return None

    predicted_by_index = {d["index"]: d for d in result["dots"]}
    n_profile = len(sidecar["profile"])
    counts = {"correct": 0, "wrong": 0, "unjudged": 0}

    for gt_dot in sidecar["dots"][:n_profile]:
        idx = gt_dot["index"]
        gt_tags = gt_dot["tags"]
        pred = predicted_by_index.get(idx, {"cx": gt_dot["cx"], "cy": gt_dot["cy"], "tags": []})
        pred_tags = pred["tags"]
        verdict = is_plausible(gt_tags, pred_tags)

        if verdict is None:
            colour = UNJUDGED
            counts["unjudged"] += 1
        elif verdict:
            colour = CORRECT
            counts["correct"] += 1
        else:
            colour = WRONG
            counts["wrong"] += 1

        cx, cy = int(pred["cx"]), int(pred["cy"])
        radius = int(sidecar["profile"][idx]["r"]) + 6
        cv2.circle(img, (cx, cy), radius, colour, 2)

        label = _abbr(pred_tags)
        if verdict is False:
            label += f"  (gt:{_abbr(gt_tags)})"
        cv2.putText(img, label, (cx - radius, cy - radius - 6),
                    cv2.FONT_HERSHEY_SIMPLEX, 0.38, colour, 1, cv2.LINE_AA)

    for e in result.get("extra", []):
        cx, cy = int(e["cx"]), int(e["cy"])
        cv2.circle(img, (cx, cy), 10, EXTRA, 2, cv2.LINE_AA)
        cv2.putText(img, "extra", (cx - 10, cy - 16), cv2.FONT_HERSHEY_SIMPLEX, 0.35, EXTRA, 1, cv2.LINE_AA)

    OUT.mkdir(parents=True, exist_ok=True)
    out_path = OUT / f"{name}_annotated.png"
    cv2.imwrite(str(out_path), img)
    rel = out_path.relative_to(SAMPLES.parent)
    print(f"{name:22} correct={counts['correct']:2} wrong={counts['wrong']:2} "
          f"unjudged={counts['unjudged']:2} extra={len(result.get('extra', [])):2}  -> {rel}")
    return out_path


def main() -> None:
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("--sample", help="visualise one sample by name (e.g. missing_carryover)")
    parser.add_argument("--all", action="store_true", help="visualise every canonical sample")
    parser.add_argument("--mixed", action="store_true", help="with --all, also visualise the mixed set")
    args = parser.parse_args()

    if args.sample:
        annotate(args.sample)
        return

    if args.all:
        for p in sorted(SAMPLES.glob("*.json")):
            annotate(p.stem)
        if args.mixed:
            for p in sorted((SAMPLES / "mixed").glob("*.json")):
                annotate(p.stem)
        return

    parser.print_help()


if __name__ == "__main__":
    main()
