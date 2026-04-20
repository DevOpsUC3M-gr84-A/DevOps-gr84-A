from dataclasses import dataclass
from datetime import datetime, timezone
from collections.abc import Generator

import pytest

from app.schemas.alert import Alert
from app.services import alert_monitoring_service
from app.services.alert_monitoring_service import (
    _as_text,
    _parse_news_datetime,
    _resolve_title_datetime,
    build_notification_payload,
)


@dataclass
class FakeAlert:
    name: str


@pytest.fixture
def sample_alert() -> Alert:
    return Alert(
        id=1,
        user_id=1,
        name="Alerta IA",
        descriptors=["inteligencia artificial", "machine learning"],
        categories=[],
        cron_expression="* * * * *",
    )


@pytest.fixture
def sample_news() -> dict[str, str]:
    return {
        "title": "Avances en inteligencia artificial revolucionan la industria",
        "description": "Nuevos modelos de machine learning superan expectativas.",
        "summary": "Resumen breve.",
        "source": "El Diario",
        "published": "2026-04-14T18:30:00",
    }


@pytest.fixture(autouse=True)
def clean_stores() -> Generator[None, None, None]:
    alert_monitoring_service.alerts_store.clear()
    alert_monitoring_service.notifications_store.clear()
    yield
    alert_monitoring_service.alerts_store.clear()
    alert_monitoring_service.notifications_store.clear()


@pytest.mark.unit
def test_generar_notificaciones_formato_title_y_message() -> None:
    alerta = FakeAlert(name="Alerta Economia")
    noticia = {
        "source": "El Diario",
        "published": "2026-04-14T18:30:00",
        "title": "Mercados en alza",
        "summary": "La bolsa cierra con ganancias.",
    }

    payload = build_notification_payload(alerta, noticia)

    assert payload["title"] == "Actualización de Alerta Economia en 14/04/2026 18:30"
    assert payload["message"] == (
        "Origen: El Diario\n"
        "Fecha: 2026-04-14T18:30:00\n"
        "Título: Mercados en alza\n"
        "Resumen: La bolsa cierra con ganancias."
    )


@pytest.mark.unit
def test_formato_notificacion_con_campos_faltantes() -> None:
    alerta = FakeAlert(name="Alerta Tecnologia")
    noticia: dict[str, str] = {}
    fixed_now = datetime(2026, 4, 15, 12, 45)

    payload = build_notification_payload(alerta, noticia, now_provider=lambda: fixed_now)

    assert payload["title"] == "Actualización de Alerta Tecnologia en 15/04/2026 12:45"
    assert payload["message"] == (
        "Origen: Origen desconocido\n"
        "Fecha: Fecha desconocida\n"
        "Título: Título desconocido\n"
        "Resumen: Sin resumen disponible"
    )


@pytest.mark.unit
def test_parse_news_datetime_accept_datetime_object() -> None:
    dt = datetime(2026, 4, 14, 14, 30, tzinfo=timezone.utc)
    assert _parse_news_datetime(dt) == dt


@pytest.mark.unit
def test_parse_news_datetime_handles_invalid_values() -> None:
    assert _parse_news_datetime("") is None
    assert _parse_news_datetime("not-a-date") is None
    assert _parse_news_datetime(12345) is None


@pytest.mark.unit
def test_as_text_with_none_and_whitespace() -> None:
    assert _as_text(None, "default") == "default"
    assert _as_text("  ", "default") == "default"
    assert _as_text(" value ", "default") == "value"


@pytest.mark.unit
def test_resolve_title_datetime_fallback_to_now() -> None:
    noticia: dict[str, str] = {}
    fixed_now = datetime(2026, 4, 15, 12, 45)
    result = _resolve_title_datetime(noticia, lambda: fixed_now)
    assert result == fixed_now


@pytest.mark.unit
def test_noticia_coincide_alerta(sample_alert: Alert, sample_news: dict[str, str]) -> None:
    assert alert_monitoring_service.noticia_coincide_alerta(sample_news, sample_alert)


@pytest.mark.unit
def test_generar_notificacion_si_coincide(sample_alert: Alert, sample_news: dict[str, str]) -> None:
    alert_monitoring_service.alerts_store[sample_alert.id] = sample_alert

    created = alert_monitoring_service.generar_notificacion_si_coincide(sample_news)

    assert created == 1
    assert len(alert_monitoring_service.notifications_store) == 1
    notif = list(alert_monitoring_service.notifications_store.values())[0]
    assert notif.alert_id == sample_alert.id


@pytest.mark.unit
def test_generar_notificacion_si_coincide_no_match(sample_alert: Alert) -> None:
    alert_monitoring_service.alerts_store[sample_alert.id] = sample_alert
    noticia = {
        "title": "Economia internacional",
        "description": "Sin descriptores de IA.",
    }

    created = alert_monitoring_service.generar_notificacion_si_coincide(noticia)

    assert created == 0
    assert len(alert_monitoring_service.notifications_store) == 0
