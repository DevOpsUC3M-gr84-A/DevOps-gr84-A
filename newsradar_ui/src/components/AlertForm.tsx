import React, { useEffect, useState } from "react";
import { Check, X } from "lucide-react";

const API_BASE_URL =
  import.meta.env.VITE_API_BASE_URL ?? "http://localhost:8000";

export interface AlertFormPayload {
  name: string;
  descriptors: string[];
  categoria_iptc: string;
  fuentes_rss: string[];
  cron_expression: string;
}

export interface AlertTableItem {
  id: number;
  nombre: string;
  descriptores: string;
  categoria_iptc: string;
  fuentes_rss: string[];
}

interface AlertFormProps {
  isOpen: boolean;
  onClose: () => void;
  initialData?: AlertTableItem | null;
  onSubmit: (datos: AlertFormPayload) => Promise<void> | void;
}

export const AlertForm: React.FC<AlertFormProps> = ({
  isOpen,
  onClose,
  initialData,
  onSubmit,
}) => {
  const IPTC_LEVEL_1_CATEGORIES: string[] = [
    "Arte, cultura y entretenimiento",
    "Crimen, derecho y justicia",
    "Desastre y accidente",
    "Economia, negocio y finanzas",
    "Educacion",
    "Medioambiente",
    "Salud",
    "Interes humano",
    "Trabajo",
    "Politica",
    "Religion y creencias",
    "Ciencia y tecnologia",
    "Sociedad",
    "Deportes",
    "Conflicto, guerra y paz",
    "Clima",
  ];

  const [name, setName] = useState("");
  const [descriptors, setDescriptors] = useState("");
  const [categoriaIptc, setCategoriaIptc] = useState("");
  const [fuentesRss, setFuentesRss] = useState("");
  const [cronExpression, setCronExpression] = useState("0 * * * *");
  const [recommendations, setRecommendations] = useState<string[]>([]);
  const [hasFetchedRecommendations, setHasFetchedRecommendations] =
    useState(false);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [formError, setFormError] = useState<string | null>(null);

  const parseDescriptors = (value: string): string[] => {
    return value
      .split(",")
      .map((palabra) => palabra.trim())
      .filter((palabra) => palabra !== "");
  };

  const isValidCronExpression = (value: string): boolean => {
    // Cron de 5 campos: minuto hora dia-mes mes dia-semana
    const normalized = value.trim();
    return /^(\S+\s+){4}\S+$/.test(normalized);
  };

  useEffect(() => {
    if (!isOpen) {
      return;
    }

    if (initialData) {
      setName(initialData.nombre);
      setDescriptors(initialData.descriptores ?? "");
      setCategoriaIptc(initialData.categoria_iptc ?? "");
      setFuentesRss((initialData.fuentes_rss ?? []).join(", "));
      setCronExpression("0 * * * *");
      setFormError(null);
      setRecommendations([]);
      setHasFetchedRecommendations(false);
      return;
    }

    setName("");
    setDescriptors("");
    setCategoriaIptc("");
    setFuentesRss("");
    setCronExpression("0 * * * *");
    setFormError(null);
    setRecommendations([]);
    setHasFetchedRecommendations(false);
  }, [isOpen, initialData]);

  const fetchRecommendations = async () => {
    if (!name.trim()) {
      setRecommendations([]);
      setHasFetchedRecommendations(false);
      return;
    }

    try {
      const response = await fetch(
        `${API_BASE_URL}/api/v1/alerts/keyword-recommendations?keyword=${encodeURIComponent(name)}`,
      );

      if (!response.ok) {
        throw new Error("Error fetching keyword recommendations");
      }

      const data = await response.json();

      const backendRecommendations = Array.isArray(data)
        ? data
            .filter((item): item is string => typeof item === "string")
            .map((item) => item.trim())
            .filter((item) => item !== "")
        : [];

      const existingDescriptors = new Set(
        parseDescriptors(descriptors).map((item) => item.toLowerCase()),
      );

      const filteredRecommendations = backendRecommendations.filter(
        (item) => !existingDescriptors.has(item.toLowerCase()),
      );

      setRecommendations(filteredRecommendations);
      setHasFetchedRecommendations(true);
    } catch (error) {
      const errorMessage =
        error instanceof Error ? error.message : "Error desconocido";
      setFormError(`No se pudieron obtener recomendaciones: ${errorMessage}`);
      setRecommendations([]);
      setHasFetchedRecommendations(false);
    }
  };

  const acceptRecommendation = (word: string) => {
    setDescriptors((prev) => {
      const descriptorArray = parseDescriptors(prev);
      descriptorArray.push(word);
      return descriptorArray.join(", ");
    });

    setRecommendations((prev) =>
      prev.filter(
        (recommendation) => recommendation.toLowerCase() !== word.toLowerCase(),
      ),
    );
  };

  const rejectRecommendation = (word: string) => {
    setRecommendations((prev) =>
      prev.filter((recommendation) => recommendation !== word),
    );
  };

  if (!isOpen) return null;

  const handleSubmit = async (e: React.SyntheticEvent) => {
    e.preventDefault();

    setFormError(null);

    if (!categoriaIptc.trim()) {
      setFormError("Debes seleccionar una categoria IPTC.");
      return;
    }

    if (!cronExpression.trim()) {
      setFormError("La expresion cron es obligatoria.");
      return;
    }

    if (!isValidCronExpression(cronExpression)) {
      setFormError(
        "La expresion cron no es valida. Usa 5 campos separados por espacios.",
      );
      return;
    }

    const descriptoresArray = parseDescriptors(descriptors);

    const fuentesRssArray = parseDescriptors(fuentesRss);

    const payload: AlertFormPayload = {
      name: name,
      descriptors: descriptoresArray,
      categoria_iptc: categoriaIptc,
      fuentes_rss: fuentesRssArray,
      cron_expression: cronExpression,
    };

    try {
      setIsSubmitting(true);
      const token = globalThis.localStorage.getItem("token");
      const userId = globalThis.localStorage.getItem("userId");

      if (!token || !userId) {
        throw new Error("Sesión no disponible para guardar la alerta");
      }

      const endpoint = initialData
        ? `${API_BASE_URL}/api/v1/users/${userId}/alerts/${initialData.id}`
        : `${API_BASE_URL}/api/v1/users/${userId}/alerts`;

      const response = await fetch(endpoint, {
        method: initialData ? "PUT" : "POST",
        headers: {
          Authorization: `Bearer ${token}`,
          "Content-Type": "application/json",
        },
        body: JSON.stringify(payload),
      });

      if (!response.ok) {
        throw new Error("Error al guardar la alerta");
      }

      await onSubmit(payload);

      // Limpiar campos para la próxima vez
      setName("");
      setDescriptors("");
      setCategoriaIptc("");
      setFuentesRss("");
      setCronExpression("0 * * * *");
      setFormError(null);
      setRecommendations([]);
      setHasFetchedRecommendations(false);
    } catch (error) {
      const errorMessage =
        error instanceof Error ? error.message : "Error desconocido";
      setFormError(`No se pudo guardar la alerta: ${errorMessage}`);
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <div className="modal-overlay">
      <div className="modal-content">
        <div className="modal-header">
          <h2>{initialData ? "EDITAR ALERTA" : "CREAR NUEVA ALERTA"}</h2>
          <button onClick={onClose} className="modal-close-btn" title="Cerrar">
            <X size={24} />
          </button>
        </div>

        <form onSubmit={handleSubmit} className="modal-body">
          {formError && (
            <div
              className="alert-feedback alert-feedback-error"
              role="alert"
              aria-live="assertive"
            >
              {formError}
            </div>
          )}

          <div className="form-group">
            <label htmlFor="alertName">NOMBRE DE LA ALERTA</label>
            <input
              id="alertName"
              type="text"
              className="form-input"
              required
              placeholder="Ej: TENDENCIAS TECH 2026"
              value={name}
              onChange={(e) => setName(e.target.value)}
            />
            <button
              type="button"
              className="btn-secondary"
              onClick={fetchRecommendations}
              disabled={isSubmitting}
            >
              Sugerir Descriptores
            </button>
          </div>

          <div className="form-group">
            <label htmlFor="alertDescriptors">
              DESCRIPTORES (SEPARADOS POR COMA)
            </label>
            <input
              id="alertDescriptors"
              type="text"
              className="form-input"
              required
              placeholder="Ej: IA, ROBÓTICA, CHIPS"
              value={descriptors}
              onChange={(e) => setDescriptors(e.target.value)}
            />
            {(recommendations.length > 0 || hasFetchedRecommendations) && (
              <div className="recommendations-block">
                <p>Sugerencias:</p>
                {recommendations.length > 0 ? (
                  <div className="recommendations-list">
                    {recommendations.map((word) => (
                      <div key={word} className="recommendation-chip">
                        <span>{word}</span>
                        <button
                          type="button"
                          aria-label={`Aceptar recomendación ${word}`}
                          onClick={() => acceptRecommendation(word)}
                          className="recommendation-icon-btn"
                        >
                          <Check size={14} color="green" />
                        </button>
                        <button
                          type="button"
                          aria-label={`Rechazar recomendación ${word}`}
                          onClick={() => rejectRecommendation(word)}
                          className="recommendation-icon-btn"
                        >
                          <X size={14} color="red" />
                        </button>
                      </div>
                    ))}
                  </div>
                ) : (
                  <p className="form-hint-text">No hay sugerencias nuevas.</p>
                )}
              </div>
            )}
          </div>

          <div className="form-group">
            <label htmlFor="alertIptcCategory">CATEGORIA IPTC (NIVEL 1)</label>
            <select
              id="alertIptcCategory"
              className="form-input"
              required
              value={categoriaIptc}
              onChange={(e) => setCategoriaIptc(e.target.value)}
            >
              <option value="" disabled>
                Selecciona una categoria
              </option>
              {IPTC_LEVEL_1_CATEGORIES.map((category) => (
                <option key={category} value={category}>
                  {category}
                </option>
              ))}
            </select>
          </div>

          <div className="form-group">
            <label htmlFor="alertRssSources">
              FUENTES / CANALES RSS (OPCIONAL)
            </label>
            <input
              id="alertRssSources"
              type="text"
              className="form-input"
              placeholder="Ej: ElPais, BBC, Reuters"
              value={fuentesRss}
              onChange={(e) => setFuentesRss(e.target.value)}
            />
            <p className="form-hint-text">
              Si lo dejas vacio, se aplicaran todas las fuentes de la categoria
              seleccionada.
            </p>
          </div>

          <div className="form-group">
            <label htmlFor="alertCronExpression">EXPRESION CRON</label>
            <input
              id="alertCronExpression"
              type="text"
              className="form-input"
              required
              placeholder="0 * * * *"
              value={cronExpression}
              onChange={(e) => setCronExpression(e.target.value)}
            />
          </div>

          <div className="modal-footer">
            <button
              type="button"
              className="btn-secondary"
              onClick={onClose}
              disabled={isSubmitting}
            >
              CANCELAR
            </button>
            <button
              type="submit"
              className="btn-submit"
              disabled={isSubmitting}
            >
              {isSubmitting ? (
                <span className="btn-submit-loading">
                  <span className="btn-spinner" aria-hidden="true" />
                  <span> GUARDANDO...</span>
                </span>
              ) : (
                "GUARDAR ALERTA"
              )}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
};
