import pytest


@pytest.fixture
def sample_information_source(api_client, auth_headers):
    response = api_client.post(
        "/api/v1/information-sources",
        json={"name": "Agencia EFE", "url": "https://www.efe.com/rss.xml"},
        headers=auth_headers,
    )
    assert response.status_code == 201, response.text
    return response.json()["id"]


@pytest.mark.unit
def test_lector_can_read_alerts_and_sources(api_client_lector, lector_auth_headers, sample_information_source):
    list_response = api_client_lector.get("/api/v1/information-sources", headers=lector_auth_headers)
    assert list_response.status_code == 200
    assert any(source["id"] == sample_information_source for source in list_response.json())

    get_source_response = api_client_lector.get(
        f"/api/v1/information-sources/{sample_information_source}",
        headers=lector_auth_headers,
    )
    assert get_source_response.status_code == 200

    get_alerts_response = api_client_lector.get("/api/v1/users/1/alerts", headers=lector_auth_headers)
    assert get_alerts_response.status_code == 200
    assert isinstance(get_alerts_response.json(), list)


@pytest.mark.unit
def test_lector_cannot_create_alert(api_client_lector, lector_auth_headers):
    response = api_client_lector.post(
        "/api/v1/users/1/alerts",
        json={
            "name": "Alerta de prueba",
            "descriptors": ["economía"],
            "categories": [],
            "cron_expression": "0 0 * * *",
        },
        headers=lector_auth_headers,
    )
    assert response.status_code == 403


@pytest.mark.unit
def test_lector_cannot_manage_information_sources(api_client_lector, lector_auth_headers, sample_information_source):
    create_response = api_client_lector.post(
        "/api/v1/information-sources",
        json={"name": "Fuente secreta", "url": "https://ejemplo.com/rss.xml"},
        headers=lector_auth_headers,
    )
    assert create_response.status_code == 403

    update_response = api_client_lector.put(
        f"/api/v1/information-sources/{sample_information_source}",
        json={"name": "Fuente modificada"},
        headers=lector_auth_headers,
    )
    assert update_response.status_code == 403

    delete_response = api_client_lector.delete(
        f"/api/v1/information-sources/{sample_information_source}",
        headers=lector_auth_headers,
    )
    assert delete_response.status_code == 403
