import React, { useMemo, useState } from "react";
import { useI18n } from "../i18n/i18n";
import { Eye, EyeOff } from "lucide-react";
import { AuthLayout } from "../components/AuthLayout";

const API_BASE_URL =
  import.meta.env.VITE_API_BASE_URL ?? "http://localhost:8000";

interface ResetPasswordResponse {
  detail?: string;
}

export const ResetPassword = () => {
  const { t } = useI18n();
  const token = useMemo(
    () => new URLSearchParams(globalThis.location.search).get("token") ?? "",
    [],
  );
  const [newPassword, setNewPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [successMessage, setSuccessMessage] = useState<string | null>(null);
  const [showNewPassword, setShowNewPassword] = useState(false);
  const [showConfirmPassword, setShowConfirmPassword] = useState(false);

  const handleSubmit = async (event: React.SyntheticEvent) => {
    event.preventDefault();
    setErrorMessage(null);
    setSuccessMessage(null);

    if (!token) {
      setErrorMessage(t("resetPassword.invalidToken"));
      return;
    }

    if (newPassword !== confirmPassword) {
      setErrorMessage(t("resetPassword.mismatch"));
      return;
    }

    setIsSubmitting(true);

    try {
      const response = await fetch(
        `${API_BASE_URL}/api/v1/auth/reset-password`,
        {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            token,
            new_password: newPassword,
          }),
        },
      );

      const data = (await response.json()) as ResetPasswordResponse;

      if (!response.ok) {
        throw new Error(
          data.detail ??
            "No se pudo restablecer la contraseña. Inténtalo más tarde.",
        );
      }

      setSuccessMessage("Tu contraseña se ha actualizado correctamente.");
      setNewPassword("");
      setConfirmPassword("");
    } catch (error) {
      const message =
        error instanceof Error
          ? error.message
          : "Error inesperado al restablecer la contraseña.";
      setErrorMessage(message);
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <AuthLayout
      title={t("resetPassword.title")}
      description={t("resetPassword.description")}
      errorMessage={errorMessage}
      successMessage={successMessage}
      isSubmitting={isSubmitting}
      submitText={isSubmitting ? t("resetPassword.updating") : t("resetPassword.submitButton")}
      onSubmit={handleSubmit}
    >
      <div className="form-group" style={{ position: "relative" }}>
        <label htmlFor="new-password">{t("resetPassword.newPassword")}</label>
        <div
          style={{
            position: "relative",
            display: "flex",
            alignItems: "center",
          }}
        >
          <input
            id="new-password"
            type={showNewPassword ? "text" : "password"}
            value={newPassword}
            onChange={(event) => setNewPassword(event.target.value)}
            placeholder="••••••••"
            required
            autoComplete="new-password"
            style={{ paddingRight: 38, width: "100%" }}
          />
          <button
            type="button"
            aria-label={showNewPassword ? t("auth.hidePassword") : t("auth.showPassword")}
            onClick={() => setShowNewPassword((v) => !v)}
            style={{
              position: "absolute",
              right: 8,
              background: "none",
              border: "none",
              padding: 0,
              cursor: "pointer",
              display: "flex",
              alignItems: "center",
              justifyContent: "center",
              color: "#64748b",
            }}
            tabIndex={0}
          >
            {showNewPassword ? <EyeOff size={20} /> : <Eye size={20} />}
          </button>
        </div>
      </div>

      <div className="form-group" style={{ position: "relative" }}>
        <label htmlFor="confirm-password">{t("resetPassword.confirmPassword")}</label>
        <div
          style={{
            position: "relative",
            display: "flex",
            alignItems: "center",
          }}
        >
          <input
            id="confirm-password"
            type={showConfirmPassword ? "text" : "password"}
            value={confirmPassword}
            onChange={(event) => setConfirmPassword(event.target.value)}
            placeholder="••••••••"
            required
            autoComplete="new-password"
            style={{ paddingRight: 38, width: "100%" }}
          />
          <button
            type="button"
            aria-label={showConfirmPassword ? t("auth.hidePassword") : t("auth.showPassword")}
            onClick={() => setShowConfirmPassword((v) => !v)}
            style={{
              position: "absolute",
              right: 8,
              background: "none",
              border: "none",
              padding: 0,
              cursor: "pointer",
              display: "flex",
              alignItems: "center",
              justifyContent: "center",
              color: "#64748b",
            }}
            tabIndex={0}
          >
            {showConfirmPassword ? <EyeOff size={20} /> : <Eye size={20} />}
          </button>
        </div>
      </div>
    </AuthLayout>
  );
};
