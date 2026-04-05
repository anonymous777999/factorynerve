"""WhatsApp alert delivery via Twilio."""

from __future__ import annotations

import logging
import os
from datetime import date
from typing import Any


logger = logging.getLogger(__name__)


def _enabled() -> bool:
    return (os.getenv("WHATSAPP_ALERTS_ENABLED") or "").strip().lower() in {"1", "true", "yes", "on"}


def _twilio_client():
    try:
        from twilio.rest import Client  # type: ignore
    except Exception as error:
        raise RuntimeError("Twilio SDK not installed.") from error
    sid = os.getenv("TWILIO_ACCOUNT_SID") or ""
    token = os.getenv("TWILIO_AUTH_TOKEN") or ""
    if not sid or not token:
        raise RuntimeError("Twilio credentials missing.")
    return Client(sid, token)


def _default_to() -> str | None:
    return os.getenv("TWILIO_WHATSAPP_TO_DEFAULT")


def _from_number() -> str | None:
    return os.getenv("TWILIO_WHATSAPP_FROM")


def is_configured() -> bool:
    if not _enabled():
        return False
    return bool(_from_number() and _default_to() and os.getenv("TWILIO_ACCOUNT_SID") and os.getenv("TWILIO_AUTH_TOKEN"))


def send_message(body: str, to_number: str | None = None) -> bool:
    if not _enabled():
        return False
    to_number = to_number or _default_to()
    from_number = _from_number()
    if not to_number or not from_number:
        logger.info("WhatsApp alert skipped: missing to/from numbers.")
        return False
    try:
        client = _twilio_client()
        client.messages.create(
            from_=from_number,
            to=to_number,
            body=body,
        )
        return True
    except Exception as error:  # pylint: disable=broad-except
        logger.warning("WhatsApp send failed: %s", error)
        return False


def notify_entry_alerts(entry: Any, alerts: list[dict[str, str]]) -> None:
    if not is_configured():
        return
    base = f"Factory alert for {getattr(entry, 'date', '')} shift {getattr(entry, 'shift', '')}:"
    for alert in alerts:
        alert_type = alert.get("type", "ALERT")
        message = alert.get("message", "")
        if alert_type in {"LOW_PRODUCTION", "HIGH_DOWNTIME", "MANPOWER_SHORTAGE"}:
            send_message(f"{base}\n{alert_type}: {message}")


def notify_ocr_failure(job_id: str, details: str | None = None) -> None:
    if not is_configured():
        return
    detail_text = f"\nDetails: {details}" if details else ""
    send_message(f"OCR job failed (id={job_id}). Please retry or check the image.{detail_text}")


def notify_shift_missed(factory_name: str, shift_label: str | None = None, day: date | None = None) -> None:
    if not is_configured():
        return
    day_label = day.isoformat() if day else "today"
    shift_text = f" ({shift_label} shift)" if shift_label else ""
    send_message(f"Shift missed for {factory_name}{shift_text} on {day_label}. Please submit DPR.")
