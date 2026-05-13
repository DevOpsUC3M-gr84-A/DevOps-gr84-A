# Registro de Prompts de IA · Trazabilidad (RNF11)

> Este documento cumple el **RNF11**: toda interacción con una IA generativa (ChatGPT, Claude, GitHub Copilot Chat, Gemini, etc.) que haya **influido en código, configuración, documentación o decisiones de arquitectura** debe quedar registrada aquí.

## 1. ¿Qué registrar?

| Sí registrar | No es necesario |
|---|---|
| Prompts que generaron **código** que terminó en `main`. | Auto-completados triviales de Copilot (1-2 líneas). |
| Prompts que ayudaron a **diseñar** un módulo, esquema de BD o ADR. | Preguntas de "cómo se hace X en Python" sin código generado. |
| Prompts que generaron **tests, fixtures o seeds**. | Conversaciones exploratorias sin output retenido. |
| Prompts usados para **redactar documentación** publicada. | Refactors mecánicos disparados por el linter. |

---

## 2. Plantilla de Copy-Paste

> **Cómo usarla:** copia la fila Markdown de abajo, pégala como **primera fila** del cuerpo de la tabla en la sección [§3 Historial de Prompts](#3-historial-de-prompts) y rellena los placeholders `<...>`. Mantén el orden cronológico inverso (más reciente arriba). Para prompts largos, usa el formato `<<resumen>> · [ver completo](#detalle-YYYYMMDD-slug)` y añade una subsección al final con el prompt íntegro.

```markdown
| <YYYY-MM-DD> | <Nombre Apellido> | `#NN` · `RFxx`/`RNFxx` | <Claude Opus 4.7 / ChatGPT GPT-5 / Copilot Chat / Gemini 2.5 Pro> | `<prompt literal o resumen + enlace al detalle>` | <archivo(s) modificado(s), commit `abc1234`, PR [#NN](url)> |
```

!!! tip "Convención de columna *Tarea*"
    Usa el formato `#NN` (issue de GitHub) o `RFxx` / `RNFxx` (código del requisito). Ejemplo: `#95 · RNF11`.

!!! tip "Prompts largos"
    La columna *Prompt* es estrecha. Si tu prompt supera ~3 líneas, pega un resumen y enlaza a una subsección `## Detalle YYYY-MM-DD — <slug>` al final del documento con el prompt íntegro en un bloque de código.

---

## 3. Historial de Prompts

> Orden: **más reciente arriba**. Una fila por interacción significativa.

| Fecha       | Autor          | Tarea            | IA                  | Prompt                                                                                                                                                                                                | Resultado                                                                                                                            |
|-------------|----------------|------------------|---------------------|-------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------|--------------------------------------------------------------------------------------------------------------------------------------|
| 2026-05-12  | Eloy Martín    | `#95` · `RNF11`  | Claude Opus 4.7     | Auditoría de coherencia de `docs/`: sincronización de `quickstart.md`/`deployment.md`/`architecture.md`, estandarización de ADRs y generación de `spec.md` y `prompts.md` definitivos. [Ver detalle](#detalle-20260512-refinamiento-mkdocs) | Renumerado ADR-024 (i18n) → [ADR-027](ADRs/ADR-027-internacionalizacion-i18n.md); creada plantilla [_TEMPLATE.md](ADRs/_TEMPLATE.md); regenerados [spec.md](spec.md) y [prompts.md](prompts.md). |
| 2026-05-10  | Lucía Pérez    | `#142` · `RF03`  | Claude Opus 4.7     | Diseñar validación que impide a un *gestor* superar 20 alertas + tests asociados (servicio y API).                                                                                                    | Límite enforzado en `AlertsService.create_alert` con `AlertQuotaExceededError` → HTTP 409. Commit `e7f9c1a`, PR [#143](https://github.com/DevOpsUC3M-gr84-A/DevOps-gr84-A/pull/143). |
| 2026-04-22  | Diego Ramírez  | `#118` · `RNF08` | ChatGPT (GPT-5)     | Integrar SonarCloud en GitHub Actions reutilizando `coverage.xml` y bloqueando PRs por debajo del Quality Gate.                                                                                       | Workflow con `SonarSource/sonarcloud-github-action@v2` y `sonar.qualitygate.wait=true`. Decisión en [ADR-007](ADRs/ADR-007-sonarcloud.md). Commit `4b1d77e`. |
| YYYY-MM-DD  | &lt;tu nombre&gt; | `#NN`           | &lt;modelo&gt;          | _Pendiente — sustituir por entrada real usando la plantilla de §2._                                                                                                                                    | —                                                                                                                                    |

---

## 4. Detalles ampliados de prompts largos

Anclas para prompts cuyo texto íntegro no cabe en la tabla. Añade aquí una subsección por cada fila que enlace a `[Ver detalle](...)`.

### Detalle 2026-05-12 — Refinamiento MkDocs

**Contexto pasado a la IA:** árbol completo de `docs/`, `requirements.csv`, listado de ADRs, `mkdocs.yml`, `evaluate.sh`.

**Prompt principal:**

```text
Actúa como Technical Writer Principal y Arquitecto de Software. Estamos finalizando
la documentación de nuestro proyecto (Issue #95) y necesito realizar una auditoría
de coherencia y formato en la carpeta docs/. Tres tareas: (1) sincronizar
architecture/deployment/quickstart con la realidad (FastAPI + Docker Compose +
evaluate.sh), (2) estandarizar todos los ADRs con título numerado, fecha+estado,
contexto, decisión y consecuencias (plantilla + corregir los 2 peor formateados),
(3) consolidar requirements/requirements.csv en docs/spec.md con tablas de RF/RNF
y casos de uso. Quita los emojis.
```

**Resultado / Observaciones:**

- Eliminados emojis de los encabezados en [quickstart.md](quickstart.md).
- Corregida en [deployment.md](deployment.md) la descripción de `evaluate.sh` (también levanta el contenedor del frontend).
- Resuelta colisión de número ADR-024 renombrando i18n → [ADR-027](ADRs/ADR-027-internacionalizacion-i18n.md).
- Creada plantilla [ADRs/_TEMPLATE.md](ADRs/_TEMPLATE.md) y reescrito [ADR-016](ADRs/ADR-016-gestion-acciones-recomendaciones.md).
- Generado [spec.md](spec.md) con matriz de trazabilidad RF/RNF ↔ ADR ↔ componente.

---

## 5. Referencias

- [docs/spec.md](spec.md) — catálogo formal de RF/RNF y matriz de trazabilidad.
- [docs/ADRs/](ADRs/) — catálogo completo de decisiones de arquitectura.
- [ADR-004 · MkDocs](ADRs/ADR-004-mkdocs.md) — decisión sobre la cadena de documentación.
