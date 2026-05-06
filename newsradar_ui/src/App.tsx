// @ts-ignore: CSS module declaration not found
import React, { useState, useEffect, lazy, Suspense } from "react";

import "./App.css";
import {
  Bell,
  CheckCheck,
  Menu,
  Rss,
  LayoutDashboard,
  UserCog,
  Inbox,
  LogOut,
  Cloud,
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
import { Auth } from "./pages/Auth";
import { useAuth } from "./hooks/useAuth";
import { normalizeRoleToId } from "./utils/roleUtils";
import { useI18n } from "./i18n/i18n";
import { LanguageToggle } from "./components/LanguageToggle";

const AlertsManagement = lazy(
  () =>
    import("./pages/AlertsManagement").then((module) => ({
      default: module.AlertsManagement,
    })),
);
const SourcesRss = lazy(
  () => import("./pages/SourcesRss").then((module) => ({ default: module.SourcesRss })),
);
const ProfilePage = lazy(
  () => import("./pages/ProfilePage").then((module) => ({ default: module.ProfilePage })),
);
const Dashboard = lazy(
  () => import("./pages/Dashboard").then((module) => ({ default: module.Dashboard })),
);
const ResumenPage = lazy(
  () => import("./pages/Resumen").then((module) => ({ default: module.ResumenPage })),
);
const VerifyEmail = lazy(
  () => import("./pages/VerifyEmail").then((module) => ({ default: module.VerifyEmail })),
);
const ForgotPassword = lazy(
  () => import("./pages/ForgotPassword").then((module) => ({ default: module.ForgotPassword })),
);
const ResetPassword = lazy(
  () => import("./pages/ResetPassword").then((module) => ({ default: module.ResetPassword })),
);

interface ProtectedLayoutProps {
  handleLogout: () => void;
  canManageSections: boolean;
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

  const legacyRoles = parseStoredRoles(globalThis.localStorage.getItem("role_ids"));
  if (legacyRoles.length > 0) {
    return legacyRoles;
  }

  return parseStoredRoles(globalThis.localStorage.getItem("userRole"));
};

const canAccessManagementSections = (roles: number[]): boolean =>
  roles.includes(1) || roles.includes(3);
interface NotificationItem {
  id: number;
  title: string;
  message: string;
  created_at: string;
  is_read: boolean;
}

const API_BASE_URL =
  import.meta.env.VITE_API_BASE_URL ?? "http://localhost:8000";

const NOTIFICATION_PREVIEW_MAX_LENGTH = 250;

const stripHtmlTagsLinear = (input: string): string => {
  let result = "";
  let insideTag = false;
  for (const ch of input) {
    if (insideTag) {
      if (ch === ">") insideTag = false;
    } else if (ch === "<") {
      insideTag = true;
    } else {
      result += ch;
    }
  }
  return result;
};

const stripHtmlAndTruncate = (
  html: string,
  maxLength: number = NOTIFICATION_PREVIEW_MAX_LENGTH,
): string => {
  if (!html) return "";

  let plainText = "";
  if (typeof DOMParser === "undefined") {
    plainText = stripHtmlTagsLinear(html);
  } else {
    try {
      const doc = new DOMParser().parseFromString(html, "text/html");
      plainText = doc.body?.textContent ?? "";
    } catch {
      plainText = stripHtmlTagsLinear(html);
    }
  }

  plainText = plainText.replaceAll(/\s+/g, " ").trim();

  if (plainText.length > maxLength) {
    return `${plainText.slice(0, maxLength)}...`;
  }
  return plainText;
};

const NotificationsPage = () => {
  const { t } = useI18n();
  const [notifications, setNotifications] = useState<NotificationItem[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    const userId = globalThis.localStorage.getItem("userId");
    const token = globalThis.localStorage.getItem("token");

    if (!userId || !token) {
      setIsLoading(false);
      setError(t("notifications.invalidSession"));
      return;
    }

    let cancelled = false;

    const loadNotifications = async () => {
      try {
        const response = await fetch(
          `${API_BASE_URL}/api/v1/users/${userId}/notifications?limit=30`,
          { headers: { Authorization: `Bearer ${token}` } },
        );

        if (!response.ok) throw new Error(`Error ${response.status}`);

        const data = await response.json();
        if (cancelled) return;

        const items: NotificationItem[] = Array.isArray(data)
          ? data.map((raw: any) => ({
              id: Number(raw?.id),
              title: String(raw?.title ?? ""),
              message: String(raw?.message ?? ""),
              created_at: String(raw?.created_at ?? ""),
              is_read: Boolean(raw?.is_read),
            }))
          : [];

        setNotifications(items);
        setError(null);
      } catch (err) {
        if (cancelled) return;
        setError(
          err instanceof Error ? err.message : t("notifications.loadError"),
        );
      } finally {
        if (!cancelled) setIsLoading(false);
      }
    };

    void loadNotifications();
    return () => { cancelled = true; };
  }, []);

  const markAsRead = async (notificationId: number) => {
    const userId = globalThis.localStorage.getItem("userId");
    const token = globalThis.localStorage.getItem("token");

    if (!userId || !token) { setError(t("notifications.invalidSession")); return; }

    try {
      const response = await fetch(
        `${API_BASE_URL}/api/v1/users/${userId}/notifications/${notificationId}/read`,
        { method: "PUT", headers: { Authorization: `Bearer ${token}` } },
      );

      if (!response.ok) throw new Error(`Error ${response.status}`);

      setNotifications((current) =>
        current.map((item) =>
          item.id === notificationId ? { ...item, is_read: true } : item,
        ),
      );
      setError(null);
    } catch (err) {
      setError(err instanceof Error ? err.message : t("notifications.markReadError"));
    }
  };

  const clearMailbox = async () => {
    const userId = globalThis.localStorage.getItem("userId");
    const token = globalThis.localStorage.getItem("token");

    if (!userId || !token) { setError(t("notifications.invalidSession")); return; }

    try {
      const response = await fetch(
        `${API_BASE_URL}/api/v1/users/${userId}/notifications`,
        { method: "DELETE", headers: { Authorization: `Bearer ${token}` } },
      );

      if (!response.ok && response.status !== 204) {
        throw new Error(`Error ${response.status}`);
      }

      setNotifications([]);
      setError(null);
    } catch (err) {
      setError(err instanceof Error ? err.message : t("notifications.clearError"));
    }
  };

  const formatDate = (iso: string): string => {
    if (!iso) return "";
    const d = new Date(iso);
    return Number.isNaN(d.getTime()) ? iso : d.toLocaleString();
  };

  return (
    <section className="main-content">
      <header className="page-heading">
        <div className="notifications-toolbar">
          <div>
            <h1 className="section-title">{t("notifications.title")}</h1>
            <p className="section-subtitle">{t("notifications.subtitle")}</p>
          </div>
          <button
            type="button"
            className="notifications-clear-button"
            aria-label="Limpiar Buzon"
            onClick={() => void clearMailbox()}
            disabled={isLoading || notifications.length === 0}
          >
            {t("notifications.clearMailbox")}
          </button>
        </div>
      </header>

      {isLoading && <p className="form-hint-text">{t("notifications.loading")}</p>}

      {error && (
        <div className="alert-feedback alert-feedback-error" role="alert" aria-live="assertive">
          {error}
        </div>
      )}

      {!isLoading && !error && notifications.length === 0 && (
        <p className="form-hint-text">{t("notifications.empty")}</p>
      )}

      {!isLoading && !error && notifications.length > 0 && (
        <ul className="notifications-list">
          {notifications.map((n) => (
            <li
              key={n.id}
              className={`notification-item ${n.is_read ? "notification-read" : "notification-unread"}`}
            >
              <div className="notification-item-header">
                <h3 className="notification-title">{n.title}</h3>
                <span className="notification-date">{formatDate(n.created_at)}</span>
              </div>
              <p className="notification-message">{stripHtmlAndTruncate(n.message)}</p>
              <div className="notification-actions">
                {!n.is_read && (
                  <button
                    type="button"
                    className="notification-read-button"
                    aria-label="Marcar como leida"
                    onClick={() => void markAsRead(n.id)}
                  >
                    <CheckCheck size={16} />
                    {t("notifications.markAsRead")}
                  </button>
                )}
                {n.is_read && (
                  <span className="notification-read-label">{t("notifications.read")}</span>
                )}
              </div>
            </li>
          ))}
        </ul>
      )}
    </section>
  );
};

const ProtectedLayout = ({
  handleLogout,
  canManageSections,
}: ProtectedLayoutProps) => {
  const location = useLocation();
  const { t } = useI18n();
  const [isSidebarOpen, setIsSidebarOpen] = useState(true);
  const [userName, setUserName] = useState("Usuario");
  const [userRole, setUserRole] = useState(() => t("roles.lector"));
  const [userInitials, setUserInitials] = useState("US");
  const [userAvatar, setUserAvatar] = useState<string | null>(null);

  const sectionTitleByPath: Record<string, string> = {
    "/dashboard": t("nav.dashboard").toUpperCase(),
    "/resumen": t("nav.resumen").toUpperCase(),
    "/alertas": t("nav.alerts").toUpperCase(),
    "/fuentes-rss": t("nav.sourcesRss").toUpperCase(),
    "/notificaciones": t("nav.notifications").toUpperCase(),
    "/perfil": t("nav.profile").toUpperCase(),
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
        return t("roles.admin");
      }

      if (roleIds.includes(1)) {
        return t("roles.gestor");
      }

      return t("roles.lector");
    };

    let cancelled = false;

    const fetchCurrentUser = async () => {
      try {
        const apiBaseUrl = import.meta.env.VITE_API_BASE_URL ?? "http://localhost:8000";
        const response = await fetch(`${apiBaseUrl}/api/v1/users/${userId}`, {
          method: "GET",
          headers: {
            Authorization: `Bearer ${token}`,
            "Content-Type": "application/json",
          },
        });

        if (!response.ok || cancelled) {
          return;
        }

        const data = (await response.json()) as {
          first_name?: string;
          last_name?: string;
          role_ids?: unknown;
          avatar?: string;
        };
        if (cancelled) return;

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
        setUserAvatar(data.avatar || null);
      } catch {
        // Keep fallback local values if profile cannot be loaded.
      }
    };

    fetchCurrentUser();

    return () => {
      cancelled = true;
    };
  }, []);

  return (
    <div className="app-container">
      <aside className={`sidebar ${isSidebarOpen ? "" : "closed"}`}>
        <div className="brand-section app-brand-section">
          <img
            src={`${import.meta.env.BASE_URL}newsradar-logo-white.png`}
            alt="NewsRadar Logo"
            className="app-brand-logo"
          />
          <span>NewsRadar</span>
        </div>

        <LanguageToggle />

        <nav className="nav-container">
          <ul className="nav-links">
            <li>
              <NavLink to="/dashboard" className="nav-item">
                <LayoutDashboard size={20} />
                <span>{t("nav.dashboard")}</span>
              </NavLink>
            </li>
            <li>
              <NavLink to="/resumen" className="nav-item">
                <Cloud size={20} />
                <span>{t("nav.resumen")}</span>
              </NavLink>
            </li>
            {canManageSections && (
              <>
                <li>
                  <NavLink to="/alertas" className="nav-item">
                    <Bell size={20} />
                    <span>{t("nav.alerts")}</span>
                  </NavLink>
                </li>
                <li>
                  <NavLink to="/fuentes-rss" className="nav-item">
                    <Rss size={20} />
                    <span>{t("nav.sourcesRss")}</span>
                  </NavLink>
                </li>
              </>
            )}
            <li>
              <NavLink to="/notificaciones" className="nav-item">
                <Inbox size={20} />
                <span>{t("nav.notifications")}</span>
              </NavLink>
            </li>
            <li>
              <NavLink to="/perfil" className="nav-item">
                <UserCog size={20} />
                <span>{t("nav.profile")}</span>
              </NavLink>
            </li>
          </ul>

          <div className="nav-footer">
            <button onClick={handleLogout} className="logout-button">
              <LogOut size={20} aria-hidden="true" />
              <span>{t("nav.logout")}</span>
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
              aria-label={isSidebarOpen ? t("nav.closeSidebar") : t("nav.openSidebar")}
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
              <div className="user-badge-avatar" aria-hidden="true" style={{ padding: userAvatar ? 0 : undefined, overflow: 'hidden' }}>
                {userAvatar ? (
                  <img
                    src={userAvatar}
                    alt="Avatar"
                    style={{ width: "100%", height: "100%", objectFit: "cover", display: "block" }}
                  />
                ) : (
                  userInitials
                )}
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

  const { t } = useI18n();

  useEffect(() => {
    const validateSession = async () => {
      const token = globalThis.localStorage.getItem("token");
      const userId = globalThis.localStorage.getItem("userId");

      if (!token || !userId) {
        if (isAuthenticated) {
          setIsCheckingAuth(false);
          return;
        }

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
        <span>{t("common.loading")}</span>
      </div>
    );
  }

  return (
    <Suspense fallback={<div className="app-loading">{t("common.loading")}</div>}>
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
              />
            ) : (
              <Navigate to="/login" replace />
            )
          }
        >
          <Route index element={<Navigate to="/dashboard" replace />} />
          <Route path="dashboard" element={<Dashboard />} />
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
    </Suspense>
  );
}

export default App;