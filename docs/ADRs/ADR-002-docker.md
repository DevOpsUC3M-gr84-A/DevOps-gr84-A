# ADR 002: Contenerización del Entorno con Docker

**Estado:** Aceptado  
**Fecha:** 2026-03-21  
**Autores:** Equipo DevOps-gr84-A  

## 1. Contexto
Para evitar el clásico problema de "en mi máquina funciona", necesitamos asegurar que todos los desarrolladores y los entornos de evaluación ejecuten el código bajo las mismas condiciones de sistema operativo y dependencias (RNF04).

## 2. Alternativas consideradas
- Entornos virtuales locales de Python (`venv` o `conda`).
- Máquinas virtuales completas (Vagrant).
- **Contenedores ligeros (Docker + Docker Compose)**.

## 3. Decisión
Se adopta **Docker** como herramienta de contenerización utilizando imágenes oficiales y ligeras (`python:3.11-slim`). La orquestación local se gestionará mediante **Docker Compose**, configurando volúmenes locales para permitir el *hot-reload* durante el desarrollo sin necesidad de reconstruir las imágenes constantemente.

## 4. Consecuencias
- **Positivas:** Aislamiento total de dependencias, despliegue con un solo comando y estandarización del entorno.
- **Negativas:** Curva de aprendizaje inicial para el equipo y consumo extra de recursos en las máquinas locales.