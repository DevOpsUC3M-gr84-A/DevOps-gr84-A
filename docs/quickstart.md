# 🚀 Guía de Desarrollo Local: NewsRadar (Backend + Frontend)

Con la nueva integración de Docker, el backend ahora vive en una caja autosuficiente: ya no necesitas instalar Python ni PostgreSQL en tu máquina para arrancarlo.

## 🛠️ 1. Dependencias Previas

- **Docker Desktop** (imprescindible — levanta backend, PostgreSQL y Elasticsearch).
- **Node.js / npm** (para el frontend con Vite).
- **Git**.

## 🐍 2. ¿Necesito el entorno virtual (`.venv`)?

- **Para EJECUTAR el backend: NO.** La imagen Docker ya lleva Python 3.11 y todas las dependencias.
- **Para PROGRAMAR (Opcional): Sí**, conviene crear un `.venv` con `pip install -r requirements.txt` para que VS Code / Pylance den autocompletado y type-checking sobre las librerías.

## 🏃‍♂️ 3. Pasos para levantar el proyecto

### 3.1 Configurar variables de entorno

Crea tu fichero `newsradar_api/.env` local con los datos de SMTP (Gmail / MailHog / etc.) y los secretos de admin/lector. **No hace falta definir `DATABASE_URL`**: el `docker-compose.yml` ya inyecta la URL de PostgreSQL apuntando al contenedor `postgres`:

```
DATABASE_URL=postgresql://newsradar_user:newsradar_password@postgres:5432/newsradar_db
```

### 3.2 Levantar el backend (FastAPI + PostgreSQL + Elasticsearch)

Desde la raíz del repositorio:

```bash
docker compose up -d --build
```

Esto construye la imagen del backend y arranca tres contenedores: `newsradar_backend_container`, `newsradar_postgres` y `newsradar_elasticsearch`.

### 3.3 Levantar el frontend

En otra terminal:

```bash
cd newsradar_ui
npm install
npm run dev
```

## 🗺️ 4. ¿Dónde está todo ahora?

| Servicio          | URL                                              |
|-------------------|--------------------------------------------------|
| Frontend (Vite)   | http://localhost:5173                            |
| Backend API       | http://localhost:8000                            |
| Swagger / OpenAPI | http://localhost:8000/docs                       |
| ReDoc             | http://localhost:8000/redoc                      |
| Elasticsearch     | http://localhost:9200                            |
| PostgreSQL        | localhost:5432 (`newsradar_db`)                  |

Para inspeccionar los logs en vivo del backend:

```bash
docker logs -f newsradar_backend_container
```

## 🛑 5. Cómo apagar

```bash
docker compose down
```

Añade `-v` si quieres borrar también los volúmenes (`postgres_data`, `elasticsearch_data`) y empezar desde cero.

## 6. Ejecutar pruebas

```bash
# Backend (dentro del .venv local o vía docker exec)
cd newsradar_api
pytest --cov=app --cov-report=term-missing

# Frontend
cd newsradar_ui
npm test
```

**Credenciales de administrador por defecto:** `admin@newsradar.com` / `admin123456`.
