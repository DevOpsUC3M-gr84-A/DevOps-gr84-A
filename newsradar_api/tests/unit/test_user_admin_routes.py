"""Tests for admin-only user management routes: GET /api/v1/users and PATCH /api/v1/users/{user_id}/role"""

import pytest
from app.models.user import User, UserRole
from app.services.user_service import get_password_hash


@pytest.mark.unit
class TestAdminUserManagement:
    """Tests para las rutas de gestión de usuarios exclusivas de Admin."""

    def test_list_users_admin_success(self, api_client_admin):
        """Admin puede listar todos los usuarios."""
        response = api_client_admin.get("/api/v1/users")

        assert response.status_code == 200
        data = response.json()
        assert isinstance(data, list)
        # Al menos el admin debe estar en la lista
        assert any(u["email"] == "rf01-admin@test.com" for u in data)
        # Verificar estructura de respuesta
        assert "id" in data[0]
        assert "email" in data[0]
        assert "role_ids" in data[0]

    def test_list_users_admin_forbidden_gestor(self, api_client):
        """Gestor NO puede listar usuarios (requiere Admin)."""
        response = api_client.get("/api/v1/users")

        assert response.status_code == 403
        assert "No tienes los permisos necesarios" in response.json()["detail"]

    def test_list_users_admin_forbidden_lector(self, api_client_lector):
        """Lector NO puede listar usuarios (requiere Admin)."""
        response = api_client_lector.get("/api/v1/users")

        assert response.status_code == 403

    def test_list_users_admin_no_auth(self, api_client_no_auth):
        """Sin token → 401."""
        response = api_client_no_auth.get("/api/v1/users")
        assert response.status_code == 401

    def test_update_user_role_success(self, api_client_admin, test_session_factory):
        """Admin puede actualizar el rol de un usuario."""
        # Crear un usuario Gestor para cambiar su rol
        session = test_session_factory()
        target_user = User(
            email="target_update_role@test.com",
            name="Target",
            surname="User",
            organization="TestOrg",
            hashed_password=get_password_hash("password123"),
            role=UserRole.GESTOR,
            is_verified=True,
        )
        session.add(target_user)
        session.commit()
        target_id = target_user.id
        session.close()

        payload = {"role_id": 2}  # Cambiar a Lector
        response = api_client_admin.patch(
            f"/api/v1/users/{target_id}/role",
            json=payload,
        )

        assert response.status_code == 200
        data = response.json()
        assert data["id"] == target_id
        assert data["role_ids"] == [2]

    def test_update_user_role_forbidden_gestor(self, api_client, test_session_factory):
        """Gestor NO puede actualizar roles de usuarios."""
        # Crear un usuario para intentar cambiar su rol
        session = test_session_factory()
        target_user = User(
            email="target_gestor_attempt@test.com",
            name="Target",
            surname="User",
            organization="TestOrg",
            hashed_password=get_password_hash("password123"),
            role=UserRole.LECTOR,
            is_verified=True,
        )
        session.add(target_user)
        session.commit()
        target_id = target_user.id
        session.close()

        payload = {"role_id": 1}
        response = api_client.patch(
            f"/api/v1/users/{target_id}/role",
            json=payload,
        )

        assert response.status_code == 403

    def test_update_user_role_not_found(self, api_client_admin):
        """Usuario no encontrado → 404."""
        payload = {"role_id": 1}
        response = api_client_admin.patch("/api/v1/users/9999/role", json=payload)

        assert response.status_code == 404

    def test_update_user_role_invalid_role_id(self, api_client_admin, test_session_factory):
        """role_id inválido → 400."""
        # Crear un usuario
        session = test_session_factory()
        target_user = User(
            email="target_invalid_role@test.com",
            name="Target",
            surname="User",
            organization="TestOrg",
            hashed_password=get_password_hash("password123"),
            role=UserRole.GESTOR,
            is_verified=True,
        )
        session.add(target_user)
        session.commit()
        target_id = target_user.id
        session.close()

        payload = {"role_id": 999}  # Role ID inválido
        response = api_client_admin.patch(
            f"/api/v1/users/{target_id}/role",
            json=payload,
        )

        assert response.status_code == 400

    def test_list_users_admin_generic_exception_returns_500(self, api_client_admin, mocker):
        """Si el servicio falla, la ruta devuelve 500."""
        mocker.patch("app.api.routes.users.list_all_users", side_effect=Exception("boom"))

        response = api_client_admin.get("/api/v1/users")

        assert response.status_code == 500
        assert response.json()["detail"] == "Error al obtener la lista de usuarios"

    def test_update_user_role_admin_generic_exception_returns_500(self, api_client_admin, mocker):
        """Si la actualización falla, la ruta devuelve 500."""
        mocker.patch(
            "app.api.routes.users.update_user_role_by_role_id",
            side_effect=Exception("boom"),
        )

        response = api_client_admin.patch("/api/v1/users/1/role", json={"role_id": 2})

        assert response.status_code == 500
        assert response.json()["detail"] == "Error al actualizar el rol del usuario"

    def test_update_user_role_lector_forbidden(self, api_client_lector, test_session_factory):
        """Lector NO puede actualizar roles de usuarios."""
        # Crear un usuario
        session = test_session_factory()
        target_user = User(
            email="target_lector_attempt@test.com",
            name="Target",
            surname="User",
            organization="TestOrg",
            hashed_password=get_password_hash("password123"),
            role=UserRole.GESTOR,
            is_verified=True,
        )
        session.add(target_user)
        session.commit()
        target_id = target_user.id
        session.close()

        payload = {"role_id": 2}
        response = api_client_lector.patch(
            f"/api/v1/users/{target_id}/role",
            json=payload,
        )

        assert response.status_code == 403
