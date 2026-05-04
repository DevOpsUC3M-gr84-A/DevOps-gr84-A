import React, { useEffect, useState } from "react";
import { ChangePasswordModal } from "../components/ChangePasswordModal";
import { ProfileHeader } from "../components/ProfileHeader";
import { useNavigate } from "react-router-dom";
import {
  Key,
  RefreshCw,
  Mail,
  AlertTriangle,
  Trash2,
  Pencil,
  Save,
  X,
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
  avatar?: string;
  banner?: string;
}

export const ProfilePage: React.FC = () => {
  const { token, logout } = useAuth();
  const navigate = useNavigate();
  const [profile, setProfile] = useState<UserProfile | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  
  // Estados de edición
  const [isEditing, setIsEditing] = useState(false);
  const [isSaving, setIsSaving] = useState(false);
  const [saveError, setSaveError] = useState<string | null>(null);
  const [editFormData, setEditFormData] = useState({
    first_name: "",
    last_name: "",
    organization: "",
  });

  // Estados para mensajes de seguridad
  const [verificationMessage, setVerificationMessage] = useState<{
    type: "success" | "error";
    text: string;
  } | null>(null);
  const [passwordMessage, setPasswordMessage] = useState<{
    type: "success" | "error";
    text: string;
  } | null>(null);

  // Estados para eliminación de cuenta
  const [isDeleteModalOpen, setIsDeleteModalOpen] = useState(false);
  const [deletePassword, setDeletePassword] = useState("");
  const [deleteError, setDeleteError] = useState<string | null>(null);
  const [isDeleting, setIsDeleting] = useState(false);

  const [isPasswordModalOpen, setIsPasswordModalOpen] = useState(false);

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

  // Manejo de edición de perfil
  const handleEditClick = () => {
    setEditFormData({
      first_name: profile?.first_name || "",
      last_name: profile?.last_name || "",
      organization: profile?.organization || "",
    });
    setIsEditing(true);
    setSaveError(null);
  };

  const handleCancelEdit = () => {
    setIsEditing(false);
    setSaveError(null);
  }

  const handleSaveProfile = async () => {
    setSaveError(null);
    setIsSaving(true);
    try {
      const userId = globalThis.localStorage.getItem("userId");
      const response = await fetch(`${API_BASE_URL}/api/v1/users/${userId}`, {
        method: "PUT",
        headers: {
          Authorization: `Bearer ${token}`,
          "Content-Type": "application/json",
        },
        body: JSON.stringify(editFormData),
      });

      if (!response.ok) {
        const errorData = await response.json();
        throw new Error(errorData.detail || "Error al actualizar perfil");
      }
      const updatedProfile: UserProfile = await response.json();
      setProfile(updatedProfile);
      setIsEditing(false);
    } catch (err) {
      setSaveError(err instanceof Error ? err.message : "Error desconocido");
    } finally {
      setIsSaving(false);
    }
  }

  // Función para guardar las fotos directamente en la base de datos
const handleImageUpdate = async (type: "avatar" | "banner", base64Data: string | null) => {
    try {
      // 1. Actualización Optimista: Mostramos la foto al usuario inmediatamente
      setProfile(prev => prev ? { ...prev, [type]: base64Data } : null);

      const userId = globalThis.localStorage.getItem("userId");
      const payload = { [type]: base64Data };

      const response = await fetch(`${API_BASE_URL}/api/v1/users/${userId}`, {
        method: "PUT",
        headers: {
          Authorization: `Bearer ${token}`,
          "Content-Type": "application/json",
        },
        body: JSON.stringify(payload),
      });

      if (!response.ok) {
        throw new Error("Error al guardar la imagen en el servidor");
      }
    } catch (err) {
      console.error(err);
      alert("Hubo un error al intentar guardar la imagen.");
    }
  };

  // Lógica de seguridad
  const handlePasswordResetRequest = async () => {
    setPasswordMessage(null);
    try {
      const response = await fetch(`${API_BASE_URL}/api/v1/auth/forgot-password`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({ email: profile?.email }),
      });

      if (!response.ok) throw new Error ("Error al solicitar reset");
      setPasswordMessage({
        type: "success",
        text: "Recibirás un correo para restablecer tu contraseña.",
      });
    } catch (err) {
      setPasswordMessage({
        type: "error",
        text: err instanceof Error ? err.message : "No se pudo procesar la solicitud.",
      });
    }
  }

  const handleResendVerification = async () => {
    setVerificationMessage(null);
    try {
      const response = await fetch(`${API_BASE_URL}/api/v1/auth/verify-email`, {
        method: "POST",
        headers: {
          Authorization: `Bearer ${token}`,
          "Content-Type": "application/json",
        },
        body: JSON.stringify({ email: profile?.email }),
      });
      if (!response.ok) throw new Error("Error al reenviar correo de verificación");
      setVerificationMessage({
        type: "success",
        text: "Te hemos reenviado un correo de verificación.",
      });
    } catch (err) {
      setVerificationMessage({
        type: "error",
        text: err instanceof Error ? err.message : "No se pudo reenviar el correo de verificación.",
      });
    }
  };

  // Borrado de cuenta
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
        } catch {}
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

  if (loading) {
    return (
      <main className="profile-page">
        <div className="loading-state" role="status" aria-live="polite">
          <p>Cargando perfil...</p>
        </div>
      </main>
    );
  }

  if (error || !profile) {
    return (
      <main className="profile-page">
        <div role="alert" className="error-alert">
          {error || "No se pudo cargar el perfil"}
        </div>
      </main>
    );
  }

  const roleSet = new Set(profile.role_ids || []);
  let roleLabel = "Lector";
  if (roleSet.has(3)) roleLabel = "Administrador";
  else if (roleSet.has(1)) roleLabel = "Gestor";

  const isAdmin = roleSet.has(3);
  const isEmailVerified = profile.is_verified === true || profile.email_verified === true || profile.is_active === true;

  const openPasswordModal = () => {
      setIsPasswordModalOpen(true);
      setPasswordMessage(null); // Limpia mensajes anteriores de éxito/error
    };

  return (
    <main className="profile-page" aria-labelledby="profile-title">
      <div className="profile-container">
        <ProfileHeader 
          firstName={profile.first_name} 
          lastName={profile.last_name} 
          roleLabel={roleLabel} 
          isVerified={isEmailVerified} 
          avatar={profile.avatar}
          banner={profile.banner}
          onImageUpdate={handleImageUpdate}
        />
        <div className="profile-layout">
          <section className="profile-main-column" aria-label="Información y gestión">
            <article className="profile-card" aria-label="Información personal">
              <div className="profile-card-header">
                <h2>Información Personal</h2>
              </div>
              {saveError && <div className="error-alert" style={{ marginBottom: "1rem" }}>{saveError}</div>}

              <div className="form-row-split">
                <div className="profile-field">
                  <label htmlFor="first_name">Nombre:</label>
                  {isEditing ? (
                    <input
                      id="first_name"
                      className="profile-edit-input"
                      value={editFormData.first_name}
                      onChange={(e) => setEditFormData({ ...editFormData, first_name: e.target.value })}
                    />
                  ) : (
                    <p id="name-display">{profile.first_name}</p>
                  )}
                </div>

                <div className="profile-field">
                  <label htmlFor="last_name">Apellido/s:</label>
                  {isEditing ? (
                    <input
                      id="last_name"
                      className="profile-edit-input"
                      value={editFormData.last_name}
                      onChange={(e) => setEditFormData({ ...editFormData, last_name: e.target.value })}
                    />
                  ) : <p>{profile.last_name}</p>}
                </div>
              </div>

              <div className="profile-field">
                <span style={{ "color": "#475569", "fontSize": "0.95rem", "textTransform": "uppercase", "letterSpacing": "0.05em", "fontWeight": "700" }}>
                  Email:</span>
                <p className="disabled-field">{profile.email} <small>(No editable)</small></p>
              </div>

              <div className="profile-field">
                <label htmlFor="organization">Organización:</label>
                {isEditing ? (
                  <input
                    id="organization"
                    className="profile-edit-input"
                    value={editFormData.organization}
                    onChange={(e) => setEditFormData({ ...editFormData, organization: e.target.value })}
                  />
                ) : <p>{profile.organization || "No especificada"}</p>}
              </div>

              <div className="profile-field">
                <span style={{ "color": "#475569", "fontSize": "0.95rem", "textTransform": "uppercase", "letterSpacing": "0.05em", "fontWeight": "700" }}>
                  Rol:</span>
                <p id="role-display" className="disabled-field">{roleLabel}</p>
              </div>

              <div className="profile-card-actions">
                {isEditing ? (
                  <div className="edit-actions">
                    <button type="button" className="profile-cancel-button" onClick={handleCancelEdit} disabled={isSaving}>
                      <X size={16} /> Cancelar
                    </button>
                    <button type="button" className="profile-save-button" onClick={handleSaveProfile} disabled={isSaving}>
                      <Save size={16} /> {isSaving ? "Guardando..." : "Guardar"}
                    </button>
                  </div>
                ) : (
                  <button type="button" className="profile-edit-button" onClick={handleEditClick}>
                    <Pencil size={16} /><span>Editar Perfil</span>
                  </button>
                )}
              </div>
            </article>

            {isAdmin && <UserManagementTable isAdmin={true} />}
          </section>

          <aside className="profile-side-column">
            <article className="security-card">
              <div className="profile-card-header">
                <h2>Seguridad</h2>
              </div>
              <div className="security-actions">
                {/* Cambiar contraseña*/}
                  <button 
                    type="button" 
                    className="security-action-link security-action-button" 
                    onClick={openPasswordModal}
                  >
                    <Key size={16} /><span>Cambiar contraseña</span>
                  </button>

                  {/* Recuperar acceso */}
                  <button 
                    type="button" 
                    className="security-action-link security-action-button" 
                    onClick={handlePasswordResetRequest}
                  >
                    <RefreshCw size={16} /><span>Recuperar acceso</span>
                  </button>
                
                {passwordMessage && (
                  <p className={`verification-message verification-message-${passwordMessage.type}`}>
                    {passwordMessage.text}
                  </p>
                )}
                <button
                  className="security-action-link security-action-button"
                  type="button"
                  onClick={handleResendVerification}
                  disabled={isEmailVerified}
                >
                  <Mail size={16} /> Verificar correo
                </button>
                {verificationMessage && (
                  <p className={`verification-message verification-message-${verificationMessage.type}`}>
                    {verificationMessage.text}
                  </p>
                )}
              </div>
            </article>

            <article className="danger-card">
              <div className="profile-card-header">
                <h2>Zona de Peligro</h2>
              </div>
              <div className="danger-content">
                <div className="danger-warning">
                  <AlertTriangle size={18} />
                  <p>
                    {isAdmin 
                      ? "Las cuentas de administrador no pueden ser eliminadas para garantizar la gestión del sistema." 
                      : "Eliminar la cuenta borra el acceso y los datos de forma permanente."}
                  </p>
                </div>
                
                {/* Solo mostrar el botón si no es administrador*/}
                {!isAdmin && (
                  <button type="button" className="danger-button" onClick={openDeleteModal}>
                    <Trash2 size={16} /><span>Eliminar Cuenta</span>
                  </button>
                )}
              </div>
            </article>
          </aside>
        </div>
      </div>

      {isDeleteModalOpen && (
        <div className="delete-account-modal-overlay">
          <dialog open className="delete-account-modal-card">
            <h2>Confirmar eliminación</h2>
            <p>Introduce tu contraseña para eliminar definitivamente tu cuenta.</p>
            <input
              type="password"
              className="delete-account-input"
              value={deletePassword}
              onChange={(e) => setDeletePassword(e.target.value)}
              placeholder="••••••••"
            />
            {deleteError && <p className="delete-account-error">{deleteError}</p>}
            <div className="delete-account-actions">
              <button type="button" className="delete-account-cancel" onClick={closeDeleteModal}>Cancelar</button>
              <button type="button" className="delete-account-confirm" onClick={handleDeleteAccount} disabled={isDeleting}>
                {isDeleting ? "Eliminando..." : "Eliminar"}
              </button>
            </div>
          </dialog>
        </div>
      )}

      <ChangePasswordModal
        isOpen={isPasswordModalOpen}
        onClose={() => setIsPasswordModalOpen(false)}
        token={token}
        onSuccess={(message) => {
          setPasswordMessage({ type: "success", text: message });
        }}
      />
    </main>
  );
};