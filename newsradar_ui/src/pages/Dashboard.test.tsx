import { render, screen, waitFor } from "../test-utils";
import { vi } from "vitest";
import { MemoryRouter } from "react-router-dom";
import { Dashboard } from "./Dashboard";

// Chart.js requiere canvas real — en jsdom lo reemplazamos por un elemento simple
vi.mock("react-chartjs-2", () => ({
  Line: () => <canvas data-testid="line-chart" />,
}));

const DEFAULT_SUMMARY = {
  active_sources: 45,
  rss_channels: 170,
  alerts_configured: 3,
  captured_news_total: 1200,
  last_7_days: Array.from({ length: 7 }, (_, i) => ({
    date: `2026-05-0${i + 1}`,
    value: i * 10,
  })),
  last_30_days: Array.from({ length: 30 }, (_, i) => ({
    date: `2026-04-${String(i + 1).padStart(2, "0")}`,
    value: i * 5,
  })),
  top_categories: [
    { label: "Política", value: 450 },
    { label: "Economía", value: 300 },
    { label: "Ciencia y tecnología", value: 200 },
  ],
};

const renderDashboard = () =>
  render(
    <MemoryRouter>
      <Dashboard />
    </MemoryRouter>,
  );

describe("Dashboard", () => {
  beforeEach(() => {
    sessionStorage.clear();
    localStorage.setItem("token", "test-token");
    jest.spyOn(globalThis, "fetch").mockResolvedValue({
      ok: true,
      json: async () => DEFAULT_SUMMARY,
    } as Response);
  });

  afterEach(() => {
    jest.restoreAllMocks();
    localStorage.clear();
    sessionStorage.clear();
  });

  test("muestra el indicador de carga mientras espera la API", () => {
    jest.spyOn(globalThis, "fetch").mockReturnValue(new Promise(() => {}));
    renderDashboard();
    expect(screen.getByText(/Cargando estadísticas/i)).toBeInTheDocument();
  });

  test("muestra los títulos de las tarjetas de métricas", async () => {
    renderDashboard();
    await waitFor(() => {
      expect(screen.getByText("Fuentes activas")).toBeInTheDocument();
      expect(screen.getByText("Noticias capturadas")).toBeInTheDocument();
      expect(screen.getByText("Alertas configuradas")).toBeInTheDocument();
      expect(screen.getByText("Canales RSS")).toBeInTheDocument();
    });
  });

  test("muestra el valor numérico de fuentes activas", async () => {
    renderDashboard();
    await waitFor(() => {
      expect(screen.getByText("45")).toBeInTheDocument();
    });
  });

  test("muestra los nombres de categoría recibidos de la API", async () => {
    renderDashboard();
    await waitFor(() => {
      expect(screen.getByText("Política")).toBeInTheDocument();
      expect(screen.getByText("Economía")).toBeInTheDocument();
      expect(screen.getByText("Ciencia y tecnología")).toBeInTheDocument();
    });
  });

  test("usa categorías por defecto si top_categories llega vacío", async () => {
    jest.spyOn(globalThis, "fetch").mockResolvedValue({
      ok: true,
      json: async () => ({ ...DEFAULT_SUMMARY, top_categories: [] }),
    } as Response);

    renderDashboard();

    await waitFor(() => {
      // Las categorías por defecto incluyen "Política"
      expect(screen.getByText("Política")).toBeInTheDocument();
    });
  });

  test("muestra mensaje de error cuando la API devuelve fallo", async () => {
    jest.spyOn(globalThis, "fetch").mockResolvedValue({
      ok: false,
      status: 500,
    } as Response);

    renderDashboard();

    await waitFor(() => {
      expect(screen.getByText(/No se pudo cargar/i)).toBeInTheDocument();
    });
  });

  test("muestra mensaje de error cuando hay fallo de red", async () => {
    jest.spyOn(globalThis, "fetch").mockRejectedValue(new Error("Network Error"));

    renderDashboard();

    await waitFor(() => {
      expect(screen.getByText(/Network Error/i)).toBeInTheDocument();
    });
  });

  test("renderiza el componente de gráfico de línea", async () => {
    renderDashboard();
    await waitFor(() => {
      expect(screen.getByTestId("line-chart")).toBeInTheDocument();
    });
  });

  test("no llama a fetch si no hay token en localStorage", () => {
    localStorage.removeItem("token");
    renderDashboard();
    expect(globalThis.fetch).not.toHaveBeenCalled();
  });
});
