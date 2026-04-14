"""Shared trust summary helpers for outbound reports and owner updates."""

from __future__ import annotations

import re
from datetime import date, datetime, time, timezone
from typing import Any

from sqlalchemy.orm import Session

from backend.models.attendance_record import AttendanceRecord
from backend.models.entry import Entry
from backend.models.ocr_verification import OcrVerification
from backend.models.report import AuditLog
from backend.models.user import User, UserRole
from backend.query_helpers import apply_org_scope, apply_role_scope, factory_user_ids_query
from backend.tenancy import resolve_factory_id, resolve_org_id


_ENTRY_APPROVAL_RE = re.compile(r"entry_id=(\d+)")


def _normalize_datetime(value: datetime | None) -> datetime | None:
    if value is None:
        return None
    if value.tzinfo is None:
        return value.replace(tzinfo=timezone.utc)
    return value.astimezone(timezone.utc)


def _day_bounds(start: date, end: date) -> tuple[datetime, datetime]:
    return (
        datetime.combine(start, time.min, tzinfo=timezone.utc),
        datetime.combine(end, time.max, tzinfo=timezone.utc),
    )


def _effective_factory_scope(db: Session, current_user: User, factory_id: str | None = None) -> str | None:
    if current_user.role in {UserRole.ADMIN, UserRole.OWNER}:
        return factory_id
    return resolve_factory_id(db, current_user)


def _user_name_map(db: Session, user_ids: set[int]) -> dict[int, str]:
    if not user_ids:
        return {}
    return {
        user.id: user.name
        for user in db.query(User).filter(User.id.in_(user_ids)).all()
    }


def _shift_label(value: Any) -> str:
    raw = value.value if hasattr(value, "value") else value
    return str(raw or "-")


def get_entry_approval_signoffs(
    db: Session,
    current_user: User,
    entries: list[Entry],
    *,
    factory_id: str | None = None,
) -> dict[int, dict[str, Any]]:
    entry_ids = {entry.id for entry in entries if entry.id}
    if not entry_ids:
        return {}

    query = db.query(AuditLog).filter(AuditLog.action == "ENTRY_APPROVED")
    org_id = resolve_org_id(current_user)
    if org_id:
        query = query.filter(AuditLog.org_id == org_id)
    scoped_factory_id = _effective_factory_scope(db, current_user, factory_id)
    if scoped_factory_id:
        query = query.filter(AuditLog.factory_id == scoped_factory_id)

    signoffs: dict[int, dict[str, Any]] = {}
    approver_ids: set[int] = set()
    for log in query.order_by(AuditLog.timestamp.desc(), AuditLog.id.desc()).all():
        match = _ENTRY_APPROVAL_RE.search(log.details or "")
        if not match:
            continue
        entry_id = int(match.group(1))
        if entry_id not in entry_ids or entry_id in signoffs:
            continue
        approved_at = _normalize_datetime(log.timestamp)
        signoffs[entry_id] = {
            "approved_at": approved_at.isoformat() if approved_at else None,
            "approved_by_user_id": log.user_id,
        }
        if log.user_id:
            approver_ids.add(int(log.user_id))

    approver_map = _user_name_map(db, approver_ids)
    for payload in signoffs.values():
        approver_id = payload.get("approved_by_user_id")
        payload["approved_by_name"] = approver_map.get(int(approver_id)) if approver_id else None
    return signoffs


def build_report_trust_summary(
    db: Session,
    current_user: User,
    *,
    start: date,
    end: date,
    shift: str | None = None,
    factory_id: str | None = None,
) -> dict[str, Any]:
    start_dt, end_dt = _day_bounds(start, end)
    scoped_factory_id = _effective_factory_scope(db, current_user, factory_id)
    normalized_shift = (shift or "").strip().lower() or None

    entry_query = (
        db.query(Entry)
        .filter(Entry.date >= start, Entry.date <= end, Entry.is_active.is_(True))
    )
    entry_query = apply_org_scope(entry_query, current_user)
    entry_query = apply_role_scope(entry_query, db, current_user)
    if scoped_factory_id and current_user.role in {UserRole.ADMIN, UserRole.OWNER}:
        entry_query = entry_query.filter(Entry.factory_id == scoped_factory_id)
    if normalized_shift:
        entry_query = entry_query.filter(Entry.shift == normalized_shift)
    entries = entry_query.order_by(Entry.date.asc(), Entry.created_at.asc()).all()
    entry_signoffs = get_entry_approval_signoffs(db, current_user, entries, factory_id=scoped_factory_id)

    entry_approved = sum(1 for entry in entries if entry.status == "approved")
    entry_rejected = sum(1 for entry in entries if entry.status == "rejected")
    entry_pending = max(len(entries) - entry_approved - entry_rejected, 0)

    entry_register = []
    for entry in entries:
        if entry.status != "approved":
            continue
        approval = entry_signoffs.get(entry.id, {})
        entry_register.append(
            {
                "id": entry.id,
                "label": f"Entry #{entry.id} - {entry.date.isoformat()} {_shift_label(entry.shift).title()}",
                "approved_by_name": approval.get("approved_by_name"),
                "approved_at": approval.get("approved_at"),
            }
        )

    attendance_query = db.query(AttendanceRecord).filter(
        AttendanceRecord.attendance_date >= start,
        AttendanceRecord.attendance_date <= end,
    )
    org_id = resolve_org_id(current_user)
    if org_id:
        attendance_query = attendance_query.filter(AttendanceRecord.org_id == org_id)
    if scoped_factory_id:
        attendance_query = attendance_query.filter(AttendanceRecord.factory_id == scoped_factory_id)
    if normalized_shift:
        attendance_query = attendance_query.filter(AttendanceRecord.shift == normalized_shift)
    if current_user.role == UserRole.OPERATOR:
        attendance_query = attendance_query.filter(AttendanceRecord.user_id == current_user.id)
    elif current_user.role in {UserRole.SUPERVISOR, UserRole.MANAGER}:
        attendance_query = attendance_query.filter(AttendanceRecord.user_id.in_(factory_user_ids_query(db, current_user)))
    attendance_records = attendance_query.order_by(AttendanceRecord.attendance_date.asc(), AttendanceRecord.created_at.asc()).all()

    attendance_pending = sum(1 for record in attendance_records if record.review_status == "pending_review")
    attendance_reviewed = len(attendance_records) - attendance_pending
    attendance_approved_records = [record for record in attendance_records if record.review_status == "approved"]
    attendance_approver_ids = {
        int(record.approved_by_user_id)
        for record in attendance_approved_records
        if record.approved_by_user_id
    }
    attendance_user_ids = {
        int(record.user_id)
        for record in attendance_approved_records
        if record.user_id
    }
    attendance_name_map = _user_name_map(db, attendance_approver_ids | attendance_user_ids)
    attendance_register = []
    for record in attendance_approved_records:
        approved_at = _normalize_datetime(record.approved_at)
        attendance_register.append(
            {
                "id": record.id,
                "label": (
                    f"Attendance - {record.attendance_date.isoformat()} "
                    f"{(record.shift or '-').title()} - {attendance_name_map.get(int(record.user_id), 'Worker')}"
                ),
                "approved_by_name": attendance_name_map.get(int(record.approved_by_user_id))
                if record.approved_by_user_id
                else None,
                "approved_at": approved_at.isoformat() if approved_at else None,
            }
        )

    ocr_query = db.query(OcrVerification).filter(
        OcrVerification.created_at >= start_dt,
        OcrVerification.created_at <= end_dt,
    )
    if org_id:
        ocr_query = ocr_query.filter(OcrVerification.org_id == org_id)
    if scoped_factory_id:
        ocr_query = ocr_query.filter(OcrVerification.factory_id == scoped_factory_id)
    if current_user.role == UserRole.OPERATOR:
        ocr_query = ocr_query.filter(OcrVerification.user_id == current_user.id)
    ocr_records = ocr_query.order_by(OcrVerification.created_at.asc(), OcrVerification.id.asc()).all()

    ocr_approved_records = [record for record in ocr_records if record.status == "approved"]
    ocr_pending = sum(1 for record in ocr_records if record.status in {"draft", "pending"})
    ocr_rejected = sum(1 for record in ocr_records if record.status == "rejected")
    ocr_approver_ids = {
        int(record.approved_by)
        for record in ocr_approved_records
        if record.approved_by
    }
    ocr_name_map = _user_name_map(db, ocr_approver_ids)
    ocr_register = []
    for record in ocr_approved_records:
        approved_at = _normalize_datetime(record.approved_at)
        source_label = (record.source_filename or f"OCR record #{record.id}").strip() or f"OCR record #{record.id}"
        ocr_register.append(
            {
                "id": record.id,
                "label": source_label,
                "approved_by_name": ocr_name_map.get(int(record.approved_by)) if record.approved_by else None,
                "approved_at": approved_at.isoformat() if approved_at else None,
            }
        )

    denominator = len(entries) + len(attendance_records) + len(ocr_records)
    reviewed_numerator = (entry_approved + entry_rejected) + attendance_reviewed + (len(ocr_approved_records) + ocr_rejected)
    overall_trust_score = 100 if denominator == 0 else round((reviewed_numerator * 100) / denominator)

    blocking_reason: str | None = None
    next_action: dict[str, str] | None = None
    if ocr_pending > 0:
        blocking_reason = (
            f"{ocr_pending} OCR record{'s' if ocr_pending != 1 else ''} pending review. "
            "Approve or flag them before sending."
        )
        next_action = {"href": "/ocr/verify", "label": "Open Review Documents"}
    elif entry_pending > 0:
        blocking_reason = (
            f"{entry_pending} shift entr{'ies' if entry_pending != 1 else 'y'} pending review. "
            "Approve or reject them before sending."
        )
        next_action = {"href": "/approvals", "label": "Open Review Queue"}
    elif attendance_pending > 0:
        blocking_reason = (
            f"{attendance_pending} attendance record{'s' if attendance_pending != 1 else ''} pending review. "
            "Review attendance before sending."
        )
        next_action = {"href": "/attendance/review", "label": "Open Attendance Review"}

    can_send = blocking_reason is None
    if denominator == 0:
        confirmation = "No records in this report period. Safe to export the empty state."
    else:
        confirmation = "All records reviewed. Safe to export."

    return {
        "range": {
            "start_date": start.isoformat(),
            "end_date": end.isoformat(),
        },
        "ocr": {
            "approved_count": len(ocr_approved_records),
            "reviewed_count": len(ocr_approved_records) + ocr_rejected,
            "total_count": len(ocr_records),
            "pending_count": ocr_pending,
            "flagged_count": ocr_rejected,
        },
        "shift_entries": {
            "approved_count": entry_approved,
            "reviewed_count": entry_approved + entry_rejected,
            "total_count": len(entries),
            "pending_count": entry_pending,
            "flagged_count": entry_rejected,
        },
        "attendance": {
            "approved_count": len(attendance_approved_records),
            "reviewed_count": attendance_reviewed,
            "total_count": len(attendance_records),
            "pending_count": attendance_pending,
            "status": "reviewed" if attendance_pending == 0 else "not_reviewed",
        },
        "overall_trust_score": overall_trust_score,
        "can_send": can_send,
        "blocking_reason": blocking_reason,
        "confirmation": confirmation,
        "next_action": next_action,
        "approval_register": {
            "ocr": ocr_register,
            "shift_entries": entry_register,
            "attendance": attendance_register,
        },
    }


def evaluate_report_trust_gate(
    db: Session,
    current_user: User,
    *,
    route: str,
    start: date,
    end: date,
    shift: str | None = None,
    factory_id: str | None = None,
) -> dict[str, Any]:
    summary = build_report_trust_summary(
        db,
        current_user,
        start=start,
        end=end,
        shift=shift,
        factory_id=factory_id,
    )
    try:
        from backend.services.product_analytics import track_product_event

        track_product_event(
            event_name="report_trust_gate_evaluated",
            current_user=current_user,
            properties={
                "route": route,
                "user_role": current_user.role.value if hasattr(current_user.role, "value") else str(current_user.role),
                "period_start": start.isoformat(),
                "period_end": end.isoformat(),
                "passed": bool(summary["can_send"]),
                "block_reason": summary["blocking_reason"],
                "ocr_approved": int(summary["ocr"]["approved_count"]),
                "ocr_total": int(summary["ocr"]["total_count"]),
                "shift_approved": int(summary["shift_entries"]["approved_count"]),
                "shift_total": int(summary["shift_entries"]["total_count"]),
                "attendance_reviewed": summary["attendance"]["status"] == "reviewed",
                "trust_score": float(summary["overall_trust_score"]),
            },
        )
    except Exception:
        # Tracking stays best-effort and must not interfere with send/export flows.
        pass
    return summary
