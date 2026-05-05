from datetime import datetime, timezone

import pytest

from app.models.alert_monitoring import AlertRule
from app.models.notification import Notification as NotificationModel
from app.schemas.alert import Alert
from app.stores.memory import alerts_store, notifications_store


@pytest.fixture(autouse=True)
def clear_notification_stores():
    alerts_store.clear()
    notifications_store.clear()
    yield
    alerts_store.clear()
    notifications_store.clear()


@pytest.mark.unit
def test_notifications_crud_flow(api_client, auth_headers):
    alerts_store[1] = Alert(
        id=1,
        user_id=1,
        name="Alerta QA",
        descriptors=["test"],
        categories=[],
        cron_expression="0 * * * *",
    )

    payload = {
        "timestamp": datetime.now(timezone.utc).isoformat(),
        "metrics": [{"name": "mentions", "value": 5.0}],
    }

    create_response = api_client.post(
        "/api/v1/users/1/alerts/1/notifications",
        json=payload,
        headers=auth_headers,
    )
    assert create_response.status_code == 201
    notification_id = create_response.json()["id"]

    list_response = api_client.get(
        "/api/v1/users/1/alerts/1/notifications", headers=auth_headers
    )
    assert list_response.status_code == 200
    assert len(list_response.json()) == 1

    get_response = api_client.get(
        f"/api/v1/users/1/alerts/1/notifications/{notification_id}",
        headers=auth_headers,
    )
    assert get_response.status_code == 200

    update_response = api_client.put(
        f"/api/v1/users/1/alerts/1/notifications/{notification_id}",
        json={"metrics": [{"name": "mentions", "value": 9.0}]},
        headers=auth_headers,
    )
    assert update_response.status_code == 200
    assert update_response.json()["metrics"][0]["value"] == 9.0

    delete_response = api_client.delete(
        f"/api/v1/users/1/alerts/1/notifications/{notification_id}",
        headers=auth_headers,
    )
    assert delete_response.status_code == 204


@pytest.mark.unit
def test_notifications_returns_404_when_alert_not_found(api_client, auth_headers):
    payload = {
        "timestamp": datetime.now(timezone.utc).isoformat(),
        "metrics": [{"name": "mentions", "value": 1.0}],
    }

    response = api_client.post(
        "/api/v1/users/1/alerts/999/notifications",
        json=payload,
        headers=auth_headers,
    )

    assert response.status_code == 404
    assert response.json()["detail"] == "Alerta no encontrada para el usuario"


def _seed_user_notifications(test_session_factory, user_id: int, count: int) -> list[int]:
    session = test_session_factory()
    try:
        rule = AlertRule(
            user_id=user_id,
            name="Regla QA",
            descriptors=["foo"],
            categories=[],
            rss_channel_ids=[],
            cron_expression="0 * * * *",
        )
        session.add(rule)
        session.commit()
        session.refresh(rule)

        ids: list[int] = []
        for i in range(count):
            n = NotificationModel(
                user_id=user_id,
                alert_id=rule.id,
                article_url=f"https://example.com/{i}",
                title=f"Titulo {i}",
                message=f"Mensaje {i}",
                is_read=False,
            )
            session.add(n)
            session.commit()
            session.refresh(n)
            ids.append(n.id)
        return ids
    finally:
        session.close()


@pytest.mark.unit
def test_list_user_notifications_respects_limit(
    api_client, auth_headers, test_session_factory, seeded_user
):
    _seed_user_notifications(test_session_factory, seeded_user.id, count=5)

    response = api_client.get(
        f"/api/v1/users/{seeded_user.id}/notifications?limit=2",
        headers=auth_headers,
    )

    assert response.status_code == 200
    body = response.json()
    assert isinstance(body, list)
    assert len(body) == 2


@pytest.mark.unit
def test_mark_user_notification_as_read_changes_state(
    api_client, auth_headers, test_session_factory, seeded_user
):
    ids = _seed_user_notifications(test_session_factory, seeded_user.id, count=1)
    notification_id = ids[0]

    response = api_client.put(
        f"/api/v1/users/{seeded_user.id}/notifications/{notification_id}/read",
        headers=auth_headers,
    )

    assert response.status_code == 200
    body = response.json()
    assert body["id"] == notification_id
    assert body["is_read"] is True

    verify_session = test_session_factory()
    try:
        persisted = (
            verify_session.query(NotificationModel)
            .filter(NotificationModel.id == notification_id)
            .first()
        )
        assert persisted is not None
        assert persisted.is_read is True
    finally:
        verify_session.close()


@pytest.mark.unit
def test_mark_user_notification_as_read_returns_404_when_missing(
    api_client, auth_headers, seeded_user
):
    response = api_client.put(
        f"/api/v1/users/{seeded_user.id}/notifications/99999/read",
        headers=auth_headers,
    )

    assert response.status_code == 404


@pytest.mark.unit
def test_delete_user_notifications_clears_all(
    api_client, auth_headers, test_session_factory, seeded_user
):
    _seed_user_notifications(test_session_factory, seeded_user.id, count=3)

    delete_response = api_client.delete(
        f"/api/v1/users/{seeded_user.id}/notifications",
        headers=auth_headers,
    )
    assert delete_response.status_code == 204

    list_response = api_client.get(
        f"/api/v1/users/{seeded_user.id}/notifications",
        headers=auth_headers,
    )
    assert list_response.status_code == 200
    assert list_response.json() == []

    verify_session = test_session_factory()
    try:
        remaining = (
            verify_session.query(NotificationModel)
            .filter(NotificationModel.user_id == seeded_user.id)
            .count()
        )
        assert remaining == 0
    finally:
        verify_session.close()
