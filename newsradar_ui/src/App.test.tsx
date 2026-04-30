import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import { MemoryRouter } from "react-router-dom";
import { vi } from "vitest";
import App from "./App";
import { useAuth } from "./hooks/useAuth";

const { mockedNavigate } = vi.hoisted(() => ({
  mockedNavigate: vi.fn(),
}));

vi.mock("react-router-dom", async () => {
  const actual = await vi.importActual<typeof import("react-router-dom")>(
    "react-router-dom",
  );

  return {
    ...actual,
    useNavigate: () => mockedNavigate,
  };
});

vi.mock("./pages/Auth", () => ({ Auth: () => <div>AUTH_VIEW</div> }));
vi.mock("./pages/AlertsManagement", () => ({
  AlertsManagement: () => <div>ALERTS_VIEW</div>,
}));
vi.mock("./pages/SourcesRss", () => ({
  SourcesRss: () => <div>SOURCES_RSS_VIEW</div>,
}));
vi.mock("./pages/VerifyEmail", () => ({
  VerifyEmail: () => <div>VERIFY_EMAIL_VIEW</div>,
}));
vi.mock("./pages/ForgotPassword", () => ({
  ForgotPassword: () => <div>FORGOT_PASSWORD_VIEW</div>,
}));
vi.mock("./pages/ResetPassword", () => ({
  ResetPassword: () => <div>RESET_PASSWORD_VIEW</div>,
}));

vi.mock("./hooks/useAuth");
const mockedUseAuth = vi.mocked(useAuth);

describe("Componente Raíz App", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    localStorage.clear();
    mockedUseAuth.mockReturnValue({
      login: vi.fn(),
      logout: vi.fn(),
      token: null,
      isAuthenticated: false,
    });
    // Prevent App's session validation fetch from logging out the test user.
    vi.stubGlobal("fetch", vi.fn(() =>
      Promise.resolve({
        ok: true,
        json: async () => {
          // Mirror a minimal response based on localStorage fallbacks used in the app.
          const roleIdsRaw = localStorage.getItem("role_ids");
          if (roleIdsRaw) {
            try {
              return { role_ids: JSON.parse(roleIdsRaw) };
            } catch {
              return { role_ids: [] };
            }
          }

          const raw = localStorage.getItem("userRoles");
          if (raw) {
            try {
              const parsed = JSON.parse(raw);
              if (Array.isArray(parsed)) {
                const ids = parsed
                  .map((p: any) => {
                    if (typeof p === "number") return p;
                    if (typeof p === "string") {
                      const s = p.toLowerCase();
                      if (s.includes("admin")) return 3;
                      if (s.includes("gestor")) return 1;
                      if (s.includes("lector")) return 2;
                    }
                    if (p && typeof p === "object") {
                      return p.role_id ?? p.id ?? p.role ?? null;
                    }
                    return null;
                  })
                  .filter(Boolean);
                return { role_ids: ids };
              }
            } catch {
              // legacy comma-separated string fallback
              const parts = raw.split(",").map((s) => s.trim().toLowerCase());
              const ids = parts.map((s) => (s.includes("admin") ? 3 : s.includes("gestor") ? 1 : s.includes("lector") ? 2 : null)).filter(Boolean);
              return { role_ids: ids };
            }
          }

          const single = localStorage.getItem("userRole");
          if (single) {
            const s = single.toLowerCase();
            if (s.includes("admin")) return { role_ids: [3] };
            if (s.includes("gestor")) return { role_ids: [1] };
            if (s.includes("lector")) return { role_ids: [2] };
          }

          return { role_ids: [] };
        },
      } as unknown),
    ));
  });

  afterEach(() => {
    // Restore any global stubs to avoid cross-test pollution
    // vi.unstubAllGlobals is available in vitest to remove stubbed globals
    // Fallback to deleting global.fetch if the helper is not present.
    try {
      // @ts-ignore - vitest helper
      vi.unstubAllGlobals();
    } catch {
      // manual cleanup
      // eslint-disable-next-line no-undef
      // @ts-ignore
      delete global.fetch;
    }
    vi.clearAllMocks();
    localStorage.clear();
  });

  test("renderiza ForgotPassword cuando pathname es /forgot-password", () => {
    render(
      <MemoryRouter initialEntries={["/forgot-password"]}>
        <App />
      </MemoryRouter>,
    );

    expect(screen.getByText("FORGOT_PASSWORD_VIEW")).toBeInTheDocument();
  });

  test("renderiza ResetPassword cuando pathname es /reset-password", () => {
    render(
      <MemoryRouter initialEntries={["/reset-password"]}>
        <App />
      </MemoryRouter>,
    );

    expect(screen.getByText("RESET_PASSWORD_VIEW")).toBeInTheDocument();
  });

  test("renderiza Auth cuando no hay token", () => {
    render(
      <MemoryRouter initialEntries={["/"]}>
        <App />
      </MemoryRouter>,
    );

    expect(screen.getByText("AUTH_VIEW")).toBeInTheDocument();
  });

  test("renderiza VerifyEmail en ruta pública aunque no haya token", () => {
    render(
      <MemoryRouter initialEntries={["/verify-email?token=test"]}>
        <App />
      </MemoryRouter>,
    );

    expect(screen.getByText("VERIFY_EMAIL_VIEW")).toBeInTheDocument();
  });

  test("renderiza layout protegido cuando hay token", async () => {
    localStorage.setItem("userRoles", JSON.stringify([1]));
    mockedUseAuth.mockReturnValue({
      login: vi.fn(),
      logout: vi.fn(),
      token: "fake-token",
      isAuthenticated: true,
    });

    render(
      <MemoryRouter initialEntries={["/dashboard"]}>
        <App />
      </MemoryRouter>,
    );

    await waitFor(() => {
      expect(
        screen.getByRole("link", { name: /Alertas/i }),
      ).toBeInTheDocument();
    });

    fireEvent.click(screen.getByRole("link", { name: /Alertas/i }));

    await waitFor(() => {
      expect(screen.getByText("ALERTS_VIEW")).toBeInTheDocument();
    });
  });

  test("renderiza fuentes rss para usuarios con permisos de gestión", async () => {
    localStorage.setItem("userRoles", JSON.stringify([3]));
    mockedUseAuth.mockReturnValue({
      login: vi.fn(),
      logout: vi.fn(),
      token: "fake-token",
      isAuthenticated: true,
    });

    render(
      <MemoryRouter initialEntries={["/dashboard"]}>
        <App />
      </MemoryRouter>,
    );

    await waitFor(() => {
      expect(
        screen.getByRole("link", { name: /Fuentes y RSS/i }),
      ).toBeInTheDocument();
    });

    fireEvent.click(
      screen.getByRole("link", { name: /Fuentes y RSS/i }),
    );

    await waitFor(() => {
      expect(screen.getByText("SOURCES_RSS_VIEW")).toBeInTheDocument();
    });
  });

  test("bloquea alertas para rol LECTOR", async () => {
    localStorage.setItem("userRoles", JSON.stringify([2]));
    mockedUseAuth.mockReturnValue({
      login: vi.fn(),
      logout: vi.fn(),
      token: "fake-token",
      isAuthenticated: true,
    });

    render(
      <MemoryRouter initialEntries={["/dashboard"]}>
        <App />
      </MemoryRouter>,
    );

    await waitFor(() => {
      expect(
        screen.queryByRole("link", { name: /Alertas/i }),
      ).not.toBeInTheDocument();
    });
  });

  test("renderiza alertas para Admin con role_ids string 'Admin'", async () => {
    localStorage.setItem("userRoles", JSON.stringify(["Admin"]));
    mockedUseAuth.mockReturnValue({
      login: vi.fn(),
      logout: vi.fn(),
      token: "fake-token",
      isAuthenticated: true,
    });

    render(
      <MemoryRouter initialEntries={["/dashboard"]}>
        <App />
      </MemoryRouter>,
    );

    await waitFor(() => {
      expect(
        screen.getByRole("link", { name: /Alertas/i }),
      ).toBeInTheDocument();
    });

    fireEvent.click(screen.getByRole("link", { name: /Alertas/i }));

    await waitFor(() => {
      expect(screen.getByText("ALERTS_VIEW")).toBeInTheDocument();
    });
  });

  test("renderiza fuentes RSS para Gestor con role_ids string 'Gestor'", async () => {
    localStorage.setItem("userRoles", JSON.stringify(["Gestor"]));
    mockedUseAuth.mockReturnValue({
      login: vi.fn(),
      logout: vi.fn(),
      token: "fake-token",
      isAuthenticated: true,
    });

    render(
      <MemoryRouter initialEntries={["/dashboard"]}>
        <App />
      </MemoryRouter>,
    );

    await waitFor(() => {
      expect(
        screen.getByRole("link", { name: /Fuentes y RSS/i }),
      ).toBeInTheDocument();
    });

    fireEvent.click(
      screen.getByRole("link", { name: /Fuentes y RSS/i }),
    );

    await waitFor(() => {
      expect(screen.getByText("SOURCES_RSS_VIEW")).toBeInTheDocument();
    });
  });

  test("bloquea alertas con role_ids string 'Lector'", async () => {
    localStorage.setItem("userRoles", JSON.stringify(["Lector"]));
    mockedUseAuth.mockReturnValue({
      login: vi.fn(),
      logout: vi.fn(),
      token: "fake-token",
      isAuthenticated: true,
    });

    render(
      <MemoryRouter initialEntries={["/dashboard"]}>
        <App />
      </MemoryRouter>,
    );

    await waitFor(() => {
      expect(
        screen.queryByRole("link", { name: /Alertas/i }),
      ).not.toBeInTheDocument();
    });
  });

  test("maneja role_ids mixtos (números y strings) - Admin tiene acceso", async () => {
    localStorage.setItem("userRoles", JSON.stringify([3, "Gestor", "Lector"]));
    mockedUseAuth.mockReturnValue({
      login: vi.fn(),
      logout: vi.fn(),
      token: "fake-token",
      isAuthenticated: true,
    });

    render(
      <MemoryRouter initialEntries={["/dashboard"]}>
        <App />
      </MemoryRouter>,
    );

    await waitFor(() => {
      expect(
        screen.getByRole("link", { name: /Fuentes y RSS/i }),
      ).toBeInTheDocument();
    });

    fireEvent.click(
      screen.getByRole("link", { name: /Fuentes y RSS/i }),
    );

    await waitFor(() => {
      expect(screen.getByText("SOURCES_RSS_VIEW")).toBeInTheDocument();
    });
  });

  test("habilita gestión cuando userRoles es objeto con role_ids", async () => {
    localStorage.setItem("userRoles", JSON.stringify({ role_ids: [3] }));
    mockedUseAuth.mockReturnValue({
      login: vi.fn(),
      logout: vi.fn(),
      token: "fake-token",
      isAuthenticated: true,
    });

    render(
      <MemoryRouter initialEntries={["/dashboard"]}>
        <App />
      </MemoryRouter>,
    );

    await waitFor(() => {
      expect(
        screen.getByRole("link", { name: /Alertas/i }),
      ).toBeInTheDocument();
    });

    fireEvent.click(screen.getByRole("link", { name: /Alertas/i }));

    await waitFor(() => {
      expect(screen.getByText("ALERTS_VIEW")).toBeInTheDocument();
    });
  });

  test("habilita gestión cuando userRoles es objeto con role", async () => {
    localStorage.setItem("userRoles", JSON.stringify({ role: 1 }));
    mockedUseAuth.mockReturnValue({
      login: vi.fn(),
      logout: vi.fn(),
      token: "fake-token",
      isAuthenticated: true,
    });

    render(
      <MemoryRouter initialEntries={["/dashboard"]}>
        <App />
      </MemoryRouter>,
    );

    await waitFor(() => {
      expect(
        screen.getByRole("link", { name: /Fuentes y RSS/i }),
      ).toBeInTheDocument();
    });

    fireEvent.click(
      screen.getByRole("link", { name: /Fuentes y RSS/i }),
    );

    await waitFor(() => {
      expect(screen.getByText("SOURCES_RSS_VIEW")).toBeInTheDocument();
    });
  });

  test("habilita gestión cuando userRoles usa formato { roles: [1] }", async () => {
    localStorage.setItem("userRoles", JSON.stringify({ roles: [1] }));
    mockedUseAuth.mockReturnValue({
      login: vi.fn(),
      logout: vi.fn(),
      token: "fake-token",
      isAuthenticated: true,
    });

    render(
      <MemoryRouter initialEntries={["/dashboard"]}>
        <App />
      </MemoryRouter>,
    );

    await waitFor(() => {
      expect(
        screen.getByRole("link", { name: /Fuentes y RSS/i }),
      ).toBeInTheDocument();
    });
  });

  test("habilita gestión cuando userRoles usa formato { role_id: 3 }", async () => {
    localStorage.setItem("userRoles", JSON.stringify({ role_id: 3 }));
    mockedUseAuth.mockReturnValue({
      login: vi.fn(),
      logout: vi.fn(),
      token: "fake-token",
      isAuthenticated: true,
    });

    render(
      <MemoryRouter initialEntries={["/dashboard"]}>
        <App />
      </MemoryRouter>,
    );

    await waitFor(() => {
      expect(
        screen.getByRole("link", { name: /Alertas/i }),
      ).toBeInTheDocument();
    });
  });

  test("habilita gestión cuando userRoles usa formato { id: 1 }", async () => {
    localStorage.setItem("userRoles", JSON.stringify({ id: 1 }));
    mockedUseAuth.mockReturnValue({
      login: vi.fn(),
      logout: vi.fn(),
      token: "fake-token",
      isAuthenticated: true,
    });

    render(
      <MemoryRouter initialEntries={["/dashboard"]}>
        <App />
      </MemoryRouter>,
    );

    await waitFor(() => {
      expect(
        screen.getByRole("link", { name: /Fuentes y RSS/i }),
      ).toBeInTheDocument();
    });
  });

  test("parseStoredRoles usa fallback extractCandidates con valor primitivo JSON", async () => {
    localStorage.setItem("userRoles", "2");
    mockedUseAuth.mockReturnValue({
      login: vi.fn(),
      logout: vi.fn(),
      token: "fake-token",
      isAuthenticated: true,
    });

    render(
      <MemoryRouter initialEntries={["/dashboard"]}>
        <App />
      </MemoryRouter>,
    );

    await waitFor(() => {
      expect(
        screen.queryByRole("link", { name: /Alertas/i }),
      ).not.toBeInTheDocument();
    });
  });

  test("parseStoredRoles normaliza candidato objeto con role_id", async () => {
    localStorage.setItem("userRoles", JSON.stringify([{ role_id: 1 }]));
    mockedUseAuth.mockReturnValue({
      login: vi.fn(),
      logout: vi.fn(),
      token: "fake-token",
      isAuthenticated: true,
    });

    render(
      <MemoryRouter initialEntries={["/dashboard"]}>
        <App />
      </MemoryRouter>,
    );

    await waitFor(() => {
      expect(
        screen.getByRole("link", { name: /Fuentes y RSS/i }),
      ).toBeInTheDocument();
    });
  });

  test("parseStoredRoles normaliza candidato objeto con role", async () => {
    localStorage.setItem("userRoles", JSON.stringify([{ role: 3 }]));
    mockedUseAuth.mockReturnValue({
      login: vi.fn(),
      logout: vi.fn(),
      token: "fake-token",
      isAuthenticated: true,
    });

    render(
      <MemoryRouter initialEntries={["/dashboard"]}>
        <App />
      </MemoryRouter>,
    );

    await waitFor(() => {
      expect(
        screen.getByRole("link", { name: /Alertas/i }),
      ).toBeInTheDocument();
    });
  });

  test("parseStoredRoles normaliza candidato objeto con id", async () => {
    localStorage.setItem("userRoles", JSON.stringify([{ id: 1 }]));
    mockedUseAuth.mockReturnValue({
      login: vi.fn(),
      logout: vi.fn(),
      token: "fake-token",
      isAuthenticated: true,
    });

    render(
      <MemoryRouter initialEntries={["/dashboard"]}>
        <App />
      </MemoryRouter>,
    );

    await waitFor(() => {
      expect(
        screen.getByRole("link", { name: /Fuentes y RSS/i }),
      ).toBeInTheDocument();
    });
  });

  test("parseStoredRoles normaliza candidato objeto con name", async () => {
    localStorage.setItem("userRoles", JSON.stringify([{ name: "admin" }]));
    mockedUseAuth.mockReturnValue({
      login: vi.fn(),
      logout: vi.fn(),
      token: "fake-token",
      isAuthenticated: true,
    });

    render(
      <MemoryRouter initialEntries={["/dashboard"]}>
        <App />
      </MemoryRouter>,
    );

    await waitFor(() => {
      expect(
        screen.getByRole("link", { name: /Alertas/i }),
      ).toBeInTheDocument();
    });
  });

  test("parseStoredRoles usa objeto desconocido y cae en fallback de extracción", async () => {
    localStorage.setItem("userRoles", JSON.stringify({ unknown: true }));
    mockedUseAuth.mockReturnValue({
      login: vi.fn(),
      logout: vi.fn(),
      token: "fake-token",
      isAuthenticated: true,
    });

    render(
      <MemoryRouter initialEntries={["/dashboard"]}>
        <App />
      </MemoryRouter>,
    );

    await waitFor(() => {
      expect(
        screen.queryByRole("link", { name: /Alertas/i }),
      ).not.toBeInTheDocument();
    });
  });

  test("parseStoredRoles usa rama catch con lista vacía y fallback a rawRoles", async () => {
    localStorage.setItem("userRoles", " , , ");
    mockedUseAuth.mockReturnValue({
      login: vi.fn(),
      logout: vi.fn(),
      token: "fake-token",
      isAuthenticated: true,
    });

    render(
      <MemoryRouter initialEntries={["/dashboard"]}>
        <App />
      </MemoryRouter>,
    );

    await waitFor(() => {
      expect(
        screen.queryByRole("link", { name: /Alertas/i }),
      ).not.toBeInTheDocument();
    });
  });

  test("habilita gestión cuando userRoles es objeto con name admin", async () => {
    localStorage.setItem("userRoles", JSON.stringify({ name: "admin" }));
    mockedUseAuth.mockReturnValue({
      login: vi.fn(),
      logout: vi.fn(),
      token: "fake-token",
      isAuthenticated: true,
    });

    render(
      <MemoryRouter initialEntries={["/dashboard"]}>
        <App />
      </MemoryRouter>,
    );

    await waitFor(() => {
      expect(
        screen.getByRole("link", { name: /Alertas/i }),
      ).toBeInTheDocument();
    });

    fireEvent.click(screen.getByRole("link", { name: /Alertas/i }));

    await waitFor(() => {
      expect(screen.getByText("ALERTS_VIEW")).toBeInTheDocument();
    });
  });

  test("habilita gestión con fallback de userRoles legacy por comas", async () => {
    localStorage.setItem("userRoles", "Admin, Gestor");
    mockedUseAuth.mockReturnValue({
      login: vi.fn(),
      logout: vi.fn(),
      token: "fake-token",
      isAuthenticated: true,
    });

    render(
      <MemoryRouter initialEntries={["/dashboard"]}>
        <App />
      </MemoryRouter>,
    );

    await waitFor(() => {
      expect(
        screen.getByRole("link", { name: /Fuentes y RSS/i }),
      ).toBeInTheDocument();
    });

    fireEvent.click(
      screen.getByRole("link", { name: /Fuentes y RSS/i }),
    );

    await waitFor(() => {
      expect(screen.getByText("SOURCES_RSS_VIEW")).toBeInTheDocument();
    });
  });

  test("usa fallback legacy role_ids cuando userRoles no existe", async () => {
    localStorage.removeItem("userRoles");
    localStorage.setItem("role_ids", JSON.stringify([3]));
    mockedUseAuth.mockReturnValue({
      login: vi.fn(),
      logout: vi.fn(),
      token: "fake-token",
      isAuthenticated: true,
    });

    render(
      <MemoryRouter initialEntries={["/dashboard"]}>
        <App />
      </MemoryRouter>,
    );

    await waitFor(() => {
      expect(
        screen.getByRole("link", { name: /Alertas/i }),
      ).toBeInTheDocument();
    });

    fireEvent.click(screen.getByRole("link", { name: /Alertas/i }));

    await waitFor(() => {
      expect(screen.getByText("ALERTS_VIEW")).toBeInTheDocument();
    });
  });

  test("usa fallback legacy userRole cuando faltan userRoles y role_ids", async () => {
    localStorage.removeItem("userRoles");
    localStorage.removeItem("role_ids");
    localStorage.setItem("userRole", "Gestor");
    mockedUseAuth.mockReturnValue({
      login: vi.fn(),
      logout: vi.fn(),
      token: "fake-token",
      isAuthenticated: true,
    });

    render(
      <MemoryRouter initialEntries={["/dashboard"]}>
        <App />
      </MemoryRouter>,
    );

    await waitFor(() => {
      expect(
        screen.getByRole("link", { name: /Fuentes y RSS/i }),
      ).toBeInTheDocument();
    });

    fireEvent.click(
      screen.getByRole("link", { name: /Fuentes y RSS/i }),
    );

    await waitFor(() => {
      expect(screen.getByText("SOURCES_RSS_VIEW")).toBeInTheDocument();
    });
  });

  test("al cerrar sesión navega a /login y ejecuta logout", () => {
    localStorage.setItem("userRoles", JSON.stringify([1]));
    const logoutSpy = vi.fn();
    mockedUseAuth.mockReturnValue({
      login: vi.fn(),
      logout: logoutSpy,
      token: "fake-token",
      isAuthenticated: true,
    });

    render(
      <MemoryRouter initialEntries={["/"]}>
        <App />
      </MemoryRouter>,
    );

    fireEvent.click(screen.getByText(/Cerrar Sesion/i));

    expect(logoutSpy).toHaveBeenCalled();
    expect(mockedNavigate).toHaveBeenCalledWith("/login", { replace: true });
  });

  test("renderiza los enlaces de navegación principales en modo autenticado", () => {
    localStorage.setItem("userRoles", JSON.stringify([1]));
    mockedUseAuth.mockReturnValue({
      login: vi.fn(),
      logout: vi.fn(),
      token: "fake-token",
      isAuthenticated: true,
    });

    render(
      <MemoryRouter initialEntries={["/"]}>
        <App />
      </MemoryRouter>,
    );

    expect(
      screen.getByRole("link", { name: /Dashboard/i }),
    ).toBeInTheDocument();
    expect(screen.getByRole("link", { name: /Resumen/i })).toBeInTheDocument();
    expect(
      screen.getByRole("link", { name: /Alertas/i }),
    ).toBeInTheDocument();
    expect(
      screen.getByRole("link", { name: /Fuentes y RSS/i }),
    ).toBeInTheDocument();
    expect(
      screen.getByRole("link", { name: /Notificaciones/i }),
    ).toBeInTheDocument();
    expect(
      screen.getByRole("link", { name: "Perfil" }),
    ).toBeInTheDocument();
  });

  test("renderiza selector de idioma con botones accesibles", () => {
    localStorage.setItem("userRoles", JSON.stringify([1]));
    mockedUseAuth.mockReturnValue({
      login: vi.fn(),
      logout: vi.fn(),
      token: "fake-token",
      isAuthenticated: true,
    });

    render(
      <MemoryRouter initialEntries={["/"]}>
        <App />
      </MemoryRouter>,
    );

    expect(screen.getByRole("button", { name: "ES" })).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "EN" })).toBeInTheDocument();
  });

  test("renderiza marca y logo en modo autenticado", () => {
    localStorage.setItem("userRoles", JSON.stringify([1]));
    mockedUseAuth.mockReturnValue({
      login: vi.fn(),
      logout: vi.fn(),
      token: "fake-token",
      isAuthenticated: true,
    });

    render(
      <MemoryRouter initialEntries={["/"]}>
        <App />
      </MemoryRouter>,
    );

    expect(screen.getByAltText(/NewsRadar Logo/i)).toBeInTheDocument();
    expect(screen.getByText(/NewsRadar/i)).toBeInTheDocument();
  });

  test("hamburger menu button es clickeable y el sidebar cambia clase", async () => {
    localStorage.setItem("userRoles", JSON.stringify([1]));
    mockedUseAuth.mockReturnValue({
      login: vi.fn(),
      logout: vi.fn(),
      token: "fake-token",
      isAuthenticated: true,
    });

    render(
      <MemoryRouter initialEntries={["/dashboard"]}>
        <App />
      </MemoryRouter>,
    );

    const menuButton = screen.getByRole("button", {
      name: /abrir menú lateral|cerrar menú lateral/i,
    });
    expect(menuButton).toBeInTheDocument();

    // El sidebar debe estar abierto inicialmente (sin clase "closed")
    let sidebar = screen.getByRole("complementary");
    expect(sidebar).toHaveClass("sidebar");
    expect(sidebar).not.toHaveClass("closed");

    // Hacer click en el botón del menú
    fireEvent.click(menuButton);

    // Después del click, el sidebar debe tener la clase "closed"
    await waitFor(() => {
      sidebar = screen.getByRole("complementary");
      expect(sidebar).toHaveClass("closed");
    });

    // Hacer click nuevamente
    fireEvent.click(menuButton);

    // Después del segundo click, la clase "closed" debe removerse
    await waitFor(() => {
      sidebar = screen.getByRole("complementary");
      expect(sidebar).not.toHaveClass("closed");
    });
  });

  test("top-bar muestra título dinámico correcto por ruta", async () => {
    localStorage.setItem("userRoles", JSON.stringify([1]));
    mockedUseAuth.mockReturnValue({
      login: vi.fn(),
      logout: vi.fn(),
      token: "fake-token",
      isAuthenticated: true,
    });

    // Busca el h1 del top-bar específicamente para evitar colisión con el
    // enlace homónimo del menú lateral.
    const getTopBarTitle = () =>
      screen.getByRole("heading", { level: 1, name: /ALERTAS|FUENTES Y RSS|PERFIL/i });

    // MemoryRouter solo lee initialEntries al montarse, así que usamos `key`
    // para forzar un remount limpio en cada cambio de ruta del rerender.
    const { rerender } = render(
      <MemoryRouter key="/alertas" initialEntries={["/alertas"]}>
        <App />
      </MemoryRouter>,
    );

    await waitFor(() => {
      expect(getTopBarTitle()).toHaveTextContent(/ALERTAS/i);
    });

    rerender(
      <MemoryRouter key="/fuentes-rss" initialEntries={["/fuentes-rss"]}>
        <App />
      </MemoryRouter>,
    );

    await waitFor(() => {
      expect(getTopBarTitle()).toHaveTextContent(/FUENTES Y RSS/i);
    });

    rerender(
      <MemoryRouter key="/perfil" initialEntries={["/perfil"]}>
        <App />
      </MemoryRouter>,
    );

    await waitFor(() => {
      expect(getTopBarTitle()).toHaveTextContent(/PERFIL/i);
    });
  });

  test("renderiza contenido de Resumen en /resumen", async () => {
    localStorage.setItem("userRoles", JSON.stringify([1]));
    mockedUseAuth.mockReturnValue({
      login: vi.fn(),
      logout: vi.fn(),
      token: "fake-token",
      isAuthenticated: true,
    });

    render(
      <MemoryRouter initialEntries={["/resumen"]}>
        <App />
      </MemoryRouter>,
    );

    await waitFor(() => {
      expect(screen.getByText(/Resumen ejecutivo de actividad/i)).toBeInTheDocument();
    });
  });

  test("renderiza contenido de Notificaciones en /notificaciones", async () => {
    localStorage.setItem("userRoles", JSON.stringify([1]));
    mockedUseAuth.mockReturnValue({
      login: vi.fn(),
      logout: vi.fn(),
      token: "fake-token",
      isAuthenticated: true,
    });

    render(
      <MemoryRouter initialEntries={["/notificaciones"]}>
        <App />
      </MemoryRouter>,
    );

    await waitFor(() => {
      expect(screen.getByText(/Buzon de avisos y alertas detectadas/i)).toBeInTheDocument();
    });
  });

  test("usa fallback por comas cuando userRoles no es JSON válido", async () => {
    localStorage.setItem("userRoles", "Admin, Gestor");
    mockedUseAuth.mockReturnValue({
      login: vi.fn(),
      logout: vi.fn(),
      token: "fake-token",
      isAuthenticated: true,
    });

    render(
      <MemoryRouter initialEntries={["/dashboard"]}>
        <App />
      </MemoryRouter>,
    );

    await waitFor(() => {
      expect(
        screen.getByRole("link", { name: /Fuentes y RSS/i }),
      ).toBeInTheDocument();
    });
  });

  test("usa fallback de userRole cuando faltan userRoles y role_ids", async () => {
    localStorage.removeItem("userRoles");
    localStorage.removeItem("role_ids");
    localStorage.setItem("userRole", "Gestor");
    mockedUseAuth.mockReturnValue({
      login: vi.fn(),
      logout: vi.fn(),
      token: "fake-token",
      isAuthenticated: true,
    });

    render(
      <MemoryRouter initialEntries={["/dashboard"]}>
        <App />
      </MemoryRouter>,
    );

    await waitFor(() => {
      expect(
        screen.getByRole("link", { name: /Fuentes y RSS/i }),
      ).toBeInTheDocument();
    });
  });

  describe('Nuevas funcionalidades UI (Sidebar, Idioma y Perfil)', () => {
    beforeEach(() => {
      globalThis.localStorage.setItem('token', 'fake-token');
      globalThis.localStorage.setItem('userId', '1');
      globalThis.localStorage.setItem('userRoles', JSON.stringify([1]));

      // Usamos el mock que ya tienes configurado arriba
      mockedUseAuth.mockReturnValue({
        login: vi.fn(),
        logout: vi.fn(),
        token: "fake-token",
        isAuthenticated: true,
      });
    });

    test('hace fetch del perfil, abre/cierra sidebar y cambia idioma', async () => {
      // 1. Mockeamos la respuesta del backend para el perfil
      global.fetch = vi.fn().mockResolvedValue({
        ok: true,
        json: async () => ({ first_name: 'Eloy', last_name: 'Martin', role_ids: [1] }),
      });

      render(
        <MemoryRouter initialEntries={['/dashboard']}>
          <App />
        </MemoryRouter>
      );

      // 2. Verificamos que el nombre carga en la Top Bar
      await waitFor(() => {
        expect(screen.getByText('Eloy Martin')).toBeInTheDocument();
      });

      // 3. Probamos el botón hamburguesa
      const toggleBtn = screen.getByRole('button', { name: /Cerrar menú lateral|Abrir menú lateral/i });
      fireEvent.click(toggleBtn);
      await waitFor(() => {
        expect(toggleBtn).toHaveAttribute('aria-label', 'Abrir menú lateral');
      });

      // 4. Probamos el selector de idiomas
      const enBtn = screen.getByRole('button', { name: 'EN' });
      fireEvent.click(enBtn);
      await waitFor(() => {
        expect(enBtn).toHaveClass('is-active');
      });

      const esBtn = screen.getByRole('button', { name: 'ES' });
      fireEvent.click(esBtn);
      await waitFor(() => {
        expect(esBtn).toHaveClass('is-active');
      });
    });

    test('mapea role_ids a etiqueta Admin en el badge de usuario', async () => {
      global.fetch = vi.fn().mockResolvedValue({
        ok: true,
        json: async () => ({
          first_name: 'Ada',
          last_name: 'Lovelace',
          role_ids: [3],
        }),
      });

      render(
        <MemoryRouter initialEntries={['/dashboard']}>
          <App />
        </MemoryRouter>
      );

      await waitFor(() => {
        expect(screen.getByText('Admin')).toBeInTheDocument();
      });
    });

    test('mapea role_ids a etiqueta Lector en el badge de usuario', async () => {
      global.fetch = vi.fn().mockResolvedValue({
        ok: true,
        json: async () => ({
          first_name: 'Alan',
          last_name: 'Turing',
          role_ids: [2],
        }),
      });

      render(
        <MemoryRouter initialEntries={['/dashboard']}>
          <App />
        </MemoryRouter>
      );

      await waitFor(() => {
        expect(screen.getByText('Lector')).toBeInTheDocument();
      });
    });

    test('fetchCurrentUser no rompe UI cuando fetch rechaza (catch)', async () => {
      global.fetch = vi.fn().mockRejectedValueOnce(new Error('fallo de red'));

      render(
        <MemoryRouter initialEntries={['/dashboard']}>
          <App />
        </MemoryRouter>
      );

      await waitFor(() => {
        expect(screen.getByLabelText('Usuario logueado')).toBeInTheDocument();
      });

      expect(screen.getByText('Usuario')).toBeInTheDocument();
    });

    test('fetchCurrentUser no actualiza perfil cuando response.ok es false', async () => {
      global.fetch = vi.fn().mockResolvedValueOnce({
        ok: false,
        json: async () => ({ detail: 'No autorizado' }),
      });

      render(
        <MemoryRouter initialEntries={['/dashboard']}>
          <App />
        </MemoryRouter>
      );

      await waitFor(() => {
        expect(screen.getByLabelText('Usuario logueado')).toBeInTheDocument();
      });

      expect(screen.getByText('Usuario')).toBeInTheDocument();
    });

    test('fetchCurrentUser aplica fallbacks cuando faltan first_name, last_name y role_ids', async () => {
      global.fetch = vi.fn().mockResolvedValueOnce({
        ok: true,
        json: async () => ({
          first_name: "",
          last_name: "",
        }),
      });

      render(
        <MemoryRouter initialEntries={['/dashboard']}>
          <App />
        </MemoryRouter>
      );

      await waitFor(() => {
        expect(screen.getByText('US')).toBeInTheDocument();
      });

      expect(screen.getByText('Lector')).toBeInTheDocument();
    });

    test('fetchCurrentUser aplica fallback nullish para first_name y last_name', async () => {
      global.fetch = vi.fn().mockResolvedValueOnce({
        ok: true,
        json: async () => ({}),
      });

      render(
        <MemoryRouter initialEntries={['/dashboard']}>
          <App />
        </MemoryRouter>
      );

      await waitFor(() => {
        expect(screen.getByText('Usuario')).toBeInTheDocument();
      });
    });

    test('fetchCurrentUser usa URL por defecto cuando VITE_API_BASE_URL es undefined', async () => {
      const originalBaseUrl = (import.meta as ImportMeta & {
        env: Record<string, string | undefined>;
      }).env.VITE_API_BASE_URL;

      (import.meta as ImportMeta & {
        env: Record<string, string | undefined>;
      }).env.VITE_API_BASE_URL = undefined;

      global.fetch = vi.fn().mockResolvedValueOnce({
        ok: true,
        json: async () => ({ first_name: 'Test', last_name: 'Fallback', role_ids: [1] }),
      });

      render(
        <MemoryRouter initialEntries={['/dashboard']}>
          <App />
        </MemoryRouter>
      );

      await waitFor(() => {
        expect(global.fetch).toHaveBeenCalledWith(
          expect.stringContaining('http://localhost:8000/api/v1/users/1'),
          expect.any(Object),
        );
      });

      (import.meta as ImportMeta & {
        env: Record<string, string | undefined>;
      }).env.VITE_API_BASE_URL = originalBaseUrl;
    });
  });

});