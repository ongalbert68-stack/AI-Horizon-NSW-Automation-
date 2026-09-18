from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy.orm import Session

from app.core.database import get_db
from app.crud import case as cases_crud
from app.models.enums import RankTier
from app.domains.ranking.schema import RankingOut
from app.domains.ranking.service import run_ranking

router = APIRouter(prefix="/cases/{case_id}", tags=["Ranking (step 5)"])


@router.post(
    "/rank",
    response_model=RankingOut,
    summary="Rank causes for a case",
    description=(
        "Runs both passes and both gates fresh over the case's current fingerprint, "
        "then stores and returns the result. Call this again after every step-6 check "
        "result — 'causes re-rank instantly' — and after step 3's vision analysis."
    ),
)
def rank(case_id: int, db: Session = Depends(get_db)) -> RankingOut:
    case = cases_crud.get_case(db, case_id)
    if case is None:
        raise HTTPException(status.HTTP_404_NOT_FOUND, f"Case {case_id} not found")

    ranking = run_ranking(db, case)
    case.ranking = ranking
    case.rank_tier = RankTier(ranking["tier"])
    db.commit()
    return RankingOut(**ranking)
