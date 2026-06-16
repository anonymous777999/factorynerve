"""Background scheduler for approval expiry — auto-escalates, auto-rejects, or
abandons TTL-expired approval instances.

Runs as a daemon thread that periodically calls
ApprovalService.update_expired_instances() to process instances past their
configured TTL. Follows the same pattern as AttendanceAbsenceService for
consistency with the rest of the codebase.

Expiry policies (defined in approval_service.py):
- AUTO_ESCALATE_WORKFLOWS: L1→L2 on first expiry, escalated on second
- AUTO_REJECT_WORKFLOWS: auto-rejected on expiry
- Others: abandoned on expiry
"""

from __future__ import annotations

import logging
import os
import threading
from datetime import datetime, timezone

from backend.database import SessionLocal
from backend.services.approval_service import approval_service as APPROVAL_SERVICE

logger = logging.getLogger(__name__)

APPROVAL_EXPIRY_POLL_SECONDS_DEFAULT = 300.0  # 5 minutes

_service_lock = threading.Lock()
_service: ApprovalExpiryService | None = None


def _env_float(name: str, default: float) -> float:
    raw = os.getenv(name)
    if raw is None or not raw.strip():
        return default
    try:
        return float(raw)
    except ValueError:
        return default


def _env_bool(name: str, default: bool) -> bool:
    raw = os.getenv(name)
    if raw is None or not raw.strip():
        return default
    return raw.strip().lower() in ("1", "true", "yes", "on")


class ApprovalExpiryService:
    """Background scheduler that processes expired approval instances.

    Periodically scans the approval_instances table for instances past their
    TTL and applies the configured expiry policy for each workflow type.
    """

    def __init__(self, poll_interval_seconds: float = APPROVAL_EXPIRY_POLL_SECONDS_DEFAULT) -> None:
        self.poll_interval_seconds = max(10.0, poll_interval_seconds)
        self._stop = threading.Event()
        self._thread: threading.Thread | None = None

    def start(self) -> None:
        if self._thread is not None:
            return
        self._stop.clear()
        self._thread = threading.Thread(
            target=self._loop,
            name="approval-expiry-scheduler",
            daemon=True,
        )
        self._thread.start()
        logger.info(
            "Approval expiry scheduler started (poll_interval=%.0fs).",
            self.poll_interval_seconds,
        )

    def stop(self) -> None:
        self._stop.set()
        if self._thread is not None:
            self._thread.join(timeout=2.0)
            self._thread = None
        logger.info("Approval expiry scheduler stopped.")

    def _loop(self) -> None:
        while not self._stop.is_set():
            try:
                self._run_once()
            except Exception:
                logger.exception("Approval expiry sweep failed.")
            if self._stop.wait(self.poll_interval_seconds):
                break

    def _run_once(self) -> None:
        with SessionLocal() as db:
            updated = APPROVAL_SERVICE.update_expired_instances(db)
            if updated:
                logger.info("Approval expiry sweep completed: %d instance(s) updated.", updated)


# ── Module-level lifecycle functions ───────────────────────────────────────


def initialize_approval_expiry_scheduler() -> None:
    """Create and start the approval expiry scheduler.

    Called during application startup (main.py lifespan). No-op if the
    APPROVAL_EXPIRY_ENABLED env var is explicitly set to false.
    """
    global _service
    enabled = _env_bool("APPROVAL_EXPIRY_ENABLED", default=True)
    if not enabled:
        logger.info("Approval expiry scheduler disabled via env var.")
        return

    with _service_lock:
        if _service is not None:
            return
        poll_seconds = _env_float("APPROVAL_EXPIRY_POLL_SECONDS", APPROVAL_EXPIRY_POLL_SECONDS_DEFAULT)
        service = ApprovalExpiryService(poll_interval_seconds=poll_seconds)
        service.start()
        _service = service


def shutdown_approval_expiry_scheduler() -> None:
    """Stop the approval expiry scheduler.

    Called during application shutdown (main.py lifespan finally).
    """
    global _service
    with _service_lock:
        if _service is None:
            return
        _service.stop()
        _service = None
