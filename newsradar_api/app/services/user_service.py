"""Este módulo contiene funciones relacionadas con la lógica de verificación de usuarios"""

from datetime import datetime, timedelta, timezone
from passlib.context import CryptContext
from sqlalchemy.exc import IntegrityError
from sqlalchemy.orm import Session

from app.models.user import User, UserRole
from app.schemas.user import UserCreate, UserUpdate


pwd_context = CryptContext(schemes=["argon2"], deprecated="auto")


def get_password_hash(password: str) -> str:
    """Genera hash de contraseña para persistencia en BD."""
    return pwd_context.hash(password)


def verify_password(plain_password: str, hashed_password: str) -> bool:
    """Verifica contraseña en texto plano frente al hash persistido."""
    return pwd_context.verify(plain_password, hashed_password)


def role_from_role_ids(role_ids: list[int]) -> UserRole:
    """Mapea los role_ids legacy a un rol del modelo SQL."""
    if 1 in role_ids:
        return UserRole.GESTOR
    return UserRole.LECTOR


def role_ids_from_role(role: UserRole) -> list[int]:
    """Mapea el rol SQL a role_ids esperados por los schemas actuales."""
    if role == UserRole.GESTOR:
        return [1]
    return [2]


def create_db_user(db: Session, payload: UserCreate) -> User:
    """Crea un usuario persistente en SQL y devuelve la entidad."""
    db_user = User(
        email=payload.email,
        name=payload.first_name,
        surname=payload.last_name,
        organization=payload.organization,
        hashed_password=get_password_hash(payload.password),
        role=role_from_role_ids(payload.role_ids),
        is_verified=False,
    )

    db.add(db_user)
    try:
        db.commit()
    except IntegrityError as exc:
        db.rollback()
        raise ValueError("El email ya está registrado") from exc

    db.refresh(db_user)
    return db_user


def update_db_user(db: Session, db_user: User, payload: UserUpdate) -> User:
    data = payload.model_dump(exclude_unset=True)

    if "email" in data:
        db_user.email = data["email"]
    if "first_name" in data:
        db_user.name = data["first_name"]
    if "last_name" in data:
        db_user.surname = data["last_name"]
    if "organization" in data:
        db_user.organization = data["organization"]
    if "password" in data:
        db_user.hashed_password = get_password_hash(data["password"])
    if "role_ids" in data and data["role_ids"] is not None:
        db_user.role = role_from_role_ids(data["role_ids"])

    try:
        db.commit()
    except IntegrityError as exc:
        db.rollback()
        raise ValueError("El email ya está registrado") from exc

    db.refresh(db_user)
    return db_user


def is_verification_expired(user: User) -> bool:
    """Comprueba si el período de 24 horas para verificar el correo ha expirado."""
    if not user.created_at:
        return True

    now = datetime.now(timezone.utc)

    # Si el datetime no tiene zona horaria, asignar UTC para que coincida con "now".
    user_created_at = user.created_at
    if user_created_at.tzinfo is None:
        user_created_at = user_created_at.replace(tzinfo=timezone.utc)

    # Comprobar si la hora ha expirado
    expiration_time = user_created_at + timedelta(hours=24)
    return now > expiration_time


def verify_user_email(user: User, db: Session) -> tuple[bool, str]:
    """Intenta verificar el correo de un usuario usando la lógica de caducidad."""
    if user.is_verified:
        return False, "El usuario ya estaba verificado."

    if is_verification_expired(user):
        return (
            False,
            "El enlace de verificación ha caducado (han pasado más de 24 horas).",
        )

    # Si no ha expirado, marcar al usuario como verificado y guardar en BD
    user.is_verified = True
    db.commit()
    db.refresh(user)
    return True, "Email verificado con éxito."


def update_user_role(db: Session, user_id: int, new_role: UserRole) -> bool:
    """Permite al administrador asignar un nuevo rol a un usuario existente."""
    user = db.query(User).filter(User.id == user_id).first()
    if not user:
        return False

    user.role = new_role
    db.commit()
    db.refresh(user)
    return True
