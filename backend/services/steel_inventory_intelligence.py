"""Expanded steel inventory intelligence services: valuation, slow-moving stock,
overstock detection, ABC analysis, suspicious movement detection, and reconciliation risk.

Phase 1 — No schema changes required. All analytics derived from existing
SteelInventoryItem, SteelInventoryTransaction, SteelStockReconciliation models.
Uses current_rate_per_kg for valuation (estimated, not audited).
"""

from __future__ import annotations

from collections import defaultdict
from datetime import date, datetime, timezone, timedelta
from typing import Any

import statistics

from sqlalchemy import case, func
from sqlalchemy.orm import Session

from backend.models.steel_inventory_item import SteelInventoryItem
from backend.models.steel_inventory_transaction import SteelInventoryTransaction
from backend.models.steel_stock_reconciliation import SteelStockReconciliation
from backend.services.steel_service import (
    coerce_utc_datetime,
    latest_reconciliations_for_factory,
    stock_balances_for_factory,
    stock_confidence_for_item,
)

# ── Constants ─────────────────────────────────────────────────────────────────

DEFAULT_LOW_STOCK_DAYS = 14
DEFAULT_DEAD_STOCK_DAYS = 90
DEFAULT_SLOW_MOVING_THRESHOLD_KG_PER_DAY = 10.0
DEFAULT_OVERSTOCK_COVERAGE_DAYS = 180
DEFAULT_STALE_RECONCILIATION_DAYS = 14
DEFAULT_MISMATCH_TOLERANCE_KG = 0.001

SEVERITY_ORDER = {"normal": 0, "watch": 1, "high": 2, "critical": 3}


# ── Expanded Inventory Intelligence ─────────────────────────────────────────


def build_inventory_intelligence(
    db: Session,
    factory_id: str,
    *,
    low_stock_days: int = DEFAULT_LOW_STOCK_DAYS,
    dead_stock_days: int = DEFAULT_DEAD_STOCK_DAYS,
) -> dict[str, Any]:
    """Expanded inventory health analysis.

    Phase 1 additions (over existing low-stock/dead-stock/turnover):
      - inventory_valuation      estimated value from current_rate × balance
      - slow_moving_items        items with low daily outflow
      - overstocked_items        items with excessive coverage
      - abc_analysis             value-based A/B/C classification
      - suspicious_movements     anomalous transaction patterns
      - reconciliation_risk      stale / high-variance items
    """
    items = (
        db.query(SteelInventoryItem)
        .filter(SteelInventoryItem.factory_id == factory_id, SteelInventoryItem.is_active.is_(True))
        .order_by(SteelInventoryItem.name.asc())
        .all()
    )
    item_ids = {item.id for item in items}
    if not item_ids:
        return _empty_response()

    balances = stock_balances_for_factory(db, factory_id)
    reconciliations = latest_reconciliations_for_factory(db, factory_id)

    now = datetime.now(timezone.utc)
    usage_cutoff = now - timedelta(days=low_stock_days)
    dead_cutoff = now - timedelta(days=dead_stock_days)

    # ── Usage / outflow statistics ──────────────────────────────────────
    usage_rows = (
        db.query(
            SteelInventoryTransaction.item_id,
            func.sum(func.abs(SteelInventoryTransaction.quantity_kg)).label("total_out"),
            func.count(SteelInventoryTransaction.id).label("txn_count"),
            func.max(SteelInventoryTransaction.created_at).label("last_txn_at"),
        )
        .filter(
            SteelInventoryTransaction.factory_id == factory_id,
            SteelInventoryTransaction.item_id.in_(list(item_ids)),
            SteelInventoryTransaction.quantity_kg < 0,
            SteelInventoryTransaction.created_at >= usage_cutoff,
        )
        .group_by(SteelInventoryTransaction.item_id)
        .all()
    )
    usage_map = {int(row.item_id): row for row in usage_rows}

    # Last transaction date (any direction) for dead-stock detection
    last_txn_rows = (
        db.query(
            SteelInventoryTransaction.item_id,
            func.max(SteelInventoryTransaction.created_at).label("last_any_txn"),
        )
        .filter(
            SteelInventoryTransaction.factory_id == factory_id,
            SteelInventoryTransaction.item_id.in_(list(item_ids)),
        )
        .group_by(SteelInventoryTransaction.item_id)
        .all()
    )
    last_txn_map = {int(row.item_id): coerce_utc_datetime(row.last_any_txn) for row in last_txn_rows}

    # ── Aggregate computed per-item values ──────────────────────────────
    item_analytics: list[dict[str, Any]] = []

    low_stock_alerts: list[dict[str, Any]] = []
    dead_stock_items: list[dict[str, Any]] = []
    slow_moving_items: list[dict[str, Any]] = []
    overstocked_items: list[dict[str, Any]] = []

    for item in items:
        item_id = item.id
        balance_kg = balances.get(item_id, 0.0)
        rate = float(item.current_rate_per_kg or 0.0)
        estimated_value_inr = balance_kg * rate

        usage = usage_map.get(item_id)
        total_out = float(usage.total_out or 0.0) if usage else 0.0
        txn_count = int(usage.txn_count or 0) if usage else 0
        avg_daily_out_kg = total_out / max(low_stock_days, 1)

        last_txn = last_txn_map.get(item_id)
        rec = reconciliations.get(item_id)
        confident = stock_confidence_for_item(balance_kg=balance_kg, reconciliation=rec)

        # Days of stock on hand
        days_of_stock = (balance_kg / avg_daily_out_kg) if avg_daily_out_kg > 0 else None

        # Coverage threshold (for low stock / overstock)
        coverage_threshold_kg = avg_daily_out_kg * low_stock_days

        # ── Low stock (Phase 2 enhanced with reorder point / safety stock) ─
        # If reorder_point_kg or safety_stock_kg is set, use the configured
        # thresholds instead of heuristics.
        has_policy = item.reorder_point_kg is not None or item.safety_stock_kg is not None
        if has_policy:
            effective_reorder = float(item.reorder_point_kg or item.safety_stock_kg or 0.0)
            effective_minimum = float(item.safety_stock_kg or (item.reorder_point_kg * 0.5) if item.reorder_point_kg else 0.0)
            if balance_kg < effective_reorder:
                is_critical = balance_kg < effective_minimum
                days_remaining = balance_kg / avg_daily_out_kg if avg_daily_out_kg else 999.0
                low_stock_alerts.append({
                    "item_id": item_id,
                    "item_code": item.item_code,
                    "name": item.name,
                    "category": item.category,
                    "current_balance_kg": round(balance_kg, 3),
                    "avg_daily_usage_kg": round(avg_daily_out_kg, 3),
                    "days_remaining": round(days_remaining, 1),
                    "coverage_threshold_kg": round(effective_reorder, 3),
                    "estimated_value_inr": round(estimated_value_inr, 2),
                    "severity": "critical" if is_critical else "warning",
                })
        elif avg_daily_out_kg > 0 and balance_kg >= 0:
            days_remaining = balance_kg / avg_daily_out_kg if avg_daily_out_kg else 999.0
            is_low = balance_kg < coverage_threshold_kg * 0.3
            is_critical = balance_kg < coverage_threshold_kg * 0.1
            if is_low:
                low_stock_alerts.append({
                    "item_id": item_id,
                    "item_code": item.item_code,
                    "name": item.name,
                    "category": item.category,
                    "current_balance_kg": round(balance_kg, 3),
                    "avg_daily_usage_kg": round(avg_daily_out_kg, 3),
                    "days_remaining": round(days_remaining, 1),
                    "coverage_threshold_kg": round(coverage_threshold_kg, 3),
                    "estimated_value_inr": round(estimated_value_inr, 2),
                    "severity": "critical" if is_critical else "warning",
                })

        # ── Dead stock (existing logic) ─────────────────────────────────
        is_dead = last_txn is None or (last_txn and last_txn < dead_cutoff)
        if is_dead and balance_kg > 0.001:
            age_days = (now - (last_txn or now)).days if last_txn else dead_stock_days
            dead_stock_items.append({
                "item_id": item_id,
                "item_code": item.item_code,
                "name": item.name,
                "category": item.category,
                "current_balance_kg": round(balance_kg, 3),
                "estimated_value_inr": round(estimated_value_inr, 2),
                "last_transaction_at": last_txn.isoformat() if last_txn else None,
                "inactive_days": min(age_days, dead_stock_days),
            })

        # ── Slow-moving stock (new) ────────────────────────────────────
        # Items with balance > 0 but very low outflow
        if balance_kg > 0.001 and avg_daily_out_kg < DEFAULT_SLOW_MOVING_THRESHOLD_KG_PER_DAY and avg_daily_out_kg > 0:
            slow_moving_items.append({
                "item_id": item_id,
                "item_code": item.item_code,
                "name": item.name,
                "category": item.category,
                "current_balance_kg": round(balance_kg, 3),
                "estimated_value_inr": round(estimated_value_inr, 2),
                "avg_daily_out_kg": round(avg_daily_out_kg, 3),
                "days_of_stock_on_hand": round(days_of_stock, 1) if days_of_stock else None,
                "last_transaction_at": last_txn.isoformat() if last_txn else None,
            })

        # ── Overstock detection (new) ──────────────────────────────────
        if avg_daily_out_kg > 0 and days_of_stock is not None and days_of_stock > DEFAULT_OVERSTOCK_COVERAGE_DAYS:
            overstocked_items.append({
                "item_id": item_id,
                "item_code": item.item_code,
                "name": item.name,
                "category": item.category,
                "current_balance_kg": round(balance_kg, 3),
                "estimated_value_inr": round(estimated_value_inr, 2),
                "days_of_stock_on_hand": round(days_of_stock, 1),
                "avg_daily_out_kg": round(avg_daily_out_kg, 3),
                "coverage_days": DEFAULT_OVERSTOCK_COVERAGE_DAYS,
            })

        # Collect for valuation/ABC rollup
        item_analytics.append({
            "item_id": item_id,
            "item_code": item.item_code,
            "name": item.name,
            "category": item.category,
            "balance_kg": balance_kg,
            "estimated_value_inr": estimated_value_inr,
            "rate": rate,
            "avg_daily_out_kg": avg_daily_out_kg,
            "days_of_stock": days_of_stock,
            "confidence_status": confident[0],
        })

    # ── Turnover items (existing logic, enhanced) ────────────────────────
    turnover_items = [
        {
            "item_id": a["item_id"],
            "item_code": a["item_code"],
            "name": a["name"],
            "category": a["category"],
            "current_balance_kg": round(a["balance_kg"], 3),
            "avg_daily_out_kg": round(a["avg_daily_out_kg"], 3),
            "days_of_stock_on_hand": round(a["days_of_stock"], 1) if a["days_of_stock"] else None,
            "total_outflow_kg_30d": round(a["avg_daily_out_kg"] * low_stock_days, 3),
            "estimated_value_inr": round(a["estimated_value_inr"], 2),
            "confidence_status": a["confidence_status"],
        }
        for a in item_analytics
    ]

    # ── Inventory Valuation (new) ───────────────────────────────────────
    valuation = _build_inventory_valuation(item_analytics)

    # ── ABC Analysis (new) ──────────────────────────────────────────────
    abc_analysis = _build_abc_analysis(item_analytics)

    # ── Suspicious Movement Detection (new) ─────────────────────────────
    suspicious_movements = _build_suspicious_movement_analysis(db, factory_id, item_ids, days=low_stock_days)

    # ── Reconciliation Risk (new) ───────────────────────────────────────
    reconciliation_risk = _build_reconciliation_risk(db, factory_id, items, balances, reconciliations)

    # ── Category rollup ─────────────────────────────────────────────────
    category_summary: dict[str, dict[str, Any]] = {}
    for item in items:
        cat = item.category
        if cat not in category_summary:
            category_summary[cat] = {
                "category": cat,
                "item_count": 0,
                "total_balance_kg": 0.0,
                "total_value_inr": 0.0,
                "low_stock_count": 0,
                "dead_stock_count": 0,
                "slow_moving_count": 0,
                "overstocked_count": 0,
            }
        balance_kg = balances.get(item.id, 0.0)
        rate = float(item.current_rate_per_kg or 0.0)
        category_summary[cat]["item_count"] += 1
        category_summary[cat]["total_balance_kg"] += balance_kg
        category_summary[cat]["total_value_inr"] += balance_kg * rate
        category_summary[cat]["low_stock_count"] += sum(1 for a in low_stock_alerts if a["item_id"] == item.id)
        category_summary[cat]["dead_stock_count"] += sum(1 for d in dead_stock_items if d["item_id"] == item.id)
        category_summary[cat]["slow_moving_count"] += sum(1 for s in slow_moving_items if s["item_id"] == item.id)
        category_summary[cat]["overstocked_count"] += sum(1 for o in overstocked_items if o["item_id"] == item.id)

    for summary in category_summary.values():
        summary["total_balance_kg"] = round(summary["total_balance_kg"], 3)
        summary["total_value_inr"] = round(summary["total_value_inr"], 2)

    # ── Sort and finalise ───────────────────────────────────────────────
    low_stock_alerts.sort(key=lambda x: x["days_remaining"])
    dead_stock_items.sort(key=lambda x: x["estimated_value_inr"], reverse=True)
    slow_moving_items.sort(key=lambda x: x["estimated_value_inr"], reverse=True)
    overstocked_items.sort(key=lambda x: x["estimated_value_inr"], reverse=True)
    turnover_items.sort(key=lambda x: float(x["avg_daily_out_kg"] or 0), reverse=True)

    return {
        "as_of": date.today().isoformat(),
        "low_stock_alerts": low_stock_alerts,
        "dead_stock": dead_stock_items,
        "turnover_analysis": {
            "items": turnover_items,
            "category_summary": list(category_summary.values()),
        },
        # ── Phase 1 additions ──────────────────────────────────────────
        "inventory_valuation": valuation,
        "slow_moving_items": slow_moving_items,
        "overstocked_items": overstocked_items,
        "abc_analysis": abc_analysis,
        "suspicious_movements": suspicious_movements,
        "reconciliation_risk": reconciliation_risk,
    }


# ── Inventory Valuation ──────────────────────────────────────────────────────


def _build_inventory_valuation(
    item_analytics: list[dict[str, Any]],
) -> dict[str, Any]:
    """Compute total estimated inventory value from current_rate × balance."""
    if not item_analytics:
        return {
            "total_estimated_value_inr": 0.0,
            "by_category": [],
            "as_of": date.today().isoformat(),
        }

    total_value = sum(a["estimated_value_inr"] for a in item_analytics)
    category_rollup: dict[str, dict[str, Any]] = {}
    for a in item_analytics:
        cat = a["category"]
        if cat not in category_rollup:
            category_rollup[cat] = {
                "category": cat,
                "balance_kg": 0.0,
                "value_inr": 0.0,
                "item_count": 0,
            }
        category_rollup[cat]["balance_kg"] += a["balance_kg"]
        category_rollup[cat]["value_inr"] += a["estimated_value_inr"]
        category_rollup[cat]["item_count"] += 1

    by_category = sorted(
        [
            {
                "category": v["category"],
                "balance_kg": round(v["balance_kg"], 3),
                "value_inr": round(v["value_inr"], 2),
                "item_count": v["item_count"],
            }
            for v in category_rollup.values()
        ],
        key=lambda x: x["value_inr"],
        reverse=True,
    )

    return {
        "total_estimated_value_inr": round(total_value, 2),
        "by_category": by_category,
        "as_of": date.today().isoformat(),
        "data_quality": "estimated",
        "method": "current_rate_per_kg × stock_balance",
        "note": "Uses mutable current_rate_per_kg — not audited COGS.",
    }


# ── ABC Analysis ────────────────────────────────────────────────────────────


def _build_abc_analysis(
    item_analytics: list[dict[str, Any]],
) -> dict[str, Any]:
    """Classify items by value: A (top 80%), B (next 15%), C (bottom 5%)."""
    if not item_analytics:
        return {"a_items": [], "b_items": [], "c_items": [], "method": "value_contribution"}

    sorted_items = sorted(item_analytics, key=lambda x: x["estimated_value_inr"], reverse=True)
    total_value = sum(a["estimated_value_inr"] for a in sorted_items)

    if total_value <= 0:
        return {"a_items": [], "b_items": [], "c_items": [], "method": "value_contribution"}

    running_pct = 0.0
    a_items: list[dict[str, Any]] = []
    b_items: list[dict[str, Any]] = []
    c_items: list[dict[str, Any]] = []

    for a in sorted_items:
        contribution_pct = (a["estimated_value_inr"] / total_value) * 100 if total_value > 0 else 0.0
        item_entry = {
            "item_id": a["item_id"],
            "item_code": a["item_code"],
            "name": a["name"],
            "category": a["category"],
            "balance_kg": round(a["balance_kg"], 3),
            "estimated_value_inr": round(a["estimated_value_inr"], 2),
            "contribution_percent": round(contribution_pct, 2),
        }
        if running_pct < 80:
            a_items.append(item_entry)
        elif running_pct < 95:
            b_items.append(item_entry)
        else:
            c_items.append(item_entry)
        running_pct += contribution_pct

    return {
        "a_items": a_items,
        "b_items": b_items,
        "c_items": c_items,
        "summary": {
            "a_count": len(a_items),
            "a_value_inr": round(sum(x["estimated_value_inr"] for x in a_items), 2),
            "b_count": len(b_items),
            "b_value_inr": round(sum(x["estimated_value_inr"] for x in b_items), 2),
            "c_count": len(c_items),
            "c_value_inr": round(sum(x["estimated_value_inr"] for x in c_items), 2),
            "total_value_inr": round(total_value, 2),
        },
        "method": "value_contribution",
    }


# ── Suspicious Movement Detection ───────────────────────────────────────────


def _build_suspicious_movement_analysis(
    db: Session,
    factory_id: str,
    item_ids: set[int],
    *,
    days: int = 30,
) -> list[dict[str, Any]]:
    """Detect anomalous stock movement patterns.

    Flags:
      1. Same-day inward + outward on the same item
      2. Frequent manual adjustments (>3 in period)
      3. Unusually large single transactions (outlier detection)
    """
    now = datetime.now(timezone.utc)
    cutoff = now - timedelta(days=days)
    suspicious: list[dict[str, Any]] = []

    # 1. Same-day inward + outward per item
    day_rows = (
        db.query(
            SteelInventoryTransaction.item_id,
            func.date(SteelInventoryTransaction.created_at).label("txn_date"),
            func.sum(
                case((SteelInventoryTransaction.quantity_kg > 0, 1), else_=0)
            ).label("inward_count"),
            func.sum(
                case((SteelInventoryTransaction.quantity_kg < 0, 1), else_=0)
            ).label("outward_count"),
        )
        .filter(
            SteelInventoryTransaction.factory_id == factory_id,
            SteelInventoryTransaction.item_id.in_(list(item_ids)),
            SteelInventoryTransaction.created_at >= cutoff,
        )
        .group_by(SteelInventoryTransaction.item_id, func.date(SteelInventoryTransaction.created_at))
        .having(
            func.sum(
                case((SteelInventoryTransaction.quantity_kg > 0, 1), else_=0)
            ) > 0,
            func.sum(
                case((SteelInventoryTransaction.quantity_kg < 0, 1), else_=0)
            ) > 0,
        )
        .all()
    )

    item_name_map: dict[int, tuple[str, str]] = {}
    for row in day_rows:
        item_id = int(row.item_id)
        if item_id not in item_name_map:
            item_obj = db.query(SteelInventoryItem).filter(SteelInventoryItem.id == item_id).first()
            name = item_obj.name if item_obj else f"Item #{item_id}"
            code = item_obj.item_code if item_obj else ""
            item_name_map[item_id] = (name, code)

        name, code = item_name_map.get(item_id, (f"Item #{item_id}", ""))
        suspicious.append({
            "type": "same_day_in_out",
            "severity": "warning",
            "item_id": item_id,
            "item_code": code,
            "item_name": name,
            "detail": f"Both inward and outward transactions on {str(row.txn_date)}.",
            "txn_date": str(row.txn_date),
            "inward_count": int(row.inward_count or 0),
            "outward_count": int(row.outward_count or 0),
            "detected_at": now.isoformat(),
        })

    # 2. Frequent manual adjustments
    adjustment_counts = (
        db.query(
            SteelInventoryTransaction.item_id,
            func.count(SteelInventoryTransaction.id).label("adj_count"),
        )
        .filter(
            SteelInventoryTransaction.factory_id == factory_id,
            SteelInventoryTransaction.item_id.in_(list(item_ids)),
            SteelInventoryTransaction.transaction_type == "adjustment",
            SteelInventoryTransaction.created_at >= cutoff,
        )
        .group_by(SteelInventoryTransaction.item_id)
        .having(func.count(SteelInventoryTransaction.id) > 3)
        .all()
    )

    for row in adjustment_counts:
        item_id = int(row.item_id)
        item_obj = db.query(SteelInventoryItem).filter(SteelInventoryItem.id == item_id).first()
        name = item_obj.name if item_obj else f"Item #{item_id}"
        code = item_obj.item_code if item_obj else ""
        suspicious.append({
            "type": "frequent_adjustments",
            "severity": "warning",
            "item_id": item_id,
            "item_code": code,
            "item_name": name,
            "detail": f"{int(row.adj_count)} manual adjustments in the last {days} days.",
            "adjustment_count": int(row.adj_count),
            "period_days": days,
            "detected_at": now.isoformat(),
        })

    # 3. Unusually large transactions (outlier via Python stats)
    #   Fetch all transaction quantities per item, compute mean + std in Python
    #   to avoid SQLite's lack of stddev function.
    recent_txns = (
        db.query(SteelInventoryTransaction)
        .filter(
            SteelInventoryTransaction.factory_id == factory_id,
            SteelInventoryTransaction.item_id.in_(list(item_ids)),
            SteelInventoryTransaction.created_at >= cutoff,
        )
        .order_by(SteelInventoryTransaction.created_at.desc())
        .limit(1000)
        .all()
    )

    # Group absolute quantities by item
    item_qty_lists: dict[int, list[float]] = defaultdict(list)
    for txn in recent_txns:
        item_qty_lists[int(txn.item_id)].append(abs(float(txn.quantity_kg or 0.0)))

    # Compute stats per item and flag outliers
    item_stat_cache: dict[int, tuple[float, float]] = {}
    for item_id, qty_list in item_qty_lists.items():
        if len(qty_list) >= 2:
            mean_val = statistics.mean(qty_list)
            std_val = statistics.stdev(qty_list) if len(qty_list) >= 2 else 0.0
            if mean_val > 0 and std_val > 0:
                item_stat_cache[item_id] = (mean_val, std_val)

    seen_outlier_keys: set[tuple[int, int]] = set()
    for txn in recent_txns:
        item_id = int(txn.item_id)
        stats = item_stat_cache.get(item_id)
        if not stats:
            continue
        mean_val, std_val = stats
        abs_qty = abs(float(txn.quantity_kg or 0.0))
        # Flag if > 3 std devs above mean and not already flagged
        outlier_key = (item_id, int(txn.id))
        if outlier_key not in seen_outlier_keys and abs_qty > mean_val + 3 * std_val:
            seen_outlier_keys.add(outlier_key)
            item_obj = db.query(SteelInventoryItem).filter(SteelInventoryItem.id == item_id).first()
            name = item_obj.name if item_obj else f"Item #{item_id}"
            code = item_obj.item_code if item_obj else ""
            suspicious.append({
                "type": "outlier_transaction",
                "severity": "high",
                "item_id": item_id,
                "item_code": code,
                "item_name": name,
                "detail": f"Transaction of {round(abs_qty, 2)} KG is >3 std devs above the mean of {round(mean_val, 2)} KG.",
                "quantity_kg": round(abs_qty, 3),
                "mean_kg": round(mean_val, 3),
                "std_dev_kg": round(std_val, 3),
                "transaction_type": txn.transaction_type,
                "detected_at": now.isoformat(),
            })

    suspicious.sort(key=lambda x: {"critical": 0, "high": 1, "warning": 2}.get(x["severity"], 99))
    return suspicious


# ── Reconciliation Risk ──────────────────────────────────────────────────────


def _build_reconciliation_risk(
    db: Session,
    factory_id: str,
    items: list[SteelInventoryItem],
    balances: dict[int, float],
    reconciliations: dict[int, SteelStockReconciliation],
) -> dict[str, Any]:
    """Rank items by reconciliation risk: stale reviews and high variance."""
    stale_cutoff = datetime.now(timezone.utc) - timedelta(days=DEFAULT_STALE_RECONCILIATION_DAYS)

    stale_items: list[dict[str, Any]] = []
    high_variance_items: list[dict[str, Any]] = []
    pending_count = 0

    pending_count = (
        db.query(SteelStockReconciliation)
        .filter(
            SteelStockReconciliation.factory_id == factory_id,
            SteelStockReconciliation.status == "pending",
        )
        .count()
    )

    for item in items:
        rec = reconciliations.get(item.id)
        balance_kg = balances.get(item.id, 0.0)
        rate = float(item.current_rate_per_kg or 0.0)
        estimated_value = balance_kg * rate

        if rec is None:
            stale_items.append({
                "item_id": item.id,
                "item_code": item.item_code,
                "name": item.name,
                "category": item.category,
                "current_balance_kg": round(balance_kg, 3),
                "estimated_value_inr": round(estimated_value, 2),
                "reason": "Never reconciled",
                "days_since_last_review": None,
            })
        else:
            counted_at = coerce_utc_datetime(rec.counted_at)
            if counted_at and counted_at < stale_cutoff:
                age_days = (datetime.now(timezone.utc) - counted_at).days
                stale_items.append({
                    "item_id": item.id,
                    "item_code": item.item_code,
                    "name": item.name,
                    "category": item.category,
                    "current_balance_kg": round(balance_kg, 3),
                    "estimated_value_inr": round(estimated_value, 2),
                    "reason": f"Last review {age_days} days ago (SLA: {DEFAULT_STALE_RECONCILIATION_DAYS} days)",
                    "days_since_last_review": age_days,
                    "last_reviewed_at": counted_at.isoformat() if counted_at else None,
                })

            variance_pct = abs(float(rec.variance_percent or 0.0))
            if variance_pct > 5.0:
                high_variance_items.append({
                    "item_id": item.id,
                    "item_code": item.item_code,
                    "name": item.name,
                    "category": item.category,
                    "current_balance_kg": round(balance_kg, 3),
                    "estimated_value_inr": round(estimated_value, 2),
                    "variance_percent": round(variance_pct, 2),
                    "variance_kg": round(abs(float(rec.variance_kg or 0.0)), 3),
                    "mismatch_cause": rec.mismatch_cause,
                })

    stale_items.sort(key=lambda x: float(x.get("estimated_value_inr", 0) or 0), reverse=True)
    high_variance_items.sort(key=lambda x: float(x.get("variance_percent", 0) or 0), reverse=True)

    return {
        "stale_items": stale_items[:10],
        "high_variance_items": high_variance_items[:10],
        "pending_reviews": int(pending_count or 0),
        "stale_sla_days": DEFAULT_STALE_RECONCILIATION_DAYS,
    }


# ── Empty Response ──────────────────────────────────────────────────────────


def _empty_response() -> dict[str, Any]:
    today = date.today().isoformat()
    return {
        "as_of": today,
        "low_stock_alerts": [],
        "dead_stock": [],
        "turnover_analysis": {"items": [], "category_summary": []},
        "inventory_valuation": {
            "total_estimated_value_inr": 0.0,
            "by_category": [],
            "as_of": today,
            "data_quality": "estimated",
            "method": "current_rate_per_kg × stock_balance",
            "note": "Uses mutable current_rate_per_kg — not audited COGS.",
        },
        "slow_moving_items": [],
        "overstocked_items": [],
        "abc_analysis": {"a_items": [], "b_items": [], "c_items": [], "method": "value_contribution"},
        "suspicious_movements": [],
        "reconciliation_risk": {
            "stale_items": [],
            "high_variance_items": [],
            "pending_reviews": 0,
            "stale_sla_days": DEFAULT_STALE_RECONCILIATION_DAYS,
        },
    }
