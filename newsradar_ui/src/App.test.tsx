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

    const { rerender } = render(
      <MemoryRouter initialEntries={["/alertas"]}>
        <App />
      </MemoryRouter>,
    );

    await waitFor(() => {
      expect(screen.getByText(/ALERTAS/i)).toBeInTheDocument();
    });

    // Cambiar a ruta /fuentes-rss
    rerender(
      <MemoryRouter initialEntries={["/fuentes-rss"]}>
        <App />
      </MemoryRouter>,
    );

    await waitFor(() => {
      expect(screen.getByText(/FUENTES Y RSS/i)).toBeInTheDocument();
    });

    // Cambiar a ruta /perfil
    rerender(
      <MemoryRouter initialEntries={["/perfil"]}>
        <App />
      </MemoryRouter>,
    );

    await waitFor(() => {
      expect(screen.getByText(/PERFIL/i)).toBeInTheDocument();
    });
  });
});