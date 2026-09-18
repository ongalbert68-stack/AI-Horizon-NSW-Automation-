from pydantic import BaseModel


class VisionResultOut(BaseModel):
    quality_ok: bool
    quality_reason: str | None
    signals: dict[str, float | int]
    magnitude: str
    small_then_big_above_chance: bool
    suggested_signature: list[str] = []
    """Axis-1 picks the measurement supports, for the interview to open on.
    Empty when the quality gate failed, or when nothing measured out of
    spec."""
    cv_output: dict
