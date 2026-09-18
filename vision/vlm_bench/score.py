"""Scores one runner.py results file and prints a report shaped like
detect/evaluate.py's (same columns: generator tag, n, accuracy %,
predicted-tag breakdown) so the two baselines -- geometric detector vs.
VLM -- read side by side despite being produced by unrelated pipelines.

Unlike detect/expected.py, no cause->symptom mapping layer is needed here:
prompt.py hands the model the same tag vocabulary ground_truth.py scores
against, so "correct" is just direct set membership, not a plausibility
judgement.

    cd vision && .venv/bin/python -m vlm_bench.score --results vlm_bench/results/<file>.json
"""

from __future__ import annotations

import argparse
import json
import pathlib
from collections import Counter

from .vocab import GOOD


def score(results_path: pathlib.Path) -> str:
    data = json.loads(results_path.read_text())
    records = data["records"]

    coverage: dict[str, Counter] = {}
    accuracy: dict[str, dict[str, int]] = {}
    good_false_positives = good_total = 0
    parse_methods: Counter = Counter()
    unrecognized: Counter = Counter()
    errors = 0

    for rec in records:
        parse_methods[rec["parse_method"]] += 1
        if rec["error"]:
            errors += 1
        for tag in rec["unrecognized_tags"]:
            unrecognized[tag] += 1

        gt = rec["ground_truth"]
        pred = rec["predicted"]

        if gt == [GOOD]:
            good_total += 1
            if pred:
                good_false_positives += 1
            bucket = coverage.setdefault(GOOD, Counter())
            bucket["(nothing flagged)" if not pred else ",".join(sorted(pred))] += 1
            acc = accuracy.setdefault(GOOD, {"correct": 0, "wrong": 0})
            acc["correct" if not pred else "wrong"] += 1
            continue

        for tag in gt:
            bucket = coverage.setdefault(tag, Counter())
            bucket[tag if tag in pred else "(missed)"] += 1
            acc = accuracy.setdefault(tag, {"correct": 0, "wrong": 0})
            acc["correct" if tag in pred else "wrong"] += 1

    lines = []
    lines.append(f"Model: {data['model']} | prompt {data['prompt_version']} | "
                 f"{data['n_samples']} images | {data['duration_s']}s total")
    lines.append("")
    lines.append(f"{'generator tag':22} n     accuracy   predicted breakdown")
    lines.append("-" * 90)
    total_correct = total_wrong = 0
    for tag in sorted(coverage):
        a = accuracy[tag]
        total_correct += a["correct"]
        total_wrong += a["wrong"]
        n = a["correct"] + a["wrong"]
        pct = f"{100 * a['correct'] / n:5.1f}%" if n else " n/a "
        breakdown = ", ".join(f"{k}={v}" for k, v in coverage[tag].most_common())
        lines.append(f"{tag:22} {n:<5} {pct:<10} {breakdown}")

    total = total_correct + total_wrong
    overall_pct = 100 * total_correct / total if total else 0.0
    lines.append("-" * 90)
    lines.append(f"{'OVERALL':22} {total:<5} {overall_pct:5.1f}% ({total_correct} correct / {total_wrong} wrong)")
    lines.append("")
    lines.append(f"False positives on '{GOOD}' images: {good_false_positives}/{good_total}")
    lines.append(f"Output-format compliance: {dict(parse_methods)} (errors: {errors})")
    if unrecognized:
        lines.append(f"Out-of-vocabulary tags the model invented: {dict(unrecognized.most_common())}")

    return "\n".join(lines)


def main() -> None:
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("--results", required=True, type=pathlib.Path)
    args = parser.parse_args()
    print(score(args.results))


if __name__ == "__main__":
    main()
