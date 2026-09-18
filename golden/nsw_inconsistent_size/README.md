# Golden case: nsw_inconsistent_size

Dot sizes scatter at random across one array. The operator always reports
**"Inconsistent size shot to shot"**, the vision result is a real detector
run over a real sample image, and the document lookup is fixed and
hand-verified.

This is the **negative control** of the pair: the carryover mechanism from
matc82 sec 3.5 must *not* come first here, because its signature is absent
from the measurements. `../nsw_missing_carryover/` is the positive control,
where the same cause must come first.

## Files

| File | What it is | Where it came from |
|---|---|---|
| `expected.json` | The answer key, in a form a script can grade against | Written from what the generator does |
| `expected_reasoning.md` | The same thing in prose, plus how the current system scores | — |
| `user_input.json` | The operator's fixed complaint, as an `Answer[]` (`web/core/types.ts`) | Uses the real option text from `NSW_QUESTIONS` |
| `img/inconsistent.png` | The image the detector ran on | Copy of `vision/samples/inconsistent.png` |
| `sidecar.json` | The recipe (nominal dot positions) **and** the generator's per-dot ground truth | Copy of `vision/samples/inconsistent.json`, verified identical |
| `img/inconsistent_annotated.png` | `visualize.py`'s drawing of the result over the image | Copy of `vision/detect/annotated/inconsistent_annotated.png` |
| `cv_output.json` | Real `detect()` output, verified identical to a fresh run | See below |
| `signals.json` | Numbers derived from `cv_output.json` | `check_golden.py` recomputes each one |
| `rag_output.json` | The document lookup: passages only, no conclusion | Quoted from the two project PDFs |

`rag_output.json` deliberately holds no answer. An earlier version carried a
`synthesized_answer` and a `root_cause_hypothesis`, which meant the fixture
was handing over the conclusion it was supposed to be testing.

## Reproduce

```bash
# cv_output.json
cd vision && .venv/bin/python -m detect.run samples/inconsistent.png --profile samples/inconsistent.json

# signals.json, and every other structural check
python3 golden/check_golden.py
```

The detector is classical computer vision with no model, so a rerun
reproduces `cv_output.json` exactly.

## Using it

Feed an engine `user_input.json`, plus `cv_output.json` or `signals.json`,
plus the passages in `rag_output.json`. Then check its output against
`expected.json`: the defect it names, whether a forbidden cause leads,
whether it asks the frequency question, and whether it makes any claim in
`forbidden_claims`.

## Known issues recorded here

- `vision/main.py` reports a "spreading" signal on this image although
  nothing is smeared, which feeds a false claim into the needle-height
  cause. Details in `expected_reasoning.md`.
- Row 2 of the array does read smaller than rows 1 and 3, but within
  chance. The numbers, and a correction to an earlier claim of ours, are in
  `expected_reasoning.md`.
