import { useCallback, useEffect, useMemo, useState } from "react";
import { Pencil, Plus, RefreshCw, Trash2, X } from "lucide-react";
import { useAuth } from "../hooks/useAuth";
import "./SourcesRss.css";

const API_BASE_URL = (
  import.meta.env.VITE_API_BASE_URL || "http://localhost:8000"
).replace(/\/$/, "");

interface InformationSourceApiItem {
  id: number;
  name: string;
  url: string;
}

interface RssChannelApiItem {
  id: number;
  information_source_id: number;
  url: string;
  category_id: number | null;
  iptc_category: string;
  media_name?: string;
}

interface CategoryApiItem {
  id: number;
  name: string;
  source?: string;
  iptc_code?: string | null;
  iptc_label?: string | null;
}

interface ChannelCategorySource {
  category_id?: number | null;
  categoria_id?: number | null;
  categoria_iptc?: string | null;
  iptc_category?: string | null;
  category?: string | null;
  url?: string;
  feed_url?: string;
  rss_url?: string;
  link?: string;
}

const SLUG_TO_IPTC: Record<string, string> = {
  artes_cultura_entretenimiento_y_medios: "01000000",
  arts_culture_entertainment_and_media: "01000000",
  catastrofes_y_accidentes: "03000000",
  crime_law_and_justice: "02000000",
  cultura: "01000000",
  disaster_and_accident: "03000000",
  economia: "04000000",
  economy_business_and_finance: "04000000",
  education: "05000000",
  environment: "06000000",
  ciencia_y_tecnologia: "13000000",
  health: "07000000",
  human_interest: "08000000",
  interes_humano: "08000000",
  labor: "09000000",
  lifestyle_and_leisure: "10000000",
  mano_de_obra: "09000000",
  medio_ambiente: "06000000",
  meteorologia: "17000000",
  policia_y_justicia: "02000000",
  politics: "11000000",
  politica: "11000000",
  religion_and_belief: "12000000",
  religion_y_culto: "12000000",
  science_and_technology: "13000000",
  society: "14000000",
  sociedad: "14000000",
  sport: "15000000",
  sports: "15000000",
  deporte: "15000000",
  tecnologia: "04010000",
  unrest_conflicts_and_war: "16000000",
  conflicto_guerra_y_paz: "16000000",
  weather: "17000000",
};

const normalizeIptcSlug = (raw: unknown): string => {
  const value = String(raw ?? "").trim();

  if (!value) {
    return "";
  }

  if (/^\d{8}$/.test(value)) {
    return value;
  }

  const withoutPrefix = value.replace(/^medtop:/i, "");
  const normalized = withoutPrefix
    .normalize("NFD")
    .replace(/\p{Diacritic}/gu, "")
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "_")
    .replace(/^_+|_+$/g, "")
    .replace(/_+/g, "_");

  return SLUG_TO_IPTC[normalized] ?? normalized;
};

const getChannelRawCategoryValue = (channel: ChannelCategorySource): string => {
  const rawCategory =
    channel.categoria_iptc ?? channel.iptc_category ?? channel.category ?? "";

  if (typeof rawCategory === "string" && rawCategory.trim()) {
    return rawCategory.trim();
  }

  const urlCandidates = [channel.url, channel.feed_url, channel.rss_url, channel.link];
  const explicitUrl = urlCandidates.find(
    (value) => typeof value === "string" && value.trim(),
  );

  if (explicitUrl) {
    return explicitUrl.trim();
  }

  const possibleUrl = Object.values(channel).find(
    (val): val is string => typeof val === "string" && val.includes("http"),
  );

  return possibleUrl ?? "";
};

const findChannelCategory = (
  channel: ChannelCategorySource,
  categories: CategoryApiItem[],
): CategoryApiItem | null => {
  const directMatch = categories.find(
    (item) => item.id === channel.category_id || item.id === channel.categoria_id,
  );

  if (directMatch) {
    return directMatch;
  }

  let categoryValue = getChannelRawCategoryValue(channel);

  if (!categoryValue || /^(null|none|undefined)$/i.test(categoryValue)) {
    return null;
  }

  const urlMatch = categoryValue.match(/iptc=([^&]+)/i);
  if (urlMatch) {
    categoryValue = urlMatch[1];
  }

  const normalizedCode = normalizeIptcSlug(categoryValue);

  return (
    categories.find(
      (item) =>
        item.iptc_code === normalizedCode ||
        item.iptc_code === categoryValue.trim() ||
        String(item.id) === normalizedCode,
    ) ?? null
  );
};

interface SourcesRssFeedback {
  type: "success" | "error";
  message: string;
}

interface SourceFormState {
  name: string;
  url: string;
}

interface ChannelFormState {
  sourceId: string;
  url: string;
  categoryId: string;
}

const getErrorMessage = (error: unknown): string => {
  if (error instanceof Error) {
    return error.message;
  }

  return "Error desconocido";
};

const IPTC_MAP: Record<string, string> = {
  "00000000": "Sin categoría",
  "01000000": "Artes, cultura, entretenimiento y medios",
  "02000000": "Policía y justicia",
  "03000000": "Catástrofes y accidentes",
  "04000000": "Economía, negocios y finanzas",
  "04010000": "Economía, negocios y finanzas",
  "05000000": "Educación",
  "06000000": "Medio ambiente",
  "07000000": "Salud",
  "08000000": "Interés humano, animales, insólito",
  "09000000": "Mano de obra",
  "10000000": "Estilo de vida y tiempo libre",
  "11000000": "Política",
  "12000000": "Religión y culto",
  "13000000": "Ciencia y tecnología",
  "14000000": "Sociedad",
  "15000000": "Deporte",
  "16000000": "Conflicto, guerra y paz",
  "17000000": "Meteorología",
};

const getChannelCategoryLabel = (
  channel: ChannelCategorySource,
  categories: CategoryApiItem[],
): string => {
  const matched = findChannelCategory(channel, categories);

  if (matched) {
    return matched.iptc_label ?? matched.name;
  }

  const fallbackCode = normalizeIptcSlug(getChannelRawCategoryValue(channel));
  return IPTC_MAP[fallbackCode] ?? "Sin categoría";
};

const isHttpUrl = (value: string): boolean => {
  try {
    const parsedUrl = new URL(value);
    return parsedUrl.protocol === "http:" || parsedUrl.protocol === "https:";
  } catch {
    return false;
  }
};

const getCategoryLabel = (
  category: CategoryApiItem | undefined,
  fallback?: string | null,
): string => {
  if (category) {
    return category.iptc_label ?? category.name;
  }

  return fallback ?? "Sin categoría";
};

const formatValidationDetailEntry = (item: unknown): string => {
  if (!item || typeof item !== "object") {
    return "";
  }

  const entry = item as { loc?: unknown; msg?: unknown };
  const field = Array.isArray(entry.loc)
    ? entry.loc.filter((v) => v !== "body").join(".")
    : "";
  const msg = typeof entry.msg === "string" ? entry.msg : "";
  return field ? `${field}: ${msg}` : msg;
};

const formatDetailValue = (detail: unknown): string => {
  if (typeof detail === "string") {
    return detail;
  }

  if (!Array.isArray(detail)) {
    return "";
  }

  const messages = detail.map(formatValidationDetailEntry).filter(Boolean);
  return messages.length > 0 ? messages.join("; ") : "";
};

const isDetailResponse = (value: unknown): value is { detail?: unknown } => {
  return typeof value === "object" && value !== null && "detail" in value;
};

const extractApiDetail = async (
  response: Response,
  fallbackMessage: string,
): Promise<string> => {
  try {
    const data: unknown = await response.json();

    if (isDetailResponse(data)) {
      const formatted = formatDetailValue(data.detail);
      if (formatted) {
        return formatted;
      }
    }
  } catch {
    // Se conserva el mensaje de respaldo si la API no devuelve JSON.
  }

  return response.statusText || fallbackMessage;
};

const requestJson = async <T,>(
  url: string,
  token: string | null,
  options: RequestInit,
  onUnauthorized: () => void,
): Promise<T> => {
  if (!token) {
    throw new Error("No hay sesión activa.");
  }

  try {
    const response = await fetch(url, {
      ...options,
      headers: {
        Authorization: `Bearer ${token}`,
        ...options.headers,
      },
    });

    if (response.status === 401) {
      onUnauthorized();
      throw new Error("Sesión expirada. Vuelve a iniciar sesión.");
    }

    if (!response.ok) {
      const detail = await extractApiDetail(
        response,
        "Error al procesar la solicitud",
      );
      throw new Error(detail);
    }

    return (await response.json()) as T;
  } catch (error) {
    console.error("Fetch failed:", { url, error, token: token ? "present" : "missing" });
    throw error;
  }
};

const requestVoid = async (
  url: string,
  token: string | null,
  options: RequestInit,
  onUnauthorized: () => void,
): Promise<void> => {
  if (!token) {
    throw new Error("No hay sesión activa.");
  }

  const response = await fetch(url, {
    ...options,
    headers: {
      Authorization: `Bearer ${token}`,
      ...options.headers,
    },
  });

  if (response.status === 401) {
    onUnauthorized();
    throw new Error("Sesión expirada. Vuelve a iniciar sesión.");
  }

  if (!response.ok) {
    const detail = await extractApiDetail(
      response,
      "Error al procesar la solicitud",
    );
    throw new Error(detail);
  }
};

interface SubmitChannelSaveRequestArgs {
  endpoint: string;
  method: "POST" | "PUT";
  token: string | null;
  payload: Record<string, string | number>;
  onUnauthorized: () => void;
}

const submitChannelSaveRequest = async ({
  endpoint,
  method,
  token,
  payload,
  onUnauthorized,
}: SubmitChannelSaveRequestArgs): Promise<void> => {
  if (!token) {
    throw new Error("No hay sesión activa.");
  }

  const response = await fetch(endpoint, {
    method,
    headers: {
      Authorization: `Bearer ${token}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify(payload),
  });

  if (response.status === 401) {
    onUnauthorized();
    throw new Error("Sesión expirada. Vuelve a iniciar sesión.");
  }

  if (response.status === 409) {
    throw new Error("Este canal RSS ya existe.");
  }

  if (response.status === 422) {
    const detail = await extractApiDetail(
      response,
      "Datos no válidos para el canal RSS.",
    );
    throw new Error(`Datos no válidos: ${detail}`);
  }

  if (!response.ok) {
    const detail = await extractApiDetail(
      response,
      "Error al procesar la solicitud",
    );
    throw new Error(detail);
  }
};


interface CategoryFilterCheckboxProps {
  optionKey: string;
  label: string;
  isChecked: boolean;
  onToggle: (key: string) => void;
}

const CategoryFilterCheckbox = ({
  optionKey,
  label,
  isChecked,
  onToggle,
}: CategoryFilterCheckboxProps) => {
  const handleChange = useCallback(() => onToggle(optionKey), [onToggle, optionKey]);

  return (
    <label className="sources-rss-category-checkbox">
      <input type="checkbox" checked={isChecked} onChange={handleChange} />
      <span>{label}</span>
    </label>
  );
};

export const SourcesRss = () => {
  const { token, logout } = useAuth();
  const [sources, setSources] = useState<InformationSourceApiItem[]>([]);
  const [channels, setChannels] = useState<RssChannelApiItem[]>([]);
  const [categories, setCategories] = useState<CategoryApiItem[]>([]);
  const [selectedSourceId, setSelectedSourceId] = useState<number | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [feedback, setFeedback] = useState<SourcesRssFeedback | null>(null);
  const [activeModal, setActiveModal] = useState<"source" | "channel" | null>(null);
  const [sourceBeingEdited, setSourceBeingEdited] = useState<InformationSourceApiItem | null>(null);
  const [channelBeingEdited, setChannelBeingEdited] = useState<RssChannelApiItem | null>(null);
  const [selectedChannel, setSelectedChannel] = useState<RssChannelApiItem | null>(null);
  const [sourceForm, setSourceForm] = useState<SourceFormState>({ name: "", url: "" });
  const [channelForm, setChannelForm] = useState<ChannelFormState>({
    sourceId: "",
    url: "",
    categoryId: "",
  });
  const [tempCategoryId, setTempCategoryId] = useState<string>("");
  const [searchTerm, setSearchTerm] = useState<string>("");
  const [selectedCategories, setSelectedCategories] = useState<string[]>([]);

  const selectedSource = useMemo(() => {
    if (selectedSourceId === null) {
      return sources[0];
    }

    return sources.find((source) => source.id === selectedSourceId);
  }, [selectedSourceId, sources]);

  const filteredSources = useMemo(() => {
    if (!searchTerm.trim()) {
      return sources;
    }

    const lowerSearchTerm = searchTerm.toLowerCase();
    return sources.filter(
      (source) =>
        source.name.toLowerCase().includes(lowerSearchTerm) ||
        source.url.toLowerCase().includes(lowerSearchTerm),
    );
  }, [sources, searchTerm]);

  const selectedSourceChannels = useMemo(() => {
    if (!selectedSource) {
      return [];
    }

    return channels.filter(
      (channel) =>
        Number.parseInt(String(channel.information_source_id), 10) ===
        Number.parseInt(String(selectedSource.id), 10),
    );
  }, [channels, selectedSource]);

  const getChannelCategoryKey = useCallback(
    (ch: RssChannelApiItem) => {
      const matched = findChannelCategory(ch, categories);

      if (matched) {
        return matched.id ? `id:${matched.id}` : `iptc:${matched.iptc_code ?? ""}`;
      }

      if (ch.category_id) {
        return `id:${ch.category_id}`;
      }

      if (ch.iptc_category) {
        return `iptc:${ch.iptc_category}`;
      }

      return "none";
    },
    [categories],
  );

  const filteredChannels = useMemo(() => {
    if (!selectedSource) {
      return [];
    }

    if (!selectedCategories || selectedCategories.length === 0) {
      return selectedSourceChannels;
    }

    return selectedSourceChannels.filter((channel) => {
      console.log("DEBUG Filtro:", channel, selectedSource);

      return (
        String(channel.information_source_id) === String(selectedSource.id) &&
        selectedCategories.includes(getChannelCategoryKey(channel))
      );
    });
  }, [getChannelCategoryKey, selectedCategories, selectedSource, selectedSourceChannels]);

  const uniqueCategories = useMemo(() => {
    const map = new Map<string, string>();

    selectedSourceChannels.forEach((ch) => {
      const matched = findChannelCategory(ch, categories);
      const label = getChannelCategoryLabel(ch, categories);

      let key: string;

      if (matched) {
        key = matched.id ? `id:${matched.id}` : `iptc:${matched.iptc_code ?? ""}`;
      } else if (ch.category_id) {
        key = `id:${ch.category_id}`;
      } else if (ch.iptc_category) {
        key = `iptc:${ch.iptc_category}`;
      } else {
        key = "none";
      }

      if (!map.has(key)) {
        map.set(key, label);
      }
    });

    return Array.from(map.entries()).map(([key, label]) => ({ key, label }));
  }, [selectedSourceChannels, categories]);

  const closeModal = () => {
    setActiveModal(null);
    setSourceBeingEdited(null);
    setChannelBeingEdited(null);
    setSelectedChannel(null);
    setTempCategoryId("");
    setSourceForm({ name: "", url: "" });
    setChannelForm({ sourceId: "", url: "", categoryId: "" });
  };

  const runSaveOperation = useCallback(
    async (operation: () => Promise<void>, successMessage: string) => {
      try {
        await operation();
        setFeedback({ type: "success", message: successMessage });
        closeModal();
      } catch (error) {
        setFeedback({ type: "error", message: getErrorMessage(error) });
      }
    },
    [],
  );

  const loadSourcesAndChannels = useCallback(async () => {
    setIsLoading(true);
    console.log("Loading sources and channels from:", {
      apiBaseUrl: API_BASE_URL,
      urls: [
        `${API_BASE_URL}/api/v1/information-sources`,
        `${API_BASE_URL}/api/v1/rss-channels`,
        `${API_BASE_URL}/api/v1/categories`,
      ],
    });

    try {
      const [sourcesData, channelsData, categoriesData] = await Promise.all([
        requestJson<InformationSourceApiItem[]>(
          `${API_BASE_URL}/api/v1/information-sources`,
          token,
          {},
          logout,
        ),
        requestJson<RssChannelApiItem[]>(
          `${API_BASE_URL}/api/v1/rss-channels?limit=1000`,
          token,
          {},
          logout,
        ),
        requestJson<CategoryApiItem[]>(
          `${API_BASE_URL}/api/v1/categories`,
          token,
          {},
          logout,
        ),
      ]);

      setSources(sourcesData);
      setChannels(channelsData);
      setCategories(categoriesData);
      console.log("Successfully loaded data:", { sourcesData, channelsData, categoriesData });
    } catch (error) {
      console.error("Failed to load sources and channels:", error);
      setFeedback({
        type: "error",
        message: `No se pudieron cargar las fuentes y canales RSS: ${getErrorMessage(error)}`,
      });
    } finally {
      setIsLoading(false);
    }
  }, [logout, token]);

  useEffect(() => {
    if (!token) {
      setIsLoading(false);
      return;
    }

    void loadSourcesAndChannels();
  }, [loadSourcesAndChannels, token]);

  useEffect(() => {
    if (selectedSourceId === null && sources.length > 0) {
      setSelectedSourceId(sources[0].id);
    }
  }, [selectedSourceId, sources]);

  useEffect(() => {
    if (!feedback) {
      return;
    }

    const timeoutId = globalThis.setTimeout(() => setFeedback(null), 5000);
    return () => globalThis.clearTimeout(timeoutId);
  }, [feedback]);

  const openCreateSourceModal = () => {
    setFeedback(null);
    setSourceBeingEdited(null);
    setSourceForm({ name: "", url: "" });
    setActiveModal("source");
  };

  const openEditSourceModal = (source: InformationSourceApiItem) => {
    setFeedback(null);
    setSourceBeingEdited(source);
    setSourceForm({ name: source.name, url: source.url });
    setActiveModal("source");
  };

  const openCreateChannelModal = () => {
    const sourceId = selectedSource!.id;

    setFeedback(null);
    setChannelBeingEdited(null);
    setSelectedChannel(null);
    setTempCategoryId("");
    setChannelForm({
      sourceId: sourceId.toString(),
      url: "",
      categoryId: "",
    });
    setActiveModal("channel");
  };

  const openEditChannelModal = (channel: RssChannelApiItem) => {
    setFeedback(null);
    setChannelBeingEdited(channel);
    setSelectedChannel(channel);
    setTempCategoryId(channel.category_id?.toString() ?? "");
    setChannelForm({
      sourceId: channel.information_source_id.toString(),
      url: channel.url,
      categoryId: channel.category_id?.toString() ?? "",
    });
    setActiveModal("channel");
  };

  const handleSourceDelete = useCallback(
    async (sourceId: number) => {
      if (!token) {
        setFeedback({
          type: "error",
          message: "No hay sesión activa para borrar la fuente.",
        });
        return;
      }

      try {
        await requestVoid(
          `${API_BASE_URL}/api/v1/information-sources/${sourceId}`,
          token,
          { method: "DELETE" },
          logout,
        );

        setSources((currentSources) => {
          const remainingSources = currentSources.filter((source) => source.id !== sourceId);

          if (selectedSourceId === sourceId) {
            setSelectedSourceId(remainingSources[0]?.id ?? null);
            setSelectedCategories([]);
          }

          return remainingSources;
        });
        setChannels((currentChannels) =>
          currentChannels.filter(
            (channel) => String(channel.information_source_id) !== String(sourceId),
          ),
        );
        setFeedback({ type: "success", message: "Fuente de información borrada correctamente." });
      } catch (error) {
        setFeedback({ type: "error", message: getErrorMessage(error) });
      }
    },
    [logout, selectedSourceId, token],
  );

  const handleChannelDelete = useCallback(
    async (channel: RssChannelApiItem) => {
      if (!token) {
        setFeedback({
          type: "error",
          message: "No hay sesión activa para borrar el canal RSS.",
        });
        return;
      }

      try {
        await requestVoid(
          `${API_BASE_URL}/api/v1/information-sources/${channel.information_source_id}/rss-channels/${channel.id}`,
          token,
          { method: "DELETE" },
          logout,
        );

        await loadSourcesAndChannels();
      } catch (error) {
        setFeedback({ type: "error", message: getErrorMessage(error) });
      }
    },
    [loadSourcesAndChannels, logout, token],
  );

  const clearFilters = () => {
    setSearchTerm("");
    setSelectedCategories([]);
  };

  const toggleCategoryFilter = useCallback((key: string) => {
    setSelectedCategories((prev) =>
      prev.includes(key)
        ? prev.filter((k) => k !== key)
        : [...prev, key],
    );
  }, []);

  const handleSourceSave = useCallback(async () => {
    if (!token) {
      setFeedback({
        type: "error",
        message: "No hay sesión activa para guardar la fuente.",
      });
      return;
    }

    const trimmedName = sourceForm.name.trim();
    const trimmedUrl = sourceForm.url.trim();

    if (!trimmedName) {
      setFeedback({
        type: "error",
        message: "El nombre de la fuente es obligatorio.",
      });
      return;
    }

    if (!isHttpUrl(trimmedUrl)) {
      setFeedback({
        type: "error",
        message:
          "La URL de la fuente debe ser una URL válida con protocolo http o https.",
      });
      return;
    }

    const payload = {
      name: trimmedName,
      url: trimmedUrl,
    };

    if (!token) {
      throw new Error("No hay sesión activa para guardar la fuente.");
    }

    await runSaveOperation(async () => {
      const savedSource = await requestJson<InformationSourceApiItem>(
        sourceBeingEdited
          ? `${API_BASE_URL}/api/v1/information-sources/${sourceBeingEdited.id}`
          : `${API_BASE_URL}/api/v1/information-sources`,
        token,
        {
          method: sourceBeingEdited ? "PUT" : "POST",
          headers: {
            "Content-Type": "application/json",
          },
          body: JSON.stringify(payload),
        },
        logout,
      );

      await loadSourcesAndChannels();
      setSelectedSourceId(savedSource.id);
    }, sourceBeingEdited
      ? "Fuente de información actualizada correctamente."
      : "Fuente de información creada correctamente.");
  }, [
    loadSourcesAndChannels,
    logout,
    runSaveOperation,
    sourceBeingEdited,
    sourceForm.name,
    sourceForm.url,
    token,
  ]);

  const persistChannelChanges = useCallback(
    async ({
      sourceId,
      endpoint,
      method,
      payload,
    }: {
      sourceId: number;
      endpoint: string;
      method: "POST" | "PUT";
      payload: Record<string, string | number>;
    }) => {
      await submitChannelSaveRequest({
        endpoint,
        method,
        token,
        payload,
        onUnauthorized: () => {
          globalThis.localStorage.clear();
          globalThis.location.assign("/login");
        },
      });

      await loadSourcesAndChannels();
      setSelectedChannel(null);
      setSelectedSourceId(sourceId);
    },
    [loadSourcesAndChannels, token],
  );

  const handleChannelSave = useCallback(async () => {
    const sourceId = Number(channelForm.sourceId);
    const trimmedUrl = channelForm.url.trim();
    const categoryIdValue = channelBeingEdited ? tempCategoryId : channelForm.categoryId;
    const selectedCategoryId = Number(categoryIdValue);
    const source = sources.find((item) => item.id === sourceId);
    const selectedCategory = categories.find((item) => item.id === selectedCategoryId);

    if (!Number.isInteger(sourceId) || !source) {
      setFeedback({
        type: "error",
        message: "Debes seleccionar una fuente válida para el canal RSS.",
      });
      return;
    }

    if (!isHttpUrl(trimmedUrl)) {
      setFeedback({
        type: "error",
        message:
          "La URL del feed debe ser una URL válida con protocolo http o https.",
      });
      return;
    }

    if (!Number.isInteger(selectedCategoryId) || !selectedCategory) {
      setFeedback({
        type: "error",
        message: "Debes seleccionar una categoría IPTC válida.",
      });
      return;
    }

    const mappedIptcCategory = String(
      selectedCategory.iptc_code ?? selectedCategoryId,
    );

    const payload: Record<string, string | number> = channelBeingEdited
      ? {
          url: trimmedUrl,
          category_id: selectedCategoryId,
          iptc_category: mappedIptcCategory,
        }
      : {
          media_name: source.name,
          url: trimmedUrl,
          category_id: selectedCategoryId,
          iptc_category: mappedIptcCategory,
        };

    const endpoint = channelBeingEdited
      ? `${API_BASE_URL}/api/v1/information-sources/${sourceId}/rss-channels/${channelBeingEdited.id}`
      : `${API_BASE_URL}/api/v1/information-sources/${sourceId}/rss-channels`;

    await runSaveOperation(
      () => persistChannelChanges({
        sourceId,
        endpoint,
        method: channelBeingEdited ? "PUT" : "POST",
        payload,
      }),
      channelBeingEdited
        ? "Canal RSS actualizado correctamente."
        : "Canal RSS creado correctamente.",
    );
  }, [
    categories,
    channelBeingEdited,
    tempCategoryId,
    channelForm.categoryId,
    channelForm.sourceId,
    channelForm.url,
    persistChannelChanges,
    runSaveOperation,
    sources,
    token,
  ]);

  const renderSourceRow = (source: InformationSourceApiItem) => {
    const isSelected = source.id === selectedSource?.id;

    return (
      <tr key={source.id} className={isSelected ? "is-selected" : ""}>
        <td>
          <button
            type="button"
            className="sources-rss-row-button"
            aria-pressed={isSelected}
            onClick={() => setSelectedSourceId(source.id)}
          >
            {source.name}
          </button>
        </td>
        <td>
          <a href={source.url} target="_blank" rel="noreferrer">
            {source.url}
          </a>
        </td>
        <td>
          <div className="sources-rss-row-actions">
            <button
              type="button"
              className="sources-rss-inline-button"
              onClick={() => openEditSourceModal(source)}
              aria-label={`Editar fuente ${source.name}`}
              title="Editar"
            >
              <Pencil size={14} />
            </button>
            <button
              type="button"
              className="sources-rss-inline-button sources-rss-danger-button"
              onClick={() => void handleSourceDelete(source.id)}
              aria-label={`Borrar fuente ${source.name}`}
              title="Borrar"
            >
              <Trash2 size={14} />
            </button>
          </div>
        </td>
      </tr>
    );
  };

  const renderChannelRow = (channel: RssChannelApiItem) => (
    <tr key={channel.id}>
      <td>
        <a href={channel.url} target="_blank" rel="noreferrer">
          {channel.url}
        </a>
      </td>
      <td>
        {getChannelCategoryLabel(channel, categories)}
      </td>
      <td>
        <div className="sources-rss-row-actions">
          <button
            type="button"
            className="sources-rss-inline-button"
            onClick={() => openEditChannelModal(channel)}
            aria-label={`Editar canal ${channel.url}`}
            title="Editar"
          >
            <Pencil size={14} />
          </button>
          <button
            type="button"
            className="sources-rss-inline-button sources-rss-danger-button"
            onClick={() => void handleChannelDelete(channel)}
            aria-label={`Borrar canal ${channel.url}`}
            title="Borrar"
          >
            <Trash2 size={14} />
          </button>
        </div>
      </td>
    </tr>
  );

  const renderSourcesPanelContent = () => {
    if (sources.length === 0) {
      return (
        <div className="sources-rss-empty-state">
          <p>No hay fuentes registradas todavía.</p>
        </div>
      );
    }

    if (filteredSources.length === 0) {
      return (
        <div className="sources-rss-empty-state">
          <p>No se encontraron fuentes que coincidan con tu búsqueda.</p>
        </div>
      );
    }

    return (
      <table className="sources-rss-table" aria-label="Listado de fuentes de información">
        <thead>
          <tr>
            <th>Nombre</th>
            <th>URL web</th>
            <th>Acciones</th>
          </tr>
        </thead>
        <tbody>{filteredSources.map(renderSourceRow)}</tbody>
      </table>
    );
  };

  const renderChannelsPanelContent = () => {
    if (selectedSource && selectedSourceChannels.length > 0) {
      return (
        <table className="sources-rss-table" aria-label="Canales RSS asociados">
          <thead>
            <tr>
              <th>URL del feed</th>
              <th>Categoría IPTC</th>
              <th>Acciones</th>
            </tr>
          </thead>
          <tbody>{filteredChannels.map(renderChannelRow)}</tbody>
        </table>
      );
    }

    const emptyMessage = selectedSource
      ? "Esta fuente todavía no tiene canales RSS asociados."
      : "Selecciona una fuente para administrar sus canales RSS.";

    return (
      <div className="sources-rss-empty-state">
        <p>{emptyMessage}</p>
      </div>
    );
  };

  const renderSourceModal = () => (
    <div className="sources-rss-modal-overlay">
      <dialog
        open
        className="sources-rss-dialog"
        aria-labelledby="sources-rss-source-title"
      >
        <div className="sources-rss-dialog-header">
          <div>
            <h2 id="sources-rss-source-title">
              {sourceBeingEdited
                ? "Editar fuente de información"
                : "Crear fuente de información"}
            </h2>
            <p>Define el medio principal y su web pública.</p>
          </div>
          <button
            type="button"
            className="sources-rss-icon-button"
            onClick={closeModal}
            aria-label="Cerrar modal de fuente"
          >
            <X size={18} />
          </button>
        </div>

        <form
          className="sources-rss-modal-form"
          onSubmit={(event) => {
            event.preventDefault();
            void handleSourceSave();
          }}
        >
          <div className="form-group">
            <label htmlFor="source-name">NOMBRE DE LA FUENTE</label>
            <input
              id="source-name"
              type="text"
              className="form-input"
              required
              maxLength={120}
              value={sourceForm.name}
              onChange={(event) =>
                setSourceForm((current) => ({ ...current, name: event.target.value }))
              }
              placeholder="Ej: Agencia Central"
            />
          </div>

          <div className="form-group">
            <label htmlFor="source-url">URL WEB</label>
            <input
              id="source-url"
              type="url"
              className="form-input"
              required
              value={sourceForm.url}
              onChange={(event) =>
                setSourceForm((current) => ({ ...current, url: event.target.value }))
              }
              placeholder="https://www.ejemplo.com"
            />
          </div>

          <div className="sources-rss-modal-actions">
            <button
              type="button"
              className="btn-secondary sources-rss-secondary-button"
              onClick={closeModal}
            >
              Cancelar
            </button>
            <button type="submit" className="btn-primary">
              {sourceBeingEdited ? "Guardar cambios" : "Crear fuente"}
            </button>
          </div>
        </form>
      </dialog>
    </div>
  );

  const renderChannelModal = () => {
    const currentSourceId = Number(channelForm.sourceId);
    const currentCategoryId = channelBeingEdited ? tempCategoryId : channelForm.categoryId;

    return (
      <div className="sources-rss-modal-overlay">
        <dialog
          key={selectedChannel?.id ?? "new-channel"}
          open
          className="sources-rss-dialog"
          aria-labelledby="sources-rss-channel-title"
        >
          <div className="sources-rss-dialog-header">
            <div>
              <h2 id="sources-rss-channel-title">
                {channelBeingEdited ? "Editar canal RSS" : "Crear canal RSS"}
              </h2>
              <p>Vincula el feed al medio y clasifícalo con una categoría IPTC.</p>
            </div>
            <button
              type="button"
              className="sources-rss-icon-button"
              onClick={closeModal}
              aria-label="Cerrar modal de canal"
            >
              <X size={18} />
            </button>
          </div>

          <form
            className="sources-rss-modal-form"
            onSubmit={(event) => {
              event.preventDefault();
              void handleChannelSave();
            }}
          >
            <div className="form-group">
              <label htmlFor="channel-source">FUENTE DE INFORMACIÓN</label>
              <select
                id="channel-source"
                className="form-input"
                required
                value={channelForm.sourceId}
                disabled={Boolean(channelBeingEdited)}
                onChange={(event) =>
                  setChannelForm((current) => ({ ...current, sourceId: event.target.value }))
                }
              >
                <option value="">Selecciona una fuente</option>
                {sources.map((source) => (
                  <option key={source.id} value={source.id}>
                    {source.name}
                  </option>
                ))}
              </select>
              {channelBeingEdited && (
                <p className="sources-rss-hint">
                  El canal se mantiene asociado a la fuente original.
                </p>
              )}
            </div>

            <div className="form-group">
              <label htmlFor="channel-url">URL DEL FEED RSS</label>
              <input
                id="channel-url"
                type="url"
                className="form-input"
                required
                value={channelForm.url}
                onChange={(event) =>
                  setChannelForm((current) => ({ ...current, url: event.target.value }))
                }
                placeholder="https://www.ejemplo.com/rss.xml"
              />
            </div>

            <div className="form-group">
              <label htmlFor="channel-category">CATEGORÍA IPTC</label>
              <select
                id="channel-category"
                className="form-input"
                required
                value={currentCategoryId}
                onChange={(event) => {
                  const value = event.target.value;

                  if (channelBeingEdited) {
                    setTempCategoryId(value);
                    return;
                  }

                  setChannelForm((current) => ({ ...current, categoryId: value }));
                }}
              >
                <option value="">Selecciona una categoría</option>
                {categories.map((category) => (
                  <option key={category.id} value={category.id}>
                    {getCategoryLabel(category)}
                  </option>
                ))}
              </select>
            </div>

            <div className="sources-rss-modal-actions">
              <button
                type="button"
                className="btn-secondary sources-rss-secondary-button"
                onClick={closeModal}
              >
                Cancelar
              </button>
              <button
                type="submit"
                className="btn-primary"
                disabled={!currentSourceId && !channelBeingEdited}
              >
                {channelBeingEdited ? "Guardar cambios" : "Crear canal"}
              </button>
            </div>
          </form>
        </dialog>
      </div>
    );
  };

  return (
    <main className="main-content sources-rss-page" aria-labelledby="sources-rss-title">
      <header className="page-heading sources-rss-header">
        <div>
          <h1 id="sources-rss-title" className="section-title">
            Fuentes RSS
          </h1>
          <p className="section-subtitle">
            Administra las fuentes de información y sus canales RSS asociados.
          </p>
        </div>

        <div className="sources-rss-header-actions">
          {(searchTerm.trim() !== "" || selectedCategories.length > 0) && (
            <button
              type="button"
              className="btn-secondary"
              onClick={clearFilters}
            >
              Limpiar Filtros
            </button>
          )}

          <button
            type="button"
            className="btn-secondary"
            onClick={() => void loadSourcesAndChannels()}
          >
            <RefreshCw size={16} />
            Recargar
          </button>
          
          <button type="button" className="btn-primary" onClick={openCreateSourceModal}>
            <Plus size={18} />
            Nueva fuente
          </button>
        </div>
      </header>

      {feedback && feedback.type === "error" && (
        <div
          className="alert-feedback alert-feedback-error"
          role="alert"
          aria-live="polite"
        >
          {feedback.message}
        </div>
      )}

      {feedback && feedback.type === "success" && (
        <output
          className="alert-feedback alert-feedback-success"
          aria-live="polite"
        >
          {feedback.message}
        </output>
      )}

      {isLoading ? (
        <output className="sources-rss-loading" aria-live="polite">
          <p>Cargando fuentes y canales RSS...</p>
        </output>
      ) : (
        <section className="sources-rss-grid" aria-label="Gestión de fuentes y canales RSS">
          <article className="sources-rss-panel">
            <div className="sources-rss-panel-header">
              <div>
                <h2>Fuentes de información</h2>
                <p>Selecciona una fuente para ver sus canales asociados.</p>
              </div>
              <span className="sources-rss-badge">{filteredSources.length} fuentes</span>
            </div>

            <div className="sources-rss-search-row">
              <input
                type="search"
                className="sources-rss-search-input"
                placeholder="Buscar por nombre o URL..."
                value={searchTerm}
                onChange={(event) => setSearchTerm(event.target.value)}
                aria-label="Buscar fuentes de información"
              />
            </div>

            {renderSourcesPanelContent()}
          </article>

          <article className="sources-rss-panel sources-rss-panel-highlight">
            <div className="sources-rss-panel-header">
              <div>
                <h2>Canales RSS asociados</h2>
                <p>
                  {selectedSource
                    ? `Canales vinculados a ${selectedSource.name}.`
                    : "Selecciona una fuente para ver sus canales."}
                </p>
              </div>
              <div className="sources-rss-panel-header-actions">
                <span className="sources-rss-badge">{filteredChannels.length} canales</span>
                <button
                  type="button"
                  className="btn-primary"
                  onClick={openCreateChannelModal}
                  disabled={!selectedSource}
                >
                  <Plus size={18} />
                  Nuevo canal
                </button>
              </div>
            </div>

            {uniqueCategories.length > 0 && (
              <div className="sources-rss-categories-filter">
                {uniqueCategories.map((opt) => (
                  <CategoryFilterCheckbox
                    key={opt.key}
                    optionKey={opt.key}
                    label={opt.label}
                    isChecked={selectedCategories.includes(opt.key)}
                    onToggle={toggleCategoryFilter}
                  />
                ))}
              </div>
            )}

            {renderChannelsPanelContent()}
          </article>
        </section>
      )}

      {activeModal === "source" && renderSourceModal()}
      {activeModal === "channel" && renderChannelModal()}
    </main>
  );
};
