"""rq worker for feedback anomaly detection — detects feedback channel abuse.

Migrated from ``backend/services/feedback_anomaly_detection.py``.

Usage::

    from backend.workers.feedback_anomaly import enqueue_anomaly_detection

    enqueue_anomaly_detection()
"""

from __future__ import annotations

import logging
from typing import Any

from backend.database import SessionLocal
from backend.services.feedback_anomaly_detection import (
    _detect_volume_spike,
    _detect_repeat_blocks,
    _detect_block_then_success,
)
from backend.workers import get_queue

logger = logging.getLogger(__name__)


def enqueue_anomaly_detection() -> str | None:
    """Enqueue a feedback anomaly detection sweep to the rq ``dpr:feedback`` queue."""
    queue = get_queue("dpr:feedback")
    if queue is None:
        logger.warning("Cannot enqueue anomaly detection — Redis unavailable.")
        return None
    job = queue.enqueue("backend.workers.feedback_anomaly.run_anomaly_detection")
    logger.info("Enqueued anomaly detection (rq id=%s).", job.id)
    return job.id


def run_anomaly_detection() -> dict[str, Any]:
    """rq job: run all anomaly detection checks.

    Detects:
    - A: Volume spikes (org-level)
    - B: Repeat blocks (by user)
    - C: Block-then-success patterns (by user)

    Returns a summary of alerts written.
    """
    results: list[dict[str, Any]] = []

    with SessionLocal() as db:
        count_a = _detect_volume_spike(db)
        if count_a:
            results.append({"alert": "VOLUME_SPIKE", "count": count_a})

        count_b = _detect_repeat_blocks(db)
        if count_b:
            results.append({"alert": "REPEAT_BLOCK", "count": count_b})

        count_c = _detect_block_then_success(db)
        if count_c:
            results.append({"alert": "BLOCK_THEN_SUCCESS", "count": count_c})

        if results:
            db.commit()
            for r in results:
                logger.info("Anomaly detected: %s — %d alert(s).", r["alert"], r["count"])
        else:
            db.rollback()

    logger.info("Anomaly detection sweep complete: %d alert types.", len(results))
    return {"alerts": results, "total_alert_types": len(results)}
