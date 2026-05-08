import pytest
from fastapi.testclient import TestClient
from app.main import app

client = TestClient(app)


def test_recommend_keywords_returns_descriptors_3_to_10():
    response = client.get(
        "/api/v1/alerts/keyword-recommendations", params={"keyword": "noticia"}
    )
    assert response.status_code == 200
    body = response.json()
    assert isinstance(body, dict)
    assert "descriptors" in body
    descriptors = body["descriptors"]
    assert isinstance(descriptors, list)
    assert 3 <= len(descriptors) <= 10
    if descriptors:
        assert all("noticia".lower() != p.lower() for p in descriptors)


def test_recommend_keywords_falls_back_for_gibberish():
    response = client.get(
        "/api/v1/alerts/keyword-recommendations",
        params={"keyword": "asdkfjhasdkjfh"},
    )
    assert response.status_code == 200
    body = response.json()
    assert isinstance(body, dict)
    assert "descriptors" in body
    descriptors = body["descriptors"]
    assert isinstance(descriptors, list)
    assert 3 <= len(descriptors) <= 10
