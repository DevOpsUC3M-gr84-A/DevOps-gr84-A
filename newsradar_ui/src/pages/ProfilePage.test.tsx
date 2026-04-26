import React from "react";
import { describe, test, expect, beforeEach, vi, afterEach } from "vitest";
import { render, screen, waitFor, fireEvent } from "@testing-library/react";
import { MemoryRouter } from "react-router-dom";
import { ProfilePage } from "./ProfilePage";
import { useAuth } from "../hooks/useAuth";

vi.mock("../hooks/useAuth");
const mockedUseAuth = vi.mocked(useAuth);

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
    mockedUseAuth.mockReturnValue({
      token: "fake-token",
      isAuthenticated: true,
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
});
