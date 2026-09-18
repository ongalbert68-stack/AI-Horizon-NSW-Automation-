from datetime import datetime
from typing import TYPE_CHECKING

from sqlalchemy import Boolean, DateTime, Enum, ForeignKey, Numeric, String, Text
from sqlalchemy.orm import Mapped, mapped_column, relationship

from app.core.database import Base
from app.domains.enums import CheckOutcome

if TYPE_CHECKING:
    from app.domains.cases.model import Case


class CheckResult(Base):
    """One iteration of the troubleshooting loop (step 6) for a case."""

    __tablename__ = "check_results"

    check_result_id: Mapped[int] = mapped_column(primary_key=True)
    case_id: Mapped[int] = mapped_column(ForeignKey("cases.case_id"))

    sequence: Mapped[int] = mapped_column(default=0)
    check_name: Mapped[str] = mapped_column(String(120))
    cause_id: Mapped[str | None] = mapped_column(String(60), default=None)

    cost_minutes: Mapped[float | None] = mapped_column(Numeric(6, 1), default=None)
    invasive: Mapped[bool] = mapped_column(Boolean, default=False)
    safety_note: Mapped[str | None] = mapped_column(Text, default=None)

    is_change: Mapped[bool] = mapped_column(Boolean, default=False)
    """Did this iteration *alter* the machine, tooling or material, or only
    observe it? Only changes count toward Case.action_count, because that
    is what DESIGN.md step 8's "exactly one thing was changed" is about.

    Counting every logged iteration instead — which is what
    ``len(check_results)`` did — punished the operator who investigated
    properly: the second observation permanently disqualified the case from
    CONFIRMED, so no case could ever reach Gate B and the case database
    could never learn from itself."""

    outcome: Mapped[CheckOutcome | None] = mapped_column(
        Enum(CheckOutcome, name="check_outcome", native_enum=False), default=None
    )
    result_detail: Mapped[str | None] = mapped_column(Text, default=None)

    performed_at: Mapped[datetime | None] = mapped_column(DateTime(timezone=True), default=None)

    case: Mapped["Case"] = relationship(back_populates="check_results")
