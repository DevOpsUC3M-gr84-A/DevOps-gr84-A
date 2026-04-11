import pytest


@pytest.mark.integration
def test_alerts_crud_via_api_only(api_client, seeded_user):
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
    alert_id = created["id"]

    get_response = api_client.get(f"/api/v1/users/{seeded_user.id}/alerts/{alert_id}")
    assert get_response.status_code == 200
    assert get_response.json()["name"] == "Alerta RF01"

    update_response = api_client.put(
        f"/api/v1/users/{seeded_user.id}/alerts/{alert_id}",
        json={"name": "Alerta RF01 Actualizada", "descriptors": ["economy"]},
    )
    assert update_response.status_code == 200
    assert update_response.json()["name"] == "Alerta RF01 Actualizada"

    delete_response = api_client.delete(
        f"/api/v1/users/{seeded_user.id}/alerts/{alert_id}"
    )
    assert delete_response.status_code == 204

    final_get = api_client.get(f"/api/v1/users/{seeded_user.id}/alerts/{alert_id}")
    assert final_get.status_code == 404


@pytest.mark.integration
def test_alerts_404_paths_via_api_only(api_client, seeded_user):
    response = api_client.post(
        "/api/v1/users/999999/alerts",
        json={
            "name": "Alerta Usuario Inexistente",
            "descriptors": ["security"],
            "categories": [{"code": "01000000", "label": "Cultura"}],
            "cron_expression": "*/5 * * * *",
        },
    )
    assert response.status_code == 404

    get_response = api_client.get(f"/api/v1/users/{seeded_user.id}/alerts/999999")
    assert get_response.status_code == 404

    update_response = api_client.put(
        f"/api/v1/users/{seeded_user.id}/alerts/999999",
        json={"name": "ghost"},
    )
    assert update_response.status_code == 404

    delete_response = api_client.delete(
        f"/api/v1/users/{seeded_user.id}/alerts/999999"
    )
    assert delete_response.status_code == 404


@pytest.mark.integration
def test_alert_limit_per_user_rf03(api_client, seeded_user):
    """RF03: Integration test for the 20 alert limit per user."""
    # Create 20 alerts (the maximum allowed)
    created_alert_ids = []
    for i in range(20):
        create_payload = {
            "name": f"Alerta {i+1}",
            "descriptors": [f"keyword{i}"],
            "categories": [{"code": "04010000", "label": "Tecnologia"}],
            "cron_expression": "*/1 * * * *",
        }
        response = api_client.post(
            f"/api/v1/users/{seeded_user.id}/alerts",
            json=create_payload,
        )
        assert response.status_code == 201, f"Failed to create alert {i+1}"
        created_alert_ids.append(response.json()["id"])

    # Try to create the 21st alert - should fail with 400
    response = api_client.post(
        f"/api/v1/users/{seeded_user.id}/alerts",
        json={
            "name": "Alerta 21 - Should Fail",
            "descriptors": ["overflow"],
            "categories": [{"code": "01000000", "label": "Cultura"}],
            "cron_expression": "*/5 * * * *",
        },
    )
    assert response.status_code == 400
    assert "limite maximo de 20 alertas" in response.json()["detail"]

    # Delete one alert to free up space
    delete_response = api_client.delete(
        f"/api/v1/users/{seeded_user.id}/alerts/{created_alert_ids[0]}"
    )
    assert delete_response.status_code == 204

    # Now creating a new alert should succeed
    response = api_client.post(
        f"/api/v1/users/{seeded_user.id}/alerts",
        json={
            "name": "Alerta 20 - After Delete",
            "descriptors": ["newkeyword"],
            "categories": [{"code": "02000000", "label": "Economia"}],
            "cron_expression": "*/2 * * * *",
        },
    )
    assert response.status_code == 201
    assert response.json()["name"] == "Alerta 20 - After Delete"
