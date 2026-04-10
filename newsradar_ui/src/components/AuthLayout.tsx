import React from 'react';

interface AuthLayoutProps {
  title: string;
  description: string;
  errorMessage: string | null;
  successMessage: string | null;
  isSubmitting: boolean;
  submitText: string;
  onSubmit: (e: React.SyntheticEvent) => void;
  children: React.ReactNode;
}

export const AuthLayout = ({
  title,
  description,
  errorMessage,
  successMessage,
  isSubmitting,
  submitText,
  onSubmit,
  children,
}: AuthLayoutProps) => {
  return (
    <main className="auth-page">
      <section className="auth-card" aria-labelledby="auth-layout-title">
        <h1 id="auth-layout-title">{title}</h1>
        <p>{description}</p>

        <form onSubmit={onSubmit} className="auth-form">
          {children}

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
            {submitText}
          </button>

          <a href="/" className="btn-toggle-auth">
            Volver al Login
          </a>
        </form>
      </section>
    </main>
  );
};
