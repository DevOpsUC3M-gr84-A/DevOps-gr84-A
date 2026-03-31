"""Este módulo define los servicios relacionados con la gestión de canales RSS."""

from sqlalchemy.orm import Session
from app.models.rss import RSSChannel
from app.schemas.rss import RSSChannelCreate


def create_rss_channel(db: Session, rss_in: RSSChannelCreate) -> RSSChannel:
    """Crea un nuevo canal RSS en la base de datos."""
    # Convertir la URL de HttpUrl a string para guardarla en BD
    db_rss = RSSChannel(
        media_name=rss_in.media_name,
        url=str(rss_in.url),
        iptc_category=rss_in.iptc_category,
    )

    db.add(db_rss)
    db.commit()
    db.refresh(db_rss)

    return db_rss


def get_all_rss_channels(db: Session, skip: int = 0, limit: int = 100):
    """Obtiene todos los canales RSS (útil para Lectores y Gestores)."""
    return db.query(RSSChannel).offset(skip).limit(limit).all()
