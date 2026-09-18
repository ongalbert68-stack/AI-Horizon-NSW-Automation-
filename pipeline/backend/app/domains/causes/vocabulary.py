"""The cause vocabulary is golden/causes.json, not a copy of it — that file
is what the golden fixtures grade against (DESIGN.md W1), so a second,
drifting list here would be exactly the vocabulary-drift risk DESIGN.md's
'Known risks' section warns about."""

import json
from functools import lru_cache
from pathlib import Path

GOLDEN_CAUSES_PATH = Path(__file__).resolve().parents[5] / "golden" / "causes.json"


@lru_cache
def load_causes() -> list[dict]:
    data = json.loads(GOLDEN_CAUSES_PATH.read_text())
    return data["causes"]


def cause_ids() -> set[str]:
    return {c["id"] for c in load_causes()}


def get_cause(cause_id: str) -> dict | None:
    return next((c for c in load_causes() if c["id"] == cause_id), None)
