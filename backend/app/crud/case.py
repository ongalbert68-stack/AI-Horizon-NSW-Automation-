from sqlalchemy import func, select
from sqlalchemy.orm import Session, selectinload

from app.models.case import Case
from app.schemas.case import CaseCreate, CaseUpdate


def list_cases(db: Session, *, limit: int, offset: int) -> tuple[list[Case], int]:
    total = db.scalar(select(func.count()).select_from(Case)) or 0
    items = list(
        db.scalars(
            select(Case)
            .options(
                selectinload(Case.station),
                selectinload(Case.profile),
                selectinload(Case.check_results),
            )
            .order_by(Case.opened_at.desc())
            .limit(limit)
            .offset(offset)
        )
    )
    return items, total


def get_case(db: Session, case_id: int) -> Case | None:
    return db.scalar(
        select(Case)
        .options(
            selectinload(Case.station),
            selectinload(Case.profile),
            selectinload(Case.check_results),
        )
        .where(Case.case_id == case_id)
    )


def create_case(db: Session, data: CaseCreate) -> Case:
    payload = data.model_dump(mode="json")
    case = Case(**payload)
    db.add(case)
    db.commit()
    db.refresh(case)
    return case


def update_case(db: Session, case: Case, data: CaseUpdate) -> Case:
    for field, value in data.model_dump(mode="json", exclude_unset=True).items():
        setattr(case, field, value)
    db.commit()
    db.refresh(case)
    return case


def delete_case(db: Session, case: Case) -> None:
    db.delete(case)
    db.commit()
