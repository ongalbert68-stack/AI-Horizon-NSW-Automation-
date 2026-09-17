from sqlalchemy import select
from sqlalchemy.orm import Session

from app.models.check_result import CheckResult
from app.schemas.check_result import CheckResultCreate, CheckResultUpdate


def list_check_results(db: Session, case_id: int) -> list[CheckResult]:
    return list(
        db.scalars(
            select(CheckResult).where(CheckResult.case_id == case_id).order_by(CheckResult.sequence)
        )
    )


def get_check_result(db: Session, case_id: int, check_result_id: int) -> CheckResult | None:
    return db.scalar(
        select(CheckResult).where(
            CheckResult.case_id == case_id, CheckResult.check_result_id == check_result_id
        )
    )


def create_check_result(db: Session, case_id: int, data: CheckResultCreate) -> CheckResult:
    check_result = CheckResult(case_id=case_id, **data.model_dump(mode="json"))
    db.add(check_result)
    db.commit()
    db.refresh(check_result)
    return check_result


def update_check_result(
    db: Session, check_result: CheckResult, data: CheckResultUpdate
) -> CheckResult:
    for field, value in data.model_dump(mode="json", exclude_unset=True).items():
        setattr(check_result, field, value)
    db.commit()
    db.refresh(check_result)
    return check_result


def delete_check_result(db: Session, check_result: CheckResult) -> None:
    db.delete(check_result)
    db.commit()
