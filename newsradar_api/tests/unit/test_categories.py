import pytest
from fastapi.testclient import TestClient
from app.main import app
from app.stores.memory import categories_store
from app.utils.seed_utils import create_seed_data


# Fixture de sesión: ejecuta el seed una sola vez para toda la suite
@pytest.fixture(scope="session", autouse=True)
def init_seed():
    """Equivale al evento on_startup que no se dispara en TestClient directo."""
    create_seed_data()


# Cliente HTTP de pruebas
@pytest.fixture(scope="session")
def client():
    with TestClient(app) as c:
        yield c


# Helper de autenticación
@pytest.fixture(scope="session")
def auth_headers(client):
    response = client.post("/api/v1/auth/login", json={
        "email": "admin@newsradar.com",
        "password": "admin123",
    })
    assert response.status_code == 200, f"Login fallido: {response.json()}"
    token = response.json()["access_token"]
    return {"Authorization": f"Bearer {token}"}


# IPTC categories

def test_list_iptc_categories_ok(client, auth_headers):
    response = client.get("/api/v1/iptc-categories", headers=auth_headers)
    assert response.status_code == 200
    assert isinstance(response.json(), list)
    assert len(response.json()) > 0


def test_iptc_categories_have_code_and_label(client, auth_headers):
    response = client.get("/api/v1/iptc-categories", headers=auth_headers)
    first = response.json()[0]
    assert "code" in first
    assert "label" in first


# GET /categories

def test_list_categories_requires_auth(client):
    response = client.get("/api/v1/categories")
    assert response.status_code == 401


def test_list_categories_returns_list(client, auth_headers):
    response = client.get("/api/v1/categories", headers=auth_headers)
    assert response.status_code == 200
    assert isinstance(response.json(), list)


# POST /categories

def test_create_category_minimal(client, auth_headers):
    payload = {"name": "Política", "source": "IPTC"}
    response = client.post("/api/v1/categories", json=payload, headers=auth_headers)
    assert response.status_code == 201
    data = response.json()
    assert data["name"] == "Política"
    assert data["source"] == "IPTC"
    assert "id" in data


def test_create_category_with_valid_iptc_code(client, auth_headers):
    iptc_list = client.get("/api/v1/iptc-categories", headers=auth_headers).json()
    valid_code = iptc_list[0]["code"]
    valid_label = iptc_list[0]["label"]

    payload = {
        "name": "Deportes",
        "source": "IPTC",
        "iptc_code": valid_code,
        "iptc_label": valid_label,
    }
    response = client.post("/api/v1/categories", json=payload, headers=auth_headers)
    assert response.status_code == 201
    assert response.json()["iptc_code"] == valid_code
    assert response.json()["iptc_label"] == valid_label


def test_create_category_with_invalid_iptc_code(client, auth_headers):
    payload = {
        "name": "Inválida",
        "source": "IPTC",
        "iptc_code": "CODIGO_INEXISTENTE_XYZ",
    }
    response = client.post("/api/v1/categories", json=payload, headers=auth_headers)
    assert response.status_code == 422


def test_create_category_without_iptc_code(client, auth_headers):
    payload = {"name": "Sin IPTC", "source": "IPTC"}
    response = client.post("/api/v1/categories", json=payload, headers=auth_headers)
    assert response.status_code == 201
    assert response.json()["iptc_code"] is None


# GET /categories/{id}

def test_get_category_by_id(client, auth_headers):
    created = client.post("/api/v1/categories", json={"name": "Tech"}, headers=auth_headers)
    cat_id = created.json()["id"]
    response = client.get(f"/api/v1/categories/{cat_id}", headers=auth_headers)
    assert response.status_code == 200
    assert response.json()["id"] == cat_id


def test_get_category_not_found(client, auth_headers):
    response = client.get("/api/v1/categories/99999", headers=auth_headers)
    assert response.status_code == 404


#  PUT /categories/{id}

def test_update_category_name(client, auth_headers):
    created = client.post("/api/v1/categories", json={"name": "Vieja"}, headers=auth_headers)
    cat_id = created.json()["id"]
    response = client.put(f"/api/v1/categories/{cat_id}", json={"name": "Nueva"}, headers=auth_headers)
    assert response.status_code == 200
    assert response.json()["name"] == "Nueva"


def test_update_category_valid_iptc_code(client, auth_headers):
    iptc_list = client.get("/api/v1/iptc-categories", headers=auth_headers).json()
    valid_code = iptc_list[1]["code"]
    created = client.post("/api/v1/categories", json={"name": "Para actualizar"}, headers=auth_headers)
    cat_id = created.json()["id"]
    response = client.put(f"/api/v1/categories/{cat_id}", json={"iptc_code": valid_code}, headers=auth_headers)
    assert response.status_code == 200
    assert response.json()["iptc_code"] == valid_code


def test_update_category_invalid_iptc_code(client, auth_headers):
    created = client.post("/api/v1/categories", json={"name": "Para fallar"}, headers=auth_headers)
    cat_id = created.json()["id"]
    response = client.put(f"/api/v1/categories/{cat_id}", json={"iptc_code": "MAL_CODIGO"}, headers=auth_headers)
    assert response.status_code == 422


def test_update_category_not_found(client, auth_headers):
    response = client.put("/api/v1/categories/99999", json={"name": "No existe"}, headers=auth_headers)
    assert response.status_code == 404


# DELETE /categories/{id}

def test_delete_category_ok(client, auth_headers):
    created = client.post("/api/v1/categories", json={"name": "Para borrar"}, headers=auth_headers)
    cat_id = created.json()["id"]
    response = client.delete(f"/api/v1/categories/{cat_id}", headers=auth_headers)
    assert response.status_code == 204
    get_response = client.get(f"/api/v1/categories/{cat_id}", headers=auth_headers)
    assert get_response.status_code == 404


def test_delete_category_not_found(client, auth_headers):
    response = client.delete("/api/v1/categories/99999", headers=auth_headers)
    assert response.status_code == 404