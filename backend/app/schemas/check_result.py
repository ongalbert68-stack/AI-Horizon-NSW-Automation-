from datetime import datetime

from pydantic import BaseModel

from app.models.enums import CheckOutcome
from app.schemas.common import ORMModel


class CheckResultBase(BaseModel):
    sequence: int = 0
    check_name: str
    cause_id: str | None = None
    cost_minutes: float | None = None
    invasive: bool = False
    safety_note: str | None = None
    outcome: CheckOutcome | None = None
    result_detail: str | None = None
    performed_at: datetime | None = None


class CheckResultCreate(CheckResultBase):
    pass


class CheckResultUpdate(BaseModel):
    sequence: int | None = None
    check_name: str | None = None
    cause_id: str | None = None
    cost_minutes: float | None = None
    invasive: bool | None = None
    safety_note: str | None = None
    outcome: CheckOutcome | None = None
    result_detail: str | None = None
    performed_at: datetime | None = None


class CheckResultRead(CheckResultBase, ORMModel):
    check_result_id: int
    case_id: int
