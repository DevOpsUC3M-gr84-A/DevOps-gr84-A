import React, { useState } from 'react';

const API_BASE_URL = process.env.REACT_APP_API_BASE_URL ?? 'http://localhost:8000';

interface ForgotPasswordResponse {
  detail?: string;
}

export const ForgotPassword = () => {
  const [email, setEmail] = useState('');
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [successMessage, setSuccessMessage] = useState<string | null>(null);

  const handleSubmit = async (event: React.FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    setErrorMessage(null);
    setSuccessMessage(null);

    if (!email.trim()) {
      setErrorMessage('Debes introducir un email.');
      return;
    }

    setIsSubmitting(true);

    try {
      const response = await fetch(`${API_BASE_URL}/api/v1/auth/forgot-password`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email: email.trim() }),
      });

      const data = (await response.json()) as ForgotPasswordResponse;

      if (!response.ok) {
        throw new Error(data.detail ?? 'No se pudo procesar la solicitud. Inténtalo más tarde.');
      }

      setSuccessMessage('Si el correo existe, recibirás instrucciones para restablecer tu contraseña.');
    } catch (error) {
      const message = error instanceof Error ? error.message : 'Error inesperado al solicitar recuperación de contraseña.';
      setErrorMessage(message);
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <main className="auth-page">
      <section className="auth-card" aria-labelledby="forgot-password-title">
        <h1 id="forgot-password-title">Recuperar contraseña</h1>
        <p>Introduce tu correo corporativo y te enviaremos instrucciones.</p>

        <form onSubmit={handleSubmit} className="auth-form">
          <div className="form-group">
            <label htmlFor="forgot-email">Email</label>
            <input
              id="forgot-email"
              name="email"
              type="email"
              value={email}
              onChange={(event) => setEmail(event.target.value)}
              placeholder="tu@organizacion.com"
              required
            />
          </div>

          {errorMessage && (
            <div role="alert" aria-live="assertive" className="alert-feedback alert-feedback-error">
              {errorMessage}
            </div>
          )}

          {successMessage && (
            <div role="status" aria-live="polite" className="alert-feedback alert-feedback-success">
              {successMessage}
            </div>
          )}

          <button type="submit" className="btn-auth-submit" disabled={isSubmitting}>
            {isSubmitting ? 'Enviando...' : 'Enviar enlace de recuperación'}
          </button>

          <a href="/" className="btn-toggle-auth">
            Volver al Login
          </a>
        </form>
      </section>
    </main>
  );
};
