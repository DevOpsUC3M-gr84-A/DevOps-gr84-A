"""
Este módulo configura la conexión a la base de datos y define la base para los modelos de datos.
"""

import os
from sqlalchemy import create_engine
from sqlalchemy.orm import declarative_base, sessionmaker

# 1. Obtenemos la ruta absoluta de la carpeta donde está este archivo (database.py)
# 2. Subimos dos niveles para llegar a la raíz de la carpeta 'newsradar_api'
BASE_DIR = os.path.dirname(os.path.dirname(os.path.dirname(os.path.abspath(__file__))))
DB_PATH = os.path.join(BASE_DIR, "newsradar.db")

# Forzamos la URL para que apunte SIEMPRE al archivo físico en la raíz
DATABASE_URL = f"sqlite:///{DB_PATH}"

# Crear el motor de la base de datos con la ruta absoluta
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