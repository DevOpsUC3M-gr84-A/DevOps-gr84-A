from fastapi import APIRouter, Depends, HTTPException, Response, status
from typing import List
from app.schemas.user import User, UserCreate, UserUpdate, UserInDB
from app.stores.memory import users_store
from app.utils.user_utils import sanitize_user, ensure_role_ids_exist
from app.utils.deps import get_current_user

users_router = APIRouter()

API_PREFIX = "/api/v1"


@users_router.get(f"{API_PREFIX}/users", response_model=List[User], tags=["users"])
def list_users(_: UserInDB = Depends(get_current_user)) -> List[User]:
    return [sanitize_user(user) for user in users_store.values()]


@users_router.post(
    f"{API_PREFIX}/users", response_model=User, status_code=201, tags=["users"]
)
def create_user(payload: UserCreate, _: UserInDB = Depends(get_current_user)) -> User:
    if any(user.email == payload.email for user in users_store.values()):
        raise HTTPException(status_code=409, detail="El email ya está registrado")
    ensure_role_ids_exist(payload.role_ids)
    user_id = max(users_store.keys(), default=0) + 1
    user_db = UserInDB(id=user_id, **payload.model_dump())
    users_store[user_id] = user_db
    return sanitize_user(user_db)


@users_router.get(
    f"{API_PREFIX}/users/{{user_id}}", response_model=User, tags=["users"]
)
def get_user(user_id: int, _: UserInDB = Depends(get_current_user)) -> User:
    user = users_store.get(user_id)
    if not user:
        raise HTTPException(status_code=404, detail="Usuario no encontrado")
    return sanitize_user(user)


@users_router.put(
    f"{API_PREFIX}/users/{{user_id}}", response_model=User, tags=["users"]
)
def update_user(
    user_id: int, payload: UserUpdate, _: UserInDB = Depends(get_current_user)
) -> User:
    user = users_store.get(user_id)
    if not user:
        raise HTTPException(status_code=404, detail="Usuario no encontrado")
    data = payload.model_dump(exclude_unset=True)
    if "email" in data and any(
        u.email == data["email"] and u.id != user_id for u in users_store.values()
    ):
        raise HTTPException(status_code=409, detail="El email ya está registrado")
    if "role_ids" in data:
        ensure_role_ids_exist(data["role_ids"])
    updated = user.model_copy(update=data)
    users_store[user_id] = updated
    return sanitize_user(updated)


@users_router.delete(
    f"{API_PREFIX}/users/{{user_id}}",
    status_code=204,
    response_model=None,
    response_class=Response,
    tags=["users"],
)
def delete_user(user_id: int, _: UserInDB = Depends(get_current_user)) -> None:
    if user_id not in users_store:
        raise HTTPException(status_code=404, detail="Usuario no encontrado")
    users_store.pop(user_id, None)
