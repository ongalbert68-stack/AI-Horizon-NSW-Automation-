from typing import TYPE_CHECKING

from sqlalchemy import Boolean, Enum, String
from sqlalchemy.orm import Mapped, mapped_column, relationship

from app.core.database import Base
from app.models.enums import DispenserClass

if TYPE_CHECKING:
    from app.models.case import Case


class DispenseStation(Base):
    """The machine. Changes when someone buys a machine."""

    __tablename__ = "dispense_stations"

    station_id: Mapped[int] = mapped_column(primary_key=True)
    name: Mapped[str] = mapped_column(String(120))
    line: Mapped[str] = mapped_column(String(120))

    dispenser_class: Mapped[DispenserClass] = mapped_column(
        Enum(DispenserClass, name="dispenser_class", native_enum=True)
    )
    valve_model: Mapped[str | None] = mapped_column(String(120), default=None)

    heated_reservoir: Mapped[bool] = mapped_column(Boolean, default=False)
    reports_dispense_order: Mapped[bool] = mapped_column(Boolean, default=False)
    camera_available: Mapped[bool] = mapped_column(Boolean, default=False)

    cases: Mapped[list["Case"]] = relationship(back_populates="station")
