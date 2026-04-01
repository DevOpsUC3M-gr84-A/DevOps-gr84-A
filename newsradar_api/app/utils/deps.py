from fastapi import Depends, HTTPException, status
from fastapi.security import HTTPAuthorizationCredentials, HTTPBearer
from app.stores.memory import users_store, active_tokens, roles_store
from app.schemas.user import UserInDB

security = HTTPBearer(auto_error=False)
MANAGEMENT_ROLE_NAMES = {"Gestor", "admin", "manager"}


def get_current_user(
    credentials: HTTPAuthorizationCredentials = Depends(security),
) -> UserInDB:
    if credentials is None or credentials.scheme.lower() != "bearer":
        raise HTTPException(status_code=401, detail="Token inválido o ausente")

    user_id = active_tokens.get(credentials.credentials)
    if not user_id:
        raise HTTPException(status_code=401, detail="Token inválido o expirado")

    user = users_store.get(user_id)
    if not user:
        raise HTTPException(status_code=401, detail="Usuario inválido")

    return user


def get_user_role_names(user: UserInDB) -> set[str]:
    return {
        roles_store[role_id].name
        for role_id in user.role_ids
        if role_id in roles_store
    }


def get_current_gestor(current_user: UserInDB = Depends(get_current_user)) -> UserInDB:
    if not get_user_role_names(current_user).intersection(MANAGEMENT_ROLE_NAMES):
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="No tienes los permisos necesarios para realizar esta acción.",
        )
    return current_user
