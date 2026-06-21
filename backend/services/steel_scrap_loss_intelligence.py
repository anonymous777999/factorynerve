"""Scrap & Loss Intelligence — Phase A+B: direct analytics from batch-level scrap/rejection data.

All analytics are derived from existing ``SteelProductionBatch`` fields
(``scrap_qty_kg``, ``rejection_qty_kg``) without requiring schema changes.

Labels honestly distinguish direct, derived, and estimated data.
"""

from __future__ import annotations

from collections import defaultdict
from datetime import date, datetime, timedelta, timezone
from typing import Any

from sqlalchemy.orm import Session

from backend.models.entry import Entry
from backend.models.steel_inventory_item import SteelInventoryItem
from backend.models.steel_production_batch import SteelProductionBatch
from backend.models.user import User


DEFAULT_PERIOD_DAYS = 30
MAX_PERIOD_DAYS = 365


def build_scrap_loss_intelligence(
    db: Session,
    factory_id: str,
    *,
    days: int = DEFAULT_PERIOD_DAYS,
    baseline_days: int | None = None,
    line_id: int | None = None,
    machine_id: int | None = None,
    operator_user_id: int | None = None,
    can_view_financials: bool = False,
) -> dict[str, Any]:
    """Comprehensive scrap & loss intelligence for steel factories.

    Args:
        db: SQLAlchemy session.
        factory_id: Target factory.
        days: Number of days for the current analysis period.
        baseline_days: Number of days for the baseline comparison period.
            Defaults to ``days``. Set to 0 to skip baseline comparison.
        line_id: Optional filter to a specific production line.
        machine_id: Optional filter to a specific machine.
        operator_user_id: Optional filter to a specific operator.
        can_view_financials: Whether the caller can see scrap cost values.

    Returns:
        A dictionary with all scrap/loss intelligence sections.
    """
    today = date.today()
    cutoff = today - timedelta(days=days)
    baseline_days = baseline_days or days
    baseline_cutoff = cutoff - timedelta(days=baseline_days) if baseline_days > 0 else None

    # ── Load batches ────────────────────────────────────────────────────
    query = db.query(SteelProductionBatch).filter(
        SteelProductionBatch.factory_id == factory_id,
        SteelProductionBatch.production_date >= cutoff,
    )
    if line_id is not None:
        query = query.filter(SteelProductionBatch.line_id == line_id)
    if machine_id is not None:
        query = query.filter(SteelProductionBatch.machine_id == machine_id)
    if operator_user_id is not None:
        query = query.filter(SteelProductionBatch.operator_user_id == operator_user_id)
    batches = query.order_by(SteelProductionBatch.production_date.asc()).all()

    # ── Load baseline batches ───────────────────────────────────────────
    baseline_batches: list[SteelProductionBatch] = []
    if baseline_cutoff is not None:
        baseline_query = db.query(SteelProductionBatch).filter(
            SteelProductionBatch.factory_id == factory_id,
            SteelProductionBatch.production_date >= baseline_cutoff,
            SteelProductionBatch.production_date < cutoff,
        )
        if line_id is not None:
            baseline_query = baseline_query.filter(SteelProductionBatch.line_id == line_id)
        if machine_id is not None:
            baseline_query = baseline_query.filter(SteelProductionBatch.machine_id == machine_id)
        if operator_user_id is not None:
            baseline_query = baseline_query.filter(SteelProductionBatch.operator_user_id == operator_user_id)
        baseline_batches = baseline_query.all()

    # ── Load Entry records for shift / team attribution ───────────────────
    entry_records = (
        db.query(Entry)
        .filter(
            Entry.factory_id == factory_id,
            Entry.date >= cutoff,
            Entry.is_active.is_(True),
        )
        .all()
    )
    entry_lookup: dict[tuple[int, date], list[Entry]] = {}
    for e in entry_records:
        key = (e.user_id, e.date)
        if key not in entry_lookup:
            entry_lookup[key] = []
        entry_lookup[key].append(e)

    # ── Load reference data ──────────────────────────────────────────────
    item_ids = set()
    for b in batches + baseline_batches:
        item_ids.add(b.input_item_id)
        item_ids.add(b.output_item_id)

    items = (
        db.query(SteelInventoryItem).filter(SteelInventoryItem.id.in_(item_ids)).all()
        if item_ids
        else []
    )
    item_map = {it.id: it for it in items}

    operator_ids = {b.operator_user_id for b in batches + baseline_batches if b.operator_user_id}
    operator_map: dict[int, User] = {
        u.id: u
        for u in db.query(User).filter(User.id.in_(operator_ids)).all()
    } if operator_ids else {}

    # ── Load lines and machines ──────────────────────────────────────────
    line_ids = {b.line_id for b in batches + baseline_batches if b.line_id is not None}
    machine_ids = {b.machine_id for b in batches + baseline_batches if b.machine_id is not None}

    line_map: dict[int, Any] = {}
    if line_ids:
        from backend.models.steel_production_line import SteelProductionLine
        lines = db.query(SteelProductionLine).filter(SteelProductionLine.id.in_(line_ids)).all()
        line_map = {ln.id: ln for ln in lines}

    machine_map: dict[int, Any] = {}
    if machine_ids:
        from backend.models.steel_machine import SteelMachine
        machines = db.query(SteelMachine).filter(SteelMachine.id.in_(machine_ids)).all()
        machine_map = {m.id: m for m in machines}

    # ── Compute sections (Phase A+B) ─────────────────────────────────────
    summary = _build_scrap_summary(batches, item_map, today)
    daily_trend = _build_scrap_daily_trend(batches, item_map)
    by_machine = _build_scrap_by_machine(batches, machine_map, item_map)
    by_line = _build_scrap_by_line(batches, line_map, item_map)
    by_operator = _build_scrap_by_operator(batches, operator_map, item_map)
    by_process = _build_scrap_by_process(batches, item_map)
    financial_impact = _build_scrap_financial_impact(batches, item_map, today)

    # ── Compute sections (Phase C: inferred attribution) ─────────────────
    by_shift = _build_scrap_by_shift(batches, entry_lookup, item_map)
    by_team = _build_scrap_by_team(batches, entry_lookup, item_map)

    data_confidence = _build_scrap_confidence(batches, by_shift, by_team)

    # ── Redact financials ────────────────────────────────────────────────
    if not can_view_financials:
        summary = _redact_scrap_costs(summary)
        daily_trend = [_redact_scrap_costs(d) for d in daily_trend]
        by_machine = [_redact_scrap_costs(d) for d in by_machine]
        by_line = [_redact_scrap_costs(d) for d in by_line]
        by_operator = [_redact_scrap_costs(d) for d in by_operator]
        by_process = [_redact_scrap_costs(d) for d in by_process]
        by_shift["by_shift"] = [_redact_scrap_costs(s) for s in by_shift["by_shift"]]
        by_team["by_team"] = [_redact_scrap_costs(t) for t in by_team["by_team"]]
        financial_impact = _redact_scrap_costs(financial_impact)

    # ── Increase drivers (baseline comparison) ───────────────────────────
    increase_drivers = _build_scrap_increase_drivers(
        batches, baseline_batches, item_map, machine_map, line_map, operator_map, today, days, baseline_days,
    )
    if not can_view_financials:
        increase_drivers = _redact_scrap_costs(increase_drivers)

    return {
        "as_of": today.isoformat(),
        "period_days": min(days, MAX_PERIOD_DAYS),
        "baseline_period_days": baseline_days,
        "financial_access": can_view_financials,
        "data_confidence": data_confidence,
        "summary": summary,
        "daily_trend": daily_trend,
        "by_machine": by_machine,
        "by_line": by_line,
        "by_operator": by_operator,
        "by_process": by_process,
        "by_shift": by_shift,
        "by_team": by_team,
        "financial_impact": financial_impact,
        "increase_drivers": increase_drivers,
    }


# ── Helpers ───────────────────────────────────────────────────────────────────

def _scrap_qty(batch: SteelProductionBatch) -> float:
    return float(batch.scrap_qty_kg or 0.0)


def _rejection_qty(batch: SteelProductionBatch) -> float:
    return float(batch.rejection_qty_kg or 0.0)


def _output_qty(batch: SteelProductionBatch) -> float:
    return float(batch.actual_output_kg or 0.0)


def _scrap_cost(batch: SteelProductionBatch, item_map: dict[int, Any]) -> float:
    rate = _output_rate(batch, item_map)
    return _scrap_qty(batch) * rate


def _output_rate(batch: SteelProductionBatch, item_map: dict[int, Any]) -> float:
    item = item_map.get(batch.output_item_id)
    return float(item.current_rate_per_kg or 0.0) if item else 0.0


def _scrap_rate_pct(scrap_kg: float, output_kg: float) -> float | None:
    if output_kg > 0:
        return round(scrap_kg / output_kg * 100, 2)
    return None


def _redact_scrap_costs(row: dict[str, Any]) -> dict[str, Any]:
    """Set all INR/cost fields to None."""
    out = dict(row)
    for key in list(out.keys()):
        if key.endswith("_cost_inr") or key.endswith("_value_inr"):
            out[key] = None
    return out


# ── Summary ───────────────────────────────────────────────────────────────────

def _build_scrap_summary(
    batches: list[SteelProductionBatch],
    item_map: dict[int, Any],
    today: date,
) -> dict[str, Any]:
    """High-level scrap KPIs for today, MTD, and the full period."""
    if not batches:
        return {
            "total_scrap_today_kg": 0,
            "total_scrap_mtd_kg": 0,
            "total_scrap_period_kg": 0,
            "total_rejection_period_kg": 0,
            "total_scrap_batch_count": 0,
            "total_output_period_kg": 0,
            "scrap_rate_percent": None,
            "scrap_cost_today_inr": None,
            "scrap_cost_mtd_inr": None,
            "scrap_cost_period_inr": None,
            "data_quality": "insufficient_data",
        }

    today_batches = [b for b in batches if b.production_date == today]
    first_of_month = today.replace(day=1)
    mtd_batches = [b for b in batches if b.production_date >= first_of_month]

    def _aggregate(bs: list[SteelProductionBatch]) -> dict[str, float]:
        scrap = sum(_scrap_qty(b) for b in bs)
        rejection = sum(_rejection_qty(b) for b in bs)
        output = sum(_output_qty(b) for b in bs)
        cost = sum(_scrap_cost(b, item_map) for b in bs)
        return {"scrap_kg": scrap, "rejection_kg": rejection, "output_kg": output, "cost_inr": cost}

    period = _aggregate(batches)
    today_agg = _aggregate(today_batches)
    mtd_agg = _aggregate(mtd_batches)

    # Identify highest scrap contributors
    highest_scrap_machine = _highest_scrap_entity(batches, lambda b: b.machine_id)
    highest_scrap_line = _highest_scrap_entity(batches, lambda b: b.line_id)
    highest_scrap_operator = _highest_scrap_entity(batches, lambda b: b.operator_user_id)

    return {
        "total_scrap_today_kg": round(today_agg["scrap_kg"], 2),
        "total_scrap_mtd_kg": round(mtd_agg["scrap_kg"], 2),
        "total_scrap_period_kg": round(period["scrap_kg"], 2),
        "total_rejection_period_kg": round(period["rejection_kg"], 2),
        "total_scrap_batch_count": len([b for b in batches if _scrap_qty(b) > 0]),
        "total_output_period_kg": round(period["output_kg"], 2),
        "scrap_rate_percent": _scrap_rate_pct(period["scrap_kg"], period["output_kg"]),
        "scrap_cost_today_inr": round(today_agg["cost_inr"], 2),
        "scrap_cost_mtd_inr": round(mtd_agg["cost_inr"], 2),
        "scrap_cost_period_inr": round(period["cost_inr"], 2),
        "highest_scrap_machine_kg": round(highest_scrap_machine[0], 2) if highest_scrap_machine else None,
        "highest_scrap_line_kg": round(highest_scrap_line[0], 2) if highest_scrap_line else None,
        "highest_scrap_operator_kg": round(highest_scrap_operator[0], 2) if highest_scrap_operator else None,
        "data_quality": "direct" if period["scrap_kg"] > 0 else "none_recorded",
    }


def _highest_scrap_entity(
    batches: list[SteelProductionBatch],
    entity_fn,
) -> tuple[float, int | None] | None:
    """Return (max_scrap_kg, entity_id) for the entity that has the most scrap."""
    scrap_by_entity: dict[int, float] = {}
    for b in batches:
        eid = entity_fn(b)
        if eid is not None:
            scrap_by_entity[eid] = scrap_by_entity.get(eid, 0.0) + _scrap_qty(b)
    if not scrap_by_entity:
        return None
    max_eid = max(scrap_by_entity, key=scrap_by_entity.get)  # type: ignore[arg-type]
    return (scrap_by_entity[max_eid], max_eid)


# ── Daily Trend ──────────────────────────────────────────────────────────────

def _build_scrap_daily_trend(
    batches: list[SteelProductionBatch],
    item_map: dict[int, Any],
) -> list[dict[str, Any]]:
    """Daily scrap, rejection, loss, and scrap cost over the analysis period."""
    day_map: dict[date, dict[str, Any]] = {}
    for b in batches:
        d = b.production_date
        if d not in day_map:
            day_map[d] = {
                "date": d.isoformat(),
                "scrap_kg": 0.0,
                "scrap_cost_inr": 0.0,
                "rejection_kg": 0.0,
                "loss_kg": 0.0,
                "output_kg": 0.0,
                "scrap_rate_percent": None,
                "batch_count": 0,
            }
        day = day_map[d]
        day["scrap_kg"] += _scrap_qty(b)
        day["scrap_cost_inr"] += _scrap_cost(b, item_map)
        day["rejection_kg"] += _rejection_qty(b)
        day["loss_kg"] += float(b.loss_kg or 0.0)
        day["output_kg"] += _output_qty(b)
        day["batch_count"] += 1

    for day in day_map.values():
        day["scrap_rate_percent"] = _scrap_rate_pct(day["scrap_kg"], day["output_kg"])
        day["scrap_kg"] = round(day["scrap_kg"], 2)
        day["scrap_cost_inr"] = round(day["scrap_cost_inr"], 2)
        day["rejection_kg"] = round(day["rejection_kg"], 2)
        day["loss_kg"] = round(day["loss_kg"], 2)
        day["output_kg"] = round(day["output_kg"], 2)

    return sorted(day_map.values(), key=lambda x: x["date"], reverse=True)[:90]


# ── By Machine ────────────────────────────────────────────────────────────────

def _build_scrap_by_machine(
    batches: list[SteelProductionBatch],
    machine_map: dict[int, Any],
    item_map: dict[int, Any],
) -> list[dict[str, Any]]:
    """Scrap aggregated by machine."""
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
                "line_id": mach.line_id if mach else None,
                "batch_count": 0,
                "scrap_kg": 0.0,
                "scrap_cost_inr": 0.0,
                "rejection_kg": 0.0,
                "output_kg": 0.0,
                "scrap_rate_percent": None,
            }
        s = machine_stats[mid]
        s["batch_count"] += 1
        s["scrap_kg"] += _scrap_qty(b)
        s["scrap_cost_inr"] += _scrap_cost(b, item_map)
        s["rejection_kg"] += _rejection_qty(b)
        s["output_kg"] += _output_qty(b)

    result = []
    for s in machine_stats.values():
        s["scrap_rate_percent"] = _scrap_rate_pct(s["scrap_kg"], s["output_kg"])
        s["scrap_kg"] = round(s["scrap_kg"], 2)
        s["scrap_cost_inr"] = round(s["scrap_cost_inr"], 2)
        s["rejection_kg"] = round(s["rejection_kg"], 2)
        s["output_kg"] = round(s["output_kg"], 2)
        result.append(s)

    result.sort(key=lambda x: x["scrap_kg"], reverse=True)
    return result


# ── By Line ──────────────────────────────────────────────────────────────────

def _build_scrap_by_line(
    batches: list[SteelProductionBatch],
    line_map: dict[int, Any],
    item_map: dict[int, Any],
) -> list[dict[str, Any]]:
    """Scrap aggregated by production line."""
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
                "scrap_kg": 0.0,
                "scrap_cost_inr": 0.0,
                "rejection_kg": 0.0,
                "output_kg": 0.0,
                "scrap_rate_percent": None,
            }
        s = line_stats[lid]
        s["batch_count"] += 1
        s["scrap_kg"] += _scrap_qty(b)
        s["scrap_cost_inr"] += _scrap_cost(b, item_map)
        s["rejection_kg"] += _rejection_qty(b)
        s["output_kg"] += _output_qty(b)

    result = []
    for s in line_stats.values():
        s["scrap_rate_percent"] = _scrap_rate_pct(s["scrap_kg"], s["output_kg"])
        s["scrap_kg"] = round(s["scrap_kg"], 2)
        s["scrap_cost_inr"] = round(s["scrap_cost_inr"], 2)
        s["rejection_kg"] = round(s["rejection_kg"], 2)
        s["output_kg"] = round(s["output_kg"], 2)
        result.append(s)

    result.sort(key=lambda x: x["scrap_kg"], reverse=True)
    return result


# ── By Operator ───────────────────────────────────────────────────────────────

def _build_scrap_by_operator(
    batches: list[SteelProductionBatch],
    operator_map: dict[int, User],
    item_map: dict[int, Any],
) -> list[dict[str, Any]]:
    """Scrap aggregated by operator."""
    op_stats: dict[int, dict[str, Any]] = {}
    for b in batches:
        op_id = b.operator_user_id
        if op_id is None:
            continue
        if op_id not in op_stats:
            user = operator_map.get(op_id)
            op_stats[op_id] = {
                "user_id": op_id,
                "name": user.name if user else f"User {op_id}",
                "batch_count": 0,
                "scrap_kg": 0.0,
                "scrap_cost_inr": 0.0,
                "rejection_kg": 0.0,
                "output_kg": 0.0,
                "scrap_rate_percent": None,
            }
        s = op_stats[op_id]
        s["batch_count"] += 1
        s["scrap_kg"] += _scrap_qty(b)
        s["scrap_cost_inr"] += _scrap_cost(b, item_map)
        s["rejection_kg"] += _rejection_qty(b)
        s["output_kg"] += _output_qty(b)

    result = []
    for s in op_stats.values():
        s["scrap_rate_percent"] = _scrap_rate_pct(s["scrap_kg"], s["output_kg"])
        s["scrap_kg"] = round(s["scrap_kg"], 2)
        s["scrap_cost_inr"] = round(s["scrap_cost_inr"], 2)
        s["rejection_kg"] = round(s["rejection_kg"], 2)
        s["output_kg"] = round(s["output_kg"], 2)
        result.append(s)

    result.sort(key=lambda x: x["scrap_kg"], reverse=True)
    return result


# ── By Process (conversion pairs) ────────────────────────────────────────────

def _build_scrap_by_process(
    batches: list[SteelProductionBatch],
    item_map: dict[int, Any],
) -> list[dict[str, Any]]:
    """Scrap by input→output conversion pair (process proxy)."""
    pair_stats: dict[tuple[int, int], dict[str, Any]] = {}
    for b in batches:
        key = (b.input_item_id, b.output_item_id)
        if key not in pair_stats:
            inp = item_map.get(b.input_item_id)
            out = item_map.get(b.output_item_id)
            pair_stats[key] = {
                "input_name": inp.name if inp else f"Item #{b.input_item_id}",
                "input_category": inp.category if inp else "",
                "output_name": out.name if out else f"Item #{b.output_item_id}",
                "output_category": out.category if out else "",
                "batch_count": 0,
                "scrap_kg": 0.0,
                "scrap_cost_inr": 0.0,
                "rejection_kg": 0.0,
                "loss_kg": 0.0,
                "output_kg": 0.0,
                "scrap_rate_percent": None,
            }
        s = pair_stats[key]
        s["batch_count"] += 1
        s["scrap_kg"] += _scrap_qty(b)
        s["scrap_cost_inr"] += _scrap_cost(b, item_map)
        s["rejection_kg"] += _rejection_qty(b)
        s["loss_kg"] += float(b.loss_kg or 0.0)
        s["output_kg"] += _output_qty(b)

    result = []
    for s in pair_stats.values():
        s["scrap_rate_percent"] = _scrap_rate_pct(s["scrap_kg"], s["output_kg"])
        s["scrap_kg"] = round(s["scrap_kg"], 2)
        s["scrap_cost_inr"] = round(s["scrap_cost_inr"], 2)
        s["rejection_kg"] = round(s["rejection_kg"], 2)
        s["loss_kg"] = round(s["loss_kg"], 2)
        s["output_kg"] = round(s["output_kg"], 2)
        result.append(s)

    result.sort(key=lambda x: x["scrap_kg"], reverse=True)
    return result


# ── Financial Impact ─────────────────────────────────────────────────────────

def _build_scrap_financial_impact(
    batches: list[SteelProductionBatch],
    item_map: dict[int, Any],
    today: date,
) -> dict[str, Any]:
    """Aggregated financial impact of scrap with top cost entities."""
    first_of_month = today.replace(day=1)

    total_cost = sum(_scrap_cost(b, item_map) for b in batches if _scrap_qty(b) > 0)
    today_cost = sum(_scrap_cost(b, item_map) for b in batches if b.production_date == today and _scrap_qty(b) > 0)
    mtd_cost = sum(_scrap_cost(b, item_map) for b in batches if b.production_date >= first_of_month and _scrap_qty(b) > 0)

    # Top cost machines
    machine_cost: dict[int, float] = {}
    for b in batches:
        mid = b.machine_id
        if mid is not None and _scrap_qty(b) > 0:
            machine_cost[mid] = machine_cost.get(mid, 0.0) + _scrap_cost(b, item_map)

    # Top cost lines
    line_cost: dict[int, float] = {}
    for b in batches:
        lid = b.line_id
        if lid is not None and _scrap_qty(b) > 0:
            line_cost[lid] = line_cost.get(lid, 0.0) + _scrap_cost(b, item_map)

    # Top cost operators
    op_cost: dict[int, float] = {}
    for b in batches:
        oid = b.operator_user_id
        if oid is not None and _scrap_qty(b) > 0:
            op_cost[oid] = op_cost.get(oid, 0.0) + _scrap_cost(b, item_map)

    # Top cost processes
    process_cost: dict[tuple[int, int], float] = {}
    for b in batches:
        key = (b.input_item_id, b.output_item_id)
        if _scrap_qty(b) > 0:
            process_cost[key] = process_cost.get(key, 0.0) + _scrap_cost(b, item_map)

    # Build entity labels (use ids from cost dicts as fallback)
    machine_labels: dict[int, str] = {mid: f"Machine #{mid}" for mid in machine_cost}
    line_labels: dict[int, str] = {lid: f"Line #{lid}" for lid in line_cost}
    op_labels: dict[int, str] = {oid: f"User #{oid}" for oid in op_cost}
    process_labels: dict[tuple[int, int], str] = {
        k: f"{(item_map.get(k[0]).name if item_map.get(k[0]) else '?')} "
           f"\u2192 {(item_map.get(k[1]).name if item_map.get(k[1]) else '?')}"
        for k in process_cost
    }

    def _top_n(cost_map: dict, labels: dict, n: int = 5) -> list[dict[str, Any]]:
        sorted_items = sorted(cost_map.items(), key=lambda x: x[1], reverse=True)[:n]
        return [{"entity": labels.get(k, str(k)), "scrap_cost_inr": round(v, 2)} for k, v in sorted_items]

    return {
        "cost_basis": "current_output_item_rate",
        "valuation_mode": "estimated",
        "total_scrap_cost_inr": round(total_cost, 2),
        "today_scrap_cost_inr": round(today_cost, 2),
        "mtd_scrap_cost_inr": round(mtd_cost, 2),
        "top_cost_machines": _top_n(machine_cost, machine_labels),
        "top_cost_lines": _top_n(line_cost, line_labels),
        "top_cost_operators": _top_n(op_cost, op_labels),
        "top_cost_processes": _top_n(process_cost, process_labels),
    }


# ── Increase Drivers (baseline comparison) ──────────────────────────────────

def _build_scrap_increase_drivers(
    batches: list[SteelProductionBatch],
    baseline_batches: list[SteelProductionBatch],
    item_map: dict[int, Any],
    machine_map: dict[int, Any],
    line_map: dict[int, Any],
    operator_map: dict[int, User],
    today: date,
    days: int,
    baseline_days: int,
) -> dict[str, Any]:
    """Compare scrap between current period and baseline period."""
    if not baseline_batches or not batches:
        return {
            "current_period_days": days,
            "baseline_period_days": baseline_days,
            "total_scrap_delta_kg": 0.0,
            "total_scrap_delta_percent": 0.0,
            "top_drivers": [],
        }

    current_scrap = sum(_scrap_qty(b) for b in batches)
    baseline_scrap = sum(_scrap_qty(b) for b in baseline_batches)
    delta_kg = current_scrap - baseline_scrap
    delta_pct = ((current_scrap - baseline_scrap) / baseline_scrap * 100) if baseline_scrap > 0 else 0.0

    # Driver analysis — compare by machine, line, operator, process
    drivers: list[dict[str, Any]] = []

    # By machine
    machine_current: dict[int, float] = defaultdict(float)
    machine_baseline: dict[int, float] = defaultdict(float)
    for b in batches:
        if b.machine_id is not None:
            machine_current[b.machine_id] += _scrap_qty(b)
    for b in baseline_batches:
        if b.machine_id is not None:
            machine_baseline[b.machine_id] += _scrap_qty(b)

    all_machine_ids = set(machine_current.keys()) | set(machine_baseline.keys())
    for mid in all_machine_ids:
        cur = machine_current.get(mid, 0.0)
        base = machine_baseline.get(mid, 0.0)
        if cur != base:
            mach = machine_map.get(mid)
            label = mach.name if mach else f"Machine #{mid}"
            drivers.append({
                "dimension": "machine",
                "entity_key": str(mid),
                "entity_label": label,
                "current_scrap_kg": round(cur, 2),
                "baseline_scrap_kg": round(base, 2),
                "delta_kg": round(cur - base, 2),
                "delta_percent": round(((cur - base) / base * 100), 1) if base > 0 else None,
                "explanation": f"Machine {label} scrap changed from {round(base, 1)}kg to {round(cur, 1)}kg.",
                "confidence": "direct",
            })

    # By line
    line_current: dict[int, float] = defaultdict(float)
    line_baseline: dict[int, float] = defaultdict(float)
    for b in batches:
        if b.line_id is not None:
            line_current[b.line_id] += _scrap_qty(b)
    for b in baseline_batches:
        if b.line_id is not None:
            line_baseline[b.line_id] += _scrap_qty(b)

    all_line_ids = set(line_current.keys()) | set(line_baseline.keys())
    for lid in all_line_ids:
        cur = line_current.get(lid, 0.0)
        base = line_baseline.get(lid, 0.0)
        if cur != base:
            ln = line_map.get(lid)
            label = ln.name if ln else f"Line #{lid}"
            drivers.append({
                "dimension": "line",
                "entity_key": str(lid),
                "entity_label": label,
                "current_scrap_kg": round(cur, 2),
                "baseline_scrap_kg": round(base, 2),
                "delta_kg": round(cur - base, 2),
                "delta_percent": round(((cur - base) / base * 100), 1) if base > 0 else None,
                "explanation": f"Line {label} scrap changed from {round(base, 1)}kg to {round(cur, 1)}kg.",
                "confidence": "direct",
            })

    # By operator
    op_current: dict[int, float] = defaultdict(float)
    op_baseline: dict[int, float] = defaultdict(float)
    for b in batches:
        if b.operator_user_id is not None:
            op_current[b.operator_user_id] += _scrap_qty(b)
    for b in baseline_batches:
        if b.operator_user_id is not None:
            op_baseline[b.operator_user_id] += _scrap_qty(b)

    all_op_ids = set(op_current.keys()) | set(op_baseline.keys())
    for oid in all_op_ids:
        cur = op_current.get(oid, 0.0)
        base = op_baseline.get(oid, 0.0)
        if cur != base:
            user = operator_map.get(oid)
            label = user.name if user else f"User #{oid}"
            drivers.append({
                "dimension": "operator",
                "entity_key": str(oid),
                "entity_label": label,
                "current_scrap_kg": round(cur, 2),
                "baseline_scrap_kg": round(base, 2),
                "delta_kg": round(cur - base, 2),
                "delta_percent": round(((cur - base) / base * 100), 1) if base > 0 else None,
                "explanation": f"Operator {label} scrap changed from {round(base, 1)}kg to {round(cur, 1)}kg.",
                "confidence": "direct",
            })

    # By process (conversion pair)
    proc_current: dict[tuple[int, int], float] = defaultdict(float)
    proc_baseline: dict[tuple[int, int], float] = defaultdict(float)
    for b in batches:
        key = (b.input_item_id, b.output_item_id)
        proc_current[key] += _scrap_qty(b)
    for b in baseline_batches:
        key = (b.input_item_id, b.output_item_id)
        proc_baseline[key] += _scrap_qty(b)

    all_proc_keys = set(proc_current.keys()) | set(proc_baseline.keys())
    for pkey in all_proc_keys:
        cur = proc_current.get(pkey, 0.0)
        base = proc_baseline.get(pkey, 0.0)
        if cur != base:
            inp = item_map.get(pkey[0])
            out = item_map.get(pkey[1])
            label = f"{(inp.name if inp else '?')} → {(out.name if out else '?')}"
            drivers.append({
                "dimension": "process",
                "entity_key": f"{pkey[0]}→{pkey[1]}",
                "entity_label": label,
                "current_scrap_kg": round(cur, 2),
                "baseline_scrap_kg": round(base, 2),
                "delta_kg": round(cur - base, 2),
                "delta_percent": round(((cur - base) / base * 100), 1) if base > 0 else None,
                "explanation": f"Process {label} scrap changed from {round(base, 1)}kg to {round(cur, 1)}kg.",
                "confidence": "direct",
            })

    drivers.sort(key=lambda x: abs(x["delta_kg"]), reverse=True)

    return {
        "current_period_days": days,
        "baseline_period_days": baseline_days,
        "total_scrap_delta_kg": round(delta_kg, 2),
        "total_scrap_delta_percent": round(delta_pct, 1),
        "top_drivers": drivers[:10],
    }


# ── By Shift (Phase C: inferred from Entry) ──────────────────────────────

def _build_scrap_by_shift(
    batches: list[SteelProductionBatch],
    entry_lookup: dict[tuple[int, date], list[Entry]],
    item_map: dict[int, Any],
) -> dict[str, Any]:
    """Scrap aggregated by shift, **inferred** from the operator's Entry records.

    Shift is NOT stored on ``SteelProductionBatch``.  It is derived by matching
    the batch ``operator_user_id`` + ``production_date`` to the operator's Entry
    records for that day in the same factory.  Ambiguous cases (operator has
    entries in multiple shifts on the same day) are counted separately.
    """
    shift_stats: dict[str, dict[str, Any]] = {}
    matched_count = 0
    ambiguous_count = 0

    for b in batches:
        op_id = b.operator_user_id
        if op_id is None:
            continue

        matching = entry_lookup.get((op_id, b.production_date), [])
        if not matching:
            continue

        matched_count += 1

        shift_counts: dict[str, int] = {}
        for e in matching:
            shift_key = e.shift.value if hasattr(e.shift, "value") else str(e.shift)
            shift_counts[shift_key] = shift_counts.get(shift_key, 0) + 1

        if len(shift_counts) > 1:
            ambiguous_count += 1

        # Dominant shift for this batch
        dominant = max(shift_counts, key=shift_counts.get)  # type: ignore[arg-type]

        if dominant not in shift_stats:
            shift_stats[dominant] = {
                "shift": dominant,
                "batch_count": 0,
                "scrap_kg": 0.0,
                "scrap_cost_inr": 0.0,
                "rejection_kg": 0.0,
                "output_kg": 0.0,
                "scrap_rate_percent": None,
            }
        s = shift_stats[dominant]
        s["batch_count"] += 1
        s["scrap_kg"] += _scrap_qty(b)
        s["scrap_cost_inr"] += _scrap_cost(b, item_map)
        s["rejection_kg"] += _rejection_qty(b)
        s["output_kg"] += _output_qty(b)

    result = []
    for s in shift_stats.values():
        s["scrap_rate_percent"] = _scrap_rate_pct(s["scrap_kg"], s["output_kg"])
        s["scrap_kg"] = round(s["scrap_kg"], 2)
        s["scrap_cost_inr"] = round(s["scrap_cost_inr"], 2)
        s["rejection_kg"] = round(s["rejection_kg"], 2)
        s["output_kg"] = round(s["output_kg"], 2)
        result.append(s)

    result.sort(key=lambda x: x["scrap_kg"], reverse=True)

    total_with_op = len([b for b in batches if b.operator_user_id is not None])
    coverage = round(matched_count / max(total_with_op, 1) * 100, 1)

    return {
        "by_shift": result,
        "matched_batch_count": matched_count,
        "total_batches_with_operator": total_with_op,
        "coverage_percent": coverage,
        "ambiguous_count": ambiguous_count,
        "attribution_method": "inferred",
        "note": (
            "Shift is inferred by matching batch operator + production_date "
            "to the operator's Entry records. Not all batches have "
            "operator_user_id set."
        ),
    }


# ── By Department / Team (Phase C: proxied from Entry) ─────────────────────

def _build_scrap_by_team(
    batches: list[SteelProductionBatch],
    entry_lookup: dict[tuple[int, date], list[Entry]],
    item_map: dict[int, Any],
) -> dict[str, Any]:
    """Scrap aggregated by department/team, **proxied** from the operator's Entries.

    Team/department is NOT stored on ``SteelProductionBatch``.  It is proxied
    by matching ``operator_user_id`` + ``production_date`` to the department
    recorded in the operator's Entry records for that day.  This is a best-effort
    proxy — an operator may be assigned to multiple departments over time.
    """
    dept_stats: dict[str, dict[str, Any]] = {}
    matched_count = 0

    for b in batches:
        op_id = b.operator_user_id
        if op_id is None:
            continue

        matching = entry_lookup.get((op_id, b.production_date), [])
        if not matching:
            continue

        # Collect non-null departments from matching entries
        departments = [e.department for e in matching if e.department]
        if not departments:
            continue

        matched_count += 1

        # Most common department for this batch
        dept_counts: dict[str, int] = {}
        for d in departments:
            dept_counts[d] = dept_counts.get(d, 0) + 1
        dominant = max(dept_counts, key=dept_counts.get)  # type: ignore[arg-type]

        if dominant not in dept_stats:
            dept_stats[dominant] = {
                "department": dominant,
                "batch_count": 0,
                "scrap_kg": 0.0,
                "scrap_cost_inr": 0.0,
                "rejection_kg": 0.0,
                "output_kg": 0.0,
                "scrap_rate_percent": None,
            }
        s = dept_stats[dominant]
        s["batch_count"] += 1
        s["scrap_kg"] += _scrap_qty(b)
        s["scrap_cost_inr"] += _scrap_cost(b, item_map)
        s["rejection_kg"] += _rejection_qty(b)
        s["output_kg"] += _output_qty(b)

    result = []
    for s in dept_stats.values():
        s["scrap_rate_percent"] = _scrap_rate_pct(s["scrap_kg"], s["output_kg"])
        s["scrap_kg"] = round(s["scrap_kg"], 2)
        s["scrap_cost_inr"] = round(s["scrap_cost_inr"], 2)
        s["rejection_kg"] = round(s["rejection_kg"], 2)
        s["output_kg"] = round(s["output_kg"], 2)
        result.append(s)

    result.sort(key=lambda x: x["scrap_kg"], reverse=True)

    total_with_op = len([b for b in batches if b.operator_user_id is not None])
    coverage = round(matched_count / max(total_with_op, 1) * 100, 1)

    return {
        "by_team": result,
        "matched_batch_count": matched_count,
        "total_batches_with_operator": total_with_op,
        "coverage_percent": coverage,
        "attribution_method": "proxy",
        "note": (
            "Department/team is proxied from the operator's Entry records "
            "on the same production date. Not a direct batch attribute."
        ),
    }


# ── Data Confidence ──────────────────────────────────────────────────────────

def _build_scrap_confidence(
    batches: list[SteelProductionBatch],
    by_shift: dict[str, Any],
    by_team: dict[str, Any],
) -> dict[str, Any]:
    """Report which scrap data dimensions are available."""
    has_scrap = any(_scrap_qty(b) > 0 for b in batches)
    has_rejection = any(_rejection_qty(b) > 0 for b in batches)
    has_machine = any(b.machine_id is not None for b in batches)
    has_line = any(b.line_id is not None for b in batches)
    has_operator = any(b.operator_user_id is not None for b in batches)

    shift_coverage = by_shift.get("coverage_percent", 0)
    team_coverage = by_team.get("coverage_percent", 0)

    return {
        "batch_scrap_tracking": has_scrap,
        "batch_rejection_tracking": has_rejection,
        "machine_tracking": has_machine,
        "line_tracking": has_line,
        "operator_tracking": has_operator,
        "shift_attribution": f"inferred_coverage_{shift_coverage}%" if shift_coverage > 0 else "unavailable",
        "team_attribution": f"proxy_coverage_{team_coverage}%" if team_coverage > 0 else "unavailable",
        "financial_valuation": "estimated_current_rate" if has_scrap else "no_data",
        "missing_fields": [
            field
            for field, present in [
                ("batch.shift", shift_coverage >= 50),
                ("batch.team_id", team_coverage >= 50),
                ("scrap_reason_code", False),
                ("historical_rate_snapshot", False),
            ]
            if not present
        ],
    }



