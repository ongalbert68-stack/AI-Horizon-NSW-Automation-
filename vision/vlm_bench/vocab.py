"""Single source of truth for the defect vocabulary VLMs are asked to choose
from. Deliberately the *generator's* tag names (see ../synth/defects.py),
not detect/classify.py's symptom names -- a VLM describing what it sees can
attempt the actual cause (e.g. "double_dispense"), unlike the silhouette-only
geometric pipeline in vision/detect/ which can only describe the resulting
shape (e.g. "oversized"). That makes this vocabulary, and the scoring in
score.py, a different and complementary axis to docs/vision_detection_log.md
-- not a replacement for it.

Definitions are written from what's actually visible in a flat 2D image,
grounded in how ../synth/defects.py constructs each defect and in
docs/personal/img_type.txt's issue list -- not from theoretical/textbook
defect names. Shared by prompt.py (to render the prompt), parse.py (to
validate/keyword-match a model's answer) and ground_truth.py (to know which
per-dot tags count as which class).
"""

from __future__ import annotations

GOOD = "good"

# tag -> one-line visual definition, in roughly the order docs/personal/img_type.txt lists them.
TAG_VOCAB: dict[str, str] = {
    "missing": "a dot that should be there is completely absent -- a blank gap in the pattern.",
    "carryover_big": (
        "a dot immediately after a missing one that is abnormally large, as if the "
        "missed dot's material landed on the next dot instead."
    ),
    "smearing": "a dot with a tail/streak trailing off in one direction that fades out to nothing.",
    "stringing": (
        "a dot with a thin, stringy tail trailing off in one direction, often ending in a "
        "tiny separate droplet at its tip."
    ),
    "satellite": "a small stray droplet near a dot but clearly separate from it, its own tiny blob.",
    "abnormal_shape": "a dot with an irregular, jagged, or lobed outline, not round, with no tail or fusion.",
    "overrun": "a dot much larger and flatter/more squashed than its neighbors, from too much material.",
    "ghost": "a faint dot that shows only as a thin ring/outline instead of a solid filled disk.",
    "air_bubble": (
        "a dot with a small void or gap inside it. Hard to be sure of from a flat 2D image "
        "with no height information -- abstain rather than guess."
    ),
    "double_dispense": (
        "a dot made of two overlapping lobes offset from each other, like a figure-eight or "
        "peanut shape, from dispensing twice at nearly the same spot."
    ),
    "misaligned": "an otherwise normal round dot sitting noticeably off from its expected position in the pattern.",
    "inconsistent": (
        "across the whole image, dot sizes vary a lot from dot to dot (some clearly bigger, "
        "some clearly smaller) with no single obvious local cause -- a pattern-wide problem, "
        "not any one dot."
    ),
    "dragged": "a dot with a straight tail stretched toward the next dot's position, as if dragged along the path.",
    "bridging": "two neighboring dots touching or fused together into one connected blob.",
    "line_start_defect": "on a line-traced dot path only: the very first dot in the line is missing.",
    "line_end_defect": "on a line-traced dot path only: the very last dot in the line is abnormally large/smeared.",
    "contamination_speck": (
        "a tiny stray mark elsewhere on the substrate, unrelated to any dispensed dot position -- "
        "may be too small/subtle to see confidently."
    ),
}

ALL_TAGS: tuple[str, ...] = tuple(TAG_VOCAB)
