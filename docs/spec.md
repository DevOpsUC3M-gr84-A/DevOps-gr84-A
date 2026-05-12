# Documento Maestro de Especificaciones — NewsRadar

**Proyecto:** NewsRadar — sistema de monitorización inteligente de fuentes RSS y generación de alertas clasificadas según el estándar IPTC Media Topics.
**Equipo:** DevOps-gr84-A
**Versión del documento:** 1.0
**Última actualización:** 2026-05-12

---

## 1. Introducción

Este documento consolida los **requisitos funcionales (RF)** y **no funcionales (RNF)** del sistema NewsRadar, así como sus **casos de uso principales**. Constituye la referencia única de especificaciones del proyecto y sustituye, a efectos de lectura, al desglose disperso en [docs/requirements/requirements.csv](requirements/requirements.csv), que se mantiene como fuente de datos importable hacia la plataforma de gestión de incidencias (GitHub Issues).

### 1.1 Alcance

NewsRadar es una aplicación web compuesta por:

- Un **backend** REST implementado en FastAPI (Python 3.11).
- Un **frontend** SPA implementado en React + TypeScript + Vite.
- Una **capa de persistencia** sobre PostgreSQL 15, complementada con Elasticsearch para búsqueda textual.
- Un **pipeline de evaluación automatizada** orquestado con Docker Compose y GitHub Actions.

El sistema permite a usuarios con rol *Gestor* dar de alta alertas sobre descriptores y canales RSS, y a usuarios con rol *Lector* consumir las noticias clasificadas. La clasificación se realiza dentro del estándar **IPTC Media Topics** de primer nivel.

### 1.2 Definiciones y siglas

| Término | Definición |
|---------|------------|
| **RF**  | Requisito Funcional |
| **RNF** | Requisito No Funcional |
| **IPTC**| International Press Telecommunications Council — taxonomía de categorías informativas |
| **ADR** | Architecture Decision Record |
| **RBAC**| Role-Based Access Control |
| **CI/CD** | Integración Continua / Entrega Continua |

### 1.3 Referencias normativas

- Arquitectura de cinco capas — ver [architecture.md](architecture.md) y [[ADR-001-arquitectura-5-capas]].
- Despliegue y CI/CD — ver [deployment.md](deployment.md).
- Catálogo completo de decisiones — ver [docs/ADRs/](ADRs/).

---

## 2. Requisitos Funcionales

| ID    | Título                          | Descripción                                                                                                                                                                                                                  | Prioridad | Sprint |
|-------|---------------------------------|------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------|-----------|--------|
| RF01  | Gestión de alertas              | El sistema monitoriza los descriptores de las alertas mediante un proceso continuo definido por una expresión cron. Al detectar una noticia, se almacena y se envía al módulo de clasificación.                              | Alta      | 2      |
| RF02  | Permisos del Gestor             | El sistema permite a un Gestor dar de alta alertas especificando un nombre y una palabra clave.                                                                                                                              | Media     | 3      |
| RF03  | Limitaciones del Gestor         | El sistema restringe el máximo de alertas por Gestor a 20.                                                                                                                                                                   | Media     | 3      |
| RF04  | Clasificación de alertas        | El sistema obliga a clasificar cada alerta dentro del estándar IPTC Media Topics.                                                                                                                                            | Media     | 3      |
| RF05  | Cantidad de recomendaciones     | El sistema recomienda entre 3 y 10 palabras extra (sinónimos o relacionadas) al introducir la palabra clave de una alerta.                                                                                                   | Baja      | 3      |
| RF06  | Acciones del usuario            | El sistema permite al usuario aceptar o rechazar manualmente las recomendaciones de palabras extra.                                                                                                                          | Baja      | 3      |
| RF07  | Canales de las alertas          | El sistema permite al usuario seleccionar canales RSS específicos para la alerta; por omisión asigna todos los de su misma categoría.                                                                                        | Media     | 3      |
| RF08  | Clasificación de noticias       | El sistema clasifica cada noticia candidata según la categoría IPTC de la alerta (exclusivamente de primer nivel) o, en su defecto, la del canal RSS origen.                                                                 | Alta      | 3      |
| RF09  | Generación de notificaciones    | El sistema genera una notificación cuando detecta una noticia que coincide con los criterios de una alerta.                                                                                                                  | Media     | 4      |
| RF10  | Configuración de notificaciones | La alerta se puede configurar para enviar notificaciones al buzón interno de la aplicación o al correo electrónico del usuario.                                                                                              | Alta      | 4      |
| RF11  | Título de las notificaciones    | El título de la notificación sigue el formato: `Actualización de <alerta> en <día/hora>`.                                                                                                                                    | Baja      | 4      |
| RF12  | Contenido de las notificaciones | El cuerpo de la notificación incluye: origen, fecha/hora, título de la noticia y resumen del RSS.                                                                                                                            | Baja      | 4      |
| RF13  | Creación de canales             | El sistema permite a un Gestor dar de alta canales RSS asociados a un medio de comunicación y a una categoría IPTC.                                                                                                          | Media     | 2      |
| RF14  | Gestión de fuentes RSS          | El sistema incluye por defecto al menos 100 canales RSS de 10 medios distintos, cubriendo cada categoría de primer nivel IPTC.                                                                                               | Alta      | 2      |
| RF15  | Gestión de usuarios             | Dos roles: *Gestor* y *Lector*. Atributos: email, nombre, apellidos, organización. Verificación de email con caducidad de 24 h. Admin inicial que asigna roles. Recuperación de contraseña. El Lector accede a toda la plataforma excepto la gestión de alertas y fuentes. | Alta      | 1      |
| RF16  | Panel de mando                  | Nube de palabras por categoría; estadísticas (nº fuentes, noticias, noticias/categoría, alertas, alertas/categoría); CRUD de alertas y fuentes; gestión de perfil; soporte bilingüe ES/EN únicamente en la UI.                | Media     | 4      |

---

## 3. Requisitos No Funcionales

| ID     | Título                                      | Descripción                                                                                                                                                                                                                       | Categoría        | Prioridad |
|--------|---------------------------------------------|-----------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------|------------------|-----------|
| RNF01  | Arquitectura de cinco capas                 | El sistema debe basarse en cinco capas obligatorias: gestor de datos para información, gestor de datos para entidades, lógica de negocio, API REST y capa de visualización.                                                       | Arquitectura     | Alta      |
| RNF02  | Diseño basado en API REST                   | Toda la comunicación y la gestión de información debe realizarse a través de una API REST.                                                                                                                                        | Arquitectura     | Alta      |
| RNF03  | Documentación de la API                     | Toda la API REST debe documentarse usando OpenAPI.                                                                                                                                                                                | Documentación    | Media     |
| RNF04  | Configuración con Docker                    | El software y su entorno deben configurarse mediante Docker (o herramienta equivalente).                                                                                                                                          | Infraestructura  | Alta      |
| RNF05  | Automatización de la configuración          | Deben existir mecanismos para automatizar la configuración de todas las herramientas tecnológicas utilizadas.                                                                                                                     | Infraestructura  | Alta      |
| RNF06  | Integración Continua (CI)                   | Las pruebas (unitarias y funcionales) deben ejecutarse automáticamente cada vez que se integre nuevo código en el repositorio.                                                                                                    | CI/CD            | Alta      |
| RNF07  | Cobertura de pruebas                        | Es obligatorio cubrir un mínimo de pruebas unitarias y funcionales del sistema. Opcionalmente, pruebas de rendimiento.                                                                                                            | Calidad / Test   | Alta      |
| RNF08  | Métricas de calidad del código              | El sistema debe proporcionar de forma automática métricas sobre el código fuente (p. ej. SonarQube/SonarCloud).                                                                                                                    | Calidad          | Media     |
| RNF09  | Empaquetado y distribución (CD)             | El sistema debe empaquetarse automáticamente para su distribución, generando los artefactos necesarios.                                                                                                                           | CI/CD            | Alta      |
| RNF10  | Pipeline reproducible de evaluación         | El repositorio debe permitir a un evaluador construir, probar, generar documentación y cobertura, desplegar en entorno limpio y ejecutar la aplicación con un único comando, sin intervención manual adicional.                   | CI/CD            | Alta      |
| RNF11  | Documentación versionada y trazable         | Toda la documentación debe estar versionada junto al código, generarse automáticamente cuando sea posible y mantener trazabilidad cruzada con requisitos, ADRs, componentes, pruebas y los prompts utilizados para generar código.| Documentación    | Media     |

---

## 4. Casos de Uso Principales

Los casos de uso se identifican como **CU-NN** y trazan a los requisitos funcionales que satisfacen.

### CU-01 — Registro y verificación de usuario

- **Actor primario:** Usuario anónimo.
- **Requisitos relacionados:** RF15.
- **Precondición:** Servicio SMTP operativo.
- **Flujo principal:**
  1. El usuario se registra aportando email, nombre, apellidos y organización.
  2. El sistema envía un correo de verificación con un token válido durante 24 horas.
  3. El usuario hace clic en el enlace antes de la expiración.
  4. El sistema marca la cuenta como verificada y permite el inicio de sesión.
- **Flujo alternativo:** Si transcurren más de 24 horas, el token caduca y el usuario debe reiniciar el registro.

### CU-02 — Alta de alerta por un Gestor

- **Actor primario:** Usuario con rol *Gestor* autenticado.
- **Requisitos relacionados:** RF02, RF03, RF04, RF05, RF06, RF07.
- **Precondición:** El gestor tiene menos de 20 alertas activas.
- **Flujo principal:**
  1. El gestor introduce nombre y palabra clave.
  2. El sistema sugiere entre 3 y 10 palabras relacionadas.
  3. El gestor acepta o rechaza individualmente cada recomendación.
  4. El gestor selecciona la categoría IPTC de primer nivel.
  5. El gestor confirma los canales RSS asociados (todos los de la categoría por defecto).
  6. El sistema persiste la alerta y la incorpora al ciclo de monitorización cron.

### CU-03 — Monitorización y notificación

- **Actor primario:** Scheduler (proceso interno).
- **Requisitos relacionados:** RF01, RF08, RF09, RF10, RF11, RF12.
- **Precondición:** Existen alertas activas y canales RSS configurados.
- **Flujo principal:**
  1. El scheduler ejecuta el ciclo según la expresión cron configurada.
  2. Para cada alerta, recorre sus canales y extrae las noticias nuevas.
  3. El módulo de clasificación asigna la categoría IPTC de primer nivel.
  4. Cuando una noticia coincide con los descriptores, se genera una notificación con el formato definido en RF11/RF12.
  5. La notificación se entrega al buzón interno o al correo del usuario, según la configuración de la alerta.

### CU-04 — Gestión de fuentes RSS

- **Actor primario:** Usuario con rol *Gestor*.
- **Requisitos relacionados:** RF13, RF14.
- **Flujo principal:**
  1. El gestor da de alta un nuevo canal RSS asociándolo a un medio y a una categoría IPTC.
  2. El sistema valida la URL y normaliza el feed.
  3. El canal queda disponible para ser asignado a futuras alertas.
- **Nota:** El sistema arranca con un seed automático de ≥100 canales de ≥10 medios cubriendo todas las categorías IPTC de primer nivel (RF14).

### CU-05 — Consulta del panel de mando

- **Actor primario:** Usuario autenticado (*Gestor* o *Lector*).
- **Requisitos relacionados:** RF16.
- **Flujo principal:**
  1. El usuario accede al panel de mando.
  2. El sistema muestra nube de palabras y estadísticas agregadas (fuentes, noticias, alertas) y sus desgloses por categoría.
  3. El *Lector* puede consultar pero no editar alertas ni fuentes; el *Gestor* dispone de las acciones CRUD correspondientes.
  4. El usuario puede conmutar el idioma de la UI entre ES y EN.

### CU-06 — Evaluación automatizada del proyecto

- **Actor primario:** Evaluador externo.
- **Requisitos relacionados:** RNF04, RNF05, RNF06, RNF07, RNF09, RNF10.
- **Precondición:** Docker Desktop instalado.
- **Flujo principal:**
  1. El evaluador clona la release y ejecuta `make evaluate` (o `bash evaluate.sh`).
  2. El script reconstruye imágenes, levanta el stack completo con `docker compose`, espera a que los servicios respondan y ejecuta `pytest --cov`.
  3. Al finalizar se publican las URLs de frontend, API y Swagger, junto con el informe HTML de cobertura.

---

## 5. Trazabilidad

La trazabilidad entre requisitos, ADRs y componentes se mantiene de forma cruzada:

| Requisito        | ADRs principales                                                                 | Componente / Módulo                                    |
|------------------|----------------------------------------------------------------------------------|--------------------------------------------------------|
| RF01, RF08       | [[ADR-014-gestion-alertas]], [[ADR-018-resiliencia-scheduler-y-ciclo-vida]], [[ADR-022-clasificacion-noticias]] | `app/services/agents/alert_monitor_agent.py`           |
| RF04, RF08       | [[ADR-012-clasificacion-iptc]]                                                   | `app/services/workflows/classification_workflow.py`    |
| RF05, RF06       | [[ADR-016-gestion-acciones-recomendaciones]]                                     | `newsradar_ui/src/components/AlertForm.tsx`            |
| RF13, RF14       | [[ADR-008-seed-datos-rss]]                                                       | `app/services/rss_service.py`, `rss_seed.json`         |
| RF15             | [[ADR-006-api-rest-usuarios]], [[ADR-020-recuperacion-contrasena]], [[ADR-021-sistema-de-verificacion-de-cuenta-por-email-24h]] | `app/services/user_service.py`                         |
| RF16             | [[ADR-010-arquitectura-frontend]], [[ADR-027-internacionalizacion-i18n]]         | `newsradar_ui/src/pages/Dashboard.tsx`                 |
| RNF01            | [[ADR-001-arquitectura-5-capas]]                                                 | Estructura global                                      |
| RNF02, RNF03     | [[ADR-024-fastapi]]                                                              | `app/api/routes/*`                                     |
| RNF04, RNF09     | [[ADR-002-docker]], [[ADR-017-estrategia-empaquetado-docker]]                    | `docker-compose.yml`, Dockerfiles                      |
| RNF06, RNF08     | [[ADR-003-ci-actions]], [[ADR-007-sonarcloud]]                                   | `.github/workflows/`                                   |
| RNF10            | [[ADR-026-automatizacion-evaluacion-y-entregas]]                                 | `evaluate.sh`, `Makefile`                              |
| RNF11            | [[ADR-004-mkdocs]]                                                               | `mkdocs.yml`, `docs/`                                  |
