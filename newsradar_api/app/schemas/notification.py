from pydantic import BaseModel, Field
from typing import List, Optional
from datetime import datetime
from .alert import Alert


class Metric(BaseModel):
    name: str = Field(..., min_length=1, max_length=100)
    value: float


class NotificationBase(BaseModel):
    timestamp: datetime
    metrics: List[Metric] = Field(default_factory=list)


class NotificationCreate(NotificationBase):
    pass


class NotificationUpdate(BaseModel):
    timestamp: Optional[datetime] = None
    metrics: Optional[List[Metric]] = None


class Notification(NotificationBase):
    id: int
    alert_id: int
