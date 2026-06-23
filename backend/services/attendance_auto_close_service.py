"""Background scheduler that auto-closes attendance records open for >24 hours.

Periodically scans for AttendanceRecord rows where the worker clocked in but
never clocked out — "missed punch-out" records from previous days. For each
such record, the service computes the shift's scheduled end time and sets
punch_out_at to that time, calculates metrics (worked/overtime/late), logs
an AttendanceEvent, and writes an audit log.

Follows the same daemon-thread pattern as AttendanceAbsenceService and
ApprovalExpiryService for consistency with the rest of the codebase.
"""

from __future__ import annotations

import logging
import os
import threading
from datetime import date, datetime, time, timedelta, timezone
from zoneinfo import ZoneInfo

from sqlalchemy.orm import Session

from backend.database import SessionLocal
from backend.models.attendance_event import AttendanceEvent
from backend.models.attendance_record import AttendanceRecord
from backend.models.factory import Factory
from backend.models.report import AuditLog
from backend.models.shift_template import ShiftTemplate


logger = logging.getLogger(__name__)

DEFAULT_TIMEZONE = "Asia/Kolkata"
DEFAULT_POLL_SECONDS = 300.0  # 5 minutes
DEFAULT_STALE_HOURS = 24  # Close records open longer than this

_service_lock = threading.Lock()
_service: AttendanceAutoCloseService | None = None

# ── Helpers (mirrored from attendance router to keep service self-contained) ──


def _factory_timezone(factory: Factory) -> ZoneInfo:
    timezone_name = (factory.timezone if factory else None) or DEFAULT_TIMEZONE
    try:
        return ZoneInfo(timezone_name)
    except Exception:
        logger.warning(
            "Invalid timezone=%s for factory_id=%s; falling back to %s.",
            timezone_name,
            factory.factory_id,
            DEFAULT_TIMEZONE,
        )
        return ZoneInfo(DEFAULT_TIMEZONE)


def _default_shift_end_time(
    *,
    factory: Factory,
    attendance_date: date,
    shift_name: str | None,
    template: ShiftTemplate | None,
) -> datetime:
    """Compute the default punch-out time from the shift template's end time.

    For cross-midnight shifts (e.g. night shift 22:00-06:00), the end time
    falls on the next calendar day. Falls back to standard shift end times
    when no template is found.
    """
    factory_tz = _factory_timezone(factory)
    if template:
        end_date = attendance_date
        if template.cross_midnight:
            end_date += timedelta(days=1)
        naive_end = datetime.combine(end_date, template.end_time, factory_tz)
        return naive_end.astimezone(timezone.utc)
    # Fallback by shift name
    normalized_shift = (shift_name or "").strip().lower()
    fallback_end: dict[str, time] = {
        "morning": time(14, 0),
        "evening": time(22, 0),
        "night": time(6, 0),
    }
    end = fallback_end.get(normalized_shift, time(14, 0))
    end_date = attendance_date
    if normalized_shift == "night":
        end_date += timedelta(days=1)
    naive_end = datetime.combine(end_date, end, factory_tz)
    return naive_end.astimezone(timezone.utc)


def _worked_minutes(punch_in_at: datetime, punch_out_at: datetime) -> int:
    start = punch_in_at
    end = punch_out_at
    if start.tzinfo is None:
        start = start.replace(tzinfo=timezone.utc)
    if end.tzinfo is None:
        end = end.replace(tzinfo=timezone.utc)
    return max(int((end - start).total_seconds() // 60), 0)


def _overtime_minutes(worked_minutes: int, threshold_minutes: int | None = None) -> int:
    return max(worked_minutes - (threshold_minutes or 8 * 60), 0)


def _late_minutes_for_punch(
    *,
    factory: Factory,
    attendance_date: date,
    punch_in_at: datetime | None,
    template: ShiftTemplate | None,
) -> int:
    if not punch_in_at or not template:
        return 0
    factory_tz = _factory_timezone(factory)
    local_start = datetime.combine(attendance_date, template.start_time, factory_tz)
    allowed = local_start + timedelta(minutes=template.grace_minutes or 0)
    local_punch = punch_in_at.astimezone(factory_tz)
    return max(int((local_punch - allowed).total_seconds() // 60), 0)


# ── Configuration ───────────────────────────────────────────────────────────


def _env_bool(name: str, default: bool) -> bool:
    raw = os.getenv(name)
    if raw is None or not raw.strip():
        return default
    return raw.strip().lower() in ("1", "true", "yes", "on")


def _env_float(name: str, default: float) -> float:
    raw = os.getenv(name)
    if raw is None or not raw.strip():
        return default
    try:
        return float(raw)
    except ValueError:
        return default


def _env_int(name: str, default: int) -> int:
    raw = os.getenv(name)
    if raw is None or not raw.strip():
        return default
    try:
        return int(raw)
    except ValueError:
        return default


# ── Core logic ─────────────────────────────────────────────────────────────


def _auto_close_factory_stale_records(
    db: Session,
    *,
    factory: Factory,
    stale_hours: int,
) -> int:
    """Force-close all AttendanceRecord rows for a factory that are stale.

    A record is considered stale when:
    - punch_in_at IS NOT NULL
    - punch_out_at IS NULL
    - attendance_date < today (previous day)

    Returns the number of records closed.
    """
    factory_tz = _factory_timezone(factory)
    local_now = datetime.now(factory_tz)
    today = local_now.date()
    cutoff = local_now - timedelta(hours=stale_hours)

    # Fetch stale records — punched in, not punched out, from a previous day
    stale_records = (
        db.query(AttendanceRecord)
        .filter(
            AttendanceRecord.factory_id == factory.factory_id,
            AttendanceRecord.punch_in_at.is_not(None),
            AttendanceRecord.punch_out_at.is_(None),
            AttendanceRecord.attendance_date < today,
        )
        .order_by(AttendanceRecord.attendance_date.asc(), AttendanceRecord.id.asc())
        .limit(500)
        .all()
    )
    if not stale_records:
        return 0

    # Fetch active shift templates for this factory
    templates = (
        db.query(ShiftTemplate)
        .filter(
            ShiftTemplate.org_id == factory.org_id,
            ShiftTemplate.factory_id == factory.factory_id,
            ShiftTemplate.is_active.is_(True),
        )
        .all()
    )
    template_by_shift = {
        template.shift_name.strip().lower(): template
        for template in templates
        if template.shift_name
    }
    now_utc = datetime.now(timezone.utc)
    closed_count = 0

    for record in stale_records:
        # Double-check that the record is still open (defense-in-depth)
        if record.punch_out_at is not None:
            continue

        # Only close records that are truly stale (> stale_hours old)
        record_punch_in = record.punch_in_at
        if record_punch_in is not None:
            if record_punch_in.tzinfo is None:
                record_punch_in = record_punch_in.replace(tzinfo=timezone.utc)
            if record_punch_in > cutoff:
                continue

        shift_name = (record.shift or "").strip().lower()
        template = template_by_shift.get(shift_name)

        # Compute default end-of-shift punch-out time
        default_punch_out = _default_shift_end_time(
            factory=factory,
            attendance_date=record.attendance_date,
            shift_name=record.shift,
            template=template,
        )

        # --- Apply the force-close ---
        record.punch_out_at = default_punch_out
        record.worked_minutes = _worked_minutes(record.punch_in_at, default_punch_out)
        record.overtime_minutes = _overtime_minutes(
            record.worked_minutes,
            template.overtime_after_minutes if template else None,
        )
        record.late_minutes = _late_minutes_for_punch(
            factory=factory,
            attendance_date=record.attendance_date,
            punch_in_at=record.punch_in_at,
            template=template,
        )
        record.status = "completed"
        record.review_status = "approved"
        record.approved_by_user_id = None  # System action
        record.approved_at = now_utc

        # Log AttendanceEvent
        db.add(
            AttendanceEvent(
                org_id=record.org_id,
                factory_id=record.factory_id,
                user_id=record.user_id,
                attendance_record_id=record.id,
                attendance_date=record.attendance_date,
                shift=record.shift,
                event_type="out",
                event_time=default_punch_out,
                source="system_auto_close",
                note="Auto-closed by system (missed punch-out >24h)",
            )
        )

        # Write audit log
        db.add(
            AuditLog(
                user_id=None,
                org_id=record.org_id,
                factory_id=record.factory_id,
                action="ATTENDANCE_AUTO_CLOSED",
                details=(
                    f"attendance_id={record.id}; "
                    f"user_id={record.user_id}; "
                    f"date={record.attendance_date.isoformat()}; "
                    f"shift={record.shift}; "
                    f"punch_out_at={default_punch_out.isoformat()}; "
                    f"worked_minutes={record.worked_minutes}"
                ),
                ip_address=None,
                timestamp=now_utc,
            )
        )

        closed_count += 1

    db.commit()
    if closed_count:
        logger.info(
            "Auto-close completed factory_id=%s factory=%s closed=%s.",
            factory.factory_id,
            factory.name,
            closed_count,
        )
    return closed_count


# ── Service class ──────────────────────────────────────────────────────────


class AttendanceAutoCloseService:
    """Background scheduler that auto-closes stale attendance records.

    Scans factories periodically for AttendanceRecord rows where the worker
    clocked in but never clocked out from a previous day. Closes them using
    the shift's scheduled end time.
    """

    def __init__(
        self,
        *,
        poll_interval_seconds: float = DEFAULT_POLL_SECONDS,
        stale_hours: int = DEFAULT_STALE_HOURS,
    ) -> None:
        self.poll_interval_seconds = max(10.0, poll_interval_seconds)
        self.stale_hours = max(1, stale_hours)
        self._stop = threading.Event()
        self._thread: threading.Thread | None = None

    def start(self) -> None:
        if self._thread is not None:
            return
        self._stop.clear()
        self._thread = threading.Thread(
            target=self._loop,
            name="attendance-auto-close-scheduler",
            daemon=True,
        )
        self._thread.start()
        logger.info(
            "Attendance auto-close scheduler started "
            "(poll_interval=%.0fs, stale_hours=%dh).",
            self.poll_interval_seconds,
            self.stale_hours,
        )

    def stop(self) -> None:
        self._stop.set()
        if self._thread is not None:
            self._thread.join(timeout=2.0)
            self._thread = None
        logger.info("Attendance auto-close scheduler stopped.")

    def _loop(self) -> None:
        while not self._stop.is_set():
            try:
                self._run_once()
            except Exception:
                logger.exception("Attendance auto-close sweep failed.")
            if self._stop.wait(self.poll_interval_seconds):
                break

    def _run_once(self) -> None:
        run_auto_close_sweep_once(stale_hours=self.stale_hours)


# ── Module-level manual sweep ───────────────────────────────────────────────


def run_auto_close_sweep_once(
    stale_hours: int = DEFAULT_STALE_HOURS,
) -> list[dict[str, object]]:
    """Run a single auto-close sweep across all active factories.

    Used by the cron endpoint for manual triggering and by the scheduler's
    ``_run_once`` method. Returns a list of per-factory result dicts.
    """
    results: list[dict[str, object]] = []
    with SessionLocal() as db:
        factories = (
            db.query(Factory)
            .filter(Factory.is_active.is_(True))
            .order_by(Factory.created_at.asc(), Factory.factory_id.asc())
            .limit(1000)
            .all()
        )
        for factory in factories:
            try:
                closed = _auto_close_factory_stale_records(
                    db,
                    factory=factory,
                    stale_hours=stale_hours,
                )
                if closed:
                    results.append(
                        {
                            "factory_id": factory.factory_id,
                            "factory_name": factory.name,
                            "closed_count": closed,
                        }
                    )
            except Exception:
                db.rollback()
                logger.exception(
                    "Auto-close failed for factory_id=%s.",
                    factory.factory_id,
                )
    logger.info("Auto-close sweep completed: %d factories affected.", len(results))
    return results


# ── Module-level lifecycle functions ───────────────────────────────────────


def initialize_attendance_auto_close_scheduler() -> None:
    """Create and start the attendance auto-close scheduler.

    Called during application startup (main.py lifespan). No-op if the
    ATTENDANCE_AUTO_CLOSE_ENABLED env var is explicitly set to false.
    """
    global _service
    if not _env_bool("ATTENDANCE_AUTO_CLOSE_ENABLED", default=True):
        logger.info("Attendance auto-close scheduler disabled via env var.")
        return

    with _service_lock:
        if _service is not None:
            return
        poll_seconds = _env_float(
            "ATTENDANCE_AUTO_CLOSE_POLL_SECONDS",
            DEFAULT_POLL_SECONDS,
        )
        stale_hours = _env_int(
            "ATTENDANCE_AUTO_CLOSE_STALE_HOURS",
            DEFAULT_STALE_HOURS,
        )
        service = AttendanceAutoCloseService(
            poll_interval_seconds=poll_seconds,
            stale_hours=stale_hours,
        )
        service.start()
        _service = service


def get_auto_close_service() -> AttendanceAutoCloseService | None:
    """Return the singleton auto-close service instance, or None if not running.

    Used by the cron status endpoint to inspect scheduler configuration.
    """
    with _service_lock:
        return _service


def shutdown_attendance_auto_close_scheduler() -> None:
    """Stop the attendance auto-close scheduler.

    Called during application shutdown (main.py lifespan finally).
    """
    global _service
    with _service_lock:
        if _service is None:
            return
        _service.stop()
        _service = None
