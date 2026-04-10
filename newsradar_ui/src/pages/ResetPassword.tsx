import React, { useMemo, useState } from 'react';

const API_BASE_URL = process.env.REACT_APP_API_BASE_URL ?? 'http://localhost:8000';

interface ResetPasswordResponse {
  detail?: string;
}

export const ResetPassword = () => {
  const token = useMemo(() => new URLSearchParams(globalThis.location.search).get('token') ?? '', []);
  const [newPassword, setNewPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [successMessage, setSuccessMessage] = useState<string | null>(null);

  const handleSubmit = async (event: React.FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    setErrorMessage(null);
    setSuccessMessage(null);

    if (!token) {
      setErrorMessage('El enlace de recuperación no es válido.');
      return;
    }

    if (newPassword !== confirmPassword) {
      setErrorMessage('Las contraseñas no coinciden.');
      return;
    }

    setIsSubmitting(true);

    try {
      const response = await fetch(`${API_BASE_URL}/api/v1/auth/reset-password`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          token,
          new_password: newPassword,
        }),
      });

      const data = (await response.json()) as ResetPasswordResponse;

      if (!response.ok) {
        throw new Error(data.detail ?? 'No se pudo restablecer la contraseña. Inténtalo más tarde.');
      }

      setSuccessMessage('Tu contraseña se ha actualizado correctamente.');
      setNewPassword('');
      setConfirmPassword('');
    } catch (error) {
      const message = error instanceof Error ? error.message : 'Error inesperado al restablecer la contraseña.';
      setErrorMessage(message);
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <main className="auth-page">
      <section className="auth-card" aria-labelledby="reset-password-title">
        <h1 id="reset-password-title">Restablecer contraseña</h1>
        <p>Escribe tu nueva contraseña para completar el proceso.</p>

        <form onSubmit={handleSubmit} className="auth-form">
          <div className="form-group">
            <label htmlFor="new-password">Nueva Contraseña</label>
            <input
              id="new-password"
              type="password"
              value={newPassword}
              onChange={(event) => setNewPassword(event.target.value)}
              placeholder="••••••••"
              required
            />
          </div>

          <div className="form-group">
            <label htmlFor="confirm-password">Confirmar Contraseña</label>
            <input
              id="confirm-password"
              type="password"
              value={confirmPassword}
              onChange={(event) => setConfirmPassword(event.target.value)}
              placeholder="••••••••"
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
            {isSubmitting ? 'Actualizando...' : 'Actualizar contraseña'}
          </button>

          <a href="/" className="btn-toggle-auth">
            Volver al Login
          </a>
        </form>
      </section>
    </main>
  );
};
