"""Agente de monitorizacion: consume RSS, detecta matches y persiste articulos."""

from __future__ import annotations

import logging
from datetime import datetime, timezone
from email.utils import parsedate_to_datetime
import json
from typing import List
from urllib.parse import urlparse, urlunparse

import feedparser
from pydantic import BaseModel, ConfigDict
from sqlalchemy.exc import IntegrityError
from sqlalchemy.orm import Session

from app.models.alert_monitoring import AlertRule, Article
from app.models.rss import RSSChannel
from app.services.workflows.classification_workflow import classify_article

logger = logging.getLogger("uvicorn.error")
RSS_USER_AGENT = "NewsRadar/1.0 (+https://localhost)"


class ParsedEntry(BaseModel):
    """Representacion normalizada de una entrada RSS parseada."""

    model_config = ConfigDict(str_strip_whitespace=True)

    title: str
    summary: str | None = None
    content: str | None = None
    link: str
    published_at: datetime | None = None


def _extract_published_at(raw_entry: dict) -> datetime | None:
    for field in ("published", "updated"):
        raw_value = raw_entry.get(field)
        if not raw_value:
            continue
        try:
            parsed = parsedate_to_datetime(raw_value)
            if parsed.tzinfo is None:
                return parsed.replace(tzinfo=timezone.utc)
            return parsed.astimezone(timezone.utc)
        except (TypeError, ValueError):
            continue
    return None


def _normalize_feed_entry(raw_entry: dict) -> ParsedEntry | None:
    link = raw_entry.get("link")
    title = raw_entry.get("title", "")

    if not link or not title:
        return None

    content_parts = raw_entry.get("content", [])
    content_text = None
    if isinstance(content_parts, list) and content_parts:
        first_item = content_parts[0]
        if isinstance(first_item, dict):
            content_text = first_item.get("value")

    return ParsedEntry(
        title=title,
        summary=raw_entry.get("summary"),
        content=content_text,
        link=link,
        published_at=_extract_published_at(raw_entry),
    )


def _parse_feed(channel_url: str):
    parsed = feedparser.parse(
        channel_url,
        request_headers={"User-Agent": RSS_USER_AGENT},
    )

    if getattr(parsed, "entries", None):
        return parsed

    # Forma profesional de actualizar el protocolo a seguro
    parsed_url = urlparse(channel_url)
    if parsed_url.scheme == "http":
        # Cambiamos el esquema de forma segura y reconstruimos la URL
        secure_url = urlunparse(parsed_url._replace(scheme="https"))

        parsed_https = feedparser.parse(
            secure_url,
            request_headers={"User-Agent": RSS_USER_AGENT},
        )
        if getattr(parsed_https, "entries", None):
            return parsed_https

    return parsed


def _load_active_rss_channels(db: Session) -> List[RSSChannel]:
    return db.query(RSSChannel).filter(RSSChannel.is_active.is_(True)).all()


def _load_active_alerts(db: Session) -> List[AlertRule]:
    return db.query(AlertRule).filter(AlertRule.is_active.is_(True)).all()


def _normalize_descriptors(raw_descriptors: object) -> list[str]:
    if raw_descriptors is None:
        return []

    if isinstance(raw_descriptors, str):
        # Compatibilidad con datos legacy serializados como texto JSON.
        try:
            parsed = json.loads(raw_descriptors)
            if isinstance(parsed, list):
                return [str(item).strip() for item in parsed if str(item).strip()]
        except (TypeError, ValueError):
            pass

        normalized = raw_descriptors.strip()
        return [normalized] if normalized else []

    if isinstance(raw_descriptors, list):
        return [str(item).strip() for item in raw_descriptors if str(item).strip()]

    return []


def _descriptor_matches(entry: ParsedEntry, descriptors: list[str]) -> bool:
    if not descriptors:
        return False

    haystack = " ".join(
        [
            entry.title or "",
            entry.summary or "",
            entry.content or "",
        ]
    ).lower()

    return any(descriptor.casefold() in haystack for descriptor in descriptors if descriptor)


def _persist_article(
    db: Session,
    *,
    alert: AlertRule,
    channel: RSSChannel,
    entry: ParsedEntry,
) -> Article | None:
    article = Article(
        alert_id=alert.id,
        rss_channel_id=channel.id,
        title=entry.title,
        summary=entry.summary,
        content=entry.content,
        url=entry.link,
        published_at=entry.published_at,
        source=channel.media_name,
    )
    db.add(article)

    try:
        db.commit()
    except IntegrityError as exc:
        db.rollback()
        logger.debug(
            "Articulo descartado para alert_id=%s url=%s por IntegrityError: %s",
            alert.id,
            entry.link,
            exc,
        )
        return None

    db.refresh(article)
    logger.info(
        "Articulo persistido id=%s alert_id=%s channel_id=%s url=%s",
        article.id,
        alert.id,
        channel.id,
        article.url,
    )
    return article


def run_alert_monitoring_cycle(db: Session) -> int:
    """Ejecuta un ciclo completo de monitorizacion y devuelve articulos nuevos."""

    channels = _load_active_rss_channels(db)
    alerts = _load_active_alerts(db)

    logger.info(
        "Monitor cycle start: active_channels=%s active_alerts=%s",
        len(channels),
        len(alerts),
    )

    if not channels or not alerts:
        return 0

    created_articles = 0

    for channel in channels:
        feed = _parse_feed(channel.url)
        raw_entries = getattr(feed, "entries", [])
        logger.info(
            "Canal RSS id=%s media=%s entries=%s bozo=%s",
            channel.id,
            channel.media_name,
            len(raw_entries),
            getattr(feed, "bozo", False),
        )

        normalized_entries = [
            normalized
            for normalized in (_normalize_feed_entry(item) for item in raw_entries)
            if normalized is not None
        ]

        for entry in normalized_entries:
            for alert in alerts:
                normalized_descriptors = _normalize_descriptors(alert.descriptors)
                if not _descriptor_matches(entry, normalized_descriptors):
                    continue

                article = _persist_article(db, alert=alert, channel=channel, entry=entry)
                if article is None:
                    continue

                created_articles += 1

                try:
                    classify_article(article.id)
                    article.is_classified = True
                    db.commit()
                except Exception as exc:  # noqa: BLE001
                    db.rollback()
                    logger.exception(
                        "Error clasificando article_id=%s: %s", article.id, exc
                    )

    check_time = datetime.now(timezone.utc)
    for alert in alerts:
        alert.last_checked_at = check_time
    db.commit()

    return created_articles
