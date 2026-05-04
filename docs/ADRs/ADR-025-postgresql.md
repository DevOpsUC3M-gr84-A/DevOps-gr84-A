# ADR-025 — PostgreSQL como sistema gestor de base de datos

- **Estado:** Aceptado
- **Fecha:** 2026-05-04
- **Autores:** Equipo DevOps-gr84-A
- **Requisitos relacionados:** RNF01 (5 capas), RF14 (≥100 canales RSS)

## 1. Contexto

NewsRadar manipula entidades transaccionales (usuarios, alertas, fuentes, notificaciones) y requiere capacidades avanzadas: índices full-text para búsquedas por palabra clave, restricciones de integridad referencial sobre relaciones complejas (alerta ↔ canal ↔ categoría IPTC) y soporte robusto para transacciones concurrentes desde el agente scheduler de alertas.

## 2. Alternativas consideradas

- **SQLite**: descartada para producción (concurrencia limitada y sin tipos avanzados). Se mantiene únicamente como soporte de ejecución local en tests.
- **MySQL / MariaDB**: viable, pero menor riqueza en tipos JSON y *full-text search*.
- **MongoDB**: descartada — el modelo es relacional y se requiere integridad referencial estricta.

## 3. Decisión

Se adopta **PostgreSQL 15** como motor de la capa 5 (Datos), accedido mediante **SQLAlchemy 2.x** desde la capa 4 (Persistencia). Ver capas en [ADR-001](ADR-001-arquitectura-5-capas.md).

## 4. Consecuencias

**Positivas**
- Integridad referencial y transacciones ACID.
- `tsvector` / índices `GIN` para búsqueda eficiente de noticias por palabra clave.
- Compatibilidad nativa con Docker (RNF04, ver [ADR-002](ADR-002-docker.md) y [ADR-017](ADR-017-estrategia-empaquetado-docker.md)).

**Negativas**
- Setup local algo más pesado que SQLite, mitigado mediante Docker Compose.

## 5. Implementación

- Configuración del servicio: [docker-compose.yml](../../docker-compose.yml).
- ORM y sesión: [newsradar_api/app/database/](../../newsradar_api/app/database/).
- Modelos: [newsradar_api/app/models/](../../newsradar_api/app/models/).
- Stores: [newsradar_api/app/stores/](../../newsradar_api/app/stores/).
