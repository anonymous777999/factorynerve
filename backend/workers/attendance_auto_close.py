"""rq worker for attendance auto-close — processes stale attendance records.

Migrated from ``backend/services/attendance_auto_close_service.py``.

Usage::

    from backend.workers.attendance_auto_close import enqueue_auto_close_sweep

    enqueue_auto_close_sweep()
"""

from __future__ import annotations

import logging
from typing import Any

from backend.services.attendance_auto_close_service import run_auto_close_sweep_once
from backend.workers import get_queue

logger = logging.getLogger(__name__)


def enqueue_auto_close_sweep(stale_hours: int = 24) -> str | None:
    """Enqueue an attendance auto-close sweep to the rq ``dpr:attendance`` queue."""
    queue = get_queue("dpr:attendance")
    if queue is None:
        logger.warning("Cannot enqueue auto-close sweep — Redis unavailable.")
        return None
    job = queue.enqueue(
        "backend.workers.attendance_auto_close.run_auto_close_sweep",
        kwargs={"stale_hours": stale_hours},
    )
    logger.info("Enqueued auto-close sweep (rq id=%s).", job.id)
    return job.id


def run_auto_close_sweep(stale_hours: int = 24) -> dict[str, Any]:
    """rq job: run one auto-close sweep across all active factories.

    Delegates to the existing ``run_auto_close_sweep_once()`` function
    from the attendance auto-close service.
    """
    results = run_auto_close_sweep_once(stale_hours=stale_hours)
    total_closed = sum(r.get("closed_count", 0) for r in results)
    logger.info(
        "Auto-close sweep completed: %d factories affected, %d total closed.",
        len(results),
        total_closed,
    )
    return {
        "factories_affected": len(results),
        "total_closed": total_closed,
        "results": results,
    }
