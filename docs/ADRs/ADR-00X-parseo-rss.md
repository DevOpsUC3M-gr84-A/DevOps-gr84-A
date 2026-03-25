# ADR 009: Librería de Parseo para Fuentes RSS (RF01)

**Estado:** Aceptado  
**Fecha:** 2026-03-23  
**Autores:** Equipo DevOps-gr84-A  

## 1. Contexto
Para el requisito **[RF01] Gestión de alertas**, el sistema debe conectarse a Internet, descargar canales RSS en formato XML, parsearlos y extraer la información relevante (título, fecha, origen, resumen y link). Necesitamos decidir qué herramienta utilizar para procesar estos documentos de forma eficiente y tolerante a fallos.

## 2. Alternativas consideradas
- **xml.etree.ElementTree (Librería estándar):** Integrada en Python, pero requiere gestionar manualmente las diferencias de formato entre versiones de RSS (0.9, 1.0, 2.0) y Atom.
- **BeautifulSoup4:** Excelente para *web scraping* de HTML, pero pesada y poco semántica para feeds RSS estructurados.
- **Feedparser:** Librería externa especializada. Normaliza automáticamente cualquier formato RSS/Atom en un diccionario Python estándar, gestionando fechas, enlaces y codificaciones defectuosas.

## 3. Decisión
Se ha decidido adoptar la librería **`feedparser`** como el motor principal de ingesta de noticias. 
Se desarrollará un módulo aislado (Capa de Servicios) que recibirá una URL y una lista de descriptores (palabras clave), y devolverá una lista de noticias coincidentes normalizadas, abstrayendo a la base de datos de la complejidad del XML.

## 4. Consecuencias
- **Positivas:** Reducción drástica del tiempo de desarrollo y manejo de errores. El código será agnóstico al periódico del que provenga el RSS.
- **Negativas:** Introduce una nueva dependencia de terceros en el entorno virtual (`requirements.txt`) y en la imagen Docker.