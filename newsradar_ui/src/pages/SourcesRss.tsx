import { useCallback, useEffect, useMemo, useState } from "react";
import { Pencil, Plus, RefreshCw, X } from "lucide-react";
import { useAuth } from "../hooks/useAuth";
import "./SourcesRss.css";

const API_BASE_URL =
  import.meta.env.VITE_API_BASE_URL ?? "http://localhost:8000";

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

const extractApiDetail = async (
  response: Response,
  fallbackMessage: string,
): Promise<string> => {
  try {
    const data = (await response.json()) as { detail?: unknown } | unknown;

    if (data && typeof data === "object" && "detail" in data) {
      const detail = (data as { detail?: unknown }).detail;

      if (typeof detail === "string") {
        return detail;
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

  const response = await fetch(url, {
    ...options,
    headers: {
      Authorization: `Bearer ${token}`,
      ...(options.headers ?? {}),
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
  const [sourceForm, setSourceForm] = useState<SourceFormState>({ name: "", url: "" });
  const [channelForm, setChannelForm] = useState<ChannelFormState>({
    sourceId: "",
    url: "",
    categoryId: "",
  });

  const selectedSource = useMemo(() => {
    if (selectedSourceId === null) {
      return sources[0];
    }

    return sources.find((source) => source.id === selectedSourceId);
  }, [selectedSourceId, sources]);

  const selectedSourceChannels = useMemo(() => {
    if (!selectedSource) {
      return [];
    }

    return channels.filter(
      (channel) => channel.information_source_id === selectedSource.id,
    );
  }, [channels, selectedSource]);

  const closeModal = () => {
    setActiveModal(null);
    setSourceBeingEdited(null);
    setChannelBeingEdited(null);
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

    try {
      const [sourcesData, channelsData, categoriesData] = await Promise.all([
        requestJson<InformationSourceApiItem[]>(
          `${API_BASE_URL}/api/v1/information-sources`,
          token,
          {},
          logout,
        ),
        requestJson<RssChannelApiItem[]>(
          `${API_BASE_URL}/api/v1/rss-channels`,
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
    } catch (error) {
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
    setChannelForm({
      sourceId: channel.information_source_id.toString(),
      url: channel.url,
      categoryId: channel.category_id?.toString() ?? "",
    });
    setActiveModal("channel");
  };

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

  const handleChannelSave = useCallback(async () => {
    const sourceId = Number(channelForm.sourceId);
    const trimmedUrl = channelForm.url.trim();
    const selectedCategoryId = Number(channelForm.categoryId);
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

    const payload = channelBeingEdited
      ? {
          url: trimmedUrl,
          category_id: selectedCategoryId,
        }
      : {
          media_name: source.name,
          url: trimmedUrl,
          category_id: selectedCategoryId,
          iptc_category: selectedCategory.iptc_code!,
        };

    await runSaveOperation(async () => {
      await requestJson<RssChannelApiItem>(
        channelBeingEdited
          ? `${API_BASE_URL}/api/v1/information-sources/${sourceId}/rss-channels/${channelBeingEdited.id}`
          : `${API_BASE_URL}/api/v1/information-sources/${sourceId}/rss-channels`,
        token,
        {
          method: channelBeingEdited ? "PUT" : "POST",
          headers: {
            "Content-Type": "application/json",
          },
          body: JSON.stringify(payload),
        },
        logout,
      );

      await loadSourcesAndChannels();
      setSelectedSourceId(sourceId);
    }, channelBeingEdited
      ? "Canal RSS actualizado correctamente."
      : "Canal RSS creado correctamente.");
  }, [
    categories,
    channelBeingEdited,
    channelForm.categoryId,
    channelForm.sourceId,
    channelForm.url,
    loadSourcesAndChannels,
    logout,
    runSaveOperation,
    sources,
    token,
  ]);

  const renderSourceModal = () => (
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
  );

  const renderChannelModal = () => {
    const currentSourceId = Number(channelForm.sourceId);

    return (
      <dialog
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
              value={channelForm.categoryId}
              onChange={(event) =>
                setChannelForm((current) => ({ ...current, categoryId: event.target.value }))
              }
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

      {feedback && (
        <div
          className={`alert-feedback ${
            feedback.type === "success"
              ? "alert-feedback-success"
              : "alert-feedback-error"
          }`}
          role={feedback.type === "error" ? "alert" : "status"}
          aria-live="polite"
        >
          {feedback.message}
        </div>
      )}

      {isLoading ? (
        <section className="sources-rss-loading" role="status" aria-live="polite">
          <p>Cargando fuentes y canales RSS...</p>
        </section>
      ) : (
        <section className="sources-rss-grid" aria-label="Gestión de fuentes y canales RSS">
          <article className="sources-rss-panel">
            <div className="sources-rss-panel-header">
              <div>
                <h2>Fuentes de información</h2>
                <p>Selecciona una fuente para ver sus canales asociados.</p>
              </div>
              <span className="sources-rss-badge">{sources.length} fuentes</span>
            </div>

            {sources.length === 0 ? (
              <div className="sources-rss-empty-state">
                <p>No hay fuentes registradas todavía.</p>
              </div>
            ) : (
              <table className="sources-rss-table" aria-label="Listado de fuentes de información">
                <thead>
                  <tr>
                    <th>Nombre</th>
                    <th>URL web</th>
                    <th>Acciones</th>
                  </tr>
                </thead>
                <tbody>
                  {sources.map((source) => {
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
                          <button
                            type="button"
                            className="sources-rss-inline-button"
                            onClick={() => openEditSourceModal(source)}
                            aria-label={`Editar fuente ${source.name}`}
                          >
                            <Pencil size={14} />
                            Editar
                          </button>
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            )}
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
                <span className="sources-rss-badge">{selectedSourceChannels.length} canales</span>
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

            {!selectedSource ? (
              <div className="sources-rss-empty-state">
                <p>Selecciona una fuente para administrar sus canales RSS.</p>
              </div>
            ) : selectedSourceChannels.length === 0 ? (
              <div className="sources-rss-empty-state">
                <p>Esta fuente todavía no tiene canales RSS asociados.</p>
              </div>
            ) : (
              <table className="sources-rss-table" aria-label="Canales RSS asociados">
                <thead>
                  <tr>
                    <th>URL del feed</th>
                    <th>Categoría IPTC</th>
                    <th>Acciones</th>
                  </tr>
                </thead>
                <tbody>
                  {selectedSourceChannels.map((channel) => {
                    const category = categories.find((item) => item.id === channel.category_id);

                    return (
                      <tr key={channel.id}>
                        <td>
                          <a href={channel.url} target="_blank" rel="noreferrer">
                            {channel.url}
                          </a>
                        </td>
                        <td>{getCategoryLabel(category, channel.iptc_category)}</td>
                        <td>
                          <button
                            type="button"
                            className="sources-rss-inline-button"
                            onClick={() => openEditChannelModal(channel)}
                            aria-label={`Editar canal ${channel.url}`}
                          >
                            <Pencil size={14} />
                            Editar
                          </button>
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            )}
          </article>
        </section>
      )}

      {activeModal === "source" && renderSourceModal()}
      {activeModal === "channel" && renderChannelModal()}
    </main>
  );
};
