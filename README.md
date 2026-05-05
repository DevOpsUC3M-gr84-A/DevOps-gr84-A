# NewsRadar — DevOps Grupo 84-A

[![CI/CD Pipeline](https://img.shields.io/badge/CI%2FCD-GitHub_Actions-blue.svg)](.github/workflows/)
[![Quality Gate](https://img.shields.io/badge/SonarQube-Passed_A-success.svg)](https://sonarcloud.io/)
[![Coverage](https://img.shields.io/badge/Coverage->80%25-brightgreen.svg)](htmlcov/)
[![License: MIT](https://img.shields.io/badge/License-MIT-yellow.svg)](LICENSE)

Sistema avanzado de **monitorización de noticias** sobre canales RSS, con clasificación basada en IA siguiendo el estándar **IPTC Media Topics**, **alertas configurables**, **notificaciones** por email y buzón interno, y **deduplicación** de contenidos. Proyecto final de la asignatura *Desarrollo y Operación de Sistemas Software* (UC3M, Grado en Ingeniería Informática, curso 2025/2026).

---

## Índice

- [Descripción](#descripción)
- [Inicio Rápido](#inicio-rápido)
- [APIs disponibles](#apis-disponibles)
- [Arquitectura](#arquitectura)
- [Documentación](#documentación)
- [Trazabilidad de Requisitos](#trazabilidad-de-requisitos)
- [Licencia y Equipo](#licencia-y-equipo)

---

## Descripción

NewsRadar permite a *Gestores* y *Lectores* (RF15) escuchar **canales RSS** de medios de comunicación, organizar la información en **categorías IPTC**, y monitorizar **palabras clave** mediante alertas configurables. Cuando se detecta una noticia que coincide con una alerta:

- El sistema **clasifica** la noticia mediante un workflow de IA (RF04, RF08).
- **Deduplica** apariciones repetidas.
- **Notifica** al usuario por correo electrónico y/o buzón interno (RF09–RF12).

El sistema cumple los requisitos arquitectónicos exigidos: 5 capas (RNF01), API REST documentada con OpenAPI (RNF02–RNF03), Docker (RNF04–RNF05), CI/CD con SonarCloud (RNF06–RNF09) y pipeline reproducible (RNF10).

---

## Inicio Rápido

Guía completa en [docs/quickstart.md](docs/quickstart.md).

### Evaluación con un único comando (RNF10)

```bash
git clone https://github.com/DevOpsUC3M-gr84-A/DevOps-gr84-A.git
cd DevOps-gr84-A
chmod +x evaluate.sh
make evaluate          # equivalente a: bash evaluate.sh
```

El script [evaluate.sh](evaluate.sh) limpia contenedores previos, construye las imágenes, arranca los servicios (con los **100 canales RSS semilla**), espera a que la API esté lista, ejecuta `pytest` con cobertura HTML dentro del contenedor del backend e imprime las URLs de la aplicación y de Swagger.

### Arranque manual (desarrollo)

```bash
docker compose up -d --build
```

Esto levanta el **backend FastAPI**, **PostgreSQL 15** y **Elasticsearch** de forma autocontenida.

**Frontend (React + Vite, puerto 5173):**

```bash
cd newsradar_ui
npm install
npm run dev
```

| Servicio          | URL                                        |
|-------------------|--------------------------------------------|
| Frontend (Vite)   | http://localhost:5173                      |
| API Backend       | http://localhost:8000                      |
| Swagger / OpenAPI | http://localhost:8000/docs                 |
| Elasticsearch     | http://localhost:9200                      |
| PostgreSQL        | localhost:5432                             |

**Credenciales por defecto:** `admin@newsradar.com` / `admin123456`.

---

## APIs disponibles

Todos los routers están en [newsradar_api/app/api/routes/](newsradar_api/app/api/routes/) y la documentación interactiva se publica en `/docs`.

| Router | Archivo | Descripción |
|--------|---------|-------------|
| **auth** | [auth.py](newsradar_api/app/api/routes/auth.py) | Login, logout, refresh, verificación de email (24h) y recuperación de contraseña. |
| **users** | [users.py](newsradar_api/app/api/routes/users.py) | Gestión de usuarios, perfiles y administración. |
| **roles** | [roles.py](newsradar_api/app/api/routes/roles.py) | Gestión de roles y RBAC (Gestor / Lector). |
| **alerts** | [alerts.py](newsradar_api/app/api/routes/alerts.py) | CRUD de alertas, configuración de canales y modo de notificación. |
| **rss_channels** | [rss_channels.py](newsradar_api/app/api/routes/rss_channels.py) | Gestión de canales RSS y asociación con medios y categorías IPTC. |
| **information_sources** | [information_sources.py](newsradar_api/app/api/routes/information_sources.py) | Gestión de medios de comunicación / fuentes. |
| **categories** | [categories.py](newsradar_api/app/api/routes/categories.py) | Catálogo IPTC Media Topics. |
| **notifications** | [notifications.py](newsradar_api/app/api/routes/notifications.py) | Buzón interno y entrega de notificaciones. |
| **dashboard** | [dashboard.py](newsradar_api/app/api/routes/dashboard.py) | Datos agregados para el panel: nube de palabras y métricas. |
| **stats** | [stats.py](newsradar_api/app/api/routes/stats.py) | Estadísticas globales (nº fuentes, noticias, alertas por categoría). |

---

## Arquitectura

Arquitectura de **5 capas** (detalle en [docs/architecture.md](docs/architecture.md)):

| Capa | Tecnología | Localización |
|------|------------|--------------|
| 1. Presentación (UI) | React + TypeScript + Vite | [newsradar_ui/src](newsradar_ui/src/) |
| 2. API REST | FastAPI + OpenAPI 3.1 | [newsradar_api/app/api](newsradar_api/app/api/) |
| 3. Lógica de Negocio | Servicios + Agentes asíncronos | [newsradar_api/app/services](newsradar_api/app/services/) |
| 4. Persistencia | SQLAlchemy 2.x | [newsradar_api/app/models](newsradar_api/app/models/), [newsradar_api/app/stores](newsradar_api/app/stores/) |
| 5. Datos | PostgreSQL 15 | [docker-compose.yml](docker-compose.yml) |

---

## Documentación

| Recurso | Descripción |
|---------|-------------|
| [docs/quickstart.md](docs/quickstart.md) | Guía de arranque local. |
| [docs/architecture.md](docs/architecture.md) | Arquitectura de 5 capas y componentes. |
| [docs/deployment.md](docs/deployment.md) | CI/CD, SonarCloud y empaquetado Docker. |
| [docs/spec.md](docs/spec.md) | Especificación funcional. |
| [docs/prompts.md](docs/prompts.md) | Trazabilidad de prompts IA (RNF11). |
| [docs/requirements/](docs/requirements/) | Catálogo CSV de requisitos. |
| [docs/ADRs/](docs/ADRs/) | Decisiones arquitectónicas (ADR-001 a ADR-025). |

---

## Trazabilidad de Requisitos

Tabla cruzada entre los requisitos de [docs/requirements/requirements.csv](docs/requirements/requirements.csv) y los módulos / pruebas que los implementan y validan.

### Requisitos Funcionales

| Issue | RF | Descripción | Implementación | Test |
|------:|----|-------------|----------------|------|
| #14  | **RF01** | Monitorización cron de alertas e ingesta de noticias. | [services/agents/alert_monitor_agent.py](newsradar_api/app/services/agents/alert_monitor_agent.py), [services/alert_monitoring_service.py](newsradar_api/app/services/alert_monitoring_service.py) | [tests/unit/test_alert_monitor_agent.py](newsradar_api/tests/unit/test_alert_monitor_agent.py), [test_scheduler.py](newsradar_api/tests/unit/test_scheduler.py) |
| #15  | **RF02** | Alta de alertas por Gestor con nombre y palabra clave. | [api/routes/alerts.py](newsradar_api/app/api/routes/alerts.py), [services/alert_monitoring_service.py](newsradar_api/app/services/alert_monitoring_service.py) | [tests/integration/test_alerts_api.py](newsradar_api/tests/integration/test_alerts_api.py), [test_alerts_service.py](newsradar_api/tests/unit/test_alerts_service.py) |
| #16  | **RF03** | Máximo de 20 alertas por Gestor. | [services/alert_monitoring_service.py](newsradar_api/app/services/alert_monitoring_service.py) | [tests/unit/test_alert_monitoring_service.py](newsradar_api/tests/unit/test_alert_monitoring_service.py) |
| #17  | **RF04** | Clasificación IPTC obligatoria de cada alerta. | [services/workflows/classification_workflow.py](newsradar_api/app/services/workflows/classification_workflow.py), [api/routes/categories.py](newsradar_api/app/api/routes/categories.py) | [tests/unit/test_article_classification.py](newsradar_api/tests/unit/test_article_classification.py), [test_categories.py](newsradar_api/tests/unit/test_categories.py) |
| #18  | **RF05** | Recomendación de 3–10 palabras extra. | [utils/keywords](newsradar_api/app/utils/), [api/routes/alerts.py](newsradar_api/app/api/routes/alerts.py) | [tests/unit/test_keyword_utils.py](newsradar_api/tests/unit/test_keyword_utils.py) |
| #19  | **RF06** | Aceptar / rechazar recomendaciones (UI). | [pages/AlertsManagement.tsx](newsradar_ui/src/pages/AlertsManagement.tsx) | [pages/AlertsManagement.test.tsx](newsradar_ui/src/pages/AlertsManagement.test.tsx) |
| #20  | **RF07** | Selección de canales RSS para la alerta. | [api/routes/alerts.py](newsradar_api/app/api/routes/alerts.py), [models/alert_monitoring.py](newsradar_api/app/models/alert_monitoring.py) | [tests/integration/test_alerts_api.py](newsradar_api/tests/integration/test_alerts_api.py) |
| #22  | **RF08** | Clasificación IPTC de noticias candidatas. | [services/workflows/classification_workflow.py](newsradar_api/app/services/workflows/classification_workflow.py) | [tests/unit/test_article_classification.py](newsradar_api/tests/unit/test_article_classification.py) |
| #23  | **RF09** | Generación de notificaciones al detectar coincidencia. | [services/alert_monitoring_service.py](newsradar_api/app/services/alert_monitoring_service.py), [api/routes/notifications.py](newsradar_api/app/api/routes/notifications.py) | [tests/unit/test_notifications_routes.py](newsradar_api/tests/unit/test_notifications_routes.py) |
| #21  | **RF10** | Configuración de alerta: buzón y/o email. | [api/routes/alerts.py](newsradar_api/app/api/routes/alerts.py), [services/alert_monitoring_service.py](newsradar_api/app/services/alert_monitoring_service.py) | [tests/unit/test_alert_monitoring_service.py](newsradar_api/tests/unit/test_alert_monitoring_service.py), [tests/integration/test_alerts_api.py](newsradar_api/tests/integration/test_alerts_api.py) |
| #24  | **RF11** | Título: "Actualización de \<alerta\> en \<día/hora\>". | [services/alert_monitoring_service.py](newsradar_api/app/services/alert_monitoring_service.py) | [tests/unit/test_notifications_routes.py](newsradar_api/tests/unit/test_notifications_routes.py) |
| #25  | **RF12** | Cuerpo de notificación: origen, fecha, título, resumen. | [api/routes/notifications.py](newsradar_api/app/api/routes/notifications.py), [models/notification.py](newsradar_api/app/models/notification.py) | [tests/unit/test_notifications_routes.py](newsradar_api/tests/unit/test_notifications_routes.py) |
| #26  | **RF13** | Alta de canales RSS por Gestor (medio + IPTC). | [api/routes/rss_channels.py](newsradar_api/app/api/routes/rss_channels.py), [api/routes/information_sources.py](newsradar_api/app/api/routes/information_sources.py) | [tests/unit/test_rss_channels_routes.py](newsradar_api/tests/unit/test_rss_channels_routes.py), [tests/integration/test_sources_channels_api.py](newsradar_api/tests/integration/test_sources_channels_api.py) |
| #27  | **RF14** | ≥100 canales RSS de ≥10 medios cubriendo IPTC L1. | [services/rss_service.py](newsradar_api/app/services/rss_service.py), seed de datos | [tests/unit/test_rss.py](newsradar_api/tests/unit/test_rss.py), [test_generate_rss_seed.py](newsradar_api/tests/unit/test_generate_rss_seed.py) |
| #28  | **RF15** | Roles Gestor/Lector, verificación email 24h, recuperación. | [api/routes/auth.py](newsradar_api/app/api/routes/auth.py), [api/routes/users.py](newsradar_api/app/api/routes/users.py), [services/user_service.py](newsradar_api/app/services/user_service.py) | [tests/unit/test_auth_routes.py](newsradar_api/tests/unit/test_auth_routes.py), [test_email_verify.py](newsradar_api/tests/unit/test_email_verify.py), [test_recup_contr.py](newsradar_api/tests/unit/test_recup_contr.py), [test_rbac.py](newsradar_api/tests/unit/test_rbac.py) |
| #29  | **RF16** | Panel de mando con nube de palabras, stats, CRUD, i18n. | [pages/Dashboard.tsx](newsradar_ui/src/pages/Dashboard.tsx), [api/routes/dashboard.py](newsradar_api/app/api/routes/dashboard.py), [api/routes/stats.py](newsradar_api/app/api/routes/stats.py) | [pages/Dashboard.test.tsx](newsradar_ui/src/pages/Dashboard.test.tsx), [tests/unit/test_dashboard_routes.py](newsradar_api/tests/unit/test_dashboard_routes.py), [test_stats_routes.py](newsradar_api/tests/unit/test_stats_routes.py) |

### Requisitos No Funcionales

| Issue | RNF | Descripción | Implementación | Validación |
|------:|-----|-------------|----------------|------------|
| #1 | **RNF01** | Arquitectura de 5 capas. | [docs/architecture.md](docs/architecture.md), separación `api`/`services`/`models`/`stores` | [ADR-001](docs/ADRs/ADR-001-arquitectura-5-capas.md) |
| #2 | **RNF02** | Comunicación íntegra vía API REST. | [newsradar_api/app/api/router.py](newsradar_api/app/api/router.py), routers en [routes/](newsradar_api/app/api/routes/) | [ADR-024](docs/ADRs/ADR-024-fastapi.md) |
| #3 | **RNF03** | OpenAPI 3.1 generado automáticamente. | FastAPI `/docs`, `/redoc` | Inspección manual + [tests/integration](newsradar_api/tests/integration/) |
| #4 | **RNF04** | Configuración con Docker. | [docker-compose.yml](docker-compose.yml), Dockerfiles backend/frontend | [ADR-002](docs/ADRs/ADR-002-docker.md), [ADR-017](docs/ADRs/ADR-017-estrategia-empaquetado-docker.md) |
| #5 | **RNF05** | Automatización de la configuración. | [.github/workflows/](.github/workflows/), seed de DB, [release.yml](.github/workflows/release.yml) (publicación automática de GitHub Releases al subir tags `v*`) | Pipelines verdes + Releases publicadas |
| #6 | **RNF06** | Integración Continua. | [.github/workflows/ci.yml](.github/workflows/ci.yml), [test.yml](.github/workflows/test.yml) | Ejecución por PR |
| #7 | **RNF07** | Cobertura de pruebas (unit + integration + perf). | [newsradar_api/tests/unit](newsradar_api/tests/unit/), [tests/integration](newsradar_api/tests/integration/), [tests/performance](newsradar_api/tests/performance/) | `pytest --cov`, [htmlcov/](htmlcov/) |
| #8 | **RNF08** | Métricas de calidad de código. | [sonar-project.properties](sonar-project.properties) | SonarCloud Quality Gate, [ADR-007](docs/ADRs/ADR-007-sonarcloud.md) |
| #9 | **RNF09** | Empaquetado y distribución (CD). | [.github/workflows/backend-package.yml](.github/workflows/backend-package.yml), [cd-frontend.yml](.github/workflows/cd-frontend.yml), [release.yml](.github/workflows/release.yml) | Imagen publicada + GitHub Release con `.tar.gz` y notas auto-generadas |
| #10 | **RNF10** | Pipeline reproducible con un único comando. | [evaluate.sh](evaluate.sh) + [Makefile](Makefile) (`make evaluate`) — build, seed (100 canales), tests, cobertura HTML y despliegue | [docs/deployment.md](docs/deployment.md) |
| #11 | **RNF11** | Documentación versionada y trazabilidad de prompts. | [docs/](docs/), [docs/prompts.md](docs/prompts.md), [mkdocs.yml](mkdocs.yml) | Esta tabla + ADRs |

---

## Licencia y Equipo

Distribuido bajo licencia **MIT** — ver [LICENSE](LICENSE).

**Equipo:** DevOps Grupo 84-A — Universidad Carlos III de Madrid (UC3M), curso 2025/2026.
