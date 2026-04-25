from types import SimpleNamespace
from unittest.mock import MagicMock

import pytest
from fastapi import HTTPException
from fastapi.testclient import TestClient

from app.main import app
from app.api.routes.auth import login, register
from app.schemas.auth import LoginRequest
from app.schemas.user import UserCreate, UserInDB
from app.services.user_service import UserRole
from app.stores.memory import active_tokens, users_store
from app.database.database import get_db

client = TestClient(app)

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
        password="secret123",
    )
    db = MagicMock()
    from app.api.routes import auth as auth_module

    original_ensure = auth_module.ensure_role_ids_exist
    original_create = auth_module.create_db_user

    auth_module.ensure_role_ids_exist = lambda _role_ids: None
    auth_module.existe_dominio = lambda _email: True

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
        password="secret123",
        is_verified=False,
        verification_token="token_fake"
    )

    fake_db_user = SimpleNamespace(
        id=10,
        email="ok@test.com",
        name="Ok",
        surname="User",
        organization="QA",
        role=UserRole.GESTOR,
        hashed_password="hashed",
        is_verified=False,
        verification_token="token_fake"
    )

    monkeypatch.setattr("app.api.routes.auth.ensure_role_ids_exist", lambda _role_ids: None)
    monkeypatch.setattr("app.api.routes.auth.create_db_user", lambda _db, _payload: fake_db_user)
    monkeypatch.setattr("app.api.routes.auth.existe_dominio", lambda _email: True)

    db = MagicMock()
    response = register(payload=payload, db=db)

    assert response.id == 10
    assert response.email == "ok@test.com"


@pytest.mark.unit
def test_login_unverified_user_returns_401(monkeypatch):
    """Prueba que el login se bloquea si el usuario no ha verificado su email"""
    # Creamos un usuario falso que simula salir de la base de datos
    fake_user = SimpleNamespace(
        id=1,
        email="unverified@test.com",
        hashed_password="hashed_pwd",
        is_verified=False
    )

    # Cuando busque al usuario en la DB, devolverá a fake_user
    db_mock = MagicMock()
    db_mock.query.return_value.filter.return_value.first.return_value = fake_user
    
    # Verificar contraseña
    monkeypatch.setattr("app.api.routes.auth.verify_password", lambda plain, hashed: True)

    payload = LoginRequest(email="unverified@test.com", password="correct_password")

    # Intentar el login y comprobar que explota con un 401
    with pytest.raises(HTTPException) as exc_info:
        login(payload=payload, db=db_mock)
    
    assert exc_info.value.status_code == 401
    assert "Cuenta no verificada" in str(exc_info.value.detail)


@pytest.mark.unit
def test_login_verified_user_returns_token(monkeypatch):
    """Prueba que el login triunfa si el usuario es correcto y está verificado"""
    
    fake_user = SimpleNamespace(
        id=1,
        email="verified@test.com",
        hashed_password="hashed_pwd",
        is_verified=True,
        name="Verified",
        surname="User",
        organization="QA",
        role=UserRole.GESTOR
    )

    db_mock = MagicMock()
    db_mock.query.return_value.filter.return_value.first.return_value = fake_user
    
    # Contraseña correcta
    monkeypatch.setattr("app.api.routes.auth.verify_password", lambda plain, hashed: True)

    payload = LoginRequest(email="verified@test.com", password="correct_password")

    # Llamar a la función de login
    response = login(payload=payload, db=db_mock)
    
    # Comprobaciones de éxito
    assert response.access_token is not None
    assert response.token_type == "bearer"
    # Aseguramos que el token se ha guardado en la memoria activa
    from app.stores.memory import active_tokens
    assert response.access_token in active_tokens


@pytest.mark.unit
def test_verify_email_endpoint_success(monkeypatch):
    """Prueba la ruta real de FastAPI para verificar un email pasándole un token en la URL."""
    
    # Creamos una petición
    db_mock = MagicMock()
    fake_user = SimpleNamespace(email="test@test.com", is_verified=False)
    db_mock.query.return_value.filter.return_value.first.return_value = fake_user

    # Engañar al user_service para que la función verify_user_email devuelva éxito
    monkeypatch.setattr("app.api.routes.auth.verify_user_email", lambda u, db: (True, "Cuenta verificada con éxito"))
    
    # FastAPI devuelve el db_mock cuando la ruta pida la DB
    app.dependency_overrides[get_db] = lambda: db_mock

    # petición POST con TestClient
    response = client.post(
        "/api/v1/auth/verify-email", 
        json={"token": "token_inventado_123"} 
    )

    assert response.status_code == 200
    assert response.json()["message"] == "Cuenta verificada con éxito"
    
    # Limpiar los overrides
    app.dependency_overrides.clear()

def test_register_rechaza_dominio_falso(api_client, monkeypatch):
    # Devuelve dominio falso
    monkeypatch.setattr("app.api.routes.auth.existe_dominio", lambda x: False)
    
    # Intentar registro
    payload = {
        "email": "test@falso.com", "password": "password123",
        "first_name": "Test", "last_name": "Falso", 
        "organization": "Org", "role_ids": [2]
    }
    response = api_client.post("/api/v1/auth/register", json=payload)
    
    # Comprobar error 400 por dominio sin MX
    assert response.status_code == 400
    assert "no existe o no admite correos" in response.json()["detail"]
