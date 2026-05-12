# Despliegue y CI/CD — NewsRadar

Este documento describe el ciclo de Integración Continua y Entrega Continua (CI/CD) aplicado en el repositorio, así como el flujo de empaquetado y despliegue.

## 1. Plataforma

El pipeline de CI/CD está implementado sobre **GitHub Actions**. Los workflows residen en [.github/workflows/](../.github/workflows/) y cubren las siguientes etapas:

| Workflow                | Disparador                       | Propósito                                           |
|-------------------------|----------------------------------|-----------------------------------------------------|
| `ci.yml`                | push / pull_request              | Lint, build y validación general del repositorio.   |
| `test.yml`              | push / pull_request              | Ejecución de pruebas unitarias e integración + cobertura. |
| `backend-package.yml`   | push a `main` / release          | Construcción de la imagen Docker del backend FastAPI.|
| `cd-frontend.yml`       | push a `main` / release          | Build y publicación del bundle estático del frontend.|
| `release.yml`           | push de tag `v*`                 | Empaqueta el código (`.tar.gz`), genera `RELEASE_NOTES.txt` y publica una **GitHub Release** con ambos como assets. |

Estos workflows cubren los requisitos **RNF06 (CI)**, **RNF09 (CD)** y **RNF10 (pipeline reproducible)**.

## 2. Etapas del pipeline

### 2.1 Integración Continua (CI)

1. **Checkout** del repositorio.
2. **Configuración de toolchain** (Python 3.11 para el backend, Node 18 para el frontend).
3. **Instalación de dependencias** con caché (`pip` / `npm`).
4. **Linting** (`ruff` / `eslint`).
5. **Pruebas unitarias y de integración**:
   - Backend: `pytest` con plugin de cobertura.
   - Frontend: `vitest` / `react-testing-library`.
6. **Generación de informes de cobertura** (`coverage.xml`, `lcov.info`).

### 2.2 Calidad de código — SonarCloud

Tras la fase de pruebas se ejecuta el análisis estático con **SonarCloud** usando la configuración de [sonar-project.properties](../sonar-project.properties). Se aplica el *Quality Gate* por defecto (cobertura mínima, *bugs*, *vulnerabilities*, *code smells*, duplicación). Esto cubre **RNF08**.

### 2.3 Empaquetado (CD)

- **Backend**: `backend-package.yml` construye una imagen Docker multistage a partir del `Dockerfile` de `newsradar_api/` y la publica en el registry configurado.
- **Frontend**: `cd-frontend.yml` ejecuta `npm run build` y publica el bundle estático.
- **GitHub Releases**: [`release.yml`](../.github/workflows/release.yml) se dispara al hacer push de un tag `v*` (p. ej. `v1.0.0`), empaqueta el código en `newsradar-release-<tag>.tar.gz` (excluyendo `.git`, `.venv`, `__pycache__`, `node_modules`, etc.), genera `RELEASE_NOTES.txt` automáticamente y publica la Release usando `softprops/action-gh-release@v2`.
- Toda la pila puede levantarse con [docker-compose.yml](../docker-compose.yml), cubriendo **RNF04** y **RNF05**.

#### Cómo crear una nueva Release

```bash
git tag v1.0.0
git push origin v1.0.0
```

El workflow `release.yml` adjuntará automáticamente el `.tar.gz` del código fuente y `RELEASE_NOTES.txt` como assets de la Release en GitHub.

### 2.4 Despliegue reproducible (RNF10)

El evaluador puede reproducir el sistema **con un único comando** mediante el script [evaluate.sh](../evaluate.sh) y el [Makefile](../Makefile) de la raíz:

```bash
chmod +x evaluate.sh
make evaluate
# equivalente a: bash evaluate.sh
```

`evaluate.sh` ejecuta de forma encadenada, apoyándose íntegramente en **Docker Compose**:

1. Crea `newsradar_api/.env` desde `.env.example` si no existe.
2. `docker compose down -v --remove-orphans` — limpieza de contenedores y volúmenes previos.
3. `docker compose build` — construcción de las imágenes (backend FastAPI y frontend React/Vite).
4. `docker compose up -d` — arranque en segundo plano de los cuatro servicios: **frontend**, **api-backend**, **postgres** y **elasticsearch**, con seed automático de 100 canales / 10 medios cuando la base de datos está vacía (RF14).
5. Espera activa (`curl http://localhost:8000/docs` y `http://localhost:5173`) hasta que API y frontend responden.
6. `docker compose exec -T api-backend pytest --cov=app --cov-report=html` — ejecuta la suite de pruebas y genera el informe HTML de cobertura dentro del contenedor (RNF07).
7. Impresión en verde de las URLs: Frontend (`:5173`), API (`:8000`) y **Swagger /docs** (`:8000/docs`).

Para iterar en local sin reconstruir imágenes en cada cambio, el flujo de desarrollo combina Docker Compose para los servicios de datos con ejecución nativa de backend y frontend (ver [quickstart.md](quickstart.md), vía B). El entorno completo en modo contenedor se levanta con:

```bash
docker compose up -d --build       # entorno completo dockerizado
docker compose down -v             # apagado y limpieza de volúmenes
```

La suite de pruebas del evaluador puede invocarse de forma independiente sobre un entorno ya levantado mediante:

```bash
docker compose exec -T api-backend pytest --cov=app --cov-report=html
```

## 3. Estrategia de ramas

Detallada en [ADR-005](ADRs/ADR-005-estrategia-ramas.md). En síntesis: `main` protegida, ramas `feature/<id>-<descripcion>`, fusión vía Pull Request con CI verde y revisión.

## 4. Artefactos generados

- **Imagen Docker** del backend (`newsradar-api:<sha>`).
- **Bundle estático** del frontend.
- **Reporte de cobertura** (`htmlcov/`).
- **Documentación MkDocs** publicada (ver [mkdocs.yml](../mkdocs.yml)).

## 5. Variables de entorno

Configuradas como *secrets* en GitHub:

- `SONAR_TOKEN` — autenticación con SonarCloud.
- `DOCKER_REGISTRY_TOKEN` — push de imágenes.
- `DATABASE_URL`, `SMTP_HOST`, `SMTP_PORT` — configuración runtime.
