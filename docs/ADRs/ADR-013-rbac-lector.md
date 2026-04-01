# ADR 013: Control de Acceso Basado en Roles para el rol Lector

## 1. Estado

Aceptado

## 2. Contexto

El requisito **RF17** establece que el rol **Lector** puede acceder a toda la plataforma salvo la gestión de alertas y fuentes. En otras palabras:

- El usuario con rol `Lector` debe poder consultar datos mediante endpoints `GET`.
- El usuario con rol `Lector` no debe poder crear, modificar ni eliminar alertas ni fuentes.

## 3. Decisión

Se ha decidido implementar RBAC en la capa de dependencias de FastAPI usando una dependencia centralizada que verifica los roles del usuario autenticado.

- Se introduce `get_current_gestor` en `newsradar_api/app/utils/deps.py`.
- Este dependency permite el acceso solo a usuarios con roles de gestión (`Gestor`, `admin`, `manager`).
- Se mantiene `get_current_user` para permisos de lectura general.

Se aplica el control de acceso en los endpoints de gestión:

- `newsradar_api/app/api/routes/alerts.py`
  - `POST /users/{user_id}/alerts`
  - `PUT /users/{user_id}/alerts/{alert_id}`
  - `DELETE /users/{user_id}/alerts/{alert_id}`
- `newsradar_api/app/api/routes/information_sources.py`
  - `POST /information-sources`
  - `PUT /information-sources/{source_id}`
  - `DELETE /information-sources/{source_id}`
- `newsradar_api/app/api/routes/rss_channels.py`
  - Se añade la misma restricción a la creación, actualización y borrado de canales RSS vinculados a fuentes.

También se añade un usuario semilla con rol `Lector` y un rol `Gestor` para permitir pruebas funcionales reales.

## 4. Consecuencias

- **Positivas:**
  - RF17 queda implementado de manera centralizada, manteniendo la lógica de autorización limpia y reutilizable.
  - El rol `Lector` conserva acceso de solo lectura a las rutas de alertas y fuentes.
  - Se mejora la seguridad de los endpoints de gestión.

- **Negativas:**
  - El sistema de roles en memoria conserva la flexibilidad, pero requiere cuidados si se migra a un modelo de base de datos relacional completo.
  - El cambio de nombres de roles (`Gestor`, `Lector`) puede necesitar sinónimos adicionales si se integran roles heredados con nombres en inglés.
