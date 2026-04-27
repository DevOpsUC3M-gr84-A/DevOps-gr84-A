import { beforeEach, describe, expect, test, vi } from "vitest";
import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import { SourcesRss } from "./SourcesRss";
import { useAuth } from "../hooks/useAuth";

vi.mock("../hooks/useAuth");
const mockedUseAuth = vi.mocked(useAuth);

const mockedLogout = vi.fn();
const mockFetch = vi.fn();

globalThis.fetch = mockFetch as unknown as typeof fetch;

const baseSource = {
  id: 1,
  name: "Agencia Central",
  url: "https://agencia.example.com",
};

const baseCategory = {
  id: 10,
  name: "Ciencia y tecnología",
  source: "IPTC",
  iptc_code: "13000000",
  iptc_label: "Ciencia y tecnología",
};

const baseChannel = {
  id: 7,
  information_source_id: 1,
  url: "https://agencia.example.com/rss.xml",
  category_id: 10,
  iptc_category: "13000000",
  media_name: "Agencia Central",
};

const mockInitialLoad = ({
  sources = [baseSource],
  channels = [baseChannel],
  categories = [baseCategory],
}: {
  sources?: typeof baseSource[];
  channels?: typeof baseChannel[];
  categories?: typeof baseCategory[];
} = {}) => {
  mockFetch
    .mockResolvedValueOnce({
      ok: true,
      status: 200,
      json: async () => sources,
      statusText: "OK",
    })
    .mockResolvedValueOnce({
      ok: true,
      status: 200,
      json: async () => channels,
      statusText: "OK",
    })
    .mockResolvedValueOnce({
      ok: true,
      status: 200,
      json: async () => categories,
      statusText: "OK",
    });
};

describe("SourcesRss", () => {
  beforeEach(() => {
    localStorage.clear();
    mockFetch.mockReset();
    mockedLogout.mockReset();
    mockedUseAuth.mockReturnValue({
      login: vi.fn(),
      logout: mockedLogout,
      token: "fake-token",
      isAuthenticated: true,
    });
  });

  test("renderiza las fuentes y canales iniciales", async () => {
    mockInitialLoad();

    render(<SourcesRss />);

    expect(await screen.findByText("Agencia Central")).toBeInTheDocument();
    expect(screen.getByText("https://agencia.example.com")).toBeInTheDocument();
    expect(screen.getByText("https://agencia.example.com/rss.xml")).toBeInTheDocument();
    expect(screen.getByText("Ciencia y tecnología")).toBeInTheDocument();
  });

  test("abre los modales de creación de fuente y canal", async () => {
    mockInitialLoad({ channels: [] });

    render(<SourcesRss />);

    await screen.findByText("Agencia Central");

    fireEvent.click(screen.getByRole("button", { name: /Nueva fuente/i }));
    expect(
      screen.getByRole("heading", { name: /Crear fuente de información/i }),
    ).toBeInTheDocument();

    fireEvent.click(screen.getByRole("button", { name: /Cerrar modal de fuente/i }));

    fireEvent.click(screen.getByRole("button", { name: /Nuevo canal/i }));
    expect(
      screen.getByRole("heading", { name: /Crear canal RSS/i }),
    ).toBeInTheDocument();
    expect(screen.getByLabelText("FUENTE DE INFORMACIÓN")).toHaveValue("1");
  });

  test("recarga las fuentes y canales al pulsar Recargar", async () => {
    mockInitialLoad({ channels: [] });
    mockFetch
      .mockResolvedValueOnce({
        ok: true,
        status: 200,
        json: async () => [baseSource],
        statusText: "OK",
      })
      .mockResolvedValueOnce({
        ok: true,
        status: 200,
        json: async () => [],
        statusText: "OK",
      })
      .mockResolvedValueOnce({
        ok: true,
        status: 200,
        json: async () => [baseCategory],
        statusText: "OK",
      });

    render(<SourcesRss />);

    await screen.findByText("Agencia Central");
    fireEvent.click(screen.getByRole("button", { name: /Recargar/i }));

    await waitFor(() => {
      expect(mockFetch).toHaveBeenCalledTimes(6);
    });
  });

  test("abre los modales de edición con sus valores precargados", async () => {
    mockInitialLoad();

    render(<SourcesRss />);

    await screen.findByText("Agencia Central");

    fireEvent.click(screen.getByRole("button", { name: /Editar fuente Agencia Central/i }));
    expect(
      screen.getByRole("heading", { name: /Editar fuente de información/i }),
    ).toBeInTheDocument();
    expect(screen.getByLabelText("NOMBRE DE LA FUENTE")).toHaveValue("Agencia Central");
    expect(screen.getByLabelText("URL WEB")).toHaveValue("https://agencia.example.com");

    fireEvent.click(screen.getByRole("button", { name: /Cerrar modal de fuente/i }));

    fireEvent.click(screen.getByRole("button", { name: /Editar canal https:\/\/agencia.example.com\/rss\.xml/i }));
    expect(screen.getByRole("heading", { name: /Editar canal RSS/i })).toBeInTheDocument();
    expect(screen.getByLabelText("FUENTE DE INFORMACIÓN")).toHaveValue("1");
    expect(screen.getByLabelText("URL DEL FEED RSS")).toHaveValue(
      "https://agencia.example.com/rss.xml",
    );
    expect(screen.getByLabelText("CATEGORÍA IPTC")).toHaveValue("10");
  });

  test("permite cambiar la fuente seleccionada desde la tabla", async () => {
    mockInitialLoad({
      sources: [
        baseSource,
        {
          id: 2,
          name: "Segunda Agencia",
          url: "https://segunda.example.com",
        },
      ],
      channels: [
        baseChannel,
        {
          id: 8,
          information_source_id: 2,
          url: "https://segunda.example.com/rss.xml",
          category_id: 10,
          iptc_category: "13000000",
          media_name: "Segunda Agencia",
        },
      ],
      categories: [baseCategory],
    });

    render(<SourcesRss />);

    await screen.findByText("Agencia Central");
    fireEvent.click(screen.getByRole("button", { name: /^Segunda Agencia$/i }));

    expect(
      screen.getByText("https://segunda.example.com/rss.xml"),
    ).toBeInTheDocument();
  });

  test("valida la selección de categoría al crear un canal RSS", async () => {
    mockInitialLoad({
      sources: [
        baseSource,
        {
          id: 2,
          name: "Segunda Agencia",
          url: "https://segunda.example.com",
        },
      ],
      channels: [],
      categories: [baseCategory],
    });

    render(<SourcesRss />);

    await screen.findByText("Agencia Central");
    fireEvent.click(screen.getByRole("button", { name: /Nuevo canal/i }));

    fireEvent.change(screen.getByLabelText("FUENTE DE INFORMACIÓN"), {
      target: { value: "2" },
    });
    fireEvent.change(screen.getByLabelText("URL DEL FEED RSS"), {
      target: { value: "https://segunda.example.com/rss.xml" },
    });
    const channelForm = screen
      .getByRole("button", { name: /Crear canal/i })
      .closest("form");

    expect(channelForm).not.toBeNull();
    if (channelForm) {
      fireEvent.submit(channelForm);
    }

    expect(await screen.findByRole("alert")).toHaveTextContent(
      "Debes seleccionar una categoría IPTC válida.",
    );
  });

  test("muestra error si la fuente del canal no existe", async () => {
    mockInitialLoad({ channels: [], categories: [baseCategory] });

    render(<SourcesRss />);

    await screen.findByText("Agencia Central");
    fireEvent.click(screen.getByRole("button", { name: /Nuevo canal/i }));

    fireEvent.change(screen.getByLabelText("FUENTE DE INFORMACIÓN"), {
      target: { value: "999" },
    });
    fireEvent.change(screen.getByLabelText("CATEGORÍA IPTC"), {
      target: { value: "10" },
    });

    const channelForm = screen
      .getByRole("button", { name: /Crear canal/i })
      .closest("form");

    expect(channelForm).not.toBeNull();
    if (channelForm) {
      fireEvent.submit(channelForm);
    }

    expect(await screen.findByRole("alert")).toHaveTextContent(
      "Debes seleccionar una fuente válida para el canal RSS.",
    );
  });

  test("muestra error si la URL del feed no es válida", async () => {
    mockInitialLoad({ channels: [], categories: [baseCategory] });

    render(<SourcesRss />);

    await screen.findByText("Agencia Central");
    fireEvent.click(screen.getByRole("button", { name: /Nuevo canal/i }));

    fireEvent.change(screen.getByLabelText("URL DEL FEED RSS"), {
      target: { value: "not-a-valid-url" },
    });
    fireEvent.change(screen.getByLabelText("CATEGORÍA IPTC"), {
      target: { value: "10" },
    });

    const channelForm = screen
      .getByRole("button", { name: /Crear canal/i })
      .closest("form");

    expect(channelForm).not.toBeNull();
    if (channelForm) {
      fireEvent.submit(channelForm);
    }

    expect(await screen.findByRole("alert")).toHaveTextContent(
      "La URL del feed debe ser una URL válida con protocolo http o https.",
    );
  });

  test("envía con éxito un nuevo canal RSS", async () => {
    mockInitialLoad({ channels: [] });
    mockFetch.mockResolvedValueOnce({
      ok: true,
      status: 201,
      json: async () => ({
        id: 99,
        information_source_id: 1,
        url: "https://agencia.example.com/nuevo/rss.xml",
        category_id: 10,
        iptc_category: "13000000",
      }),
      statusText: "Created",
    });
    mockFetch.mockResolvedValueOnce({
      ok: true,
      status: 200,
      json: async () => [baseSource],
      statusText: "OK",
    });
    mockFetch.mockResolvedValueOnce({
      ok: true,
      status: 200,
      json: async () => [
        {
          ...baseChannel,
          url: "https://agencia.example.com/nuevo/rss.xml",
        },
      ],
      statusText: "OK",
    });
    mockFetch.mockResolvedValueOnce({
      ok: true,
      status: 200,
      json: async () => [baseCategory],
      statusText: "OK",
    });

    render(<SourcesRss />);

    await screen.findByText("Agencia Central");
    fireEvent.click(screen.getByRole("button", { name: /Nuevo canal/i }));

    fireEvent.change(screen.getByLabelText("URL DEL FEED RSS"), {
      target: { value: "https://agencia.example.com/nuevo/rss.xml" },
    });
    fireEvent.change(screen.getByLabelText("CATEGORÍA IPTC"), {
      target: { value: "10" },
    });

    fireEvent.click(screen.getByRole("button", { name: /Crear canal/i }));

    await waitFor(() => {
      expect(mockFetch).toHaveBeenCalledWith(
        expect.stringContaining("/api/v1/information-sources/1/rss-channels"),
        expect.objectContaining({
          method: "POST",
          body: JSON.stringify({
            media_name: "Agencia Central",
            url: "https://agencia.example.com/nuevo/rss.xml",
            category_id: 10,
            iptc_category: "13000000",
          }),
        }),
      );
    });

    expect(
      await screen.findByText("https://agencia.example.com/nuevo/rss.xml"),
    ).toBeInTheDocument();
    await waitFor(() => {
      expect(
        screen.queryByRole("heading", { name: /Crear canal RSS/i }),
      ).not.toBeInTheDocument();
    });
  });

  test("muestra error cuando falla la carga inicial", async () => {
    mockFetch
      .mockResolvedValueOnce({
        ok: true,
        status: 200,
        json: async () => [baseSource],
        statusText: "OK",
      })
      .mockResolvedValueOnce({
        ok: true,
        status: 200,
        json: async () => [baseChannel],
        statusText: "OK",
      })
      .mockResolvedValueOnce({
        ok: false,
        status: 500,
        statusText: "Internal Server Error",
        json: async () => ({}),
      });

    render(<SourcesRss />);

    expect(
      await screen.findByRole("alert"),
    ).toHaveTextContent("No se pudieron cargar las fuentes y canales RSS");
  });

  test("muestra el detalle de la API cuando la carga inicial devuelve un error JSON", async () => {
    mockFetch
      .mockResolvedValueOnce({
        ok: true,
        status: 200,
        json: async () => [baseSource],
        statusText: "OK",
      })
      .mockResolvedValueOnce({
        ok: true,
        status: 200,
        json: async () => [baseChannel],
        statusText: "OK",
      })
      .mockResolvedValueOnce({
        ok: false,
        status: 500,
        statusText: "Internal Server Error",
        json: async () => ({ detail: "Servicio temporalmente no disponible" }),
      });

    render(<SourcesRss />);

    expect(await screen.findByRole("alert")).toHaveTextContent(
      "Servicio temporalmente no disponible",
    );
  });

  test("muestra error cuando falla el alta de una fuente", async () => {
    mockInitialLoad({ channels: [] });
    mockFetch.mockRejectedValueOnce("boom");

    render(<SourcesRss />);

    await screen.findByText("Agencia Central");
    fireEvent.click(screen.getByRole("button", { name: /Nueva fuente/i }));

    fireEvent.change(screen.getByLabelText("NOMBRE DE LA FUENTE"), {
      target: { value: "Nueva Agencia" },
    });
    fireEvent.change(screen.getByLabelText("URL WEB"), {
      target: { value: "https://nueva.example.com" },
    });
    fireEvent.click(screen.getByRole("button", { name: /Crear fuente/i }));

    expect(await screen.findByRole("alert")).toHaveTextContent("Error desconocido");
  });

  test("muestra las categorías IPTC de respaldo cuando no hay catálogo de categorías", async () => {
    mockInitialLoad({
      channels: [baseChannel],
      categories: [],
    });

    render(<SourcesRss />);

    expect(await screen.findByText("Agencia Central")).toBeInTheDocument();
    expect(screen.getByText("13000000")).toBeInTheDocument();
  });

  test("llama al logout cuando la API responde 401", async () => {
    mockFetch
      .mockResolvedValueOnce({
        ok: false,
        status: 401,
        statusText: "Unauthorized",
        json: async () => ({ detail: "Sesión caducada" }),
      })
      .mockResolvedValueOnce({
        ok: true,
        status: 200,
        json: async () => [],
        statusText: "OK",
      })
      .mockResolvedValueOnce({
        ok: true,
        status: 200,
        json: async () => [],
        statusText: "OK",
      });

    render(<SourcesRss />);

    await waitFor(() => {
      expect(mockedLogout).toHaveBeenCalled();
    });
  });

  test("valida que el nombre de la fuente sea obligatorio", async () => {
    mockInitialLoad({ channels: [] });

    render(<SourcesRss />);

    await screen.findByText("Agencia Central");
    fireEvent.click(screen.getByRole("button", { name: /Nueva fuente/i }));

    fireEvent.change(screen.getByLabelText("URL WEB"), {
      target: { value: "https://nueva.example.com" },
    });

    const sourceForm = screen
      .getByRole("button", { name: /Crear fuente/i })
      .closest("form");

    expect(sourceForm).not.toBeNull();
    if (sourceForm) {
      fireEvent.submit(sourceForm);
    }

    expect(await screen.findByRole("alert")).toHaveTextContent(
      "El nombre de la fuente es obligatorio.",
    );
  });

  test("valida que la URL de la fuente sea válida", async () => {
    mockInitialLoad({ channels: [] });

    render(<SourcesRss />);

    await screen.findByText("Agencia Central");
    fireEvent.click(screen.getByRole("button", { name: /Nueva fuente/i }));

    fireEvent.change(screen.getByLabelText("NOMBRE DE LA FUENTE"), {
      target: { value: "Nueva Agencia" },
    });
    fireEvent.change(screen.getByLabelText("URL WEB"), {
      target: { value: "nota-una-url" },
    });

    const sourceForm = screen
      .getByRole("button", { name: /Crear fuente/i })
      .closest("form");

    expect(sourceForm).not.toBeNull();
    if (sourceForm) {
      fireEvent.submit(sourceForm);
    }

    expect(await screen.findByRole("alert")).toHaveTextContent(
      "La URL de la fuente debe ser una URL válida con protocolo http o https.",
    );
  });

  test("crea una nueva fuente de información con éxito", async () => {
    mockInitialLoad({ channels: [] });
    mockFetch.mockResolvedValueOnce({
      ok: true,
      status: 201,
      json: async () => ({
        id: 2,
        name: "Nueva Agencia",
        url: "https://nueva.example.com",
      }),
      statusText: "Created",
    });
    mockFetch.mockResolvedValueOnce({
      ok: true,
      status: 200,
      json: async () => [
        baseSource,
        {
          id: 2,
          name: "Nueva Agencia",
          url: "https://nueva.example.com",
        },
      ],
      statusText: "OK",
    });
    mockFetch.mockResolvedValueOnce({
      ok: true,
      status: 200,
      json: async () => [],
      statusText: "OK",
    });
    mockFetch.mockResolvedValueOnce({
      ok: true,
      status: 200,
      json: async () => [baseCategory],
      statusText: "OK",
    });

    render(<SourcesRss />);

    await screen.findByText("Agencia Central");
    fireEvent.click(screen.getByRole("button", { name: /Nueva fuente/i }));

    fireEvent.change(screen.getByLabelText("NOMBRE DE LA FUENTE"), {
      target: { value: "Nueva Agencia" },
    });
    fireEvent.change(screen.getByLabelText("URL WEB"), {
      target: { value: "https://nueva.example.com" },
    });
    fireEvent.click(screen.getByRole("button", { name: /Crear fuente/i }));

    await waitFor(() => {
      expect(mockFetch).toHaveBeenCalledWith(
        expect.stringContaining("/api/v1/information-sources"),
        expect.objectContaining({
          method: "POST",
          body: JSON.stringify({
            name: "Nueva Agencia",
            url: "https://nueva.example.com",
          }),
        }),
      );
    });

    expect(await screen.findByText("Nueva Agencia")).toBeInTheDocument();
    await waitFor(() => {
      expect(
        screen.queryByRole("heading", { name: /Crear fuente de información/i }),
      ).not.toBeInTheDocument();
    });
  });

  test("edita una fuente de información con éxito", async () => {
    mockInitialLoad({ channels: [] });
    mockFetch.mockResolvedValueOnce({
      ok: true,
      status: 200,
      json: async () => ({
        id: 1,
        name: "Agencia Central Actualizada",
        url: "https://agencia-actualizada.example.com",
      }),
      statusText: "OK",
    });
    mockFetch.mockResolvedValueOnce({
      ok: true,
      status: 200,
      json: async () => [
        {
          id: 1,
          name: "Agencia Central Actualizada",
          url: "https://agencia-actualizada.example.com",
        },
      ],
      statusText: "OK",
    });
    mockFetch.mockResolvedValueOnce({
      ok: true,
      status: 200,
      json: async () => [],
      statusText: "OK",
    });
    mockFetch.mockResolvedValueOnce({
      ok: true,
      status: 200,
      json: async () => [baseCategory],
      statusText: "OK",
    });

    render(<SourcesRss />);

    await screen.findByText("Agencia Central");
    fireEvent.click(screen.getByRole("button", { name: /Editar fuente Agencia Central/i }));

    fireEvent.change(screen.getByLabelText("NOMBRE DE LA FUENTE"), {
      target: { value: "Agencia Central Actualizada" },
    });
    fireEvent.change(screen.getByLabelText("URL WEB"), {
      target: { value: "https://agencia-actualizada.example.com" },
    });
    fireEvent.click(screen.getByRole("button", { name: /Guardar cambios/i }));

    await waitFor(() => {
      expect(mockFetch).toHaveBeenCalledWith(
        expect.stringContaining("/api/v1/information-sources/1"),
        expect.objectContaining({
          method: "PUT",
          body: JSON.stringify({
            name: "Agencia Central Actualizada",
            url: "https://agencia-actualizada.example.com",
          }),
        }),
      );
    });

    expect(await screen.findByText("Agencia Central Actualizada")).toBeInTheDocument();
  });

  test("edita un canal RSS con éxito", async () => {
    mockInitialLoad();
    mockFetch.mockResolvedValueOnce({
      ok: true,
      status: 200,
      json: async () => ({
        id: 7,
        information_source_id: 1,
        url: "https://agencia.example.com/rss-actualizado.xml",
        category_id: 10,
        iptc_category: "13000000",
      }),
      statusText: "OK",
    });
    mockFetch.mockResolvedValueOnce({
      ok: true,
      status: 200,
      json: async () => [baseSource],
      statusText: "OK",
    });
    mockFetch.mockResolvedValueOnce({
      ok: true,
      status: 200,
      json: async () => [
        {
          ...baseChannel,
          url: "https://agencia.example.com/rss-actualizado.xml",
        },
      ],
      statusText: "OK",
    });
    mockFetch.mockResolvedValueOnce({
      ok: true,
      status: 200,
      json: async () => [baseCategory],
      statusText: "OK",
    });

    render(<SourcesRss />);

    await screen.findByText("Agencia Central");
    fireEvent.click(
      screen.getByRole("button", {
        name: /Editar canal https:\/\/agencia\.example\.com\/rss\.xml/i,
      }),
    );

    fireEvent.change(screen.getByLabelText("URL DEL FEED RSS"), {
      target: { value: "https://agencia.example.com/rss-actualizado.xml" },
    });
    fireEvent.click(screen.getByRole("button", { name: /Guardar cambios/i }));

    await waitFor(() => {
      expect(mockFetch).toHaveBeenCalledWith(
        expect.stringContaining("/api/v1/information-sources/1/rss-channels/7"),
        expect.objectContaining({
          method: "PUT",
          body: JSON.stringify({
            url: "https://agencia.example.com/rss-actualizado.xml",
            category_id: 10,
          }),
        }),
      );
    });

    expect(
      await screen.findByText("https://agencia.example.com/rss-actualizado.xml"),
    ).toBeInTheDocument();
  });
+
  test("abre la edición de un canal sin categoría asociada", async () => {
    mockInitialLoad({
      channels: [
        {
          ...baseChannel,
          category_id: null,
        },
      ],
    });

    render(<SourcesRss />);

    await screen.findByText("Agencia Central");
    fireEvent.click(
      screen.getByRole("button", {
        name: /Editar canal https:\/\/agencia\.example\.com\/rss\.xml/i,
      }),
    );

    expect(
      screen.getByRole("heading", { name: /Editar canal RSS/i }),
    ).toBeInTheDocument();
    expect(screen.getByLabelText("CATEGORÍA IPTC")).toHaveValue("");
  });

  test("muestra error si se intenta guardar una fuente sin sesión", async () => {
    mockedUseAuth.mockReturnValue({
      login: vi.fn(),
      logout: mockedLogout,
      token: null,
      isAuthenticated: false,
    });

    render(<SourcesRss />);

    fireEvent.click(screen.getByRole("button", { name: /Nueva fuente/i }));
    fireEvent.change(screen.getByLabelText("NOMBRE DE LA FUENTE"), {
      target: { value: "Fuente sin sesión" },
    });
    fireEvent.change(screen.getByLabelText("URL WEB"), {
      target: { value: "https://sin-sesion.example.com" },
    });

    const sourceForm = screen
      .getByRole("button", { name: /Crear fuente/i })
      .closest("form");

    expect(sourceForm).not.toBeNull();
    if (sourceForm) {
      fireEvent.submit(sourceForm);
    }

    expect(await screen.findByRole("alert")).toHaveTextContent(
      "No hay sesión activa para guardar la fuente.",
    );
    expect(mockFetch).not.toHaveBeenCalled();
  });

  test("muestra error si se intenta guardar un canal sin sesión", async () => {
    mockedUseAuth.mockReturnValue({
      login: vi.fn(),
      logout: mockedLogout,
      token: "token-inicial",
      isAuthenticated: true,
    });
    mockInitialLoad({ channels: [] });

    const view = render(<SourcesRss />);

    await screen.findByText("Agencia Central");
    fireEvent.click(screen.getByRole("button", { name: /Nuevo canal/i }));

    fireEvent.change(screen.getByLabelText("URL DEL FEED RSS"), {
      target: { value: "https://canal-sin-sesion.example.com/rss.xml" },
    });
    fireEvent.change(screen.getByLabelText("CATEGORÍA IPTC"), {
      target: { value: "10" },
    });

    mockedUseAuth.mockReturnValue({
      login: vi.fn(),
      logout: mockedLogout,
      token: null,
      isAuthenticated: false,
    });
    view.rerender(<SourcesRss />);

    const channelForm = screen
      .getByRole("button", { name: /Crear canal/i })
      .closest("form");

    expect(channelForm).not.toBeNull();
    if (channelForm) {
      fireEvent.submit(channelForm);
    }

    expect(await screen.findByRole("alert")).toHaveTextContent(
      "No hay sesión activa.",
    );
    expect(mockFetch).toHaveBeenCalledTimes(3);
  });
});
