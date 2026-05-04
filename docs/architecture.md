# Arquitectura — NewsRadar

NewsRadar implementa la **arquitectura de 5 capas** exigida por el requisito **RNF01**, con separación estricta de responsabilidades y comunicación íntegramente vía API REST (**RNF02**) documentada con OpenAPI (**RNF03**).

## 1. Visión general

```
┌──────────────────────────────────────────────────────────────┐
│  Capa 1 · Presentación (UI)                                  │
│  React + TypeScript + Vite — newsradar_ui/                   │
└──────────────────────────────────────────────────────────────┘
                              │ HTTPS / JSON
                              ▼
┌──────────────────────────────────────────────────────────────┐
│  Capa 2 · API REST                                           │
│  FastAPI — newsradar_api/app/api/routes/*.py                 │
└──────────────────────────────────────────────────────────────┘
                              │ llamadas a servicios
                              ▼
┌──────────────────────────────────────────────────────────────┐
│  Capa 3 · Lógica de Negocio                                  │
│  Servicios y agentes — newsradar_api/app/services/           │
└──────────────────────────────────────────────────────────────┘
                              │ ORM
                              ▼
┌──────────────────────────────────────────────────────────────┐
│  Capa 4 · Persistencia (SQLAlchemy)                          │
│  Modelos y stores — newsradar_api/app/models, app/stores     │
└──────────────────────────────────────────────────────────────┘
                              │ SQL
                              ▼
┌──────────────────────────────────────────────────────────────┐
│  Capa 5 · Datos (PostgreSQL)                                 │
└──────────────────────────────────────────────────────────────┘
```

## 2. Capa de Presentación (UI)

- **Tecnología**: React 18, TypeScript, Vite.
- **Ubicación**: [newsradar_ui/src](../newsradar_ui/src/).
- **Responsabilidad**: SPA que consume exclusivamente la API REST. Páginas principales: Dashboard, Gestión de Alertas, Gestión de Fuentes RSS, Autenticación, Perfil, Resumen y Notificaciones.
- **Soporte i18n** ES/EN (RF16) y enrutado protegido por roles (RBAC, ADR-013).

## 3. Capa de API REST

- **Tecnología**: FastAPI con generación automática de **OpenAPI 3.1** en `/docs`.
- **Ubicación**: [newsradar_api/app/api/routes/](../newsradar_api/app/api/routes/).
- **Responsabilidad**: validación de payloads (Pydantic), autenticación JWT, autorización por roles y serialización HTTP.
- **Routers**: `auth`, `users`, `roles`, `alerts`, `rss_channels`, `information_sources`, `categories`, `notifications`, `dashboard`, `stats`.

## 4. Capa de Lógica de Negocio

- **Ubicación**: [newsradar_api/app/services/](../newsradar_api/app/services/).
- **Componentes principales**:
  - `alert_monitoring_service.py` — gestión de ciclo de vida de alertas (RF01–RF07, RF10).
  - `rss_service.py` — ingesta y normalización de canales (RF13, RF14).
  - `user_service.py` — alta de usuarios, verificación email 24h y recuperación de contraseña (RF15).
  - `agents/alert_monitor_agent.py` — agente asíncrono dirigido por cron (RF01).
  - `workflows/classification_workflow.py` — clasificación IPTC (RF04, RF08).

## 5. Capa de Persistencia

- **Tecnología**: SQLAlchemy 2.x.
- **Ubicación**: [newsradar_api/app/models/](../newsradar_api/app/models/) y [newsradar_api/app/stores/](../newsradar_api/app/stores/).
- **Modelos**: `user`, `rss`, `alert_monitoring`, `notification`.
- **Patrón Store** para abstraer el acceso a datos por entidad.

## 6. Capa de Datos

- **Tecnología**: PostgreSQL 15.
- **Configuración**: declarada en [docker-compose.yml](../docker-compose.yml).
- **Datos semilla**: 100+ canales RSS de 10+ medios cubriendo todas las categorías IPTC de primer nivel (RF14).

## 7. Componentes transversales

| Componente            | Ubicación                                  | Función                                |
|-----------------------|--------------------------------------------|----------------------------------------|
| Notificaciones email  | `app/services/` + MailHog en dev           | RF09–RF12                              |
| Buzón interno         | `app/api/routes/notifications.py`          | RF10                                   |
| Scheduler / cron      | `app/services/agents/alert_monitor_agent.py` | RF01                                 |
| Clasificador IPTC     | `app/services/workflows/classification_workflow.py` | RF04, RF08                    |

## 8. Decisiones de arquitectura

Todas las decisiones relevantes están documentadas como ADRs en [docs/ADRs/](ADRs/). Las principales:

- [ADR-001](ADRs/ADR-001-arquitectura-5-capas.md) — Arquitectura de 5 capas (RNF01).
- [ADR-002](ADRs/ADR-002-docker.md) — Docker como entorno (RNF04).
- [ADR-003](ADRs/ADR-003-ci-actions.md) — CI con GitHub Actions (RNF06).
- [ADR-017](ADRs/ADR-017-estrategia-empaquetado-docker.md) — Empaquetado Docker multi-stage y GHCR (RNF09).
- [ADR-024](ADRs/ADR-024-fastapi.md) — FastAPI como framework REST (RNF02–RNF03).
- [ADR-025](ADRs/ADR-025-postgresql.md) — PostgreSQL como motor de datos.
