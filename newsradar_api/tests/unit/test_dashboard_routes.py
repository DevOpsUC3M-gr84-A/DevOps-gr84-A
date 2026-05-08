"""
Tests unitarios para el endpoint GET /api/v1/dashboard/summary y la función
auxiliar _build_top_categories.
Trazabilidad: RF16 (Panel de mando - estadísticas globales).
"""

import pytest
from unittest.mock import MagicMock, patch

from app.api.routes.dashboard import _build_top_categories
from app.core.iptc_categories import IPTC_FIRST_LEVEL


# ─── Helpers ──────────────────────────────────────────────────────────────────

def _make_es_mock(count: int = 0):
    """Elasticsearch mock con búsquedas vacías y count configurable."""
    mock = MagicMock()
    mock.count.return_value = {"count": count}
    mock.search.return_value = {
        "aggregations": {
            "daily": {"buckets": []},
            "top_categories": {"buckets": []},
        }
    }
    return mock


# ─── Tests unitarios de _build_top_categories ─────────────────────────────────

class TestBuildTopCategories:
    """Verifica la traducción de códigos IPTC a nombres legibles (fix RF16)."""

    def test_traduce_codigos_iptc_a_nombres_legibles(self):
        mock_es = MagicMock()
        mock_es.search.return_value = {
            "aggregations": {
                "top_categories": {
                    "buckets": [
                        {"key": 1000000, "doc_count": 100},
                        {"key": 11000000, "doc_count": 50},
                    ]
                }
            }
        }

        result = _build_top_categories(mock_es)

        labels = [c.label for c in result]
        assert IPTC_FIRST_LEVEL[1000000] in labels
        assert IPTC_FIRST_LEVEL[11000000] in labels
        assert 1000000 not in labels
        assert 11000000 not in labels

    def test_preserva_clave_cuando_no_es_codigo_iptc(self):
        mock_es = MagicMock()
        mock_es.search.return_value = {
            "aggregations": {
                "top_categories": {
                    "buckets": [{"key": "nombre-libre", "doc_count": 10}]
                }
            }
        }

        result = _build_top_categories(mock_es)

        assert result[0].label == "nombre-libre"

    def test_devuelve_lista_vacia_si_elasticsearch_falla(self):
        mock_es = MagicMock()
        mock_es.search.side_effect = Exception("Conexión rechazada")

        result = _build_top_categories(mock_es)

        assert result == []

    def test_devuelve_lista_vacia_si_buckets_vacios(self):
        mock_es = MagicMock()
        mock_es.search.return_value = {
            "aggregations": {"top_categories": {"buckets": []}}
        }

        result = _build_top_categories(mock_es)

        assert result == []

    def test_mantiene_el_valor_doc_count_de_cada_bucket(self):
        mock_es = MagicMock()
        mock_es.search.return_value = {
            "aggregations": {
                "top_categories": {
                    "buckets": [{"key": 4000000, "doc_count": 77}]
                }
            }
        }

        result = _build_top_categories(mock_es)

        assert result[0].value == 77


# ─── Tests del endpoint GET /dashboard/summary ────────────────────────────────

@pytest.mark.unit
class TestDashboardSummaryEndpoint:

    def test_devuelve_200_con_estructura_correcta(self, api_client, auth_headers):
        with patch("app.api.routes.dashboard.Elasticsearch", return_value=_make_es_mock()):
            response = api_client.get("/api/v1/dashboard/summary", headers=auth_headers)

        assert response.status_code == 200
        data = response.json()
        for field in [
            "active_sources",
            "rss_channels",
            "alerts_configured",
            "captured_news_total",
            "last_7_days",
            "last_30_days",
            "top_categories",
        ]:
            assert field in data, f"Campo '{field}' ausente en la respuesta"

    def test_sin_elasticsearch_devuelve_7_puntos_a_cero(self, api_client, auth_headers):
        with patch(
            "app.api.routes.dashboard.Elasticsearch",
            side_effect=Exception("No disponible"),
        ):
            response = api_client.get("/api/v1/dashboard/summary", headers=auth_headers)

        data = response.json()
        assert response.status_code == 200
        assert len(data["last_7_days"]) == 7
        assert all(p["value"] == 0 for p in data["last_7_days"])

    def test_sin_elasticsearch_devuelve_30_puntos_a_cero(self, api_client, auth_headers):
        with patch(
            "app.api.routes.dashboard.Elasticsearch",
            side_effect=Exception("No disponible"),
        ):
            response = api_client.get("/api/v1/dashboard/summary", headers=auth_headers)

        data = response.json()
        assert len(data["last_30_days"]) == 30
        assert all(p["value"] == 0 for p in data["last_30_days"])

    def test_sin_elasticsearch_noticias_totales_es_cero(self, api_client, auth_headers):
        with patch(
            "app.api.routes.dashboard.Elasticsearch",
            side_effect=Exception("No disponible"),
        ):
            response = api_client.get("/api/v1/dashboard/summary", headers=auth_headers)

        assert response.json()["captured_news_total"] == 0

    def test_sin_autenticacion_devuelve_401(self, api_client_no_auth):
        response = api_client_no_auth.get("/api/v1/dashboard/summary")
        assert response.status_code == 401

    def test_lector_puede_acceder(self, api_client_lector, lector_auth_headers):
        with patch("app.api.routes.dashboard.Elasticsearch", return_value=_make_es_mock()):
            response = api_client_lector.get(
                "/api/v1/dashboard/summary", headers=lector_auth_headers
            )
        assert response.status_code == 200

    def test_categorias_incluyen_label_y_value(self, api_client, auth_headers):
        mock_es = MagicMock()
        mock_es.count.return_value = {"count": 0}
        mock_es.search.return_value = {
            "aggregations": {
                "daily": {"buckets": []},
                "top_categories": {
                    "buckets": [{"key": 4000000, "doc_count": 30}]
                },
            }
        }

        with patch("app.api.routes.dashboard.Elasticsearch", return_value=mock_es):
            response = api_client.get("/api/v1/dashboard/summary", headers=auth_headers)

        categories = response.json()["top_categories"]
        assert len(categories) == 1
        assert categories[0]["label"] == IPTC_FIRST_LEVEL[4000000]
        assert categories[0]["value"] == 30

    def test_noticias_totales_refleja_count_de_elasticsearch(self, api_client, auth_headers):
        mock_es = _make_es_mock(count=500)

        with patch("app.api.routes.dashboard.Elasticsearch", return_value=mock_es):
            response = api_client.get("/api/v1/dashboard/summary", headers=auth_headers)

        assert response.json()["captured_news_total"] == 500
