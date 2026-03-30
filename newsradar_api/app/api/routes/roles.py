from fastapi import APIRouter, Depends, HTTPException, Response, status
from typing import List
from app.schemas.user import UserInDB
from app.stores.memory import roles_store, users_store
from app.utils.deps import get_current_user
from app.schemas.roles import Role, RoleCreate, RoleUpdate

roles_router = APIRouter()

API_PREFIX = "/api/v1"


@roles_router.get(f"{API_PREFIX}/roles", response_model=List[Role], tags=["roles"])
def list_roles(_: UserInDB = Depends(get_current_user)) -> List[Role]:
    return list(roles_store.values())


@roles_router.post(
    f"{API_PREFIX}/roles", response_model=Role, status_code=201, tags=["roles"]
)
def create_role(payload: RoleCreate, _: UserInDB = Depends(get_current_user)) -> Role:
    role_id = max(roles_store.keys(), default=0) + 1
    role = Role(id=role_id, **payload.model_dump())
    roles_store[role_id] = role
    return role


@roles_router.get(
    f"{API_PREFIX}/roles/{{role_id}}", response_model=Role, tags=["roles"]
)
def get_role(role_id: int, _: UserInDB = Depends(get_current_user)) -> Role:
    role = roles_store.get(role_id)
    if not role:
        raise HTTPException(status_code=404, detail="Rol no encontrado")
    return role


@roles_router.put(
    f"{API_PREFIX}/roles/{{role_id}}", response_model=Role, tags=["roles"]
)
def update_role(
    role_id: int, payload: RoleUpdate, _: UserInDB = Depends(get_current_user)
) -> Role:
    role = roles_store.get(role_id)
    if not role:
        raise HTTPException(status_code=404, detail="Rol no encontrado")
    updated = role.model_copy(update=payload.model_dump(exclude_unset=True))
    roles_store[role_id] = updated
    return updated


@roles_router.delete(
    f"{API_PREFIX}/roles/{{role_id}}",
    status_code=204,
    response_model=None,
    response_class=Response,
    tags=["roles"],
)
def delete_role(role_id: int, _: UserInDB = Depends(get_current_user)) -> None:
    if role_id not in roles_store:
        raise HTTPException(status_code=404, detail="Rol no encontrado")
    for user in users_store.values():
        if role_id in user.role_ids:
            raise HTTPException(
                status_code=409,
                detail="No se puede eliminar un rol asignado a usuarios",
            )
    roles_store.pop(role_id, None)
