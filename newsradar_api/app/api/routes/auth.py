from uuid import uuid4
from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy.orm import Session

from app.database.database import get_db
from app.models.user import User as DBUser
from app.schemas.user import UserCreate, User, UserInDB
from app.schemas.auth import LoginRequest, TokenResponse
from app.stores.memory import users_store, active_tokens
from app.utils.user_utils import ensure_role_ids_exist, sync_memory_user, to_user_schema
from app.services.user_service import (
    create_db_user,
    verify_password,
)


api_auth_router = APIRouter()


def _issue_token(user_id: int) -> TokenResponse:
    token = str(uuid4())
    active_tokens[token] = user_id
    return TokenResponse(access_token=token)


def _find_db_user_by_email(email: str, db: Session) -> DBUser | None:
    return db.query(DBUser).filter(DBUser.email == email).first()


def _find_legacy_user_by_email(email: str) -> UserInDB | None:
    return next((u for u in users_store.values() if u.email == email), None)


@api_auth_router.post("/auth/login", response_model=TokenResponse, tags=["auth"])
def login(payload: LoginRequest, db: Session = Depends(get_db)) -> TokenResponse:
    db_user = _find_db_user_by_email(payload.email, db)
    if db_user is not None and verify_password(payload.password, db_user.hashed_password):
        sync_memory_user(db_user)
        return _issue_token(db_user.id)

    user = _find_legacy_user_by_email(payload.email)
    if user is None:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED, detail="Credenciales inválidas"
        )

    # Compatibilidad temporal: login de usuarios legacy en memoria.
    if user.password != payload.password:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED, detail="Credenciales inválidas"
        )

    return _issue_token(user.id)


@api_auth_router.post("/auth/register", response_model=User, tags=["auth"])
def register(payload: UserCreate, db: Session = Depends(get_db)) -> User:
    ensure_role_ids_exist(payload.role_ids)
    try:
        user_db = create_db_user(db, payload)
    except ValueError as exc:
        raise HTTPException(status_code=409, detail=str(exc)) from exc

    sync_memory_user(user_db)
    return to_user_schema(user_db)
