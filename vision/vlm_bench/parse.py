"""Turns a raw model response (free text, hopefully JSON) into a validated
set of vocabulary tags. Small/local VLMs frequently ignore "respond with
ONLY JSON" -- wrap it in a code fence, add a preamble sentence, etc. -- so
this is deliberately lenient in *finding* the JSON but strict about what
tags it accepts out of it, so a hallucinated tag can't silently corrupt
scoring.
"""

from __future__ import annotations

import json
import re

from .vocab import ALL_TAGS

_JSON_OBJECT = re.compile(r"\{.*\}", re.DOTALL)
_TAG_WORD = re.compile(r"[a-z_]+")


def parse_response(raw: str) -> dict:
    """Returns {"defects": [...], "confidence": str|None, "notes": str,
    "method": "json"|"keyword_fallback", "unrecognized": [...], "raw": raw}.
    """
    match = _JSON_OBJECT.search(raw or "")
    if match:
        try:
            obj = json.loads(match.group(0))
        except json.JSONDecodeError:
            obj = None
        if isinstance(obj, dict) and "defects" in obj:
            candidates = obj.get("defects") or []
            if isinstance(candidates, str):
                candidates = [candidates]
            defects, unrecognized = _validate(candidates)
            return {
                "defects": defects,
                "confidence": obj.get("confidence") if isinstance(obj.get("confidence"), str) else None,
                "notes": obj.get("notes") if isinstance(obj.get("notes"), str) else "",
                "method": "json",
                "unrecognized": unrecognized,
                "raw": raw,
            }

    # Fallback: the model ignored the JSON instruction entirely. Scan for
    # any vocabulary tag mentioned as a whole word anywhere in the text --
    # better than discarding the response outright, but flagged distinctly
    # (method="keyword_fallback") so score.py/the log can report how often
    # a model refused to follow the output contract at all.
    words = set(_TAG_WORD.findall((raw or "").lower()))
    defects = sorted(t for t in ALL_TAGS if t in words)
    return {
        "defects": defects,
        "confidence": None,
        "notes": "",
        "method": "keyword_fallback",
        "unrecognized": [],
        "raw": raw,
    }


def _validate(candidates: list) -> tuple[list[str], list[str]]:
    defects, unrecognized = [], []
    for c in candidates:
        if not isinstance(c, str):
            unrecognized.append(repr(c))
            continue
        tag = c.strip().lower().replace(" ", "_")
        if tag in ALL_TAGS:
            if tag not in defects:
                defects.append(tag)
        elif tag and tag != "good":
            unrecognized.append(tag)
    return defects, unrecognized
