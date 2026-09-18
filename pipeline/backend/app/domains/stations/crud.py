from sqlalchemy import func, select
from sqlalchemy.orm import Session

from app.domains.stations.model import DispenseStation
from app.domains.stations.schema import DispenseStationCreate, DispenseStationUpdate


def list_stations(db: Session, *, limit: int, offset: int) -> tuple[list[DispenseStation], int]:
    total = db.scalar(select(func.count()).select_from(DispenseStation)) or 0
    items = list(
        db.scalars(select(DispenseStation).order_by(DispenseStation.name).limit(limit).offset(offset))
    )
    return items, total


def get_station(db: Session, station_id: int) -> DispenseStation | None:
    return db.get(DispenseStation, station_id)


def create_station(db: Session, data: DispenseStationCreate) -> DispenseStation:
    station = DispenseStation(**data.model_dump())
    db.add(station)
    db.commit()
    db.refresh(station)
    return station


def update_station(db: Session, station: DispenseStation, data: DispenseStationUpdate) -> DispenseStation:
    for field, value in data.model_dump(exclude_unset=True).items():
        setattr(station, field, value)
    db.commit()
    db.refresh(station)
    return station


def delete_station(db: Session, station: DispenseStation) -> None:
    db.delete(station)
    db.commit()
