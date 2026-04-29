import { useCallback, useEffect, useState } from "react";
import { Plus, Pencil, Trash2 } from "lucide-react";
import { AlertForm } from "../components/AlertForm";
import type {
  AlertCategoryOption,
  AlertCategoryPayload,
  AlertFormPayload,
  AlertTableItem,
} from "../components/AlertForm";

interface AlertCategory extends AlertCategoryOption {
  id: number;
  name?: string;
  iptc_code?: string | null;
  iptc_label?: string | null;
}

interface AlertApiItem {
  id: number;
  name: string;
  descriptors: string[];
  categoria_iptc?: string | null;
  categories?: Array<string | AlertCategory> | null;
  information_sources_ids?: string[] | null;
  fuentes_rss?: string[] | null;
}

interface AlertFeedback {
  type: "success" | "error";
  message: string;
}

interface ApiAlertCategoryItem {
  code: string;
  label: string;
}

interface ApiAlertPayload {
  name: string;
  descriptors: string[];
  categories: ApiAlertCategoryItem[];
  cron_expression: string;
  rss_channels_ids?: string[];
  information_sources_ids?: string[];
}

const API_BASE_URL =
  import.meta.env.VITE_API_BASE_URL ?? "http://localhost:8000";

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

export const AlertsManagement = ({ onLogout }: { onLogout: () => void }) => {
  const [isAlertFormOpen, setIsAlertFormOpen] = useState(false);
  const [alertas, setAlertas] = useState<AlertTableItem[]>([]);
  const [categories, setCategories] = useState<AlertCategoryOption[]>([]);
  const [alertToEdit, setAlertToEdit] = useState<AlertTableItem | null>(null);
  const [alertFeedback, setAlertFeedback] = useState<AlertFeedback | null>(
    null,
  );
  const [selectedIptcCategory, setSelectedIptcCategory] = useState("");
  const [sourceFilter, setSourceFilter] = useState("");

  const token = globalThis.localStorage.getItem("token");
  const userId = globalThis.localStorage.getItem("userId");
  const userRoles = JSON.parse(
    globalThis.localStorage.getItem("userRoles") || "[]",
  );
  const canManageAlerts =
    userRoles.some((roleId: number) => roleId === 1 || roleId === 3) &&
    Boolean(userId) &&
    Boolean(token);

  const mapAlertToTableItem = (item: AlertApiItem): AlertTableItem => ({
    id: item.id,
    nombre: item.name,
    descriptores: (item.descriptors ?? []).join(", "),
    categories: Array.isArray(item.categories)
      ? (item.categories as Array<string | AlertCategory>)
      : item.categoria_iptc
      ? [item.categoria_iptc]
      : [],
      information_sources_ids:
        item.information_sources_ids ?? item.rss_channels_ids ?? [],
  } as unknown as AlertTableItem);

  const availableIptcCategories = Object.entries(IPTC_MAP).map(
    ([code, label]) => ({ code, label }),
  );

  const normalizedSearch = sourceFilter.trim().toLowerCase();
  const filteredAlertas = alertas.filter((alerta) => {
    const categorias = alerta.categories ?? [];
    const nameLower = alerta.nombre.toLowerCase();
    const descriptorsLower = (alerta.descriptores || "").toLowerCase();

    const categoryCodes = (categorias as Array<string | { code?: string; iptc_code?: string | null }>).map(
      (c) => {
        if (typeof c === "string") return c;
        return String(c.iptc_code ?? c.code ?? "");
      },
    );

    const matchesCategory =
      selectedIptcCategory === "" || categoryCodes.includes(selectedIptcCategory);

    const matchesSearch =
      normalizedSearch === "" ||
      nameLower.includes(normalizedSearch) ||
      descriptorsLower.includes(normalizedSearch);

    return matchesCategory && matchesSearch;
  });

  const handleCloseAlertForm = () => {
    setIsAlertFormOpen(false);
    setAlertToEdit(null);
  };

  const handleOpenCreateModal = () => {
    setAlertFeedback(null);
    setAlertToEdit(null);
    setIsAlertFormOpen(true);
  };

  const handleEditAlert = (alerta: AlertTableItem) => {
    setAlertFeedback(null);
    setAlertToEdit(alerta);
    setIsAlertFormOpen(true);
  };

  const handleDeleteAlert = async (alertId: number) => {
    const confirmed = globalThis.confirm(
      "¿Seguro que quieres borrar esta alerta?",
    );
    if (!confirmed) {
      return;
    }

    try {
      const response = await fetch(
        `${API_BASE_URL}/api/v1/users/${userId}/alerts/${alertId}`,
        {
          method: "DELETE",
          headers: {
            Authorization: `Bearer ${token}`,
          },
        },
      );

      if (response.status === 401) {
        globalThis.localStorage.clear();
        onLogout();
        return;
      }

      if (!response.ok) {
        throw new Error("Error al borrar la alerta");
      }

      setAlertas((prevAlertas) =>
        prevAlertas.filter((alerta) => alerta.id !== alertId),
      );
      setAlertFeedback({
        type: "success",
        message: "Alerta borrada correctamente.",
      });
    } catch (error) {
      const errorMessage =
        error instanceof Error ? error.message : "Error desconocido";
      setAlertFeedback({
        type: "error",
        message: `No se pudo borrar la alerta: ${errorMessage}`,
      });
    }
  };

  const fetchAlertas = useCallback(async () => {
    try {
      const response = await fetch(
        `${API_BASE_URL}/api/v1/users/${userId}/alerts`,
        {
          headers: {
            Authorization: `Bearer ${token}`,
          },
        },
      );

      if (response.status === 401) {
        globalThis.localStorage.clear();
        onLogout();
        return;
      }
      if (!response.ok) {
        throw new Error("Error al obtener alertas");
      }

      const data = await response.json();
      const alertasMapeadas = Array.isArray(data)
        ? (data as AlertApiItem[]).map(mapAlertToTableItem)
        : [];

      setAlertas(alertasMapeadas);
    } catch (error) {
      const errorMessage =
        error instanceof Error ? error.message : "Error desconocido";
      setAlertFeedback({
        type: "error",
        message: `No se pudieron cargar las alertas: ${errorMessage}`,
      });
    }
  }, [userId, token, onLogout]);

  const fetchCategories = useCallback(async () => {
    if (!token) {
      return;
    }

    try {
      const response = await fetch(`${API_BASE_URL}/api/v1/categories`, {
        headers: {
          Authorization: `Bearer ${token}`,
        },
      });

      if (response.status === 401) {
        globalThis.localStorage.clear();
        onLogout();
        return;
      }

      if (!response.ok) {
        throw new Error("Error al obtener categorías");
      }

      const data = await response.json();
      const categoriesFromApi = Array.isArray(data)
        ? (data as AlertCategory[]).map((category) => ({
            id: Number(category.id),
            name: category.name,
            iptc_code: category.iptc_code,
            iptc_label: category.iptc_label,
          }))
            .filter((category) => Number.isFinite(Number(category.id)))
        : [];

      setCategories(categoriesFromApi);
    } catch {
      const fallbackCategories = Object.entries(IPTC_MAP).map(([code, label], index) => ({
        id: index + 1,
        name: label,
        iptc_code: code,
        iptc_label: label,
      }));

      setCategories(fallbackCategories);
    }
  }, [token]);

  // Carga desde la API
  useEffect(() => {
    if (userId && token) {
      void fetchAlertas();
      void fetchCategories();
    }
  }, [userId, token, fetchAlertas, fetchCategories]);

  useEffect(() => {
    if (!alertFeedback) {
      return;
    }

    const timeoutId = globalThis.setTimeout(() => {
      setAlertFeedback(null);
    }, 5000);

    return () => globalThis.clearTimeout(timeoutId);
  }, [alertFeedback]);

  const handleSaveAlert = async (alertData: AlertFormPayload) => {

    if (!token || !userId) {
      globalThis.localStorage.clear();
      window.location.assign("/login");
      return;
    }

    const descriptorsArray = Array.isArray(alertData.descriptors)
      ? alertData.descriptors.map((d) => String(d).trim()).filter((d) => d !== "")
      : String(alertData.descriptors)
          .split(",")
          .map((d) => d.trim())
          .filter((d) => d !== "");

    const categoriesArray = Array.isArray(alertData.categories)
      ? alertData.categories
          .map((category) => ({
            id: Number(category.id),
            name: String(category.name ?? "").trim(),
            iptc_code: String(category.iptc_code ?? "").trim(),
          }))
          .filter(
            (category): category is AlertCategoryPayload =>
              Number.isFinite(category.id) &&
              category.name !== "" &&
              category.iptc_code !== "",
          )
      : [];

    const apiCategories: ApiAlertCategoryItem[] = categoriesArray.map(
      (category) => ({
        code: category.iptc_code,
        label: category.name,
      }),
    );

    const informationSourcesIds = Array.isArray(alertData.information_sources_ids)
      ? alertData.information_sources_ids
          .map((source) => String(source).trim())
          .filter((source) => source !== "")
      : [];

    const payload: ApiAlertPayload = {
      name: alertData.name,
      descriptors: descriptorsArray,
      categories: apiCategories,
      cron_expression: alertData.cron_expression,
    };

    // Always include the sources/channels fields (empty array if none)
    payload.information_sources_ids = informationSourcesIds;
    payload.rss_channels_ids = informationSourcesIds;

    console.log("DATOS A ENVIAR:", payload);

    try {
      const endpoint = alertToEdit
        ? `${API_BASE_URL}/api/v1/users/${userId}/alerts/${alertToEdit.id}`
        : `${API_BASE_URL}/api/v1/users/${userId}/alerts`;

      const response = await fetch(endpoint, {
        method: alertToEdit ? "PUT" : "POST",
        headers: {
          Authorization: `Bearer ${token}`,
          "Content-Type": "application/json",
        },
        body: JSON.stringify(payload),
      });

      if (response.status === 401) {
        globalThis.localStorage.clear();
        onLogout();
        return;
      }

      if (!response.ok) {
        throw new Error("Error al guardar la alerta");
      }

      await fetchAlertas();
      setAlertFeedback({
        type: "success",
        message: alertToEdit
          ? "Alerta actualizada correctamente."
          : "Alerta creada correctamente.",
      });
      handleCloseAlertForm();
    } catch (error) {
      const errorMessage =
        error instanceof Error ? error.message : "Error desconocido";
      setAlertFeedback({
        type: "error",
        message: `No se pudo guardar la alerta: ${errorMessage}`,
      });
    }
  };

  return (
    <>
      <main className="main-content">
        <div className="alerts-header">
          <div className="page-heading">
            <h1 className="section-title">Gestión de Alertas</h1>
            <p className="section-subtitle">
              Configura tus radares de información personalizados.
            </p>
          </div>
          {canManageAlerts && (
            <button className="btn-primary" onClick={handleOpenCreateModal}>
              <Plus size={18} /> Crear Nueva Alerta
            </button>
          )}
        </div>

        {alertFeedback && (
          <div
            className={`alert-feedback ${
              alertFeedback.type === "success"
                ? "alert-feedback-success"
                : "alert-feedback-error"
            }`}
            role="status"
            aria-live="polite"
          >
            {alertFeedback.message}
          </div>
        )}

        <section className="table-container">
          <div className="header-actions" aria-label="Filtros de alertas">
            <div className="form-group">
              <label htmlFor="alertsIptcFilter">Filtrar por categoria IPTC</label>
              <select
                id="alertsIptcFilter"
                className="form-input alerts-filter-select"
                value={selectedIptcCategory}
                onChange={(e) => setSelectedIptcCategory(e.target.value)}
              >
                <option value="">Todas las categorias</option>
                {availableIptcCategories.map((opt) => (
                  <option key={opt.code} value={opt.code}>
                    {opt.label}
                  </option>
                ))}
              </select>
            </div>

            <div className="form-group">
              <label htmlFor="alertsSearch">Buscar por Nombre o Descriptor</label>
              <input
                id="alertsSearch"
                type="text"
                className="form-input"
                placeholder="Ej: IA, tendencias"
                value={sourceFilter}
                onChange={(e) => setSourceFilter(e.target.value)}
              />
            </div>
          </div>

          <table className="management-table">
            <thead>
              <tr>
                <th>Nombre de la Alerta</th>
                <th>Categoria IPTC</th>
                <th>Descriptores</th>
                {canManageAlerts && <th>Acciones</th>}
              </tr>
            </thead>
            <tbody>
              {filteredAlertas.length === 0 ? (
                <tr>
                  <td
                    colSpan={canManageAlerts ? 4 : 3}
                    className="empty-state-cell"
                  >
                    No hay alertas todavía.
                  </td>
                </tr>
              ) : (
                filteredAlertas.map((alerta) => (
                  <tr key={alerta.id}>
                    <td>{alerta.nombre}</td>
                    <td>
                      {alerta.categories && alerta.categories.length > 0
                        ? alerta.categories
                            .map((c: any) => {
                              if (c === null || c === undefined) return "";
                              if (typeof c === "string") {
                                return IPTC_MAP[c] ?? c;
                              }
                              return (
                                c.name ||
                                c.label ||
                                IPTC_MAP[c.iptc_code ?? c.code ?? ""] ||
                                c.iptc_code ||
                                c.code ||
                                ""
                              );
                            })
                            .filter(Boolean)
                            .join(", ")
                        : "Todas"}
                    </td>
                    <td>{alerta.descriptores}</td>
                      {canManageAlerts && (
                      <td>
                        <div className="action-buttons">
                          <button
                            className="btn-icon edit"
                            title="Editar"
                            aria-label={`Editar alerta ${alerta.nombre}`}
                            onClick={() => handleEditAlert(alerta)}
                          >
                            <Pencil size={18} />
                          </button>
                          <button
                            className="btn-icon delete"
                            title="Eliminar"
                            aria-label={`Eliminar alerta ${alerta.nombre}`}
                            onClick={() => void handleDeleteAlert(alerta.id)}
                          >
                            <Trash2 size={16} />
                          </button>
                        </div>
                      </td>
                    )}
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </section>
      </main>

      <AlertForm
        isOpen={isAlertFormOpen}
        onClose={handleCloseAlertForm}
        initialData={alertToEdit}
        categories={categories}
        onSubmit={handleSaveAlert}
      />
    </>
  );
};
