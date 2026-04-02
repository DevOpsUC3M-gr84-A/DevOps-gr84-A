import pytest


@pytest.mark.integration
def test_information_source_and_channel_crud_via_api_only(api_client):
    source_response = api_client.post(
        "/api/v1/information-sources",
        json={"name": "RF01 Source", "url": "https://source-rf01.test"},
    )
    assert source_response.status_code == 201
    source_id = source_response.json()["id"]

    get_source = api_client.get(f"/api/v1/information-sources/{source_id}")
    assert get_source.status_code == 200

    channel_response = api_client.post(
        f"/api/v1/information-sources/{source_id}/rss-channels",
        json={
            "media_name": "RF01 Feed",
            "url": "https://feed-rf01.test/rss.xml",
            "category_id": 1,
            "iptc_category": "04010000",
        },
    )
    assert channel_response.status_code == 201
    channel_id = channel_response.json()["id"]

    get_channel = api_client.get(
        f"/api/v1/information-sources/{source_id}/rss-channels/{channel_id}"
    )
    assert get_channel.status_code == 200

    update_channel = api_client.put(
        f"/api/v1/information-sources/{source_id}/rss-channels/{channel_id}",
        json={"url": "https://feed-rf01.test/rss-updated.xml", "category_id": 2},
    )
    assert update_channel.status_code == 200

    delete_channel = api_client.delete(
        f"/api/v1/information-sources/{source_id}/rss-channels/{channel_id}"
    )
    assert delete_channel.status_code == 204

    final_channel_get = api_client.get(
        f"/api/v1/information-sources/{source_id}/rss-channels/{channel_id}"
    )
    assert final_channel_get.status_code == 404

    delete_source = api_client.delete(f"/api/v1/information-sources/{source_id}")
    assert delete_source.status_code == 204

    final_source_get = api_client.get(f"/api/v1/information-sources/{source_id}")
    assert final_source_get.status_code == 404


@pytest.mark.integration
def test_sources_and_channels_rbac_and_404(api_client, api_client_lector):
    source_get = api_client.get("/api/v1/information-sources/999999")
    assert source_get.status_code == 404

    channel_get = api_client.get("/api/v1/information-sources/999999/rss-channels/999999")
    assert channel_get.status_code == 404

    lector_create_source = api_client_lector.post(
        "/api/v1/information-sources",
        json={"name": "Blocked", "url": "https://blocked.test"},
    )
    assert lector_create_source.status_code == 403
