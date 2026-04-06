import pytest

from app.schemas.roles import Role
from app.schemas.user import UserInDB
from app.stores.memory import roles_store, users_store


@pytest.fixture(autouse=True)
def clear_role_related_stores():
    roles_store.clear()
    users_store.clear()
    yield
    roles_store.clear()
    users_store.clear()


@pytest.mark.unit
def test_roles_crud_flow(api_client, auth_headers):
    create_response = api_client.post(
        "/api/v1/roles",
        json={"name": "Analista"},
        headers=auth_headers,
    )
    assert create_response.status_code == 201
    role_id = create_response.json()["id"]

    list_response = api_client.get("/api/v1/roles", headers=auth_headers)
    assert list_response.status_code == 200
    role_names = {role["name"] for role in list_response.json()}
    assert "Analista" in role_names

    get_response = api_client.get(f"/api/v1/roles/{role_id}", headers=auth_headers)
    assert get_response.status_code == 200
    assert get_response.json()["name"] == "Analista"

    update_response = api_client.put(
        f"/api/v1/roles/{role_id}",
        json={"name": "Editor"},
        headers=auth_headers,
    )
    assert update_response.status_code == 200
    assert update_response.json()["name"] == "Editor"

    delete_response = api_client.delete(f"/api/v1/roles/{role_id}", headers=auth_headers)
    assert delete_response.status_code == 204

    not_found_response = api_client.get(f"/api/v1/roles/{role_id}", headers=auth_headers)
    assert not_found_response.status_code == 404


@pytest.mark.unit
def test_delete_assigned_role_returns_409(api_client, auth_headers):
    roles_store[1] = Role(id=1, name="Gestor")
    users_store[10] = UserInDB(
        id=10,
        email="qa-role@test.com",
        first_name="QA",
        last_name="Role",
        organization="NewsRadar",
        role_ids=[1],
        password="hashed",
    )

    response = api_client.delete("/api/v1/roles/1", headers=auth_headers)

    assert response.status_code == 409
    assert response.json()["detail"] == "No se puede eliminar un rol asignado a usuarios"
