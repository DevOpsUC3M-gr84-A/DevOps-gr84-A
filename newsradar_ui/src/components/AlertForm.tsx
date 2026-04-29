import React, { useEffect, useState } from "react";
import { Check, X } from "lucide-react";

const API_BASE_URL =
  import.meta.env.VITE_API_BASE_URL ?? "http://localhost:8000";

export interface AlertFormPayload {
  name: string;
  descriptors: string[];
  categories: AlertCategoryPayload[];
  information_sources_ids: string[];
  rss_channels_ids: string[];
  cron_expression: string;
}

export interface AlertCategoryOption {
  id: number | string;
  name?: string;
  iptc_code?: string | null;
  iptc_label?: string | null;
}

export interface AlertCategoryPayload {
  id: number;
  name: string;
  iptc_code: string;
}

export interface AlertCategoryLike {
  id?: number | string;
  name?: string;
  code?: string;
  iptc_code?: string | null;
  iptc_label?: string | null;
}

export interface AlertTableItem {
  id: number;
  nombre: string;
  descriptores: string;
  categories: Array<string | AlertCategoryLike>;
  information_sources_ids: string[];
}

interface AlertFormProps {
  isOpen: boolean;
  onClose: () => void;
  initialData?: AlertTableItem | null;
  categories?: AlertCategoryOption[];
  onSubmit: (datos: AlertFormPayload) => Promise<void> | void;
}

export const AlertForm: React.FC<AlertFormProps> = ({
  isOpen,
  onClose,
  initialData,
  categories = [],
  onSubmit,
}) => {
  const IPTC_MAP: Record<string, string> = {
    "00000000": "General",
    "01000000": "Arte y Cultura",
    "04000000": "Economía",
    "04010000": "Economía",
    "06000000": "Medio Ambiente",
    "07000000": "Salud",
    "08000000": "Tecnología",
    "11000000": "Política",
    "13000000": "Ciencia",
    "14000000": "Deportes",
    "15000000": "Deportes",
  };

  const [name, setName] = useState("");
  const [descriptors, setDescriptors] = useState("");
  const [selectedCategoriesIds, setSelectedCategoriesIds] = useState<string[]>([]);
  const [informationSourcesIds, setInformationSourcesIds] = useState("");
  const [cronExpression, setCronExpression] = useState("0 * * * *");
  const [recommendations, setRecommendations] = useState<string[]>([]);
  const [hasFetchedRecommendations, setHasFetchedRecommendations] =
    useState(false);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [formError, setFormError] = useState<string | null>(null);

  const rawCategoryOptions =
    categories.length > 0
      ? categories
      : Object.entries(IPTC_MAP).map(([code, label], index) => ({
          id: index + 1,
          name: label,
          iptc_code: code,
          iptc_label: label,
        }));

  // Filtra opciones para que no haya nombres repetidos (mantiene la primera ocurrencia por name)
  const categoryOptions = (() => {
    const seen = new Set<string>();
    return rawCategoryOptions.filter((category) => {
      const label = String(category.name ?? category.iptc_label ?? "").trim().toLowerCase();
      if (!label || seen.has(label)) {
        return false;
      }
      seen.add(label);
      return true;
    });
  })();

    const normalizeCategoryText = (value: string): string =>
      value
        .normalize("NFD")
        .replace(/\p{Diacritic}/gu, "")
        .trim()
        .toLowerCase();

    const resolveCategoryCode = (value: string): string => {
      const normalizedValue = value.trim();
      if (!normalizedValue) {
        return "";
      }

      const directMatch = categoryOptions.find(
        (category) => String(category.iptc_code ?? "").trim() === normalizedValue,
      );
      if (directMatch?.iptc_code) {
        return directMatch.iptc_code;
      }

      const labelMatch = categoryOptions.find(
        (category) =>
          normalizeCategoryText(String(category.name ?? category.iptc_label ?? "")) ===
          normalizeCategoryText(normalizedValue),
      );
      return labelMatch?.iptc_code ?? normalizedValue;
    };

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
      // initialData may store categories as comma separated, array of strings, or array of objects
      const initCatsRaw = (initialData as any)?.categories ?? (initialData as any)?.categoria_iptc;
      let initCats: string[] = [];
      if (Array.isArray(initCatsRaw)) {
        initCats = initCatsRaw
          .map((entry: any) => {
            if (entry === null || entry === undefined) return "";
            if (typeof entry === "string") return resolveCategoryCode(entry);
            const codeCandidate =
              entry.code ?? entry.iptc_code ?? entry.name ?? entry.label ?? "";
            return resolveCategoryCode(String(codeCandidate));
          })
          .filter((code) => code !== "");
      } else if (typeof initCatsRaw === "string" && initCatsRaw.trim()) {
        initCats = initCatsRaw
          .split(",")
          .map((s: string) => resolveCategoryCode(s))
          .filter((code) => code !== "");
      }
      setSelectedCategoriesIds(initCats);
      const initSources = (initialData as any)?.information_sources_ids ?? (initialData as any)?.rss_channels_ids ?? [];
      setInformationSourcesIds(
        Array.isArray(initSources) ? initSources.join(", ") : String(initSources ?? ""),
      );
      setCronExpression("0 * * * *");
      setFormError(null);
      setRecommendations([]);
      setHasFetchedRecommendations(false);
      return;
    }

    setName("");
    setDescriptors("");
    setSelectedCategoriesIds([]);
    setInformationSourcesIds("");
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
      // 1. Construimos la URL de forma segura usando la API nativa
      const requestUrl = new URL(
        "/api/v1/alerts/keyword-recommendations",
        API_BASE_URL,
      );

      // 2. Añadimos el parámetro (la API nativa ya se encarga de codificarlo de forma segura)
      requestUrl.searchParams.set("keyword", name);

      // 3. Hacemos el fetch
      const response = await fetch(requestUrl.toString());

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

    if (!selectedCategoriesIds || selectedCategoriesIds.length === 0) {
      setFormError("Debes seleccionar al menos una categoria IPTC.");
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

    const informationSourcesArray = parseDescriptors(informationSourcesIds);

    const formData = {
      name: name,
      descriptors: descriptoresArray,
      information_sources_ids: informationSourcesArray,
      rss_channels_ids: informationSourcesArray,
      cron_expression: cronExpression,
    };

    const categoriesToSave = selectedCategoriesIds
      .map((id) => categoryOptions.find((c) => c.iptc_code === id))
      .filter(Boolean)
      .map((category) => ({
        id: Number((category as AlertCategoryOption).id),
        name:
          String((category as AlertCategoryOption).name ?? "").trim() ||
          String((category as AlertCategoryOption).iptc_label ?? "").trim() ||
          String((category as AlertCategoryOption).iptc_code ?? "").trim(),
        iptc_code: String((category as AlertCategoryOption).iptc_code ?? "").trim(),
      }))
      .filter(
        (category): category is AlertCategoryPayload =>
          Number.isFinite(category.id) &&
          category.name !== "" &&
          category.iptc_code !== "",
      );

    const payload: AlertFormPayload = {
      ...formData,
      categories: categoriesToSave,
    };

    try {
      setIsSubmitting(true);
      await onSubmit(payload);

      // Limpiar campos para la próxima vez
      setName("");
      setDescriptors("");
      setSelectedCategoriesIds([]);
      setInformationSourcesIds("");
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
              multiple
              value={selectedCategoriesIds}
              onChange={(e) => {
                const opts = Array.from(e.target.selectedOptions).map((o) => o.value);
                setSelectedCategoriesIds(opts);
              }}
            >
              {categoryOptions.map((category) => {
                const code = String(category.iptc_code ?? category.id ?? "");
                const label = String(
                  category.name ?? category.iptc_label ?? code,
                );
                return (
                  <option key={code || label} value={code}>
                    {label}
                  </option>
                );
              })}
            </select>
            <p className="form-hint-text">Mantén pulsada Ctrl / Cmd para seleccionar varias.</p>
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
              value={informationSourcesIds}
              onChange={(e) => setInformationSourcesIds(e.target.value)}
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
