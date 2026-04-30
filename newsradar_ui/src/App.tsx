// @ts-ignore: CSS module declaration not found
import React, { useState, useEffect } from "react";

import "./App.css";
import {
  Bell,
  Menu,
  Rss,
  LayoutDashboard,
  UserCog,
  Inbox,
  LogOut,
} from "lucide-react";
import {
  Link,
  Navigate,
  NavLink,
  Outlet,
  Route,
  Routes,
  useLocation,
  useNavigate,
} from "react-router-dom";
import { AlertsManagement } from "./pages/AlertsManagement";
import { Auth } from "./pages/Auth";
import { VerifyEmail } from "./pages/VerifyEmail";
import { ForgotPassword } from "./pages/ForgotPassword";
import { ResetPassword } from "./pages/ResetPassword";
import { useAuth } from "./hooks/useAuth";
import { SourcesRss } from "./pages/SourcesRss";
import { ProfilePage } from "./pages/ProfilePage";
import { normalizeRoleToId } from "./utils/roleUtils";

interface ProtectedLayoutProps {
  handleLogout: () => void;
  canManageSections: boolean;
  onLanguageChange: (language: "es" | "en") => void;
}

const parseStoredRoles = (rawRoles: string | null): number[] => {
  if (!rawRoles) {
    return [];
  }

  const extractCandidates = (roles: unknown): unknown[] => {
    if (Array.isArray(roles)) {
      return roles;
    }

    if (roles && typeof roles === "object") {
      const roleObject = roles as Record<string, unknown>;

      if (Array.isArray(roleObject.role_ids)) {
        return roleObject.role_ids;
      }

      if (Array.isArray(roleObject.roles)) {
        return roleObject.roles;
      }

      if (roleObject.role != null) {
        return [roleObject.role];
      }

      if (roleObject.role_id != null) {
        return [roleObject.role_id];
      }

      if (roleObject.id != null) {
        return [roleObject.id];
      }

      if (roleObject.name != null) {
        return [roleObject.name];
      }
    }

    return [roles];
  };

  const normalizeCandidate = (candidate: unknown): number => {
    if (candidate && typeof candidate === "object") {
      const candidateObject = candidate as Record<string, unknown>;

      if (candidateObject.role_id != null) {
        return normalizeRoleToId(candidateObject.role_id);
      }

      if (candidateObject.role != null) {
        return normalizeRoleToId(candidateObject.role);
      }

      if (candidateObject.id != null) {
        return normalizeRoleToId(candidateObject.id);
      }

      if (candidateObject.name != null) {
        return normalizeRoleToId(candidateObject.name);
      }
    }

    return normalizeRoleToId(candidate);
  };

  const normalizeAndFilterRoles = (roles: unknown): number[] => {
    return extractCandidates(roles).map(normalizeCandidate);
  };

  try {
    return normalizeAndFilterRoles(JSON.parse(rawRoles) as unknown);
  } catch {
    const commaSeparatedRoles = rawRoles
      .split(",")
      .map((value) => value.trim())
      .filter(Boolean);

    return normalizeAndFilterRoles(
      commaSeparatedRoles.length > 0 ? commaSeparatedRoles : rawRoles,
    );
  }
};

const getStoredUserRoles = (): number[] => {
  const primaryRoles = parseStoredRoles(
    globalThis.localStorage.getItem("userRoles"),
  );

  if (primaryRoles.length > 0) {
    return primaryRoles;
  }

  // Fallback for older localStorage keys.
  const legacyRoles = parseStoredRoles(globalThis.localStorage.getItem("role_ids"));
  if (legacyRoles.length > 0) {
    return legacyRoles;
  }

  return parseStoredRoles(globalThis.localStorage.getItem("userRole"));
};

const canAccessManagementSections = (roles: number[]): boolean =>
  roles.includes(1) || roles.includes(3);

const DashboardPage = () => (
  <section className="main-content">
    <header className="page-heading">
      <h1 className="section-title">Dashboard</h1>
      <p className="section-subtitle">
        Vision general y metricas clave de tu entorno.
      </p>
    </header>
  </section>
);

const ResumenPage = () => (
  <section className="main-content">
    <header className="page-heading">
      <h1 className="section-title">Resumen</h1>
      <p className="section-subtitle">
        Resumen ejecutivo de actividad y principales indicadores.
      </p>
    </header>
  </section>
);

const NotificationsPage = () => (
  <section className="main-content">
    <header className="page-heading">
      <h1 className="section-title">Buzon de Notificaciones</h1>
      <p className="section-subtitle">Buzon de avisos y alertas detectadas.</p>
    </header>
  </section>
);

const LanguageSwitcher = ({
  activeLanguage,
  onLanguageChange,
}: {
  activeLanguage: "es" | "en";
  onLanguageChange: (language: "es" | "en") => void;
}) => (
  <div className="language-switcher">
    <button
      type="button"
      className={`language-switcher-item ${
        activeLanguage === "es" ? "is-active" : ""
      }`}
      onClick={() => onLanguageChange("es")}
    >
      ES
    </button>
    <span className="language-switcher-separator"> / </span>
    <button
      type="button"
      className={`language-switcher-item ${
        activeLanguage === "en" ? "is-active" : ""
      }`}
      onClick={() => onLanguageChange("en")}
    >
      EN
    </button>
  </div>
);

const ProtectedLayout = ({
  handleLogout,
  canManageSections,
  onLanguageChange,
}: ProtectedLayoutProps) => {
  const location = useLocation();
  const [isSidebarOpen, setIsSidebarOpen] = useState(true);
  const [activeLanguage, setActiveLanguage] = useState<"es" | "en">("es");
  const [userName, setUserName] = useState("Usuario");
  const [userRole, setUserRole] = useState("Lector");
  const [userInitials, setUserInitials] = useState("US");

  const sectionTitleByPath: Record<string, string> = {
    "/dashboard": "DASHBOARD",
    "/resumen": "RESUMEN",
    "/alertas": "ALERTAS",
    "/fuentes-rss": "FUENTES Y RSS",
    "/notificaciones": "NOTIFICACIONES",
    "/perfil": "PERFIL",
  };

  const currentSectionTitle = sectionTitleByPath[location.pathname] ?? "DASHBOARD";

  useEffect(() => {
    const token = globalThis.localStorage.getItem("token");
    const userId = globalThis.localStorage.getItem("userId");

    if (!token || !userId) {
      return;
    }

    const roleIdToLabel = (roleIds: number[]): string => {
      if (roleIds.includes(3)) {
        return "Admin";
      }

      if (roleIds.includes(1)) {
        return "Gestor";
      }

      return "Lector";
    };

    const controller = new AbortController();

    const fetchCurrentUser = async () => {
      try {
        const apiBaseUrl = import.meta.env.VITE_API_BASE_URL ?? "http://localhost:8000";
        const response = await fetch(`${apiBaseUrl}/api/v1/users/${userId}`, {
          method: "GET",
          headers: {
            Authorization: `Bearer ${token}`,
            "Content-Type": "application/json",
          },
          signal: controller.signal,
        });

        if (!response.ok) {
          return;
        }

        const data = (await response.json()) as {
          first_name?: string;
          last_name?: string;
          role_ids?: unknown;
        };

        const firstName = (data.first_name ?? "Usuario").trim();
        const lastName = (data.last_name ?? "").trim();
        const fullName = `${firstName} ${lastName}`.trim();
        const firstInitial = firstName.charAt(0).toUpperCase();
        const lastInitial = lastName.charAt(0).toUpperCase();
        const initials = `${firstInitial}${lastInitial}` || "US";
        const parsedRoleIds = parseStoredRoles(
          data.role_ids ? JSON.stringify(data.role_ids) : null
        );

        setUserName(fullName);
        setUserRole(roleIdToLabel(parsedRoleIds));
        setUserInitials(initials);
      } catch {
        // Keep fallback local values if profile cannot be loaded.
      }
    };

    fetchCurrentUser();

    return () => {
      controller.abort();
    };
  }, []);

  const handleLanguageChange = (language: "es" | "en") => {
    setActiveLanguage(language);
    onLanguageChange(language);
  };

  return (
    <div className="app-container">
      <aside className={`sidebar ${isSidebarOpen ? "" : "closed"}`}>
        <div className="brand-section app-brand-section">
          <img
            src={`${import.meta.env.BASE_URL}newsradar-logo.png`}
            alt="NewsRadar Logo"
            className="app-brand-logo"
          />
          <span>NewsRadar</span>
        </div>

        <LanguageSwitcher
          activeLanguage={activeLanguage}
          onLanguageChange={handleLanguageChange}
        />

        <nav className="nav-container">
          <ul className="nav-links">
            <li>
              <NavLink to="/dashboard" className="nav-item">
                <LayoutDashboard size={20} />
                <span>Dashboard</span>
              </NavLink>
            </li>
            <li>
              <NavLink to="/resumen" className="nav-item">
                <LayoutDashboard size={20} />
                <span>Resumen</span>
              </NavLink>
            </li>
            {canManageSections && (
              <>
                <li>
                  <NavLink to="/alertas" className="nav-item">
                    <Bell size={20} />
                    <span>Alertas</span>
                  </NavLink>
                </li>
                <li>
                  <NavLink to="/fuentes-rss" className="nav-item">
                    <Rss size={20} />
                    <span>Fuentes y RSS</span>
                  </NavLink>
                </li>
              </>
            )}
            <li>
              <NavLink to="/notificaciones" className="nav-item">
                <Inbox size={20} />
                <span>Notificaciones</span>
              </NavLink>
            </li>
            <li>
              <NavLink to="/perfil" className="nav-item">
                <UserCog size={20} />
                <span>Perfil</span>
              </NavLink>
            </li>
          </ul>

          <div className="nav-footer">
            <button onClick={handleLogout} className="logout-button">
              <LogOut size={20} />
              <span>Cerrar Sesion</span>
            </button>
          </div>
        </nav>
      </aside>

      <main className="layout-main">
        <header className="top-bar">
          <div className="top-bar-left">
            <button
              type="button"
              className="sidebar-toggle-button"
              onClick={() => setIsSidebarOpen(!isSidebarOpen)}
              aria-label={isSidebarOpen ? "Cerrar menú lateral" : "Abrir menú lateral"}
            >
              <Menu size={20} />
            </button>
            <h1 className="top-bar-title">{currentSectionTitle}</h1>
          </div>

          <Link
            to="/perfil"
            className="user-badge-link"
            aria-label="Ir al perfil del usuario logueado"
          >
            <div className="user-badge" aria-label="Usuario logueado">
              <div className="user-badge-avatar" aria-hidden="true">
                {userInitials}
              </div>
              <div className="user-badge-info">
                <span className="user-badge-name">{userName}</span>
                <span className="user-badge-role">{userRole}</span>
              </div>
            </div>
          </Link>
        </header>

        <div className="layout-content">
          <Outlet />
        </div>
      </main>
    </div>
  );
};

function App() {
  const { logout, isAuthenticated } = useAuth();
  const navigate = useNavigate();
  const hasStoredToken = Boolean(globalThis.localStorage.getItem("token"));
  const isSessionAuthenticated = isAuthenticated || hasStoredToken;
  const [canManageSections, setCanManageSections] = useState<boolean>(() =>
    canAccessManagementSections(getStoredUserRoles()),
  );
  const [isCheckingAuth, setIsCheckingAuth] = useState<boolean>(() =>
    hasStoredToken,
  );

  useEffect(() => {
    const validateSession = async () => {
      const token = globalThis.localStorage.getItem("token");
      const userId = globalThis.localStorage.getItem("userId");

      if (!token || !userId) {
        setIsCheckingAuth(false);
        setCanManageSections(false);
        return;
      }

      try {
        const apiBaseUrl = import.meta.env.VITE_API_BASE_URL ?? "http://localhost:8000";
        const response = await fetch(`${apiBaseUrl}/api/v1/users/${userId}`, {
          method: "GET",
          headers: {
            Authorization: `Bearer ${token}`,
            "Content-Type": "application/json",
          },
        });

        if (response.status === 401) {
          logout();
          navigate("/login", { replace: true });
          setIsCheckingAuth(false);
          return;
        }

        if (!response.ok) {
          throw new Error("Session validation failed");
        }

        const userRoles = getStoredUserRoles();
        setCanManageSections(canAccessManagementSections(userRoles));
      } catch (error) {
        console.error("Session validation error:", error);
        logout();
        navigate("/login", { replace: true });
      } finally {
        setIsCheckingAuth(false);
      }
    };

    if (isSessionAuthenticated) {
      validateSession();
    } else {
      setIsCheckingAuth(false);
      setCanManageSections(false);
    }
  }, [isSessionAuthenticated, logout, navigate]);

  const handleLogout = () => {
    logout();
    navigate("/login", { replace: true });
  };

  if (isCheckingAuth) {
    return (
      <div className="auth-checking" role="status" aria-live="polite">
        <span className="auth-checking-spinner" aria-hidden="true" />
        <span>Cargando…</span>
      </div>
    );
  }

  return (
    <Routes>
      <Route path="/verify-email" element={<VerifyEmail />} />
      <Route path="/forgot-password" element={<ForgotPassword />} />
      <Route path="/reset-password" element={<ResetPassword />} />
      <Route
        path="/"
        element={
          isSessionAuthenticated ? (
            <ProtectedLayout
              handleLogout={handleLogout}
              canManageSections={canManageSections}
              onLanguageChange={() => {}}
            />
          ) : (
            <Navigate to="/login" replace />
          )
        }
      >
        <Route index element={<Navigate to="/dashboard" replace />} />
        <Route path="dashboard" element={<DashboardPage />} />
        <Route path="resumen" element={<ResumenPage />} />
        <Route
          path="alertas"
          element={
            canManageSections ? (
              <AlertsManagement onLogout={handleLogout} />
            ) : (
              <Navigate to="/dashboard" replace />
            )
          }
        />
        <Route
          path="fuentes-rss"
          element={
            canManageSections ? (
              <SourcesRss />
            ) : (
              <Navigate to="/dashboard" replace />
            )
          }
        />
        <Route path="notificaciones" element={<NotificationsPage />} />
        <Route path="perfil" element={<ProfilePage />} />
      </Route>
      <Route path="/login" element={<Auth />} />
      <Route
        path="*"
        element={
          isSessionAuthenticated ? (
            <Navigate to="/dashboard" replace />
          ) : (
            <Navigate to="/login" replace />
          )
        }
      />
    </Routes>
  );
}

export default App;