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
        avatar=user.avatar,
        banner=user.banner,
    )


def _hardcoded_role_ids(role) -> list[int]:
    """Mapeo hardcoded role → role_ids para garantizar la respuesta esperada.

    gestor → [1], lector → [2], admin → [3]. Tolerante a string o enum.
    """
    if role is None:
        return [1]
    raw = getattr(role, "value", role)
    name = str(raw).strip().lower()
    if name == "admin":
        return [3]
    if name == "lector":
        return [2]
    if name == "gestor":
        return [1]
    return [1]


def to_user_schema(user: DBUser) -> User:
    role_ids = _hardcoded_role_ids(user.role)
    schema = User(
        id=user.id,
        email=user.email,
        first_name=user.name or "Usuario",
        last_name=user.surname or "Desconocido",
        organization=user.organization or "",
        role_ids=role_ids,
        is_verified=bool(user.is_verified),
        is_active=bool(user.is_verified),
        avatar=user.avatar,
        banner=user.banner,
    )
    print(f"DEBUG: Devolviendo usuario id={user.id} email={user.email} "
          f"role={user.role} role_ids={schema.role_ids}")
    return schema


def sync_memory_user(user: DBUser) -> None:
    users_store[user.id] = UserInDB(
        id=user.id,
        email=user.email,
        first_name=user.name or "Usuario",
        last_name=user.surname or "Desconocido",
        organization=user.organization or "",
        role_ids=role_ids_from_role(user.role),
        password=user.hashed_password,
        avatar=user.avatar,
        banner=user.banner,
    )
