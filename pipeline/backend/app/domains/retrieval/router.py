from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy.orm import Session

from app.core.database import get_db
from app.domains.cases import crud as cases_crud
from app.domains.retrieval.coarse import coarse_match
from app.domains.retrieval.fine import fine_match
from app.domains.retrieval.precedents import precedent_stats
from app.domains.retrieval.schema import (
    CauseTallyOut,
    CoarseMatchOut,
    FineMatchOut,
    PrecedentsOut,
)

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


@router.get(
    "/precedents",
    response_model=PrecedentsOut,
    summary="Learning database: how often this has happened, and what it was",
    description="Counts what coarse retrieval's matches were diagnosed as — "
    "'Similar problems occurred 12 times previously. In 8 cases, the main cause was air "
    "trapped inside the syringe.' Descriptive only: this never reaches the ranking, which "
    "takes precedent through Gate B alone and only to demote.",
)
def precedents(case_id: int, db: Session = Depends(get_db)) -> PrecedentsOut:
    case = _get_case_or_404(db, case_id)
    stats = precedent_stats(db, case)
    return PrecedentsOut(
        total=stats.total,
        diagnosed_total=stats.diagnosed_total,
        matched_axes=stats.matched_axes,
        by_cause=[
            CauseTallyOut(cause_id=t.cause_id, label=t.label, count=t.count, share=t.share)
            for t in stats.by_cause
        ],
        sentence=stats.sentence,
        note=stats.note,
    )
