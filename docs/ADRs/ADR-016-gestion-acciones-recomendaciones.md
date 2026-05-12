# ADR 016: Gestión de Acciones sobre Recomendaciones de Alertas

**Estado:** Aceptado
**Fecha:** 2026-04-08
**Autores:** Equipo DevOps-gr84-A
**Issue / Requisito:** RF05, RF06

---

## 1. Contexto

El sistema debe sugerir entre 3 y 10 palabras adicionales al introducir el descriptor de una alerta (RF05) y permitir que el usuario acepte o rechace manualmente esas recomendaciones (RF06). Durante la implementación se identificaron tres problemas adicionales:

- Necesidad de **centralizar la lógica de creación y edición** de alertas en un único componente modal para mantener la consistencia visual y funcional.
- Riesgo de **redundancia** entre sugerencias del backend y palabras ya aceptadas por el usuario.
- Posibles **solapamientos del scheduler** de monitorización cuando el volumen de noticias es alto, que podían producir saltos en el cronograma cron.

## 2. Alternativas consideradas

| Alternativa | Pros | Contras |
|-------------|------|---------|
| Componentes separados para crear y editar alertas | Lógica más simple por pantalla | Duplicación de código, divergencia de UX |
| Filtrado de sugerencias en backend | Cliente más ligero | Round-trip extra por cada cambio del input |
| **Componente unificado + filtrado en cliente (elegida)** | Una sola fuente de verdad en el frontend, menos llamadas a la API | Mayor complejidad interna del componente `AlertForm` |

## 3. Decisión

1. **Componente unificado `AlertForm`** en el frontend que opera en modos *creación* y *edición*, encapsulando el ciclo completo de descriptores y chips de recomendaciones.
2. **Filtrado en cliente**: las sugerencias devueltas por la API se filtran contra las palabras ya aceptadas antes de renderizarse, eliminando duplicados sin pedirlo al backend.
3. **Separación de endpoints**: el botón "Sugerir" (lectura) y el botón "Guardar" (escritura) operan sobre endpoints distintos para evitar escrituras intermedias durante la edición.
4. **Backend con solapamiento controlado**: el scheduler de monitorización se configura con `max_instances=3` (APScheduler), permitiendo ejecuciones concurrentes acotadas y evitando saltos del cron.

## 4. Consecuencias

### Positivas
- Mejora notable de la experiencia de usuario al gestionar descriptores y recomendaciones.
- Reducción del número de llamadas HTTP durante la edición.
- Mayor robustez del scheduler frente a picos de carga.

### Negativas / Limitaciones
- `AlertForm` concentra dos modos de operación, lo que incrementa su complejidad ciclomática.
- El filtrado en cliente exige mantener sincronizado el estado local con la respuesta del backend.

## 5. Referencias

- Relacionado con [[ADR-014-gestion-alertas]] y [[ADR-018-resiliencia-scheduler-y-ciclo-vida]].
