from sqlalchemy import Column, Integer, String, DateTime, Boolean, ForeignKey
from sqlalchemy.sql import func
from app.database.database import Base


class Notification(Base):
    __tablename__ = "notifications"

    id = Column(Integer, primary_key=True, index=True)
    user_id = Column(Integer, ForeignKey("usuarios.id"), nullable=True, index=True)
    alert_id = Column(Integer, ForeignKey("alert_rules.id"), nullable=False, index=True)
    article_url = Column(String(2000), nullable=False)
    title = Column(String(500), nullable=True)
    message = Column(String(2000), nullable=True)
    created_at = Column(DateTime(timezone=True), server_default=func.now())
    is_read = Column(Boolean, nullable=False, default=False)
