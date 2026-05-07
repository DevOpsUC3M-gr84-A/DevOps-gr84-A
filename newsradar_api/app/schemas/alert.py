import re
from pydantic import BaseModel, Field, field_validator
from typing import List, Optional
from datetime import datetime
from .user import User


_CRON_FIELD = r"(\*|\?|[0-9]+(-[0-9]+)?(/[0-9]+)?(,[0-9]+(-[0-9]+)?(/[0-9]+)?)*|\*/[0-9]+)"
_CRON_RE = re.compile(rf"^\s*{_CRON_FIELD}(\s+{_CRON_FIELD}){{4,5}}\s*$")

_GENERIC_DESCRIPTORS = ["keyword1", "keyword2", "keyword3"]
_MIN_DESCRIPTORS = 3
_MAX_DESCRIPTORS = 10


def _normalize_categories(value):
    if value is None:
        return value
    seen = set()
    deduped = []
    for item in value:
        if isinstance(item, dict):
            code = item.get("code")
        else:
            code = getattr(item, "code", None)
        key = (code or "").strip()
        if key in seen:
            continue
        seen.add(key)
        deduped.append(item)
    if len(deduped) > 1:
        raise ValueError("Solo se permite una categoría")
    return deduped


def _validate_cron_expression(value: str) -> str:
    try:
        from croniter import croniter  # type: ignore

        if not croniter.is_valid(value):
            raise ValueError("Invalid cron expression")
        return value
    except ImportError:
        if not isinstance(value, str) or not _CRON_RE.match(value):
            raise ValueError("Invalid cron expression")
        return value


def _normalize_descriptors(value):
    items = list(value or [])
    if len(items) < _MIN_DESCRIPTORS:
        for fill in _GENERIC_DESCRIPTORS:
            if len(items) >= _MIN_DESCRIPTORS:
                break
            if fill not in items:
                items.append(fill)
        idx = 1
        while len(items) < _MIN_DESCRIPTORS:
            candidate = f"keyword{idx}"
            if candidate not in items:
                items.append(candidate)
            idx += 1
    if len(items) > _MAX_DESCRIPTORS:
        items = items[:_MAX_DESCRIPTORS]
    return items


class AlertCategoryItem(BaseModel):
    code: str = Field(..., min_length=1, max_length=60)
    label: str = Field(..., min_length=1, max_length=120)


class AlertBase(BaseModel):
    name: str = Field(..., min_length=1, max_length=200)
    descriptors: List[str] = Field(default_factory=list)
    categories: List[AlertCategoryItem] = Field(default_factory=list)
    rss_channels_ids: List[str] = Field(default_factory=list)
    information_sources_ids: List[str] = Field(default_factory=list)
    cron_expression: str = Field(..., min_length=1, max_length=120)

    notify_inbox: bool = Field(default=True, description="Enviar notificaciones al buzon de la aplicacion")
    notify_email: bool = Field(default=False, description="Enviar notificaciones al correo electronico")


class AlertCreate(AlertBase):
    @field_validator("name")
    @classmethod
    def _strip_name(cls, value: str) -> str:
        if isinstance(value, str):
            return value.strip()
        return value

    @field_validator("cron_expression")
    @classmethod
    def _check_cron(cls, value: str) -> str:
        return _validate_cron_expression(value)

    @field_validator("categories")
    @classmethod
    def _check_categories(cls, value):
        return _normalize_categories(value)


class AlertUpdate(BaseModel):
    name: Optional[str] = Field(None, min_length=1, max_length=200)
    descriptors: Optional[List[str]] = None
    categories: Optional[List[AlertCategoryItem]] = None
    rss_channels_ids: Optional[List[str]] = None
    information_sources_ids: Optional[List[str]] = None

    notify_inbox: Optional[bool] = None
    notify_email: Optional[bool] = None

    cron_expression: Optional[str] = Field(None, min_length=1, max_length=120)

    @field_validator("name")
    @classmethod
    def _strip_name(cls, value):
        if isinstance(value, str):
            return value.strip()
        return value

    @field_validator("cron_expression")
    @classmethod
    def _check_cron(cls, value):
        if value is None:
            return value
        return _validate_cron_expression(value)

    @field_validator("categories")
    @classmethod
    def _check_categories(cls, value):
        return _normalize_categories(value)


class Alert(AlertBase):
    id: int
    user_id: int

    @field_validator("descriptors")
    @classmethod
    def _enforce_descriptors_range(cls, value):
        return _normalize_descriptors(value)
