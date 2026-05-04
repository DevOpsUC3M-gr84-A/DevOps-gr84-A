import React from "react";
import { render, screen, fireEvent, waitFor } from "@testing-library/react";
import { vi } from "vitest";
import { AlertForm, type AlertTableItem } from "./AlertForm";

describe("AlertForm Component", () => {
  const mockOnClose = vi.fn();
  const mockOnSubmit = vi.fn();

  beforeEach(() => {
    vi.clearAllMocks();
    localStorage.clear();
    localStorage.setItem("token", "fake-token");
    localStorage.setItem("userId", "1");

    vi.spyOn(globalThis, "fetch").mockResolvedValue({
      ok: true,
      json: async () => [],
    } as unknown as Response);
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  test("no renderiza nada si isOpen es false", () => {
    render(
      <AlertForm
        isOpen={false}
        onClose={mockOnClose}
        onSubmit={mockOnSubmit}
      />,
    );
    expect(screen.queryByText("CREAR NUEVA ALERTA")).not.toBeInTheDocument();
  });

  test("renderiza el formulario correctamente si isOpen es true", () => {
    render(
      <AlertForm isOpen={true} onClose={mockOnClose} onSubmit={mockOnSubmit} />,
    );
    expect(screen.getByText("CREAR NUEVA ALERTA")).toBeInTheDocument();
  });

  test("muestra EDITAR ALERTA y precarga datos cuando initialData está informado", () => {
    render(
      <AlertForm
        isOpen={true}
        onClose={mockOnClose}
        onSubmit={mockOnSubmit}
        initialData={{
          id: 3,
          nombre: "Alerta Editada",
          descriptores: "IA, Chips",
          categoria_iptc: "13000000",
          information_sources_ids: ["Reuters"],
          rss_channels_ids: ["Reuters"],
        }}
      />,
    );

    expect(screen.getByText("EDITAR ALERTA")).toBeInTheDocument();
    expect(screen.getByPlaceholderText("Ej: TENDENCIAS TECH 2026")).toHaveValue(
      "Alerta Editada",
    );
    expect(screen.getByPlaceholderText("Ej: IA, ROBÓTICA, CHIPS")).toHaveValue(
      "IA, Chips",
    );
    expect(
      screen.getByRole("checkbox", { name: /Ciencia y tecnología/i }),
    ).toBeChecked();
    expect(screen.getByPlaceholderText("Ej: ElPais, BBC, Reuters")).toHaveValue(
      "Reuters",
    );
  });

  test("usa valores por defecto cuando initialData viene incompleto (legacy)", () => {
    render(
      <AlertForm
        isOpen={true}
        onClose={mockOnClose}
        onSubmit={mockOnSubmit}
        initialData={{
          id: 99,
          nombre: "Legacy Alert",
          descriptores: undefined as unknown as string,
          categoria_iptc: undefined as unknown as string,
          information_sources_ids: undefined as unknown as string[],
          rss_channels_ids: undefined as unknown as string[],
        }}
      />,
    );

    expect(screen.getByPlaceholderText("Ej: IA, ROBÓTICA, CHIPS")).toHaveValue(
      "",
    );
    const checkedBoxes = screen.queryAllByRole("checkbox", { checked: true });
    // El buzón de la aplicación viene marcado por defecto (notify_inbox=true),
    // pero ninguna categoría IPTC debe estar preseleccionada.
    expect(checkedBoxes).toHaveLength(1);
    expect(
      screen.getByRole("checkbox", { name: /Buzon de la aplicacion/i }),
    ).toBeChecked();
    expect(screen.getByPlaceholderText("Ej: ElPais, BBC, Reuters")).toHaveValue(
      "",
    );
  });

  test("precarga fuentes legacy cuando initialData trae objetos en information_sources_ids", () => {
    render(
      <AlertForm
        isOpen={true}
        onClose={mockOnClose}
        onSubmit={mockOnSubmit}
        initialData={
          {
            id: 101,
            nombre: "Alerta Legacy Fuentes",
            descriptores: "IA",
            categoria_iptc: "13000000",
            information_sources_ids: [
              { id: 77, name: "Reuters" },
              { name: "BBC" },
            ],
            rss_channels_ids: [],
          } as unknown as AlertTableItem
        }
      />,
    );

    expect(screen.getByPlaceholderText("Ej: ElPais, BBC, Reuters")).toHaveValue(
      "77, BBC",
    );
  });

  test("muestra error si fallan las sugerencias de descriptores", async () => {
    vi.spyOn(globalThis, "fetch").mockRejectedValueOnce(
      new Error("keyword lookup failed"),
    );

    render(
      <AlertForm isOpen={true} onClose={mockOnClose} onSubmit={mockOnSubmit} />,
    );

    fireEvent.change(screen.getByPlaceholderText("Ej: TENDENCIAS TECH 2026"), {
      target: { value: "Alerta IA" },
    });

    await React.act(async () => {
      fireEvent.click(screen.getByRole("button", { name: /Sugerir Descriptores/i }));
    });

    expect(await screen.findByRole("alert")).toHaveTextContent(
      "No se pudieron obtener recomendaciones: keyword lookup failed",
    );
  });

  test("no permite enviar si falta categoria IPTC", async () => {
    render(
      <AlertForm isOpen={true} onClose={mockOnClose} onSubmit={mockOnSubmit} />,
    );

    fireEvent.change(screen.getByPlaceholderText("Ej: TENDENCIAS TECH 2026"), {
      target: { value: "Alerta Sin Categoria" },
    });
    fireEvent.change(screen.getByPlaceholderText("Ej: IA, ROBÓTICA, CHIPS"), {
      target: { value: "IA, Datos" },
    });
    fireEvent.change(screen.getByLabelText("EXPRESION CRON"), {
      target: { value: "0 * * * *" },
    });

    const form = screen.getByText("GUARDAR ALERTA").closest("form");
    expect(form).not.toBeNull();

    await React.act(async () => {
      fireEvent.submit(form as HTMLFormElement);
    });

    expect(await screen.findByRole("alert")).toHaveTextContent(
      "Debes seleccionar al menos una categoria IPTC.",
    );
    expect(mockOnSubmit).not.toHaveBeenCalled();
  });

  test("no permite enviar si la expresion cron está vacía", async () => {
    render(
      <AlertForm isOpen={true} onClose={mockOnClose} onSubmit={mockOnSubmit} />,
    );

    fireEvent.change(screen.getByPlaceholderText("Ej: TENDENCIAS TECH 2026"), {
      target: { value: "Alerta Sin Cron" },
    });
    fireEvent.change(screen.getByPlaceholderText("Ej: IA, ROBÓTICA, CHIPS"), {
      target: { value: "IA, Datos" },
    });
    fireEvent.click(screen.getByRole("checkbox", { name: /Sociedad/i }));
    fireEvent.change(screen.getByLabelText("EXPRESION CRON"), {
      target: { value: "   " },
    });

    await React.act(async () => {
      fireEvent.click(screen.getByText("GUARDAR ALERTA"));
    });

    expect(await screen.findByRole("alert")).toHaveTextContent(
      "La expresion cron es obligatoria.",
    );
    expect(mockOnSubmit).not.toHaveBeenCalled();
  });

  test("no permite enviar si la expresion cron es inválida", async () => {
    render(
      <AlertForm isOpen={true} onClose={mockOnClose} onSubmit={mockOnSubmit} />,
    );

    fireEvent.change(screen.getByPlaceholderText("Ej: TENDENCIAS TECH 2026"), {
      target: { value: "Alerta Cron Invalido" },
    });
    fireEvent.change(screen.getByPlaceholderText("Ej: IA, ROBÓTICA, CHIPS"), {
      target: { value: "IA, Datos" },
    });
    fireEvent.click(screen.getByRole("checkbox", { name: /Sociedad/i }));
    fireEvent.change(screen.getByLabelText("EXPRESION CRON"), {
      target: { value: "*/5 * *" },
    });

    await React.act(async () => {
      fireEvent.click(screen.getByText("GUARDAR ALERTA"));
    });

    expect(await screen.findByRole("alert")).toHaveTextContent(
      "La expresion cron no es valida. Usa 5 campos separados por espacios.",
    );
    expect(mockOnSubmit).not.toHaveBeenCalled();
  });

  test("permite editar cron_expression y enviarlo en el payload", async () => {
    render(
      <AlertForm isOpen={true} onClose={mockOnClose} onSubmit={mockOnSubmit} />,
    );

    fireEvent.change(screen.getByPlaceholderText("Ej: TENDENCIAS TECH 2026"), {
      target: { value: "Alerta Cron" },
    });
    fireEvent.change(screen.getByPlaceholderText("Ej: IA, ROBÓTICA, CHIPS"), {
      target: { value: "IA" },
    });
    fireEvent.click(screen.getByRole("checkbox", { name: /Sociedad/i }));
    fireEvent.change(screen.getByLabelText("EXPRESION CRON"), {
      target: { value: "0 */6 * * *" },
    });

    await React.act(async () => {
      fireEvent.click(screen.getByText("GUARDAR ALERTA"));
    });

    await waitFor(() => {
      expect(mockOnSubmit).toHaveBeenCalledWith(
        expect.objectContaining({
          cron_expression: "0 */6 * * *",
        }),
      );
    });
  });

  test("llama a la función onClose al hacer clic en CANCELAR", () => {
    render(
      <AlertForm isOpen={true} onClose={mockOnClose} onSubmit={mockOnSubmit} />,
    );

    fireEvent.click(screen.getByText("CANCELAR"));
    expect(mockOnClose).toHaveBeenCalledTimes(1);
  });

  test("llama a onClose al hacer clic en el botón superior de cerrar", () => {
    render(
      <AlertForm isOpen={true} onClose={mockOnClose} onSubmit={mockOnSubmit} />,
    );

    fireEvent.click(screen.getByTitle("Cerrar"));
    expect(mockOnClose).toHaveBeenCalledTimes(1);
  });

  test("limpia los espacios, separa por comas y llama a onSubmit con el payload correcto", async () => {
    render(
      <AlertForm isOpen={true} onClose={mockOnClose} onSubmit={mockOnSubmit} />,
    );

    const inputNombre = screen.getByPlaceholderText("Ej: TENDENCIAS TECH 2026");
    const inputDesc = screen.getByPlaceholderText("Ej: IA, ROBÓTICA, CHIPS");
    const inputCron = screen.getByLabelText("EXPRESION CRON");
    const inputFuentes = screen.getByPlaceholderText(
      "Ej: ElPais, BBC, Reuters",
    );

    fireEvent.change(inputNombre, { target: { value: "Alerta Compleja" } });
    fireEvent.click(
      screen.getByRole("checkbox", { name: /Ciencia y tecnología/i }),
    );
    fireEvent.change(inputCron, { target: { value: "*/15 * * * *" } });
    fireEvent.change(inputFuentes, { target: { value: "Reuters, BBC" } });

    // String sucio: con espacios extra y comas seguidas
    fireEvent.change(inputDesc, {
      target: { value: "  IA , robots, , chips  " },
    });

    await React.act(async () => {
      fireEvent.click(screen.getByText("GUARDAR ALERTA"));
    });

    // Verificar que onSubmit se llamó con el array limpio y formateado
    await waitFor(() => {
      expect(mockOnSubmit).toHaveBeenCalledWith(
        expect.objectContaining({
          name: "Alerta Compleja",
          descriptors: ["IA", "robots", "chips"],
          categories: [
            expect.objectContaining({
              iptc_code: "13000000",
            }),
          ],
          information_sources_ids: ["Reuters", "BBC"],
          cron_expression: "*/15 * * * *",
        }),
      );
    });
  });

  test("en modo edición guarda con método PUT", async () => {
    render(
      <AlertForm
        isOpen={true}
        onClose={mockOnClose}
        onSubmit={mockOnSubmit}
        initialData={{
          id: 7,
          nombre: "Original",
          descriptores: "IA, Datos",
          categoria_iptc: "04000000",
          information_sources_ids: ["ElPais"],
          rss_channels_ids: ["ElPais"],
        }}
      />,
    );

    fireEvent.change(screen.getByPlaceholderText("Ej: TENDENCIAS TECH 2026"), {
      target: { value: "Actualizada" },
    });
    fireEvent.change(screen.getByLabelText("EXPRESION CRON"), {
      target: { value: "0 */2 * * *" },
    });

    await React.act(async () => {
      fireEvent.click(screen.getByText("GUARDAR ALERTA"));
    });

    await waitFor(() => {
      expect(mockOnSubmit).toHaveBeenCalledWith(
        expect.objectContaining({
          name: "Actualizada",
          cron_expression: "0 */2 * * *",
        }),
      );
    });
  });

  test("limpia los inputs después de enviar el formulario", async () => {
    render(
      <AlertForm isOpen={true} onClose={mockOnClose} onSubmit={mockOnSubmit} />,
    );

    const inputNombre = screen.getByPlaceholderText("Ej: TENDENCIAS TECH 2026");
    const inputDesc = screen.getByPlaceholderText("Ej: IA, ROBÓTICA, CHIPS");
    fireEvent.change(inputNombre, { target: { value: "Test" } });
    fireEvent.change(inputDesc, { target: { value: "IA" } });
    fireEvent.click(screen.getByRole("checkbox", { name: /Sociedad/i }));

    await React.act(async () => {
      fireEvent.click(screen.getByText("GUARDAR ALERTA"));
    });

    await waitFor(() => {
      expect(mockOnSubmit).toHaveBeenCalled();
      expect(inputNombre).toHaveValue("");
    });
  });

  test("muestra chips de sugerencias al pulsar Sugerir Descriptores", async () => {
    vi.spyOn(globalThis, "fetch").mockResolvedValue({
      ok: true,
      json: async () => ["Machine Learning", "IA"],
    } as unknown as Response);

    render(
      <AlertForm isOpen={true} onClose={mockOnClose} onSubmit={mockOnSubmit} />,
    );

    fireEvent.change(screen.getByPlaceholderText("Ej: TENDENCIAS TECH 2026"), {
      target: { value: "Tecnologia" },
    });

    fireEvent.click(screen.getByText("Sugerir Descriptores"));

    expect(await screen.findByText("Sugerencias:")).toBeInTheDocument();
    expect(screen.getByText("Machine Learning")).toBeInTheDocument();
    expect(screen.getByText("IA")).toBeInTheDocument();

    await waitFor(() => {
      expect(globalThis.fetch).toHaveBeenCalledTimes(1);
      expect(globalThis.fetch).toHaveBeenCalledWith(
        expect.stringContaining(
          "/api/v1/alerts/keyword-recommendations?keyword=Tecnologia",
        ),
      );
    });
  });

  test("muestra error si falla la API de recomendaciones", async () => {
    vi.spyOn(globalThis, "fetch").mockResolvedValueOnce({
      ok: false,
      json: async () => ({}),
    } as unknown as Response);

    render(
      <AlertForm isOpen={true} onClose={mockOnClose} onSubmit={mockOnSubmit} />,
    );
    fireEvent.change(screen.getByPlaceholderText("Ej: TENDENCIAS TECH 2026"), {
      target: { value: "Tecnologia" },
    });

    fireEvent.click(screen.getByText("Sugerir Descriptores"));

    expect(await screen.findByRole("alert")).toHaveTextContent(
      "No se pudieron obtener recomendaciones",
    );
  });

  test("muestra error desconocido si recomendaciones lanza valor no Error", async () => {
    vi.spyOn(globalThis, "fetch").mockRejectedValueOnce("boom");

    render(
      <AlertForm isOpen={true} onClose={mockOnClose} onSubmit={mockOnSubmit} />,
    );
    fireEvent.change(screen.getByPlaceholderText("Ej: TENDENCIAS TECH 2026"), {
      target: { value: "Tecnologia" },
    });

    fireEvent.click(screen.getByText("Sugerir Descriptores"));

    expect(await screen.findByRole("alert")).toHaveTextContent(
      "No se pudieron obtener recomendaciones: Error desconocido",
    );
  });

  test('muestra "No hay sugerencias nuevas" cuando recomendaciones no es array', async () => {
    vi.spyOn(globalThis, "fetch").mockResolvedValueOnce({
      ok: true,
      json: async () => ({ invalid: true }),
    } as unknown as Response);

    render(
      <AlertForm isOpen={true} onClose={mockOnClose} onSubmit={mockOnSubmit} />,
    );
    fireEvent.change(screen.getByPlaceholderText("Ej: TENDENCIAS TECH 2026"), {
      target: { value: "Tecnologia" },
    });

    fireEvent.click(screen.getByText("Sugerir Descriptores"));

    expect(
      await screen.findByText("No hay sugerencias nuevas."),
    ).toBeInTheDocument();
  });

  test("muestra error si falla el guardado en API", async () => {
    vi.spyOn(globalThis, "fetch").mockResolvedValueOnce({
      ok: false,
      json: async () => ({}),
    } as unknown as Response);

    render(
      <AlertForm isOpen={true} onClose={mockOnClose} onSubmit={mockOnSubmit} />,
    );

    fireEvent.change(screen.getByPlaceholderText("Ej: TENDENCIAS TECH 2026"), {
      target: { value: "Alerta Error Guardado" },
    });
    fireEvent.change(screen.getByPlaceholderText("Ej: IA, ROBÓTICA, CHIPS"), {
      target: { value: "IA" },
    });
    fireEvent.click(
      screen.getByRole("checkbox", { name: /Ciencia y tecnología/i }),
    );

    mockOnSubmit.mockRejectedValueOnce(new Error("Error al guardar la alerta"));

    await React.act(async () => {
      fireEvent.click(screen.getByText("GUARDAR ALERTA"));
    });

    expect(await screen.findByRole("alert")).toHaveTextContent(
      "No se pudo guardar la alerta: Error al guardar la alerta",
    );
    expect(mockOnSubmit).toHaveBeenCalled();
  });

  test("muestra spinner y texto de carga mientras se está guardando", async () => {
    let resolveSubmit: (() => void) | null = null;
    const pendingSubmit = new Promise<void>((resolve) => {
      resolveSubmit = resolve;
    });

    mockOnSubmit.mockReturnValueOnce(pendingSubmit);

    render(
      <AlertForm isOpen={true} onClose={mockOnClose} onSubmit={mockOnSubmit} />,
    );

    fireEvent.change(screen.getByPlaceholderText("Ej: TENDENCIAS TECH 2026"), {
      target: { value: "Alerta Spinner" },
    });
    fireEvent.change(screen.getByPlaceholderText("Ej: IA, ROBÓTICA, CHIPS"), {
      target: { value: "IA" },
    });
    fireEvent.click(
      screen.getByRole("checkbox", { name: /Ciencia y tecnología/i }),
    );

    await React.act(async () => {
      fireEvent.click(screen.getByRole("button", { name: /GUARDAR ALERTA/i }));
    });

    expect(screen.getByText("GUARDANDO...")).toBeInTheDocument();
    expect(
      screen.getByRole("button", { name: /GUARDANDO.../i }),
    ).toBeDisabled();

    await React.act(async () => {
      resolveSubmit?.();
      await pendingSubmit;
    });
  });

  test("muestra error desconocido si guardar lanza un valor no Error", async () => {
    mockOnSubmit.mockRejectedValueOnce("boom");

    render(
      <AlertForm isOpen={true} onClose={mockOnClose} onSubmit={mockOnSubmit} />,
    );

    fireEvent.change(screen.getByPlaceholderText("Ej: TENDENCIAS TECH 2026"), {
      target: { value: "Alerta Error Unknown" },
    });
    fireEvent.change(screen.getByPlaceholderText("Ej: IA, ROBÓTICA, CHIPS"), {
      target: { value: "IA" },
    });
    fireEvent.click(
      screen.getByRole("checkbox", { name: /Ciencia y tecnología/i }),
    );

    await React.act(async () => {
      fireEvent.click(screen.getByText("GUARDAR ALERTA"));
    });

    expect(await screen.findByRole("alert")).toHaveTextContent(
      "No se pudo guardar la alerta: Error desconocido",
    );
  });

  test("no consulta recomendaciones si el nombre está vacío", async () => {
    render(
      <AlertForm isOpen={true} onClose={mockOnClose} onSubmit={mockOnSubmit} />,
    );

    fireEvent.click(screen.getByText("Sugerir Descriptores"));

    expect(globalThis.fetch).not.toHaveBeenCalled();
    expect(screen.queryByText("Sugerencias:")).not.toBeInTheDocument();
  });

  test("aceptar una recomendación la elimina y actualiza el input de descriptores", async () => {
    vi.spyOn(globalThis, "fetch").mockResolvedValue({
      ok: true,
      json: async () => ["Machine Learning", "IA"],
    } as unknown as Response);

    render(
      <AlertForm isOpen={true} onClose={mockOnClose} onSubmit={mockOnSubmit} />,
    );

    fireEvent.change(screen.getByPlaceholderText("Ej: TENDENCIAS TECH 2026"), {
      target: { value: "Tecnologia" },
    });

    fireEvent.click(screen.getByText("Sugerir Descriptores"));

    expect(await screen.findByText("Machine Learning")).toBeInTheDocument();
    fireEvent.click(
      screen.getByLabelText("Aceptar recomendación Machine Learning"),
    );

    await waitFor(() => {
      expect(screen.queryByText("Machine Learning")).not.toBeInTheDocument();
    });

    expect(screen.getByPlaceholderText("Ej: IA, ROBÓTICA, CHIPS")).toHaveValue(
      "Machine Learning",
    );
  });

  test("rechazar una recomendación la elimina y no modifica el input de descriptores", async () => {
    vi.spyOn(globalThis, "fetch").mockResolvedValue({
      ok: true,
      json: async () => ["Machine Learning", "IA"],
    } as unknown as Response);

    render(
      <AlertForm isOpen={true} onClose={mockOnClose} onSubmit={mockOnSubmit} />,
    );

    fireEvent.change(screen.getByPlaceholderText("Ej: TENDENCIAS TECH 2026"), {
      target: { value: "Tecnologia" },
    });

    fireEvent.click(screen.getByText("Sugerir Descriptores"));

    expect(await screen.findByText("IA")).toBeInTheDocument();
    fireEvent.click(screen.getByLabelText("Rechazar recomendación IA"));

    await waitFor(() => {
      expect(screen.queryByText("IA")).not.toBeInTheDocument();
    });

    expect(screen.getByPlaceholderText("Ej: IA, ROBÓTICA, CHIPS")).toHaveValue(
      "",
    );
  });
});
