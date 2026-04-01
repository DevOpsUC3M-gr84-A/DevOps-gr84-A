from types import SimpleNamespace
from unittest.mock import MagicMock

import pytest
from fastapi import HTTPException

from app.api.routes.auth import login, register
from app.schemas.auth import LoginRequest
from app.schemas.user import UserCreate, UserInDB
from app.services.user_service import UserRole
from app.stores.memory import active_tokens, users_store


@pytest.mark.unit
def test_login_legacy_user_not_found_returns_401():
    db = MagicMock()
    db.query.return_value.filter.return_value.first.return_value = None
    payload = LoginRequest(email="missing@test.com", password="x")

    snapshot = dict(users_store)
    users_store.clear()
    try:
        with pytest.raises(HTTPException) as exc_info:
            login(payload=payload, db=db)
        assert exc_info.value.status_code == 401
    finally:
        users_store.clear()
        users_store.update(snapshot)


@pytest.mark.unit
def test_login_legacy_user_wrong_password_returns_401():
    db = MagicMock()
    db.query.return_value.filter.return_value.first.return_value = None
    payload = LoginRequest(email="legacy@test.com", password="bad")

    snapshot = dict(users_store)
    users_store.clear()
    users_store[1] = UserInDB(
        id=1,
        email="legacy@test.com",
        first_name="L",
        last_name="User",
        organization="QA",
        role_ids=[2],
        password="good",
    )
    try:
        with pytest.raises(HTTPException) as exc_info:
            login(payload=payload, db=db)
        assert exc_info.value.status_code == 401
    finally:
        users_store.clear()
        users_store.update(snapshot)


@pytest.mark.unit
def test_login_legacy_user_success_generates_token():
    db = MagicMock()
    db.query.return_value.filter.return_value.first.return_value = None
    payload = LoginRequest(email="legacy@test.com", password="good")

    users_snapshot = dict(users_store)
    tokens_snapshot = dict(active_tokens)
    users_store.clear()
    active_tokens.clear()
    users_store[2] = UserInDB(
        id=2,
        email="legacy@test.com",
        first_name="Legacy",
        last_name="User",
        organization="QA",
        role_ids=[1],
        password="good",
    )

    try:
        response = login(payload=payload, db=db)
        assert response.access_token
        assert response.access_token in active_tokens
        assert active_tokens[response.access_token] == 2
    finally:
        users_store.clear()
        users_store.update(users_snapshot)
        active_tokens.clear()
        active_tokens.update(tokens_snapshot)


@pytest.mark.unit
def test_register_conflict_returns_409():
    payload = UserCreate(
        email="dup@test.com",
        first_name="Dup",
        last_name="User",
        organization="QA",
        role_ids=[1],
        password="secret123",
    )
    db = MagicMock()
    from app.api.routes import auth as auth_module

    original_ensure = auth_module.ensure_role_ids_exist
    original_create = auth_module.create_db_user

    auth_module.ensure_role_ids_exist = lambda _role_ids: None

    def _raise_conflict(_db, _payload):
        raise ValueError("duplicated")

    auth_module.create_db_user = _raise_conflict

    try:
        with pytest.raises(HTTPException) as exc_info:
            register(payload=payload, db=db)

        assert exc_info.value.status_code == 409
    finally:
        auth_module.ensure_role_ids_exist = original_ensure
        auth_module.create_db_user = original_create


@pytest.mark.unit
def test_register_success_returns_user_schema(monkeypatch):
    payload = UserCreate(
        email="ok@test.com",
        first_name="Ok",
        last_name="User",
        organization="QA",
        role_ids=[1],
        password="secret123",
    )

    fake_db_user = SimpleNamespace(
        id=10,
        email="ok@test.com",
        name="Ok",
        surname="User",
        organization="QA",
        role=UserRole.GESTOR,
        hashed_password="hashed",
    )

    monkeypatch.setattr("app.api.routes.auth.ensure_role_ids_exist", lambda _role_ids: None)
    monkeypatch.setattr("app.api.routes.auth.create_db_user", lambda _db, _payload: fake_db_user)
    monkeypatch.setattr("app.api.routes.auth.role_ids_from_role", lambda _role: [1])

    db = MagicMock()
    response = register(payload=payload, db=db)

    assert response.id == 10
    assert response.email == "ok@test.com"
