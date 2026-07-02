"""Phase 2 — Production Intelligence: shift-level KPIs from Entry +
batch-quality analytics from SteelProductionBatch + machine intelligence.

All analytics are read-only and require no schema changes.
Labels honestly distinguish direct/derived/proxy/unavailable data.

This follows the same pattern as steel_inventory_intelligence.py.
"""

from __future__ import annotations

from collections import defaultdict
from datetime import date, datetime, timedelta, timezone
from typing import Any

from sqlalchemy import func
from sqlalchemy.orm import Session

from backend.models.entry import Entry, ShiftType
from backend.models.steel_inventory_item import SteelInventoryItem
from backend.models.steel_production_batch import SteelProductionBatch
from backend.models.user import User
from backend.services.steel_service import (
    coerce_utc_datetime,
    serialize_batch,
)


# ── Constants ─────────────────────────────────────────────────────────────────

DEFAULT_PERIOD_DAYS = 30
MAX_PERIOD_DAYS = 365


# ── Main Entry Point ─────────────────────────────────────────────────────────


def build_production_intelligence(
    db: Session,
    factory_id: str,
    *,
    days: int = DEFAULT_PERIOD_DAYS,
) -> dict[str, Any]:
    """Comprehensive production intelligence for steel factories.

    Phase 1 — No schema changes required. All analytics are derived from
    the existing ``Entry`` (shift records) and ``SteelProductionBatch``
    (batch quality) models.

    Returns:
        as_of: ISO date string for the snapshot
        period_days: number of days covered
        data_coverage: which dimensions are available vs missing
        summary: high-level production KPIs
        throughput_trend: daily produced vs target over the period
        shift_analysis: per-shift KPIs and ranking
        downtime_analysis: downtime by shift/department and top reasons
        manpower_productivity: per-shift and per-worker metrics
        batch_loss_analysis: batch-level quality/loss/severity
        operator_batch_performance: per-operator batch rollup
        process_loss_proxy: loss by input->output conversion pair
        quality_signal_summary: quality issue incidence from entries + batches
        oee_readiness: honest coverage report for OEE requirements
    """
    cutoff = datetime.now(timezone.utc) - timedelta(days=days)
    today = date.today()

    # ── 1. Entry-based shift analytics ──────────────────────────────────
    entries = (
        db.query(Entry)
        .filter(
            Entry.factory_id == factory_id,
            Entry.date >= (today - timedelta(days=days)),
            Entry.is_active.is_(True),
        )
        .order_by(Entry.date.asc())
        .all()
    )

    batch_cutoff_date = today - timedelta(days=days)
    batches = (
        db.query(SteelProductionBatch)
        .filter(
            SteelProductionBatch.factory_id == factory_id,
            SteelProductionBatch.production_date >= batch_cutoff_date,
        )
        .order_by(SteelProductionBatch.production_date.asc())
        .all()
    )

    summary = _build_production_summary(entries, batches, today)
    throughput_trend = _build_throughput_trend(entries, batches, days)
    shift_analysis = _build_shift_analysis(entries)
    downtime_analysis = _build_downtime_analysis(entries)
    manpower_productivity = _build_manpower_productivity(entries)
    batch_loss_analysis = _build_batch_loss_analysis(batches)
    operator_batch_performance = _build_operator_batch_performance(db, batches, factory_id)
    process_loss_proxy = _build_process_loss_proxy(db, batches, factory_id)
    quality_signal_summary = _build_quality_signal_summary(entries, batches)
    rejection_scrap_analysis = _build_rejection_scrap_analysis(batches)
    line_efficiency_analysis = _build_line_efficiency_analysis(db, batches, factory_id)
    machine_utilization_analysis = _build_machine_utilization_analysis(db, batches, factory_id)

    # Machine intelligence — downtime events, maintenance, MTBF/MTTR
    machine_intelligence = _build_machine_intelligence_section(db, factory_id, days=days)

    # Detect whether Phase 2 schema data is present
    has_rejection_data = any(
        b.rejection_qty_kg is not None and b.rejection_qty_kg > 0
        for b in batches
    )
    has_scrap_data = any(
        b.scrap_qty_kg is not None and b.scrap_qty_kg > 0
        for b in batches
    )
    has_line_data = any(b.line_id is not None for b in batches)
    has_machine_data = any(b.machine_id is not None for b in batches)

    # ── OEE Readiness Assessment ──────────────────────────────────────
    # Determine performance availability: machine_id on batches + expected/actual output
    has_performance_data = any(
        b.machine_id is not None and b.expected_output_kg > 0
        for b in batches
    )
    # Determine true OEE support: need runtime + batch linkage + rejection/scrap
    has_availability_data = machine_intelligence.get("has_runtime_data", False)
    has_machine_batch_linkage = any(b.machine_id is not None for b in batches)
    has_quality_data = has_rejection_data or has_scrap_data

    true_oee_supported = has_availability_data and has_machine_batch_linkage and has_quality_data

    oee_readiness = {
        "availability_inputs_present": "available" if has_availability_data else "partial",
        "performance_inputs_present": "available" if has_performance_data else "partial",
        "quality_inputs_present": "available" if has_quality_data else "missing",
        "true_oee_supported": true_oee_supported,
        "missing_fields": [],
    }
    if not has_availability_data:
        oee_readiness["missing_fields"].append("planned_runtime_minutes")
    if not has_machine_batch_linkage:
        oee_readiness["missing_fields"].append("machine_id on batches")
    if not has_quality_data:
        oee_readiness["missing_fields"].append("rejection_qty_kg / scrap_qty_kg")

    return {
        "as_of": today.isoformat(),
        "period_days": min(days, MAX_PERIOD_DAYS),
        "data_coverage": {
            "entry_based_shift_data": len(entries) > 0,
            "batch_based_quality_data": len(batches) > 0,
            "machine_tracking": has_machine_data,
            "line_tracking": has_line_data,
            "true_rejection_counts": has_rejection_data,
            "true_oee": False,
        },
        "summary": summary,
        "throughput_trend": throughput_trend,
        "shift_analysis": shift_analysis,
        "downtime_analysis": downtime_analysis,
        "manpower_productivity": manpower_productivity,
        "batch_loss_analysis": batch_loss_analysis,
        "operator_batch_performance": operator_batch_performance,
        "process_loss_proxy": process_loss_proxy,
        "quality_signal_summary": quality_signal_summary,
        "rejection_scrap_analysis": rejection_scrap_analysis,
        "line_efficiency_analysis": line_efficiency_analysis,
        "machine_utilization_analysis": machine_utilization_analysis,
        "machine_intelligence": machine_intelligence,
        "oee_readiness": oee_readiness,
    }


# ── Production Summary ───────────────────────────────────────────────────────


def _build_production_summary(
    entries: list[Entry],
    batches: list[SteelProductionBatch],
    today: date,
) -> dict[str, Any]:
    """High-level production KPIs from entries and batches."""
    approved = [e for e in entries if e.status == "approved"]
    pending = [e for e in entries if e.status == "submitted"]
    rejected = [e for e in entries if e.status == "rejected"]

    total_target = sum(e.units_target for e in approved)
    total_produced = sum(e.units_produced for e in approved)
    attainment_pct = (total_produced / total_target * 100) if total_target > 0 else 0.0

    total_downtime = sum(e.downtime_minutes for e in approved)
    total_quality_issues = sum(1 for e in approved if e.quality_issues)

    # Today's entry data
    today_entries = [e for e in entries if e.date == today]
    today_approved = [e for e in today_entries if e.status == "approved"]
    today_produced = sum(e.units_produced for e in today_approved)

    # Batch summary
    total_batches = len(batches)
    total_batch_output = sum(float(b.actual_output_kg or 0.0) for b in batches)
    total_batch_loss = sum(float(b.loss_kg or 0.0) for b in batches)
    avg_batch_loss_pct = (total_batch_loss / total_batch_output * 100) if total_batch_output > 0 else 0.0
    high_critical_batches = sum(1 for b in batches if b.severity in ("high", "critical"))

    return {
        "total_entries": len(entries),
        "approved_entries": len(approved),
        "pending_entries": len(pending),
        "rejected_entries": len(rejected),
        "total_target_units": total_target,
        "total_produced_units": total_produced,
        "overall_attainment_percent": round(attainment_pct, 1),
        "total_downtime_minutes": total_downtime,
        "total_quality_issue_entries": total_quality_issues,
        "today_produced_units": today_produced,
        "today_entry_count": len(today_approved),
        "total_batch_count": total_batches,
        "total_batch_output_kg": round(total_batch_output, 2),
        "total_batch_loss_kg": round(total_batch_loss, 2),
        "avg_batch_loss_percent": round(avg_batch_loss_pct, 2),
        "high_critical_batch_count": high_critical_batches,
        "data_quality": "direct" if approved else "insufficient_data",
    }


# ── Throughput Trend ─────────────────────────────────────────────────────────


def _build_throughput_trend(
    entries: list[Entry],
    batches: list[SteelProductionBatch],
    days: int,
) -> list[dict[str, Any]]:
    """Daily throughput: produced units vs target, with batch output/loss."""
    # Group entries by date
    day_map: dict[date, dict[str, Any]] = {}
    for entry in entries:
        d = entry.date
        if d not in day_map:
            day_map[d] = {
                "date": d.isoformat(),
                "total_target": 0,
                "total_produced": 0,
                "entry_count": 0,
                "approved_entry_count": 0,
                "total_downtime_minutes": 0,
                "quality_issue_count": 0,
                "batch_output_kg": 0.0,
                "batch_loss_kg": 0.0,
                "batch_loss_percent": 0.0,
                "batch_count": 0,
            }
        dm = day_map[d]
        dm["total_target"] += entry.units_target
        dm["total_produced"] += entry.units_produced
        dm["entry_count"] += 1
        if entry.status == "approved":
            dm["approved_entry_count"] += 1
        dm["total_downtime_minutes"] += entry.downtime_minutes
        if entry.quality_issues:
            dm["quality_issue_count"] += 1

    for batch in batches:
        d = batch.production_date
        if d not in day_map:
            day_map[d] = {
                "date": d.isoformat(),
                "total_target": 0,
                "total_produced": 0,
                "entry_count": 0,
                "approved_entry_count": 0,
                "total_downtime_minutes": 0,
                "quality_issue_count": 0,
                "batch_output_kg": 0.0,
                "batch_loss_kg": 0.0,
                "batch_loss_percent": 0.0,
                "batch_count": 0,
            }
        dm = day_map[d]
        output_kg = float(batch.actual_output_kg or 0.0)
        loss_kg = float(batch.loss_kg or 0.0)
        dm["batch_output_kg"] += output_kg
        dm["batch_loss_kg"] += loss_kg
        dm["batch_count"] += 1

    # Compute batch loss percent per day
    for dm in day_map.values():
        if dm["batch_output_kg"] > 0:
            dm["batch_loss_percent"] = round(dm["batch_loss_kg"] / dm["batch_output_kg"] * 100, 2)
        dm["batch_output_kg"] = round(dm["batch_output_kg"], 3)
        dm["batch_loss_kg"] = round(dm["batch_loss_kg"], 3)
        # Attainment
        if dm["total_target"] > 0:
            dm["attainment_percent"] = round(dm["total_produced"] / dm["total_target"] * 100, 1)
        else:
            dm["attainment_percent"] = None

    # Sort by date descending, limit to days
    sorted_days = sorted(day_map.values(), key=lambda x: x["date"], reverse=True)[:min(days, 90)]
    return sorted_days


# ── Shift Analysis ───────────────────────────────────────────────────────────


def _build_shift_analysis(entries: list[Entry]) -> dict[str, Any]:
    """Per-shift KPIs: target, produced, attainment, downtime, quality."""
    approved = [e for e in entries if e.status == "approved"]
    if not approved:
        return {
            "by_shift": [],
            "worst_attainment_shift": None,
            "highest_downtime_shift": None,
        }

    shift_stats: dict[str, dict[str, Any]] = {}
    for entry in approved:
        shift_key = entry.shift.value if hasattr(entry.shift, "value") else str(entry.shift)
        if shift_key not in shift_stats:
            shift_stats[shift_key] = {
                "shift": shift_key,
                "entry_count": 0,
                "total_target": 0,
                "total_produced": 0,
                "total_downtime_minutes": 0,
                "quality_issue_count": 0,
                "total_manpower_present": 0,
            }
        s = shift_stats[shift_key]
        s["entry_count"] += 1
        s["total_target"] += entry.units_target
        s["total_produced"] += entry.units_produced
        s["total_downtime_minutes"] += entry.downtime_minutes
        if entry.quality_issues:
            s["quality_issue_count"] += 1
        s["total_manpower_present"] += entry.manpower_present

    by_shift = []
    for s in shift_stats.values():
        attainment = (s["total_produced"] / s["total_target"] * 100) if s["total_target"] > 0 else 0.0
        quality_issue_rate = (s["quality_issue_count"] / s["entry_count"] * 100) if s["entry_count"] > 0 else 0.0
        by_shift.append({
            "shift": s["shift"],
            "entry_count": s["entry_count"],
            "total_target_units": s["total_target"],
            "total_produced_units": s["total_produced"],
            "attainment_percent": round(attainment, 1),
            "total_downtime_minutes": s["total_downtime_minutes"],
            "quality_issue_count": s["quality_issue_count"],
            "quality_issue_rate_percent": round(quality_issue_rate, 1),
        })

    by_shift.sort(key=lambda x: x["attainment_percent"], reverse=True)
    worst_attainment = min(by_shift, key=lambda x: x["attainment_percent"]) if by_shift else None
    highest_downtime = max(by_shift, key=lambda x: x["total_downtime_minutes"]) if by_shift else None

    return {
        "by_shift": by_shift,
        "worst_attainment_shift": worst_attainment,
        "highest_downtime_shift": highest_downtime,
    }


# ── Downtime Analysis ────────────────────────────────────────────────────────


def _build_downtime_analysis(entries: list[Entry]) -> dict[str, Any]:
    """Downtime by shift, department, and top bucketed reasons."""
    approved = [e for e in entries if e.status == "approved"]
    if not approved:
        return {
            "total_downtime_minutes": 0,
            "avg_downtime_per_entry_minutes": 0.0,
            "by_shift": [],
            "by_department": [],
            "top_reasons": [],
        }

    total_downtime = sum(e.downtime_minutes for e in approved)
    avg_downtime = total_downtime / max(len(approved), 1)

    # By shift
    shift_downtime: dict[str, int] = {}
    for e in approved:
        shift_key = e.shift.value if hasattr(e.shift, "value") else str(e.shift)
        shift_downtime[shift_key] = shift_downtime.get(shift_key, 0) + e.downtime_minutes

    by_shift = [
        {"shift": k, "total_downtime_minutes": v}
        for k, v in sorted(shift_downtime.items(), key=lambda x: x[1], reverse=True)
    ]

    # By department (normalized, sanitised)
    dept_downtime: dict[str, int] = {}
    for e in approved:
        dept = (e.department or "Unspecified").strip()[:40]
        dept_downtime[dept] = dept_downtime.get(dept, 0) + e.downtime_minutes

    by_department = [
        {"department": k, "total_downtime_minutes": v}
        for k, v in sorted(dept_downtime.items(), key=lambda x: x[1], reverse=True)
    ]

    # Top reasons (bucketed / normalised)
    reason_counts: dict[str, int] = {}
    for e in approved:
        reason = (e.downtime_reason or "Not specified").strip().lower()[:60]
        if not reason:
            reason = "Not specified"
        reason_counts[reason] = reason_counts.get(reason, 0) + e.downtime_minutes

    top_reasons = [
        {"reason": k, "total_downtime_minutes": v}
        for k, v in sorted(reason_counts.items(), key=lambda x: x[1], reverse=True)[:8]
    ]

    return {
        "total_downtime_minutes": total_downtime,
        "avg_downtime_per_entry_minutes": round(avg_downtime, 1),
        "by_shift": by_shift,
        "by_department": by_department,
        "top_reasons": top_reasons,
    }


# ── Manpower Productivity ─────────────────────────────────────────────────────


def _build_manpower_productivity(entries: list[Entry]) -> dict[str, Any]:
    """Productivity metrics per worker and per shift."""
    approved = [e for e in entries if e.status == "approved"]
    if not approved:
        return {
            "total_manpower_present": 0,
            "total_manpower_absent": 0,
            "avg_units_per_worker": 0.0,
            "avg_absenteeism_percent": 0.0,
            "by_shift": [],
        }

    total_present = sum(e.manpower_present for e in approved)
    total_absent = sum(e.manpower_absent for e in approved)
    total_produced = sum(e.units_produced for e in approved)
    total_workers = total_present + total_absent

    avg_units_per_worker = (total_produced / total_present) if total_present > 0 else 0.0
    absenteeism_pct = (total_absent / total_workers * 100) if total_workers > 0 else 0.0

    # By shift
    shift_stats: dict[str, dict[str, int]] = {}
    for e in approved:
        shift_key = e.shift.value if hasattr(e.shift, "value") else str(e.shift)
        if shift_key not in shift_stats:
            shift_stats[shift_key] = {"present": 0, "absent": 0, "produced": 0}
        shift_stats[shift_key]["present"] += e.manpower_present
        shift_stats[shift_key]["absent"] += e.manpower_absent
        shift_stats[shift_key]["produced"] += e.units_produced

    by_shift = [
        {
            "shift": k,
            "total_manpower_present": v["present"],
            "total_manpower_absent": v["absent"],
            "units_per_worker": round(v["produced"] / v["present"], 1) if v["present"] > 0 else 0.0,
        }
        for k, v in sorted(shift_stats.items())
    ]

    return {
        "total_manpower_present": total_present,
        "total_manpower_absent": total_absent,
        "avg_units_per_worker": round(avg_units_per_worker, 1),
        "avg_absenteeism_percent": round(absenteeism_pct, 1),
        "by_shift": by_shift,
    }


# ── Batch Loss Analysis ───────────────────────────────────────────────────────


def _build_batch_loss_analysis(batches: list[SteelProductionBatch]) -> dict[str, Any]:
    """Batch-level quality and loss metrics."""
    if not batches:
        return {
            "total_batches": 0,
            "severity_distribution": {},
            "avg_loss_percent": 0.0,
            "avg_variance_percent": 0.0,
            "top_loss_batches": [],
        }

    severity_dist: dict[str, int] = {}
    total_loss_pct = 0.0
    total_variance_pct = 0.0
    total_output_kg = 0.0

    for b in batches:
        sev = str(b.severity or "normal")
        severity_dist[sev] = severity_dist.get(sev, 0) + 1
        total_loss_pct += float(b.loss_percent or 0.0)
        total_variance_pct += float(b.variance_percent or 0.0)
        total_output_kg += float(b.actual_output_kg or 0.0)

    n = len(batches)
    avg_loss_pct = total_loss_pct / n
    avg_variance_pct = total_variance_pct / n

    # Top loss batches
    sorted_batches = sorted(batches, key=lambda b: float(b.loss_percent or 0.0), reverse=True)
    top_loss = []
    for b in sorted_batches[:5]:
        top_loss.append({
            "id": b.id,
            "batch_code": b.batch_code,
            "production_date": b.production_date.isoformat(),
            "loss_percent": round(float(b.loss_percent or 0.0), 2),
            "loss_kg": round(float(b.loss_kg or 0.0), 2),
            "actual_output_kg": round(float(b.actual_output_kg or 0.0), 2),
            "severity": b.severity,
        })

    return {
        "total_batches": n,
        "severity_distribution": severity_dist,
        "avg_loss_percent": round(avg_loss_pct, 2),
        "avg_variance_percent": round(avg_variance_pct, 2),
        "total_batch_output_kg": round(total_output_kg, 2),
        "top_loss_batches": top_loss,
    }


# ── Operator Batch Performance ────────────────────────────────────────────────


def _build_operator_batch_performance(
    db: Session,
    batches: list[SteelProductionBatch],
    factory_id: str,
) -> list[dict[str, Any]]:
    """Per-operator batch performance rollup."""
    if not batches:
        return []

    operator_ids = {b.operator_user_id for b in batches if b.operator_user_id}
    operator_map: dict[int, User] = {
        u.id: u
        for u in db.query(User).filter(User.id.in_(operator_ids)).all()
    } if operator_ids else {}

    op_stats: dict[int, dict[str, Any]] = {}
    for b in batches:
        op_id = b.operator_user_id
        if not op_id:
            continue
        if op_id not in op_stats:
            op_stats[op_id] = {
                "user_id": op_id,
                "name": operator_map[op_id].name if op_id in operator_map else f"User {op_id}",
                "batch_count": 0,
                "high_critical_count": 0,
                "total_loss_percent": 0.0,
                "total_actual_output_kg": 0.0,
                "avg_loss_percent": 0.0,
                "high_critical_percent": 0.0,
            }
        s = op_stats[op_id]
        s["batch_count"] += 1
        s["total_loss_percent"] += float(b.loss_percent or 0.0)
        s["total_actual_output_kg"] += float(b.actual_output_kg or 0.0)
        if b.severity in ("high", "critical"):
            s["high_critical_count"] += 1

    results = []
    for s in op_stats.values():
        s["avg_loss_percent"] = round(s["total_loss_percent"] / max(s["batch_count"], 1), 2)
        s["high_critical_percent"] = round(
            s["high_critical_count"] / max(s["batch_count"], 1) * 100, 1
        )
        s["total_actual_output_kg"] = round(s["total_actual_output_kg"], 2)
        results.append(s)

    results.sort(key=lambda x: x["avg_loss_percent"], reverse=True)
    return results


# ── Process Loss Proxy ────────────────────────────────────────────────────────


def _build_process_loss_proxy(
    db: Session,
    batches: list[SteelProductionBatch],
    factory_id: str,
) -> dict[str, Any]:
    """Proxy for process-level loss using input→output item conversion pairs."""
    if not batches:
        return {
            "by_conversion_pair": [],
            "note": "Uses material conversion pairs as a proxy — not true process-stage tracking.",
        }

    item_ids = set()
    for b in batches:
        item_ids.add(b.input_item_id)
        item_ids.add(b.output_item_id)

    items = (
        db.query(SteelInventoryItem)
        .filter(SteelInventoryItem.id.in_(item_ids))
        .all()
    ) if item_ids else []
    item_map = {it.id: it for it in items}

    pair_stats: dict[tuple[int, int], dict[str, Any]] = {}
    for b in batches:
        pair_key = (b.input_item_id, b.output_item_id)
        if pair_key not in pair_stats:
            inp = item_map.get(b.input_item_id)
            out = item_map.get(b.output_item_id)
            pair_stats[pair_key] = {
                "input_item_id": b.input_item_id,
                "input_name": inp.name if inp else f"Item #{b.input_item_id}",
                "input_category": inp.category if inp else "",
                "output_item_id": b.output_item_id,
                "output_name": out.name if out else f"Item #{b.output_item_id}",
                "output_category": out.category if out else "",
                "batch_count": 0,
                "total_input_kg": 0.0,
                "total_output_kg": 0.0,
                "total_loss_kg": 0.0,
                "total_loss_percent_sum": 0.0,
                "high_critical_count": 0,
            }
        ps = pair_stats[pair_key]
        ps["batch_count"] += 1
        ps["total_input_kg"] += float(b.input_quantity_kg or 0.0)
        ps["total_output_kg"] += float(b.actual_output_kg or 0.0)
        ps["total_loss_kg"] += float(b.loss_kg or 0.0)
        ps["total_loss_percent_sum"] += float(b.loss_percent or 0.0)
        if b.severity in ("high", "critical"):
            ps["high_critical_count"] += 1

    by_conversion_pair = []
    for ps in pair_stats.values():
        avg_loss_pct = ps["total_loss_percent_sum"] / max(ps["batch_count"], 1)
        by_conversion_pair.append({
            "input_name": ps["input_name"],
            "input_category": ps["input_category"],
            "output_name": ps["output_name"],
            "output_category": ps["output_category"],
            "batch_count": ps["batch_count"],
            "total_input_kg": round(ps["total_input_kg"], 2),
            "total_output_kg": round(ps["total_output_kg"], 2),
            "total_loss_kg": round(ps["total_loss_kg"], 2),
            "avg_loss_percent": round(avg_loss_pct, 2),
            "high_critical_count": ps["high_critical_count"],
        })

    by_conversion_pair.sort(key=lambda x: x["avg_loss_percent"], reverse=True)

    return {
        "by_conversion_pair": by_conversion_pair,
        "note": "Uses material conversion pairs as a proxy — not true process-stage tracking.",
    }


# ── Quality Signal Summary ────────────────────────────────────────────────────


def _build_quality_signal_summary(
    entries: list[Entry],
    batches: list[SteelProductionBatch],
) -> dict[str, Any]:
    """Quality signals from entries (quality_issues bool) and batches (severity/loss)."""
    entry_based: dict[str, Any] = {
        "total_entries": len(entries),
        "quality_issue_entries": 0,
        "quality_issue_rate_percent": 0.0,
    }
    approved_entries = [e for e in entries if e.status == "approved"]
    quality_issue_count = sum(1 for e in approved_entries if e.quality_issues)
    entry_based["quality_issue_entries"] = quality_issue_count
    entry_based["quality_issue_rate_percent"] = round(
        quality_issue_count / max(len(approved_entries), 1) * 100, 1
    )

    batch_based: dict[str, Any] = {
        "total_batches": len(batches),
        "normal_count": 0,
        "watch_count": 0,
        "high_count": 0,
        "critical_count": 0,
        "high_critical_rate_percent": 0.0,
    }
    for b in batches:
        sev = str(b.severity or "normal")
        if sev == "normal":
            batch_based["normal_count"] += 1
        elif sev == "watch":
            batch_based["watch_count"] += 1
        elif sev == "high":
            batch_based["high_count"] += 1
        elif sev == "critical":
            batch_based["critical_count"] += 1

    high_crit = batch_based["high_count"] + batch_based["critical_count"]
    batch_based["high_critical_rate_percent"] = round(
        high_crit / max(len(batches), 1) * 100, 1
    )

    return {
        "entry_based": entry_based,
        "batch_based": batch_based,
        "note": "Entry quality is a boolean signal (not rejection count). Batch severity is a proxy for quality events.",
    }


# ── Rejection & Scrap Analysis (Phase 2) ────────────────────────────────────


def _build_rejection_scrap_analysis(batches: list[SteelProductionBatch]) -> dict[str, Any]:
    """Analyse rejection and scrap quantities from Phase 2 batch data."""
    rejection_batches = [b for b in batches if b.rejection_qty_kg is not None and b.rejection_qty_kg > 0]
    scrap_batches = [b for b in batches if b.scrap_qty_kg is not None and b.scrap_qty_kg > 0]

    if not rejection_batches and not scrap_batches:
        return {
            "total_rejection_kg": 0.0,
            "total_scrap_kg": 0.0,
            "rejection_rate_percent": None,
            "scrap_rate_percent": None,
            "rejection_batch_count": 0,
            "scrap_batch_count": 0,
            "data_quality": "unavailable" if not batches else "none_recorded",
            "note": "Rejection and scrap quantities are captured at batch level. Populate rejection_qty_kg and scrap_qty_kg on batches to enable this analysis.",
        }

    total_rejection_kg = sum(float(b.rejection_qty_kg or 0.0) for b in batches)
    total_scrap_kg = sum(float(b.scrap_qty_kg or 0.0) for b in batches)
    total_output_kg = sum(float(b.actual_output_kg or 0.0) for b in batches)

    rejection_rate = (total_rejection_kg / total_output_kg * 100) if total_output_kg > 0 else 0.0
    scrap_rate = (total_scrap_kg / total_output_kg * 100) if total_output_kg > 0 else 0.0

    return {
        "total_rejection_kg": round(total_rejection_kg, 2),
        "total_scrap_kg": round(total_scrap_kg, 2),
        "rejection_rate_percent": round(rejection_rate, 2),
        "scrap_rate_percent": round(scrap_rate, 2),
        "rejection_batch_count": len(rejection_batches),
        "scrap_batch_count": len(scrap_batches),
        "data_quality": "direct",
        "note": "Rejection and scrap tracked at batch level via rejection_qty_kg and scrap_qty_kg.",
    }


# ── Line Efficiency Analysis (Phase 2) ──────────────────────────────────────


def _build_line_efficiency_analysis(
    db: Session,
    batches: list[SteelProductionBatch],
    factory_id: str,
) -> dict[str, Any]:
    """Analyse production efficiency by production line."""
    from backend.models.steel_production_line import SteelProductionLine

    line_ids = {b.line_id for b in batches if b.line_id is not None}
    if not line_ids:
        return {
            "by_line": [],
            "line_count": 0,
            "total_batches_with_line": 0,
            "data_quality": "unavailable",
            "note": "Assign line_id on batches to enable line-level efficiency analysis.",
        }

    lines = db.query(SteelProductionLine).filter(SteelProductionLine.id.in_(line_ids)).all()
    line_map = {ln.id: ln for ln in lines}

    line_stats: dict[int, dict[str, Any]] = {}
    for b in batches:
        lid = b.line_id
        if lid is None:
            continue
        if lid not in line_stats:
            ln = line_map.get(lid)
            line_stats[lid] = {
                "line_id": lid,
                "line_name": ln.name if ln else f"Line #{lid}",
                "line_code": ln.code if ln else None,
                "batch_count": 0,
                "total_output_kg": 0.0,
                "total_loss_kg": 0.0,
                "avg_loss_percent": 0.0,
                "high_critical_count": 0,
                "total_rejection_kg": 0.0,
                "total_scrap_kg": 0.0,
            }
        s = line_stats[lid]
        s["batch_count"] += 1
        s["total_output_kg"] += float(b.actual_output_kg or 0.0)
        s["total_loss_kg"] += float(b.loss_kg or 0.0)
        s["high_critical_count"] += 1 if b.severity in ("high", "critical") else 0
        s["total_rejection_kg"] += float(b.rejection_qty_kg or 0.0)
        s["total_scrap_kg"] += float(b.scrap_qty_kg or 0.0)

    by_line = []
    for s in line_stats.values():
        s["avg_loss_percent"] = round(
            s["total_loss_kg"] / max(s["total_output_kg"], 1) * 100, 2
        )
        s["total_output_kg"] = round(s["total_output_kg"], 2)
        s["total_loss_kg"] = round(s["total_loss_kg"], 2)
        s["total_rejection_kg"] = round(s["total_rejection_kg"], 2)
        s["total_scrap_kg"] = round(s["total_scrap_kg"], 2)
        by_line.append(s)

    by_line.sort(key=lambda x: x["avg_loss_percent"], reverse=True)

    return {
        "by_line": by_line,
        "line_count": len(line_stats),
        "total_batches_with_line": sum(s["batch_count"] for s in line_stats.values()),
        "data_quality": "direct",
        "note": "Line-level efficiency based on batch assignment.",
    }


# ── Machine Utilization Analysis (Phase 2) ──────────────────────────────────


def _build_machine_utilization_analysis(
    db: Session,
    batches: list[SteelProductionBatch],
    factory_id: str,
) -> dict[str, Any]:
    """Analyse machine utilization, rejection rate by machine, and throughput."""
    from backend.models.steel_machine import SteelMachine

    machine_ids = {b.machine_id for b in batches if b.machine_id is not None}
    if not machine_ids:
        return {
            "by_machine": [],
            "machine_count": 0,
            "total_batches_with_machine": 0,
            "highest_rejection_machine": None,
            "highest_utilization_machine": None,
            "data_quality": "unavailable",
            "note": "Assign machine_id on batches to enable machine-level performance analysis.",
        }

    machines = db.query(SteelMachine).filter(SteelMachine.id.in_(machine_ids)).all()
    machine_map = {m.id: m for m in machines}

    machine_stats: dict[int, dict[str, Any]] = {}
    for b in batches:
        mid = b.machine_id
        if mid is None:
            continue
        if mid not in machine_stats:
            mach = machine_map.get(mid)
            machine_stats[mid] = {
                "machine_id": mid,
                "machine_code": mach.machine_code if mach else f"M#{mid}",
                "machine_name": mach.name if mach else f"Machine #{mid}",
                "machine_type": mach.machine_type if mach else None,
                "batch_count": 0,
                "total_output_kg": 0.0,
                "total_loss_kg": 0.0,
                "avg_loss_percent": 0.0,
                "high_critical_count": 0,
                "total_rejection_kg": 0.0,
                "total_scrap_kg": 0.0,
                "rejection_rate_percent": 0.0,
            }
        s = machine_stats[mid]
        s["batch_count"] += 1
        s["total_output_kg"] += float(b.actual_output_kg or 0.0)
        s["total_loss_kg"] += float(b.loss_kg or 0.0)
        s["high_critical_count"] += 1 if b.severity in ("high", "critical") else 0
        s["total_rejection_kg"] += float(b.rejection_qty_kg or 0.0)
        s["total_scrap_kg"] += float(b.scrap_qty_kg or 0.0)

    by_machine = []
    for s in machine_stats.values():
        s["avg_loss_percent"] = round(
            s["total_loss_kg"] / max(s["total_output_kg"], 1) * 100, 2
        )
        s["rejection_rate_percent"] = round(
            s["total_rejection_kg"] / max(s["total_output_kg"], 1) * 100, 2
        )
        s["total_output_kg"] = round(s["total_output_kg"], 2)
        s["total_loss_kg"] = round(s["total_loss_kg"], 2)
        s["total_rejection_kg"] = round(s["total_rejection_kg"], 2)
        s["total_scrap_kg"] = round(s["total_scrap_kg"], 2)
        by_machine.append(s)

    by_machine.sort(key=lambda x: x["batch_count"], reverse=True)

    highest_rejection = max(by_machine, key=lambda x: x["rejection_rate_percent"]) if by_machine else None
    highest_utilization = max(by_machine, key=lambda x: x["batch_count"]) if by_machine else None

    return {
        "by_machine": by_machine,
        "machine_count": len(machine_stats),
        "total_batches_with_machine": sum(s["batch_count"] for s in machine_stats.values()),
        "highest_rejection_machine": highest_rejection,
        "highest_utilization_machine": highest_utilization,
        "data_quality": "direct",
        "note": "Machine metrics based on batch assignment. True OEE requires runtime tracking (Phase 3).",
    }


# ── Machine Intelligence Section ────────────────────────────────────────────


def _build_machine_intelligence_section(
    db: Session,
    factory_id: str,
    *,
    days: int = DEFAULT_PERIOD_DAYS,
) -> dict[str, Any]:
    """Pull machine intelligence data (downtime events, maintenance, MTBF/MTTR)
    and merge it with the production intelligence response for a unified view.

    This bridges the gap between production-level KPIs and machine-level
    health tracking so that operators and managers can see both in one place.
    """
    from backend.services.steel_machine_intelligence import build_machine_intelligence
    return build_machine_intelligence(db, factory_id, days=days)
