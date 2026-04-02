# Exponemos todos los modelos aquí para que SQLAlchemy metadata los encuentre fácilmente
from app.models.user import User, UserRole
from app.models.rss import RSSChannel, CategoriaIPTC, InformationSource
from app.models.alert_monitoring import AlertRule
