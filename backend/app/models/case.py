from datetime import datetime
from typing import TYPE_CHECKING

from sqlalchemy import Boolean, DateTime, Enum, ForeignKey, String, Text
from sqlalchemy.dialects.postgresql import JSONB
from sqlalchemy.orm import Mapped, mapped_column, relationship

from app.core.database import Base
from app.models.enums import CaseTier, DiagnosedState

if TYPE_CHECKING:
    from app.models.check_result import CheckResult
    from app.models.dispense_profile import DispenseProfile
    from app.models.dispense_station import DispenseStation


class Case(Base):
    """One problem, one investigation.

    The nested groups from DESIGN.md step 8 (fingerprint, diagnosis,
    verification) are stored as JSONB rather than flattened into columns:
    they are read and written as one unit, their shape is still evolving
    faster than the schema should, and nothing here needs to query inside
    them yet. ``action_count`` is deliberately not a stored column — it is
    derived by counting this case's CheckResult rows (see schemas/case.py),
    which is the whole point of the rule in DESIGN.md ("count the CheckResult
    rows").
    """

    __tablename__ = "cases"

    case_id: Mapped[int] = mapped_column(primary_key=True)

    # -- links --
    station_id: Mapped[int] = mapped_column(ForeignKey("dispense_stations.station_id"))
    profile_id: Mapped[int] = mapped_column(ForeignKey("dispense_profiles.profile_id"))
    rules_version: Mapped[str] = mapped_column(String(60))
    opened_at: Mapped[datetime] = mapped_column(DateTime(timezone=True))
    closed_at: Mapped[datetime | None] = mapped_column(DateTime(timezone=True), default=None)

    # -- context --
    material_lot: Mapped[str | None] = mapped_column(String(60), default=None)
    complaint: Mapped[str | None] = mapped_column(String(80), default=None)
    complaint_text: Mapped[str | None] = mapped_column(Text, default=None)

    # -- fingerprint: {axes: {signature[], trajectory, footprint, inputs[], response}, signals: {}} --
    fingerprint: Mapped[dict | None] = mapped_column(JSONB, default=None)

    # -- pre-existing: what was done before intake, kept out of action_count --
    pre_intake_actions: Mapped[list[str] | None] = mapped_column(JSONB, default=None)

    # -- diagnosis: {cause_id, runners_up[], confirmed_by: {check, result}} --
    diagnosis: Mapped[dict | None] = mapped_column(JSONB, default=None)

    # -- verification: {signal, before, after, in_spec, shots_measured, recurred_after_days} --
    verification: Mapped[dict | None] = mapped_column(JSONB, default=None)

    # -- the 2x2 --
    resolved: Mapped[bool] = mapped_column(Boolean, default=False)
    diagnosed: Mapped[DiagnosedState] = mapped_column(
        Enum(DiagnosedState, name="diagnosed_state", native_enum=True),
        default=DiagnosedState.NEVER_TESTED,
    )

    # -- derived --
    tier: Mapped[CaseTier | None] = mapped_column(
        Enum(CaseTier, name="case_tier", native_enum=True), default=None
    )
    escalate: Mapped[bool] = mapped_column(Boolean, default=False)
    # action_count is derived, not stored — see class docstring.

    engineer_notes: Mapped[str | None] = mapped_column(Text, default=None)

    station: Mapped["DispenseStation"] = relationship(back_populates="cases")
    profile: Mapped["DispenseProfile"] = relationship(back_populates="cases")
    check_results: Mapped[list["CheckResult"]] = relationship(
        back_populates="case", order_by="CheckResult.sequence", cascade="all, delete-orphan"
    )

    @property
    def action_count(self) -> int:
        """Derived, never stored — counting is what keeps post-hoc reasoning out."""
        return len(self.check_results)
