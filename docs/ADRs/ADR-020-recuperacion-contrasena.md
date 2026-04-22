# ADR 020: Recuperación de Contraseña mediante Token de Un Solo Uso

**Estado:** Aceptado  
**Fecha:** 2026-04-18  
**Autores:** Equipo DevOps-gr84-A  
**Issue relacionado:** [RF18 #34](https://github.com/DevOpsUC3M-gr84-A/DevOps-gr84-A/issues/34)

---

## 1. Contexto

El requisito **RF18** establece que un usuario debe poder recuperar su contraseña si no la recuerda. Esta funcionalidad es crítica para la usabilidad de la plataforma y debe diseñarse de forma segura para evitar ataques de enumeración de usuarios y reutilización de tokens.

---

## 2. Alternativas consideradas

| Alternativa | Descripción | Descartada por |
|---|---|---|
| **Token JWT de corta duración** | Emitir un JWT firmado con tiempo de expiración embebido | Requiere clave secreta adicional; el token no se puede invalidar antes de su expiración sin una lista negra |
| **Token aleatorio en BD (elegida)** | Generar un token `secrets.token_urlsafe(32)` y persistirlo en la fila del usuario junto con su fecha de expiración | — |
| **Enlace de sesión temporal (magic link)** | Crear una sesión de un solo uso sin contraseña intermedia | Complejidad extra innecesaria para el alcance del proyecto |
| **Preguntas de seguridad** | Responder preguntas personales para cambiar la contraseña | Práctica obsoleta y con mala experiencia de usuario |

---

## 3. Decisión

Se implementa el flujo estándar de recuperación de contraseña en dos pasos:

### Flujo

```
Usuario → POST /api/v1/auth/forgot-password  →  genera token → email
Usuario → POST /api/v1/auth/reset-password   →  valida token → nueva contraseña
```

### Componentes modificados

**`app/models/user.py`**  
Se añaden dos columnas al modelo `User`:
- `reset_password_token` (`String`, nullable, indexado) — almacena el token generado.
- `reset_password_token_expires` (`DateTime(timezone=True)`, nullable) — fecha de expiración.

**`app/schemas/auth.py`**  
Se añaden tres schemas Pydantic:
- `ForgotPasswordRequest` — valida el campo `email`.
- `ResetPasswordRequest` — valida `token` (no vacío) y `new_password` (6–128 chars).
- `MessageResponse` — respuesta genérica con campo `message`.

**`app/services/user_service.py`**  
Se añaden dos funciones de servicio:
- `generate_reset_token(db, email)` — busca al usuario, genera un token con `secrets.token_urlsafe(32)`, calcula la expiración según `RESET_TOKEN_EXPIRE_HOURS` y persiste ambos valores.
- `reset_password_with_token(db, token, new_password)` — valida el token, comprueba la expiración (con normalización de timezone para compatibilidad con SQLite), actualiza el hash de la contraseña e invalida el token.

**`app/api/routes/auth.py`**  
Se añaden dos endpoints públicos (sin autenticación requerida):
- `POST /api/v1/auth/forgot-password` — devuelve siempre `HTTP 202` para evitar enumeración de usuarios.
- `POST /api/v1/auth/reset-password` — devuelve `HTTP 200` si el token es válido o `HTTP 400` si es inválido/expirado.

**`app/utils/email_utils.py`**  
Se añade `send_reset_password_email(to_email, reset_token)` que construye el enlace `{FRONTEND_URL}/reset-password?token=<TOKEN>` y lo envía en formato texto plano y HTML. En entornos sin SMTP configurado (`SMTP_USER` vacío), registra el enlace en el log en lugar de fallar.

**`app/config.py`**  
Se añaden variables de entorno:
- `SMTP_HOST`, `SMTP_PORT`, `SMTP_USER`, `SMTP_PASSWORD`, `SMTP_FROM`
- `FRONTEND_URL` — URL base del frontend para construir el enlace de reset.
- `RESET_TOKEN_EXPIRE_HOURS` — tiempo de validez del token (por defecto: 1 hora).

---

## 4. Decisiones de seguridad explícitas

- **Anti-enumeración:** `POST /auth/forgot-password` devuelve siempre `HTTP 202` con el mismo mensaje, sin revelar si el email está o no registrado.
- **Token de un solo uso:** una vez utilizado correctamente, el token y su fecha de expiración se ponen a `NULL` en la BD, impidiendo su reutilización.
- **Expiración:** el token expira en `RESET_TOKEN_EXPIRE_HOURS` horas (1h por defecto). Al expirar, se limpia de la BD.
- **Hash de contraseña:** la nueva contraseña se hashea con Argon2 (vía Passlib), igual que en el registro.
- **Normalización de timezone:** se maneja el caso de BD SQLite que devuelve `datetime` sin `tzinfo` para evitar errores de comparación.

---

## 5. Consecuencias

**Positivas:**
- RF18 queda completamente implementado con un flujo seguro y estándar en la industria.
- El diseño es compatible con el modelo `User` ya existente sin migraciones complejas.
- La función `send_reset_password_email` es tolerante a fallos: un error SMTP no interrumpe el flujo ni revela información al cliente.
- La lógica está completamente testeada con 20 tests unitarios que cubren todos los caminos de código.

**Negativas:**
- El token se almacena en texto claro en la BD. Una mitigación futura sería almacenar su hash (como hace Django), aunque para el alcance actual es aceptable.
- El modelo `User` acumula responsabilidades de autenticación y recuperación. En una evolución futura se podría extraer a una tabla `PasswordResetToken` independiente.
- Requiere configuración SMTP correcta en producción; sin ella, el flujo funciona en modo desarrollo (log del enlace) pero no envía correos reales.

---

## 6. Referencias cruzadas

| Elemento | Referencia |
|---|---|
| Requisito | RF18 — Issue #34 |
| Issue frontend relacionado | RF18-Frontend — Issue #80 |
| Modelo de datos | `newsradar_api/app/models/user.py` |
| Schemas | `newsradar_api/app/schemas/auth.py` |
| Servicio | `newsradar_api/app/services/user_service.py` |
| Endpoints | `newsradar_api/app/api/routes/auth.py` |
| Email | `newsradar_api/app/utils/email_utils.py` |
| Configuración | `newsradar_api/app/config.py` |
| Tests | `newsradar_api/tests/unit/test_rf18_password_recovery.py` |
| ADR arquitectura API | ADR-006 |
| ADR gestión usuarios | ADR-006 |