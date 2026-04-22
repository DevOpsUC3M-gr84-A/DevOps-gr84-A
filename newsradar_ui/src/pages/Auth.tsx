import React, { useState } from "react";
import { Eye, EyeOff } from "lucide-react";
import { LogIn, UserPlus, Mail, Lock, User, Building } from "lucide-react";
import { useAuth } from "../hooks/useAuth";
// @ts-ignore: CSS module declaration not found
import "./Auth.css";

const API_BASE_URL =
  import.meta.env.VITE_API_BASE_URL ?? "http://localhost:8000";

interface ApiValidationError {
  loc?: (string | number)[];
  msg?: string;
}

interface ApiErrorResponse {
  detail?: string | ApiValidationError[] | Record<string, unknown>;
}

interface AuthResponse extends ApiErrorResponse {
  access_token?: string;
  user_id?: number;
  role_ids?: number[];
}

const formatApiError = (data: ApiErrorResponse): string => {
  if (typeof data.detail === "string") {
    return data.detail;
  }

  if (Array.isArray(data.detail)) {
    return data.detail
      .map(
        (err) => `${err.loc?.[1] ?? "campo"}: ${err.msg ?? "valor inválido"}`,
      )
      .join("\n");
  }

  if (data.detail && typeof data.detail === "object") {
    return JSON.stringify(data.detail);
  }

  return "Error en la operación";
};

const normalizeLoginErrorMessage = (
  status: number,
  message: string,
  isLogin: boolean,
): string => {
  if (!isLogin || (status !== 401 && status !== 403)) {
    return message;
  }

  if (/verif|verify/i.test(message)) {
    return "Tu cuenta no está verificada. Revisa tu email.";
  }

  return message;
};

export const Auth = () => {
  const { login } = useAuth();
  const [isLogin, setIsLogin] = useState(true);
  const [authError, setAuthError] = useState<string | null>(null);
  const [registerSuccess, setRegisterSuccess] = useState(false);
  const [formData, setFormData] = useState({
    email: "",
    password: "",
    first_name: "",
    last_name: "",
    organization: "",
  });
  const [showPassword, setShowPassword] = useState(false);

  const handleChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    setFormData({ ...formData, [e.target.name]: e.target.value });
  };

  const validate = () => {
    const emailRegex =
      /^[a-zA-Z0-9.!#$%&'*+/=?^_`{|}~-]+@[a-zA-Z0-9](?:[a-zA-Z0-9-]{0,61}[a-zA-Z0-9])?(?:\.[a-zA-Z0-9](?:[a-zA-Z0-9-]{0,61}[a-zA-Z0-9])?)*$/;
    if (!emailRegex.test(formData.email)) return "Email no válido";
    if (formData.password.length < 6)
      return "La contraseña debe tener al menos 6 caracteres";
    if (
      !isLogin &&
      (!formData.first_name || !formData.last_name || !formData.organization)
    ) {
      return "Todos los campos de registro son obligatorios";
    }
    return null;
  };

  const handleSubmit = async (e: React.SyntheticEvent) => {
    e.preventDefault();
    setAuthError(null);
    const errorMsg = validate();
    if (errorMsg) {
      setAuthError(errorMsg);
      return;
    }

    const endpoint = isLogin ? "/api/v1/auth/login" : "/api/v1/auth/register";

    const payload = isLogin
      ? { email: formData.email, password: formData.password }
      : {
          ...formData,
          role_ids: [2],
        };

    try {
      const response = await fetch(`${API_BASE_URL}${endpoint}`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      });

      const data = (await response.json()) as AuthResponse;

      if (!response.ok) {
        const baseError = formatApiError(data);
        const normalizedError = normalizeLoginErrorMessage(
          response.status,
          baseError,
          isLogin,
        );
        throw new Error(normalizedError);
      }

      if (isLogin) {
        login({
          access_token: data.access_token ?? "",
          user_id: data.user_id ?? 0,
          role_ids: data.role_ids ?? [],
        });
      } else {
        setRegisterSuccess(true);
        setAuthError(null);
      }
    } catch (error) {
      const message =
        error instanceof Error
          ? error.message
          : "Error inesperado en autenticación";
      setAuthError(message);
    }
  };

  if (registerSuccess) {
    return (
      <div className="auth-page">
        <div className="auth-card" role="status" aria-live="polite">
          <h2>Registro exitoso</h2>
          <p>
            Por favor, revisa tu bandeja de entrada para verificar tu cuenta.
          </p>
          <button
            type="button"
            className="btn-toggle-auth"
            onClick={() => {
              setRegisterSuccess(false);
              setIsLogin(true);
              setAuthError(null);
            }}
          >
            Ir al Login
          </button>
        </div>
      </div>
    );
  }
  const submitText = isLogin ? "Entrar al sistema" : "Crear mi cuenta";
  return (
    <div className="auth-page">
      <div className="auth-card">
        <header className="auth-header">
          <div className="auth-logo">
            <img
              src={`${import.meta.env.BASE_URL}newsradar-logo.png`}
              alt="NewsRadar Logo"
              className="auth-logo-image"
            />
            <span>NewsRadar</span>
          </div>
          <h2>{isLogin ? "Iniciar Sesión" : "Crear Cuenta"}</h2>
          <p className="auth-subtitle">
            {isLogin
              ? "Accede a tu panel de control"
              : "Únete a la plataforma de monitoreo"}
          </p>
        </header>

        <form onSubmit={handleSubmit} className="auth-form">
          {authError && (
            <div
              role="alert"
              aria-live="assertive"
              className="alert-feedback alert-feedback-error"
            >
              {authError}
            </div>
          )}

          {!isLogin && (
            <div className="form-row">
              <div className="form-group">
                <label htmlFor="first_name">
                  <User size={16} /> Nombre
                </label>
                <input
                  id="first_name"
                  type="text"
                  name="first_name"
                  required
                  placeholder="Ej: Juan"
                  onChange={handleChange}
                />
              </div>
              <div className="form-group">
                <label htmlFor="last_name">Apellidos</label>
                <input
                  id="last_name"
                  type="text"
                  name="last_name"
                  required
                  placeholder="Ej: Pérez"
                  onChange={handleChange}
                />
              </div>
            </div>
          )}

          {!isLogin && (
            <div className="form-group">
              <label htmlFor="organization">
                <Building size={16} /> Organización
              </label>
              <input
                id="organization"
                type="text"
                name="organization"
                required
                placeholder="Nombre de tu empresa/institución"
                onChange={handleChange}
              />
            </div>
          )}

          <div className="form-group">
            <label htmlFor="email">
              <Mail size={16} /> Email Corporativo
            </label>
            <input
              id="email"
              type="email"
              name="email"
              required
              placeholder="tu@organizacion.com"
              onChange={handleChange}
            />
          </div>

          <div
            className="form-group"
            style={{
              position: "relative",
              display: "flex",
              flexDirection: "column",
            }}
          >
            <label htmlFor="password">
              <Lock size={16} /> Contraseña
            </label>
            <div
              style={{
                position: "relative",
                display: "flex",
                alignItems: "center",
              }}
            >
              <input
                id="password"
                type={showPassword ? "text" : "password"}
                name="password"
                required
                placeholder="••••••••"
                onChange={handleChange}
                value={formData.password}
                autoComplete="current-password"
                style={{ paddingRight: 38, width: "100%" }}
              />
              <button
                type="button"
                aria-label={
                  showPassword ? "Ocultar contraseña" : "Mostrar contraseña"
                }
                onClick={() => setShowPassword((v) => !v)}
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
                {showPassword ? <EyeOff size={20} /> : <Eye size={20} />}
              </button>
            </div>
          </div>

          <button type="submit" className="btn-auth-submit">
            {isLogin ? <LogIn size={20} /> : <UserPlus size={20} />}
            {submitText}
          </button>

          {isLogin && (
            <a
              href="/forgot-password"
              className="btn-toggle-auth forgot-password-link"
            >
              ¿Has olvidado tu contraseña?
            </a>
          )}
        </form>

        <footer className="auth-footer">
          <p>
            {isLogin ? "¿No tienes cuenta todavía?" : "¿Ya tienes una cuenta?"}
          </p>
          <button
            type="button"
            onClick={() => {
              setIsLogin(!isLogin);
              setAuthError(null);
              setRegisterSuccess(false);
            }}
            className="btn-toggle-auth"
          >
            {isLogin ? "Regístrate ahora" : "Inicia sesión aquí"}
          </button>
        </footer>
      </div>
    </div>
  );
};
