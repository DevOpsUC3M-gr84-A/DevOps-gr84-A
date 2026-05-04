import { useEffect, useMemo, useState } from "react";
import cloud from "d3-cloud";
import "./Resumen.css";

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

const CLOUD_WIDTH = 960;
const CLOUD_HEIGHT = 360;

const GLOBAL_WORDS: WordData[] = [
  { text: "INTELIGENCIA ARTIFICIAL", value: 72 },
  { text: "SOSTENIBILIDAD", value: 58 },
  { text: "CIBERSEGURIDAD", value: 52 },
  { text: "BLOCKCHAIN", value: 44 },
  { text: "ECONOMÍA CIRCULAR", value: 39 },
  { text: "METAVERSO", value: 34 },
  { text: "ENERGÍA VERDE", value: 30 },
  { text: "TELETRABAJO", value: 28 },
  { text: "SALUD MENTAL", value: 26 },
  { text: "5G", value: 24 },
  { text: "STARTUP", value: 22 },
  { text: "NUBE", value: 20 },
  { text: "FRONTEND", value: 18 },
  { text: "INVERSIÓN", value: 16 },
  { text: "LEGISLACIÓN", value: 14 },
];

const CATEGORIES = [
  {
    title: "Tecnología",
    topics: [
      "IA",
      "Nube",
      "SaaS",
      "Hardware",
      "Chips",
      "Software",
      "DevOps",
      "Frontend",
    ],
  },
  {
    title: "Economía",
    topics: [
      "Inflación",
      "PIB",
      "Mercados",
      "Bolsa",
      "Tipos",
      "Deuda",
      "Inversión",
      "Startup",
    ],
  },
  {
    title: "Política",
    topics: [
      "Elecciones",
      "Ley",
      "Gobierno",
      "Tratado",
      "Cumbre",
      "Reforma",
      "Senado",
      "Voto",
    ],
  },
  {
    title: "Salud",
    topics: [
      "Vacuna",
      "Virus",
      "Hospital",
      "Dieta",
      "Fitness",
      "Medicina",
      "Genoma",
      "Bienestar",
    ],
  },
];

const buildLayout = (words: WordData[], width: number, height: number) =>
  new Promise<CloudWord[]>((resolve) => {
    (cloud() as any)
      .size([width, height])
      .words(
        words.map((entry) => ({
          text: entry.text,
          value: entry.value,
          size: Math.max(18, Math.min(56, entry.value)),
        } as CloudWord)),
      )
      .padding(8)
      .rotate(() => 0)
      .font("Inter")
      .fontSize((d: any) => d.size)
      .on("end", (result: CloudWord[]) => resolve(result))
      .start();
  });

export const ResumenPage = () => {
  const [cloudWords, setCloudWords] = useState<CloudWord[]>([]);

  useEffect(() => {
    let mounted = true;

    buildLayout(GLOBAL_WORDS, CLOUD_WIDTH, CLOUD_HEIGHT).then((result) => {
      if (mounted) {
        setCloudWords(result);
      }
    });

    return () => {
      mounted = false;
    };
  }, []);

  const wordColor = useMemo(
    () => (value: number) => {
      if (value > 50) return "#0f172a";
      if (value > 35) return "#1e40af";
      return "#334155";
    },
    [],
  );

  return (
    <section className="main-content resumen-page">
      <header className="page-heading">
        <p className="resumen-label">Resumen</p>
        <h1 className="section-title">Analítica y Nube de Palabras</h1>
        <p className="section-subtitle">
          Visualiza los temas más candentes y descubre cómo se distribuyen los
          descriptores por categoría.
        </p>
      </header>

      <div className="resumen-hero-card">
        <div className="resumen-hero-copy">
          <span className="resumen-chip">Nube de Descriptores Global</span>
        </div>

        <div className="resumen-cloud-frame" aria-label="Nube de palabras global">
          {cloudWords.length === 0 ? (
            <div className="resumen-cloud-loading">Generando nube de palabras...</div>
          ) : (
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
          )}
        </div>
      </div>

      <div className="resumen-category-section">
        <div className="resumen-category-header">
          <p className="resumen-category-title">Nube de palabras por categoría</p>
          <p className="resumen-category-description">
            Explora los términos más frecuentes agrupados en las principales
            áreas temáticas.
          </p>
        </div>
        <div className="resumen-category-grid">
          {CATEGORIES.map((category) => (
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
    </section>
  );
};
