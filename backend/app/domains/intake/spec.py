"""Steps 1-2: the fixed question spine (DESIGN.md W3). Declared as data, not
endpoints or components, so the frontend renders one generic form from
whatever this module returns rather than hand-coding five screens."""

from dataclasses import dataclass


@dataclass(frozen=True)
class QuestionOption:
    value: str
    label: str
    """What the operator reads. `value` is the stored id and is never shown:
    slugging it into "near syringe end" put the machine's vocabulary on
    screen and left the sentence an operator would recognise unread in
    `help_text`."""
    help_text: str = ""
    """The plain-language example. DESIGN.md W3: "nobody on a line says
    'stringing', they say 'it leaves a hair'." """
    exclusive: bool = False
    """Selecting this clears every other selection on the same question —
    e.g. "Other / not sure", "Nothing unusual", "Don't know"."""


@dataclass(frozen=True)
class Question:
    id: str
    axis: str
    prompt: str
    kind: str  # "single" | "multi"
    options: list[QuestionOption]
    max_picks: int | None = None
    has_dont_know: bool = True
    has_other: bool = True


# Axis 1 lives with the defect picker (step 1) rather than the other four
# (step 2): the same option list is filled from the user's own pick *and*,
# later, from step 3's measurement, so it is asked here but scored as an
# axis like the rest.
IMAGE_ONLY_SIGNATURE_VALUE = "small_then_big"
"""Option 8 ('a small dot, then an oversized one') — the vocabulary holds
eight signature values but the picker exposes only the first seven; this
one can only be set by vision/service.py, and only above chance."""

DONT_KNOW_VALUE = "dont_know"
"""DESIGN.md W2: every question gets one, it adds no evidence, and it is
excluded from the 2b match rather than scored as a mismatch (W5: "a
missing axis is missing evidence, not evidence of difference"). No rule
in ranking/rules.py references it, so "adds no evidence" is structural
rather than a special case anyone has to remember."""

UNMAPPED_VALUE = "unmapped"
"""Stored when "Other (describe)" could not be mapped onto a real option
by the W7 call-1 mapper. The raw words go to `Fingerprint.axis_notes` —
DESIGN.md: "store the text, mark the axis `unmapped`, and exclude that
axis from the match rather than letting the enum space fork silently." """

UNSCORED_AXIS_VALUES = frozenset({DONT_KNOW_VALUE, UNMAPPED_VALUE})
"""Answers that carry no similarity information, for retrieval/coarse.py.

Deliberately excludes `not_tested` and `not_tried`: DESIGN.md is explicit
that "'Not tested' is not 'Don't know'" — it names a cheap experiment, so
it is a real answer that two cases can genuinely share."""

SIGNATURE_OPTIONS = [
    QuestionOption("too_little", "Too little", "starved, thin, under-filled"),
    QuestionOption("too_much", "Too much", "oversized, flooded"),
    QuestionOption("size_varies", "Size varies shot to shot", "some big, some small, no pattern"),
    QuestionOption("missing", "Missing deposits", "nothing came out at that point"),
    QuestionOption(
        "shape_changes_across_board",
        "Shape changes across the board",
        "squat in one area, tall in another",
    ),
    QuestionOption("wrong_shape", "Wrong shape", "tails, strings, satellites, voids — not round"),
    QuestionOption("spread_or_smeared", "Spread or smeared", "looked right, then ran out of place"),
    # small_then_big (option 8) is image-only — vision/service.py sets it,
    # it is never offered in the picker.
]

QUESTIONS: list[Question] = [
    Question(
        id="signature",
        axis="signature",
        prompt="Compared with a good deposit, what is wrong with the bad one?",
        kind="multi",
        max_picks=2,
        options=SIGNATURE_OPTIONS,
    ),
    Question(
        id="trajectory",
        axis="trajectory",
        prompt="How has it behaved since it started?",
        kind="single",
        options=[
            QuestionOption("sudden_step", "Sudden — from one point on", "fine, then bad from one shot onwards"),
            QuestionOption("gradual", "Gradual — over hours or days", "creeping worse, not a step change"),
            QuestionOption("random", "Random — comes and goes", "no pattern to when it happens"),
            QuestionOption("after_pause", "Only after a pause", "the first shots after the machine sat idle"),
            QuestionOption("after_running_a_while", "Only after running a while", "starts fine, drifts once it's warm"),
            QuestionOption("near_syringe_end", "Only near the end of a syringe", "the last part of the barrel"),
            QuestionOption("always_been_like_this", "It has always been like this", "this job never ran better than this"),
        ],
    ),
    Question(
        id="footprint",
        axis="footprint",
        prompt="If you move things around, what does the defect follow?",
        kind="single",
        options=[
            QuestionOption("material", "The material", "it moves with the syringe or the lot"),
            QuestionOption("tooling", "The nozzle, needle or valve", "swap the needle and the problem follows it"),
            QuestionOption("machine", "The machine or head", "the same program runs fine on another machine"),
            QuestionOption("recipe", "The product or program", "only this job — other jobs are fine"),
            QuestionOption("operator", "The shift or operator", "happens on one shift, not the others"),
            QuestionOption("everywhere", "Nothing — it happens everywhere", "swapping things around changes nothing"),
            QuestionOption("not_tested", "Not tested yet", "nothing has been swapped to find out — this becomes a check"),
        ],
    ),
    Question(
        id="inputs",
        axis="inputs",
        prompt="What is the state of the material and the supply right now?",
        kind="multi",
        options=[
            QuestionOption("fresh_lot", "Fresh lot, within pot life", "thawed and degassed per spec"),
            QuestionOption("new_lot_or_syringe", "New lot or syringe just started", "first job off it"),
            QuestionOption("near_out_time", "Near or past out-time", "been on the machine longer than spec allows"),
            QuestionOption("syringe_nearly_empty", "Syringe nearly empty", "down to the last of the barrel"),
            QuestionOption("ambient_changed", "Room temp or humidity changed", "hot day, aircon out, wet weather"),
            QuestionOption("air_supply_changed", "Air supply changed or serviced", "plant air down, wet line, new regulator"),
            QuestionOption(
                "nothing_unusual", "Nothing unusual",
                "material and supply are all normal", exclusive=True,
            ),
        ],
    ),
    Question(
        id="response",
        axis="response",
        prompt="What helps most, even temporarily?",
        kind="single",
        options=[
            QuestionOption("purge_or_prime", "Purging or priming", "clears it, at least for a few shots"),
            QuestionOption("wipe_or_change_needle", "Wiping or changing the needle", "comes good with a clean tip"),
            QuestionOption("new_syringe", "A new syringe", "a fresh barrel fixes it"),
            QuestionOption("raise_pressure_or_time", "Turning pressure or time up", "compensating gets the size back"),
            QuestionOption("let_it_warm_up", "Letting it warm up", "better once it's been running"),
            QuestionOption("restart_or_rehome", "Restarting or re-homing", "a power cycle or re-home clears it"),
            QuestionOption("nothing_helps", "Nothing tried helps", "none of the above made any difference"),
            QuestionOption("not_tried", "Not tried yet", "nothing has been tried — this becomes a check"),
        ],
    ),
]

AXIS_WEIGHTS: dict[str, float] = {
    # "an axis is worth what it localises" — footprint/response are the
    # highest-yield questions, signature/inputs the lowest (DESIGN.md W5).
    "footprint": 1.5,
    "response": 1.5,
    "trajectory": 1.0,
    "signature": 0.7,
    "inputs": 0.5,
}


def question_by_id(question_id: str) -> Question | None:
    return next((q for q in QUESTIONS if q.id == question_id), None)
