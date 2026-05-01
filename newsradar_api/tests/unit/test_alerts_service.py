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
    recommend_keywords,
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
        rss_channel_ids=None,
        cron_expression="*/5 * * * *",
        is_active=True,
    )
    db.query.return_value.filter.return_value.all.return_value = [db_alert]

    result = list_user_alerts(user_id=7, db=db)

    assert len(result) == 1
    assert result[0].descriptors == []
    assert result[0].categories == []
    assert result[0].rss_channels_ids == []


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
        rss_channels_ids=[],
        information_sources_ids=[],
        cron_expression="*/1 * * * *",
    )

    with pytest.raises(HTTPException) as exc_info:
        create_user_alert(user_id=404, payload=payload, db=db)

    assert exc_info.value.status_code == 404


@pytest.mark.unit
def test_create_user_alert_integrity_error_rolls_back_and_raises_400():
    owner = SimpleNamespace(id=1)
    db = MagicMock()

    # Mock for user query, count query, and RSS channel query
    query_mock = MagicMock()
    channel_query_mock = MagicMock()
    channel_query_mock.filter.return_value.filter.return_value.all.return_value = []

    db.query.side_effect = [
        query_mock,  # For user query
        MagicMock(filter=MagicMock(return_value=MagicMock(count=MagicMock(return_value=0)))),  # For count query
        channel_query_mock,  # For RSS channel query
    ]
    query_mock.filter.return_value.first.return_value = owner

    db.commit.side_effect = IntegrityError("statement", "params", Exception("orig"))

    payload = AlertCreate(
        name="RF01",
        descriptors=["a"],
        categories=[AlertCategoryItem(code="04010000", label="Tecnologia")],
        rss_channels_ids=[],
        information_sources_ids=[],
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

    # Mock for user query, count query, and RSS channel query
    query_mock = MagicMock()
    channel_query_mock = MagicMock()
    channel_query_mock.filter.return_value.filter.return_value.all.return_value = [
        SimpleNamespace(id=1),
        SimpleNamespace(id=2),
    ]

    db.query.side_effect = [
        query_mock,  # For user query
        MagicMock(filter=MagicMock(return_value=MagicMock(count=MagicMock(return_value=5)))),  # For count query
        channel_query_mock,  # For RSS channel query
    ]
    query_mock.filter.return_value.first.return_value = owner

    def _refresh_side_effect(obj):
        obj.id = 10

    db.refresh.side_effect = _refresh_side_effect

    payload = AlertCreate(
        name="RF01",
        descriptors=["a"],
        categories=[AlertCategoryItem(code="04010000", label="Tecnologia")],
        rss_channels_ids=[],
        information_sources_ids=[],
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
        rss_channel_ids=["1", "2"],
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
        rss_channel_ids=["1", "2"],
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
def test_update_user_alert_updates_information_sources_branch():
    db_alert = SimpleNamespace(
        id=5,
        user_id=1,
        name="viejo",
        descriptors=["x"],
        categories=[],
        rss_channel_ids=["1", "2"],
        cron_expression="*/5 * * * *",
        is_active=True,
    )
    db = MagicMock()
    db.query.return_value.filter.return_value.first.return_value = db_alert

    payload = MagicMock()
    payload.model_dump.return_value = {
        "information_sources_ids": ["9", "10"],
    }

    result = update_user_alert(user_id=1, alert_id=5, payload=payload, db=db)

    assert result.rss_channels_ids == ["9", "10"]


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

    # Mock for user query, count query, and RSS channel query
    query_mock = MagicMock()
    channel_query_mock = MagicMock()
    channel_query_mock.filter.return_value.filter.return_value.all.return_value = []

    db.query.side_effect = [
        query_mock,  # For user query
        MagicMock(filter=MagicMock(return_value=MagicMock(count=MagicMock(return_value=3)))),  # For count query
        channel_query_mock,  # For RSS channel query
    ]
    query_mock.filter.return_value.first.return_value = owner

    db.commit.side_effect = SQLAlchemyError("connection lost")

    payload = AlertCreate(
        name="RF01",
        descriptors=["a"],
        categories=[AlertCategoryItem(code="04010000", label="Tecnologia")],
        rss_channels_ids=[],
        information_sources_ids=[],
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
        rss_channel_ids=["1", "2"],
        cron_expression="*/5 * * * *",
        is_active=True,
    )
    db = MagicMock()
    db.query.return_value.filter.return_value.first.return_value = db_alert
    db.commit.side_effect = SQLAlchemyError("connection lost")

    payload = AlertUpdate(name="nuevo", descriptors=["d1"], cron_expression="*/1 * * * *")

    with pytest.raises(SQLAlchemyError):
        update_user_alert(user_id=1, alert_id=5, payload=payload, db=db)


@pytest.mark.unit
def test_create_user_alert_exceeds_limit_raises_400():
    """RF03: Test that creating an alert when user has 20 active alerts raises 400."""
    owner = SimpleNamespace(id=1)
    db = MagicMock()

    # Mock owner exists
    db.query.return_value.filter.return_value.first.return_value = owner

    # Mock count query to return 20 (limit reached)
    db.query.return_value.filter.return_value.count.return_value = 20

    payload = AlertCreate(
        name="Alert 21",
        descriptors=["test"],
        categories=[AlertCategoryItem(code="04010000", label="Tecnologia")],
        rss_channels_ids=[],
        information_sources_ids=[],
        cron_expression="*/1 * * * *",
    )

    with pytest.raises(HTTPException) as exc_info:
        create_user_alert(user_id=1, payload=payload, db=db)

    assert exc_info.value.status_code == 400
    assert "limite maximo de 20 alertas" in exc_info.value.detail


@pytest.mark.unit
def test_create_user_alert_below_limit_succeeds():
    """RF03: Test that creating an alert when user has less than 20 alerts succeeds."""
    owner = SimpleNamespace(id=1)
    db = MagicMock()

    # Mock owner exists
    query_mock = MagicMock()
    channel_query_mock = MagicMock()
    channel_query_mock.filter.return_value.filter.return_value.all.return_value = [
        SimpleNamespace(id=10),
    ]

    # First query returns owner, second query returns count, third for RSS channels
    db.query.side_effect = [
        query_mock,  # For user query
        MagicMock(filter=MagicMock(return_value=MagicMock(count=MagicMock(return_value=19)))),  # For count query
        channel_query_mock,  # For RSS channel query
    ]
    query_mock.filter.return_value.first.return_value = owner

    def _refresh_side_effect(obj):
        obj.id = 15

    db.refresh.side_effect = _refresh_side_effect

    payload = AlertCreate(
        name="Alert 20",
        descriptors=["test"],
        categories=[AlertCategoryItem(code="04010000", label="Tecnologia")],
        rss_channels_ids=[],
        information_sources_ids=[],
        cron_expression="*/1 * * * *",
    )

    result = create_user_alert(user_id=1, payload=payload, db=db)

    assert result.id == 15
    assert result.name == "Alert 20"
    db.add.assert_called_once()
    db.commit.assert_called_once()


@pytest.mark.unit
def test_create_alert_with_explicit_channels():
    """RF07: Test creating alert with explicitly specified RSS channels."""
    owner = SimpleNamespace(id=1)
    db = MagicMock()

    # Mock user query
    query_mock = MagicMock()

    # Mock count query (for RF03)
    count_mock = MagicMock()
    count_mock.filter.return_value.count.return_value = 3

    # Mock RSS channel validation query
    channel_validation_mock = MagicMock()
    channel_validation_mock.filter.return_value.all.return_value = [
        SimpleNamespace(id=7),
        SimpleNamespace(id=9),
    ]

    db.query.side_effect = [
        query_mock,  # For user query
        count_mock,  # For count query
        channel_validation_mock,  # For RSS channel validation
    ]
    query_mock.filter.return_value.first.return_value = owner

    def _refresh_side_effect(obj):
        obj.id = 20

    db.refresh.side_effect = _refresh_side_effect

    payload = AlertCreate(
        name="Alert with explicit channels",
        descriptors=["tech"],
        categories=[AlertCategoryItem(code="04010000", label="Tecnologia")],
        rss_channels_ids=["7", "9"],  # Explicitly specified
        information_sources_ids=[],
        cron_expression="*/1 * * * *",
    )

    result = create_user_alert(user_id=1, payload=payload, db=db)

    assert result.id == 20
    assert result.rss_channels_ids == ["7", "9"]
    db.add.assert_called_once()
    db.commit.assert_called_once()


@pytest.mark.unit
def test_update_alert_with_rss_channels():
    """RF07: Test updating alert RSS channels."""
    db_alert = SimpleNamespace(
        id=5,
        user_id=1,
        name="old",
        descriptors=["x"],
        categories=[{"code": "04010000", "label": "Tech"}],
        rss_channel_ids=["1", "2"],
        cron_expression="*/5 * * * *",
        is_active=True,
    )
    db = MagicMock()

    # Mock alert query
    db.query.return_value.filter.return_value.first.return_value = db_alert

    # Mock RSS channel validation
    channel_validation_mock = MagicMock()
    channel_validation_mock.filter.return_value.all.return_value = [
        SimpleNamespace(id=10),
        SimpleNamespace(id=20),
        SimpleNamespace(id=30),
    ]
    db.query.return_value.filter.return_value.all.return_value = [
        SimpleNamespace(id=10),
        SimpleNamespace(id=20),
        SimpleNamespace(id=30),
    ]

    payload = AlertUpdate(rss_channels_ids=["10", "20", "30"])

    result = update_user_alert(user_id=1, alert_id=5, payload=payload, db=db)

    assert result.rss_channels_ids == ["10", "20", "30"]
    db.commit.assert_called_once()
    db.refresh.assert_called_once_with(db_alert)




@pytest.mark.unit
def test_get_user_alert_success_returns_alert_data():
    db = MagicMock()
    db_alert = SimpleNamespace(
        id=8,
        user_id=2,
        name="Mi alerta",
        descriptors=["energia"],
        categories=[{"code": "04010000", "label": "Tech"}],
        rss_channel_ids=["5", "6"],
        cron_expression="*/10 * * * *",
        is_active=True,
    )
    db.query.return_value.filter.return_value.first.return_value = db_alert

    result = get_user_alert(user_id=2, alert_id=8, db=db)

    assert result.id == 8
    assert result.user_id == 2
    assert result.name == "Mi alerta"
    assert result.rss_channels_ids == ["5", "6"]


@pytest.mark.unit
def test_recommend_keywords_delegates_to_helper(monkeypatch):
    expected = ["ia", "aprendizaje", "automatizacion"]

    monkeypatch.setattr(
        "app.api.routes.alerts.get_related_words",
        lambda keyword: expected,
    )

    result = recommend_keywords("tecnologia")

    assert result == expected
