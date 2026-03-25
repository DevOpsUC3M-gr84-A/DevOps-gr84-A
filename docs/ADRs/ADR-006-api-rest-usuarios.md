# ADR 006: Diseño de la API REST Modular y Gestión de Usuarios

**Estado:** Aceptado  
**Fecha:** 2026-03-23  
**Autores:** Equipo DevOps-gr84-A  

## 1. Contexto
Para dar cumplimiento al **RNF02** (Diseño basado en API REST) y al **RF15** (Gestión de Usuarios), necesitamos definir las reglas de arquitectura y las tecnologías específicas que gobernarán la comunicación de nuestro backend, la persistencia de datos relacionales y la lógica de autenticación/autorización (Roles de Gestor y Lector).

## 2. Alternativas consideradas
- **Enrutamiento:** Un único archivo `main.py` monolítico vs. Enrutadores modulares (`APIRouter`).
- **Acceso a datos:** Consultas SQL en crudo (raw SQL) vs. Uso de un ORM (Object-Relational Mapping).
- **Lógica de negocio:** Controladores que gestionen todo vs. Capa de servicios independiente.

## 3. Decisión
Se ha decidido implementar el siguiente estándar de diseño arquitectónico para la API, respetando la arquitectura de 5 capas (ADR-001):

1. **Capa 4 - API REST (FastAPI & Pydantic):** - Se utilizará **FastAPI** implementando el paradigma de Monolito Modular mediante `APIRouter`. Todo el tráfico colgará del prefijo de versionado estandarizado `/api/v1`.
   - La validación de los datos de entrada/salida se realizará estrictamente mediante modelos de **Pydantic** (`BaseModel`).

2. **Capa 2 - Gestor de Entidades (SQLAlchemy ORM):**
   - Se adopta **SQLAlchemy** como ORM principal (`database.py`) para interactuar con la base de datos (PostgreSQL/SQLite).
   - Se han modelado las entidades iniciales como `User`, definiendo los roles (`GESTOR`, `LECTOR`) mediante `Enum` de Python.
   - *Nota de transición:* Mientras se migran todas las entidades a base de datos, el resto de dominios (Alertas, RSS, Notificaciones) utilizarán almacenamiento en memoria (Mock DB) temporalmente.

3. **Capa 3 - Lógica de Negocio y Seguridad (Servicios):**
   - La lógica compleja (como la validación de la caducidad del correo de verificación en 24 horas requerida en el RF15) se aísla en archivos de servicio (`user_service.py`).
   - Las contraseñas nunca se guardan en texto plano; se utiliza **Passlib (Bcrypt)** para la generación de hashes.
   - Se ha creado un script de inicialización (`init_db.py`) que garantiza la creación automática de un administrador `GESTOR` inicial (Admin) en el primer despliegue.

## 4. Consecuencias
- **Positivas:** - Cumplimiento estricto del RNF02 y RF15.
  - El uso de `Depends()` en FastAPI para inyectar la sesión de base de datos (`get_db`) o verificar el usuario activo (`get_current_user`) hace que los *endpoints* sean muy limpios y seguros.
  - La separación de la base de datos y la lógica de negocio facilita las futuras pruebas unitarias.
- **Negativas:** - Añade una curva de aprendizaje inicial para los miembros del equipo menos familiarizados con SQLAlchemy y la inyección de dependencias de FastAPI.
  - Obliga a mapear constantemente los objetos de base de datos (SQLAlchemy) a esquemas de respuesta (Pydantic) antes de enviarlos al cliente.