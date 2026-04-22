from pydantic import BaseModel, EmailStr, Field


class LoginRequest(BaseModel):
    email: EmailStr
    password: str


class TokenResponse(BaseModel):
    access_token: str
    token_type: str = "bearer"
    user_id: int
    role_ids: list[int]

#  Recuperación de contraseña

class ForgotPasswordRequest(BaseModel):
    """Payload para solicitar el enlace de recuperación de contraseña."""
    email: EmailStr


class ResetPasswordRequest(BaseModel):
    """Payload para establecer la nueva contraseña usando el token recibido por email."""
    token: str = Field(..., min_length=1)
    new_password: str = Field(..., min_length=6, max_length=128)


class MessageResponse(BaseModel):
    """Respuesta genérica con un mensaje informativo."""
    message: str