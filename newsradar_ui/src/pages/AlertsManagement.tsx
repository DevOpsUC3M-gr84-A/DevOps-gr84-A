// src/components/AlertsManagement.tsx
import React, { useState, useEffect } from 'react';
import { Plus, Pencil, Trash2 } from 'lucide-react';
import { AlertForm, AlertFormPayload } from '../components/AlertForm';
import { useAlertModal } from '../hooks/useAlertModal';

interface ApiAlert {
  id: number;
  name: string;
  descriptors: string[];
}

interface AlertTableItem {
  id: number;
  nombre: string;
  descriptores: string;
}

const API_BASE_URL = process.env.REACT_APP_API_BASE_URL ?? 'http://localhost:8000';

export const AlertsManagement = () => {
  const { isOpen, open, close } = useAlertModal();
  const [alertas, setAlertas] = useState<AlertTableItem[]>([]);

  // Carga inicial de datos desde la API
  useEffect(() => {
    const fetchAlertas = async () => {
      const token = localStorage.getItem('token');
      const userId = localStorage.getItem('userId');

      if (!userId || !token) return;

      try {
        const response = await fetch(`${API_BASE_URL}/api/v1/users/${userId}/alerts`, {
          headers: { 'Authorization': `Bearer ${token}` }
        });

        if (response.ok) {
          const data: ApiAlert[] = await response.json();
          // Formateamos descriptores de Array a String para la tabla
          setAlertas(data.map((a) => ({
            ...a,
            nombre: a.name,
            descriptores: a.descriptors.join(', ')
          })));
        }
      } catch (error) {
        console.error("Error al cargar alertas:", error);
      }
    };
    fetchAlertas();
  }, []);

  // Actualización de la tabla tras crear una alerta
  const handleAlertSubmit = (datos: AlertFormPayload) => {
    setAlertas([...alertas, {
      id: Date.now(),
      nombre: datos.name,
      descriptores: datos.descriptors.join(', ')
    }]);
    close();
  };

  return (
    <>
      <main className="main-content">
        <header className="header-actions">
          <h1 className="page-title">Gestión de Alertas</h1>
          <button className="btn-primary" onClick={open}>
            <Plus size={20} /> Nueva Alerta
          </button>
        </header>

        <section className="table-container">
          <table className="management-table">
            <thead>
              <tr>
                <th>Nombre de la Alerta</th>
                <th>Descriptores</th>
                <th>Acciones</th>
              </tr>
            </thead>
            <tbody>
              {alertas.length === 0 ? (
                <tr>
                  <td colSpan={3} className="empty-state-cell">
                    No hay alertas todavía.
                  </td>
                </tr>
              ) : (
                alertas.map((alerta) => (
                  <tr key={alerta.id}>
                    <td>{alerta.nombre}</td>
                    <td>{alerta.descriptores}</td>
                    <td>
                      <div className="action-buttons">
                        <button className="btn-icon edit" aria-label="Editar alerta" title="Editar alerta"><Pencil size={20} /></button>
                        <button className="btn-icon delete" aria-label="Eliminar alerta" title="Eliminar alerta"><Trash2 size={20} /></button>
                      </div>
                    </td>
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
