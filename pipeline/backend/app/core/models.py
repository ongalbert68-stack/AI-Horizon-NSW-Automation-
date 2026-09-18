"""Import every ORM model once so they all register on Base.metadata —
needed for Alembic autogenerate and for the TYPE_CHECKING-only relationship
forward refs across domains to resolve. Nothing else should import this
directly; import the specific domain's model module instead."""

from app.core.database import Base
from app.domains.cases.model import Case
from app.domains.checks.model import CheckResult
from app.domains.materials.model import FluidMaterial
from app.domains.profiles.model import DispenseProfile
from app.domains.stations.model import DispenseStation

__all__ = ["Base", "Case", "CheckResult", "DispenseProfile", "DispenseStation", "FluidMaterial"]
