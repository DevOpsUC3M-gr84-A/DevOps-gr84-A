from typing import List
from fastapi import APIRouter, Depends, HTTPException, Response
from app.schemas.notification import (
    Notification,
    NotificationCreate,
    NotificationUpdate,
)
from app.schemas.user import UserInDB
from app.stores.memory import notifications_store, alerts_store
from app.utils.deps import get_current_user

notifications_router = APIRouter()
API_PREFIX = "/api/v1"


def ensure_alert_for_user(user_id: int, alert_id: int):
    alert = alerts_store.get(alert_id)
    if not alert or alert.user_id != user_id:
        raise HTTPException(
            status_code=404, detail="Alerta no encontrada para el usuario"
        )
    return alert


def ensure_notification_for_alert(alert_id: int, notification_id: int):
    notification = notifications_store.get(notification_id)
    if not notification or notification.alert_id != alert_id:
        raise HTTPException(
            status_code=404, detail="Notificación no encontrada para la alerta"
        )
    return notification


@notifications_router.get(
    f"{API_PREFIX}/users/{{user_id}}/alerts/{{alert_id}}/notifications",
    response_model=List[Notification],
    tags=["notifications"],
)
def list_alert_notifications(
    user_id: int, alert_id: int, _: UserInDB = Depends(get_current_user)
) -> List[Notification]:
    ensure_alert_for_user(user_id, alert_id)
    return [item for item in notifications_store.values() if item.alert_id == alert_id]


@notifications_router.post(
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
    notification_id = max(notifications_store.keys(), default=0) + 1
    notification = Notification(
        id=notification_id, alert_id=alert_id, **payload.model_dump()
    )
    notifications_store[notification_id] = notification
    return notification


@notifications_router.get(
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


@notifications_router.put(
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


@notifications_router.delete(
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
