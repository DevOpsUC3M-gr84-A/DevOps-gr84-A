# Guía de Arranque: NewsRadar

Este proyecto admite **dos vías de ejecución** claramente diferenciadas. Elige la que corresponda a tu rol:

| Vía | Para quién | Tiempo de setup | Servicios en Docker |
|-----|------------|-----------------|---------------------|
| **A. Evaluador (1 clic)** | Profesorado, corrección | ~3–5 min | **TODO**: frontend + backend + Postgres + Elasticsearch |
| **B. Desarrollador (manual)** | Equipo de desarrollo | ~10 min | Solo Postgres + Elasticsearch (back y front en local con hot-reload) |

Ambas vías se apoyan en **Docker Compose** ([docker-compose.yml](../docker-compose.yml)) y en el script de evaluación automatizada `evaluate.sh` (envuelto por el `Makefile`), que orquesta el ciclo completo de construcción, arranque y ejecución de la suite de pruebas.

---

## A. Para el Evaluador: Ejecución en 1 Clic (RNF10)

> **Único requisito previo:** tener **Docker Desktop** arrancado.
> **No hace falta** instalar Python, Node.js, npm ni PostgreSQL en local. Todo — incluido el **frontend** — está dockerizado.

### Pasos desde cero

**1. Obtener el código** (descomprimir la release o clonar el repo):

```bash
# Opción A — release empaquetada
tar -xzf DevOps-gr84-A-v*.tar.gz && cd DevOps-gr84-A-*

# Opción B — clonar
git clone https://github.com/DevOpsUC3M-gr84-A/DevOps-gr84-A.git
cd DevOps-gr84-A
```

**2. Ejecutar la evaluación con un único comando:**

```bash
make evaluate            # Linux / macOS / WSL
# En Windows con Git Bash:
bash evaluate.sh
```

**Qué hace este comando** (ver [evaluate.sh](../evaluate.sh)):

1. Crea `newsradar_api/.env` desde `.env.example` si no existe.
2. Limpia contenedores y volúmenes previos (`docker compose down -v --remove-orphans`).
3. Construye **todas** las imágenes Docker — backend FastAPI **y frontend React/Vite**.
4. Levanta los 4 servicios: `frontend`, `api-backend`, `postgres`, `elasticsearch`.
5. El backend, al arrancar, **autoinyecta los 100 canales RSS semilla** de ≥10 medios cubriendo IPTC L1 (RF14) si la base está vacía.
6. Espera activamente a que API y frontend respondan en sus puertos.
7. Ejecuta `pytest --cov=app --cov-report=html` dentro del contenedor del backend.
8. Imprime las URLs en verde.

**3. Apagar el entorno cuando se termine:**

```bash
make down                # equivale a: docker compose down -v
```

### URLs tras la ejecución

| Servicio | URL |
|----------|-----|
| Frontend (React + Vite, dockerizado) | http://localhost:5173 |
| API Backend (FastAPI)                | http://localhost:8000 |
| Swagger / OpenAPI                    | http://localhost:8000/docs |
| ReDoc                                | http://localhost:8000/redoc |
| Elasticsearch                        | http://localhost:9200 |

**Cobertura HTML:** `newsradar_api/htmlcov/index.html` (montado desde el contenedor al host vía bind-mount; se abre directamente en el navegador).
**Credenciales por defecto:** `admin@newsradar.com` / `admin123456`.

---

## B. Para el Desarrollador: Ejecución Manual (hot-reload)

Esta vía está pensada para el **trabajo diario del equipo**: editar código Python o React y ver los cambios al instante sin reconstruir la imagen Docker. La diferencia clave frente a la vía A es que **solo la base de datos corre en Docker**; backend y frontend se ejecutan nativamente sobre tu máquina.

### B.0 Dependencias previas

- **Docker Desktop** (para Postgres y Elasticsearch).
- **Python 3.11+**.
- **Node.js 20+** y **npm**.
- **Git**.

### B.1 Variables de entorno

Crea tu fichero `newsradar_api/.env` con SMTP (Gmail / MailHog) y secretos de admin/lector. Para esta vía manual **sí** debes definir `DATABASE_URL` apuntando a `localhost` (en la vía A, el contenedor del backend la recibe automáticamente apuntando al host `postgres`):

```
DATABASE_URL=postgresql://newsradar_user:newsradar_password@localhost:5432/newsradar_db
```

### B.2 Levantar solo la base de datos en Docker

Desde la raíz del repo, arranca **únicamente** los servicios de datos:

```bash
docker compose up -d postgres elasticsearch
```

Esto levanta `newsradar_postgres` (puerto 5432) y `newsradar_elasticsearch` (puerto 9200). El backend y el frontend los lanzarás tú a mano.

### B.3 Backend FastAPI con `.venv` y `uvicorn --reload`

```bash
cd newsradar_api

# 1) Crear el entorno virtual
python -m venv .venv

# 2) Activarlo
source .venv/bin/activate          # Linux / macOS / WSL
# .venv\Scripts\Activate.ps1       # Windows PowerShell
# .venv\Scripts\activate.bat       # Windows CMD

# 3) Instalar dependencias
pip install --upgrade pip
pip install -r requirements.txt
pip install -r requirements-dev.txt   # opcional: pytest, linters, herramientas dev

# 4) Arrancar el servidor con recarga automática
uvicorn app.main:app --reload --host 0.0.0.0 --port 8000
```

Cada vez que guardes un `.py`, `uvicorn` recargará automáticamente. La API queda disponible en http://localhost:8000 y la documentación Swagger en http://localhost:8000/docs.

### B.4 Frontend React + Vite

En **otra terminal**, sin cerrar el backend:

```bash
cd newsradar_ui
npm install               # solo la primera vez
npm run dev
```

Vite arranca con HMR (Hot Module Replacement) en http://localhost:5173. Está preconfigurado para llamar al backend en `http://localhost:8000`.

### B.5 Mapa de servicios (vía manual)

| Servicio          | Dónde corre              | URL                                       |
|-------------------|--------------------------|-------------------------------------------|
| Frontend (Vite)   | Local (`npm run dev`)    | http://localhost:5173                     |
| Backend API       | Local (`uvicorn`)        | http://localhost:8000                     |
| Swagger / OpenAPI | Local                    | http://localhost:8000/docs                |
| ReDoc             | Local                    | http://localhost:8000/redoc               |
| Elasticsearch     | Docker                   | http://localhost:9200                     |
| PostgreSQL        | Docker                   | localhost:5432 (`newsradar_db`)           |

### B.6 Ejecutar pruebas (vía manual)

```bash
# Backend (con .venv activado)
cd newsradar_api
pytest --cov=app --cov-report=term-missing --cov-report=html

# Frontend
cd newsradar_ui
npm test
```

### B.7 Apagar la base de datos

```bash
docker compose down            # mantiene volúmenes
docker compose down -v         # borra también postgres_data y elasticsearch_data
```

---

## ¿Qué vía debo usar?

- ¿Vas a **corregir** o evaluar el proyecto sin tocar código? → **Vía A (Evaluador)**.
- ¿Vas a **modificar** código Python o React y quieres iteración rápida? → **Vía B (Desarrollador)**.
- ¿Quieres comprobar que todo el sistema arranca como en producción? → **Vía A**.

**Credenciales de administrador por defecto:** `admin@newsradar.com` / `admin123456`.
