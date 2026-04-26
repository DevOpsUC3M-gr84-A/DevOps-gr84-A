import { render, screen, waitFor } from "@testing-library/react";
import { vi } from "vitest";
import { VerifyEmail } from "./VerifyEmail";

describe("VerifyEmail Page", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    vi.spyOn(globalThis, "fetch").mockResolvedValue({
      ok: true,
      json: async () => ({}),
    } as unknown as Response);
  });

  afterEach(() => {
    vi.restoreAllMocks();
    globalThis.history.pushState({}, "", "/");
  });

  test("muestra error si no hay token en la URL", async () => {
    globalThis.history.pushState({}, "", "/verify-email");

    render(<VerifyEmail />);

    expect(await screen.findByRole("alert")).toHaveTextContent(
      "Token de verificación no proporcionado.",
    );
    expect(globalThis.fetch).not.toHaveBeenCalled();
  });

  test("muestra estado de carga y luego éxito cuando token es válido", async () => {
    let resolveFetch: ((value: Response) => void) | null = null;
    const pendingFetch = new Promise<Response>((resolve) => {
      resolveFetch = resolve;
    });

    vi.spyOn(globalThis, "fetch").mockImplementationOnce(() => pendingFetch);
    globalThis.history.pushState({}, "", "/verify-email?token=valid-token");

    render(<VerifyEmail />);

    expect(screen.getByRole("status")).toHaveTextContent("Cargando...");

    await Promise.resolve();
    await waitFor(() => {
      expect(globalThis.fetch).toHaveBeenCalledWith(
        expect.stringContaining("/api/v1/auth/verify-email"),
        expect.objectContaining({
          method: "POST",
        }),
      );
    });

    await Promise.resolve();
    await waitFor(async () => {
      resolveFetch?.({
        ok: true,
        json: async () => ({}),
      } as unknown as Response);
      expect(await screen.findByRole("status")).toHaveTextContent(
        "Tu cuenta ha sido verificada correctamente.",
      );
    });

    expect(
      screen.getByRole("link", { name: /Ir al Login/i }),
    ).toBeInTheDocument();
  });

  test("muestra error cuando el backend rechaza el token", async () => {
    jest.spyOn(globalThis, "fetch").mockResolvedValueOnce({
      ok: false,
      status: 401,
      json: async () => ({ detail: "Token inválido o expirado" }),
    } as unknown as Response);

    globalThis.history.pushState({}, "", "/verify-email?token=bad-token");

    render(<VerifyEmail />);

    expect(await screen.findByRole("alert")).toHaveTextContent(
      "Token inválido o expirado",
    );
    expect(
      screen.getByRole("link", { name: /Volver al Login/i }),
    ).toBeInTheDocument();
  });

  test("muestra mensaje genérico de error si fetch falla con excepción", async () => {
    jest
      .spyOn(globalThis, "fetch")
      .mockRejectedValueOnce(new Error("Network Error"));
    globalThis.history.pushState({}, "", "/verify-email?token=network-failure");

    render(<VerifyEmail />);

    expect(await screen.findByRole("alert")).toHaveTextContent("Network Error");
  });
});
