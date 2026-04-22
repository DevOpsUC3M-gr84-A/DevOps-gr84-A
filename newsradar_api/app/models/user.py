"""Este módulo define el modelo de datos para los usuarios."""

import enum
from sqlalchemy import Column, Integer, String, Boolean, DateTime, Enum
from sqlalchemy.sql import func
from app.database.database import Base


class UserRole(str, enum.Enum):
    """Define los roles de usuario válidos."""

    ADMIN = "Admin"
    GESTOR = "Gestor"
    LECTOR = "Lector"


class User(Base):
    """Define el modelo de datos para los usuarios"""

    __tablename__ = "usuarios"

    id = Column(Integer, primary_key=True, index=True)
    email = Column(String, unique=True, index=True, nullable=False)
    name = Column(String, nullable=False)
    surname = Column(String, nullable=False)
    organization = Column(String, nullable=True)
    hashed_password = Column(String, nullable=False)

    # El rol por defecto en la creación de usuarios es "Gestor"
    role = Column(Enum(UserRole), default=UserRole.GESTOR, nullable=False)

    # Control de email de verificación
    is_verified = Column(Boolean, default=False)

    # Token de verificación único para cada usuario, utilizado para el proceso de verificación de email
    verification_token = Column(String, unique=True, index=True, nullable=True)

    # Fecha de control para calcular la caducidad de 24 horas
    created_at = Column(DateTime(timezone=True), server_default=func.now())

    # Recuperación de contraseña
    reset_password_token = Column(String, nullable=True, index=True)
    reset_password_token_expires = Column(DateTime(timezone=True), nullable=True)