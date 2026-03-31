import pytest

from app.models.alert_monitoring import AlertRule


@pytest.mark.integration
def test_alerts_crud_persists_in_database(api_client, test_session_factory, seeded_user):
    create_payload = {
        "name": "Alerta RF01",
        "descriptors": ["technology", "ai"],
        "categories": [{"code": "04010000", "label": "Tecnologia"}],
        "cron_expression": "*/1 * * * *",
    }

    create_response = api_client.post(
        f"/api/v1/users/{seeded_user.id}/alerts",
        json=create_payload,
    )
    assert create_response.status_code == 201
    created = create_response.json()
    assert created["name"] == create_payload["name"]
    assert created["descriptors"] == create_payload["descriptors"]
    alert_id = created["id"]

    session = test_session_factory()
    try:
        db_alert = session.query(AlertRule).filter(AlertRule.id == alert_id).first()
        assert db_alert is not None
        assert db_alert.user_id == seeded_user.id
        assert db_alert.cron_expression == "*/1 * * * *"
    finally:
        session.close()

    list_response = api_client.get(f"/api/v1/users/{seeded_user.id}/alerts")
    assert list_response.status_code == 200
    listed = list_response.json()
    assert len(listed) == 1
    assert listed[0]["id"] == alert_id

    update_payload = {
        "name": "Alerta RF01 Actualizada",
        "descriptors": ["economy"],
    }
    update_response = api_client.put(
        f"/api/v1/users/{seeded_user.id}/alerts/{alert_id}",
        json=update_payload,
    )
    assert update_response.status_code == 200
    updated = update_response.json()
    assert updated["name"] == "Alerta RF01 Actualizada"
    assert updated["descriptors"] == ["economy"]

    delete_response = api_client.delete(
        f"/api/v1/users/{seeded_user.id}/alerts/{alert_id}"
    )
    assert delete_response.status_code == 204

    session = test_session_factory()
    try:
        db_alert = session.query(AlertRule).filter(AlertRule.id == alert_id).first()
        assert db_alert is not None
        assert db_alert.is_active is False
    finally:
        session.close()


@pytest.mark.integration
def test_create_alert_returns_404_for_non_existing_user(api_client):
    payload = {
        "name": "Alerta Usuario Inexistente",
        "descriptors": ["security"],
        "categories": [{"code": "01000000", "label": "Cultura"}],
        "cron_expression": "*/5 * * * *",
    }

    response = api_client.post("/api/v1/users/999999/alerts", json=payload)
    assert response.status_code == 404
    assert "Usuario no encontrado" in response.text
