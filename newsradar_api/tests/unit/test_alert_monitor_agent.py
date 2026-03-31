from types import SimpleNamespace
from unittest.mock import patch

import pytest

from app.models.alert_monitoring import AlertRule, Article
from app.models.rss import CategoriaIPTC, InformationSource, RSSChannel
from app.services.agents.alert_monitor_agent import run_alert_monitoring_cycle


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
