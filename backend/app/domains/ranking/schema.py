from pydantic import BaseModel


class EvidenceOut(BaseModel):
    label: str
    detail: str
    source: str
    weight: float
    kind: str


class Pass1CauseOut(BaseModel):
    cause_id: str
    label: str
    likelihood: float
    evidence: list[EvidenceOut]


class Pass2CauseOut(BaseModel):
    cause_id: str
    likelihood_pct: float


class GateAOut(BaseModel):
    above_chance: bool
    deciding_signal: str | None
    p_value: float | None
    note: str


class GateBOut(BaseModel):
    applied: bool
    matched_count: int
    contradicting_count: int
    note: str


class RankingOut(BaseModel):
    pass1: list[Pass1CauseOut]
    pass2: list[Pass2CauseOut] | None
    agree: bool
    critic_top_cause_id: str | None = None
    """The critic's pick, or null when it abstained — see pass2.critic_verdict.
    Null with a non-empty `pass2` means it ranked the causes but had no
    clear view, which is not counted as disagreement."""
    critic_note: str = ""
    """Why the critic did or didn't get a vote, in words the UI can show."""
    gate_a: GateAOut
    gate_b: GateBOut
    tier: str
    top_cause_id: str
    runners_up: list[str]
