from datetime import datetime

from pydantic import BaseModel

from app.core.schema import ORMModel
from app.domains.enums import CheckOutcome


class CheckResultCreate(BaseModel):
    """Recording a result. ``sequence``/``performed_at`` are filled in
    server-side — see checks/crud.py — so the caller only sends what a user
    would actually observe in the loop."""

    check_name: str
    cause_id: str | None = None
    cost_minutes: float | None = None
    invasive: bool = False
    safety_note: str | None = None
    is_change: bool = False
    """True only if the machine, tooling or material was actually altered.
    Defaults to False — an observation — so a caller that doesn't know
    can't silently inflate the change count that step 8 rests on."""
    outcome: CheckOutcome | None = None
    result_detail: str | None = None


class CheckResultRead(ORMModel):
    check_result_id: int
    case_id: int
    sequence: int
    check_name: str
    cause_id: str | None = None
    cost_minutes: float | None = None
    invasive: bool
    safety_note: str | None = None
    is_change: bool
    outcome: CheckOutcome | None = None
    result_detail: str | None = None
    performed_at: datetime | None = None
