from datetime import datetime
from typing import TYPE_CHECKING

from sqlalchemy import JSON, Boolean, DateTime, Enum, ForeignKey, String, Text
from sqlalchemy.orm import Mapped, mapped_column, relationship

from app.core.database import Base
from app.domains.enums import CaseTier, DiagnosedState, RankTier

if TYPE_CHECKING:
    from app.domains.checks.model import CheckResult
    from app.domains.profiles.model import DispenseProfile
    from app.domains.stations.model import DispenseStation


class Case(Base):
    """One problem, one investigation — the record the whole pipeline
    reads and writes as the user moves through steps 1-8.

    Nested groups are stored as JSON rather than flattened into columns:
    they are read/written as one unit per step, and their shape tracks
    DESIGN.md directly rather than a fixed table schema:

    - ``fingerprint``: {axes: {signature[], trajectory, footprint,
      inputs[], response}, signals: {}} — steps 1, 2, 3 write into this.
    - ``vision_result``: the raw detect() report plus the quality-gate
      verdict from step 3, kept for the report (step 7) to cite.
    - ``ranking``: the live step-5 state {pass1, pass2, gate_a, gate_b,
      rank_tier, top_cause_id, runners_up} — recomputed after every
      checklist result in step 6.
    - ``diagnosis`` / ``verification``: the step-8 close record, same
      shape as DESIGN.md's worked example.

    ``action_count`` is deliberately not a column — see the property below.
    """

    __tablename__ = "cases"

    case_id: Mapped[int] = mapped_column(primary_key=True)

    # -- links --
    station_id: Mapped[int] = mapped_column(ForeignKey("dispense_stations.station_id"))
    profile_id: Mapped[int] = mapped_column(ForeignKey("dispense_profiles.profile_id"))
    rules_version: Mapped[str] = mapped_column(String(60), default="nsw-pack@1")
    opened_at: Mapped[datetime] = mapped_column(DateTime(timezone=True))
    closed_at: Mapped[datetime | None] = mapped_column(DateTime(timezone=True), default=None)

    # -- context --
    material_lot: Mapped[str | None] = mapped_column(String(60), default=None)
    complaint: Mapped[str | None] = mapped_column(String(120), default=None)
    complaint_text: Mapped[str | None] = mapped_column(Text, default=None)

    # -- steps 1/2/3: the fingerprint --
    fingerprint: Mapped[dict | None] = mapped_column(JSON, default=None)
    pre_intake_actions: Mapped[list[str]] = mapped_column(JSON, default=list)
    vision_result: Mapped[dict | None] = mapped_column(JSON, default=None)

    # -- step 5: live ranking state --
    ranking: Mapped[dict | None] = mapped_column(JSON, default=None)
    rank_tier: Mapped[RankTier | None] = mapped_column(
        Enum(RankTier, name="rank_tier", native_enum=False), default=None
    )

    # -- W7: at most one use each per case, tracked so the UI/report can
    # show "whether the LLM was used" and so a retry can't silently re-spend
    # budget the session doesn't have --
    llm_map_used: Mapped[bool] = mapped_column(Boolean, default=False)
    llm_critic_used: Mapped[bool] = mapped_column(Boolean, default=False)
    llm_explain_used: Mapped[bool] = mapped_column(Boolean, default=False)

    # -- step 7: the written analysis, kept rather than regenerated --
    # The budget above allows one explanation per case, so without storing
    # it the report's analysis section was empty on every revisit. Keeping
    # it also means a case re-read later shows the analysis it was closed
    # on, not a fresh one written against a ranking that has since moved.
    explanation: Mapped[str | None] = mapped_column(Text, default=None)
    explanation_used_llm: Mapped[bool] = mapped_column(Boolean, default=False)

    # -- step 8: the close record --
    diagnosis: Mapped[dict | None] = mapped_column(JSON, default=None)
    verification: Mapped[dict | None] = mapped_column(JSON, default=None)

    # -- the 2x2 --
    resolved: Mapped[bool] = mapped_column(Boolean, default=False)
    diagnosed: Mapped[DiagnosedState] = mapped_column(
        Enum(DiagnosedState, name="diagnosed_state", native_enum=False),
        default=DiagnosedState.NEVER_TESTED,
    )

    # -- derived --
    tier: Mapped[CaseTier | None] = mapped_column(
        Enum(CaseTier, name="case_tier", native_enum=False), default=None
    )
    escalate: Mapped[bool] = mapped_column(Boolean, default=False)
    # action_count is derived, not stored — see the property below.

    engineer_notes: Mapped[str | None] = mapped_column(Text, default=None)

    station: Mapped["DispenseStation"] = relationship(back_populates="cases")
    profile: Mapped["DispenseProfile"] = relationship(back_populates="cases")
    check_results: Mapped[list["CheckResult"]] = relationship(
        back_populates="case", order_by="CheckResult.sequence", cascade="all, delete-orphan"
    )

    @property
    def action_count(self) -> int:
        """Derived, never stored — counting is what keeps post-hoc
        reasoning out (DESIGN.md step 8): only checks logged *after*
        intake count, which is why pre_intake_actions is a separate field
        entirely rather than pre-seeded CheckResult rows.

        Counts *changes*, not iterations: looking at something twice is
        not "two changes at once" (see CheckResult.is_change)."""
        return sum(1 for check in self.check_results if check.is_change)

    @property
    def observation_count(self) -> int:
        """The other half of the loop log — free to run as often as the
        operator likes, and deliberately not penalised at close."""
        return sum(1 for check in self.check_results if not check.is_change)
