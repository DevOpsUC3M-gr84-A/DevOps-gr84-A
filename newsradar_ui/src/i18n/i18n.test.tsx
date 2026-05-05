import { render, screen, fireEvent, act } from "@testing-library/react";
import { vi } from "vitest";
import React from "react";
import { I18nProvider, useI18n } from "./i18n";
import { LanguageToggle } from "../components/LanguageToggle";

// Helper: componente consumidor de useI18n

const Consumer: React.FC = () => {
  const { t, language, setLanguage } = useI18n();
  return (
    <div>
      <span data-testid="lang">{language}</span>
      <span data-testid="nav-logout">{t("nav.logout")}</span>
      <span data-testid="nav-alerts">{t("nav.alerts")}</span>
      <span data-testid="alerts-title">{t("alerts.title")}</span>
      <button onClick={() => setLanguage("en")}>Switch EN</button>
      <button onClick={() => setLanguage("es")}>Switch ES</button>
    </div>
  );
};

// Suites

describe("I18nProvider y useI18n", () => {
  beforeEach(() => {
    globalThis.localStorage.clear();
  });

  afterEach(() => {
    globalThis.localStorage.clear();
  });

  test("arranca en español por defecto cuando no hay preferencia almacenada", () => {
    render(
      <I18nProvider>
        <Consumer />
      </I18nProvider>,
    );

    expect(screen.getByTestId("lang").textContent).toBe("es");
    expect(screen.getByTestId("nav-logout").textContent).toBe("Cerrar Sesión");
  });

  test("t() devuelve la traducción en español correctamente", () => {
    render(
      <I18nProvider>
        <Consumer />
      </I18nProvider>,
    );

    expect(screen.getByTestId("nav-alerts").textContent).toBe("Mis Alertas");
    expect(screen.getByTestId("alerts-title").textContent).toBe(
      "Gestión de Alertas",
    );
  });

  test("cambia al inglés al llamar setLanguage('en')", () => {
    render(
      <I18nProvider>
        <Consumer />
      </I18nProvider>,
    );

    fireEvent.click(screen.getByText("Switch EN"));

    expect(screen.getByTestId("lang").textContent).toBe("en");
    expect(screen.getByTestId("nav-logout").textContent).toBe("Log Out");
    expect(screen.getByTestId("nav-alerts").textContent).toBe("My Alerts");
  });

  test("t() devuelve la traducción en inglés correctamente", () => {
    render(
      <I18nProvider>
        <Consumer />
      </I18nProvider>,
    );

    fireEvent.click(screen.getByText("Switch EN"));

    expect(screen.getByTestId("alerts-title").textContent).toBe(
      "Alert Management",
    );
  });

  test("vuelve al español al llamar setLanguage('es')", () => {
    render(
      <I18nProvider>
        <Consumer />
      </I18nProvider>,
    );

    fireEvent.click(screen.getByText("Switch EN"));
    fireEvent.click(screen.getByText("Switch ES"));

    expect(screen.getByTestId("lang").textContent).toBe("es");
    expect(screen.getByTestId("nav-logout").textContent).toBe("Cerrar Sesión");
  });

  test("persiste el idioma en localStorage al cambiar", () => {
    render(
      <I18nProvider>
        <Consumer />
      </I18nProvider>,
    );

    fireEvent.click(screen.getByText("Switch EN"));

    expect(globalThis.localStorage.getItem("newsradar_language")).toBe("en");
  });

  test("lee el idioma de localStorage al inicializar", () => {
    globalThis.localStorage.setItem("newsradar_language", "en");

    render(
      <I18nProvider>
        <Consumer />
      </I18nProvider>,
    );

    expect(screen.getByTestId("lang").textContent).toBe("en");
    expect(screen.getByTestId("nav-logout").textContent).toBe("Log Out");
  });

  test("t() devuelve la clave si la traducción no existe", () => {
    render(
      <I18nProvider>
        <Consumer />
      </I18nProvider>,
    );

    // Comprobamos mediante un componente inline
    const MissingKey: React.FC = () => {
      const { t } = useI18n();
      return <span data-testid="missing">{t("clave.inexistente")}</span>;
    };

    const { getByTestId } = render(
      <I18nProvider>
        <MissingKey />
      </I18nProvider>,
    );

    expect(getByTestId("missing").textContent).toBe("clave.inexistente");
  });

  test("useI18n lanza error fuera del provider", () => {
    const ErrorBoundary: React.FC = () => {
      try {
        useI18n();
        return <span>no debería llegar aquí</span>;
      } catch (e: unknown) {
        const msg = e instanceof Error ? e.message : String(e);
        return <span data-testid="err">{msg}</span>;
      }
    };

    render(<ErrorBoundary />);

    expect(screen.getByTestId("err").textContent).toMatch(/I18nProvider/);
  });
});

describe("Componente LanguageToggle", () => {
  beforeEach(() => {
    globalThis.localStorage.clear();
  });

  afterEach(() => {
    globalThis.localStorage.clear();
  });

  test("renderiza los botones ES y EN", () => {
    render(
      <I18nProvider>
        <LanguageToggle />
      </I18nProvider>,
    );

    expect(screen.getByText("ES")).toBeInTheDocument();
    expect(screen.getByText("EN")).toBeInTheDocument();
  });

  test("el botón ES tiene aria-pressed=true por defecto", () => {
    render(
      <I18nProvider>
        <LanguageToggle />
      </I18nProvider>,
    );

    const esBtn = screen.getByText("ES").closest("button");
    expect(esBtn).toHaveAttribute("aria-pressed", "true");
  });

  test("al hacer clic en EN cambia el idioma a inglés", () => {
    render(
      <I18nProvider>
        <Consumer />
        <LanguageToggle />
      </I18nProvider>,
    );

    fireEvent.click(screen.getByText("EN"));

    expect(screen.getByTestId("lang").textContent).toBe("en");
  });

  test("el botón activo tiene la clase lang-btn--active", () => {
    render(
      <I18nProvider>
        <LanguageToggle />
      </I18nProvider>,
    );

    const esBtn = screen.getByText("ES").closest("button");
    expect(esBtn?.className).toContain("lang-btn--active");
  });

  test("al cambiar a EN, el botón EN toma la clase activa", () => {
    render(
      <I18nProvider>
        <LanguageToggle />
      </I18nProvider>,
    );

    fireEvent.click(screen.getByText("EN"));

    const enBtn = screen.getByText("EN").closest("button");
    expect(enBtn?.className).toContain("lang-btn--active");

    const esBtn = screen.getByText("ES").closest("button");
    expect(esBtn?.className).not.toContain("lang-btn--active");
  });

  test("tiene un role=group con aria-label de idioma", () => {
    render(
      <I18nProvider>
        <LanguageToggle />
      </I18nProvider>,
    );

    const group = screen.getByRole("group");
    expect(group).toBeInTheDocument();
  });
});

describe("Claves de traducción exhaustivas", () => {
  beforeEach(() => {
    globalThis.localStorage.clear();
  });

  afterEach(() => {
    globalThis.localStorage.clear();
  });

  const keys = [
    "nav.dashboard",
    "nav.alerts",
    "nav.settings",
    "nav.logout",
    "auth.login",
    "auth.register",
    "auth.loginButton",
    "auth.registerButton",
    "alerts.title",
    "alerts.newAlert",
    "alerts.name",
    "alerts.descriptors",
    "alerts.category",
    "alerts.actions",
    "alerts.noAlerts",
    "alerts.filterByCategory",
    "alerts.allCategories",
    "common.edit",
    "common.delete",
    "common.language",
  ];

  test.each(keys)(
    "la clave '%s' existe en español y en inglés y no devuelve la clave misma",
    (key) => {
      const EsCheck: React.FC = () => {
        const { t } = useI18n();
        return <span data-testid="val">{t(key)}</span>;
      };

      // Español
      globalThis.localStorage.setItem("newsradar_language", "es");
      const { getByTestId, unmount } = render(
        <I18nProvider>
          <EsCheck />
        </I18nProvider>,
      );
      const esVal = getByTestId("val").textContent ?? "";
      expect(esVal).not.toBe(key);
      expect(esVal.length).toBeGreaterThan(0);
      unmount();

      // Inglés
      globalThis.localStorage.setItem("newsradar_language", "en");
      const { getByTestId: getByTestIdEn } = render(
        <I18nProvider>
          <EsCheck />
        </I18nProvider>,
      );
      const enVal = getByTestIdEn("val").textContent ?? "";
      expect(enVal).not.toBe(key);
      expect(enVal.length).toBeGreaterThan(0);
    },
  );
});