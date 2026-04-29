"""Servicios de monitorizacion y formateo para notificaciones de alertas."""

from __future__ import annotations

from datetime import datetime
from email.utils import parsedate_to_datetime
from typing import Any, Callable, Mapping, Protocol, runtime_checkable

from app.schemas.alert import Alert
from app.schemas.notification import Notification
from app.stores.memory import alerts_store, notifications_store, users_store
from app.utils.email_utils import send_alert_notification_email


@runtime_checkable
class AlertLike(Protocol):
    """Contrato minimo requerido para formatear una notificacion."""

    name: str


def _as_text(value: Any, default: str) -> str:
    if value is None:
        return default
    text = str(value).strip()
    return text if text else default


def _parse_news_datetime(raw_value: Any) -> datetime | None:
    if isinstance(raw_value, datetime):
        return raw_value

    if isinstance(raw_value, str):
        value = raw_value.strip()
        if not value:
            return None

        try:
            return datetime.fromisoformat(value)
        except ValueError:
            pass

        try:
            return parsedate_to_datetime(value)
        except (TypeError, ValueError):
            return None

    return None


def _resolve_title_datetime(
    noticia: Mapping[str, Any],
    now_provider: Callable[[], datetime],
) -> datetime:
    for key in ("published", "published_at", "date"):
        parsed = _parse_news_datetime(noticia.get(key))
        if parsed is not None:
            return parsed
    return now_provider()


def build_notification_payload(
    alerta: AlertLike,
    noticia: Mapping[str, Any],
    now_provider: Callable[[], datetime] | None = None,
) -> dict[str, str]:
    """Genera titulo y cuerpo de notificacion segun RF11/RF12."""

    resolved_now = now_provider or datetime.now
    fecha_formateada = _resolve_title_datetime(noticia, resolved_now).strftime("%d/%m/%Y %H:%M")

    origen = _as_text(noticia.get("source", "Origen desconocido"), "Origen desconocido")
    fecha_publicacion = _as_text(noticia.get("published", "Fecha desconocida"), "Fecha desconocida")
    titulo_noticia = _as_text(noticia.get("title", "Título desconocido"), "Título desconocido")
    resumen_noticia = _as_text(
        noticia.get("summary", "Sin resumen disponible"), "Sin resumen disponible"
    )

    title = f"Actualización de {alerta.name} en {fecha_formateada}"
    message = (
        f"Origen: {origen}\n"
        f"Fecha: {fecha_publicacion}\n"
        f"Título: {titulo_noticia}\n"
        f"Resumen: {resumen_noticia}"
    )

    return {"title": title, "message": message}


def noticia_coincide_alerta(noticia: Mapping[str, Any], alerta: Alert) -> bool:
    """Evalua si una noticia coincide con los descriptores de una alerta."""

    texto = (
        f"{noticia.get('title', '')} "
        f"{noticia.get('description', '')} "
        f"{noticia.get('summary', '')}"
    ).lower()
    return any(descriptor.lower() in texto for descriptor in alerta.descriptors)


def generar_notificacion_si_coincide(noticia: Mapping[str, Any]) -> int:
    """Genera notificaciones para cada alerta activa que coincida con la noticia (RF10)."""

    created_notifications = 0
    for alerta in alerts_store.values():
        if not noticia_coincide_alerta(noticia, alerta):
            continue

        # Genera el título y mensaje de la notificación según RF11/RF12
        payload = build_notification_payload(alerta, noticia)

        # RF10: Crear notificación en inbox si está configurado
        if alerta.notify_inbox:
            notificacion = Notification(
                id=max(notifications_store.keys(), default=0) + 1,
                alert_id=alerta.id,
                timestamp=_resolve_title_datetime(noticia, datetime.now),
                metrics=[],
                title=payload["title"],
                message=payload["message"],
            )
            notifications_store[notificacion.id] = notificacion
            created_notifications += 1

        # RF10: Enviar notificación por email si está configurado
        if alerta.notify_email:
            # Obtener el email del usuario
            user = users_store.get(alerta.user_id)
            if user and user.email:
                send_alert_notification_email(
                    to_email=user.email,
                    alert_name=alerta.name,
                    title=payload["title"],
                    message=payload["message"],
                )

    return created_notifications
