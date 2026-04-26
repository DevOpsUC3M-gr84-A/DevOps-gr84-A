import React, { useEffect, useState, useRef } from "react";
import { AlertCircle, MailCheck } from "lucide-react";
import { useNavigate } from "react-router-dom";
import "./Auth.css";

const API_BASE_URL =
  import.meta.env.VITE_API_BASE_URL ?? "http://localhost:8000";

type VerificationStatus = "loading" | "success" | "error";

export const VerifyEmail: React.FC = () => {
  const navigate = useNavigate();
  const [status, setStatus] = useState<VerificationStatus>("loading");
  const [message, setMessage] = useState("Cargando...");
  const [countdown, setCountdown] = useState(3);

  const hasCalled = useRef(false);

  useEffect(() => {
    const verifyToken = async () => {
      if (hasCalled.current) return;
      const token =
        new URLSearchParams(globalThis.location.search).get("token")?.trim() ??
        "";

      if (!token) {
        setStatus("error");
        setMessage("Token de verificación no proporcionado.");
        return;
      }

      hasCalled.current = true;

      try {
        const response = await fetch(
          `${API_BASE_URL}/api/v1/auth/verify-email`,
          {
            method: "POST",
            headers: {
              "Content-Type": "application/json",
            },
            body: JSON.stringify({ token }),
          },
        );

        if (!response.ok) {
          const errorData = (await response.json()) as {
            detail?: string | Record<string, unknown>;
          };
          const detail =
            typeof errorData.detail === "string"
              ? errorData.detail
              : "El enlace de verificación es inválido o ha expirado.";
          throw new Error(detail);
        }

        setStatus("success");
        setMessage(
          "Tu cuenta ha sido verificada correctamente. Ya puedes iniciar sesión.",
        );
      } catch (error) {
        const errorMessage =
          error instanceof Error
            ? error.message
            : "No se pudo verificar la cuenta. Inténtalo de nuevo mas tarde.";
        setStatus("error");
        setMessage(errorMessage);
      }
    };

    void verifyToken();
  }, []);

  useEffect(() => {
    if (status !== "success") {
      setCountdown(3);
      return;
    }

    let fallbackTimer: number | undefined;
    const timer = globalThis.setInterval(() => {
      setCountdown((prev) => {
        if (prev <= 1) {
          globalThis.clearInterval(timer);
          globalThis.close();

          fallbackTimer = globalThis.setTimeout(() => {
            if (!globalThis.closed) {
              navigate("/login", { replace: true });
            }
          }, 500);

          return 0;
        }

        return prev - 1;
      });
    }, 1000);

    return () => {
      globalThis.clearInterval(timer);
      if (fallbackTimer) {
        globalThis.clearTimeout(fallbackTimer);
      }
    };
  }, [navigate, status]);

  return (
    <div className="auth-page">
      <div className="auth-card verify-email-panel" aria-labelledby="verify-email-title">
        <header className="auth-header">
          <div className="auth-logo">
            <img
              src={`${import.meta.env.BASE_URL}newsradar-logo.png`}
              alt="NewsRadar Logo"
              className="auth-logo-image"
            />
            <span>NewsRadar</span>
          </div>
          <h2 id="verify-email-title">Verificación de Cuenta</h2>
        </header>

        <section className="verify-email-content">
          {status === "loading" && (
            <p role="status" aria-live="polite" className="verify-email-status-row">
              <MailCheck size={24} className="verify-email-icon" aria-hidden="true" />
              <span>{message}</span>
            </p>
          )}

          {status === "success" && (
            <>
              <p role="status" aria-live="polite" className="verify-email-status-row success">
                <span>{message}</span>
              </p>
              <p role="status" aria-live="polite" className="verify-email-status-row">
                Esta ventana se cerrará automáticamente en {countdown} segundos...
              </p>
            </>
          )}

          {status === "error" && (
            <>
              <div
                role="alert"
                aria-live="assertive"
                className="alert-feedback alert-feedback-error verify-email-feedback"
              >
                <p className="verify-email-status-row">
                  <AlertCircle size={20} className="verify-email-icon" aria-hidden="true" />
                  <span>{message}</span>
                </p>
              </div>
              <a href="/login" className="btn-auth-submit verify-email-submit-link">
                Volver al Login
              </a>
            </>
          )}
        </section>
      </div>
    </div>
  );
};
