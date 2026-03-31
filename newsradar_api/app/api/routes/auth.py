from uuid import uuid4
from fastapi import APIRouter, HTTPException, status

from app.schemas.user import UserCreate, User, UserInDB
from app.schemas.auth import LoginRequest, TokenResponse
from app.stores.memory import users_store, active_tokens
from app.utils.user_utils import sanitize_user
from app.utils.user_utils import ensure_role_ids_exist


api_auth_router = APIRouter()


@api_auth_router.post("/auth/login", response_model=TokenResponse, tags=["auth"])
def login(payload: LoginRequest) -> TokenResponse:
    user = next((u for u in users_store.values() if u.email == payload.email), None)
    if user is None or user.password != payload.password:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED, detail="Credenciales inválidas"
        )

    token = str(uuid4())
    active_tokens[token] = user.id
    return TokenResponse(access_token=token)


@api_auth_router.post("/auth/register", response_model=User, tags=["auth"])
def register(payload: UserCreate) -> User:
    if any(user.email == payload.email for user in users_store.values()):
        raise HTTPException(
            status_code=status.HTTP_409_CONFLICT, detail="El email ya está registrado"
        )

    ensure_role_ids_exist(payload.role_ids)
    user_id = max(users_store.keys(), default=0) + 1
    user_db = UserInDB(id=user_id, **payload.model_dump())
    users_store[user_id] = user_db
    return sanitize_user(user_db)
