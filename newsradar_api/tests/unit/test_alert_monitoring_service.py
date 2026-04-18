from datetime import datetime, timezone
from types import SimpleNamespace
from email.utils import formatdate, parsedate_to_datetime
import pytest

from app.services.alert_monitoring_service import (
    build_notification_payload,
    _as_text,
    _parse_news_datetime,
    _resolve_title_datetime,
)


@pytest.mark.unit
def test_generar_notificaciones_formato_title_y_message():
    """Valida exactitud de formato RF11/RF12 con datos completos."""
    alerta = SimpleNamespace(name="Alerta Economia")
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
def test_formato_notificacion_con_campos_faltantes():
    """Valida defaults cuando la noticia está vacía."""
    alerta = SimpleNamespace(name="Alerta Tecnologia")
    noticia = {}
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
def test_parse_news_datetime_accept_datetime_object():
    """Línea 18: raw_value es datetime, retorna directamente."""
    dt = datetime(2026, 4, 14, 14, 30, tzinfo=timezone.utc)
    assert _parse_news_datetime(dt) == dt


@pytest.mark.unit
def test_parse_news_datetime_handles_empty_string():
    """Línea 25: raw_value es string pero vacío."""
    assert _parse_news_datetime("") is None
    assert _parse_news_datetime("   ") is None


@pytest.mark.unit
def test_parse_news_datetime_fromisoformat_valid():
    """Línea 33: parsedate_to_datetime reemplazado por fromisoformat válido."""
    iso_str = "2026-04-14T18:30:00"
    result = _parse_news_datetime(iso_str)
    assert result is not None
    assert result.year == 2026
    assert result.month == 4
    assert result.day == 14


@pytest.mark.unit
def test_parse_news_datetime_fromisoformat_invalid():
    """Línea 34-35: fromisoformat lanza ValueError, fallback a parsedate."""
    invalid_iso = "not-a-valid-iso-date"
    # parsedate_to_datetime fallará también
    result = _parse_news_datetime(invalid_iso)
    assert result is None


@pytest.mark.unit
def test_parse_news_datetime_rfc2822_format():
    """Línea 40: parsedate_to_datetime con RFC2822."""
    rfc2822 = "Tue, 14 Apr 2026 18:30:00 +0000"
    result = _parse_news_datetime(rfc2822)
    assert result is not None


@pytest.mark.unit
def test_parse_news_datetime_non_string_non_datetime():
    """Línea 46: raw_value no es str ni datetime."""
    assert _parse_news_datetime(None) is None
    assert _parse_news_datetime(12345) is None
    assert _parse_news_datetime([]) is None


@pytest.mark.unit
def test_as_text_with_none():
    """Función _as_text retorna default cuando value es None."""
    assert _as_text(None, "default") == "default"


@pytest.mark.unit
def test_as_text_with_whitespace():
    """_as_text retorna default cuando value es solo whitespace."""
    assert _as_text("   ", "default") == "default"
    assert _as_text("\t\n", "default") == "default"


@pytest.mark.unit
def test_as_text_with_valid_string():
    """_as_text retorna string limpio."""
    assert _as_text("  hello  ", "default") == "hello"


@pytest.mark.unit
def test_resolve_title_datetime_published_key():
    """_resolve_title_datetime busca 'published' primero."""
    noticia = {"published": "2026-04-14T14:00:00"}
    fixed_now = datetime(2026, 4, 15, 0, 0)

    result = _resolve_title_datetime(noticia, lambda: fixed_now)
    assert result.day == 14


@pytest.mark.unit
def test_resolve_title_datetime_published_at_key():
    """_resolve_title_datetime busca 'published_at' si 'published' no está."""
    noticia = {"published_at": "2026-04-13T10:00:00"}
    fixed_now = datetime(2026, 4, 15, 0, 0)

    result = _resolve_title_datetime(noticia, lambda: fixed_now)
    assert result.day == 13


@pytest.mark.unit
def test_resolve_title_datetime_date_key():
    """_resolve_title_datetime busca 'date' si no encuentra otros."""
    noticia = {"date": "2026-04-12T08:00:00"}
    fixed_now = datetime(2026, 4, 15, 0, 0)

    result = _resolve_title_datetime(noticia, lambda: fixed_now)
    assert result.day == 12


@pytest.mark.unit
def test_resolve_title_datetime_fallback_to_now():
    """_resolve_title_datetime usa now_provider si no hay fecha."""
    noticia = {}
    fixed_now = datetime(2026, 4, 15, 12, 45)

    result = _resolve_title_datetime(noticia, lambda: fixed_now)
    assert result == fixed_now


@pytest.mark.unit
def test_build_notification_payload_with_rfc2822_published():
    """Integración: RFC2822 date parsed correctamente."""
    alerta = SimpleNamespace(name="Test Alert")
    noticia = {
        "source": "BBC News",
        "published": "Tue, 14 Apr 2026 18:30:00 +0000",
        "title": "Breaking News",
        "summary": "Important update.",
    }

    payload = build_notification_payload(alerta, noticia)

    assert "BBC News" in payload["message"]
    assert "Breaking News" in payload["message"]


@pytest.mark.unit
def test_build_notification_payload_with_datetime_object():
    """Integración: datetime object como published."""
    alerta = SimpleNamespace(name="Test Alert")
    dt = datetime(2026, 4, 14, 10, 30, tzinfo=timezone.utc)
    noticia = {
        "source": "Reuters",
        "published": dt,
        "title": "Market Update",
        "summary": "Markets rally.",
    }

    payload = build_notification_payload(alerta, noticia)

    assert "Actualización de Test Alert en 14/04/2026 10:30" == payload["title"]


@pytest.mark.unit
def test_build_notification_payload_preserves_summary_newlines():
    """Mensaje no introduce caracteres adicionales en summary."""
    alerta = SimpleNamespace(name="Alert")
    noticia = {
        "source": "Source",
        "published": "2026-04-14T10:00:00",
        "title": "Title",
        "summary": "Multi\nline\nsummary",
    }

    payload = build_notification_payload(alerta, noticia)

    assert "Multi\nline\nsummary" in payload["message"]


@pytest.mark.unit
def test_build_notification_payload_all_fields_required_in_message():
    """Mensaje contiene exactamente los 4 campos requeridos."""
    alerta = SimpleNamespace(name="Test")
    noticia = {
        "source": "S",
        "published": "2026-04-14T10:00:00",
        "title": "T",
        "summary": "Sum",
    }

    payload = build_notification_payload(alerta, noticia)
    message = payload["message"]

    assert "Origen:" in message
    assert "Fecha:" in message
    assert "Título:" in message
    assert "Resumen:" in message
    assert message.count("\n") == 3  # Exactamente 3 newlines
