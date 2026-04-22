from types import SimpleNamespace
from unittest.mock import MagicMock, patch

import pytest

from app.models.alert_monitoring import AlertRule
from app.models.rss import CategoriaIPTC, InformationSource, RSSChannel
from app.services.agents.alert_monitor_agent import (
    _build_article_document,
    _normalize_descriptors,
    _normalize_feed_entry,
    _parse_feed,
    run_alert_monitoring_cycle,
)


def _seed_monitor_entities(db_session, seeded_user, descriptors):
    source = InformationSource(name="RF01 Source", url="https://source.test")
    db_session.add(source)
    db_session.commit()
    db_session.refresh(source)

    channel = RSSChannel(
        information_source_id=source.id,
        media_name="RF01 Media",
        url="https://feed.test/rss.xml",
        category_id=1,
        iptc_category=CategoriaIPTC.TECNOLOGIA,
        is_active=True,
    )
    db_session.add(channel)
    db_session.commit()
    db_session.refresh(channel)

    alert = AlertRule(
        user_id=seeded_user.id,
        name="RF01 Alert",
        descriptors=descriptors,
        categories=[{"code": "04010000", "label": "Tecnologia"}],
        cron_expression="*/1 * * * *",
        is_active=True,
    )
    db_session.add(alert)
    db_session.commit()
    db_session.refresh(alert)

    return alert, channel


def _make_es_client(index_side_effect=None, index_return_value=None):
    client = MagicMock()
    if index_side_effect is not None:
        client.index.side_effect = index_side_effect
    else:
        client.index.return_value = index_return_value or {"result": "created", "_id": "doc-1"}
    return client


@pytest.mark.unit
def test_monitor_match_indexes_document(db_session, seeded_user):
    alert, channel = _seed_monitor_entities(db_session, seeded_user, descriptors=["technology"])

    fake_feed = SimpleNamespace(
        entries=[
            {
                "title": "Technology market update",
                "summary": "A story that matches the descriptor",
                "link": "https://example.test/article-1",
                "published": "Tue, 31 Mar 2026 10:00:00 GMT",
            }
        ],
        bozo=False,
    )
    es_client = _make_es_client(index_return_value={"result": "created", "_id": "doc-1"})

    with patch("app.services.agents.alert_monitor_agent.feedparser.parse", return_value=fake_feed), patch(
        "app.services.agents.alert_monitor_agent._create_elasticsearch_client",
        return_value=es_client,
    ), patch("app.services.agents.alert_monitor_agent.classify_article") as classify_mock:
        created = run_alert_monitoring_cycle(db_session)

    assert created == 1
    es_client.index.assert_called_once()
    assert es_client.index.call_args.kwargs["index"] == "articles"
    assert es_client.index.call_args.kwargs["op_type"] == "create"
    document = es_client.index.call_args.kwargs["document"]
    assert document["title"] == "Technology market update"
    assert document["link"] == "https://example.test/article-1"
    assert document["summary"] == "A story that matches the descriptor"
    assert document["notification_title"] == "Actualización de RF01 Alert en 31/03/2026 10:00"
    assert document["notification_message"] == (
        "Origen: RF01 Media\n"
        "Fecha: 2026-03-31T10:00:00+00:00\n"
        "Título: Technology market update\n"
        "Resumen: A story that matches the descriptor"
    )
    assert document["alert_id"] == alert.id
    assert document["user_id"] == seeded_user.id
    assert document["channel_id"] == channel.id
    classify_mock.assert_called_once_with("doc-1")


@pytest.mark.unit
def test_monitor_no_match_indexes_nothing(db_session, seeded_user):
    _seed_monitor_entities(db_session, seeded_user, descriptors=["economy"])

    fake_feed = SimpleNamespace(
        entries=[
            {
                "title": "Sports headline",
                "summary": "No descriptor present",
                "link": "https://example.test/article-2",
                "published": "Tue, 31 Mar 2026 10:05:00 GMT",
            }
        ],
        bozo=False,
    )
    es_client = _make_es_client()

    with patch("app.services.agents.alert_monitor_agent.feedparser.parse", return_value=fake_feed), patch(
        "app.services.agents.alert_monitor_agent._create_elasticsearch_client",
        return_value=es_client,
    ), patch("app.services.agents.alert_monitor_agent.classify_article"):
        created = run_alert_monitoring_cycle(db_session)

    assert created == 0
    es_client.index.assert_not_called()


@pytest.mark.unit
def test_monitor_duplicate_article_is_not_indexed_twice(db_session, seeded_user):
    _seed_monitor_entities(db_session, seeded_user, descriptors=["technology"])

    fake_feed = SimpleNamespace(
        entries=[
            {
                "title": "Technology duplicated headline",
                "summary": "Duplicate scenario",
                "link": "https://example.test/article-dup",
                "published": "Tue, 31 Mar 2026 10:10:00 GMT",
            }
        ],
        bozo=False,
    )
    es_client = _make_es_client(
        index_side_effect=[{"result": "created", "_id": "doc-dup"}, Exception("conflict")]
    )

    with patch("app.services.agents.alert_monitor_agent.feedparser.parse", return_value=fake_feed), patch(
        "app.services.agents.alert_monitor_agent._create_elasticsearch_client",
        return_value=es_client,
    ), patch("app.services.agents.alert_monitor_agent.classify_article"):
        first_created = run_alert_monitoring_cycle(db_session)
        second_created = run_alert_monitoring_cycle(db_session)

    assert first_created == 1
    assert second_created == 0
    assert es_client.index.call_count == 2


@pytest.mark.unit
def test_monitor_es_index_error_is_handled(db_session, seeded_user):
    _seed_monitor_entities(db_session, seeded_user, descriptors=["technology"])

    fake_feed = SimpleNamespace(
        entries=[
            {
                "title": "Technology index failure",
                "summary": "Elasticsearch should fail",
                "link": "https://example.test/article-es-error",
                "published": "Tue, 31 Mar 2026 10:20:00 GMT",
            }
        ],
        bozo=False,
    )
    es_client = _make_es_client(index_side_effect=RuntimeError("es down"))

    with patch("app.services.agents.alert_monitor_agent.feedparser.parse", return_value=fake_feed), patch(
        "app.services.agents.alert_monitor_agent._create_elasticsearch_client",
        return_value=es_client,
    ), patch("app.services.agents.alert_monitor_agent.classify_article") as classify_mock:
        created = run_alert_monitoring_cycle(db_session)

    assert created == 0
    es_client.index.assert_called_once()
    classify_mock.assert_not_called()


@pytest.mark.unit
def test_monitor_handles_bozo_feed_with_no_entries(db_session, seeded_user):
    _seed_monitor_entities(db_session, seeded_user, descriptors=["technology"])

    fake_feed = SimpleNamespace(entries=[], bozo=True)
    es_client = _make_es_client()

    with patch("app.services.agents.alert_monitor_agent.feedparser.parse", return_value=fake_feed), patch(
        "app.services.agents.alert_monitor_agent._create_elasticsearch_client",
        return_value=es_client,
    ), patch("app.services.agents.alert_monitor_agent.classify_article"):
        created = run_alert_monitoring_cycle(db_session)

    assert created == 0
    es_client.index.assert_not_called()


@pytest.mark.unit
def test_monitor_rolls_back_when_classification_fails(db_session, seeded_user):
    _seed_monitor_entities(db_session, seeded_user, descriptors=["technology"])

    fake_feed = SimpleNamespace(
        entries=[
            {
                "title": "Technology rollback check",
                "summary": "Classification should fail",
                "link": "https://example.test/article-classify-error",
                "published": "Tue, 31 Mar 2026 10:15:00 GMT",
            }
        ],
        bozo=False,
    )
    es_client = _make_es_client(index_return_value={"result": "created", "_id": "doc-rollback"})

    with patch("app.services.agents.alert_monitor_agent.feedparser.parse", return_value=fake_feed), patch(
        "app.services.agents.alert_monitor_agent._create_elasticsearch_client",
        return_value=es_client,
    ), patch(
        "app.services.agents.alert_monitor_agent.classify_article",
        side_effect=RuntimeError("classification failed"),
    ), patch.object(db_session, "rollback", wraps=db_session.rollback) as rollback_mock:
        created = run_alert_monitoring_cycle(db_session)

    assert created == 1
    es_client.index.assert_called_once()
    assert rollback_mock.called is True


@pytest.mark.unit
def test_build_article_document_includes_required_fields(db_session, seeded_user):
    alert, channel = _seed_monitor_entities(db_session, seeded_user, descriptors=["technology"])
    entry = _normalize_feed_entry(
        {
            "title": "Technology headline",
            "summary": "Some summary",
            "link": "https://example.test/article-doc",
            "published": "Tue, 31 Mar 2026 10:30:00 GMT",
        }
    )
    assert entry is not None

    document = _build_article_document(alert=alert, channel=channel, entry=entry)

    assert document["title"] == "Technology headline"
    assert document["link"] == "https://example.test/article-doc"
    assert document["summary"] == "Some summary"
    assert document["notification_title"] == "Actualización de RF01 Alert en 31/03/2026 10:30"
    assert document["notification_message"] == (
        "Origen: RF01 Media\n"
        "Fecha: 2026-03-31T10:30:00+00:00\n"
        "Título: Technology headline\n"
        "Resumen: Some summary"
    )
    assert document["alert_id"] == alert.id
    assert document["user_id"] == seeded_user.id


@pytest.mark.unit
def test_parse_feed_falls_back_to_https_when_http_returns_no_entries():
    first = SimpleNamespace(entries=[])
    second = SimpleNamespace(entries=[{"title": "ok", "link": "https://ok"}])

    with patch(
        "app.services.agents.alert_monitor_agent.feedparser.parse",
        side_effect=[first, second],
    ) as mocked_parse:
        parsed = _parse_feed("http://fallback.test/rss")

    assert parsed is second
    assert mocked_parse.call_count == 2


@pytest.mark.unit
def test_normalize_feed_entry_returns_none_without_required_fields():
    assert _normalize_feed_entry({"title": "missing link"}) is None
    assert _normalize_feed_entry({"link": "https://missing-title.test"}) is None


@pytest.mark.unit
def test_normalize_descriptors_supports_json_and_plain_text():
    assert _normalize_descriptors('["a", "b"]') == ["a", "b"]
    assert _normalize_descriptors("single") == ["single"]
    assert _normalize_descriptors(None) == []
