from typing import Optional
from pydantic import BaseModel, Field, field_validator


def _strip_or_none(value):
    if isinstance(value, str):
        return value.strip()
    return value


def _strip_required(value):
    if isinstance(value, str):
        stripped = value.strip()
        if not stripped:
            raise ValueError("El campo no puede estar vacío")
        return stripped
    return value


def _validate_url_format(value: Optional[str]) -> Optional[str]:
    if value is None:
        return value
    if not isinstance(value, str):
        raise ValueError("La URL debe ser un string")
    stripped = value.strip()
    if not stripped:
        raise ValueError("La URL no puede estar vacía")
    if not (stripped.startswith("http://") or stripped.startswith("https://")):
        raise ValueError("La URL debe empezar por http:// o https://")
    return stripped


class InformationSourceBase(BaseModel):
    name: str = Field(..., min_length=1, max_length=120)
    url: str = Field(..., min_length=1, max_length=500)

    @field_validator("name", mode="before")
    @classmethod
    def _strip_name(cls, value):
        return _strip_required(value)

    @field_validator("url", mode="before")
    @classmethod
    def _strip_url(cls, value):
        return _strip_required(value)

    @field_validator("url")
    @classmethod
    def _check_url(cls, value):
        return _validate_url_format(value)


class InformationSourceCreate(InformationSourceBase):
    pass


class InformationSourceUpdate(BaseModel):
    name: Optional[str] = Field(None, min_length=1, max_length=120)
    url: Optional[str] = Field(None, min_length=1, max_length=500)

    @field_validator("name", mode="before")
    @classmethod
    def _strip_name(cls, value):
        return _strip_or_none(value)

    @field_validator("url", mode="before")
    @classmethod
    def _strip_url(cls, value):
        return _strip_or_none(value)

    @field_validator("url")
    @classmethod
    def _check_url(cls, value):
        return _validate_url_format(value)


class InformationSource(InformationSourceBase):
    id: int
