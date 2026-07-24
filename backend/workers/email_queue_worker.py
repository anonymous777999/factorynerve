"""rq worker for email queue processing.

Migrated from ``backend/services/email_queue_processor.py`` daemon-thread
pattern to a dedicated rq worker process.

Usage (enqueue from web process)::

    from backend.workers.email_queue_worker import enqueue_email_batch

    enqueue_email_batch()

The actual work runs in the ``dpr:email`` rq worker process.  The original
``EmailQueueProcessor`` daemon-thread can be disabled once this worker is
verified in production.
"""

from __future__ import annotations

import logging
import os
from datetime import datetime, timedelta, timezone
from typing import Any

from backend.database import SessionLocal
from backend.email_service import send_email
from backend.models.email_queue import EmailQueue
from backend.workers import get_queue

logger = logging.getLogger(__name__)

# Retry configuration (mirrors email_queue_processor.py)
MAX_RETRIES = int(os.getenv("EMAIL_MAX_RETRIES", "5"))
RETRY_BACKOFF_MINUTES = [1, 5, 15, 60, 360]
BATCH_SIZE = int(os.getenv("EMAIL_BATCH_SIZE", "10"))


def enqueue_email_batch() -> int | None:
    """Enqueue an email batch job to the rq ``dpr:email`` queue.

    Returns the rq job id, or None if Redis is unavailable.
    Schedule this via cron (e.g., ``POST /cron/process-email-queue``)
    or from the application lifespan.
    """
    queue = get_queue("dpr:email")
    if queue is None:
        logger.warning("Cannot enqueue email batch — Redis unavailable.")
        return None
    job = queue.enqueue("backend.workers.email_queue_worker.process_email_batch")
    logger.info("Enqueued email batch job (rq id=%s).", job.id)
    return job.id


def process_email_batch() -> dict[str, Any]:
    """rq job: process one batch of pending/failed emails.

    Returns a dict with ``processed`` count and ``errors`` list.

    This is the rq replacement for
    ``EmailQueueProcessor._process_batch()``.
    """
    now = datetime.now(timezone.utc)
    processed = 0
    errors: list[str] = []

    db = SessionLocal()
    try:
        pending = (
            db.query(EmailQueue)
            .filter(
                EmailQueue.status.in_(["pending", "failed"]),
                (EmailQueue.next_retry_at.is_(None) | (EmailQueue.next_retry_at <= now)),
                EmailQueue.attempts < MAX_RETRIES,
            )
            .order_by(EmailQueue.created_at.asc())
            .limit(BATCH_SIZE)
            .all()
        )

        if not pending:
            return {"processed": 0, "errors": [], "message": "No pending emails"}

        for email in pending:
            try:
                _deliver_one(db, email, now)
                processed += 1
            except Exception as exc:
                errors.append(str(exc)[:200])

        db.commit()
    except Exception as exc:
        db.rollback()
        logger.exception("Email batch processing failed.")
        return {"processed": processed, "errors": [str(exc)], "message": "Batch failed"}
    finally:
        db.close()

    logger.info("Email batch processed: %d sent, %d errors.", processed, len(errors))
    return {"processed": processed, "errors": errors, "message": "OK"}


def _deliver_one(db, email: EmailQueue, now: datetime) -> None:
    """Attempt delivery for a single queue entry (mirrors EmailQueueProcessor._deliver_one)."""
    try:
        recipients = [addr.strip() for addr in email.to_emails.split(",") if addr.strip()]
        if not recipients:
            email.status = "failed"
            email.last_error = "No valid recipients"
            email.attempts = (email.attempts or 0) + 1
            email.last_attempt_at = now
            return

        send_email(
            to_emails=recipients,
            subject=email.subject,
            body=email.body,
        )
        email.status = "sent"
        email.attempts = (email.attempts or 0) + 1
        email.last_error = None
        email.last_attempt_at = now
        email.next_retry_at = None
        logger.info(
            "Email %s delivered to %s (attempt %s).",
            email.id,
            recipients[0],
            email.attempts,
        )
    except Exception as exc:
        email.attempts = (email.attempts or 0) + 1
        email.last_error = str(exc)[:500]
        email.last_attempt_at = now

        if email.attempts >= MAX_RETRIES:
            email.status = "failed"
            email.next_retry_at = None
            logger.error(
                "Email %s permanently failed after %s attempts: %s",
                email.id,
                MAX_RETRIES,
                str(exc)[:200],
            )
        else:
            email.status = "failed"
            backoff = RETRY_BACKOFF_MINUTES[
                min(email.attempts - 1, len(RETRY_BACKOFF_MINUTES) - 1)
            ]
            email.next_retry_at = now + timedelta(minutes=backoff)
            logger.warning(
                "Email %s failed (attempt %s/%s), retrying in %s min: %s",
                email.id,
                email.attempts,
                MAX_RETRIES,
                backoff,
                str(exc)[:200],
            )

    email.updated_at = now
