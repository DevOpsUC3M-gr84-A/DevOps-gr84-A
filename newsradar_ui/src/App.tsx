import React from 'react';
// @ts-ignore: CSS module declaration not found
import './App.css';
import { Bell, Settings, Radar, LogOut } from 'lucide-react';
import { Route, Routes } from 'react-router-dom';
import { AlertsManagement } from './pages/AlertsManagement';
import { Auth } from './pages/Auth';
import { VerifyEmail } from './pages/VerifyEmail';
import { ForgotPassword } from './pages/ForgotPassword';
import { ResetPassword } from './pages/ResetPassword';
import { useAuth } from './hooks/useAuth';

interface ProtectedLayoutProps {
  handleLogout: () => void;
}

const ProtectedLayout = ({ handleLogout }: ProtectedLayoutProps) => (
  <div className="app-container">
    {/* Sidebar */}
    <aside className="sidebar">
      <div className="brand-section app-brand-section">
        <img
          src={process.env.PUBLIC_URL + '/newsradar-logo.png'}
          alt="NewsRadar Logo"
          className="app-brand-logo"
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

function App() {
  const pathname = globalThis.location.pathname;
  const token = globalThis.localStorage.getItem('token');
  const { logout } = useAuth();

  // Función para cerrar sesión
  const handleLogout = () => {
    globalThis.localStorage.removeItem('token');
    globalThis.localStorage.removeItem('userId');
    globalThis.localStorage.removeItem('userRoles');
    globalThis.localStorage.removeItem('userEmail');
    // Recargamos para volver a la página de Auth
    globalThis.location.href = '/';
    logout();
  };

  return (
    <Routes>
      <Route path="/verify-email" element={<VerifyEmail />} />
      <Route path="*" element={token ? <ProtectedLayout handleLogout={handleLogout} /> : <Auth />} />
    </Routes>
  );
}

export default App;
