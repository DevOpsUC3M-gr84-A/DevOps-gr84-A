"""
Este módulo se encarga de inicializar la base de datos y
crear un usuario administrador inicial si no existe ninguno.
"""

import os
from sqlalchemy.orm import Session
from passlib.context import CryptContext
from app.database.database import SessionLocal, engine, Base
from app.models.user import User, UserRole

# Configuración de passlib para generar hashes con bcrypt
pwd_context = CryptContext(schemes=["bcrypt"], deprecated="auto")


def get_password_hash(password: str) -> str:
    """Genera un hash seguro para la contraseña."""
    return pwd_context.hash(password)


def create_initial_admin(db: Session) -> None:
    """Crea un usuario Gestor inicial verificado si no existe ninguno en la plataforma."""

    # Comprobar si ya existe algún usuario con el rol de GESTOR
    admin = db.query(User).filter(User.role == UserRole.GESTOR).first()

    # Si no existe, crearlo
    if not admin:
        print("No se encontró ningún administrador. Creando Gestor inicial...")

        admin_email = os.getenv("FIRST_SUPERUSER_EMAIL", "admin@newsradar.com")
        admin_password = os.getenv("FIRST_SUPERUSER_PASSWORD", "admin1234")

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

        print(f"Gestor inicial creado exitosamente con el email: {admin_email}")
    else:
        print(
            f"El Gestor inicial {admin.email} ya existe. No se ha realizado ninguna acción."
        )


if __name__ == "__main__":
    print("Iniciando conexión con la base de datos...")
    # Asegurarnos de que las tablas existen (equivalente a una migración inicial sencilla)
    Base.metadata.create_all(bind=engine)

    database = SessionLocal()
    try:
        create_initial_admin(database)
    finally:
        database.close()
