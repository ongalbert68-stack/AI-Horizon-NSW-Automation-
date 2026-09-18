from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy.orm import Session

from app.core.database import get_db
from app.crud import case as cases_crud
from app.domains.retrieval.coarse import coarse_match
from app.domains.retrieval.fine import fine_match
from app.domains.retrieval.schema import CoarseMatchOut, FineMatchOut

router = APIRouter(prefix="/cases/{case_id}/retrieval", tags=["Retrieval (steps 2b, 5b)"])


def _get_case_or_404(db: Session, case_id: int):
    case = cases_crud.get_case(db, case_id)
    if case is None:
        raise HTTPException(status.HTTP_404_NOT_FOUND, f"Case {case_id} not found")
    return case


@router.get(
    "/coarse",
    response_model=list[CoarseMatchOut],
    summary="Step 2b: coarse case retrieval",
    description="Hard filter on material+dispenser, then weighted axis agreement. Orders the interview only — never affects ranking.",
)
def coarse(case_id: int, db: Session = Depends(get_db)) -> list[CoarseMatchOut]:
    case = _get_case_or_404(db, case_id)
    matches = coarse_match(
        db,
        dispenser_class=case.station.dispenser_class.value,
        material_family=case.profile.material.family.value,
        fingerprint=case.fingerprint or {"axes": {}, "signals": {}},
        exclude_case_id=case_id,
    )
    return [CoarseMatchOut(case_id=m.case_id, score=m.score, matched_axes=m.matched_axes) for m in matches]


@router.get(
    "/fine",
    response_model=list[FineMatchOut],
    summary="Step 5b: fine case retrieval",
    description="Distance across discriminating signals only, over CONFIRMED cases only. This is what Gate B reads.",
)
def fine(case_id: int, db: Session = Depends(get_db)) -> list[FineMatchOut]:
    case = _get_case_or_404(db, case_id)
    matches = fine_match(
        db, fingerprint=case.fingerprint or {"axes": {}, "signals": {}}, exclude_case_id=case_id
    )
    return [FineMatchOut(case_id=m.case_id, distance=m.distance, cause_id=m.cause_id) for m in matches]
