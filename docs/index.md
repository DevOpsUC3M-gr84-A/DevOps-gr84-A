# NEWSRADAR · Documentación Técnica

[![Build](https://img.shields.io/badge/CI-GitHub_Actions-2088FF?logo=githubactions&logoColor=white)](../.github/workflows/)
[![Quality Gate](https://img.shields.io/badge/Quality-SonarCloud-F3702A?logo=sonarcloud&logoColor=white)](https://sonarcloud.io/)
[![Docs](https://img.shields.io/badge/Docs-MkDocs_Material-526CFE?logo=materialformkdocs&logoColor=white)](https://squidfunk.github.io/mkdocs-material/)

> **NewsRadar** es una plataforma de **vigilancia de noticias** que ingiere fuentes RSS, las clasifica mediante taxonomía **IPTC**, las indexa en **Elasticsearch** y notifica a los usuarios cuando se cumplen las **alertas** que ellos mismos definen. El sistema se diseñó siguiendo una **arquitectura limpia de 5 capas** (RNF01), expone toda su funcionalidad vía **API REST documentada con OpenAPI** (RNF02/RNF03) y se entrega completamente **dockerizado y reproducible con un único comando** (RNF04/RNF10).

---

## 🎯 ¿Qué encontrarás aquí?

Esta documentación está pensada para **tres audiencias** distintas. Salta directamente a lo que te interese:

| Si eres… | Empieza por… |
|---|---|
| 👨‍🏫 **Evaluador / Profesor** | La sección [🚀 Getting Started](#-getting-started--guía-de-evaluación) de abajo — un único comando para levantar todo. |
| 🧑‍💻 **Desarrollador del equipo** | La [Guía de Arranque detallada](quickstart.md) con la vía manual y hot-reload. |
| 🏛️ **Arquitecto / Revisor técnico** | La [Visión de Arquitectura](architecture.md) y las [Decisiones de Arquitectura (ADRs)](ADRs/ADR-001-arquitectura-5-capas.md). |

---

## 🚀 Getting Started · Guía de Evaluación

> **Objetivo:** que un evaluador externo pueda **clonar, levantar y validar el proyecto entero — frontend, backend, base de datos, motor de búsqueda y pruebas con cobertura — en un único comando, sin instalar Python, Node ni PostgreSQL en local.**

### 1. Único prerrequisito

- **Docker Desktop** arrancado (Windows / macOS / Linux).
- No es necesario instalar Python, Node.js, npm ni PostgreSQL.

### 2. Obtener el código

```bash
git clone https://github.com/DevOpsUC3M-gr84-A/DevOps-gr84-A.git
cd DevOps-gr84-A
```

### 3. El comando ÚNICO

```bash
make evaluate
```

> En Windows sin `make`, ejecuta el equivalente directo:
>
> ```bash
> bash evaluate.sh
> ```

Esto, de forma automática:

1. Genera el fichero `.env` por defecto si no existe.
2. Limpia cualquier contenedor o volumen previo.
3. Construye **todas** las imágenes Docker (backend FastAPI **y** frontend React).
4. Levanta los 4 servicios (`frontend`, `api-backend`, `postgres`, `elasticsearch`).
5. **Auto-inyecta 100 canales RSS semilla** de ≥10 medios cubriendo la taxonomía IPTC L1 (RF14).
6. Espera activamente a que la API y el frontend estén `healthy`.
7. Ejecuta **`pytest --cov`** dentro del contenedor y genera el informe HTML.
8. Imprime en verde las URLs listas para usar.

### 4. URLs tras `make evaluate`

| Servicio | URL |
|---|---|
| 🖥️ Frontend (React + Vite) | <http://localhost:5173> |
| ⚙️ API Backend (FastAPI) | <http://localhost:8000> |
| 📖 Swagger / OpenAPI | <http://localhost:8000/docs> |
| 📕 ReDoc | <http://localhost:8000/redoc> |
| 🔍 Elasticsearch | <http://localhost:9200> |
| 📊 Cobertura de pruebas (HTML) | `newsradar_api/htmlcov/index.html` |

### 5. Credenciales por defecto

| Rol | Email | Contraseña |
|---|---|---|
| Administrador | `admin@newsradar.com` | `admin123456` |

### 6. Apagar el entorno

```bash
make down            # equivale a: docker compose down -v
```

!!! success "Reproducibilidad (RNF10)"
    Todo el ciclo arriba descrito está implementado en [evaluate.sh](../evaluate.sh) y orquestado desde el [Makefile](../Makefile). El pipeline de CI/CD ejecuta exactamente la misma secuencia, garantizando paridad entre la evaluación local y la integración continua.

!!! tip "¿Prefieres hot-reload para desarrollar?"
    Consulta la [Guía de Arranque detallada](quickstart.md) (vía B · Desarrollador), donde solo Postgres y Elasticsearch corren en Docker, mientras backend y frontend se ejecutan en local con recarga automática.

---

## 🗺️ Mapa rápido de la documentación

### Arquitectura
- [Visión general de la arquitectura de 5 capas](architecture.md) — RNF01 / RNF02 / RNF03.
- [Despliegue, CI/CD y empaquetado](deployment.md) — RNF06 / RNF08 / RNF09 / RNF10.

### Requisitos y trazabilidad
- [Documento maestro de especificaciones (RF / RNF + Matriz de Trazabilidad)](spec.md) — referencia única consolidada.
- [Registro de Prompts de IA](prompts.md) — trazabilidad de uso de IA generativa (**RNF11**).
- Decisiones fundacionales: [ADR-001 · Arquitectura de 5 Capas](ADRs/ADR-001-arquitectura-5-capas.md) y [ADR-026 · Automatización de Evaluación](ADRs/ADR-026-automatizacion-evaluacion-y-entregas.md).

### Decisiones de Arquitectura (ADRs)
Cada decisión de arquitectura no trivial está documentada como un ADR independiente. Algunas de las más relevantes:

- [ADR-001 · Arquitectura de 5 capas](ADRs/ADR-001-arquitectura-5-capas.md) — fundamento del diseño (RNF01).
- [ADR-002 · Contenedorización con Docker](ADRs/ADR-002-docker.md)
- [ADR-003 · CI con GitHub Actions](ADRs/ADR-003-ci-actions.md)
- [ADR-007 · Análisis estático con SonarCloud](ADRs/ADR-007-sonarcloud.md)
- [ADR-012 · Clasificación IPTC](ADRs/ADR-012-clasificacion-iptc.md)
- [ADR-015 · Migración a Elasticsearch](ADRs/ADR-015-migracion-elasticsearch.md)
- [ADR-024 · FastAPI como framework REST](ADRs/ADR-024-fastapi.md)
- [ADR-026 · Automatización de evaluación y entregas](ADRs/ADR-026-automatizacion-evaluacion-y-entregas.md) — clave para el evaluador (RNF10).
- [ADR-027 · Internacionalización ES/EN](ADRs/ADR-027-internacionalizacion-i18n.md)

> El listado completo (27 ADRs, ADR-001 → ADR-027) está disponible en el menú lateral, bajo **📐 Decisiones de Arquitectura (ADRs)**. El antiguo `ADR-024-internacionalizacion-i18n.md` fue renumerado a **ADR-027** para resolver una colisión con [ADR-024 · FastAPI](ADRs/ADR-024-fastapi.md).

---

## 📦 Estructura del repositorio (resumida)

```text
DevOps-gr84-A/
├── newsradar_api/          # Backend FastAPI (capas 2–4)
├── newsradar_ui/           # Frontend React + Vite (capa 1)
├── docs/                   # Esta documentación (MkDocs)
│   ├── ADRs/               # Decisiones de Arquitectura
│   ├── index.md            # Página que estás leyendo
│   └── prompts.md          # Trazabilidad de IA (RNF11)
├── .github/workflows/      # Pipelines CI/CD
├── docker-compose.yml      # Orquestación local completa
├── evaluate.sh             # Script "1 clic" para evaluador
├── Makefile                # Atajos: make evaluate / make down
└── mkdocs.yml              # Configuración de esta documentación
```

---

## 🤝 Contribuir a la documentación

- **Nuevos ADRs:** crea `docs/ADRs/ADR-XXX-<slug>.md` y añade una línea en el bloque `nav` de [`mkdocs.yml`](../mkdocs.yml).
- **Trazabilidad de IA (RNF11):** copia la plantilla de [`docs/prompts.md`](prompts.md) y rellena tu entrada.
- **Servir la docs en local:**

```bash
pip install mkdocs-material
mkdocs serve   # http://127.0.0.1:8000
```
