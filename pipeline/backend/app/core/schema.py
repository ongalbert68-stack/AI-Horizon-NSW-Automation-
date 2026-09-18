from pydantic import BaseModel, ConfigDict


class ORMModel(BaseModel):
    """Base for response schemas read directly off SQLAlchemy models."""

    model_config = ConfigDict(from_attributes=True)


class Page[T](BaseModel):
    """A simple offset-paginated list response."""

    items: list[T]
    total: int
    limit: int
    offset: int
