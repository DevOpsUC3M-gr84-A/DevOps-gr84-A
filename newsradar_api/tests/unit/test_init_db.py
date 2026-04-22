from unittest.mock import MagicMock, mock_open, patch

import pytest
from sqlalchemy.exc import SQLAlchemyError

from app.database import init_db
from app.models.rss import CategoriaIPTC
from app.models.user import UserRole


@pytest.mark.unit
def test_get_password_hash_uses_pwd_context_hash():
    with patch.object(init_db.pwd_context, "hash", return_value="hashed-value") as hash_mock:
        result = init_db.get_password_hash("plain-password")

    assert result == "hashed-value"
    hash_mock.assert_called_once_with("plain-password")


@pytest.mark.unit
def test_map_seed_category_to_iptc_returns_otros_when_empty_value():
    assert init_db._map_seed_category_to_iptc(None) == CategoriaIPTC.OTROS


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


@pytest.mark.unit
def test_load_rss_seed_if_empty_success_generates_missing_file_and_inserts_data():
    db = MagicMock()
    db.query.return_value.first.side_effect = [None, None]

    payload = {
        "information_sources": [
            {"id": 1, "name": "El Pais", "domain": "elpais.com"},
        ],
        "rss_channels": [
            {
                "id": 101,
                "information_source_id": 1,
                "category_iptc": "sports",
                "url": "https://elpais.com/rss/sports.xml",
            },
            {
                "id": 102,
                "information_source_id": 1,
                "category_iptc": "unknown",
                "url": "https://elpais.com/rss/unknown.xml",
            },
        ],
    }

    with (
        patch("builtins.open", side_effect=[FileNotFoundError(), mock_open()()]),
        patch.object(init_db.json, "load", return_value=payload),
        patch.object(init_db, "generate_seed_data") as generate_seed_mock,
    ):
        init_db.load_rss_seed_if_empty(db)

    generate_seed_mock.assert_called_once()
    db.add_all.assert_called()
    assert db.add_all.call_count == 2
    db.flush.assert_called_once()
    db.commit.assert_called_once()

    inserted_sources = db.add_all.call_args_list[0].args[0]
    inserted_channels = db.add_all.call_args_list[1].args[0]

    assert inserted_sources[0].name == "El Pais"
    assert inserted_channels[0].iptc_category == CategoriaIPTC.DEPORTES
    assert inserted_channels[1].iptc_category == CategoriaIPTC.OTROS


@pytest.mark.unit
def test_load_rss_seed_if_empty_skips_when_database_has_data():
    db = MagicMock()
    db.query.return_value.first.side_effect = [object(), None]

    init_db.load_rss_seed_if_empty(db)

    db.add_all.assert_not_called()
    db.flush.assert_not_called()
    db.commit.assert_not_called()
    db.rollback.assert_not_called()


@pytest.mark.unit
def test_load_rss_seed_if_empty_rolls_back_on_corrupt_json():
    db = MagicMock()
    db.query.return_value.first.side_effect = [None, None]

    with (
        patch("builtins.open", mock_open(read_data="{bad-json")),
        patch.object(
            init_db.json,
            "load",
            side_effect=init_db.JSONDecodeError("bad json", "{bad-json", 1),
        ),
    ):
        init_db.load_rss_seed_if_empty(db)

    db.rollback.assert_called_once()
    db.add_all.assert_not_called()
    db.commit.assert_not_called()


@pytest.mark.unit
def test_load_rss_seed_if_empty_rolls_back_when_generated_file_is_invalid():
    db = MagicMock()
    db.query.return_value.first.side_effect = [None, None]

    with (
        patch("builtins.open", side_effect=[FileNotFoundError(), mock_open()()]),
        patch.object(init_db, "generate_seed_data") as generate_seed_mock,
        patch.object(
            init_db.json,
            "load",
            side_effect=init_db.JSONDecodeError("bad json", "{}", 1),
        ),
    ):
        init_db.load_rss_seed_if_empty(db)

    generate_seed_mock.assert_called_once()
    db.rollback.assert_called_once()
    db.add_all.assert_not_called()
    db.commit.assert_not_called()


@pytest.mark.unit
def test_load_rss_seed_if_empty_rolls_back_on_sqlalchemy_error():
    db = MagicMock()
    db.query.return_value.first.side_effect = [None, None]
    db.commit.side_effect = SQLAlchemyError("db failure")

    payload = {
        "information_sources": [
            {"id": 1, "name": "El Mundo", "domain": "elmundo.es"},
        ],
        "rss_channels": [
            {
                "id": 10,
                "information_source_id": 1,
                "category_iptc": "politics",
                "url": "https://elmundo.es/rss/politics.xml",
            },
        ],
    }

    with (
        patch("builtins.open", mock_open(read_data="{}")),
        patch.object(init_db.json, "load", return_value=payload),
    ):
        init_db.load_rss_seed_if_empty(db)

    db.add_all.assert_called()
    db.rollback.assert_called_once()
    db.commit.assert_called_once()


@pytest.mark.unit
def test_load_rss_seed_if_empty_skips_incomplete_records_and_sets_unknown_media_name():
    db = MagicMock()
    db.query.return_value.first.side_effect = [None, None]

    payload = {
        "information_sources": [
            {"id": 1, "domain": "missing-name.com"},
            {"name": "Fuente Sin ID", "domain": "fuente-sin-id.com"},
        ],
        "rss_channels": [
            {
                "id": 100,
                "information_source_id": 999,
                "category_iptc": "sports",
                "url": "https://unknown.example/rss.xml",
            },
            {
                "id": 101,
                "information_source_id": 999,
                "category_iptc": "sports",
            },
        ],
    }

    with (
        patch("builtins.open", mock_open(read_data="{}")),
        patch.object(init_db.json, "load", return_value=payload),
    ):
        init_db.load_rss_seed_if_empty(db)

    assert db.add_all.call_count == 2
    inserted_sources = db.add_all.call_args_list[0].args[0]
    inserted_channels = db.add_all.call_args_list[1].args[0]

    assert len(inserted_sources) == 1
    assert inserted_sources[0].name == "Fuente Sin ID"
    assert len(inserted_channels) == 1
    assert inserted_channels[0].media_name == "Unknown"
    db.commit.assert_called_once()
