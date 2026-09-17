from pydantic import BaseModel

from app.schemas.common import ORMModel
from app.schemas.fluid_material import FluidMaterialRead


class GeometryPoint(BaseModel):
    x: float
    y: float
    r: float | None = None
    """Target radius for this dot. ``count`` is len(points), pitch is
    derived from coordinates — neither is stored separately."""


class Geometry(BaseModel):
    """Mirrors the shape vision/detect/profile.py already produces."""

    pattern: str
    width: float | None = None
    height: float | None = None
    points: list[GeometryPoint] = []


class DispenseProfileBase(BaseModel):
    name: str
    material_id: int
    needle_gauge: str | None = None
    needle_id_um: float | None = None
    set_pressure_kpa: float | None = None
    set_time_ms: float | None = None
    standoff_um: float | None = None
    speed_mm_s: float | None = None
    set_temp_c: float | None = None
    spec_metric: str | None = None
    spec_limit: str | None = None
    geometry: Geometry | None = None


class DispenseProfileCreate(DispenseProfileBase):
    pass


class DispenseProfileUpdate(BaseModel):
    name: str | None = None
    material_id: int | None = None
    needle_gauge: str | None = None
    needle_id_um: float | None = None
    set_pressure_kpa: float | None = None
    set_time_ms: float | None = None
    standoff_um: float | None = None
    speed_mm_s: float | None = None
    set_temp_c: float | None = None
    spec_metric: str | None = None
    spec_limit: str | None = None
    geometry: Geometry | None = None


class DispenseProfileRead(DispenseProfileBase, ORMModel):
    profile_id: int


class DispenseProfileReadWithMaterial(DispenseProfileRead):
    material: FluidMaterialRead
