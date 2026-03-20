# NewsRadar API

API REST construida con FastAPI, versionada bajo `/api/v1`, con autenticación por usuario/contraseña y documentación OpenAPI.

## Requisitos

- Python 3.10+

## Instalación

```bash
python -m venv .venv
source .venv/bin/activate
pip install -r requirements.txt
```

## Ejecución

```bash
uvicorn app.main:app --reload
```

## Documentación

- Swagger UI: `http://127.0.0.1:8000/docs`
- OpenAPI JSON: `http://127.0.0.1:8000/openapi.json`

## Autenticación

1. Usuario semilla en arranque:
  - email: `admin@newsradar.com`
   - password: `admin123`
2. Obtener token en `POST /api/v1/auth/login`
3. Usar el token como `Bearer <token>` en el header `Authorization`.
1. Usuario semilla en el web:
  - email: `admin@newsradar.ai`
   - password: `admin123`
## Flujo de URLs

- Usuario → Alertas:
  - `/api/v1/users/{user_id}/alerts`
- Alertas → Notificaciones:
  - `/api/v1/users/{user_id}/alerts/{alert_id}/notifications`
- Fuente de información → Canales RSS:
  - `/api/v1/information-sources/{source_id}/rss-channels`

## Entidades con CRUD

- Usuarios
- Roles
- Alertas
- Categorías
- Notificaciones
- Fuentes de información
- Canales RSS
- Stats
