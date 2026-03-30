from __future__ import annotations

from datetime import datetime, timezone
from typing import Dict, List, Optional

from fastapi import APIRouter, Depends, HTTPException, Response, status
from fastapi.security import HTTPAuthorizationCredentials, HTTPBearer
from pydantic import BaseModel, EmailStr, Field, HttpUrl

from app.schemas.roles import Role
from app.stores.memory import users_store, roles_store
from app.schemas.alert import (
    Alert,
    AlertCreate,
    AlertUpdate,
)
from app.schemas.user import User, UserInDB
from app.schemas.notification import (
    Notification,
    NotificationCreate,
    NotificationUpdate,
)

from app.utils.user_utils import ensure_role_ids_exist, sanitize_user
from app.utils.deps import get_current_user
from .routes.auth import api_auth_router
from .routes.users import users_router
from .routes.roles import roles_router

api_router = APIRouter()
api_router.include_router(api_auth_router)
api_router.include_router(users_router)
api_router.include_router(roles_router)

API_PREFIX = "/api/v1"
security = HTTPBearer(auto_error=False)


class Metric(BaseModel):
    name: str = Field(..., min_length=1, max_length=100)
    value: float


class CategoryBase(BaseModel):
    name: str = Field(..., min_length=1, max_length=120)
    source: str = Field(default="IPTC", pattern="^IPTC$")


class CategoryCreate(CategoryBase):
    pass


class CategoryUpdate(BaseModel):
    name: Optional[str] = Field(None, min_length=1, max_length=120)
    source: Optional[str] = Field(None, pattern="^IPTC$")


class Category(CategoryBase):
    id: int


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


class RSSChannelBase(BaseModel):
    url: HttpUrl
    category_id: int


class RSSChannelCreate(RSSChannelBase):
    pass


class RSSChannelUpdate(BaseModel):
    url: Optional[HttpUrl] = None
    category_id: Optional[int] = None


class RSSChannel(RSSChannelBase):
    id: int
    information_source_id: int


class StatsBase(BaseModel):
    metrics: List[Metric] = Field(default_factory=list)


class StatsCreate(StatsBase):
    pass


class StatsUpdate(BaseModel):
    metrics: Optional[List[Metric]] = None


class Stats(StatsBase):
    id: int


roles_store: Dict[int, Role] = {}
alerts_store: Dict[int, Alert] = {}
categories_store: Dict[int, Category] = {}
notifications_store: Dict[int, Notification] = {}
information_sources_store: Dict[int, InformationSource] = {}
rss_channels_store: Dict[int, RSSChannel] = {}
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


def ensure_role_ids_exist(role_ids: List[int]) -> None:
    missing = [role_id for role_id in role_ids if role_id not in roles_store]
    if missing:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail=f"Roles no encontrados: {missing}",
        )


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


def sanitize_user(user: UserInDB) -> User:
    return User(
        id=user.id,
        email=user.email,
        first_name=user.first_name,
        last_name=user.last_name,
        organization=user.organization,
        role_ids=user.role_ids,
    )


def get_current_user(
    credentials: HTTPAuthorizationCredentials = Depends(security),
) -> UserInDB:
    if credentials is None or credentials.scheme.lower() != "bearer":
        raise HTTPException(status_code=401, detail="Token inválido o ausente")

    user_id = active_tokens.get(credentials.credentials)
    if not user_id:
        raise HTTPException(status_code=401, detail="Token inválido o expirado")

    user = users_store.get(user_id)
    if not user:
        raise HTTPException(status_code=401, detail="Usuario inválido")

    return user


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
    f"{API_PREFIX}/users/{{user_id}}/alerts",
    response_model=List[Alert],
    tags=["alerts"],
)
def list_user_alerts(
    user_id: int, _: UserInDB = Depends(get_current_user)
) -> List[Alert]:
    ensure_user_exists(user_id)
    return [alert for alert in alerts_store.values() if alert.user_id == user_id]


@api_router.post(
    f"{API_PREFIX}/users/{{user_id}}/alerts",
    response_model=Alert,
    status_code=201,
    tags=["alerts"],
)
def create_user_alert(
    user_id: int, payload: AlertCreate, _: UserInDB = Depends(get_current_user)
) -> Alert:
    ensure_user_exists(user_id)
    alert_id = next_id("alerts")
    alert = Alert(id=alert_id, user_id=user_id, **payload.model_dump())
    alerts_store[alert_id] = alert
    return alert


@api_router.get(
    f"{API_PREFIX}/users/{{user_id}}/alerts/{{alert_id}}",
    response_model=Alert,
    tags=["alerts"],
)
def get_user_alert(
    user_id: int, alert_id: int, _: UserInDB = Depends(get_current_user)
) -> Alert:
    return ensure_alert_for_user(user_id, alert_id)


@api_router.put(
    f"{API_PREFIX}/users/{{user_id}}/alerts/{{alert_id}}",
    response_model=Alert,
    tags=["alerts"],
)
def update_user_alert(
    user_id: int,
    alert_id: int,
    payload: AlertUpdate,
    _: UserInDB = Depends(get_current_user),
) -> Alert:
    alert = ensure_alert_for_user(user_id, alert_id)
    updated = alert.model_copy(update=payload.model_dump(exclude_unset=True))
    alerts_store[alert_id] = updated
    return updated


@api_router.delete(
    f"{API_PREFIX}/users/{{user_id}}/alerts/{{alert_id}}",
    status_code=204,
    response_model=None,
    response_class=Response,
    tags=["alerts"],
)
def delete_user_alert(
    user_id: int, alert_id: int, _: UserInDB = Depends(get_current_user)
) -> None:
    ensure_alert_for_user(user_id, alert_id)
    notification_ids = [
        n.id for n in notifications_store.values() if n.alert_id == alert_id
    ]
    for notification_id in notification_ids:
        notifications_store.pop(notification_id, None)
    alerts_store.pop(alert_id, None)


@api_router.get(
    f"{API_PREFIX}/users/{{user_id}}/alerts/{{alert_id}}/notifications",
    response_model=List[Notification],
    tags=["notifications"],
)
def list_alert_notifications(
    user_id: int,
    alert_id: int,
    _: UserInDB = Depends(get_current_user),
) -> List[Notification]:
    ensure_alert_for_user(user_id, alert_id)
    return [item for item in notifications_store.values() if item.alert_id == alert_id]


@api_router.post(
    f"{API_PREFIX}/users/{{user_id}}/alerts/{{alert_id}}/notifications",
    response_model=Notification,
    status_code=201,
    tags=["notifications"],
)
def create_alert_notification(
    user_id: int,
    alert_id: int,
    payload: NotificationCreate,
    _: UserInDB = Depends(get_current_user),
) -> Notification:
    ensure_alert_for_user(user_id, alert_id)
    notification_id = next_id("notifications")
    notification = Notification(
        id=notification_id, alert_id=alert_id, **payload.model_dump()
    )
    notifications_store[notification_id] = notification
    return notification


@api_router.get(
    f"{API_PREFIX}/users/{{user_id}}/alerts/{{alert_id}}/notifications/{{notification_id}}",
    response_model=Notification,
    tags=["notifications"],
)
def get_alert_notification(
    user_id: int,
    alert_id: int,
    notification_id: int,
    _: UserInDB = Depends(get_current_user),
) -> Notification:
    ensure_alert_for_user(user_id, alert_id)
    return ensure_notification_for_alert(alert_id, notification_id)


@api_router.put(
    f"{API_PREFIX}/users/{{user_id}}/alerts/{{alert_id}}/notifications/{{notification_id}}",
    response_model=Notification,
    tags=["notifications"],
)
def update_alert_notification(
    user_id: int,
    alert_id: int,
    notification_id: int,
    payload: NotificationUpdate,
    _: UserInDB = Depends(get_current_user),
) -> Notification:
    ensure_alert_for_user(user_id, alert_id)
    notification = ensure_notification_for_alert(alert_id, notification_id)
    updated = notification.model_copy(update=payload.model_dump(exclude_unset=True))
    notifications_store[notification_id] = updated
    return updated


@api_router.delete(
    f"{API_PREFIX}/users/{{user_id}}/alerts/{{alert_id}}/notifications/{{notification_id}}",
    status_code=204,
    response_model=None,
    response_class=Response,
    tags=["notifications"],
)
def delete_alert_notification(
    user_id: int,
    alert_id: int,
    notification_id: int,
    _: UserInDB = Depends(get_current_user),
) -> None:
    ensure_alert_for_user(user_id, alert_id)
    ensure_notification_for_alert(alert_id, notification_id)
    notifications_store.pop(notification_id, None)


@api_router.get(
    f"{API_PREFIX}/categories", response_model=List[Category], tags=["categories"]
)
def list_categories(_: UserInDB = Depends(get_current_user)) -> List[Category]:
    return list(categories_store.values())


@api_router.post(
    f"{API_PREFIX}/categories",
    response_model=Category,
    status_code=201,
    tags=["categories"],
)
def create_category(
    payload: CategoryCreate, _: UserInDB = Depends(get_current_user)
) -> Category:
    category_id = next_id("categories")
    category = Category(id=category_id, **payload.model_dump())
    categories_store[category_id] = category
    return category


@api_router.get(
    f"{API_PREFIX}/categories/{{category_id}}",
    response_model=Category,
    tags=["categories"],
)
def get_category(category_id: int, _: UserInDB = Depends(get_current_user)) -> Category:
    category = categories_store.get(category_id)
    if not category:
        raise HTTPException(status_code=404, detail="Categoría no encontrada")
    return category


@api_router.put(
    f"{API_PREFIX}/categories/{{category_id}}",
    response_model=Category,
    tags=["categories"],
)
def update_category(
    category_id: int, payload: CategoryUpdate, _: UserInDB = Depends(get_current_user)
) -> Category:
    category = categories_store.get(category_id)
    if not category:
        raise HTTPException(status_code=404, detail="Categoría no encontrada")
    updated = category.model_copy(update=payload.model_dump(exclude_unset=True))
    categories_store[category_id] = updated
    return updated


@api_router.delete(
    f"{API_PREFIX}/categories/{{category_id}}",
    status_code=204,
    response_model=None,
    response_class=Response,
    tags=["categories"],
)
def delete_category(category_id: int, _: UserInDB = Depends(get_current_user)) -> None:
    if category_id not in categories_store:
        raise HTTPException(status_code=404, detail="Categoría no encontrada")

    for channel in rss_channels_store.values():
        if channel.category_id == category_id:
            raise HTTPException(
                status_code=409, detail="Categoría asociada a canales RSS"
            )

    categories_store.pop(category_id, None)


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
