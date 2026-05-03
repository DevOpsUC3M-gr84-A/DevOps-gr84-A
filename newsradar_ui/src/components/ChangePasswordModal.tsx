import React, { useState } from "react";
import { Eye, EyeOff } from "lucide-react";
import "../pages/ProfilePage.css"; 

const API_BASE_URL = import.meta.env.VITE_API_BASE_URL ?? "http://localhost:8000";

const STRONG_PASSWORD_REGEX = /^(?=.*[A-Z])(?=.*\d)(?=.*[^A-Za-z0-9]).{8,}$/;

interface ChangePasswordModalProps {
  isOpen: boolean;
  onClose: () => void;
  token: string | null;
  onSuccess: (message: string) => void;
}

export const ChangePasswordModal: React.FC<ChangePasswordModalProps> = ({
  isOpen,
  onClose,
  token,
  onSuccess,
}) => {
  const [formData, setFormData] = useState({ current: "", new: "", confirm: "" });
  const [error, setError] = useState<string | null>(null);
  const [isSubmitting, setIsSubmitting] = useState(false);

  // Estados para controlar la visibilidad de cada contraseña
  const [showCurrent, setShowCurrent] = useState(false);
  const [showNew, setShowNew] = useState(false);
  const [showConfirm, setShowConfirm] = useState(false);

  if (!isOpen) return null;

  const resetStates = () => {
    setFormData({ current: "", new: "", confirm: "" });
    setShowCurrent(false);
    setShowNew(false);
    setShowConfirm(false);
    setError(null);
  };

  const handleSubmit = async () => {
    if (formData.new !== formData.confirm) {
      setError("Las contraseñas no coinciden.");
      return;
    }
    if (!STRONG_PASSWORD_REGEX.test(formData.new)) {
      setError("La contraseña debe tener al menos 8 caracteres, una mayúscula, un número y un carácter especial.");
      return;
    }

    if (!formData.current) {
      setError("Debes introducir tu contraseña actual.");
      return;
    }

    setIsSubmitting(true);
    setError(null);

    try {
      const userId = globalThis.localStorage.getItem("userId");
      const response = await fetch(`${API_BASE_URL}/api/v1/users/${userId}/password`, {
        method: "PUT",
        headers: {
          Authorization: `Bearer ${token}`,
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          current_password: formData.current,
          new_password: formData.new,
        }),
      });

      if (!response.ok) {
        const errorData = await response.json();
        throw new Error(errorData.detail || "Error al cambiar la contraseña.");
      }

      onSuccess("Tu contraseña se ha actualizado correctamente.");
      resetStates(); // Limpiamos inputs y ocultamos contraseñas
      onClose(); // Cerramos el modal
    } catch (err) {
      setError(err instanceof Error ? err.message : "Error desconocido.");
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleCancel = () => {
    resetStates();
    onClose();
  };

  // Estilo reutilizable para el botón del ojo
  const eyeButtonStyle: React.CSSProperties = {
    position: "absolute",
    right: "12px",
    top: "50%",
    transform: "translateY(-50%)",
    background: "none",
    border: "none",
    cursor: "pointer",
    color: "#64748b",
    display: "flex",
    alignItems: "center",
    justifyContent: "center",
    padding: "0"
  };

  return (
    <div className="delete-account-modal-overlay">
      <dialog open className="delete-account-modal-card">
        <h2>Cambiar Contraseña</h2>

        <label className="delete-account-label">Contraseña actual</label>
        <div style={{ position: "relative" }}>
          <input
            id = "current-password"
            type={showCurrent ? "text" : "password"}
            className="delete-account-input"
            value={formData.current}
            onChange={(e) => setFormData({ ...formData, current: e.target.value })}
            placeholder="••••••••"
            style={{ paddingRight: "40px" }}
          />
          <button type="button" onClick={() => setShowCurrent(!showCurrent)} style={eyeButtonStyle}>
            {showCurrent ? <EyeOff size={18} /> : <Eye size={18} />}
          </button>
        </div>

        <label className="delete-account-label" style={{ marginTop: "10px" }}>Nueva contraseña</label>
        <div style={{ position: "relative" }}>
          <input
            id = "new-password"
            type={showNew ? "text" : "password"}
            className="delete-account-input"
            value={formData.new}
            onChange={(e) => setFormData({ ...formData, new: e.target.value })}
            placeholder="••••••••"
            style={{ paddingRight: "40px" }}
          />
          <button type="button" onClick={() => setShowNew(!showNew)} style={eyeButtonStyle}>
            {showNew ? <EyeOff size={18} /> : <Eye size={18} />}
          </button>
        </div>
        <p style={{ fontSize: "0.75rem", color: "#64748b", margin: "4px 0 0 0", lineHeight: "1.4" }}>
          Debe tener al menos 8 caracteres, incluir una mayúscula, un número y un carácter especial.
        </p>

        <label className="delete-account-label" style={{ marginTop: "10px" }}>Confirmar nueva contraseña</label>
        <div style={{ position: "relative" }}>
          <input
            id = "confirm-password"
            type={showConfirm ? "text" : "password"}
            className="delete-account-input"
            value={formData.confirm}
            onChange={(e) => setFormData({ ...formData, confirm: e.target.value })}
            placeholder="••••••••"
            style={{ paddingRight: "40px" }}
          />
          <button type="button" onClick={() => setShowConfirm(!showConfirm)} style={eyeButtonStyle}>
            {showConfirm ? <EyeOff size={18} /> : <Eye size={18} />}
          </button>
        </div>

        {error && <p className="delete-account-error" style={{ marginTop: "10px", color: "#ef4444" }}>{error}</p>}

        <div className="delete-account-actions" style={{ marginTop: "20px" }}>
          <button type="button" className="delete-account-cancel" onClick={handleCancel}>
            Cancelar
          </button>
          <button
            type="button"
            className="profile-save-button"
            onClick={handleSubmit}
            disabled={isSubmitting}
          >
            {isSubmitting ? "Actualizando..." : "Actualizar Contraseña"}
          </button>
        </div>
      </dialog>
    </div>
  );
};
