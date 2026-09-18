from datetime import UTC, datetime

from sqlalchemy import select
from sqlalchemy.orm import Session

from app.domains.checks.model import CheckResult
from app.domains.checks.schema import CheckResultCreate


def list_check_results(db: Session, case_id: int) -> list[CheckResult]:
    return list(
        db.scalars(
            select(CheckResult).where(CheckResult.case_id == case_id).order_by(CheckResult.sequence)
        )
    )


def create_check_result(db: Session, case_id: int, data: CheckResultCreate) -> CheckResult:
    next_sequence = len(list_check_results(db, case_id)) + 1
    check_result = CheckResult(
        case_id=case_id,
        sequence=next_sequence,
        performed_at=datetime.now(UTC),
        **data.model_dump(),
    )
    db.add(check_result)
    db.commit()
    db.refresh(check_result)
    return check_result
