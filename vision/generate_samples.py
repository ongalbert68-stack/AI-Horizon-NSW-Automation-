"""CLI for the synthetic dispensing-defect generator (see vision/synth/).

    .venv/bin/python generate_samples.py                 # canonical oracle set -> samples/
    .venv/bin/python generate_samples.py --mixed 200      # + 200 randomly mixed images -> samples/mixed/
"""

from __future__ import annotations

import argparse
import pathlib

from synth import dataset


def main() -> None:
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("--out", default="samples", help="output directory (default: samples/)")
    parser.add_argument("--seed", type=int, default=7, help="canonical-set seed")
    parser.add_argument("--mixed", type=int, default=0, help="also generate N randomly mixed images")
    parser.add_argument("--mixed-seed", type=int, default=11)
    parser.add_argument("--min-defects", type=int, default=0, help="min co-occurring defects per mixed image")
    parser.add_argument("--max-defects", type=int, default=3, help="max co-occurring defects per mixed image")
    args = parser.parse_args()

    out_dir = pathlib.Path(__file__).parent / args.out
    written = dataset.generate_canonical(out_dir, seed=args.seed)
    print(f"wrote {len(written)} canonical samples to {out_dir}/")
    for name in written:
        print(f"  {name}.png / {name}.json")

    if args.mixed:
        mixed_dir = out_dir / "mixed"
        written = dataset.generate_mixed(
            mixed_dir, args.mixed, seed=args.mixed_seed,
            k_range=(args.min_defects, args.max_defects),
        )
        print(f"\nwrote {len(written)} mixed samples to {mixed_dir}/")


if __name__ == "__main__":
    main()
