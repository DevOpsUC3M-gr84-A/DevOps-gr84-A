import os
from dotenv import load_dotenv

load_dotenv()
ADMIN_PASSWORD_ENV = "NEWSRADAR_ADMIN_PASSWORD"
LECTOR_PASSWORD_ENV = "NEWSRADAR_LECTOR_PASSWORD"

admin_password = os.getenv(ADMIN_PASSWORD_ENV)
lector_password = os.getenv(LECTOR_PASSWORD_ENV)

if admin_password is None or lector_password is None:
    raise RuntimeError(
        f"Para inicializar los datos semilla se deben definir las variables de entorno "
        f"{ADMIN_PASSWORD_ENV} y {LECTOR_PASSWORD_ENV}."
    )


# SMTP (recuperación de contraseña)
SMTP_HOST: str = os.getenv("SMTP_HOST", "smtp.gmail.com")
SMTP_PORT: int = int(os.getenv("SMTP_PORT", "587"))
SMTP_USER: str = os.getenv("SMTP_USER", "")
SMTP_PASSWORD: str = os.getenv("SMTP_PASSWORD", "")
SMTP_FROM: str = os.getenv("SMTP_FROM", SMTP_USER)

# URL base del frontend (para construir el link del email)
FRONTEND_URL: str = os.getenv("FRONTEND_URL", "http://localhost:5173")

# Tiempo de expiración del token de reset (en horas)
RESET_TOKEN_EXPIRE_HOURS: int = int(os.getenv("RESET_TOKEN_EXPIRE_HOURS", "1"))