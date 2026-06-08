"""
Email service for AutoStudio AI.

Sends transactional emails (password reset, welcome, etc.) via SMTP.
Configuration via environment variables:
  SMTP_HOST        - SMTP server hostname (e.g. smtp.sendgrid.net, smtp.postmarkapp.com)
  SMTP_PORT        - SMTP port (default 587 for TLS, 465 for SSL)
  SMTP_USER        - SMTP username / API key username
  SMTP_PASSWORD    - SMTP password / API key
  SMTP_FROM_EMAIL  - From address (e.g. noreply@autostudio.cc)
  SMTP_FROM_NAME   - From display name (default: AutoStudio AI)
  APP_URL          - Base URL for links (e.g. https://autostudio.cc)
"""
import logging
import os
import smtplib
import ssl
from email.mime.multipart import MIMEMultipart
from email.mime.text import MIMEText
from typing import Optional

logger = logging.getLogger(__name__)

_SMTP_HOST = os.getenv("SMTP_HOST", "")
_SMTP_PORT = int(os.getenv("SMTP_PORT", "587"))
_SMTP_USER = os.getenv("SMTP_USER", "")
_SMTP_PASSWORD = os.getenv("SMTP_PASSWORD", "")
_FROM_EMAIL = os.getenv("SMTP_FROM_EMAIL", "noreply@autostudio.cc")
_FROM_NAME = os.getenv("SMTP_FROM_NAME", "AutoStudio AI")
_APP_URL = os.getenv("APP_URL", "https://autostudio.cc")


def _is_configured() -> bool:
    return bool(_SMTP_HOST and _SMTP_USER and _SMTP_PASSWORD)


def _send(to_email: str, subject: str, html_body: str, text_body: str) -> bool:
    """Send a single email. Returns True on success, False on failure."""
    if not _is_configured():
        logger.warning(
            "Email not sent (SMTP not configured): to=%s subject=%s — "
            "Set SMTP_HOST, SMTP_USER, SMTP_PASSWORD to enable email delivery.",
            to_email, subject,
        )
        return False

    msg = MIMEMultipart("alternative")
    msg["Subject"] = subject
    msg["From"] = f"{_FROM_NAME} <{_FROM_EMAIL}>"
    msg["To"] = to_email
    msg.attach(MIMEText(text_body, "plain", "utf-8"))
    msg.attach(MIMEText(html_body, "html", "utf-8"))

    try:
        context = ssl.create_default_context()
        if _SMTP_PORT == 465:
            with smtplib.SMTP_SSL(_SMTP_HOST, _SMTP_PORT, context=context) as server:
                server.login(_SMTP_USER, _SMTP_PASSWORD)
                server.sendmail(_FROM_EMAIL, to_email, msg.as_string())
        else:
            with smtplib.SMTP(_SMTP_HOST, _SMTP_PORT) as server:
                server.ehlo()
                server.starttls(context=context)
                server.login(_SMTP_USER, _SMTP_PASSWORD)
                server.sendmail(_FROM_EMAIL, to_email, msg.as_string())
        logger.info("Email sent: to=%s subject=%s", to_email, subject)
        return True
    except Exception:
        logger.exception("Failed to send email to %s (subject: %s)", to_email, subject)
        return False


def send_password_reset(to_email: str, reset_token: str, locale: str = "en") -> bool:
    """Send a password reset link email."""
    reset_url = f"{_APP_URL}/{locale}/auth/reset-password?token={reset_token}"

    if locale == "sv":
        subject = "Återställ ditt lösenord – AutoStudio AI"
        html_body = f"""
<!DOCTYPE html>
<html lang="sv">
<head><meta charset="utf-8"><title>{subject}</title></head>
<body style="font-family:sans-serif;max-width:600px;margin:40px auto;color:#1c1917">
  <h2 style="color:#ef4444">AutoStudio AI</h2>
  <p>Vi har tagit emot en begäran om att återställa lösenordet för ditt konto.</p>
  <p>Klicka på knappen nedan för att välja ett nytt lösenord. Länken är giltig i <strong>1 timme</strong>.</p>
  <p style="text-align:center;margin:32px 0">
    <a href="{reset_url}"
       style="background:#ef4444;color:#fff;text-decoration:none;padding:14px 28px;border-radius:8px;font-weight:600;display:inline-block">
      Återställ lösenord
    </a>
  </p>
  <p style="color:#78716c;font-size:14px">
    Om du inte begärde detta kan du ignorera detta e-postmeddelande — ditt lösenord förblir oförändrat.
  </p>
  <p style="color:#a8a29e;font-size:12px">AutoStudio AI &middot; autostudio.cc</p>
</body>
</html>"""
        text_body = (
            f"Återställ ditt lösenord för AutoStudio AI.\n\n"
            f"Klicka här (giltig i 1 timme):\n{reset_url}\n\n"
            f"Om du inte begärde detta, ignorera detta e-postmeddelande."
        )
    else:
        subject = "Reset your password – AutoStudio AI"
        html_body = f"""
<!DOCTYPE html>
<html lang="en">
<head><meta charset="utf-8"><title>{subject}</title></head>
<body style="font-family:sans-serif;max-width:600px;margin:40px auto;color:#1c1917">
  <h2 style="color:#ef4444">AutoStudio AI</h2>
  <p>We received a request to reset the password for your account.</p>
  <p>Click the button below to choose a new password. This link expires in <strong>1 hour</strong>.</p>
  <p style="text-align:center;margin:32px 0">
    <a href="{reset_url}"
       style="background:#ef4444;color:#fff;text-decoration:none;padding:14px 28px;border-radius:8px;font-weight:600;display:inline-block">
      Reset Password
    </a>
  </p>
  <p style="color:#78716c;font-size:14px">
    If you didn't request this, you can safely ignore this email — your password will remain unchanged.
  </p>
  <p style="color:#a8a29e;font-size:12px">AutoStudio AI &middot; autostudio.cc</p>
</body>
</html>"""
        text_body = (
            f"Reset your AutoStudio AI password.\n\n"
            f"Click here (valid for 1 hour):\n{reset_url}\n\n"
            f"If you didn't request this, you can safely ignore this email."
        )

    return _send(to_email, subject, html_body, text_body)
