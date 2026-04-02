# ADR 014: Persistencia SQL, Monitorización Asíncrona y Refactorización Core (RF01)

## Estado
**Aceptado**

## Contexto
El sistema NewsRadar requería la implementación del **Motor de Monitorización de Alertas (RF01)**. El estado inicial del proyecto presentaba limitaciones críticas que impedían su evolución:
1. **Almacenamiento volátil:** El uso de listas y diccionarios en memoria causaba la pérdida total de datos tras reiniciar el servidor Uvicorn.
2. **Inestabilidad en el Agente:** La ausencia de una base de datos real impedía al agente de monitorización consultar reglas de alertas y persistir artículos de forma autónoma y fiable.
3. **Incompatibilidad de Entorno:** La librería `bcrypt` presentaba fallos de compilación recurrentes en entornos de desarrollo Windows.
4. **Deuda Técnica y Calidad:** Se detectaron fallos de concurrencia en la suite de tests (Deadlocks), advertencias de seguridad en SonarCloud (Security Hotspots) y un ratio de código duplicado superior al permitido.

## Decisiones

### 1. Migración a SQLAlchemy (SQLite para Datos Estructurados)
Alineado con el documento de arquitectura, se ha implementado un sistema de persistencia basado en **SQLAlchemy ORM** utilizando **SQLite** como motor de base de datos definitivo para la información estructurada.
* Se han configurado modelos relacionales con integridad referencial estricta (**Foreign Keys**) para las tablas de Usuarios, Fuentes de Información, Canales RSS y Alertas.
* *Nota:* Los artículos extraídos por el agente se persisten temporalmente en SQLite, a la espera de integrar la infraestructura de búsqueda documental.

### 2. Planificador (Scheduler) y Agente RSS
Se ha integrado el componente `apscheduler` vinculado directamente al ciclo de vida (**Lifespan**) de la aplicación FastAPI.
* **Frecuencia:** Configuración de ejecución cada minuto mediante cron (`cron='*/1 * * * *'`).
* **Lógica del Agente:** El módulo `alert_monitor_agent.py` gestiona de forma autónoma el parseo de feeds mediante `feedparser`, realiza el filtrado por descriptores y previene la duplicidad de noticias manejando excepciones de tipo `IntegrityError`.

### 3. Criptografía con Argon2 e Inyección de Secretos
Se ha sustituido la suite de seguridad original por **`argon2_cffi`**. 
* Argon2 proporciona la máxima resistencia contra ataques de fuerza bruta y garantiza compatibilidad multiplataforma absoluta. 
* Las credenciales críticas se gestionan mediante variables de entorno obligatorias (`NEWSRADAR_ADMIN_PASSWORD`), eliminando cualquier rastro de secretos en el código fuente.

### 4. Refactorización de Calidad y Seguridad (SonarCloud)
* **Resolución de Security Hotspots:** Se eliminó el uso de strings literales inseguros (`"http://"`) reemplazándolos por una gestión de URLs mediante la librería `urllib.parse`, permitiendo upgrades a HTTPS de forma robusta.
* **Principio DRY (Don't Repeat Yourself):** Se han centralizado las funciones de transformación de esquemas en `app/utils/user_utils.py`, eliminando la duplicidad de código detectada.
* **Refuerzo de RBAC:** Se han ajustado los permisos de los endpoints para asegurar la segregación de roles, validando respuestas 401 y 403.

### 5. Arquitectura de Tests Anti-Bloqueo
Se ha rediseñado la estrategia de pruebas para garantizar una ejecución fluida:
* **Aislamiento de Sesiones:** Los tests de integración operan exclusivamente a través del `TestClient`, eliminando aperturas manuales de sesiones que causaban bloqueos (Deadlocks) en SQLite.
* **Cobertura Focalizada:** Se han priorizado los Unit Tests con mocks para cubrir lógicas de excepción, superando el **84% de cobertura global**.

## Consecuencias

* **Positivas:**
    * La información estructural persiste correctamente bajo un esquema relacional ligero y eficiente (SQLite).
    * El sistema recolecta noticias en segundo plano de forma totalmente autónoma.
    * El proyecto cumple con excelencia el **Quality Gate** de SonarCloud.
* **Negativas:** El tiempo de ejecución de las pruebas unitarias ha aumentado ligeramente debido al coste computacional deliberado del algoritmo Argon2.
* **Riesgos y Mitigación:** La acumulación masiva de artículos (noticias) en SQLite podría degradar el rendimiento a medio plazo. Como mitigación, y siguiendo el diseño original, el próximo hito arquitectónico derivará el almacenamiento y búsqueda de estas noticias hacia un clúster de **Elasticsearch**.