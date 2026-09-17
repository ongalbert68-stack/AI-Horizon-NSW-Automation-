from datetime import datetime

from pydantic import BaseModel

from app.models.enums import CaseTier, DiagnosedState
from app.schemas.check_result import CheckResultRead
from app.schemas.common import ORMModel
from app.schemas.dispense_profile import DispenseProfileRead
from app.schemas.dispense_station import DispenseStationRead


class FingerprintAxes(BaseModel):
    """The interview half of the fingerprint — DESIGN.md W3."""

    signature: list[str] = []
    trajectory: str | None = None
    footprint: str | None = None
    inputs: list[str] = []
    response: str | None = None


class Fingerprint(BaseModel):
    axes: FingerprintAxes = FingerprintAxes()
    signals: dict[str, float | int | str | None] = {}


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


class CaseBase(BaseModel):
    station_id: int
    profile_id: int
    rules_version: str
    opened_at: datetime
    closed_at: datetime | None = None

    material_lot: str | None = None
    complaint: str | None = None
    complaint_text: str | None = None

    fingerprint: Fingerprint | None = None
    pre_intake_actions: list[str] = []
    diagnosis: Diagnosis | None = None
    verification: Verification | None = None

    resolved: bool = False
    diagnosed: DiagnosedState = DiagnosedState.NEVER_TESTED
    tier: CaseTier | None = None
    escalate: bool = False

    engineer_notes: str | None = None


class CaseCreate(CaseBase):
    pass


class CaseUpdate(BaseModel):
    station_id: int | None = None
    profile_id: int | None = None
    rules_version: str | None = None
    opened_at: datetime | None = None
    closed_at: datetime | None = None

    material_lot: str | None = None
    complaint: str | None = None
    complaint_text: str | None = None

    fingerprint: Fingerprint | None = None
    pre_intake_actions: list[str] | None = None
    diagnosis: Diagnosis | None = None
    verification: Verification | None = None

    resolved: bool | None = None
    diagnosed: DiagnosedState | None = None
    tier: CaseTier | None = None
    escalate: bool | None = None

    engineer_notes: str | None = None


class CaseRead(CaseBase, ORMModel):
    case_id: int
    action_count: int
    station: DispenseStationRead
    profile: DispenseProfileRead


class CaseReadDetail(CaseRead):
    check_results: list[CheckResultRead] = []
