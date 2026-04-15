import React, { useEffect, useState } from "react";

const API_BASE_URL =
  import.meta.env.VITE_API_BASE_URL ?? "http://localhost:8000";

type VerificationStatus = "loading" | "success" | "error";

export const VerifyEmail: React.FC = () => {
  const [status, setStatus] = useState<VerificationStatus>("loading");
  const [message, setMessage] = useState("Validando tu cuenta...");

  useEffect(() => {
    const verifyToken = async () => {
      const token =
        new URLSearchParams(globalThis.location.search).get("token")?.trim() ??
        "";

      if (!token) {
        setStatus("error");
        setMessage("Token de verificacion no proporcionado.");
        return;
      }

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
              : "El enlace de verificacion es invalido o ha expirado.";
          throw new Error(detail);
        }

        setStatus("success");
        setMessage(
          "Tu cuenta ha sido verificada correctamente. Ya puedes iniciar sesion.",
        );
      } catch (error) {
        const errorMessage =
          error instanceof Error
            ? error.message
            : "No se pudo verificar la cuenta. Intentalo de nuevo mas tarde.";
        setStatus("error");
        setMessage(errorMessage);
      }
    };

    void verifyToken();
  }, []);

  return (
    <main className="main-content" aria-labelledby="verify-email-title">
      <section
        className="table-container"
        style={{ maxWidth: 700, margin: "2rem auto" }}
      >
        <h2 id="verify-email-title">Verificacion de Cuenta</h2>

        {status === "loading" && (
          <p role="status" aria-live="polite">
            Cargando...
          </p>
        )}

        {status === "success" && (
          <div role="status" aria-live="polite">
            <p>{message}</p>
            <a
              href="/"
              className="btn-primary"
              style={{ display: "inline-block", marginTop: "1rem" }}
            >
              Ir al Login
            </a>
          </div>
        )}

        {status === "error" && (
          <div
            role="alert"
            aria-live="assertive"
            className="alert-feedback alert-feedback-error"
          >
            <p>{message}</p>
            <a
              href="/"
              className="btn-secondary"
              style={{ display: "inline-block", marginTop: "1rem" }}
            >
              Volver al Login
            </a>
          </div>
        )}
      </section>
    </main>
  );
};
