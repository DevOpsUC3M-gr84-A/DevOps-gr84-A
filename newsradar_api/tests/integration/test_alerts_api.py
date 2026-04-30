import pytest
from app.models.rss import RSSChannel, CategoriaIPTC


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


@pytest.mark.integration
def test_create_alert_with_explicit_rss_channels_rf07(api_client, seeded_user, test_session_factory):
    """RF07: Test creating alert with explicitly specified RSS channels."""
    session = test_session_factory()
    try:
        # Create RSS channels
        tech_channel = RSSChannel(
            media_name="Tech News",
            url="https://technews.com/feed2",
            iptc_category=CategoriaIPTC.TECNOLOGIA,
            is_active=True,
        )
        eco_channel = RSSChannel(
            media_name="Economy Times",
            url="https://economy.com/feed",
            iptc_category=CategoriaIPTC.ECONOMIA,
            is_active=True,
        )
        session.add_all([tech_channel, eco_channel])
        session.commit()
        session.refresh(tech_channel)
        session.refresh(eco_channel)

        # Create alert with explicit channel selection
        create_payload = {
            "name": "Selective Alert",
            "descriptors": ["business", "startup"],
            "categories": [{"code": "04000000", "label": "Economia"}],
            "rss_channels_ids": [str(eco_channel.id)],  # Explicitly specify only one channel
            "cron_expression": "*/5 * * * *",
        }

        response = api_client.post(
            f"/api/v1/users/{seeded_user.id}/alerts",
            json=create_payload,
        )

        assert response.status_code == 201
        data = response.json()
        assert data["name"] == "Selective Alert"
        assert data["rss_channels_ids"] == [str(eco_channel.id)]

    finally:
        session.close()


@pytest.mark.integration
def test_update_alert_rss_channels_rf07(api_client, seeded_user, test_session_factory):
    """RF07: Test updating alert RSS channels."""
    session = test_session_factory()
    try:
        # Create RSS channels
        channel_1 = RSSChannel(
            media_name="Channel 1",
            url="https://channel1.com/feed",
            iptc_category=CategoriaIPTC.DEPORTES,
            is_active=True,
        )
        channel_2 = RSSChannel(
            media_name="Channel 2",
            url="https://channel2.com/feed",
            iptc_category=CategoriaIPTC.DEPORTES,
            is_active=True,
        )
        channel_3 = RSSChannel(
            media_name="Channel 3",
            url="https://channel3.com/feed",
            iptc_category=CategoriaIPTC.DEPORTES,
            is_active=True,
        )
        session.add_all([channel_1, channel_2, channel_3])
        session.commit()
        session.refresh(channel_1)
        session.refresh(channel_2)
        session.refresh(channel_3)

        # Create alert
        create_payload = {
            "name": "Sports Alert",
            "descriptors": ["football"],
            "categories": [{"code": "15000000", "label": "Deportes"}],
            "rss_channels_ids": [str(channel_1.id)],
            "cron_expression": "*/1 * * * *",
        }

        create_response = api_client.post(
            f"/api/v1/users/{seeded_user.id}/alerts",
            json=create_payload,
        )
        assert create_response.status_code == 201
        alert_id = create_response.json()["id"]

        # Update RSS channels
        update_payload = {
            "rss_channels_ids": [str(channel_2.id), str(channel_3.id)]
        }

        update_response = api_client.put(
            f"/api/v1/users/{seeded_user.id}/alerts/{alert_id}",
            json=update_payload,
        )

        assert update_response.status_code == 200
        data = update_response.json()
        assert set(data["rss_channels_ids"]) == {str(channel_2.id), str(channel_3.id)}

    finally:
        session.close()


