"""rq worker for attendance absence sweep — marks absent employees.

Migrated from ``backend/services/attendance_absence_service.py``.

Usage::

    from backend.workers.attendance_absence import enqueue_absence_sweep

    enqueue_absence_sweep()
"""

from __future__ import annotations

import logging
from datetime import date
from typing import Any

from backend.database import SessionLocal
from backend.models.factory import Factory
from backend.models.shift_template import ShiftTemplate
from backend.services.attendance_absence_service import (
    AttendanceAbsenceSettings,
    build_attendance_absence_settings,
    _mark_factory_absences,
    _local_date_is_holiday,
    _factory_timezone,
)
from backend.workers import get_queue

logger = logging.getLogger(__name__)


def enqueue_absence_sweep() -> str | None:
    """Enqueue an attendance absence sweep to the rq ``dpr:attendance`` queue."""
    queue = get_queue("dpr:attendance")
    if queue is None:
        logger.warning("Cannot enqueue absence sweep — Redis unavailable.")
        return None
    job = queue.enqueue("backend.workers.attendance_absence.run_absence_sweep")
    logger.info("Enqueued absence sweep (rq id=%s).", job.id)
    return job.id


def run_absence_sweep() -> dict[str, Any]:
    """rq job: run one absence sweep across all active factories.

    Scans each factory for employees without attendance records for
    the current local date and creates 'absent' records for them.
    """
    from datetime import datetime, timezone
    now = datetime.now(timezone.utc)
    settings: AttendanceAbsenceSettings = build_attendance_absence_settings()

    total_created = 0
    factories_processed = 0
    errors: list[str] = []

    with SessionLocal() as db:
        factories = (
            db.query(Factory)
            .filter(Factory.is_active.is_(True))
            .order_by(Factory.created_at.asc(), Factory.factory_id.asc())
            .limit(1000)
            .all()
        )

        for factory in factories:
            local_now = datetime.now(_factory_timezone(factory))
            local_date = local_now.date()

            if _local_date_is_holiday(settings=settings, attendance_date=local_date):
                logger.info(
                    "Skipping absence sweep for holiday factory_id=%s date=%s.",
                    factory.factory_id,
                    local_date.isoformat(),
                )
                continue

            try:
                created_count = _mark_factory_absences(
                    db,
                    factory=factory,
                    attendance_date=local_date,
                )
                total_created += created_count
                factories_processed += 1
            except Exception as exc:
                db.rollback()
                errors.append(f"factory_id={factory.factory_id}: {str(exc)}")
                logger.exception(
                    "Absence sweep failed for factory_id=%s.",
                    factory.factory_id,
                )

    logger.info(
        "Absence sweep completed: %d factories, %d absent records created.",
        factories_processed,
        total_created,
    )
    return {
        "factories_processed": factories_processed,
        "total_created": total_created,
        "errors": errors,
    }
