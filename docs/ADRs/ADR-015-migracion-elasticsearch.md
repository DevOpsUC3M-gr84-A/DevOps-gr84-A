# ADR 015: Migración de persistencia documental a Elasticsearch y limpieza de infraestructura

## Estado
**Aceptado**

## Contexto
Durante el desarrollo del sistema de monitorización (RF01), se detectó una desviación significativa respecto al documento de arquitectura original:
1. Existía un contenedor de PostgreSQL en el `docker-compose.yml` que no estaba siendo utilizado (infraestructura huérfana).
2. Los artículos/noticias recolectados por el Agente Monitor se estaban persistiendo en una tabla relacional dentro de SQLite, lo cual no es escalable ni eficiente para texto libre a medio/largo plazo.
3. Las dependencias del proyecto mezclaban librerías de producción con herramientas de testing (`pytest`, `locust`), aumentando innecesariamente el peso y la superficie de ataque de la imagen Docker de producción.

## Decisiones

### 1. Limpieza de Infraestructura Relacional
Se ha eliminado definitivamente el servicio de PostgreSQL del entorno local de Docker, consolidando **SQLite** como el motor único y definitivo para el almacenamiento de datos estructurados (usuarios, reglas de alertas, configuraciones), tal y como dictaba el diseño inicial.

### 2. Integración de Elasticsearch
Se ha desplegado **Elasticsearch** (modo *single-node* para desarrollo) como base de datos documental.
El `alert_monitor_agent.py` ha sido refactorizado para que, en lugar de utilizar SQLAlchemy para guardar noticias, actúe como un cliente de Elasticsearch que indexa documentos JSON directamente en el índice `articles`.

### 3. Normalización de Dependencias
Se ha dividido la gestión de paquetes en Python:
* `requirements.txt`: Contiene estrictamente las dependencias de *runtime* (FastAPI, SQLAlchemy, Elasticsearch, Argon2, etc.).
* `requirements-dev.txt`: Importa las librerías de producción y añade las herramientas necesarias para la integración continua (pytest, coverage).
Se han purgado drivers no utilizados como `psycopg2`.

### 4. Estrategia de Testing (Mocks)
Para evitar la necesidad de levantar un clúster de Elasticsearch en los runners de GitHub Actions, se ha decidido emplear técnicas de *mocking* (`unittest.mock.patch`) en los tests unitarios del Agente Monitor. Esto permite simular respuestas exitosas y errores del clúster manteniendo alta velocidad de ejecución y fiabilidad.

## Consecuencias

* **Positivas:**
    * Infraestructura alineada al 100% con el documento de diseño arquitectónico.
    * Base de datos relacional más ligera al delegar el almacenamiento masivo de texto a un motor especializado.
    * Entorno de producción más seguro y ligero gracias a la separación de dependencias.
* **Negativas:** La arquitectura ahora depende de dos servicios de persistencia distintos simultáneamente, aumentando ligeramente la complejidad operativa local.
* **Riesgos y Mitigación:** La falta de Elasticsearch en los tests automatizados podría enmascarar errores de integración. Como mitigación, los esquemas de los documentos JSON se tipan estrictamente antes de ser enviados al mock durante los tests.