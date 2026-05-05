import React, {
  createContext,
  useCallback,
  useContext,
  useMemo,
  useState,
} from "react";

import esMessages from "./locales/es.json";
import enMessages from "./locales/en.json";

// Tipos 

export type Language = "es" | "en";

type NestedMessages = { [key: string]: string | NestedMessages };

const MESSAGES: Record<Language, NestedMessages> = {
  es: esMessages as NestedMessages,
  en: enMessages as NestedMessages,
};

const STORAGE_KEY = "newsradar_language";

// Utilidades

/**
 * Obtiene el valor de una clave con notación de punto desde un objeto anidado.
 */
function getNestedValue(obj: NestedMessages, key: string): string {
  const parts = key.split(".");
  let current: string | NestedMessages = obj;
  for (const part of parts) {
    if (typeof current !== "object" || current === null) return key;
    current = (current as Record<string, string | NestedMessages>)[part];
    if (current === undefined) return key;
  }
  return typeof current === "string" ? current : key;
}

/**
 * Detecta el idioma preferido del usuario.
 * Prioridad: localStorage -> "es"
 */
function detectInitialLanguage(): Language {
  try {
    const stored = globalThis.localStorage?.getItem(STORAGE_KEY);
    if (stored === "es" || stored === "en") return stored;
  } catch {
    // En entornos sin localStorage usamos el valor por defecto
  }
  return "es";
}

// Contexto

interface I18nContextValue {
  language: Language;
  setLanguage: (lang: Language) => void;
  t: (key: string) => string;
}

const I18nContext = createContext<I18nContextValue | null>(null);

// Provider 

interface I18nProviderProps {
  children: React.ReactNode;
}

export const I18nProvider: React.FC<I18nProviderProps> = ({ children }) => {
  const [language, setLanguageState] = useState<Language>(detectInitialLanguage);

  const setLanguage = useCallback((lang: Language) => {
    setLanguageState(lang);
    try {
      globalThis.localStorage?.setItem(STORAGE_KEY, lang);
    } catch {
      // ignorar errores de localStorage
    }
  }, []);

  const t = useCallback(
    (key: string): string => getNestedValue(MESSAGES[language], key),
    [language],
  );

  const value = useMemo(
    () => ({ language, setLanguage, t }),
    [language, setLanguage, t],
  );

  return <I18nContext.Provider value={value}>{children}</I18nContext.Provider>;
};

// Hook

/**
 * useI18n – Hook para consumir el contexto de internacionalización.
 */
export function useI18n(): I18nContextValue {
  const ctx = useContext(I18nContext);
  if (!ctx) {
    throw new Error("useI18n debe usarse dentro de <I18nProvider>");
  }
  return ctx;
}
