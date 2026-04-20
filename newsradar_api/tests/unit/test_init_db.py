import json
from unittest.mock import MagicMock, mock_open, patch

import pytest
from sqlalchemy.exc import SQLAlchemyError

from app.database import init_db
from app.models.rss import CategoriaIPTC, InformationSource, RSSChannel
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
            "FIRST_SUPERUSER_EMAIL": "admin@test.com",
            "FIRST_SUPERUSER_PASSWORD": "secret123",
        }.get(key)

        init_db.create_initial_admin(db)

    db.add.assert_called_once()
    db.commit.assert_called_once()
    db.refresh.assert_called_once()

    created_user = db.add.call_args.args[0]
    assert created_user.email == "admin@test.com"
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
def test_load_rss_seed_if_empty_returns_early_when_channels_exist():
    db = MagicMock()
    channels_query = MagicMock()
    channels_query.count.return_value = 3
    db.query.return_value = channels_query

    with patch.object(init_db, "_load_seed_payload") as load_payload_mock:
        init_db.load_rss_seed_if_empty(db)

    load_payload_mock.assert_not_called()
    db.add_all.assert_not_called()
    db.commit.assert_not_called()
    db.rollback.assert_not_called()


@pytest.mark.unit
def test_load_seed_payload_generates_seed_when_missing_file():
    payload = {"information_sources": [], "rss_channels": []}

    with (
        patch.object(init_db.os.path, "exists", return_value=False),
        patch.object(init_db, "generate_seed_data") as generate_seed_mock,
        patch("builtins.open", mock_open(read_data="{}")),
        patch.object(init_db.json, "load", return_value=payload) as json_load_mock,
    ):
        result = init_db._load_seed_payload("rss_seed.json")

    assert result == payload
    generate_seed_mock.assert_called_once()
    json_load_mock.assert_called_once()


@pytest.mark.unit
def test_seed_json_path_builds_expected_location():
    with (
        patch.object(init_db.os.path, "abspath", return_value="/project/app/database/init_db.py"),
        patch.object(init_db.os.path, "dirname", return_value="/project/app/database"),
        patch.object(init_db.os.path, "join", return_value="/project/app/database/rss_seed.json"),
    ):
        result = init_db._seed_json_path()

    assert result == "/project/app/database/rss_seed.json"


@pytest.mark.unit
def test_load_seed_payload_returns_empty_when_generate_seed_fails():
    with (
        patch.object(init_db.os.path, "exists", return_value=False),
        patch.object(init_db, "generate_seed_data", side_effect=RuntimeError("boom")),
    ):
        result = init_db._load_seed_payload("rss_seed.json")

    assert result == {}


@pytest.mark.unit
def test_load_seed_payload_returns_empty_dict_on_missing_file_after_generation():
    with (
        patch.object(init_db.os.path, "exists", return_value=False),
        patch.object(init_db, "generate_seed_data"),
        patch("builtins.open", side_effect=FileNotFoundError),
    ):
        result = init_db._load_seed_payload("rss_seed.json")

    assert result == {}


@pytest.mark.unit
def test_load_seed_payload_returns_empty_dict_on_os_error():
    with (
        patch.object(init_db.os.path, "exists", return_value=True),
        patch("builtins.open", side_effect=OSError("io error")),
    ):
        result = init_db._load_seed_payload("rss_seed.json")

    assert result == {}


@pytest.mark.unit
def test_load_seed_payload_returns_empty_dict_when_payload_not_dict():
    with (
        patch.object(init_db.os.path, "exists", return_value=True),
        patch("builtins.open", mock_open(read_data="[]")),
        patch.object(init_db.json, "load", return_value=[]),
    ):
        result = init_db._load_seed_payload("rss_seed.json")

    assert result == {}


@pytest.mark.unit
def test_load_seed_payload_returns_empty_dict_on_corrupt_json():
    with (
        patch.object(init_db.os.path, "exists", return_value=True),
        patch("builtins.open", mock_open(read_data="{invalid json")),
        patch.object(
            init_db.json,
            "load",
            side_effect=json.JSONDecodeError("bad json", "{", 1),
        ),
    ):
        result = init_db._load_seed_payload("rss_seed.json")

    assert result == {}


@pytest.mark.unit
def test_load_rss_seed_if_empty_returns_when_payload_is_empty():
    db = MagicMock()
    channels_query = MagicMock()
    channels_query.count.return_value = 0
    db.query.return_value = channels_query

    with (
        patch.object(init_db, "_seed_json_path", return_value="rss_seed.json"),
        patch.object(init_db, "_load_seed_payload", return_value={}),
    ):
        init_db.load_rss_seed_if_empty(db)

    db.add_all.assert_not_called()
    db.commit.assert_not_called()
    db.rollback.assert_not_called()


@pytest.mark.unit
def test_load_rss_seed_if_empty_with_valid_payload_inserts_and_commits():
    db = MagicMock()

    channels_query = MagicMock()
    channels_query.count.return_value = 0
    existing_sources_query = MagicMock()
    existing_sources_query.all.return_value = []
    db.query.side_effect = [channels_query, existing_sources_query]

    payload = {
        "information_sources": [
            {"id": 10, "name": "Reuters", "domain": "reuters.com"},
        ],
        "rss_channels": [
            {
                "id": 99,
                "information_source_id": 10,
                "category_iptc": "sports",
                "url": "https://reuters.com/rss/sports",
            }
        ],
    }

    with (
        patch.object(init_db, "_seed_json_path", return_value="rss_seed.json"),
        patch.object(init_db, "_load_seed_payload", return_value=payload),
    ):
        init_db.load_rss_seed_if_empty(db)

    assert db.add_all.call_count == 2
    assert db.flush.call_count == 1
    assert db.commit.call_count == 1
    db.rollback.assert_not_called()

    inserted_sources = db.add_all.call_args_list[0].args[0]
    inserted_channels = db.add_all.call_args_list[1].args[0]

    assert len(inserted_sources) == 1
    assert isinstance(inserted_sources[0], InformationSource)
    assert inserted_sources[0].id == 10
    assert inserted_sources[0].name == "Reuters"
    assert inserted_sources[0].url == "https://reuters.com"

    assert len(inserted_channels) == 1
    assert isinstance(inserted_channels[0], RSSChannel)
    assert inserted_channels[0].id == 99
    assert inserted_channels[0].information_source_id == 10
    assert inserted_channels[0].media_name == "Reuters"
    assert inserted_channels[0].iptc_category == CategoriaIPTC.DEPORTES


@pytest.mark.unit
def test_load_rss_seed_if_empty_uses_otros_for_unknown_iptc():
    db = MagicMock()

    channels_query = MagicMock()
    channels_query.count.return_value = 0
    existing_sources_query = MagicMock()
    existing_sources_query.all.return_value = []
    db.query.side_effect = [channels_query, existing_sources_query]

    payload = {
        "information_sources": [
            {"id": 7, "name": "Unknown", "domain": "unknown.com"},
        ],
        "rss_channels": [
            {
                "id": 8,
                "information_source_id": 7,
                "category_iptc": "non-standard",
                "url": "https://unknown.com/rss/main",
            }
        ],
    }

    with (
        patch.object(init_db, "_seed_json_path", return_value="rss_seed.json"),
        patch.object(init_db, "_load_seed_payload", return_value=payload),
    ):
        init_db.load_rss_seed_if_empty(db)

    inserted_channels = db.add_all.call_args_list[1].args[0]
    assert inserted_channels[0].iptc_category == CategoriaIPTC.OTROS


@pytest.mark.unit
def test_load_rss_seed_if_empty_rolls_back_when_no_valid_channels():
    db = MagicMock()

    channels_query = MagicMock()
    channels_query.count.return_value = 0
    existing_sources_query = MagicMock()
    existing_sources_query.all.return_value = []
    db.query.side_effect = [channels_query, existing_sources_query]

    payload = {
        "information_sources": [
            {"id": 20, "name": "Reuters", "domain": "reuters.com"},
        ],
        "rss_channels": [
            {
                "id": 1,
                "information_source_id": 20,
                "category_iptc": "sports",
                # url ausente para forzar canal invalido
            }
        ],
    }

    with (
        patch.object(init_db, "_seed_json_path", return_value="rss_seed.json"),
        patch.object(init_db, "_load_seed_payload", return_value=payload),
    ):
        init_db.load_rss_seed_if_empty(db)

    db.rollback.assert_called_once()
    db.commit.assert_not_called()


@pytest.mark.unit
def test_load_rss_seed_if_empty_skips_invalid_and_existing_sources():
    db = MagicMock()

    channels_query = MagicMock()
    channels_query.count.return_value = 0
    existing_sources_query = MagicMock()
    existing_sources_query.all.return_value = [MagicMock(id=10)]
    db.query.side_effect = [channels_query, existing_sources_query]

    payload = {
        "information_sources": [
            {"id": None, "name": "Invalid", "domain": "invalid.com"},
            {"id": 10, "name": "Existing Source", "domain": "existing.com"},
        ],
        "rss_channels": [
            {
                "id": 300,
                "information_source_id": 10,
                "category_iptc": "sports",
                "url": "https://existing.com/rss/sports",
            }
        ],
    }

    with (
        patch.object(init_db, "_seed_json_path", return_value="rss_seed.json"),
        patch.object(init_db, "_load_seed_payload", return_value=payload),
    ):
        init_db.load_rss_seed_if_empty(db)

    # Solo se insertan canales; las sources invalidas/existentes se omiten.
    assert db.add_all.call_count == 1
    inserted_channels = db.add_all.call_args.args[0]
    assert len(inserted_channels) == 1
    assert inserted_channels[0].media_name == "Existing Source"
    db.commit.assert_called_once()


@pytest.mark.unit
def test_load_rss_seed_if_empty_rolls_back_on_sqlalchemy_error():
    db = MagicMock()

    channels_query = MagicMock()
    channels_query.count.return_value = 0
    existing_sources_query = MagicMock()
    existing_sources_query.all.return_value = []
    db.query.side_effect = [channels_query, existing_sources_query]

    payload = {
        "information_sources": [
            {"id": 1, "name": "Source", "domain": "source.com"},
        ],
        "rss_channels": [
            {
                "id": 2,
                "information_source_id": 1,
                "category_iptc": "health",
                "url": "https://source.com/rss/health",
            }
        ],
    }

    # Primera insercion (sources) ok, segunda (channels) falla.
    db.add_all.side_effect = [None, SQLAlchemyError("boom")]

    with (
        patch.object(init_db, "_seed_json_path", return_value="rss_seed.json"),
        patch.object(init_db, "_load_seed_payload", return_value=payload),
        pytest.raises(SQLAlchemyError),
    ):
        init_db.load_rss_seed_if_empty(db)

    db.rollback.assert_called_once()
    db.commit.assert_not_called()
