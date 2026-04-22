// @ts-ignore: CSS module declaration not found
import "./App.css";
import { Bell, LogOut, Mail, Radar, Rss, Settings, User } from "lucide-react";
import { Navigate, NavLink, Route, Routes, useNavigate } from "react-router-dom";
import { AlertsManagement } from "./pages/AlertsManagement";
import { Auth } from "./pages/Auth";
import { ForgotPassword } from "./pages/ForgotPassword";
import { ResetPassword } from "./pages/ResetPassword";
import { VerifyEmail } from "./pages/VerifyEmail";
import {
  DashboardDevelopmentPage,
  NotificationsDevelopmentPage,
  ProfileDevelopmentPage,
  SourcesRssDevelopmentPage,
} from "./pages/placeholders/DevelopmentPlaceholderPages";

interface ProtectedLayoutProps {
  handleLogout: () => void;
}

const ConfigurationDevelopmentPage = () => (
  <main className="main-content" aria-labelledby="configuration-title">
    <header className="header-actions">
      <h2 id="configuration-title">Configuración</h2>
    </header>

    <section className="table-container" aria-label="Configuración en desarrollo">
      <p>Aquí se mostrarán las opciones de configuración general de la plataforma.</p>
      <p>
        Esta vista mantiene la navegación integrada mientras se implementan las
        preferencias definitivas.
      </p>
    </section>
  </main>
);

const ProtectedLayout = ({ handleLogout }: ProtectedLayoutProps) => (
  <div className="app-container">
    <aside className="sidebar">
      <div className="brand-section app-brand-section">
        <img
          src={`${import.meta.env.BASE_URL}newsradar-logo.png`}
          alt="NewsRadar Logo"
          className="app-brand-logo"
        />
        <span>NewsRadar</span>
      </div>

      <nav className="nav-container">
        <ul className="nav-links">
          <li>
            <NavLink
              to="/dashboard"
              className={({ isActive }) =>
                `nav-item${isActive ? " active" : ""}`
              }
            >
              <Radar size={20} />
              <span>Dashboard / Resumen</span>
            </NavLink>
          </li>
          <li>
            <NavLink
              to="/alertas"
              className={({ isActive }) =>
                `nav-item${isActive ? " active" : ""}`
              }
            >
              <Bell size={20} />
              <span>Gestión de Alertas</span>
            </NavLink>
          </li>
          <li>
            <NavLink
              to="/fuentes-rss"
              className={({ isActive }) =>
                `nav-item${isActive ? " active" : ""}`
              }
            >
              <Rss size={20} />
              <span>Gestión de Fuentes y canales RSS</span>
            </NavLink>
          </li>
          <li>
            <NavLink
              to="/notificaciones"
              className={({ isActive }) =>
                `nav-item${isActive ? " active" : ""}`
              }
            >
              <Mail size={20} />
              <span>Buzón de Notificaciones</span>
            </NavLink>
          </li>
          <li>
            <NavLink
              to="/perfil"
              className={({ isActive }) =>
                `nav-item${isActive ? " active" : ""}`
              }
            >
              <User size={20} />
              <span>Gestión del Perfil de Usuario</span>
            </NavLink>
          </li>
          <li>
            <NavLink
              to="/configuracion"
              className={({ isActive }) =>
                `nav-item${isActive ? " active" : ""}`
              }
            >
              <Settings size={20} />
              <span>Configuración</span>
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
      <Route path="/configuracion" element={<ConfigurationDevelopmentPage />} />
      <Route path="*" element={<Navigate to="/dashboard" replace />} />
    </Routes>
  </div>
);

function App() {
  const token = globalThis.localStorage.getItem("token");
  const navigate = useNavigate();

  const handleLogout = () => {
    globalThis.localStorage.removeItem("token");
    globalThis.localStorage.removeItem("userId");
    globalThis.localStorage.removeItem("userRoles");
    globalThis.localStorage.removeItem("userEmail");
    navigate("/login", { replace: true });
  };

  return (
    <Routes>
      <Route path="/login" element={token ? <Navigate to="/dashboard" replace /> : <Auth />} />
      <Route path="/verify-email" element={<VerifyEmail />} />
      <Route path="/forgot-password" element={<ForgotPassword />} />
      <Route path="/reset-password" element={<ResetPassword />} />
      <Route
        path="*"
        element={token ? <ProtectedLayout handleLogout={handleLogout} /> : <Auth />}
      />
    </Routes>
  );
}

export default App;
