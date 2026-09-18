"""Step 5 pass 1's rule set: one CauseRule list per golden/causes.json
entry. DESIGN.md W2's fix over the old pack is applied throughout: signal
rules scale continuously by distance from a chance/nominal baseline
instead of firing at full weight the instant a fixed threshold is
crossed, so 0.16 and 0.49 on size_cv no longer score the same.

Grounded in the same manual sections golden/causes.json cites — the
`source` on each rule is what causes/compare.py shows as the citation for
step 4, and what a human can argue with, per DESIGN.md's design goal.
"""

from collections.abc import Callable
from dataclasses import dataclass
from typing import Literal

Fingerprint = dict  # {"axes": {...}, "signals": {...}} — see cases/schema.py


def clamp(value: float, lo: float = 0.0, hi: float = 1.0) -> float:
    return max(lo, min(hi, value))


def ramp(value: float, baseline: float, spread: float, cap: float = 1.5) -> float:
    """0 at/below baseline, ramping linearly to `cap` as value moves one
    `spread` past it. This is the "how far past chance/nominal" scaling
    DESIGN.md W2 asks for, in place of a binary threshold."""
    if spread <= 0:
        return 0.0
    return clamp((value - baseline) / spread, 0.0, cap)


@dataclass(frozen=True)
class CauseRule:
    label: str
    detail: str
    source: str
    evaluate: Callable[[Fingerprint], float | None]  # logit contribution, or None if it doesn't fire
    kind: Literal["signal", "answer"] = "answer"


def _signal(fp: Fingerprint, key: str) -> float | None:
    value = fp.get("signals", {}).get(key)
    return value if isinstance(value, int | float) else None


def _axis(fp: Fingerprint, axis: str) -> str | list[str] | None:
    return fp.get("axes", {}).get(axis)


def _has(fp: Fingerprint, axis: str, value: str) -> bool:
    got = _axis(fp, axis)
    if isinstance(got, list):
        return value in got
    return got == value


# ---- reusable signal rules -------------------------------------------------

def _size_cv_instability(weight: float):
    def rule(fp: Fingerprint) -> float | None:
        cv = _signal(fp, "size_cv")
        if cv is None:
            return None
        strength = ramp(cv, baseline=0.15, spread=0.20)
        return weight * strength if strength > 0 else None
    return rule


def _carryover_pattern(weight: float):
    def rule(fp: Fingerprint) -> float | None:
        count = _signal(fp, "small_then_big_count")
        p = _signal(fp, "small_then_big_chance_p")
        if not count or p is None or p >= 0.05:
            return None
        # Further below the 0.05 chance line = stronger evidence, capped.
        strength = clamp(1.0 + (0.05 - p) / 0.05, 1.0, 2.0)
        return weight * strength
    return rule


def _low_circularity(weight: float):
    def rule(fp: Fingerprint) -> float | None:
        circ = _signal(fp, "mean_circularity")
        if circ is None:
            return None
        strength = ramp(0.80 - circ, baseline=0.0, spread=0.30)
        return weight * strength if strength > 0 else None
    return rule


def _missing_without_carryover(weight: float):
    def rule(fp: Fingerprint) -> float | None:
        missing = _signal(fp, "missing_count")
        p = _signal(fp, "small_then_big_chance_p")
        if not missing or (p is not None and p < 0.05):
            return None  # the carryover rule already explains this pattern better
        strength = ramp(float(missing), baseline=0.0, spread=3.0)
        return weight * strength if strength > 0 else None
    return rule


def _answer(weight: float):
    def rule(_fp: Fingerprint) -> float | None:
        return weight
    return rule


# ---- cause definitions ------------------------------------------------------
# Each tuple: (rule, only fires when predicate(fp) is true)

def _r(label: str, detail: str, source: str, evaluate, kind: Literal["signal", "answer"] = "answer") -> CauseRule:
    return CauseRule(label=label, detail=detail, source=source, evaluate=evaluate, kind=kind)


def _gated(predicate, make_rule):
    """Wrap an answer-triggered rule so it only evaluates when predicate(fp)."""
    def evaluate(fp: Fingerprint) -> float | None:
        return make_rule(fp) if predicate(fp) else None
    return evaluate


CAUSE_RULES: dict[str, list[CauseRule]] = {
    "volume_too_small_carryover": [
        _r(
            "Small dot then oversized dot, above chance",
            "The next deposition point measured oversized after a small/missing one — matc82's carryover signature, and above the chance baseline for this dispense order.",
            "matc82 sec 3.5 p.18-19",
            _carryover_pattern(2.2), kind="signal",
        ),
        _r(
            "Response: purging helps",
            "Purging is the standard remedy for insufficient volume reaching the pad.",
            "matc82 sec 3.5 p.18-19",
            _gated(lambda fp: _has(fp, "response", "purge_or_prime"), _answer(0.6)),
        ),
    ],
    "pressure_time_instability": [
        _r(
            "Size varies shot to shot, no clear pattern",
            "Shot-to-shot volume variability is the signature of an unstable pressure-time system.",
            "matc82 sec 2.1 p.6",
            _size_cv_instability(1.4), kind="signal",
        ),
        _r(
            "Footprint follows the machine or head",
            "Points at the dispense unit itself rather than material or tooling.",
            "matc82 sec 2.1 p.6",
            _gated(lambda fp: _has(fp, "footprint", "machine"), _answer(1.0)),
        ),
        _r(
            "Plant air supply changed or unreliable",
            "Pressure-time systems draw directly on plant air; a change there changes every shot.",
            "matc82 sec 2.1 p.6",
            _gated(lambda fp: _has(fp, "inputs", "air_supply_changed"), _answer(1.3)),
        ),
        _r(
            "Response: raising pressure/time helps",
            "Compensating with more pressure or time is consistent with an underlying instability.",
            "brief p.3",
            _gated(lambda fp: _has(fp, "response", "raise_pressure_or_time"), _answer(0.5)),
        ),
    ],
    "air_in_fluid_path": [
        _r(
            "Occasional, comes and goes",
            "The brief links air entrapment to volume that changes occasionally, not continuously.",
            "brief p.3",
            _gated(lambda fp: _has(fp, "trajectory", "random"), _answer(1.0)),
        ),
        _r(
            "Only on the first shots after a pause",
            "Air pockets settle during a pause and clear a few shots in — a distinctive time signature.",
            "brief p.3",
            _gated(lambda fp: _has(fp, "trajectory", "after_pause"), _answer(1.3)),
        ),
        _r(
            "Response: purging or a new syringe helps",
            "Purging expels trapped air; a fresh syringe removes it entirely.",
            "brief p.4",
            _gated(
                lambda fp: _has(fp, "response", "purge_or_prime") or _has(fp, "response", "new_syringe"),
                _answer(1.1),
            ),
        ),
        _r(
            "Syringe nearly empty",
            "Air is most likely to enter the fluid path as a syringe runs low.",
            "brief p.3",
            _gated(lambda fp: _has(fp, "inputs", "syringe_nearly_empty"), _answer(0.8)),
        ),
    ],
    "material_rheology_change": [
        _r(
            "Gradual, worse over hours or days",
            "Curing, settling, or ambient drift changes viscosity gradually rather than in a step.",
            "matc82 sec 2.5 p.8",
            _gated(lambda fp: _has(fp, "trajectory", "gradual"), _answer(1.1)),
        ),
        _r(
            "Near or past out-time",
            "matc82 ties dispensed volume directly to material condition against pot life / out-time.",
            "matc82 sec 2.9.1 p.13",
            _gated(lambda fp: _has(fp, "inputs", "near_out_time"), _answer(1.4)),
        ),
        _r(
            "Room temperature or humidity changed",
            "Ambient conditions change fluid viscosity, and so the dispensed volume.",
            "matc82 sec 2.5 p.8",
            _gated(lambda fp: _has(fp, "inputs", "ambient_changed"), _answer(1.0)),
        ),
        _r(
            "Footprint follows the material or lot",
            "Points at the fluid itself rather than the machine or tooling.",
            "brief p.3",
            _gated(lambda fp: _has(fp, "footprint", "material"), _answer(0.9)),
        ),
        _r(
            "Response: warming up helps",
            "Warm-up recovering the process is consistent with a viscosity effect.",
            "matc82 sec 2.5 p.8",
            _gated(lambda fp: _has(fp, "response", "let_it_warm_up"), _answer(1.0)),
        ),
    ],
    "nozzle_blockage": [
        _r(
            "Irregular deposit shape (low circularity)",
            "A partially blocked needle distorts the flow, and so the deposit's silhouette.",
            "matc82 sec 3.1 p.15-16",
            _low_circularity(1.2), kind="signal",
        ),
        _r(
            "Missing deposits without the carryover pattern",
            "Deposits are dropped outright, but not in the small-then-big pattern that points to carryover instead.",
            "matc82 sec 3.1 p.15-16",
            _missing_without_carryover(1.0), kind="signal",
        ),
        _r(
            "Footprint follows the nozzle, needle, or valve",
            "Points directly at the tooling most likely to carry a partial blockage.",
            "matc82 sec 3.1 p.15-16",
            _gated(lambda fp: _has(fp, "footprint", "tooling"), _answer(1.3)),
        ),
        _r(
            "Response: wiping or changing the needle helps",
            "Clearing or replacing the needle is the direct remedy for a blockage.",
            "matc82 sec 3.1 p.15-16",
            _gated(lambda fp: _has(fp, "response", "wipe_or_change_needle"), _answer(1.4)),
        ),
    ],
    "dispense_height_or_board_bending": [
        _r(
            "Shape changes across the board",
            "matc82 describes squat deposits where the needle sits low and tall ones where it sits high — a position-dependent shape effect.",
            "matc82 sec 2.8 p.12",
            _gated(lambda fp: _has(fp, "signature", "shape_changes_across_board"), _answer(1.8)),
        ),
        _r(
            "It has always been like this",
            "A process that was never capable routes to recipe/geometry, not to wear or contamination.",
            "matc82 sec 2.7 p.11",
            _gated(lambda fp: _has(fp, "trajectory", "always_been_like_this"), _answer(1.2)),
        ),
        _r(
            "Footprint follows the product or program",
            "Points at the recipe/geometry rather than a component that can wear or clog.",
            "matc82 sec 2.7 p.11",
            _gated(lambda fp: _has(fp, "footprint", "recipe"), _answer(1.0)),
        ),
    ],
    "equipment_condition": [
        _r(
            "Gradual, worse over hours or days",
            "General wear degrades performance gradually rather than in a step.",
            "matc82 sec 2.10 p.13",
            _gated(lambda fp: _has(fp, "trajectory", "gradual"), _answer(0.6)),
        ),
        _r(
            "Footprint follows the machine or head",
            "Points at the equipment itself.",
            "brief p.4",
            _gated(lambda fp: _has(fp, "footprint", "machine"), _answer(0.7)),
        ),
        _r(
            "Response: restarting or re-homing helps",
            "Recovering after a restart/re-home points at equipment state rather than material or recipe.",
            "matc82 sec 2.10 p.13",
            _gated(lambda fp: _has(fp, "response", "restart_or_rehome"), _answer(1.2)),
        ),
    ],
}

# "It has always been like this" argues against wear/contamination causes —
# DESIGN.md is explicit that this is a different case class. Modeled as
# negative-weight rules on the causes it argues against, so the evidence is
# visible in step 4's comparison rather than a silent exclusion.
CAUSE_RULES["nozzle_blockage"].append(
    _r(
        "Always been like this (argues against wear/contamination)",
        "A process that was never capable is a setup/geometry issue, not a developing blockage.",
        "matc82 sec 2.7 p.11",
        _gated(lambda fp: _has(fp, "trajectory", "always_been_like_this"), _answer(-0.8)),
    )
)
CAUSE_RULES["equipment_condition"].append(
    _r(
        "Always been like this (argues against wear/contamination)",
        "A process that was never capable is a setup/geometry issue, not equipment that has degraded.",
        "matc82 sec 2.7 p.11",
        _gated(lambda fp: _has(fp, "trajectory", "always_been_like_this"), _answer(-0.8)),
    )
)
