from fastapi import Depends, HTTPException
from fastapi.security import HTTPAuthorizationCredentials, HTTPBearer
from sqlalchemy.orm import Session

from app.database.database import get_db
from app.models.user import User as DBUser
from app.services.user_service import role_ids_from_role
from app.stores.memory import active_tokens
from app.schemas.user import UserInDB

security = HTTPBearer(auto_error=False)


def get_current_user(
    credentials: HTTPAuthorizationCredentials = Depends(security),
    db: Session = Depends(get_db),
) -> UserInDB:
    if credentials is None or credentials.scheme.lower() != "bearer":
        raise HTTPException(status_code=401, detail="Token inválido o ausente")

    user_id = active_tokens.get(credentials.credentials)
    if not user_id:
        raise HTTPException(status_code=401, detail="Token inválido o expirado")

    user = db.query(DBUser).filter(DBUser.id == user_id).first()
    if user is None:
        raise HTTPException(status_code=401, detail="Usuario inválido")

    return UserInDB(
        id=user.id,
        email=user.email,
        first_name=user.name,
        last_name=user.surname,
        organization=user.organization or "",
        role_ids=role_ids_from_role(user.role),
        password=user.hashed_password,
    )
