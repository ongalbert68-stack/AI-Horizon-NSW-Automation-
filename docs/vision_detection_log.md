# Vision Detection — Change Log & Known Issues

Engineering log for `vision/detect/`. Each change-log entry records what
changed and the `evaluate.py` metrics measured right after.

## Reproduce the numbers

```bash
cd vision && .venv/bin/python -m detect.evaluate
```

Prints an **accuracy % per class + overall**, scored against `expected.py`'s
correct/incorrect table (the same one `visualize.py` colors rings by).
Classes marked "not yet judged" (air bubble, satellite, speck) are excluded
from the score, not counted as pass or fail. Several defect *causes* share
one *symptom* by design (`classify.py`), so a spread across a few tags in
the breakdown can be the correct outcome, not a partial failure.

## Visualize a prediction

```bash
cd vision
.venv/bin/python -m detect.visualize --sample missing_carryover   # one sample
.venv/bin/python -m detect.visualize --all --mixed                # everything
```

Draws a ring on every dot in `vision/detect/annotated/`: **green** = correct,
**red** = wrong (ground-truth tag shown alongside), **teal** = not yet
judgeable (air bubble, satellite, speck), **yellow** = stray unmatched blob.

## Known issues

- **~~Severe misalignment reads as `missing`~~ — mostly fixed 09-14.**
  Capping generator drift (see change log) took this from ~20% down to a
  residual **14/48 misaligned dots reading "nothing flagged"** rather than
  `missing` — still capture-radius-adjacent cases, just no longer wrong in
  the worse direction. Not fully closed.
- **A defect on one dot can still drag its clean neighbor down.** When two
  dots fuse (bridging, dragged), the aligner can't always tell which side is
  the real problem. Confirmed in `dragged_annotated.png`. Far smaller now —
  the 09-14 spacing/closed-loop fixes removed the *accidental* version of
  this (dots touching due to layout bugs, not real defects) — but the
  genuine case (an actual fused blob) is unresolved and needs real shape
  analysis (Tier 2), not an alignment tweak.

## Change log

### 2026-09-14 — Initial profile-aware detector

Added `vision/detect/`: `profile.py` (recipe schema), `segment.py` (Otsu +
contours, factored out of `main.py`), `align.py` (nearest-neighbor match to
profile positions, any pattern shape), `classify.py` (symptom tagging),
`report.py` (`detect()` entry point), `evaluate.py`. Also added
`nominal_cx/cy/r` to `vision/synth`'s `Dot` — a sample's sidecar now carries
a `profile` (recipe) section separate from `dots` (what actually happened),
since a misaligned dot needs something to compare its wrong position to.

**Baseline** (57 images, 916 dot-instances) — solid: `missing` 9/10,
`overrun` 7/7, `carryover_big`'s oversized half 7/10. Not attempted yet:
`air_bubble`, satellite/speck via `extra`, or disambiguating *why*
something's oversized.

<details>
<summary>Full breakdown</summary>

```
generator tag          n     predicted symptom breakdown
------------------------------------------------------------------------------
abnormal_shape         7     irregular=5, (nothing flagged)=1, undersized=1
air_bubble             3     (nothing flagged)=2, possibly_fused=1
bridging               18    missing=6, possibly_fused=3, oversized=3, irregular=3, misaligned=3
carryover_big          10    oversized=7, missing=2, irregular=1
double_dispense        7     oversized=4, (nothing flagged)=2, irregular=1
dragged                8     oversized=2, irregular=2, misaligned=2, missing=1, possibly_fused=1
ghost                  7     missing=4, possibly_fused=3
good                   658   (nothing flagged)=564, possibly_fused=33, oversized=20, irregular=20, misaligned=20, missing=1
inconsistent           68    (nothing flagged)=20, undersized=18, oversized=18, possibly_fused=7, irregular=3, misaligned=1, missing=1
line_end_defect        2     oversized=1, irregular=1
line_start_defect      2     possibly_fused=2
misaligned             90    misaligned=32, missing=22, (nothing flagged)=18, possibly_fused=10, oversized=4, irregular=4
missing                10    missing=9, possibly_fused=1
overrun                7     oversized=5, irregular=2
smearing               12    oversized=5, irregular=5, misaligned=2
stringing              7     irregular=5, oversized=1, misaligned=1

Extra (unmatched) blobs across all images: 27
```

</details>

### 2026-09-14 — Fusion-detection fix, `expected.py`, visualizer

Built `visualize.py` and immediately caught a real bug on the first sample
checked by eye: `bridging_dots` showed **both** positions as `missing` plus
the shared blob a third time as `extra` — `possibly_fused` never fired.

**Root cause:** a fused blob's centroid sits ~65px from each original
position on a 130px pitch — *past* the 47px capture radius — so neither
position ever claimed it, and the old fused-check only looked at
already-claimed blobs.

**Fix** (`align.py`): for an unmatched position, check whether some *other
unmatched* position shares the same nearest blob — mutual sharing, not
claim status, is what fusion actually looks like. That blob is also dropped
from `extra` once explained this way.

Added `expected.py`: one shared correct/incorrect table used by both
`evaluate.py` and `visualize.py`, so they can't silently disagree.

**Improved:** `missing` now 10/10. `bridging` now mostly `possibly_fused`
(was mostly `missing`). `ghost` and `line_start_defect` now clean `missing`
in every instance — the old check was producing false "fused" hints on
these genuinely-isolated cases. Stray `extra` blobs: 27 → 16.

**Still open:** `good`'s unwanted-flag rate didn't drop — it moved from
`possibly_fused` (33) to `missing` (30), same neighbor-contamination cause,
different wrong label. `misaligned`'s missing-instead-of-misaligned rate is
roughly unchanged. Both known issues above reflect this.

<details>
<summary>Full breakdown</summary>

```
generator tag          n     predicted symptom breakdown
------------------------------------------------------------------------------
abnormal_shape         7     irregular=5, (nothing flagged)=1, undersized=1
air_bubble             3     (nothing flagged)=2, possibly_fused=1
bridging               18    possibly_fused=6, missing=3, oversized=3, irregular=3, misaligned=3
carryover_big          10    oversized=7, possibly_fused=2, irregular=1
double_dispense        7     oversized=4, (nothing flagged)=2, irregular=1
dragged                8     possibly_fused=2, oversized=2, irregular=2, misaligned=2
ghost                  7     missing=7
good                   658   (nothing flagged)=564, missing=30, oversized=20, irregular=20, misaligned=20, possibly_fused=4
inconsistent           68    (nothing flagged)=20, undersized=18, oversized=18, possibly_fused=6, irregular=3, missing=2, misaligned=1
line_end_defect        2     oversized=1, irregular=1
line_start_defect      2     missing=2
misaligned             90    misaligned=32, (nothing flagged)=18, missing=18, possibly_fused=14, oversized=4, irregular=4
missing                10    missing=10
overrun                7     oversized=5, irregular=2
smearing               12    oversized=5, irregular=5, misaligned=2
stringing              7     irregular=5, oversized=1, misaligned=1

Extra (unmatched) blobs across all images: 16
```

</details>

### 2026-09-14 — Three real bugs found going case-by-case with the visualizer

1. **Misaligned drift was unbounded**, growing with column index past the
   detector's capture radius. **Capped at 1.4× r** (`defects.py`). Correct
   `misaligned` reads: **36% → 71%**.
2. **Path-based patterns had too little spacing** — perimeter/pattern/
   line_trace's default spacing barely exceeded the dot diameter, so
   ordinary jitter alone made clean neighbors touch and misread as fused.
   **Widened to 120px** (`layouts.py`). Found **26 false positives on
   completely defect-free images** (`mixed_0007`: `defects_applied: []`,
   4 dots wrongly flagged anyway).
3. **Closed loops duplicated their own start point** — `perimeter`'s first
   and last profile position landed on the *identical coordinate*,
   guaranteeing one misread as missing. Fixed the closed-path spacing math
   in `along_path`.

Also dropped one stale assertion (`line_end_defect flags shape`) that only
passed *because of* bug #2 — the "irregular" reading was incidental overlap
with a too-close neighbor, not the pooling shape itself.

**`good` dots wrongly flagged: 14.3% → 1.0%.** Extra stray blobs: 16 → 1.

<details>
<summary>Full breakdown</summary>

```
generator tag          n     predicted symptom breakdown
------------------------------------------------------------------------------
abnormal_shape         3     irregular=3
air_bubble             6     (nothing flagged)=6
bridging               16    possibly_fused=8, oversized=2, irregular=2, misaligned=2, missing=2
carryover_big          7     oversized=7
double_dispense        4     oversized=3, (nothing flagged)=1
dragged                8     possibly_fused=4, missing=1, oversized=1, irregular=1, misaligned=1
ghost                  1     missing=1
good                   499   (nothing flagged)=494, possibly_fused=3, missing=2
inconsistent           63    (nothing flagged)=24, oversized=22, undersized=16, possibly_fused=1
line_end_defect        2     oversized=2
line_start_defect      1     missing=1
misaligned             48    misaligned=34, (nothing flagged)=14
missing                7     missing=7
overrun                5     oversized=4, irregular=1
smearing               9     irregular=5, oversized=3, (nothing flagged)=1
stringing              8     irregular=7, (nothing flagged)=1

Extra (unmatched) blobs across all images: 1
```

</details>

### 2026-09-14 — Accuracy scoring + array-level `inconsistent` detection

* **Unified Benchmarking:** `evaluate.py` now prints hard **accuracy %** per class against `expected.py`'s truth table. Visualizer ring colors and CLI metrics finally draw from the exact same mathematical ground truth.
* **The Problem (`inconsistent` tanking at 60.3%):**
  * The generator samples radius as $r \sim \mathcal{U}(0.55, 1.50)$, but defect cutoffs operate on area ($\propto r^2$).
  * Solving for our tolerance band ($0.70\times$ to $1.40\times$ area) means any radius between $0.84\times$ and $1.18\times$ looks completely in-spec. That deadband swallows **~36% of the distribution by pure chance**.
  * A stateless, single-dot `classify_point` inspection mathematically cannot detect an array-wide distribution anomaly.
* **The Dumb Idea (Scrapped before shipping):**
  * Tried calculating an array-wide Coefficient of Variation ($CV = \sigma / \mu$) on blob areas.
  * Trashed it immediately: a single local `overrun` outlier ($A \ge 2.5\times$) in a mixed image spikes $\sigma$ globally, falsely flunking dozens of pristine, clean dots.
* **The Smart Fix (`classify_array` in `classify.py`):**
  * **The Physical Invariant:** Real dispense defects are strictly unidirectional—overrun, carryover, and double-dispense only ever inflate volume ($\Delta V > 0$). Starvation only ever shrinks it ($\Delta V < 0$).
  * Seeing **BOTH** an `oversized` ($>1.40\times$) **AND** an `undersized` ($<0.70\times$) dot on the exact same substrate pass is an unmistakable signature of pressure oscillation / fluid inconsistency.
  * If both coexist, post-classify any remaining unflagged dots in that array as `inconsistent`. Zero statistical threshold tuning required.
* **The Numbers:**
  * **`inconsistent`: 60.3% → 98.4%** (24 deadband dots successfully reclaimed).
  * **`good`: Locked at 99.0%** (494/499 clean; zero false-alarm spillover).
  * **OVERALL: 93.0% → 96.6%** (648 correct / 23 wrong / 6 unjudged). Extra blobs down to 1.

<details>
<summary>Full breakdown</summary>

```
generator tag          n     accuracy   predicted symptom breakdown
------------------------------------------------------------------------------------------
abnormal_shape         3     100.0%                   irregular=3
air_bubble             6      n/a  (6 not yet judged) (nothing flagged)=4, inconsistent=2
bridging               16    100.0%                   possibly_fused=8, oversized=2, irregular=2, misaligned=2, missing=2
carryover_big          7     100.0%                   oversized=7
double_dispense        4      75.0%                   oversized=3, (nothing flagged)=1
dragged                8     100.0%                   possibly_fused=4, missing=1, oversized=1, irregular=1, misaligned=1
ghost                  1     100.0%                   missing=1
good                   499    99.0%                   (nothing flagged)=494, possibly_fused=3, missing=2
inconsistent           63     98.4%                   inconsistent=24, oversized=22, undersized=16, possibly_fused=1
line_end_defect        2     100.0%                   oversized=2
line_start_defect      1     100.0%                   missing=1
misaligned             48     70.8%                   misaligned=34, (nothing flagged)=14
missing                7     100.0%                   missing=7
overrun                5     100.0%                   oversized=4, irregular=1
smearing               9      83.3%                   irregular=5, oversized=3, (nothing flagged)=1
stringing              8      87.5%                   irregular=7, (nothing flagged)=1
------------------------------------------------------------------------------------------
OVERALL                687    96.6% (648 correct / 23 wrong / 6 not yet judged)

Extra (unmatched) blobs across all images: 1
```

</details>
