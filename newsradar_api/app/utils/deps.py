from fastapi import Depends, HTTPException, status
from fastapi.security import HTTPAuthorizationCredentials, HTTPBearer
from sqlalchemy.orm import Session

from app.database.database import get_db
from app.models.user import User as DBUser, UserRole
from app.services.user_service import role_ids_from_role
from app.stores.memory import active_tokens
from app.schemas.user import UserInDB

security = HTTPBearer(auto_error=False)


def get_current_user(
    credentials: HTTPAuthorizationCredentials = Depends(security),
    db: Session = Depends(get_db),
) -> DBUser:
    if credentials is None or credentials.scheme.lower() != "bearer":
        raise HTTPException(status_code=401, detail="Token inválido o ausente")

    user_id = active_tokens.get(credentials.credentials)
    if not user_id:
        raise HTTPException(status_code=401, detail="Token inválido o expirado")

    user = db.query(DBUser).filter(DBUser.id == user_id).first()
    if user is None:
        raise HTTPException(status_code=401, detail="Usuario inválido (ID no encontrado)")

    if not user.is_verified:
        raise HTTPException(status_code=401, detail="Cuenta no verificada")
    return user


def get_current_gestor(current_user: DBUser = Depends(get_current_user)) -> DBUser:
    if current_user.role not in {UserRole.GESTOR, UserRole.ADMIN}:
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="No tienes los permisos necesarios (rol de gestión).",
        )
    return current_user
