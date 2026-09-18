from fastapi import APIRouter, Depends, HTTPException, Query, status
from sqlalchemy.orm import Session

from app.core.database import get_db
from app.core.schema import Page
from app.domains.profiles import crud
from app.domains.profiles.schema import (
    DispenseProfileCreate,
    DispenseProfileReadWithMaterial,
    DispenseProfileUpdate,
)

router = APIRouter(prefix="/profiles", tags=["Dispense Profiles"])


@router.get(
    "", response_model=Page[DispenseProfileReadWithMaterial], summary="List dispense profiles",
    description="The jobs. One row changes only when someone sets up a product.",
)
def list_profiles(
    limit: int = Query(50, ge=1, le=200),
    offset: int = Query(0, ge=0),
    db: Session = Depends(get_db),
) -> Page[DispenseProfileReadWithMaterial]:
    items, total = crud.list_profiles(db, limit=limit, offset=offset)
    return Page(items=items, total=total, limit=limit, offset=offset)  # type: ignore[arg-type]


@router.post(
    "", response_model=DispenseProfileReadWithMaterial, status_code=status.HTTP_201_CREATED,
    summary="Register a dispense profile",
)
def create_profile(
    payload: DispenseProfileCreate, db: Session = Depends(get_db)
) -> DispenseProfileReadWithMaterial:
    profile = crud.create_profile(db, payload)
    return crud.get_profile(db, profile.profile_id)  # type: ignore[return-value]


@router.get("/{profile_id}", response_model=DispenseProfileReadWithMaterial, summary="Get a dispense profile")
def get_profile(profile_id: int, db: Session = Depends(get_db)) -> DispenseProfileReadWithMaterial:
    profile = crud.get_profile(db, profile_id)
    if profile is None:
        raise HTTPException(status.HTTP_404_NOT_FOUND, f"Profile {profile_id} not found")
    return profile  # type: ignore[return-value]


@router.patch(
    "/{profile_id}", response_model=DispenseProfileReadWithMaterial, summary="Update a dispense profile"
)
def update_profile(
    profile_id: int, payload: DispenseProfileUpdate, db: Session = Depends(get_db)
) -> DispenseProfileReadWithMaterial:
    profile = crud.get_profile(db, profile_id)
    if profile is None:
        raise HTTPException(status.HTTP_404_NOT_FOUND, f"Profile {profile_id} not found")
    updated = crud.update_profile(db, profile, payload)
    return crud.get_profile(db, updated.profile_id)  # type: ignore[return-value]


@router.delete("/{profile_id}", status_code=status.HTTP_204_NO_CONTENT, summary="Delete a dispense profile")
def delete_profile(profile_id: int, db: Session = Depends(get_db)) -> None:
    profile = crud.get_profile(db, profile_id)
    if profile is None:
        raise HTTPException(status.HTTP_404_NOT_FOUND, f"Profile {profile_id} not found")
    crud.delete_profile(db, profile)
