from pydantic import BaseModel


class CoarseMatchOut(BaseModel):
    case_id: int
    score: float
    matched_axes: list[str]


class FineMatchOut(BaseModel):
    case_id: int
    distance: float
    cause_id: str | None


class CauseTallyOut(BaseModel):
    cause_id: str
    label: str
    count: int
    share: float


class PrecedentsOut(BaseModel):
    """The learning-database read. `sentence` is None whenever the history
    is too thin to summarise — the caller shows `note` instead rather than
    printing a count that reads like a finding."""

    total: int
    diagnosed_total: int
    matched_axes: list[str]
    by_cause: list[CauseTallyOut]
    sentence: str | None
    note: str
