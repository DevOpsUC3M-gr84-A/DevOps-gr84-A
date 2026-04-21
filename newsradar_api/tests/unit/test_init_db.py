from unittest.mock import MagicMock, mock_open, patch

import pytest

from app.database import init_db
from app.models.user import UserRole


@pytest.mark.unit
def test_get_password_hash_uses_pwd_context_hash():
    with patch.object(init_db.pwd_context, "hash", return_value="hashed-value") as hash_mock:
        result = init_db.get_password_hash("plain-password")

    assert result == "hashed-value"
    hash_mock.assert_called_once_with("plain-password")


@pytest.mark.unit
def test_create_initial_admin_creates_user_when_missing():
    db = MagicMock()
    db.query.return_value.filter.return_value.first.return_value = None

    with (
        patch.object(init_db.os, "getenv") as getenv_mock,
        patch.object(init_db, "get_password_hash", return_value="hashed-password") as hash_mock,
    ):
        getenv_mock.side_effect = lambda key: {
            "NEWSRADAR_ADMIN_PASSWORD": "secret123",
        }.get(key)

        init_db.create_initial_admin(db)

    db.add.assert_called_once()
    db.commit.assert_called_once()
    db.refresh.assert_called_once()

    created_user = db.add.call_args.args[0]
    assert created_user.email == "admin@newsradar.com"
    assert created_user.hashed_password == "hashed-password"
    assert created_user.role == UserRole.GESTOR
    assert created_user.is_verified is True
    hash_mock.assert_called_once_with("secret123")


@pytest.mark.unit
def test_create_initial_admin_skips_creation_when_user_exists():
    existing_admin = MagicMock(email="admin@test.com")
    db = MagicMock()
    db.query.return_value.filter.return_value.first.return_value = existing_admin

    with patch.object(init_db.os, "getenv") as getenv_mock:
        init_db.create_initial_admin(db)

    db.add.assert_not_called()
    db.commit.assert_not_called()
    db.refresh.assert_not_called()
    getenv_mock.assert_not_called()


@pytest.mark.unit
def test_create_initial_admin_raises_when_env_missing():
    db = MagicMock()
    db.query.return_value.filter.return_value.first.return_value = None

    with patch.object(init_db.os, "getenv", return_value=None):
        with pytest.raises(RuntimeError, match="Faltan credenciales de entorno"):
            init_db.create_initial_admin(db)

    db.add.assert_not_called()
    db.commit.assert_not_called()
    db.refresh.assert_not_called()
