from types import SimpleNamespace
from unittest.mock import MagicMock

import pytest
from fastapi import HTTPException
from sqlalchemy.exc import IntegrityError, SQLAlchemyError

from app.api.routes.alerts import (
    create_user_alert,
    delete_user_alert,
    get_user_alert,
    list_user_alerts,
    update_user_alert,
)
from app.schemas.alert import AlertCategoryItem, AlertCreate, AlertUpdate


@pytest.mark.unit
def test_list_user_alerts_maps_empty_descriptors_and_categories():
    db = MagicMock()
    db_alert = SimpleNamespace(
        id=1,
        user_id=7,
        name="A1",
        descriptors=None,
        categories=None,
        cron_expression="*/5 * * * *",
        is_active=True,
    )
    db.query.return_value.filter.return_value.all.return_value = [db_alert]

    result = list_user_alerts(user_id=7, db=db)

    assert len(result) == 1
    assert result[0].descriptors == []
    assert result[0].categories == []


@pytest.mark.unit
def test_get_user_alert_not_found_raises_404():
    db = MagicMock()
    db.query.return_value.filter.return_value.first.return_value = None

    with pytest.raises(HTTPException) as exc_info:
        get_user_alert(user_id=1, alert_id=99, db=db)

    assert exc_info.value.status_code == 404


@pytest.mark.unit
def test_create_user_alert_owner_not_found_raises_404():
    db = MagicMock()
    db.query.return_value.filter.return_value.first.return_value = None
    payload = AlertCreate(
        name="RF01",
        descriptors=["a"],
        categories=[AlertCategoryItem(code="04010000", label="Tecnologia")],
        cron_expression="*/1 * * * *",
    )

    with pytest.raises(HTTPException) as exc_info:
        create_user_alert(user_id=404, payload=payload, db=db)

    assert exc_info.value.status_code == 404


@pytest.mark.unit
def test_create_user_alert_integrity_error_rolls_back_and_raises_400():
    owner = SimpleNamespace(id=1)
    db = MagicMock()
    db.query.return_value.filter.return_value.first.return_value = owner
    db.commit.side_effect = IntegrityError("statement", "params", Exception("orig"))

    payload = AlertCreate(
        name="RF01",
        descriptors=["a"],
        categories=[AlertCategoryItem(code="04010000", label="Tecnologia")],
        cron_expression="*/1 * * * *",
    )

    with pytest.raises(HTTPException) as exc_info:
        create_user_alert(user_id=1, payload=payload, db=db)

    assert exc_info.value.status_code == 400
    db.rollback.assert_called_once()


@pytest.mark.unit
def test_create_user_alert_success_commits_and_returns_alert():
    owner = SimpleNamespace(id=1)
    db = MagicMock()
    db.query.return_value.filter.return_value.first.return_value = owner

    def _refresh_side_effect(obj):
        obj.id = 10

    db.refresh.side_effect = _refresh_side_effect

    payload = AlertCreate(
        name="RF01",
        descriptors=["a"],
        categories=[AlertCategoryItem(code="04010000", label="Tecnologia")],
        cron_expression="*/1 * * * *",
    )

    result = create_user_alert(user_id=1, payload=payload, db=db)

    assert result.id == 10
    assert result.user_id == 1
    db.add.assert_called_once()
    db.commit.assert_called_once()
    db.refresh.assert_called_once()


@pytest.mark.unit
def test_update_user_alert_not_found_raises_404():
    db = MagicMock()
    db.query.return_value.filter.return_value.first.return_value = None
    payload = MagicMock()
    payload.model_dump.return_value = {"name": "nuevo"}

    with pytest.raises(HTTPException) as exc_info:
        update_user_alert(user_id=1, alert_id=999, payload=payload, db=db)

    assert exc_info.value.status_code == 404


@pytest.mark.unit
def test_update_user_alert_applies_fields_and_commits():
    db_alert = SimpleNamespace(
        id=5,
        user_id=1,
        name="viejo",
        descriptors=["x"],
        categories=[],
        cron_expression="*/5 * * * *",
        is_active=True,
    )
    db = MagicMock()
    db.query.return_value.filter.return_value.first.return_value = db_alert

    payload = AlertUpdate(name="nuevo", descriptors=["d1"], cron_expression="*/1 * * * *")

    result = update_user_alert(user_id=1, alert_id=5, payload=payload, db=db)

    assert result.name == "nuevo"
    assert result.descriptors == ["d1"]
    assert result.cron_expression == "*/1 * * * *"
    db.commit.assert_called_once()
    db.refresh.assert_called_once_with(db_alert)


@pytest.mark.unit
def test_update_user_alert_updates_categories_branch():
    db_alert = SimpleNamespace(
        id=5,
        user_id=1,
        name="viejo",
        descriptors=["x"],
        categories=[],
        cron_expression="*/5 * * * *",
        is_active=True,
    )
    db = MagicMock()
    db.query.return_value.filter.return_value.first.return_value = db_alert

    payload = MagicMock()
    payload.model_dump.return_value = {
        "categories": [
            {"code": "04010000", "label": "Tecnologia"},
            {"code": "01000000", "label": "Cultura"},
        ]
    }

    result = update_user_alert(user_id=1, alert_id=5, payload=payload, db=db)

    assert len(result.categories) == 2
    assert result.categories[0].code == "04010000"


@pytest.mark.unit
def test_delete_user_alert_not_found_raises_404():
    db = MagicMock()
    db.query.return_value.filter.return_value.first.return_value = None

    with pytest.raises(HTTPException) as exc_info:
        delete_user_alert(user_id=1, alert_id=999, db=db)

    assert exc_info.value.status_code == 404


@pytest.mark.unit
def test_delete_user_alert_soft_deletes_and_commits():
    db_alert = SimpleNamespace(id=5, user_id=1, is_active=True)
    db = MagicMock()
    db.query.return_value.filter.return_value.first.return_value = db_alert

    delete_user_alert(user_id=1, alert_id=5, db=db)

    assert db_alert.is_active is False
    db.commit.assert_called_once()


@pytest.mark.unit
def test_create_user_alert_sqlalchemy_error_propagates():
    owner = SimpleNamespace(id=1)
    db = MagicMock()
    db.query.return_value.filter.return_value.first.return_value = owner
    db.commit.side_effect = SQLAlchemyError("connection lost")

    payload = AlertCreate(
        name="RF01",
        descriptors=["a"],
        categories=[AlertCategoryItem(code="04010000", label="Tecnologia")],
        cron_expression="*/1 * * * *",
    )

    with pytest.raises(SQLAlchemyError):
        create_user_alert(user_id=1, payload=payload, db=db)


@pytest.mark.unit
def test_update_user_alert_sqlalchemy_error_propagates():
    db_alert = SimpleNamespace(
        id=5,
        user_id=1,
        name="viejo",
        descriptors=["x"],
        categories=[],
        cron_expression="*/5 * * * *",
        is_active=True,
    )
    db = MagicMock()
    db.query.return_value.filter.return_value.first.return_value = db_alert
    db.commit.side_effect = SQLAlchemyError("connection lost")

    payload = AlertUpdate(name="nuevo", descriptors=["d1"], cron_expression="*/1 * * * *")

    with pytest.raises(SQLAlchemyError):
        update_user_alert(user_id=1, alert_id=5, payload=payload, db=db)
