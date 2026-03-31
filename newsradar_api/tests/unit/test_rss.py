"""
Este módulo contiene pruebas unitarias para los servicios,
esquemas y modelos relacionados con la gestión de canales RSS.
"""

from datetime import datetime
from unittest.mock import MagicMock
import pytest
from app.services import rss_service
from app.schemas.rss import RSSChannelCreate, RSSChannelResponse
from app.models.rss import CategoriaIPTC, RSSChannel


@pytest.mark.unit
class TestRssService:
    """Testea los servicios relacionados con la gestión de canales RSS"""

    def test_create_rss_channel_success(self):
        """Debe crear un canal RSS correctamente en la base de datos"""
        db = MagicMock()
        rss_in = RSSChannelCreate(
            media_name="El País",
            url="https://elpais.com/rss/technology.xml",
            iptc_category=CategoriaIPTC.TECNOLOGIA,
            category_id=1,
        )
        # Simula el objeto devuelto por la BD
        db.add.return_value = None
        db.commit.return_value = None
        db.refresh.side_effect = lambda obj: setattr(obj, "id", 1)

        result = rss_service.create_rss_channel(db, rss_in)
        assert isinstance(result, RSSChannel)
        assert result.media_name == "El País"
        assert result.url == "https://elpais.com/rss/technology.xml"
        assert result.iptc_category == CategoriaIPTC.TECNOLOGIA

    def test_get_all_rss_channels(self):
        """Debe devolver la lista de canales RSS"""
        db = MagicMock()
        mock_channel = MagicMock(spec=RSSChannel)
        db.query.return_value.offset.return_value.limit.return_value.all.return_value = [
            mock_channel
        ]
        result = rss_service.get_all_rss_channels(db)
        assert isinstance(result, list)
        assert len(result) == 1


@pytest.mark.unit
class TestRssSchemas:
    """Testea los esquemas de datos relacionados con los canales RSS"""

    def test_rss_channel_create_schema(self):
        """Valida el esquema de entrada para crear canal RSS"""
        data = {
            "media_name": "El Mundo",
            "url": "https://elmundo.es/rss.xml",
            "iptc_category": CategoriaIPTC.ECONOMIA,
            "category_id": 2,
        }
        schema = RSSChannelCreate(**data)
        assert schema.media_name == "El Mundo"
        assert str(schema.url) == "https://elmundo.es/rss.xml"
        assert schema.iptc_category == CategoriaIPTC.ECONOMIA

    def test_rss_channel_response_schema(self):
        """Valida el esquema de respuesta de canal RSS"""
        data = {
            "media_name": "BBC",
            "url": "https://bbc.com/rss.xml",
            "iptc_category": CategoriaIPTC.CIENCIA,
            "category_id": 3,
            "id": 10,
            "created_at": datetime.now(),
        }
        schema = RSSChannelResponse(**data)
        assert schema.id == 10
        assert schema.media_name == "BBC"
        assert schema.iptc_category == CategoriaIPTC.CIENCIA


@pytest.mark.unit
class TestRssModel:
    """Testea los modelos de base de datos relacionados con los canales RSS"""

    def test_categoria_iptc_enum(self):
        """Valida que las categorías IPTC existan y sean strings"""
        assert isinstance(CategoriaIPTC.POLITICA.value, str)
        assert CategoriaIPTC.TECNOLOGIA.value == "04010000"

    def test_rss_channel_model_fields(self):
        """Valida los campos del modelo RSSChannel"""
        channel = RSSChannel(
            id=1,
            media_name="Test",
            url="https://test.com/rss.xml",
            iptc_category=CategoriaIPTC.OTROS,
            created_at=datetime.now(),
        )
        assert channel.media_name == "Test"
        assert channel.url.startswith("http")
        assert channel.iptc_category == CategoriaIPTC.OTROS
