import { fireEvent, render, screen } from "@testing-library/react";
import { MemoryRouter } from "react-router-dom";
import { vi } from "vitest";
import App from "./App";
import { useAuth } from "./hooks/useAuth";

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
  const removeItemSpy = jest.spyOn(Storage.prototype, "removeItem");

  beforeEach(() => {
    jest.clearAllMocks();
    removeItemSpy.mockReset();
    localStorage.clear();
    mockedUseAuth.mockReturnValue({
      login: jest.fn(),
      logout: jest.fn(),
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
    mockedUseAuth.mockReturnValue({ login: jest.fn(), logout: jest.fn() });

    render(
      <MemoryRouter initialEntries={["/reset-password"]}>
        <App />
      </MemoryRouter>,
    );

    expect(screen.getByText("RESET_PASSWORD_VIEW")).toBeInTheDocument();
  });

  test("renderiza Auth cuando no hay token", () => {
    mockedUseAuth.mockReturnValue({ login: jest.fn(), logout: jest.fn() });

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
    localStorage.setItem("token", "fake-token");
    localStorage.setItem("userRoles", JSON.stringify([1]));
    mockedUseAuth.mockReturnValue({ login: jest.fn(), logout: jest.fn() });

    render(
      <MemoryRouter initialEntries={["/alertas"]}>
        <App />
      </MemoryRouter>,
    );

    expect(screen.getByText("ALERTS_VIEW")).toBeInTheDocument();
  });

  test("renderiza fuentes rss para usuarios con permisos de gestión", () => {
    localStorage.setItem("token", "fake-token");
    localStorage.setItem("userRoles", JSON.stringify([3]));

    render(
      <MemoryRouter initialEntries={["/fuentes-rss"]}>
        <App />
      </MemoryRouter>,
    );

    expect(screen.getByText("SOURCES_RSS_VIEW")).toBeInTheDocument();
    expect(screen.getByText(/Fuentes RSS/i)).toBeInTheDocument();
  });

  test("bloquea alertas a usuarios sin permisos de gestión", () => {
    localStorage.setItem("token", "fake-token");
    localStorage.setItem("userRoles", JSON.stringify([2]));

    render(
      <MemoryRouter initialEntries={["/alertas"]}>
        <App />
      </MemoryRouter>,
    );

    expect(screen.getByText(/Panel general/i)).toBeInTheDocument();
    expect(screen.queryByText("ALERTS_VIEW")).not.toBeInTheDocument();
  });

  test("al cerrar sesión elimina claves y redirige", () => {
    localStorage.setItem("token", "fake-token");
    localStorage.setItem("userRoles", JSON.stringify([1]));
    removeItemSpy.mockImplementation(() => {});
    const logoutSpy = jest.fn();
    mockedUseAuth.mockReturnValue({
      login: jest.fn(),
      logout: logoutSpy,
    });

    render(
      <MemoryRouter initialEntries={["/"]}>
        <App />
      </MemoryRouter>,
    );

    fireEvent.click(screen.getByText(/Cerrar Sesión/i));

    expect(removeItemSpy).toHaveBeenCalledWith("token");
    expect(removeItemSpy).toHaveBeenCalledWith("userId");
    expect(removeItemSpy).toHaveBeenCalledWith("userRoles");
    expect(removeItemSpy).toHaveBeenCalledWith("userEmail");
    expect(logoutSpy).toHaveBeenCalled();
  });

  test("renderiza los enlaces de navegación principales en modo autenticado", () => {
    localStorage.setItem("token", "fake-token");
    localStorage.setItem("userRoles", JSON.stringify([1]));

    render(
      <MemoryRouter initialEntries={["/"]}>
        <App />
      </MemoryRouter>,
    );

    expect(screen.getByText(/Dashboard/i)).toBeInTheDocument();
    expect(screen.getByText(/Mis Alertas/i)).toBeInTheDocument();
    expect(screen.getByText(/Fuentes RSS/i)).toBeInTheDocument();
    expect(screen.getByText(/Configuración/i)).toBeInTheDocument();
  });

  test("renderiza marca y logo en modo autenticado", () => {
    localStorage.setItem("token", "fake-token");
    localStorage.setItem("userRoles", JSON.stringify([1]));

    render(
      <MemoryRouter initialEntries={["/"]}>
        <App />
      </MemoryRouter>,
    );

    expect(screen.getByAltText(/NewsRadar Logo/i)).toBeInTheDocument();
    expect(screen.getByText(/NewsRadar/i)).toBeInTheDocument();
  });
});
