import React from 'react';
// @ts-ignore: CSS module declaration not found
import './App.css';
import { Bell, Settings, Radar, LogOut } from 'lucide-react'; // Añadimos LogOut
import { AlertsManagement } from './pages/AlertsManagement';
import { Auth } from './pages/Auth';

function App() {
  const token = localStorage.getItem('token');

  // Función para cerrar sesión
  const handleLogout = () => {
    localStorage.removeItem('token');
    localStorage.removeItem('userId');
    localStorage.removeItem('userRoles');
    localStorage.removeItem('userEmail');
    // Recargamos para volver a la página de Auth
    window.location.href = '/';
  };

  if (!token) {
    return <Auth />;
  }

  return (
    <div className="app-container">
      {/* Sidebar */}
      <aside className="sidebar">
        <div className="brand-section" style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
          <img 
            src={process.env.PUBLIC_URL + '/newsradar-logo.png'}
            alt="NewsRadar Logo" 
            style={{ width: '32px', height: '32px' }} 
          />
          <span>NewsRadar</span>
        </div>
        
        <nav className="nav-container">
          <ul className="nav-links">
            <li>
              <a href="/" className="nav-item">
                <Radar size={20} /><span>Dashboard</span>
              </a>
            </li>
            <li>
              <a href="/alertas" className="nav-item active">
                <Bell size={20} /><span>Mis Alertas</span>
              </a>
            </li>
            <li>
              <a href="/configuracion" className="nav-item">
                <Settings size={20} /><span>Configuración</span>
              </a>
            </li>
          </ul>

          {/* Botón de Logout al final del nav */}
          <div className="nav-footer">
            <button onClick={handleLogout} className="logout-button">
              <LogOut size={20} />
              <span>Cerrar Sesión</span>
            </button>
          </div>
        </nav>
      </aside>

      {/* Main Content */}
      <AlertsManagement onLogout={handleLogout} />
    </div>
  );
}

export default App;
