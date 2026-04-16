import { useCallback, useEffect, useState } from "react";
import { Plus, Pencil, Trash2 } from "lucide-react";
import { AlertForm } from "../components/AlertForm";
import type { AlertFormPayload, AlertTableItem } from "../components/AlertForm";

interface AlertApiItem {
  id: number;
  name: string;
  descriptors: string[];
  categoria_iptc?: string | null;
  fuentes_rss?: string[] | null;
}

interface AlertFeedback {
  type: "success" | "error";
  message: string;
}

const API_BASE_URL =
  import.meta.env.VITE_API_BASE_URL ?? "http://localhost:8000";

export const AlertsManagement = ({ onLogout }: { onLogout: () => void }) => {
  const [isAlertFormOpen, setIsAlertFormOpen] = useState(false);
  const [alertas, setAlertas] = useState<AlertTableItem[]>([]);
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
  const isGestor = userRoles.includes(1);
  const canManageAlerts = isGestor && Boolean(userId) && Boolean(token);

  const mapAlertToTableItem = (item: AlertApiItem): AlertTableItem => ({
    id: item.id,
    nombre: item.name,
    descriptores: (item.descriptors ?? []).join(", "),
    categoria_iptc: item.categoria_iptc ?? "",
    fuentes_rss: item.fuentes_rss ?? [],
  });

  const availableIptcCategories = Array.from(
    new Set(
      alertas
        .map((alerta) => (alerta.categoria_iptc || "").trim())
        .filter((categoria) => categoria !== ""),
    ),
  ).sort((a, b) => a.localeCompare(b));

  const normalizedSourceFilter = sourceFilter.trim().toLowerCase();
  const filteredAlertas = alertas.filter((alerta) => {
    const categoriaIptc = (alerta.categoria_iptc || "").trim();
    const fuentesRss = alerta.fuentes_rss;

    const matchesCategory =
      selectedIptcCategory === "" || categoriaIptc === selectedIptcCategory;
    const matchesSource =
      normalizedSourceFilter === "" ||
      fuentesRss.some((source) =>
        source?.toLowerCase().includes(normalizedSourceFilter),
      );

    return matchesCategory && matchesSource;
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

  // Carga desde la API
  useEffect(() => {
    if (userId && token) {
      void fetchAlertas();
    }
  }, [userId, token, fetchAlertas]);

  useEffect(() => {
    if (!alertFeedback) {
      return;
    }

    const timeoutId = globalThis.setTimeout(() => {
      setAlertFeedback(null);
    }, 5000);

    return () => globalThis.clearTimeout(timeoutId);
  }, [alertFeedback]);

  const handleSaveAlert = async (_datos: AlertFormPayload) => {
    await fetchAlertas();
    setAlertFeedback({
      type: "success",
      message: alertToEdit
        ? "Alerta actualizada correctamente."
        : "Alerta creada correctamente.",
    });
    handleCloseAlertForm();
  };

  return (
    <>
      <main className="main-content">
        <header className="header-actions">
          <h2>Gestión de Alertas</h2>
          {canManageAlerts && (
            <button className="btn-primary" onClick={handleOpenCreateModal}>
              <Plus size={18} /> Crear Nueva Alerta
            </button>
          )}
        </header>

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
              <label htmlFor="alertsIptcFilter">
                Filtrar por categoria IPTC
              </label>
              <select
                id="alertsIptcFilter"
                className="form-input"
                value={selectedIptcCategory}
                onChange={(e) => setSelectedIptcCategory(e.target.value)}
              >
                <option value="">Todas las categorias</option>
                {availableIptcCategories.map((category) => (
                  <option key={category} value={category}>
                    {category}
                  </option>
                ))}
              </select>
            </div>

            <div className="form-group">
              <label htmlFor="alertsSourceFilter">Filtrar por fuente RSS</label>
              <input
                id="alertsSourceFilter"
                type="text"
                className="form-input"
                placeholder="Ej: Reuters"
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
                    <td>{alerta.categoria_iptc}</td>
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
                            onClick={() => handleDeleteAlert(alerta.id)}
                          >
                            <Trash2 size={18} />
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
        onSubmit={handleSaveAlert}
      />
    </>
  );
};
