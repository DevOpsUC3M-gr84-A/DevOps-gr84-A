"""Agente de monitorizacion: consume RSS, detecta matches y persiste articulos."""

from __future__ import annotations

import hashlib
import logging
import os
from datetime import datetime, timezone
from email.utils import parsedate_to_datetime
import json
from typing import List
from urllib.parse import urlparse, urlunparse

import feedparser
import requests
from elasticsearch import Elasticsearch
from pydantic import BaseModel, ConfigDict
from sqlalchemy.orm import Session

from app.models.alert_monitoring import AlertRule
from app.models.rss import RSSChannel
from app.services.alert_monitoring_service import build_notification_payload
from app.services.workflows.classification_workflow import classify_article
from app.models.notification import Notification as NotificationModel
from app.database.database import engine, Base

logger = logging.getLogger("uvicorn.error")
# Cabecera de navegador real para evitar bloqueos 403 de medios como
# La Vanguardia o ABC, que rechazan User-Agents identificados como bots.
RSS_USER_AGENT = (
    "Mozilla/5.0 (Windows NT 10.0; Win64; x64) "
    "AppleWebKit/537.36 (KHTML, like Gecko) "
    "Chrome/120.0.0.0 Safari/537.36"
)
RSS_REQUEST_HEADERS = {
    "User-Agent": RSS_USER_AGENT,
    "Accept": (
        "application/rss+xml, application/atom+xml, application/xml;q=0.9, "
        "text/xml;q=0.8, */*;q=0.5"
    ),
    "Accept-Language": "es-ES,es;q=0.9,en;q=0.8",
}
ELASTICSEARCH_URL = os.getenv("ELASTICSEARCH_URL", "http://localhost:9200")
RSS_FETCH_TIMEOUT_SECONDS = float(os.getenv("RSS_FETCH_TIMEOUT_SECONDS", "10"))


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
    def _fetch_and_parse(url: str):
        try:
            response = requests.get(
                url,
                headers=RSS_REQUEST_HEADERS,
                timeout=RSS_FETCH_TIMEOUT_SECONDS,
            )
            response.raise_for_status()
            return feedparser.parse(response.content)
        except requests.RequestException as exc:
            logger.warning("Fallo leyendo RSS url=%s: %s", url, exc)
            return feedparser.parse("")

    parsed = _fetch_and_parse(channel_url)

    if getattr(parsed, "entries", None):
        return parsed

    # Forma profesional de actualizar el protocolo a seguro
    parsed_url = urlparse(channel_url)
    if parsed_url.scheme == "http":
        # Cambiamos el esquema de forma segura y reconstruimos la URL
        secure_url = urlunparse(parsed_url._replace(scheme="https"))

        parsed_https = _fetch_and_parse(secure_url)
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



def _create_elasticsearch_client() -> Elasticsearch:
    return Elasticsearch(ELASTICSEARCH_URL)


def _build_article_document(
    *,
    alert: AlertRule,
    channel: RSSChannel,
    entry: ParsedEntry,
) -> dict[str, object | None]:
    published_at = entry.published_at.isoformat() if entry.published_at else None
    notification_payload = build_notification_payload(
        alert,
        {
            "source": channel.media_name,
            "published": published_at,
            "title": entry.title,
            "summary": entry.summary,
        },
    )
    return {
        "title": entry.title,
        "link": entry.link,
        "summary": entry.summary,
        "content": entry.content,
        "published_at": published_at,
        "date": published_at,
        "alert_id": alert.id,
        "user_id": alert.user_id,
        "channel_id": channel.id,
        "source": channel.media_name,
        "notification_title": notification_payload["title"],
        "notification_message": notification_payload["message"],
    }


def _index_article_document(
    *,
    es_client: Elasticsearch,
    alert: AlertRule,
    channel: RSSChannel,
    entry: ParsedEntry,
) -> str | None:
    document = _build_article_document(alert=alert, channel=channel, entry=entry)
    document_id = hashlib.sha256(f"{alert.id}:{entry.link}".encode("utf-8")).hexdigest()
    try:
        try:
            response = es_client.index(
                index="articles",
                id=document_id,
                document=document,
                op_type="create",
                request_timeout=1,
            )
        except Exception as exc:  # noqa: BLE001
            logger.warning(
                "Elasticsearch indexing failed for alert_id=%s url=%s: %s",
                alert.id,
                entry.link,
                exc,
            )
            return None

        logger.info(
            "Documento indexado id=%s alert_id=%s user_id=%s url=%s",
            response.get("_id", document_id),
            alert.id,
            alert.user_id,
            entry.link,
        )
        return str(response.get("_id", document_id))
    except Exception as exc:  # noqa: BLE001
        logger.exception("Unexpected error indexing in Elasticsearch: %s", exc)
        return None


def _normalize_entries(feed) -> list[ParsedEntry]:
    raw_entries = getattr(feed, "entries", [])
    return [
        normalized
        for normalized in (_normalize_feed_entry(item) for item in raw_entries)
        if normalized is not None
    ]


def _notification_already_exists(
    db: Session, alert: AlertRule, entry: ParsedEntry
) -> bool:
    return (
        db.query(NotificationModel)
        .filter(
            NotificationModel.alert_id == alert.id,
            NotificationModel.article_url == entry.link,
        )
        .first()
        is not None
    )


def _build_notification_payload_safe(
    alert: AlertRule, channel: RSSChannel, entry: ParsedEntry
) -> dict | None:
    try:
        return build_notification_payload(
            alert,
            {
                "source": channel.media_name,
                "published": entry.published_at.isoformat() if entry.published_at else None,
                "title": entry.title,
                "summary": entry.summary,
            },
        )
    except Exception as exc:  # noqa: BLE001
        logger.exception(
            "Error creando payload de notificación para url=%s: %s", entry.link, exc
        )
        return None


def _index_and_classify(
    es_client: Elasticsearch,
    alert: AlertRule,
    channel: RSSChannel,
    entry: ParsedEntry,
) -> None:
    """Indexa el artículo en Elasticsearch y dispara clasificación. No crítico."""
    try:
        article_id = _index_article_document(
            es_client=es_client, alert=alert, channel=channel, entry=entry
        )
    except Exception as exc:  # noqa: BLE001
        logger.warning(
            "Elasticsearch indexing error (ignored) for url=%s: %s", entry.link, exc
        )
        return

    if not article_id:
        return

    try:
        classify_article(article_id)
    except Exception as exc:  # noqa: BLE001
        logger.warning(
            "Classification service failed (ignored) for article_id=%s: %s",
            article_id,
            exc,
        )


def _handle_match(
    db: Session,
    es_client: Elasticsearch,
    channel: RSSChannel,
    alert: AlertRule,
    entry: ParsedEntry,
    pending_notifications: list[NotificationModel],
) -> int:
    """Procesa un match (entry, alert): encola notificación e indexa. Devuelve 1 si encoló."""
    logger.info(
        "Match detectado: channel_id=%s alert_id=%s url=%s",
        channel.id,
        alert.id,
        entry.link,
    )

    created = 0
    if getattr(alert, "notify_inbox", False):
        payload = _build_notification_payload_safe(alert, channel, entry)
        if payload is not None:
            if _notification_already_exists(db, alert, entry):
                logger.debug(
                    "Notificación duplicada omitida: alert_id=%s url=%s",
                    alert.id,
                    entry.link,
                )
                # Dedupe por BD: omitimos también la indexación en ES.
                return 0

            pending_notifications.append(
                NotificationModel(
                    user_id=alert.user_id,
                    alert_id=alert.id,
                    article_url=entry.link,
                    title=payload.get("title"),
                    message=payload.get("message"),
                )
            )
            created = 1
            logger.debug(
                "Notification queued for DB persist: alert_id=%s url=%s",
                alert.id,
                entry.link,
            )

    _index_and_classify(es_client, alert, channel, entry)
    return created


def _persist_pending_notifications(
    db: Session, channel: RSSChannel, pending: list[NotificationModel]
) -> None:
    if not pending:
        return
    try:
        for n in pending:
            db.add(n)
        db.commit()
        logger.info(
            "Persistidas %d notificaciones en BD para canal id=%s",
            len(pending),
            channel.id,
        )
    except Exception as exc:  # noqa: BLE001
        db.rollback()
        logger.exception(
            "Error persisting notifications to DB for channel id=%s: %s",
            channel.id,
            exc,
        )


def _process_channel_entries(
    channel: RSSChannel,
    alerts: list[AlertRule],
    es_client: Elasticsearch,
    db: Session,
) -> int:
    feed = _parse_feed(channel.url)
    logger.info(
        "Canal RSS id=%s media=%s entries=%s bozo=%s",
        channel.id,
        channel.media_name,
        len(getattr(feed, "entries", [])),
        getattr(feed, "bozo", False),
    )

    normalized_entries = _normalize_entries(feed)
    created_articles = 0
    pending_notifications: list[NotificationModel] = []

    for entry in normalized_entries:
        for alert in alerts:
            descriptors = _normalize_descriptors(alert.descriptors)
            if not _descriptor_matches(entry, descriptors):
                continue
            created_articles += _handle_match(
                db, es_client, channel, alert, entry, pending_notifications
            )

    _persist_pending_notifications(db, channel, pending_notifications)
    return created_articles


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
    # Asegurarse de que las tablas están presentes (crea tables si faltan)
    try:
        Base.metadata.create_all(bind=engine)
    except Exception:
        # Si no podemos crear tablas aquí, continuamos y esperamos que la infra las gestione
        logger.debug("No se pudieron crear tablas automáticamente en este contexto")

    es_client = _create_elasticsearch_client()

    try:
        for channel in channels:
            created_articles += _process_channel_entries(channel, alerts, es_client, db)

        check_time = datetime.now(timezone.utc)
        for alert in alerts:
            alert.last_checked_at = check_time
        db.commit()
    finally:
        es_client.close()

    return created_articles
