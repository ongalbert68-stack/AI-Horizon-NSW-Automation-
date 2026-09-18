from fastapi import APIRouter, Depends, HTTPException, Query, status
from sqlalchemy.orm import Session

from app.core.database import get_db
from app.core.schema import Page
from app.domains.stations import crud
from app.domains.stations.schema import (
    DispenseStationCreate,
    DispenseStationRead,
    DispenseStationUpdate,
)

router = APIRouter(prefix="/stations", tags=["Dispense Stations"])


@router.get(
    "",
    response_model=Page[DispenseStationRead],
    summary="List dispense stations",
    description="The machines. One row changes only when a machine is bought, moved, or re-tooled.",
)
def list_stations(
    limit: int = Query(50, ge=1, le=200),
    offset: int = Query(0, ge=0),
    db: Session = Depends(get_db),
) -> Page[DispenseStationRead]:
    items, total = crud.list_stations(db, limit=limit, offset=offset)
    return Page(items=items, total=total, limit=limit, offset=offset)  # type: ignore[arg-type]


@router.post(
    "", response_model=DispenseStationRead, status_code=status.HTTP_201_CREATED,
    summary="Register a dispense station",
)
def create_station(payload: DispenseStationCreate, db: Session = Depends(get_db)) -> DispenseStationRead:
    return crud.create_station(db, payload)  # type: ignore[return-value]


@router.get("/{station_id}", response_model=DispenseStationRead, summary="Get a dispense station")
def get_station(station_id: int, db: Session = Depends(get_db)) -> DispenseStationRead:
    station = crud.get_station(db, station_id)
    if station is None:
        raise HTTPException(status.HTTP_404_NOT_FOUND, f"Station {station_id} not found")
    return station  # type: ignore[return-value]


@router.patch("/{station_id}", response_model=DispenseStationRead, summary="Update a dispense station")
def update_station(
    station_id: int, payload: DispenseStationUpdate, db: Session = Depends(get_db)
) -> DispenseStationRead:
    station = crud.get_station(db, station_id)
    if station is None:
        raise HTTPException(status.HTTP_404_NOT_FOUND, f"Station {station_id} not found")
    return crud.update_station(db, station, payload)  # type: ignore[return-value]


@router.delete("/{station_id}", status_code=status.HTTP_204_NO_CONTENT, summary="Delete a dispense station")
def delete_station(station_id: int, db: Session = Depends(get_db)) -> None:
    station = crud.get_station(db, station_id)
    if station is None:
        raise HTTPException(status.HTTP_404_NOT_FOUND, f"Station {station_id} not found")
    crud.delete_station(db, station)
