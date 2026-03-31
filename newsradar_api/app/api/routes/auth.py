from uuid import uuid4
from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy.orm import Session

from app.database.database import get_db
from app.models.user import User as DBUser
from app.schemas.user import UserCreate, User, UserInDB
from app.schemas.auth import LoginRequest, TokenResponse
from app.stores.memory import users_store, active_tokens
from app.utils.user_utils import ensure_role_ids_exist
from app.services.user_service import (
    create_db_user,
    role_ids_from_role,
    verify_password,
)


api_auth_router = APIRouter()


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


@api_auth_router.post("/auth/login", response_model=TokenResponse, tags=["auth"])
def login(payload: LoginRequest, db: Session = Depends(get_db)) -> TokenResponse:
    db_user = db.query(DBUser).filter(DBUser.email == payload.email).first()
    if db_user is not None and verify_password(payload.password, db_user.hashed_password):
        _sync_memory_user(db_user)
        token = str(uuid4())
        active_tokens[token] = db_user.id
        return TokenResponse(access_token=token)

    user = next((u for u in users_store.values() if u.email == payload.email), None)
    if user is None:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED, detail="Credenciales inválidas"
        )

    # Compatibilidad temporal: login de usuarios legacy en memoria.
    if user.password != payload.password:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED, detail="Credenciales inválidas"
        )

    token = str(uuid4())
    active_tokens[token] = user.id
    return TokenResponse(access_token=token)


@api_auth_router.post("/auth/register", response_model=User, tags=["auth"])
def register(payload: UserCreate, db: Session = Depends(get_db)) -> User:
    ensure_role_ids_exist(payload.role_ids)
    try:
        user_db = create_db_user(db, payload)
    except ValueError as exc:
        raise HTTPException(status_code=409, detail=str(exc)) from exc

    _sync_memory_user(user_db)
    return _to_user_schema(user_db)
