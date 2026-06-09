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


_FRONTEND_URL = os.getenv("FRONTEND_URL", "http://localhost:3000")


def send_ticket_assignment_email(
    editor_email: str,
    editor_name: str,
    ticket_id: int,
    ticket_title: str,
    project_name: str,
    due_date: Optional[datetime] = None,
    admin_instructions: Optional[str] = None,
) -> bool:
    """Notify an editor that a ticket has been assigned to them."""
    subject = f"New editing assignment: {ticket_title}"
    ticket_url = f"{_FRONTEND_URL}/editor/tickets/{ticket_id}"
    due_str = due_date.strftime("%Y-%m-%d") if due_date else "No due date"
    instructions_block = (
        f"<p><strong>Instructions:</strong></p><p>{admin_instructions}</p>"
        if admin_instructions else ""
    )
    html_body = f"""<!DOCTYPE html>
<html><body style="font-family:sans-serif;color:#1a1a1a;max-width:600px;margin:0 auto;padding:24px">
<h2 style="color:#CC2020">New Editing Assignment</h2>
<p>Hi {editor_name},</p>
<p>You have been assigned a new editing ticket.</p>
<table style="width:100%;border-collapse:collapse;margin:16px 0">
  <tr><td style="padding:8px;background:#f5f5f7;font-weight:600;width:140px">Ticket #</td><td style="padding:8px">{ticket_id}</td></tr>
  <tr><td style="padding:8px;background:#f5f5f7;font-weight:600">Title</td><td style="padding:8px">{ticket_title}</td></tr>
  <tr><td style="padding:8px;background:#f5f5f7;font-weight:600">Project</td><td style="padding:8px">{project_name}</td></tr>
  <tr><td style="padding:8px;background:#f5f5f7;font-weight:600">Due Date</td><td style="padding:8px">{due_str}</td></tr>
</table>
{instructions_block}
<p style="text-align:center;margin:32px 0">
  <a href="{ticket_url}" style="background:#CC2020;color:#fff;text-decoration:none;padding:14px 28px;border-radius:8px;font-weight:600;display:inline-block">View Ticket</a>
</p>
<p style="color:#a8a29e;font-size:12px">AutoStudio AI &middot; autostudio.cc</p>
</body></html>"""
    text_body = f"New assignment: {ticket_title} (#{ticket_id})\nProject: {project_name}\nDue: {due_str}\nView: {ticket_url}"
    try:
        return _send(editor_email, subject, html_body, text_body)
    except Exception:
        logger.exception("send_ticket_assignment_email failed (non-fatal)")
        return False


def send_ticket_result_notification(
    admin_email: str,
    ticket_id: int,
    ticket_title: str,
    editor_name: str,
    editor_note: Optional[str] = None,
) -> bool:
    """Notify admin that an editor has uploaded a result ready for review."""
    subject = f"Editor result ready for review: {ticket_title}"
    ticket_url = f"{_FRONTEND_URL}/admin/editor-portal/tickets/{ticket_id}"
    note_block = f"<p><strong>Editor note:</strong> {editor_note}</p>" if editor_note else ""
    html_body = f"""<!DOCTYPE html>
<html><body style="font-family:sans-serif;color:#1a1a1a;max-width:600px;margin:0 auto;padding:24px">
<h2 style="color:#CC2020">Result Ready for Review</h2>
<p>Editor <strong>{editor_name}</strong> has uploaded a result for ticket #{ticket_id}.</p>
<p><strong>Title:</strong> {ticket_title}</p>
{note_block}
<p style="text-align:center;margin:32px 0">
  <a href="{ticket_url}" style="background:#CC2020;color:#fff;text-decoration:none;padding:14px 28px;border-radius:8px;font-weight:600;display:inline-block">Review Result</a>
</p>
<p style="color:#a8a29e;font-size:12px">AutoStudio AI &middot; autostudio.cc</p>
</body></html>"""
    text_body = f"Result ready: {ticket_title} (#{ticket_id}) by {editor_name}\nReview: {ticket_url}"
    try:
        return _send(admin_email, subject, html_body, text_body)
    except Exception:
        logger.exception("send_ticket_result_notification failed (non-fatal)")
        return False


def send_ticket_status_update_email(
    editor_email: str,
    ticket_id: int,
    ticket_title: str,
    new_status: str,
    admin_note: Optional[str] = None,
) -> bool:
    """Notify editor that their ticket status has been updated."""
    subject = f"Ticket update: {ticket_title} is now {new_status}"
    ticket_url = f"{_FRONTEND_URL}/editor/tickets/{ticket_id}"
    note_block = f"<p><strong>Admin note:</strong> {admin_note}</p>" if admin_note else ""
    html_body = f"""<!DOCTYPE html>
<html><body style="font-family:sans-serif;color:#1a1a1a;max-width:600px;margin:0 auto;padding:24px">
<h2 style="color:#CC2020">Ticket Status Update</h2>
<p>Your ticket <strong>{ticket_title}</strong> (#{ticket_id}) status has changed to <strong>{new_status}</strong>.</p>
{note_block}
<p style="text-align:center;margin:32px 0">
  <a href="{ticket_url}" style="background:#CC2020;color:#fff;text-decoration:none;padding:14px 28px;border-radius:8px;font-weight:600;display:inline-block">View Ticket</a>
</p>
<p style="color:#a8a29e;font-size:12px">AutoStudio AI &middot; autostudio.cc</p>
</body></html>"""
    text_body = f"Ticket update: {ticket_title} (#{ticket_id}) → {new_status}\nView: {ticket_url}"
    try:
        return _send(editor_email, subject, html_body, text_body)
    except Exception:
        logger.exception("send_ticket_status_update_email failed (non-fatal)")
        return False

