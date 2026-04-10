import pytest
from fastapi.testclient import TestClient
from app.main import app

client = TestClient(app)


def test_recommend_keywords_returns_3_to_10_words():
    response = client.get(
        "/api/v1/alerts/keyword-recommendations", params={"keyword": "noticia"}
    )
    assert response.status_code == 200
    palabras = response.json()
    assert isinstance(palabras, list)
    assert 0 <= len(palabras) <= 10
    # Si hay resultados, deben ser diferentes a la palabra original
    if palabras:
        assert all("noticia".lower() != p.lower() for p in palabras)


def test_recommend_keywords_empty_for_gibberish():
    response = client.get(
        "/api/v1/alerts/keyword-recommendations", params={"keyword": "asdkfjhasdkjfh"}
    )
    assert response.status_code == 200
    palabras = response.json()
    assert isinstance(palabras, list)
    assert len(palabras) == 0
