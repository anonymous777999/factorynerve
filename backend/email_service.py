"""Email sending helper for summary reports."""

from __future__ import annotations

import logging
import os
import smtplib
import ssl
from email.message import EmailMessage
from typing import Iterable

logger = logging.getLogger(__name__)
SMTP_TIMEOUT_SECONDS = float(os.getenv("SMTP_TIMEOUT_SECONDS", "12"))


def _to_bool(value: str | None, default: bool = False) -> bool:
    if value is None:
        return default
    return value.strip().lower() in {"1", "true", "yes", "on"}


def _build_smtp_attempts(
    *,
    host: str,
    port: int,
    use_tls: bool,
    use_ssl: bool,
) -> list[tuple[str, int, bool, bool]]:
    attempts: list[tuple[str, int, bool, bool]] = [(host, port, use_tls, use_ssl)]
    normalized_host = host.strip().lower()

    # Resend supports both 465 (implicit TLS) and 587 (STARTTLS). Some local
    # networks and Python SMTP stacks are more reliable on one than the other,
    # so we retry with the alternate transport before giving up.
    if "resend" in normalized_host:
        for candidate in (
            (host, 587, True, False),
            (host, 465, False, True),
        ):
            if candidate not in attempts:
                attempts.append(candidate)
    return attempts


def _send_via_smtp(
    *,
    host: str,
    port: int,
    user: str | None,
    password: str | None,
    use_tls: bool,
    use_ssl: bool,
    message: EmailMessage,
) -> None:
    if use_ssl:
        context = ssl.create_default_context()
        with smtplib.SMTP_SSL(host, port, timeout=SMTP_TIMEOUT_SECONDS, context=context) as smtp:
            smtp.ehlo()
            if user and password:
                smtp.login(user, password)
            smtp.send_message(message)
        return

    with smtplib.SMTP(host, port, timeout=SMTP_TIMEOUT_SECONDS) as smtp:
        smtp.ehlo()
        if use_tls:
            context = ssl.create_default_context()
            smtp.starttls(context=context)
            smtp.ehlo()
        if user and password:
            smtp.login(user, password)
        smtp.send_message(message)


def send_email(
    *,
    to_emails: Iterable[str],
    subject: str,
    body: str,
    from_email: str | None = None,
    reply_to: str | None = None,
) -> dict:
    host = os.getenv("SMTP_HOST")
    if not host:
        raise RuntimeError("SMTP_HOST is not configured.")
    port = int(os.getenv("SMTP_PORT", "587"))
    user = os.getenv("SMTP_USER")
    password = os.getenv("SMTP_PASSWORD")
    sender = from_email or os.getenv("SMTP_FROM") or user
    if not sender:
        raise RuntimeError("SMTP_FROM or SMTP_USER is required.")

    use_tls = _to_bool(os.getenv("SMTP_USE_TLS"), True)
    use_ssl = _to_bool(os.getenv("SMTP_USE_SSL"), False)
    dry_run = _to_bool(os.getenv("SMTP_DRY_RUN"), False)

    msg = EmailMessage()
    msg["Subject"] = subject
    msg["From"] = sender
    msg["To"] = ", ".join(list(to_emails))
    if reply_to:
        msg["Reply-To"] = reply_to
    msg.set_content(body)

    if dry_run:
        return {"sent": False, "dry_run": True}

    attempts = _build_smtp_attempts(
        host=host,
        port=port,
        use_tls=use_tls,
        use_ssl=use_ssl,
    )
    last_error: Exception | None = None
    for index, (attempt_host, attempt_port, attempt_tls, attempt_ssl) in enumerate(attempts, start=1):
        try:
            _send_via_smtp(
                host=attempt_host,
                port=attempt_port,
                user=user,
                password=password,
                use_tls=attempt_tls,
                use_ssl=attempt_ssl,
                message=msg,
            )
            return {"sent": True, "dry_run": False}
        except (smtplib.SMTPException, OSError) as error:
            last_error = error
            if index < len(attempts):
                logger.warning(
                    "SMTP delivery attempt %s/%s failed for %s:%s; retrying alternate transport.",
                    index,
                    len(attempts),
                    attempt_host,
                    attempt_port,
                    exc_info=error,
                )
            else:
                logger.error(
                    "SMTP delivery failed after %s attempt(s).",
                    len(attempts),
                    exc_info=error,
                )

    if last_error is not None:
        raise last_error
    raise RuntimeError("SMTP delivery failed without a recorded exception.")
