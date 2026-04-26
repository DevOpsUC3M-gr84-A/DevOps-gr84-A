"""
Pytest configuration and shared fixtures for all tests
"""
import os
import sys
from pathlib import Path

# 1. Required Libraries
os.environ.setdefault("NEWSRADAR_ADMIN_PASSWORD", "admin123")
os.environ.setdefault("NEWSRADAR_LECTOR_PASSWORD", "lector123")

import pytest

from fastapi import FastAPI
from fastapi.testclient import TestClient
from sqlalchemy import create_engine
from sqlalchemy.pool import StaticPool
from sqlalchemy.orm import sessionmaker

# 2. Python Path Configuration (Module Resolution)
# This is the crucial fix we made earlier to avoid 'ModuleNotFoundError'
# 2.1. Calculate the root directory ('newsradar_api') by going two levels up from this file's location.
newsradar_path = Path(__file__).parent.parent

# 2.2. Inject this path at the very beginning (index 0) of Python's system path.
# This ensures that statements like 'from app.models import User' resolve correctly.
if str(newsradar_path) not in sys.path:
    sys.path.insert(0, str(newsradar_path))

import app.models  # noqa: F401
from app.api.router import api_router
from app.database.database import Base, get_db
from app.models.user import User, UserRole
from app.schemas.user import UserInDB
from app.services.user_service import get_password_hash
from app.utils import deps as deps_module


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


@pytest.fixture
def test_engine():
    """Creates an isolated in-memory SQLite DB shared across test sessions."""

    engine = create_engine(
        "sqlite:///:memory:",
        connect_args={"check_same_thread": False},
        poolclass=StaticPool,
    )
    Base.metadata.create_all(bind=engine)

    try:
        yield engine
    finally:
        Base.metadata.drop_all(bind=engine)
        engine.dispose()


@pytest.fixture
def test_session_factory(test_engine):
    return sessionmaker(autocommit=False, autoflush=False, bind=test_engine)


@pytest.fixture
def db_session(test_session_factory):
    session = test_session_factory()
    try:
        yield session
    finally:
        session.close()


@pytest.fixture
def seeded_user(test_session_factory):
    session = test_session_factory()
    try:
        db_user = User(
            email="rf01-user@test.com",
            name="RF01",
            surname="Tester",
            organization="QA",
            hashed_password=get_password_hash("secret123"),
            role=UserRole.GESTOR,
            is_verified=True,
        )
        session.add(db_user)
        session.commit()
        session.refresh(db_user)
        return db_user
    finally:
        session.close()


@pytest.fixture
def seeded_lector_user(test_session_factory):
    session = test_session_factory()
    try:
        db_user = User(
            email="rf01-lector@test.com",
            name="RF01",
            surname="Reader",
            organization="QA",
            hashed_password=get_password_hash("lector123"),
            role=UserRole.LECTOR,
            is_verified=True,
        )
        session.add(db_user)
        session.commit()
        session.refresh(db_user)
        return db_user
    finally:
        session.close()


@pytest.fixture
def seeded_admin_user(test_session_factory):
    session = test_session_factory()
    try:
        db_user = User(
            email="rf01-admin@test.com",
            name="RF01",
            surname="Admin",
            organization="QA",
            hashed_password=get_password_hash("admin123"),
            role=UserRole.ADMIN,
            is_verified=True,
        )
        session.add(db_user)
        session.commit()
        session.refresh(db_user)
        return db_user
    finally:
        session.close()


@pytest.fixture
def api_client(test_session_factory, seeded_user):
    app = FastAPI()
    app.include_router(api_router, prefix="/api/v1")

    def _override_get_db():
        db = test_session_factory()
        try:
            yield db
        finally:
            db.rollback()
            db.close()

    def _override_current_user() -> UserInDB:
        return seeded_user

    app.dependency_overrides[get_db] = _override_get_db
    app.dependency_overrides[deps_module.get_current_user] = _override_current_user

    with TestClient(app) as client:
        yield client

    app.dependency_overrides.clear()


@pytest.fixture
def api_client_no_auth(test_session_factory):
    app = FastAPI()
    app.include_router(api_router, prefix="/api/v1")

    def _override_get_db():
        db = test_session_factory()
        try:
            yield db
        finally:
            db.rollback()
            db.close()

    app.dependency_overrides[get_db] = _override_get_db

    with TestClient(app) as client:
        yield client

    app.dependency_overrides.clear()


@pytest.fixture
def api_client_lector(test_session_factory, seeded_lector_user):
    app = FastAPI()
    app.include_router(api_router, prefix="/api/v1")

    def _override_get_db():
        db = test_session_factory()
        try:
            yield db
        finally:
            db.rollback()
            db.close()

    def _override_current_user() -> UserInDB:
        return seeded_lector_user

    app.dependency_overrides[get_db] = _override_get_db
    app.dependency_overrides[deps_module.get_current_user] = _override_current_user

    with TestClient(app) as client:
        yield client

    app.dependency_overrides.clear()


@pytest.fixture
def api_client_admin(test_session_factory, seeded_admin_user):
    app = FastAPI()
    app.include_router(api_router, prefix="/api/v1")

    def _override_get_db():
        db = test_session_factory()
        try:
            yield db
        finally:
            db.rollback()
            db.close()

    def _override_current_user() -> UserInDB:
        return seeded_admin_user

    app.dependency_overrides[get_db] = _override_get_db
    app.dependency_overrides[deps_module.get_current_user] = _override_current_user

    with TestClient(app) as client:
        yield client

    app.dependency_overrides.clear()


@pytest.fixture
def auth_headers(api_client):
    response = api_client.post(
        "/api/v1/auth/login",
        json={"email": "rf01-user@test.com", "password": "secret123"},
    )
    assert response.status_code == 200, response.text
    token = response.json()["access_token"]
    return {"Authorization": f"Bearer {token}"}


@pytest.fixture
def lector_auth_headers(api_client_lector):
    response = api_client_lector.post(
        "/api/v1/auth/login",
        json={"email": "rf01-lector@test.com", "password": "lector123"},
    )
    assert response.status_code == 200, response.text
    token = response.json()["access_token"]
    return {"Authorization": f"Bearer {token}"}


@pytest.fixture
def admin_auth_headers(api_client_admin):
    response = api_client_admin.post(
        "/api/v1/auth/login",
        json={"email": "rf01-admin@test.com", "password": "admin123"},
    )
    assert response.status_code == 200, response.text
    token = response.json()["access_token"]
    return {"Authorization": f"Bearer {token}"}

@pytest.fixture(autouse=True)
def disable_real_emails(monkeypatch):
    """
    Borra las credenciales SMTP en memoria para que el sistema no envíe mails durante los tests
    """
    monkeypatch.setattr("app.config.SMTP_USER", "")
    monkeypatch.setattr("app.config.SMTP_PASSWORD", "")
