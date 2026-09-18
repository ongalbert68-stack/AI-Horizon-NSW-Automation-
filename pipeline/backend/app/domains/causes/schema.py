from pydantic import BaseModel


class CauseOut(BaseModel):
    id: str
    label: str
    sources: list[str]
    image_signature: str | None
    image_signature_note: str | None = None


class ComparisonRowOut(BaseModel):
    label: str
    detail: str
    source: str
    weight: float


class CauseComparisonOut(BaseModel):
    cause_id: str
    label: str
    image_signature: str | None
    supports: list[ComparisonRowOut]
    contradicts: list[ComparisonRowOut]
