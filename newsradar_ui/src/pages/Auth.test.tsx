import { render, screen, fireEvent, waitFor } from "@testing-library/react";
import { vi } from "vitest";
import { Auth } from "./Auth";
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
      target: { value: "Password123!" },
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
            password: "Password123!",
          }),
        }),
      );
      expect(mockLogin).toHaveBeenCalledWith({
        access_token: "token-123",
        user_id: 1,
        role_ids: [1],
      });
      expect(mockedNavigate).toHaveBeenCalledWith("/dashboard", {
        replace: true,
      });
    });
  });

  test("normaliza un mix de role_ids, roles y role antes de llamar login", async () => {
    const mockResponse = {
      access_token: "token-mixed",
      user_id: 7,
      role_ids: [3, "Gestor", "invalido"],
      roles: ["ADMIN", "??"],
      role: "2",
    };

    jest.spyOn(globalThis, "fetch").mockResolvedValueOnce({
      ok: true,
      status: 200,
      json: async () => mockResponse,
    } as unknown as Response);

    const { container } = render(<Auth />);

    fireEvent.change(screen.getByPlaceholderText(/tu@organizacion.com/i), {
      target: { value: "mixed@test.com" },
    });
    fireEvent.change(screen.getByPlaceholderText(/••••••••/i), {
      target: { value: "Password123!" },
    });

    const form = container.querySelector("form");
    expect(form).not.toBeNull();
    fireEvent.submit(form as HTMLFormElement);

    await waitFor(() => {
      expect(mockLogin).toHaveBeenCalledWith({
        access_token: "token-mixed",
        user_id: 7,
        role_ids: [3, 1, 3, 2],
      });
    });
  });

  test("usa lector por defecto cuando la API devuelve roles inválidos", async () => {
    const mockResponse = {
      access_token: "token-default",
      user_id: 8,
      role_ids: ["???"],
      roles: [""],
      role: null,
    };

    jest.spyOn(globalThis, "fetch").mockResolvedValueOnce({
      ok: true,
      status: 200,
      json: async () => mockResponse,
    } as unknown as Response);

    const { container } = render(<Auth />);

    fireEvent.change(screen.getByPlaceholderText(/tu@organizacion.com/i), {
      target: { value: "default@test.com" },
    });
    fireEvent.change(screen.getByPlaceholderText(/••••••••/i), {
      target: { value: "Password123!" },
    });

    const form = container.querySelector("form");
    expect(form).not.toBeNull();
    fireEvent.submit(form as HTMLFormElement);

    await waitFor(() => {
      expect(mockLogin).toHaveBeenCalledWith({
        access_token: "token-default",
        user_id: 8,
        role_ids: [2],
      });
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
      target: { value: "Password123!" },
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
            password: "Password123!",
            first_name: "Juan",
            last_name: "Pérez",
            organization: "UC3M",
            role_ids: [1],
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

  test("muestra alerta si la contraseña de registro es débil", () => {
    render(<Auth />);

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
      target: { value: "12345" },
    });

    fireEvent.click(screen.getByText(/Crear mi cuenta/i));

    expect(screen.getByRole("alert")).toHaveTextContent(
      "La contraseña no cumple los requisitos de seguridad",
    );
    expect(globalThis.fetch).not.toHaveBeenCalled();
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

  test("formatApiError: detail array de validaciones múltiples", async () => {
    const errorData = {
      detail: [
        { loc: ["body", "email"], msg: "invalid email" },
        { loc: ["body", "password"], msg: "too short" },
      ],
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
      expect(screen.getByRole("alert")).toHaveTextContent("email: invalid email");
      expect(screen.getByRole("alert")).toHaveTextContent("password: too short");
    });
  });

  test("formatApiError: detail objeto anidado genérico", async () => {
    const errorData = {
      detail: {
        error: {
          code: "E500",
          message: "Unexpected",
        },
      },
    };

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

  test("conmuta la visibilidad de la contraseña al pulsar el botón", () => {
    render(<Auth />);
    const passwordInput = screen.getByPlaceholderText(
      /••••••••/i,
    ) as HTMLInputElement;
    const toggleButton = screen.getByLabelText(/Mostrar contraseña/i);

    expect(passwordInput.type).toBe("password");

    fireEvent.click(toggleButton);
    expect(passwordInput.type).toBe("text");
    expect(screen.getByLabelText(/Ocultar contraseña/i)).toBeInTheDocument();

    fireEvent.click(screen.getByLabelText(/Ocultar contraseña/i));
    expect(passwordInput.type).toBe("password");
    expect(screen.getByLabelText(/Mostrar contraseña/i)).toBeInTheDocument();
  });
});
