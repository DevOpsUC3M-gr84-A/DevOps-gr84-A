"""
Pytest configuration and shared fixtures for all tests
"""
# 1. Required Libraries
import pytest
import sys
from pathlib import Path

# 2. Python Path Configuration (Module Resolution)
# This is the crucial fix we made earlier to avoid 'ModuleNotFoundError'
# 2.1. Calculate the root directory ('newsradar_api') by going two levels up from this file's location.
newsradar_path = Path(__file__).parent.parent

# 2.2. Inject this path at the very beginning (index 0) of Python's system path.
# This ensures that statements like 'from app.models import User' resolve correctly.
if str(newsradar_path) not in sys.path:
    sys.path.insert(0, str(newsradar_path))


# 3. Shared Test Fixtures
# The @pytest.fixture decorator creates reusable pieces of data or configurations
# that can be injected into any test simply by adding the function name as a parameter.

# 3.1. Application Context Fixture
@pytest.fixture
def mock_app_context():
    """Fixture providing a mock application context (avoids connecting to a real DB during basic tests)"""
    return {
        "env": "test",
        "db": None,
        "config": {}
    }

# 3.2. Alert Data Fixture
@pytest.fixture
def sample_alert():
    """Fixture providing standard, pre-filled sample alert data for testing models and logic"""
    return {
        "id": 1,
        "name": "Test Alert",
        "keywords": ["python", "testing"],
        "category": "Technology",
        "channels": [1, 2, 3],
        "notification_channels": ["email", "inbox"]
    }

# 3.3. RSS Item Data Fixture
@pytest.fixture
def sample_rss_item():
    """Fixture providing a mocked RSS feed item to test parsing algorithms without hitting real URLs"""
    return {
        "title": "Test News Article",
        "link": "https://example.com/article",
        "description": "This is a test article about Python testing",
        "pubDate": "2026-03-25T10:00:00Z",
        "source": "Test News Source"
    }