"""Este módulo define los modelos de base de datos relacionados con los canales RSS."""

import enum
from sqlalchemy import Column, Integer, String, Enum, DateTime
from sqlalchemy.sql import func
from app.database.database import Base


class CategoriaIPTC(str, enum.Enum):
    """Categorías IPTC principales según el estándar estándar para noticias."""

    POLITICA = "11000000"
    ECONOMIA = "04000000"
    DEPORTES = "15000000"
    TECNOLOGIA = "04010000"
    CULTURA = "01000000"
    SALUD = "07000000"
    MEDIO_AMBIENTE = "06000000"
    CIENCIA = "13000000"
    OTROS = "00000000"


class RSSChannel(Base):
    """Modelo de base de datos para los canales RSS."""

    __tablename__ = "rss_channels"

    id = Column(Integer, primary_key=True, index=True)
    media_name = Column(String, index=True, nullable=False)
    url = Column(String, unique=True, index=True, nullable=False)
    iptc_category = Column(Enum(CategoriaIPTC), nullable=False)

    created_at = Column(DateTime(timezone=True), server_default=func.now())
