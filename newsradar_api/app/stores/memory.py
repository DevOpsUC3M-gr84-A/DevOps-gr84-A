"""Almacén en memoria para usuarios y tokens activos"""

from typing import Dict
from app.schemas.user import UserInDB
from app.schemas.roles import Role
from app.schemas.alert import Alert
from app.schemas.notification import Notification
from app.schemas.category import Category
from app.schemas.rss import RSSChannel
from app.schemas.information_sources import InformationSource
from app.schemas.stats import Stats

users_store: Dict[int, UserInDB] = {}
active_tokens: Dict[str, int] = {}
roles_store: Dict[int, Role] = {}
alerts_store: Dict[int, Alert] = {}
categories_store: Dict[int, Category] = {}
notifications_store: Dict[int, Notification] = {}
rss_channels_store: Dict[int, RSSChannel] = {}
information_sources_store: Dict[int, InformationSource] = {}
stats_store: Dict[int, Stats] = {}
