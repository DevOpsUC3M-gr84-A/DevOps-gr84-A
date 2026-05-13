"""Este módulo define los esquemas de datos relacionados con los canales RSS."""

from typing import Optional
from datetime import datetime
from pydantic import BaseModel, Field, HttpUrl
from app.models.rss import CategoriaIPTC


class RSSChannelBase(BaseModel):
    url: HttpUrl
    category_id: Optional[int] = None


class RSSChannelCreate(RSSChannelBase):
    """Esquema de entrada para crear un nuevo canal RSS."""

    media_name: Optional[str] = Field(
        None,
        description="Nombre del medio de comunicación",
        max_length=150,
    )
    url: HttpUrl = Field(..., description="URL del feed RSS")
    category_id: Optional[int] = Field(
        None, description="ID de categoría (opcional)"
    )
    iptc_category: Optional[CategoriaIPTC] = Field(
        None, description="Categoría IPTC asociada al feed"
    )


class RSSChannelUpdate(BaseModel):
    url: Optional[HttpUrl] = None
    category_id: Optional[int] = None
    iptc_category: Optional[CategoriaIPTC] = None


class RSSChannelResponse(BaseModel):
    """
    Esquema de respuesta para un canal RSS, incluye campos adicionales como ID y fecha de creación.
    Sólo expone campos definidos en el contrato OpenAPI (sin iptc_category ni media_name).
    """

    id: int
    url: HttpUrl
    category_id: Optional[int] = None
    created_at: datetime

    class Config:
        from_attributes = True


class RSSChannel(RSSChannelBase):
    id: int
    information_source_id: int
    media_name: Optional[str] = None
    iptc_category: Optional[CategoriaIPTC] = None

    class Config:
        from_attributes = True
