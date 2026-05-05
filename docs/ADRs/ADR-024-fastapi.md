# ADR-024 — Adopción de FastAPI como framework de la capa REST

- **Estado:** Aceptado
- **Fecha:** 2026-05-04
- **Autores:** Equipo DevOps-gr84-A
- **Requisitos relacionados:** RNF02 (API REST), RNF03 (OpenAPI), RNF06 (CI)

## 1. Contexto

El sistema NewsRadar requiere una capa REST moderna, validable, documentada automáticamente con OpenAPI y compatible con un stack Python para reutilizar bibliotecas de IA y procesamiento de texto necesarias para la clasificación IPTC y la deduplicación de noticias.

## 2. Alternativas consideradas

- **Flask**: minimalista, pero requiere ensamblar a mano validación, OpenAPI y soporte async.
- **Django REST Framework**: maduro, pero excesivo para el tamaño del proyecto y con sobrecoste en el modelo síncrono.
- **FastAPI**: nativo async, validación con Pydantic y OpenAPI 3.1 automático.

## 3. Decisión

Se adopta **FastAPI** como framework de la capa REST (capa 4 según [ADR-001](ADR-001-arquitectura-5-capas.md)).

## 4. Consecuencias

**Positivas**
- Generación automática de OpenAPI 3.1 (`/docs`, `/redoc`), cumpliendo RNF03 sin trabajo manual.
- Validación tipada con Pydantic en el *boundary* HTTP.
- Soporte nativo `async`/`await`, ideal para tareas IO-bound (ingesta RSS, envío de emails, agente scheduler).
- Excelente rendimiento sobre Starlette + Uvicorn.

**Negativas**
- Ecosistema más joven que Django; algunas piezas (admin, auth) deben construirse a medida.
- Requiere disciplina en la organización de dependencias y middlewares.

## 5. Implementación

- Punto de entrada: [newsradar_api/app/main.py](../../newsradar_api/app/main.py).
- Routers: [newsradar_api/app/api/routes/](../../newsradar_api/app/api/routes/).
- Router agregado: [newsradar_api/app/api/router.py](../../newsradar_api/app/api/router.py).
