import pytest
from fastapi.testclient import TestClient
from app.main import app
from app.utils.seed_utils import create_seed_data


@pytest.fixture(scope="session", autouse=True)
def init_seed():
    """Equivale al evento on_startup que no se dispara en TestClient directo."""
    create_seed_data()


@pytest.fixture(scope="session")
def client():
    with TestClient(app) as c:
        yield c


@pytest.fixture(scope="session")
def admin_auth_headers(client):
    response = client.post(
        "/api/v1/auth/login",
        json={"email": "admin@newsradar.com", "password": "admin123"},
    )
    assert response.status_code == 200, response.text
    token = response.json()["access_token"]
    return {"Authorization": f"Bearer {token}"}


@pytest.fixture(scope="session")
def lector_auth_headers(client):
    response = client.post(
        "/api/v1/auth/login",
        json={"email": "lector@newsradar.com", "password": "lector123"},
    )
    assert response.status_code == 200, response.text
    token = response.json()["access_token"]
    return {"Authorization": f"Bearer {token}"}


@pytest.fixture(scope="session")
def sample_information_source(client, admin_auth_headers):
    response = client.post(
        "/api/v1/information-sources",
        json={"name": "Agencia EFE", "url": "https://www.efe.com/rss.xml"},
        headers=admin_auth_headers,
    )
    assert response.status_code == 201, response.text
    return response.json()["id"]


def test_lector_can_read_alerts_and_sources(client, lector_auth_headers, sample_information_source):
    list_response = client.get("/api/v1/information-sources", headers=lector_auth_headers)
    assert list_response.status_code == 200
    assert any(source["id"] == sample_information_source for source in list_response.json())

    get_source_response = client.get(
        f"/api/v1/information-sources/{sample_information_source}",
        headers=lector_auth_headers,
    )
    assert get_source_response.status_code == 200

    get_alerts_response = client.get("/api/v1/users/2/alerts", headers=lector_auth_headers)
    assert get_alerts_response.status_code == 200
    assert isinstance(get_alerts_response.json(), list)


def test_lector_cannot_create_alert(client, lector_auth_headers):
    response = client.post(
        "/api/v1/users/2/alerts",
        json={
            "name": "Alerta de prueba",
            "descriptors": ["economía"],
            "categories": [],
            "cron_expression": "0 0 * * *",
        },
        headers=lector_auth_headers,
    )
    assert response.status_code == 403


def test_lector_cannot_manage_information_sources(client, lector_auth_headers, sample_information_source):
    create_response = client.post(
        "/api/v1/information-sources",
        json={"name": "Fuente secreta", "url": "https://ejemplo.com/rss.xml"},
        headers=lector_auth_headers,
    )
    assert create_response.status_code == 403

    update_response = client.put(
        f"/api/v1/information-sources/{sample_information_source}",
        json={"name": "Fuente modificada"},
        headers=lector_auth_headers,
    )
    assert update_response.status_code == 403

    delete_response = client.delete(
        f"/api/v1/information-sources/{sample_information_source}",
        headers=lector_auth_headers,
    )
    assert delete_response.status_code == 403
