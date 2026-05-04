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
- Toda la pila puede levantarse con [docker-compose.yml](../docker-compose.yml), cubriendo **RNF04** y **RNF05**.

### 2.4 Despliegue reproducible (RNF10)

El evaluador puede reproducir el sistema con un único comando:

```bash
docker compose up --build
```

Esto construye, siembra los datos (100 canales / 10 medios) y arranca todos los servicios.

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
