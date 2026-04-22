// @ts-ignore: CSS module declaration not found
import "./App.css";
import { Bell, Settings, Radar, LogOut, Rss } from "lucide-react";
import { Navigate, Route, Routes, useLocation } from "react-router-dom";
import { AlertsManagement } from "./pages/AlertsManagement";
import { Auth } from "./pages/Auth";
import { VerifyEmail } from "./pages/VerifyEmail";
import { ForgotPassword } from "./pages/ForgotPassword";
import { ResetPassword } from "./pages/ResetPassword";
import { useAuth } from "./hooks/useAuth";
import { SourcesRss } from "./pages/SourcesRss";

interface ProtectedLayoutProps {
  handleLogout: () => void;
  canManageSections: boolean;
}

const MANAGEMENT_ROLE_IDS = new Set([1, 3]);

const getStoredUserRoles =(): number[] => {
  try {
    const rawRoles = globalThis.localStorage.getItem("userRoles") || "[]";
    const parsedRoles = JSON.parse(rawRoles) as unknown;
    return Array.isArray(parsedRoles)
      ? parsedRoles.filter((role): role is number => typeof role === "number")
      : [];
  } catch {
    return [];
  }
};

const canAccessManagementSections = (roles: number[]): boolean =>
  roles.some((roleId) => MANAGEMENT_ROLE_IDS.has(roleId));

const DashboardHome = () => (
  <main className="main-content">
    <div className="table-container">
      <h2 className="page-title">Panel general</h2>
      <p>
        Selecciona una sección del menú lateral para empezar a trabajar con la
        plataforma.
      </p>
    </div>
  </main>
);

const ProtectedLayout = ({
  handleLogout,
  canManageSections,
}: ProtectedLayoutProps) => {
  const location = useLocation();
  const isAlertasRoute = location.pathname === "/alertas";
  const isFuentesRoute = location.pathname === "/fuentes-rss";

  let mainContent = <DashboardHome />;

  if (isAlertasRoute) {
    mainContent = canManageSections ? (
      <AlertsManagement onLogout={handleLogout} />
    ) : (
      <Navigate to="/" replace />
    );
  } else if (isFuentesRoute) {
    mainContent = canManageSections ? (
      <SourcesRss />
    ) : (
      <Navigate to="/" replace />
    );
  } else if (location.pathname === "/") {
    mainContent = canManageSections ? (
      <Navigate to="/alertas" replace />
    ) : (
      <DashboardHome />
    );
  }

  return (
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

        <nav className="nav-container">
          <ul className="nav-links">
            <li>
              <a href="/" className="nav-item">
                <Radar size={20} />
                <span>Dashboard</span>
              </a>
            </li>
            {canManageSections && (
              <>
                <li>
                  <a href="/alertas" className="nav-item active">
                    <Bell size={20} />
                    <span>Mis Alertas</span>
                  </a>
                </li>
                <li>
                  <a href="/fuentes-rss" className="nav-item">
                    <Rss size={20} />
                    <span>Fuentes RSS</span>
                  </a>
                </li>
              </>
            )}
            <li>
              <a href="/configuracion" className="nav-item">
                <Settings size={20} />
                <span>Configuración</span>
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
      {mainContent}
    </div>
  );
};

function App() {
  const token = globalThis.localStorage.getItem("token");
  const { logout } = useAuth();
  const userRoles = getStoredUserRoles();
  const canManageSections = canAccessManagementSections(userRoles);

  // Función para cerrar sesión
  const handleLogout = () => {
    globalThis.localStorage.removeItem("token");
    globalThis.localStorage.removeItem("userId");
    globalThis.localStorage.removeItem("userRoles");
    globalThis.localStorage.removeItem("userEmail");
    // Recargamos para volver a la página de Auth
    globalThis.location.href = "/";
    logout();
  };

  return (
    <Routes>
      <Route path="/verify-email" element={<VerifyEmail />} />
      <Route path="/forgot-password" element={<ForgotPassword />} />
      <Route path="/reset-password" element={<ResetPassword />} />
      <Route
        path="*"
        element={
          token ? (
            <ProtectedLayout
              handleLogout={handleLogout}
              canManageSections={canManageSections}
            />
          ) : (
            <Auth />
          )
        }
      />
    </Routes>
  );
}

export default App;
