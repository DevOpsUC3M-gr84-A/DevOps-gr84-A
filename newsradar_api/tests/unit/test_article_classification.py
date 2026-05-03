"""Tests para RF08: Clasificación de Noticias según categoría IPTC."""

import pytest
from unittest.mock import patch, MagicMock
from elasticsearch import Elasticsearch
from sqlalchemy.orm import Session

from app.services.workflows.classification_workflow import (
    classify_article,
    _get_first_level_iptc_category,
)
from app.models.alert_monitoring import AlertRule
from app.models.rss import RSSChannel, CategoriaIPTC


@pytest.mark.unit
class TestGetFirstLevelIPTCCategory:
    """Tests para la extracción de categoría IPTC de primer nivel."""

    def test_extracts_first_level_from_full_code(self):
        """Debe extraer los 4 primeros dígitos + 0000 (primer nivel IPTC)."""
        assert _get_first_level_iptc_category("04010000") == "04010000"  # Ya es nivel 1
        assert _get_first_level_iptc_category("04010001") == "04010000"  # Nivel 2/3 -> nivel 1
        assert _get_first_level_iptc_category("13005017") == "13000000"  # Nivel específico -> nivel 1
        assert _get_first_level_iptc_category("15000000") == "15000000"  # Deportes nivel 1

    def test_handles_none_input(self):
        """Debe retornar None si el código es None."""
        assert _get_first_level_iptc_category(None) is None

    def test_handles_short_codes(self):
        """Debe retornar None si el código tiene menos de 4 caracteres."""
        assert _get_first_level_iptc_category("123") is None
        assert _get_first_level_iptc_category("") is None


@pytest.mark.unit
class TestClassifyArticle:
    """Tests para la clasificación de noticias según RF08."""

    @patch("app.services.workflows.classification_workflow.SessionLocal")
    @patch("app.services.workflows.classification_workflow.Elasticsearch")
    def test_classifies_by_alert_category_when_available(
        self, mock_es_class, mock_session_class
    ):
        """RF08: Debe clasificar por categoría de alerta (precedencia 1)."""
        
        # Setup Elasticsearch mock
        mock_es = MagicMock(spec=Elasticsearch)
        mock_es_class.return_value = mock_es
        mock_es.get.return_value = {
            "_source": {
                "title": "Test Article",
                "alert_id": 1,
                "channel_id": 1,
                "source": "BBC",
            }
        }
        
        # Setup BD mock
        mock_db = MagicMock(spec=Session)
        mock_session_class.return_value = mock_db
        
        mock_alert = MagicMock(spec=AlertRule)
        mock_alert.categories = [
            {"code": "04010000", "label": "Economía/Finanzas"}  # Nivel 2, se convierte a nivel 1
        ]
        
        mock_channel = MagicMock(spec=RSSChannel)
        mock_channel.iptc_category = CategoriaIPTC.DEPORTES  # No debe usarse
        
        mock_query = MagicMock()
        mock_query.filter.return_value.first.side_effect = [mock_alert, mock_channel]
        mock_db.query.return_value = mock_query
        
        # Ejecutar
        classify_article("doc-123")
        
        # Verificar que se actualiza ES con la categoría de la alerta
        mock_es.index.assert_called_once()
        call_args = mock_es.index.call_args
        assert call_args[1]["document"]["iptc_category"] == "04010000"  # Primer nivel
        assert call_args[1]["document"]["iptc_category_source"] == "alert"

    @patch("app.services.workflows.classification_workflow.SessionLocal")
    @patch("app.services.workflows.classification_workflow.Elasticsearch")
    def test_classifies_by_channel_when_alert_has_no_category(
        self, mock_es_class, mock_session_class
    ):
        """RF08: Debe clasificar por categoría de canal RSS si alerta no tiene (fallback)."""
        
        # Setup Elasticsearch mock
        mock_es = MagicMock(spec=Elasticsearch)
        mock_es_class.return_value = mock_es
        mock_es.get.return_value = {
            "_source": {
                "title": "Test Article",
                "alert_id": 1,
                "channel_id": 1,
                "source": "Reuters",
            }
        }
        
        # Setup BD mock
        mock_db = MagicMock(spec=Session)
        mock_session_class.return_value = mock_db
        
        mock_alert = MagicMock(spec=AlertRule)
        mock_alert.categories = []  # Sin categorías en la alerta
        
        mock_channel = MagicMock(spec=RSSChannel)
        # Configura el mock para devolver el valor del enum cuando se llama a str()
        mock_channel.iptc_category = CategoriaIPTC.TECNOLOGIA
        
        # Asegúrate de que str() del mock devuelva el valor del enum
        type(mock_channel).iptc_category = property(lambda self: CategoriaIPTC.TECNOLOGIA)
        
        mock_query = MagicMock()
        mock_query.filter.return_value.first.side_effect = [mock_alert, mock_channel]
        mock_db.query.return_value = mock_query
        
        # Ejecutar
        classify_article("doc-456")
        
        # Verificar que se actualiza ES con la categoría del canal
        mock_es.index.assert_called_once()
        call_args = mock_es.index.call_args
        assert call_args[1]["document"]["iptc_category"] == "04010000"  # Primer nivel de TECNOLOGIA
        assert call_args[1]["document"]["iptc_category_source"] == "channel"

    @patch("app.services.workflows.classification_workflow.SessionLocal")
    @patch("app.services.workflows.classification_workflow.Elasticsearch")
    def test_does_not_classify_if_article_not_found(self, mock_es_class, mock_session_class):
        """Debe registrar error y retornar si el artículo no existe en ES."""
        
        mock_es = MagicMock(spec=Elasticsearch)
        mock_es_class.return_value = mock_es
        mock_es.get.side_effect = Exception("Article not found")
        
        # Ejecutar (no debería lanzar excepción)
        classify_article("nonexistent")
        
        # ES.index no debe ser llamado
        mock_es.index.assert_not_called()

    @patch("app.services.workflows.classification_workflow.SessionLocal")
    @patch("app.services.workflows.classification_workflow.Elasticsearch")
    def test_does_not_classify_if_alert_not_found(self, mock_es_class, mock_session_class):
        """Debe registrar error y retornar si la alerta no existe en BD."""
        
        mock_es = MagicMock(spec=Elasticsearch)
        mock_es_class.return_value = mock_es
        mock_es.get.return_value = {
            "_source": {"alert_id": 999, "channel_id": 1}
        }
        
        mock_db = MagicMock(spec=Session)
        mock_session_class.return_value = mock_db
        
        mock_query = MagicMock()
        mock_query.filter.return_value.first.return_value = None  # Alerta no existe
        mock_db.query.return_value = mock_query
        
        # Ejecutar
        classify_article("doc-missing-alert")
        
        # ES.index no debe ser llamado
        mock_es.index.assert_not_called()

    @patch("app.services.workflows.classification_workflow.SessionLocal")
    @patch("app.services.workflows.classification_workflow.Elasticsearch")
    def test_preserves_other_article_fields_during_classification(
        self, mock_es_class, mock_session_class
    ):
        """RF08: Debe preservar los campos del artículo original al clasificar."""
        
        original_article = {
            "title": "Breaking News",
            "link": "https://example.com/article",
            "summary": "Important information",
            "source": "CNN",
            "user_id": 5,
            "alert_id": 2,
            "channel_id": 3,
        }
        
        mock_es = MagicMock(spec=Elasticsearch)
        mock_es_class.return_value = mock_es
        mock_es.get.return_value = {"_source": original_article.copy()}
        
        mock_db = MagicMock(spec=Session)
        mock_session_class.return_value = mock_db
        
        mock_alert = MagicMock(spec=AlertRule)
        mock_alert.categories = [{"code": "15000000", "label": "Deportes"}]
        
        mock_channel = MagicMock(spec=RSSChannel)
        mock_channel.iptc_category = CategoriaIPTC.CULTURA
        
        mock_query = MagicMock()
        mock_query.filter.return_value.first.side_effect = [mock_alert, mock_channel]
        mock_db.query.return_value = mock_query
        
        # Ejecutar
        classify_article("doc-789")
        
        # Verificar que todos los campos originales se preservan + categoría se añade
        mock_es.index.assert_called_once()
        call_args = mock_es.index.call_args
        updated_document = call_args[1]["document"]
        
        assert updated_document["title"] == "Breaking News"
        assert updated_document["source"] == "CNN"
        assert updated_document["user_id"] == 5
        assert updated_document["iptc_category"] == "15000000"  # Primer nivel de Deportes
        assert updated_document["iptc_category_source"] == "alert"  # Nuevo campo
