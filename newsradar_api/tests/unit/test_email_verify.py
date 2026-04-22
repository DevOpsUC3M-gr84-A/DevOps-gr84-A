"""
Tests unitarios para el envío de correos de verificación.
Cubre:
  - send_verification_email (app.utils.email_utils)
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
        eu_module.config.FRONTEND_URL = "http://localhost:5173"

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
        eu_module.config.FRONTEND_URL = "http://localhost:5173"

        try:
            with patch(
                "app.utils.email_utils.smtplib.SMTP",
                side_effect=smtplib.SMTPException("fallo de red SMTP"),
            ):
                send_verification_email("dest@test.com", "tok_fail_verify")
        finally:
            eu_module.config.SMTP_USER = ""
