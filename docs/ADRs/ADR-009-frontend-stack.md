# ADR 009: Elección del Stack Tecnológico para el Frontend

**Estado:** Aceptado  
**Fecha:** 2026-03-30  
**Autores:** Equipo DevOps-gr84-A  

## 1. Contexto
El proyecto NewsRadar requiere una interfaz de usuario interactiva, dinámica y mantenible para la gestión de alertas y visualización del dashboard. Necesitamos elegir un framework/librería y un lenguaje que nos permita escalar el proyecto de forma segura, minimizando errores en tiempo de ejecución y facilitando el trabajo en equipo desde el primer día.

## 2. Alternativas consideradas
- **Vue.js / Svelte:** Excelentes alternativas modernas, pero con un ecosistema de librerías de terceros (como las de iconos o componentes UI) ligeramente menor al de React.
- **JavaScript puro (Vanilla) / JQuery:** Descartados por su dificultad para mantener proyectos a gran escala, la falta de componentes reutilizables y la ausencia de tipado estático, lo que propicia errores en producción.

## 3. Decisión
Se ha decidido utilizar **React** como librería principal para la construcción de la interfaz, junto con **TypeScript** como lenguaje de programación. Esta combinación nos ofrece un ecosistema maduro y un tipado estricto que previene errores durante el desarrollo.

## 4. Consecuencias
- **Positivas:** TypeScript proporcionará seguridad de tipado, autocompletado en el IDE (ej. interfaces para los datos de la API) y prevención temprana de bugs. React permite un desarrollo basado en componentes reutilizables, acelerando la creación de nuevas pantallas.
- **Negativas:** Añade una ligera curva de aprendizaje inicial para los desarrolladores que no estén familiarizados con el tipado estricto de TypeScript o con el ciclo de vida de React. Requiere un paso de compilación/transpilación.