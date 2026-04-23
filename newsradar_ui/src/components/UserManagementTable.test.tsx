import React from "react";
import { describe, test, expect, beforeEach, vi, afterEach } from "vitest";
import { render, screen, waitFor, fireEvent } from "@testing-library/react";
import { UserManagementTable } from "./UserManagementTable";

const mockFetch = vi.fn();
global.fetch = mockFetch;

describe("UserManagementTable", () => {
  beforeEach(() => {
    localStorage.clear();
    mockFetch.mockClear();
    localStorage.setItem("token", "fake-admin-token");
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  test("no renderiza nada cuando isAdmin es false", () => {
    const { container } = render(<UserManagementTable isAdmin={false} />);
    expect(container.firstChild).toBeNull();
    expect(mockFetch).not.toHaveBeenCalled();
  });

  test("muestra estado de carga mientras obtiene usuarios", () => {
    mockFetch.mockImplementation(
      () => new Promise(() => {}) // Promise pendiente
    );

    render(<UserManagementTable isAdmin={true} />);

    expect(screen.getByText("Cargando usuarios...")).toBeInTheDocument();
  });

  test("renderiza tabla de usuarios correctamente", async () => {
    const mockUsers = [
      {
        id: 1,
        email: "admin@test.com",
        first_name: "Admin",
        last_name: "User",
        role_ids: [3],
      },
      {
        id: 2,
        email: "gestor@test.com",
        first_name: "Gestor",
        last_name: "User",
        role_ids: [1],
      },
    ];

    mockFetch.mockResolvedValueOnce({
      ok: true,
      json: async () => mockUsers,
    });

    render(<UserManagementTable isAdmin={true} />);

    await waitFor(() => {
      expect(screen.getByText("Gestión de Usuarios")).toBeInTheDocument();
    });

    expect(screen.getByRole("grid")).toBeInTheDocument();
    expect(screen.getByText("admin@test.com")).toBeInTheDocument();
    expect(screen.getByText("gestor@test.com")).toBeInTheDocument();
    expect(screen.getByText("Admin User")).toBeInTheDocument();
    expect(screen.getByText("Gestor User")).toBeInTheDocument();

    // Verificar headers de tabla semántica
    expect(screen.getByRole("columnheader", { name: "Email" })).toBeInTheDocument();
    expect(screen.getByRole("columnheader", { name: "Nombre Completo" })).toBeInTheDocument();
    expect(screen.getByRole("columnheader", { name: "Rol Actual" })).toBeInTheDocument();
    expect(screen.getByRole("columnheader", { name: "Cambiar Rol" })).toBeInTheDocument();
  });

  test("select tiene aria-label accesible para SonarCloud", async () => {
    const mockUsers = [
      {
        id: 1,
        email: "user@test.com",
        first_name: "Test",
        last_name: "User",
        role_ids: [1],
      },
    ];

    mockFetch.mockResolvedValueOnce({
      ok: true,
      json: async () => mockUsers,
    });

    render(<UserManagementTable isAdmin={true} />);

    await waitFor(() => {
      expect(screen.getByLabelText("Cambiar rol de usuario user@test.com")).toBeInTheDocument();
    });

    const select = screen.getByLabelText("Cambiar rol de usuario user@test.com");
    expect(select).toBeInTheDocument();
    expect(select.tagName).toBe("SELECT");
  });

  test("muestra error cuando falla la carga de usuarios", async () => {
    mockFetch.mockResolvedValueOnce({
      ok: false,
      json: async () => ({ detail: "No autorizado" }),
    });

    render(<UserManagementTable isAdmin={true} />);

    await waitFor(() => {
      expect(screen.getByRole("alert")).toBeInTheDocument();
    });

    expect(screen.getByText("No autorizado")).toBeInTheDocument();
  });

  test("actualiza rol de usuario al cambiar select", async () => {
    const mockUsers = [
      {
        id: 2,
        email: "user@test.com",
        first_name: "Test",
        last_name: "User",
        role_ids: [1],
      },
    ];

    const updatedUser = {
      id: 2,
      email: "user@test.com",
      first_name: "Test",
      last_name: "User",
      role_ids: [2],
    };

    // Primera llamada: cargar usuarios
    mockFetch.mockResolvedValueOnce({
      ok: true,
      json: async () => mockUsers,
    });

    // Segunda llamada: actualizar rol
    mockFetch.mockResolvedValueOnce({
      ok: true,
      json: async () => updatedUser,
    });

    render(<UserManagementTable isAdmin={true} />);

    await waitFor(() => {
      expect(screen.getByLabelText("Cambiar rol de usuario user@test.com")).toBeInTheDocument();
    });

    const select = screen.getByLabelText("Cambiar rol de usuario user@test.com");
    fireEvent.change(select, { target: { value: "2" } });

    await waitFor(() => {
      expect(mockFetch).toHaveBeenCalledTimes(2);
    });

    // Verificar que se llamó al endpoint correcto con PATCH
    expect(mockFetch).toHaveBeenNthCalledWith(
      2,
      expect.stringContaining("/api/v1/users/2/role"),
      expect.objectContaining({
        method: "PATCH",
        body: JSON.stringify({ role_id: 2 }),
      })
    );

    // Verificar que el rol actualizado se refleja en la UI
    await waitFor(() => {
      const roleCells = screen.getAllByRole("cell");
      expect(roleCells.some((cell) => cell.textContent === "Lector")).toBe(true);
    });
  });

  test("muestra mensaje cuando no hay usuarios", async () => {
    mockFetch.mockResolvedValueOnce({
      ok: true,
      json: async () => [],
    });

    render(<UserManagementTable isAdmin={true} />);

    await waitFor(() => {
      expect(screen.getByText("No hay usuarios para mostrar.")).toBeInTheDocument();
    });
  });
});
