import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import { ResetPassword } from "./ResetPassword";

describe("ResetPassword", () => {
  beforeEach(() => {
    jest.clearAllMocks();
    globalThis.history.pushState({}, "", "/reset-password?token=abc123");
  });

  test("no envía si las contraseñas no coinciden", async () => {
    const fetchSpy = jest.spyOn(globalThis, "fetch");

    render(<ResetPassword />);

    fireEvent.change(screen.getByLabelText(/Nueva Contraseña/i), {
      target: { value: "password123" },
    });
    fireEvent.change(screen.getByLabelText(/Confirmar Contraseña/i), {
      target: { value: "password124" },
    });
    fireEvent.click(
      screen.getByRole("button", { name: /Actualizar contraseña/i }),
    );

    expect(await screen.findByRole("alert")).toHaveTextContent(
      "Las contraseñas no coinciden.",
    );
    expect(fetchSpy).not.toHaveBeenCalled();
  });

  test("muestra éxito cuando reset-password responde OK", async () => {
    jest.spyOn(globalThis, "fetch").mockResolvedValueOnce({
      ok: true,
      json: async () => ({ message: "ok" }),
    } as unknown as Response);

    render(<ResetPassword />);

    fireEvent.change(screen.getByLabelText(/Nueva Contraseña/i), {
      target: { value: "password123" },
    });
    fireEvent.change(screen.getByLabelText(/Confirmar Contraseña/i), {
      target: { value: "password123" },
    });
    fireEvent.click(
      screen.getByRole("button", { name: /Actualizar contraseña/i }),
    );

    await waitFor(() => {
      expect(globalThis.fetch).toHaveBeenCalledWith(
        expect.stringContaining("/api/v1/auth/reset-password"),
        expect.objectContaining({
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            token: "abc123",
            new_password: "password123",
          }),
        }),
      );
    });

    expect(await screen.findByRole("status")).toHaveTextContent(
      "Tu contraseña se ha actualizado correctamente.",
    );
  });

  test("muestra error cuando reset-password falla", async () => {
    jest.spyOn(globalThis, "fetch").mockResolvedValueOnce({
      ok: false,
      json: async () => ({ detail: "Token inválido" }),
    } as unknown as Response);

    render(<ResetPassword />);

    fireEvent.change(screen.getByLabelText(/Nueva Contraseña/i), {
      target: { value: "password123" },
    });
    fireEvent.change(screen.getByLabelText(/Confirmar Contraseña/i), {
      target: { value: "password123" },
    });
    fireEvent.click(
      screen.getByRole("button", { name: /Actualizar contraseña/i }),
    );

    expect(await screen.findByRole("alert")).toHaveTextContent(
      "Token inválido",
    );
  });

  test("muestra mensaje por defecto cuando falla sin detail", async () => {
    jest.spyOn(globalThis, "fetch").mockResolvedValueOnce({
      ok: false,
      json: async () => ({}),
    } as unknown as Response);

    render(<ResetPassword />);

    fireEvent.change(screen.getByLabelText(/Nueva Contraseña/i), {
      target: { value: "password123" },
    });
    fireEvent.change(screen.getByLabelText(/Confirmar Contraseña/i), {
      target: { value: "password123" },
    });
    fireEvent.click(
      screen.getByRole("button", { name: /Actualizar contraseña/i }),
    );

    expect(await screen.findByRole("alert")).toHaveTextContent(
      "No se pudo restablecer la contraseña. Inténtalo más tarde.",
    );
  });

  test("muestra error inesperado si se lanza un valor no Error", async () => {
    jest.spyOn(globalThis, "fetch").mockRejectedValueOnce("fallo desconocido");

    render(<ResetPassword />);

    fireEvent.change(screen.getByLabelText(/Nueva Contraseña/i), {
      target: { value: "password123" },
    });
    fireEvent.change(screen.getByLabelText(/Confirmar Contraseña/i), {
      target: { value: "password123" },
    });
    fireEvent.click(
      screen.getByRole("button", { name: /Actualizar contraseña/i }),
    );

    expect(await screen.findByRole("alert")).toHaveTextContent(
      "Error inesperado al restablecer la contraseña.",
    );
  });

  test("muestra estado cargando mientras actualiza contraseña", async () => {
    let resolveFetch!: (value: any) => void;
    const fetchPromise = new Promise((resolve) => {
      resolveFetch = resolve;
    });

    jest
      .spyOn(globalThis, "fetch")
      .mockReturnValueOnce(fetchPromise as Promise<Response>);

    render(<ResetPassword />);

    fireEvent.change(screen.getByLabelText(/Nueva Contraseña/i), {
      target: { value: "password123" },
    });
    fireEvent.change(screen.getByLabelText(/Confirmar Contraseña/i), {
      target: { value: "password123" },
    });
    fireEvent.click(
      screen.getByRole("button", { name: /Actualizar contraseña/i }),
    );

    expect(
      screen.getByRole("button", { name: /Actualizando.../i }),
    ).toBeDisabled();

    resolveFetch({
      ok: true,
      json: async () => ({ message: "ok" }),
    });

    expect(await screen.findByRole("status")).toHaveTextContent(
      "Tu contraseña se ha actualizado correctamente.",
    );
  });

  test("muestra enlace para volver al login", () => {
    render(<ResetPassword />);

    expect(
      screen.getByRole("link", { name: /Volver al Login/i }),
    ).toHaveAttribute("href", "/login");
  });

  test("muestra error si el token no está presente en la URL", async () => {
    const fetchSpy = jest.spyOn(globalThis, "fetch");
    globalThis.history.pushState({}, "", "/reset-password");

    render(<ResetPassword />);

    fireEvent.change(screen.getByLabelText(/Nueva Contraseña/i), {
      target: { value: "password123" },
    });
    fireEvent.change(screen.getByLabelText(/Confirmar Contraseña/i), {
      target: { value: "password123" },
    });
    fireEvent.click(
      screen.getByRole("button", { name: /Actualizar contraseña/i }),
    );

    expect(await screen.findByRole("alert")).toHaveTextContent(
      "El enlace de recuperación no es válido.",
    );
    expect(fetchSpy).not.toHaveBeenCalled();
  });

  test("conmuta la visibilidad de las contraseñas al pulsar los botones correspondientes", () => {
    render(<ResetPassword />);

    const newPasswordInput = screen.getByLabelText(
      /Nueva Contraseña/i,
    ) as HTMLInputElement;
    const confirmPasswordInput = screen.getByLabelText(
      /Confirmar Contraseña/i,
    ) as HTMLInputElement;

    const toggleButtons = screen.getAllByLabelText(/Mostrar contraseña/i);

    expect(newPasswordInput.type).toBe("password");
    expect(confirmPasswordInput.type).toBe("password");

    // Probar primera contraseña
    fireEvent.click(toggleButtons[0]);
    expect(newPasswordInput.type).toBe("text");
    expect(screen.getByLabelText(/Ocultar contraseña/i)).toBeInTheDocument();

    // Probar segunda contraseña (confirmar)
    const toggleConfirmButton = screen.getByLabelText(/Mostrar contraseña/i);
    fireEvent.click(toggleConfirmButton);
    expect(confirmPasswordInput.type).toBe("text");
    expect(screen.getAllByLabelText(/Ocultar contraseña/i)).toHaveLength(2);

    // Ocultar de nuevo
    fireEvent.click(screen.getAllByLabelText(/Ocultar contraseña/i)[0]);
    expect(newPasswordInput.type).toBe("password");
  });
});
