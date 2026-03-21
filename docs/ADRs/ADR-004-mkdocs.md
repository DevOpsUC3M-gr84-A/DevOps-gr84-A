# ADR 004: Documentación como Código (Docs-as-Code) con MkDocs

**Estado:** Aceptado  
**Fecha:** 2026-03-21  
**Autores:** Equipo DevOps-gr84-A  

## 1. Contexto
El RNF11 exige que la documentación esté versionada junto al código, se genere automáticamente y mantenga referencias cruzadas reales con los componentes y la trazabilidad de los prompts de IA.

## 2. Alternativas consideradas
- Wiki nativa de GitHub (Difícil automatización y referencias cruzadas débiles).
- [cite_start]Pandoc para generación de PDFs (Poco interactivo para navegación web)[cite: 51].
- **MkDocs con el tema Material**.

## 3. Decisión
Se ha optado por **MkDocs** utilizando el tema `material`. Se implementa el paradigma *Docs-as-Code*, donde la documentación se escribe en Markdown y reside en el mismo repositorio que el código. Se utilizará la extensión `pymdownx.snippets` para inyectar bloques de código fuente real directamente en la documentación web.

## 4. Consecuencias
- **Positivas:** La documentación nunca se desincroniza del código fuente real y su lectura es altamente accesible mediante un sitio web estático.
- **Negativas:** Requiere ejecutar comandos de Python (`mkdocs serve`) para previsualizar los cambios localmente antes de subirlos.