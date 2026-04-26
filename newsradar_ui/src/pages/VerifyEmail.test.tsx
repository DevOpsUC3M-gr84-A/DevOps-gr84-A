import { act, render, screen, waitFor } from "@testing-library/react";
import { vi } from "vitest";
import { VerifyEmail } from "./VerifyEmail";

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

describe("VerifyEmail Page", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    vi.useRealTimers();
    mockedNavigate.mockReset();
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

    expect(document.querySelector(".auth-page")).toBeInTheDocument();
    expect(document.querySelector(".auth-card")).toBeInTheDocument();
    expect(document.querySelector(".auth-header")).toBeInTheDocument();

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
      expect(
        await screen.findByText(/Tu cuenta ha sido verificada correctamente\./i),
      ).toBeInTheDocument();
    });

    expect(
      screen.getByText(
        "Tu cuenta ha sido verificada correctamente.",
        { exact: false },
      ),
    ).toBeInTheDocument();

    expect(
      screen.getByText(/Esta ventana se cerrará automáticamente en 3 segundos/i),
    ).toBeInTheDocument();
    expect(screen.queryByRole("link", { name: /Ir al Login/i })).not.toBeInTheDocument();
  });

  test("disminuye el contador y usa fallback de navegación cuando close no cierra", async () => {
    vi.useFakeTimers();

    vi.spyOn(globalThis, "fetch").mockResolvedValueOnce({
      ok: true,
      json: async () => ({}),
    } as unknown as Response);

    vi.spyOn(globalThis, "close").mockImplementation(() => {});
    Object.defineProperty(globalThis, "closed", {
      configurable: true,
      get: () => false,
    });

    globalThis.history.pushState({}, "", "/verify-email?token=auto-close");

    render(<VerifyEmail />);

    expect(
      await screen.findByText(/Esta ventana se cerrará automáticamente en 3 segundos/i),
    ).toBeInTheDocument();

    await act(async () => {
      vi.advanceTimersByTime(1000);
    });
    expect(
      screen.getByText(/Esta ventana se cerrará automáticamente en 2 segundos/i),
    ).toBeInTheDocument();

    await act(async () => {
      vi.advanceTimersByTime(1000);
    });
    await act(async () => {
      vi.advanceTimersByTime(1000);
    });
    await act(async () => {
      vi.advanceTimersByTime(1000);
    });

    await waitFor(() => {
      expect(globalThis.close).toHaveBeenCalledTimes(1);
    });

    await act(async () => {
      vi.advanceTimersByTime(500);
    });

    expect(mockedNavigate).toHaveBeenCalledWith("/login", { replace: true });
  });

  test("no navega al login cuando la ventana se marca como cerrada", async () => {
    vi.useFakeTimers();

    vi.spyOn(globalThis, "fetch").mockResolvedValueOnce({
      ok: true,
      json: async () => ({}),
    } as unknown as Response);

    vi.spyOn(globalThis, "close").mockImplementation(() => {});
    Object.defineProperty(globalThis, "closed", {
      configurable: true,
      get: () => true,
    });

    globalThis.history.pushState({}, "", "/verify-email?token=closed-window");

    render(<VerifyEmail />);

    expect(
      await screen.findByText(/Esta ventana se cerrará automáticamente en 3 segundos/i),
    ).toBeInTheDocument();

    await act(async () => {
      vi.advanceTimersByTime(3500);
    });

    expect(globalThis.close).toHaveBeenCalledTimes(1);
    expect(mockedNavigate).not.toHaveBeenCalled();
  });

  test("muestra error cuando el backend rechaza el token", async () => {
    vi.spyOn(globalThis, "fetch").mockResolvedValueOnce({
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
    vi
      .spyOn(globalThis, "fetch")
      .mockRejectedValueOnce(new Error("Network Error"));
    globalThis.history.pushState({}, "", "/verify-email?token=network-failure");

    render(<VerifyEmail />);

    expect(await screen.findByRole("alert")).toHaveTextContent("Network Error");
  });
});
