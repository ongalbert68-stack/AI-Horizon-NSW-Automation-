# VLM Benchmark — Change Log

Engineering log for `vision/vlm_bench/`. This is a **benchmarking-only**
side track, not a replacement for the geometric detector in `vision/detect/`
(see [`vision_detection_log.md`](vision_detection_log.md), currently 96.6%
overall on the same dataset). The geometric pipeline is silhouette-only by
design and structurally can't judge texture-level defects (air bubble,
satellite, contamination speck — see `detect/classify.py`'s docstring). The
point of this track is to establish a baseline for whether a VLM could fill
that gap, or serve as a fallback/second opinion, in some future scenario —
not because current accuracy needs it today.

## Verdict (2026-09-15) — small local VLMs don't work here, track paused

**Small (<4B) local VLMs, run on CPU under this benchmark's one shared
prompt, do not detect any of this dataset's defect types.** `qwen2.5-vl-3b`
scored 13.6% overall on the full 57-image set, and that entire score is
the 12 `good` images it got right by predicting nothing at all — every one
of the 76 real defect instances was missed. `moondream2` and `smolvlm2`
showed the identical "always say good" pattern on their 5-sample smoke
tests. All three produced perfectly valid, correctly-formatted JSON the
whole time — this is a genuine capability finding, not a harness or
prompt-compliance bug. **This benchmarking track is paused here.**
`vision/detect/`'s geometric pipeline remains the working, primary
detector (96.6% overall — see `vision_detection_log.md`).

**Scope this verdict does and doesn't cover**, so a future session doesn't
have to re-derive it from the change log below:

- Covers: three open-weight models at 1.8B-3B params, forced onto CPU
  (fp32) after every GPU/quantization path failed on this laptop's ~3.68GB
  usable VRAM (see "Hardware note"), under one fixed 862-token prompt with
  an 18-tag closed vocabulary, scored at image level.
- Does **not** cover larger open models, or frontier models in general —
  `gemini-3.5-flash` never produced a single real result: its free tier
  (20 requests/day, 5/minute) was exhausted by 503 errors on the very
  first smoke test, before any actual prediction came back (see "Gemini
  quota").
- Does **not** rule out that a shorter prompt, few-shot examples, or
  per-dot grounding (`moondream2` has a native `detect`/`point` capability
  this benchmark never exercised, since scoring here is image-level) would
  change the result — none of that was tried, deliberately, since the
  point of this round was one fixed prompt across models, not prompt
  tuning.
- If this track is revisited: the cheapest next experiment is probably
  running the existing `gemini` backend (already rate-limited and
  quota-guarded) across a few images on a fresh day's quota, since it's
  the one model here with a real chance of a different outcome.

## Reproduce

```bash
cd vision
# vision/.venv has no pip (created by `uv venv`) -- install with uv instead:
uv pip install --python .venv/bin/python -r vlm_bench/requirements.txt   # heavy: torch + transformers + CUDA wheels
cp vlm_bench/.env.example vlm_bench/.env               # fill in GEMINI_API_KEY / GEMINI_MODEL

# one model per process -- see "Why one at a time" below
.venv/bin/python -m vlm_bench.runner --model moondream2
.venv/bin/python -m vlm_bench.runner --model qwen2.5-vl-3b
.venv/bin/python -m vlm_bench.runner --model smolvlm2
# gemini: PAUSED, see "Gemini quota" below -- don't run without a plan for the 20/day budget

.venv/bin/python -m vlm_bench.score --results vlm_bench/results/<file>.json
```

`--limit N` on `runner.py` runs only the first N samples, for a smoke test
before committing to a full run over the sample set (57 runnable images:
17 canonical + 40 mixed — see the 2026-09-15 change-log entry for the
`missing.json`/`missing.png` dataset quirk).

## Hardware note

The original plan assumed 6GB of VRAM. `nvidia-smi` on this machine actually
reports an **RTX 3050 Laptop with 4096 MiB (4GB) total** — checked 2026-09-15
while scaffolding this harness. That number is itself optimistic: in
practice only **~3.68GB was actually free** once the display/driver's own
reservation is accounted for, which mattered a lot below.

**All three local backends ended up running on CPU**, not GPU as originally
planned — every GPU option tried failed for a different reason (see the
2026-09-15 change-log entry for the full investigation):

- `moondream2` fp16 (~3.5GB weights) OOM'd on its first forward pass — no
  headroom left for activations out of that 3.68GB.
- `moondream2` 8-bit crashed inside its own `trust_remote_code` modeling
  code (a hardcoded bfloat16 cast ahead of the quantized matmul) —
  independent of the VRAM budget, a real incompatibility.
- `qwen2.5-vl-3b` 4-bit loaded fine but produced garbage output
  specifically on this benchmark's long (862-token) shared prompt —
  confirmed as a 4-bit numerical-stability issue, not a model or prompt
  problem, by reproducing a normal correct answer at full fp32 precision.
- `qwen2.5-vl-3b` 8-bit refused to load at all without CPU/disk offload —
  didn't fit in 3.68GB.
- `smolvlm2` was moved straight to CPU without a GPU attempt, on the
  strength of the two failures above.

CPU is slower (roughly 35-120s/image depending on the model) but reliable,
and this is offline benchmarking, not a latency-sensitive path — see each
backend function's docstring in `backends.py` for the specific reasoning.

## Why one model at a time

Each `runner.py` invocation loads exactly one backend and the process
exiting is what frees its memory — there's no in-process "run everything"
mode. Originally this was to respect the 4GB VRAM budget; now that all
three local backends run on CPU instead (see "Hardware note"), the reason
is simpler: this is a single-CPU laptop, and running multiple heavy
inference processes at once would just make all of them slower by
contending for the same cores. Run the `runner.py` commands above as
separate invocations, in any order.

## Shared prompt policy

All four models are given `vlm_bench/prompt.py`'s `PROMPT` **verbatim and
unmodified** — same text, no per-image or per-model templating. VLM output
is heavily prompt-dependent, so a cross-model comparison only means
anything if the prompt is the one fixed variable. If the prompt ever needs
revising, that becomes a new `PROMPT_VERSION` and a new log entry, rather
than an edit to history — every session entry below embeds the exact prompt
text it ran with, in its own dropdown, so old entries stay correct even
after the prompt changes.

## Gemini quota — PAUSED

A live smoke test on 2026-09-15 found the configured `GEMINI_MODEL`'s free
tier allows only **20 requests/day and 5/minute** on this project's key —
discovered by burning 5 requests on a first smoke test (all 503
UNAVAILABLE / "high demand", which still counted against quota). Running
Gemini over the full sample set (57 images) at that rate would take 3 days
minimum even with zero retries -- and this is meant to run per-session, not
be permanently staged across days.

Decision: **pause the Gemini backend** rather than design around the quota
for now (an alternative considered and rejected: a fixed one-sample-per-
generator-tag subset, ~15-18 images, that would fit in one day's budget —
worth revisiting later). `backends.gemini()` still exists and is safe to
call (rate-limited to under 5/minute, and refuses to exceed
`GEMINI_DAILY_LIMIT` calls in a single process run as a backstop against
accidentally spending the whole day's quota on one run), but is not part
of the current benchmark loop. Only the three local models
(`moondream2`, `qwen2.5-vl-3b`, `smolvlm2`) are being run for now.

## Tag vocabulary and scoring, vs. `detect/evaluate.py`

`vlm_bench/vocab.py` uses the **generator's** cause-level tag names
(`double_dispense`, `carryover_big`, `bridging`, ...) rather than
`detect/classify.py`'s symptom-level names (`oversized`, `possibly_fused`,
...) — see `vocab.py`'s docstring for the reasoning: a VLM describing what
it sees can attempt the actual cause, which the silhouette-only geometric
pipeline structurally cannot. Because the model is handed the same
vocabulary the ground truth is scored in, `vlm_bench/score.py` needs no
cause→symptom plausibility layer the way `detect/expected.py` does — a
prediction is simply right or wrong against the sidecar JSON's per-dot tags
(`vlm_bench/ground_truth.py`). Scoring is **image-level**, not per-dot: a
model has to name a defect tag present anywhere in the image, not localize
which specific dot has it. See `prompt.py`'s design-pass docstring for the
full include/exclude reasoning against `docs/personal/img_type.txt`.

## Models on the bench

| Backend id | Params | Runs on | Notes |
|---|---|---|---|
| `moondream2` | ~1.8B | CPU | has a native `detect`/`point` grounding capability, unused here since scoring is image-level. ~116s/image |
| `qwen2.5-vl-3b` | 3B | CPU | `Qwen/Qwen2.5-VL-3B-Instruct`. ~35-47s/image |
| `smolvlm2` | 2.2B | CPU | `HuggingFaceTB/SmolVLM2-2.2B-Instruct`, HF's own small VLM. ~45-52s/image |
| `gemini` | n/a (API) | network call | **paused** — see "Gemini quota" below. Model id `gemini-3.5-flash`, free tier is 20 requests/day |

## Change log

### 2026-09-15 — Harness scaffolded, first full run (qwen2.5-vl-3b: 13.6%)

Built `vision/vlm_bench/`: `vocab.py` (shared tag vocabulary + visual
definitions), `prompt.py` (the one shared prompt, with an explicit
include/exclude design pass against `docs/personal/img_type.txt`),
`ground_truth.py` (image-level ground truth from sample sidecars),
`parse.py` (lenient JSON extraction + keyword fallback + vocabulary
validation), `backends.py` (one function per model, lazy-imported deps),
`runner.py` (CLI, one model per process), `score.py` (accuracy report in
`evaluate.py`'s table format).

Corrected the VRAM assumption from 6GB to the actual 4GB (`nvidia-smi`) —
changed the default quantization plan for `qwen2.5-vl-3b` and `smolvlm2` to
4-bit before any weights were downloaded.

Verified current library usage (own knowledge cutoff is Jan 2026, so this
was checked rather than assumed) against live docs: Moondream2's
`revision="2025-06-21"` + `model.query()`, Qwen2.5-VL's
`Qwen2_5_VLForConditionalGeneration` + `qwen_vl_utils.process_vision_info`,
SmolVLM2's `AutoModelForImageTextToText` chat-template flow, and the
`google-genai` SDK's `client.models.generate_content` + `types.Part.from_bytes`
(one fetch first returned a suspicious `client.interactions.create(...)`
shape that didn't match anything in this SDK's actual history — discarded
after cross-checking against the library's own README on GitHub, which
confirmed `generate_content`/`response.text` instead).

Installed `vlm_bench/requirements.txt` into `vision/.venv` via `uv pip
install` (this venv has no `pip` binary — it was created with `uv venv`).
Resolved: `torch==2.14.0+cu130` (confirms CUDA available, device = RTX 3050
Laptop GPU), `transformers==5.17.0` (a major-version jump past the 4.49+
this was written against — re-verified all four needed classes still
import cleanly under 5.x before writing any benchmark numbers against it).

First live Gemini smoke test (5 samples) returned 503 UNAVAILABLE on every
call and, in the process, surfaced that the free tier is 20 requests/day,
5/minute — see "Gemini quota" below. **Gemini is paused** as a result;
`backends.gemini()` gained rate limiting and a daily-call guardrail, but
only the three local models are being benchmarked for now.

Smoke-tested (`--limit 5`) all three local backends and hit five real bugs
in sequence, each fixed before moving on:

1. **transformers 5.x breaks moondream2.** `AttributeError: 'HfMoondream'
   object has no attribute 'all_tied_weights_keys'` — confirmed via search
   as a known, widespread break: transformers 5.x requires
   `trust_remote_code` models to call a new `post_init()` pattern that
   moondream2's remote code doesn't. Pinned `transformers>=4.49,<5.0`
   (now `4.57.6`); re-verified Qwen2.5-VL/SmolVLM2 classes still import
   fine at that version before re-testing.
2. **moondream2 fp16 OOM's on the real ~3.68GB free VRAM**, not the
   nominal 4GB. Tried 8-bit quantization next; that hit a *different*
   failure (`RuntimeError: expected scalar type Float but found Half`,
   moondream2's remote code hardcoding a bfloat16 cast regardless of the
   dtype requested) that persisted even after forcing `dtype=torch.float16`
   at load — not a caller-side fix. Moved `moondream2` to CPU; runs clean.
3. **Qwen2.5-VL missing `torchvision`** (`AutoVideoProcessor` imports it
   even for a still image) and **SmolVLM2 missing `num2words`** (its
   processor requires it) — both added to `requirements.txt`.
4. **Qwen2.5-VL-3B at 4-bit produced garbage** on this benchmark's full
   prompt: exactly `"{\n failed to<|im_end|>"` (a real, deterministic EOS
   stop — confirmed via raw token ids, not a decoding artifact) on every
   sample regardless of image content. A short test prompt worked fine at
   4-bit, isolating this to prompt length (862 prompt tokens + image =
   1325 total), not the model or quantization in general. Confirmed by
   reproducing the *same* prompt on CPU at full fp32: normal, correct,
   well-formed JSON. 8-bit was tried as a middle ground next and refused
   to load at all without CPU/disk offload (didn't fit in 3.68GB). Moved
   `qwen2.5-vl-3b` to CPU (fp32) given both GPU paths failed.
5. **`smolvlm2` was echoing its own prompt back as its answer.** Not a
   model or quantization issue this time — a real bug in `backends.py`:
   `model.generate()` returns the input prompt tokens followed by the new
   ones, and this function decoded the *whole* sequence instead of
   slicing off the prompt (the `qwen2_5_vl_3b` function next to it did
   this slicing correctly; `smolvlm2` just didn't). Every predicted tag
   was "correct" for the wrong reason — the tag names were literally
   sitting in the prompt text quoted back verbatim, matched by `parse.py`'s
   keyword fallback. Fixed by slicing `generated[:, input_len:]` before
   decoding, matching the Qwen backend. Given 8-bit also failed to load
   for the two backends above, `smolvlm2` went straight to CPU without a
   separate GPU attempt.

Also corrected an earlier documentation error in this log: the sample set
is **57 runnable images** (18 canonical sidecars, but `missing.json` has no
matching `missing.png` — a pre-existing dataset quirk, not introduced here;
`ground_truth.iter_samples()` skips it the same way `detect/evaluate.py`
does — + 40 mixed = 57), not "~700" — that number came
from misreading `detect/evaluate.py`'s 687 *dot-instance* count as an
image count. This also means the Gemini free-tier math above was too
pessimistic (57 images/20-per-day is 3 days, not a month) — the pause
decision stands for this session regardless.

**Preliminary smoke-test finding (n=5, not yet the full set):** all three
local backends, once actually working, converge on the same answer —
`{"defects": [], "confidence": "high", ...}` on every one of 5 images that
each have a real, ground-truth-confirmed defect. Not a bug this time (raw
responses are valid, correctly-formatted JSON) — a genuine early signal
that all three under-trigger on this prompt/task at this model size.

**Ran `qwen2.5-vl-3b` against the full 57-image set to check whether that
held at scale. It did, almost entirely:**

```
Model: qwen2.5-vl-3b | prompt v1 | 57 images | 2028.0s total

generator tag          n     accuracy   predicted breakdown
------------------------------------------------------------------------------------------
abnormal_shape         3       0.0%     (missed)=3
air_bubble             6       0.0%     (missed)=6
bridging               6       0.0%     (missed)=6
carryover_big          4       0.0%     (missed)=4
contamination_speck    6       0.0%     (missed)=6
double_dispense        4       0.0%     (missed)=4
dragged                6       0.0%     (missed)=6
ghost                  1       0.0%     (missed)=1
good                   12    100.0%     (nothing flagged)=12
inconsistent           5       0.0%     (missed)=5
line_end_defect        2       0.0%     (missed)=2
line_start_defect      1       0.0%     (missed)=1
misaligned             4       0.0%     (missed)=4
missing                4       0.0%     (missed)=4
overrun                4       0.0%     (missed)=4
satellite              6       0.0%     (missed)=6
smearing               6       0.0%     (missed)=6
stringing              8       0.0%     (missed)=8
------------------------------------------------------------------------------------------
OVERALL                88     13.6% (12 correct / 76 wrong)

False positives on 'good' images: 0/12
Output-format compliance: {'json': 57} (errors: 0)
```

**Reading this:** the harness itself is working correctly — 100% valid
JSON, zero errors, zero false positives on clean images, ~35s/image. The
model just predicts empty defects on every single image, defective or not.
The 13.6% "accuracy" is entirely the 12 `good` images it gets right by
never predicting anything at all; every one of the 76 actual-defect
instances is a miss. This isn't a prompt-compliance failure (it followed
the JSON contract perfectly) — `Qwen2.5-VL-3B-Instruct`, on CPU/fp32, with
this shared prompt, does not detect any of this dataset's defect types at
this model size. Whether a shorter prompt, few-shot examples, or a larger
Qwen2.5-VL variant changes this is open for a future session — not tried
here, since the prompt is deliberately fixed across models this round (see
"Shared prompt policy").

**`moondream2` and `smolvlm2` not yet run against the full set** — both
showed the same 5/5 empty-prediction pattern on the smoke test as Qwen, so
a similarly low score is likely but unconfirmed. Left for a future session.

<details>
<summary>Prompt used (v1) — the exact text `qwen2.5-vl-3b`'s full run above was scored against</summary>

```
You are inspecting a machine-vision image of a liquid-dispensing pattern: a set of round dots deposited on a substrate. The image is flat, 2D, and black-and-white (grayscale) -- there is no color and no height/depth information, only dot shape, size, brightness, and position.

The dots may be arranged as a closed perimeter, a filled area, a decorative pattern, a custom grid, or a line-traced path -- do not assume a fixed rectangular grid or a fixed dot count. Judge each dot only against its own neighbors in the image.

Look for these defect types (a dot showing none of them is normal):
- "missing": a dot that should be there is completely absent -- a blank gap in the pattern.
- "carryover_big": a dot immediately after a missing one that is abnormally large, as if the missed dot's material landed on the next dot instead.
- "smearing": a dot with a tail/streak trailing off in one direction that fades out to nothing.
- "stringing": a dot with a thin, stringy tail trailing off in one direction, often ending in a tiny separate droplet at its tip.
- "satellite": a small stray droplet near a dot but clearly separate from it, its own tiny blob.
- "abnormal_shape": a dot with an irregular, jagged, or lobed outline, not round, with no tail or fusion.
- "overrun": a dot much larger and flatter/more squashed than its neighbors, from too much material.
- "ghost": a faint dot that shows only as a thin ring/outline instead of a solid filled disk.
- "air_bubble": a dot with a small void or gap inside it. Hard to be sure of from a flat 2D image with no height information -- abstain rather than guess.
- "double_dispense": a dot made of two overlapping lobes offset from each other, like a figure-eight or peanut shape, from dispensing twice at nearly the same spot.
- "misaligned": an otherwise normal round dot sitting noticeably off from its expected position in the pattern.
- "inconsistent": across the whole image, dot sizes vary a lot from dot to dot (some clearly bigger, some clearly smaller) with no single obvious local cause -- a pattern-wide problem, not any one dot.
- "dragged": a dot with a straight tail stretched toward the next dot's position, as if dragged along the path.
- "bridging": two neighboring dots touching or fused together into one connected blob.
- "line_start_defect": on a line-traced dot path only: the very first dot in the line is missing.
- "line_end_defect": on a line-traced dot path only: the very last dot in the line is abnormally large/smeared.
- "contamination_speck": a tiny stray mark elsewhere on the substrate, unrelated to any dispensed dot position -- may be too small/subtle to see confidently.

Notes:
- "carryover_big" only makes sense next to a "missing" dot immediately before it in the dispense sequence -- look for that pair, not an oversized dot on its own.
- "air_bubble" is genuinely hard to confirm from a flat 2D image with no height data. It is fine, and expected, to leave it out if you are not confident -- do not guess.
- Do not comment on needle blockage, deposit height, dam height/width, laser profiling, dot-dome curvature, or any dispense timing/programming parameter (dispense height, up height, dispense time, dwell time, ON/OFF delay). None of these can be seen in this image; only report what is visually present.

Respond with ONLY a single JSON object, no other text, no markdown code fence:
{"defects": [<zero or more tags from the list above, or empty for none>], "confidence": "low" | "medium" | "high", "notes": "<one short sentence>"}

If the image looks entirely normal, respond with an empty "defects" list (this represents "good").
```

</details>
