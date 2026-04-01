from types import SimpleNamespace
from unittest.mock import patch

import pytest

from app.models.alert_monitoring import AlertRule, Article
from app.models.rss import CategoriaIPTC, InformationSource, RSSChannel
from app.services.agents.alert_monitor_agent import (
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


@pytest.mark.unit
def test_monitor_match_inserts_article(db_session, seeded_user):
    _seed_monitor_entities(db_session, seeded_user, descriptors=["technology"])

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

    with patch("app.services.agents.alert_monitor_agent.feedparser.parse", return_value=fake_feed), patch(
        "app.services.agents.alert_monitor_agent.classify_article"
    ):
        created = run_alert_monitoring_cycle(db_session)

    assert created > 0

    saved_articles = db_session.query(Article).all()
    assert len(saved_articles) == 1
    assert saved_articles[0].url == "https://example.test/article-1"


@pytest.mark.unit
def test_monitor_no_match_inserts_nothing(db_session, seeded_user):
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

    with patch("app.services.agents.alert_monitor_agent.feedparser.parse", return_value=fake_feed), patch(
        "app.services.agents.alert_monitor_agent.classify_article"
    ):
        created = run_alert_monitoring_cycle(db_session)

    assert created == 0
    assert db_session.query(Article).count() == 0


@pytest.mark.unit
def test_monitor_duplicate_article_is_not_inserted_twice(db_session, seeded_user):
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

    with patch("app.services.agents.alert_monitor_agent.feedparser.parse", return_value=fake_feed), patch(
        "app.services.agents.alert_monitor_agent.classify_article"
    ):
        first_created = run_alert_monitoring_cycle(db_session)
        second_created = run_alert_monitoring_cycle(db_session)

    assert first_created == 1
    assert second_created == 0
    assert db_session.query(Article).count() == 1


@pytest.mark.unit
def test_monitor_duplicate_article_triggers_rollback(db_session, seeded_user):
    _seed_monitor_entities(db_session, seeded_user, descriptors=["technology"])

    fake_feed = SimpleNamespace(
        entries=[
            {
                "title": "Technology duplicate rollback",
                "summary": "Duplicate scenario with rollback",
                "link": "https://example.test/article-rollback",
                "published": "Tue, 31 Mar 2026 10:20:00 GMT",
            }
        ],
        bozo=False,
    )

    with patch("app.services.agents.alert_monitor_agent.feedparser.parse", return_value=fake_feed), patch(
        "app.services.agents.alert_monitor_agent.classify_article"
    ), patch.object(db_session, "rollback", wraps=db_session.rollback) as rollback_mock:
        first_created = run_alert_monitoring_cycle(db_session)
        second_created = run_alert_monitoring_cycle(db_session)

    assert first_created == 1
    assert second_created == 0
    assert rollback_mock.called is True


@pytest.mark.unit
def test_monitor_handles_bozo_feed_with_no_entries(db_session, seeded_user):
    _seed_monitor_entities(db_session, seeded_user, descriptors=["technology"])

    fake_feed = SimpleNamespace(entries=[], bozo=True)

    with patch("app.services.agents.alert_monitor_agent.feedparser.parse", return_value=fake_feed), patch(
        "app.services.agents.alert_monitor_agent.classify_article"
    ):
        created = run_alert_monitoring_cycle(db_session)

    assert created == 0
    assert db_session.query(Article).count() == 0


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

    with patch("app.services.agents.alert_monitor_agent.feedparser.parse", return_value=fake_feed), patch(
        "app.services.agents.alert_monitor_agent.classify_article",
        side_effect=RuntimeError("classification failed"),
    ):
        created = run_alert_monitoring_cycle(db_session)

    assert created == 1
    assert db_session.query(Article).count() == 1


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
