from typing import Annotated, List
from fastapi import APIRouter, Depends, HTTPException, Response
from app.schemas.user import UserInDB
from app.stores.memory import roles_store, users_store
from app.utils.deps import get_current_user
from app.schemas.roles import Role, RoleCreate, RoleUpdate

roles_router = APIRouter()

ERROR_ROLE_NOT_FOUND = "Rol no encontrado"
ERROR_ROLE_ASSIGNED_TO_USERS = "No se puede eliminar un rol asignado a usuarios"


@roles_router.get("/roles", tags=["roles"])
def list_roles(_: Annotated[UserInDB, Depends(get_current_user)] = None) -> List[Role]:
    return list(roles_store.values())


@roles_router.post("/roles", status_code=201, tags=["roles"])
def create_role(payload: RoleCreate, _: Annotated[UserInDB, Depends(get_current_user)] = None) -> Role:
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
    updated = role.model_copy(update=payload.model_dump(exclude_unset=True))
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
def delete_role(role_id: int, _: Annotated[UserInDB, Depends(get_current_user)] = None) -> None:
    if role_id not in roles_store:
        raise HTTPException(status_code=404, detail=ERROR_ROLE_NOT_FOUND)
    for user in users_store.values():
        if role_id in user.role_ids:
            raise HTTPException(
                status_code=409,
                detail=ERROR_ROLE_ASSIGNED_TO_USERS,
            )
    roles_store.pop(role_id, None)
