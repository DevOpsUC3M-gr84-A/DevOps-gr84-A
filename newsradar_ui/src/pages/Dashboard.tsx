import { useEffect, useMemo, useState, type ComponentType } from "react";
import { Activity, Bell, Globe2, Rss } from "lucide-react";
import { Line } from "react-chartjs-2";
import {
  Chart as ChartJS,
  CategoryScale,
  LinearScale,
  PointElement,
  LineElement,
  Title,
  Tooltip,
  Legend,
  Filler,
} from "chart.js";
import "./Dashboard.css";

ChartJS.register(
  CategoryScale,
  LinearScale,
  PointElement,
  LineElement,
  Title,
  Tooltip,
  Legend,
  Filler,
);

const API_BASE_URL =
  import.meta.env.VITE_API_BASE_URL ?? "http://localhost:8000";

interface TrendPoint {
  date: string;
  value: number;
}

interface DashboardMetrics {
  activeSources: number;
  rssChannels: number;
  alertsConfigured: number;
  capturedNews: number;
}

interface DashboardSummaryResponse {
  active_sources: number;
  rss_channels: number;
  alerts_configured: number;
  captured_news_total: number;
  last_7_days: TrendPoint[];
  last_30_days: TrendPoint[];
  top_categories: Array<{ label: string; value: number }>;
}

const DEFAULT_METRICS: DashboardMetrics = {
  activeSources: 0,
  rssChannels: 0,
  alertsConfigured: 0,
  capturedNews: 0,
};

const DEFAULT_CATEGORIES = [
  { label: "Política", value: 450, color: "#0f172a" },
  { label: "Economía", value: 300, color: "#0f172a" },
  { label: "Tecnología", value: 200, color: "#0f172a" },
  { label: "Salud", value: 150, color: "#0f172a" },
  { label: "Deportes", value: 100, color: "#0f172a" },
];

const statLookup: Array<{
  title: string;
  metricKey: keyof DashboardMetrics;
  description: string;
  icon: ComponentType<{ size?: number }>;
  accentClass: string;
}> = [
  {
    title: "Fuentes activas",
    metricKey: "activeSources",
    description: "Orígenes RSS y fuentes monitorizadas",
    icon: Globe2,
    accentClass: "accent-sky",
  },
  {
    title: "Noticias capturadas",
    metricKey: "capturedNews",
    description: "Historico de noticias extraídas",
    icon: Activity,
    accentClass: "accent-blue",
  },
  {
    title: "Alertas configuradas",
    metricKey: "alertsConfigured",
    description: "Reglas activas para detección automática",
    icon: Bell,
    accentClass: "accent-indigo",
  },
  {
    title: "Canales RSS",
    metricKey: "rssChannels",
    description: "Canales RSS importados en el sistema",
    icon: Rss,
    accentClass: "accent-teal",
  },
];

const buildAxisLabel = (dateString: string, range: "7d" | "30d") => {
  const date = new Date(dateString);
  return date.toLocaleDateString("es-ES", {
    day: "2-digit",
    month: range === "30d" ? "2-digit" : undefined,
  });
};

export const Dashboard = () => {
  const [dashboardMetrics, setDashboardMetrics] = useState<DashboardMetrics>(
    DEFAULT_METRICS,
  );
  const [trendData, setTrendData] = useState<{
    last_7_days: TrendPoint[];
    last_30_days: TrendPoint[];
  }>({
    last_7_days: Array.from({ length: 7 }, (_, index) => ({
      date: new Date(Date.now() - (6 - index) * 86400000).toISOString().slice(0, 10),
      value: 0,
    })),
    last_30_days: Array.from({ length: 30 }, (_, index) => ({
      date: new Date(Date.now() - (29 - index) * 86400000).toISOString().slice(0, 10),
      value: 0,
    })),
  });
  const [topCategories, setTopCategories] = useState(DEFAULT_CATEGORIES);
  const [selectedRange, setSelectedRange] = useState<"7d" | "30d">("7d");
  const [isLoading, setIsLoading] = useState<boolean>(true);
  const [fetchError, setFetchError] = useState<string | null>(null);

  useEffect(() => {
    const token = globalThis.localStorage.getItem("token");
    if (!token) {
      setIsLoading(false);
      return;
    }

    const abortController = new AbortController();

    const loadSummary = async () => {
      try {
        const response = await fetch(
          `${API_BASE_URL}/api/v1/dashboard/summary`,
          {
            headers: {
              Authorization: `Bearer ${token}`,
              "Content-Type": "application/json",
            },
            signal: abortController.signal,
          },
        );

        if (!response.ok) {
          throw new Error("No se pudo cargar el panel de control");
        }

        const data = (await response.json()) as DashboardSummaryResponse;

        setDashboardMetrics({
          activeSources: data.active_sources,
          rssChannels: data.rss_channels,
          alertsConfigured: data.alerts_configured,
          capturedNews: data.captured_news_total,
        });

        setTrendData({
          last_7_days: data.last_7_days,
          last_30_days: data.last_30_days,
        });

        if (Array.isArray(data.top_categories) && data.top_categories.length > 0) {
          setTopCategories(
            data.top_categories.map((item, index) => ({
              label: item.label,
              value: item.value,
              color: DEFAULT_CATEGORIES[index]?.color ?? "#0f172a",
            })),
          );
        }
      } catch (error) {
        if (abortController.signal.aborted) {
          return;
        }

        setFetchError(error instanceof Error ? error.message : "Error desconocido");
      } finally {
        setIsLoading(false);
      }
    };

    loadSummary();

    return () => {
      abortController.abort();
    };
  }, []);

  const summaryCards = useMemo(
    () =>
      statLookup.map((item) => {
        const Icon = item.icon;
        return (
          <article key={item.title} className="dashboard-card">
            <div className={`dashboard-card-icon ${item.accentClass}`}>
              <Icon size={20} />
            </div>
            <div className="dashboard-card-content">
              <p className="dashboard-card-title">{item.title}</p>
              <p className="dashboard-card-value">
                {dashboardMetrics[item.metricKey].toLocaleString()}
              </p>
              <p className="dashboard-card-description">{item.description}</p>
            </div>
          </article>
        );
      }),
    [dashboardMetrics],
  );

  const activeTrend = selectedRange === "7d" ? trendData.last_7_days : trendData.last_30_days;
  const labels = activeTrend.map((point) => buildAxisLabel(point.date, selectedRange));
  const dataValues = activeTrend.map((point) => point.value);

  const chartData = {
    labels,
    datasets: [
      {
        label: "Noticias capturadas",
        data: dataValues,
        borderColor: "#0f172a",
        backgroundColor: "rgba(15, 23, 42, 0.05)",
        borderWidth: 2.5,
        pointRadius: 4,
        pointBackgroundColor: "#0f172a",
        pointBorderColor: "#0f172a",
        pointBorderWidth: 2,
        tension: 0.4,
        fill: true,
      },
    ],
  };

  const chartOptions = {
    responsive: true,
    maintainAspectRatio: false,
    plugins: {
      legend: {
        display: false,
      },
      tooltip: {
        backgroundColor: "rgba(15, 23, 42, 0.8)",
        padding: 8,
        cornerRadius: 6,
        titleFont: { size: 12, weight: 600 },
        bodyFont: { size: 12 },
      },
      filler: {
        propagate: true,
      },
    },
    scales: {
      y: {
        beginAtZero: true,
        min: 0,
        max: Math.max(...dataValues, 10) * 1.1,
        grid: {
          color: "rgba(226, 232, 240, 0.5)",
          drawBorder: false,
        },
        ticks: {
          color: "#64748b",
          font: { size: 11 },
          stepSize: Math.max(1, Math.ceil(Math.max(...dataValues, 10) / 4)),
        },
        padding: 20,
      },
      x: {
        grid: {
          display: false,
          drawBorder: false,
        },
        ticks: {
          color: "#64748b",
          font: { size: 11 },
        },
      },
    },
    layout: {
      padding: {
        top: 10,
        bottom: 10,
        left: 0,
        right: 0,
      },
    },
  };
  return (
    <section className="main-content dashboard-page">
      <header className="page-heading">
        <h1 className="section-title">Dashboard</h1>
        <p className="section-subtitle">
          Visión general de actividad, cumplimiento y datos clave de NewsRadar.
        </p>
      </header>

      {isLoading ? (
        <div className="dashboard-loading">Cargando estadísticas...</div>
      ) : null}

      {fetchError ? (
        <div className="dashboard-notice">{fetchError}</div>
      ) : null}

      <div className="dashboard-summary-grid">{summaryCards}</div>

      <div className="dashboard-panels-grid">
        <section className="dashboard-panel">
          <div className="dashboard-panel-header">
            <div>
              <p className="dashboard-panel-label">Tendencia de noticias capturadas</p>
              <h2 className="dashboard-panel-title">
                Últimos {selectedRange === "7d" ? "7 días" : "30 días"}
              </h2>
            </div>
            <div className="dashboard-range-switcher">
              <button
                type="button"
                className={`dashboard-range-button ${selectedRange === "7d" ? "is-active" : ""}`}
                onClick={() => setSelectedRange("7d")}
              >
                7 días
              </button>
              <button
                type="button"
                className={`dashboard-range-button ${selectedRange === "30d" ? "is-active" : ""}`}
                onClick={() => setSelectedRange("30d")}
              >
                30 días
              </button>
            </div>
          </div>

          <div className="dashboard-chart-frame">
            <Line data={chartData} options={chartOptions} />
          </div>
        </section>

        <section className="dashboard-panel">
          <div className="dashboard-panel-header">
            <div>
              <p className="dashboard-panel-label">Noticias por categoría</p>
            </div>
          </div>

          <ul className="dashboard-category-list">
            {topCategories.map((category, index) => {
              const maxCategoryValue = Math.max(...topCategories.map((c) => c.value), 1);
              const barWidth = (category.value / maxCategoryValue) * 100;
              const opacity = Math.max(0.2, 1 - index * 0.15);
              return (
                <li key={category.label} className="dashboard-category-item">
                  <div className="dashboard-category-row">
                    <span className="dashboard-category-name">{category.label}</span>
                    <span className="dashboard-category-value">{category.value}</span>
                  </div>
                  <div className="dashboard-category-bar" aria-hidden="true">
                    <div
                      className="dashboard-category-bar-fill"
                      style={{
                        width: `${Math.max(20, barWidth)}%`,
                        backgroundColor: `rgba(15, 23, 42, ${opacity})`,
                      }}
                    />
                  </div>
                </li>
              );
            })}
          </ul>
        </section>
      </div>
    </section>
  );
};
