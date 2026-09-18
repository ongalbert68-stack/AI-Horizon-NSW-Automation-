"""One station/material/profile so the frontend has something to pick from
when opening a case. Run with: uv run python -m app.seed
"""

import app.core.models  # noqa: F401  (register every model first)
from app.core.database import SessionLocal
from app.domains.enums import DispenserClass, MaterialFamily
from app.domains.materials.model import FluidMaterial
from app.domains.profiles.model import DispenseProfile
from app.domains.stations.model import DispenseStation


def seed() -> None:
    db = SessionLocal()
    try:
        if db.query(FluidMaterial).count() > 0:
            print("Already seeded, skipping.")
            return

        material = FluidMaterial(
            name="Epoxy A", part_number="EPX-100", family=MaterialFamily.EPOXY,
            two_part=True, thixotropic=True, requires_thaw=False,
            pot_life_hours=8, out_time_hours=4, storage_temp_c=4, filler_particle_um=15,
        )
        db.add(material)
        db.flush()

        station = DispenseStation(
            name="Line 3 Dispenser", line="L3", dispenser_class=DispenserClass.PRESSURE_TIME,
            valve_model="Nordson 741", heated_reservoir=False,
            reports_dispense_order=True, camera_available=True,
        )
        db.add(station)
        db.flush()

        profile = DispenseProfile(
            name="Standard Dot", material_id=material.material_id,
            needle_gauge="25G", needle_id_um=260,
            set_pressure_kpa=250, set_time_ms=120, standoff_um=300, speed_mm_s=20, set_temp_c=25,
            spec_metric="size_cv", spec_limit="< 0.15",
            geometry={
                "pattern": "dots", "width": 260, "height": 100,
                "profile": [
                    {"index": 0, "cx": 30, "cy": 50, "r": 26},
                    {"index": 1, "cx": 90, "cy": 50, "r": 26},
                    {"index": 2, "cx": 150, "cy": 50, "r": 26},
                    {"index": 3, "cx": 210, "cy": 50, "r": 26},
                ],
            },
        )
        db.add(profile)
        db.commit()
        print(f"Seeded material={material.material_id} station={station.station_id} profile={profile.profile_id}")
    finally:
        db.close()


if __name__ == "__main__":
    seed()
