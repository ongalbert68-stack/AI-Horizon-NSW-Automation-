"""Runs exactly one VLM backend over the sample set and saves raw + parsed
predictions to a results JSON. Deliberately one model per process: the 4GB
card here can only hold one backend's weights at a time (see backends.py),
so "one at a time" is enforced structurally -- just invoke this once per
model rather than adding a multi-model loop.

    cd vision && .venv/bin/python -m vlm_bench.runner --model moondream2
    cd vision && .venv/bin/python -m vlm_bench.runner --model gemini --limit 20

Every model in a run is given prompt.PROMPT verbatim -- unmodified,
un-templated, identical across models and sessions -- because a benchmark
of prompt-sensitive VLMs only means something if the prompt is the fixed
variable (see prompt.py's module docstring). The exact prompt text is
saved into the results file alongside PROMPT_VERSION so a later prompt
revision can never silently invalidate an old run's numbers.
"""

from __future__ import annotations

import argparse
import datetime
import json
import pathlib
import time

from .backends import BACKENDS
from .ground_truth import ground_truth_tags, iter_samples
from .parse import parse_response
from .prompt import PROMPT, PROMPT_VERSION

RESULTS_DIR = pathlib.Path(__file__).resolve().parent / "results"


def run(model: str, limit: int | None = None) -> pathlib.Path:
    infer = BACKENDS[model]
    samples = list(iter_samples())
    if limit:
        samples = samples[:limit]

    records = []
    started = time.time()
    for n, (image_path, sidecar) in enumerate(samples, 1):
        t0 = time.time()
        try:
            raw = infer(image_path, PROMPT)
            parsed = parse_response(raw)
            error = None
        except Exception as exc:  # noqa: BLE001 -- one bad sample must not abort the whole run
            raw, error = "", f"{type(exc).__name__}: {exc}"
            parsed = {"defects": [], "confidence": None, "notes": "", "method": "error", "unrecognized": []}
        records.append({
            "sample": image_path.relative_to(image_path.parents[1]).as_posix(),
            "generator_tag": sidecar.get("pattern"),
            "ground_truth": sorted(ground_truth_tags(sidecar)),
            "predicted": parsed["defects"],
            "confidence": parsed["confidence"],
            "notes": parsed["notes"],
            "parse_method": parsed["method"],
            "unrecognized_tags": parsed["unrecognized"],
            "error": error,
            "latency_s": round(time.time() - t0, 2),
            "raw_response": raw,
        })
        print(f"[{n}/{len(samples)}] {image_path.name}: "
              f"gt={sorted(ground_truth_tags(sidecar))} pred={parsed['defects']}"
              f"{' ERROR: ' + error if error else ''}")

    RESULTS_DIR.mkdir(exist_ok=True)
    timestamp = datetime.datetime.now().strftime("%Y%m%d_%H%M%S")
    out_path = RESULTS_DIR / f"{model.replace('.', '_')}_{timestamp}.json"
    out_path.write_text(json.dumps({
        "model": model,
        "prompt_version": PROMPT_VERSION,
        "prompt": PROMPT,
        "started_at": datetime.datetime.fromtimestamp(started).isoformat(timespec="seconds"),
        "duration_s": round(time.time() - started, 1),
        "n_samples": len(records),
        "records": records,
    }, indent=2))
    print(f"\nWrote {len(records)} predictions to {out_path}")
    return out_path


def main() -> None:
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("--model", required=True, choices=sorted(BACKENDS))
    parser.add_argument("--limit", type=int, default=None, help="only run the first N samples (smoke test)")
    args = parser.parse_args()
    run(args.model, args.limit)


if __name__ == "__main__":
    main()
