# ADR 003: Persistencia SQL con SQLAlchemy y Seguridad con Argon2

## Estado
Aceptado

## Contexto
El sistema NewsRadar utilizaba inicialmente un almacenamiento volátil en memoria (listas y diccionarios de Python). Esto impedía la persistencia de datos tras reiniciar el servidor y dificultaba la implementación del Agente de Monitorización (RF01), el cual requiere consultar alertas y canales de forma recurrente. Además, se detectaron fallos de compatibilidad con la librería `bcrypt` en entornos Windows durante el desarrollo.

## Decisiones

1. **Migración a SQLAlchemy (SQLite):** Se ha implementado un sistema de persistencia basado en SQLAlchemy ORM utilizando SQLite como motor de base de datos inicial para facilitar el desarrollo local y las pruebas integradas.
2. **Eliminación de Memory Stores:** Se han suprimido todos los módulos de almacenamiento en memoria (`app/stores/memory.py` y similares) en favor de modelos de base de datos relacionales con integridad referencial (Foreign Keys).
3. **Cambio a Argon2 para Hashing:** Se ha sustituido `passlib[bcrypt]` por `argon2_cffi` para el hashing de contraseñas. Argon2 es el ganador del Password Hashing Competition y ofrece mejor resistencia a ataques de GPU, además de eliminar errores de compilación en Windows.
4. **Arquitectura de Tests Anti-Bloqueo:** Se ha rediseñado la suite de tests para evitar "Deadlocks" en SQLite, eliminando aperturas manuales de sesiones en tests de integración y delegando la gestión de base de datos exclusivamente al `TestClient` de FastAPI y mocks unitarios.

## Consecuencias

* **Positivas:** Los datos (usuarios, alertas, noticias) sobreviven a los reinicios. El agente de monitorización puede operar de forma autónoma consultando la DB. La cobertura de tests ha subido al 80% global y >95% en los módulos core.
* **Negativas:** La ejecución de tests es ligeramente más lenta debido al coste computacional intencionado de Argon2.
* **Riesgos:** La concurrencia de escritura en SQLite es limitada; para el despliegue en producción será mandatorio el salto a PostgreSQL (preparado en la capa de modelos).