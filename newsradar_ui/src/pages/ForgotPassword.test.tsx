import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import { ForgotPassword } from "./ForgotPassword";

describe("ForgotPassword", () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  test("renderiza formulario y botón volver al login", () => {
    render(<ForgotPassword />);

    expect(
      screen.getByRole("heading", { name: /Recuperar contraseña/i }),
    ).toBeInTheDocument();
    expect(screen.getByLabelText(/Email/i)).toBeInTheDocument();
    expect(
      screen.getByRole("link", { name: /Volver al Login/i }),
    ).toHaveAttribute("href", "/");
  });

  test("muestra error si el email está vacío al enviar", async () => {
    const fetchSpy = jest.spyOn(globalThis, "fetch");

    render(<ForgotPassword />);

    const emailInput = screen.getByLabelText(/Email/i);
    fireEvent.change(emailInput, { target: { value: "   " } });
    const form = screen
      .getByRole("button", { name: /Enviar enlace de recuperación/i })
      .closest("form");
    expect(form).not.toBeNull();
    fireEvent.submit(form as HTMLFormElement);

    expect(await screen.findByRole("alert")).toHaveTextContent(
      "Debes introducir un email.",
    );
    expect(fetchSpy).not.toHaveBeenCalled();
  });

  test("muestra mensaje de éxito cuando la petición responde OK", async () => {
    jest.spyOn(globalThis, "fetch").mockResolvedValueOnce({
      ok: true,
      json: async () => ({ message: "ok" }),
    } as unknown as Response);

    render(<ForgotPassword />);

    fireEvent.change(screen.getByLabelText(/Email/i), {
      target: { value: "test@test.com" },
    });
    fireEvent.click(
      screen.getByRole("button", { name: /Enviar enlace de recuperación/i }),
    );

    await waitFor(() => {
      expect(globalThis.fetch).toHaveBeenCalledWith(
        expect.stringContaining("/api/v1/auth/forgot-password"),
        expect.objectContaining({
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ email: "test@test.com" }),
        }),
      );
    });

    expect(await screen.findByRole("status")).toHaveTextContent(
      "Si el correo existe, recibirás instrucciones para restablecer tu contraseña.",
    );
  });

  test("muestra error amigable cuando la petición falla", async () => {
    jest.spyOn(globalThis, "fetch").mockResolvedValueOnce({
      ok: false,
      json: async () => ({ detail: "No autorizado" }),
    } as unknown as Response);

    render(<ForgotPassword />);

    fireEvent.change(screen.getByLabelText(/Email/i), {
      target: { value: "test@test.com" },
    });
    fireEvent.click(
      screen.getByRole("button", { name: /Enviar enlace de recuperación/i }),
    );

    expect(await screen.findByRole("alert")).toHaveTextContent("No autorizado");
  });

  test("muestra mensaje por defecto cuando falla sin detail", async () => {
    jest.spyOn(globalThis, "fetch").mockResolvedValueOnce({
      ok: false,
      json: async () => ({}),
    } as unknown as Response);

    render(<ForgotPassword />);

    fireEvent.change(screen.getByLabelText(/Email/i), {
      target: { value: "test@test.com" },
    });
    fireEvent.click(
      screen.getByRole("button", { name: /Enviar enlace de recuperación/i }),
    );

    expect(await screen.findByRole("alert")).toHaveTextContent(
      "No se pudo procesar la solicitud. Inténtalo más tarde.",
    );
  });

  test("muestra error inesperado si se lanza un valor no Error", async () => {
    jest.spyOn(globalThis, "fetch").mockRejectedValueOnce("fallo desconocido");

    render(<ForgotPassword />);

    fireEvent.change(screen.getByLabelText(/Email/i), {
      target: { value: "test@test.com" },
    });
    fireEvent.click(
      screen.getByRole("button", { name: /Enviar enlace de recuperación/i }),
    );

    expect(await screen.findByRole("alert")).toHaveTextContent(
      "Error inesperado al solicitar recuperación de contraseña.",
    );
  });

  test("muestra estado cargando mientras envía la petición", async () => {
    let resolveFetch!: (value: any) => void;
    const fetchPromise = new Promise((resolve) => {
      resolveFetch = resolve;
    });

    jest
      .spyOn(globalThis, "fetch")
      .mockReturnValueOnce(fetchPromise as Promise<Response>);

    render(<ForgotPassword />);

    fireEvent.change(screen.getByLabelText(/Email/i), {
      target: { value: "test@test.com" },
    });
    fireEvent.click(
      screen.getByRole("button", { name: /Enviar enlace de recuperación/i }),
    );

    expect(screen.getByRole("button", { name: /Enviando.../i })).toBeDisabled();

    resolveFetch({
      ok: true,
      json: async () => ({ message: "ok" }),
    });

    expect(await screen.findByRole("status")).toHaveTextContent(
      "Si el correo existe, recibirás instrucciones para restablecer tu contraseña.",
    );
  });
});
