import React from 'react';
import './App.css';
import { Bell, Radar, Rss, Mail, User, LogOut } from 'lucide-react';
import { Navigate, NavLink, Route, Routes, useNavigate } from 'react-router-dom';
import { AlertsManagement } from './pages/AlertsManagement';
import { Auth } from './pages/Auth';
import { VerifyEmail } from './pages/VerifyEmail';
import { ForgotPassword } from './pages/ForgotPassword';
import { ResetPassword } from './pages/ResetPassword';
import {
  DashboardDevelopmentPage,
  SourcesRssDevelopmentPage,
  NotificationsDevelopmentPage,
  ProfileDevelopmentPage
} from './pages/placeholders/DevelopmentPlaceholderPages';
import { useAuth } from './hooks/useAuth';

interface ProtectedLayoutProps {
  handleLogout: () => void;
}

const ProtectedLayout = ({ handleLogout }: ProtectedLayoutProps) => (
  <div className="app-container">
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
            <NavLink to="/dashboard" className="nav-item">
              <Radar size={20} /><span>Dashboard / Resumen</span>
            </NavLink>
          </li>
          <li>
            <NavLink to="/alertas" className="nav-item">
              <Bell size={20} /><span>Gestión de Alertas</span>
            </NavLink>
          </li>
          <li>
            <NavLink to="/fuentes-rss" className="nav-item">
              <Rss size={20} /><span>Gestión de Fuentes y canales RSS</span>
            </NavLink>
          </li>
          <li>
            <NavLink to="/notificaciones" className="nav-item">
              <Mail size={20} /><span>Buzón de Notificaciones</span>
            </NavLink>
          </li>
          <li>
            <NavLink to="/perfil" className="nav-item">
              <User size={20} /><span>Gestión del Perfil de Usuario</span>
            </NavLink>
          </li>
        </ul>

        <div className="nav-footer">
          <button onClick={handleLogout} className="logout-button">
            <LogOut size={20} />
            <span>Cerrar Sesión</span>
          </button>
        </div>
      </nav>
    </aside>

    <Routes>
      <Route path="/dashboard" element={<DashboardDevelopmentPage />} />
      <Route path="/alertas" element={<AlertsManagement onLogout={handleLogout} />} />
      <Route path="/fuentes-rss" element={<SourcesRssDevelopmentPage />} />
      <Route path="/notificaciones" element={<NotificationsDevelopmentPage />} />
      <Route path="/perfil" element={<ProfileDevelopmentPage />} />
      <Route path="*" element={<Navigate to="/dashboard" replace />} />
    </Routes>
  </div>
);

function App() {
  const token = globalThis.localStorage.getItem('token');
  const { logout } = useAuth();
  const navigate = useNavigate();

  const handleLogout = () => {
    globalThis.localStorage.removeItem('token');
    globalThis.localStorage.removeItem('userId');
    globalThis.localStorage.removeItem('userRoles');
    globalThis.localStorage.removeItem('userEmail');
    logout();
    navigate('/login', { replace: true });
  };

  return (
    <Routes>
      <Route path="/login" element={token ? <Navigate to="/dashboard" replace /> : <Auth />} />
      <Route path="/verify-email" element={<VerifyEmail />} />
      <Route path="/forgot-password" element={<ForgotPassword />} />
      <Route path="/reset-password" element={<ResetPassword />} />
      <Route path="/*" element={token ? <ProtectedLayout handleLogout={handleLogout} /> : <Navigate to="/login" replace />} />
    </Routes>
  );
}

export default App;