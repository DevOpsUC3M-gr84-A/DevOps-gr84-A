# ADR 027: Internacionalización del Frontend (ES/EN) sin librerías externas

> Renombrado desde ADR-024 para resolver colisión de numeración con [[ADR-024-fastapi]].

**Estado:** Aceptado  
**Fecha:** 2026-04-23  
**Autores:** Equipo DevOps-gr84-A  
**Issue:** RF16 – [RF16 - 3/3] Internacionalización: Soporte Bilingüe (ES/EN) en UI #87

---

## 1. Contexto

El enunciado del proyecto (RF16, sección opcional) requiere que el panel de mando pueda mostrarse en dos idiomas seleccionables: **Español (ES)** e **Inglés (EN)**.

**Restricción explícita:** La traducción aplica **exclusivamente a la interfaz de usuario** (menús, botones, títulos). Los contenidos de las noticias obtenidas por RSS y el texto de las alertas se mantienen en su idioma original.

El stack existente es **React + TypeScript + Vite** (ADR-009). Se buscaba la solución más sencilla, mantenible y sin añadir peso al bundle innecesariamente.

---

## 2. Alternativas consideradas

| Alternativa | Pros | Contras |
|---|---|---|
| **react-i18next** (librería estándar) | Muy completa, pluralización, interpolación, lazy-load | Añade ~40 KB al bundle; requiere configurar `i18next` + plugin Vite; curva de aprendizaje |
| **react-intl (FormatJS)** | Estándar ICU, pluralización robusta | Bundle grande; verboso para casos simples |
| **Solución propia** (elegida) | Cero dependencias nuevas; simple Context+Hook; fácil de extender | Sin pluralización avanzada ni interpolación (no necesaria aquí) |

---

## 3. Decisión

Se implementa un **motor de traducción propio** basado en:

1. **Archivos JSON** por idioma (`src/i18n/locales/es.json`, `en.json`) con claves jerárquicas tipo `"nav.logout"`, `"alerts.title"`, etc.
2. **`I18nProvider`** (React Context) que detecta el idioma inicial de `localStorage → navigator.language → "es"` y lo persiste automáticamente.
3. **Hook `useI18n()`** que expone `{ t, language, setLanguage }` a cualquier componente.
4. **Componente `LanguageToggle`** con botones ES/EN accesibles (`aria-pressed`, `role="group"`) integrado en la barra lateral.

---

## 4. Consecuencias

### Positivas
- **Sin dependencias externas**: no aumenta el bundle ni el número de vulnerabilidades.
- **Fácil de mantener**: añadir un idioma nuevo es crear un JSON y registrarlo en el mapa.
- **Accesible**: selector con `aria-pressed` y `role="group"`.
- **Persistencia automática**: el idioma elegido se guarda en `localStorage`.
- **Testable**: el hook y el provider se prueban de forma aislada con Vitest + Testing Library.

### Negativas / Limitaciones
- No soporta pluralización ni interpolación de variables (no requeridas en este proyecto).
- Si en el futuro se necesitara pluralización, habría que migrar a `react-i18next`.

---

## 5. Archivos creados / modificados

| Archivo | Tipo | Descripción |
|---|---|---|
| `src/i18n/i18n.tsx` | Nuevo | Provider, hook `useI18n`, utilidad `getNestedValue` |
| `src/i18n/locales/es.json` | Nuevo | Diccionario español |
| `src/i18n/locales/en.json` | Nuevo | Diccionario inglés |
| `src/components/LanguageToggle.tsx` | Nuevo | Selector de idioma accesible |
| `src/main.tsx` | Modificado | Envuelve `<App>` con `<I18nProvider>` |
| `src/App.tsx` | Modificado | Usa `t()` en nav; incluye `<LanguageToggle>` |
| `src/pages/AlertsManagement.tsx` | Modificado | Usa `t()` en títulos, botones y filtros |
| `src/App.css` | Modificado | Estilos del selector de idioma |
| `src/i18n/i18n.test.tsx` | Nuevo | Suite de tests funcionales del sistema i18n |

---