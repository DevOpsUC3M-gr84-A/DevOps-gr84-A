# ADR 021: Sistema de Verificación de Cuenta por Email (24h)

**Estado:** Aceptado  
**Fecha:** 2026-04-21  
**Autores:** Equipo DevOps-gr84-A  
**Issue relacionado:** [Backend] #76  

---

## 1. Contexto

El sistema requería un mecanismo de seguridad para evitar el acceso de usuarios con correos electrónicos falsos o no validados. El Ticket #76 exige que, tras el registro, la cuenta permanezca inactiva hasta que el usuario confirme su identidad mediante un enlace enviado a su email, el cual debe tener una validez estrictamente limitada en el tiempo.

---

## 2. Alternativas consideradas

| Alternativa                  | Descripción                                                                 | Descartada por                                                                 |
|----------------------------|-----------------------------------------------------------------------------|-------------------------------------------------------------------------------|
| Activación manual por Admin | Un gestor debe aprobar cada registro individualmente                        | No escala; mala experiencia de usuario                                       |
| Código OTP (6 dígitos)     | Enviar un código numérico para introducir en el frontend                    | Requiere mayor lógica de estado en el frontend; el enlace es más directo     |
| Token en BD (elegida)      | Generar un UUID vinculado al usuario y validar contra `created_at`          | Simplicidad y robustez; aprovecha la persistencia actual de SQL              |

---

## 3. Decisión

Se implementa un flujo de verificación asíncrono basado en tokens persistidos.

### Flujo Técnico

```text
Registro → User(is_verified=False, verification_token=UUID) → Envío Email
Usuario → POST /api/v1/auth/verify-email?token=<UUID> → Activa cuenta
Login   → Verifica is_verified == True → Emite JWT
```
## Componentes Modificados

### `app/models/user.py`
- Se añade el campo `is_verified` (Boolean, default `False`) para controlar el estado de la cuenta.
- Se añade `verification_token` (String) para almacenar el identificador único de activación.

### `app/services/user_service.py`
- `create_db_user`: Genera automáticamente un `uuid4()` como token y establece `is_verified=False`.
- `is_verification_expired`: Lógica central que compara `created_at` con el tiempo actual para asegurar la ventana de 24 horas.
- `verify_user_email`: Valida el token, comprueba la expiración y realiza el commit del cambio de estado a verificado.

### `app/utils/deps.py`
- Se modifica el inyector de dependencias `get_current_user` para que, tras validar el token JWT, compruebe el campo `is_verified`.  
  Si es `False`, lanza un `HTTP 401 Unauthorized`.

### `app/utils/email_utils.py`
- `send_verification_email`: Construye el correo con plantillas HTML/Texto plano y gestiona el envío vía SMTP o logs en modo desarrollo.

---

## 4. Decisiones de diseño y seguridad

### Método POST para Verificación
Se optó por POST en lugar de GET para el endpoint de verificación para evitar pre-ejecuciones accidentales por parte de escáneres de correo (antivirus) que "clican" enlaces automáticamente.

### Bloqueo en Cascada
El acceso no se bloquea solo en el login, sino en el inyector de dependencias central (`get_current_user`), asegurando que ninguna ruta protegida sea accesible por usuarios no verificados.

### Validación Estricta
Se implementaron esquemas de Pydantic para asegurar que campos como `password` cumplan mínimos de seguridad antes de disparar el proceso de email (evitando errores 422 tardíos).

---

## 5. Consecuencias

### Positivas
- Cumplimiento total del Ticket #76 y mejora crítica en la seguridad de la plataforma.
- Cobertura de tests incrementada al 100% en los módulos de servicio y rutas de usuario.
- Separación clara de responsabilidades entre el servicio de base de datos y el controlador de la API.

### Negativas
- Dependencia del servicio SMTP: si el servidor de correo falla, los nuevos usuarios no pueden activar sus cuentas.  
  (Mitigado con logs detallados y manejo de excepciones en `email_utils`).

---

## 6. Referencias cruzadas

| Elemento         | Referencia                                     |
|-----------------|-----------------------------------------------|
| Requisito       | Ticket #76 — Verificación Email               |
| Modelo de datos | `app/models/user.py`                          |
| Servicio        | `app/services/user_service.py`                |
| Dependencias    | `app/utils/deps.py`                           |
| Email Utility   | `app/utils/email_utils.py`                    |
| Tests Unitarios | `tests/unit/test_email_verification.py`       |
| Tests de Rutas  | `tests/unit/test_user_routes.py`              |
