from __future__ import annotations

from datetime import date
from typing import List

from pydantic import BaseModel


class DashboardTrendPoint(BaseModel):
    date: date
    value: int


class DashboardCategory(BaseModel):
    label: str
    value: int


class DashboardSummary(BaseModel):
    active_sources: int
    rss_channels: int
    alerts_configured: int
    captured_news_total: int
    last_7_days: List[DashboardTrendPoint]
    last_30_days: List[DashboardTrendPoint]
    top_categories: List[DashboardCategory]
