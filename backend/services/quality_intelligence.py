"""Quality Intelligence — Phase 1+2: Entry-level structured quality analytics.

Leverages the new structured quality fields on ``Entry`` (``rejection_qty``,
``defect_reason_id``, ``defect_reason_details``, ``rework_required``,
``scrap_qty_entry``) to provide:

- **Rejection rate analysis** — per shift, operator, department, and daily trend
- **Defect categorization** — grouped by defect_reason.code using the lookup table
- **Scrap vs rework tracking** — scrap_qty_entry vs rework_required counts

Also integrates batch-level rejection/scrap data (``SteelProductionBatch``) for
a unified quality view.

Labels honestly distinguish direct, derived, and unavailable data.
"""

from __future__ import annotations

from collections import defaultdict
from datetime import date, datetime, timedelta, timezone
from typing import Any

from sqlalchemy.orm import Session, joinedload

from backend.models.entry import Entry
from backend.models.defect_reason import DefectReason
from backend.models.steel_production_batch import SteelProductionBatch
from backend.models.user import User
from backend.models.steel_inventory_item import SteelInventoryItem


# ── Constants ─────────────────────────────────────────────────────────────────

DEFAULT_PERIOD_DAYS = 30
MAX_PERIOD_DAYS = 365


# ── Main Entry Point ──────────────────────────────────────────────────────────


def build_quality_intelligence(
    db: Session,
    factory_id: str,
    *,
    days: int = DEFAULT_PERIOD_DAYS,
    baseline_days: int | None = None,
    can_view_financials: bool = False,
) -> dict[str, Any]:
    """Comprehensive quality intelligence for steel factories.

    Args:
        db: SQLAlchemy session.
        factory_id: Target factory.
        days: Number of days for the current analysis period.
        baseline_days: Number of days for the baseline comparison period.
            Defaults to ``days``. Set to 0 to skip baseline comparison.
        can_view_financials: Whether the caller can see scrap cost / INR values.

    Returns:
        A dictionary with all quality intelligence sections.
    """
    today = date.today()
    cutoff = today - timedelta(days=days)
    baseline_days = baseline_days or days
    baseline_cutoff = cutoff - timedelta(days=baseline_days) if baseline_days > 0 else None

    # ── Load entries with structured quality data ─────────────────────────
    entries = (
        db.query(Entry)
        .filter(
            Entry.factory_id == factory_id,
            Entry.date >= cutoff,
            Entry.is_active.is_(True),
        )
        .options(joinedload(Entry.defect_reason))
        .order_by(Entry.date.asc())
        .all()
    )

    # ── Load baseline entries ─────────────────────────────────────────────
    baseline_entries: list[Entry] = []
    if baseline_cutoff is not None:
        baseline_entries = (
            db.query(Entry)
            .filter(
                Entry.factory_id == factory_id,
                Entry.date >= baseline_cutoff,
                Entry.date < cutoff,
                Entry.is_active.is_(True),
            )
            .options(joinedload(Entry.defect_reason))
            .all()
        )

    # ── Load batches for integrated batch quality view ────────────────────
    batches = (
        db.query(SteelProductionBatch)
        .filter(
            SteelProductionBatch.factory_id == factory_id,
            SteelProductionBatch.production_date >= cutoff,
        )
        .order_by(SteelProductionBatch.production_date.asc())
        .all()
    )

    baseline_batches: list[SteelProductionBatch] = []
    if baseline_cutoff is not None:
        baseline_batches = (
            db.query(SteelProductionBatch)
            .filter(
                SteelProductionBatch.factory_id == factory_id,
                SteelProductionBatch.production_date >= baseline_cutoff,
                SteelProductionBatch.production_date < cutoff,
            )
            .all()
        )

    # ── Load defect reasons for label mapping ─────────────────────────────
    defect_reasons = db.query(DefectReason).filter(DefectReason.is_active.is_(True)).all()
    defect_reason_map: dict[int, DefectReason] = {dr.id: dr for dr in defect_reasons}

    # ── Load operator names ───────────────────────────────────────────────
    operator_ids: set[int] = set()
    for e in entries + baseline_entries:
        operator_ids.add(e.user_id)
    operator_map: dict[int, User] = {
        u.id: u
        for u in db.query(User).filter(User.id.in_(operator_ids)).all()
    } if operator_ids else {}

    # ── Load item rates for scrap valuation ──────────────────────────────
    # We need output items from batches for scrap cost estimation
    batch_item_ids: set[int] = set()
    for b in batches + baseline_batches:
        batch_item_ids.add(b.output_item_id)
    items = (
        db.query(SteelInventoryItem).filter(SteelInventoryItem.id.in_(batch_item_ids)).all()
        if batch_item_ids
        else []
    )
    item_map: dict[int, SteelInventoryItem] = {it.id: it for it in items}

    # ── Compute sections ─────────────────────────────────────────────────
    summary = _build_quality_summary(entries, batches, today)
    rejection_trend = _build_rejection_daily_trend(entries, batches, today, days)
    defect_category_analysis = _build_defect_category_analysis(entries, defect_reason_map)
    by_operator = _build_quality_by_operator(entries, operator_map, defect_reason_map)
    by_shift = _build_quality_by_shift(entries, defect_reason_map)
    by_department = _build_quality_by_department(entries, defect_reason_map)
    scrap_vs_rework = _build_scrap_vs_rework(entries, today)
    batch_quality_integration = _build_batch_quality_summary(batches, item_map)
    increase_drivers = _build_quality_increase_drivers(
        entries, baseline_entries,
        batches, baseline_batches,
        defect_reason_map, operator_map, today, days, baseline_days,
    )
    data_confidence = _build_quality_data_confidence(entries, batches)

    # ── Redact financials ────────────────────────────────────────────────
    if not can_view_financials:
        scrap_vs_rework = _redact_quality_costs(scrap_vs_rework)
        batch_quality_integration = _redact_quality_costs(batch_quality_integration)
        increase_drivers = _redact_quality_costs(increase_drivers)

    return {
        "as_of": today.isoformat(),
        "period_days": min(days, MAX_PERIOD_DAYS),
        "baseline_period_days": baseline_days,
        "financial_access": can_view_financials,
        "data_confidence": data_confidence,
        "summary": summary,
        "rejection_trend": rejection_trend,
        "defect_category_analysis": defect_category_analysis,
        "by_operator": by_operator,
        "by_shift": by_shift,
        "by_department": by_department,
        "scrap_vs_rework": scrap_vs_rework,
        "batch_quality_integration": batch_quality_integration,
        "increase_drivers": increase_drivers,
    }


# ── Helper helpers ────────────────────────────────────────────────────────────


def _redact_quality_costs(row: dict[str, Any]) -> dict[str, Any]:
    """Set all INR/cost fields to None."""
    out = dict(row)
    for key in list(out.keys()):
        if key.endswith("_cost_inr") or key.endswith("_value_inr"):
            out[key] = None
    return out


def _has_quality_data(entry: Entry) -> bool:
    """Whether an entry has any structured quality data populated."""
    return (
        (entry.rejection_qty is not None and entry.rejection_qty > 0)
        or (entry.scrap_qty_entry is not None and entry.scrap_qty_entry > 0)
        or entry.rework_required
        or entry.defect_reason_id is not None
    )


def _batch_scrap_cost(batch: SteelProductionBatch, item_map: dict[int, Any]) -> float:
    """Estimate scrap cost at batch level using output item rate."""
    scrap_kg = float(batch.scrap_qty_kg or 0.0)
    output_item = item_map.get(batch.output_item_id)
    rate = float(output_item.current_rate_per_kg or 0.0) if output_item else 0.0
    return scrap_kg * rate


# ── Summary ───────────────────────────────────────────────────────────────────


def _build_quality_summary(
    entries: list[Entry],
    batches: list[SteelProductionBatch],
    today: date,
) -> dict[str, Any]:
    """High-level quality KPIs: today, MTD, and full period."""
    if not entries and not batches:
        return {
            "total_entries_analyzed": 0,
            "entries_with_quality_data": 0,
            "total_rejection_units": 0,
            "total_scrap_units": 0,
            "rework_entry_count": 0,
            "rejection_rate_percent": None,
            "total_batches_analyzed": 0,
            "total_batch_rejection_kg": 0.0,
            "total_batch_scrap_kg": 0.0,
            "entry_data_quality": "no_data",
            "batch_data_quality": "no_data",
        }

    approved = [e for e in entries if e.status == "approved"]
    entries_with_data = [e for e in approved if _has_quality_data(e)]

    total_rejection = sum(int(e.rejection_qty or 0) for e in approved)
    total_scrap = sum(int(e.scrap_qty_entry or 0) for e in approved)
    total_produced = sum(e.units_produced for e in approved)
    rework_count = sum(1 for e in approved if e.rework_required)

    # Batch-level summary
    batch_rejection_kg = sum(float(b.rejection_qty_kg or 0.0) for b in batches)
    batch_scrap_kg = sum(float(b.scrap_qty_kg or 0.0) for b in batches)
    batch_output_kg = sum(float(b.actual_output_kg or 0.0) for b in batches)

    # Rejection rate (entry level: units)
    rejection_rate = (
        round((total_rejection / total_produced) * 100, 2) if total_produced > 0 else None
    )

    # Batch rejection rate (kg)
    batch_rejection_rate = (
        round((batch_rejection_kg / batch_output_kg) * 100, 2) if batch_output_kg > 0 else None
    )
    batch_scrap_rate = (
        round((batch_scrap_kg / batch_output_kg) * 100, 2) if batch_output_kg > 0 else None
    )

    return {
        "total_entries_analyzed": len(approved),
        "entries_with_quality_data": len(entries_with_data),
        "total_rejection_units": total_rejection,
        "total_scrap_units": total_scrap,
        "rework_entry_count": rework_count,
        "rejection_rate_percent": rejection_rate,
        "scrap_rate_percent": round(
            (total_scrap / total_produced) * 100, 2
        ) if total_produced > 0 and total_scrap > 0 else None,
        "rework_rate_percent": round(
            (rework_count / len(approved)) * 100, 1
        ) if approved else None,
        "total_batches_analyzed": len(batches),
        "total_batch_rejection_kg": round(batch_rejection_kg, 2),
        "total_batch_scrap_kg": round(batch_scrap_kg, 2),
        "batch_rejection_rate_percent": batch_rejection_rate,
        "batch_scrap_rate_percent": batch_scrap_rate,
        "entry_data_quality": "structured" if entries_with_data else (
            "boolean_only" if any(e.quality_issues for e in approved) else "no_data"
        ),
        "batch_data_quality": (
            "direct" if batch_rejection_kg > 0 or batch_scrap_kg > 0
            else "unavailable"
        ),
    }


# ── Rejection Daily Trend ────────────────────────────────────────────────────


def _build_rejection_daily_trend(
    entries: list[Entry],
    batches: list[SteelProductionBatch],
    today: date,
    days: int,
) -> list[dict[str, Any]]:
    """Daily rejection and scrap quantities over the analysis period.

    Merges entry-level unit rejection/scrap with batch-level kg rejection/scrap.
    """
    day_map: dict[date, dict[str, Any]] = {}

    approved = [e for e in entries if e.status == "approved"]

    for e in approved:
        d = e.date
        if d not in day_map:
            day_map[d] = {
                "date": d.isoformat(),
                "entry_count": 0,
                "approved_entry_count": 0,
                "total_produced_units": 0,
                "rejection_units": 0,
                "scrap_units": 0,
                "rework_count": 0,
                "defect_entry_count": 0,
                "rejection_rate_percent": None,
                "batch_rejection_kg": 0.0,
                "batch_scrap_kg": 0.0,
                "batch_output_kg": 0.0,
                "batch_count": 0,
                "batch_rejection_rate_percent": None,
            }
        dm = day_map[d]
        dm["entry_count"] += 1
        if e.status == "approved":
            dm["approved_entry_count"] += 1
        dm["total_produced_units"] += e.units_produced
        dm["rejection_units"] += int(e.rejection_qty or 0)
        dm["scrap_units"] += int(e.scrap_qty_entry or 0)
        if e.rework_required:
            dm["rework_count"] += 1
        if _has_quality_data(e):
            dm["defect_entry_count"] += 1

    for b in batches:
        d = b.production_date
        if d not in day_map:
            day_map[d] = {
                "date": d.isoformat(),
                "entry_count": 0,
                "approved_entry_count": 0,
                "total_produced_units": 0,
                "rejection_units": 0,
                "scrap_units": 0,
                "rework_count": 0,
                "defect_entry_count": 0,
                "rejection_rate_percent": None,
                "batch_rejection_kg": 0.0,
                "batch_scrap_kg": 0.0,
                "batch_output_kg": 0.0,
                "batch_count": 0,
                "batch_rejection_rate_percent": None,
            }
        dm = day_map[d]
        dm["batch_rejection_kg"] += float(b.rejection_qty_kg or 0.0)
        dm["batch_scrap_kg"] += float(b.scrap_qty_kg or 0.0)
        dm["batch_output_kg"] += float(b.actual_output_kg or 0.0)
        dm["batch_count"] += 1

    for dm in day_map.values():
        # Rejection rate using the accumulated produced units
        if dm["total_produced_units"] > 0:
            dm["rejection_rate_percent"] = round(
                dm["rejection_units"] / dm["total_produced_units"] * 100, 2
            )
        if dm["batch_output_kg"] > 0:
            dm["batch_rejection_rate_percent"] = round(
                dm["batch_rejection_kg"] / dm["batch_output_kg"] * 100, 2
            )
        dm["rejection_units"] = round(dm["rejection_units"], 0)
        dm["scrap_units"] = round(dm["scrap_units"], 0)
        dm["batch_rejection_kg"] = round(dm["batch_rejection_kg"], 2)
        dm["batch_scrap_kg"] = round(dm["batch_scrap_kg"], 2)
        dm["batch_output_kg"] = round(dm["batch_output_kg"], 2)

    return sorted(day_map.values(), key=lambda x: x["date"], reverse=True)[:min(days, 90)]


# ── Defect Category Analysis ─────────────────────────────────────────────────


def _build_defect_category_analysis(
    entries: list[Entry],
    defect_reason_map: dict[int, DefectReason],
) -> dict[str, Any]:
    """Group entries by defect_reason.code for category-level analysis.

    Entries without a defect_reason_id but with rejection_qty > 0 or
    quality_issues flagged are counted as "uncategorized".
    """
    approved = [e for e in entries if e.status == "approved"]
    category_counts: dict[str, dict[str, Any]] = {}
    uncategorized_count = 0
    total_with_defect = 0

    for e in approved:
        if e.defect_reason_id is not None:
            reason = defect_reason_map.get(e.defect_reason_id)
            code = reason.code if reason else "unknown"
            label = reason.label if reason else "Unknown"

            if code not in category_counts:
                category_counts[code] = {
                    "code": code,
                    "label": label,
                    "entry_count": 0,
                    "total_rejection_units": 0,
                    "total_scrap_units": 0,
                    "rework_count": 0,
                }
            cat = category_counts[code]
            cat["entry_count"] += 1
            cat["total_rejection_units"] += int(e.rejection_qty or 0)
            cat["total_scrap_units"] += int(e.scrap_qty_entry or 0)
            if e.rework_required:
                cat["rework_count"] += 1
            total_with_defect += 1
        elif _has_quality_data(e) or e.quality_issues:
            uncategorized_count += 1
            total_with_defect += 1

    categories = list(category_counts.values())
    categories.sort(key=lambda x: x["entry_count"], reverse=True)

    # Compute percentages
    for cat in categories:
        cat["entry_percent"] = round(
            cat["entry_count"] / max(total_with_defect, 1) * 100, 1
        )
        cat["total_rejection_units"] = round(cat["total_rejection_units"], 0)
        cat["total_scrap_units"] = round(cat["total_scrap_units"], 0)

    return {
        "categories": categories,
        "uncategorized_entry_count": uncategorized_count,
        "total_entries_with_defect": total_with_defect,
        "has_structured_defects": len(categories) > 0,
        "data_quality": "structured" if len(categories) > 0 else (
            "boolean_only" if uncategorized_count > 0 else "no_data"
        ),
        "note": "Defect categories are based on defect_reason_id set on Entry records. "
        "Entries with quality_issues=true but no defect_reason_id appear as 'uncategorized'.",
    }


# ── By Operator ──────────────────────────────────────────────────────────────


def _build_quality_by_operator(
    entries: list[Entry],
    operator_map: dict[int, User],
    defect_reason_map: dict[int, DefectReason],
) -> list[dict[str, Any]]:
    """Quality metrics per operator: rejection, scrap, rework, top defect codes."""
    approved = [e for e in entries if e.status == "approved"]
    op_stats: dict[int, dict[str, Any]] = {}

    for e in approved:
        uid = e.user_id
        if uid not in op_stats:
            user = operator_map.get(uid)
            op_stats[uid] = {
                "user_id": uid,
                "name": user.name if user else f"User {uid}",
                "entry_count": 0,
                "total_rejection_units": 0,
                "total_scrap_units": 0,
                "rework_entry_count": 0,
                "defect_entry_count": 0,
                "rejection_rate_percent": None,
                "scrap_rate_percent": None,
                "total_produced_units": 0,
                "top_defect_codes": [],
            }
        s = op_stats[uid]
        s["entry_count"] += 1
        s["total_produced_units"] += e.units_produced
        s["total_rejection_units"] += int(e.rejection_qty or 0)
        s["total_scrap_units"] += int(e.scrap_qty_entry or 0)
        if e.rework_required:
            s["rework_entry_count"] += 1
        if _has_quality_data(e):
            s["defect_entry_count"] += 1

        # Track defect codes per operator
        if e.defect_reason_id is not None:
            reason = defect_reason_map.get(e.defect_reason_id)
            if reason:
                s.setdefault("_defect_code_counts", defaultdict(int))
                s["_defect_code_counts"][reason.label] += 1

    results = []
    for s in op_stats.values():
        produced = s["total_produced_units"]
        if produced > 0:
            s["rejection_rate_percent"] = round(
                s["total_rejection_units"] / produced * 100, 2
            )
            s["scrap_rate_percent"] = round(
                s["total_scrap_units"] / produced * 100, 2
            )
        # Top defect codes
        code_counts = s.pop("_defect_code_counts", {})
        top_codes = sorted(code_counts.items(), key=lambda x: x[1], reverse=True)[:5]
        s["top_defect_codes"] = [
            {"label": label, "count": count} for label, count in top_codes
        ]
        s["total_rejection_units"] = round(s["total_rejection_units"], 0)
        s["total_scrap_units"] = round(s["total_scrap_units"], 0)
        results.append(s)

    results.sort(key=lambda x: x["total_rejection_units"], reverse=True)
    return results


# ── By Shift ──────────────────────────────────────────────────────────────────


def _build_quality_by_shift(
    entries: list[Entry],
    defect_reason_map: dict[int, DefectReason],
) -> dict[str, Any]:
    """Quality metrics grouped by shift."""
    approved = [e for e in entries if e.status == "approved"]
    shift_stats: dict[str, dict[str, Any]] = {}

    for e in approved:
        shift_key = e.shift.value if hasattr(e.shift, "value") else str(e.shift)
        if shift_key not in shift_stats:
            shift_stats[shift_key] = {
                "shift": shift_key,
                "entry_count": 0,
                "total_rejection_units": 0,
                "total_scrap_units": 0,
                "rework_entry_count": 0,
                "defect_entry_count": 0,
                "total_produced_units": 0,
                "rejection_rate_percent": None,
            }
        s = shift_stats[shift_key]
        s["entry_count"] += 1
        s["total_produced_units"] += e.units_produced
        s["total_rejection_units"] += int(e.rejection_qty or 0)
        s["total_scrap_units"] += int(e.scrap_qty_entry or 0)
        if e.rework_required:
            s["rework_entry_count"] += 1
        if _has_quality_data(e):
            s["defect_entry_count"] += 1

    by_shift = []
    for s in shift_stats.values():
        if s["total_produced_units"] > 0:
            s["rejection_rate_percent"] = round(
                s["total_rejection_units"] / s["total_produced_units"] * 100, 2
            )
        s["total_rejection_units"] = round(s["total_rejection_units"], 0)
        s["total_scrap_units"] = round(s["total_scrap_units"], 0)
        by_shift.append(s)

    by_shift.sort(key=lambda x: x.get("rejection_rate_percent", 0) or 0, reverse=True)

    return {
        "by_shift": by_shift,
        "data_quality": "direct",
        "note": "Shift is directly stored on Entry records.",
    }


# ── By Department ─────────────────────────────────────────────────────────────


def _build_quality_by_department(
    entries: list[Entry],
    defect_reason_map: dict[int, DefectReason],
) -> dict[str, Any]:
    """Quality metrics grouped by department."""
    approved = [e for e in entries if e.status == "approved"]
    dept_stats: dict[str, dict[str, Any]] = {}

    for e in approved:
        dept = (e.department or "Unspecified").strip()[:40]
        if dept not in dept_stats:
            dept_stats[dept] = {
                "department": dept,
                "entry_count": 0,
                "total_rejection_units": 0,
                "total_scrap_units": 0,
                "rework_entry_count": 0,
                "defect_entry_count": 0,
                "total_produced_units": 0,
                "rejection_rate_percent": None,
            }
        s = dept_stats[dept]
        s["entry_count"] += 1
        s["total_produced_units"] += e.units_produced
        s["total_rejection_units"] += int(e.rejection_qty or 0)
        s["total_scrap_units"] += int(e.scrap_qty_entry or 0)
        if e.rework_required:
            s["rework_entry_count"] += 1
        if _has_quality_data(e):
            s["defect_entry_count"] += 1

    by_department = []
    for s in dept_stats.values():
        if s["total_produced_units"] > 0:
            s["rejection_rate_percent"] = round(
                s["total_rejection_units"] / s["total_produced_units"] * 100, 2
            )
        s["total_rejection_units"] = round(s["total_rejection_units"], 0)
        s["total_scrap_units"] = round(s["total_scrap_units"], 0)
        by_department.append(s)

    by_department.sort(key=lambda x: x.get("rejection_rate_percent", 0) or 0, reverse=True)

    return {
        "by_department": by_department,
        "data_quality": "direct",
        "note": "Department is directly stored on Entry records.",
    }


# ── Scrap vs Rework ──────────────────────────────────────────────────────────


def _build_scrap_vs_rework(
    entries: list[Entry],
    today: date,
) -> dict[str, Any]:
    """Analyse scrap vs rework: quantities, trends, and cost implications.

    Scrap is destructive (material loss). Rework is corrective (labour cost).
    """
    approved = [e for e in entries if e.status == "approved"]
    entries_with_scrap = [e for e in approved if e.scrap_qty_entry is not None and e.scrap_qty_entry > 0]
    entries_with_rework = [e for e in approved if e.rework_required]
    entries_with_both = [
        e for e in approved
        if (e.scrap_qty_entry is not None and e.scrap_qty_entry > 0) and e.rework_required
    ]

    total_scrap_units = sum(int(e.scrap_qty_entry or 0) for e in approved)
    total_rework_entries = len(entries_with_rework)

    # Scrap vs rework ratio
    if entries_with_scrap or entries_with_rework:
        scrap_dominance = round(
            total_scrap_units / max(total_rework_entries, 1), 2
        )
    else:
        scrap_dominance = None

    # Rework cost estimate (labour: estimated at 1 hour per rework entry at avg rate)
    avg_hourly_rate = 150  # INR, placeholder — configurable in future
    estimated_rework_labour_cost_inr = total_rework_entries * avg_hourly_rate

    return {
        "total_scrap_units": round(total_scrap_units, 0),
        "total_rework_entry_count": total_rework_entries,
        "entries_with_scrap_count": len(entries_with_scrap),
        "entries_with_rework_count": len(entries_with_rework),
        "entries_with_both_scrap_and_rework": len(entries_with_both),
        "scrap_vs_rework_ratio": scrap_dominance,
        "scrap_dominates": scrap_dominance is not None and scrap_dominance > 2.0,
        "estimated_rework_labour_cost_inr": round(estimated_rework_labour_cost_inr, 2),
        "data_quality": (
            "direct" if total_scrap_units > 0 or total_rework_entries > 0
            else "no_data"
        ),
        "note": (
            "Scrap is measured in units (destructive material loss). "
            "Rework is a boolean flag (corrective labour). "
            f"Labour cost estimated at INR {avg_hourly_rate}/hr per rework entry."
        ),
        "cost_basis": "estimated_at_inr_150_per_hour",
        "valuation_mode": "estimated",
    }


# ── Batch Quality Integration ────────────────────────────────────────────────


def _build_batch_quality_summary(
    batches: list[SteelProductionBatch],
    item_map: dict[int, SteelInventoryItem],
) -> dict[str, Any]:
    """Summarise batch-level quality data alongside entry-level.

    Provides severity distribution, batch rejection/scrap totals, and
    top-loss batches for cross-referencing with entry data.
    """
    if not batches:
        return {
            "total_batches": 0,
            "severity_distribution": {},
            "total_batch_rejection_kg": 0.0,
            "total_batch_scrap_kg": 0.0,
            "total_batch_loss_kg": 0.0,
            "scrap_cost_period_inr": 0.0,
            "top_loss_batches": [],
            "data_quality": "no_data",
        }

    severity_dist: dict[str, int] = {}
    total_rejection_kg = 0.0
    total_scrap_kg = 0.0
    total_loss_kg = 0.0
    total_output_kg = 0.0
    total_scrap_cost = 0.0

    for b in batches:
        sev = str(b.severity or "normal")
        severity_dist[sev] = severity_dist.get(sev, 0) + 1
        total_rejection_kg += float(b.rejection_qty_kg or 0.0)
        total_scrap_kg += float(b.scrap_qty_kg or 0.0)
        total_loss_kg += float(b.loss_kg or 0.0)
        total_output_kg += float(b.actual_output_kg or 0.0)
        total_scrap_cost += _batch_scrap_cost(b, item_map)

    # Top loss batches
    sorted_batches = sorted(
        batches, key=lambda b: float(b.loss_percent or 0.0), reverse=True
    )
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
            "rejection_qty_kg": round(float(b.rejection_qty_kg or 0.0), 2),
            "scrap_qty_kg": round(float(b.scrap_qty_kg or 0.0), 2),
        })

    return {
        "total_batches": len(batches),
        "severity_distribution": severity_dist,
        "total_batch_rejection_kg": round(total_rejection_kg, 2),
        "total_batch_scrap_kg": round(total_scrap_kg, 2),
        "total_batch_loss_kg": round(total_loss_kg, 2),
        "total_batch_output_kg": round(total_output_kg, 2),
        "batch_loss_percent": round(
            (total_loss_kg / total_output_kg * 100), 2
        ) if total_output_kg > 0 else None,
        "scrap_cost_period_inr": round(total_scrap_cost, 2),
        "top_loss_batches": top_loss,
        "data_quality": (
            "direct" if total_rejection_kg > 0 or total_scrap_kg > 0
            else "none_recorded"
        ),
        "note": "Batch-level rejection/scrap tracked via rejection_qty_kg and scrap_qty_kg.",
    }


# ── Increase Drivers (baseline comparison) ──────────────────────────────────


def _build_quality_increase_drivers(
    entries: list[Entry],
    baseline_entries: list[Entry],
    batches: list[SteelProductionBatch],
    baseline_batches: list[SteelProductionBatch],
    defect_reason_map: dict[int, DefectReason],
    operator_map: dict[int, User],
    today: date,
    days: int,
    baseline_days: int,
) -> dict[str, Any]:
    """Compare quality metrics between current and baseline periods.

    Identifies drivers of change in rejection rate, scrap, and defect counts.
    """
    approved = [e for e in entries if e.status == "approved"]
    baseline_approved = [e for e in baseline_entries if e.status == "approved"]

    if not baseline_approved or not approved:
        return {
            "current_period_days": days,
            "baseline_period_days": baseline_days,
            "total_rejection_delta_units": 0,
            "total_rejection_delta_percent": 0.0,
            "top_drivers": [],
        }

    current_rejection = sum(int(e.rejection_qty or 0) for e in approved)
    baseline_rejection = sum(int(e.rejection_qty or 0) for e in baseline_approved)

    current_scrap = sum(int(e.scrap_qty_entry or 0) for e in approved)
    baseline_scrap = sum(int(e.scrap_qty_entry or 0) for e in baseline_approved)

    delta_rejection = current_rejection - baseline_rejection
    delta_rejection_pct = (
        (delta_rejection / baseline_rejection * 100) if baseline_rejection > 0 else 0.0
    )
    delta_scrap = current_scrap - baseline_scrap
    delta_scrap_pct = (
        (delta_scrap / baseline_scrap * 100) if baseline_scrap > 0 else 0.0
    )

    # Driver analysis: by operator
    drivers: list[dict[str, Any]] = []

    # By operator rejection
    op_current: dict[int, int] = defaultdict(int)
    op_baseline: dict[int, int] = defaultdict(int)
    for e in approved:
        op_current[e.user_id] += int(e.rejection_qty or 0)
    for e in baseline_approved:
        op_baseline[e.user_id] += int(e.rejection_qty or 0)

    all_op_ids = set(op_current.keys()) | set(op_baseline.keys())
    for oid in all_op_ids:
        cur = op_current.get(oid, 0)
        base = op_baseline.get(oid, 0)
        if cur != base:
            user = operator_map.get(oid)
            label = user.name if user else f"User {oid}"
            drivers.append({
                "dimension": "operator",
                "entity_key": str(oid),
                "entity_label": label,
                "current_rejection_units": cur,
                "baseline_rejection_units": base,
                "delta_units": cur - base,
                "delta_percent": round(
                    ((cur - base) / base * 100), 1
                ) if base > 0 else None,
                "metric": "rejection_units",
                "explanation": f"Operator {label} rejection changed from {base} to {cur} units.",
                "confidence": "direct",
            })

    # By defect reason
    dr_current: dict[int, int] = defaultdict(int)
    dr_baseline: dict[int, int] = defaultdict(int)
    for e in approved:
        if e.defect_reason_id is not None:
            dr_current[e.defect_reason_id] += 1
    for e in baseline_approved:
        if e.defect_reason_id is not None:
            dr_baseline[e.defect_reason_id] += 1

    all_dr_ids = set(dr_current.keys()) | set(dr_baseline.keys())
    for dr_id in all_dr_ids:
        cur = dr_current.get(dr_id, 0)
        base = dr_baseline.get(dr_id, 0)
        if cur != base:
            reason = defect_reason_map.get(dr_id)
            label = reason.label if reason else f"Defect #{dr_id}"
            drivers.append({
                "dimension": "defect_reason",
                "entity_key": str(dr_id),
                "entity_label": label,
                "current_entry_count": cur,
                "baseline_entry_count": base,
                "delta_count": cur - base,
                "delta_percent": round(
                    ((cur - base) / base * 100), 1
                ) if base > 0 else None,
                "metric": "defect_entry_count",
                "explanation": (
                    f"Defect reason '{label}' entries changed from {base} to {cur}."
                ),
                "confidence": "direct",
            })

    # Batch-level comparison
    current_batch_rejection = sum(float(b.rejection_qty_kg or 0.0) for b in batches)
    baseline_batch_rejection = sum(
        float(b.rejection_qty_kg or 0.0) for b in baseline_batches
    )
    batch_delta_rejection_kg = current_batch_rejection - baseline_batch_rejection

    drivers.sort(key=lambda x: abs(x.get("delta_units", x.get("delta_count", 0))), reverse=True)

    return {
        "current_period_days": days,
        "baseline_period_days": baseline_days,
        "current_rejection_units": current_rejection,
        "baseline_rejection_units": baseline_rejection,
        "total_rejection_delta_units": delta_rejection,
        "total_rejection_delta_percent": round(delta_rejection_pct, 1),
        "current_scrap_units": current_scrap,
        "baseline_scrap_units": baseline_scrap,
        "total_scrap_delta_units": delta_scrap,
        "total_scrap_delta_percent": round(delta_scrap_pct, 1),
        "current_batch_rejection_kg": round(current_batch_rejection, 2),
        "baseline_batch_rejection_kg": round(baseline_batch_rejection, 2),
        "batch_rejection_delta_kg": round(batch_delta_rejection_kg, 2),
        "top_drivers": drivers[:10],
    }


# ── Data Confidence ──────────────────────────────────────────────────────────


def _build_quality_data_confidence(
    entries: list[Entry],
    batches: list[SteelProductionBatch],
) -> dict[str, Any]:
    """Report which quality data dimensions have structured vs boolean-only data."""
    approved = [e for e in entries if e.status == "approved"]

    has_rejection = any(e.rejection_qty is not None and e.rejection_qty > 0 for e in approved)
    has_scrap = any(e.scrap_qty_entry is not None and e.scrap_qty_entry > 0 for e in approved)
    has_rework = any(e.rework_required for e in approved)
    has_defect_reason = any(e.defect_reason_id is not None for e in approved)
    has_boolean_quality = any(e.quality_issues for e in approved)
    has_batch_rejection = any(
        b.rejection_qty_kg is not None and b.rejection_qty_kg > 0 for b in batches
    )
    has_batch_scrap = any(
        b.scrap_qty_kg is not None and b.scrap_qty_kg > 0 for b in batches
    )

    missing: list[str] = []
    if not has_rejection and not has_boolean_quality:
        missing.append("entry.rejection_qty")
    if not has_scrap:
        missing.append("entry.scrap_qty_entry")
    if not has_rework and not has_defect_reason:
        missing.append("entry.rework_required or entry.defect_reason_id")
    if not has_batch_rejection:
        missing.append("batch.rejection_qty_kg")
    if not has_batch_scrap:
        missing.append("batch.scrap_qty_kg")

    return {
        "entry_rejection_tracking": "structured" if has_rejection else (
            "boolean_only" if has_boolean_quality else "unavailable"
        ),
        "entry_scrap_tracking": "structured" if has_scrap else "unavailable",
        "entry_rework_tracking": "available" if has_rework else "unavailable",
        "entry_defect_reason_tracking": "structured" if has_defect_reason else (
            "boolean_only" if has_boolean_quality else "unavailable"
        ),
        "batch_rejection_tracking": "available" if has_batch_rejection else "unavailable",
        "batch_scrap_tracking": "available" if has_batch_scrap else "unavailable",
        "overall_quality_data_quality": (
            "structured" if (has_rejection or has_scrap or has_defect_reason)
            else "boolean_only" if has_boolean_quality
            else "no_data"
        ),
        "missing_fields": missing,
    }
