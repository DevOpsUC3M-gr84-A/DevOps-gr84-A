import pytest
from unittest.mock import patch, MagicMock
from app.services.rss_parser import fetch_and_filter_rss

@patch('app.services.rss_parser.feedparser.parse')
def test_fetch_and_filter_rss_success(mock_parse):
    """Prueba que el filtro encuentra palabras clave correctamente"""
    mock_feed = MagicMock()
    mock_feed.bozo = False
    mock_feed.entries = [
        {"title": "Noticia de España", "summary": "Contenido test", "link": "http://1", "published": "hoy"},
        {"title": "Otras cosas", "summary": "Sin keywords", "link": "http://2", "published": "hoy"}
    ]
    mock_parse.return_value = mock_feed

    results = fetch_and_filter_rss("http://fake.com", ["españa"])
    assert len(results) == 1
    assert "España" in results[0]["title"]

def test_fetch_and_filter_rss_no_match():
    """Prueba que si no hay coincidencias devuelve lista vacía"""
    with patch('app.services.rss_parser.feedparser.parse') as mock_parse:
        mock_feed = MagicMock()
        mock_feed.entries = []
        mock_parse.return_value = mock_feed
        results = fetch_and_filter_rss("http://fake.com", ["invisible"])
        assert len(results) == 0