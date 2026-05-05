from types import SimpleNamespace
from unittest.mock import MagicMock, patch

import pytest

from app.services.agents import alert_monitor_agent as agent


@pytest.mark.unit
def test_build_notification_payload_safe_handles_exception(monkeypatch):
    alert = SimpleNamespace(id=1, user_id=1, notify_inbox=True)
    channel = SimpleNamespace(media_name="m", id=1)
    entry = SimpleNamespace(title="t", link="l", summary="s", published_at=None)

    monkeypatch.setattr(agent, "build_notification_payload", lambda *_: (_ for _ in ()).throw(RuntimeError("boom")))

    result = agent._build_notification_payload_safe(alert, channel, entry)
    assert result is None


@pytest.mark.unit
def test_index_article_document_handles_inner_and_outer_exceptions():
    alert = SimpleNamespace(id=1, user_id=1, name="A")
    channel = SimpleNamespace(media_name="m", id=1)
    entry = SimpleNamespace(link="http://x", title="t", summary="s", content=None, published_at=None)

    # Inner exception: es_client.index raises
    es_client1 = MagicMock()
    es_client1.index.side_effect = RuntimeError("inner")
    assert agent._index_article_document(es_client=es_client1, alert=alert, channel=channel, entry=entry) is None

    # Outer exception: index returns response whose .get raises
    response = MagicMock()
    response.get.side_effect = RuntimeError("outer-get")
    es_client2 = MagicMock()
    es_client2.index.return_value = response

    assert agent._index_article_document(es_client=es_client2, alert=alert, channel=channel, entry=entry) is None


@pytest.mark.unit
def test_persist_pending_notifications_handles_db_exception():
    db = MagicMock()
    channel = SimpleNamespace(id=9)
    pending = [SimpleNamespace()]

    db.commit.side_effect = RuntimeError("db fail")

    # Should not raise
    agent._persist_pending_notifications(db, channel, pending)
    db.rollback.assert_called_once()


@pytest.mark.unit
def test_run_alert_monitoring_cycle_continues_on_channel_processing_exception(monkeypatch):
    db = MagicMock()

    ch1 = SimpleNamespace(id=1, media_name="a", url="u1")
    ch2 = SimpleNamespace(id=2, media_name="b", url="u2")
    alert = SimpleNamespace(id=10, user_id=5)

    monkeypatch.setattr(agent, "_load_active_rss_channels", lambda _db: [ch1, ch2])
    monkeypatch.setattr(agent, "_load_active_alerts", lambda _db: [alert])
    # First channel processing raises, second returns 1
    def proc(channel, alerts, es, db_sess, pending):
        if channel.id == 1:
            raise RuntimeError("proc fail")
        return 1

    monkeypatch.setattr(agent, "_process_channel_entries", proc)
    monkeypatch.setattr(agent, "_create_elasticsearch_client", lambda: MagicMock())

    result = agent.run_alert_monitoring_cycle(db)
    assert result == 1


@pytest.mark.unit
def test_dispatch_cycle_emails_handles_dispatch_exception(monkeypatch):
    db = MagicMock()
    alert = SimpleNamespace(id=1, user_id=2, name="A")
    pending = {1: [{"title": "t", "message": "m"}]}

    user = SimpleNamespace(email="a@b")
    db.query.return_value.filter.return_value.first.return_value = user

    def raise_sender(*args, **kwargs):
        raise RuntimeError("send fail")

    monkeypatch.setattr(agent, "dispatch_alert_emails_with_cap", raise_sender)

    # Should not raise even if sender fails
    agent._dispatch_cycle_emails(db, [alert], pending)
