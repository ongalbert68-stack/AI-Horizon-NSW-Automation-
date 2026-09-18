"""The "AI learning database" read: how often a problem shaped like this
one has been seen before, and what it turned out to be.

Deliberately a count, not a retrieval. The *matching* is coarse_match's —
structural agreement across the five axes, behind the same
material/dispenser hard filter — and this module only tallies what those
matched cases were finally diagnosed as. There is no embedding store and
no similarity model here, for the reason DESIGN.md gives for the whole
retrieval path: the axes are categorical and the signals numeric, so
neither half is text, and a similarity score nobody can explain is worth
nothing in front of an engineer who disagrees with it.

Descriptive only, and that is load-bearing. Gate B (ranking/gates.py) is
the single path from precedent to likelihood, and it can only ever demote.
Folding "8 of 12 said air bubbles" into the score would reintroduce
exactly the post-hoc credit assignment step 8 exists to keep out of the
database, so this number is shown to a human and reaches nothing else.
"""

from dataclasses import dataclass, field

from sqlalchemy import select
from sqlalchemy.orm import Session

from app.domains.cases.model import Case
from app.domains.causes.vocabulary import get_cause
from app.domains.retrieval.coarse import coarse_match

# Below this, a tally is noise dressed as history: "occurred twice before,
# once it was X" invites a conclusion two cases cannot support. The count
# is still reported, but without the headline sentence.
MIN_CASES_FOR_SENTENCE = 3

# Counting is over the whole matched set, not coarse_match's default
# top-10 page — a frequency claim that silently truncated at ten would
# under-report the moment the history grew past it.
MATCH_SCAN_LIMIT = 500


@dataclass
class CauseTally:
    cause_id: str
    label: str
    count: int
    share: float


@dataclass
class PrecedentStats:
    """`total` counts every similar case; `diagnosed_total` counts the
    subset that reached a confirmed cause. They differ, and the sentence
    quotes both, because a case that was never diagnosed is history the
    tally cannot speak for."""

    total: int
    diagnosed_total: int
    matched_axes: list[str] = field(default_factory=list)
    by_cause: list[CauseTally] = field(default_factory=list)
    sentence: str | None = None
    note: str = ""


def _label_for(cause_id: str) -> str:
    cause = get_cause(cause_id)
    return cause["label"] if cause else cause_id.replace("_", " ")


def precedent_stats(db: Session, case: Case) -> PrecedentStats:
    fingerprint = case.fingerprint or {"axes": {}, "signals": {}}
    matches = coarse_match(
        db,
        dispenser_class=case.station.dispenser_class.value,
        material_family=case.profile.material.family.value,
        fingerprint=fingerprint,
        exclude_case_id=case.case_id,
        limit=MATCH_SCAN_LIMIT,
    )
    if not matches:
        return PrecedentStats(
            total=0, diagnosed_total=0,
            note=(
                "No past case on this material and dispenser matches enough of this "
                "fingerprint to count — there is no history to draw on yet."
            ),
        )

    # Which axes did the agreement actually rest on? DESIGN.md is explicit
    # that a precedent count has to say what it matched on, so an engineer
    # can price it: "12 similar cases" that agreed only on material is a
    # different claim from 12 that agreed on footprint and response.
    matched_axes = sorted({axis for m in matches for axis in m.matched_axes})

    rows = db.scalars(select(Case).where(Case.case_id.in_([m.case_id for m in matches])))
    counts: dict[str, int] = {}
    for past in rows:
        cause_id = (past.diagnosis or {}).get("cause_id")
        if cause_id:
            counts[cause_id] = counts.get(cause_id, 0) + 1

    total = len(matches)
    diagnosed_total = sum(counts.values())
    by_cause = sorted(
        (
            CauseTally(
                cause_id=cause_id, label=_label_for(cause_id), count=n,
                share=round(n / diagnosed_total, 4) if diagnosed_total else 0.0,
            )
            for cause_id, n in counts.items()
        ),
        key=lambda t: -t.count,
    )

    if total < MIN_CASES_FOR_SENTENCE:
        return PrecedentStats(
            total=total, diagnosed_total=diagnosed_total, matched_axes=matched_axes,
            by_cause=by_cause,
            note=(
                f"Only {total} similar case(s) on file — too few to read a pattern from, "
                f"so no headline is drawn."
            ),
        )

    times = "once" if total == 1 else f"{total} times"
    if not by_cause:
        return PrecedentStats(
            total=total, diagnosed_total=0, matched_axes=matched_axes, by_cause=[],
            sentence=(
                f"Similar problems occurred {times} previously, but none of them reached a "
                "confirmed cause — there is nothing to say about what it turned out to be."
            ),
            note="Matched on " + ", ".join(matched_axes) + ".",
        )

    top = by_cause[0]
    cases_word = "case" if top.count == 1 else "cases"
    return PrecedentStats(
        total=total, diagnosed_total=diagnosed_total, matched_axes=matched_axes,
        by_cause=by_cause,
        sentence=(
            f"Similar problems occurred {times} previously. In {top.count} {cases_word}, "
            f"the main cause was {top.label.lower()}."
        ),
        note=(
            "Matched on " + ", ".join(matched_axes)
            + f". {diagnosed_total} of {total} reached a confirmed cause. "
            "History is shown as context and does not move the ranking."
        ),
    )
