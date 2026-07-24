"""Machine Analytics — per-machine downtime Pareto and MTBF/MTTR trends.

Provides deeper analytics for individual machines: downtime reason
breakdown (Pareto) and weekly MTBF/MTTR trends over time.
"""

from __future__ import annotations

from datetime import date as dt_date, datetime, timedelta, timezone
from typing import Any

from sqlalchemy import func
from sqlalchemy.orm import Session

from backend.models.steel_machine import SteelMachine
from backend.models.steel_machine_downtime_event import SteelMachineDowntimeEvent


def build_machine_analytics(
    db: Session,
    factory_id: str,
    machine_id: int,
    *,
    days: int = 90,
) -> dict[str, Any]:
    """Return downtime Pareto and weekly MTBF/MTTR trends for a single machine.

    Returns:
        downtime_pareto: list of {reason_category, total_minutes, event_count, percent_of_total}
        mtbf_trend: list of {week_start, mtbf_hours, failure_count, downtime_minutes}
        mttr_trend: list of {week_start, mttr_minutes, failure_count}
        daily_downtime_trend: list of {date, downtime_minutes, event_count, top_reason}
        summary: {total_downtime_minutes, total_events, failure_count, mtbf_hours, mttr_minutes}
    """
    cutoff = datetime.now(timezone.utc) - timedelta(days=days)

    # Verify machine exists and belongs to factory
    machine = (
        db.query(SteelMachine)
        .filter(
            SteelMachine.id == machine_id,
            SteelMachine.factory_id == factory_id,
            SteelMachine.is_active.is_(True),
        )
        .first()
    )
    if not machine:
        return {
            "machine_id": machine_id,
            "error": "Machine not found or inactive.",
            "downtime_pareto": [],
            "mtbf_trend": [],
            "mttr_trend": [],
            "daily_downtime_trend": [],
            "summary": None,
        }

    # Fetch all downtime events for this machine in the period
    events = (
        db.query(SteelMachineDowntimeEvent)
        .filter(
            SteelMachineDowntimeEvent.factory_id == factory_id,
            SteelMachineDowntimeEvent.machine_id == machine_id,
            SteelMachineDowntimeEvent.started_at >= cutoff,
        )
        .order_by(SteelMachineDowntimeEvent.started_at.asc())
        .all()
    )

    if not events:
        return {
            "machine_id": machine_id,
            "machine_code": machine.machine_code,
            "machine_name": machine.name,
            "downtime_pareto": [],
            "mtbf_trend": [],
            "mttr_trend": [],
            "daily_downtime_trend": [],
            "summary": {
                "total_downtime_minutes": 0.0,
                "total_events": 0,
                "failure_count": 0,
                "mtbf_hours": None,
                "mttr_minutes": None,
                "period_days": days,
            },
        }

    # ── 1. Downtime Pareto (by reason_category) ─────────────────────────
    reason_totals: dict[str, float] = {}
    reason_counts: dict[str, int] = {}
    for evt in events:
        cat = evt.reason_category or "Unspecified"
        reason_totals[cat] = reason_totals.get(cat, 0.0) + float(evt.duration_minutes or 0.0)
        reason_counts[cat] = reason_counts.get(cat, 0) + 1

    total_downtime = sum(reason_totals.values())
    sorted_reasons = sorted(reason_totals.items(), key=lambda x: x[1], reverse=True)
    cumulative = 0.0
    downtime_pareto = []
    for cat, mins in sorted_reasons:
        cumulative += mins
        downtime_pareto.append({
            "reason_category": cat,
            "total_minutes": round(mins, 1),
            "event_count": reason_counts[cat],
            "percent_of_total": round(mins / total_downtime * 100.0, 1) if total_downtime > 0 else 0.0,
            "cumulative_percent": round(cumulative / total_downtime * 100.0, 1) if total_downtime > 0 else 0.0,
        })

    # ── 2. Daily downtime trend ─────────────────────────────────────────
    daily: dict[str, dict[str, Any]] = {}
    for evt in events:
        day_key = evt.started_at.strftime("%Y-%m-%d")
        if day_key not in daily:
            daily[day_key] = {
                "date": day_key,
                "downtime_minutes": 0.0,
                "event_count": 0,
                "reason_breakdown": {},
            }
        mins = float(evt.duration_minutes or 0.0)
        daily[day_key]["downtime_minutes"] += mins
        daily[day_key]["event_count"] += 1
        cat = evt.reason_category or "Unspecified"
        daily[day_key]["reason_breakdown"][cat] = (
            daily[day_key]["reason_breakdown"].get(cat, 0.0) + mins
        )

    daily_downtime_trend = []
    for day_key in sorted(daily.keys()):
        entry = daily[day_key]
        # Find the top reason for this day
        breakdown = entry["reason_breakdown"]
        top_reason = max(breakdown, key=breakdown.get) if breakdown else None
        daily_downtime_trend.append({
            "date": entry["date"],
            "downtime_minutes": round(entry["downtime_minutes"], 1),
            "event_count": entry["event_count"],
            "top_reason": top_reason,
        })

    # ── 3. Weekly MTBF/MTTR trends ──────────────────────────────────────
    def iso_week_key(dt_val: datetime) -> str:
        """Return ISO week start (Monday) as YYYY-MM-DD."""
        iso = dt_val.isocalendar()
        monday = dt_date.fromisocalendar(iso[0], iso[1], 1)
        return monday.isoformat()

    weekly: dict[str, list[SteelMachineDowntimeEvent]] = {}
    for evt in events:
        wk = iso_week_key(evt.started_at)
        weekly.setdefault(wk, []).append(evt)

    mtbf_trend = []
    mttr_trend = []
    for wk in sorted(weekly.keys()):
        wk_events = weekly[wk]
        wk_failures = [e for e in wk_events if e.reason_category and e.reason_category.strip().lower() != "planned"]
        wk_failure_count = len(wk_failures)
        wk_downtime = sum(float(e.duration_minutes or 0.0) for e in wk_events)
        wk_failure_durations = [float(e.duration_minutes or 0.0) for e in wk_failures if e.duration_minutes is not None]

        # MTBF for the week: None when no failures (infinite MTBF means no data to measure)
        wk_mtbf = round(168.0 / wk_failure_count, 1) if wk_failure_count > 0 else None
        # MTTR for the week: avg duration of failure events
        wk_mttr = round(sum(wk_failure_durations) / max(len(wk_failure_durations), 1), 1) if wk_failure_durations else None

        mtbf_trend.append({
            "week_start": wk,
            "mtbf_hours": wk_mtbf,
            "failure_count": wk_failure_count,
            "downtime_minutes": round(wk_downtime, 1),
        })
        mttr_trend.append({
            "week_start": wk,
            "mttr_minutes": wk_mttr,
            "failure_count": wk_failure_count,
        })

    # ── 4. Summary stats ────────────────────────────────────────────────
    failure_events = [e for e in events if e.reason_category and e.reason_category.strip().lower() != "planned"]
    failure_count = len(failure_events)
    failure_durations = [float(e.duration_minutes or 0.0) for e in failure_events if e.duration_minutes is not None]
    mtbf = round((days * 24.0) / max(failure_count, 1), 1) if failure_count > 0 else None
    mttr = round(sum(failure_durations) / max(len(failure_durations), 1), 1) if failure_durations else None

    return {
        "machine_id": machine_id,
        "machine_code": machine.machine_code,
        "machine_name": machine.name,
        "period_days": days,
        "downtime_pareto": downtime_pareto,
        "daily_downtime_trend": daily_downtime_trend,
        "mtbf_trend": mtbf_trend,
        "mttr_trend": mttr_trend,
        "summary": {
            "total_downtime_minutes": round(total_downtime, 1),
            "total_events": len(events),
            "failure_count": failure_count,
            "mtbf_hours": mtbf,
            "mttr_minutes": mttr,
            "period_days": days,
        },
    }
