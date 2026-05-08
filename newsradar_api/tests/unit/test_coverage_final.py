import pytest
from pydantic import ValidationError

from app.api.routes import categories as categories_module
from app.api.routes import information_sources as information_sources_module
from app.api.routes import rss_channels as rss_channels_module
from app.schemas.information_sources import InformationSourceCreate
from app.stores.memory import categories_store


@pytest.fixture

def isolated_categories_store():
    snapshot = dict(categories_store)
    try:
        yield categories_store
    finally:
        categories_store.clear()
        categories_store.update(snapshot)


@pytest.mark.unit
@pytest.mark.parametrize(
    ("payload", "expected_fragment"),
    [
        ({"name": "Source", "url": "ftp://mal.com"}, "http"),
        ({"name": "Source", "url": ""}, "vacío"),
        ({"name": "Source", "url": 123}, "valid string"),
    ],
)
def test_information_source_create_rejects_invalid_urls(payload, expected_fragment):
    with pytest.raises(ValidationError) as exc_info:
        InformationSourceCreate(**payload)

    assert expected_fragment in str(exc_info.value)


@pytest.mark.unit
def test_get_category_not_found_returns_404(api_client, auth_headers):
    response = api_client.get("/api/v1/categories/9999999", headers=auth_headers)

    assert response.status_code == 404
    assert response.json()["detail"] == categories_module.ERROR_CATEGORY_NOT_FOUND


@pytest.mark.unit
def test_delete_category_not_found_returns_404(api_client, auth_headers):
    response = api_client.delete("/api/v1/categories/9999999", headers=auth_headers)

    assert response.status_code == 404
    assert response.json()["detail"] == categories_module.ERROR_CATEGORY_NOT_FOUND


@pytest.mark.unit
def test_information_source_not_found_on_get_and_delete(api_client, auth_headers):
    get_response = api_client.get("/api/v1/information-sources/9999999", headers=auth_headers)
    delete_response = api_client.delete(
        "/api/v1/information-sources/9999999",
        headers=auth_headers,
    )

    assert get_response.status_code == 404
    assert get_response.json()["detail"] == information_sources_module.ERROR_SOURCE_NOT_FOUND
    assert delete_response.status_code == 404
    assert delete_response.json()["detail"] == information_sources_module.ERROR_SOURCE_NOT_FOUND


@pytest.mark.unit
def test_rss_channel_not_found_on_get_and_delete(api_client, auth_headers):
    source_response = api_client.post(
        "/api/v1/information-sources",
        json={"name": "Temp source", "url": "https://temp-source.test"},
        headers=auth_headers,
    )
    assert source_response.status_code == 201
    source_id = source_response.json()["id"]

    get_response = api_client.get(
        f"/api/v1/information-sources/{source_id}/rss-channels/9999999",
        headers=auth_headers,
    )
    delete_response = api_client.delete(
        f"/api/v1/information-sources/{source_id}/rss-channels/9999999",
        headers=auth_headers,
    )

    assert get_response.status_code == 404
    assert get_response.json()["detail"] == rss_channels_module.ERROR_CHANNEL_NOT_FOUND
    assert delete_response.status_code == 404
    assert delete_response.json()["detail"] == rss_channels_module.ERROR_CHANNEL_NOT_FOUND


@pytest.mark.unit
def test_create_rss_channel_invalid_category_returns_422(api_client, auth_headers, isolated_categories_store):
    isolated_categories_store.clear()

    source_response = api_client.post(
        "/api/v1/information-sources",
        json={"name": "Category source", "url": "https://category-source.test"},
        headers=auth_headers,
    )
    assert source_response.status_code == 201
    source_id = source_response.json()["id"]

    response = api_client.post(
        f"/api/v1/information-sources/{source_id}/rss-channels",
        json={
            "media_name": "Temp media",
            "url": "https://feed.test/rss",
            "category_id": 9999999,
            "iptc_category": "04010000",
        },
        headers=auth_headers,
    )

    assert response.status_code == 422
    assert response.json()["detail"] == rss_channels_module.ERROR_INVALID_CATEGORY
