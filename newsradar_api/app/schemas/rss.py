"""Este módulo define los esquemas de datos relacionados con los canales RSS."""

from typing import Optional
from datetime import datetime
from pydantic import BaseModel, Field, HttpUrl
from app.models.rss import CategoriaIPTC


class RSSChannelBase(BaseModel):
    url: HttpUrl
    category_id: int


class RSSChannelCreate(RSSChannelBase):
    """Esquema de entrada para crear un nuevo canal RSS."""

    media_name: str = Field(
        ...,
        description="Nombre del medio de comunicación",
        min_length=2,
        max_length=150,
    )
    url: HttpUrl = Field(..., description="URL del feed RSS")
    iptc_category: CategoriaIPTC = Field(
        ..., description="Categoría IPTC asociada al feed"
    )


class RSSChannelUpdate(BaseModel):
    url: Optional[HttpUrl] = None
    category_id: Optional[int] = None
    iptc_category: Optional[CategoriaIPTC] = None


class RSSChannelResponse(RSSChannelCreate):
    """
    Esquema de respuesta para un canal RSS, incluye campos adicionales como ID y fecha de creación.
    """

    id: int
    created_at: datetime

    class Config:
        from_attributes = True


class RSSChannel(RSSChannelBase):
    id: int
    information_source_id: int
    media_name: str
    iptc_category: CategoriaIPTC

    class Config:
        from_attributes = True
