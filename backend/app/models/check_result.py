from datetime import datetime
from typing import TYPE_CHECKING

from sqlalchemy import Boolean, DateTime, Enum, ForeignKey, Numeric, String, Text
from sqlalchemy.orm import Mapped, mapped_column, relationship

from app.core.database import Base
from app.models.enums import CheckOutcome

if TYPE_CHECKING:
    from app.models.case import Case


class CheckResult(Base):
    """One iteration of the troubleshooting loop (DESIGN.md W4) for a case."""

    __tablename__ = "check_results"

    check_result_id: Mapped[int] = mapped_column(primary_key=True)
    case_id: Mapped[int] = mapped_column(ForeignKey("cases.case_id"))

    sequence: Mapped[int] = mapped_column(default=0)
    check_name: Mapped[str] = mapped_column(String(120))
    cause_id: Mapped[str | None] = mapped_column(String(60), default=None)

    cost_minutes: Mapped[float | None] = mapped_column(Numeric(6, 1), default=None)
    invasive: Mapped[bool] = mapped_column(Boolean, default=False)
    safety_note: Mapped[str | None] = mapped_column(Text, default=None)

    outcome: Mapped[CheckOutcome | None] = mapped_column(
        Enum(CheckOutcome, name="check_outcome", native_enum=True), default=None
    )
    result_detail: Mapped[str | None] = mapped_column(Text, default=None)

    performed_at: Mapped[datetime | None] = mapped_column(DateTime(timezone=True), default=None)

    case: Mapped["Case"] = relationship(back_populates="check_results")
