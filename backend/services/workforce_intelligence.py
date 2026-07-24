"""Workforce intelligence service — aggregation queries for workforce analytics.

All Phase 1 analytics are derived from existing schema:
- ``AttendanceRecord`` — punch in/out, worked minutes, overtime
- ``AttendanceEvent`` — raw event data
- ``EmployeeProfile`` — department, designation, reporting hierarchy
- ``Entry`` — shift productivity, manpower counts
- ``User`` — names, roles
- ``WorkforceCostRate`` — labour cost rates (new table, Phase 1)
"""

from __future__ import annotations

from datetime import date, datetime, timedelta, timezone
from typing import Any

from sqlalchemy import Date, and_, func, cast, case, literal_column, text
from sqlalchemy.orm import Session, joinedload

from backend.models.attendance_record import AttendanceRecord
from backend.models.attendance_event import AttendanceEvent
from backend.models.employee_profile import EmployeeProfile
from backend.models.entry import Entry
from backend.models.user import User
from backend.models.workforce_cost_rate import WorkforceCostRate


# ── Helpers ──────────────────────────────────────────────────────────────────


def _date_range(days: int) -> tuple[date, date]:
    today = date.today()
    return today - timedelta(days=days - 1), today


def _tz_now() -> datetime:
    return datetime.now(timezone.utc)


# ═══════════════════════════════════════════════════════════════════════════════
# Overview — high-level KPIs
# ═══════════════════════════════════════════════════════════════════════════════


def build_workforce_overview(
    db: Session,
    factory_id: str,
    days: int = 30,
    can_view_cost: bool = False,
) -> dict[str, Any]:
    """Top-level workforce KPIs: attendance, overtime, shift comparison, cost."""
    start_date, end_date = _date_range(days)
    today_local = date.today()

    # ── Today's attendance ──────────────────────────────────────────────────
    today_attendance = (
        db.query(
            func.count(AttendanceRecord.id).label("total"),
            func.coalesce(func.sum(case((AttendanceRecord.status == "working", 1), else_=0)), 0).label("working"),
            func.coalesce(func.sum(case((AttendanceRecord.status == "completed", 1), else_=0)), 0).label("completed"),
            func.coalesce(func.sum(case((AttendanceRecord.status == "absent", 1), else_=0)), 0).label("absent"),
            func.coalesce(func.sum(AttendanceRecord.worked_minutes), 0).label("total_worked_minutes"),
            func.coalesce(func.sum(AttendanceRecord.overtime_minutes), 0).label("total_overtime_minutes"),
        )
        .filter(
            AttendanceRecord.factory_id == factory_id,
            AttendanceRecord.attendance_date == today_local,
        )
        .first()
    )

    # ── Period attendance stats ─────────────────────────────────────────────
    period_attendance = (
        db.query(
            func.count(AttendanceRecord.id).label("total_records"),
            func.coalesce(func.sum(AttendanceRecord.worked_minutes), 0).label("total_worked_minutes"),
            func.coalesce(func.sum(AttendanceRecord.overtime_minutes), 0).label("total_overtime_minutes"),
            func.coalesce(func.sum(AttendanceRecord.late_minutes), 0).label("total_late_minutes"),
            func.avg(AttendanceRecord.worked_minutes).label("avg_worked_minutes"),
            func.avg(AttendanceRecord.overtime_minutes).label("avg_overtime_minutes"),
            func.count(func.nullif(AttendanceRecord.worked_minutes, 0)).label("days_punched"),
            (
                func.count(func.nullif(AttendanceRecord.worked_minutes, 0))
                / func.nullif(func.count(AttendanceRecord.id), 0)
                * 100
            ).label("presence_rate"),
        )
        .filter(
            AttendanceRecord.factory_id == factory_id,
            AttendanceRecord.attendance_date >= start_date,
            AttendanceRecord.attendance_date <= end_date,
        )
        .first()
    )

    # ── Today's overtime breakdown ──────────────────────────────────────────
    today_overtime_earners = (
        db.query(func.count(AttendanceRecord.id))
        .filter(
            AttendanceRecord.factory_id == factory_id,
            AttendanceRecord.attendance_date == today_local,
            AttendanceRecord.overtime_minutes > 0,
        )
        .scalar()
        or 0
    )

    # ── Shift comparison ────────────────────────────────────────────────────
    shift_analysis = _build_shift_comparison(db, factory_id, start_date, end_date)

    # ── Cost summary (financial users only) ─────────────────────────────────
    cost_summary: dict[str, Any] = {}
    if can_view_cost:
        cost_summary = _build_cost_summary(
            db, factory_id, start_date, end_date,
            total_worked_minutes=int(period_attendance.total_worked_minutes or 0),
            total_overtime_minutes=int(period_attendance.total_overtime_minutes or 0),
        )

    return {
        "as_of": _tz_now().isoformat(),
        "period_days": days,
        "date_range": {"start": start_date.isoformat(), "end": end_date.isoformat()},
        "today": {
            "total_workers": int(today_attendance.total),
            "working": int(today_attendance.working),
            "completed": int(today_attendance.completed),
            "absent": int(today_attendance.absent),
            "total_worked_minutes": int(today_attendance.total_worked_minutes),
            "total_overtime_minutes": int(today_attendance.total_overtime_minutes),
            "overtime_earners_count": today_overtime_earners,
        },
        "period": {
            "total_records": int(period_attendance.total_records),
            "total_worked_hours": round(int(period_attendance.total_worked_minutes) / 60, 1),
            "total_overtime_hours": round(int(period_attendance.total_overtime_minutes) / 60, 1),
            "total_late_hours": round(int(period_attendance.total_late_minutes) / 60, 1),
            "avg_worked_minutes_per_day": round(float(period_attendance.avg_worked_minutes or 0), 1),
            "avg_overtime_minutes_per_day": round(float(period_attendance.avg_overtime_minutes or 0), 1),
            "presence_rate_percent": round(float(period_attendance.presence_rate or 0), 1),
            "days_punched": int(period_attendance.days_punched),
        },
        "shift_comparison": shift_analysis,
        "financial_access": can_view_cost,
        **({"cost_summary": cost_summary} if cost_summary else {}),
    }


# ═══════════════════════════════════════════════════════════════════════════════
# Worker ranking & trends
# ═══════════════════════════════════════════════════════════════════════════════


def build_workers(
    db: Session,
    factory_id: str,
    days: int = 30,
    sort_by: str = "worked_minutes",
    limit: int = 50,
    can_view_cost: bool = False,
) -> dict[str, Any]:
    """Ranked worker performance with attendance metrics and estimated productivity."""
    start_date, end_date = _date_range(days)

    # ── Per-worker attendance aggregation ───────────────────────────────────
    worker_attendance = (
        db.query(
            AttendanceRecord.user_id,
            func.count(AttendanceRecord.id).label("attendance_days"),
            func.coalesce(func.sum(AttendanceRecord.worked_minutes), 0).label("total_worked_minutes"),
            func.coalesce(func.sum(AttendanceRecord.overtime_minutes), 0).label("total_overtime_minutes"),
            func.coalesce(func.sum(AttendanceRecord.late_minutes), 0).label("total_late_minutes"),
            func.avg(AttendanceRecord.worked_minutes).label("avg_worked_minutes"),
            func.avg(AttendanceRecord.overtime_minutes).label("avg_overtime_minutes"),
            func.count(func.nullif(AttendanceRecord.overtime_minutes, 0)).label("overtime_days"),
            func.count(func.nullif(AttendanceRecord.late_minutes, 0)).label("late_days"),
        )
        .filter(
            AttendanceRecord.factory_id == factory_id,
            AttendanceRecord.attendance_date >= start_date,
            AttendanceRecord.attendance_date <= end_date,
        )
        .group_by(AttendanceRecord.user_id)
        .subquery()
    )

    # ── Fetch user names and roles ──────────────────────────────────────────
    user_ids = [row.user_id for row in db.query(worker_attendance.c.user_id).all()]
    users = (
        db.query(User)
        .filter(User.id.in_(user_ids))
        .all()
    ) if user_ids else []
    user_map: dict[int, User] = {u.id: u for u in users}

    # ── Fetch employee profiles ─────────────────────────────────────────────
    profiles = (
        db.query(EmployeeProfile)
        .filter(
            EmployeeProfile.factory_id == factory_id,
            EmployeeProfile.user_id.in_(user_ids),
        )
        .all()
    ) if user_ids else []
    profile_map: dict[int, EmployeeProfile] = {p.user_id: p for p in profiles}

    # ── Fetch cost rates if permitted ───────────────────────────────────────
    cost_rates: dict[int, float] = {}
    if can_view_cost:
        rates = (
            db.query(WorkforceCostRate)
            .filter(
                WorkforceCostRate.factory_id == factory_id,
                WorkforceCostRate.is_active.is_(True),
                WorkforceCostRate.effective_from <= end_date,
                (WorkforceCostRate.effective_to.is_(None) | (WorkforceCostRate.effective_to >= start_date)),
            )
            .order_by(WorkforceCostRate.effective_from.desc())
            .all()
        )
        # Build per-user rate resolving hierarchy: user > role > department > factory default
        for rate in rates:
            if rate.user_id and rate.user_id not in cost_rates:
                cost_rates[rate.user_id] = float(rate.regular_hourly_rate_inr)

    # ── Build workers list ──────────────────────────────────────────────────
    workers: list[dict[str, Any]] = []
    for row in db.query(worker_attendance).all():
        user_id = int(row.user_id)
        user = user_map.get(user_id)
        profile = profile_map.get(user_id)
        name = user.name if user else f"User #{user_id}"
        role = user.role.value if user else "unknown"

        total_worked = int(row.total_worked_minutes or 0)
        total_overtime = int(row.total_overtime_minutes or 0)
        total_late = int(row.total_late_minutes or 0)
        attendance_days = int(row.attendance_days)
        overtime_days = int(row.overtime_days)
        late_days = int(row.late_days)
        avg_worked = round(float(row.avg_worked_minutes or 0), 1)

        # Estimated productivity: per-day contribution weighted by attendance
        est_output = round(total_worked / 60 * 1.0, 1)  # placeholder — actual attribution in Phase 2

        worker: dict[str, Any] = {
            "user_id": user_id,
            "name": name,
            "role": role,
            "department": profile.department if profile else None,
            "designation": profile.designation if profile else None,
            "employee_code": profile.employee_code if profile else None,
            "attendance_days": attendance_days,
            "total_worked_minutes": total_worked,
            "total_worked_hours": round(total_worked / 60, 1),
            "avg_worked_minutes": avg_worked,
            "total_overtime_minutes": total_overtime,
            "total_overtime_hours": round(total_overtime / 60, 1),
            "overtime_days": overtime_days,
            "total_late_minutes": total_late,
            "late_days": late_days,
            "estimated_productivity_score": est_output,
        }
        if can_view_cost:
            hourly_rate = cost_rates.get(user_id, 0.0)
            regular_cost = round((total_worked - total_overtime) / 60 * hourly_rate, 2) if hourly_rate else 0.0
            overtime_cost = round(total_overtime / 60 * hourly_rate * 1.5, 2) if hourly_rate else 0.0
            worker["hourly_rate_inr"] = hourly_rate
            worker["regular_cost_inr"] = regular_cost
            worker["overtime_cost_inr"] = overtime_cost
            worker["total_cost_inr"] = round(regular_cost + overtime_cost, 2)

        workers.append(worker)

    # ── Sort ────────────────────────────────────────────────────────────────
    sort_key_map = {
        "worked_minutes": "total_worked_minutes",
        "overtime": "total_overtime_minutes",
        "late": "total_late_minutes",
        "attendance_days": "attendance_days",
        "cost": "total_cost_inr",
        "name": "name",
    }
    sort_field = sort_key_map.get(sort_by, "total_worked_minutes")
    reverse = sort_by not in ("name",)
    workers.sort(key=lambda w: w.get(sort_field, 0) or 0, reverse=reverse)

    # ── Presence rate ──────────────────────────────────────────────────────
    total_workers_count = (
        db.query(func.count(func.distinct(AttendanceRecord.user_id)))
        .filter(
            AttendanceRecord.factory_id == factory_id,
            AttendanceRecord.attendance_date >= start_date,
            AttendanceRecord.attendance_date <= end_date,
        )
        .scalar()
        or 0
    )

    return {
        "as_of": _tz_now().isoformat(),
        "period_days": days,
        "date_range": {"start": start_date.isoformat(), "end": end_date.isoformat()},
        "total_workers_with_attendance": len(workers),
        "total_factory_workers": total_workers_count,
        "sort_by": sort_by,
        "financial_access": can_view_cost,
        "workers": workers[:limit],
    }


# ═══════════════════════════════════════════════════════════════════════════════
# Per-worker trend
# ═══════════════════════════════════════════════════════════════════════════════


def build_worker_trend(
    db: Session,
    factory_id: str,
    user_id: int,
    days: int = 30,
    can_view_cost: bool = False,
) -> dict[str, Any]:
    """Daily trend for a single worker."""
    start_date, end_date = _date_range(days)

    records = (
        db.query(AttendanceRecord)
        .filter(
            AttendanceRecord.factory_id == factory_id,
            AttendanceRecord.user_id == user_id,
            AttendanceRecord.attendance_date >= start_date,
            AttendanceRecord.attendance_date <= end_date,
        )
        .order_by(AttendanceRecord.attendance_date.asc())
        .all()
    )

    user = db.query(User).filter(User.id == user_id).first()
    profile = (
        db.query(EmployeeProfile)
        .filter(
            EmployeeProfile.factory_id == factory_id,
            EmployeeProfile.user_id == user_id,
        )
        .first()
    )

    # Fetch cost rate
    hourly_rate = 0.0
    if can_view_cost:
        rate = (
            db.query(WorkforceCostRate)
            .filter(
                WorkforceCostRate.factory_id == factory_id,
                WorkforceCostRate.user_id == user_id,
                WorkforceCostRate.is_active.is_(True),
            )
            .order_by(WorkforceCostRate.effective_from.desc())
            .first()
        )
        if rate:
            hourly_rate = float(rate.regular_hourly_rate_inr)

    daily: list[dict[str, Any]] = []
    total_worked = 0
    total_overtime = 0
    total_late = 0
    days_present = 0

    for rec in records:
        w = int(rec.worked_minutes or 0)
        o = int(rec.overtime_minutes or 0)
        l = int(rec.late_minutes or 0)

        total_worked += w
        total_overtime += o
        total_late += l
        if rec.status != "absent":
            days_present += 1

        day: dict[str, Any] = {
            "date": rec.attendance_date.isoformat(),
            "shift": rec.shift,
            "status": rec.status,
            "punch_in_at": rec.punch_in_at.isoformat() if rec.punch_in_at else None,
            "punch_out_at": rec.punch_out_at.isoformat() if rec.punch_out_at else None,
            "worked_minutes": w,
            "overtime_minutes": o,
            "late_minutes": l,
        }
        if can_view_cost and hourly_rate > 0:
            reg_cost = round((w - o) / 60 * hourly_rate, 2)
            ot_cost = round(o / 60 * hourly_rate * 1.5, 2)
            day["regular_cost_inr"] = reg_cost
            day["overtime_cost_inr"] = ot_cost
            day["total_day_cost_inr"] = round(reg_cost + ot_cost, 2)

        daily.append(day)

    return {
        "as_of": _tz_now().isoformat(),
        "period_days": days,
        "date_range": {"start": start_date.isoformat(), "end": end_date.isoformat()},
        "user_id": user_id,
        "name": user.name if user else f"User #{user_id}",
        "role": user.role.value if user else "unknown",
        "department": profile.department if profile else None,
        "designation": profile.designation if profile else None,
        "employee_code": profile.employee_code if profile else None,
        "financial_access": can_view_cost,
        "summary": {
            "days_present": days_present,
            "days_absent": len(records) - days_present,
            "total_worked_hours": round(total_worked / 60, 1),
            "total_overtime_hours": round(total_overtime / 60, 1),
            "total_late_hours": round(total_late / 60, 1),
            "avg_worked_hours_per_day": round(total_worked / max(days_present, 1) / 60, 1),
        },
        "daily": daily,
    }


# ═══════════════════════════════════════════════════════════════════════════════
# Shift comparison
# ═══════════════════════════════════════════════════════════════════════════════


def _build_shift_comparison(
    db: Session,
    factory_id: str,
    start_date: date,
    end_date: date,
) -> dict[str, Any]:
    """Compare attendance metrics across morning/evening/night shifts."""
    shift_data = (
        db.query(
            AttendanceRecord.shift,
            func.count(AttendanceRecord.id).label("total_records"),
            func.coalesce(func.sum(case((AttendanceRecord.status == "working", 1), else_=0)), 0).label("working"),
            func.coalesce(func.sum(case((AttendanceRecord.status == "completed", 1), else_=0)), 0).label("completed"),
            func.coalesce(func.sum(case((AttendanceRecord.status == "absent", 1), else_=0)), 0).label("absent"),
            func.coalesce(func.sum(AttendanceRecord.worked_minutes), 0).label("total_worked_minutes"),
            func.coalesce(func.sum(AttendanceRecord.overtime_minutes), 0).label("total_overtime_minutes"),
            func.coalesce(func.sum(AttendanceRecord.late_minutes), 0).label("total_late_minutes"),
            func.avg(AttendanceRecord.worked_minutes).label("avg_worked_minutes"),
            func.avg(AttendanceRecord.overtime_minutes).label("avg_overtime_minutes"),
            func.count(func.nullif(AttendanceRecord.overtime_minutes, 0)).label("overtime_count"),
            func.count(func.nullif(AttendanceRecord.late_minutes, 0)).label("late_count"),
        )
        .filter(
            AttendanceRecord.factory_id == factory_id,
            AttendanceRecord.attendance_date >= start_date,
            AttendanceRecord.attendance_date <= end_date,
        )
        .group_by(AttendanceRecord.shift)
        .all()
    )

    shifts = [
        {
            "shift": row.shift,
            "total_records": int(row.total_records),
            "working": int(row.working),
            "completed": int(row.completed),
            "absent": int(row.absent),
            "total_worked_hours": round(int(row.total_worked_minutes or 0) / 60, 1),
            "total_overtime_hours": round(int(row.total_overtime_minutes or 0) / 60, 1),
            "total_late_hours": round(int(row.total_late_minutes or 0) / 60, 1),
            "avg_worked_minutes": round(float(row.avg_worked_minutes or 0), 1),
            "avg_overtime_minutes": round(float(row.avg_overtime_minutes or 0), 1),
            "overtime_count": int(row.overtime_count),
            "late_count": int(row.late_count),
        }
        for row in shift_data
    ]

    # Determine best performing shift (highest avg worked minutes)
    best_shift = max(shifts, key=lambda s: s["avg_worked_minutes"]) if shifts else None

    return {
        "shifts": shifts,
        "best_performing_shift": best_shift["shift"] if best_shift else None,
        "best_avg_worked_minutes": best_shift["avg_worked_minutes"] if best_shift else None,
    }


# ═══════════════════════════════════════════════════════════════════════════════
# Cost summary
# ═══════════════════════════════════════════════════════════════════════════════


def _build_cost_summary(
    db: Session,
    factory_id: str,
    start_date: date,
    end_date: date,
    total_worked_minutes: int,
    total_overtime_minutes: int,
) -> dict[str, Any]:
    """Aggregate labour cost across the factory for the given period."""
    # Get current effective rate for factory (highest-priority fallback)
    default_rate = (
        db.query(WorkforceCostRate)
        .filter(
            WorkforceCostRate.factory_id == factory_id,
            WorkforceCostRate.user_id.is_(None),
            WorkforceCostRate.role.is_(None),
            WorkforceCostRate.department.is_(None),
            WorkforceCostRate.is_active.is_(True),
            WorkforceCostRate.effective_from <= end_date,
            (WorkforceCostRate.effective_to.is_(None) | (WorkforceCostRate.effective_to >= start_date)),
        )
        .order_by(WorkforceCostRate.effective_from.desc())
        .first()
    )
    base_rate = float(default_rate.regular_hourly_rate_inr) if default_rate else 150.0  # Default ₹150/hr
    overtime_mult = float(default_rate.overtime_multiplier) if default_rate else 1.5

    regular_hours = (total_worked_minutes - total_overtime_minutes) / 60
    overtime_hours = total_overtime_minutes / 60
    regular_cost = round(regular_hours * base_rate, 2)
    overtime_cost = round(overtime_hours * base_rate * overtime_mult, 2)
    total_cost = round(regular_cost + overtime_cost, 2)

    # Count unique workers
    worker_count = (
        db.query(func.count(func.distinct(AttendanceRecord.user_id)))
        .filter(
            AttendanceRecord.factory_id == factory_id,
            AttendanceRecord.attendance_date >= start_date,
            AttendanceRecord.attendance_date <= end_date,
        )
        .scalar()
        or 0
    )

    return {
        "worker_count": worker_count,
        "total_regular_hours": round(regular_hours, 1),
        "total_overtime_hours": round(overtime_hours, 1),
        "regular_cost_inr": regular_cost,
        "overtime_cost_inr": overtime_cost,
        "total_cost_inr": total_cost,
        "effective_hourly_rate_inr": base_rate,
        "overtime_multiplier": overtime_mult,
        "valuation_note": "Based on factory-default rate. Per-worker rates provide more accurate costing.",
    }


# ═══════════════════════════════════════════════════════════════════════════════
# Cost rates CRUD
# ═══════════════════════════════════════════════════════════════════════════════


def list_cost_rates(
    db: Session,
    factory_id: str,
    limit: int = 50,
) -> list[dict[str, Any]]:
    rates = (
        db.query(WorkforceCostRate)
        .filter(
            WorkforceCostRate.factory_id == factory_id,
            WorkforceCostRate.is_active.is_(True),
        )
        .order_by(WorkforceCostRate.effective_from.desc(), WorkforceCostRate.created_at.desc())
        .limit(limit)
        .all()
    )
    return [
        {
            "id": r.id,
            "user_id": r.user_id,
            "role": r.role,
            "department": r.department,
            "effective_from": r.effective_from.isoformat(),
            "effective_to": r.effective_to.isoformat() if r.effective_to else None,
            "regular_hourly_rate_inr": float(r.regular_hourly_rate_inr),
            "overtime_multiplier": float(r.overtime_multiplier),
            "notes": r.notes,
            "created_at": r.created_at.isoformat(),
        }
        for r in rates
    ]


def create_cost_rate(
    db: Session,
    factory_id: str,
    org_id: str,
    created_by_user_id: int,
    payload: dict[str, Any],
) -> dict[str, Any]:
    rate = WorkforceCostRate(
        org_id=org_id,
        factory_id=factory_id,
        user_id=payload.get("user_id"),
        role=payload.get("role"),
        department=payload.get("department"),
        effective_from=payload["effective_from"],
        effective_to=payload.get("effective_to"),
        regular_hourly_rate_inr=payload["regular_hourly_rate_inr"],
        overtime_multiplier=payload.get("overtime_multiplier", 1.5),
        notes=payload.get("notes"),
        created_by_user_id=created_by_user_id,
    )
    db.add(rate)
    db.commit()
    db.refresh(rate)
    return {
        "id": rate.id,
        "user_id": rate.user_id,
        "role": rate.role,
        "department": rate.department,
        "effective_from": rate.effective_from.isoformat(),
        "regular_hourly_rate_inr": float(rate.regular_hourly_rate_inr),
        "overtime_multiplier": float(rate.overtime_multiplier),
    }
