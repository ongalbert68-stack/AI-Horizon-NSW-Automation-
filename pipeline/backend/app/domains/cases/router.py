from fastapi import APIRouter, Depends, HTTPException, Query, status
from sqlalchemy.orm import Session

from app.core.database import get_db
from app.core.schema import Page
from app.domains.cases import crud
from app.domains.cases.schema import CaseOpen, CaseReadDetail, CaseUpdate
from app.domains.checks import crud as checks_crud
from app.domains.checks.schema import CheckResultCreate, CheckResultRead
from app.domains.enums import DiagnosedState, RankTier
from app.domains.ranking.schema import RankingOut
from app.domains.ranking.service import run_ranking

router = APIRouter(prefix="/cases", tags=["Cases"])


def _get_case_or_404(db: Session, case_id: int):
    case = crud.get_case(db, case_id)
    if case is None:
        raise HTTPException(status.HTTP_404_NOT_FOUND, f"Case {case_id} not found")
    return case


@router.get("", response_model=Page[CaseReadDetail], summary="List cases")
def list_cases(
    limit: int = Query(50, ge=1, le=200), offset: int = Query(0, ge=0), db: Session = Depends(get_db)
) -> Page[CaseReadDetail]:
    items, total = crud.list_cases(db, limit=limit, offset=offset)
    return Page(items=items, total=total, limit=limit, offset=offset)  # type: ignore[arg-type]


@router.post(
    "", response_model=CaseReadDetail, status_code=status.HTTP_201_CREATED,
    summary="Open a case (step 1)",
    description="Just the links + context. The rest is filled in by intake/vision/ranking as the pipeline runs.",
)
def open_case(payload: CaseOpen, db: Session = Depends(get_db)) -> CaseReadDetail:
    case = crud.open_case(db, payload)
    return crud.get_case(db, case.case_id)  # type: ignore[return-value]


@router.get("/{case_id}", response_model=CaseReadDetail, summary="Get a case")
def get_case(case_id: int, db: Session = Depends(get_db)) -> CaseReadDetail:
    return _get_case_or_404(db, case_id)  # type: ignore[return-value]


@router.patch(
    "/{case_id}", response_model=CaseReadDetail, summary="Update a case",
    description="Generic patch for fingerprint/engineer_notes/etc. Prefer the step-named "
    "endpoints (vision, rank, check-results, report, close) where one exists.",
)
def update_case(case_id: int, payload: CaseUpdate, db: Session = Depends(get_db)) -> CaseReadDetail:
    case = _get_case_or_404(db, case_id)
    updated = crud.update_case(db, case, payload)
    return crud.get_case(db, updated.case_id)  # type: ignore[return-value]


@router.get(
    "/{case_id}/check-results", response_model=list[CheckResultRead],
    summary="Step 6: the troubleshooting loop log",
)
def list_check_results(case_id: int, db: Session = Depends(get_db)) -> list[CheckResultRead]:
    _get_case_or_404(db, case_id)
    return checks_crud.list_check_results(db, case_id)  # type: ignore[return-value]


@router.post(
    "/{case_id}/check-results", response_model=RankingOut, status_code=status.HTTP_201_CREATED,
    summary="Step 6: record a check result and re-rank",
    description="Logs one loop iteration, then re-runs step 5 immediately over the updated "
    "evidence and returns the new ranking — 'causes re-rank instantly, move to the next check.'",
)
def create_check_result(
    case_id: int, payload: CheckResultCreate, db: Session = Depends(get_db)
) -> RankingOut:
    case = _get_case_or_404(db, case_id)
    checks_crud.create_check_result(db, case_id, payload)
    db.refresh(case)

    ranking = run_ranking(db, case)
    case.ranking = ranking
    case.rank_tier = RankTier(ranking["tier"])
    if payload.outcome == "confirms" and payload.cause_id:
        case.diagnosis = {
            "cause_id": payload.cause_id,
            "runners_up": ranking["runners_up"],
            "confirmed_by": {"check": payload.check_name, "result": payload.result_detail or "confirmed"},
        }
        case.diagnosed = DiagnosedState.CHECK_CONFIRMED
    db.commit()
    return RankingOut(**ranking)
