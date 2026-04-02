from typing import List
from fastapi import APIRouter, Depends, HTTPException, Response
from sqlalchemy.orm import Session

from app.database.database import get_db
from app.models.user import User as DBUser
from app.schemas.user import User, UserCreate, UserUpdate, UserInDB
from app.stores.memory import users_store, alerts_store, notifications_store
from app.services.user_service import (
    create_db_user,
    role_ids_from_role,
    update_db_user,
)
from app.utils.user_utils import ensure_role_ids_exist
from app.utils.deps import get_current_user

users_router = APIRouter()


def _to_user_schema(user: DBUser) -> User:
    return User(
        id=user.id,
        email=user.email,
        first_name=user.name,
        last_name=user.surname,
        organization=user.organization or "",
        role_ids=role_ids_from_role(user.role),
    )


def _sync_memory_user(user: DBUser) -> None:
    users_store[user.id] = UserInDB(
        id=user.id,
        email=user.email,
        first_name=user.name,
        last_name=user.surname,
        organization=user.organization or "",
        role_ids=role_ids_from_role(user.role),
        password=user.hashed_password,
    )


def _get_user_or_404(user_id: int, db: Session) -> DBUser:
    user = db.query(DBUser).filter(DBUser.id == user_id).first()
    if user is None:
        raise HTTPException(status_code=404, detail="Usuario no encontrado")
    return user


@users_router.get("/users", response_model=List[User], tags=["users"])
def list_users(
    _: UserInDB = Depends(get_current_user),
    db: Session = Depends(get_db),
) -> List[User]:
    db_users = db.query(DBUser).all()
    if db_users:
        for user in db_users:
            _sync_memory_user(user)
        return [_to_user_schema(user) for user in db_users]
    return []


@users_router.post("/users", response_model=User, status_code=201, tags=["users"])
def create_user(payload: UserCreate, db: Session = Depends(get_db)) -> User:
    ensure_role_ids_exist(payload.role_ids)
    try:
        user_db = create_db_user(db, payload)
    except ValueError as exc:
        raise HTTPException(status_code=409, detail=str(exc)) from exc

    _sync_memory_user(user_db)
    return _to_user_schema(user_db)


@users_router.get("/users/{user_id}", response_model=User, tags=["users"])
def get_user(
    user_id: int,
    _: UserInDB = Depends(get_current_user),
    db: Session = Depends(get_db),
) -> User:
    user = _get_user_or_404(user_id, db)

    _sync_memory_user(user)
    return _to_user_schema(user)


@users_router.put("/users/{user_id}", response_model=User, tags=["users"])
def update_user(
    user_id: int,
    payload: UserUpdate,
    _: UserInDB = Depends(get_current_user),
    db: Session = Depends(get_db),
) -> User:
    user = _get_user_or_404(user_id, db)
    data = payload.model_dump(exclude_unset=True)
    if "role_ids" in data and data["role_ids"] is not None:
        ensure_role_ids_exist(data["role_ids"])

    try:
        updated = update_db_user(db, user, payload)
    except ValueError as exc:
        raise HTTPException(status_code=409, detail=str(exc)) from exc

    _sync_memory_user(updated)
    return _to_user_schema(updated)


@users_router.delete("/users/{user_id}",
    status_code=204,
    response_model=None,
    response_class=Response,
    tags=["users"],
)
def delete_user(
    user_id: int,
    _: UserInDB = Depends(get_current_user),
    db: Session = Depends(get_db),
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
