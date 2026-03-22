"""
Este módulo configura la conexión a la base de datos y define la base para los modelos de datos.
"""

import os
from sqlalchemy import create_engine
from sqlalchemy.orm import declarative_base, sessionmaker


DATABASE_URL = os.getenv(
    "DATABASE_URL", "postgresql://postgres:postgres@localhost:5432/newsradar"
)

# Crear el motor de la base de datos y la fábrica de sesiones
engine = create_engine(DATABASE_URL)
SessionLocal = sessionmaker(autocommit=False, autoflush=False, bind=engine)

Base = declarative_base()


def get_db():
    """Función de dependencia para que FastAPI pueda usar la base de datos fácilmente."""
    db = SessionLocal()
    try:
        yield db
    finally:
        db.close()
