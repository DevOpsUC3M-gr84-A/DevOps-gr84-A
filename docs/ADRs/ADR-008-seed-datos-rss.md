# ADR 008: Estrategia de Carga de Datos Iniciales (Seed) para Fuentes RSS

**Estado:** Aceptado  
**Fecha:** 2026-03-23  
**Autores:** Equipo DevOps-gr84-A  

## 1. Contexto
El requisito **RF14** exige que el sistema incluya por defecto al menos 100 canales RSS provenientes de 10 medios de comunicación distintos, cubriendo todas las categorías de primer nivel del estándar IPTC Media Topics. Necesitamos una estrategia para almacenar y cargar esta información inicial en el sistema.

## 2. Alternativas consideradas
- **Hardcoding (Código fuente):** Escribir los 100 diccionarios directamente en `init_db.py` o `router.py`. Hace el código inmanejable y difícil de mantener.
- **Consultas SQL de inserción (INSERT INTO):** Depende de la base de datos específica y rompe la abstracción del ORM (SQLAlchemy).
- **Archivo JSON (Data Seed):** Almacenar los datos iniciales en un archivo `.json` independiente y crear un script para generarlo/leerlo.

## 3. Decisión
Se ha decidido utilizar el enfoque de **Archivo JSON (Data Seed)**. 
Se desarrollará un script generador (`generate_rss_seed.py`) que creará dinámicamente un archivo `rss_seed.json`. Este archivo actuará como la única "Fuente de la Verdad" para las fuentes de información por defecto. Cuando los modelos ORM de bases de datos estén listos, el script `init_db.py` simplemente leerá este JSON y poblará la base de datos de forma agnóstica.

## 4. Consecuencias
- **Positivas:** Separación clara entre datos (JSON) y lógica de negocio (Python). Permite a los desarrolladores modificar o ampliar la lista de periódicos sin tocar código crítico.
- **Negativas:** Requiere un paso adicional de lectura/parseo del archivo durante el arranque inicial (startup) de la aplicación.