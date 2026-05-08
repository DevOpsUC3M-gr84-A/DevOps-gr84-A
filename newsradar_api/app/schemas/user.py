from typing import List, Optional

from pydantic import BaseModel, EmailStr, Field, field_validator


def _reject_xss(value: Optional[str]) -> Optional[str]:
    if value is None:
        return value
    if "<" in value or ">" in value:
        raise ValueError("El texto no puede contener los caracteres '<' o '>'")
    return value


def _validate_role_ids(value: Optional[List[int]]) -> Optional[List[int]]:
    if value is not None and len(value) > 1:
        raise ValueError("Máximo un rol permitido")
    return value


def _normalize_email(value):
    if isinstance(value, str):
        return value.lower()
    return value


class UserBase(BaseModel):
    email: EmailStr
    first_name: str = Field(..., min_length=1, max_length=120)
    last_name: str = Field(..., min_length=1, max_length=120)
    organization: str = Field(..., min_length=1, max_length=180)
    role_ids: List[int] = Field(default_factory=list)
    avatar: Optional[str] = None
    banner: Optional[str] = None

    @field_validator("email", mode="before")
    @classmethod
    def _lower_email(cls, value):
        return _normalize_email(value)


class UserCreate(UserBase):
    password: str = Field(..., min_length=6, max_length=128)

    @field_validator("first_name", "last_name", "organization")
    @classmethod
    def _no_xss(cls, value):
        return _reject_xss(value)

    @field_validator("role_ids")
    @classmethod
    def _max_one_role(cls, value):
        return _validate_role_ids(value)

class UserResponse(UserBase):
    id: int
    is_verified: bool
    is_active: bool

    class Config:
        from_attributes = True

class UserUpdate(BaseModel):
    email: Optional[EmailStr] = None
    first_name: Optional[str] = Field(None, min_length=1, max_length=120)
    last_name: Optional[str] = Field(None, min_length=1, max_length=120)
    organization: Optional[str] = Field(None, min_length=1, max_length=180)
    role_ids: Optional[List[int]] = None
    password: Optional[str] = Field(None, min_length=6, max_length=128)
    avatar: Optional[str] = None
    banner: Optional[str] = None

    @field_validator("email", mode="before")
    @classmethod
    def _lower_email(cls, value):
        return _normalize_email(value)

    @field_validator("first_name", "last_name", "organization")
    @classmethod
    def _no_xss(cls, value):
        return _reject_xss(value)

    @field_validator("role_ids")
    @classmethod
    def _max_one_role(cls, value):
        return _validate_role_ids(value)


class User(UserBase):
    id: int
    is_verified: bool = False
    is_active: bool = False


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


class ChangePasswordRequest(BaseModel):
    current_password: str
    new_password: str = Field(..., min_length=8, description="La nueva contraseña debe tener al menos 8 caracteres")
