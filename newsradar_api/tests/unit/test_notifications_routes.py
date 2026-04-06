from datetime import datetime, timezone

import pytest

from app.schemas.alert import Alert
from app.stores.memory import alerts_store, notifications_store


@pytest.fixture(autouse=True)
def clear_notification_stores():
    alerts_store.clear()
    notifications_store.clear()
    yield
    alerts_store.clear()
    notifications_store.clear()


@pytest.mark.unit
def test_notifications_crud_flow(api_client, auth_headers):
    alerts_store[1] = Alert(
        id=1,
        user_id=1,
        name="Alerta QA",
        descriptors=["test"],
        categories=[],
        cron_expression="0 * * * *",
    )

    payload = {
        "timestamp": datetime.now(timezone.utc).isoformat(),
        "metrics": [{"name": "mentions", "value": 5.0}],
    }

    create_response = api_client.post(
        "/api/v1/users/1/alerts/1/notifications",
        json=payload,
        headers=auth_headers,
    )
    assert create_response.status_code == 201
    notification_id = create_response.json()["id"]

    list_response = api_client.get(
        "/api/v1/users/1/alerts/1/notifications", headers=auth_headers
    )
    assert list_response.status_code == 200
    assert len(list_response.json()) == 1

    get_response = api_client.get(
        f"/api/v1/users/1/alerts/1/notifications/{notification_id}",
        headers=auth_headers,
    )
    assert get_response.status_code == 200

    update_response = api_client.put(
        f"/api/v1/users/1/alerts/1/notifications/{notification_id}",
        json={"metrics": [{"name": "mentions", "value": 9.0}]},
        headers=auth_headers,
    )
    assert update_response.status_code == 200
    assert update_response.json()["metrics"][0]["value"] == 9.0

    delete_response = api_client.delete(
        f"/api/v1/users/1/alerts/1/notifications/{notification_id}",
        headers=auth_headers,
    )
    assert delete_response.status_code == 204


@pytest.mark.unit
def test_notifications_returns_404_when_alert_not_found(api_client, auth_headers):
    payload = {
        "timestamp": datetime.now(timezone.utc).isoformat(),
        "metrics": [{"name": "mentions", "value": 1.0}],
    }

    response = api_client.post(
        "/api/v1/users/1/alerts/999/notifications",
        json=payload,
        headers=auth_headers,
    )

    assert response.status_code == 404
    assert response.json()["detail"] == "Alerta no encontrada para el usuario"
