import React from "react";
import { render, screen, waitFor } from "@testing-library/react";
import { AlertsManagement } from "./AlertsManagement";
import { fireEvent } from "@testing-library/react";
import { within } from "@testing-library/dom";

// Mock del fetch global
globalThis.fetch = jest.fn();
const mockLogout = jest.fn();

beforeAll(() => {
  globalThis.alert = jest.fn();
});

describe("AlertsManagement Page", () => {
  beforeEach(() => {
    jest.clearAllMocks();
    localStorage.clear();
    localStorage.setItem("token", "fake-token");
    localStorage.setItem("userId", "1");
    localStorage.setItem("userRoles", JSON.stringify([1]));

    // Respuesta por defecto
    (globalThis.fetch as jest.Mock).mockResolvedValue({
      ok: true,
      json: async () => [],
    });
  });

  test("muestra el mensaje de carga vacía cuando no hay alertas", async () => {
    render(<AlertsManagement onLogout={mockLogout} />);

    // Mensaje predeterminado sin alertas
    const emptyMessage = await screen.findByText(/No hay alertas todavía/i);
    expect(emptyMessage).toBeInTheDocument();
  });

  test("renderiza la lista de alertas cuando la API devuelve datos", async () => {
    const mockAlertas = [
      {
        id: 1,
        name: "Alerta Test",
        descriptors: ["IA", "Robot"],
        categoria_iptc: "Ciencia y tecnologia",
        information_sources_ids: ["Reuters"],
        rss_channels_ids: ["Reuters"],
      },
    ];

    (globalThis.fetch as jest.Mock).mockResolvedValueOnce({
      ok: true,
      json: async () => mockAlertas,
    });

    render(<AlertsManagement onLogout={mockLogout} />);

    // Esperamos a que el estado se actualice buscando el nombre en la tabla
    const alertName = await screen.findByText("Alerta Test");
    expect(alertName).toBeInTheDocument();
  });

  test("renderiza sin romper con alertas legacy sin categoria ni fuentes", async () => {
    const mockAlertas = [
      {
        id: 10,
        name: "Alerta Legacy",
        descriptors: undefined,
        categoria_iptc: undefined,
        information_sources_ids: null,
        rss_channels_ids: null,
      },
    ];

    (globalThis.fetch as jest.Mock).mockResolvedValueOnce({
      ok: true,
      json: async () => mockAlertas,
    });

    render(<AlertsManagement onLogout={mockLogout} />);

    expect(await screen.findByText("Alerta Legacy")).toBeInTheDocument();
  });

  test("filtra sin romper cuando information_sources_ids contiene valores inválidos", async () => {
    const mockAlertas = [
      {
        id: 15,
        name: "Alerta Fuente Invalida",
        descriptors: ["IA"],
        categoria_iptc: "Ciencia y tecnologia",
        information_sources_ids: [null, "Reuters"],
        rss_channels_ids: [null, "Reuters"],
      },
    ];

    (globalThis.fetch as jest.Mock).mockResolvedValueOnce({
      ok: true,
      json: async () => mockAlertas,
    });

    render(<AlertsManagement onLogout={mockLogout} />);

    expect(
      await screen.findByText("Alerta Fuente Invalida"),
    ).toBeInTheDocument();

    expect(screen.getByText("Alerta Fuente Invalida")).toBeInTheDocument();
  });

  test("tolera respuesta no array devolviendo estado vacío", async () => {
    (globalThis.fetch as jest.Mock).mockResolvedValueOnce({
      ok: true,
      json: async () => ({ not: "an-array" }),
    });

    render(<AlertsManagement onLogout={mockLogout} />);
    expect(
      await screen.findByText("No hay alertas todavía."),
    ).toBeInTheDocument();
  });

  test("filtra alertas por categoría IPTC y fuente RSS", async () => {
    const mockAlertas = [
      {
        id: 1,
        name: "Alerta Tech",
        descriptors: ["IA"],
        categoria_iptc: "13000000",
        information_sources_ids: ["Reuters", "BBC"],
        rss_channels_ids: ["Reuters", "BBC"],
      },
      {
        id: 2,
        name: "Alerta Deportes",
        descriptors: ["Futbol"],
        categoria_iptc: "14000000",
        information_sources_ids: ["ESPN"],
        rss_channels_ids: ["ESPN"],
      },
    ];

    (globalThis.fetch as jest.Mock).mockResolvedValueOnce({
      ok: true,
      json: async () => mockAlertas,
    });

    render(<AlertsManagement onLogout={mockLogout} />);

    expect(await screen.findByText("Alerta Tech")).toBeInTheDocument();
    expect(screen.getByText("Alerta Deportes")).toBeInTheDocument();

    fireEvent.change(screen.getByLabelText("Filtrar por categoria IPTC"), {
      target: { value: "14000000" },
    });

    expect(screen.queryByText("Alerta Tech")).not.toBeInTheDocument();
    expect(screen.getByText("Alerta Deportes")).toBeInTheDocument();

    fireEvent.change(screen.getByLabelText("Filtrar por categoria IPTC"), {
      target: { value: "" },
    });
    fireEvent.change(screen.getByLabelText("Buscar por Nombre o Descriptor"), {
      target: { value: "tech" },
    });

    expect(screen.getByText("Alerta Tech")).toBeInTheDocument();
    expect(screen.queryByText("Alerta Deportes")).not.toBeInTheDocument();
  });

  test("muestra estado vacío cuando los filtros no tienen coincidencias", async () => {
    const mockAlertas = [
      {
        id: 3,
        name: "Alerta Economia",
        descriptors: ["Mercado"],
        categoria_iptc: "Economia, negocio y finanzas",
        information_sources_ids: ["Bloomberg"],
        rss_channels_ids: ["Bloomberg"],
      },
    ];

    (globalThis.fetch as jest.Mock).mockResolvedValueOnce({
      ok: true,
      json: async () => mockAlertas,
    });

    render(<AlertsManagement onLogout={mockLogout} />);

    expect(await screen.findByText("Alerta Economia")).toBeInTheDocument();
    fireEvent.change(screen.getByLabelText("Buscar por Nombre o Descriptor"), {
      target: { value: "Reuters" },
    });

    expect(screen.queryByText("Alerta Economia")).not.toBeInTheDocument();
    expect(screen.getByText("No hay alertas todavía.")).toBeInTheDocument();
  });

  test("no intenta hacer fetch si el usuario no tiene sesión", async () => {
    // Vaciar el localStorage simulando que no hay usuario logueado
    localStorage.clear();

    render(<AlertsManagement onLogout={mockLogout} />);

    // Verificar que no se ha llamado a la API
    expect(globalThis.fetch).not.toHaveBeenCalled();
  });

  test('abre el modal de creación al pulsar "Nueva Alerta"', async () => {
    render(<AlertsManagement onLogout={mockLogout} />);
    await screen.findByRole("table");
    // Simulamos un clic en el botón
    const botonNueva = screen.getByText(/Nueva Alerta/i);
    fireEvent.click(botonNueva);

    // Verificar que el título del modal aparece en pantalla
    expect(screen.getByText("CREAR NUEVA ALERTA")).toBeInTheDocument();
  });

  test("añade una nueva alerta a la tabla al enviar el formulario con éxito", async () => {
    // Limpiamos llamadas previas del useEffect inicial
    (globalThis.fetch as jest.Mock).mockClear();

    // Mock para la respuesta del POST
    const mockNuevaAlerta = {
      id: 99,
      name: "Alerta Nuclear",
      descriptors: ["Uranio", "Energía"],
      categoria_iptc: "Ciencia y tecnologia",
      information_sources_ids: ["Reuters", "BBC"],
      rss_channels_ids: ["Reuters", "BBC"],
    };

    (globalThis.fetch as jest.Mock)
      // initial fetchAlertas → vacío
      .mockResolvedValueOnce({
        ok: true,
        json: async () => [],
      })
      // initial fetchCategories → vacío (cae en fallback IPTC_MAP)
      .mockResolvedValueOnce({
        ok: true,
        json: async () => [],
      })
      // POST nueva alerta
      .mockResolvedValueOnce({
        ok: true,
        json: async () => mockNuevaAlerta,
      })
      // refetch alertas tras crear
      .mockResolvedValueOnce({
        ok: true,
        json: async () => [mockNuevaAlerta],
      });

    render(<AlertsManagement onLogout={mockLogout} />);

    // Abrir modal
    fireEvent.click(screen.getByText(/Nueva Alerta/i));

    // Rellenar inputs del modal de forma robusta
    fireEvent.change(screen.getByPlaceholderText("Ej: TENDENCIAS TECH 2026"), {
      target: { value: "Alerta Nuclear" },
    });
    fireEvent.change(screen.getByPlaceholderText("Ej: IA, ROBÓTICA, CHIPS"), {
      target: { value: "Uranio, Energía" },
    });
    fireEvent.change(screen.getByLabelText("CATEGORIA IPTC (NIVEL 1)"), {
      target: { value: "13000000" },
    });

    // Enviar el formulario
    const botonGuardar = screen.getByRole("button", {
      name: /GUARDAR ALERTA/i,
    });

    // Usar await act para envolver el click que dispara el fetch y el setAlertas
    await React.act(async () => {
      fireEvent.click(botonGuardar);
    });

    // Esperar a que el texto aparezca en la tabla
    const alertaEnTabla = await screen.findByText("Alerta Nuclear");
    const row = alertaEnTabla.closest("tr");
    expect(alertaEnTabla).toBeInTheDocument();
    expect(row).not.toBeNull();
    if (row) {
      expect(within(row).getByText("Ciencia y tecnologia")).toBeInTheDocument();
      expect(within(row).getByText("Uranio, Energía")).toBeInTheDocument();
    }

    // Verificar que el modal se cerró
    await waitFor(() => {
      expect(screen.queryByText("CREAR NUEVA ALERTA")).not.toBeInTheDocument();
    });
  });

  test("abre el modal en modo edición al pulsar Editar", async () => {
    const mockAlertas = [
      {
        id: 5,
        name: "Alerta Editable",
        descriptors: ["IA", "NLP"],
        categoria_iptc: "Sociedad",
        information_sources_ids: ["BBC"],
        rss_channels_ids: ["BBC"],
      },
    ];

    (globalThis.fetch as jest.Mock)
      .mockResolvedValueOnce({
        ok: true,
        json: async () => mockAlertas,
      })
      .mockResolvedValue({
        ok: true,
        json: async () => mockAlertas,
      });

    render(<AlertsManagement onLogout={mockLogout} />);

    expect(await screen.findByText("Alerta Editable")).toBeInTheDocument();
    fireEvent.click(screen.getByLabelText("Editar alerta Alerta Editable"));

    expect(screen.getByText("EDITAR ALERTA")).toBeInTheDocument();
    expect(screen.getByPlaceholderText("Ej: TENDENCIAS TECH 2026")).toHaveValue(
      "Alerta Editable",
    );
  });

  test("borra una alerta cuando el usuario confirma", async () => {
    const confirmSpy = jest.spyOn(globalThis, "confirm").mockReturnValue(true);
    const mockAlertas = [
      {
        id: 11,
        name: "Alerta Borrable",
        descriptors: ["IA"],
        categoria_iptc: "Politica",
        information_sources_ids: [],
        rss_channels_ids: [],
      },
    ];

    (globalThis.fetch as jest.Mock)
      .mockResolvedValueOnce({
        ok: true,
        json: async () => mockAlertas,
      })
      .mockResolvedValueOnce({
        ok: true,
        json: async () => ({}),
      });

    render(<AlertsManagement onLogout={mockLogout} />);

    expect(await screen.findByText("Alerta Borrable")).toBeInTheDocument();

    fireEvent.click(screen.getByLabelText("Eliminar alerta Alerta Borrable"));

    await waitFor(() => {
      expect(confirmSpy).toHaveBeenCalledWith(
        "¿Seguro que quieres borrar esta alerta?",
      );
      expect(globalThis.fetch).toHaveBeenCalledWith(
        expect.stringContaining("/api/v1/users/1/alerts/11"),
        expect.objectContaining({ method: "DELETE" }),
      );
    });

    await waitFor(() => {
      expect(screen.queryByText("Alerta Borrable")).not.toBeInTheDocument();
    });

    confirmSpy.mockRestore();
  });

  test("no borra la alerta si el usuario cancela la confirmación", async () => {
    const confirmSpy = jest.spyOn(globalThis, "confirm").mockReturnValue(false);
    const mockAlertas = [
      {
        id: 12,
        name: "Alerta No Borrada",
        descriptors: ["NLP"],
        categoria_iptc: "Deportes",
        information_sources_ids: ["ESPN"],
        rss_channels_ids: ["ESPN"],
      },
    ];

    (globalThis.fetch as jest.Mock).mockResolvedValueOnce({
      ok: true,
      json: async () => mockAlertas,
    });

    render(<AlertsManagement onLogout={mockLogout} />);

    expect(await screen.findByText("Alerta No Borrada")).toBeInTheDocument();

    fireEvent.click(screen.getByLabelText("Eliminar alerta Alerta No Borrada"));

    await waitFor(() => {
      expect(confirmSpy).toHaveBeenCalled();
    });
    // initial alertas + categories fetches; no DELETE expected when user cancels
    expect((globalThis.fetch as jest.Mock).mock.calls).toHaveLength(2);

    confirmSpy.mockRestore();
  });

  test("maneja correctamente un error del servidor sin romper la app", async () => {
    // Simular que el backend falla al hacer GET
    (globalThis.fetch as jest.Mock).mockResolvedValueOnce({
      ok: false,
      status: 500,
    });

    render(<AlertsManagement onLogout={mockLogout} />);

    // Aunque la API falle, la app debería sobrevivir y mostrar la tabla vacía
    const emptyMessage = await screen.findByText(/No hay alertas todavía/i);
    expect(emptyMessage).toBeInTheDocument();
  });

  test("muestra feedback de error cuando falla el borrado", async () => {
    const confirmSpy = jest.spyOn(globalThis, "confirm").mockReturnValue(true);
    const mockAlertas = [
      {
        id: 33,
        name: "Alerta Error Delete",
        descriptors: ["IA"],
        categoria_iptc: "Ciencia y tecnologia",
        information_sources_ids: ["Reuters"],
        rss_channels_ids: ["Reuters"],
      },
    ];

    (globalThis.fetch as jest.Mock)
      .mockResolvedValueOnce({
        ok: true,
        json: async () => mockAlertas,
      })
      .mockResolvedValueOnce({
        ok: true,
        json: async () => [],
      })
      .mockResolvedValueOnce({
        ok: false,
        status: 500,
        json: async () => ({}),
      });

    render(<AlertsManagement onLogout={mockLogout} />);

    expect(await screen.findByText("Alerta Error Delete")).toBeInTheDocument();
    fireEvent.click(
      screen.getByLabelText("Eliminar alerta Alerta Error Delete"),
    );

    expect(
      await screen.findByText(/No se pudo borrar la alerta/i),
    ).toBeInTheDocument();
    confirmSpy.mockRestore();
  });

  test("muestra error desconocido si fetch de alertas lanza valor no Error", async () => {
    (globalThis.fetch as jest.Mock).mockRejectedValueOnce("boom");

    render(<AlertsManagement onLogout={mockLogout} />);

    expect(
      await screen.findByText(
        /No se pudieron cargar las alertas: Error desconocido/i,
      ),
    ).toBeInTheDocument();
  });

  test("muestra error desconocido si borrado lanza valor no Error", async () => {
    const confirmSpy = jest.spyOn(globalThis, "confirm").mockReturnValue(true);
    const mockAlertas = [
      {
        id: 77,
        name: "Alerta Error Desconocido",
        descriptors: ["IA"],
        categoria_iptc: "Ciencia y tecnologia",
        information_sources_ids: ["Reuters"],
        rss_channels_ids: ["Reuters"],
      },
    ];

    (globalThis.fetch as jest.Mock)
      .mockResolvedValueOnce({
        ok: true,
        json: async () => mockAlertas,
      })
      .mockResolvedValueOnce({
        ok: true,
        json: async () => [],
      })
      .mockRejectedValueOnce("boom");

    render(<AlertsManagement onLogout={mockLogout} />);
    expect(
      await screen.findByText("Alerta Error Desconocido"),
    ).toBeInTheDocument();

    fireEvent.click(
      screen.getByLabelText("Eliminar alerta Alerta Error Desconocido"),
    );

    expect(
      await screen.findByText(
        /No se pudo borrar la alerta: Error desconocido/i,
      ),
    ).toBeInTheDocument();
    confirmSpy.mockRestore();
  });

  test("muestra feedback de alerta actualizada al guardar en edición", async () => {
    const mockAlertas = [
      {
        id: 55,
        name: "Alerta Edit",
        descriptors: ["IA"],
        categoria_iptc: "13000000",
        information_sources_ids: ["Reuters"],
        rss_channels_ids: ["Reuters"],
      },
    ];

    (globalThis.fetch as jest.Mock)
      .mockResolvedValueOnce({
        ok: true,
        json: async () => mockAlertas,
      })
      // categories fetch
      .mockResolvedValueOnce({
        ok: true,
        json: async () => [],
      })
      // PUT
      .mockResolvedValueOnce({
        ok: true,
        json: async () => ({}),
      })
      // refetch alertas
      .mockResolvedValueOnce({
        ok: true,
        json: async () => mockAlertas,
      });

    render(<AlertsManagement onLogout={mockLogout} />);

    expect(await screen.findByText("Alerta Edit")).toBeInTheDocument();
    fireEvent.click(screen.getByLabelText("Editar alerta Alerta Edit"));

    await React.act(async () => {
      fireEvent.click(screen.getByRole("button", { name: /GUARDAR ALERTA/i }));
    });

    expect(
      await screen.findByText("Alerta actualizada correctamente."),
    ).toBeInTheDocument();
  });

  test("lanza logout cuando el borrado devuelve 401", async () => {
    const confirmSpy = jest.spyOn(globalThis, "confirm").mockReturnValue(true);
    const mockAlertas = [
      {
        id: 44,
        name: "Alerta 401 Delete",
        descriptors: ["IA"],
        categoria_iptc: "Ciencia y tecnologia",
        information_sources_ids: ["Reuters"],
      },
    ];

    (globalThis.fetch as jest.Mock)
      .mockResolvedValueOnce({
        ok: true,
        json: async () => mockAlertas,
      })
      // categories fetch
      .mockResolvedValueOnce({
        ok: true,
        json: async () => [],
      })
      // DELETE 401
      .mockResolvedValueOnce({
        ok: false,
        status: 401,
        json: async () => ({}),
      });

    render(<AlertsManagement onLogout={mockLogout} />);

    expect(await screen.findByText("Alerta 401 Delete")).toBeInTheDocument();
    fireEvent.click(screen.getByLabelText("Eliminar alerta Alerta 401 Delete"));

    await waitFor(() => {
      expect(mockLogout).toHaveBeenCalled();
    });
    confirmSpy.mockRestore();
  });

  test("cierra sesión automáticamente si la API devuelve 401 (token expirado o servidor reiniciado)", async () => {
    // Simular error 401
    (globalThis.fetch as jest.Mock).mockResolvedValueOnce({
      status: 401,
      ok: false,
    });

    render(<AlertsManagement onLogout={mockLogout} />);

    // Esperar a que se detecte el 401 y se llame a la función de logout
    await waitFor(() => {
      expect(mockLogout).toHaveBeenCalled();
    });
  });

  test("oculta automáticamente el feedback tras 5 segundos", async () => {
    jest.useFakeTimers();
    (globalThis.fetch as jest.Mock).mockResolvedValueOnce({
      ok: false,
      status: 500,
    });

    render(<AlertsManagement onLogout={mockLogout} />);

    expect(
      await screen.findByText(/No se pudieron cargar las alertas/i),
    ).toBeInTheDocument();

    await React.act(async () => {
      jest.advanceTimersByTime(5000);
    });

    expect(
      screen.queryByText(/No se pudieron cargar las alertas/i),
    ).not.toBeInTheDocument();
    jest.useRealTimers();
  });
});
