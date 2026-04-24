"""Tests for user API endpoints"""

import pytest
from sqlalchemy.orm import Session

from app.models.user import User, UserRole
from app.schemas.user import UserCreate, UserUpdate
from app.services.user_service import create_db_user, get_password_hash, update_db_user, verify_user_email
from datetime import datetime, timezone

@pytest.mark.unit
class TestUsersAPIEndpoints:
	@pytest.fixture(autouse=True)
	def bypass_role_check(self, monkeypatch):
		monkeypatch.setattr("app.api.routes.users.ensure_role_ids_exist", lambda _role_ids: None)

	def test_list_users_api(self, api_client_admin, admin_auth_headers):
		response = api_client_admin.get("/api/v1/users", headers=admin_auth_headers)
		assert response.status_code == 200
		assert isinstance(response.json(), list)

	def test_get_user_success(self, api_client, auth_headers, seeded_user):
		response = api_client.get(f"/api/v1/users/{seeded_user.id}", headers=auth_headers)
		assert response.status_code == 200
		assert response.json()["email"] == seeded_user.email

	def test_get_user_404(self, api_client, auth_headers):
		response = api_client.get("/api/v1/users/9999", headers=auth_headers)
		assert response.status_code == 404
		assert response.json()["detail"] == "Usuario no encontrado"

	def test_create_user_api_success(self, api_client, auth_headers):
		payload = {
			"email": "newapiuser@test.com",
			"first_name": "API",
			"last_name": "User",
			"organization": "Test",
			"password": "Test@1234!",
			"role_ids": [2]
		}
		response = api_client.post("/api/v1/users", json=payload, headers=auth_headers)
		assert response.status_code == 201
		assert response.json()["email"] == "newapiuser@test.com"

	def test_create_user_api_conflict(self, api_client, auth_headers, seeded_user):
		# Intentamos crear un usuario con el email del admin (ya existe)
		payload = {
			"email": seeded_user.email,
			"first_name": "Dup",
			"last_name": "User",
			"organization": "Test",
			"password": "Test@1234!",
			"role_ids": [2]
		}
		response = api_client.post("/api/v1/users", json=payload, headers=auth_headers)
		assert response.status_code == 409
		assert "El email ya está registrado" in response.json()["detail"]

	def test_update_user_api_success(self, api_client, auth_headers, seeded_user):
		payload = {
			"first_name": "NombreActualizado"
		}
		response = api_client.put(f"/api/v1/users/{seeded_user.id}", json=payload, headers=auth_headers)
		assert response.status_code == 200
		assert response.json()["first_name"] == "NombreActualizado"

	def test_update_user_api_404(self, api_client, auth_headers):
		response = api_client.put("/api/v1/users/9999", json={"first_name": "Ghost"}, headers=auth_headers)
		assert response.status_code == 404

	def test_update_user_api_conflict(self, api_client, auth_headers, seeded_user, seeded_lector_user):
		# Intentamos actualizar el email del admin poniéndole el email del lector
		payload = {
			"email": seeded_lector_user.email
		}
		response = api_client.put(f"/api/v1/users/{seeded_user.id}", json=payload, headers=auth_headers)
		assert response.status_code == 409

	def test_delete_user_api_success(self, api_client, auth_headers):
		# Crear un usuario "basura" por API
		create_resp = api_client.post("/api/v1/users", json={
			"email": "todelete_api@test.com", "first_name": "Del", "last_name": "User", 
			"organization": "Org", "password": "Test@1234!", "role_ids": [2]
		}, headers=auth_headers)
		assert create_resp.status_code == 201
		user_id = create_resp.json()["id"]

		# Borrar usuario
		del_resp = api_client.delete(f"/api/v1/users/{user_id}", headers=auth_headers)
		assert del_resp.status_code == 204

		# Comprobar que ya no existe
		get_resp = api_client.get(f"/api/v1/users/{user_id}", headers=auth_headers)
		assert get_resp.status_code == 404

	def test_delete_user_api_404(self, api_client, auth_headers):
		response = api_client.delete("/api/v1/users/9999", headers=auth_headers)
		assert response.status_code == 404
