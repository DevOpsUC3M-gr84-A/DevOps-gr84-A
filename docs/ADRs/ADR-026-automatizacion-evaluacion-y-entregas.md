# ADR-026 — Automatización de Evaluación y Entregas (RNF05 y RNF10)

- **Estado:** Aceptado
- **Fecha:** 2026-05-05
- **Autores:** Equipo DevOps-gr84-A
- **Requisitos relacionados:** RNF05 (Automatización de la configuración / entregas), RNF10 (Evaluación con pipeline reproducible), Issues #25 y #27

## 1. Contexto

La evaluación del proyecto exige que el profesorado pueda **construir y desplegar el sistema partiendo de cero** (incluyendo la carga semilla de ≥100 canales RSS, RF14) ejecutando un único comando, y que las **entregas** del proyecto se generen y publiquen de forma automatizada y trazable. Sin automatización, cada entrega depende de pasos manuales (empaquetado, redacción de notas, subida de artefactos), lo que es propenso a error humano y rompe la reproducibilidad exigida por RNF05/RNF10.

Se necesita por tanto:
1. Un **flujo local unificado** que cualquier evaluador pueda ejecutar sin conocer la arquitectura interna (RNF10, issue #27).
2. Un **flujo remoto automático** que empaquete el código, genere notas y publique la entrega como GitHub Release al crear un tag (RNF05, issue #25).

## 2. Alternativas consideradas

- **Documentar pasos manuales en el README**: descartada — no garantiza reproducibilidad ni cumple con el espíritu de "un solo comando" exigido por RNF10.
- **Script único en Python o Node**: descartada — añade dependencia de runtime fuera del contenedor; bash + Docker ya están presentes en cualquier entorno de evaluación.
- **Jenkins / GitLab CI** para la release: descartada — el repositorio vive en GitHub y el coste de mantener otra plataforma no se justifica.
- **Publicar release manualmente desde la UI de GitHub**: descartada — incumple el principio de automatización (RNF05) y no deja traza reproducible del empaquetado.

## 3. Decisión

Se adopta una **estrategia dual** que separa la evaluación local de la publicación remota:

### 3.1 Evaluación local (RNF10 — Issue #27)
- Script **[`evaluate.sh`](../../evaluate.sh)** en bash que orquesta: limpieza de contenedores previos → `docker compose build` → `docker compose up -d` → *health check* sobre `/docs` → `pytest --cov`.
- **[`Makefile`](../../Makefile)** como fachada de comandos (`make evaluate`, `make down`, `make logs`) para ofrecer una interfaz uniforme al evaluador.
- La carga semilla de ≥100 canales (RF14) se realiza durante el arranque del contenedor `api-backend` mediante el seed ya existente (ver [ADR-008](ADR-008-seed-datos-rss.md)), por lo que `evaluate.sh` la cubre transitivamente.

### 3.2 Empaquetado y publicación (RNF05 — Issue #25)
- Workflow **[`.github/workflows/release.yml`](../../.github/workflows/release.yml)** disparado al hacer push de un tag `v*`.
- Empaqueta el código (`tar.gz` excluyendo `.git`, `__pycache__`, `node_modules`, `htmlcov`, etc.), genera `RELEASE_NOTES.txt` y publica con `softprops/action-gh-release@v2` adjuntando ambos artefactos.

## 4. Consecuencias

**Positivas**
- Un único comando (`make evaluate`) reproduce el sistema completo desde cero, cumpliendo RNF10 de forma verificable.
- La release se genera con trazabilidad total (commit, tag, autor, fecha UTC) sin intervención manual, cumpliendo RNF05.
- Bajo acoplamiento: el script local no depende del workflow remoto y viceversa.
- Compatible con la pipeline de CI existente ([ADR-003](ADR-003-ci-actions.md)) sin modificarla.

**Negativas**
- `evaluate.sh` asume bash + Docker disponibles. En Windows requiere WSL/Git Bash (documentado en [docs/quickstart.md](../quickstart.md)).
- El workflow `release.yml` requiere permiso `contents: write` sobre el repositorio; ya concedido a `GITHUB_TOKEN` por defecto.

## 5. Implementación

- Script de evaluación: [`evaluate.sh`](../../evaluate.sh).
- Fachada de comandos: [`Makefile`](../../Makefile).
- Workflow de release: [`.github/workflows/release.yml`](../../.github/workflows/release.yml).
- Documentación de uso: [`docs/quickstart.md`](../quickstart.md), [`docs/deployment.md`](../deployment.md), [`README.md`](../../README.md).
- Seed de canales RSS (RF14) ejecutado por el contenedor: ver [ADR-008](ADR-008-seed-datos-rss.md).

## 6. Verificación

- **Local (RNF10):** `make evaluate` debe terminar con la API respondiendo en `http://localhost:8000/docs` y la suite de tests en verde con cobertura.
- **Remoto (RNF05):** `git tag vX.Y.Z && git push origin vX.Y.Z` debe generar una GitHub Release con el `.tar.gz` y `RELEASE_NOTES.txt` adjuntos en menos de 2 minutos.
