"""Background processor for the email queue with exponential-backoff retry.

Polls the ``email_queue`` table periodically and retries failed deliveries.
Integrates into the FastAPI lifespan via ``start_email_processor`` /
``stop_email_processor``.
"""

from __future__ import annotations

import logging
import os
import threading
from datetime import datetime, timedelta, timezone

from backend.database import SessionLocal
from backend.email_service import send_email
from backend.models.email_queue import EmailQueue


logger = logging.getLogger(__name__)

MAX_RETRIES = int(os.getenv("EMAIL_MAX_RETRIES", "5"))
# Backoff in minutes per retry attempt (0-indexed → attempt 1 = 1 min, etc.)
RETRY_BACKOFF_MINUTES = [1, 5, 15, 60, 360]
POLL_INTERVAL_SECONDS = int(os.getenv("EMAIL_POLL_INTERVAL_SECONDS", "30"))
BATCH_SIZE = int(os.getenv("EMAIL_BATCH_SIZE", "10"))


class EmailQueueProcessor:
    """Polls the ``email_queue`` table and retries pending/failed emails."""

    def __init__(self) -> None:
        self._stop = threading.Event()
        self._thread: threading.Thread | None = None

    # ------------------------------------------------------------------
    # Public lifecycle
    # ------------------------------------------------------------------

    def start(self) -> None:
        if self._thread is not None:
            return
        self._stop.clear()
        self._thread = threading.Thread(
            target=self._loop,
            daemon=True,
            name="email-queue-processor",
        )
        self._thread.start()
        logger.info(
            "Email queue processor started (poll=%ss, max_retries=%s, batch=%s).",
            POLL_INTERVAL_SECONDS,
            MAX_RETRIES,
            BATCH_SIZE,
        )

    def stop(self) -> None:
        self._stop.set()
        if self._thread is not None:
            self._thread.join(timeout=5)
            self._thread = None
        logger.info("Email queue processor stopped.")

    def process_batch(self) -> int:
        """Process one batch of due emails.  Returns count processed."""
        return self._process_batch()

    # ------------------------------------------------------------------
    # Internal
    # ------------------------------------------------------------------

    def _loop(self) -> None:
        while not self._stop.wait(POLL_INTERVAL_SECONDS):
            try:
                self._process_batch()
            except Exception:
                logger.exception("Email queue processor batch error.")

    def _process_batch(self) -> int:
        now = datetime.now(timezone.utc)
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
                return 0

            for email in pending:
                self._deliver_one(db, email, now)

            db.commit()
            return len(pending)
        finally:
            db.close()

    def _deliver_one(self, db, email: EmailQueue, now: datetime) -> None:
        """Attempt delivery for a single queue entry and update its state."""
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


# ------------------------------------------------------------------
# Module-level singleton
# ------------------------------------------------------------------
_processor: EmailQueueProcessor | None = None
_lock = threading.Lock()


def start_email_processor() -> None:
    global _processor
    with _lock:
        if _processor is None:
            _processor = EmailQueueProcessor()
            _processor.start()


def stop_email_processor() -> None:
    global _processor
    with _lock:
        if _processor is not None:
            _processor.stop()
            _processor = None


def get_email_processor() -> EmailQueueProcessor | None:
    return _processor
