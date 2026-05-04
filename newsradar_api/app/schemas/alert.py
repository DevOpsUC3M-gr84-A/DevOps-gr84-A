from pydantic import BaseModel, Field
from typing import List, Optional
from datetime import datetime
from .user import User


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
    pass


class AlertUpdate(BaseModel):
    name: Optional[str] = Field(None, min_length=1, max_length=200)
    descriptors: Optional[List[str]] = None
    categories: Optional[List[AlertCategoryItem]] = None
    rss_channels_ids: Optional[List[str]] = None
    information_sources_ids: Optional[List[str]] = None

    notify_inbox: Optional[bool] = None
    notify_email: Optional[bool] = None

    cron_expression: Optional[str] = Field(None, min_length=1, max_length=120)


class Alert(AlertBase):
    id: int
    user_id: int
