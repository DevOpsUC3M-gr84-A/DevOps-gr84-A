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
    rss_channel_ids: Optional[List[int]] = Field(default=None, description="RSS channel IDs for this alert. If not provided, all channels matching alert categories will be assigned.")
    cron_expression: str = Field(..., min_length=1, max_length=120)


class AlertCreate(AlertBase):
    pass


class AlertUpdate(BaseModel):
    name: Optional[str] = Field(None, min_length=1, max_length=200)
    descriptors: Optional[List[str]] = None
    categories: Optional[List[AlertCategoryItem]] = None
    rss_channel_ids: Optional[List[int]] = None
    cron_expression: Optional[str] = Field(None, min_length=1, max_length=120)


class Alert(AlertBase):
    id: int
    user_id: int
