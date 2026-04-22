"""Attendance router for factory punch, review, and roster workflows."""

from __future__ import annotations

from collections import defaultdict
from datetime import date, datetime, time, timedelta, timezone
from typing import Literal
from zoneinfo import ZoneInfo

from fastapi import APIRouter, Depends, HTTPException, Query, Request, status
from pydantic import BaseModel, Field, field_validator
from sqlalchemy.orm import Session

from backend.database import get_db, hash_ip_address
from backend.models.attendance_event import AttendanceEvent
from backend.models.attendance_record import AttendanceRecord
from backend.models.attendance_regularization import AttendanceRegularization
from backend.models.employee_profile import EmployeeProfile
from backend.models.entry import ShiftType
from backend.models.factory import Factory
from backend.models.report import AuditLog
from backend.models.shift_template import ShiftTemplate
from backend.models.user import User, UserRole
from backend.models.user_factory_role import UserFactoryRole
from backend.rbac import require_any_role, require_role
from backend.security import get_current_user
from backend.tenancy import resolve_factory_id, resolve_org_id
from backend.utils import normalize_identifier_code, sanitize_text


router = APIRouter(tags=["Attendance"])

SHIFT_SEQUENCE = ("morning", "evening", "night")
SHIFT_PRIORITY = {shift: index for index, shift in enumerate(SHIFT_SEQUENCE)}
ROW_STATUS_PRIORITY = {
    "working": 0,
    "late": 1,
    "missed_punch": 2,
    "not_punched": 3,
    "completed": 4,
    "half_day": 5,
    "absent": 6,
}
DEFAULT_SHIFT_TEMPLATES = (
    {
        "shift_name": "morning",
        "start_time": time(6, 0),
        "end_time": time(14, 0),
        "grace_minutes": 10,
        "overtime_after_minutes": 8 * 60,
        "cross_midnight": False,
        "is_default": True,
    },
    {
        "shift_name": "evening",
        "start_time": time(14, 0),
        "end_time": time(22, 0),
        "grace_minutes": 10,
        "overtime_after_minutes": 8 * 60,
        "cross_midnight": False,
        "is_default": False,
    },
    {
        "shift_name": "night",
        "start_time": time(22, 0),
        "end_time": time(6, 0),
        "grace_minutes": 10,
        "overtime_after_minutes": 8 * 60,
        "cross_midnight": True,
        "is_default": False,
    },
)
ATTENDANCE_REGULARIZATION_TYPES = (
    "missed_punch",
    "timing_correction",
    "status_correction",
    "shift_correction",
)
ATTENDANCE_REVIEW_FINAL_STATUSES = ("working", "completed", "half_day", "absent")
REPORTING_MANAGER_ALLOWED_ROLES = {UserRole.SUPERVISOR, UserRole.MANAGER, UserRole.ADMIN, UserRole.OWNER}

AttendanceRegularizationType = Literal["missed_punch", "timing_correction", "status_correction", "shift_correction"]
AttendanceReviewFinalStatus = Literal["working", "completed", "half_day", "absent"]


class AttendancePunchRequest(BaseModel):
    action: Literal["in", "out"]
    shift: ShiftType | None = None
    note: str | None = Field(default=None, max_length=500)


class AttendanceTodayResponse(BaseModel):
    attendance_id: int | None = None
    attendance_date: date
    factory_id: str
    factory_name: str
    factory_code: str | None = None
    shift: str
    shift_template_id: int | None = None
    status: str
    review_status: str
    source: str | None = None
    note: str | None = None
    punch_in_at: datetime | None = None
    punch_out_at: datetime | None = None
    worked_minutes: int
    late_minutes: int
    overtime_minutes: int
    can_punch_in: bool
    can_punch_out: bool


class AttendanceShiftSummary(BaseModel):
    shift: str
    punched_count: int
    working_count: int
    completed_count: int
    pending_review_count: int = 0


class AttendanceLiveRow(BaseModel):
    attendance_id: int | None = None
    user_id: int
    user_code: int
    name: str
    role: str
    department: str | None = None
    designation: str | None = None
    status: str
    review_status: str = "auto"
    shift: str | None = None
    source: str | None = None
    note: str | None = None
    punch_in_at: datetime | None = None
    punch_out_at: datetime | None = None
    worked_minutes: int
    late_minutes: int
    overtime_minutes: int


class AttendanceLiveResponse(BaseModel):
    attendance_date: date
    factory_id: str
    factory_name: str
    totals: dict[str, int]
    shift_summary: list[AttendanceShiftSummary]
    rows: list[AttendanceLiveRow]


class EmployeeProfileItem(BaseModel):
    profile_id: int | None = None
    user_id: int
    user_code: int
    name: str
    email: str
    role: str
    employee_code: str | None = None
    department: str | None = None
    designation: str | None = None
    employment_type: str
    reporting_manager_id: int | None = None
    default_shift: str
    joining_date: date | None = None
    is_active: bool


class EmployeeProfileUpsertRequest(BaseModel):
    user_id: int
    employee_code: str | None = Field(default=None, max_length=32)
    department: str | None = Field(default=None, max_length=120)
    designation: str | None = Field(default=None, max_length=120)
    employment_type: str = Field(default="permanent", max_length=32)
    reporting_manager_id: int | None = Field(default=None, ge=1)
    default_shift: str = Field(default="morning", max_length=16)
    joining_date: date | None = None
    is_active: bool = True

    @field_validator("employee_code")
    @classmethod
    def validate_employee_code(cls, value: str | None) -> str | None:
        return normalize_identifier_code(value, field_name="Employee code")


class ShiftTemplateItem(BaseModel):
    id: int
    shift_name: str
    start_time: str
    end_time: str
    grace_minutes: int
    overtime_after_minutes: int
    cross_midnight: bool
    is_default: bool
    is_active: bool


class ShiftTemplateUpsertRequest(BaseModel):
    id: int | None = None
    shift_name: str = Field(min_length=2, max_length=64)
    start_time: str
    end_time: str
    grace_minutes: int = Field(default=0, ge=0, le=180)
    overtime_after_minutes: int = Field(default=480, ge=0, le=1440)
    cross_midnight: bool = False
    is_default: bool = False
    is_active: bool = True


class AttendanceRegularizationCreateRequest(BaseModel):
    attendance_record_id: int
    request_type: AttendanceRegularizationType = "missed_punch"
    requested_in_at: datetime | None = None
    requested_out_at: datetime | None = None
    reason: str = Field(min_length=4, max_length=500)


class AttendanceRegularizationItem(BaseModel):
    id: int
    status: str
    request_type: str
    reason: str
    requested_in_at: datetime | None = None
    requested_out_at: datetime | None = None
    reviewer_note: str | None = None
    reviewed_by_user_id: int | None = None
    reviewed_at: datetime | None = None
    created_at: datetime


class AttendanceReviewItem(BaseModel):
    attendance_id: int
    attendance_date: date
    user_id: int
    user_code: int
    name: str
    role: str
    department: str | None = None
    designation: str | None = None
    shift: str
    status: str
    review_status: str
    punch_in_at: datetime | None = None
    punch_out_at: datetime | None = None
    worked_minutes: int
    late_minutes: int
    overtime_minutes: int
    note: str | None = None
    review_reason: str
    regularization: AttendanceRegularizationItem | None = None


class AttendanceReviewResponse(BaseModel):
    attendance_date: date
    factory_id: str
    factory_name: str
    totals: dict[str, int]
    items: list[AttendanceReviewItem]


class AttendanceReviewDecisionRequest(BaseModel):
    regularization_id: int | None = None
    punch_in_at: datetime | None = None
    punch_out_at: datetime | None = None
    final_status: AttendanceReviewFinalStatus | None = None
    note: str | None = Field(default=None, max_length=500)


class AttendanceReportDay(BaseModel):
    attendance_date: date
    total_people: int
    punched_in: int
    completed: int
    not_punched: int
    pending_review: int
    late: int
    overtime: int


class AttendanceReportSummary(BaseModel):
    factory_id: str
    factory_name: str
    date_from: date
    date_to: date
    totals: dict[str, int]
    days: list[AttendanceReportDay]


def _factory_timezone(factory: Factory | None) -> ZoneInfo:
    timezone_name = (factory.timezone if factory else None) or "Asia/Kolkata"
    try:
        return ZoneInfo(timezone_name)
    except Exception:
        return ZoneInfo("Asia/Kolkata")


def _factory_now(factory: Factory | None) -> datetime:
    return datetime.now(_factory_timezone(factory))


def _active_org_or_400(current_user: User) -> str:
    org_id = resolve_org_id(current_user)
    if not org_id:
        raise HTTPException(status_code=400, detail="Organization could not be resolved.")
    return org_id


def _infer_shift(local_now: datetime) -> str:
    hour = local_now.hour
    if 6 <= hour < 14:
        return "morning"
    if 14 <= hour < 22:
        return "evening"
    return "night"


def _worked_minutes(record: AttendanceRecord | None, *, reference_utc: datetime | None = None) -> int:
    if not record or not record.punch_in_at:
        return 0
    end = record.punch_out_at or reference_utc or datetime.now(timezone.utc)
    start = record.punch_in_at
    if start.tzinfo is None:
        start = start.replace(tzinfo=timezone.utc)
    if end.tzinfo is None:
        end = end.replace(tzinfo=timezone.utc)
    return max(int((end - start).total_seconds() // 60), 0)


def _overtime_minutes(worked_minutes: int, threshold_minutes: int | None = None) -> int:
    return max(worked_minutes - (threshold_minutes or 8 * 60), 0)


def _parse_time_value(value: str) -> time:
    try:
        hour, minute = value.split(":", 1)
        return time(int(hour), int(minute))
    except Exception as error:  # pylint: disable=broad-except
        raise HTTPException(status_code=422, detail="Time values must be in HH:MM format.") from error


def _format_time_value(value: time | None) -> str:
    if not value:
        return "00:00"
    return value.strftime("%H:%M")


def _local_input_to_utc(value: datetime | None, factory_tz: ZoneInfo) -> datetime | None:
    if value is None:
        return None
    if value.tzinfo is None:
        return value.replace(tzinfo=factory_tz).astimezone(timezone.utc)
    return value.astimezone(timezone.utc)


def _active_factory_or_400(db: Session, current_user: User) -> Factory:
    factory_id = resolve_factory_id(db, current_user)
    if not factory_id:
        raise HTTPException(status_code=400, detail="Select a factory before using attendance.")
    factory = (
        db.query(Factory)
        .filter(Factory.factory_id == factory_id, Factory.is_active.is_(True))
        .first()
    )
    if not factory:
        raise HTTPException(status_code=400, detail="Active factory could not be resolved.")
    return factory


def _attendance_users_for_factory(db: Session, *, factory_id: str, org_id: str | None) -> list[User]:
    query = (
        db.query(User)
        .join(UserFactoryRole, UserFactoryRole.user_id == User.id)
        .filter(
            UserFactoryRole.factory_id == factory_id,
            User.is_active.is_(True),
        )
    )
    if org_id:
        query = query.filter(UserFactoryRole.org_id == org_id, User.org_id == org_id)
    return query.order_by(User.name.asc()).all()


def _employee_profiles_for_factory(
    db: Session,
    *,
    factory_id: str,
    org_id: str,
) -> dict[int, EmployeeProfile]:
    rows = (
        db.query(EmployeeProfile)
        .filter(
            EmployeeProfile.org_id == org_id,
            EmployeeProfile.factory_id == factory_id,
        )
        .all()
    )
    return {row.user_id: row for row in rows}


def _employee_profile_for_user(
    db: Session,
    *,
    org_id: str,
    factory_id: str,
    user_id: int,
) -> EmployeeProfile | None:
    return (
        db.query(EmployeeProfile)
        .filter(
            EmployeeProfile.org_id == org_id,
            EmployeeProfile.factory_id == factory_id,
            EmployeeProfile.user_id == user_id,
        )
        .first()
    )


def _ensure_default_shift_templates(db: Session, *, org_id: str, factory_id: str) -> list[ShiftTemplate]:
    templates = (
        db.query(ShiftTemplate)
        .filter(
            ShiftTemplate.org_id == org_id,
            ShiftTemplate.factory_id == factory_id,
        )
        .order_by(ShiftTemplate.id.asc())
        .all()
    )
    if templates:
        return templates

    created: list[ShiftTemplate] = []
    for template in DEFAULT_SHIFT_TEMPLATES:
        row = ShiftTemplate(
            org_id=org_id,
            factory_id=factory_id,
            shift_name=template["shift_name"],
            start_time=template["start_time"],
            end_time=template["end_time"],
            grace_minutes=template["grace_minutes"],
            overtime_after_minutes=template["overtime_after_minutes"],
            cross_midnight=template["cross_midnight"],
            is_default=template["is_default"],
            is_active=True,
        )
        db.add(row)
        created.append(row)
    db.commit()
    for row in created:
        db.refresh(row)
    return created


def _shift_templates_for_factory(db: Session, *, org_id: str, factory_id: str) -> list[ShiftTemplate]:
    templates = _ensure_default_shift_templates(db, org_id=org_id, factory_id=factory_id)
    return [template for template in templates if template.is_active]


def _shift_template_for_shift(
    db: Session,
    *,
    org_id: str,
    factory_id: str,
    shift_name: str | None,
    shift_template_id: int | None = None,
) -> ShiftTemplate | None:
    templates = _shift_templates_for_factory(db, org_id=org_id, factory_id=factory_id)
    if shift_template_id is not None:
        for template in templates:
            if template.id == shift_template_id:
                return template
    normalized = (shift_name or "").strip().lower()
    for template in templates:
        if template.shift_name.strip().lower() == normalized:
            return template
    for template in templates:
        if template.is_default:
            return template
    return templates[0] if templates else None


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


def _sync_record_metrics(
    *,
    record: AttendanceRecord,
    factory: Factory,
    template: ShiftTemplate | None,
    status_value: str | None = None,
) -> AttendanceRecord:
    worked_minutes = _worked_minutes(record, reference_utc=datetime.now(timezone.utc))
    record.worked_minutes = worked_minutes
    record.overtime_minutes = _overtime_minutes(worked_minutes, template.overtime_after_minutes if template else None)
    record.late_minutes = _late_minutes_for_punch(
        factory=factory,
        attendance_date=record.attendance_date,
        punch_in_at=record.punch_in_at,
        template=template,
    )
    if status_value:
        record.status = status_value
    elif record.punch_out_at:
        record.status = "completed"
    else:
        record.status = "working"
    return record


def _open_record_for_user(db: Session, *, user_id: int, factory_id: str) -> AttendanceRecord | None:
    return (
        db.query(AttendanceRecord)
        .filter(
            AttendanceRecord.user_id == user_id,
            AttendanceRecord.factory_id == factory_id,
            AttendanceRecord.punch_in_at.is_not(None),
            AttendanceRecord.punch_out_at.is_(None),
        )
        .order_by(AttendanceRecord.attendance_date.desc(), AttendanceRecord.created_at.desc())
        .first()
    )


def _record_for_local_day(
    db: Session,
    *,
    user_id: int,
    factory_id: str,
    attendance_date: date,
) -> AttendanceRecord | None:
    return (
        db.query(AttendanceRecord)
        .filter(
            AttendanceRecord.user_id == user_id,
            AttendanceRecord.factory_id == factory_id,
            AttendanceRecord.attendance_date == attendance_date,
        )
        .order_by(AttendanceRecord.created_at.desc())
        .first()
    )


def _record_for_today_view(
    db: Session,
    *,
    user_id: int,
    factory_id: str,
    attendance_date: date,
) -> AttendanceRecord | None:
    open_record = _open_record_for_user(db, user_id=user_id, factory_id=factory_id)
    if open_record:
        return open_record
    return _record_for_local_day(db, user_id=user_id, factory_id=factory_id, attendance_date=attendance_date)


def _attendance_rows_for_day(
    db: Session,
    *,
    factory_id: str,
    org_id: str | None,
    attendance_date: date,
    include_open_previous: bool,
) -> list[AttendanceRecord]:
    query = db.query(AttendanceRecord).filter(
        AttendanceRecord.factory_id == factory_id,
        AttendanceRecord.attendance_date == attendance_date,
    )
    if org_id:
        query = query.filter(AttendanceRecord.org_id == org_id)
    rows = query.order_by(AttendanceRecord.created_at.desc()).all()
    if not include_open_previous:
        return rows
    open_query = db.query(AttendanceRecord).filter(
        AttendanceRecord.factory_id == factory_id,
        AttendanceRecord.attendance_date < attendance_date,
        AttendanceRecord.punch_in_at.is_not(None),
        AttendanceRecord.punch_out_at.is_(None),
    )
    if org_id:
        open_query = open_query.filter(AttendanceRecord.org_id == org_id)
    return rows + open_query.order_by(AttendanceRecord.attendance_date.desc(), AttendanceRecord.created_at.desc()).all()


def _write_attendance_audit(
    db: Session,
    *,
    current_user: User,
    request: Request,
    factory_id: str,
    action: str,
    details: str,
) -> None:
    db.add(
        AuditLog(
            user_id=current_user.id,
            org_id=resolve_org_id(current_user),
            factory_id=factory_id,
            action=action,
            details=details,
            ip_address=hash_ip_address(request.client.host if request.client else None),
            user_agent=request.headers.get("user-agent"),
            timestamp=datetime.now(timezone.utc),
        )
    )


def _serialize_regularization(
    regularization: AttendanceRegularization | None,
) -> AttendanceRegularizationItem | None:
    if not regularization:
        return None
    return AttendanceRegularizationItem(
        id=regularization.id,
        status=regularization.status,
        request_type=regularization.request_type,
        reason=regularization.reason,
        requested_in_at=regularization.requested_in_at,
        requested_out_at=regularization.requested_out_at,
        reviewer_note=regularization.reviewer_note,
        reviewed_by_user_id=regularization.reviewed_by_user_id,
        reviewed_at=regularization.reviewed_at,
        created_at=regularization.created_at,
    )


def _serialize_today_response(
    *,
    db: Session,
    factory: Factory,
    attendance_date: date,
    record: AttendanceRecord | None,
    inferred_shift: str,
) -> AttendanceTodayResponse:
    org_id = record.org_id if record else factory.org_id
    template = (
        _shift_template_for_shift(
            db,
            org_id=org_id,
            factory_id=factory.factory_id,
            shift_name=record.shift if record else inferred_shift,
            shift_template_id=record.shift_template_id if record else None,
        )
        if org_id
        else None
    )
    worked_minutes = _worked_minutes(record, reference_utc=datetime.now(timezone.utc))
    overtime_minutes = _overtime_minutes(worked_minutes, template.overtime_after_minutes if template else None)
    status_value = record.status if record else "not_punched"
    if record and record.punch_out_at is None and record.attendance_date < attendance_date:
        status_value = "missed_punch"
    shift_value = record.shift if record and record.shift else inferred_shift
    return AttendanceTodayResponse(
        attendance_id=record.id if record else None,
        attendance_date=record.attendance_date if record else attendance_date,
        factory_id=factory.factory_id,
        factory_name=factory.name,
        factory_code=factory.factory_code,
        shift=shift_value,
        shift_template_id=record.shift_template_id if record else None,
        status=status_value,
        review_status=record.review_status if record else "auto",
        source=record.source if record else None,
        note=record.note if record else None,
        punch_in_at=record.punch_in_at if record else None,
        punch_out_at=record.punch_out_at if record else None,
        worked_minutes=worked_minutes,
        late_minutes=record.late_minutes if record else 0,
        overtime_minutes=overtime_minutes if record else 0,
        can_punch_in=record is None,
        can_punch_out=bool(record and record.punch_in_at and record.punch_out_at is None),
    )


def _serialize_shift_template(template: ShiftTemplate) -> ShiftTemplateItem:
    return ShiftTemplateItem(
        id=template.id,
        shift_name=template.shift_name,
        start_time=_format_time_value(template.start_time),
        end_time=_format_time_value(template.end_time),
        grace_minutes=template.grace_minutes,
        overtime_after_minutes=template.overtime_after_minutes,
        cross_midnight=template.cross_midnight,
        is_default=template.is_default,
        is_active=template.is_active,
    )


@router.get("/me/today", response_model=AttendanceTodayResponse)
def get_my_attendance_today(
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
) -> AttendanceTodayResponse:
    factory = _active_factory_or_400(db, current_user)
    local_now = _factory_now(factory)
    record = _record_for_today_view(
        db,
        user_id=current_user.id,
        factory_id=factory.factory_id,
        attendance_date=local_now.date(),
    )
    return _serialize_today_response(
        db=db,
        factory=factory,
        attendance_date=local_now.date(),
        record=record,
        inferred_shift=_infer_shift(local_now),
    )


@router.post("/punch", response_model=AttendanceTodayResponse, status_code=status.HTTP_200_OK)
def punch_attendance(
    payload: AttendancePunchRequest,
    request: Request,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
) -> AttendanceTodayResponse:
    factory = _active_factory_or_400(db, current_user)
    org_id = _active_org_or_400(current_user)
    local_now = _factory_now(factory)
    current_date = local_now.date()

    note = sanitize_text(payload.note, max_length=500, preserve_newlines=False) if payload.note else None
    open_record = _open_record_for_user(db, user_id=current_user.id, factory_id=factory.factory_id)
    today_record = _record_for_local_day(
        db,
        user_id=current_user.id,
        factory_id=factory.factory_id,
        attendance_date=current_date,
    )
    profile = _employee_profile_for_user(
        db,
        org_id=org_id,
        factory_id=factory.factory_id,
        user_id=current_user.id,
    )

    if payload.action == "in":
        if open_record:
            return _serialize_today_response(
                db=db,
                factory=factory,
                attendance_date=current_date,
                record=open_record,
                inferred_shift=open_record.shift or _infer_shift(local_now),
            )
        if today_record and today_record.punch_out_at is not None:
            raise HTTPException(status_code=409, detail="Attendance is already closed for today.")

        profile_shift = profile.default_shift if profile else None
        shift_value = (payload.shift.value if payload.shift else None) or profile_shift or _infer_shift(local_now)
        template = _shift_template_for_shift(
            db,
            org_id=org_id,
            factory_id=factory.factory_id,
            shift_name=shift_value,
        )
        punch_time = datetime.now(timezone.utc)
        record = AttendanceRecord(
            org_id=org_id,
            factory_id=factory.factory_id,
            user_id=current_user.id,
            attendance_date=current_date,
            shift=shift_value,
            shift_template_id=template.id if template else None,
            status="working",
            review_status="auto",
            source="self-service",
            note=note,
            punch_in_at=punch_time,
            worked_minutes=0,
            late_minutes=_late_minutes_for_punch(
                factory=factory,
                attendance_date=current_date,
                punch_in_at=punch_time,
                template=template,
            ),
            overtime_minutes=0,
        )
        db.add(record)
        db.flush()
        db.add(
            AttendanceEvent(
                org_id=org_id,
                factory_id=factory.factory_id,
                user_id=current_user.id,
                attendance_record_id=record.id,
                attendance_date=current_date,
                shift=shift_value,
                event_type="in",
                event_time=punch_time,
                source="self-service",
                note=note,
            )
        )
        _write_attendance_audit(
            db,
            current_user=current_user,
            request=request,
            factory_id=factory.factory_id,
            action="ATTENDANCE_PUNCHED_IN",
            details=f"attendance_date={current_date.isoformat()}; shift={shift_value}",
        )
        db.commit()
        db.refresh(record)
        return _serialize_today_response(
            db=db,
            factory=factory,
            attendance_date=current_date,
            record=record,
            inferred_shift=shift_value,
        )

    record = open_record or today_record
    if not record or not record.punch_in_at:
        raise HTTPException(status_code=409, detail="Punch in first to close attendance.")
    if record.punch_out_at is not None:
        return _serialize_today_response(
            db=db,
            factory=factory,
            attendance_date=current_date,
            record=record,
            inferred_shift=record.shift or _infer_shift(local_now),
        )

    punch_time = datetime.now(timezone.utc)
    template = _shift_template_for_shift(
        db,
        org_id=org_id,
        factory_id=factory.factory_id,
        shift_name=record.shift,
        shift_template_id=record.shift_template_id,
    )
    record.punch_out_at = punch_time
    if note:
        record.note = note
    _sync_record_metrics(record=record, factory=factory, template=template, status_value="completed")
    db.add(
        AttendanceEvent(
            org_id=org_id,
            factory_id=factory.factory_id,
            user_id=current_user.id,
            attendance_record_id=record.id,
            attendance_date=record.attendance_date,
            shift=record.shift,
            event_type="out",
            event_time=punch_time,
            source="self-service",
            note=note,
        )
    )
    _write_attendance_audit(
        db,
        current_user=current_user,
        request=request,
        factory_id=factory.factory_id,
        action="ATTENDANCE_PUNCHED_OUT",
        details=f"attendance_id={record.id}; worked_minutes={record.worked_minutes}; shift={record.shift}",
    )
    db.commit()
    db.refresh(record)
    return _serialize_today_response(
        db=db,
        factory=factory,
        attendance_date=current_date,
        record=record,
        inferred_shift=record.shift or _infer_shift(local_now),
    )


@router.get("/live", response_model=AttendanceLiveResponse)
def get_live_attendance(
    attendance_date: date | None = Query(default=None),
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
) -> AttendanceLiveResponse:
    require_role(current_user, UserRole.SUPERVISOR)
    factory = _active_factory_or_400(db, current_user)
    org_id = _active_org_or_400(current_user)
    local_now = _factory_now(factory)
    selected_date = attendance_date or local_now.date()
    include_open_previous = selected_date == local_now.date()

    users = _attendance_users_for_factory(db, factory_id=factory.factory_id, org_id=org_id)
    profiles = _employee_profiles_for_factory(db, factory_id=factory.factory_id, org_id=org_id)
    records = _attendance_rows_for_day(
        db,
        factory_id=factory.factory_id,
        org_id=org_id,
        attendance_date=selected_date,
        include_open_previous=include_open_previous,
    )
    record_map: dict[int, AttendanceRecord] = {}
    for record in records:
        existing = record_map.get(record.user_id)
        if not existing:
            record_map[record.user_id] = record
            continue
        if existing.punch_out_at is None and record.punch_out_at is not None:
            continue
        if record.attendance_date > existing.attendance_date:
            record_map[record.user_id] = record

    rows: list[AttendanceLiveRow] = []
    totals = {
        "total_people": len(users),
        "punched_in": 0,
        "working": 0,
        "completed": 0,
        "not_punched": 0,
        "pending_review": 0,
        "late": 0,
    }
    shift_summary = {
        shift: {
            "shift": shift,
            "punched_count": 0,
            "working_count": 0,
            "completed_count": 0,
            "pending_review_count": 0,
        }
        for shift in SHIFT_SEQUENCE
    }
    reference_utc = datetime.now(timezone.utc)

    for user in users:
        record = record_map.get(user.id)
        profile = profiles.get(user.id)
        if record:
            template = _shift_template_for_shift(
                db,
                org_id=org_id,
                factory_id=factory.factory_id,
                shift_name=record.shift,
                shift_template_id=record.shift_template_id,
            )
            worked_minutes = _worked_minutes(record, reference_utc=reference_utc)
            overtime_minutes = _overtime_minutes(worked_minutes, template.overtime_after_minutes if template else None)
            row_status = record.status or ("completed" if record.punch_out_at else "working")
            if record.punch_out_at is None and record.attendance_date < selected_date:
                row_status = "missed_punch"
            totals["punched_in"] += 1
            if row_status == "completed":
                totals["completed"] += 1
            else:
                totals["working"] += 1
            if record.review_status == "pending_review" or row_status == "missed_punch":
                totals["pending_review"] += 1
            if record.late_minutes > 0:
                totals["late"] += 1
            if record.shift in shift_summary:
                shift_summary[record.shift]["punched_count"] += 1
                if row_status == "completed":
                    shift_summary[record.shift]["completed_count"] += 1
                else:
                    shift_summary[record.shift]["working_count"] += 1
                if record.review_status == "pending_review" or row_status == "missed_punch":
                    shift_summary[record.shift]["pending_review_count"] += 1
            rows.append(
                AttendanceLiveRow(
                    attendance_id=record.id,
                    user_id=user.id,
                    user_code=user.user_code,
                    name=user.name,
                    role=user.role.value,
                    department=profile.department if profile else None,
                    designation=profile.designation if profile else None,
                    status=row_status,
                    review_status="pending_review" if row_status == "missed_punch" else record.review_status,
                    shift=record.shift,
                    source=record.source,
                    note=record.note,
                    punch_in_at=record.punch_in_at,
                    punch_out_at=record.punch_out_at,
                    worked_minutes=worked_minutes,
                    late_minutes=record.late_minutes,
                    overtime_minutes=overtime_minutes,
                )
            )
            continue

        totals["not_punched"] += 1
        rows.append(
            AttendanceLiveRow(
                user_id=user.id,
                user_code=user.user_code,
                name=user.name,
                role=user.role.value,
                department=profile.department if profile else None,
                designation=profile.designation if profile else None,
                status="not_punched",
                worked_minutes=0,
                late_minutes=0,
                overtime_minutes=0,
            )
        )

    rows.sort(
        key=lambda row: (
            ROW_STATUS_PRIORITY.get(row.status, 9),
            SHIFT_PRIORITY.get(row.shift or "", 9),
            row.name.lower(),
        )
    )

    return AttendanceLiveResponse(
        attendance_date=selected_date,
        factory_id=factory.factory_id,
        factory_name=factory.name,
        totals=totals,
        shift_summary=[AttendanceShiftSummary(**shift_summary[shift]) for shift in SHIFT_SEQUENCE],
        rows=rows,
    )


@router.get("/settings/employees", response_model=list[EmployeeProfileItem])
def get_attendance_employee_profiles(
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
) -> list[EmployeeProfileItem]:
    require_role(current_user, UserRole.MANAGER)
    factory = _active_factory_or_400(db, current_user)
    org_id = _active_org_or_400(current_user)
    users = _attendance_users_for_factory(db, factory_id=factory.factory_id, org_id=org_id)
    profiles = _employee_profiles_for_factory(db, factory_id=factory.factory_id, org_id=org_id)

    items: list[EmployeeProfileItem] = []
    for user in users:
        profile = profiles.get(user.id)
        items.append(
            EmployeeProfileItem(
                profile_id=profile.id if profile else None,
                user_id=user.id,
                user_code=user.user_code,
                name=user.name,
                email=user.email,
                role=user.role.value,
                employee_code=profile.employee_code if profile else None,
                department=profile.department if profile else None,
                designation=profile.designation if profile else None,
                employment_type=profile.employment_type if profile else "permanent",
                reporting_manager_id=profile.reporting_manager_id if profile else None,
                default_shift=profile.default_shift if profile else "morning",
                joining_date=profile.joining_date if profile else None,
                is_active=profile.is_active if profile else True,
            )
        )
    return items


@router.post("/settings/employees", response_model=EmployeeProfileItem)
def upsert_attendance_employee_profile(
    payload: EmployeeProfileUpsertRequest,
    request: Request,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
) -> EmployeeProfileItem:
    require_role(current_user, UserRole.MANAGER)
    factory = _active_factory_or_400(db, current_user)
    org_id = _active_org_or_400(current_user)
    user = (
        db.query(User)
        .join(UserFactoryRole, UserFactoryRole.user_id == User.id)
        .filter(
            User.id == payload.user_id,
            UserFactoryRole.factory_id == factory.factory_id,
            UserFactoryRole.org_id == org_id,
        )
        .first()
    )
    if not user:
        raise HTTPException(status_code=404, detail="User not found in the active factory.")

    template = _shift_template_for_shift(
        db,
        org_id=org_id,
        factory_id=factory.factory_id,
        shift_name=payload.default_shift,
    )
    if template is None:
        raise HTTPException(status_code=422, detail="Default shift must match an active shift template.")

    reporting_manager: User | None = None
    if payload.reporting_manager_id is not None:
        if int(payload.reporting_manager_id) == int(payload.user_id):
            raise HTTPException(status_code=422, detail="Reporting manager cannot be the same employee.")
        reporting_manager = (
            db.query(User)
            .join(UserFactoryRole, UserFactoryRole.user_id == User.id)
            .filter(
                User.id == payload.reporting_manager_id,
                User.org_id == org_id,
                User.is_active.is_(True),
                UserFactoryRole.factory_id == factory.factory_id,
                UserFactoryRole.org_id == org_id,
            )
            .first()
        )
        if not reporting_manager:
            raise HTTPException(
                status_code=422,
                detail="Reporting manager must be an active user in the selected factory.",
            )
        if reporting_manager.role not in REPORTING_MANAGER_ALLOWED_ROLES:
            raise HTTPException(
                status_code=422,
                detail="Reporting manager must be a supervisor, manager, admin, or owner.",
            )

    profile = _employee_profile_for_user(
        db,
        org_id=org_id,
        factory_id=factory.factory_id,
        user_id=payload.user_id,
    )
    if not profile:
        profile = EmployeeProfile(org_id=org_id, factory_id=factory.factory_id, user_id=payload.user_id)
        db.add(profile)

    profile.employee_code = payload.employee_code if payload.employee_code else None
    profile.department = sanitize_text(payload.department, max_length=120) if payload.department else None
    profile.designation = sanitize_text(payload.designation, max_length=120) if payload.designation else None
    profile.employment_type = sanitize_text(payload.employment_type, max_length=32) or "permanent"
    profile.reporting_manager_id = reporting_manager.id if reporting_manager else None
    profile.default_shift = sanitize_text(payload.default_shift, max_length=16) or "morning"
    profile.joining_date = payload.joining_date
    profile.is_active = payload.is_active

    _write_attendance_audit(
        db,
        current_user=current_user,
        request=request,
        factory_id=factory.factory_id,
        action="ATTENDANCE_PROFILE_UPSERTED",
        details=f"user_id={payload.user_id}; default_shift={profile.default_shift}",
    )
    db.commit()
    db.refresh(profile)
    return EmployeeProfileItem(
        profile_id=profile.id,
        user_id=user.id,
        user_code=user.user_code,
        name=user.name,
        email=user.email,
        role=user.role.value,
        employee_code=profile.employee_code,
        department=profile.department,
        designation=profile.designation,
        employment_type=profile.employment_type,
        reporting_manager_id=profile.reporting_manager_id,
        default_shift=profile.default_shift,
        joining_date=profile.joining_date,
        is_active=profile.is_active,
    )


@router.get("/settings/shifts", response_model=list[ShiftTemplateItem])
def get_shift_templates(
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
) -> list[ShiftTemplateItem]:
    require_role(current_user, UserRole.MANAGER)
    factory = _active_factory_or_400(db, current_user)
    org_id = _active_org_or_400(current_user)
    templates = _shift_templates_for_factory(db, org_id=org_id, factory_id=factory.factory_id)
    return [_serialize_shift_template(template) for template in templates]


@router.post("/settings/shifts", response_model=ShiftTemplateItem)
def upsert_shift_template(
    payload: ShiftTemplateUpsertRequest,
    request: Request,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
) -> ShiftTemplateItem:
    require_role(current_user, UserRole.MANAGER)
    factory = _active_factory_or_400(db, current_user)
    org_id = _active_org_or_400(current_user)

    template = None
    if payload.id is not None:
        template = (
            db.query(ShiftTemplate)
            .filter(
                ShiftTemplate.id == payload.id,
                ShiftTemplate.org_id == org_id,
                ShiftTemplate.factory_id == factory.factory_id,
            )
            .first()
        )
        if not template:
            raise HTTPException(status_code=404, detail="Shift template not found.")

    shift_name = sanitize_text(payload.shift_name, max_length=64)
    if not shift_name:
        raise HTTPException(status_code=422, detail="Shift name is required.")

    conflict = (
        db.query(ShiftTemplate)
        .filter(
            ShiftTemplate.org_id == org_id,
            ShiftTemplate.factory_id == factory.factory_id,
            ShiftTemplate.shift_name == shift_name,
        )
        .first()
    )
    if conflict and (template is None or conflict.id != template.id):
        raise HTTPException(status_code=409, detail="A shift template with this name already exists.")

    if not template:
        template = ShiftTemplate(org_id=org_id, factory_id=factory.factory_id)
        db.add(template)

    if payload.is_default:
        (
            db.query(ShiftTemplate)
            .filter(
                ShiftTemplate.org_id == org_id,
                ShiftTemplate.factory_id == factory.factory_id,
            )
            .update({"is_default": False}, synchronize_session=False)
        )

    template.shift_name = shift_name
    template.start_time = _parse_time_value(payload.start_time)
    template.end_time = _parse_time_value(payload.end_time)
    template.grace_minutes = payload.grace_minutes
    template.overtime_after_minutes = payload.overtime_after_minutes
    template.cross_midnight = payload.cross_midnight
    template.is_default = payload.is_default
    template.is_active = payload.is_active

    _write_attendance_audit(
        db,
        current_user=current_user,
        request=request,
        factory_id=factory.factory_id,
        action="ATTENDANCE_SHIFT_TEMPLATE_UPSERTED",
        details=f"shift_name={template.shift_name}; template_id={template.id or 'new'}",
    )
    db.commit()
    db.refresh(template)
    return _serialize_shift_template(template)


@router.post("/me/regularizations", response_model=AttendanceRegularizationItem, status_code=status.HTTP_201_CREATED)
def create_regularization_request(
    payload: AttendanceRegularizationCreateRequest,
    request: Request,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
) -> AttendanceRegularizationItem:
    factory = _active_factory_or_400(db, current_user)
    org_id = _active_org_or_400(current_user)
    record = (
        db.query(AttendanceRecord)
        .filter(
            AttendanceRecord.id == payload.attendance_record_id,
            AttendanceRecord.org_id == org_id,
            AttendanceRecord.factory_id == factory.factory_id,
            AttendanceRecord.user_id == current_user.id,
        )
        .first()
    )
    if not record:
        raise HTTPException(status_code=404, detail="Attendance record not found.")

    reason = sanitize_text(payload.reason, max_length=500)
    if not reason:
        raise HTTPException(status_code=422, detail="Reason is required.")
    existing_pending = (
        db.query(AttendanceRegularization)
        .filter(
            AttendanceRegularization.attendance_record_id == record.id,
            AttendanceRegularization.status == "pending",
        )
        .first()
    )
    if existing_pending:
        raise HTTPException(status_code=409, detail="A pending regularization already exists for this record.")

    factory_tz = _factory_timezone(factory)
    regularization = AttendanceRegularization(
        org_id=org_id,
        factory_id=factory.factory_id,
        user_id=current_user.id,
        attendance_record_id=record.id,
        attendance_date=record.attendance_date,
        request_type=payload.request_type,
        requested_in_at=_local_input_to_utc(payload.requested_in_at, factory_tz),
        requested_out_at=_local_input_to_utc(payload.requested_out_at, factory_tz),
        reason=reason,
        status="pending",
    )
    record.review_status = "pending_review"
    db.add(regularization)
    _write_attendance_audit(
        db,
        current_user=current_user,
        request=request,
        factory_id=factory.factory_id,
        action="ATTENDANCE_REGULARIZATION_CREATED",
        details=f"attendance_id={record.id}; request_type={regularization.request_type}",
    )
    db.commit()
    db.refresh(regularization)
    return _serialize_regularization(regularization)


@router.get("/review", response_model=AttendanceReviewResponse)
def get_attendance_review_queue(
    attendance_date: date | None = Query(default=None),
    lookback_days: int = Query(default=14, ge=1, le=60),
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
) -> AttendanceReviewResponse:
    require_any_role(current_user, REPORTING_MANAGER_ALLOWED_ROLES)
    factory = _active_factory_or_400(db, current_user)
    org_id = _active_org_or_400(current_user)
    local_now = _factory_now(factory)
    selected_date = attendance_date or local_now.date()
    date_from = selected_date - timedelta(days=lookback_days - 1)

    profiles = _employee_profiles_for_factory(db, factory_id=factory.factory_id, org_id=org_id)
    user_map = {user.id: user for user in _attendance_users_for_factory(db, factory_id=factory.factory_id, org_id=org_id)}
    pending_regularizations = (
        db.query(AttendanceRegularization)
        .filter(
            AttendanceRegularization.org_id == org_id,
            AttendanceRegularization.factory_id == factory.factory_id,
            AttendanceRegularization.status == "pending",
            AttendanceRegularization.attendance_date >= date_from,
            AttendanceRegularization.attendance_date <= selected_date,
        )
        .order_by(AttendanceRegularization.created_at.desc())
        .all()
    )
    regularization_map: dict[int, AttendanceRegularization] = {}
    record_ids: set[int] = set()
    for regularization in pending_regularizations:
        regularization_map.setdefault(regularization.attendance_record_id, regularization)
        record_ids.add(regularization.attendance_record_id)

    stale_records = (
        db.query(AttendanceRecord)
        .filter(
            AttendanceRecord.org_id == org_id,
            AttendanceRecord.factory_id == factory.factory_id,
            AttendanceRecord.attendance_date >= date_from,
            AttendanceRecord.attendance_date <= selected_date,
            (
                (AttendanceRecord.review_status == "pending_review")
                | (
                    AttendanceRecord.punch_in_at.is_not(None)
                    & AttendanceRecord.punch_out_at.is_(None)
                    & (AttendanceRecord.attendance_date < selected_date)
                )
            ),
        )
        .order_by(AttendanceRecord.attendance_date.desc(), AttendanceRecord.created_at.desc())
        .all()
    )
    for record in stale_records:
        record_ids.add(record.id)

    items: list[AttendanceReviewItem] = []
    totals = {
        "pending_records": 0,
        "pending_regularizations": len(pending_regularizations),
        "missed_punch": 0,
        "late": 0,
    }

    records = (
        db.query(AttendanceRecord)
        .filter(AttendanceRecord.id.in_(sorted(record_ids)))
        .order_by(AttendanceRecord.attendance_date.desc(), AttendanceRecord.created_at.desc())
        .all()
        if record_ids
        else []
    )
    for record in records:
        user = user_map.get(record.user_id)
        if not user:
            continue
        profile = profiles.get(record.user_id)
        regularization = regularization_map.get(record.id)
        review_reason = "Pending regularization"
        if record.punch_in_at and record.punch_out_at is None and record.attendance_date < selected_date:
            review_reason = "Missed punch-out needs supervisor closure"
            totals["missed_punch"] += 1
        elif regularization:
            review_reason = regularization.reason
        elif record.review_status == "pending_review":
            review_reason = "Attendance row requires review"
        if record.late_minutes > 0:
            totals["late"] += 1
        items.append(
            AttendanceReviewItem(
                attendance_id=record.id,
                attendance_date=record.attendance_date,
                user_id=user.id,
                user_code=user.user_code,
                name=user.name,
                role=user.role.value,
                department=profile.department if profile else None,
                designation=profile.designation if profile else None,
                shift=record.shift,
                status=record.status,
                review_status="pending_review",
                punch_in_at=record.punch_in_at,
                punch_out_at=record.punch_out_at,
                worked_minutes=record.worked_minutes,
                late_minutes=record.late_minutes,
                overtime_minutes=record.overtime_minutes,
                note=record.note,
                review_reason=review_reason,
                regularization=_serialize_regularization(regularization),
            )
        )

    totals["pending_records"] = len(items)
    return AttendanceReviewResponse(
        attendance_date=selected_date,
        factory_id=factory.factory_id,
        factory_name=factory.name,
        totals=totals,
        items=items,
    )


@router.post("/review/{attendance_id}/approve", response_model=AttendanceReviewItem)
def approve_attendance_review(
    attendance_id: int,
    payload: AttendanceReviewDecisionRequest,
    request: Request,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
) -> AttendanceReviewItem:
    require_any_role(current_user, REPORTING_MANAGER_ALLOWED_ROLES)
    factory = _active_factory_or_400(db, current_user)
    org_id = _active_org_or_400(current_user)
    record = (
        db.query(AttendanceRecord)
        .filter(
            AttendanceRecord.id == attendance_id,
            AttendanceRecord.org_id == org_id,
            AttendanceRecord.factory_id == factory.factory_id,
        )
        .first()
    )
    if not record:
        raise HTTPException(status_code=404, detail="Attendance review record not found.")

    regularization = (
        db.query(AttendanceRegularization)
        .filter(
            AttendanceRegularization.attendance_record_id == record.id,
            AttendanceRegularization.status == "pending",
        )
        .order_by(AttendanceRegularization.created_at.desc())
        .first()
    )
    if payload.regularization_id is not None:
        if not regularization or regularization.id != payload.regularization_id:
            raise HTTPException(status_code=404, detail="Pending regularization not found.")

    factory_tz = _factory_timezone(factory)
    resolved_in = _local_input_to_utc(payload.punch_in_at, factory_tz)
    resolved_out = _local_input_to_utc(payload.punch_out_at, factory_tz)
    if regularization:
        resolved_in = resolved_in or regularization.requested_in_at
        resolved_out = resolved_out or regularization.requested_out_at

    final_status = payload.final_status
    note = sanitize_text(payload.note, max_length=500) if payload.note else None
    template = _shift_template_for_shift(
        db,
        org_id=org_id,
        factory_id=factory.factory_id,
        shift_name=record.shift,
        shift_template_id=record.shift_template_id,
    )

    if final_status == "absent":
        record.punch_in_at = None
        record.punch_out_at = None
        record.worked_minutes = 0
        record.late_minutes = 0
        record.overtime_minutes = 0
        record.status = "absent"
    else:
        if resolved_in is not None:
            record.punch_in_at = resolved_in
        if resolved_out is not None:
            record.punch_out_at = resolved_out
        if not record.punch_in_at:
            raise HTTPException(status_code=422, detail="Punch in time is required to approve attendance.")
        if final_status != "working" and not record.punch_out_at:
            raise HTTPException(status_code=422, detail="Punch out time is required unless the record stays working.")
        _sync_record_metrics(
            record=record,
            factory=factory,
            template=template,
            status_value=final_status or ("completed" if record.punch_out_at else "working"),
        )

    record.review_status = "approved"
    record.approved_by_user_id = current_user.id
    record.approved_at = datetime.now(timezone.utc)
    if note:
        record.note = note
    if regularization:
        regularization.status = "approved"
        regularization.reviewer_note = note
        regularization.reviewed_by_user_id = current_user.id
        regularization.reviewed_at = datetime.now(timezone.utc)

    _write_attendance_audit(
        db,
        current_user=current_user,
        request=request,
        factory_id=factory.factory_id,
        action="ATTENDANCE_REVIEW_APPROVED",
        details=f"attendance_id={record.id}; final_status={record.status}",
    )
    db.commit()
    db.refresh(record)
    profile = _employee_profile_for_user(db, org_id=org_id, factory_id=factory.factory_id, user_id=record.user_id)
    user = db.query(User).filter(User.id == record.user_id).first()
    if not user:
        raise HTTPException(status_code=404, detail="User not found.")
    return AttendanceReviewItem(
        attendance_id=record.id,
        attendance_date=record.attendance_date,
        user_id=user.id,
        user_code=user.user_code,
        name=user.name,
        role=user.role.value,
        department=profile.department if profile else None,
        designation=profile.designation if profile else None,
        shift=record.shift,
        status=record.status,
        review_status=record.review_status,
        punch_in_at=record.punch_in_at,
        punch_out_at=record.punch_out_at,
        worked_minutes=record.worked_minutes,
        late_minutes=record.late_minutes,
        overtime_minutes=record.overtime_minutes,
        note=record.note,
        review_reason="Attendance review approved",
        regularization=_serialize_regularization(regularization),
    )


@router.post("/review/{attendance_id}/reject", response_model=AttendanceReviewItem)
def reject_attendance_review(
    attendance_id: int,
    payload: AttendanceReviewDecisionRequest,
    request: Request,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
) -> AttendanceReviewItem:
    require_any_role(current_user, REPORTING_MANAGER_ALLOWED_ROLES)
    factory = _active_factory_or_400(db, current_user)
    org_id = _active_org_or_400(current_user)
    record = (
        db.query(AttendanceRecord)
        .filter(
            AttendanceRecord.id == attendance_id,
            AttendanceRecord.org_id == org_id,
            AttendanceRecord.factory_id == factory.factory_id,
        )
        .first()
    )
    if not record:
        raise HTTPException(status_code=404, detail="Attendance review record not found.")
    note = sanitize_text(payload.note, max_length=500) if payload.note else None
    if not note:
        raise HTTPException(status_code=422, detail="A rejection note is required.")

    regularization = (
        db.query(AttendanceRegularization)
        .filter(
            AttendanceRegularization.attendance_record_id == record.id,
            AttendanceRegularization.status == "pending",
        )
        .order_by(AttendanceRegularization.created_at.desc())
        .first()
    )
    if payload.regularization_id is not None:
        if not regularization or regularization.id != payload.regularization_id:
            raise HTTPException(status_code=404, detail="Pending regularization not found.")

    record.review_status = "rejected"
    record.note = note
    if regularization:
        regularization.status = "rejected"
        regularization.reviewer_note = note
        regularization.reviewed_by_user_id = current_user.id
        regularization.reviewed_at = datetime.now(timezone.utc)

    _write_attendance_audit(
        db,
        current_user=current_user,
        request=request,
        factory_id=factory.factory_id,
        action="ATTENDANCE_REVIEW_REJECTED",
        details=f"attendance_id={record.id}",
    )
    db.commit()
    db.refresh(record)
    profile = _employee_profile_for_user(db, org_id=org_id, factory_id=factory.factory_id, user_id=record.user_id)
    user = db.query(User).filter(User.id == record.user_id).first()
    if not user:
        raise HTTPException(status_code=404, detail="User not found.")
    return AttendanceReviewItem(
        attendance_id=record.id,
        attendance_date=record.attendance_date,
        user_id=user.id,
        user_code=user.user_code,
        name=user.name,
        role=user.role.value,
        department=profile.department if profile else None,
        designation=profile.designation if profile else None,
        shift=record.shift,
        status=record.status,
        review_status=record.review_status,
        punch_in_at=record.punch_in_at,
        punch_out_at=record.punch_out_at,
        worked_minutes=record.worked_minutes,
        late_minutes=record.late_minutes,
        overtime_minutes=record.overtime_minutes,
        note=record.note,
        review_reason=note,
        regularization=_serialize_regularization(regularization),
    )


@router.get("/reports/summary", response_model=AttendanceReportSummary)
def get_attendance_report_summary(
    date_from: date | None = Query(default=None),
    date_to: date | None = Query(default=None),
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
) -> AttendanceReportSummary:
    require_any_role(
        current_user,
        {UserRole.ACCOUNTANT, UserRole.SUPERVISOR, UserRole.MANAGER, UserRole.ADMIN, UserRole.OWNER},
    )
    factory = _active_factory_or_400(db, current_user)
    org_id = _active_org_or_400(current_user)
    local_now = _factory_now(factory)
    selected_to = date_to or local_now.date()
    selected_from = date_from or (selected_to - timedelta(days=6))
    if selected_from > selected_to:
        raise HTTPException(status_code=422, detail="date_from must be on or before date_to.")

    users = _attendance_users_for_factory(db, factory_id=factory.factory_id, org_id=org_id)
    total_people = len(users)
    records = (
        db.query(AttendanceRecord)
        .filter(
            AttendanceRecord.org_id == org_id,
            AttendanceRecord.factory_id == factory.factory_id,
            AttendanceRecord.attendance_date >= selected_from,
            AttendanceRecord.attendance_date <= selected_to,
        )
        .order_by(AttendanceRecord.attendance_date.asc(), AttendanceRecord.created_at.asc())
        .all()
    )
    by_day: dict[date, list[AttendanceRecord]] = defaultdict(list)
    for record in records:
        by_day[record.attendance_date].append(record)

    days: list[AttendanceReportDay] = []
    totals = {
        "total_people": total_people,
        "present_records": 0,
        "completed_records": 0,
        "pending_review": 0,
        "late_records": 0,
        "overtime_records": 0,
    }
    cursor = selected_from
    while cursor <= selected_to:
        day_records = by_day.get(cursor, [])
        punched_in = sum(1 for record in day_records if record.punch_in_at is not None)
        completed = sum(1 for record in day_records if record.status == "completed")
        pending_review = sum(1 for record in day_records if record.review_status == "pending_review")
        late = sum(1 for record in day_records if record.late_minutes > 0)
        overtime = sum(1 for record in day_records if record.overtime_minutes > 0)
        totals["present_records"] += punched_in
        totals["completed_records"] += completed
        totals["pending_review"] += pending_review
        totals["late_records"] += late
        totals["overtime_records"] += overtime
        days.append(
            AttendanceReportDay(
                attendance_date=cursor,
                total_people=total_people,
                punched_in=punched_in,
                completed=completed,
                not_punched=max(total_people - punched_in, 0),
                pending_review=pending_review,
                late=late,
                overtime=overtime,
            )
        )
        cursor += timedelta(days=1)

    return AttendanceReportSummary(
        factory_id=factory.factory_id,
        factory_name=factory.name,
        date_from=selected_from,
        date_to=selected_to,
        totals=totals,
        days=days,
    )
