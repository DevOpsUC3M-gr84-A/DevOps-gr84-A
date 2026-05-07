from __future__ import annotations

import os
from datetime import datetime, timedelta
from typing import Annotated

from elasticsearch import Elasticsearch
from fastapi import APIRouter, Depends
from sqlalchemy.orm import Session

from app.core.iptc_categories import IPTC_FIRST_LEVEL
from app.database.database import get_db
from app.models.alert_monitoring import AlertRule
from app.models.rss import InformationSource as DBInformationSource
from app.models.rss import RSSChannel as DBRSSChannel
from app.schemas.dashboard import DashboardCategory, DashboardSummary, DashboardTrendPoint
from app.schemas.user import UserInDB
from app.utils.deps import get_current_user


dashboard_router = APIRouter()

ELASTICSEARCH_URL = os.getenv("ELASTICSEARCH_URL", "http://localhost:9200")


def _build_empty_series(days: int) -> list[DashboardTrendPoint]:
    today = datetime.utcnow().date()
    return [
        DashboardTrendPoint(date=today - timedelta(days=days - index - 1), value=0)
        for index in range(days)
    ]


def _build_daily_series(es: Elasticsearch, days: int, field: str) -> list[DashboardTrendPoint]:
    end_date = datetime.utcnow().date()
    start_date = end_date - timedelta(days=days - 1)
    response = es.search(
        index="articles",
        body={
            "size": 0,
            "query": {
                "range": {
                    field: {
                        "gte": start_date.isoformat(),
                        "lte": end_date.isoformat(),
                    }
                }
            },
            "aggs": {
                "daily": {
                    "date_histogram": {
                        "field": field,
                        "calendar_interval": "day",
                        "format": "yyyy-MM-dd",
                        "min_doc_count": 0,
                        "extended_bounds": {
                            "min": start_date.isoformat(),
                            "max": end_date.isoformat(),
                        },
                    }
                }
            },
        },
    )
    buckets = response["aggregations"]["daily"]["buckets"]
    return [
        DashboardTrendPoint(date=bucket["key_as_string"], value=bucket["doc_count"])
        for bucket in buckets
    ]


def _build_top_categories(es: Elasticsearch) -> list[DashboardCategory]:
    for field in ("iptc_category.keyword", "source.keyword"):
        try:
            response = es.search(
                index="articles",
                body={
                    "size": 0,
                    "aggs": {
                        "top_categories": {
                            "terms": {
                                "field": field,
                                "size": 5,
                            }
                        }
                    },
                },
            )
            buckets = response["aggregations"]["top_categories"]["buckets"]
            if buckets:
                return [
                    DashboardCategory(
                        label=IPTC_FIRST_LEVEL.get(int(bucket["key"]))
                        if str(bucket["key"]).isdigit()
                        else bucket["key"],
                        value=bucket["doc_count"],
                    )
                    for bucket in buckets
                ]
        except Exception:
            continue
    return []


@dashboard_router.get(
    "/dashboard/summary",
    tags=["dashboard"],
    response_model=DashboardSummary,
)
def get_dashboard_summary(
    db: Annotated[Session, Depends(get_db)],
    current_user: Annotated[UserInDB, Depends(get_current_user)],
) -> DashboardSummary:
    active_sources = db.query(DBInformationSource).count()
    rss_channels = db.query(DBRSSChannel).count()
    alerts_configured = (
        db.query(AlertRule)
        .filter(AlertRule.user_id == current_user.id, AlertRule.is_active.is_(True))
        .count()
    )

    last_7_days: list[DashboardTrendPoint] = _build_empty_series(7)
    last_30_days: list[DashboardTrendPoint] = _build_empty_series(30)
    captured_news_total = 0
    top_categories: list[DashboardCategory] = []

    try:
        es_client = Elasticsearch(ELASTICSEARCH_URL)
        captured_news_total = int(es_client.count(index="articles").get("count", 0))
        last_7_days = _build_daily_series(es_client, 7, "published_at")
        last_30_days = _build_daily_series(es_client, 30, "published_at")
        top_categories = _build_top_categories(es_client)
        es_client.close()
    except Exception:
        # Fallback to zeroed series if Elasticsearch is not available.
        pass

    return DashboardSummary(
        active_sources=active_sources,
        rss_channels=rss_channels,
        alerts_configured=alerts_configured,
        captured_news_total=captured_news_total,
        last_7_days=last_7_days,
        last_30_days=last_30_days,
        top_categories=top_categories,
    )
