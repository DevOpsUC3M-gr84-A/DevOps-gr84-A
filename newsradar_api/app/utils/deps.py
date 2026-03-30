from fastapi import Depends, HTTPException
from fastapi.security import HTTPAuthorizationCredentials, HTTPBearer
from app.stores.memory import users_store, active_tokens
from app.schemas.user import UserInDB

security = HTTPBearer(auto_error=False)


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
