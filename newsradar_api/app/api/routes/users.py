from typing import Annotated, List

from fastapi import APIRouter, Depends, HTTPException, Response
from sqlalchemy.orm import Session

from app.database.database import get_db
from app.models.user import User as DBUser
from app.schemas.user import User, UserCreate, UserUpdate, UserInDB
from app.stores.memory import users_store, alerts_store, notifications_store
from app.services.user_service import (
    create_db_user,
    update_db_user,
)
from app.utils.user_utils import ensure_role_ids_exist, sync_memory_user, to_user_schema
from app.utils.deps import get_current_user

users_router = APIRouter()


def _get_user_or_404(user_id: int, db: Session) -> DBUser:
    user = db.query(DBUser).filter(DBUser.id == user_id).first()
    if user is None:
        raise HTTPException(status_code=404, detail="Usuario no encontrado")
    return user


@users_router.get("/users", tags=["users"])
def list_users(
    db: Annotated[Session, Depends(get_db)],
    _: Annotated[UserInDB, Depends(get_current_user)] = None,
) -> List[User]:
    db_users = db.query(DBUser).all()
    if db_users:
        for user in db_users:
            sync_memory_user(user)
        return [to_user_schema(user) for user in db_users]
    return []


@users_router.post(
    "/users",
    status_code=201,
    tags=["users"],
    responses={409: {"description": "Conflict"}},
)
def create_user(payload: UserCreate, db: Annotated[Session, Depends(get_db)]) -> User:
    ensure_role_ids_exist(payload.role_ids)
    try:
        user_db = create_db_user(db, payload)
    except ValueError as exc:
        raise HTTPException(status_code=409, detail=str(exc)) from exc

    sync_memory_user(user_db)
    return to_user_schema(user_db)


@users_router.get(
    "/users/{user_id}",
    tags=["users"],
    responses={404: {"description": "Usuario no encontrado"}},
)
def get_user(
    user_id: int,
    db: Annotated[Session, Depends(get_db)],
    _: Annotated[UserInDB, Depends(get_current_user)] = None,
) -> User:
    user = _get_user_or_404(user_id, db)

    sync_memory_user(user)
    return to_user_schema(user)


@users_router.put(
    "/users/{user_id}",
    tags=["users"],
    responses={
        404: {"description": "Usuario no encontrado"},
        409: {"description": "Conflict"},
    },
)
def update_user(
    user_id: int,
    payload: UserUpdate,
    db: Annotated[Session, Depends(get_db)],
    _: Annotated[UserInDB, Depends(get_current_user)] = None,
) -> User:
    user = _get_user_or_404(user_id, db)
    data = payload.model_dump(exclude_unset=True)
    if "role_ids" in data and data["role_ids"] is not None:
        ensure_role_ids_exist(data["role_ids"])

    try:
        updated = update_db_user(db, user, payload)
    except ValueError as exc:
        raise HTTPException(status_code=409, detail=str(exc)) from exc

    sync_memory_user(updated)
    return to_user_schema(updated)


@users_router.delete(
    "/users/{user_id}",
    status_code=204,
    response_class=Response,
    tags=["users"],
    responses={404: {"description": "Usuario no encontrado"}},
)
def delete_user(
    user_id: int,
    db: Annotated[Session, Depends(get_db)],
    _: Annotated[UserInDB, Depends(get_current_user)] = None,
) -> None:
    user = _get_user_or_404(user_id, db)

    # Eliminar alertas y notificaciones asociadas al usuario (como en router.py)
    alert_ids = [
        alert.id for alert in alerts_store.values() if alert.user_id == user_id
    ]
    for alert_id in alert_ids:
        notification_ids = [
            n.id for n in notifications_store.values() if n.alert_id == alert_id
        ]
        for notification_id in notification_ids:
            notifications_store.pop(notification_id, None)
        alerts_store.pop(alert_id, None)

    db.delete(user)
    db.commit()
    users_store.pop(user_id, None)
