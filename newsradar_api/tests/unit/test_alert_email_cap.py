"""Tests para la barrera anti-spam de correos en alert_monitoring_service."""

from unittest.mock import MagicMock

import pytest

from app.services import alert_monitoring_service
from app.services.alert_monitoring_service import (
    MAX_EMAILS_PER_ALERT_PER_CYCLE,
    build_summary_email_payload,
    dispatch_alert_emails_with_cap,
)


def _make_payloads(n: int) -> list[dict]:
    return [
        {"title": f"Titulo {i}", "message": f"Mensaje {i}"} for i in range(n)
    ]


@pytest.mark.unit
def test_cap_constant_is_five():
    """El cap solicitado por producto es exactamente 5 correos por ciclo."""
    assert MAX_EMAILS_PER_ALERT_PER_CYCLE == 5


@pytest.mark.unit
def test_dispatch_sends_one_email_per_payload_when_below_cap():
    sender = MagicMock()
    payloads = _make_payloads(3)

    sent = dispatch_alert_emails_with_cap(
        to_email="user@test.com",
        alert_name="Alerta IA",
        payloads=payloads,
        sender=sender,
    )

    assert sent == 3
    assert sender.call_count == 3
    for i, call in enumerate(sender.call_args_list):
        assert call.kwargs["title"] == f"Titulo {i}"
        assert call.kwargs["message"] == f"Mensaje {i}"
        assert call.kwargs["to_email"] == "user@test.com"
        assert call.kwargs["alert_name"] == "Alerta IA"


@pytest.mark.unit
def test_dispatch_sends_individual_emails_at_exactly_cap():
    """Justo en el límite (5) aún se envían correos individuales."""
    sender = MagicMock()
    payloads = _make_payloads(MAX_EMAILS_PER_ALERT_PER_CYCLE)

    sent = dispatch_alert_emails_with_cap(
        to_email="user@test.com",
        alert_name="Alerta",
        payloads=payloads,
        sender=sender,
    )

    assert sent == MAX_EMAILS_PER_ALERT_PER_CYCLE
    assert sender.call_count == MAX_EMAILS_PER_ALERT_PER_CYCLE


@pytest.mark.unit
def test_dispatch_sends_single_summary_when_over_cap():
    """Con 6 noticias debe enviarse UN único correo de resumen."""
    sender = MagicMock()
    payloads = _make_payloads(MAX_EMAILS_PER_ALERT_PER_CYCLE + 1)

    sent = dispatch_alert_emails_with_cap(
        to_email="user@test.com",
        alert_name="Alerta IA",
        payloads=payloads,
        sender=sender,
    )

    assert sent == 1
    sender.assert_called_once()
    call = sender.call_args
    assert call.kwargs["alert_name"] == "Alerta IA"
    assert "Resumen" in call.kwargs["title"]
    assert "6 noticias" in call.kwargs["message"]
    assert "Alerta IA" in call.kwargs["message"]
    assert "buzón interno" in call.kwargs["message"]


@pytest.mark.unit
def test_dispatch_huge_batch_sends_only_one_summary():
    """Caso real reportado: 3000 noticias → 1 correo, no 3000."""
    sender = MagicMock()
    payloads = _make_payloads(3000)

    sent = dispatch_alert_emails_with_cap(
        to_email="user@test.com",
        alert_name="Alerta Masiva",
        payloads=payloads,
        sender=sender,
    )

    assert sent == 1
    sender.assert_called_once()
    assert "3000 noticias" in sender.call_args.kwargs["message"]


@pytest.mark.unit
def test_dispatch_returns_zero_with_empty_payloads():
    sender = MagicMock()

    sent = dispatch_alert_emails_with_cap(
        to_email="user@test.com",
        alert_name="A",
        payloads=[],
        sender=sender,
    )

    assert sent == 0
    sender.assert_not_called()


@pytest.mark.unit
def test_dispatch_returns_zero_when_email_missing():
    """Sin destinatario no se envía nada (ni siquiera resumen)."""
    sender = MagicMock()

    sent = dispatch_alert_emails_with_cap(
        to_email="",
        alert_name="A",
        payloads=_make_payloads(10),
        sender=sender,
    )

    assert sent == 0
    sender.assert_not_called()


@pytest.mark.unit
def test_build_summary_email_payload_uses_alert_name_and_total():
    payload = build_summary_email_payload("Alerta IA", 42)

    assert "Alerta IA" in payload["title"]
    assert "42" in payload["message"]
    assert "Alerta IA" in payload["message"]
    assert "buzón interno" in payload["message"]


@pytest.mark.unit
def test_build_summary_email_payload_exact_message_format():
    """El mensaje debe seguir el copy exacto solicitado por producto."""
    payload = build_summary_email_payload("Mi Alerta", 7)

    expected_message = (
        "Se han detectado 7 noticias nuevas para tu alerta Mi Alerta. "
        "Puedes ver el detalle completo en el buzón interno de la aplicación."
    )
    assert payload["message"] == expected_message


@pytest.mark.unit
def test_dispatch_default_sender_is_send_alert_notification_email():
    """El sender por defecto debe ser la función real de envío de emails."""
    import inspect

    sig = inspect.signature(dispatch_alert_emails_with_cap)
    default_sender = sig.parameters["sender"].default
    assert default_sender is alert_monitoring_service.send_alert_notification_email


@pytest.mark.unit
def test_dispatch_boundary_values():
    """Verifica el comportamiento exacto en los bordes del cap."""
    cases = [
        (0, 0),  # vacío
        (1, 1),
        (MAX_EMAILS_PER_ALERT_PER_CYCLE, MAX_EMAILS_PER_ALERT_PER_CYCLE),
        (MAX_EMAILS_PER_ALERT_PER_CYCLE + 1, 1),  # primer salto a resumen
        (100, 1),
    ]
    for n_payloads, expected_sent in cases:
        sender = MagicMock()
        sent = dispatch_alert_emails_with_cap(
            to_email="user@test.com",
            alert_name="A",
            payloads=_make_payloads(n_payloads),
            sender=sender,
        )
        assert sent == expected_sent, f"Falló en n={n_payloads}"
        assert sender.call_count == expected_sent
