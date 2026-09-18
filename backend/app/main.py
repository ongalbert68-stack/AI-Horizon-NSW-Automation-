from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware

from app.core.config import get_settings
from app.domains.causes.router import router as causes_router
from app.domains.intake.router import router as intake_router
from app.domains.ranking.router import router as ranking_router
from app.domains.report.router import router as report_router
from app.domains.retrieval.router import router as retrieval_router
from app.domains.vision.router import router as vision_router
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

# Troubleshoot-wizard domains (ported from pipeline)
app.include_router(intake_router, prefix=settings.api_prefix)
app.include_router(vision_router, prefix=settings.api_prefix)
app.include_router(causes_router, prefix=settings.api_prefix)
app.include_router(ranking_router, prefix=settings.api_prefix)
app.include_router(retrieval_router, prefix=settings.api_prefix)
app.include_router(report_router, prefix=settings.api_prefix)


@app.get("/api/health", tags=["Health"], summary="Liveness check")
def health() -> dict[str, str]:
    return {"status": "ok"}
