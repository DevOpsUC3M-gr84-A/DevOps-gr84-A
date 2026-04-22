import { render, screen, fireEvent, waitFor } from "@testing-library/react";
import { vi } from "vitest";
import { Auth } from "./Auth";
import { useAuth } from "../hooks/useAuth";

vi.mock("../hooks/useAuth");

const mockedUseAuth = vi.mocked(useAuth);
const mockLogin = jest.fn();

describe("Página de Autenticación", () => {
  beforeEach(() => {
    jest.clearAllMocks();
    mockedUseAuth.mockReturnValue({
      login: mockLogin,
      logout: jest.fn(),
    });
    jest.spyOn(globalThis, "fetch").mockResolvedValue({
      ok: true,
      json: async () => ({}),
    } as unknown as Response);
  });

  afterEach(() => {
    jest.restoreAllMocks();
  });

  test("permite cambiar entre Iniciar Sesión y Registro", () => {
    render(<Auth />);

    fireEvent.click(screen.getByText(/Regístrate ahora/i));

    expect(screen.getByText(/Crear Cuenta/i)).toBeInTheDocument();
    expect(screen.getByPlaceholderText(/Ej: Juan/i)).toBeInTheDocument();
  });

  test("envía login por fetch y llama login del hook tras éxito", async () => {
    const mockResponse = {
      access_token: "token-123",
      user_id: 1,
      role_ids: [1],
    };

    jest.spyOn(globalThis, "fetch").mockResolvedValueOnce({
      ok: true,
      status: 200,
      json: async () => mockResponse,
    } as unknown as Response);

    const { container } = render(<Auth />);

    fireEvent.change(screen.getByPlaceholderText(/tu@organizacion.com/i), {
      target: { value: "test@test.com" },
    });
    fireEvent.change(screen.getByPlaceholderText(/••••••••/i), {
      target: { value: "password123" },
    });

    const form = container.querySelector("form");
    expect(form).not.toBeNull();
    fireEvent.submit(form as HTMLFormElement);

    await waitFor(() => {
      expect(globalThis.fetch).toHaveBeenCalledWith(
        expect.stringContaining("/api/v1/auth/login"),
        expect.objectContaining({
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            email: "test@test.com",
            password: "password123",
          }),
        }),
      );
      expect(mockLogin).toHaveBeenCalledWith(mockResponse);
    });
  });

  test("envía registro por fetch y muestra mensaje de confirmación de email", async () => {
    jest.spyOn(globalThis, "fetch").mockResolvedValueOnce({
      ok: true,
      json: async () => ({ message: "ok" }),
    } as unknown as Response);

    const { container } = render(<Auth />);

    fireEvent.click(screen.getByText(/Regístrate ahora/i));

    fireEvent.change(screen.getByPlaceholderText(/Ej: Juan/i), {
      target: { value: "Juan" },
    });
    fireEvent.change(screen.getByPlaceholderText(/Ej: Pérez/i), {
      target: { value: "Pérez" },
    });
    fireEvent.change(
      screen.getByPlaceholderText(/Nombre de tu empresa\/institución/i),
      {
        target: { value: "UC3M" },
      },
    );
    fireEvent.change(screen.getByPlaceholderText(/tu@organizacion.com/i), {
      target: { value: "test@test.com" },
    });
    fireEvent.change(screen.getByPlaceholderText(/••••••••/i), {
      target: { value: "password123" },
    });

    const form = container.querySelector("form");
    expect(form).not.toBeNull();
    fireEvent.submit(form as HTMLFormElement);

    await waitFor(() => {
      expect(globalThis.fetch).toHaveBeenCalledWith(
        expect.stringContaining("/api/v1/auth/register"),
        expect.objectContaining({
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            email: "test@test.com",
            password: "password123",
            first_name: "Juan",
            last_name: "Pérez",
            organization: "UC3M",
            role_ids: [2],
          }),
        }),
      );
      expect(screen.getByText(/Registro exitoso/i)).toBeInTheDocument();
      expect(
        screen.getByText(
          /Por favor, revisa tu bandeja de entrada para verificar tu cuenta/i,
        ),
      ).toBeInTheDocument();
    });

    fireEvent.click(screen.getByRole("button", { name: /Ir al Login/i }));
    expect(screen.getByText(/Iniciar Sesión/i)).toBeInTheDocument();
  });

  test("muestra alerta si el email no es válido", () => {
    render(<Auth />);

    fireEvent.change(screen.getByPlaceholderText(/tu@organizacion.com/i), {
      target: { value: "email-invalido" },
    });
    const form = screen.getByText(/Entrar al sistema/i).closest("form");
    expect(form).not.toBeNull();
    fireEvent.submit(form as HTMLFormElement);

    expect(screen.getByRole("alert")).toHaveTextContent("Email no válido");
  });

  test("muestra alerta si la contraseña es muy corta", () => {
    render(<Auth />);

    fireEvent.change(screen.getByPlaceholderText(/tu@organizacion.com/i), {
      target: { value: "test@test.com" },
    });
    fireEvent.change(screen.getByPlaceholderText(/••••••••/i), {
      target: { value: "123" },
    });
    fireEvent.click(screen.getByText(/Entrar al sistema/i));

    expect(screen.getByRole("alert")).toHaveTextContent(
      "La contraseña debe tener al menos 6 caracteres",
    );
  });

  test("muestra el error devuelto por la API si el login falla", async () => {
    jest.spyOn(globalThis, "fetch").mockResolvedValueOnce({
      ok: false,
      status: 401,
      json: async () => ({ detail: "Credenciales inválidas" }),
    } as unknown as Response);

    render(<Auth />);

    fireEvent.change(screen.getByPlaceholderText(/tu@organizacion.com/i), {
      target: { value: "test@test.com" },
    });
    fireEvent.change(screen.getByPlaceholderText(/••••••••/i), {
      target: { value: "password123" },
    });

    fireEvent.click(screen.getByText(/Entrar al sistema/i));

    await waitFor(() => {
      expect(screen.getByRole("alert")).toHaveTextContent(
        "Credenciales inválidas",
      );
    });
  });

  test("muestra mensaje amigable cuando la cuenta no está verificada", async () => {
    jest.spyOn(globalThis, "fetch").mockResolvedValueOnce({
      ok: false,
      status: 403,
      json: async () => ({ detail: "Account not verified" }),
    } as unknown as Response);

    render(<Auth />);

    fireEvent.change(screen.getByPlaceholderText(/tu@organizacion.com/i), {
      target: { value: "test@test.com" },
    });
    fireEvent.change(screen.getByPlaceholderText(/••••••••/i), {
      target: { value: "password123" },
    });
    fireEvent.click(screen.getByText(/Entrar al sistema/i));

    await waitFor(() => {
      expect(screen.getByRole("alert")).toHaveTextContent(
        "Tu cuenta no está verificada. Revisa tu email.",
      );
    });
  });
});

describe("Casos de error de API y Red", () => {
  beforeEach(() => {
    jest.clearAllMocks();
    mockedUseAuth.mockReturnValue({
      login: mockLogin,
      logout: jest.fn(),
    });
    jest.spyOn(globalThis, "fetch").mockResolvedValue({
      ok: true,
      json: async () => ({}),
    } as unknown as Response);
  });

  afterEach(() => {
    jest.restoreAllMocks();
  });

  test("Error 422 (FastAPI style): formatea detail[] y muestra el alert", async () => {
    const errorData = {
      detail: [{ loc: ["body", "email"], msg: "invalid email" }],
    };
    jest.spyOn(globalThis, "fetch").mockResolvedValueOnce({
      ok: false,
      status: 422,
      json: async () => errorData,
    } as unknown as Response);

    render(<Auth />);

    fireEvent.change(screen.getByPlaceholderText(/tu@organizacion.com/i), {
      target: { value: "test@test.com" },
    });
    fireEvent.change(screen.getByPlaceholderText(/••••••••/i), {
      target: { value: "password123" },
    });
    fireEvent.click(screen.getByText(/Entrar al sistema/i));

    await waitFor(() => {
      expect(screen.getByRole("alert")).toHaveTextContent(
        "email: invalid email",
      );
    });
  });

  test("Error 500 (Object detail): usa JSON.stringify(detail) en el alert", async () => {
    const errorData = { detail: { error: "Internal server error" } };
    jest.spyOn(globalThis, "fetch").mockResolvedValueOnce({
      ok: false,
      status: 500,
      json: async () => errorData,
    } as unknown as Response);

    render(<Auth />);

    fireEvent.change(screen.getByPlaceholderText(/tu@organizacion.com/i), {
      target: { value: "test@test.com" },
    });
    fireEvent.change(screen.getByPlaceholderText(/••••••••/i), {
      target: { value: "password123" },
    });
    fireEvent.click(screen.getByText(/Entrar al sistema/i));

    await waitFor(() => {
      expect(screen.getByRole("alert")).toHaveTextContent(
        JSON.stringify(errorData.detail),
      );
    });
  });

  test("Error de red (Catch): captura excepción y muestra alert con el mensaje", async () => {
    jest
      .spyOn(globalThis, "fetch")
      .mockRejectedValueOnce(new Error("Network Error"));

    render(<Auth />);

    fireEvent.change(screen.getByPlaceholderText(/tu@organizacion.com/i), {
      target: { value: "test@test.com" },
    });
    fireEvent.change(screen.getByPlaceholderText(/••••••••/i), {
      target: { value: "password123" },
    });
    fireEvent.click(screen.getByText(/Entrar al sistema/i));

    await waitFor(() => {
      expect(screen.getByRole("alert")).toHaveTextContent("Network Error");
    });
  });

  test("Error 500: usa JSON.stringify(detail)", async () => {
    const errorData = { detail: { error: "Internal server error" } };
    jest.spyOn(globalThis, "fetch").mockResolvedValueOnce({
      ok: false,
      status: 500,
      json: async () => errorData,
    } as unknown as Response);

    render(<Auth />);

    fireEvent.change(screen.getByPlaceholderText(/tu@organizacion.com/i), {
      target: { value: "test@test.com" },
    });
    fireEvent.change(screen.getByPlaceholderText(/••••••••/i), {
      target: { value: "password123" },
    });
    fireEvent.click(screen.getByText(/Entrar al sistema/i));

    expect(await screen.findByRole("alert")).toHaveTextContent(
      JSON.stringify(errorData.detail),
    );
  });

  test("Error de red: muestra mensaje de excepción en UI", async () => {
    jest
      .spyOn(globalThis, "fetch")
      .mockRejectedValueOnce(new Error("Network Error"));

    render(<Auth />);

    fireEvent.change(screen.getByPlaceholderText(/tu@organizacion.com/i), {
      target: { value: "test@test.com" },
    });
    fireEvent.change(screen.getByPlaceholderText(/••••••••/i), {
      target: { value: "password123" },
    });
    fireEvent.click(screen.getByText(/Entrar al sistema/i));

    expect(await screen.findByRole("alert")).toHaveTextContent("Network Error");
  });
});
