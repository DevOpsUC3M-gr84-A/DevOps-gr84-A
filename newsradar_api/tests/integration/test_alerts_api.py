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

    delete_response = api_client.delete(f"/api/v1/users/{seeded_user.id}/alerts/999999")
    assert delete_response.status_code == 404


@pytest.mark.integration
def test_manager_cannot_create_more_than_20_alerts(api_client, seeded_user):
    for index in range(20):
        response = api_client.post(
            f"/api/v1/users/{seeded_user.id}/alerts",
            json={
                "name": f"Alerta limite {index + 1}",
                "descriptors": [f"keyword-{index}"],
                "categories": [{"code": "04010000", "label": "Tecnologia"}],
                "cron_expression": "*/5 * * * *",
            },
        )
        assert response.status_code == 201

    response_21 = api_client.post(
        f"/api/v1/users/{seeded_user.id}/alerts",
        json={
            "name": "Alerta limite 21",
            "descriptors": ["overflow"],
            "categories": [{"code": "04010000", "label": "Tecnologia"}],
            "cron_expression": "*/5 * * * *",
        },
    )

    assert response_21.status_code == 400
    assert (
        response_21.json()["detail"]
        == "El gestor ya alcanzó el máximo de 20 alertas activas"
    )
