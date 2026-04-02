from fastapi import HTTPException, status
from app.models.user import User as DBUser
from app.services.user_service import role_ids_from_role
from app.stores.memory import roles_store
from app.stores.memory import users_store
from app.schemas.user import UserInDB, User
from typing import List


def ensure_role_ids_exist(role_ids: List[int]) -> None:
    missing = [role_id for role_id in role_ids if role_id not in roles_store]
    if missing:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail=f"Roles no encontrados: {missing}",
        )


def sanitize_user(user: UserInDB) -> User:
    return User(
        id=user.id,
        email=user.email,
        first_name=user.first_name,
        last_name=user.last_name,
        organization=user.organization,
        role_ids=user.role_ids,
    )


def to_user_schema(user: DBUser) -> User:
    return User(
        id=user.id,
        email=user.email,
        first_name=user.name,
        last_name=user.surname,
        organization=user.organization or "",
        role_ids=role_ids_from_role(user.role),
    )


def sync_memory_user(user: DBUser) -> None:
    users_store[user.id] = UserInDB(
        id=user.id,
        email=user.email,
        first_name=user.name,
        last_name=user.surname,
        organization=user.organization or "",
        role_ids=role_ids_from_role(user.role),
        password=user.hashed_password,
    )
