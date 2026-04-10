import React, { useState, useEffect } from 'react';
import { Plus, Pencil, Trash2 } from 'lucide-react';
import { AlertForm, AlertFormPayload } from '../components/AlertForm';
import { useAlertModal } from '../hooks/useAlertModal';

interface AlertTableItem {
  id: number;
  nombre: string;
  descriptores: string;
}

interface AlertApiItem {
  id: number;
  name: string;
  descriptors: string[];
}

const API_BASE_URL = process.env.REACT_APP_API_BASE_URL ?? 'http://localhost:8000';

export const AlertsManagement = ({ onLogout }: { onLogout: () => void }) => {
  const { isOpen, open, close } = useAlertModal();
  const [alertas, setAlertas] = useState<AlertTableItem[]>([]);
  
  const token = globalThis.localStorage.getItem('token');
  const userId = globalThis.localStorage.getItem('userId');
  const userRoles = JSON.parse(globalThis.localStorage.getItem('userRoles') || '[]');
  const isGestor = userRoles.includes(1);

  // Carga desde la API
  useEffect(() => {
    const fetchAlertas = async () => {
      try {
        const response = await fetch(`${API_BASE_URL}/api/v1/users/${userId}/alerts`, {
          headers: {
            'Authorization': `Bearer ${token}`
          }
        });

        if (response.status === 401) {
          onLogout();
          return;
        }
        if (!response.ok) throw new Error("Error al obtener alertas");
        
        const data = await response.json();
        
        // Mapear los nombres de la API (name) a los de tu tabla (nombre)
        const alertasMapeadas = Array.isArray(data)
          ? (data as AlertApiItem[]).map((item) => ({
              id: item.id,
              nombre: item.name,
              descriptores: item.descriptors.join(', ')
            }))
          : [];
        
        setAlertas(alertasMapeadas);
      } catch (error) {
        console.error("Error cargando alertas:", error);
      }
    };
    if (userId && token) fetchAlertas();
  }, [userId, token, onLogout]);

  // Creación de alertas
  const handleAlertSubmit = async (datos: AlertFormPayload) => {
    try {
      const response = await fetch(`${API_BASE_URL}/api/v1/users/${userId}/alerts`, {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${token}`,
          'Content-Type': 'application/json'
        },
        body: JSON.stringify(datos)
      });

      if (!response.ok) throw new Error("Error al crear la alerta");

      const nuevaAlertaApi = await response.json();

      // ACTUALIZACIÓN SEGURA: Usa prevAlertas para evitar duplicados en UI
      setAlertas(prevAlertas => [...prevAlertas, {
        id: nuevaAlertaApi.id,
        nombre: nuevaAlertaApi.name,
        descriptores: nuevaAlertaApi.descriptors.join(', ')
      }]);
      
      close();
    } catch (error) {
      alert("Error al crear la alerta: " + error);
    }
  };

  return (
    <>
      <main className="main-content">
        <header className="header-actions">
          <h2>Gestión de Alertas</h2>
          {isGestor && (
            <button className="btn-primary" onClick={open}>
              <Plus size={18} /> Nueva Alerta
            </button>
          )}
        </header>

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
                          <button className="btn-icon edit" title="Editar"><Pencil size={18} /></button>
                          <button className="btn-icon delete" title="Eliminar"><Trash2 size={18} /></button>
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

      <AlertForm isOpen={isOpen} onClose={close} onSubmit={handleAlertSubmit} />
    </>
  );
};
