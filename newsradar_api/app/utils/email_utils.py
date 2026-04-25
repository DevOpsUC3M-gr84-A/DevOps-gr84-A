"""Utilidad para el envío de correos electrónicos via SMTP (stdlib, sin deps extra)."""

import logging
import smtplib
from email.mime.multipart import MIMEMultipart
from email.mime.text import MIMEText

from app import config

logger = logging.getLogger("uvicorn.error")


def send_reset_password_email(to_email: str, reset_token: str) -> None:
    """
    Envía el correo de recuperación de contraseña con el enlace de reset.

    El enlace apunta a FRONTEND_URL/reset-password?token=<TOKEN>.
    Si SMTP_USER está vacío (entorno de test/dev), solo loguea el enlace
    sin intentar la conexión SMTP real.
    """
    reset_link = f"{config.FRONTEND_URL}/reset-password?token={reset_token}"

    # Modo desarrollo: sin SMTP configurado
    if not config.SMTP_USER:
        logger.warning(
            "[RF18][DEV] SMTP no configurado. Enlace de reset generado: %s",
            reset_link,
        )
        return

    # Construcción del mensaje
    msg = MIMEMultipart("alternative")
    msg["Subject"] = "NewsRadar – Recuperación de contraseña"
    msg["From"] = config.SMTP_FROM
    msg["To"] = to_email

    text_body = (
        f"Has solicitado recuperar tu contraseña en NewsRadar.\n\n"
        f"Accede al siguiente enlace para establecer una nueva contraseña "
        f"(válido durante {config.RESET_TOKEN_EXPIRE_HOURS} hora/s):\n\n"
        f"{reset_link}\n\n"
        f"Si no has solicitado este cambio, ignora este correo."
    )

    html_body = f"""
    <html>
      <body style="font-family: Arial, sans-serif; color: #28251d; max-width: 520px; margin: auto;">
        <h2 style="color: #3b82f6;">NewsRadar – Recuperación de contraseña</h2>
        <p>Has solicitado recuperar tu contraseña.</p>
        <p>Haz clic en el botón para establecer una nueva contraseña.
           El enlace es válido durante <strong>{config.RESET_TOKEN_EXPIRE_HOURS} hora(s)</strong>.</p>
        <p style="text-align:center; margin: 32px 0;">
          <a href="{reset_link}"
             style="background:#3b82f6;color:#fff;padding:12px 28px;
                    border-radius:6px;text-decoration:none;font-weight:bold;">
            Restablecer contraseña
          </a>
        </p>
        <p style="color:#7a7974; font-size:13px;">
          Si no has solicitado este cambio, ignora este correo.<br>
          El enlace expirará automáticamente.
        </p>
      </body>
    </html>
    """

    msg.attach(MIMEText(text_body, "plain"))
    msg.attach(MIMEText(html_body, "html"))

    # Envío con STARTTLS
    try:
        with smtplib.SMTP(config.SMTP_HOST, config.SMTP_PORT, timeout=10) as server:
            server.ehlo()
            server.starttls()
            server.login(config.SMTP_USER, config.SMTP_PASSWORD)
            server.sendmail(config.SMTP_FROM, to_email, msg.as_string())
        logger.info("[RF18] Email de reset enviado a %s", to_email)
    except smtplib.SMTPException as exc:
        # No propagamos el error: el usuario no debe saber si el email existe
        logger.error("[RF18] Fallo al enviar email de reset a %s: %s", to_email, exc)


def send_verification_email(to_email: str, verification_token: str) -> None:
    """
    Envía el correo de bienvenida y verificación de cuenta.
    El enlace apunta a FRONTEND_URL/verify-email?token=<TOKEN>.
    """
    verification_link = f"{config.FRONTEND_URL}/verify-email?token={verification_token}"

    # Modo desarrollo: sin SMTP configurado
    if not config.SMTP_USER:
        logger.warning(
            "[Verificación][DEV] SMTP no configurado. Enlace de activación generado: %s",
            verification_link,
        )
        return

    # Construcción del mensaje
    msg = MIMEMultipart("alternative")
    msg["Subject"] = "NewsRadar – Activa tu cuenta"
    msg["From"] = config.SMTP_FROM
    msg["To"] = to_email

    text_body = (
        f"¡Bienvenido a NewsRadar!\n\n"
        f"Por favor, verifica tu cuenta haciendo clic en el siguiente enlace "
        f"(válido durante 24 horas):\n\n"
        f"{verification_link}\n\n"
        f"Si no te has registrado en nuestra plataforma, ignora este correo."
    )

    html_body = f"""
    <html>
      <body style="font-family: Arial, sans-serif; color: #28251d; max-width: 520px; margin: auto;">
        <h2 style="color: #3b82f6;">¡Bienvenido a NewsRadar!</h2>
        <p>Gracias por registrarte. Para poder acceder a tu cuenta, necesitamos verificar tu dirección de correo electrónico.</p>
        <p>Haz clic en el botón inferior para activar tu cuenta. El enlace es válido durante <strong>24 horas</strong>.</p>
        <p style="text-align:center; margin: 32px 0;">
          <a href="{verification_link}"
             style="background:#3b82f6;color:#fff;padding:12px 28px;
                    border-radius:6px;text-decoration:none;font-weight:bold;">
            Verificar mi cuenta
          </a>
        </p>
        <p style="color:#7a7974; font-size:13px;">
          Si no te has registrado, ignora este correo.
        </p>
      </body>
    </html>
    """

    msg.attach(MIMEText(text_body, "plain"))
    msg.attach(MIMEText(html_body, "html"))

    # Envío con STARTTLS
    try:
        with smtplib.SMTP(config.SMTP_HOST, config.SMTP_PORT, timeout=10) as server:
            server.ehlo()
            server.starttls()
            server.login(config.SMTP_USER, config.SMTP_PASSWORD)
            server.sendmail(config.SMTP_FROM, to_email, msg.as_string())
        logger.info("[Verificación] Email de activación enviado a %s", to_email)
    except smtplib.SMTPException as exc:
        logger.error("[Verificación] Fallo al enviar email a %s: %s", to_email, exc)
