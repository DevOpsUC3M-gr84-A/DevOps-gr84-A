import pytest

from app.stores.memory import stats_store


@pytest.fixture(autouse=True)
def clear_stats_store():
    stats_store.clear()
    yield
    stats_store.clear()


@pytest.mark.unit
def test_stats_crud_flow(api_client, auth_headers):
    create_response = api_client.post(
        "/api/v1/stats",
        json={"metrics": [{"name": "alert_count", "value": 3.0}]},
        headers=auth_headers,
    )
    assert create_response.status_code == 201
    stats_id = create_response.json()["id"]

    list_response = api_client.get("/api/v1/stats", headers=auth_headers)
    assert list_response.status_code == 200
    assert len(list_response.json()) == 1

    get_response = api_client.get(f"/api/v1/stats/{stats_id}", headers=auth_headers)
    assert get_response.status_code == 200

    update_response = api_client.put(
        f"/api/v1/stats/{stats_id}",
        json={"metrics": [{"name": "alert_count", "value": 10.0}]},
        headers=auth_headers,
    )
    assert update_response.status_code == 200
    assert update_response.json()["metrics"][0]["value"] == 10.0

    delete_response = api_client.delete(f"/api/v1/stats/{stats_id}", headers=auth_headers)
    assert delete_response.status_code == 204


@pytest.mark.unit
def test_stats_not_found_returns_404(api_client, auth_headers):
    response = api_client.get("/api/v1/stats/9999", headers=auth_headers)
    assert response.status_code == 404
