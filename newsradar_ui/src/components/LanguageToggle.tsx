import React from "react";
import { useI18n } from "../i18n/i18n";
import type { Language } from "../i18n/i18n";
const LANGUAGES: { code: Language; label: string; flag: string }[] = [
  { code: "es", label: "ES", flag: "🇪🇸" },
  { code: "en", label: "EN", flag: "🇬🇧" },
];

export const LanguageToggle: React.FC = () => {
  const { language, setLanguage, t } = useI18n();
  const [activeCode, setActiveCode] = React.useState<Language>(language);

  const handleClick = (code: Language) => {
    setActiveCode(code);
    setLanguage(code);
  };

  return (
    <div className="language-toggle" role="group" aria-label={t("common.language")}>
      {LANGUAGES.map(({ code, label, flag }) => (
        <button
          key={code}
          className={`lang-btn${activeCode === code ? " lang-btn--active is-active" : ""}`}
          onClick={() => handleClick(code)}
          aria-pressed={activeCode === code}
          title={`${t("common.language")}: ${label}`}
        >
          <span aria-hidden="true">{flag}</span>
          <span>{label}</span>
        </button>
      ))}
    </div>
  );
};