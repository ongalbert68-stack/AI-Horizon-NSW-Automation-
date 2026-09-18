from pydantic import BaseModel

from app.core.schema import ORMModel
from app.domains.enums import DispenserClass


class DispenseStationBase(BaseModel):
    name: str
    line: str
    dispenser_class: DispenserClass
    valve_model: str | None = None
    heated_reservoir: bool = False
    reports_dispense_order: bool = False
    camera_available: bool = False


class DispenseStationCreate(DispenseStationBase):
    pass


class DispenseStationUpdate(BaseModel):
    name: str | None = None
    line: str | None = None
    dispenser_class: DispenserClass | None = None
    valve_model: str | None = None
    heated_reservoir: bool | None = None
    reports_dispense_order: bool | None = None
    camera_available: bool | None = None


class DispenseStationRead(DispenseStationBase, ORMModel):
    station_id: int
