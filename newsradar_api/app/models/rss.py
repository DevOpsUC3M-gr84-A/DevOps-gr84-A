"""Este módulo define los modelos de base de datos relacionados con los canales RSS."""

import enum
from sqlalchemy import Boolean, Column, Integer, String, Enum, DateTime, ForeignKey
from sqlalchemy.sql import func
from app.database.database import Base


class CategoriaIPTC(str, enum.Enum):
    """Categorías IPTC principales (Nivel 1) según el estándar MediaTopic."""

    OTROS = "00000000"
    CULTURA = "01000000"
    POLICIA_JUSTICIA = "02000000"
    CATASTROFES_ACCIDENTES = "03000000"
    ECONOMIA = "04000000"
    TECNOLOGIA = "04010000"
    EDUCACION = "05000000"
    MEDIO_AMBIENTE = "06000000"
    SALUD = "07000000"
    INTERES_HUMANO = "08000000"
    MANO_DE_OBRA = "09000000"
    ESTILO_DE_VIDA = "10000000"
    POLITICA = "11000000"
    RELIGION = "12000000"
    CIENCIA = "13000000"
    SOCIEDAD = "14000000"
    DEPORTES = "15000000"
    CONFLICTO_GUERRA_PAZ = "16000000"
    METEOROLOGIA = "17000000"


class RSSChannel(Base):
    """Modelo de base de datos para los canales RSS."""

    __tablename__ = "rss_channels"

    id = Column(Integer, primary_key=True, index=True)
    information_source_id = Column(
        Integer,
        ForeignKey("information_sources.id"),
        nullable=True,
        index=True,
    )
    media_name = Column(String, index=True, nullable=False)
    url = Column(String, unique=True, index=True, nullable=False)
    category_id = Column(Integer, nullable=True)
    iptc_category = Column(Enum(CategoriaIPTC), nullable=False)
    is_active = Column(Boolean, nullable=False, default=True)

    created_at = Column(DateTime(timezone=True), server_default=func.now())


class InformationSource(Base):
    """Modelo de base de datos para las fuentes de informacion."""

    __tablename__ = "information_sources"

    id = Column(Integer, primary_key=True, index=True)
    name = Column(String(120), nullable=False, unique=True, index=True)
    url = Column(String(1000), nullable=False, unique=True)
    created_at = Column(DateTime(timezone=True), server_default=func.now())
