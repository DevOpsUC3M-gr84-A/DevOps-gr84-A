# ADR-004: Refactorización UI, Flujos de Seguridad y Quality Gates Estrictos

**Fecha:** 26 de abril de 2026  
**Estado:** Aceptado  

## Contexto
Durante el desarrollo del panel de mando y los flujos de autenticación, se detectó la necesidad de unificar el diseño bajo una paleta corporativa coherente. Paralelamente, los flujos críticos como la verificación de correo electrónico y el borrado de cuenta carecían de feedback visual adecuado y mecanismos de seguridad robustos. Además, el análisis estático de SonarCloud reportaba problemas de accesibilidad (contraste y semántica HTML) y el pipeline de CI exigía un aumento en la cobertura de ramas (branch coverage) para asegurar la fiabilidad en escenarios de error de red.

## Decisiones

1. **Gestión de Estado de UI en flujos asíncronos:**
   Se decide implementar un patrón de "Auto-cierre con Fallback" para la pantalla de verificación de email. Debido a que los navegadores modernos bloquean `window.close()` si la pestaña no fue abierta por un script, se añade un temporizador de seguridad de 500ms que evalúa `window.closed`; si es `false`, se fuerza la navegación programática (`useNavigate`) hacia el login.

2. **Seguridad en acciones destructivas:**
   Para la eliminación de cuenta, se rechaza la simple alerta de confirmación del navegador. Se implementa un modal HTML5 nativo (`<dialog>`) que requiere validación activa de identidad (introducir la contraseña) antes de emitir la petición `DELETE`, previniendo borrados accidentales o maliciosos si la sesión se deja abierta.

3. **Accesibilidad y Semántica (Zero Code Smells):**
   Para cumplir los estándares WCAG, se ajustan los valores hexadecimales de los elementos deshabilitados para garantizar el contraste mínimo. Se erradica la simulación de modales mediante `div role="dialog"` en favor de etiquetas semánticas (`<dialog open>`), y se refactorizan hooks anidados profundamente para reducir la carga cognitiva (Brain Overload) detectada por SonarCloud.

4. **Estrategia de Testing Front-End:**
   Para alcanzar el 100% de cobertura de ramas sin introducir fragilidad (flaky tests), se decide:
   - Utilizar `vi.useFakeTimers()` para manipular el tiempo de forma síncrona al probar contadores y auto-cierres.
   - Forzar simulaciones de rechazo de promesas (`Promise.reject`) para asegurar que todos los bloques `catch` de las llamadas a la API gestionan los errores genéricos o fallos de red correctamente.
   - Forzar evaluaciones estrictas de tipos (ej. `=== true`) para satisfacer el compilador de TypeScript y evitar solapamientos de tipos en la evaluación de banderas de estado enviadas por el backend.

## Consecuencias
- **Positivas:** La aplicación es ahora significativamente más segura, completamente accesible, y su resiliencia está matemáticamente probada (100% coverage). La experiencia de usuario en procesos como la validación de cuenta se percibe como profesional y fluida.
- **Negativas:** La configuración de los tests unitarios requiere ahora un conocimiento más avanzado de las herramientas de simulación (timers y mocks del DOM) por parte del equipo de desarrollo, lo que eleva ligeramente la curva de aprendizaje para futuras modificaciones.