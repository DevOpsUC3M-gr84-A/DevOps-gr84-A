# ADR-019: Formateo Centralizado de Notificaciones y Estandarización de .gitignore

## Estado
Aceptado

## Contexto
Durante el Sprint 4 (Implementación de RF11 y RF12), surgió la necesidad de definir y centralizar la lógica que formatea los títulos y cuerpos de las notificaciones del sistema. Los orígenes de datos (RSS) a menudo contienen información incompleta (sin autor, sin resumen, con formatos de fecha dispares), lo que provocaba excepciones de tipo `KeyError` o errores de parseo. 

Por otro lado, a nivel de DevOps, detectamos que el repositorio estaba acumulando archivos temporales, cachés (`__pycache__`) y binarios de reportes (`.coverage`). Esto estaba generando "ruido" en SonarCloud y provocando tediosos *Merge Conflicts* entre ramas, bloqueando la Integración Continua.

## Decisiones

1. **Desacoplamiento del Formateo:** Se ha creado un servicio dedicado (`alert_monitoring_service.py`) exclusivamente para construir el *payload* de la notificación. Esto separa la lógica de negocio del agente de monitorización (`alert_monitor_agent.py`), respetando el Principio de Responsabilidad Única (SRP).
2. **Robustez ante datos nulos:** Se ha implementado el uso sistemático de `.get()` con valores por defecto (ej. "Sin resumen disponible") para parsear los diccionarios de noticias, garantizando que el sistema nunca falle por datos externos incompletos.
3. **Tipado Estricto para SonarCloud:** Se han utilizado `Protocols` decorados con `@runtime_checkable` para asegurar un tipado estricto que satisfaga los análisis de código estático sin sacrificar la flexibilidad de Python.
4. **Política estricta de `.gitignore`:** Se ha unificado el `.gitignore` en la raíz del proyecto para cubrir tanto el frontend (React) como el backend (FastAPI). 
5. **Purga de Binarios:** Se ha eliminado `.coverage` del control de versiones resolviendo definitivamente los conflictos de fusión.
6. **Excepción de Bases de Datos:** Se ha añadido una regla explícita (`!*.db`) para mantener `newsradar.db` en el repositorio y facilitar la compartición de datos de prueba entre desarrolladores.

## Consecuencias
* **Positivas:** * Se ha alcanzado un 100% de cobertura en la nueva lógica de notificaciones.
  * Cero *Code Smells* reportados por SonarCloud.
  * Fin de los *Merge Conflicts* causados por archivos `.coverage` generados localmente.
* **Negativas:** * El equipo debe recordar no forzar la subida de archivos ignorados y ser consciente de que el `.coverage` ahora es estrictamente un artefacto local/efímero.