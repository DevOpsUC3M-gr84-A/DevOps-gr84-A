"""
Pytest configuration and shared fixtures for all tests
"""
import pytest


@pytest.fixture
def mock_app_context():
    """Fixture providing mock application context"""
    return {
        "env": "test",
        "db": None,
        "config": {}
    }


@pytest.fixture
def sample_alert():
    """Fixture providing sample alert data"""
    return {
        "id": 1,
        "name": "Test Alert",
        "keywords": ["python", "testing"],
        "category": "Technology",
        "channels": [1, 2, 3],
        "notification_channels": ["email", "inbox"]
    }


@pytest.fixture
def sample_rss_item():
    """Fixture providing sample RSS feed item"""
    return {
        "title": "Test News Article",
        "link": "https://example.com/article",
        "description": "This is a test article about Python testing",
        "pubDate": "2026-03-25T10:00:00Z",
        "source": "Test News Source"
    }
