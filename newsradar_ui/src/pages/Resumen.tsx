import { useEffect, useMemo, useState } from "react";
import cloud from "d3-cloud";
import { useI18n } from "../i18n/i18n";
import { filterPaddingDescriptors } from "../utils/descriptors";
import "./Resumen.css";

const API_BASE = (import.meta as any).env?.VITE_API_BASE_URL ?? "http://localhost:8000";

interface WordData {
  text: string;
  value: number;
}

interface CloudWord extends WordData {
  x: number;
  y: number;
  size: number;
  rotate: number;
}

interface CategoryData {
  title: string;
  topics: string[];
}

interface AlertCategory {
  code: string;
  label: string;
}

interface Alert {
  id: number;
  descriptors: string[];
  categories: AlertCategory[];
}

interface DashboardTopCategory {
  label: string;
  value: number;
}

const CLOUD_WIDTH = 960;
const CLOUD_HEIGHT = 360;

const buildLayout = (words: WordData[], width: number, height: number): Promise<CloudWord[]> => {
  const maxVal = Math.max(...words.map((w) => w.value), 1);
  const minVal = Math.min(...words.map((w) => w.value));
  const range = maxVal - minVal || 1;
  const toSize = (v: number) => Math.round(18 + ((v - minVal) / range) * (56 - 18));

  return new Promise<CloudWord[]>((resolve) => {
    (cloud() as any)
      .size([width, height])
      .words(words.map((entry) => ({ ...entry, size: toSize(entry.value) })))
      .padding(8)
      .rotate(() => 0)
      .font("Inter")
      .fontSize((d: any) => d.size)
      .on("end", (result: CloudWord[]) => resolve(result))
      .start();
  });
};

const buildWordFrequency = (alerts: Alert[]): WordData[] => {
  const freq: Record<string, number> = {};
  for (const alert of alerts) {
    for (const descriptor of filterPaddingDescriptors(alert.descriptors ?? [])) {
      const key = descriptor.toUpperCase();
      freq[key] = (freq[key] ?? 0) + 1;
    }
  }
  return Object.entries(freq)
    .map(([text, value]) => ({ text, value }))
    .sort((a, b) => b.value - a.value)
    .slice(0, 40);
};

const buildCategoryGroups = (alerts: Alert[]): CategoryData[] => {
  const map: Record<string, Set<string>> = {};
  for (const alert of alerts) {
    for (const cat of alert.categories ?? []) {
      const name = cat.label ?? cat.code ?? "Sin categoría";
      if (!map[name]) map[name] = new Set();
      for (const d of filterPaddingDescriptors(alert.descriptors ?? [])) map[name].add(d);
    }
  }
  return Object.entries(map)
    .filter(([, topics]) => topics.size > 0)
    .map(([title, topics]) => ({ title, topics: [...topics].slice(0, 12) }))
    .slice(0, 6);
};

export const ResumenPage = () => {
  const { t } = useI18n();
  const [cloudWords, setCloudWords] = useState<CloudWord[]>([]);
  const [categories, setCategories] = useState<CategoryData[]>([]);
  const [loading, setLoading] = useState(true);
  const [hasData, setHasData] = useState(false);
  const [fetchError, setFetchError] = useState(false);

  useEffect(() => {
    let mounted = true;

    const token = globalThis.localStorage?.getItem("token");
    const userId = globalThis.localStorage?.getItem("userId");

    const headers: HeadersInit = {
      "Content-Type": "application/json",
      ...(token ? { Authorization: `Bearer ${token}` } : {}),
    };

    const fetchData = async () => {
      try {
        let alerts: Alert[] = [];

        if (userId) {
          const alertsRes = await fetch(`${API_BASE}/api/v1/users/${userId}/alerts`, { headers });
          if (alertsRes.ok) {
            alerts = (await alertsRes.json()) as Alert[];
          }
        }

        if (!mounted) return;

        let wordData = buildWordFrequency(alerts);

        if (wordData.length === 0) {
          const dashRes = await fetch(`${API_BASE}/api/v1/dashboard/summary`, { headers });
          if (dashRes.ok) {
            const dash = (await dashRes.json()) as { top_categories: DashboardTopCategory[] };
            const topCats = dash.top_categories ?? [];
            wordData = topCats.map((c) => ({
              text: c.label.toUpperCase(),
              value: Math.max(1, c.value),
            }));
          }
        }

        if (!mounted) return;

        const categoryData = buildCategoryGroups(alerts);
        setCategories(categoryData);
        setHasData(wordData.length > 0);

        if (wordData.length > 0) {
          const layout = await buildLayout(wordData, CLOUD_WIDTH, CLOUD_HEIGHT);
          if (mounted) setCloudWords(layout);
        }
      } catch {
        if (mounted) setFetchError(true);
      } finally {
        if (mounted) setLoading(false);
      }
    };

    fetchData();
    return () => {
      mounted = false;
    };
  }, []);

  const wordColor = useMemo(() => {
    const maxVal = Math.max(...cloudWords.map((w) => w.value), 1);
    return (value: number) => {
      const ratio = value / maxVal;
      if (ratio > 0.7) return "#0f172a";
      if (ratio > 0.4) return "#1e40af";
      return "#334155";
    };
  }, [cloudWords]);

  const cloudContent = () => {
    if (loading) {
      return <div className="resumen-cloud-loading">{t("resumen.loading")}</div>;
    }
    if (fetchError) {
      return <div className="resumen-cloud-loading">{t("resumen.error")}</div>;
    }
    if (!hasData) {
      return (
        <div className="resumen-cloud-loading">
          {t("resumen.empty")}
        </div>
      );
    }
    return (
      <div className="resumen-cloud" style={{ width: CLOUD_WIDTH, height: CLOUD_HEIGHT }}>
        {cloudWords.map((word) => (
          <span
            key={`${word.text}-${word.x}-${word.y}`}
            className="resumen-cloud-word"
            style={{
              left: `${CLOUD_WIDTH / 2 + word.x}px`,
              top: `${CLOUD_HEIGHT / 2 + word.y}px`,
              fontSize: `${word.size}px`,
              color: wordColor(word.value),
              transform: "translate(-50%, -50%)",
            }}
          >
            {word.text}
          </span>
        ))}
      </div>
    );
  };

  return (
    <section className="main-content resumen-page">
      <header className="page-heading">
        <p className="resumen-label">{t("resumen.label")}</p>
        <h1 className="section-title">{t("resumen.title")}</h1>
        <p className="section-subtitle">{t("resumen.subtitle")}</p>
      </header>

      <div className="resumen-hero-card">
        <div className="resumen-hero-copy">
          <span className="resumen-chip">{t("resumen.globalCloud")}</span>
        </div>
        <div className="resumen-cloud-frame" aria-label={t("resumen.globalCloudAria")}>
          {cloudContent()}
        </div>
      </div>

      {categories.length > 0 && (
        <div className="resumen-category-section">
          <div className="resumen-category-header">
            <p className="resumen-category-title">{t("resumen.categoryCloud")}</p>
            <p className="resumen-category-description">{t("resumen.categoryCloudDesc")}</p>
          </div>
          <div className="resumen-category-grid">
            {categories.map((category) => (
              <article key={category.title} className="resumen-category-card">
                <h3>{category.title}</h3>
                <div className="resumen-topics-list">
                  {category.topics.map((topic) => (
                    <span key={topic} className="resumen-topic-chip">
                      {topic}
                    </span>
                  ))}
                </div>
              </article>
            ))}
          </div>
        </div>
      )}
    </section>
  );
};
