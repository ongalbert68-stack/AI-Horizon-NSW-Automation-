"""Closed case history, so the learning-database read has something to
count. Run with: uv run python -m app.seed_history

`app/seed.py` gives the app one station/material/profile to open a case
against. This gives it a *past* — retrieval/precedents.py tallies what
similar cases were diagnosed as, and with an empty table its honest answer
is "no history to draw on yet".

Shape of the history, and why it is this shape:

- Cases cluster into fingerprint families rather than spreading evenly.
  Real dispensing history is lumpy — one root cause produces a run of
  similar complaints — and a flat distribution would make every tally read
  "4 of 12 said each of three causes", which is no signal at all.
- Each family has a dominant cause and a minority of other outcomes. A
  history where the top cause won every single time would be a history
  nobody needs an AI for, and it would hide the case where precedent is
  wrong.
- Roughly a third close CONFIRMED, the rest PLAUSIBLE. CONFIRMED is the
  only tier fine_match/Gate B reads, and it is deliberately hard to reach
  (all five of step 8's conditions), so a realistic ratio is a minority.

The families below use the real axis values from intake/spec.py and the
real cause ids from golden/causes.json — a fingerprint built from invented
values would match nothing and quietly tally zero.

Re-running is safe: every case this writes carries `rules_version`
``SEED_RULES_VERSION`` and the script deletes those rows first, so it
replaces its own history and never touches cases you ran by hand.
"""

from datetime import UTC, datetime, timedelta

import app.core.models  # noqa: F401  (register every model first)
from app.core.database import SessionLocal
from app.domains.cases.model import Case
from app.domains.checks.model import CheckResult
from app.domains.checks.suggestions import suggestions_for
from app.domains.enums import CaseTier, CheckOutcome, DiagnosedState, RankTier
from app.domains.profiles.model import DispenseProfile
from app.domains.stations.model import DispenseStation

#: Marks the rows this script owns, so a re-run replaces its own history
#: instead of accumulating duplicates or deleting hand-run cases.
SEED_RULES_VERSION = "nsw-pack@1-history"


def _fingerprint(signature, trajectory, footprint, inputs, response, signals=None):
    return {
        "axes": {
            "signature": signature, "trajectory": trajectory, "footprint": footprint,
            "inputs": inputs, "response": response,
        },
        "signals": signals or {},
        "axis_notes": {},
    }


#: (complaint, complaint_text, fingerprint, cause_id, closes_confirmed)
#:
#: Family A — occasional volume swings on epoxy, mostly air in the fluid
#: path. This is the PDF's own worked example ("the dispensing dot is
#: sometimes too small", ranked to air bubbles because the volume changes
#: occasionally rather than continuously), so it is the family the
#: learning-database sentence is most likely to be read against.
FAMILY_A = [
    ("Inconsistent size shot to shot", "Dots vary in size, worse right after a pause.",
     ("air_in_fluid_path", True)),
    ("Inconsistent size shot to shot", "Some shots come out half size, then it recovers.",
     ("air_in_fluid_path", False)),
    ("Inconsistent size shot to shot", "Volume wanders through the shift, no pattern to it.",
     ("air_in_fluid_path", True)),
    ("Inconsistent size shot to shot", "Occasional undersized dot, mostly after the machine idles.",
     ("air_in_fluid_path", False)),
    ("Inconsistent size shot to shot", "Size is not repeatable, operator reports spitting.",
     ("air_in_fluid_path", False)),
    ("Inconsistent size shot to shot", "Dots inconsistent since the syringe was changed.",
     ("air_in_fluid_path", True)),
    ("Inconsistent size shot to shot", "Random small dots, purging seems to clear it for a while.",
     ("air_in_fluid_path", False)),
    ("Inconsistent size shot to shot", "Intermittent volume loss, bubbles visible in the barrel.",
     ("air_in_fluid_path", False)),
    # The minority outcomes: same complaint, different answer. Without
    # these the tally would claim a certainty the history does not have.
    ("Inconsistent size shot to shot", "Variable size, pressure gauge drifting on the gauge.",
     ("pressure_time_instability", False)),
    ("Inconsistent size shot to shot", "Sizes all over the place near the end of the syringe.",
     ("pressure_time_instability", True)),
    ("Inconsistent size shot to shot", "Inconsistent dots, material was near its out-time.",
     ("material_rheology_change", False)),
    ("Inconsistent size shot to shot", "Size varies, needle looked partly crusted over.",
     ("nozzle_blockage", False)),
]
FAMILY_A_FINGERPRINT = _fingerprint(
    ["size_varies"], "random", "material", ["new_lot_or_syringe"], "purge_or_prime",
    {"size_cv": 0.31, "size_cv_chance_p": 0.01},
)

#: Family B — starved and missing deposits on silicone, mostly a blocked
#: or contaminated fluid path. This is the family case #8 sits in.
FAMILY_B = [
    ("Missing or starved deposit", "Nozzle fires but nothing comes out on some pads.",
     ("nozzle_blockage", True)),
    ("Missing or starved deposit", "Skipped deposits across the board, pressure looks fine.",
     ("nozzle_blockage", False)),
    ("Missing or starved deposit", "Dry shots, needle tip crusted with cured material.",
     ("nozzle_blockage", False)),
    ("Missing or starved deposit", "Missing dots, nothing helped until the valve was stripped.",
     ("equipment_condition", True)),
    ("Missing or starved deposit", "Starved deposits, residue found in the valve chamber.",
     ("equipment_condition", False)),
    ("Missing or starved deposit", "No material at the pad, feed path gummed up.",
     ("equipment_condition", False)),
    ("Missing or starved deposit", "Intermittent misses, air slug in the supply line.",
     ("air_in_fluid_path", False)),
]
FAMILY_B_FINGERPRINT = _fingerprint(
    ["missing"], "always_been_like_this", "machine", ["nothing_unusual"], "nothing_helps",
    {"size_cv": 0.44, "size_cv_chance_p": 0.02},
)

#: Family C — oversized and smeared deposits traced to standoff/clamping.
FAMILY_C = [
    ("Material spreading beyond the area", "Dots smear outward at the board corners.",
     ("dispense_height_or_board_bending", True)),
    ("Material spreading beyond the area", "Spreading worse on one side of the panel.",
     ("dispense_height_or_board_bending", False)),
    ("Material spreading beyond the area", "Oversized footprint, board rocks in the fixture.",
     ("dispense_height_or_board_bending", False)),
    ("Material spreading beyond the area", "Material bridging pads after the fixture was swapped.",
     ("dispense_height_or_board_bending", False)),
    ("Material spreading beyond the area", "Excess spread, dispense time was raised last week.",
     ("pressure_time_instability", False)),
]
FAMILY_C_FINGERPRINT = _fingerprint(
    ["spread_or_smeared", "too_much"], "sudden_step", "recipe", ["nothing_unusual"],
    "raise_pressure_or_time", {"size_cv": 0.19, "size_cv_chance_p": 0.03},
)


def _build_case(
    *, station_id, profile_id, complaint, complaint_text, fingerprint, cause_id,
    confirmed, opened_at,
) -> Case:
    """One finished investigation: a fingerprint, the check that settled
    it, and a close record consistent with the tier.

    The check log is built from the cause's own suggested checks rather
    than invented text, so seeded history reads like history the loop
    itself would have produced.
    """
    suggestions = suggestions_for(cause_id)
    observation = next((s for s in suggestions if not s.is_change), None)
    change = next((s for s in suggestions if s.is_change), None)

    checks: list[CheckResult] = []
    sequence = 1
    if observation is not None:
        checks.append(
            CheckResult(
                sequence=sequence, check_name=observation.name, cause_id=cause_id,
                is_change=False, outcome=CheckOutcome.CONFIRMS,
                result_detail=observation.help, performed_at=opened_at + timedelta(minutes=12),
            )
        )
        sequence += 1

    # Exactly one change on a CONFIRMED case — step 8's second condition,
    # and the reason an unfixed case stays PLAUSIBLE however much looking
    # was done.
    if confirmed and change is not None:
        checks.append(
            CheckResult(
                sequence=sequence, check_name=change.name, cause_id=cause_id,
                is_change=True, outcome=CheckOutcome.CONFIRMS,
                result_detail="symptom cleared after the change",
                performed_at=opened_at + timedelta(minutes=25),
            )
        )

    verification = None
    if confirmed:
        verification = {
            "signal": "size_cv",
            "before": fingerprint["signals"].get("size_cv"),
            "after": 0.11, "in_spec": True, "shots_measured": 30, "recurred_after_days": None,
        }

    return Case(
        station_id=station_id, profile_id=profile_id,
        rules_version=SEED_RULES_VERSION,
        opened_at=opened_at,
        closed_at=opened_at + timedelta(hours=1),
        complaint=complaint, complaint_text=complaint_text,
        fingerprint=fingerprint,
        diagnosis={
            "cause_id": cause_id,
            "runners_up": [],
            "confirmed_by": {
                "check": (change or observation).name if (change or observation) else "check",
                "result": "confirmed",
            },
        },
        verification=verification,
        diagnosed=DiagnosedState.CHECK_CONFIRMED,
        resolved=confirmed,
        tier=CaseTier.CONFIRMED if confirmed else CaseTier.PLAUSIBLE,
        rank_tier=RankTier.T2 if confirmed else RankTier.T4,
        check_results=checks,
    )


def seed_history() -> None:
    db = SessionLocal()
    try:
        station = db.query(DispenseStation).first()
        if station is None:
            print("No station on file — run `python -m app.seed` first.")
            return

        profiles = db.query(DispenseProfile).all()
        if not profiles:
            print("No profile on file — run `python -m app.seed` first.")
            return

        # Family B is the silicone/starved family, so it wants a profile on
        # a silicone material where one exists; the others take the first
        # profile. Falls back to the first profile throughout if the
        # catalog only has one.
        silicone = next(
            (p for p in profiles if p.material and p.material.family.value == "silicone"), profiles[0]
        )
        default = profiles[0]

        existing = db.query(Case).filter(Case.rules_version == SEED_RULES_VERSION).all()
        if existing:
            for case in existing:
                db.delete(case)
            db.flush()
            print(f"Replaced {len(existing)} previously seeded case(s).")

        start = datetime.now(UTC) - timedelta(days=180)
        families = [
            (FAMILY_A, FAMILY_A_FINGERPRINT, default),
            (FAMILY_B, FAMILY_B_FINGERPRINT, silicone),
            (FAMILY_C, FAMILY_C_FINGERPRINT, default),
        ]

        written = 0
        for family, fingerprint, profile in families:
            for offset, (complaint, text, (cause_id, confirmed)) in enumerate(family):
                db.add(
                    _build_case(
                        station_id=station.station_id, profile_id=profile.profile_id,
                        complaint=complaint, complaint_text=text,
                        # Copied per case: they share a shape, but one dict
                        # shared by reference would make every later edit
                        # rewrite the whole family's history.
                        fingerprint={
                            "axes": dict(fingerprint["axes"]),
                            "signals": dict(fingerprint["signals"]),
                            "axis_notes": {},
                        },
                        cause_id=cause_id, confirmed=confirmed,
                        opened_at=start + timedelta(days=written * 4, hours=offset),
                    )
                )
                written += 1

        db.commit()
        confirmed_count = (
            db.query(Case)
            .filter(Case.rules_version == SEED_RULES_VERSION, Case.tier == CaseTier.CONFIRMED)
            .count()
        )
        print(f"Seeded {written} closed case(s), {confirmed_count} of them CONFIRMED.")
    finally:
        db.close()


if __name__ == "__main__":
    seed_history()
