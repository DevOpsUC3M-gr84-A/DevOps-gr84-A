# Inicio Rápido — NewsRadar

Esta guía describe cómo levantar el sistema completo en un entorno local de desarrollo.

## Requisitos previos

- **Python 3.11+** con `pip` y `venv`.
- **Node.js 18+** con `npm`.
- **Docker** y **Docker Compose** (para PostgreSQL y MailHog).
- **Git**.

## 1. Clonar el repositorio

```bash
git clone https://github.com/DevOpsUC3M-gr84-A/DevOps-gr84-A.git
cd DevOps-gr84-A
```

## 2. Servicios auxiliares (PostgreSQL + MailHog)

Levanta los servicios de infraestructura mediante Docker Compose:

```bash
docker compose up -d postgres mailhog
```

Esto expone:

- **PostgreSQL** en `localhost:5432` (base de datos `newsradar`).
- **MailHog SMTP** en `localhost:1025`.
- **MailHog Web UI** en [http://localhost:8025](http://localhost:8025).

## 3. Backend — FastAPI (puerto 8000)

```bash
cd newsradar_api
python -m venv .venv
# Windows
.venv\Scripts\activate
# Linux / macOS
source .venv/bin/activate

pip install -r requirements.txt
uvicorn app.main:app --reload --port 8000
```

Endpoints relevantes:

- **API REST**: [http://localhost:8000](http://localhost:8000)
- **Swagger UI (OpenAPI)**: [http://localhost:8000/docs](http://localhost:8000/docs)
- **ReDoc**: [http://localhost:8000/redoc](http://localhost:8000/redoc)

En el primer arranque, el backend siembra la base de datos con los 100+ canales RSS y crea el usuario administrador inicial.

**Credenciales de administrador por defecto:** `admin@newsradar.com` / `admin123456`.

## 4. Frontend — React + Vite (puerto 5173)

En otra terminal:

```bash
cd newsradar_ui
npm install
npm run dev
```

Accede a la SPA en [http://localhost:5173](http://localhost:5173).

## 5. Verificación de notificaciones

Las notificaciones por email del flujo RF10 se entregan al servidor SMTP de MailHog. Puedes inspeccionarlas desde su interfaz web en [http://localhost:8025](http://localhost:8025).

## 6. Resumen de puertos

| Servicio       | URL                                              |
|----------------|--------------------------------------------------|
| Frontend (Vite)| http://localhost:5173                            |
| Backend API    | http://localhost:8000                            |
| Swagger / OpenAPI | http://localhost:8000/docs                    |
| MailHog UI     | http://localhost:8025                            |
| PostgreSQL     | localhost:5432                                   |

## 7. Ejecutar pruebas

```bash
# Backend
cd newsradar_api
pytest --cov=app --cov-report=term-missing

# Frontend
cd newsradar_ui
npm test
```
