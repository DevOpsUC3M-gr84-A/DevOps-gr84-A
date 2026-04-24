"""Este módulo contiene funciones relacionadas con la lógica de verificación de usuarios"""
import uuid
import secrets
from datetime import datetime, timedelta, timezone
from passlib.context import CryptContext
from sqlalchemy.exc import IntegrityError
from sqlalchemy.orm import Session

from app import config
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
    if 3 in role_ids:
        return UserRole.ADMIN
    if 1 in role_ids:
        return UserRole.GESTOR
    if 2 in role_ids:
        return UserRole.LECTOR
    # Por defecto, los nuevos registros deben ser Gestor.
    return UserRole.GESTOR


def role_ids_from_role(role: UserRole) -> list[int]:
    """Mapea el rol SQL a role_ids esperados por los schemas actuales."""
    if role == UserRole.ADMIN:
        return [3]
    if role == UserRole.GESTOR:
        return [1]
    return [2]


def create_db_user(db: Session, payload: UserCreate) -> User:
    """Crea un usuario persistente en SQL y devuelve la entidad."""
    token = str(uuid.uuid4())
    db_user = User(
        email=payload.email,
        name=payload.first_name,
        surname=payload.last_name,
        organization=payload.organization,
        verification_token=token,
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
    try:
        user = db.query(User).filter(User.id == user_id).first()
        if not user:
            return False

        user.role = new_role
        db.commit()
        db.refresh(user)
        return True
    except Exception:
        db.rollback()
        raise

# Recuperación de contraseña

def generate_reset_token(db: Session, email: str) -> str | None:
    """
    Genera un token seguro de reset para el usuario con ese email y lo persiste en BD.

    Devuelve el token si el usuario existe, None si no (el caller no debe revelar
    esta diferencia al cliente para evitar enumeración de usuarios).
    """
    user = db.query(User).filter(User.email == email).first()
    if user is None:
        return None

    token = secrets.token_urlsafe(32)
    expires = datetime.now(timezone.utc) + timedelta(hours=config.RESET_TOKEN_EXPIRE_HOURS)

    user.reset_password_token = token
    user.reset_password_token_expires = expires
    db.commit()
    return token


def reset_password_with_token(db: Session, token: str, new_password: str) -> tuple[bool, str]:
    """
    Valida el token de reset y actualiza la contraseña si es válido y no ha expirado.

    Devuelve (True, mensaje_ok) o (False, mensaje_error).
    """
    user = db.query(User).filter(User.reset_password_token == token).first()

    if user is None:
        return False, "Token inválido o ya utilizado."

    now = datetime.now(timezone.utc)
    expires = user.reset_password_token_expires

    # Normalizar zona horaria si la BD devuelve datetime naive
    if expires is not None and expires.tzinfo is None:
        expires = expires.replace(tzinfo=timezone.utc)

    if expires is None or now > expires:
        # Limpiar token expirado
        user.reset_password_token = None
        user.reset_password_token_expires = None
        db.commit()
        return False, "El enlace de recuperación ha expirado. Solicita uno nuevo."

    # Token válido: actualizar contraseña e invalidar token
    user.hashed_password = get_password_hash(new_password)
    user.reset_password_token = None
    user.reset_password_token_expires = None
    db.commit()
    return True, "Contraseña actualizada correctamente."


def list_all_users(db: Session) -> list[User]:
    """Devuelve la lista de todos los usuarios de la base de datos."""
    try:
        users = db.query(User).all()
        return users
    except Exception:
        db.rollback()
        raise


def update_user_role_by_role_id(db: Session, user_id: int, role_id: int) -> User:
    """Actualiza el rol de un usuario basado en role_id (1=Gestor, 2=Lector, 3=Admin)."""
    try:
        # Mapear role_id a UserRole
        role_map = {1: UserRole.GESTOR, 2: UserRole.LECTOR, 3: UserRole.ADMIN}
        if role_id not in role_map:
            raise ValueError(f"Role ID inválido: {role_id}")

        user = db.query(User).filter(User.id == user_id).first()
        if not user:
            raise ValueError(f"Usuario no encontrado: {user_id}")

        user.role = role_map[role_id]
        db.commit()
        db.refresh(user)
        return user
    except Exception:
        db.rollback()
        raise