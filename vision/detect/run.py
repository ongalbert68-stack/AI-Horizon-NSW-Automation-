"""Run detect() against any image on disk -- not just this repo's samples.
Prints the JSON result to stdout, or writes it with --out.

    .venv/bin/python -m detect.run path/to/photo.png
    .venv/bin/python -m detect.run path/to/photo.png --profile recipe.json
    .venv/bin/python -m detect.run path/to/photo.png --profile recipe.json --out result.json

Without --profile, there's no nominal position to align blobs against, so
this returns raw per-blob measurements only -- no tags, no summary (see
report.py's docstring on why). --profile takes the same JSON shape
vision/synth writes into every sample's .json sidecar:

    {"pattern": "area", "width": 740, "height": 480,
     "profile": [{"index": 0, "cx": 110.0, "cy": 110.0, "r": 26.0}, ...]}

A real dispense program already has this before it dispenses anything --
it isn't something to guess from the image itself.
"""

from __future__ import annotations

import argparse
import json
import pathlib
import sys

from .report import detect


def main() -> None:
    parser = argparse.ArgumentParser(description=__doc__, formatter_class=argparse.RawDescriptionHelpFormatter)
    parser.add_argument("image", type=pathlib.Path, help="path to any image file (png, jpg, ...)")
    parser.add_argument("--profile", type=pathlib.Path, default=None,
                         help="JSON recipe of expected dot positions; omit for raw measurements only")
    parser.add_argument("--out", type=pathlib.Path, default=None, help="write JSON here instead of printing it")
    args = parser.parse_args()

    if not args.image.exists():
        sys.exit(f"No such image: {args.image}")
    if args.profile and not args.profile.exists():
        sys.exit(f"No such profile: {args.profile}")

    profile_data = json.loads(args.profile.read_text()) if args.profile else None
    result = detect(args.image.read_bytes(), profile_data)

    text = json.dumps(result, indent=2)
    if args.out:
        args.out.write_text(text)
        print(f"Wrote {args.out}")
    else:
        print(text)


if __name__ == "__main__":
    main()
