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

// Mokeamos la cabecera para poder simular fácilmente el evento de subir una foto
vi.mock("../components/ProfileHeader", () => ({
  ProfileHeader: ({ onImageUpdate, firstName, lastName }: any) => (
    <div data-testid="profile-header">
      <h1>{firstName} {lastName}</h1>
      <button onClick={() => onImageUpdate("avatar", "base64-avatar-string")}>
        Simular Subir Foto
      </button>
    </div>
  ),
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
      expect(screen.getByText("Información Personal")).toBeInTheDocument();
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
      expect(screen.getByText("Información Personal")).toBeInTheDocument();
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

  test("envía solicitud de reenvío de verificación y muestra mensaje de éxito", async () => {
    const notVerifiedProfile = {
      id: 2,
      email: "notverified@test.com",
      first_name: "NotVerified",
      last_name: "User",
      role_ids: [2],
      is_active: false,
    };

    mockFetch
      .mockResolvedValueOnce({ ok: true, json: async () => notVerifiedProfile })
      .mockResolvedValueOnce({ ok: true, json: async () => ({ message: "reenviado" }) });

    render(<MemoryRouter><ProfilePage /></MemoryRouter>);
    await waitFor(() => expect(screen.getByText("Información Personal")).toBeInTheDocument());

    fireEvent.click(screen.getByRole("button", { name: /Verificar correo/i }));

    await waitFor(() => expect(mockFetch).toHaveBeenCalledTimes(2));
    expect(await screen.findByText("Te hemos reenviado un correo de verificación.")).toBeInTheDocument();
  });

  test("abre el modal de borrado y permite cancelarlo", async () => {
    const profile = {
      id: 1, email: "user@test.com", first_name: "User", last_name: "Test", role_ids: [2]
    };

    mockFetch.mockResolvedValueOnce({ ok: true, json: async () => profile });

    render(<MemoryRouter><ProfilePage /></MemoryRouter>);
    await screen.findByText("Información Personal");

    fireEvent.click(screen.getByRole("button", { name: /Eliminar Cuenta/i }));

    expect(screen.getByRole("dialog")).toBeInTheDocument();
    expect(screen.getByText("Confirmar eliminación")).toBeInTheDocument();

    // Buscamos por placeholder en vez de LabelText
    fireEvent.change(screen.getByPlaceholderText("••••••••"), { target: { value: "Secret123!" } });
    fireEvent.click(screen.getByRole("button", { name: /Cancelar/i }));

    expect(screen.queryByRole("dialog")).not.toBeInTheDocument();
  });

  test("confirma borrado de cuenta con éxito, llama logout y navega a login", async () => {
    const profile = {
      id: 1, email: "user@test.com", first_name: "User", last_name: "Test", role_ids: [2]
    };

    mockFetch
      .mockResolvedValueOnce({ ok: true, json: async () => profile })
      .mockResolvedValueOnce({ ok: true });

    render(<MemoryRouter><ProfilePage /></MemoryRouter>);
    await screen.findByText("Información Personal");

    fireEvent.click(screen.getByRole("button", { name: /Eliminar Cuenta/i }));
    
    // Buscamos por placeholder
    fireEvent.change(screen.getByPlaceholderText("••••••••"), { target: { value: "Secret123!" } });
    
    // El botón dentro del modal es "Eliminar" (con regex estricto para no confundir con "Eliminar Cuenta")
    fireEvent.click(screen.getByRole("button", { name: /^Eliminar$/i }));

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

  test("permite al usuario editar y guardar su perfil", async () => {
    const profile = {
      id: 1, email: "user@test.com", first_name: "Original", last_name: "Name", role_ids: [2]
    };

    const updatedProfile = { ...profile, first_name: "Editado" };

    // Arreglamos el mock: que SIEMPRE devuelva un response.json válido
    mockFetch.mockImplementation(async (url: string, init?: RequestInit) => {
      if (init?.method === "PUT") {
        return { 
          ok: true, 
          json: async () => updatedProfile // Devuelve el perfil entero actualizado
        };
      }
      return { 
        ok: true, 
        json: async () => profile // Devuelve el perfil inicial
      };
    });

    render(<MemoryRouter><ProfilePage /></MemoryRouter>);
    
    // Esperamos por el nombre, no por el título
    await screen.findByText("Original");

    fireEvent.click(screen.getByRole("button", { name: /Editar Perfil/i }));
    fireEvent.change(screen.getByDisplayValue("Original"), { target: { value: "Editado" } });
    fireEvent.click(screen.getByRole("button", { name: /Guardar/i }));

    await waitFor(() => {
      expect(mockFetch).toHaveBeenCalledWith(
        expect.stringContaining("/api/v1/users/1"),
        expect.objectContaining({ method: "PUT" })
      );
    });

    expect(await screen.findByText("Editado")).toBeInTheDocument();
  });

  test("cancela la edición sin guardar", async () => {
    const profile = {
      id: 1, email: "user@test.com", first_name: "Original", last_name: "Name", role_ids: [2]
    };

    mockFetch.mockImplementation(async () => {
      return { ok: true, json: async () => profile };
    });

    render(<MemoryRouter><ProfilePage /></MemoryRouter>);
    
    await screen.findByText("Original");

    fireEvent.click(screen.getByRole("button", { name: /Editar Perfil/i }));
    fireEvent.change(screen.getByDisplayValue("Original"), { target: { value: "Editado" } });
    fireEvent.click(screen.getByRole("button", { name: /Cancelar/i }));

    const putCalls = mockFetch.mock.calls.filter(call => call[1]?.method === "PUT");
    expect(putCalls.length).toBe(0); 
    
    expect(screen.getByText("Original")).toBeInTheDocument();
  });

  test("dispara endpoint de olvidó contraseña al clicar 'Recuperar acceso'", async () => {
    const profile = {
      id: 1, email: "user@test.com", first_name: "User", last_name: "Test", role_ids: [2]
    };

    mockFetch.mockImplementation(async (url: string, init?: RequestInit) => {
      if (init?.method === "POST") {
        return { ok: true, json: async () => ({}) };
      }
      return { ok: true, json: async () => profile };
    });

    render(<MemoryRouter><ProfilePage /></MemoryRouter>);
    await screen.findByText("Información Personal");

    fireEvent.click(screen.getByRole("button", { name: /Recuperar acceso/i }));

    await waitFor(() => {
      expect(mockFetch).toHaveBeenCalledWith(
        expect.stringContaining("/api/v1/auth/forgot-password"),
        expect.objectContaining({ method: "POST" })
      );
    });
    
    expect(await screen.findByText("Recibirás un correo para restablecer tu contraseña.")).toBeInTheDocument();
  });

  test("abre el modal de cambiar contraseña al hacer clic en el botón correspondiente", async () => {
    const profile = {
      id: 1, email: "user@test.com", first_name: "User", last_name: "Test", role_ids: [2]
    };

    mockFetch.mockResolvedValue({ ok: true, json: async () => profile });

    render(<MemoryRouter><ProfilePage /></MemoryRouter>);
    await screen.findByText("Información Personal");

    fireEvent.click(screen.getByRole("button", { name: /Cambiar contraseña/i }));

    expect(await screen.findByRole("heading", { name: /Cambiar Contraseña/i })).toBeInTheDocument();
  });

  test("actualiza el avatar llamando a la API al recibir evento del ProfileHeader", async () => {
    const profile = {
      id: 1, email: "user@test.com", first_name: "User", last_name: "Test", role_ids: [2], avatar: null
    };

    const updatedProfile = { ...profile, avatar: "base64-avatar-string" };

    mockFetch.mockImplementation(async (url: string, init?: RequestInit) => {
      if (init?.method === "PUT") {
        // En tu ProfilePage, si el put falla no hace .json(), pero si va bien espera un objeto
        return { ok: true, json: async () => updatedProfile };
      }
      return { ok: true, json: async () => profile };
    });

    render(<MemoryRouter><ProfilePage /></MemoryRouter>);
    await screen.findByText("Información Personal");

    fireEvent.click(screen.getByRole("button", { name: /Simular Subir Foto/i }));

    await waitFor(() => {
      expect(mockFetch).toHaveBeenCalledWith(
        expect.stringContaining("/api/v1/users/1"),
        expect.objectContaining({ 
          method: "PUT",
          body: JSON.stringify({ avatar: "base64-avatar-string" })
        })
      );
    });
  });

  test("muestra error si intenta borrar sin contraseña", async () => {
    const profile = {
      id: 1, email: "user@test.com", first_name: "User", last_name: "Test", role_ids: [2]
    };

    mockFetch.mockResolvedValueOnce({ ok: true, json: async () => profile });

    render(<MemoryRouter><ProfilePage /></MemoryRouter>);
    await screen.findByText("Información Personal");

    fireEvent.click(screen.getByRole("button", { name: /Eliminar Cuenta/i }));
    
    // Aquí no rellenamos el input, directamente le damos a Eliminar
    fireEvent.click(screen.getByRole("button", { name: /^Eliminar$/i }));

    expect(await screen.findByText("Debes introducir tu contraseña para continuar.")).toBeInTheDocument();
    
    // Aseguramos que NO ha hecho la llamada al backend
    expect(mockFetch).toHaveBeenCalledTimes(1); // Solo el GET inicial
  });
  test("muestra error de alerta de navegador si el guardado optimista de la foto falla en el backend", async () => {
    const profile = { id: 1, email: "u@t.com", first_name: "U", last_name: "T", role_ids: [2] };
    mockFetch.mockImplementation(async (url: string, init?: RequestInit) => {
      if (init?.method === "PUT") return { ok: false }; // Forzamos fallo en el PUT
      return { ok: true, json: async () => profile };
    });
    vi.spyOn(window, 'alert').mockImplementation(() => {});
    vi.spyOn(console, 'error').mockImplementation(() => {}); // Evita ensuciar la consola

    render(<MemoryRouter><ProfilePage /></MemoryRouter>);
    await screen.findByText("Información Personal");

    fireEvent.click(screen.getByRole("button", { name: /Simular Subir Foto/i }));

    await waitFor(() => {
      expect(window.alert).toHaveBeenCalledWith("Hubo un error al intentar guardar la imagen.");
    });
  });

  test("muestra mensaje de error rojo si falla la solicitud de recuperar contraseña", async () => {
    const profile = { id: 1, email: "u@t.com", first_name: "U", last_name: "T", role_ids: [2] };
    mockFetch.mockImplementation(async (url: string, init?: RequestInit) => {
      if (init?.method === "POST") throw new Error("Servidor caído");
      return { ok: true, json: async () => profile };
    });

    render(<MemoryRouter><ProfilePage /></MemoryRouter>);
    await screen.findByText("Información Personal");

    fireEvent.click(screen.getByRole("button", { name: /Recuperar acceso/i }));
    expect(await screen.findByText("Servidor caído")).toBeInTheDocument();
  });

  test("muestra mensaje de error rojo si falla el reenvío de correo de verificación", async () => {
    const profile = { id: 1, email: "u@t.com", first_name: "U", last_name: "T", role_ids: [2], is_active: false };
    mockFetch.mockImplementation(async (url: string, init?: RequestInit) => {
      if (init?.method === "POST") throw new Error("Fallo de red");
      return { ok: true, json: async () => profile };
    });

    render(<MemoryRouter><ProfilePage /></MemoryRouter>);
    await screen.findByText("Información Personal");

    fireEvent.click(screen.getByRole("button", { name: /Verificar correo/i }));
    expect(await screen.findByText("Fallo de red")).toBeInTheDocument();
  });
  test("muestra mensaje de error cuando falla el guardado del perfil (error desde el backend)", async () => {
    const profile = { id: 1, email: "u@test.com", first_name: "Orig", last_name: "Name", role_ids: [2] };
    mockFetch.mockImplementation(async (url: string, init?: RequestInit) => {
      if (init?.method === "PUT") return { ok: false, json: async () => ({ detail: "Error de validación al actualizar" }) };
      return { ok: true, json: async () => profile };
    });

    render(<MemoryRouter><ProfilePage /></MemoryRouter>);
    await screen.findByText("Orig");
    
    fireEvent.click(screen.getByRole("button", { name: /Editar Perfil/i }));
    fireEvent.change(screen.getByDisplayValue("Orig"), { target: { value: "Nuevo" } });
    fireEvent.click(screen.getByRole("button", { name: /Guardar/i }));
    
    expect(await screen.findByText("Error de validación al actualizar")).toBeInTheDocument();
  });

  test("muestra error genérico al guardar perfil si la API falla con un error de red", async () => {
    const profile = { id: 1, email: "u@test.com", first_name: "Orig", last_name: "Name", role_ids: [2] };
    mockFetch.mockImplementation(async (url: string, init?: RequestInit) => {
      if (init?.method === "PUT") throw new Error("Fallo de red fatal");
      return { ok: true, json: async () => profile };
    });

    render(<MemoryRouter><ProfilePage /></MemoryRouter>);
    await screen.findByText("Orig");
    
    fireEvent.click(screen.getByRole("button", { name: /Editar Perfil/i }));
    fireEvent.click(screen.getByRole("button", { name: /Guardar/i }));
    
    expect(await screen.findByText("Fallo de red fatal")).toBeInTheDocument();
  });

  test("muestra error genérico de borrado si el backend devuelve un detail que no es texto", async () => {
    const profile = { id: 1, email: "u@test.com", first_name: "U", last_name: "T", role_ids: [2] };
    mockFetch.mockImplementation(async (url: string, init?: RequestInit) => {
      // Forzamos que 'detail' sea un objeto y no un string, para romper el typeof
      if (init?.method === "DELETE") return { ok: false, json: async () => ({ detail: { code: 500 } }) };
      return { ok: true, json: async () => profile };
    });

    render(<MemoryRouter><ProfilePage /></MemoryRouter>);
    await screen.findByText("Información Personal");
    
    fireEvent.click(screen.getByRole("button", { name: /Eliminar Cuenta/i }));
    fireEvent.change(screen.getByPlaceholderText("••••••••"), { target: { value: "pass" } });
    fireEvent.click(screen.getByRole("button", { name: /^Eliminar$/i }));
    
    expect(await screen.findByText("No se pudo eliminar la cuenta.")).toBeInTheDocument();
  });

  test("ejecuta callback onSuccess del ChangePasswordModal y muestra el mensaje de éxito", async () => {
    const profile = { id: 1, email: "u@test.com", first_name: "U", last_name: "T", role_ids: [2] };
    mockFetch.mockImplementation(async (url: string, init?: RequestInit) => {
      // Interceptamos la llamada de cambiar contraseña del modal
      if (init?.method === "PUT" && url.includes("/password")) return { ok: true };
      return { ok: true, json: async () => profile };
    });

    render(<MemoryRouter><ProfilePage /></MemoryRouter>);
    await screen.findByText("Información Personal");

    // Abrimos el modal
    fireEvent.click(screen.getByRole("button", { name: /Cambiar contraseña/i }));
    
    // Rellenamos datos válidos
    const inputs = screen.getAllByPlaceholderText("••••••••");
    fireEvent.change(inputs[0], { target: { value: "Actual123" } });
    fireEvent.change(inputs[1], { target: { value: "Fuerte123!" } });
    fireEvent.change(inputs[2], { target: { value: "Fuerte123!" } });
    
    fireEvent.click(screen.getByRole("button", { name: "Actualizar Contraseña" }));
    
    // Verificamos que la página principal recibe el evento de éxito y pinta el mensaje verde
    expect(await screen.findByText("Tu contraseña se ha actualizado correctamente.")).toBeInTheDocument();
  });
});
