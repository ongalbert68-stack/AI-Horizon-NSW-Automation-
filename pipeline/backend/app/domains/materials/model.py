from typing import TYPE_CHECKING

from sqlalchemy import Boolean, Enum, Numeric, String
from sqlalchemy.orm import Mapped, mapped_column, relationship

from app.core.database import Base
from app.domains.enums import MaterialFamily

if TYPE_CHECKING:
    from app.domains.profiles.model import DispenseProfile


class FluidMaterial(Base):
    """The fluid. Changes when purchasing changes supplier."""

    __tablename__ = "fluid_materials"

    material_id: Mapped[int] = mapped_column(primary_key=True)
    name: Mapped[str] = mapped_column(String(120))
    part_number: Mapped[str | None] = mapped_column(String(120), default=None)

    family: Mapped[MaterialFamily] = mapped_column(
        Enum(MaterialFamily, name="material_family", native_enum=False)
    )

    two_part: Mapped[bool] = mapped_column(Boolean, default=False)
    thixotropic: Mapped[bool] = mapped_column(Boolean, default=False)
    requires_thaw: Mapped[bool] = mapped_column(Boolean, default=False)

    pot_life_hours: Mapped[float | None] = mapped_column(Numeric(8, 2), default=None)
    out_time_hours: Mapped[float | None] = mapped_column(Numeric(8, 2), default=None)
    storage_temp_c: Mapped[float | None] = mapped_column(Numeric(6, 2), default=None)
    filler_particle_um: Mapped[float | None] = mapped_column(Numeric(8, 2), default=None)

    profiles: Mapped[list["DispenseProfile"]] = relationship(back_populates="material")
