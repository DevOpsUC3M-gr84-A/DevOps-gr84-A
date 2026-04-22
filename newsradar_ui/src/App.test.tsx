import { fireEvent, render, screen } from "@testing-library/react";
import { MemoryRouter } from "react-router-dom";
import { vi } from "vitest";
import App from "./App";

vi.mock("./pages/Auth", () => ({ Auth: () => <div>AUTH_VIEW</div> }));
vi.mock("./pages/AlertsManagement", () => ({
  AlertsManagement: () => <div>ALERTS_VIEW</div>,
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

describe("Componente Raíz App", () => {
  const getItemSpy = jest.spyOn(Storage.prototype, "getItem");
  const removeItemSpy = jest.spyOn(Storage.prototype, "removeItem");

  beforeEach(() => {
    jest.clearAllMocks();
    getItemSpy.mockReset();
    removeItemSpy.mockReset();
  });

  test("renderiza ForgotPassword cuando pathname es /forgot-password", () => {
    getItemSpy.mockReturnValue(null);

    render(
      <MemoryRouter initialEntries={["/forgot-password"]}>
        <App />
      </MemoryRouter>,
    );

    expect(screen.getByText("FORGOT_PASSWORD_VIEW")).toBeInTheDocument();
  });

  test("renderiza ResetPassword cuando pathname es /reset-password", () => {
    getItemSpy.mockReturnValueOnce(null);

    render(
      <MemoryRouter initialEntries={["/reset-password"]}>
        <App />
      </MemoryRouter>,
    );

    expect(screen.getByText("RESET_PASSWORD_VIEW")).toBeInTheDocument();
  });

  test("renderiza Auth cuando no hay token", () => {
    getItemSpy.mockReturnValueOnce(null);

    render(
      <MemoryRouter initialEntries={["/"]}>
        <App />
      </MemoryRouter>,
    );

    expect(screen.getByText("AUTH_VIEW")).toBeInTheDocument();
  });

  test("renderiza VerifyEmail en ruta pública aunque no haya token", () => {
    getItemSpy.mockReturnValueOnce(null);

    render(
      <MemoryRouter initialEntries={["/verify-email?token=test"]}>
        <App />
      </MemoryRouter>,
    );

    expect(screen.getByText("VERIFY_EMAIL_VIEW")).toBeInTheDocument();
  });

  test("renderiza layout protegido cuando hay token", () => {
    getItemSpy.mockReturnValue("fake-token");

    render(
      <MemoryRouter initialEntries={["/alertas"]}>
        <App />
      </MemoryRouter>,
    );

    expect(screen.getByText("ALERTS_VIEW")).toBeInTheDocument();
  });

  test("al cerrar sesión elimina claves y redirige", () => {
    getItemSpy.mockReturnValue("fake-token");
    removeItemSpy.mockImplementation(() => {});

    render(
      <MemoryRouter initialEntries={["/"]}>
        <App />
      </MemoryRouter>,
    );

    fireEvent.click(screen.getByRole("button", { name: /Cerrar Sesión/i }));

    expect(removeItemSpy).toHaveBeenCalledWith("token");
    expect(removeItemSpy).toHaveBeenCalledWith("userId");
    expect(removeItemSpy).toHaveBeenCalledWith("userRoles");
    expect(removeItemSpy).toHaveBeenCalledWith("userEmail");
  });

  test("renderiza los enlaces de navegación principales en modo autenticado", () => {
    getItemSpy.mockReturnValue("fake-token");

    render(
      <MemoryRouter initialEntries={["/"]}>
        <App />
      </MemoryRouter>,
    );

    expect(screen.getByRole("link", { name: /Dashboard \/ Resumen/i })).toBeInTheDocument();
    expect(screen.getByRole("link", { name: /Gestión de Alertas/i })).toBeInTheDocument();
    expect(screen.getByRole("link", { name: /Gestión de Fuentes y canales RSS/i })).toBeInTheDocument();
    expect(screen.getByRole("link", { name: /Buzón de Notificaciones/i })).toBeInTheDocument();
    expect(screen.getByRole("link", { name: /Gestión del Perfil de Usuario/i })).toBeInTheDocument();
    expect(screen.getByRole("link", { name: /Configuración/i })).toBeInTheDocument();
  });

  test("renderiza la vista de configuración cuando la ruta existe", () => {
    getItemSpy.mockReturnValue("fake-token");

    render(
      <MemoryRouter initialEntries={["/configuracion"]}>
        <App />
      </MemoryRouter>,
    );

    expect(screen.getByRole("heading", { name: "Configuración" })).toBeInTheDocument();
  });

  test("renderiza marca y logo en modo autenticado", () => {
    getItemSpy.mockReturnValue("fake-token");

    render(
      <MemoryRouter initialEntries={["/"]}>
        <App />
      </MemoryRouter>,
    );

    expect(screen.getByAltText(/NewsRadar Logo/i)).toBeInTheDocument();
    expect(screen.getByText(/NewsRadar/i)).toBeInTheDocument();
  });
});
