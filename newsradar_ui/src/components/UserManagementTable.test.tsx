import React from "react";
import { describe, test, expect, beforeEach, vi, afterEach } from "vitest";
import { render, screen, waitFor, fireEvent, act } from "@testing-library/react";
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
    mockFetch.mockImplementation(() => new Promise(() => {}));

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

    mockFetch.mockResolvedValueOnce({
      ok: true,
      json: async () => mockUsers,
    });

    mockFetch.mockResolvedValueOnce({
      ok: true,
      json: async () => updatedUser,
    });

    render(<UserManagementTable isAdmin={true} />);

    await waitFor(() => {
      expect(screen.getByLabelText("Cambiar rol de usuario user@test.com")).toBeInTheDocument();
    });

    fireEvent.change(screen.getByLabelText("Cambiar rol de usuario user@test.com"), {
      target: { value: "2" },
    });

    await waitFor(() => {
      expect(mockFetch).toHaveBeenCalledTimes(2);
    });

    expect(mockFetch).toHaveBeenNthCalledWith(
      2,
      expect.stringContaining("/api/v1/users/2/role"),
      expect.objectContaining({
        method: "PATCH",
        body: JSON.stringify({ role_id: 2 }),
      }),
    );

    await waitFor(() => {
      expect(screen.queryAllByText("Lector", { selector: "td" }).length).toBeGreaterThan(0);
    });
  });

  test("muestra error cuando falla PATCH de actualización", async () => {
    const mockUsers = [
      {
        id: 2,
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

    mockFetch.mockResolvedValueOnce({
      ok: false,
      json: async () => ({ detail: "No se pudo actualizar" }),
    });

    render(<UserManagementTable isAdmin={true} />);

    await waitFor(() => {
      expect(screen.getByLabelText("Cambiar rol de usuario user@test.com")).toBeInTheDocument();
    });

    fireEvent.change(screen.getByLabelText("Cambiar rol de usuario user@test.com"), {
      target: { value: "3" },
    });

    await waitFor(() => {
      expect(screen.getByText("No se pudo actualizar")).toBeInTheDocument();
    });
  });

  test("muestra error si no hay token al cargar usuarios", async () => {
    localStorage.removeItem("token");

    render(<UserManagementTable isAdmin={true} />);

    await waitFor(() => {
      expect(screen.getByText("No autenticado")).toBeInTheDocument();
    });

    expect(mockFetch).not.toHaveBeenCalled();
  });

  test("muestra error si no hay token al intentar PATCH", async () => {
    const mockUsers = [
      {
        id: 2,
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

    localStorage.removeItem("token");
    fireEvent.change(screen.getByLabelText("Cambiar rol de usuario user@test.com"), {
      target: { value: "3" },
    });

    await waitFor(() => {
      expect(screen.getByText("No autenticado")).toBeInTheDocument();
    });

    expect(mockFetch).toHaveBeenCalledTimes(1);
  });

  test("muestra error cuando GET lanza error de red", async () => {
    mockFetch.mockRejectedValueOnce(new Error("Network failure"));

    render(<UserManagementTable isAdmin={true} />);

    await waitFor(() => {
      expect(screen.getByText("Network failure")).toBeInTheDocument();
    });
  });

  test("muestra error cuando PATCH lanza error de red", async () => {
    const mockUsers = [
      {
        id: 2,
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

    mockFetch.mockRejectedValueOnce(new Error("Network failure"));

    render(<UserManagementTable isAdmin={true} />);

    await waitFor(() => {
      expect(screen.getByLabelText("Cambiar rol de usuario user@test.com")).toBeInTheDocument();
    });

    fireEvent.change(screen.getByLabelText("Cambiar rol de usuario user@test.com"), {
      target: { value: "3" },
    });

    await waitFor(() => {
      expect(screen.getByText("Network failure")).toBeInTheDocument();
    });
  });

  test("si PATCH es ok pero json falla, actualiza rol local con fallback", async () => {
    const mockUsers = [
      {
        id: 2,
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

    mockFetch.mockResolvedValueOnce({
      ok: true,
      json: async () => {
        throw new Error("invalid json");
      },
    });

    render(<UserManagementTable isAdmin={true} />);

    await waitFor(() => {
      expect(screen.getByLabelText("Cambiar rol de usuario user@test.com")).toBeInTheDocument();
    });

    fireEvent.change(screen.getByLabelText("Cambiar rol de usuario user@test.com"), {
      target: { value: "3" },
    });

    await waitFor(() => {
      expect(screen.getByRole("cell", { name: "Administrador" })).toBeInTheDocument();
    });
  });

  test("limpia successMessage tras el temporizador", async () => {
    vi.useFakeTimers();

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
      role_ids: [3],
    };

    mockFetch.mockResolvedValueOnce({
      ok: true,
      json: async () => mockUsers,
    });

    mockFetch.mockResolvedValueOnce({
      ok: true,
      json: async () => updatedUser,
    });

    render(<UserManagementTable isAdmin={true} />);

    await waitFor(() => {
      expect(screen.getByLabelText("Cambiar rol de usuario user@test.com")).toBeInTheDocument();
    });

    fireEvent.change(screen.getByLabelText("Cambiar rol de usuario user@test.com"), {
      target: { value: "3" },
    });

    await waitFor(() => {
      expect(screen.getByText("Rol actualizado correctamente")).toBeInTheDocument();
    });

    act(() => {
      vi.advanceTimersByTime(3000);
    });

    await waitFor(() => {
      expect(screen.queryByText("Rol actualizado correctamente")).not.toBeInTheDocument();
    });

    vi.useRealTimers();
  });
});
