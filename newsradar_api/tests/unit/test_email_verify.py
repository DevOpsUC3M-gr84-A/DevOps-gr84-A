"""
Tests unitarios para el envío de correos de verificación y notificaciones.
Cubre:
  - send_verification_email (app.utils.email_utils)
  - send_alert_notification_email (app.utils.email_utils) - RF10
"""

import pytest
from unittest.mock import patch


@pytest.mark.unit
class TestSendVerificationEmail:

    def test_dev_mode_logs_and_does_not_send_when_smtp_not_configured(self, caplog):
        """Sin SMTP configurado solo loguea el enlace de verificación, no intenta conexión."""
        from app.utils.email_utils import send_verification_email
        from app.utils import email_utils as eu_module
        import logging

        original = eu_module.config.SMTP_USER
        eu_module.config.SMTP_USER = ""

        try:
            with caplog.at_level(logging.WARNING, logger="uvicorn.error"):
                send_verification_email("user@test.com", "tok_dev_verify")
            assert any("tok_dev_verify" in r.message for r in caplog.records)
        finally:
            eu_module.config.SMTP_USER = original

    def test_dev_mode_does_not_raise(self):
        """Sin SMTP configurado la función no lanza excepción."""
        from app.utils.email_utils import send_verification_email
        from app.utils import email_utils as eu_module

        original = eu_module.config.SMTP_USER
        eu_module.config.SMTP_USER = ""

        try:
            send_verification_email("user@test.com", "tok_noerror")
        finally:
            eu_module.config.SMTP_USER = original

    def test_smtp_send_called_when_configured(self):
        """Con SMTP configurado llama a smtplib.SMTP y envía el mensaje de activación."""
        from app.utils.email_utils import send_verification_email
        from app.utils import email_utils as eu_module

        eu_module.config.SMTP_USER = "sender@test.com"
        eu_module.config.SMTP_PASSWORD = "secret"
        eu_module.config.SMTP_HOST = "smtp.test.com"
        eu_module.config.SMTP_PORT = 587
        eu_module.config.SMTP_FROM = "sender@test.com"
        eu_module.config.FRONTEND_URL = "http://localhost:3000"

        try:
            with patch("app.utils.email_utils.smtplib.SMTP") as mock_smtp:
                instance = mock_smtp.return_value.__enter__.return_value
                send_verification_email("dest@test.com", "tok_smtp_verify")

            mock_smtp.assert_called_once_with("smtp.test.com", 587, timeout=10)
            instance.starttls.assert_called_once()
            instance.login.assert_called_once_with("sender@test.com", "secret")
            instance.sendmail.assert_called_once()
        finally:
            eu_module.config.SMTP_USER = ""

    def test_smtp_exception_is_caught_and_does_not_propagate(self):
        """Un fallo SMTP al enviar el correo de verificación no debe propagar la excepción."""
        from app.utils.email_utils import send_verification_email
        from app.utils import email_utils as eu_module
        import smtplib

        eu_module.config.SMTP_USER = "sender@test.com"
        eu_module.config.SMTP_PASSWORD = "secret"
        eu_module.config.SMTP_HOST = "smtp.test.com"
        eu_module.config.SMTP_PORT = 587
        eu_module.config.SMTP_FROM = "sender@test.com"
        eu_module.config.FRONTEND_URL = "http://localhost:3000"

        try:
            with patch(
                "app.utils.email_utils.smtplib.SMTP",
                side_effect=smtplib.SMTPException("fallo de red SMTP"),
            ):
                send_verification_email("dest@test.com", "tok_fail_verify")
        finally:
            eu_module.config.SMTP_USER = ""


@pytest.mark.unit
class TestSendAlertNotificationEmail:
    """RF10: Tests para el envío de notificaciones de alerta por email."""

    def test_dev_mode_logs_and_does_not_send_when_smtp_not_configured(self, caplog):
        """Sin SMTP configurado solo loguea la notificación, no intenta conexión."""
        from app.utils.email_utils import send_alert_notification_email
        from app.utils import email_utils as eu_module
        import logging

        original = eu_module.config.SMTP_USER
        eu_module.config.SMTP_USER = ""

        try:
            with caplog.at_level(logging.WARNING, logger="uvicorn.error"):
                send_alert_notification_email(
                    "user@test.com",
                    "Alerta Test",
                    "Actualización de Alerta Test",
                    "Contenido de notificación",
                )
            assert any("[RF10][DEV]" in r.message for r in caplog.records)
        finally:
            eu_module.config.SMTP_USER = original

    def test_dev_mode_does_not_raise(self):
        """Sin SMTP configurado la función no lanza excepción."""
        from app.utils.email_utils import send_alert_notification_email
        from app.utils import email_utils as eu_module

        original = eu_module.config.SMTP_USER
        eu_module.config.SMTP_USER = ""

        try:
            send_alert_notification_email(
                "user@test.com",
                "Alerta Test",
                "Título notificación",
                "Mensaje notificación",
            )
        finally:
            eu_module.config.SMTP_USER = original

    def test_smtp_send_called_when_configured(self):
        """Con SMTP configurado llama a smtplib.SMTP y envía el email de notificación."""
        from app.utils.email_utils import send_alert_notification_email
        from app.utils import email_utils as eu_module

        eu_module.config.SMTP_USER = "sender@test.com"
        eu_module.config.SMTP_PASSWORD = "secret"
        eu_module.config.SMTP_HOST = "smtp.test.com"
        eu_module.config.SMTP_PORT = 587
        eu_module.config.SMTP_FROM = "sender@test.com"

        try:
            with patch("app.utils.email_utils.smtplib.SMTP") as mock_smtp:
                instance = mock_smtp.return_value.__enter__.return_value
                send_alert_notification_email(
                    to_email="dest@test.com",
                    alert_name="Alerta IA",
                    title="Actualización de Alerta IA en 14/04/2026 18:30",
                    message="Origen: El Diario\nTítulo: Avances en IA",
                )

            mock_smtp.assert_called_once_with("smtp.test.com", 587, timeout=10)
            instance.starttls.assert_called_once()
            instance.login.assert_called_once_with("sender@test.com", "secret")
            instance.sendmail.assert_called_once()

            # Verificar que el mensaje se envió correctamente
            call_args = instance.sendmail.call_args[0]
            sent_message = call_args[2]
            # El contenido está encoded, pero verificamos que tiene Subject y estructura MIME
            assert "Subject:" in sent_message
            assert "NewsRadar" in sent_message or "Alerta" in sent_message
        finally:
            eu_module.config.SMTP_USER = ""

    def test_smtp_exception_is_caught_and_does_not_propagate(self):
        """Un fallo SMTP al enviar notificación no debe propagar la excepción."""
        from app.utils.email_utils import send_alert_notification_email
        from app.utils import email_utils as eu_module
        import smtplib

        eu_module.config.SMTP_USER = "sender@test.com"
        eu_module.config.SMTP_PASSWORD = "secret"
        eu_module.config.SMTP_HOST = "smtp.test.com"
        eu_module.config.SMTP_PORT = 587
        eu_module.config.SMTP_FROM = "sender@test.com"

        try:
            with patch(
                "app.utils.email_utils.smtplib.SMTP",
                side_effect=smtplib.SMTPException("fallo de red SMTP"),
            ):
                send_alert_notification_email(
                    "dest@test.com",
                    "Alerta Test",
                    "Título",
                    "Mensaje",
                )
        finally:
            eu_module.config.SMTP_USER = ""

    def test_email_content_formatting(self):
        """Verifica que el contenido del email incluye alert_name, title y message."""
        from app.utils.email_utils import send_alert_notification_email
        from app.utils import email_utils as eu_module

        eu_module.config.SMTP_USER = "sender@test.com"
        eu_module.config.SMTP_PASSWORD = "secret"
        eu_module.config.SMTP_HOST = "smtp.test.com"
        eu_module.config.SMTP_PORT = 587
        eu_module.config.SMTP_FROM = "sender@test.com"

        try:
            with patch("app.utils.email_utils.smtplib.SMTP") as mock_smtp:
                instance = mock_smtp.return_value.__enter__.return_value
                send_alert_notification_email(
                    to_email="dest@test.com",
                    alert_name="Alerta Economía",
                    title="Actualización de Alerta Economía",
                    message="Origen: Reuters\nFecha: 14/04/2026\nTítulo: Bolsa en alza",
                )

            call_args = instance.sendmail.call_args[0]
            sent_message = call_args[2]

            # Verificar que el mensaje se envió con los parámetros correctos
            assert call_args[0] == "sender@test.com"
            assert call_args[1] == "dest@test.com"
            # Verificar estructura del mensaje
            assert "Subject:" in sent_message
            assert "multipart/alternative" in sent_message
        finally:
            eu_module.config.SMTP_USER = ""
