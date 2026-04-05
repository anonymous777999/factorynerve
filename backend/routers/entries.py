"""Entries API router for DPR data operations."""

from __future__ import annotations

import logging
import os
from typing import Any
from datetime import date, datetime, timedelta, timezone

from fastapi import APIRouter, BackgroundTasks, Depends, File, Form, HTTPException, Query, Request, Response, UploadFile, status
from pydantic import BaseModel, ConfigDict, Field, field_validator
from sqlalchemy import case, func
from sqlalchemy.orm import Session, selectinload

from backend.cache import delete_prefix
from backend.ai_engine import (
    build_summary_prompt,
    compute_confidence,
    estimate_tokens,
    generate_entry_summary,
    parse_unstructured_input,
    parse_unstructured_input_ai,
    parse_unstructured_input_with_confidence,
)
from backend.database import get_db, hash_ip_address, SessionLocal
from backend.models.alert import Alert
from backend.models.entry import Entry, ShiftType
from backend.models.report import AuditLog
from backend.models.user import User, UserRole
from backend.models.user_factory_role import UserFactoryRole
from backend.security import get_current_user
from backend.rbac import require_role
from backend.plans import normalize_plan, plan_rank, get_org_plan
from backend.feature_limits import check_and_record_org_feature_usage
from backend.ai_rate_limit import check_rate_limit, RateLimitError
from backend.utils import check_entry_alerts, parse_whatsapp_export, sanitize_text, save_failed_payload
from backend.services import ai_router
from backend.services.background_jobs import create_job, register_retry_handler, start_job
from backend.services.whatsapp import notify_entry_alerts
from backend.tenancy import resolve_factory_id, resolve_org_id
from backend.query_helpers import apply_role_scope, can_view_entry, factory_user_ids_query


logger = logging.getLogger(__name__)
router = APIRouter(tags=["Entries"])

ALLOWED_ENTRY_STATUSES = {"submitted", "approved", "rejected"}


def _invalidate_entry_related_cache(entry: Entry | None = None, *, org_id: str | None = None, user_id: int | None = None) -> None:
    scoped_org_id = org_id or (entry.org_id if entry else None)
    if scoped_org_id:
        delete_prefix(f"org:{scoped_org_id}:")
        return
    scoped_user_id = user_id or (entry.user_id if entry else None)
    if scoped_user_id:
        delete_prefix(f"org:personal:analytics:{scoped_user_id}:")
        delete_prefix(f"org:personal:reports:{scoped_user_id}:")
        delete_prefix(f"org:personal:ai:{scoped_user_id}:")


class EntryCreateRequest(BaseModel):
    date: date
    shift: ShiftType
    client_request_id: str | None = Field(default=None, min_length=8, max_length=64)
    units_target: int = Field(gt=0)
    units_produced: int = Field(gt=0)
    manpower_present: int = Field(gt=0)
    manpower_absent: int = Field(ge=0)
    downtime_minutes: int = Field(ge=0)
    downtime_reason: str | None = Field(default=None, max_length=500)
    department: str | None = Field(default=None, max_length=120)
    materials_used: str | None = None
    quality_issues: bool = False
    quality_details: str | None = None
    notes: str | None = Field(default=None, max_length=1000)

    @field_validator("date")
    @classmethod
    def date_not_future(cls, value: date) -> date:
        if value > date.today():
            raise ValueError("Date cannot be in the future.")
        return value


class EntryUpdateRequest(BaseModel):
    units_target: int | None = Field(default=None, gt=0)
    units_produced: int | None = Field(default=None, gt=0)
    manpower_present: int | None = Field(default=None, gt=0)
    manpower_absent: int | None = Field(default=None, ge=0)
    downtime_minutes: int | None = Field(default=None, ge=0)
    downtime_reason: str | None = Field(default=None, max_length=500)
    department: str | None = Field(default=None, max_length=120)
    materials_used: str | None = None
    quality_issues: bool | None = None
    quality_details: str | None = None
    notes: str | None = Field(default=None, max_length=1000)


class EntryResponse(BaseModel):
    id: int
    user_id: int
    submitted_by: str | None = None
    date: date
    shift: ShiftType
    client_request_id: str | None = None
    units_target: int
    units_produced: int
    manpower_present: int
    manpower_absent: int
    downtime_minutes: int
    downtime_reason: str | None
    department: str | None
    materials_used: str | None
    quality_issues: bool
    quality_details: str | None
    notes: str | None
    ai_summary: str | None
    summary_job_id: str | None = None
    status: str
    is_active: bool
    created_at: datetime
    updated_at: datetime

    model_config = ConfigDict(from_attributes=True)


class EntryListResponse(BaseModel):
    items: list[EntryResponse]
    total: int
    page: int
    page_size: int


class SmartInputResponse(BaseModel):
    extracted_fields: dict
    confidence: float | None = None
    ai_used: bool = False
    missing_fields: list[str] = []
    ai_error: str | None = None


class EntrySummaryMeta(BaseModel):
    entry_id: int
    last_regenerated_at: datetime | None
    estimated_tokens: int
    provider: str
    plan: str
    can_regenerate: bool
    min_plan: str


class EntryReviewRequest(BaseModel):
    reason: str | None = Field(default=None, max_length=500)


def _write_audit_log(db: Session, *, user_id: int | None, action: str, details: str, request: Request) -> None:
    org_id = getattr(request.state, "org_id", None)
    factory_id = getattr(request.state, "factory_id", None)
    db.add(
        AuditLog(
            user_id=user_id,
            org_id=org_id,
            factory_id=factory_id,
            action=action,
            details=details,
            ip_address=hash_ip_address(request.client.host if request.client else None),
            user_agent=request.headers.get("user-agent"),
            timestamp=datetime.now(timezone.utc),
        )
    )


def _record_entry_review(entry_id: int, reviewer_id: int) -> None:
    db = SessionLocal()
    try:
        db.add(
            AuditLog(
                user_id=reviewer_id,
                action="ENTRY_REVIEWED",
                details=f"entry_id={entry_id}",
                ip_address=None,
                timestamp=datetime.now(timezone.utc),
            )
        )
        db.commit()
    finally:
        db.close()


def _factory_user_ids_query(db: Session, current_user: User):
    return factory_user_ids_query(db, current_user)


def _apply_role_filter(query: Any, db: Session, current_user: User) -> Any:
    if current_user.role == UserRole.ACCOUNTANT:
        raise HTTPException(status_code=403, detail="Accountant role cannot access raw entries.")
    if current_user.role == UserRole.ATTENDANCE:
        raise HTTPException(status_code=403, detail="Attendance role cannot access entries.")
    return apply_role_scope(query, db, current_user)


def _can_view_entry(db: Session, current_user: User, entry: Entry) -> bool:
    if current_user.role in {UserRole.ACCOUNTANT, UserRole.ATTENDANCE}:
        return False
    return can_view_entry(db, current_user, entry)


def _to_utc(dt: datetime) -> datetime:
    if dt.tzinfo is None:
        return dt.replace(tzinfo=timezone.utc)
    return dt.astimezone(timezone.utc)


def _is_entry_reviewed(db: Session, entry_id: int) -> bool:
    return (
        db.query(AuditLog)
        .filter(AuditLog.action == "ENTRY_REVIEWED", AuditLog.details == f"entry_id={entry_id}")
        .first()
        is not None
    )


def _normalize_status_values(values: list[str]) -> list[str]:
    normalized: list[str] = []
    for raw in values:
        key = str(raw or "").strip().lower()
        if not key:
            continue
        if key not in ALLOWED_ENTRY_STATUSES:
            raise HTTPException(status_code=400, detail=f"Unknown status '{raw}'.")
        normalized.append(key)
    return normalized


def _generate_summary_task(entry_id: int) -> None:
    try:
        _run_entry_summary_job(lambda *_args, **_kwargs: None, entry_id=entry_id)
    except RateLimitError as error:
        logger.warning("Summary job rate limited for entry %s: %s", entry_id, error.detail)
    except HTTPException as error:
        logger.info("Summary job blocked for entry %s: %s", entry_id, error.detail)
    except Exception:  # pylint: disable=broad-except
        logger.exception("Summary job failed for entry %s.", entry_id)


def _run_entry_summary_job(progress, *, entry_id: int, consume_quota: bool = True) -> dict[str, Any]:
    with SessionLocal() as db:
        entry = db.query(Entry).filter(Entry.id == entry_id, Entry.is_active.is_(True)).first()
        if not entry:
            raise RuntimeError("Entry not found for summary job.")
        progress(20, "Loading entry context")
        org_id = entry.org_id
        plan = get_org_plan(db, org_id=org_id, fallback_user_id=entry.user_id)
        if consume_quota:
            check_rate_limit(entry.user_id, feature="summary")
            if org_id:
                check_and_record_org_feature_usage(db, org_id=org_id, feature="summary", plan=plan)
        progress(70, "Generating AI summary")
        entry.ai_summary = generate_entry_summary(
            _summary_payload(entry),
            scope=_summary_scope(entry),
        )
        db.add(
            AuditLog(
                user_id=entry.user_id,
                org_id=entry.org_id,
                factory_id=entry.factory_id,
                action="ENTRY_SUMMARY_GENERATED",
                details=f"Entry summary generated: id={entry.id}",
                ip_address=None,
                timestamp=datetime.now(timezone.utc),
            )
        )
        db.commit()
        db.refresh(entry)
        _invalidate_entry_related_cache(entry)
        return {
            "entry_id": entry.id,
            "summary_ready": True,
            "summary_preview": (entry.ai_summary or "")[:180],
        }


def _queue_entry_summary_job(
    *,
    entry_id: int,
    owner_id: int,
    org_id: str | None,
    consume_quota: bool = True,
) -> dict[str, Any]:
    job = create_job(
        kind="entry_summary",
        owner_id=owner_id,
        org_id=org_id,
        message=f"Queued AI summary for entry #{entry_id}",
        context={
            "route": f"/entry/{entry_id}",
            "entry_id": entry_id,
        },
        retry_context={
            "entry_id": entry_id,
            "owner_id": owner_id,
            "org_id": org_id,
            "consume_quota": False,
        },
    )
    start_job(
        job["job_id"],
        lambda progress: _run_entry_summary_job(progress, entry_id=entry_id, consume_quota=consume_quota),
    )
    return job


def _retry_entry_summary_job(payload: dict[str, Any], _source_job: dict[str, Any]) -> dict[str, Any]:
    entry_id = int(payload.get("entry_id") or 0)
    if entry_id <= 0:
        raise RuntimeError("Entry ID is missing from the original summary job.")
    return _queue_entry_summary_job(
        entry_id=entry_id,
        owner_id=int(payload["owner_id"]),
        org_id=str(payload["org_id"]) if payload.get("org_id") is not None else None,
        consume_quota=bool(payload.get("consume_quota")),
    )


register_retry_handler("entry_summary", _retry_entry_summary_job)


def _should_generate_summary() -> bool:
    if os.getenv("DPR_DISABLE_AI_SUMMARY") == "1":
        return False
    if os.getenv("PYTEST_CURRENT_TEST"):
        return False
    return True


def _summary_payload(entry: Entry) -> dict[str, Any]:
    return {
        "date": entry.date.isoformat() if entry.date else None,
        "shift": entry.shift,
        "units_produced": entry.units_produced,
        "units_target": entry.units_target,
        "manpower_present": entry.manpower_present,
        "manpower_absent": entry.manpower_absent,
        "downtime_minutes": entry.downtime_minutes,
        "downtime_reason": entry.downtime_reason,
        "department": entry.department,
        "materials_used": entry.materials_used,
        "quality_issues": entry.quality_issues,
        "quality_details": entry.quality_details,
        "notes": entry.notes,
    }


def _summary_scope(entry: Entry) -> str:
    if entry.org_id:
        return f"org:{entry.org_id}"
    return f"user:{entry.user_id}"


def _summary_min_plan() -> str:
    raw = (os.getenv("SUMMARY_REGEN_MIN_PLAN") or "free").strip().lower()
    return normalize_plan(raw)


def _can_regenerate_summary(plan: str) -> bool:
    min_plan = _summary_min_plan()
    return plan_rank(plan) >= plan_rank(min_plan)


def _last_summary_timestamp(db: Session, entry_id: int) -> datetime | None:
    last_log = (
        db.query(AuditLog)
        .filter(
            AuditLog.action.in_(["ENTRY_SUMMARY_REGENERATED", "ENTRY_SUMMARY_GENERATED"]),
            AuditLog.details.like(f"%id={entry_id}%"),
        )
        .order_by(AuditLog.timestamp.desc())
        .first()
    )
    return last_log.timestamp if last_log else None


@router.post("/smart", response_model=SmartInputResponse)
async def parse_smart_input(
    raw_text: str | None = Form(default=None),
    upload_file: UploadFile | None = File(default=None),
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
) -> SmartInputResponse:
    if current_user.role == UserRole.ACCOUNTANT:
        raise HTTPException(status_code=403, detail="Accountant role cannot use smart input.")
    if current_user.role == UserRole.ATTENDANCE:
        raise HTTPException(status_code=403, detail="Attendance role cannot use smart input.")
    text_data = (raw_text or "").strip()
    if upload_file is not None:
        if not upload_file.filename.lower().endswith(".txt"):
            raise HTTPException(status_code=400, detail="Only .txt files are supported.")
        file_content = await upload_file.read()
        if len(file_content) > 1_000_000:
            raise HTTPException(status_code=413, detail="File too large. Max 1MB.")
        try:
            text_data = f"{text_data}\n{file_content.decode('utf-8', errors='ignore')}".strip()
        except Exception as error:  # pylint: disable=broad-except
            raise HTTPException(status_code=400, detail="Could not read uploaded file.") from error

    if not text_data:
        raise HTTPException(status_code=400, detail="Please provide raw_text or upload a .txt file.")
    if len(text_data) > 10000:
        raise HTTPException(status_code=413, detail="Input too long. Please shorten.")
    org_id = resolve_org_id(current_user)
    plan = get_org_plan(db, org_id=org_id, fallback_user_id=current_user.id)
    if org_id:
        check_and_record_org_feature_usage(db, org_id=org_id, feature="smart", plan=plan)

    cleaned_text = parse_whatsapp_export(text_data) or text_data
    extracted, meta = parse_unstructured_input_with_confidence(cleaned_text)
    confidence = float(meta.get("confidence") or 0)
    missing_fields = list(meta.get("missing_fields") or [])

    threshold = float(os.getenv("SMART_INPUT_CONFIDENCE_THRESHOLD", "0.6"))
    ai_used = False
    ai_error: str | None = None
    if confidence < threshold and os.getenv("SMART_INPUT_AI_FALLBACK", "1") == "1":
        ai_extracted, ai_error = parse_unstructured_input_ai(cleaned_text)
        if ai_extracted:
            for key, value in ai_extracted.items():
                if value not in (None, ""):
                    extracted[key] = value
            confidence, missing_fields = compute_confidence(extracted)
            ai_used = True
            ai_error = None

    db.add(
        AuditLog(
            user_id=current_user.id,
            action="SMART_INPUT_USED",
            details="Smart input parsed.",
            ip_address=None,
            timestamp=datetime.now(timezone.utc),
        )
    )
    db.commit()

    return SmartInputResponse(
        extracted_fields=extracted,
        confidence=confidence,
        ai_used=ai_used,
        missing_fields=missing_fields,
        ai_error=ai_error,
    )


@router.post("", response_model=EntryResponse, status_code=status.HTTP_201_CREATED)
def create_entry(
    payload: EntryCreateRequest,
    request: Request,
    response: Response,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
) -> EntryResponse:
    if current_user.role == UserRole.ACCOUNTANT:
        raise HTTPException(status_code=403, detail="Accountant role cannot create entries.")
    if current_user.role == UserRole.ATTENDANCE:
        raise HTTPException(status_code=403, detail="Attendance role cannot create entries.")
    org_id = resolve_org_id(current_user)
    factory_id = resolve_factory_id(db, current_user)
    request.state.org_id = org_id
    request.state.factory_id = factory_id
    if payload.client_request_id:
        existing_by_request = (
            db.query(Entry)
            .filter(
                Entry.user_id == current_user.id,
                Entry.client_request_id == payload.client_request_id,
                Entry.is_active.is_(True),
            )
        )
        if factory_id:
            existing_by_request = existing_by_request.filter(Entry.factory_id == factory_id)
        elif org_id:
            existing_by_request = existing_by_request.filter(Entry.org_id == org_id)
        existing_by_request = existing_by_request.first()
        if existing_by_request:
            response.status_code = status.HTTP_200_OK
            return existing_by_request

    duplicate_query = db.query(Entry).filter(
        Entry.date == payload.date,
        Entry.shift == payload.shift,
        Entry.is_active.is_(True),
    )
    if factory_id:
        duplicate_query = duplicate_query.filter(Entry.factory_id == factory_id)
    elif org_id:
        duplicate_query = duplicate_query.filter(Entry.org_id == org_id)
    else:
        duplicate_query = duplicate_query.filter(Entry.user_id == current_user.id)

    duplicate = duplicate_query.order_by(Entry.created_at.desc()).first()
    if duplicate:
        raise HTTPException(
            status_code=409,
            detail={"message": "Entry already exists for date and shift.", "entry_id": duplicate.id},
        )
    try:
        data = payload.model_dump()
        data["downtime_reason"] = sanitize_text(data.get("downtime_reason"), max_length=500)
        department_value = sanitize_text(data.get("department"), max_length=120, preserve_newlines=False)
        if not department_value:
            department_value = current_user.role.value.title()
        data["department"] = department_value
        data["materials_used"] = sanitize_text(data.get("materials_used"), max_length=1000)
        data["quality_details"] = sanitize_text(data.get("quality_details"), max_length=1000)
        data["notes"] = sanitize_text(data.get("notes"), max_length=1000)
        entry = Entry(
            user_id=current_user.id,
            org_id=org_id,
            factory_id=factory_id,
            status="submitted",
            **data,
        )
        db.add(entry)
        db.flush()
        _write_audit_log(db, user_id=current_user.id, action="ENTRY_CREATED", details=f"Entry created: id={entry.id}", request=request)
        alert_payloads = check_entry_alerts(entry)
        for alert in alert_payloads:
            db.add(
                Alert(
                    entry_id=entry.id,
                    user_id=current_user.id,
                    alert_type=alert["type"],
                    message=alert["message"],
                    severity=alert["severity"],
                    is_read=False,
                )
            )
        db.commit()
        if alert_payloads:
            notify_entry_alerts(entry, alert_payloads)
        db.refresh(entry)
        _invalidate_entry_related_cache(entry)
        summary_job_id = None
        if _should_generate_summary():
            summary_job = _queue_entry_summary_job(
                entry_id=entry.id,
                owner_id=current_user.id,
                org_id=entry.org_id,
            )
            summary_job_id = summary_job["job_id"]
        return EntryResponse.model_validate(entry).model_copy(update={"summary_job_id": summary_job_id})
    except Exception as error:  # pylint: disable=broad-except
        db.rollback()
        save_failed_payload(
            "entry_create",
            {
                "user_id": current_user.id,
                "org_id": resolve_org_id(current_user),
                "factory_id": resolve_factory_id(db, current_user),
                "payload": data if "data" in locals() else payload.model_dump(),
            },
            reason=str(error),
        )
        logger.exception("Failed to create entry.")
        raise HTTPException(status_code=500, detail="Database error. Entry saved locally for retry.") from error


@router.get("", response_model=EntryListResponse)
def list_entries(
    date_filter: date | None = Query(default=None, alias="date"),
    start_date: date | None = Query(default=None),
    end_date: date | None = Query(default=None),
    shift: list[ShiftType] | None = Query(default=None),
    user_id: int | None = None,
    search: str | None = None,
    has_issues: bool | None = None,
    min_performance: float | None = None,
    max_performance: float | None = None,
    status_filter: list[str] | None = Query(default=None, alias="status"),
    sort_by: str | None = None,
    page: int = Query(default=1, ge=1),
    page_size: int = Query(default=10, ge=1, le=50),
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
) -> EntryListResponse:
    query = db.query(Entry).options(selectinload(Entry.user)).filter(Entry.is_active.is_(True))
    org_id = resolve_org_id(current_user)
    if org_id:
        query = query.filter(Entry.org_id == org_id)
    query = _apply_role_filter(query, db, current_user)
    if user_id is not None:
        if current_user.role == UserRole.MANAGER:
            factory_id = resolve_factory_id(db, current_user)
            allowed = (
                db.query(User.id)
                .join(UserFactoryRole, UserFactoryRole.user_id == User.id)
                .filter(User.id == user_id, User.is_active.is_(True))
            )
            if factory_id:
                allowed = allowed.filter(UserFactoryRole.factory_id == factory_id)
            if org_id:
                allowed = allowed.filter(User.org_id == org_id)
            allowed = allowed.first()
            if not allowed:
                raise HTTPException(status_code=403, detail="Access denied.")
        query = query.filter(Entry.user_id == user_id)

    if date_filter is not None:
        query = query.filter(Entry.date == date_filter)
    else:
        if start_date is not None:
            query = query.filter(Entry.date >= start_date)
        if end_date is not None:
            query = query.filter(Entry.date <= end_date)
    if shift:
        query = query.filter(Entry.shift.in_(shift))
    if status_filter:
        statuses = _normalize_status_values(status_filter)
        if statuses:
            query = query.filter(Entry.status.in_(statuses))

    performance_expr = case(
        (Entry.units_target > 0, (Entry.units_produced * 100.0) / Entry.units_target),
        else_=0.0,
    )
    if min_performance is not None:
        query = query.filter(performance_expr >= min_performance)
    if max_performance is not None:
        query = query.filter(performance_expr <= max_performance)

    if has_issues is not None:
        has_downtime = Entry.downtime_minutes > 0
        has_reason = func.trim(func.coalesce(Entry.downtime_reason, "")) != ""
        has_quality = Entry.quality_issues.is_(True)
        if has_issues:
            query = query.filter(has_downtime | has_reason | has_quality)
        else:
            query = query.filter(~(has_downtime | has_reason | has_quality))

    sort_key = (sort_by or "date").lower()
    sort_dir = "desc"
    if sort_key.endswith("_asc"):
        sort_dir = "asc"
        sort_key = sort_key[:-4]
    elif sort_key.endswith("_desc"):
        sort_dir = "desc"
        sort_key = sort_key[:-5]

    if sort_key == "performance":
        order_col = performance_expr
    elif sort_key == "downtime":
        order_col = Entry.downtime_minutes
    else:
        order_col = Entry.date
    order_clause = order_col.asc() if sort_dir == "asc" else order_col.desc()

    if search:
        search_value = f"%{search.lower().strip()}%"
        query = query.filter(
            func.lower(func.coalesce(Entry.notes, "")).like(search_value)
            | func.lower(func.coalesce(Entry.downtime_reason, "")).like(search_value)
        )
    total = query.with_entities(func.count(Entry.id)).scalar() or 0
    offset = (page - 1) * page_size
    items = query.order_by(order_clause, Entry.created_at.desc()).offset(offset).limit(page_size).all()
    return EntryListResponse(items=items, total=total, page=page, page_size=page_size)


@router.post("/{entry_id}/approve", response_model=EntryResponse)
def approve_entry(
    entry_id: int,
    request: Request,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
) -> EntryResponse:
    require_role(current_user, UserRole.SUPERVISOR)
    entry = db.query(Entry).filter(Entry.id == entry_id, Entry.is_active.is_(True)).first()
    if not entry:
        raise HTTPException(status_code=404, detail="Entry not found.")
    if not _can_view_entry(db, current_user, entry):
        raise HTTPException(status_code=403, detail="Access denied.")
    entry.status = "approved"
    request.state.org_id = entry.org_id or resolve_org_id(current_user)
    request.state.factory_id = entry.factory_id or resolve_factory_id(db, current_user)
    try:
        _write_audit_log(
            db,
            user_id=current_user.id,
            action="ENTRY_APPROVED",
            details=f"entry_id={entry.id}",
            request=request,
        )
        db.commit()
        db.refresh(entry)
        _invalidate_entry_related_cache(entry)
        return entry
    except Exception as error:  # pylint: disable=broad-except
        db.rollback()
        logger.exception("Failed to approve entry.")
        raise HTTPException(status_code=500, detail="Could not approve entry.") from error


@router.post("/{entry_id}/reject", response_model=EntryResponse)
def reject_entry(
    entry_id: int,
    payload: EntryReviewRequest,
    request: Request,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
) -> EntryResponse:
    require_role(current_user, UserRole.SUPERVISOR)
    entry = db.query(Entry).filter(Entry.id == entry_id, Entry.is_active.is_(True)).first()
    if not entry:
        raise HTTPException(status_code=404, detail="Entry not found.")
    if not _can_view_entry(db, current_user, entry):
        raise HTTPException(status_code=403, detail="Access denied.")
    entry.status = "rejected"
    reason = sanitize_text(payload.reason, max_length=500, preserve_newlines=False) if payload else None
    detail = f"entry_id={entry.id}"
    if reason:
        detail = f"{detail}; reason={reason}"
    request.state.org_id = entry.org_id or resolve_org_id(current_user)
    request.state.factory_id = entry.factory_id or resolve_factory_id(db, current_user)
    try:
        _write_audit_log(
            db,
            user_id=current_user.id,
            action="ENTRY_REJECTED",
            details=detail,
            request=request,
        )
        db.commit()
        db.refresh(entry)
        _invalidate_entry_related_cache(entry)
        return entry
    except Exception as error:  # pylint: disable=broad-except
        db.rollback()
        logger.exception("Failed to reject entry.")
        raise HTTPException(status_code=500, detail="Could not reject entry.") from error


@router.get("/today", response_model=list[EntryResponse])
def get_today_entries(db: Session = Depends(get_db), current_user: User = Depends(get_current_user)) -> list[EntryResponse]:
    today = date.today()
    query = db.query(Entry).options(selectinload(Entry.user)).filter(Entry.date == today, Entry.is_active.is_(True))
    org_id = resolve_org_id(current_user)
    if org_id:
        query = query.filter(Entry.org_id == org_id)
    query = _apply_role_filter(query, db, current_user)
    return query.order_by(Entry.created_at.desc()).all()


@router.get("/{entry_id}", response_model=EntryResponse)
def get_entry(
    entry_id: int,
    background_tasks: BackgroundTasks,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
) -> EntryResponse:
    entry = (
        db.query(Entry)
        .options(selectinload(Entry.user))
        .filter(Entry.id == entry_id, Entry.is_active.is_(True))
        .first()
    )
    if not entry:
        raise HTTPException(status_code=404, detail="Entry not found.")
    if not _can_view_entry(db, current_user, entry):
        raise HTTPException(status_code=403, detail="Access denied.")
    if current_user.role in {UserRole.SUPERVISOR, UserRole.MANAGER, UserRole.ADMIN, UserRole.OWNER}:
        owner = db.query(User).filter(User.id == entry.user_id).first()
        if owner and owner.role == UserRole.OPERATOR and entry.user_id != current_user.id:
            background_tasks.add_task(_record_entry_review, entry.id, current_user.id)
    return entry


@router.get("/{entry_id}/summary-meta", response_model=EntrySummaryMeta)
def get_entry_summary_meta(
    entry_id: int,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
) -> EntrySummaryMeta:
    entry = db.query(Entry).filter(Entry.id == entry_id, Entry.is_active.is_(True)).first()
    if not entry:
        raise HTTPException(status_code=404, detail="Entry not found.")
    if not _can_view_entry(db, current_user, entry):
        raise HTTPException(status_code=403, detail="Access denied.")

    org_id = resolve_org_id(current_user)
    plan = get_org_plan(db, org_id=org_id, fallback_user_id=current_user.id)
    prompt = build_summary_prompt(_summary_payload(entry))
    return EntrySummaryMeta(
        entry_id=entry.id,
        last_regenerated_at=_last_summary_timestamp(db, entry.id),
        estimated_tokens=estimate_tokens(prompt),
        provider=ai_router.primary_provider_label(),
        plan=plan,
        can_regenerate=_can_regenerate_summary(plan),
        min_plan=_summary_min_plan(),
    )


@router.post("/{entry_id}/summary-jobs")
def queue_entry_summary(
    entry_id: int,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
) -> dict[str, Any]:
    entry = db.query(Entry).filter(Entry.id == entry_id, Entry.is_active.is_(True)).first()
    if not entry:
        raise HTTPException(status_code=404, detail="Entry not found.")
    if not _can_view_entry(db, current_user, entry):
        raise HTTPException(status_code=403, detail="Access denied.")
    org_id = resolve_org_id(current_user)
    plan = get_org_plan(db, org_id=org_id, fallback_user_id=current_user.id)
    if not _can_regenerate_summary(plan):
        raise HTTPException(
            status_code=403,
            detail=f"AI summaries are not available on the {plan.title()} plan. Upgrade to {_summary_min_plan().title()} or higher to unlock this.",
        )
    return _queue_entry_summary_job(
        entry_id=entry.id,
        owner_id=current_user.id,
        org_id=entry.org_id,
    )


@router.post("/{entry_id}/summary", response_model=EntryResponse)
def regenerate_entry_summary(
    entry_id: int,
    request: Request,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
) -> EntryResponse:
    entry = db.query(Entry).filter(Entry.id == entry_id, Entry.is_active.is_(True)).first()
    if not entry:
        raise HTTPException(status_code=404, detail="Entry not found.")
    if not _can_view_entry(db, current_user, entry):
        raise HTTPException(status_code=403, detail="Access denied.")
    org_id = resolve_org_id(current_user)
    plan = get_org_plan(db, org_id=org_id, fallback_user_id=current_user.id)
    if not _can_regenerate_summary(plan):
        raise HTTPException(
            status_code=403,
            detail=f"AI summaries are not available on the {plan.title()} plan. Upgrade to {_summary_min_plan().title()} or higher to unlock this.",
        )
    if org_id:
        check_and_record_org_feature_usage(db, org_id=org_id, feature="summary", plan=plan)
    try:
        entry.ai_summary = generate_entry_summary(
            _summary_payload(entry),
            scope=_summary_scope(entry),
        )
        _write_audit_log(
            db,
            user_id=current_user.id,
            action="ENTRY_SUMMARY_REGENERATED",
            details=f"Entry summary regenerated: id={entry.id}",
            request=request,
        )
        db.commit()
        db.refresh(entry)
        _invalidate_entry_related_cache(entry)
        return entry
    except Exception as error:  # pylint: disable=broad-except
        db.rollback()
        save_failed_payload(
            "entry_summary_regenerate",
            {"entry_id": entry.id, "user_id": current_user.id},
            reason=str(error),
        )
        logger.exception("Failed to regenerate summary.")
        raise HTTPException(status_code=500, detail="Could not regenerate summary.") from error


@router.put("/{entry_id}", response_model=EntryResponse)
def update_entry(
    entry_id: int,
    payload: EntryUpdateRequest,
    request: Request,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
) -> EntryResponse:
    entry = db.query(Entry).filter(Entry.id == entry_id, Entry.is_active.is_(True)).first()
    if not entry:
        raise HTTPException(status_code=404, detail="Entry not found.")
    if current_user.role == UserRole.ACCOUNTANT:
        raise HTTPException(status_code=403, detail="Accountant role cannot edit entries.")
    if entry.user_id != current_user.id:
        if current_user.role in {UserRole.MANAGER, UserRole.ADMIN, UserRole.OWNER}:
            if not _can_view_entry(db, current_user, entry):
                raise HTTPException(status_code=403, detail="Access denied.")
        else:
            raise HTTPException(status_code=403, detail="Only entry owner can edit.")
    if current_user.role == UserRole.OPERATOR:
        if entry.date != date.today():
            raise HTTPException(status_code=403, detail="Operator can edit entries only on the same day.")
        if _is_entry_reviewed(db, entry.id):
            raise HTTPException(status_code=403, detail="Entry locked after supervisor review.")
    else:
        if datetime.now(timezone.utc) - _to_utc(entry.created_at) > timedelta(hours=24):
            raise HTTPException(status_code=403, detail="Entry cannot be edited after 24 hours.")

    updates = payload.model_dump(exclude_none=True)
    if "downtime_reason" in updates:
        updates["downtime_reason"] = sanitize_text(updates.get("downtime_reason"), max_length=500)
    if "department" in updates:
        updates.pop("department", None)
    if "materials_used" in updates:
        updates["materials_used"] = sanitize_text(updates.get("materials_used"), max_length=1000)
    if "quality_details" in updates:
        updates["quality_details"] = sanitize_text(updates.get("quality_details"), max_length=1000)
    if "notes" in updates:
        updates["notes"] = sanitize_text(updates.get("notes"), max_length=1000)
    for key, value in updates.items():
        setattr(entry, key, value)

    try:
        _write_audit_log(db, user_id=current_user.id, action="ENTRY_UPDATED", details=f"Entry updated: id={entry.id}", request=request)
        db.commit()
        db.refresh(entry)
        _invalidate_entry_related_cache(entry)
        return entry
    except Exception as error:  # pylint: disable=broad-except
        db.rollback()
        save_failed_payload("entry_update", {"entry_id": entry.id, "user_id": current_user.id, "payload": updates}, reason=str(error))
        logger.exception("Failed to update entry.")
        raise HTTPException(status_code=500, detail="Database error. Update saved locally for retry.") from error


@router.delete("/{entry_id}")
def delete_entry(
    entry_id: int,
    request: Request,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
) -> dict[str, str]:
    require_role(current_user, UserRole.MANAGER)
    entry = db.query(Entry).filter(Entry.id == entry_id, Entry.is_active.is_(True)).first()
    if not entry:
        raise HTTPException(status_code=404, detail="Entry not found.")
    if current_user.role == UserRole.MANAGER and not _can_view_entry(db, current_user, entry):
        raise HTTPException(status_code=403, detail="Access denied.")
    try:
        entry.is_active = False
        _write_audit_log(db, user_id=current_user.id, action="ENTRY_DELETED", details=f"Entry soft deleted: id={entry.id}", request=request)
        db.commit()
        _invalidate_entry_related_cache(entry)
        return {"message": "Entry deleted successfully."}
    except Exception as error:  # pylint: disable=broad-except
        db.rollback()
        logger.exception("Failed to delete entry.")
        raise HTTPException(status_code=500, detail="Could not delete entry.") from error
