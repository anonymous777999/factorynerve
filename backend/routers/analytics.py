"""Analytics router for DPR insights."""

from __future__ import annotations

from datetime import date, timedelta
import os
from typing import Any

from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy import case, func
from sqlalchemy.orm import Session

from backend.cache import build_cache_key, get_or_set_json
from backend.database import get_db
from backend.models.entry import Entry
from backend.models.user import User, UserRole
from backend.security import get_current_user
from backend.rbac import require_any_role, require_role
from backend.plans import has_plan_feature, min_plan_for_feature, get_org_plan, normalize_plan, plan_rank
from backend.tenancy import resolve_factory_id, resolve_org_id
from backend.query_helpers import apply_org_scope, apply_role_scope, factory_user_ids_query


router = APIRouter(tags=["Analytics"])
ANALYTICS_CACHE_TTL = int(os.getenv("ANALYTICS_CACHE_TTL_SECONDS", "30"))


def _apply_org_filter(query: Any, current_user: User) -> Any:
    return apply_org_scope(query, current_user)


def _apply_role_filter(query: Any, db: Session, current_user: User) -> Any:
    return apply_role_scope(query, db, current_user)


def _require_analytics_feature(db: Session, current_user: User) -> None:
    org_id = resolve_org_id(current_user)
    plan = get_org_plan(db, org_id=org_id, fallback_user_id=current_user.id)
    if not has_plan_feature(plan, "analytics"):
        min_plan = min_plan_for_feature("analytics")
        raise HTTPException(
            status_code=402,
            detail=f"Analytics is not available on the {plan.title()} plan. Upgrade to {min_plan.title()} or higher to unlock this.",
        )


def _basic_min_plan() -> str:
    raw = (os.getenv("ANALYTICS_BASIC_MIN_PLAN") or "growth").strip().lower()
    return normalize_plan(raw)


def _require_basic_analytics(db: Session, current_user: User) -> None:
    org_id = resolve_org_id(current_user)
    plan = get_org_plan(db, org_id=org_id, fallback_user_id=current_user.id)
    min_plan = _basic_min_plan()
    if plan_rank(plan) < plan_rank(min_plan):
        raise HTTPException(
            status_code=402,
            detail=f"Analytics is not available on the {plan.title()} plan. Upgrade to {min_plan.title()} or higher to unlock this.",
        )


def _cache_key(db: Session, current_user: User, *parts: Any) -> str:
    return build_cache_key(
        "org",
        resolve_org_id(current_user) or "personal",
        "factory",
        resolve_factory_id(db, current_user) or "all",
        "analytics",
        current_user.id,
        *parts,
    )


@router.get("/weekly")
def weekly_analytics(
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
) -> list[dict]:
    _require_basic_analytics(db, current_user)
    require_any_role(current_user, {UserRole.SUPERVISOR, UserRole.MANAGER, UserRole.ADMIN, UserRole.OWNER})
    today = date.today()
    start = today - timedelta(days=6)

    def build_payload() -> list[dict]:
        query = db.query(Entry).filter(Entry.date >= start, Entry.date <= today, Entry.is_active.is_(True))
        query = _apply_org_filter(query, current_user)
        query = _apply_role_filter(query, db, current_user)

        performance_expr = case(
            (Entry.units_target > 0, (Entry.units_produced * 100.0) / Entry.units_target),
            else_=0.0,
        )
        grouped = (
            query.with_entities(
                Entry.date.label("date"),
                func.sum(Entry.units_produced).label("units"),
                func.avg(performance_expr).label("production_percent"),
                func.avg(
                    case(
                        (
                            Entry.manpower_present + Entry.manpower_absent > 0,
                            (Entry.manpower_present * 100.0) / (Entry.manpower_present + Entry.manpower_absent),
                        ),
                        else_=0.0,
                    )
                ).label("attendance_percent"),
            )
            .group_by(Entry.date)
            .all()
        )
        by_date = {row.date: row for row in grouped}
        results = []
        for offset in range(7):
            day = start + timedelta(days=offset)
            row = by_date.get(day)
            results.append(
                {
                    "date": day.isoformat(),
                    "units": int(row.units) if row and row.units else 0,
                    "production_percent": float(row.production_percent)
                    if row and row.production_percent is not None
                    else 0.0,
                    "attendance_percent": float(row.attendance_percent)
                    if row and row.attendance_percent is not None
                    else 0.0,
                }
            )
        return results

    return get_or_set_json(
        _cache_key(db, current_user, "weekly", start.isoformat(), today.isoformat()),
        ANALYTICS_CACHE_TTL,
        build_payload,
    )


@router.get("/monthly")
def monthly_summary(
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
) -> dict:
    _require_basic_analytics(db, current_user)
    require_any_role(current_user, {UserRole.SUPERVISOR, UserRole.MANAGER, UserRole.ADMIN, UserRole.OWNER})
    today = date.today()
    start = today - timedelta(days=29)

    def build_payload() -> dict:
        query = db.query(Entry).filter(Entry.date >= start, Entry.date <= today, Entry.is_active.is_(True))
        query = _apply_org_filter(query, current_user)
        query = _apply_role_filter(query, db, current_user)

        performance_expr = case(
            (Entry.units_target > 0, (Entry.units_produced * 100.0) / Entry.units_target),
            else_=0.0,
        )
        grouped = (
            query.with_entities(
                Entry.date.label("date"),
                func.sum(Entry.units_produced).label("units"),
                func.avg(performance_expr).label("performance"),
            )
            .group_by(Entry.date)
            .all()
        )
        if not grouped:
            return {"summary": [], "best_day": None, "worst_day": None, "average": 0.0}
        best = max(grouped, key=lambda row: row.performance or 0)
        worst = min(grouped, key=lambda row: row.performance or 0)
        avg = sum(float(row.performance or 0) for row in grouped) / len(grouped)
        return {
            "summary": [
                {"date": row.date.isoformat(), "units": int(row.units or 0), "performance": float(row.performance or 0)}
                for row in grouped
            ],
            "best_day": {"date": best.date.isoformat(), "performance": float(best.performance or 0)},
            "worst_day": {"date": worst.date.isoformat(), "performance": float(worst.performance or 0)},
            "average": avg,
        }

    return get_or_set_json(
        _cache_key(db, current_user, "monthly", start.isoformat(), today.isoformat()),
        ANALYTICS_CACHE_TTL,
        build_payload,
    )


@router.get("/trends")
def trends(
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
) -> dict:
    _require_analytics_feature(db, current_user)
    require_any_role(current_user, {UserRole.SUPERVISOR, UserRole.MANAGER, UserRole.ADMIN, UserRole.OWNER})
    today = date.today()
    start = today - timedelta(days=6)

    def build_payload() -> dict:
        query = db.query(Entry).filter(Entry.date >= start, Entry.date <= today, Entry.is_active.is_(True))
        query = _apply_org_filter(query, current_user)
        query = _apply_role_filter(query, db, current_user)

        performance_expr = case(
            (Entry.units_target > 0, (Entry.units_produced * 100.0) / Entry.units_target),
            else_=0.0,
        )
        daily = (
            query.with_entities(
                Entry.date.label("date"),
                func.avg(performance_expr).label("performance"),
                func.sum(Entry.downtime_minutes).label("downtime"),
            )
            .group_by(Entry.date)
            .order_by(Entry.date)
            .all()
        )
        if len(daily) >= 2 and daily[-1].performance is not None and daily[0].performance is not None:
            trend = (
                "up"
                if daily[-1].performance > daily[0].performance
                else "down" if daily[-1].performance < daily[0].performance else "stable"
            )
        else:
            trend = "stable"

        common_issues = {
            "downtime": sum(int(row.downtime or 0) for row in daily),
            "quality": query.filter(Entry.quality_issues.is_(True)).count(),
        }

        peak_shift = (
            query.with_entities(Entry.shift, func.avg(performance_expr).label("performance"))
            .group_by(Entry.shift)
            .order_by(func.avg(performance_expr).desc())
            .first()
        )
        return {
            "production_trend": trend,
            "common_issues": common_issues,
            "peak_performance_shift": peak_shift.shift if peak_shift else None,
        }

    return get_or_set_json(
        _cache_key(db, current_user, "trends", start.isoformat(), today.isoformat()),
        ANALYTICS_CACHE_TTL,
        build_payload,
    )


@router.get("/manager")
def manager_analytics(
    start_date: date | None = None,
    end_date: date | None = None,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
) -> dict:
    _require_analytics_feature(db, current_user)
    require_role(current_user, UserRole.MANAGER)
    start = start_date or (date.today() - timedelta(days=7))
    end = end_date or date.today()

    def build_payload() -> dict:
        query = db.query(Entry).filter(Entry.date >= start, Entry.date <= end, Entry.is_active.is_(True))
        query = _apply_org_filter(query, current_user)
        if current_user.role == UserRole.MANAGER:
            query = query.filter(Entry.user_id.in_(factory_user_ids_query(db, current_user)))
            factory_id = resolve_factory_id(db, current_user)
            if factory_id:
                query = query.filter(Entry.factory_id == factory_id)

        performance_expr = case(
            (Entry.units_target > 0, (Entry.units_produced * 100.0) / Entry.units_target),
            else_=0.0,
        )

        totals = query.with_entities(
            func.sum(Entry.units_produced).label("total_units"),
            func.sum(Entry.units_target).label("total_target"),
            func.avg(performance_expr).label("average_performance"),
            func.sum(Entry.downtime_minutes).label("total_downtime"),
        ).first()

        shift_summary = (
            query.with_entities(
                Entry.shift.label("shift"),
                func.avg(performance_expr).label("production_percent"),
            )
            .group_by(Entry.shift)
            .all()
        )
        supervisor_summary = (
            query.join(User, Entry.user_id == User.id)
            .with_entities(
                User.name.label("name"),
                func.avg(performance_expr).label("production_percent"),
                func.sum(Entry.downtime_minutes).label("downtime_minutes"),
            )
            .group_by(User.name)
            .all()
        )
        return {
            "totals": {
                "total_units": int(totals.total_units or 0),
                "total_target": int(totals.total_target or 0),
                "average_performance": float(totals.average_performance or 0),
                "total_downtime": int(totals.total_downtime or 0),
            },
            "shift_summary": [
                {"shift": row.shift, "production_percent": float(row.production_percent or 0)}
                for row in shift_summary
            ],
            "supervisor_summary": [
                {
                    "name": row.name,
                    "production_percent": float(row.production_percent or 0),
                    "downtime_minutes": int(row.downtime_minutes or 0),
                }
                for row in supervisor_summary
            ],
        }

    return get_or_set_json(
        _cache_key(db, current_user, "manager", start.isoformat(), end.isoformat()),
        ANALYTICS_CACHE_TTL,
        build_payload,
    )
