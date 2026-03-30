"""Almacén en memoria para usuarios y tokens activos"""

from typing import Dict
from app.schemas.user import UserInDB

users_store: Dict[int, UserInDB] = {}
active_tokens: Dict[str, int] = {}
roles_store: Dict[int, any] = {}
