import pytest

from fastapi.testclient import TestClient
from app.main import app



@pytest.fixture
def client():
    with TestClient(app) as test_client:
        yield test_client


def test_read_root(client):
    """Prueba que el endpoint raíz (/) responde correctamente y devuelve un 200 OK"""
    response = client.get("/")
    assert response.status_code == 200
    assert response.json() == {"message": "Motor API REST de NewsRadar activo. Visita /docs"}

def test_app_metadata():
    """Verifica que la API tiene configurados los metadatos correctos para Swagger/OpenAPI"""
    assert app.title == "NewsRadar API"
    assert app.version == "1.0.0"