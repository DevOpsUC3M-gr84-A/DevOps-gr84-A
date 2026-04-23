import { fireEvent, render, screen } from "@testing-library/react";
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

  test("renderiza layout protegido cuando hay token", () => {
    localStorage.setItem("userRoles", JSON.stringify([1]));
    mockedUseAuth.mockReturnValue({
      login: vi.fn(),
      logout: vi.fn(),
      token: "fake-token",
      isAuthenticated: true,
    });

    render(
      <MemoryRouter initialEntries={["/alertas"]}>
        <App />
      </MemoryRouter>,
    );

    expect(screen.getByText("ALERTS_VIEW")).toBeInTheDocument();
  });

  test("renderiza fuentes rss para usuarios con permisos de gestión", () => {
    localStorage.setItem("userRoles", JSON.stringify([3]));
    mockedUseAuth.mockReturnValue({
      login: vi.fn(),
      logout: vi.fn(),
      token: "fake-token",
      isAuthenticated: true,
    });

    render(
      <MemoryRouter initialEntries={["/fuentes-rss"]}>
        <App />
      </MemoryRouter>,
    );

    expect(screen.getByText("SOURCES_RSS_VIEW")).toBeInTheDocument();
  });

  test("bloquea alertas para rol LECTOR", () => {
    localStorage.setItem("userRoles", JSON.stringify([2]));
    mockedUseAuth.mockReturnValue({
      login: vi.fn(),
      logout: vi.fn(),
      token: "fake-token",
      isAuthenticated: true,
    });

    render(
      <MemoryRouter initialEntries={["/alertas"]}>
        <App />
      </MemoryRouter>,
    );

    expect(screen.getByRole("heading", { name: /Dashboard \/ Resumen/i })).toBeInTheDocument();
    expect(screen.queryByText("ALERTS_VIEW")).not.toBeInTheDocument();
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
      screen.getByRole("link", { name: /Dashboard \/ Resumen/i }),
    ).toBeInTheDocument();
    expect(
      screen.getByRole("link", { name: /Gestion de Alertas/i }),
    ).toBeInTheDocument();
    expect(
      screen.getByRole("link", { name: /Gestion de Fuentes y canales RSS/i }),
    ).toBeInTheDocument();
    expect(
      screen.getByRole("link", { name: /Buzon de Notificaciones/i }),
    ).toBeInTheDocument();
    expect(
      screen.getByRole("link", { name: /Gestion del Perfil de Usuario/i }),
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
});