"""Step 5's tier table, verbatim from DESIGN.md:

| Tier | Reached when | Shown |
| T1 | Passes agree, signal beats chance, confirmed precedent | One lead cause |
| T2 | Passes agree, no precedent or signal at chance | One lead cause, provisional |
| T3 | Passes disagree, signal beats chance | Both candidates, measurement holds top slot |
| T4 | Passes disagree, signal at chance | No lead cause — show the deciding check instead |

Without a Groq key, pass 2 never runs — "the whole app works with no API
key" (DESIGN.md's opening line), so a missing pass 2 counts as agreement
rather than blocking T1/T2 entirely.
"""

from app.domains.ranking.gates import GateAResult, GateBResult


def passes_agree(pass1_top_id: str, pass2_top_id: str | None) -> bool:
    """`None` covers both "never ran" and "ran but abstained" (see
    pass2.critic_verdict) — read this as *not contradicted* rather than
    *actively agreed*, which is why agreement alone still can't reach T1.
    Only a critic with a real pick is allowed to veto."""
    return pass2_top_id is None or pass1_top_id == pass2_top_id


def _has_confirmed_precedent(gate_b: GateBResult) -> bool:
    return gate_b.matched_count >= 3 and gate_b.contradicting_count == 0


def compute_tier(agree: bool, gate_a: GateAResult, gate_b: GateBResult) -> str:
    above_chance = bool(gate_a.above_chance)
    if agree:
        return "T1" if above_chance and _has_confirmed_precedent(gate_b) else "T2"
    return "T3" if above_chance else "T4"
