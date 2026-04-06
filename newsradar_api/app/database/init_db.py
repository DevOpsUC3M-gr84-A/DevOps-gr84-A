"""
Este módulo se encarga de inicializar la base de datos y
crear un usuario administrador inicial si no existe ninguno.
"""

import os
import logging
from sqlalchemy.orm import Session
from passlib.context import CryptContext
from app.database.database import SessionLocal, engine, Base
from app.models.user import User, UserRole

logger = logging.getLogger(__name__)

# Configuración de passlib para generar hashes con argon2
pwd_context = CryptContext(schemes=["argon2"], deprecated="auto")


def get_password_hash(password: str) -> str:
    """Genera un hash seguro para la contraseña."""
    return pwd_context.hash(password)


def create_initial_admin(db: Session) -> None:
    """Crea un usuario Gestor inicial verificado si no existe ninguno en la plataforma."""

    # Comprobar si ya existe algún usuario con el rol de GESTOR
    admin = db.query(User).filter(User.role == UserRole.GESTOR).first()

    # Si no existe, crearlo
    if not admin:
        logger.info("No se encontró ningún administrador. Creando Gestor inicial...")

        admin_email = os.getenv("FIRST_SUPERUSER_EMAIL")
        admin_password = os.getenv("FIRST_SUPERUSER_PASSWORD")

        if not admin_email or not admin_password:
            raise RuntimeError("Faltan credenciales de entorno")

        new_admin = User(
            email=admin_email,
            name="Admin",
            surname="Inicial",
            organization="NewsRadar Admin",
            hashed_password=get_password_hash(admin_password),
            role=UserRole.GESTOR,
            is_verified=True,
        )

        db.add(new_admin)
        db.commit()
        db.refresh(new_admin)

        logger.info("Gestor inicial creado exitosamente con el email: %s", admin_email)
    else:
        logger.info(
            "El Gestor inicial %s ya existe. No se ha realizado ninguna acción.",
            admin.email,
        )


if __name__ == "__main__":  # pragma: no cover
    logging.basicConfig(level=logging.INFO)
    logger.info("Iniciando conexión con la base de datos...")
    # Asegurarnos de que las tablas existen (equivalente a una migración inicial sencilla)
    Base.metadata.create_all(bind=engine)

    database = SessionLocal()
    try:
        create_initial_admin(database)
    finally:
        database.close()
