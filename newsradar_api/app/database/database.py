"""
Este módulo configura la conexión a la base de datos y define la base para los modelos de datos.
"""

from sqlalchemy import create_engine
from sqlalchemy.orm import declarative_base, sessionmaker

DATABASE_URL = "sqlite:///./newsradar.db"

engine = create_engine(
    DATABASE_URL,
    connect_args={"check_same_thread": False}
)

SessionLocal = sessionmaker(autocommit=False, autoflush=False, bind=engine)

Base = declarative_base()

def get_db():
    """Función de dependencia para que FastAPI pueda usar la base de datos fácilmente."""
    db = SessionLocal()
    try:
        yield db
    finally:
        db.close()