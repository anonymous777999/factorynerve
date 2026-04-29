"""Reports router for PDF/Excel exports."""

from __future__ import annotations

from collections import defaultdict
from io import BytesIO
from typing import Any
from datetime import date, datetime, timedelta, timezone
import os
import time

from fastapi import APIRouter, Depends, HTTPException, Query, Response
from sqlalchemy import func
from sqlalchemy.orm import Session, selectinload
from reportlab.lib.pagesizes import A4
from reportlab.pdfgen import canvas
from openpyxl import Workbook

from backend.cache import build_cache_key, get_or_set_json
from backend.database import SessionLocal, get_db
from backend.models.entry import Entry
from backend.models.user import User, UserRole
from backend.models.user_factory_role import UserFactoryRole
from backend.security import get_current_user
from backend.plans import has_plan_feature, min_plan_for_feature, get_org_plan
from backend.rbac import require_any_role
from backend.tenancy import resolve_factory_id, resolve_org_id
from backend.query_helpers import apply_org_scope, apply_role_scope, can_view_entry, factory_user_ids_query
from backend.services.background_jobs import (
    create_job,
    get_job,
    read_job_file,
    register_retry_handler,
    start_job,
    write_job_file,
)


router = APIRouter(tags=["Reports"])
REPORTS_CACHE_TTL = int(os.getenv("REPORTS_CACHE_TTL_SECONDS", "45"))


def _factory_user_ids_query(db: Session, current_user: User):
    return factory_user_ids_query(db, current_user)


def _apply_org_filter(query: Any, current_user: User) -> Any:
    return apply_org_scope(query, current_user)


def _can_view_entry(db: Session, current_user: User, entry: Entry) -> bool:
    if current_user.role == UserRole.ACCOUNTANT:
        return False
    return can_view_entry(db, current_user, entry)


def _report_cache_key(db: Session, current_user: User, *parts: Any) -> str:
    return build_cache_key(
        "org",
        resolve_org_id(current_user) or "personal",
        "factory",
        resolve_factory_id(db, current_user) or "all",
        "reports",
        current_user.id,
        *parts,
    )


def _apply_role_filter(query: Any, db: Session, current_user: User) -> Any:
    if current_user.role == UserRole.ACCOUNTANT:
        raise HTTPException(status_code=403, detail="Accountant role cannot access raw report insights.")
    return apply_role_scope(query, db, current_user)


def _scoped_entries_query(
    db: Session,
    current_user: User,
    *,
    start: date,
    end: date,
):
    query = db.query(Entry).filter(Entry.date >= start, Entry.date <= end, Entry.is_active.is_(True))
    query = _apply_org_filter(query, current_user)
    if current_user.role == UserRole.OPERATOR:
        query = query.filter(Entry.user_id == current_user.id)
        factory_id = resolve_factory_id(db, current_user)
        if factory_id:
            query = query.filter(Entry.factory_id == factory_id)
    elif current_user.role in {UserRole.SUPERVISOR, UserRole.MANAGER, UserRole.ACCOUNTANT}:
        query = query.filter(Entry.user_id.in_(_factory_user_ids_query(db, current_user)))
        factory_id = resolve_factory_id(db, current_user)
        if factory_id:
            query = query.filter(Entry.factory_id == factory_id)
    return query


def _render_pdf_bytes(entry: Entry) -> bytes:
    buffer = BytesIO()
    c = canvas.Canvas(buffer, pagesize=A4)
    width, height = A4
    y = height - 60
    c.setFont("Helvetica-Bold", 16)
    c.drawString(40, y, "DPR.ai - Daily Production Report")
    y -= 30
    c.setFont("Helvetica", 10)
    c.drawString(40, y, f"Date: {entry.date} | Shift: {entry.shift}")
    y -= 20
    submitted_by = entry.submitted_by or "-"
    submitted_at = entry.created_at.isoformat() if entry.created_at else "-"
    c.drawString(40, y, f"Department: {entry.department or '-'}")
    y -= 20
    c.drawString(40, y, f"Submitted By: {submitted_by}")
    y -= 20
    c.drawString(40, y, f"Submitted At: {submitted_at}")
    y -= 20
    c.drawString(40, y, f"Units Produced: {entry.units_produced} / Target: {entry.units_target}")
    y -= 20
    c.drawString(40, y, f"Manpower Present: {entry.manpower_present}, Absent: {entry.manpower_absent}")
    y -= 20
    c.drawString(40, y, f"Downtime: {entry.downtime_minutes} min")
    y -= 20
    c.drawString(40, y, f"Downtime Reason: {entry.downtime_reason or '-'}")
    y -= 20
    c.drawString(40, y, f"Materials Used: {entry.materials_used or '-'}")
    y -= 20
    c.drawString(40, y, f"Quality Issues: {'Yes' if entry.quality_issues else 'No'}")
    y -= 20
    c.drawString(40, y, f"Quality Details: {entry.quality_details or '-'}")
    y -= 20
    c.drawString(40, y, f"Notes: {entry.notes or '-'}")
    y -= 20
    c.drawString(40, y, f"AI Summary: {entry.ai_summary or '-'}")
    c.showPage()
    c.save()
    return buffer.getvalue()


def _render_entries_excel(entries: list[Entry]) -> bytes:
    wb = Workbook()
    ws = wb.active
    ws.title = "Factory Report"
    headers = [
        "Entry ID",
        "Date",
        "Shift",
        "Department",
        "Submitted By",
        "Submitted At",
        "Status",
        "Units Target",
        "Units Produced",
        "Manpower Present",
        "Manpower Absent",
        "Downtime Minutes",
        "Downtime Reason",
        "Materials Used",
        "Quality Issues",
        "Quality Details",
        "Notes",
        "AI Summary",
    ]
    ws.append(headers)
    for entry in entries:
        ws.append(
            [
                entry.id,
                str(entry.date),
                str(entry.shift),
                entry.department or "",
                entry.submitted_by or "",
                entry.created_at.isoformat() if entry.created_at else "",
                entry.status,
                entry.units_target,
                entry.units_produced,
                entry.manpower_present,
                entry.manpower_absent,
                entry.downtime_minutes,
                entry.downtime_reason or "",
                entry.materials_used or "",
                "Yes" if entry.quality_issues else "No",
                entry.quality_details or "",
                entry.notes or "",
                entry.ai_summary or "",
            ]
        )
    buffer = BytesIO()
    wb.save(buffer)
    return buffer.getvalue()


def _entry_performance(entry: Entry) -> float:
    return float((entry.units_produced * 100.0) / entry.units_target) if entry.units_target else 0.0


def _entry_attendance(entry: Entry) -> float:
    total = entry.manpower_present + entry.manpower_absent
    return float((entry.manpower_present * 100.0) / total) if total else 0.0


def _entry_has_issues(entry: Entry) -> bool:
    return bool(
        entry.downtime_minutes > 0
        or (entry.downtime_reason or "").strip()
        or entry.quality_issues
    )


def _attention_score(*, performance_percent: float, downtime_minutes: int, quality_issue_entries: int) -> float:
    return round(max(0.0, 100.0 - performance_percent) * 1.15 + (downtime_minutes / 8.0) + (quality_issue_entries * 12.0), 2)


def _support_reason(*, performance_percent: float, downtime_minutes: int, quality_issue_entries: int) -> str:
    reasons: list[str] = []
    if performance_percent < 90:
        reasons.append(f"performance at {performance_percent:.1f}%")
    if downtime_minutes > 0:
        reasons.append(f"{downtime_minutes} min downtime")
    if quality_issue_entries > 0:
        reasons.append(f"{quality_issue_entries} quality issue entries")
    return ", ".join(reasons) if reasons else "Stable performance"


def _week_start(day: date) -> date:
    return day - timedelta(days=day.weekday())


def _build_report_insights_payload(
    db: Session,
    current_user: User,
    *,
    start: date,
    end: date,
    shifts: list[str] | None,
    statuses: list[str] | None,
    has_issues: bool | None,
    search: str | None,
) -> dict[str, Any]:
    query = (
        db.query(Entry)
        .options(selectinload(Entry.user))
        .filter(Entry.date >= start, Entry.date <= end, Entry.is_active.is_(True))
    )
    query = _apply_org_filter(query, current_user)
    query = _apply_role_filter(query, db, current_user)
    if shifts:
        query = query.filter(Entry.shift.in_(shifts))
    if statuses:
        query = query.filter(Entry.status.in_(statuses))
    if has_issues is not None:
        if has_issues:
            query = query.filter(
                (Entry.downtime_minutes > 0)
                | (func.trim(func.coalesce(Entry.downtime_reason, "")) != "")
                | Entry.quality_issues.is_(True)
            )
        else:
            query = query.filter(
                ~(
                    (Entry.downtime_minutes > 0)
                    | (func.trim(func.coalesce(Entry.downtime_reason, "")) != "")
                    | Entry.quality_issues.is_(True)
                )
            )
    if search:
        search_value = f"%{search.lower().strip()}%"
        query = query.filter(
            func.lower(func.coalesce(Entry.notes, "")).like(search_value)
            | func.lower(func.coalesce(Entry.downtime_reason, "")).like(search_value)
            | func.lower(func.coalesce(Entry.department, "")).like(search_value)
        )

    entries = query.order_by(Entry.date.asc(), Entry.created_at.asc()).all()

    totals = {
        "entry_count": 0,
        "total_units_produced": 0,
        "total_units_target": 0,
        "performance_percent": 0.0,
        "total_downtime_minutes": 0,
        "quality_issue_entries": 0,
        "active_people": 0,
        "attendance_percent": 0.0,
    }
    daily: dict[date, dict[str, Any]] = {}
    shift_map: dict[str, dict[str, Any]] = {}
    employee_map: dict[int, dict[str, Any]] = {}
    weekly_by_user: dict[date, dict[int, dict[str, Any]]] = defaultdict(dict)

    unique_users: set[int] = set()
    attendance_present_total = 0
    attendance_total = 0

    for entry in entries:
        shift_value = entry.shift.value if hasattr(entry.shift, "value") else str(entry.shift)
        performance_percent = _entry_performance(entry)
        quality_issue_entries = 1 if entry.quality_issues else 0
        unique_users.add(entry.user_id)
        totals["entry_count"] += 1
        totals["total_units_produced"] += int(entry.units_produced or 0)
        totals["total_units_target"] += int(entry.units_target or 0)
        totals["total_downtime_minutes"] += int(entry.downtime_minutes or 0)
        totals["quality_issue_entries"] += quality_issue_entries
        attendance_present_total += int(entry.manpower_present or 0)
        attendance_total += int((entry.manpower_present or 0) + (entry.manpower_absent or 0))

        day_bucket = daily.setdefault(
            entry.date,
            {
                "date": entry.date.isoformat(),
                "units_produced": 0,
                "units_target": 0,
                "downtime_minutes": 0,
                "quality_issue_entries": 0,
                "reporter_ids": set(),
            },
        )
        day_bucket["units_produced"] += int(entry.units_produced or 0)
        day_bucket["units_target"] += int(entry.units_target or 0)
        day_bucket["downtime_minutes"] += int(entry.downtime_minutes or 0)
        day_bucket["quality_issue_entries"] += quality_issue_entries
        day_bucket["reporter_ids"].add(entry.user_id)

        shift_bucket = shift_map.setdefault(
            shift_value,
            {
                "shift": shift_value,
                "units_produced": 0,
                "units_target": 0,
                "downtime_minutes": 0,
                "entry_count": 0,
            },
        )
        shift_bucket["units_produced"] += int(entry.units_produced or 0)
        shift_bucket["units_target"] += int(entry.units_target or 0)
        shift_bucket["downtime_minutes"] += int(entry.downtime_minutes or 0)
        shift_bucket["entry_count"] += 1

        employee_bucket = employee_map.setdefault(
            entry.user_id,
            {
                "user_id": entry.user_id,
                "name": (entry.submitted_by or "Unknown").strip() or "Unknown",
                "entries_count": 0,
                "units_produced": 0,
                "units_target": 0,
                "downtime_minutes": 0,
                "quality_issue_entries": 0,
                "manpower_present_total": 0,
                "attendance_total": 0,
            },
        )
        employee_bucket["entries_count"] += 1
        employee_bucket["units_produced"] += int(entry.units_produced or 0)
        employee_bucket["units_target"] += int(entry.units_target or 0)
        employee_bucket["downtime_minutes"] += int(entry.downtime_minutes or 0)
        employee_bucket["quality_issue_entries"] += quality_issue_entries
        employee_bucket["manpower_present_total"] += int(entry.manpower_present or 0)
        employee_bucket["attendance_total"] += int((entry.manpower_present or 0) + (entry.manpower_absent or 0))

        week_bucket = weekly_by_user[_week_start(entry.date)].setdefault(
            entry.user_id,
            {
                "user_id": entry.user_id,
                "name": (entry.submitted_by or "Unknown").strip() or "Unknown",
                "entries_count": 0,
                "units_produced": 0,
                "units_target": 0,
                "downtime_minutes": 0,
                "quality_issue_entries": 0,
            },
        )
        week_bucket["entries_count"] += 1
        week_bucket["units_produced"] += int(entry.units_produced or 0)
        week_bucket["units_target"] += int(entry.units_target or 0)
        week_bucket["downtime_minutes"] += int(entry.downtime_minutes or 0)
        week_bucket["quality_issue_entries"] += quality_issue_entries

    totals["active_people"] = len(unique_users)
    totals["performance_percent"] = round(
        (totals["total_units_produced"] * 100.0 / totals["total_units_target"]) if totals["total_units_target"] else 0.0,
        2,
    )
    totals["attendance_percent"] = round((attendance_present_total * 100.0 / attendance_total) if attendance_total else 0.0, 2)

    daily_series: list[dict[str, Any]] = []
    cursor = start
    while cursor <= end:
        day_bucket = daily.get(cursor)
        units_target = int(day_bucket["units_target"]) if day_bucket else 0
        units_produced = int(day_bucket["units_produced"]) if day_bucket else 0
        downtime_minutes = int(day_bucket["downtime_minutes"]) if day_bucket else 0
        quality_issue_entries = int(day_bucket["quality_issue_entries"]) if day_bucket else 0
        reporter_count = len(day_bucket["reporter_ids"]) if day_bucket else 0
        daily_series.append(
            {
                "date": cursor.isoformat(),
                "units_produced": units_produced,
                "units_target": units_target,
                "performance_percent": round((units_produced * 100.0 / units_target) if units_target else 0.0, 2),
                "downtime_minutes": downtime_minutes,
                "quality_issue_entries": quality_issue_entries,
                "reporter_count": reporter_count,
            }
        )
        cursor += timedelta(days=1)

    shift_order = ["morning", "evening", "night"]
    shift_breakdown = []
    for shift_key in shift_order:
        bucket = shift_map.get(shift_key)
        if not bucket:
            shift_breakdown.append(
                {
                    "shift": shift_key,
                    "units_produced": 0,
                    "units_target": 0,
                    "performance_percent": 0.0,
                    "downtime_minutes": 0,
                    "entry_count": 0,
                }
            )
            continue
        shift_breakdown.append(
            {
                "shift": shift_key,
                "units_produced": int(bucket["units_produced"]),
                "units_target": int(bucket["units_target"]),
                "performance_percent": round(
                    (bucket["units_produced"] * 100.0 / bucket["units_target"]) if bucket["units_target"] else 0.0,
                    2,
                ),
                "downtime_minutes": int(bucket["downtime_minutes"]),
                "entry_count": int(bucket["entry_count"]),
            }
        )

    employee_leaderboard = []
    support_signals = []
    for bucket in employee_map.values():
        performance_percent = round(
            (bucket["units_produced"] * 100.0 / bucket["units_target"]) if bucket["units_target"] else 0.0,
            2,
        )
        attendance_percent = round(
            (bucket["manpower_present_total"] * 100.0 / bucket["attendance_total"]) if bucket["attendance_total"] else 0.0,
            2,
        )
        attention_score = _attention_score(
            performance_percent=performance_percent,
            downtime_minutes=int(bucket["downtime_minutes"]),
            quality_issue_entries=int(bucket["quality_issue_entries"]),
        )
        employee_payload = {
            "user_id": int(bucket["user_id"]),
            "name": str(bucket["name"]),
            "entries_count": int(bucket["entries_count"]),
            "units_produced": int(bucket["units_produced"]),
            "units_target": int(bucket["units_target"]),
            "performance_percent": performance_percent,
            "attendance_percent": attendance_percent,
            "downtime_minutes": int(bucket["downtime_minutes"]),
            "quality_issue_entries": int(bucket["quality_issue_entries"]),
            "attention_score": attention_score,
        }
        employee_leaderboard.append(employee_payload)
        support_signals.append(
            {
                **employee_payload,
                "reason": _support_reason(
                    performance_percent=performance_percent,
                    downtime_minutes=int(bucket["downtime_minutes"]),
                    quality_issue_entries=int(bucket["quality_issue_entries"]),
                ),
            }
        )

    employee_leaderboard.sort(
        key=lambda row: (
            float(row["performance_percent"]),
            int(row["units_produced"]),
            -int(row["downtime_minutes"]),
        ),
        reverse=True,
    )
    support_signals.sort(
        key=lambda row: (
            float(row["attention_score"]),
            int(row["downtime_minutes"]),
            int(row["quality_issue_entries"]),
        ),
        reverse=True,
    )

    weekly_snapshots = []
    all_week_starts = sorted(weekly_by_user.keys())
    for week_start in all_week_starts:
        buckets = list(weekly_by_user[week_start].values())
        prepared = []
        total_units = 0
        total_target = 0
        for bucket in buckets:
            performance_percent = round(
                (bucket["units_produced"] * 100.0 / bucket["units_target"]) if bucket["units_target"] else 0.0,
                2,
            )
            attention_score = _attention_score(
                performance_percent=performance_percent,
                downtime_minutes=int(bucket["downtime_minutes"]),
                quality_issue_entries=int(bucket["quality_issue_entries"]),
            )
            prepared.append(
                {
                    "user_id": int(bucket["user_id"]),
                    "name": str(bucket["name"]),
                    "entries_count": int(bucket["entries_count"]),
                    "units_produced": int(bucket["units_produced"]),
                    "units_target": int(bucket["units_target"]),
                    "performance_percent": performance_percent,
                    "downtime_minutes": int(bucket["downtime_minutes"]),
                    "quality_issue_entries": int(bucket["quality_issue_entries"]),
                    "attention_score": attention_score,
                }
            )
            total_units += int(bucket["units_produced"])
            total_target += int(bucket["units_target"])
        prepared.sort(key=lambda row: (float(row["performance_percent"]), int(row["units_produced"])), reverse=True)
        best_employee = prepared[0] if prepared else None
        support_employee = max(prepared, key=lambda row: float(row["attention_score"]), default=None)
        weekly_snapshots.append(
            {
                "week_start": week_start.isoformat(),
                "week_end": (week_start + timedelta(days=6)).isoformat(),
                "total_units_produced": total_units,
                "total_units_target": total_target,
                "performance_percent": round((total_units * 100.0 / total_target) if total_target else 0.0, 2),
                "best_employee": best_employee,
                "needs_support_employee": {
                    **support_employee,
                    "reason": _support_reason(
                        performance_percent=float(support_employee["performance_percent"]),
                        downtime_minutes=int(support_employee["downtime_minutes"]),
                        quality_issue_entries=int(support_employee["quality_issue_entries"]),
                    ),
                }
                if support_employee
                else None,
            }
        )

    top_employee_ids = [int(row["user_id"]) for row in employee_leaderboard[:5]]
    employee_trend = []
    for user_id in top_employee_ids:
        employee = employee_map.get(user_id)
        if not employee:
            continue
        points = []
        for week_start in all_week_starts:
            bucket = weekly_by_user[week_start].get(user_id)
            units_produced = int(bucket["units_produced"]) if bucket else 0
            units_target = int(bucket["units_target"]) if bucket else 0
            downtime_minutes = int(bucket["downtime_minutes"]) if bucket else 0
            quality_issue_entries = int(bucket["quality_issue_entries"]) if bucket else 0
            points.append(
                {
                    "week_start": week_start.isoformat(),
                    "week_end": (week_start + timedelta(days=6)).isoformat(),
                    "units_produced": units_produced,
                    "units_target": units_target,
                    "performance_percent": round((units_produced * 100.0 / units_target) if units_target else 0.0, 2),
                    "downtime_minutes": downtime_minutes,
                    "quality_issue_entries": quality_issue_entries,
                }
            )
        employee_trend.append(
            {
                "user_id": user_id,
                "name": str(employee["name"]),
                "points": points,
            }
        )

    return {
        "range": {
            "start_date": start.isoformat(),
            "end_date": end.isoformat(),
            "days": (end - start).days + 1,
        },
        "totals": totals,
        "daily_series": daily_series,
        "shift_breakdown": shift_breakdown,
        "employee_leaderboard": employee_leaderboard[:8],
        "support_signals": support_signals[:5],
        "weekly_snapshots": weekly_snapshots,
        "employee_trend": employee_trend,
    }


def _queue_range_export_job(
    *,
    owner_id: int,
    org_id: str | None,
    factory_id: str | None,
    start: date,
    end: date,
) -> dict[str, Any]:
    job = create_job(
        kind="reports_excel_range",
        owner_id=owner_id,
        org_id=org_id,
        message="Queued range export",
        context={
            "route": "/reports",
            "start_date": start.isoformat(),
            "end_date": end.isoformat(),
            "factory_id": factory_id,
        },
        retry_context={
            "owner_id": owner_id,
            "org_id": org_id,
            "factory_id": factory_id,
            "start_date": start.isoformat(),
            "end_date": end.isoformat(),
        },
    )

    def worker(update):
        # Give immediate cancel requests a small window before fast exports finish.
        time.sleep(0.05)
        update(20, "Loading report rows")
        with SessionLocal() as job_db:
            job_user = job_db.query(User).filter(User.id == owner_id).first()
            if not job_user:
                raise RuntimeError("User is no longer available for export.")
            job_user.active_org_id = org_id
            job_user.active_factory_id = factory_id
            entries = (
                _scoped_entries_query(job_db, job_user, start=start, end=end)
                .order_by(Entry.date.asc(), Entry.created_at.asc())
                .all()
            )
            update(70, f"Rendering {len(entries)} rows into Excel")
            excel_bytes = _render_entries_excel(entries)
            file_meta = write_job_file(
                job["job_id"],
                filename=f"reports-{start.isoformat()}-to-{end.isoformat()}.xlsx",
                content=excel_bytes,
                media_type="application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
            )
            return {
                "file": file_meta,
                "row_count": len(entries),
                "start_date": start.isoformat(),
                "end_date": end.isoformat(),
            }

    start_job(job["job_id"], worker)
    return job


def _queue_entry_pdf_job(
    *,
    owner_id: int,
    org_id: str | None,
    factory_id: str | None,
    entry_id: int,
) -> dict[str, Any]:
    job = create_job(
        kind="reports_entry_pdf",
        owner_id=owner_id,
        org_id=org_id,
        message=f"Queued PDF export for entry #{entry_id}",
        context={
            "route": f"/entry/{entry_id}",
            "entry_id": entry_id,
            "factory_id": factory_id,
        },
        retry_context={
            "owner_id": owner_id,
            "org_id": org_id,
            "factory_id": factory_id,
            "entry_id": entry_id,
        },
    )

    def worker(update):
        update(20, "Loading entry details")
        with SessionLocal() as job_db:
            job_user = job_db.query(User).filter(User.id == owner_id).first()
            if not job_user:
                raise RuntimeError("User is no longer available for export.")
            job_user.active_org_id = org_id
            job_user.active_factory_id = factory_id
            entry = job_db.query(Entry).filter(Entry.id == entry_id, Entry.is_active.is_(True)).first()
            if not entry:
                raise RuntimeError("Entry not found.")
            if not _can_view_entry(job_db, job_user, entry):
                raise RuntimeError("Access denied for this entry export.")
            update(75, "Rendering PDF")
            pdf_bytes = _render_pdf_bytes(entry)
            file_meta = write_job_file(
                job["job_id"],
                filename=f"entry-{entry_id}.pdf",
                content=pdf_bytes,
                media_type="application/pdf",
            )
            return {
                "file": file_meta,
                "entry_id": entry_id,
            }

    start_job(job["job_id"], worker)
    return job


def _retry_range_export_job(payload: dict[str, Any], _source_job: dict[str, Any]) -> dict[str, Any]:
    start_text = str(payload.get("start_date") or "")
    end_text = str(payload.get("end_date") or "")
    if not start_text or not end_text:
        raise RuntimeError("The original range export is missing its date range.")
    return _queue_range_export_job(
        owner_id=int(payload["owner_id"]),
        org_id=str(payload["org_id"]) if payload.get("org_id") is not None else None,
        factory_id=str(payload["factory_id"]) if payload.get("factory_id") is not None else None,
        start=date.fromisoformat(start_text),
        end=date.fromisoformat(end_text),
    )


def _retry_entry_pdf_job(payload: dict[str, Any], _source_job: dict[str, Any]) -> dict[str, Any]:
    entry_id = int(payload.get("entry_id") or 0)
    if entry_id <= 0:
        raise RuntimeError("The original PDF export is missing its entry ID.")
    return _queue_entry_pdf_job(
        owner_id=int(payload["owner_id"]),
        org_id=str(payload["org_id"]) if payload.get("org_id") is not None else None,
        factory_id=str(payload["factory_id"]) if payload.get("factory_id") is not None else None,
        entry_id=entry_id,
    )


register_retry_handler("reports_excel_range", _retry_range_export_job)
register_retry_handler("reports_entry_pdf", _retry_entry_pdf_job)


@router.get("/insights")
def report_insights(
    start_date: date | None = Query(default=None),
    end_date: date | None = Query(default=None),
    shift: list[str] | None = Query(default=None),
    has_issues: bool | None = Query(default=None),
    status_filter: list[str] | None = Query(default=None, alias="status"),
    search: str | None = Query(default=None),
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
) -> dict[str, Any]:
    require_any_role(current_user, {UserRole.SUPERVISOR, UserRole.MANAGER, UserRole.ADMIN, UserRole.OWNER})
    start = start_date or (date.today() - timedelta(days=27))
    end = end_date or date.today()
    if start > end:
        raise HTTPException(status_code=400, detail="Start date cannot be after end date.")

    allowed_shifts = {"morning", "evening", "night"}
    normalized_shifts = []
    for raw in shift or []:
        value = str(raw or "").strip().lower()
        if not value:
            continue
        if value not in allowed_shifts:
            raise HTTPException(status_code=400, detail=f"Unknown shift '{raw}'.")
        normalized_shifts.append(value)
    normalized_statuses = []
    for raw in status_filter or []:
        value = str(raw or "").strip().lower()
        if not value:
            continue
        if value not in {"submitted", "approved", "rejected"}:
            raise HTTPException(status_code=400, detail=f"Unknown status '{raw}'.")
        normalized_statuses.append(value)

    cache_key = _report_cache_key(
        db,
        current_user,
        "insights",
        start.isoformat(),
        end.isoformat(),
        ",".join(normalized_shifts) or "all-shifts",
        ",".join(normalized_statuses) or "all-statuses",
        "issues" if has_issues is True else "clean" if has_issues is False else "all-issues",
        (search or "").strip().lower() or "all-search",
    )

    return get_or_set_json(
        cache_key,
        REPORTS_CACHE_TTL,
        lambda: _build_report_insights_payload(
            db,
            current_user,
            start=start,
            end=end,
            shifts=normalized_shifts or None,
            statuses=normalized_statuses or None,
            has_issues=has_issues,
            search=search,
        ),
    )


@router.get("/pdf/{entry_id}")
def download_pdf(
    entry_id: int,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
) -> Response:
    require_any_role(
        current_user,
        {UserRole.OPERATOR, UserRole.SUPERVISOR, UserRole.MANAGER, UserRole.ACCOUNTANT, UserRole.ADMIN, UserRole.OWNER},
    )
    org_id = resolve_org_id(current_user)
    plan = get_org_plan(db, org_id=org_id, fallback_user_id=current_user.id)
    if not has_plan_feature(plan, "pdf"):
        min_plan = min_plan_for_feature("pdf")
        raise HTTPException(
            status_code=402,
            detail=f"PDF export is not available on the {plan.title()} plan. Upgrade to {min_plan.title()} or higher to unlock this.",
        )
    entry = db.query(Entry).filter(Entry.id == entry_id, Entry.is_active.is_(True)).first()
    if not entry:
        raise HTTPException(status_code=404, detail="Entry not found.")
    if not _can_view_entry(db, current_user, entry):
        raise HTTPException(status_code=403, detail="Access denied.")
    pdf_bytes = _render_pdf_bytes(entry)
    return Response(content=pdf_bytes, media_type="application/pdf")


@router.post("/pdf/{entry_id}/jobs")
def download_pdf_job(
    entry_id: int,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
) -> dict[str, Any]:
    require_any_role(
        current_user,
        {UserRole.OPERATOR, UserRole.SUPERVISOR, UserRole.MANAGER, UserRole.ACCOUNTANT, UserRole.ADMIN, UserRole.OWNER},
    )
    org_id = resolve_org_id(current_user)
    plan = get_org_plan(db, org_id=org_id, fallback_user_id=current_user.id)
    if not has_plan_feature(plan, "pdf"):
        min_plan = min_plan_for_feature("pdf")
        raise HTTPException(
            status_code=402,
            detail=f"PDF export is not available on the {plan.title()} plan. Upgrade to {min_plan.title()} or higher to unlock this.",
        )
    entry = db.query(Entry).filter(Entry.id == entry_id, Entry.is_active.is_(True)).first()
    if not entry:
        raise HTTPException(status_code=404, detail="Entry not found.")
    if not _can_view_entry(db, current_user, entry):
        raise HTTPException(status_code=403, detail="Access denied.")
    return _queue_entry_pdf_job(
        owner_id=current_user.id,
        org_id=org_id,
        factory_id=resolve_factory_id(db, current_user),
        entry_id=entry_id,
    )


@router.get("/sample-pdf")
def sample_pdf() -> Response:
    sample = Entry(
        id=0,
        user_id=0,
        date=date.today(),
        shift="morning",
        department="Spinning",
        units_target=100,
        units_produced=95,
        manpower_present=30,
        manpower_absent=2,
        downtime_minutes=10,
        downtime_reason="Maintenance",
        materials_used="Steel",
        quality_issues=False,
        quality_details=None,
        notes="Sample report",
        ai_summary="Sample summary.",
        is_active=True,
        created_at=datetime.now(timezone.utc),
        updated_at=datetime.now(timezone.utc),
    )
    pdf_bytes = _render_pdf_bytes(sample)
    return Response(content=pdf_bytes, media_type="application/pdf")


@router.get("/excel/{entry_id}")
def download_excel(
    entry_id: int,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
) -> Response:
    require_any_role(
        current_user,
        {UserRole.OPERATOR, UserRole.SUPERVISOR, UserRole.MANAGER, UserRole.ACCOUNTANT, UserRole.ADMIN, UserRole.OWNER},
    )
    org_id = resolve_org_id(current_user)
    plan = get_org_plan(db, org_id=org_id, fallback_user_id=current_user.id)
    if not has_plan_feature(plan, "excel"):
        min_plan = min_plan_for_feature("excel")
        raise HTTPException(
            status_code=402,
            detail=f"Excel export is not available on the {plan.title()} plan. Upgrade to {min_plan.title()} or higher to unlock this.",
        )
    entry = db.query(Entry).filter(Entry.id == entry_id, Entry.is_active.is_(True)).first()
    if not entry:
        raise HTTPException(status_code=404, detail="Entry not found.")
    if not _can_view_entry(db, current_user, entry):
        raise HTTPException(status_code=403, detail="Access denied.")

    wb = Workbook()
    ws = wb.active
    ws.title = "DPR"
    rows = [
        ("Date", str(entry.date)),
        ("Shift", str(entry.shift)),
        ("Department", entry.department or ""),
        ("Submitted By", entry.submitted_by or ""),
        ("Submitted At", entry.created_at.isoformat() if entry.created_at else ""),
        ("Units Target", entry.units_target),
        ("Units Produced", entry.units_produced),
        ("Manpower Present", entry.manpower_present),
        ("Manpower Absent", entry.manpower_absent),
        ("Downtime Minutes", entry.downtime_minutes),
        ("Downtime Reason", entry.downtime_reason or ""),
        ("Materials Used", entry.materials_used or ""),
        ("Quality Issues", "Yes" if entry.quality_issues else "No"),
        ("Quality Details", entry.quality_details or ""),
        ("Notes", entry.notes or ""),
        ("AI Summary", entry.ai_summary or ""),
    ]
    for row in rows:
        ws.append(row)
    buffer = BytesIO()
    wb.save(buffer)
    return Response(
        content=buffer.getvalue(),
        media_type="application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
    )


@router.get("/weekly")
def weekly_export(
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
) -> list[dict]:
    require_any_role(
        current_user,
        {UserRole.OPERATOR, UserRole.SUPERVISOR, UserRole.MANAGER, UserRole.ACCOUNTANT, UserRole.ADMIN, UserRole.OWNER},
    )
    start = date.today() - timedelta(days=6)
    end = date.today()

    def build_payload() -> list[dict]:
        entries = (
            _scoped_entries_query(db, current_user, start=start, end=end)
            .with_entities(Entry.date, Entry.shift, Entry.units_produced, Entry.units_target)
            .order_by(Entry.date.asc(), Entry.shift.asc())
            .all()
        )
        return [
            {
                "date": row.date.isoformat(),
                "shift": row.shift,
                "units_produced": row.units_produced,
                "units_target": row.units_target,
            }
            for row in entries
        ]

    return get_or_set_json(
        _report_cache_key(db, current_user, "weekly", start.isoformat(), end.isoformat()),
        REPORTS_CACHE_TTL,
        build_payload,
    )


@router.get("/monthly")
def monthly_export(
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
) -> list[dict]:
    require_any_role(
        current_user,
        {UserRole.OPERATOR, UserRole.SUPERVISOR, UserRole.MANAGER, UserRole.ACCOUNTANT, UserRole.ADMIN, UserRole.OWNER},
    )
    start = date.today() - timedelta(days=29)
    end = date.today()

    def build_payload() -> list[dict]:
        entries = (
            _scoped_entries_query(db, current_user, start=start, end=end)
            .with_entities(Entry.date, Entry.shift, Entry.units_produced, Entry.units_target)
            .order_by(Entry.date.asc(), Entry.shift.asc())
            .all()
        )
        return [
            {
                "date": row.date.isoformat(),
                "shift": row.shift,
                "units_produced": row.units_produced,
                "units_target": row.units_target,
            }
            for row in entries
        ]

    return get_or_set_json(
        _report_cache_key(db, current_user, "monthly", start.isoformat(), end.isoformat()),
        REPORTS_CACHE_TTL,
        build_payload,
    )


@router.get("/excel-range")
def export_factory_excel(
    start_date: date | None = Query(default=None),
    end_date: date | None = Query(default=None),
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
) -> Response:
    require_any_role(
        current_user,
        {UserRole.OPERATOR, UserRole.SUPERVISOR, UserRole.MANAGER, UserRole.ACCOUNTANT, UserRole.ADMIN, UserRole.OWNER},
    )
    org_id = resolve_org_id(current_user)
    plan = get_org_plan(db, org_id=org_id, fallback_user_id=current_user.id)
    if not has_plan_feature(plan, "excel"):
        min_plan = min_plan_for_feature("excel")
        raise HTTPException(
            status_code=402,
            detail=f"Excel export is not available on the {plan.title()} plan. Upgrade to {min_plan.title()} or higher to unlock this.",
        )

    start = start_date or (date.today() - timedelta(days=6))
    end = end_date or date.today()
    entries = _scoped_entries_query(db, current_user, start=start, end=end).order_by(Entry.date.asc(), Entry.created_at.asc())
    excel_bytes = _render_entries_excel(entries.all())
    return Response(
        content=excel_bytes,
        media_type="application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
    )


@router.post("/excel-range/jobs")
def export_factory_excel_job(
    start_date: date | None = Query(default=None),
    end_date: date | None = Query(default=None),
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
) -> dict[str, Any]:
    require_any_role(
        current_user,
        {UserRole.OPERATOR, UserRole.SUPERVISOR, UserRole.MANAGER, UserRole.ACCOUNTANT, UserRole.ADMIN, UserRole.OWNER},
    )
    org_id = resolve_org_id(current_user)
    plan = get_org_plan(db, org_id=org_id, fallback_user_id=current_user.id)
    if not has_plan_feature(plan, "excel"):
        min_plan = min_plan_for_feature("excel")
        raise HTTPException(
            status_code=402,
            detail=f"Excel export is not available on the {plan.title()} plan. Upgrade to {min_plan.title()} or higher to unlock this.",
        )

    start = start_date or (date.today() - timedelta(days=6))
    end = end_date or date.today()
    return _queue_range_export_job(
        owner_id=current_user.id,
        org_id=org_id,
        factory_id=resolve_factory_id(db, current_user),
        start=start,
        end=end,
    )


@router.get("/export-jobs/{job_id}")
def get_report_job(
    job_id: str,
    current_user: User = Depends(get_current_user),
) -> dict[str, Any]:
    job = get_job(job_id, owner_id=current_user.id)
    if not job or not str(job.get("kind", "")).startswith("reports_"):
        raise HTTPException(status_code=404, detail="Export job not found.")
    return job


@router.get("/export-jobs/{job_id}/download")
def download_report_job(
    job_id: str,
    current_user: User = Depends(get_current_user),
) -> Response:
    job = get_job(job_id, owner_id=current_user.id)
    if not job or not str(job.get("kind", "")).startswith("reports_"):
        raise HTTPException(status_code=404, detail="Export job not found.")
    if job.get("status") != "succeeded":
        raise HTTPException(status_code=409, detail="Export is not ready yet.")
    try:
        content, file_meta = read_job_file(job_id, owner_id=current_user.id)
    except FileNotFoundError as error:
        raise HTTPException(status_code=404, detail="Export file not found.") from error
    filename = file_meta.get("filename") or f"{job_id}.bin"
    media_type = file_meta.get("media_type") or "application/octet-stream"
    return Response(
        content=content,
        media_type=media_type,
        headers={"Content-Disposition": f'attachment; filename="{filename}"'},
    )
