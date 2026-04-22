"""
Tests unitarios para Recuperación de contraseña.

Cubre:
  - generate_reset_token  (user_service)
  - reset_password_with_token (user_service)
  - POST /auth/forgot-password (auth route)
  - POST /auth/reset-password (auth route)

Ejecutar con:
    pytest tests/unit/test_recup_contr.py -v
"""

from datetime import datetime, timedelta, timezone
from unittest.mock import MagicMock, patch

import pytest


# Helper


def _make_user(
    *,
    email="test@example.com",
    reset_token=None,
    token_expires=None,
    hashed_password="hashed_old",
):
    user = MagicMock()
    user.email = email
    user.reset_password_token = reset_token
    user.reset_password_token_expires = token_expires
    user.hashed_password = hashed_password
    return user


def _get_client():
    """Crea un TestClient mínimo que sólo registra el router de autenticación."""
    from fastapi import FastAPI
    from fastapi.testclient import TestClient
    from app.api.routes.auth import api_auth_router

    app = FastAPI()
    app.include_router(api_auth_router)
    return TestClient(app)


# generate_reset_token


@pytest.mark.unit
class TestGenerateResetToken:

    def test_returns_none_when_user_not_found(self):
        from app.services.user_service import generate_reset_token

        db = MagicMock()
        db.query.return_value.filter.return_value.first.return_value = None

        result = generate_reset_token(db, "noexiste@example.com")

        assert result is None
        db.commit.assert_not_called()

    def test_returns_token_and_persists_when_user_exists(self):
        from app.services.user_service import generate_reset_token

        user = _make_user()
        db = MagicMock()
        db.query.return_value.filter.return_value.first.return_value = user

        token = generate_reset_token(db, user.email)

        assert token is not None
        assert len(token) > 20  # token_urlsafe(32) -> ~43 chars
        assert user.reset_password_token == token
        assert user.reset_password_token_expires is not None
        db.commit.assert_called_once()

    def test_token_expiration_is_within_configured_hours(self):
        from app.services.user_service import generate_reset_token
        from app import config

        user = _make_user()
        db = MagicMock()
        db.query.return_value.filter.return_value.first.return_value = user

        before = datetime.now(timezone.utc)
        generate_reset_token(db, user.email)
        after = datetime.now(timezone.utc)

        expected_delta = timedelta(hours=config.RESET_TOKEN_EXPIRE_HOURS)
        assert (
            before + expected_delta
            <= user.reset_password_token_expires
            <= after + expected_delta
        )

    def test_token_is_urlsafe_string(self):
        """El token generado no debe contener caracteres problemáticos para URLs."""
        import re
        from app.services.user_service import generate_reset_token

        user = _make_user()
        db = MagicMock()
        db.query.return_value.filter.return_value.first.return_value = user

        token = generate_reset_token(db, user.email)

        assert isinstance(token, str)
        assert re.match(r"^[A-Za-z0-9\-_]+$", token)


# reset_password_with_token


@pytest.mark.unit
class TestResetPasswordWithToken:

    def test_returns_false_when_token_not_found(self):
        from app.services.user_service import reset_password_with_token

        db = MagicMock()
        db.query.return_value.filter.return_value.first.return_value = None

        ok, msg = reset_password_with_token(db, "token_falso", "nueva1234")

        assert ok is False
        assert "inválido" in msg.lower() or "utilizado" in msg.lower()

    def test_returns_false_when_token_expired(self):
        from app.services.user_service import reset_password_with_token

        expired = datetime.now(timezone.utc) - timedelta(minutes=1)
        user = _make_user(reset_token="tok_exp", token_expires=expired)

        db = MagicMock()
        db.query.return_value.filter.return_value.first.return_value = user

        ok, msg = reset_password_with_token(db, "tok_exp", "nueva1234")

        assert ok is False
        assert "expirado" in msg.lower()
        assert user.reset_password_token is None
        assert user.reset_password_token_expires is None

    def test_returns_true_and_updates_password_with_valid_token(self):
        from app.services.user_service import reset_password_with_token

        future = datetime.now(timezone.utc) + timedelta(hours=1)
        user = _make_user(reset_token="tok_valido", token_expires=future)

        db = MagicMock()
        db.query.return_value.filter.return_value.first.return_value = user

        ok, msg = reset_password_with_token(db, "tok_valido", "nueva_segura")

        assert ok is True
        assert user.hashed_password != "hashed_old"
        assert user.reset_password_token is None
        assert user.reset_password_token_expires is None
        db.commit.assert_called_once()

    def test_token_invalidated_after_successful_reset(self):
        """El mismo token no puede usarse dos veces."""
        from app.services.user_service import reset_password_with_token

        future = datetime.now(timezone.utc) + timedelta(hours=1)
        user = _make_user(reset_token="tok_unico", token_expires=future)

        db = MagicMock()
        db.query.return_value.filter.return_value.first.side_effect = [user, None]

        reset_password_with_token(db, "tok_unico", "pass1")
        ok2, _ = reset_password_with_token(db, "tok_unico", "pass2")

        assert ok2 is False

    def test_handles_naive_datetime_from_db(self):
        """Cubre el caso de BD que devuelve datetime sin tzinfo (SQLite)."""
        from app.services.user_service import reset_password_with_token

        # datetime naive intencionado: simula lo que devuelve SQLite
        naive_future = datetime.now() + timedelta(hours=1)
        user = _make_user(reset_token="tok_naive", token_expires=naive_future)

        db = MagicMock()
        db.query.return_value.filter.return_value.first.return_value = user

        ok, _ = reset_password_with_token(db, "tok_naive", "pass_nueva")

        assert ok is True

    def test_returns_false_when_expires_is_none(self):
        """Si el campo expires es None en BD, el token se considera expirado."""
        from app.services.user_service import reset_password_with_token

        user = _make_user(reset_token="tok_sin_exp", token_expires=None)

        db = MagicMock()
        db.query.return_value.filter.return_value.first.return_value = user

        ok, msg = reset_password_with_token(db, "tok_sin_exp", "pass1234")

        assert ok is False
        assert "expirado" in msg.lower()


# POST /auth/forgot-password


@pytest.mark.unit
class TestForgotPasswordEndpoint:

    def test_always_returns_202_even_for_unknown_email(self):
        client = _get_client()

        with patch(
            "app.api.routes.auth.generate_reset_token", return_value=None
        ), patch("app.api.routes.auth.send_reset_password_email") as mock_send:

            resp = client.post("/auth/forgot-password", json={"email": "no@existe.com"})

        assert resp.status_code == 202
        mock_send.assert_not_called()

    def test_sends_email_when_user_exists(self):
        client = _get_client()

        with patch(
            "app.api.routes.auth.generate_reset_token", return_value="tok123"
        ), patch("app.api.routes.auth.send_reset_password_email") as mock_send:

            resp = client.post(
                "/auth/forgot-password", json={"email": "user@existe.com"}
            )

        assert resp.status_code == 202
        mock_send.assert_called_once_with(
            to_email="user@existe.com", reset_token="tok123"
        )

    def test_response_body_contains_message(self):
        """La respuesta siempre incluye el campo message independientemente del email."""
        client = _get_client()

        with patch(
            "app.api.routes.auth.generate_reset_token", return_value=None
        ), patch("app.api.routes.auth.send_reset_password_email"):

            resp = client.post("/auth/forgot-password", json={"email": "x@test.com"})

        assert "message" in resp.json()
        assert len(resp.json()["message"]) > 0

    def test_rejects_invalid_email_format(self):
        """Un email malformado debe devolver 422 (validacion Pydantic)."""
        client = _get_client()

        resp = client.post("/auth/forgot-password", json={"email": "no-es-un-email"})

        assert resp.status_code == 422

    def test_rejects_missing_email_field(self):
        """Sin campo email debe devolver 422."""
        client = _get_client()

        resp = client.post("/auth/forgot-password", json={})

        assert resp.status_code == 422


# POST /auth/reset-password


@pytest.mark.unit
class TestResetPasswordEndpoint:

    def test_returns_400_on_invalid_token(self):
        client = _get_client()

        with patch(
            "app.api.routes.auth.reset_password_with_token",
            return_value=(False, "Token invalido o ya utilizado."),
        ):
            resp = client.post(
                "/auth/reset-password",
                json={"token": "malo", "new_password": "pass1234"},
            )

        assert resp.status_code == 400

    def test_returns_400_on_expired_token(self):
        client = _get_client()

        with patch(
            "app.api.routes.auth.reset_password_with_token",
            return_value=(
                False,
                "El enlace de recuperacion ha expirado. Solicita uno nuevo.",
            ),
        ):
            resp = client.post(
                "/auth/reset-password",
                json={"token": "tok_exp", "new_password": "pass1234"},
            )

        assert resp.status_code == 400
        assert "expirado" in resp.json()["detail"].lower()

    def test_returns_200_on_valid_token(self):
        client = _get_client()

        with patch(
            "app.api.routes.auth.reset_password_with_token",
            return_value=(True, "Contrasena actualizada correctamente."),
        ):
            resp = client.post(
                "/auth/reset-password",
                json={"token": "tok_valido", "new_password": "nuevapass"},
            )

        assert resp.status_code == 200
        assert resp.json()["message"] == "Contrasena actualizada correctamente."

    def test_rejects_short_password(self):
        """new_password con menos de 6 chars debe fallar en validacion Pydantic (422)."""
        client = _get_client()

        resp = client.post(
            "/auth/reset-password",
            json={"token": "tok", "new_password": "abc"},
        )

        assert resp.status_code == 422

    def test_rejects_missing_token(self):
        """Sin campo token debe devolver 422."""
        client = _get_client()

        resp = client.post(
            "/auth/reset-password",
            json={"new_password": "pass1234"},
        )

        assert resp.status_code == 422

    def test_rejects_missing_new_password(self):
        """Sin campo new_password debe devolver 422."""
        client = _get_client()

        resp = client.post(
            "/auth/reset-password",
            json={"token": "tok123"},
        )

        assert resp.status_code == 422

    def test_rejects_password_exceeding_max_length(self):
        """Una contrasena de mas de 128 caracteres debe devolver 422."""
        client = _get_client()

        resp = client.post(
            "/auth/reset-password",
            json={"token": "tok123", "new_password": "a" * 129},
        )

        assert resp.status_code == 422

    # ── send_reset_password_email ─────────────────────────────────────────────────


@pytest.mark.unit
class TestSendResetPasswordEmail:

    def test_dev_mode_logs_and_does_not_send_when_smtp_not_configured(self, caplog):
        """Sin SMTP configurado solo loguea el enlace, no intenta conexion."""
        from app.utils.email_utils import send_reset_password_email
        from app.utils import email_utils as eu_module
        import logging

        original = eu_module.config.SMTP_USER
        eu_module.config.SMTP_USER = ""

        try:
            with caplog.at_level(logging.WARNING, logger="uvicorn.error"):
                send_reset_password_email("user@test.com", "tok_dev")
            assert any("tok_dev" in r.message for r in caplog.records)
        finally:
            eu_module.config.SMTP_USER = original

    def test_dev_mode_does_not_raise(self):
        """Sin SMTP configurado la funcion no lanza excepcion."""
        from app.utils.email_utils import send_reset_password_email
        from app.utils import email_utils as eu_module

        original = eu_module.config.SMTP_USER
        eu_module.config.SMTP_USER = ""

        try:
            send_reset_password_email("user@test.com", "tok_noerror")
        finally:
            eu_module.config.SMTP_USER = original

    def test_smtp_send_called_when_configured(self):
        """Con SMTP configurado llama a smtplib.SMTP y envia el mensaje."""
        from app.utils.email_utils import send_reset_password_email
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
                send_reset_password_email("dest@test.com", "tok_smtp")

            mock_smtp.assert_called_once_with("smtp.test.com", 587, timeout=10)
            instance.starttls.assert_called_once()
            instance.login.assert_called_once_with("sender@test.com", "secret")
            instance.sendmail.assert_called_once()
        finally:
            eu_module.config.SMTP_USER = ""

    def test_smtp_exception_is_caught_and_does_not_propagate(self):
        """Un fallo SMTP no debe propagar la excepcion al caller."""
        from app.utils.email_utils import send_reset_password_email
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
                side_effect=smtplib.SMTPException("fallo de red"),
            ):
                send_reset_password_email("dest@test.com", "tok_fail")
            # Si llegamos aqui, la excepcion fue capturada correctamente
        finally:
            eu_module.config.SMTP_USER = ""

    def test_reset_link_contains_token_and_frontend_url(self):
        """El enlace generado incluye el token y la FRONTEND_URL correctamente."""
        import base64
        from app.utils.email_utils import send_reset_password_email
        from app.utils import email_utils as eu_module

        eu_module.config.SMTP_USER = "sender@test.com"
        eu_module.config.SMTP_PASSWORD = "secret"
        eu_module.config.SMTP_HOST = "smtp.test.com"
        eu_module.config.SMTP_PORT = 587
        eu_module.config.SMTP_FROM = "sender@test.com"
        eu_module.config.FRONTEND_URL = "http://mifrontend.com"

        try:
            with patch("app.utils.email_utils.smtplib.SMTP") as mock_smtp:
                instance = mock_smtp.return_value.__enter__.return_value
                send_reset_password_email("dest@test.com", "tok_url_check")

            raw_email = instance.sendmail.call_args[0][2]

            # Decodificar solo los bloques base64 validos (longitud multiplo de 4)
            decoded_parts = []
            for part in raw_email.split("\n"):
                part = part.strip()
                if len(part) >= 20 and len(part) % 4 == 0:
                    try:
                        decoded_parts.append(
                            base64.b64decode(part).decode("utf-8", errors="ignore")
                        )
                    except Exception:
                        pass

            decoded = " ".join(decoded_parts)
            assert (
                "http://mifrontend.com/reset-password?token=tok_url_check"
                in decoded.replace(" ", "")
            )
        finally:
            eu_module.config.SMTP_USER = ""
