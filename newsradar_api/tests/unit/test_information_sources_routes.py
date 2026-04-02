from types import SimpleNamespace
from unittest.mock import MagicMock

import pytest
from fastapi import HTTPException
from sqlalchemy.exc import IntegrityError, SQLAlchemyError

from app.api.routes.information_sources import (
    create_information_source,
    delete_information_source,
    get_information_source,
    update_information_source,
)
@pytest.mark.unit
def test_create_information_source_integrity_conflict_returns_409():
    db = MagicMock()
    db.commit.side_effect = IntegrityError("statement", "params", Exception("orig"))
    payload = SimpleNamespace(name="S1", url="https://s1.test")

    with pytest.raises(HTTPException) as exc_info:
        create_information_source(payload=payload, db=db)

    assert exc_info.value.status_code == 409
    db.rollback.assert_called_once()


@pytest.mark.unit
def test_create_information_source_sqlalchemy_error_returns_500():
    db = MagicMock()
    db.commit.side_effect = SQLAlchemyError("db down")
    payload = SimpleNamespace(name="S1", url="https://s1.test")

    with pytest.raises(HTTPException) as exc_info:
        create_information_source(payload=payload, db=db)

    assert exc_info.value.status_code == 500
    db.rollback.assert_called_once()


@pytest.mark.unit
def test_get_information_source_not_found_returns_404():
    db = MagicMock()
    db.query.return_value.filter.return_value.first.return_value = None

    with pytest.raises(HTTPException) as exc_info:
        get_information_source(source_id=999, db=db)

    assert exc_info.value.status_code == 404


@pytest.mark.unit
def test_update_information_source_not_found_returns_404():
    db = MagicMock()
    db.query.return_value.filter.return_value.first.return_value = None
    payload = MagicMock()
    payload.model_dump.return_value = {"name": "new", "url": "https://new.test"}

    with pytest.raises(HTTPException) as exc_info:
        update_information_source(source_id=999, payload=payload, db=db)

    assert exc_info.value.status_code == 404


@pytest.mark.unit
def test_update_information_source_integrity_conflict_returns_409():
    source = MagicMock(id=1, name="old", url="https://old.test")
    db = MagicMock()
    db.query.return_value.filter.return_value.first.return_value = source
    db.commit.side_effect = IntegrityError("statement", "params", Exception("orig"))
    payload = MagicMock()
    payload.model_dump.return_value = {"name": "new"}

    with pytest.raises(HTTPException) as exc_info:
        update_information_source(source_id=1, payload=payload, db=db)

    assert exc_info.value.status_code == 409
    db.rollback.assert_called_once()


@pytest.mark.unit
def test_delete_information_source_not_found_returns_404():
    db = MagicMock()
    db.query.return_value.filter.return_value.first.return_value = None

    with pytest.raises(HTTPException) as exc_info:
        delete_information_source(source_id=999, db=db)

    assert exc_info.value.status_code == 404


@pytest.mark.unit
def test_update_information_source_success_commits_and_refreshes():
    source = MagicMock(id=1, name="old", url="https://old.test")
    db = MagicMock()
    db.query.return_value.filter.return_value.first.return_value = source

    payload = MagicMock()
    payload.model_dump.return_value = {"name": "new", "url": "https://new.test"}

    result = update_information_source(source_id=1, payload=payload, db=db)

    assert result.name == "new"
    assert str(result.url).startswith("https://new.test")
    db.commit.assert_called_once()
    db.refresh.assert_called_once_with(source)


@pytest.mark.unit
def test_delete_information_source_success_deletes_related_channels():
    source = MagicMock(id=1)
    db = MagicMock()
    db.query.return_value.filter.return_value.first.return_value = source

    delete_information_source(source_id=1, db=db)

    db.delete.assert_called_once_with(source)
    db.commit.assert_called_once()
