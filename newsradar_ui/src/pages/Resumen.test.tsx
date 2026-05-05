import { render, screen, waitFor } from "../test-utils";
import { vi } from "vitest";
import { ResumenPage } from "./Resumen";

// d3-cloud necesita canvas real para calcular posiciones.
// Lo reemplazamos por una implementación síncrona que devuelve las palabras
// con coordenadas fijas, permitiendo que el componente las renderice.
vi.mock("d3-cloud", () => ({
  default: () => {
    let _words: any[] = [];
    let _endCb: ((words: any[]) => void) | null = null;

    const chain = {
      size: () => chain,
      words: (w: any[]) => {
        _words = w;
        return chain;
      },
      padding: () => chain,
      rotate: () => chain,
      font: () => chain,
      fontSize: () => chain,
      on: (event: string, cb: (words: any[]) => void) => {
        if (event === "end") _endCb = cb;
        return chain;
      },
      start: () => {
        if (_endCb) {
          // Llamada síncrona para que el estado se actualice en el mismo tick
          setTimeout(
            () =>
              _endCb!(
                _words.map((w) => ({ ...w, x: 0, y: 0, rotate: 0 })),
              ),
            0,
          );
        }
        return chain;
      },
    };
    return chain;
  },
}));

const MOCK_ALERTS = [
  {
    id: 1,
    descriptors: ["python", "devops"],
    categories: [{ code: "13000000", label: "Ciencia y tecnología" }],
  },
  {
    id: 2,
    descriptors: ["python", "testing"],
    categories: [{ code: "13000000", label: "Ciencia y tecnología" }],
  },
];

describe("ResumenPage", () => {
  beforeEach(() => {
    localStorage.setItem("token", "test-token");
    localStorage.setItem("userId", "1");
  });

  afterEach(() => {
    jest.restoreAllMocks();
    localStorage.clear();
  });

  test("muestra el estado de carga al iniciar", () => {
    jest.spyOn(globalThis, "fetch").mockReturnValue(new Promise(() => {}));
    render(<ResumenPage />);
    expect(screen.getByText(/Cargando nube de palabras/i)).toBeInTheDocument();
  });

  test("muestra el título de la sección siempre", () => {
    jest.spyOn(globalThis, "fetch").mockReturnValue(new Promise(() => {}));
    render(<ResumenPage />);
    expect(screen.getByText(/Analítica y Nube de Palabras/i)).toBeInTheDocument();
  });

  test("muestra los descriptores en mayúsculas como palabras de la nube", async () => {
    jest.spyOn(globalThis, "fetch").mockResolvedValue({
      ok: true,
      json: async () => MOCK_ALERTS,
    } as Response);

    render(<ResumenPage />);

    // "python" aparece en 2 alertas → frecuencia 2 → debe ser la más grande
    await waitFor(() => {
      expect(screen.getByText("PYTHON")).toBeInTheDocument();
    });
  });

  test("muestra tarjetas de categoría cuando las alertas tienen categorías asignadas", async () => {
    jest.spyOn(globalThis, "fetch").mockResolvedValue({
      ok: true,
      json: async () => MOCK_ALERTS,
    } as Response);

    render(<ResumenPage />);

    await waitFor(() => {
      expect(screen.getByText("Ciencia y tecnología")).toBeInTheDocument();
    });
  });

  test("muestra los descriptores dentro de la tarjeta de su categoría", async () => {
    jest.spyOn(globalThis, "fetch").mockResolvedValue({
      ok: true,
      json: async () => MOCK_ALERTS,
    } as Response);

    render(<ResumenPage />);

    await waitFor(() => {
      // Los chips de la tarjeta de categoría muestran los descriptores originales
      expect(screen.getByText("python")).toBeInTheDocument();
    });
  });

  test("muestra mensaje de vacío si no hay alertas ni datos de dashboard", async () => {
    jest
      .spyOn(globalThis, "fetch")
      .mockResolvedValueOnce({
        ok: true,
        json: async () => [],
      } as Response) // alerts vacías
      .mockResolvedValueOnce({
        ok: true,
        json: async () => ({ top_categories: [] }),
      } as Response); // dashboard sin categorías

    render(<ResumenPage />);

    await waitFor(() => {
      expect(screen.getByText(/Sin descriptores/i)).toBeInTheDocument();
    });
  });

  test("usa top_categories del dashboard como fallback si no hay alertas", async () => {
    jest
      .spyOn(globalThis, "fetch")
      .mockResolvedValueOnce({
        ok: true,
        json: async () => [],
      } as Response) // alertas vacías
      .mockResolvedValueOnce({
        ok: true,
        json: async () => ({
          top_categories: [{ label: "Política", value: 100 }],
        }),
      } as Response);

    render(<ResumenPage />);

    await waitFor(() => {
      expect(screen.getByText("POLÍTICA")).toBeInTheDocument();
    });
  });

  test("muestra error de servidor si la petición de alertas falla", async () => {
    jest.spyOn(globalThis, "fetch").mockRejectedValue(new Error("Network error"));

    render(<ResumenPage />);

    await waitFor(() => {
      expect(screen.getByText(/No se pudo cargar los datos/i)).toBeInTheDocument();
    });
  });

  test("no muestra la sección de categorías si no hay ninguna", async () => {
    jest.spyOn(globalThis, "fetch").mockResolvedValue({
      ok: true,
      json: async () => [{ id: 1, descriptors: ["solo"], categories: [] }],
    } as Response);

    render(<ResumenPage />);

    await waitFor(() => {
      expect(
        screen.queryByText(/Nube de palabras por categoría/i),
      ).not.toBeInTheDocument();
    });
  });
});
