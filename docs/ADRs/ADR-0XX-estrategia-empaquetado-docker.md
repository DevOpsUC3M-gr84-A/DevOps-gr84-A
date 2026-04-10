# ADR 0XX: Estrategia de Empaquetado y Distribución del Backend con Docker

## 1. Contexto
En preparación para el despliegue en entornos Cloud (Sprint 4), necesitamos aislar el entorno de ejecución de la API de FastAPI del entorno local del desarrollador. Es necesario definir un formato de empaquetado estándar, seguro y optimizado que se integre con nuestros flujos de Integración y Entrega Continua (CI/CD), asegurando que el código funcione igual en desarrollo, pruebas y producción.

## 2. Decisión
Se ha decidido adoptar **Docker** como estándar de contenedorización para el backend, implementando las siguientes estrategias:
1. **Multi-stage Build:** Utilizar una imagen base `python:3.11-slim` separando el proceso en dos fases: un `builder` que compila las dependencias (`wheels`) y un entorno de ejecución (`runtime`) que solo copia los artefactos compilados.
2. **Hardening de Seguridad:** El contenedor se ejecutará bajo un usuario sin privilegios (`appuser`) y no como `root`.
3. **Orquestación Local:** Se utilizará `docker-compose` para definir los servicios, inyectando la configuración (CORS, URLs de base de datos) mediante variables de entorno.
4. **Distribución Automática:** Se integrará un workflow de GitHub Actions que construirá y publicará la imagen en **GitHub Container Registry (GHCR)** con cada integración en la rama principal.

## 3. Consecuencias

### Positivas:
* **Reducción de tamaño:** La imagen final es significativamente más pequeña y libre de herramientas de compilación innecesarias.
* **Seguridad:** Cumplimiento de las mejores prácticas de contenedores al evitar la ejecución como root.
* **Consistencia:** Se elimina el problema de "en mi máquina funciona".
* **Preparación para la Nube:** El artefacto generado es directamente desplegable en servicios Cloud (AWS ECS, Azure App Service, Render, etc.).

### Negativas / Riesgos:
* **Curva de aprendizaje:** Los desarrolladores necesitan tener Docker instalado para probar el entorno orquestado de forma completa.
* **Gestión de Secretos:** La adopción de contenedores obliga a un manejo estricto de las variables de entorno en producción (evitando hardcodear contraseñas en el código).