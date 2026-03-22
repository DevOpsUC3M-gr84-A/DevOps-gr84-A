# ADR 005: Estrategia de Control de Versiones y Ramas

## 1. Estado

Aceptado

## 2. Contexto

Para el desarrollo de NEWSRADAR, es un requisito explícito configurar las ramas del control de versiones apropiadamente. Además, el día de la evaluación final habrá una competición que consistirá en realizar modificaciones rápidas, como añadir funcionalidades o recuperar versiones previas de la aplicación. Necesitamos una estrategia ágil que minimice los conflictos complejos, evite cuellos de botella y garantice que el código en producción sea siempre estable y fácil de revertir.

## 3. Decisión

Se ha decidido adoptar **GitHub Flow** como nuestra estrategia principal de control de versiones.

Las reglas acordadas son las siguientes:

- **Rama `main` blindada:** Representa el entorno de producción. Se ha bloqueado el `push` directo mediante las reglas de protección de GitHub. Cualquier integración de código debe hacerse obligatoriamente a través de un Pull Request (PR).
- **Ramas Efímeras (Feature Branches):** Todo nuevo desarrollo (requisito, corrección de errores o documentación) se realizará en una rama temporal creada a partir de `main`. Se utilizarán prefijos estandarizados como `feature/*`, `bugfix/*` o `docs/*` seguidos del identificador del issue (ej. `feature/RF_1-login`).
- **Integración Continua:** Para que un PR sea aprobado y fusionado, deberá contar con la revisión de código de al menos un miembro del equipo y superar con éxito los pipelines de CI automatizados.

## 4. Consecuencias

- **Positivas:** Se garantiza que la rama `main` siempre contiene una versión desplegable y funcional.
  - Ante la necesidad de recuperar una versión previa durante la competición, bastará con revertir el último PR fusionado en `main`.
  - Fomenta el trabajo en equipo y la revisión por pares (Code Review).
- **Negativas:** Exige la creación de ramas y PRs incluso para cambios tipográficos o ajustes mínimos, añadiendo una ligera sobrecarga administrativa que compensa por la seguridad obtenida.
