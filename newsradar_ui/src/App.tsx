import React, { useState } from 'react';
import './App.css';
import { Bell, Settings, Plus, Pencil, Trash2, Radar } from 'lucide-react';
import { AlertForm } from './components/AlertForm';
import { useAlertModal } from './hooks/useAlertModal';

function App() {
  const { isOpen, open, close } = useAlertModal();

  // Datos mock de ALERTAS en lugar de usuarios
  const [alertas, setAlertas] = useState([
    { id: 1, nombre: 'CRISIS ENERGÉTICA EUROPA', descriptores: 'GAS, ELECTRICIDAD, CRISIS, PRECIOS'},
    { id: 2, nombre: 'AVANCES EN LA GENERATIVA', descriptores: 'LLM, GPT, OPENAI, ANTHROPIC' },
  ]);

  const handleAlertSubmit = (datos: any) => {
    console.log("Nueva alerta:", datos);
    close();
  };

  return (
    <div className="app-container">
      {/* Sidebar */}
      <aside className="sidebar">
        <div className="brand-section">
          <Radar size={32} />
          <span>NewsRadar</span>
        </div>
        <nav>
          <ul className="nav-links">
            <li>
              <a href="#" className="nav-item">
                <Radar size={20} /><span>Dashboard</span>
              </a>
            </li>
            <li>
              <a href="#" className="nav-item active">
                <Bell size={20} /><span>Mis Alertas</span>
              </a>
            </li>
            <li>
              <a href="#" className="nav-item">
                <Settings size={20} /><span>Configuración</span>
              </a>
            </li>
          </ul>
        </nav>
      </aside>

      {/* Main Content */}
      <main className="main-content">
        <header className="header-actions">
          <h1 className="page-title">Gestión de Alertas</h1>
          <button className="btn-primary" onClick={open}>
            <Plus size={20} />
            Nueva Alerta
          </button>
        </header>

        {/* Tabla de Alertas */}
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
              {alertas.map(alerta => (
                <tr key={alerta.id}>
                  <td style={{ fontWeight: '600' }}>{alerta.nombre}</td>
                  <td style={{ color: 'var(--text-gray)', fontSize: '0.875rem' }}>{alerta.descriptores}</td>
                  <td>
                    <div className="action-buttons">
                      <button className="btn-icon edit" title="Editar"><Pencil size={18} /></button>
                      <button className="btn-icon delete" title="Eliminar"><Trash2 size={18} /></button>
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </section>
      </main>

      <AlertForm isOpen={isOpen} onClose={close} onSubmit={handleAlertSubmit} />
    </div>
  );
}

export default App;
