# Golden test cases

Fixed inputs and hand-checked answer keys for NSW diagnostic reasoning.
**Not an app** — no server, no UI, no dependency on `web/` or `vision/`, and
nothing here is imported by either. Nothing here calls a model, a retriever
or a detector at check time.

## The idea

Each case fixes all three inputs to the reasoning so the only thing being
tested is the reasoning itself:

1. **What the operator says** — always the same complaint.
2. **What the camera measured** — a real `vision/detect/` run over a real
   sample image, frozen.
3. **What the documents say** — passages quoted from the two project PDFs,
   treated as a complete and correct lookup.

The answer key is not our opinion. It comes from the generator that made the
image, in `vision/synth/defects.py`, which is the only source here
independent of the people writing the rules.

## The pair

The two cases exist together on purpose:

| Case | Image | Carryover (matc82 sec 3.5) |
|---|---|---|
| `nsw_inconsistent_size` | sizes scatter at random | **must not** rank first — the signature is absent |
| `nsw_missing_carryover` | every miss is followed by an oversized dot | **must** rank first — the signature is present on all three misses |

The measurement that separates them is `small_then_big_count` in each
`signals.json`: 1 of 4 small dots for the first case, which chance gives 62%
of the time, against 3 of 3 for the second, which chance gives about 1% of
the time.

An engine that always likes the carryover answer passes one case and fails
the other. So does an engine that never considers it. That is the point.

## Layout

```
golden/
  README.md                  -- this file
  causes.json                 -- the candidate causes both cases grade against,
                                 with sources and the matching ids in web/packs/nsw
  check_golden.py             -- structural checks over every case
  nsw_inconsistent_size/      -- negative control
  nsw_missing_carryover/      -- positive control
    README.md                 -- what the case is, and where each file came from
    expected.json             -- the answer key, for a script
    expected_reasoning.md     -- the answer key in prose, plus how the app scores today
    user_input.json           -- the operator's complaint
    sidecar.json              -- the recipe and the generator's ground truth
    cv_output.json            -- real detect() output
    signals.json              -- numbers derived from cv_output.json
    rag_output.json           -- document passages, no conclusion
    img/                      -- the image, and the annotated version
```

## Running the checks

```bash
python3 golden/check_golden.py
```

This verifies that each `signals.json` really follows from its
`cv_output.json`, that each answer key matches the generator's own ground
truth and the operator's complaint, and that each document lookup covers
every candidate cause while stating no conclusion. It does not grade an
engine; there isn't one to grade yet.

## Where these cases stand today

Both were run against `web/engines/deterministic.ts`. The inconsistent case
gets an acceptable top cause but makes a false "spreading" claim from a
vision signal. The carryover case fails outright, because the pack has no
carryover cause to rank. Each case's `expected_reasoning.md` has the
measured numbers.
