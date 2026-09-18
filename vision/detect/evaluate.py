"""Runs vision/detect against every canonical AND mixed sample and reports,
for each generator-assigned class: what symptom(s) the detector actually
predicted, and an accuracy percentage against expected.py's definition of
correct.

Accuracy excludes classes expected.py marks "not yet judged" (air_bubble,
satellite, contamination_speck) from the scored total -- counting them as
automatic passes or automatic fails would both misrepresent a class this
pipeline doesn't attempt yet. Their count is reported separately instead.

    .venv/bin/python -m detect.evaluate
"""

from __future__ import annotations

import json
import pathlib
from collections import Counter

from . import detect
from .expected import is_plausible

SAMPLES = pathlib.Path(__file__).resolve().parents[1] / "samples"


def _iter_sidecars():
    yield from sorted(SAMPLES.glob("*.json"))
    mixed = SAMPLES / "mixed"
    if mixed.is_dir():
        yield from sorted(mixed.glob("*.json"))


def main() -> None:
    coverage: dict[str, Counter] = {}
    accuracy: dict[str, dict[str, int]] = {}
    extra_blobs_total = 0
    n_images = 0

    for json_path in _iter_sidecars():
        sidecar = json.loads(json_path.read_text())
        img_path = json_path.with_suffix(".png")
        if not img_path.exists():
            continue
        result = detect(img_path.read_bytes(), sidecar)
        if "error" in result:
            continue
        n_images += 1
        extra_blobs_total += len(result.get("extra", []))

        predicted_by_index = {d["index"]: d["tags"] for d in result["dots"]}
        n_profile = len(sidecar["profile"])
        for gt_dot in sidecar["dots"][:n_profile]:
            idx = gt_dot["index"]
            raw_gt_tags = gt_dot["tags"]
            gt_tags = raw_gt_tags or ["good"]
            predicted = predicted_by_index.get(idx, [])
            verdict = is_plausible(raw_gt_tags, predicted)

            for gt_tag in gt_tags:
                bucket = coverage.setdefault(gt_tag, Counter())
                if predicted:
                    for pt in predicted:
                        bucket[pt] += 1
                else:
                    bucket["(nothing flagged)"] += 1

                acc = accuracy.setdefault(gt_tag, {"correct": 0, "wrong": 0, "unjudged": 0})
                if verdict is None:
                    acc["unjudged"] += 1
                elif verdict:
                    acc["correct"] += 1
                else:
                    acc["wrong"] += 1

    n_instances = sum(sum(bucket.values()) for bucket in coverage.values())
    print(f"Ran detect() with a profile against {n_images} images ({n_instances} labelled dot-instances).\n")

    print(f"{'generator tag':22} n     accuracy   predicted symptom breakdown")
    print("-" * 90)
    total_correct = total_wrong = total_unjudged = 0
    for gt_tag in sorted(coverage):
        a = accuracy[gt_tag]
        total_correct += a["correct"]
        total_wrong += a["wrong"]
        total_unjudged += a["unjudged"]
        scored = a["correct"] + a["wrong"]
        pct = f"{100 * a['correct'] / scored:5.1f}%" if scored else " n/a "
        if a["unjudged"]:
            pct += f" ({a['unjudged']} not yet judged)"
        breakdown = ", ".join(f"{k}={v}" for k, v in coverage[gt_tag].most_common())
        n = sum(coverage[gt_tag].values())
        print(f"{gt_tag:22} {n:<5} {pct:<24} {breakdown}")

    scored_total = total_correct + total_wrong
    overall_pct = 100 * total_correct / scored_total if scored_total else 0.0
    print("-" * 90)
    print(f"{'OVERALL':22} {n_instances:<5} {overall_pct:5.1f}%"
          f" ({total_correct} correct / {total_wrong} wrong / {total_unjudged} not yet judged)")

    print(f"\nExtra (unmatched) blobs across all images: {extra_blobs_total}")
    print("(covers contamination specks and satellites that cleared the area-noise floor)")


if __name__ == "__main__":
    main()
