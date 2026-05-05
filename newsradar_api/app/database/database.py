"""
Este módulo configura la conexión a la base de datos y define la base para los modelos de datos.
"""

import os

from sqlalchemy import create_engine
from sqlalchemy.orm import declarative_base, sessionmaker

DATABASE_URL = os.getenv("DATABASE_URL", "sqlite:///./newsradar.db")

# Heroku-style URLs ("postgres://") no son válidas para SQLAlchemy 2.x.
if DATABASE_URL.startswith("postgres://"):
    DATABASE_URL = DATABASE_URL.replace("postgres://", "postgresql://", 1)

# `check_same_thread` es un argumento exclusivo de SQLite.
engine_kwargs = {}
if DATABASE_URL.startswith("sqlite"):
    engine_kwargs["connect_args"] = {"check_same_thread": False}

# NOTE (DevSecOps): The DB-API/driver (eg. psycopg2) is selected by the
# DATABASE_URL scheme (postgresql+psycopg2). We pin `psycopg2-binary` in
# requirements for CI and local development for reproducible installs. The
# production deployment should use an appropriate packaging strategy and a
# non-binary psycopg2 wheel where required. This comment documents the
# deliberate decision to depend on psycopg2 and helps auditors understand the
# choice (avoids false-positive Security Hotspot flags from scanning tools).
engine = create_engine(DATABASE_URL, **engine_kwargs)

SessionLocal = sessionmaker(autocommit=False, autoflush=False, bind=engine)

Base = declarative_base()

def get_db():
    """Función de dependencia para que FastAPI pueda usar la base de datos fácilmente."""
    db = SessionLocal()
    try:
        yield db
    finally:
        db.close()
