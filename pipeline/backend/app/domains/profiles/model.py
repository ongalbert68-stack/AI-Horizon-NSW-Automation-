from typing import TYPE_CHECKING

from sqlalchemy import JSON, ForeignKey, Numeric, String
from sqlalchemy.orm import Mapped, mapped_column, relationship

from app.core.database import Base

if TYPE_CHECKING:
    from app.domains.cases.model import Case
    from app.domains.materials.model import FluidMaterial


class DispenseProfile(Base):
    """The job. Changes when someone sets up a product.

    ``geometry`` holds the vision/detect shape verbatim (pattern, width,
    height, points[]) so nothing is duplicated: ``r`` per point is the
    target radius, ``count`` is ``len(points)``, pitch comes from the
    coordinates. This is exactly the ``profile_data`` shape ``detect()``
    itself expects, so a profile row can be handed to step 3 unchanged.
    """

    __tablename__ = "dispense_profiles"

    profile_id: Mapped[int] = mapped_column(primary_key=True)
    name: Mapped[str] = mapped_column(String(120))

    material_id: Mapped[int] = mapped_column(ForeignKey("fluid_materials.material_id"))

    needle_gauge: Mapped[str | None] = mapped_column(String(20), default=None)
    needle_id_um: Mapped[float | None] = mapped_column(Numeric(8, 2), default=None)

    set_pressure_kpa: Mapped[float | None] = mapped_column(Numeric(8, 2), default=None)
    set_time_ms: Mapped[float | None] = mapped_column(Numeric(8, 2), default=None)
    standoff_um: Mapped[float | None] = mapped_column(Numeric(8, 2), default=None)
    speed_mm_s: Mapped[float | None] = mapped_column(Numeric(8, 2), default=None)
    set_temp_c: Mapped[float | None] = mapped_column(Numeric(6, 2), default=None)

    spec_metric: Mapped[str | None] = mapped_column(String(60), default=None)
    spec_limit: Mapped[str | None] = mapped_column(String(60), default=None)

    geometry: Mapped[dict | None] = mapped_column(JSON, default=None)

    material: Mapped["FluidMaterial"] = relationship(back_populates="profiles")
    cases: Mapped[list["Case"]] = relationship(back_populates="profile")
