from fastapi import APIRouter, Depends, HTTPException, Response, status
from typing import List
from app.schemas.alert import Alert, AlertCreate, AlertUpdate
from app.schemas.user import UserInDB
from app.stores.memory import alerts_store, notifications_store
from app.utils.deps import get_current_user


def ensure_user_exists(user_id: int, users_store):
    if user_id not in users_store:
        raise HTTPException(status_code=404, detail="Usuario no encontrado")


api_alerts_router = APIRouter()
API_PREFIX = "/api/v1"


@api_alerts_router.get(
    f"{API_PREFIX}/users/{{user_id}}/alerts",
    response_model=List[Alert],
    tags=["alerts"],
)
def list_user_alerts(
    user_id: int,
    users_store=Depends(lambda: alerts_store),
    _: UserInDB = Depends(get_current_user),
) -> List[Alert]:
    # users_store is not used here, but kept for signature compatibility
    return [alert for alert in alerts_store.values() if alert.user_id == user_id]


@api_alerts_router.post(
    f"{API_PREFIX}/users/{{user_id}}/alerts",
    response_model=Alert,
    status_code=201,
    tags=["alerts"],
)
def create_user_alert(
    user_id: int, payload: AlertCreate, _: UserInDB = Depends(get_current_user)
) -> Alert:
    alert_id = max(alerts_store.keys(), default=0) + 1
    alert = Alert(id=alert_id, user_id=user_id, **payload.model_dump())
    alerts_store[alert_id] = alert
    return alert


@api_alerts_router.get(
    f"{API_PREFIX}/users/{{user_id}}/alerts/{{alert_id}}",
    response_model=Alert,
    tags=["alerts"],
)
def get_user_alert(
    user_id: int, alert_id: int, _: UserInDB = Depends(get_current_user)
) -> Alert:
    alert = alerts_store.get(alert_id)
    if not alert or alert.user_id != user_id:
        raise HTTPException(
            status_code=404, detail="Alerta no encontrada para el usuario"
        )
    return alert


@api_alerts_router.put(
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
    alert = alerts_store.get(alert_id)
    if not alert or alert.user_id != user_id:
        raise HTTPException(
            status_code=404, detail="Alerta no encontrada para el usuario"
        )
    updated = alert.model_copy(update=payload.model_dump(exclude_unset=True))
    alerts_store[alert_id] = updated
    return updated


@api_alerts_router.delete(
    f"{API_PREFIX}/users/{{user_id}}/alerts/{{alert_id}}",
    status_code=204,
    response_model=None,
    response_class=Response,
    tags=["alerts"],
)
def delete_user_alert(
    user_id: int, alert_id: int, _: UserInDB = Depends(get_current_user)
) -> None:
    alert = alerts_store.get(alert_id)
    if not alert or alert.user_id != user_id:
        raise HTTPException(
            status_code=404, detail="Alerta no encontrada para el usuario"
        )
    notification_ids = [
        n_id for n_id, n in notifications_store.items() if n.alert_id == alert_id
    ]
    for notification_id in notification_ids:
        notifications_store.pop(notification_id, None)
    alerts_store.pop(alert_id, None)
