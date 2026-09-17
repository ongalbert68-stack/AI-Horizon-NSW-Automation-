from sqlalchemy import func, select
from sqlalchemy.orm import Session

from app.models.fluid_material import FluidMaterial
from app.schemas.fluid_material import FluidMaterialCreate, FluidMaterialUpdate


def list_materials(db: Session, *, limit: int, offset: int) -> tuple[list[FluidMaterial], int]:
    total = db.scalar(select(func.count()).select_from(FluidMaterial)) or 0
    items = list(
        db.scalars(select(FluidMaterial).order_by(FluidMaterial.name).limit(limit).offset(offset))
    )
    return items, total


def get_material(db: Session, material_id: int) -> FluidMaterial | None:
    return db.get(FluidMaterial, material_id)


def create_material(db: Session, data: FluidMaterialCreate) -> FluidMaterial:
    material = FluidMaterial(**data.model_dump())
    db.add(material)
    db.commit()
    db.refresh(material)
    return material


def update_material(db: Session, material: FluidMaterial, data: FluidMaterialUpdate) -> FluidMaterial:
    for field, value in data.model_dump(exclude_unset=True).items():
        setattr(material, field, value)
    db.commit()
    db.refresh(material)
    return material


def delete_material(db: Session, material: FluidMaterial) -> None:
    db.delete(material)
    db.commit()
