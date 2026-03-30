# ADR 012: Clasificación IPTC de Categorías de Noticias (RF04)
**Estado:** Aceptado  
**Fecha:** 2026-03-30  
**Autores:** Equipo DevOps-gr84-A  
## 1. Contexto
El sistema necesita clasificar las categorías de noticias según estándares periodísticos internacionales para garantizar la interoperabilidad con otras plataformas de medios. Sin un estándar de clasificación común, cada instancia del sistema usaría taxonomías propias, dificultando la integración y el intercambio de contenidos (RNF04). 
## 2. Alternativas consideradas
- **Taxonomía propia ad-hoc:** Crear una lista de categorías personalizada. Descartada porque no es interoperable y requiere mantenimiento manual.
- **NewsML G2 / rNews:** Estándares alternativos del sector. Más complejos de implementar y con menor adopción que IPTC en el contexto europeo.
- **IPTC Media Topic como catálogo externo obligatorio:** Vincular siempre una categoría a un código IPTC. Descartado para no romper la compatibilidad con categorías ya existentes en el sistema.
- **IPTC Media Topic como campo opcional con validación:** Permite adopción gradual sin romper el contrato actual de la API. 
## 3. Decisión
Se adopta el estándar **IPTC Media Topic** como sistema de clasificación de categorías. Los campos `iptc_code` e `iptc_label` se añaden como campos **opcionales** al modelo `Category`. 
El catálogo oficial de códigos válidos reside en `app/core/iptc_categories.py` como única fuente de verdad. Cuando se proporciona un `iptc_code` al crear o actualizar una categoría, el sistema valida que pertenezca al catálogo; en caso contrario devuelve HTTP 422. 
Se expone además el endpoint `GET /api/v1/iptc-categories` para que los clientes puedan consultar el catálogo completo sin necesidad de embeber la lista en el frontend. 
## 4. Consecuencias
- **Positivas:**
  - Las categorías son ahora interoperables con cualquier sistema que entienda IPTC, estándar ampliamente adoptado en la industria periodística.
  - La validación centralizada en el backend evita que entren códigos inválidos independientemente del cliente que consuma la API.
  - La opcionalidad de los campos mantiene compatibilidad total con categorías previas y no requiere migración de datos.
- **Negativas:**
  - El catálogo IPTC embebido en `iptc_categories.py` es estático; si IPTC actualiza su taxonomía, habrá que actualizar el fichero manualmente.
  - Los desarrolladores deben conocer el estándar IPTC para asignar códigos correctamente al crear categorías desde el frontend.
