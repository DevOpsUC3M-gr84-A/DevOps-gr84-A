# ADR 011: Estrategia de Testing en el Frontend e Integración Continua (CI)

**Estado:** Aceptado  
**Fecha:** 2026-03-30  
**Autores:** Equipo DevOps-gr84-A  

## 1. Contexto
Para garantizar la calidad de la interfaz de usuario, asegurar que los flujos críticos (como la creación de alertas) funcionan y evitar regresiones cuando se refactoriza el código, necesitamos establecer un estándar para las pruebas automatizadas en el frontend. Además, depender exclusivamente de que los desarrolladores ejecuten los tests localmente es un riesgo de fallo humano, por lo que necesitamos automatizar su ejecución.

## 2. Alternativas consideradas
- **Cypress / Playwright:** Herramientas excelentes para testing End-to-End (E2E). Sin embargo, son más lentas de ejecutar en pipelines de CI/CD. Se evaluarán en el futuro como complemento.
- **Ejecución manual exclusiva:** Descartada. Depender de la memoria del desarrollador para correr los tests antes de un *merge* inevitablemente lleva a introducir bugs en la rama principal.
- **Jest + React Testing Library integrados en GitHub Actions:** El estándar actual para tests unitarios/integración en React, fácilmente automatizables.

## 3. Decisión
Se ha adoptado **Jest** como motor de ejecución y **React Testing Library (RTL)** como herramienta para renderizar e interactuar con los componentes. 

Además, en consonancia con el `ADR-003` (sobre GitHub Actions), se decide **integrar la suite de tests del frontend en el pipeline de CI**. Se creará un workflow (`frontend-ci.yml`) que ejecutará `npm test` de forma obligatoria en cada Push y Pull Request hacia la rama `main`.

## 4. Consecuencias
- **Positivas:** - Fomenta escribir pruebas centradas en el comportamiento del usuario simulando las respuestas de la API (`mocking`).
  - GitHub Actions actuará como "guardián", bloqueando automáticamente cualquier Pull Request si los tests de React fallan, protegiendo la rama `main`.
- **Negativas:** - Los desarrolladores deben familiarizarse con la asincronía en los tests de React (`findBy`, `waitFor`).
  - Los tiempos de las GitHub Actions aumentarán ligeramente al tener que instalar dependencias de Node.js y correr los tests en cada PR, por lo que los desarrolladores tendrán que esperar unos minutos antes de poder hacer un merge.