"""Este módulo contiene funciones relacionadas con la lógica de verificación de usuarios"""

from datetime import datetime, timedelta, timezone
from sqlalchemy.orm import Session
from newsradar_api.app.models.user import User


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
