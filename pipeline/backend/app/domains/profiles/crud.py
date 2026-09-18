from sqlalchemy import func, select
from sqlalchemy.orm import Session, selectinload

from app.domains.profiles.model import DispenseProfile
from app.domains.profiles.schema import DispenseProfileCreate, DispenseProfileUpdate


def list_profiles(db: Session, *, limit: int, offset: int) -> tuple[list[DispenseProfile], int]:
    total = db.scalar(select(func.count()).select_from(DispenseProfile)) or 0
    items = list(
        db.scalars(
            select(DispenseProfile)
            .options(selectinload(DispenseProfile.material))
            .order_by(DispenseProfile.name)
            .limit(limit)
            .offset(offset)
        )
    )
    return items, total


def get_profile(db: Session, profile_id: int) -> DispenseProfile | None:
    return db.scalar(
        select(DispenseProfile)
        .options(selectinload(DispenseProfile.material))
        .where(DispenseProfile.profile_id == profile_id)
    )


def create_profile(db: Session, data: DispenseProfileCreate) -> DispenseProfile:
    profile = DispenseProfile(**data.model_dump(mode="json"))
    db.add(profile)
    db.commit()
    db.refresh(profile)
    return profile


def update_profile(db: Session, profile: DispenseProfile, data: DispenseProfileUpdate) -> DispenseProfile:
    for field, value in data.model_dump(mode="json", exclude_unset=True).items():
        setattr(profile, field, value)
    db.commit()
    db.refresh(profile)
    return profile


def delete_profile(db: Session, profile: DispenseProfile) -> None:
    db.delete(profile)
    db.commit()
