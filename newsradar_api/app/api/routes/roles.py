from typing import Annotated, List
from fastapi import APIRouter, Depends, HTTPException, Response
from sqlalchemy.orm import Session

from app.database.database import get_db
from app.models.user import User as DBUser, UserRole
from app.schemas.user import UserInDB
from app.stores.memory import roles_store, users_store
from app.utils.deps import get_current_user
from app.schemas.roles import Role, RoleCreate, RoleUpdate

roles_router = APIRouter()

ERROR_ROLE_NOT_FOUND = "Rol no encontrado"
ERROR_ROLE_ASSIGNED_TO_USERS = "No se puede eliminar un rol asignado a usuarios"
ERROR_ROLE_ALREADY_EXISTS = "Role already exists"
ERROR_ROLE_IN_USE = "Role in use"


def _find_role_by_name_ci(name: str, exclude_id: int | None = None) -> Role | None:
    target = name.strip().lower()
    for existing in roles_store.values():
        if existing.id == exclude_id:
            continue
        if existing.name.strip().lower() == target:
            return existing
    return None


@roles_router.get("/roles", tags=["roles"])
def list_roles(_: Annotated[UserInDB, Depends(get_current_user)] = None) -> List[Role]:
    return list(roles_store.values())


@roles_router.post(
    "/roles",
    status_code=201,
    tags=["roles"],
    responses={409: {"description": "Conflict"}},
)
def create_role(payload: RoleCreate, _: Annotated[UserInDB, Depends(get_current_user)] = None) -> Role:
    if _find_role_by_name_ci(payload.name) is not None:
        raise HTTPException(status_code=409, detail=ERROR_ROLE_ALREADY_EXISTS)
    role_id = max(roles_store.keys(), default=0) + 1
    role = Role(id=role_id, **payload.model_dump())
    roles_store[role_id] = role
    return role


@roles_router.get(
    "/roles/{role_id}",
    tags=["roles"],
    responses={404: {"description": "Not found"}},
)
def get_role(
    role_id: int,
    _: Annotated[UserInDB, Depends(get_current_user)] = None,
) -> Role:
    role = roles_store.get(role_id)
    if not role:
        raise HTTPException(status_code=404, detail=ERROR_ROLE_NOT_FOUND)
    return role


@roles_router.put(
    "/roles/{role_id}",
    tags=["roles"],
    responses={404: {"description": "Rol no encontrado"}},
)
def update_role(
    role_id: int,
    payload: RoleUpdate,
    _: Annotated[UserInDB, Depends(get_current_user)] = None,
) -> Role:
    role = roles_store.get(role_id)
    if not role:
        raise HTTPException(status_code=404, detail=ERROR_ROLE_NOT_FOUND)
    data = payload.model_dump(exclude_unset=True)
    new_name = data.get("name")
    if new_name and _find_role_by_name_ci(new_name, exclude_id=role_id) is not None:
        raise HTTPException(status_code=409, detail=ERROR_ROLE_ALREADY_EXISTS)
    updated = role.model_copy(update=data)
    roles_store[role_id] = updated
    return updated


@roles_router.delete(
    "/roles/{role_id}",
    status_code=204,
    response_class=Response,
    tags=["roles"],
    responses={
        404: {"description": "Not found"},
        409: {"description": "Conflict"},
    },
)
def delete_role(
    role_id: int,
    db: Annotated[Session, Depends(get_db)],
    _: Annotated[UserInDB, Depends(get_current_user)] = None,
) -> None:
    role = roles_store.get(role_id)
    if role is None:
        raise HTTPException(status_code=404, detail=ERROR_ROLE_NOT_FOUND)

    role_name_lower = (role.name or "").strip().lower()

    # 1) Memoria: usuarios sincronizados con role_ids.
    memory_count = sum(
        1 for user in users_store.values() if role_id in user.role_ids
    )

    # 2) BD: mapear el nombre del rol a UserRole (gestor/lector/admin) y, si no
    #    coincide, mapear por role_id como fallback. Contar usuarios en ambos
    #    casos por separado y sumar.
    name_to_enum = {
        "gestor": UserRole.GESTOR,
        "lector": UserRole.LECTOR,
        "admin": UserRole.ADMIN,
    }
    id_to_enum = {1: UserRole.GESTOR, 2: UserRole.LECTOR, 3: UserRole.ADMIN}

    db_role = name_to_enum.get(role_name_lower) or id_to_enum.get(role_id)

    db_count = 0
    if db_role is not None:
        db_count = (
            db.query(DBUser)
            .filter(DBUser.role == db_role)
            .count()
        )
        # 3) Búsqueda extra por string del nombre (defensiva por si el enum se
        #    almacena como string en la columna).
        if db_count == 0:
            db_count = (
                db.query(DBUser)
                .filter(DBUser.role == db_role.value)
                .count()
            )

    total = memory_count + db_count
    print(f"DEBUG: Usuarios encontrados con rol '{role.name}' (id={role_id}): "
          f"memoria={memory_count}, db={db_count}, total={total}")

    if total > 0:
        raise HTTPException(status_code=409, detail=ERROR_ROLE_IN_USE)

    roles_store.pop(role_id, None)
