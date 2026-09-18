#!/usr/bin/env python3
"""Structural checks over every golden case in this folder.

Stdlib only, and no imports from web/ or vision/ -- this stays a fixture
harness, not part of either app. It checks that the fixtures are internally
consistent: that signals.json really follows from cv_output.json, that the
document lookup covers every candidate cause and states no conclusion, and
that each answer key matches the generator's own ground truth. It does not
run a detector, a retriever or a reasoning engine.

    python3 golden/check_golden.py
"""

from __future__ import annotations

import json
import math
import statistics
import sys
from pathlib import Path

GOLDEN = Path(__file__).parent
TOLERANCE = 0.005
REQUIRED = [
    "README.md", "expected.json", "expected_reasoning.md", "user_input.json",
    "sidecar.json", "cv_output.json", "signals.json", "rag_output.json",
]
NON_CAUSE_TOPICS = {"defect_identification", "question", "remedy"}
BANNED_RAG_KEYS = ["synthesized_answer", "root_cause_hypothesis", "conclusion", "answer"]


def load(path: Path):
    return json.loads(path.read_text())


def derive(cv: dict) -> dict:
    """Recompute every value signals.json claims, from the detector output."""
    dots = sorted(cv["dots"], key=lambda d: d["index"])
    n = len(dots)
    measured = [d for d in dots if "area_ratio" in d]
    ratios = [d["area_ratio"] for d in measured]
    mean = statistics.mean(ratios)

    tags = [d["tags"] for d in dots]
    small = [i for i in range(n - 1) if {"missing", "undersized"} & set(tags[i])]
    hits = [i for i in small if "oversized" in tags[i + 1]]
    share = sum("oversized" in tags[i] for i in range(1, n)) / (n - 1) if n > 1 else 0.0

    out = {
        "size_cv": statistics.pstdev(ratios) / mean if mean else 0.0,
        "mean_circularity": statistics.mean(d["circularity"] for d in measured),
        "missing_count": sum("missing" in t for t in tags),
        "oversized_count": sum("oversized" in t for t in tags),
        "undersized_count": sum("undersized" in t for t in tags),
        "small_dot_count": len(small),
        "small_then_big_count": len(hits),
        "oversized_share": share,
    }
    if small:
        out["small_then_big_chance_p"] = sum(
            math.comb(len(small), i) * share**i * (1 - share) ** (len(small) - i)
            for i in range(len(hits), len(small) + 1)
        )
    return out


def check_files(case: Path) -> list[str]:
    missing = [f for f in REQUIRED if not (case / f).exists()]
    errors = [f"missing required file '{f}'" for f in missing]
    img = case / "img"
    if not img.is_dir() or not any(img.glob("*.png")):
        errors.append("img/ must exist and hold at least one png")
    return errors


def check_cv_output(cv: dict, sidecar: dict) -> list[str]:
    errors = []
    for key in ("profile_supplied", "summary", "dots", "extra", "counts"):
        if key not in cv:
            errors.append(f"cv_output.json: missing top-level key '{key}'")
    if errors:
        return errors

    dots, extra, summary = cv["dots"], cv["extra"], cv["summary"]
    if {d["index"] for d in dots} != {p["index"] for p in sidecar["profile"]}:
        errors.append("cv_output.json: dot indices do not match the recipe in sidecar.json")
    if summary.get("dot_count") != len(dots):
        errors.append("cv_output.json: summary.dot_count does not match the number of dots")
    if summary.get("extra_count") != len(extra):
        errors.append("cv_output.json: summary.extra_count does not match the extra list")
    if summary.get("flagged_count") != sum(1 for d in dots if d["tags"]):
        errors.append("cv_output.json: summary.flagged_count does not match the tagged dots")

    tally: dict[str, int] = {}
    for d in dots + extra:
        for tag in d["tags"]:
            tally[tag] = tally.get(tag, 0) + 1
    if tally != cv["counts"]:
        errors.append(f"cv_output.json: counts {cv['counts']} do not match the tags on the dots ({tally})")
    return errors


def check_signals(signals: list, cv: dict) -> list[str]:
    errors = []
    if not isinstance(signals, list) or not signals:
        return ["signals.json: must be a non-empty list"]

    values = {}
    for s in signals:
        for key in ("key", "label", "value", "note"):
            if key not in s:
                errors.append(f"signals.json: an entry is missing '{key}'")
        values[s.get("key")] = s.get("value")

    for key, expected in derive(cv).items():
        if key not in values:
            errors.append(f"signals.json: missing '{key}', which cv_output.json supports")
        elif abs(values[key] - expected) > TOLERANCE:
            errors.append(f"signals.json: {key}={values[key]} but cv_output.json gives {expected:.4f}")
    return errors


def check_rag(rag: dict, cause_ids: set[str]) -> list[str]:
    errors = [f"rag_output.json: must not contain '{k}' -- the fixture states no conclusion"
              for k in BANNED_RAG_KEYS if k in rag]

    sources = {s["id"] for s in rag.get("sources", [])}
    if not sources:
        return errors + ["rag_output.json: 'sources' must list the documents quoted"]

    passages = rag.get("passages")
    if not isinstance(passages, list) or not passages:
        return errors + ["rag_output.json: 'passages' must be a non-empty list"]

    seen, covered = set(), set()
    for p in passages:
        pid = p.get("id", "?")
        for key in ("id", "source", "section", "page", "text", "bears_on"):
            if not p.get(key):
                errors.append(f"rag_output.json: passage {pid} is missing '{key}'")
        if pid in seen:
            errors.append(f"rag_output.json: duplicate passage id {pid}")
        seen.add(pid)
        if p.get("source") not in sources:
            errors.append(f"rag_output.json: passage {pid} cites undeclared source '{p.get('source')}'")
        for topic in p.get("bears_on", []):
            if topic not in cause_ids | NON_CAUSE_TOPICS:
                errors.append(f"rag_output.json: passage {pid} bears_on unknown '{topic}'")
            covered.add(topic)

    for cause in sorted(cause_ids - covered):
        errors.append(f"rag_output.json: no passage bears on '{cause}' -- retrieval must cover every candidate cause")
    return errors


def check_expected(exp: dict, sidecar: dict, user_input: dict, rag: dict, cause_ids: set[str]) -> list[str]:
    errors = []
    truth = exp.get("truth", {})
    if truth.get("generator_defects") != sidecar.get("defects_applied"):
        errors.append(f"expected.json: truth.generator_defects {truth.get('generator_defects')} "
                      f"does not match sidecar.json defects_applied {sidecar.get('defects_applied')}")

    answer = exp.get("operator_answer", {})
    given = [a for a in user_input["answers"] if a["questionId"] == answer.get("questionId")]
    if not given or given[0]["value"] != answer.get("value"):
        errors.append("expected.json: operator_answer does not match user_input.json")

    causes = exp.get("causes", {})
    first = causes.get("must_rank_first")
    referenced = set(causes.get("acceptable_first", [])) | set(causes.get("must_not_rank_first", [])) \
        | set(causes.get("acceptable_second", [])) | ({first} if first else set())
    for cid in sorted(referenced - cause_ids):
        errors.append(f"expected.json: unknown cause id '{cid}' (not in causes.json)")
    if first and first in causes.get("must_not_rank_first", []):
        errors.append(f"expected.json: '{first}' is both must_rank_first and must_not_rank_first")
    if not first and not causes.get("acceptable_first"):
        errors.append("expected.json: needs either must_rank_first or acceptable_first")

    passage_ids = {p.get("id") for p in rag.get("passages", [])}
    for pid in exp.get("remedy", {}).get("must_cite", []):
        if pid not in passage_ids:
            errors.append(f"expected.json: remedy cites passage '{pid}', which rag_output.json does not contain")
    if not exp.get("forbidden_claims"):
        errors.append("expected.json: needs a non-empty forbidden_claims list")
    return errors


def check_case(case: Path, cause_ids: set[str]) -> list[str]:
    errors = check_files(case)
    if errors:
        return errors

    cv = load(case / "cv_output.json")
    sidecar = load(case / "sidecar.json")
    user_input = load(case / "user_input.json")
    rag = load(case / "rag_output.json")
    exp = load(case / "expected.json")

    if not user_input.get("answers"):
        return ["user_input.json: 'answers' must be a non-empty list"]

    errors += check_cv_output(cv, sidecar)
    errors += check_signals(load(case / "signals.json"), cv)
    errors += check_rag(rag, cause_ids)
    errors += check_expected(exp, sidecar, user_input, rag, cause_ids)
    return errors


def main() -> int:
    causes = load(GOLDEN / "causes.json")["causes"]
    cause_ids = {c["id"] for c in causes}
    if len(cause_ids) != len(causes):
        print("causes.json: duplicate cause ids")
        return 1

    cases = sorted(d for d in GOLDEN.iterdir() if d.is_dir() and (d / "expected.json").exists())
    if not cases:
        print("No golden cases found.")
        return 1

    failed = 0
    for case in cases:
        errors = check_case(case, cause_ids)
        print(f"{'FAIL' if errors else 'OK  '}  {case.name}")
        for e in errors:
            print(f"        - {e}")
        failed += bool(errors)

    print(f"\n{len(cases) - failed} of {len(cases)} golden case(s) passed "
          f"against {len(cause_ids)} candidate causes.")
    return 1 if failed else 0


if __name__ == "__main__":
    sys.exit(main())
