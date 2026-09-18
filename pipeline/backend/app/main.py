from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware

from app.core.config import get_settings
from app.domains.cases.router import router as cases_router
from app.domains.causes.router import router as causes_router
from app.domains.intake.router import router as intake_router
from app.domains.materials.router import router as materials_router
from app.domains.profiles.router import router as profiles_router
from app.domains.ranking.router import router as ranking_router
from app.domains.report.router import router as report_router
from app.domains.retrieval.router import router as retrieval_router
from app.domains.stations.router import router as stations_router
from app.domains.vision.router import router as vision_router

settings = get_settings()

app = FastAPI(
    title=settings.app_name,
    description=(
        "Implements AiHorizon/DESIGN.md's 8-step troubleshooting pipeline end to end: "
        "intake (1-2) -> coarse retrieval (2b) -> vision (3) -> compare causes (4) -> "
        "rank (5, two passes + two gates) -> fine retrieval (5b) -> troubleshooting loop (6) "
        "-> report & verify (7) -> close case (8). Each domain below is one step (or ERD "
        "entity); see each router's tag. Backed by a single SQLite file — delete "
        "pipeline.db to reset the ERD, the schema itself enforces the same relationships "
        "a 'real' database would."
    ),
    version="0.1.0",
)

app.add_middleware(
    CORSMiddleware,
    allow_origins=settings.cors_origins,
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

# ERD domains
app.include_router(stations_router, prefix=settings.api_prefix)
app.include_router(materials_router, prefix=settings.api_prefix)
app.include_router(profiles_router, prefix=settings.api_prefix)
app.include_router(cases_router, prefix=settings.api_prefix)

# Pipeline-step domains
app.include_router(intake_router, prefix=settings.api_prefix)
app.include_router(vision_router, prefix=settings.api_prefix)
app.include_router(causes_router, prefix=settings.api_prefix)
app.include_router(ranking_router, prefix=settings.api_prefix)
app.include_router(retrieval_router, prefix=settings.api_prefix)
app.include_router(report_router, prefix=settings.api_prefix)


@app.get("/api/health", tags=["Health"], summary="Liveness check")
def health() -> dict[str, str]:
    return {"status": "ok"}
