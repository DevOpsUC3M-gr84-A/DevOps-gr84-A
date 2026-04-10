import React, { useCallback, useEffect, useState } from 'react';
import { Plus, Pencil, Trash2 } from 'lucide-react';
import { AlertForm, AlertFormPayload, AlertTableItem } from '../components/AlertForm';

interface AlertApiItem {
  id: number;
  name: string;
  descriptors: string[];
}

interface AlertFeedback {
  type: 'success' | 'error';
  message: string;
}

const API_BASE_URL = process.env.REACT_APP_API_BASE_URL ?? 'http://localhost:8000';

export const AlertsManagement = ({ onLogout }: { onLogout: () => void }) => {
  const [isAlertFormOpen, setIsAlertFormOpen] = useState(false);
  const [alertas, setAlertas] = useState<AlertTableItem[]>([]);
  const [alertToEdit, setAlertToEdit] = useState<AlertTableItem | null>(null);
  const [alertFeedback, setAlertFeedback] = useState<AlertFeedback | null>(null);
  
  const token = globalThis.localStorage.getItem('token');
  const userId = globalThis.localStorage.getItem('userId');
  const userRoles = JSON.parse(globalThis.localStorage.getItem('userRoles') || '[]');
  const isGestor = userRoles.includes(1);

  const mapAlertToTableItem = (item: AlertApiItem): AlertTableItem => ({
    id: item.id,
    nombre: item.name,
    descriptores: item.descriptors.join(', ')
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
    if (!userId || !token) {
      return;
    }

    const confirmed = globalThis.confirm('¿Seguro que quieres borrar esta alerta?');
    if (!confirmed) {
      return;
    }

    try {
      const response = await fetch(`${API_BASE_URL}/api/v1/users/${userId}/alerts/${alertId}`, {
        method: 'DELETE',
        headers: {
          Authorization: `Bearer ${token}`
        }
      });

      if (response.status === 401) {
        onLogout();
        return;
      }

      if (!response.ok) {
        throw new Error('Error al borrar la alerta');
      }

      setAlertas((prevAlertas) => prevAlertas.filter((alerta) => alerta.id !== alertId));
      setAlertFeedback({
        type: 'success',
        message: 'Alerta borrada correctamente.'
      });
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : 'Error desconocido';
      setAlertFeedback({
        type: 'error',
        message: `No se pudo borrar la alerta: ${errorMessage}`
      });
    }
  };

  const fetchAlertas = useCallback(async () => {
    try {
      const response = await fetch(`${API_BASE_URL}/api/v1/users/${userId}/alerts`, {
        headers: {
          Authorization: `Bearer ${token}`
        }
      });

      if (response.status === 401) {
        onLogout();
        return;
      }
      if (!response.ok) {
        throw new Error('Error al obtener alertas');
      }

      const data = await response.json();
      const alertasMapeadas = Array.isArray(data)
        ? (data as AlertApiItem[]).map(mapAlertToTableItem)
        : [];

      setAlertas(alertasMapeadas);
    } catch (error) {
      console.error('Error cargando alertas:', error);
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
    if (!userId || !token) {
      return;
    }

    await fetchAlertas();
    setAlertFeedback({
      type: 'success',
      message: alertToEdit ? 'Alerta actualizada correctamente.' : 'Alerta creada correctamente.'
    });
    handleCloseAlertForm();
  };

  return (
    <>
      <main className="main-content">
        <header className="header-actions">
          <h2>Gestión de Alertas</h2>
          {isGestor && (
            <button className="btn-primary" onClick={handleOpenCreateModal}>
              <Plus size={18} /> Crear Nueva Alerta
            </button>
          )}
        </header>

        {alertFeedback && (
          <div
            className={`alert-feedback ${
              alertFeedback.type === 'success' ? 'alert-feedback-success' : 'alert-feedback-error'
            }`}
            role="status"
            aria-live="polite"
          >
            {alertFeedback.message}
          </div>
        )}

        <section className="table-container">
          <table className="management-table">
            <thead>
              <tr>
                <th>Nombre de la Alerta</th>
                <th>Descriptores</th>
                {isGestor && <th>Acciones</th>}
              </tr>
            </thead>
            <tbody>
              {alertas.length === 0 ? (
                <tr>
                  <td colSpan={isGestor ? 3 : 2} className="empty-state-cell">
                    No hay alertas todavía.
                  </td>
                </tr>
              ) : (
                alertas.map((alerta) => (
                  <tr key={alerta.id}>
                    <td>{alerta.nombre}</td>
                    <td>{alerta.descriptores}</td>
                    {isGestor && (
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
