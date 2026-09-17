from fastapi import APIRouter, Depends, HTTPException, Query, status
from sqlalchemy.orm import Session

from app.core.database import get_db
from app.crud import fluid_material as crud
from app.schemas.common import Page
from app.schemas.fluid_material import (
    FluidMaterialCreate,
    FluidMaterialRead,
    FluidMaterialUpdate,
)

router = APIRouter(prefix="/materials", tags=["Fluid Materials"])


@router.get(
    "",
    response_model=Page[FluidMaterialRead],
    summary="List fluid materials",
    description="The fluids. One row changes only when purchasing changes supplier.",
)
def list_materials(
    limit: int = Query(50, ge=1, le=200),
    offset: int = Query(0, ge=0),
    db: Session = Depends(get_db),
) -> Page[FluidMaterialRead]:
    items, total = crud.list_materials(db, limit=limit, offset=offset)
    return Page(items=items, total=total, limit=limit, offset=offset)  # type: ignore[arg-type]


@router.post(
    "",
    response_model=FluidMaterialRead,
    status_code=status.HTTP_201_CREATED,
    summary="Register a fluid material",
)
def create_material(payload: FluidMaterialCreate, db: Session = Depends(get_db)) -> FluidMaterialRead:
    return crud.create_material(db, payload)  # type: ignore[return-value]


@router.get(
    "/{material_id}",
    response_model=FluidMaterialRead,
    summary="Get a fluid material",
)
def get_material(material_id: int, db: Session = Depends(get_db)) -> FluidMaterialRead:
    material = crud.get_material(db, material_id)
    if material is None:
        raise HTTPException(status.HTTP_404_NOT_FOUND, f"Material {material_id} not found")
    return material  # type: ignore[return-value]


@router.patch(
    "/{material_id}",
    response_model=FluidMaterialRead,
    summary="Update a fluid material",
)
def update_material(
    material_id: int, payload: FluidMaterialUpdate, db: Session = Depends(get_db)
) -> FluidMaterialRead:
    material = crud.get_material(db, material_id)
    if material is None:
        raise HTTPException(status.HTTP_404_NOT_FOUND, f"Material {material_id} not found")
    return crud.update_material(db, material, payload)  # type: ignore[return-value]


@router.delete(
    "/{material_id}",
    status_code=status.HTTP_204_NO_CONTENT,
    summary="Delete a fluid material",
)
def delete_material(material_id: int, db: Session = Depends(get_db)) -> None:
    material = crud.get_material(db, material_id)
    if material is None:
        raise HTTPException(status.HTTP_404_NOT_FOUND, f"Material {material_id} not found")
    crud.delete_material(db, material)
