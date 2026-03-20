# ADR 01: Adopción de una Arquitectura de 5 Capas

**Estado:** Propuesto  
**Fecha:** 2026-03-20  
**Autores:** Equipo DevOps-gr84-A  

## Contexto
El sistema NEWSRADAR requiere una estructura robusta que permita la escalabilidad, el mantenimiento sencillo y la separación clara de responsabilidades entre la ingesta de datos (RSS), el procesamiento (IA) y la visualización.

## Decisión
Hemos decidido implementar una arquitectura basada en **5 capas obligatorias** (según el requisito RNF01):
1. **Gestor de datos para información:** Persistencia y acceso a datos brutos.
2. **Gestor de datos para entidades:** Modelado de objetos de negocio.
3. **Lógica de negocio:** Reglas de clasificación y procesamiento de alertas.
4. **API REST:** Interfaz de comunicación estándar.
5. **Capa de visualización:** Interfaz de usuario para gestores y lectores.

## Consecuencias
* **Positivas:** * Facilita el desarrollo en paralelo (Frontend vs Backend).
    * Permite cambiar la base de datos o la lógica de IA sin afectar a la interfaz.
* **Negativas:** * Mayor complejidad inicial en la estructura de carpetas y flujo de datos.