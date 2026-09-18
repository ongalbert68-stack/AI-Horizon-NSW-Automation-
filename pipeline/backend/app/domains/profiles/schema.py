from pydantic import BaseModel

from app.core.schema import ORMModel
from app.domains.materials.schema import FluidMaterialRead


class GeometryPoint(BaseModel):
    """Field names match vision/detect/profile.py's ProfilePoint exactly
    (index, cx, cy, r) — this is deliberately the same dict vision/synth
    writes into every sample's sidecar, not a re-shaped version of it."""

    index: int
    cx: float
    cy: float
    r: float


class Geometry(BaseModel):
    """Mirrors vision/detect's profile_data shape exactly — same dict can be
    passed straight to detect(raw, profile_data). ``r`` per point is the
    target radius, ``count`` is len(profile), pitch comes from cx/cy."""

    pattern: str
    width: float | None = None
    height: float | None = None
    profile: list[GeometryPoint] = []


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
