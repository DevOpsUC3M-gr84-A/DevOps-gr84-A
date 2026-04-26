import React, { useEffect, useState } from "react";
import { Link, useNavigate } from "react-router-dom";
import {
  Key,
  RefreshCw,
  Mail,
  AlertTriangle,
  Trash2,
  Pencil,
  CheckCircle,
  XCircle,
} from "lucide-react";
import { useAuth } from "../hooks/useAuth";
import { UserManagementTable } from "../components/UserManagementTable";
import "./ProfilePage.css";

const API_BASE_URL = import.meta.env.VITE_API_BASE_URL ?? "http://localhost:8000";

interface UserProfile {
  id: number;
  email: string;
  first_name: string;
  last_name: string;
  organization?: string;
  role_ids: number[];
  is_verified?: boolean;
  email_verified?: boolean;
  is_active?: boolean;
}

/**
 * Página de perfil de usuario.
 * Muestra información del usuario logueado y gestión de usuarios si es Admin.
 */
export const ProfilePage: React.FC = () => {
  const { token, logout } = useAuth();
  const navigate = useNavigate();
  const [profile, setProfile] = useState<UserProfile | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [verificationMessage, setVerificationMessage] = useState<{
    type: "success" | "error";
    text: string;
  } | null>(null);
  const [isDeleteModalOpen, setIsDeleteModalOpen] = useState(false);
  const [deletePassword, setDeletePassword] = useState("");
  const [deleteError, setDeleteError] = useState<string | null>(null);
  const [isDeleting, setIsDeleting] = useState(false);

  useEffect(() => {
    if (!token) {
      setLoading(false);
      return;
    }

    const fetchProfile = async () => {
      try {
        const userId = globalThis.localStorage.getItem("userId");
        if (!userId) {
          setError("ID de usuario no encontrado");
          setLoading(false);
          return;
        }

        const response = await fetch(`${API_BASE_URL}/api/v1/users/${userId}`, {
          headers: {
            Authorization: `Bearer ${token}`,
            "Content-Type": "application/json",
          },
        });

        if (!response.ok) {
          const errorData = await response.json();
          setError(errorData.detail || "Error al cargar perfil");
          setLoading(false);
          return;
        }

        const data: UserProfile = await response.json();
        setProfile(data);
      } catch (err) {
        setError(err instanceof Error ? err.message : "Error desconocido");
      } finally {
        setLoading(false);
      }
    };

    fetchProfile();
  }, [token]);

  if (loading) {
    return (
      <main className="profile-page">
        <div className="loading-state" role="status" aria-live="polite">
          <p>Cargando perfil...</p>
        </div>
      </main>
    );
  }

  if (error) {
    return (
      <main className="profile-page">
        <div role="alert" className="error-alert">
          {error}
        </div>
      </main>
    );
  }

  if (!profile) {
    return (
      <main className="profile-page">
        <div role="alert" className="error-alert">
          No se pudo cargar el perfil
        </div>
      </main>
    );
  }

  const roleSet = new Set(profile.role_ids);
  let roleLabel = "Lector";

  if (roleSet.has(3)) {
    roleLabel = "Administrador";
  } else if (roleSet.has(1)) {
    roleLabel = "Gestor";
  }

  const isAdmin = roleSet.has(3);
  const isEmailVerified = profile.is_verified === true || profile.email_verified === true || profile.is_active === true;

  const handleResendVerification = async () => {
    setVerificationMessage(null);

    try {
      const response = await fetch(`${API_BASE_URL}/api/v1/auth/resend-verification`, {
        method: "POST",
        headers: {
          Authorization: `Bearer ${token}`,
          "Content-Type": "application/json",
        },
        body: JSON.stringify({ email: profile.email }),
      });

      if (!response.ok) {
        let detail = "No se pudo reenviar el correo de verificación.";

        try {
          const errorData = (await response.json()) as { detail?: unknown };

          if (typeof errorData.detail === "string") {
            detail = errorData.detail;
          }
        } catch {
          // Keep default detail when the API does not return valid JSON.
        }

        throw new Error(detail);
      }

      setVerificationMessage({
        type: "success",
        text: "Te hemos reenviado un correo de verificación.",
      });
    } catch (resendError) {
      const message =
        resendError instanceof Error
          ? resendError.message
          : "No se pudo reenviar el correo de verificación.";

      setVerificationMessage({ type: "error", text: message });
    }
  };

  const openDeleteModal = () => {
    setDeleteError(null);
    setDeletePassword("");
    setIsDeleteModalOpen(true);
  };

  const closeDeleteModal = () => {
    setIsDeleteModalOpen(false);
    setDeleteError(null);
    setDeletePassword("");
  };

  const handleDeleteAccount = async () => {
    if (!deletePassword.trim()) {
      setDeleteError("Debes introducir tu contraseña para continuar.");
      return;
    }

    const userId = globalThis.localStorage.getItem("userId");

    if (!userId) {
      setDeleteError("No se encontró el identificador de usuario.");
      return;
    }

    setDeleteError(null);
    setIsDeleting(true);

    try {
      const response = await fetch(`${API_BASE_URL}/api/v1/users/${userId}`, {
        method: "DELETE",
        headers: {
          Authorization: `Bearer ${token}`,
          "Content-Type": "application/json",
        },
        body: JSON.stringify({ password: deletePassword }),
      });

      if (!response.ok) {
        let detail = "No se pudo eliminar la cuenta.";

        try {
          const errorData = (await response.json()) as { detail?: unknown };
          if (typeof errorData.detail === "string") {
            detail = errorData.detail;
          }
        } catch {
          // Keep fallback message when response has no JSON body.
        }

        throw new Error(detail);
      }

      logout();
      navigate("/login", { replace: true });
    } catch (deleteAccountError) {
      setDeleteError(
        deleteAccountError instanceof Error
          ? deleteAccountError.message
          : "No se pudo eliminar la cuenta.",
      );
    } finally {
      setIsDeleting(false);
    }
  };

  return (
    <main className="profile-page" aria-labelledby="profile-title">
      <div className="profile-container">
        <header className="page-heading">
          <h1 id="profile-title" className="section-title">
            Perfil de Usuario
          </h1>
          <p className="section-subtitle">
            Gestiona tu información personal y configuración de cuenta.
          </p>
        </header>
        <div className="profile-layout">
          <section className="profile-main-column" aria-label="Información y gestión">
            <article className="profile-card" aria-label="Información personal">
              <div className="profile-card-header">
                <h2>Información Personal</h2>
              </div>

              <div className="form-row-split">
                <div className="profile-field">
                  <label htmlFor="name-display">Nombre:</label>
                  <p id="name-display">{profile.first_name}</p>
                </div>

                <div className="profile-field">
                  <label htmlFor="surname-display">Apellido:</label>
                  <p id="surname-display">{profile.last_name}</p>
                </div>
              </div>

              <div className="profile-field">
                <label htmlFor="email-display">Email:</label>
                <p id="email-display">{profile.email}</p>
              </div>

              {profile.organization && (
                <div className="profile-field">
                  <label htmlFor="org-display">Organización:</label>
                  <p id="org-display">{profile.organization}</p>
                </div>
              )}

              <div className="profile-field">
                <label htmlFor="role-display">Rol:</label>
                <p id="role-display">{roleLabel}</p>
              </div>

              <div className="profile-card-actions">
                <button type="button" className="profile-edit-button">
                  <Pencil size={16} />
                  <span>Editar Perfil</span>
                </button>
              </div>
            </article>

            {isAdmin && <UserManagementTable isAdmin={true} />}
          </section>

          <aside className="profile-side-column" aria-label="Acciones y seguridad">
            <article className="security-card">
              <div className="profile-card-header">
                <h2>Seguridad</h2>
              </div>

              <div className="security-actions">
                <Link to="/reset-password" className="security-action-link">
                  <Key size={16} />
                  <span>Cambiar contraseña</span>
                </Link>
                <Link to="/forgot-password" className="security-action-link">
                  <RefreshCw size={16} />
                  <span>Recuperar acceso</span>
                </Link>
                <button
                  className="security-action-link security-action-button"
                  type="button"
                  onClick={handleResendVerification}
                  disabled={isEmailVerified}
                >
                  <Mail size={16} aria-hidden="true" />
                  Verificar correo
                </button>

                <div
                  className={`email-verification-status ${
                    isEmailVerified ? "verified" : "not-verified"
                  }`}
                >
                  {isEmailVerified ? <CheckCircle size={16} /> : <XCircle size={16} />}
                  <span>{isEmailVerified ? "Email Verificado" : "No verificado"}</span>
                </div>

                {verificationMessage && (
                  <p
                    role="status"
                    aria-live="polite"
                    className={`verification-message verification-message-${verificationMessage.type}`}
                  >
                    {verificationMessage.text}
                  </p>
                )}
              </div>
            </article>

            <article className="danger-card">
              <div className="profile-card-header">
                <h2>¿Desea eliminar su cuenta?</h2>
              </div>

              <div className="danger-content">
                <div className="danger-warning">
                  <AlertTriangle size={18} />
                  <p>
                    Eliminar la cuenta borra el acceso y los datos asociados de forma
                    permanente.
                  </p>
                </div>

                <button type="button" className="danger-button" onClick={openDeleteModal}>
                  <Trash2 size={16} />
                  <span>Eliminar Cuenta</span>
                </button>
              </div>
            </article>
          </aside>
        </div>
      </div>

      {isDeleteModalOpen && (
        <div className="delete-account-modal-overlay" role="presentation">
          <div
            className="delete-account-modal-card"
            role="dialog"
            aria-modal="true"
            aria-labelledby="delete-account-title"
          >
            <h2 id="delete-account-title">Confirmar eliminación de cuenta</h2>
            <p>
              Esta acción es irreversible. Introduce tu contraseña para eliminar
              definitivamente tu cuenta.
            </p>

            <label htmlFor="delete-password-input" className="delete-account-label">
              Contraseña actual
            </label>
            <input
              id="delete-password-input"
              type="password"
              className="delete-account-input"
              value={deletePassword}
              onChange={(event) => setDeletePassword(event.target.value)}
              placeholder="••••••••"
            />

            {deleteError && (
              <p role="alert" className="delete-account-error">
                {deleteError}
              </p>
            )}

            <div className="delete-account-actions">
              <button
                type="button"
                className="delete-account-cancel"
                onClick={closeDeleteModal}
                disabled={isDeleting}
              >
                Cancelar
              </button>
              <button
                type="button"
                className="delete-account-confirm"
                onClick={handleDeleteAccount}
                disabled={isDeleting}
              >
                {isDeleting ? "Eliminando..." : "Eliminar definitivamente"}
              </button>
            </div>
          </div>
        </div>
      )}
    </main>
  );
};
