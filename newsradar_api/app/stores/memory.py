"""Almacén en memoria para usuarios y tokens activos"""

from typing import Dict
from app.schemas.user import UserInDB
from app.schemas.roles import Role
from app.schemas.alert import Alert
from app.schemas.notification import Notification

users_store: Dict[int, UserInDB] = {}
active_tokens: Dict[str, int] = {}
roles_store: Dict[int, Role] = {}
alerts_store: Dict[int, Alert] = {}
notifications_store: Dict[int, Notification] = {}
