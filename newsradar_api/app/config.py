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
