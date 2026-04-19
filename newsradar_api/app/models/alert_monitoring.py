"""Modelos persistentes para monitorizacion de alertas detectadas."""

from sqlalchemy import JSON, Boolean, Column, DateTime, ForeignKey, Integer, String
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
    rss_channel_ids = Column(JSON, nullable=False, default=list)  # RF07: RSS channels for alert
    cron_expression = Column(String(120), nullable=False)
    is_active = Column(Boolean, nullable=False, default=True)

    created_at = Column(DateTime(timezone=True), server_default=func.now())
    updated_at = Column(DateTime(timezone=True), server_default=func.now(), onupdate=func.now())
    last_checked_at = Column(DateTime(timezone=True), nullable=True)
