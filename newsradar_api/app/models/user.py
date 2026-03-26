"""Este módulo define el modelo de datos para los usuarios."""

import enum
from sqlalchemy import Column, Integer, String, Boolean, DateTime, Enum
from sqlalchemy.sql import func
from app.database.database import Base


class UserRole(str, enum.Enum):
    """Define los roles de usuario válidos."""

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

    # Asumimos que el rol por defecto es "Lector"
    role = Column(Enum(UserRole), default=UserRole.LECTOR, nullable=False)

    # Control de email de verificación
    is_verified = Column(Boolean, default=False)

    # Fecha de control para calcular la caducidad de 24 horas
    created_at = Column(DateTime(timezone=True), server_default=func.now())
