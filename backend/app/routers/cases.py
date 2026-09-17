from fastapi import APIRouter, Depends, HTTPException, Query, status
from sqlalchemy.orm import Session

from app.core.database import get_db
from app.crud import case as crud
from app.crud import check_result as check_result_crud
from app.schemas.case import CaseCreate, CaseReadDetail, CaseUpdate
from app.schemas.check_result import (
    CheckResultCreate,
    CheckResultRead,
    CheckResultUpdate,
)
from app.schemas.common import Page

router = APIRouter(prefix="/cases", tags=["Cases"])


def _get_case_or_404(db: Session, case_id: int):
    case = crud.get_case(db, case_id)
    if case is None:
        raise HTTPException(status.HTTP_404_NOT_FOUND, f"Case {case_id} not found")
    return case


@router.get(
    "",
    response_model=Page[CaseReadDetail],
    summary="List cases",
    description="One problem, one investigation each. Newest first.",
)
def list_cases(
    limit: int = Query(50, ge=1, le=200),
    offset: int = Query(0, ge=0),
    db: Session = Depends(get_db),
) -> Page[CaseReadDetail]:
    items, total = crud.list_cases(db, limit=limit, offset=offset)
    return Page(items=items, total=total, limit=limit, offset=offset)  # type: ignore[arg-type]


@router.post(
    "",
    response_model=CaseReadDetail,
    status_code=status.HTTP_201_CREATED,
    summary="Open a case",
)
def create_case(payload: CaseCreate, db: Session = Depends(get_db)) -> CaseReadDetail:
    case = crud.create_case(db, payload)
    return crud.get_case(db, case.case_id)  # type: ignore[return-value]


@router.get(
    "/{case_id}",
    response_model=CaseReadDetail,
    summary="Get a case",
    description="Includes the station, profile, and every CheckResult logged against it.",
)
def get_case(case_id: int, db: Session = Depends(get_db)) -> CaseReadDetail:
    return _get_case_or_404(db, case_id)  # type: ignore[return-value]


@router.patch(
    "/{case_id}",
    response_model=CaseReadDetail,
    summary="Update a case",
    description="Used to record fingerprint, diagnosis, verification, and close-tier fields as the loop progresses.",
)
def update_case(case_id: int, payload: CaseUpdate, db: Session = Depends(get_db)) -> CaseReadDetail:
    case = _get_case_or_404(db, case_id)
    updated = crud.update_case(db, case, payload)
    return crud.get_case(db, updated.case_id)  # type: ignore[return-value]


@router.delete(
    "/{case_id}",
    status_code=status.HTTP_204_NO_CONTENT,
    summary="Delete a case",
)
def delete_case(case_id: int, db: Session = Depends(get_db)) -> None:
    case = _get_case_or_404(db, case_id)
    crud.delete_case(db, case)


@router.get(
    "/{case_id}/check-results",
    response_model=list[CheckResultRead],
    summary="List the troubleshooting loop log for a case",
)
def list_check_results(case_id: int, db: Session = Depends(get_db)) -> list[CheckResultRead]:
    _get_case_or_404(db, case_id)
    return check_result_crud.list_check_results(db, case_id)  # type: ignore[return-value]


@router.post(
    "/{case_id}/check-results",
    response_model=CheckResultRead,
    status_code=status.HTTP_201_CREATED,
    summary="Log one troubleshooting-loop check against a case",
)
def create_check_result(
    case_id: int, payload: CheckResultCreate, db: Session = Depends(get_db)
) -> CheckResultRead:
    _get_case_or_404(db, case_id)
    return check_result_crud.create_check_result(db, case_id, payload)  # type: ignore[return-value]


@router.patch(
    "/{case_id}/check-results/{check_result_id}",
    response_model=CheckResultRead,
    summary="Update a logged check result",
)
def update_check_result(
    case_id: int,
    check_result_id: int,
    payload: CheckResultUpdate,
    db: Session = Depends(get_db),
) -> CheckResultRead:
    _get_case_or_404(db, case_id)
    check_result = check_result_crud.get_check_result(db, case_id, check_result_id)
    if check_result is None:
        raise HTTPException(status.HTTP_404_NOT_FOUND, f"Check result {check_result_id} not found")
    return check_result_crud.update_check_result(db, check_result, payload)  # type: ignore[return-value]


@router.delete(
    "/{case_id}/check-results/{check_result_id}",
    status_code=status.HTTP_204_NO_CONTENT,
    summary="Delete a logged check result",
)
def delete_check_result(case_id: int, check_result_id: int, db: Session = Depends(get_db)) -> None:
    _get_case_or_404(db, case_id)
    check_result = check_result_crud.get_check_result(db, case_id, check_result_id)
    if check_result is None:
        raise HTTPException(status.HTTP_404_NOT_FOUND, f"Check result {check_result_id} not found")
    check_result_crud.delete_check_result(db, check_result)
