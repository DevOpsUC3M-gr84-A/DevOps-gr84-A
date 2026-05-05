import React, { useEffect, useState } from "react";
import { useI18n } from "../i18n/i18n";
import { AlertCircle, Loader } from "lucide-react";
import "./UserManagementTable.css";

interface User {
  id: number;
  email: string;
  first_name: string;
  last_name: string;
  role_ids: number[];
}

interface UserManagementTableProps {
  isAdmin: boolean;
}

const API_BASE_URL = import.meta.env.VITE_API_BASE_URL ?? "http://localhost:8000";

export const UserManagementTable: React.FC<UserManagementTableProps> = ({ isAdmin }) => {
  const { t } = useI18n();
  const [users, setUsers] = useState<User[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [successMessage, setSuccessMessage] = useState<string | null>(null);
  const [updatingUserId, setUpdatingUserId] = useState<number | null>(null);

  useEffect(() => {
    if (!successMessage) {
      return;
    }

    const timeoutId = globalThis.setTimeout(() => {
      setSuccessMessage(null);
    }, 2500);

    return () => {
      globalThis.clearTimeout(timeoutId);
    };
  }, [successMessage]);

  useEffect(() => {
    if (!isAdmin) {
      return;
    }

    const fetchUsers = async () => {
      setLoading(true);
      setError(null);

      try {
        const token = globalThis.localStorage.getItem("token");
        if (!token) {
          setError(t("userManagement.notAuthenticated"));
          setLoading(false);
          return;
        }

        const response = await fetch(`${API_BASE_URL}/api/v1/users`, {
          headers: {
            Authorization: `Bearer ${token}`,
            "Content-Type": "application/json",
          },
        });

        if (!response.ok) {
          const errorData = await response.json();
          setError(errorData.detail || "Error al cargar la lista de usuarios");
          setLoading(false);
          return;
        }

        const data: User[] = await response.json();
        setUsers(data);
      } catch (err) {
        setError(
          err instanceof Error
            ? err.message
            : "Error desconocido al cargar usuarios",
        );
      } finally {
        setLoading(false);
      }
    };

    fetchUsers();
  }, [isAdmin]);

  const myOwnId = Number(globalThis.localStorage.getItem("userId"));

  const handleRoleChange = async (userId: number, newRoleId: number) => {
    setUpdatingUserId(userId);
    setError(null);
    setSuccessMessage(null);

    try {
      const token = globalThis.localStorage.getItem("token");
      if (!token) {
        setError(t("userManagement.notAuthenticated"));
        setUpdatingUserId(null);
        return;
      }

      const response = await fetch(`${API_BASE_URL}/api/v1/users/${userId}/role`, {
        method: "PATCH",
        headers: {
          Authorization: `Bearer ${token}`,
          "Content-Type": "application/json",
        },
        body: JSON.stringify({ role_id: newRoleId }),
      });

      if (!response.ok) {
        const errorData = await response.json();
        setError(errorData.detail || "Error al actualizar el rol del usuario");
        setUpdatingUserId(null);
        return;
      }

      let updatedUser: Partial<User> | null = null;

      try {
        updatedUser = (await response.json()) as Partial<User>;
      } catch {
        updatedUser = null;
      }

      setUsers((prevUsers) =>
        prevUsers.map((user) => {
          if (user.id !== userId) {
            return user;
          }

          const nextRoleIds =
            updatedUser?.role_ids && updatedUser.role_ids.length > 0
              ? updatedUser.role_ids
              : [newRoleId];

          return {
            ...user,
            ...updatedUser,
            role_ids: nextRoleIds,
          };
        }),
      );
      setSuccessMessage(t("userManagement.roleUpdated"));
    } catch (err) {
      setError(
        err instanceof Error
          ? err.message
          : "Error desconocido al actualizar rol",
      );
    } finally {
      setUpdatingUserId(null);
    }
  };

  if (!isAdmin) {
    return null;
  }

  return (
    <section className="user-management-section" aria-labelledby="user-management-title" data-testid="user-management-table">
      <h2 id="user-management-title">{t("userManagement.title")}</h2>

      {error && (
        <div className="error-message" role="alert" aria-live="polite">
          <AlertCircle size={20} aria-hidden="true" />
          <p>{error}</p>
        </div>
      )}

      {successMessage && (
        <div className="success-message" role="status" aria-live="polite">
          <p>{successMessage}</p>
        </div>
      )}

      {loading && (
        <div className="loading-state" role="status" aria-live="polite">
          <Loader size={24} className="spinner" aria-hidden="true" />
          <p>{t("userManagement.loading")}</p>
        </div>
      )}

      {!loading && users.length > 0 && (
        <div className="table-wrapper">
          <table className="users-table" role="grid">
            <thead>
              <tr>
                <th scope="col">{t("userManagement.email")}</th>
                <th scope="col">{t("userManagement.fullName")}</th>
                <th scope="col">{t("userManagement.currentRole")}</th>
                <th scope="col">{t("userManagement.changeRole")}</th>
              </tr>
            </thead>
            <tbody>
              {users.map((user) => (
                <tr key={user.id}>
                  <td>{user.email}</td>
                  <td>{user.first_name} {user.last_name}</td>
                  <td>{user.role_ids.includes(3) ? t("roles.admin") : user.role_ids.includes(1) ? t("roles.gestor") : t("roles.lector")}</td>
                  <td aria-label={`${t("userManagement.changeRole")}: ${user.email}`}>
                    <select
                      value={user.role_ids[0] || 2}
                      onChange={(event) =>
                        handleRoleChange(user.id, Number.parseInt(event.target.value, 10))
                      }
                      disabled={updatingUserId === user.id || user.id === myOwnId}
                      aria-label={`Cambiar rol de usuario ${user.email}`}
                      className="role-select"
                    >
                      <option value={1}>{t("roles.gestor")}</option>
                      <option value={2}>{t("roles.lector")}</option>
                      <option value={3}>{t("roles.admin")}</option>
                    </select>
                    {updatingUserId === user.id && (
                      <span className="updating-indicator" aria-hidden="true">
                        {t("common.updating")}
                      </span>
                    )}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      {!loading && users.length === 0 && !error && (
        <p className="no-users-message">{t("userManagement.noUsers")}</p>
      )}
    </section>
  );
};
