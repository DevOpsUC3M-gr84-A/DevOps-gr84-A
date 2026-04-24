from typing import List, Optional
from pydantic import BaseModel, EmailStr, Field


class UserBase(BaseModel):
    email: EmailStr
    first_name: str = Field(..., min_length=1, max_length=120)
    last_name: str = Field(..., min_length=1, max_length=120)
    organization: str = Field(..., min_length=1, max_length=180)
    role_ids: List[int] = Field(default_factory=list)


class UserCreate(UserBase):
    password: str = Field(..., min_length=6, max_length=128)

class UserResponse(UserBase):
    id: int
    is_verified: bool

    class Config:
        from_attributes = True

class UserUpdate(BaseModel):
    email: Optional[EmailStr] = None
    first_name: Optional[str] = Field(None, min_length=1, max_length=120)
    last_name: Optional[str] = Field(None, min_length=1, max_length=120)
    organization: Optional[str] = Field(None, min_length=1, max_length=180)
    role_ids: Optional[List[int]] = None
    password: Optional[str] = Field(None, min_length=6, max_length=128)


class User(UserBase):
    id: int


class UserInDB(User):
    password: str

class TokenVerification(BaseModel):
    token: str


class UserListItem(BaseModel):
    """Esquema para listar usuarios (solo Admin)."""
    id: int
    email: str
    first_name: str
    last_name: str
    role_ids: List[int]

    class Config:
        from_attributes = True


class UpdateUserRoleRequest(BaseModel):
    """Esquema para actualizar el rol de un usuario."""
    role_id: int = Field(..., description="ID del nuevo rol (1=Gestor, 2=Lector, 3=Admin)")
