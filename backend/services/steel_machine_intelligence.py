"""Machine Intelligence — downtime events, maintenance tracking, MTBF/MTTR, and uptime analysis.

Exposes both raw event CRUD and aggregated analytics that power the
machine intelligence dashboard and feed into production intelligence.
"""

from __future__ import annotations

from datetime import date, datetime, timedelta, timezone
from typing import Any

from sqlalchemy import func
from sqlalchemy.orm import Session

from backend.models.steel_machine import SteelMachine
from backend.models.steel_machine_downtime_event import SteelMachineDowntimeEvent
from backend.models.steel_maintenance_task import SteelMaintenanceTask
from backend.models.steel_production_batch import SteelProductionBatch
from backend.models.user import User


# ── Constants ─────────────────────────────────────────────────────────────────

DEFAULT_PERIOD_DAYS = 30
MAX_PERIOD_DAYS = 365
MTBF_THRESHOLD_HOURS = 2  # Alert when MTBF drops below 2 hours (frequent failures)


# ── Machine Intelligence Summary ─────────────────────────────────────────────

def build_machine_intelligence(
    db: Session,
    factory_id: str,
    *,
    days: int = DEFAULT_PERIOD_DAYS,
    machine_id: int | None = None,
) -> dict[str, Any]:
    """Comprehensive machine intelligence for a factory or specific machine.

    Returns a snapshot of machine-level metrics including uptime/downtime,
    MTBF/MTTR, maintenance status, and per-machine event summaries.
    """
    cutoff = datetime.now(timezone.utc) - timedelta(days=days)
    today = date.today()

    # Base machine query
    machines_query = db.query(SteelMachine).filter(
        SteelMachine.factory_id == factory_id,
        SteelMachine.is_active.is_(True),
    )
    if machine_id is not None:
        machines_query = machines_query.filter(SteelMachine.id == machine_id)
    machines = machines_query.order_by(SteelMachine.name.asc()).all()

    machine_ids = [m.id for m in machines]

    # Downtime events in period
    downtime_events = (
        db.query(SteelMachineDowntimeEvent)
        .filter(
            SteelMachineDowntimeEvent.factory_id == factory_id,
            SteelMachineDowntimeEvent.machine_id.in_(machine_ids),
            SteelMachineDowntimeEvent.started_at >= cutoff,
        )
        .order_by(SteelMachineDowntimeEvent.started_at.desc())
        .all()
    ) if machine_ids else []

    # Maintenance tasks in period
    maintenance_tasks = (
        db.query(SteelMaintenanceTask)
        .filter(
            SteelMaintenanceTask.factory_id == factory_id,
            SteelMaintenanceTask.machine_id.in_(machine_ids),
            SteelMaintenanceTask.created_at >= cutoff,
        )
        .order_by(SteelMaintenanceTask.scheduled_date.desc())
        .all()
    ) if machine_ids else []

    # Per-machine rollup
    downtime_by_machine: dict[int, list[SteelMachineDowntimeEvent]] = {}
    for evt in downtime_events:
        downtime_by_machine.setdefault(evt.machine_id, []).append(evt)

    # Batch output for OEE performance
    batch_cutoff_date = date.today() - timedelta(days=days)
    machine_batches = (
        db.query(SteelProductionBatch)
        .filter(
            SteelProductionBatch.factory_id == factory_id,
            SteelProductionBatch.machine_id.in_(machine_ids),
            SteelProductionBatch.production_date >= batch_cutoff_date,
        )
        .all()
    ) if machine_ids else []

    batches_by_machine: dict[int, list[SteelProductionBatch]] = {}
    for b in machine_batches:
        batches_by_machine.setdefault(b.machine_id, []).append(b)

    maintenance_by_machine: dict[int, list[SteelMaintenanceTask]] = {}
    for task in maintenance_tasks:
        maintenance_by_machine.setdefault(task.machine_id, []).append(task)

    per_machine = []
    total_uptime_pct = 0.0
    total_downtime_minutes = 0.0
    total_failure_count = 0

    for mach in machines:
        d_events = downtime_by_machine.get(mach.id, [])
        m_tasks = maintenance_by_machine.get(mach.id, [])

        machine_downtime_minutes = sum(
            float(e.duration_minutes or 0.0)
            for e in d_events
            if e.duration_minutes is not None
        )
        total_downtime_minutes += machine_downtime_minutes

        # True OEE calculation when planned_runtime is available on the machine
        planned_minutes = float(mach.planned_runtime_minutes or 0.0)
        operating_minutes = float(mach.operating_runtime_minutes or 0.0)
        has_runtime_data = planned_minutes > 0

        # Initialize OEE variables before conditional (avoid NameError in else branch)
        availability = None
        performance = None
        quality = None
        oee_score = None

        if has_runtime_data:
            # Availability = Operating Runtime / Planned Production Time
            # Use operating_runtime_minutes when available, otherwise estimate from planned - downtime
            effective_operating = operating_minutes if operating_minutes > 0 else max(0.0, planned_minutes - machine_downtime_minutes)
            availability = max(0.0, effective_operating / planned_minutes * 100.0)
            uptime_pct = round(availability, 1)
        else:
            # Fallback: assume 24h/day availability
            machine_operating_minutes = days * 24 * 60
            uptime_pct = (
                max(0.0, 100.0 - (machine_downtime_minutes / max(machine_operating_minutes, 1) * 100.0))
                if machine_operating_minutes > 0
                else 100.0
            )
        total_uptime_pct += uptime_pct

        # ── OEE Performance from batch output ────────────────────────
        # Performance = (total_actual_output / total_expected_output) × 100
        # Uses batches linked to this machine_id within the analysis period.
        # Capped at 100% to be conservative — actual exceeding expected may
        # indicate conservative planning rather than true over-performance.
        machine_batches_list = batches_by_machine.get(mach.id, [])
        total_expected = sum(float(b.expected_output_kg or 0.0) for b in machine_batches_list)
        total_actual = sum(float(b.actual_output_kg or 0.0) for b in machine_batches_list)
        if total_expected > 0:
            raw_performance = total_actual / total_expected * 100.0
            performance = round(min(raw_performance, 100.0), 1)
        else:
            performance = None

        # ── OEE Score = Availability × Performance (Quality = 1.0 for now) ──
        if availability is not None and performance is not None:
            oee_score = round(availability * performance / 100.0, 1)
        quality = None  # needs per-machine good_output_count tracking

        # Failure events (downtime events with a reason)
        failure_events = [e for e in d_events if e.reason_category and e.reason_category.strip().lower() != "planned"]
        failure_count = len(failure_events)
        total_failure_count += failure_count

        # MTBF (hours between failures)
        mtbf_hours = round((days * 24.0) / max(failure_count, 1), 1) if failure_count > 0 else None

        # MTTR (hours to repair)
        failure_durations = [float(e.duration_minutes or 0.0) for e in failure_events if e.duration_minutes is not None]
        mttr_minutes = round(sum(failure_durations) / max(len(failure_durations), 1), 1) if failure_durations else None

        # Latest downtime reason categories
        top_reasons = _top_reasons(d_events, limit=5)

        # Maintenance status
        upcoming_tasks = [t for t in m_tasks if t.status in ("scheduled", "in_progress")]
        now_dt = datetime.now(timezone.utc)
        overdue_tasks = [t for t in m_tasks if t.status in ("scheduled", "in_progress")
                        and t.scheduled_date.replace(tzinfo=timezone.utc) < now_dt]
        completed_tasks = [t for t in m_tasks if t.status == "completed"]
        last_maintenance_at = max(
            (t.completed_at for t in completed_tasks if t.completed_at),
            default=None,
        )
        maintenance_due = (
            next(
                (t for t in upcoming_tasks if t.scheduled_date.replace(tzinfo=timezone.utc) <= now_dt + timedelta(days=7)),
                None,
            )
            is not None
        )

        # ── Machine-level alerts ────────────────────────────────────
        mtbf_alert = mtbf_hours is not None and mtbf_hours < MTBF_THRESHOLD_HOURS
        overdue_maintenance_alert = len(overdue_tasks) > 0
        maintenance_due_alert = maintenance_due
        machine_alerts: list[dict[str, Any]] = []
        if mtbf_alert:
            machine_alerts.append({
                "type": "mtbf_low",
                "severity": "critical",
                "message": f"MTBF {mtbf_hours}h below threshold of {MTBF_THRESHOLD_HOURS}h ({failure_count} failures in {days}d)",
            })
        if overdue_maintenance_alert:
            machine_alerts.append({
                "type": "overdue_maintenance",
                "severity": "high",
                "message": f"{len(overdue_tasks)} overdue maintenance task(s)",
            })
        if maintenance_due_alert:
            machine_alerts.append({
                "type": "maintenance_due_soon",
                "severity": "warning",
                "message": "Maintenance due within 7 days",
            })

        per_machine.append({
            "machine_id": mach.id,
            "machine_code": mach.machine_code,
            "machine_name": mach.name,
            "machine_type": mach.machine_type,
            "line_id": mach.line_id,
            "rated_capacity_per_hour": mach.rated_capacity_per_hour,
            "planned_runtime_minutes": mach.planned_runtime_minutes,
            "operating_runtime_minutes": mach.operating_runtime_minutes,
            "downtime_minutes": round(machine_downtime_minutes, 1),
            "uptime_percent": round(uptime_pct, 1),
            "oee_availability_percent": round(availability, 1) if availability is not None else None,
            "oee_performance_percent": performance,
            "oee_quality_percent": None,
            "oee_score": oee_score,
            "oee_data_quality": "true_runtime" if has_runtime_data else "estimated_24h",
            "failure_count": failure_count,
            "mtbf_hours": mtbf_hours,
            "mttr_minutes": mttr_minutes,
            "top_downtime_reasons": top_reasons,
            "event_count": len(d_events),
            "upcoming_maintenance_count": len(upcoming_tasks),
            "overdue_maintenance_count": len(overdue_tasks),
            "last_maintenance_at": last_maintenance_at.isoformat() if last_maintenance_at else None,
            "maintenance_due_soon": maintenance_due,
            "maintenance_tasks": [
                _serialize_task(t) for t in sorted(
                    m_tasks, key=lambda x: x.scheduled_date, reverse=True
                )[:10]
            ],
            "alerts": machine_alerts,
        })

    # Factory-wide rollup
    factory_uptime = round(
        total_uptime_pct / max(len(per_machine), 1), 1
    ) if per_machine else None
    factory_downtime = round(total_downtime_minutes, 1)
    all_failures = total_failure_count
    factory_mtbf = round(
        (days * 24.0 * max(len(per_machine), 1)) / max(all_failures, 1), 1
    ) if all_failures > 0 else None

    # Overdue & upcoming maintenance across all machines
    all_maintenance = maintenance_tasks
    maintenance_now_dt = datetime.now(timezone.utc)
    total_overdue = len([t for t in all_maintenance if t.status in ("scheduled", "in_progress")
                        and t.scheduled_date.replace(tzinfo=timezone.utc) < maintenance_now_dt])
    total_upcoming = len([t for t in all_maintenance if t.status in ("scheduled", "in_progress")])

    return {
        "as_of": today.isoformat(),
        "period_days": days,
        "machine_count": len(per_machine),
        "factory_summary": {
            "avg_uptime_percent": factory_uptime,
            "total_downtime_minutes": factory_downtime,
            "total_failure_count": all_failures,
            "factory_mtbf_hours": factory_mtbf,
            "overdue_maintenance_count": total_overdue,
            "upcoming_maintenance_count": total_upcoming,
            "completed_maintenance_count": len(
                [t for t in all_maintenance if t.status == "completed"]
            ),
            "active_alerts_count": sum(
                1 for m in per_machine for a in (m.get("alerts") or []) if a.get("severity") in ("critical", "high")
            ),
        },
        "machines": per_machine,
        "data_quality": "event_based" if any(
            m["event_count"] > 0 for m in per_machine
        ) else "no_downtime_data",
        "has_true_oee": any(
            m.get("oee_data_quality") == "true_runtime" for m in per_machine
        ),
        "has_runtime_data": any(
            m.get("planned_runtime_minutes") is not None and m["planned_runtime_minutes"] > 0
            for m in per_machine
        ),
        "note": (
            "True OEE computed from planned_runtime_minutes and downtime events. "
            "Performance derived from batch actual vs expected output (machine_id on batches). "
            "Set planned_runtime_minutes and operating_runtime_minutes on each machine "
            "to replace the 24h/day estimate with true availability."
        ),
    }


def _top_reasons(
    events: list[SteelMachineDowntimeEvent],
    limit: int = 5,
) -> list[dict[str, Any]]:
    """Aggregate downtime by reason category, sorted by total minutes."""
    reason_totals: dict[str, float] = {}
    reason_counts: dict[str, int] = {}
    for evt in events:
        cat = evt.reason_category or "Unspecified"
        reason_totals[cat] = reason_totals.get(cat, 0.0) + float(evt.duration_minutes or 0.0)
        reason_counts[cat] = reason_counts.get(cat, 0) + 1

    sorted_reasons = sorted(reason_totals.items(), key=lambda x: x[1], reverse=True)
    return [
        {
            "reason_category": cat,
            "total_minutes": round(mins, 1),
            "event_count": reason_counts[cat],
        }
        for cat, mins in sorted_reasons[:limit]
    ]


def _serialize_task(task: SteelMaintenanceTask) -> dict[str, Any]:
    return {
        "id": task.id,
        "machine_id": task.machine_id,
        "title": task.title,
        "description": task.description,
        "maintenance_type": task.maintenance_type,
        "status": task.status,
        "priority": task.priority,
        "scheduled_date": task.scheduled_date.isoformat(),
        "completed_at": task.completed_at.isoformat() if task.completed_at else None,
        "assigned_to_user_id": task.assigned_to_user_id,
        "runtime_hours_trigger": task.runtime_hours_trigger,
        "notes": task.notes,
        "created_at": task.created_at.isoformat(),
    }


# ── Raw Event CRUD ───────────────────────────────────────────────────────────

def list_downtime_events(
    db: Session,
    factory_id: str,
    *,
    machine_id: int | None = None,
    limit: int = 100,
    offset: int = 0,
) -> list[dict[str, Any]]:
    """List downtime events for a factory, optionally filtered by machine."""
    query = db.query(SteelMachineDowntimeEvent).filter(
        SteelMachineDowntimeEvent.factory_id == factory_id,
    )
    if machine_id is not None:
        query = query.filter(SteelMachineDowntimeEvent.machine_id == machine_id)
    query = query.order_by(SteelMachineDowntimeEvent.started_at.desc())
    query = query.offset(offset).limit(limit)
    events = query.all()

    # Hydrate machine names
    machine_ids = {e.machine_id for e in events}
    machines = (
        db.query(SteelMachine).filter(SteelMachine.id.in_(machine_ids)).all()
    ) if machine_ids else []
    machine_map = {m.id: m for m in machines}

    return [
        {
            "id": e.id,
            "machine_id": e.machine_id,
            "machine_code": machine_map[e.machine_id].machine_code if e.machine_id in machine_map else None,
            "machine_name": machine_map[e.machine_id].name if e.machine_id in machine_map else None,
            "started_at": e.started_at.isoformat(),
            "ended_at": e.ended_at.isoformat() if e.ended_at else None,
            "duration_minutes": e.duration_minutes,
            "reason_category": e.reason_category,
            "reason_detail": e.reason_detail,
            "shift": e.shift,
            "operator_user_id": e.operator_user_id,
            "entry_id": e.entry_id,
            "notes": e.notes,
            "created_at": e.created_at.isoformat(),
        }
        for e in events
    ]


def create_downtime_event(
    db: Session,
    org_id: str,
    factory_id: str,
    machine_id: int,
    started_at: datetime,
    *,
    ended_at: datetime | None = None,
    duration_minutes: float | None = None,
    reason_category: str | None = None,
    reason_detail: str | None = None,
    shift: str | None = None,
    operator_user_id: int | None = None,
    entry_id: int | None = None,
    notes: str | None = None,
    created_by_user_id: int | None = None,
) -> dict[str, Any]:
    """Create a new downtime event. Computes duration if ended_at is provided."""
    if ended_at and not duration_minutes:
        delta = ended_at - started_at
        duration_minutes = delta.total_seconds() / 60.0
    elif not duration_minutes:
        duration_minutes = None

    event = SteelMachineDowntimeEvent(
        org_id=org_id,
        factory_id=factory_id,
        machine_id=machine_id,
        started_at=started_at,
        ended_at=ended_at,
        duration_minutes=duration_minutes,
        reason_category=reason_category,
        reason_detail=reason_detail,
        shift=shift,
        operator_user_id=operator_user_id,
        entry_id=entry_id,
        notes=notes,
        created_by_user_id=created_by_user_id,
    )
    db.add(event)
    db.flush()
    return {
        "id": event.id,
        "machine_id": event.machine_id,
        "started_at": event.started_at.isoformat(),
        "ended_at": event.ended_at.isoformat() if event.ended_at else None,
        "duration_minutes": event.duration_minutes,
        "reason_category": event.reason_category,
        "shift": event.shift,
    }


# ── Maintenance Task CRUD ────────────────────────────────────────────────────

def list_maintenance_tasks(
    db: Session,
    factory_id: str,
    *,
    machine_id: int | None = None,
    status: str | None = None,
    limit: int = 100,
    offset: int = 0,
) -> list[dict[str, Any]]:
    """List maintenance tasks, optionally filtered by machine and/or status."""
    query = db.query(SteelMaintenanceTask).filter(
        SteelMaintenanceTask.factory_id == factory_id,
    )
    if machine_id is not None:
        query = query.filter(SteelMaintenanceTask.machine_id == machine_id)
    if status is not None:
        query = query.filter(SteelMaintenanceTask.status == status)
    query = query.order_by(SteelMaintenanceTask.scheduled_date.desc())
    query = query.offset(offset).limit(limit)
    tasks = query.all()

    # Hydrate machine names
    machine_ids = {t.machine_id for t in tasks}
    machines = (
        db.query(SteelMachine).filter(SteelMachine.id.in_(machine_ids)).all()
    ) if machine_ids else []
    machine_map = {m.id: m for m in machines}

    return [
        {
            "id": t.id,
            "machine_id": t.machine_id,
            "machine_code": machine_map[t.machine_id].machine_code if t.machine_id in machine_map else None,
            "machine_name": machine_map[t.machine_id].name if t.machine_id in machine_map else None,
            "title": t.title,
            "description": t.description,
            "maintenance_type": t.maintenance_type,
            "status": t.status,
            "priority": t.priority,
            "scheduled_date": t.scheduled_date.isoformat(),
            "completed_at": t.completed_at.isoformat() if t.completed_at else None,
            "assigned_to_user_id": t.assigned_to_user_id,
            "runtime_hours_trigger": t.runtime_hours_trigger,
            "notes": t.notes,
            "created_by_user_id": t.created_by_user_id,
            "created_at": t.created_at.isoformat(),
        }
        for t in tasks
    ]


def create_maintenance_task(
    db: Session,
    org_id: str,
    factory_id: str,
    machine_id: int,
    title: str,
    scheduled_date: datetime,
    *,
    description: str | None = None,
    maintenance_type: str = "preventive",
    priority: str = "medium",
    assigned_to_user_id: int | None = None,
    runtime_hours_trigger: float | None = None,
    notes: str | None = None,
    created_by_user_id: int | None = None,
) -> dict[str, Any]:
    """Create a new maintenance task."""
    task = SteelMaintenanceTask(
        org_id=org_id,
        factory_id=factory_id,
        machine_id=machine_id,
        title=title,
        description=description,
        maintenance_type=maintenance_type,
        status="scheduled",
        priority=priority,
        scheduled_date=scheduled_date,
        assigned_to_user_id=assigned_to_user_id,
        runtime_hours_trigger=runtime_hours_trigger,
        notes=notes,
        created_by_user_id=created_by_user_id,
    )
    db.add(task)
    db.flush()
    return {
        "id": task.id,
        "machine_id": task.machine_id,
        "title": task.title,
        "maintenance_type": task.maintenance_type,
        "status": task.status,
        "priority": task.priority,
        "scheduled_date": task.scheduled_date.isoformat(),
    }


def update_maintenance_task_status(
    db: Session,
    task_id: int,
    factory_id: str,
    new_status: str,
    *,
    notes: str | None = None,
) -> dict[str, Any] | None:
    """Update a maintenance task's status (e.g. mark completed)."""
    task = (
        db.query(SteelMaintenanceTask)
        .filter(
            SteelMaintenanceTask.id == task_id,
            SteelMaintenanceTask.factory_id == factory_id,
        )
        .first()
    )
    if not task:
        return None

    task.status = new_status
    if new_status == "completed":
        task.completed_at = datetime.now(timezone.utc)
    if notes:
        task.notes = (task.notes or "") + ("\n" + notes if task.notes else notes)

    db.flush()
    return {
        "id": task.id,
        "machine_id": task.machine_id,
        "status": task.status,
        "completed_at": task.completed_at.isoformat() if task.completed_at else None,
    }


def update_maintenance_task(
    db: Session,
    task_id: int,
    factory_id: str,
    *,
    title: str | None = None,
    description: str | None = None,
    maintenance_type: str | None = None,
    priority: str | None = None,
    scheduled_date: datetime | None = None,
    assigned_to_user_id: int | None = None,
    notes: str | None = None,
) -> dict[str, Any] | None:
    """Update a maintenance task's fields (title, date, priority, etc.)."""
    task = (
        db.query(SteelMaintenanceTask)
        .filter(
            SteelMaintenanceTask.id == task_id,
            SteelMaintenanceTask.factory_id == factory_id,
        )
        .first()
    )
    if not task:
        return None

    if title is not None:
        task.title = title
    if description is not None:
        task.description = description
    if maintenance_type is not None:
        task.maintenance_type = maintenance_type
    if priority is not None:
        task.priority = priority
    if scheduled_date is not None:
        task.scheduled_date = scheduled_date
    if assigned_to_user_id is not None:
        task.assigned_to_user_id = assigned_to_user_id
    if notes is not None:
        task.notes = (task.notes or "") + ("\n" + notes if task.notes else notes)

    db.flush()
    return {
        "id": task.id,
        "machine_id": task.machine_id,
        "title": task.title,
        "description": task.description,
        "maintenance_type": task.maintenance_type,
        "priority": task.priority,
        "status": task.status,
        "scheduled_date": task.scheduled_date.isoformat(),
        "assigned_to_user_id": task.assigned_to_user_id,
        "notes": task.notes,
    }


def delete_maintenance_task(
    db: Session,
    task_id: int,
    factory_id: str,
) -> bool:
    """Delete a maintenance task. Returns True if deleted, False if not found."""
    task = (
        db.query(SteelMaintenanceTask)
        .filter(
            SteelMaintenanceTask.id == task_id,
            SteelMaintenanceTask.factory_id == factory_id,
        )
        .first()
    )
    if not task:
        return False
    db.delete(task)
    db.flush()
    return True


def update_downtime_event(
    db: Session,
    event_id: int,
    factory_id: str,
    *,
    started_at: datetime | None = None,
    ended_at: datetime | None = None,
    duration_minutes: float | None = None,
    reason_category: str | None = None,
    reason_detail: str | None = None,
    shift: str | None = None,
    operator_user_id: int | None = None,
    notes: str | None = None,
) -> dict[str, Any] | None:
    """Update a downtime event's fields."""
    event = (
        db.query(SteelMachineDowntimeEvent)
        .filter(
            SteelMachineDowntimeEvent.id == event_id,
            SteelMachineDowntimeEvent.factory_id == factory_id,
        )
        .first()
    )
    if not event:
        return None

    if started_at is not None:
        event.started_at = started_at
    if ended_at is not None:
        event.ended_at = ended_at
    if duration_minutes is not None:
        event.duration_minutes = duration_minutes
    elif ended_at is not None and started_at is not None:
        event.duration_minutes = (ended_at - started_at).total_seconds() / 60.0
    if reason_category is not None:
        event.reason_category = reason_category
    if reason_detail is not None:
        event.reason_detail = reason_detail
    if shift is not None:
        event.shift = shift
    if operator_user_id is not None:
        event.operator_user_id = operator_user_id
    if notes is not None:
        event.notes = notes

    db.flush()
    return {
        "id": event.id,
        "machine_id": event.machine_id,
        "started_at": event.started_at.isoformat(),
        "ended_at": event.ended_at.isoformat() if event.ended_at else None,
        "duration_minutes": event.duration_minutes,
        "reason_category": event.reason_category,
        "reason_detail": event.reason_detail,
        "shift": event.shift,
        "operator_user_id": event.operator_user_id,
        "notes": event.notes,
    }


def delete_downtime_event(
    db: Session,
    event_id: int,
    factory_id: str,
) -> bool:
    """Delete a downtime event. Returns True if deleted, False if not found."""
    event = (
        db.query(SteelMachineDowntimeEvent)
        .filter(
            SteelMachineDowntimeEvent.id == event_id,
            SteelMachineDowntimeEvent.factory_id == factory_id,
        )
        .first()
    )
    if not event:
        return False
    db.delete(event)
    db.flush()
    return True
