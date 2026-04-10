# ADR 018: Estrategia de Resiliencia del Scheduler y Ciclo de Vida de la API

## 1. Contexto
Durante las pruebas de integración del frontend (Issue #75) con el motor de monitorización de noticias, detectamos dos problemas críticos de estabilidad en el backend:
1. **Bloqueo del Servidor (El "Bug del Ctrl+C"):** Al intentar detener el servidor Uvicorn en local, la terminal quedaba congelada porque el hilo del `APScheduler` seguía vivo en segundo plano impidiendo un cierre limpio (Graceful Shutdown). Además, se usaban los eventos deprecados `@app.on_event("startup")` de FastAPI.
2. **Colapso de Instancias del Scheduler:** La lectura de canales RSS externos (mediante `feedparser`) no tenía un límite de tiempo. Si una fuente externa tardaba en responder, los trabajos programados se solapaban hasta alcanzar el límite del planificador (`Execution of job skipped: maximum number of running instances reached`).

## 2. Decisión
Para garantizar la resiliencia del sistema y prepararlo para producción, hemos implementado las siguientes decisiones arquitectónicas:

* **Migración a `lifespan` de FastAPI:** Se ha refactorizado la gestión de arranque y parada de la API utilizando el gestor de contexto asíncrono `@asynccontextmanager def lifespan(app: FastAPI)`. Esto asegura que el `scheduler.shutdown(wait=False)` se ejecute de forma garantizada y explícita al recibir una señal de terminación (SIGTERM/SIGINT).
* **Timeouts Estrictos de Red:** Se ha introducido la librería `requests` para gestionar la descarga de los XML de los feeds RSS, imponiendo un `timeout` estricto de 10 segundos.
* **Tolerancia a la concurrencia:** Se ha configurado el trabajo del `AlertMonitorScheduler` con `max_instances=5` y `coalesce=True` (para agrupar ejecuciones solapadas en lugar de encolarlas infinitamente).

## 3. Consecuencias

### Positivas:
* **Cierre limpio (Graceful Shutdown):** La API ahora se puede detener de forma inmediata sin dejar procesos huérfanos, crucial para los despliegues automáticos (CI/CD) en la nube.
* **Alta disponibilidad:** Un canal RSS caído o lento ya no bloqueará la monitorización del resto de alertas del sistema.
* **Código moderno:** Eliminación de *DeprecationWarnings* de FastAPI.

### Negativas / Riesgos:
* **Falsos Negativos en Feeds Lentos:** Si un canal RSS legítimo tarda más de 10 segundos en generar su XML, el sistema abortará la lectura de ese ciclo.
* **Gestión de dependencias:** Se ha añadido una nueva dependencia explícita (`requests==2.32.5`) que debe mantenerse actualizada.