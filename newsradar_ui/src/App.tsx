// @ts-ignore: CSS module declaration not found
import "./App.css";
import {
  Bell,
  Rss,
  LayoutDashboard,
  UserCog,
  Inbox,
  LogOut,
} from "lucide-react";
import { Navigate, NavLink, Outlet, Route, Routes, useNavigate } from "react-router-dom";
import { AlertsManagement } from "./pages/AlertsManagement";
import { Auth } from "./pages/Auth";
import { VerifyEmail } from "./pages/VerifyEmail";
import { ForgotPassword } from "./pages/ForgotPassword";
import { ResetPassword } from "./pages/ResetPassword";
import { useAuth } from "./hooks/useAuth";

interface ProtectedLayoutProps {
  handleLogout: () => void;
  onLanguageChange: (language: "es" | "en") => void;
}

const DashboardPage = () => (
  <section className="main-content">
    {/* Sprint 4 placeholder: estadísticas globales y nubes de palabras */}
    <h1>Dashboard / Resumen</h1>
    <p>
      Aqui iran las estadisticas globales (Issue #85) y nubes de palabras (Issue #85).
    </p>
  </section>
);

const SourcesRssPage = () => (
  <section className="main-content">
    {/* Sprint 4 placeholder: gestión de fuentes RSS y categorías IPTC */}
    <h1>Gestion de Fuentes y canales RSS</h1>
    <p>CRUD de Fuentes y categorias IPTC (Issue #86).</p>
  </section>
);

const ProfilePage = () => (
  <section className="main-content">
    {/* Sprint 4 placeholder: edición de perfil y seguridad */}
    <h1>Gestion del Perfil de Usuario</h1>
    <p>Edicion de datos personales, organizacion y seguridad (Issue #86).</p>
  </section>
);

const NotificationsPage = () => (
  <section className="main-content">
    {/* Sprint 4 placeholder: buzón de notificaciones de indexación */}
    <h1>Buzon de Notificaciones</h1>
    <p>Buzon de notificaciones de indexacion.</p>
  </section>
);

const LanguageSwitcher = ({
  onLanguageChange,
}: {
  onLanguageChange: (language: "es" | "en") => void;
}) => (
  <div className="language-switcher">
    <button
      type="button"
      className="language-switcher-item"
      onClick={() => onLanguageChange("es")}
    >
      ES
    </button>
    <span className="language-switcher-separator"> / </span>
    <button
      type="button"
      className="language-switcher-item"
      onClick={() => onLanguageChange("en")}
    >
      EN
    </button>
  </div>
);

const ProtectedLayout = ({
  handleLogout,
  onLanguageChange,
}: ProtectedLayoutProps) => (
  <div className="app-container">
    {/* Sidebar */}
    <aside className="sidebar">
      <div className="brand-section app-brand-section">
        <img
          src={`${import.meta.env.BASE_URL}newsradar-logo.png`}
          alt="NewsRadar Logo"
          className="app-brand-logo"
        />
        <span>NewsRadar</span>
      </div>

      <LanguageSwitcher onLanguageChange={onLanguageChange} />

      <nav className="nav-container">
        <ul className="nav-links">
          <li>
            <NavLink to="/dashboard" className="nav-item">
              <LayoutDashboard size={20} />
              <span>Dashboard / Resumen</span>
            </NavLink>
          </li>
          <li>
            <NavLink to="/alertas" className="nav-item">
              <Bell size={20} />
              <span>Gestion de Alertas</span>
            </NavLink>
          </li>
          <li>
            <NavLink to="/fuentes-rss" className="nav-item">
              <Rss size={20} />
              <span>Gestion de Fuentes y canales RSS</span>
            </NavLink>
          </li>
          <li>
            <NavLink to="/notificaciones" className="nav-item">
              <Inbox size={20} />
              <span>Buzon de Notificaciones</span>
            </NavLink>
          </li>
          <li>
            <NavLink to="/perfil" className="nav-item">
              <UserCog size={20} />
              <span>Gestion del Perfil de Usuario</span>
            </NavLink>
          </li>
        </ul>

        {/* Botón de Logout al final del nav */}
        <div className="nav-footer">
          <button onClick={handleLogout} className="logout-button">
            <LogOut size={20} />
            <span>Cerrar Sesion</span>
          </button>
        </div>
      </nav>
    </aside>

    {/* Main Content */}
    <Outlet />
  </div>
);

function App() {
  const { logout, isAuthenticated } = useAuth();
  const navigate = useNavigate();

  // Función para cerrar sesión
  const handleLogout = () => {
    logout();
    navigate("/login", { replace: true });
  };

  return (
    <Routes>
      <Route path="/verify-email" element={<VerifyEmail />} />
      <Route path="/forgot-password" element={<ForgotPassword />} />
      <Route path="/reset-password" element={<ResetPassword />} />
      <Route
        path="/"
        element={
          isAuthenticated ? (
            <ProtectedLayout
              handleLogout={handleLogout}
              onLanguageChange={() => {}}
            />
          ) : (
            <Navigate to="/login" replace />
          )
        }
      >
        <Route index element={<Navigate to="/dashboard" replace />} />
        <Route path="dashboard" element={<DashboardPage />} />
        <Route path="alertas" element={<AlertsManagement onLogout={handleLogout} />} />
        <Route path="fuentes-rss" element={<SourcesRssPage />} />
        <Route path="notificaciones" element={<NotificationsPage />} />
        <Route path="perfil" element={<ProfilePage />} />
      </Route>
      <Route path="/login" element={<Auth />} />
      <Route
        path="*"
        element={
          isAuthenticated ? <Navigate to="/dashboard" replace /> : <Navigate to="/login" replace />
        }
      />
    </Routes>
  );
}

export default App;
