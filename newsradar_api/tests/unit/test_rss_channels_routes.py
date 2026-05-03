from types import SimpleNamespace
from unittest.mock import MagicMock

import pytest
from fastapi import HTTPException
from sqlalchemy.exc import IntegrityError

from app.api.routes.rss_channels import (
    create_source_channel,
    get_source_channel,
    update_source_channel,
)
@pytest.mark.unit
def test_create_source_channel_not_found_returns_404():
    db = MagicMock()
    db.query.return_value.filter.return_value.first.return_value = None
    payload = SimpleNamespace(
        media_name="m1",
        url="https://m1.test/rss",
        category_id=1,
        iptc_category="04010000",
    )

    with pytest.raises(HTTPException) as exc_info:
        create_source_channel(source_id=999, payload=payload, db=db)

    assert exc_info.value.status_code == 404


@pytest.mark.unit
def test_create_source_channel_integrity_conflict_returns_409():
    source = MagicMock(id=1)
    db = MagicMock()
    db.query.return_value.filter.return_value.first.return_value = source
    db.commit.side_effect = IntegrityError("statement", "params", Exception("orig"))
    payload = SimpleNamespace(
        media_name="m1",
        url="https://m1.test/rss",
        category_id=1,
        iptc_category="04010000",
    )

    with pytest.raises(HTTPException) as exc_info:
        create_source_channel(source_id=1, payload=payload, db=db)

    assert exc_info.value.status_code == 409
    db.rollback.assert_called_once()


@pytest.mark.unit
def test_create_source_channel_success_returns_channel():
    source = MagicMock(id=1)
    channel = MagicMock(
        id=10,
        information_source_id=1,
        url="https://created.test/rss",
        category_id=None,
        iptc_category="04010000",
        media_name="created media",
    )
    db = MagicMock()
    db.query.return_value.filter.return_value.first.return_value = source
    db.refresh.side_effect = lambda obj: setattr(obj, "id", 10)
    payload = SimpleNamespace(
        media_name="created media",
        url="https://created.test/rss",
        category_id=1,
        iptc_category="04010000",
    )

    result = create_source_channel(source_id=1, payload=payload, db=db)

    assert result.id == 10
    db.add.assert_called_once()
    db.commit.assert_called_once()
    db.refresh.assert_called_once()


@pytest.mark.unit
def test_get_source_channel_not_found_returns_404():
    db = MagicMock()
    db.query.return_value.filter.return_value.first.return_value = None

    with pytest.raises(HTTPException) as exc_info:
        get_source_channel(source_id=1, channel_id=999, db=db)

    assert exc_info.value.status_code == 404


@pytest.mark.unit
def test_list_source_channels_not_found_returns_404():
    db = MagicMock()
    db.query.return_value.filter.return_value.first.return_value = None

    from app.api.routes.rss_channels import list_source_channels

    with pytest.raises(HTTPException) as exc_info:
        list_source_channels(source_id=999, db=db)

    assert exc_info.value.status_code == 404


@pytest.mark.unit
def test_update_source_channel_not_found_returns_404():
    db = MagicMock()
    db.query.return_value.filter.return_value.first.return_value = None
    payload = MagicMock()
    payload.model_dump.return_value = {"url": "https://updated.test/rss", "category_id": 1}

    with pytest.raises(HTTPException) as exc_info:
        update_source_channel(source_id=1, channel_id=999, payload=payload, db=db)

    assert exc_info.value.status_code == 404


@pytest.mark.unit
def test_update_source_channel_integrity_conflict_returns_409():
    channel = MagicMock(id=1, information_source_id=1, url="https://old.test/rss", category_id=1)
    db = MagicMock()
    db.query.return_value.filter.return_value.first.return_value = channel
    db.commit.side_effect = IntegrityError("statement", "params", Exception("orig"))
    payload = MagicMock()
    payload.model_dump.return_value = {"url": "https://updated.test/rss", "category_id": 2}

    with pytest.raises(HTTPException) as exc_info:
        update_source_channel(source_id=1, channel_id=1, payload=payload, db=db)

    assert exc_info.value.status_code == 409
    db.rollback.assert_called_once()


@pytest.mark.unit
def test_update_source_channel_updates_iptc_category_branch():
    channel = SimpleNamespace(
        id=1,
        information_source_id=1,
        url="https://old.test/rss",
        category_id=1,
        iptc_category="04000000",
        media_name="m1",
    )
    db = MagicMock()
    db.query.return_value.filter.return_value.first.return_value = channel
    payload = MagicMock()
    payload.model_dump.return_value = {"iptc_category": "04010000"}

    result = update_source_channel(source_id=1, channel_id=1, payload=payload, db=db)

    assert result.iptc_category == "04010000"
    db.commit.assert_called_once()


@pytest.mark.unit
def test_crear_canal_rss_success_and_error_paths(monkeypatch):
    db = MagicMock()
    payload = SimpleNamespace(
        media_name="root",
        url="https://root.test/rss",
        category_id=1,
        iptc_category="04010000",
    )

    created = SimpleNamespace(
        id=1,
        information_source_id=1,
        url="https://root.test/rss",
        category_id=1,
    )

    monkeypatch.setattr("app.api.routes.rss_channels.create_rss_channel", lambda *_: created)
    from app.api.routes.rss_channels import crear_canal_rss

    ok = crear_canal_rss(rss_in=payload, db=db)
    assert ok.id == 1

    def _raise(_db, _payload):
        raise RuntimeError("boom")

    monkeypatch.setattr("app.api.routes.rss_channels.create_rss_channel", _raise)
    from app.api.routes.rss_channels import HTTPException as RouteHTTPException

    with pytest.raises(RouteHTTPException) as exc_info:
        crear_canal_rss(rss_in=payload, db=db)

    assert exc_info.value.status_code == 400


@pytest.mark.unit
def test_listar_canales_and_list_source_channels_success(monkeypatch):
    db = MagicMock()

    fake_root_channels = [
        SimpleNamespace(
            id=1,
            information_source_id=1,
            url="https://a.test",
            category_id=1,
            iptc_category="04010000",
            media_name="m1",
        ),
        SimpleNamespace(
            id=2,
            information_source_id=1,
            url="https://b.test",
            category_id=1,
            iptc_category="04010000",
            media_name="m2",
        ),
    ]
    monkeypatch.setattr(
        "app.api.routes.rss_channels.get_all_rss_channels",
        lambda _db, skip=0, limit=100: fake_root_channels,
    )

    from app.api.routes.rss_channels import listar_canales_rss, list_source_channels

    listed = listar_canales_rss(db=db)
    assert len(listed) == 2

    source = SimpleNamespace(id=1)
    channel = SimpleNamespace(
        id=10,
        information_source_id=1,
        url="https://x.test",
        category_id=1,
        iptc_category="04010000",
        media_name="x",
    )
    query = db.query.return_value
    query.filter.return_value.first.return_value = source
    query.filter.return_value.all.return_value = [channel]

    result = list_source_channels(source_id=1, db=db)
    assert len(result) == 1
    assert result[0].id == 10


@pytest.mark.unit
def test_list_source_channels_maps_missing_category_to_zero():
    db = MagicMock()
    source = SimpleNamespace(id=1)
    channel = SimpleNamespace(
        id=11,
        information_source_id=1,
        url="https://x.test",
        category_id=None,
        iptc_category="04010000",
        media_name="x",
    )
    query = db.query.return_value
    query.filter.return_value.first.return_value = source
    query.filter.return_value.all.return_value = [channel]

    from app.api.routes.rss_channels import list_source_channels

    result = list_source_channels(source_id=1, db=db)

    assert result[0].category_id == 0


@pytest.mark.unit
def test_get_update_delete_source_channel_additional_branches():
    from app.api.routes.rss_channels import delete_source_channel, get_source_channel, update_source_channel

    channel = SimpleNamespace(
        id=1,
        information_source_id=1,
        url="https://old.test/rss",
        category_id=1,
        iptc_category="04010000",
        media_name="m1",
    )
    db = MagicMock()
    db.query.return_value.filter.return_value.first.return_value = channel

    got = get_source_channel(source_id=1, channel_id=1, db=db)
    assert got.id == 1

    payload = MagicMock()
    payload.model_dump.return_value = {"url": "https://new.test/rss", "category_id": 2}
    updated = update_source_channel(source_id=1, channel_id=1, payload=payload, db=db)
    assert updated.category_id == 2

    delete_source_channel(source_id=1, channel_id=1, db=db)
    db.delete.assert_called_once_with(channel)
    assert db.commit.call_count >= 2


@pytest.mark.unit
def test_delete_source_channel_not_found_returns_404():
    db = MagicMock()
    db.query.return_value.filter.return_value.first.return_value = None

    from app.api.routes.rss_channels import delete_source_channel

    with pytest.raises(HTTPException) as exc_info:
        delete_source_channel(source_id=1, channel_id=999, db=db)

    assert exc_info.value.status_code == 404
