# ADR 001: Adopción de Arquitectura de 5 Capas

**Estado:** Aceptado  
**Fecha:** 2026-03-21  
**Autores:** Equipo DevOps-gr84-A  

## 1. Contexto
El sistema NEWSRADAR requiere una estructura robusta que permita la escalabilidad, el mantenimiento sencillo y la separación clara de responsabilidades entre la ingesta de datos (RSS), el procesamiento inteligente (IA) y la interfaz de usuario.

## 2. Alternativas consideradas
- Arquitectura monolítica tradicional (MVC acoplado).
- Arquitectura de microservicios (Descartada por exceso de complejidad inicial para el tamaño del equipo).
- **Arquitectura de 5 capas (Monolito Modular)**.

## 3. Decisión
Hemos decidido implementar una arquitectura basada en **5 capas obligatorias** (cumpliendo el RNF01):
1. **Gestor de datos para información:** Persistencia y acceso a datos brutos.
2. **Gestor de datos para entidades:** Modelado de objetos de negocio.
3. **Lógica de negocio:** Reglas de clasificación y procesamiento de alertas.
4. **API REST:** Interfaz de comunicación estándar.
5. **Capa de visualización:** Interfaz de usuario para gestores y lectores.

## 4. Consecuencias
- **Positivas:** Facilita el desarrollo en paralelo (Frontend vs Backend) y permite cambiar tecnologías internas (ej. la BD) sin afectar a la interfaz.
- **Negativas:** Introduce una mayor complejidad inicial en la estructura de carpetas y requiere mapeo de datos entre capas.