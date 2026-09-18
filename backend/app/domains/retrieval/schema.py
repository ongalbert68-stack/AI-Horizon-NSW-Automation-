from pydantic import BaseModel


class CoarseMatchOut(BaseModel):
    case_id: int
    score: float
    matched_axes: list[str]


class FineMatchOut(BaseModel):
    case_id: int
    distance: float
    cause_id: str | None
