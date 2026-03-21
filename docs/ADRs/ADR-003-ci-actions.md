# ADR 003: Integración Continua con GitHub Actions

**Estado:** Aceptado  
**Fecha:** 2026-03-21  
**Autores:** Equipo DevOps-gr84-A  

## 1. Contexto
A medida que el equipo comience a programar en paralelo, existe el riesgo de introducir código con errores de sintaxis o que rompa funcionalidades existentes al fusionarse en la rama principal (RNF06).

## 2. Alternativas consideradas
- Servidor Jenkins autogestionado.
- GitLab CI (Requeriría migrar el repositorio).
- **GitHub Actions**.

## 3. Decisión
Se ha decidido implementar el pipeline de Integración Continua utilizando **GitHub Actions**. El workflow analizará estáticamente el código con `flake8` y ejecutará la suite de pruebas con `pytest` cada vez que se abra o actualice una *Pull Request* hacia la rama `main`.

## 4. Consecuencias
- **Positivas:** Feedback inmediato sobre la calidad del código, prevención de bugs en producción e integración nativa y gratuita con nuestro repositorio actual.
- **Negativas:** Acoplamiento fuerte al ecosistema (vendor lock-in) de Microsoft/GitHub.