import React from "react";
import { describe, test, expect, beforeEach, vi, afterEach } from "vitest";
import { render, screen, waitFor, fireEvent } from "@testing-library/react";
import { MemoryRouter } from "react-router-dom";
import { ProfilePage } from "./ProfilePage";
import { useAuth } from "../hooks/useAuth";

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

vi.mock("../hooks/useAuth");
const mockedUseAuth = vi.mocked(useAuth);
const mockedLogout = vi.fn();

vi.mock("../components/UserManagementTable", () => ({
  UserManagementTable: ({ isAdmin }: { isAdmin: boolean }) =>
    isAdmin ? <div data-testid="user-management-table">USER_MANAGEMENT_TABLE</div> : null,
}));

const mockFetch = vi.fn();
global.fetch = mockFetch;

describe("ProfilePage", () => {
  beforeEach(() => {
    localStorage.clear();
    mockFetch.mockClear();
    mockedLogout.mockClear();
    mockedNavigate.mockClear();
    mockedUseAuth.mockReturnValue({
      token: "fake-token",
      isAuthenticated: true,
      logout: mockedLogout,
      login: vi.fn(),
    });
    localStorage.setItem("userId", "1");
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  test("muestra carga inicial", () => {
    mockFetch.mockImplementation(() => new Promise(() => {}));

    render(
      <MemoryRouter>
        <ProfilePage />
      </MemoryRouter>
    );

    expect(screen.getByText("Cargando perfil...")).toBeInTheDocument();
  });

  test("renderiza perfil de admin y muestra gestión de usuarios", async () => {
    const adminProfile = {
      id: 1,
      email: "admin@test.com",
      first_name: "Admin",
      last_name: "User",
      organization: "TestOrg",
      role_ids: [3],
    };

    mockFetch.mockResolvedValueOnce({
      ok: true,
      json: async () => adminProfile,
    });

    render(
      <MemoryRouter>
        <ProfilePage />
      </MemoryRouter>
    );

    await waitFor(() => {
      expect(screen.getByText("Perfil de Usuario")).toBeInTheDocument();
    });

    expect(screen.getByText("admin@test.com")).toBeInTheDocument();
    expect(screen.getByText("Admin")).toBeInTheDocument();
    expect(screen.getByText("User")).toBeInTheDocument();
    expect(screen.getByText("Administrador")).toBeInTheDocument();
    expect(screen.getByTestId("user-management-table")).toBeInTheDocument();
  });

  test("renderiza perfil de gestor sin gestión de usuarios", async () => {
    const gestorProfile = {
      id: 2,
      email: "gestor@test.com",
      first_name: "Gestor",
      last_name: "User",
      organization: "TestOrg",
      role_ids: [1],
    };

    mockFetch.mockResolvedValueOnce({
      ok: true,
      json: async () => gestorProfile,
    });

    render(
      <MemoryRouter>
        <ProfilePage />
      </MemoryRouter>
    );

    await waitFor(() => {
      expect(screen.getByText("Perfil de Usuario")).toBeInTheDocument();
    });

    expect(screen.getByText("gestor@test.com")).toBeInTheDocument();
    expect(screen.getByText("Gestor", { selector: "#role-display" })).toBeInTheDocument();
    expect(screen.queryByTestId("user-management-table")).not.toBeInTheDocument();
  });

  test("muestra error cuando falla carga de perfil", async () => {
    mockFetch.mockResolvedValueOnce({
      ok: false,
      json: async () => ({ detail: "Error de autenticación" }),
    });

    render(
      <MemoryRouter>
        <ProfilePage />
      </MemoryRouter>
    );

    await waitFor(() => {
      expect(screen.getByRole("alert")).toBeInTheDocument();
    });

    expect(screen.getByText("Error de autenticación")).toBeInTheDocument();
  });

  test("muestra fallback 'Error al cargar perfil' cuando ok=false y detail vacío", async () => {
    mockFetch.mockResolvedValueOnce({
      ok: false,
      json: async () => ({}),
    });

    render(
      <MemoryRouter>
        <ProfilePage />
      </MemoryRouter>
    );

    await waitFor(() => {
      expect(screen.getByRole("alert")).toBeInTheDocument();
    });

    expect(screen.getByText("Error al cargar perfil")).toBeInTheDocument();
  });

  test("muestra error si no existe userId en localStorage", async () => {
    localStorage.removeItem("userId");

    render(
      <MemoryRouter>
        <ProfilePage />
      </MemoryRouter>
    );

    await waitFor(() => {
      expect(screen.getByRole("alert")).toBeInTheDocument();
    });

    expect(screen.getByText("ID de usuario no encontrado")).toBeInTheDocument();
    expect(mockFetch).not.toHaveBeenCalled();
  });

  test("muestra error cuando no hay token", async () => {
    mockedUseAuth.mockReturnValue({
      token: null,
      isAuthenticated: false,
      logout: mockedLogout,
      login: vi.fn(),
    });

    render(
      <MemoryRouter>
        <ProfilePage />
      </MemoryRouter>
    );

    await waitFor(() => {
      expect(screen.getByRole("alert")).toBeInTheDocument();
    });

    expect(screen.getByText("No se pudo cargar el perfil")).toBeInTheDocument();
    expect(mockFetch).not.toHaveBeenCalled();
  });

  test("muestra fallback cuando response ok pero body null", async () => {
    mockFetch.mockResolvedValueOnce({
      ok: true,
      json: async () => null,
    });

    render(
      <MemoryRouter>
        <ProfilePage />
      </MemoryRouter>
    );

    await waitFor(() => {
      expect(screen.getByRole("alert")).toBeInTheDocument();
    });

    expect(screen.getByText("No se pudo cargar el perfil")).toBeInTheDocument();
  });

  test("muestra error cuando fetch del perfil lanza excepción", async () => {
    mockFetch.mockRejectedValueOnce(new Error("API caída"));

    render(
      <MemoryRouter>
        <ProfilePage />
      </MemoryRouter>
    );

    await waitFor(() => {
      expect(screen.getByRole("alert")).toBeInTheDocument();
    });

    expect(screen.getByText("API caída")).toBeInTheDocument();
  });

  test("muestra 'Error desconocido' cuando el catch recibe algo no Error", async () => {
    mockFetch.mockRejectedValueOnce("Error de red string");

    render(
      <MemoryRouter>
        <ProfilePage />
      </MemoryRouter>
    );

    await waitFor(() => {
      expect(screen.getByRole("alert")).toBeInTheDocument();
    });

    expect(screen.getByText("Error desconocido")).toBeInTheDocument();
  });

  test("muestra error cuando API responde 500 y falla al leer el cuerpo", async () => {
    mockFetch.mockResolvedValueOnce({
      ok: false,
      status: 500,
      json: async () => {
        throw new Error("Error 500 interno");
      },
    });

    render(
      <MemoryRouter>
        <ProfilePage />
      </MemoryRouter>
    );

    await waitFor(() => {
      expect(screen.getByRole("alert")).toBeInTheDocument();
    });

    expect(screen.getByText("Error 500 interno")).toBeInTheDocument();
  });

  test("muestra email verificado (CheckCircle verde) cuando is_active es true", async () => {
    const verifiedProfile = {
      id: 1,
      email: "verified@test.com",
      first_name: "Verified",
      last_name: "User",
      organization: "TestOrg",
      role_ids: [2],
      is_active: true,
      email_verified: true,
      is_verified: true,
    };

    mockFetch.mockResolvedValueOnce({
      ok: true,
      json: async () => verifiedProfile,
    });

    render(
      <MemoryRouter>
        <ProfilePage />
      </MemoryRouter>
    );

    await waitFor(() => {
      expect(screen.getByText("Perfil de Usuario")).toBeInTheDocument();
    });

    // Buscar el estado de verificación del email
    const emailStatusElement = screen.getByText("Email Verificado");
    expect(emailStatusElement).toBeInTheDocument();

    // Verificar que el botón de verificación está deshabilitado
    const verifyButton = screen.getByRole("button", {
      name: /Verificar correo/i,
    });
    expect(verifyButton).toBeDisabled();
  });

  test("muestra email no verificado (XCircle naranja) cuando is_active es false", async () => {
    const notVerifiedProfile = {
      id: 2,
      email: "notverified@test.com",
      first_name: "NotVerified",
      last_name: "User",
      organization: "TestOrg",
      role_ids: [2],
      is_active: false,
      email_verified: false,
      is_verified: false,
    };

    mockFetch.mockResolvedValueOnce({
      ok: true,
      json: async () => notVerifiedProfile,
    });

    render(
      <MemoryRouter>
        <ProfilePage />
      </MemoryRouter>
    );

    await waitFor(() => {
      expect(screen.getByText("Perfil de Usuario")).toBeInTheDocument();
    });

    // Buscar el estado de no verificación del email
    const emailStatusElement = screen.getByText("No verificado");
    expect(emailStatusElement).toBeInTheDocument();

    // Verificar que el botón está habilitado para reenviar verificación
    const verifyButton = screen.getByRole("button", {
      name: /Verificar correo/i,
    });
    expect(verifyButton).not.toBeDisabled();
  });

  test("envía solicitud de reenvío de verificación y muestra mensaje de éxito", async () => {
    const notVerifiedProfile = {
      id: 2,
      email: "notverified@test.com",
      first_name: "NotVerified",
      last_name: "User",
      organization: "TestOrg",
      role_ids: [2],
      is_active: false,
      email_verified: false,
      is_verified: false,
    };

    mockFetch
      .mockResolvedValueOnce({
        ok: true,
        json: async () => notVerifiedProfile,
      })
      .mockResolvedValueOnce({
        ok: true,
        json: async () => ({ message: "reenviado" }),
      });

    render(
      <MemoryRouter>
        <ProfilePage />
      </MemoryRouter>
    );

    await waitFor(() => {
      expect(screen.getByText("Perfil de Usuario")).toBeInTheDocument();
    });

    const verifyButton = screen.getByRole("button", {
      name: /Verificar correo/i,
    });

    fireEvent.click(verifyButton);

    await waitFor(() => {
      expect(mockFetch).toHaveBeenCalledTimes(2);
    });

    expect(mockFetch).toHaveBeenNthCalledWith(
      2,
      expect.stringContaining("/api/v1/auth/resend-verification"),
      expect.objectContaining({
        method: "POST",
      }),
    );

    expect(
      await screen.findByText("Te hemos reenviado un correo de verificación."),
    ).toBeInTheDocument();
  });

  test("muestra mensaje de error cuando falla el reenvío de verificación", async () => {
    const notVerifiedProfile = {
      id: 2,
      email: "notverified@test.com",
      first_name: "NotVerified",
      last_name: "User",
      organization: "TestOrg",
      role_ids: [2],
      is_active: false,
      email_verified: false,
      is_verified: false,
    };

    mockFetch
      .mockResolvedValueOnce({
        ok: true,
        json: async () => notVerifiedProfile,
      })
      .mockResolvedValueOnce({
        ok: false,
        json: async () => ({ detail: "No autorizado" }),
      });

    render(
      <MemoryRouter>
        <ProfilePage />
      </MemoryRouter>
    );

    await waitFor(() => {
      expect(screen.getByText("Perfil de Usuario")).toBeInTheDocument();
    });

    const verifyButton = screen.getByRole("button", {
      name: /Verificar correo/i,
    });

    fireEvent.click(verifyButton);

    expect(await screen.findByText("No autorizado")).toBeInTheDocument();
  });

  test("usa mensaje de fallback cuando el reenvío falla con error no tipado", async () => {
    const notVerifiedProfile = {
      id: 2,
      email: "notverified@test.com",
      first_name: "NotVerified",
      last_name: "User",
      organization: "TestOrg",
      role_ids: [2],
      is_active: false,
      email_verified: false,
      is_verified: false,
    };

    mockFetch
      .mockResolvedValueOnce({
        ok: true,
        json: async () => notVerifiedProfile,
      })
      .mockRejectedValueOnce("error-string");

    render(
      <MemoryRouter>
        <ProfilePage />
      </MemoryRouter>
    );

    await waitFor(() => {
      expect(screen.getByText("Perfil de Usuario")).toBeInTheDocument();
    });

    const verifyButton = screen.getByRole("button", {
      name: /Verificar correo/i,
    });

    fireEvent.click(verifyButton);

    expect(
      await screen.findByText("No se pudo reenviar el correo de verificación."),
    ).toBeInTheDocument();
  });

  test("abre el modal de borrado y permite cancelarlo", async () => {
    const profile = {
      id: 1,
      email: "user@test.com",
      first_name: "User",
      last_name: "Test",
      organization: "TestOrg",
      role_ids: [2],
      is_active: false,
      email_verified: false,
      is_verified: false,
    };

    mockFetch.mockResolvedValueOnce({
      ok: true,
      json: async () => profile,
    });

    render(
      <MemoryRouter>
        <ProfilePage />
      </MemoryRouter>
    );

    await screen.findByText("Perfil de Usuario");

    fireEvent.click(screen.getByRole("button", { name: /Eliminar Cuenta/i }));

    expect(
      screen.getByRole("dialog", { name: /Confirmar eliminación de cuenta/i }),
    ).toBeInTheDocument();

    fireEvent.change(screen.getByLabelText(/Contraseña actual/i), {
      target: { value: "Secret123!" },
    });

    fireEvent.click(screen.getByRole("button", { name: /Cancelar/i }));

    expect(screen.queryByRole("dialog")).not.toBeInTheDocument();
  });

  test("confirma borrado de cuenta con éxito, llama logout y navega a login", async () => {
    const profile = {
      id: 1,
      email: "user@test.com",
      first_name: "User",
      last_name: "Test",
      organization: "TestOrg",
      role_ids: [2],
      is_active: false,
      email_verified: false,
      is_verified: false,
    };

    mockFetch
      .mockResolvedValueOnce({
        ok: true,
        json: async () => profile,
      })
      .mockResolvedValueOnce({
        ok: true,
      });

    render(
      <MemoryRouter>
        <ProfilePage />
      </MemoryRouter>
    );

    await screen.findByText("Perfil de Usuario");

    fireEvent.click(screen.getByRole("button", { name: /Eliminar Cuenta/i }));
    fireEvent.change(screen.getByLabelText(/Contraseña actual/i), {
      target: { value: "Secret123!" },
    });

    fireEvent.click(screen.getByRole("button", { name: /Eliminar definitivamente/i }));

    await waitFor(() => {
      expect(mockFetch).toHaveBeenNthCalledWith(
        2,
        expect.stringContaining("/api/v1/users/1"),
        expect.objectContaining({
          method: "DELETE",
          body: JSON.stringify({ password: "Secret123!" }),
        }),
      );
    });

    expect(mockedLogout).toHaveBeenCalledTimes(1);
    expect(mockedNavigate).toHaveBeenCalledWith("/login", { replace: true });
  });

  test("muestra error si intenta borrar sin contraseña", async () => {
    const profile = {
      id: 1,
      email: "user@test.com",
      first_name: "User",
      last_name: "Test",
      organization: "TestOrg",
      role_ids: [2],
      is_active: false,
      email_verified: false,
      is_verified: false,
    };

    mockFetch.mockResolvedValueOnce({
      ok: true,
      json: async () => profile,
    });

    render(
      <MemoryRouter>
        <ProfilePage />
      </MemoryRouter>
    );

    await screen.findByText("Perfil de Usuario");

    fireEvent.click(screen.getByRole("button", { name: /Eliminar Cuenta/i }));
    fireEvent.click(screen.getByRole("button", { name: /Eliminar definitivamente/i }));

    expect(
      await screen.findByText("Debes introducir tu contraseña para continuar."),
    ).toBeInTheDocument();
    expect(mockFetch).toHaveBeenCalledTimes(1);
  });

  test("muestra error si falta userId al confirmar borrado", async () => {
    const profile = {
      id: 1,
      email: "user@test.com",
      first_name: "User",
      last_name: "Test",
      organization: "TestOrg",
      role_ids: [2],
      is_active: false,
      email_verified: false,
      is_verified: false,
    };

    mockFetch.mockResolvedValueOnce({
      ok: true,
      json: async () => profile,
    });

    render(
      <MemoryRouter>
        <ProfilePage />
      </MemoryRouter>
    );

    await screen.findByText("Perfil de Usuario");
    fireEvent.click(screen.getByRole("button", { name: /Eliminar Cuenta/i }));

    fireEvent.change(screen.getByLabelText(/Contraseña actual/i), {
      target: { value: "Secret123!" },
    });
    localStorage.removeItem("userId");

    fireEvent.click(screen.getByRole("button", { name: /Eliminar definitivamente/i }));

    expect(
      await screen.findByText("No se encontró el identificador de usuario."),
    ).toBeInTheDocument();
    expect(mockFetch).toHaveBeenCalledTimes(1);
  });

  test("muestra detalle del backend cuando falla el borrado", async () => {
    const profile = {
      id: 1,
      email: "user@test.com",
      first_name: "User",
      last_name: "Test",
      organization: "TestOrg",
      role_ids: [2],
      is_active: false,
      email_verified: false,
      is_verified: false,
    };

    mockFetch
      .mockResolvedValueOnce({
        ok: true,
        json: async () => profile,
      })
      .mockResolvedValueOnce({
        ok: false,
        json: async () => ({ detail: "Contraseña incorrecta" }),
      });

    render(
      <MemoryRouter>
        <ProfilePage />
      </MemoryRouter>
    );

    await screen.findByText("Perfil de Usuario");
    fireEvent.click(screen.getByRole("button", { name: /Eliminar Cuenta/i }));
    fireEvent.change(screen.getByLabelText(/Contraseña actual/i), {
      target: { value: "wrong-pass" },
    });
    fireEvent.click(screen.getByRole("button", { name: /Eliminar definitivamente/i }));

    expect(await screen.findByText("Contraseña incorrecta")).toBeInTheDocument();
    expect(mockedLogout).not.toHaveBeenCalled();
  });

  test("usa mensaje fallback si el borrado rechaza con error no tipado", async () => {
    const profile = {
      id: 1,
      email: "user@test.com",
      first_name: "User",
      last_name: "Test",
      organization: "TestOrg",
      role_ids: [2],
      is_active: false,
      email_verified: false,
      is_verified: false,
    };

    mockFetch
      .mockResolvedValueOnce({
        ok: true,
        json: async () => profile,
      })
      .mockRejectedValueOnce("delete-string-error");

    render(
      <MemoryRouter>
        <ProfilePage />
      </MemoryRouter>
    );

    await screen.findByText("Perfil de Usuario");
    fireEvent.click(screen.getByRole("button", { name: /Eliminar Cuenta/i }));
    fireEvent.change(screen.getByLabelText(/Contraseña actual/i), {
      target: { value: "Secret123!" },
    });
    fireEvent.click(screen.getByRole("button", { name: /Eliminar definitivamente/i }));

    expect(await screen.findByText("No se pudo eliminar la cuenta.")).toBeInTheDocument();
    expect(mockedLogout).not.toHaveBeenCalled();
  });
});
