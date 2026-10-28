import logging
import smtplib
from email.message import EmailMessage
from .config import settings

log = logging.getLogger(__name__)

def send_email(to: str, subject: str, body: str) -> None:
    if not settings.smtp_host or not settings.smtp_from or not to:
        log.warning("Email not sent (SMTP not configured): to=%s subject=%s", to, subject)
        return
    msg = EmailMessage()
    msg["Subject"] = subject
    msg["From"] = settings.smtp_from
    msg["To"] = to
    msg.set_content(body)
    try:
        with smtplib.SMTP(settings.smtp_host, settings.smtp_port, timeout=10) as server:
            server.starttls()
            if settings.smtp_user:
                server.login(settings.smtp_user, settings.smtp_password)
            server.send_message(msg)
    except Exception:
        log.exception("Email delivery failed")
