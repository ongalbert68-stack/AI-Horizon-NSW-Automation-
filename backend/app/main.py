from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware

from app.core.config import get_settings
from app.routers import cases, dispense_profiles, dispense_stations, fluid_materials

settings = get_settings()

app = FastAPI(
    title=settings.app_name,
    description=(
        "Read/write API over the case-tracking ERD: DispenseStation, DispenseProfile, "
        "FluidMaterial, Case, and CheckResult. See /docs for interactive schemas."
    ),
    version="0.1.0",
    docs_url="/docs",
    redoc_url="/redoc",
)

app.add_middleware(
    CORSMiddleware,
    allow_origins=settings.cors_origins,
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

app.include_router(dispense_stations.router, prefix=settings.api_prefix)
app.include_router(fluid_materials.router, prefix=settings.api_prefix)
app.include_router(dispense_profiles.router, prefix=settings.api_prefix)
app.include_router(cases.router, prefix=settings.api_prefix)


@app.get("/api/health", tags=["Health"], summary="Liveness check")
def health() -> dict[str, str]:
    return {"status": "ok"}
