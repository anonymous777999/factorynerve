"""Email helper that enqueues + immediately attempts send with retry fallback.

This replaces direct calls to ``backend.email_service.send_email`` so that
every email is persisted in the ``email_queue`` table.  If the immediate
SMTP/API attempt fails the background ``EmailQueueProcessor`` retries it
with exponential backoff.
"""

from __future__ import annotations

import logging
from collections.abc import Iterable

from sqlalchemy.orm import Session

from backend.database import SessionLocal
from backend.email_service import send_email
from backend.models.email_queue import EmailQueue


logger = logging.getLogger(__name__)


def queue_and_send_email(
    *,
    to_emails: Iterable[str],
    subject: str,
    body: str,
    user_id: int | None,
    factory_name: str = "FactoryNerve",
    from_email: str | None = None,
    reply_to: str | None = None,
) -> dict:
    """Persist the email in the queue and attempt delivery immediately.

    Returns the result dict from ``send_email`` on success, or a fallback
    dict with ``sent=False`` and the queue ``id`` so callers know the
    message is queued for retry.
    """
    normalized_recipients = [email.strip() for email in to_emails if email and email.strip()]
    if not normalized_recipients:
        logger.warning("queue_and_send_email called with empty to_emails — skipping")
        return {"sent": False, "dry_run": False, "reason": "no_recipients"}

    body_text = body if isinstance(body, str) else str(body)
    subject_text = subject if isinstance(subject, str) else str(subject)

    # 1. Persist in the queue first (so the retry processor can find it)
    queue_id: int | None = None
    db: Session | None = None
    try:
        db = SessionLocal()
        entry = EmailQueue(
            user_id=user_id,
            factory_name=factory_name,
            subject=subject_text,
            body=body_text,
            to_emails=", ".join(normalized_recipients),
            status="pending",
        )
        db.add(entry)
        db.commit()
        db.refresh(entry)
        queue_id = entry.id
    except Exception:
        logger.exception("Failed to persist email in queue; continuing with direct send.")
    finally:
        if db is not None:
            db.close()

    # 2. Attempt immediate delivery
    try:
        result = send_email(
            to_emails=normalized_recipients,
            subject=subject_text,
            body=body_text,
            from_email=from_email,
            reply_to=reply_to,
        )
        if queue_id is not None:
            _mark_sent(queue_id)
        result["queue_id"] = queue_id
        return result
    except Exception as exc:
        logger.warning(
            "Immediate email delivery failed for %s (queue_id=%s); queued for retry.",
            normalized_recipients[0],
            queue_id,
            exc_info=exc,
        )
        return {
            "sent": False,
            "dry_run": False,
            "queue_id": queue_id,
            "error": str(exc),
        }


def _mark_sent(queue_id: int) -> None:
    """Mark a queue entry as sent after successful delivery."""
    db = SessionLocal()
    try:
        entry = db.query(EmailQueue).filter(EmailQueue.id == queue_id).first()
        if entry is not None:
            entry.status = "sent"
            entry.attempts = (entry.attempts or 0) + 1
            db.commit()
    except Exception:
        logger.exception("Failed to mark email queue entry %s as sent.", queue_id)
    finally:
        db.close()


def enqueue_email_only(
    *,
    to_emails: Iterable[str],
    subject: str,
    body: str,
    user_id: int,
    factory_name: str = "FactoryNerve",
) -> int | None:
    """Enqueue an email without attempting immediate delivery.

    Useful when the caller wants the background processor to handle
    delivery entirely (e.g. bulk or scheduled emails).
    """
    normalized_recipients = [email.strip() for email in to_emails if email and email.strip()]
    if not normalized_recipients:
        return None

    body_text = body if isinstance(body, str) else str(body)
    subject_text = subject if isinstance(subject, str) else str(subject)

    db = SessionLocal()
    try:
        entry = EmailQueue(
            user_id=user_id,
            factory_name=factory_name,
            subject=subject_text,
            body=body_text,
            to_emails=", ".join(normalized_recipients),
            status="pending",
        )
        db.add(entry)
        db.commit()
        db.refresh(entry)
        return entry.id
    except Exception:
        logger.exception("Failed to enqueue email.")
        return None
    finally:
        db.close()
