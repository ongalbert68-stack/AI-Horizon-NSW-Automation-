"""The recipe a photo is checked against: where each dot was supposed to
land. Deliberately a plain dict/JSON shape, not tied to vision/synth's `Dot`
class -- a real product supplies this from its own dispense program, not
from this repo's generator, so this module has no import from vision/synth
at all.

Expected shape (this is exactly the "profile" key vision/synth writes into
every sample's JSON sidecar, so a sidecar can be passed straight through
unchanged during development):

    {"pattern": "area", "width": 720, "height": 460,
     "profile": [{"index": 0, "cx": 110.0, "cy": 110.0, "r": 26.0}, ...]}
"""

from __future__ import annotations

from dataclasses import dataclass


@dataclass
class ProfilePoint:
    index: int
    cx: float
    cy: float
    r: float


@dataclass
class Profile:
    points: list[ProfilePoint]
    pattern: str = ""
    width: int = 0
    height: int = 0


def load_profile(data: dict) -> Profile:
    points = [
        ProfilePoint(index=p["index"], cx=float(p["cx"]), cy=float(p["cy"]), r=float(p["r"]))
        for p in data["profile"]
    ]
    return Profile(
        points=points,
        pattern=data.get("pattern", ""),
        width=data.get("width", 0),
        height=data.get("height", 0),
    )
