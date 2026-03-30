from fastapi import HTTPException
from app.stores.memory import (
    users_store,
    alerts_store,
    notifications_store,
    information_sources_store,
    categories_store,
    rss_channels_store,
)
from app.schemas.alert import Alert
from app.schemas.notification import Notification
from app.schemas.rss import RSSChannel

counters = {
    "roles": 1,
    "users": 1,
    "alerts": 1,
    "categories": 1,
    "notifications": 1,
    "information_sources": 1,
    "rss_channels": 1,
    "stats": 1,
}


def next_id(counter_key: str) -> int:
    value = counters[counter_key]
    counters[counter_key] += 1
    return value


def ensure_information_source_exists(source_id: int) -> None:
    if source_id not in information_sources_store:
        raise HTTPException(
            status_code=404, detail="Fuente de información no encontrada"
        )


def ensure_category_exists(category_id: int) -> None:
    if category_id not in categories_store:
        raise HTTPException(status_code=404, detail="Categoría no encontrada")


def ensure_rss_for_source(source_id: int, channel_id: int) -> RSSChannel:
    channel = rss_channels_store.get(channel_id)
    if not channel or channel.information_source_id != source_id:
        raise HTTPException(
            status_code=404, detail="Canal RSS no encontrado para la fuente"
        )
    return channel
