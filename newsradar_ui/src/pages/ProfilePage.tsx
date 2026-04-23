import React, { useState, useEffect } from "react";
import { useAuth } from "../hooks/useAuth";
import { normalizeRoleToId } from "../utils/roleUtils";
import "./ProfilePage.css";

const API_BASE_URL = import.meta.env.VITE_API_BASE_URL ?? "http://localhost:8000";

interface UserProfile {
  id: number;
  email: string;
  first_name: string;
  last_name: string;
  organization?: string;
  role_ids: number[];
}

/**
 * Página de perfil de usuario.
 * Muestra información del usuario logueado y gestión de usuarios si es Admin.
 */
export const ProfilePage: React.FC = () => {
  const { token } = useAuth();
  const [profile, setProfile] = useState<UserProfile | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!token) {
      setLoading(false);
      return;
    }

    const fetchProfile = async () => {
      try {
        // Obtener información del perfil del usuario actual
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
          setError(
            errorData.detail || "Error al cargar perfil"
          );
          setLoading(false);
          return;
        }

        const data: UserProfile = await response.json();
        setProfile(data);
      } catch (err) {
        setError(
          err instanceof Error
            ? err.message
            : "Error desconocido"
        );
      } finally {
        setLoading(false);
      }
    };

    fetchProfile();
  }, [token]);

  if (loading) {
    return (
      <section className="profile-page" role="main">
        <div className="loading-state" role="status" aria-live="polite">
          <p>Cargando perfil...</p>
        </div>
      </section>
    );
  }

  if (error) {
    return (
      <section className="profile-page" role="main">
        <div role="alert" className="error-alert">
          {error}
        </div>
      </section>
    );
  }

  if (!profile) {
    return (
      <section className="profile-page" role="main">
        <div role="alert" className="error-alert">
          No se pudo cargar el perfil
        </div>
      </section>
    );
  }

  const normalizedRoleIds = profile.role_ids
    .map(normalizeRoleToId)
    .filter((roleId): roleId is number => roleId !== null);

  const roleLabel = normalizedRoleIds.includes(3)
    ? "Administrador"
    : normalizedRoleIds.includes(1)
      ? "Gestor"
      : "Lector";

  return (
    <section className="profile-page" role="main" aria-labelledby="profile-title">
      <div className="profile-container">
        <h1 id="profile-title">Perfil de Usuario</h1>

        <article className="profile-card" aria-label="Información del perfil">
          <div className="profile-field">
            <label htmlFor="email-display">Email:</label>
            <p id="email-display">{profile.email}</p>
          </div>

          <div className="profile-field">
            <label htmlFor="name-display">Nombre:</label>
            <p id="name-display">{profile.first_name}</p>
          </div>

          <div className="profile-field">
            <label htmlFor="surname-display">Apellido:</label>
            <p id="surname-display">{profile.last_name}</p>
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
        </article>
      </div>
    </section>
  );
};
