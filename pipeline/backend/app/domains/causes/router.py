from dataclasses import asdict

from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy.orm import Session

from app.core.database import get_db
from app.domains.cases import crud as cases_crud
from app.domains.causes.compare import compare_causes
from app.domains.causes.schema import CauseComparisonOut, CauseOut
from app.domains.causes.vocabulary import load_causes

router = APIRouter(tags=["Causes (step 4)"])


@router.get(
    "/causes", response_model=list[CauseOut],
    summary="List the candidate-cause vocabulary",
    description="golden/causes.json, verbatim — the id space every case's diagnosis is drawn from.",
)
def list_causes() -> list[CauseOut]:
    return [CauseOut(**c) for c in load_causes()]


@router.get(
    "/cases/{case_id}/compare",
    response_model=list[CauseComparisonOut],
    summary="Compare causes for a case",
    description="Every candidate cause with evidence for and against, each citing its manual passage.",
)
def compare(case_id: int, db: Session = Depends(get_db)) -> list[CauseComparisonOut]:
    case = cases_crud.get_case(db, case_id)
    if case is None:
        raise HTTPException(status.HTTP_404_NOT_FOUND, f"Case {case_id} not found")
    rows = compare_causes(case.fingerprint or {"axes": {}, "signals": {}})
    return [CauseComparisonOut(**asdict(r)) for r in rows]
