from uuid import uuid4
from typing import Annotated, List

from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy.orm import Session

from app.database.database import get_db
from app.models.user import User as DBUser
from app.schemas.user import UserCreate, User, UserInDB, TokenVerification, UserResponse
from app.schemas.auth import (
    LoginRequest,
    TokenResponse,
    ForgotPasswordRequest,
    ResetPasswordRequest,
    MessageResponse,
)
from app.stores.memory import active_tokens, users_store
from app.services.user_service import role_ids_from_role
from app.utils.user_utils import ensure_role_ids_exist, sync_memory_user, to_user_schema
from app.utils.email_utils import send_reset_password_email, send_verification_email
from app.services.user_service import (
    create_db_user,
    verify_password,
    generate_reset_token,
    reset_password_with_token,
    verify_user_email,
)


api_auth_router = APIRouter()


def _issue_token(user_id: int, role_ids: List[int]) -> TokenResponse:
    token = str(uuid4())
    active_tokens[token] = user_id
    return TokenResponse(
        access_token=token, 
        user_id=user_id, 
        role_ids=role_ids
    )


def _find_db_user_by_email(email: str, db: Session) -> DBUser | None:
    return db.query(DBUser).filter(DBUser.email == email).first()


def _find_legacy_user_by_email(email: str) -> UserInDB | None:
    return next((u for u in users_store.values() if u.email == email), None)


@api_auth_router.post("/auth/login", tags=["auth"])
def login(
    payload: LoginRequest,
    db: Annotated[Session, Depends(get_db)],
) -> TokenResponse:
    db_user = _find_db_user_by_email(payload.email, db)
    if db_user is not None and verify_password(payload.password, db_user.hashed_password):
        if not db_user.is_verified:
            raise HTTPException(
                status_code=status.HTTP_401_UNAUTHORIZED,
                detail="Cuenta no verificada. Revisa tu email para activar tu cuenta.",
            )
        
        sync_memory_user(db_user)
        ids = role_ids_from_role(db_user.role)
        return _issue_token(db_user.id, ids)

    user = _find_legacy_user_by_email(payload.email)
    if user is None:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED, detail="Credenciales inválidas"
        )

    # Compatibilidad temporal: login de usuarios legacy en memoria.
    if user.password != payload.password:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED, detail="Credenciales inválidas"
        )

    return _issue_token(user.id, user.role_ids)


@api_auth_router.post(
    "/auth/register",
    tags=["auth"],
    responses={409: {"description": "Conflict"}},
)
def register(payload: UserCreate, db: Annotated[Session, Depends(get_db)]) -> User:
    ensure_role_ids_exist(payload.role_ids)
    try:
        user_db = create_db_user(db, payload)
    except ValueError as exc:
        raise HTTPException(status_code=409, detail=str(exc)) from exc

    if user_db.verification_token:
        send_verification_email(to_email=user_db.email, verification_token=user_db.verification_token)

    sync_memory_user(user_db)
    return to_user_schema(user_db)

# Endpoint de verificación de email
@api_auth_router.post("/auth/verify-email", tags=["auth"])
def verify_account(payload: TokenVerification, db: Annotated[Session, Depends(get_db)]) -> MessageResponse:
    """Valida el token de verificación recibido por email y activa la cuenta del usuario."""
    db_user = db.query(DBUser).filter(DBUser.verification_token == payload.token).first()
    if not db_user:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Token de verificación inválido o la cuenta ya está verificada.",
        )

    success, message = verify_user_email(db_user, db)

    if not success:
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail=message)

    return MessageResponse(message=message)

# Recuperación de contraseña

@api_auth_router.post(
    "/auth/forgot-password",
    tags=["auth"],
    status_code=status.HTTP_202_ACCEPTED,
    summary="Solicitar recuperación de contraseña",
    description=(
        "Recibe un email y, si existe en el sistema, envía un enlace de reset. "
        "Siempre devuelve 202 para no revelar si el email está registrado."
    ),
)
def forgot_password(
    payload: ForgotPasswordRequest,
    db: Annotated[Session, Depends(get_db)],
) -> MessageResponse:
    token = generate_reset_token(db, payload.email)

    # Si el usuario existe, enviamos el email (el fallo de envío se loguea internamente)
    if token is not None:
        send_reset_password_email(to_email=payload.email, reset_token=token)

    # Respuesta siempre igual (evita enumeración de usuarios)
    return MessageResponse(
        message="Si el email está registrado, recibirás un enlace de recuperación en breve."
    )


@api_auth_router.post(
    "/auth/reset-password",
    tags=["auth"],
    summary="Restablecer contraseña con token",
    description="Valida el token recibido por email y establece la nueva contraseña.",
    responses={
        400: {"description": "Token inválido o expirado"},
    },
)
def reset_password(
    payload: ResetPasswordRequest,
    db: Annotated[Session, Depends(get_db)],
) -> MessageResponse:
    success, message = reset_password_with_token(db, payload.token, payload.new_password)

    if not success:
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail=message)

    return MessageResponse(message=message)