from datetime import datetime

from pydantic import BaseModel, Field

from app.core.schema import ORMModel
from app.domains.checks.schema import CheckResultRead
from app.domains.enums import CaseTier, DiagnosedState, RankTier
from app.domains.profiles.schema import DispenseProfileReadWithMaterial
from app.domains.stations.schema import DispenseStationRead


class FingerprintAxes(BaseModel):
    """The interview half of the fingerprint — DESIGN.md W3's five axes."""

    signature: list[str] = []
    trajectory: str | None = None
    footprint: str | None = None
    inputs: list[str] = []
    response: str | None = None


class Fingerprint(BaseModel):
    axes: FingerprintAxes = FingerprintAxes()
    signals: dict[str, float | int | str | None] = {}
    axis_notes: dict[str, str] = {}
    """Raw words from "Other (describe)" on an axis, keyed by axis id, kept
    whether or not the W7 mapper could place them on a real option. An
    axis stored as `unmapped` has its text here — DESIGN.md wants the
    words kept and the axis excluded from the match, never a silently
    forked enum. Read by humans, never scored."""


class ConfirmedBy(BaseModel):
    check: str
    result: str


class Diagnosis(BaseModel):
    cause_id: str | None = None
    runners_up: list[str] = []
    confirmed_by: ConfirmedBy | None = None


class Verification(BaseModel):
    signal: str | None = None
    before: float | None = None
    after: float | None = None
    in_spec: bool | None = None
    shots_measured: int | None = None
    recurred_after_days: int | None = None


class CaseOpen(BaseModel):
    """What step 1 needs to open a case: just the links + context. Everything
    else (fingerprint, vision, ranking, diagnosis...) is filled in by the
    later steps' own endpoints, not by the caller."""

    station_id: int
    profile_id: int
    material_lot: str | None = None
    complaint: str | None = None
    complaint_text: str | None = None


class CaseUpdate(BaseModel):
    """Generic patch, used by later steps to write into fingerprint/
    ranking/diagnosis/verification/engineer_notes as the case progresses."""

    material_lot: str | None = None
    complaint: str | None = None
    complaint_text: str | None = None
    fingerprint: Fingerprint | None = None
    pre_intake_actions: list[str] | None = None
    vision_result: dict | None = None
    ranking: dict | None = None
    rank_tier: RankTier | None = None
    diagnosis: Diagnosis | None = None
    verification: Verification | None = None
    resolved: bool | None = None
    diagnosed: DiagnosedState | None = None
    tier: CaseTier | None = None
    escalate: bool | None = None
    engineer_notes: str | None = None
    closed_at: datetime | None = None


class CaseRead(ORMModel):
    case_id: int
    station_id: int
    profile_id: int
    rules_version: str
    opened_at: datetime
    closed_at: datetime | None = None
    material_lot: str | None = None
    complaint: str | None = None
    complaint_text: str | None = None
    fingerprint: Fingerprint | None = None
    pre_intake_actions: list[str] = Field(default_factory=list)
    vision_result: dict | None = None
    ranking: dict | None = None
    rank_tier: RankTier | None = None
    llm_map_used: bool
    llm_critic_used: bool
    llm_explain_used: bool
    diagnosis: Diagnosis | None = None
    verification: Verification | None = None
    resolved: bool
    diagnosed: DiagnosedState
    tier: CaseTier | None = None
    escalate: bool
    engineer_notes: str | None = None
    action_count: int
    """Changes only — observations are counted separately and cost nothing
    at close. See CheckResult.is_change."""
    observation_count: int
    station: DispenseStationRead
    profile: DispenseProfileReadWithMaterial


class CaseReadDetail(CaseRead):
    check_results: list[CheckResultRead] = Field(default_factory=list)
