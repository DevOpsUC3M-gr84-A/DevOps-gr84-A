import React, { useEffect, useState } from "react";
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

const getRoleLabel = (roleIds: number[]): string => {
  const roleSet = new Set(roleIds);

  if (roleSet.has(3)) {
    return "Administrador";
  }

  if (roleSet.has(1)) {
    return "Gestor";
  }

  return "Lector";
};

export const UserManagementTable: React.FC<UserManagementTableProps> = ({ isAdmin }) => {
  const [users, setUsers] = useState<User[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [updatingUserId, setUpdatingUserId] = useState<number | null>(null);

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
          setError("No autenticado");
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

  const handleRoleChange = async (userId: number, newRoleId: number) => {
    setUpdatingUserId(userId);
    setError(null);

    try {
      const token = globalThis.localStorage.getItem("token");
      if (!token) {
        setError("No autenticado");
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

      const updatedUser: User = await response.json();
      setUsers((prevUsers) =>
        prevUsers.map((user) => (user.id === updatedUser.id ? updatedUser : user)),
      );
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
      <h2 id="user-management-title">Gestión de Usuarios</h2>

      {error && (
        <div className="error-message" role="alert" aria-live="polite">
          <AlertCircle size={20} aria-hidden="true" />
          <p>{error}</p>
        </div>
      )}

      {loading && (
        <div className="loading-state" role="status" aria-live="polite">
          <Loader size={24} className="spinner" aria-hidden="true" />
          <p>Cargando usuarios...</p>
        </div>
      )}

      {!loading && users.length > 0 && (
        <div className="table-wrapper">
          <table className="users-table" role="grid">
            <thead>
              <tr>
                <th scope="col">Email</th>
                <th scope="col">Nombre Completo</th>
                <th scope="col">Rol Actual</th>
                <th scope="col">Cambiar Rol</th>
              </tr>
            </thead>
            <tbody>
              {users.map((user) => (
                <tr key={user.id}>
                  <td>{user.email}</td>
                  <td>{user.first_name} {user.last_name}</td>
                  <td>{getRoleLabel(user.role_ids)}</td>
                  <td>
                    <select
                      value={user.role_ids[0] || 2}
                      onChange={(event) =>
                        handleRoleChange(user.id, Number.parseInt(event.target.value, 10))
                      }
                      disabled={updatingUserId === user.id}
                      aria-label={`Cambiar rol de usuario ${user.email}`}
                      className="role-select"
                    >
                      <option value={1}>Gestor</option>
                      <option value={2}>Lector</option>
                      <option value={3}>Admin</option>
                    </select>
                    {updatingUserId === user.id && (
                      <span className="updating-indicator" aria-hidden="true">
                        Actualizando...
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
        <p className="no-users-message">No hay usuarios para mostrar.</p>
      )}
    </section>
  );
};
