"""Modelos persistentes para monitorizacion de alertas y noticias detectadas."""

from sqlalchemy import (
    JSON,
    Boolean,
    Column,
    DateTime,
    ForeignKey,
    Integer,
    String,
    Text,
    UniqueConstraint,
)
from sqlalchemy.sql import func

from app.database.database import Base


class AlertRule(Base):
    """Alerta persistida para ser evaluada por el monitor periodico."""

    __tablename__ = "alert_rules"

    id = Column(Integer, primary_key=True, index=True)
    user_id = Column(Integer, ForeignKey("usuarios.id"), nullable=False, index=True)
    name = Column(String(200), nullable=False)
    descriptors = Column(JSON, nullable=False, default=list)
    categories = Column(JSON, nullable=False, default=list)
    cron_expression = Column(String(120), nullable=False)
    is_active = Column(Boolean, nullable=False, default=True)

    created_at = Column(DateTime(timezone=True), server_default=func.now())
    updated_at = Column(DateTime(timezone=True), server_default=func.now(), onupdate=func.now())
    last_checked_at = Column(DateTime(timezone=True), nullable=True)


class Article(Base):
    """Noticia detectada por una alerta y persistida antes de clasificacion."""

    __tablename__ = "articles"
    __table_args__ = (
        UniqueConstraint("alert_id", "url", name="uq_articles_alert_id_url"),
    )

    id = Column(Integer, primary_key=True, index=True)
    alert_id = Column(Integer, ForeignKey("alert_rules.id"), nullable=False, index=True)
    rss_channel_id = Column(Integer, ForeignKey("rss_channels.id"), nullable=False, index=True)

    title = Column(String(500), nullable=False)
    summary = Column(Text, nullable=True)
    content = Column(Text, nullable=True)
    url = Column(String(1000), nullable=False)
    published_at = Column(DateTime(timezone=True), nullable=True)

    source = Column(String(255), nullable=False)
    is_classified = Column(Boolean, nullable=False, default=False)

    created_at = Column(DateTime(timezone=True), server_default=func.now())
    updated_at = Column(DateTime(timezone=True), server_default=func.now(), onupdate=func.now())
