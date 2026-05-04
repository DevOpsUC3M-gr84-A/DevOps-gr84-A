# ADR-017 — Estrategia de empaquetado y distribución del backend (Docker + GHCR)

- **Estado:** Aceptado
- **Fecha:** 2026-05-03
- **Issue:** #56 — [RNF09] Empaquetado y distribución Backend (Docker / Cloud)
- **Autores:** Equipo NewsRadar (gr84-A)

## Contexto

El backend de NewsRadar (FastAPI + Uvicorn) debe distribuirse como artefacto ejecutable, reproducible y portable, válido tanto para entornos de desarrollo local como para despliegues en cloud. Hasta este sprint, la imagen se construía con un `Dockerfile` mono-etapa que ejecutaba el proceso como `root`, instalaba dependencias de compilación en la imagen final y no se publicaba en ningún registro de contenedores.

Esta situación presenta tres problemas:

1. **Tamaño y superficie de ataque**: las herramientas de compilación (`build-essential`, `gcc`, etc.) acaban en la imagen de runtime, aumentando tanto el peso como los CVEs potenciales.
2. **Seguridad / hallazgos SonarCloud**: SonarCloud y los linters de Docker marcan como *security hotspot* el ejecutar el contenedor como `root`.
3. **Distribución manual**: cada miembro del equipo construía la imagen localmente, sin trazabilidad de qué commit generó qué binario en producción.

## Decisión

Adoptamos una estrategia de empaquetado en tres frentes:

### 1. Dockerfile *multi-stage*
El `Dockerfile` se divide en dos etapas:
- **`builder`** (basada en `python:3.11-slim`): instala `build-essential`, crea un *virtualenv* en `/opt/venv` e instala `requirements.txt`.
- **`runtime`** (basada en `python:3.11-slim` *limpia*): copia únicamente el `/opt/venv` ya construido y el código de la aplicación. No contiene compiladores.

### 2. Hardening con usuario no privilegiado `appuser`
En la etapa `runtime` creamos explícitamente un grupo y usuario de sistema (`appgroup` / `appuser`, UID/GID `1001`). Antes del `CMD` se hace `USER appuser`, de modo que `uvicorn` **nunca** se ejecuta como `root`. 
Motivación: es la recomendación directa de SonarCloud (regla *"docker:S6471"*) y de los benchmarks CIS Docker. 

### 3. Registro de Contenedores (GHCR) y Orquestación Local
- Publicamos las imágenes en **`ghcr.io`** mediante un workflow de GitHub Actions (`backend-package.yml`) que se dispara en cada push a `main` (etiquetando con el SHA del commit y `latest`).
- Actualizamos el `docker-compose.yml` para garantizar una **experiencia de desarrollo nativa**:
  - Utilizamos `env_file` para inyectar automáticamente la configuración del host.
  - Añadimos un bind-mount de solo lectura (`/app/app:ro`) junto al comando `--reload` para mantener el *hot-reload* sin corromper permisos de host.
  - Montamos el directorio de datos (`/app/data`) para que la base de datos SQLite sea persistente e inspeccionable desde el host.

## Alternativas consideradas
- **Docker Hub**: descartado por el límite de pulls del plan gratuito.
- **AWS ECR / Azure ACR**: descartados en este sprint por requerir infraestructura cloud externa.
- **Mono-stage con `--no-install-recommends`**: insuficiente; sigue dejando herramientas residuales y no resuelve el root.

## Consecuencias

**Positivas**
- Imagen runtime más ligera y segura (hotspot de SonarCloud resuelto).
- Trazabilidad total: cada commit en `main` produce una imagen inmutable.
- Experiencia del desarrollador (DX) intacta: conservamos *hot-reload*, autoconfiguración vía `.env` y acceso directo a la base de datos SQLite local, todo dentro de un entorno dockerizado y seguro.

**Negativas / a vigilar**
- En sistemas host Linux (no Windows/Mac), la carpeta montada para la base de datos (`./newsradar_api/data`) podría requerir un `chown` manual inicial al UID `1001` para que el contenedor pueda escribir en ella.
- El código se monta como `read-only` (`:ro`) a propósito para evitar que el contenedor cree carpetas `__pycache__` con permisos de root/1001 en el host.