"""The one shared prompt every model in this benchmark is given, verbatim
and unmodified -- same text for Moondream2, Qwen2.5-VL, SmolVLM2, and
Gemini, every session. VLM output is famously prompt-sensitive, so the
benchmark only means anything if the prompt is the one fixed variable
across model comparisons; if a prompt revision is ever needed, bump
PROMPT_VERSION and start a new log entry rather than editing history.

Design pass against docs/personal/img_type.txt
================================================
Included, and why:

- All 16 dot-visible defect tags in vocab.TAG_VOCAB. These expand
  img_type.txt's issue list #1-#14 (dropping #15 "needle blockage", see
  below) to the generator's actual tag granularity -- e.g. img_type.txt's
  single "smearing, stringing, satellites" line is three distinct generator
  tags with three distinct visual signatures (see ../synth/defects.py), so
  collapsing them back into one prompt category would just be asking the
  model to guess which of three things it means.
- A note that carryover ("same class type: small/big/missing dots as
  leftover get carries to the next") is *relational*: the defect only makes
  sense read against the dot immediately before it in dispense order, not
  in isolation. Told explicitly, since a model scoring one dot at a time
  would otherwise have no way to know this pattern exists.
- A note that the dot pattern itself may be a perimeter, filled area,
  decorative pattern, custom grid landmark, or a line-traced path
  (img_type.txt's 5 pattern types) -- so the model is told not to assume a
  fixed rectangular grid or a fixed dot count.
- A caveat on air_bubble specifically: img_type.txt lists it under *both*
  "common dispense dots-only issues" (in scope) and "issues better
  diagnosed with 3D scope" (usually needs a height profile this flat image
  doesn't have). Kept in the vocabulary since the scope section says
  synthetic data should include it, but the model is explicitly told
  abstaining is fine -- mirrors detect/expected.py treating it as "not yet
  judged" rather than forcing a guess either way.

Excluded, and why:

- "Needle blockage" (img_type.txt's one "common dispense issue"). It's an
  equipment condition, not a visual dot symptom -- it's the *cause* behind
  missing/inconsistent dots, not itself a thing to point at in an image. If
  the model wants to say this, it should name the visible symptom instead
  (missing / inconsistent), which is already in-vocabulary.
- The four "issues better diagnosed with 3D scope" other than air_bubble:
  insufficient deposit height, dam height/width profile, laser profiling,
  pointed-vs-flat dome profile. None are recoverable from a flat 2D image
  with no height channel -- leaving them in the prompt would just invite a
  model to hallucinate a height judgement it has no pixels to support.
- The dispense *programming* parameters (dispense height, up height,
  dispense time, dwell time, ON/OFF delay). These are process-recipe
  numbers, not visual features -- an image cannot reveal them, and asking
  about them would only produce confabulated numbers.
- Color/tint reasoning. Per img_type.txt's CV scope note, these are 2D
  black-and-white images -- brightness/shape only, no color channel exists
  to reason about.

Output contract: strict JSON so score.py can parse it the same way across
every model. Kept deliberately small (a tag list + confidence + one-line
note) rather than per-dot bounding boxes -- localizing which *specific*
dot is at fault is a harder grounding task the smallest models here likely
can't do reliably, and ground_truth.py's scoring is image-level to match.
"""

from __future__ import annotations

from .vocab import ALL_TAGS, GOOD, TAG_VOCAB

PROMPT_VERSION = "v1"

_TAG_LINES = "\n".join(f'- "{tag}": {desc}' for tag, desc in TAG_VOCAB.items())

PROMPT = f"""You are inspecting a machine-vision image of a liquid-dispensing pattern: a set of round dots deposited on a substrate. The image is flat, 2D, and black-and-white (grayscale) -- there is no color and no height/depth information, only dot shape, size, brightness, and position.

The dots may be arranged as a closed perimeter, a filled area, a decorative pattern, a custom grid, or a line-traced path -- do not assume a fixed rectangular grid or a fixed dot count. Judge each dot only against its own neighbors in the image.

Look for these defect types (a dot showing none of them is normal):
{_TAG_LINES}

Notes:
- "carryover_big" only makes sense next to a "missing" dot immediately before it in the dispense sequence -- look for that pair, not an oversized dot on its own.
- "air_bubble" is genuinely hard to confirm from a flat 2D image with no height data. It is fine, and expected, to leave it out if you are not confident -- do not guess.
- Do not comment on needle blockage, deposit height, dam height/width, laser profiling, dot-dome curvature, or any dispense timing/programming parameter (dispense height, up height, dispense time, dwell time, ON/OFF delay). None of these can be seen in this image; only report what is visually present.

Respond with ONLY a single JSON object, no other text, no markdown code fence:
{{"defects": [<zero or more tags from the list above, or empty for none>], "confidence": "low" | "medium" | "high", "notes": "<one short sentence>"}}

If the image looks entirely normal, respond with an empty "defects" list (this represents "{GOOD}")."""

assert set(ALL_TAGS) == set(TAG_VOCAB)  # keeps prompt/vocab from silently drifting apart
