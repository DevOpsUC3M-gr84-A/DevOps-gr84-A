# 🚀 Guía de Desarrollo Local: NewsRadar (Backend + Frontend)

Con la nueva integración de Docker, el backend ahora vive en una caja autosuficiente: ya no necesitas instalar Python ni PostgreSQL en tu máquina para arrancarlo.

---

## 👨‍🏫 Para el Evaluador: Ejecución en 1 Clic (RNF10)

> **Único requisito previo:** tener **Docker Desktop** arrancado. No hace falta Python, Node ni PostgreSQL en local.

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

**Qué hace este comando:** levanta Docker (backend FastAPI + PostgreSQL + Elasticsearch) e inyecta los **100 canales RSS semilla**.
Después ejecuta `pytest` con cobertura HTML dentro del contenedor del backend y, al finalizar, imprime las URLs de la aplicación (Frontend, API y Swagger).

**3. Apagar el entorno cuando se termine:**

```bash
make down                # equivale a: docker compose down -v
```

**URLs tras la ejecución:** Frontend → http://localhost:5173 · API → http://localhost:8000 · Swagger → http://localhost:8000/docs.
*El frontend también está dockerizado: no necesitas Node.js instalado en local.*
**Cobertura HTML:** `newsradar_api/htmlcov/index.html`.
**Credenciales por defecto:** `admin@newsradar.com` / `admin123456`.

---

## 🛠️ 1. Dependencias Previas

- **Docker Desktop** (imprescindible — levanta backend, PostgreSQL y Elasticsearch).
- **Node.js / npm** (para el frontend con Vite).
- **Git**.

## 🐍 2. ¿Necesito el entorno virtual (`.venv`)?

- **Para EJECUTAR el backend: NO.** La imagen Docker ya lleva Python 3.11 y todas las dependencias.
- **Para PROGRAMAR (Opcional): Sí**, conviene crear un `.venv` con `pip install -r requirements.txt` para que VS Code / Pylance den autocompletado y type-checking sobre las librerías.

> Si sólo necesitas **corregir** el proyecto, usa la sección [👨‍🏫 Para el Evaluador](#-para-el-evaluador-ejecución-en-1-clic-rnf10) al inicio de esta guía. El resto de esta página es para desarrollo iterativo.

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
