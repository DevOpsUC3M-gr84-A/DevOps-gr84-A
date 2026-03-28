"""Este módulo define los esquemas de datos relacionados con los canales RSS."""

from datetime import datetime
from pydantic import BaseModel, HttpUrl, Field
from app.models.rss import CategoriaIPTC


class RssChannelCreate(BaseModel):
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


class RssChannelResponse(RssChannelCreate):
    """
    Esquema de respuesta para un canal RSS, incluye campos adicionales como ID y fecha de creación.
    """

    id: int
    created_at: datetime

    class Config:
        from_attributes = True
