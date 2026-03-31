// src/components/AlertsManagement.tsx
import React, { useState, useEffect } from 'react';
import { Plus, Pencil, Trash2 } from 'lucide-react';
import { AlertForm } from '../components/AlertForm';
import { useAlertModal } from '../hooks/useAlertModal';

export const AlertsManagement = () => {
  const { isOpen, open, close } = useAlertModal();
  const [alertas, setAlertas] = useState<any[]>([]);

  // Carga inicial de datos desde la API
  useEffect(() => {
    const fetchAlertas = async () => {
      const token = localStorage.getItem('token');
      const userId = localStorage.getItem('userId');

      if (!userId || !token) return;

      try {
        const response = await fetch(`http://localhost:8000/api/v1/users/${userId}/alerts`, {
          headers: { 'Authorization': `Bearer ${token}` }
        });

        if (response.ok) {
          const data = await response.json();
          // Formateamos descriptores de Array a String para la tabla
          setAlertas(data.map((a: any) => ({
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
  const handleAlertSubmit = (datos: any) => {
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
                  <td colSpan={3} style={{ textAlign: 'center', padding: '2rem' }}>
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
                        <button className="btn-icon edit"><Pencil size={20} /></button>
                        <button className="btn-icon delete"><Trash2 size={20} /></button>
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
