from pydantic import BaseModel


class DefectOut(BaseModel):
    signature: list[str]
    magnitude: str
    stars: int


class QualityOut(BaseModel):
    ok: bool | None
    reason: str | None


class CheckLogRowOut(BaseModel):
    sequence: int
    check_name: str
    cause_id: str | None
    outcome: str | None
    result_detail: str | None


class RecommendedActionOut(BaseModel):
    """What to check next, in order. Distinct from `check_log`, which is
    what was already done — the report used to carry only the latter."""

    step: int
    check_name: str
    cause_id: str
    cause_label: str
    is_change: bool
    help: str
    likelihood: float | None


class CauseTallyOut(BaseModel):
    cause_id: str
    label: str
    count: int
    share: float


class PrecedentsOut(BaseModel):
    total: int
    diagnosed_total: int
    matched_axes: list[str]
    by_cause: list[CauseTallyOut]
    sentence: str | None
    note: str


class ReportOut(BaseModel):
    case_id: int
    complaint: str | None
    complaint_text: str | None
    defect: DefectOut
    quality: QualityOut
    tier: str | None
    disagreement_note: str | None
    causes: list[dict]
    explanation: str | None
    explanation_used_llm: bool
    recommended_actions: list[RecommendedActionOut]
    precedents: PrecedentsOut | None
    check_log: list[CheckLogRowOut]
    diagnosis: dict | None
    verification: dict | None
    engineer_notes: str | None
    rules_version: str
    llm_used: bool
    disclaimer: str
    action_count: int
    resolved: bool
    close_tier: str | None


class CloseCaseResponse(BaseModel):
    tier: str
    gaps: list[str]
