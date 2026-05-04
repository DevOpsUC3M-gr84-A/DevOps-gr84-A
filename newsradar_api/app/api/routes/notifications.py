from typing import Annotated, List
from fastapi import APIRouter, Depends, HTTPException, Response
from sqlalchemy.orm import Session

from app.database.database import get_db
from app.models.alert_monitoring import AlertRule
from app.models.notification import Notification as NotificationModel
from app.schemas.notification import (
    Notification,
    NotificationCreate,
    NotificationUpdate,
    UserNotification,
)
from app.schemas.user import UserInDB
from app.stores.memory import alerts_store, notifications_store
from app.utils.deps import get_current_user

notifications_router = APIRouter()


@notifications_router.get(
    "/users/{user_id}/notifications",
    tags=["notifications"],
)
def list_user_notifications(
    user_id: int,
    _: Annotated[UserInDB, Depends(get_current_user)],
    db: Annotated[Session, Depends(get_db)],
    limit: int = 30,
) -> List[UserNotification]:
    items = (
        db.query(NotificationModel)
        .filter(NotificationModel.user_id == user_id)
        .order_by(NotificationModel.created_at.desc())
        .limit(limit)
        .all()
    )
    return [
        UserNotification(
            id=item.id,
            alert_id=item.alert_id,
            title=item.title,
            message=item.message,
            created_at=item.created_at,
            is_read=item.is_read,
        )
        for item in items
    ]


@notifications_router.put(
    "/users/{user_id}/notifications/{notification_id}/read",
    tags=["notifications"],
    responses={404: {"description": "Notificación no encontrada"}},
)
def mark_notification_as_read(
    user_id: int,
    notification_id: int,
    _: Annotated[UserInDB, Depends(get_current_user)],
    db: Annotated[Session, Depends(get_db)],
) -> UserNotification:
    notification = (
        db.query(NotificationModel)
        .filter(
            NotificationModel.id == notification_id,
            NotificationModel.user_id == user_id,
        )
        .first()
    )
    if not notification:
        raise HTTPException(status_code=404, detail="Notificación no encontrada")

    notification.is_read = True
    db.commit()
    db.refresh(notification)

    return UserNotification(
        id=notification.id,
        alert_id=notification.alert_id,
        title=notification.title,
        message=notification.message,
        created_at=notification.created_at,
        is_read=notification.is_read,
    )


@notifications_router.delete(
    "/users/{user_id}/notifications",
    status_code=204,
    response_class=Response,
    tags=["notifications"],
)
def delete_user_notifications(
    user_id: int,
    _: Annotated[UserInDB, Depends(get_current_user)],
    db: Annotated[Session, Depends(get_db)],
) -> None:
    db.query(NotificationModel).filter(NotificationModel.user_id == user_id).delete()
    db.commit()


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
    "/users/{user_id}/alerts/{alert_id}/notifications",
    tags=["notifications"],
    responses={404: {"description": "Alerta no encontrada para el usuario"}},
)
def list_alert_notifications(
    user_id: int,
    alert_id: int,
    _: Annotated[UserInDB, Depends(get_current_user)],
) -> List[Notification]:
    ensure_alert_for_user(user_id, alert_id)
    return [item for item in notifications_store.values() if item.alert_id == alert_id]


@notifications_router.post(
    "/users/{user_id}/alerts/{alert_id}/notifications",
    status_code=201,
    tags=["notifications"],
    responses={404: {"description": "Alerta no encontrada para el usuario"}},
)
def create_alert_notification(
    user_id: int,
    alert_id: int,
    payload: NotificationCreate,
    _: Annotated[UserInDB, Depends(get_current_user)],
) -> Notification:
    ensure_alert_for_user(user_id, alert_id)
    notification_id = max(notifications_store.keys(), default=0) + 1
    notification = Notification(
        id=notification_id, alert_id=alert_id, **payload.model_dump()
    )
    notifications_store[notification_id] = notification
    return notification


@notifications_router.get(
    "/users/{user_id}/alerts/{alert_id}/notifications/{notification_id}",
    tags=["notifications"],
    responses={404: {"description": "Notificación no encontrada para la alerta"}},
)
def get_alert_notification(
    user_id: int,
    alert_id: int,
    notification_id: int,
    _: Annotated[UserInDB, Depends(get_current_user)],
) -> Notification:
    ensure_alert_for_user(user_id, alert_id)
    return ensure_notification_for_alert(alert_id, notification_id)


@notifications_router.put(
    "/users/{user_id}/alerts/{alert_id}/notifications/{notification_id}",
    tags=["notifications"],
    responses={404: {"description": "Notificación no encontrada para la alerta"}},
)
def update_alert_notification(
    user_id: int,
    alert_id: int,
    notification_id: int,
    payload: NotificationUpdate,
    _: Annotated[UserInDB, Depends(get_current_user)],
) -> Notification:
    ensure_alert_for_user(user_id, alert_id)
    notification = ensure_notification_for_alert(alert_id, notification_id)
    updated = notification.model_copy(update=payload.model_dump(exclude_unset=True))
    notifications_store[notification_id] = updated
    return updated


@notifications_router.delete(
    "/users/{user_id}/alerts/{alert_id}/notifications/{notification_id}",
    status_code=204,
    response_class=Response,
    tags=["notifications"],
    responses={404: {"description": "Notificación no encontrada para la alerta"}},
)
def delete_alert_notification(
    user_id: int,
    alert_id: int,
    notification_id: int,
    _: Annotated[UserInDB, Depends(get_current_user)],
) -> None:
    ensure_alert_for_user(user_id, alert_id)
    ensure_notification_for_alert(alert_id, notification_id)
    notifications_store.pop(notification_id, None)
