# Golden case: nsw_missing_carryover

Three dots are missing, and each one is followed by an oversized dot at the
next dispense position. The operator always reports **"Missing dots"**, the
vision result is a real detector run over a real sample image, and the
document lookup is fixed and hand-verified.

This is the **positive control** of the pair: the carryover mechanism from
matc82 sec 3.5 must come first here, because its signature is in the
measurements on all three misses. `../nsw_inconsistent_size/` is the
negative control, where the same cause must not come first.

## Files

| File | What it is | Where it came from |
|---|---|---|
| `expected.json` | The answer key, in a form a script can grade against | Written from what the generator does |
| `expected_reasoning.md` | The same thing in prose, plus how the current system scores | — |
| `user_input.json` | The operator's fixed complaint, as an `Answer[]` (`web/core/types.ts`) | Uses the real option text from `NSW_QUESTIONS` |
| `img/missing_carryover.png` | The image the detector ran on | Copy of `vision/samples/missing_carryover.png` |
| `sidecar.json` | The recipe (nominal dot positions) **and** the generator's per-dot ground truth | Copy of `vision/samples/missing_carryover.json` |
| `img/missing_carryover_annotated.png` | `visualize.py`'s drawing of the result over the image | Copy of `vision/detect/annotated/missing_carryover_annotated.png` |
| `cv_output.json` | Real `detect()` output | See below |
| `signals.json` | Numbers derived from `cv_output.json` | `check_golden.py` recomputes each one |
| `rag_output.json` | The document lookup: passages only, no conclusion | Quoted from the two project PDFs |

## Reproduce

```bash
# cv_output.json
cd vision && .venv/bin/python -m detect.run samples/missing_carryover.png --profile samples/missing_carryover.json

# signals.json, and every other structural check
python3 golden/check_golden.py
```

## Using it

Feed an engine `user_input.json`, plus `cv_output.json` or `signals.json`,
plus the passages in `rag_output.json`. Then check its output against
`expected.json`: whether carryover leads, whether the remedy cites the
manual, and whether it makes any claim in `forbidden_claims`.

The signal that decides this case is `small_then_big_count`, which needs
per-dot tags in dispense order. `vision/detect/` produces them;
`vision/main.py`, which the app currently calls, does not.

## Known issues recorded here

- The current pack has no carryover cause, so it cannot pass this case. The
  measured results and the two related gaps are in `expected_reasoning.md`.
- The generator's carries are larger than physics would give (3.4x to 4.0x
  nominal area rather than about 2x), because it carries radius rather than
  volume. Details in `expected_reasoning.md`.
