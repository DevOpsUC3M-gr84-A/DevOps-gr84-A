"""Este módulo define los servicios relacionados con la gestión de canales RSS."""

from sqlalchemy.exc import IntegrityError
from sqlalchemy.orm import Session
from app.models.rss import RSSChannel
from app.schemas.rss import RSSChannelCreate


def create_rss_channel(db: Session, rss_in: RSSChannelCreate) -> RSSChannel:
    """Crea un nuevo canal RSS en la base de datos.

    Hace rollback explícito en caso de IntegrityError para no dejar la sesión
    en estado roto (lo que provocaba 500 en cascada y logout en el frontend).
    Re-lanza la excepción para que el router la traduzca a 409.
    """
    db_rss = RSSChannel(
        media_name=rss_in.media_name,
        url=str(rss_in.url),
        category_id=rss_in.category_id,
        iptc_category=rss_in.iptc_category,
        is_active=True,
    )

    db.add(db_rss)
    try:
        db.commit()
    except IntegrityError:
        db.rollback()
        raise

    db.refresh(db_rss)
    return db_rss


def get_all_rss_channels(db: Session, skip: int = 0, limit: int = 100):
    """Obtiene todos los canales RSS (útil para Lectores y Gestores)."""
    return db.query(RSSChannel).offset(skip).limit(limit).all()
