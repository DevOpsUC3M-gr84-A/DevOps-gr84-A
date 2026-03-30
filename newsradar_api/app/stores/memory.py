from typing import Dict
from app.schemas.user import UserInDB

# Diccionarios en memoria para usuarios y tokens activos
users_store: Dict[int, UserInDB] = {}
active_tokens: Dict[str, int] = {}

# Diccionario en memoria para roles
roles_store: Dict[int, any] = {}
