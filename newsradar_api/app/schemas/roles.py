from typing import Optional
from pydantic import BaseModel, Field, field_validator


_NAME_PATTERN = r"^[a-zA-Z0-9 ñÑáéíóúÁÉÍÓÚ\-_]+$"


class RoleBase(BaseModel):
    name: str = Field(..., min_length=1, max_length=50, pattern=_NAME_PATTERN)

    @field_validator("name", mode="before")
    @classmethod
    def _strip_name(cls, value):
        if isinstance(value, str):
            return value.strip()
        return value


class RoleCreate(RoleBase):
    pass


class RoleUpdate(BaseModel):
    name: Optional[str] = Field(None, min_length=1, max_length=50, pattern=_NAME_PATTERN)

    @field_validator("name", mode="before")
    @classmethod
    def _strip_name(cls, value):
        if isinstance(value, str):
            return value.strip()
        return value


class Role(RoleBase):
    id: int
