import pytest
from unittest.mock import patch, MagicMock
from app.services.rss_parser import fetch_and_filter_rss

@patch('app.services.rss_parser.feedparser.parse')
def test_fetch_and_filter_rss_success(mock_parse):
    mock_feed = MagicMock()
    mock_feed.bozo = False
    mock_feed.entries = [
        {"title": "Noticia Test", "summary": "Info", "link": "http://1", "published": "hoy"}
    ]
    mock_parse.return_value = mock_feed
    results = fetch_and_filter_rss("http://fake.com", ["test"])
    assert len(results) == 1

@patch('app.services.rss_parser.feedparser.parse')
def test_fetch_and_filter_rss_no_match(mock_parse):
    mock_feed = MagicMock()
    mock_feed.entries = []
    mock_parse.return_value = mock_feed
    results = fetch_and_filter_rss("http://fake.com", ["nada"])
    assert len(results) == 0