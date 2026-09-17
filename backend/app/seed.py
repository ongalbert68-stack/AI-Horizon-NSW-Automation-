"""Populate a couple of stations/materials/profiles for local dev.

Run with: uv run python -m app.seed
"""

from datetime import UTC, datetime

from app.core.database import SessionLocal
from app.models.case import Case
from app.models.dispense_profile import DispenseProfile
from app.models.dispense_station import DispenseStation
from app.models.enums import DiagnosedState, DispenserClass, MaterialFamily
from app.models.fluid_material import FluidMaterial


def seed() -> None:
    db = SessionLocal()
    try:
        if db.query(FluidMaterial).count() > 0:
            print("Already seeded, skipping.")
            return

        material = FluidMaterial(
            name="Epoxy A",
            part_number="EPX-100",
            family=MaterialFamily.EPOXY,
            two_part=True,
            thixotropic=True,
            requires_thaw=False,
            pot_life_hours=8,
            out_time_hours=4,
            storage_temp_c=4,
            filler_particle_um=15,
        )
        db.add(material)
        db.flush()

        station = DispenseStation(
            name="Line 3 Dispenser",
            line="L3",
            dispenser_class=DispenserClass.PRESSURE_TIME,
            valve_model="Nordson 741",
            heated_reservoir=False,
            reports_dispense_order=True,
            camera_available=True,
        )
        db.add(station)
        db.flush()

        profile = DispenseProfile(
            name="Standard Dot 0.5mm",
            material_id=material.material_id,
            needle_gauge="25G",
            needle_id_um=260,
            set_pressure_kpa=250,
            set_time_ms=120,
            standoff_um=300,
            speed_mm_s=20,
            set_temp_c=25,
            spec_metric="size_cv",
            spec_limit="< 0.15",
            geometry={
                "pattern": "dots",
                "width": 10,
                "height": 10,
                "points": [{"x": 0, "y": 0, "r": 0.5}, {"x": 1, "y": 0, "r": 0.5}],
            },
        )
        db.add(profile)
        db.flush()

        case = Case(
            station_id=station.station_id,
            profile_id=profile.profile_id,
            rules_version="nsw-pack@3",
            opened_at=datetime.now(UTC),
            material_lot="LOT-882",
            complaint="Inconsistent size shot to shot",
            complaint_text="Some dots big, some small, no pattern",
            fingerprint={
                "axes": {
                    "signature": ["Size varies shot to shot"],
                    "trajectory": "Random, comes and goes",
                    "footprint": "Nothing, it happens everywhere",
                    "inputs": ["New lot or syringe just started"],
                    "response": "Purging or priming",
                },
                "signals": {"size_cv": 0.49},
            },
            pre_intake_actions=["operator wiped needle"],
            diagnosed=DiagnosedState.NEVER_TESTED,
            engineer_notes="Seed data for local development.",
        )
        db.add(case)

        db.commit()
        print(f"Seeded material={material.material_id} station={station.station_id} "
              f"profile={profile.profile_id} case={case.case_id}")
    finally:
        db.close()


if __name__ == "__main__":
    seed()
