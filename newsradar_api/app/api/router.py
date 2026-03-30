from __future__ import annotations

from datetime import datetime, timezone
from typing import Dict, List, Optional

from fastapi import APIRouter, Depends, HTTPException, Response
from fastapi.security import HTTPBearer
from pydantic import BaseModel, Field, HttpUrl

from app.schemas.roles import Role
from app.stores.memory import users_store, roles_store
from app.schemas.alert import Alert
from app.schemas.user import UserInDB
from app.schemas.notification import Notification
from app.schemas.rss import RSSChannel, RSSChannelCreate, RSSChannelUpdate

from app.stores.memory import (
    users_store,
    roles_store,
    alerts_store,
    categories_store,
    notifications_store,
    rss_channels_store,
)

from app.utils.user_utils import ensure_role_ids_exist, sanitize_user
from app.utils.deps import get_current_user
from .routes.auth import api_auth_router
from .routes.users import users_router
from .routes.roles import roles_router
from .routes.alerts import api_alerts_router
from .routes.notifications import notifications_router
from .routes.categories import categories_router

api_router = APIRouter()
api_router.include_router(api_auth_router)
api_router.include_router(users_router)
api_router.include_router(roles_router)
api_router.include_router(api_alerts_router)
api_router.include_router(notifications_router)
api_router.include_router(categories_router)

API_PREFIX = "/api/v1"
security = HTTPBearer(auto_error=False)


class Metric(BaseModel):
    name: str = Field(..., min_length=1, max_length=100)
    value: float


class InformationSourceBase(BaseModel):
    name: str = Field(..., min_length=1, max_length=120)
    url: HttpUrl


class InformationSourceCreate(InformationSourceBase):
    pass


class InformationSourceUpdate(BaseModel):
    name: Optional[str] = Field(None, min_length=1, max_length=120)
    url: Optional[HttpUrl] = None


class InformationSource(InformationSourceBase):
    id: int


class StatsBase(BaseModel):
    metrics: List[Metric] = Field(default_factory=list)


class StatsCreate(StatsBase):
    pass


class StatsUpdate(BaseModel):
    metrics: Optional[List[Metric]] = None


class Stats(StatsBase):
    id: int


information_sources_store: Dict[int, InformationSource] = {}
stats_store: Dict[int, Stats] = {}

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


def ensure_user_exists(user_id: int) -> None:
    if user_id not in users_store:
        raise HTTPException(status_code=404, detail="Usuario no encontrado")


def ensure_alert_for_user(user_id: int, alert_id: int) -> Alert:
    alert = alerts_store.get(alert_id)
    if not alert or alert.user_id != user_id:
        raise HTTPException(
            status_code=404, detail="Alerta no encontrada para el usuario"
        )
    return alert


def ensure_notification_for_alert(alert_id: int, notification_id: int) -> Notification:
    notification = notifications_store.get(notification_id)
    if not notification or notification.alert_id != alert_id:
        raise HTTPException(
            status_code=404, detail="Notificación no encontrada para la alerta"
        )
    return notification


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


def create_seed_data() -> None:
    if roles_store:
        return

    admin_role_id = next_id("roles")
    roles_store[admin_role_id] = Role(id=admin_role_id, name="admin")

    user_role_id = next_id("roles")
    roles_store[user_role_id] = Role(id=user_role_id, name="user")

    admin_user_id = next_id("users")
    users_store[admin_user_id] = UserInDB(
        id=admin_user_id,
        email="admin@newsradar.com",
        first_name="Admin",
        last_name="NewsRadar",
        organization="NewsRadar",
        role_ids=[admin_role_id],
        password="admin123",
    )


@api_router.on_event("startup")
def on_startup() -> None:
    create_seed_data()


@api_router.get(f"{API_PREFIX}/health", tags=["system"])
def health() -> dict:
    return {"status": "ok", "timestamp": datetime.now(timezone.utc).isoformat()}


@api_router.get(
    f"{API_PREFIX}/information-sources",
    response_model=List[InformationSource],
    tags=["information-sources"],
)
def list_information_sources(
    _: UserInDB = Depends(get_current_user),
) -> List[InformationSource]:
    return list(information_sources_store.values())


@api_router.post(
    f"{API_PREFIX}/information-sources",
    response_model=InformationSource,
    status_code=201,
    tags=["information-sources"],
)
def create_information_source(
    payload: InformationSourceCreate,
    _: UserInDB = Depends(get_current_user),
) -> InformationSource:
    source_id = next_id("information_sources")
    source = InformationSource(id=source_id, **payload.model_dump())
    information_sources_store[source_id] = source
    return source


@api_router.get(
    f"{API_PREFIX}/information-sources/{{source_id}}",
    response_model=InformationSource,
    tags=["information-sources"],
)
def get_information_source(
    source_id: int, _: UserInDB = Depends(get_current_user)
) -> InformationSource:
    source = information_sources_store.get(source_id)
    if not source:
        raise HTTPException(
            status_code=404, detail="Fuente de información no encontrada"
        )
    return source


@api_router.put(
    f"{API_PREFIX}/information-sources/{{source_id}}",
    response_model=InformationSource,
    tags=["information-sources"],
)
def update_information_source(
    source_id: int,
    payload: InformationSourceUpdate,
    _: UserInDB = Depends(get_current_user),
) -> InformationSource:
    source = information_sources_store.get(source_id)
    if not source:
        raise HTTPException(
            status_code=404, detail="Fuente de información no encontrada"
        )
    updated = source.model_copy(update=payload.model_dump(exclude_unset=True))
    information_sources_store[source_id] = updated
    return updated


@api_router.delete(
    f"{API_PREFIX}/information-sources/{{source_id}}",
    status_code=204,
    response_model=None,
    response_class=Response,
    tags=["information-sources"],
)
def delete_information_source(
    source_id: int, _: UserInDB = Depends(get_current_user)
) -> None:
    if source_id not in information_sources_store:
        raise HTTPException(
            status_code=404, detail="Fuente de información no encontrada"
        )

    channel_ids = [
        channel.id
        for channel in rss_channels_store.values()
        if channel.information_source_id == source_id
    ]
    for channel_id in channel_ids:
        rss_channels_store.pop(channel_id, None)

    information_sources_store.pop(source_id, None)


@api_router.get(
    f"{API_PREFIX}/information-sources/{{source_id}}/rss-channels",
    response_model=List[RSSChannel],
    tags=["rss-channels"],
)
def list_source_channels(
    source_id: int, _: UserInDB = Depends(get_current_user)
) -> List[RSSChannel]:
    ensure_information_source_exists(source_id)
    return [
        channel
        for channel in rss_channels_store.values()
        if channel.information_source_id == source_id
    ]


@api_router.post(
    f"{API_PREFIX}/information-sources/{{source_id}}/rss-channels",
    response_model=RSSChannel,
    status_code=201,
    tags=["rss-channels"],
)
def create_source_channel(
    source_id: int,
    payload: RSSChannelCreate,
    _: UserInDB = Depends(get_current_user),
) -> RSSChannel:
    ensure_information_source_exists(source_id)
    ensure_category_exists(payload.category_id)

    channel_id = next_id("rss_channels")
    channel = RSSChannel(
        id=channel_id,
        information_source_id=source_id,
        **payload.model_dump(),
    )
    rss_channels_store[channel_id] = channel
    return channel


@api_router.get(
    f"{API_PREFIX}/information-sources/{{source_id}}/rss-channels/{{channel_id}}",
    response_model=RSSChannel,
    tags=["rss-channels"],
)
def get_source_channel(
    source_id: int,
    channel_id: int,
    _: UserInDB = Depends(get_current_user),
) -> RSSChannel:
    ensure_information_source_exists(source_id)
    return ensure_rss_for_source(source_id, channel_id)


@api_router.put(
    f"{API_PREFIX}/information-sources/{{source_id}}/rss-channels/{{channel_id}}",
    response_model=RSSChannel,
    tags=["rss-channels"],
)
def update_source_channel(
    source_id: int,
    channel_id: int,
    payload: RSSChannelUpdate,
    _: UserInDB = Depends(get_current_user),
) -> RSSChannel:
    ensure_information_source_exists(source_id)
    channel = ensure_rss_for_source(source_id, channel_id)

    update_data = payload.model_dump(exclude_unset=True)
    if "category_id" in update_data:
        ensure_category_exists(update_data["category_id"])

    updated = channel.model_copy(update=update_data)
    rss_channels_store[channel_id] = updated
    return updated


@api_router.delete(
    f"{API_PREFIX}/information-sources/{{source_id}}/rss-channels/{{channel_id}}",
    status_code=204,
    response_model=None,
    response_class=Response,
    tags=["rss-channels"],
)
def delete_source_channel(
    source_id: int,
    channel_id: int,
    _: UserInDB = Depends(get_current_user),
) -> None:
    ensure_information_source_exists(source_id)
    ensure_rss_for_source(source_id, channel_id)
    rss_channels_store.pop(channel_id, None)


@api_router.get(f"{API_PREFIX}/stats", response_model=List[Stats], tags=["stats"])
def list_stats(_: UserInDB = Depends(get_current_user)) -> List[Stats]:
    return list(stats_store.values())


@api_router.post(
    f"{API_PREFIX}/stats", response_model=Stats, status_code=201, tags=["stats"]
)
def create_stats(
    payload: StatsCreate, _: UserInDB = Depends(get_current_user)
) -> Stats:
    stats_id = next_id("stats")
    stats = Stats(id=stats_id, **payload.model_dump())
    stats_store[stats_id] = stats
    return stats


@api_router.get(
    f"{API_PREFIX}/stats/{{stats_id}}", response_model=Stats, tags=["stats"]
)
def get_stats(stats_id: int, _: UserInDB = Depends(get_current_user)) -> Stats:
    stats = stats_store.get(stats_id)
    if not stats:
        raise HTTPException(status_code=404, detail="Stats no encontrados")
    return stats


@api_router.put(
    f"{API_PREFIX}/stats/{{stats_id}}", response_model=Stats, tags=["stats"]
)
def update_stats(
    stats_id: int, payload: StatsUpdate, _: UserInDB = Depends(get_current_user)
) -> Stats:
    stats = stats_store.get(stats_id)
    if not stats:
        raise HTTPException(status_code=404, detail="Stats no encontrados")

    updated = stats.model_copy(update=payload.model_dump(exclude_unset=True))
    stats_store[stats_id] = updated
    return updated


@api_router.delete(
    f"{API_PREFIX}/stats/{{stats_id}}",
    status_code=204,
    response_model=None,
    response_class=Response,
    tags=["stats"],
)
def delete_stats(stats_id: int, _: UserInDB = Depends(get_current_user)) -> None:
    if stats_id not in stats_store:
        raise HTTPException(status_code=404, detail="Stats no encontrados")
    stats_store.pop(stats_id, None)
