from pydantic import BaseModel

from app.core.schema import ORMModel
from app.domains.enums import MaterialFamily


class FluidMaterialBase(BaseModel):
    name: str
    part_number: str | None = None
    family: MaterialFamily
    two_part: bool = False
    thixotropic: bool = False
    requires_thaw: bool = False
    pot_life_hours: float | None = None
    out_time_hours: float | None = None
    storage_temp_c: float | None = None
    filler_particle_um: float | None = None


class FluidMaterialCreate(FluidMaterialBase):
    pass


class FluidMaterialUpdate(BaseModel):
    name: str | None = None
    part_number: str | None = None
    family: MaterialFamily | None = None
    two_part: bool | None = None
    thixotropic: bool | None = None
    requires_thaw: bool | None = None
    pot_life_hours: float | None = None
    out_time_hours: float | None = None
    storage_temp_c: float | None = None
    filler_particle_um: float | None = None


class FluidMaterialRead(FluidMaterialBase, ORMModel):
    material_id: int
