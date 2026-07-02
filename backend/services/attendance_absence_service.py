"""Daily attendance absence sweep for employees without a record."""

from __future__ import annotations

from dataclasses import dataclass
from datetime import date, datetime, time as dt_time
import json
import logging
import os
import threading
from zoneinfo import ZoneInfo

from sqlalchemy.exc import IntegrityError
from sqlalchemy.orm import Session

from backend.database import SessionLocal
from backend.models.attendance_record import AttendanceRecord
from backend.models.employee_profile import EmployeeProfile
from backend.models.factory import Factory
from backend.models.shift_template import ShiftTemplate
from backend.models.user import User


logger = logging.getLogger(__name__)

DEFAULT_TIMEZONE = "Asia/Kolkata"
DEFAULT_RUN_TIME = dt_time(23, 59)
_service_lock = threading.Lock()
_service: "AttendanceAbsenceService | None" = None


def _to_bool(value: str | None, *, default: bool) -> bool:
    if value is None:
        return default
    return value.strip().lower() in {"1", "true", "yes", "on"}


def _to_float(value: str | None, *, default: float) -> float:
    if value is None or not value.strip():
        return default
    return float(value)


def _parse_local_time(value: str | None) -> dt_time:
    raw = (value or "").strip()
    if not raw:
        return DEFAULT_RUN_TIME
    try:
        hour_str, minute_str = raw.split(":", 1)
        hour = int(hour_str)
        minute = int(minute_str)
        return dt_time(hour=hour, minute=minute)
    except Exception:
        logger.warning("Invalid ATTENDANCE_ABSENCE_RUN_TIME_LOCAL=%s; defaulting to 23:59.", raw)
        return DEFAULT_RUN_TIME


def _parse_holiday_dates(value: str | None) -> frozenset[str]:
    raw = (value or "").strip()
    if not raw:
        return frozenset()
    try:
        if raw.startswith("["):
            parsed = json.loads(raw)
            if isinstance(parsed, list):
                return frozenset(str(item).strip() for item in parsed if str(item).strip())
    except Exception:
        logger.warning("Invalid ATTENDANCE_HOLIDAYS JSON; falling back to CSV parsing.")
    return frozenset(part.strip() for part in raw.split(",") if part.strip())


def _factory_timezone(factory: Factory) -> ZoneInfo:
    timezone_name = (factory.timezone or "").strip() or DEFAULT_TIMEZONE
    try:
        return ZoneInfo(timezone_name)
    except Exception:
        logger.warning("Invalid factory timezone=%s for factory_id=%s; defaulting to %s.", timezone_name, factory.factory_id, DEFAULT_TIMEZONE)
        return ZoneInfo(DEFAULT_TIMEZONE)


@dataclass(frozen=True)
class AttendanceAbsenceSettings:
    enabled: bool
    run_time_local: dt_time
    poll_interval_seconds: float
    holiday_dates: frozenset[str]


def build_attendance_absence_settings() -> AttendanceAbsenceSettings:
    tests_running = bool(os.getenv("PYTEST_CURRENT_TEST"))
    return AttendanceAbsenceSettings(
        enabled=_to_bool(os.getenv("ATTENDANCE_ABSENCE_ENABLED"), default=not tests_running),
        run_time_local=_parse_local_time(os.getenv("ATTENDANCE_ABSENCE_RUN_TIME_LOCAL")),
        poll_interval_seconds=max(
            5.0,
            _to_float(os.getenv("ATTENDANCE_ABSENCE_POLL_SECONDS"), default=30.0),
        ),
        holiday_dates=_parse_holiday_dates(os.getenv("ATTENDANCE_HOLIDAYS")),
    )


def _local_date_is_holiday(*, settings: AttendanceAbsenceSettings, attendance_date: date) -> bool:
    return attendance_date.isoformat() in settings.holiday_dates


def _mark_factory_absences(
    db: Session,
    *,
    factory: Factory,
    attendance_date: date,
) -> int:
    active_profiles = (
        db.query(EmployeeProfile)
        .join(User, User.id == EmployeeProfile.user_id)
        .filter(
            EmployeeProfile.org_id == factory.org_id,
            EmployeeProfile.factory_id == factory.factory_id,
            EmployeeProfile.is_active.is_(True),
            EmployeeProfile.default_shift.isnot(None),
            EmployeeProfile.default_shift != "",
            User.is_active.is_(True),
        )
        .order_by(EmployeeProfile.user_id.asc())
        .all()
    )
    if not active_profiles:
        return 0

    existing_user_ids = {
        user_id
        for (user_id,) in (
            db.query(AttendanceRecord.user_id)
            .filter(
                AttendanceRecord.org_id == factory.org_id,
                AttendanceRecord.factory_id == factory.factory_id,
                AttendanceRecord.attendance_date == attendance_date,
            )
            .all()
        )
    }
    templates = (
        db.query(ShiftTemplate)
        .filter(
            ShiftTemplate.org_id == factory.org_id,
            ShiftTemplate.factory_id == factory.factory_id,
            ShiftTemplate.is_active.is_(True),
        )
        .order_by(ShiftTemplate.id.asc())
        .all()
    )
    template_by_shift = {template.shift_name.strip().lower(): template for template in templates if template.shift_name}

    created_count = 0
    for profile in active_profiles:
        if profile.user_id in existing_user_ids:
            continue
        shift_name = (profile.default_shift or "").strip()
        if not shift_name:
            continue
        template = template_by_shift.get(shift_name.lower())
        try:
            with db.begin_nested():
                db.add(
                    AttendanceRecord(
                        org_id=factory.org_id,
                        factory_id=factory.factory_id,
                        user_id=profile.user_id,
                        attendance_date=attendance_date,
                        shift=shift_name,
                        shift_template_id=template.id if template else None,
                        status="absent",
                        review_status="auto",
                        source="system",
                        worked_minutes=0,
                        late_minutes=0,
                        overtime_minutes=0,
                    )
                )
                db.flush()
            created_count += 1
            existing_user_ids.add(profile.user_id)
        except IntegrityError:
            logger.info(
                "Attendance absence row already exists factory_id=%s user_id=%s date=%s.",
                factory.factory_id,
                profile.user_id,
                attendance_date.isoformat(),
            )
    db.commit()
    return created_count


class AttendanceAbsenceService:
    def __init__(self, settings: AttendanceAbsenceSettings) -> None:
        self.settings = settings
        self._stop = threading.Event()
        self._thread: threading.Thread | None = None
        self._lock = threading.Lock()
        self._last_run_by_factory: dict[str, date] = {}

    def start(self) -> None:
        if self._thread is not None:
            return
        self._stop.clear()
        self._thread = threading.Thread(
            target=self._loop,
            name="attendance-absence-scheduler",
            daemon=True,
        )
        self._thread.start()

    def stop(self) -> None:
        self._stop.set()
        if self._thread is not None:
            self._thread.join(timeout=2.0)
            self._thread = None

    def _loop(self) -> None:
        while not self._stop.is_set():
            try:
                self._run_if_due()
            except Exception:
                logger.exception("Daily attendance absence sweep failed.")
            if self._stop.wait(self.settings.poll_interval_seconds):
                break

    def _run_if_due(self) -> None:
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
                run_time = self.settings.run_time_local
                if (local_now.hour, local_now.minute) < (run_time.hour, run_time.minute):
                    continue
                with self._lock:
                    already_ran = self._last_run_by_factory.get(factory.factory_id) == local_date
                if already_ran:
                    continue
                if _local_date_is_holiday(settings=self.settings, attendance_date=local_date):
                    with self._lock:
                        self._last_run_by_factory[factory.factory_id] = local_date
                    logger.info(
                        "Skipping attendance absence sweep for holiday factory_id=%s date=%s.",
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
                    logger.info(
                        "Attendance absence sweep completed factory_id=%s date=%s created=%s.",
                        factory.factory_id,
                        local_date.isoformat(),
                        created_count,
                    )
                    with self._lock:
                        self._last_run_by_factory[factory.factory_id] = local_date
                except Exception:
                    db.rollback()
                    raise


def initialize_attendance_absence_scheduler() -> None:
    global _service
    settings = build_attendance_absence_settings()
    with _service_lock:
        if _service is not None:
            return
        if not settings.enabled:
            logger.info("Attendance absence scheduler disabled.")
            return
        service = AttendanceAbsenceService(settings)
        service.start()
        _service = service
        logger.info(
            "Attendance absence scheduler initialized run_time_local=%s.",
            settings.run_time_local.strftime("%H:%M"),
        )


def shutdown_attendance_absence_scheduler() -> None:
    global _service
    with _service_lock:
        if _service is None:
            return
        _service.stop()
        _service = None
