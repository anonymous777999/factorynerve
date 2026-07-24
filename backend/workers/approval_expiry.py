"""rq worker for approval expiry — processes TTL-expired approval instances.

Migrated from ``backend/services/approval_expiry_service.py``.

Usage::

    from backend.workers.approval_expiry import enqueue_approval_expiry_sweep

    enqueue_approval_expiry_sweep()
"""

from __future__ import annotations

import logging
from typing import Any

from backend.database import SessionLocal
from backend.services.approval_service import approval_service as APPROVAL_SERVICE
from backend.workers import get_queue

logger = logging.getLogger(__name__)


def enqueue_approval_expiry_sweep() -> str | None:
    """Enqueue an approval expiry sweep to the rq ``dpr:approval`` queue."""
    queue = get_queue("dpr:approval")
    if queue is None:
        logger.warning("Cannot enqueue approval expiry sweep — Redis unavailable.")
        return None
    job = queue.enqueue("backend.workers.approval_expiry.run_expiry_sweep")
    logger.info("Enqueued approval expiry sweep (rq id=%s).", job.id)
    return job.id


def run_expiry_sweep() -> dict[str, Any]:
    """rq job: process all TTL-expired approval instances.

    Delegates to ``ApprovalService.update_expired_instances()``.
    """
    with SessionLocal() as db:
        updated = APPROVAL_SERVICE.update_expired_instances(db)

    logger.info("Approval expiry sweep completed: %d instance(s) updated.", updated)
    return {"updated": updated}
