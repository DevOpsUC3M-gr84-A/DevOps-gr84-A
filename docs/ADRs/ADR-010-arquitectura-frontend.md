# ADR 010: Arquitectura de Carpetas y Separación de Responsabilidades en React

**Estado:** Aceptado  
**Fecha:** 2026-03-30  
**Autores:** Equipo DevOps-gr84-A  

## 1. Contexto
A medida que la aplicación crece (añadiendo la página de Gestión de Alertas, configuración, dashboard, etc.), mantener toda la lógica, el estado y el maquetado visual en archivos monolíticos como `App.tsx` o en una estructura plana generaría "código espagueti". Esto haría que el código fuera difícil de leer, testear y escalar por múltiples desarrolladores.

## 2. Alternativas consideradas
- **Estructura plana (todo en `src/`):** Rápida para empezar, pero insostenible a partir de los 10 archivos.
- **Arquitectura agrupada por Feature (ej. `src/alerts/`):** Muy buena para dominios complejos, pero excesiva para el tamaño actual del proyecto, pudiendo generar duplicidad de código en componentes compartidos como botones o modales.
- **Arquitectura separada por Responsabilidad Técnica:** Agrupar los archivos según su función (páginas, componentes visuales, lógica).

## 3. Decisión
Se establece utilizar la **Arquitectura separada por Responsabilidad Técnica** mediante la siguiente estructura de directorios dentro de `src/`:
- `/pages`: Componentes de vista principal (ej. `AlertsManagement.tsx`). Actúan como orquestadores, realizando llamadas a la API y gestionando el estado global de esa vista.
- `/components`: Componentes visuales y aislados (ej. `AlertForm.tsx`). Reciben datos y callbacks a través de props.
- `/hooks`: Lógica de estado y efectos reutilizable (ej. `useAlertModal.ts`).

## 4. Consecuencias
- **Positivas:** `App.tsx` queda limpio, actuando únicamente como esqueleto (Layout) y enrutador. Los componentes pequeños son mucho más fáciles de testear de forma unitaria. La lógica de negocio se puede reutilizar.
- **Negativas:** Obliga a los desarrolladores a pensar dónde ubicar cada pieza de código antes de programar, requiriendo disciplina para no romper la convención establecida.