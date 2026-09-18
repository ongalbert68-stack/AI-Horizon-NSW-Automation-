import enum


class DispenserClass(str, enum.Enum):
    """Half the 2b hard filter — see DESIGN.md step 2b."""

    PRESSURE_TIME = "pressure_time"
    AUGER = "auger"
    PISTON = "piston"
    JETTING = "jetting"


class MaterialFamily(str, enum.Enum):
    """The other half of the 2b hard filter."""

    EPOXY = "epoxy"
    SOLDER_PASTE = "solder_paste"
    SILICONE = "silicone"
    UV_CURE = "uv_cure"
    CYANOACRYLATE = "cyanoacrylate"


class DiagnosedState(str, enum.Enum):
    CHECK_CONFIRMED = "check_confirmed"
    BEST_GUESS = "best_guess"
    NEVER_TESTED = "never_tested"


class CaseTier(str, enum.Enum):
    """Step 8 close tiering — separate from the T1-T4 ranking-confidence tier."""

    CONFIRMED = "CONFIRMED"
    PLAUSIBLE = "PLAUSIBLE"
    UNVERIFIED = "UNVERIFIED"


class CheckOutcome(str, enum.Enum):
    CONFIRMS = "confirms"
    RULES_OUT = "rules_out"
    INCONCLUSIVE = "inconclusive"


class RankTier(str, enum.Enum):
    """Step 5's confidence tier — T1..T4, see domains/ranking/tier.py."""

    T1 = "T1"
    T2 = "T2"
    T3 = "T3"
    T4 = "T4"
