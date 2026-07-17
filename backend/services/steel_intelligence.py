"""Steel intelligence services: inventory intelligence, quality tracking, anomaly detection, and owner dashboard.

Launched as P1 feature set for factory operations readiness.
"""

from __future__ import annotations

from collections import defaultdict
from datetime import date, datetime, timedelta, timezone
from typing import Any

from sqlalchemy import func, case
from sqlalchemy.orm import Session

from backend.models.factory import Factory
from backend.models.steel_customer import SteelCustomer
from backend.models.steel_customer_payment import SteelCustomerPayment
from backend.models.steel_dispatch import SteelDispatch
from backend.models.steel_dispatch_line import SteelDispatchLine
from backend.models.steel_inventory_item import SteelInventoryItem
from backend.models.steel_inventory_transaction import SteelInventoryTransaction
from backend.models.steel_production_batch import SteelProductionBatch
from backend.models.steel_sales_invoice import SteelSalesInvoice
from backend.models.steel_sales_invoice_line import SteelSalesInvoiceLine
from backend.models.steel_stock_reconciliation import SteelStockReconciliation
from backend.models.user import User
from backend.services.steel_service import (
    coerce_utc_datetime,
    latest_reconciliations_for_factory,
    serialize_batch,
    serialize_stock_row,
    stock_balances_for_factory,
    stock_confidence_for_item,
    build_steel_realization_metrics,
)


# ── Constants ─────────────────────────────────────────────────────────────────

DEFAULT_LOW_STOCK_DAYS_COVERAGE = 14       # how many days of average usage to compare against
DEFAULT_DEAD_STOCK_DAYS = 90                # no transactions in this many days = dead
DEFAULT_STALE_RECONCILIATION_DAYS = 14
DEFAULT_MISMATCH_TOLERANCE_KG = 0.001

SEVERITY_ORDER = {"normal": 0, "watch": 1, "high": 2, "critical": 3}


# ── Inventory Intelligence ────────────────────────────────────────────────────


def build_inventory_intelligence(
    db: Session,
    factory_id: str,
    *,
    low_stock_days: int = DEFAULT_LOW_STOCK_DAYS_COVERAGE,
    dead_stock_days: int = DEFAULT_DEAD_STOCK_DAYS,
) -> dict[str, Any]:
    """Analyse inventory health: low-stock alerts, dead stock, turnover velocity.

    Returns:
        low_stock_alerts: items where current stock < (avg daily usage × coverage days)
        dead_stock: items with no transactions in dead_stock_days
        turnover_analysis: per-item in/out velocity, days-of-stock, category rollup
    """
    items = (
        db.query(SteelInventoryItem)
        .filter(SteelInventoryItem.factory_id == factory_id, SteelInventoryItem.is_active.is_(True))
        .order_by(SteelInventoryItem.name.asc())
        .all()
    )
    item_ids = {item.id for item in items}
    if not item_ids:
        return {"low_stock_alerts": [], "dead_stock": [], "turnover_analysis": {"items": [], "category_summary": {}}}

    balances = stock_balances_for_factory(db, factory_id)
    reconciliations = latest_reconciliations_for_factory(db, factory_id)

    # Usage window: last N days of outbound transactions
    usage_cutoff = datetime.now(timezone.utc) - timedelta(days=low_stock_days)
    dead_cutoff = datetime.now(timezone.utc) - timedelta(days=dead_stock_days)

    # Aggregate outbound quantity per item over the usage window
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

    # Also get the last transaction date for ALL transactions (for dead stock detection)
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

    low_stock_alerts: list[dict[str, Any]] = []
    dead_stock_items: list[dict[str, Any]] = []
    turnover_items: list[dict[str, Any]] = []

    now = datetime.now(timezone.utc)

    for item in items:
        item_id = item.id
        balance_kg = balances.get(item_id, 0.0)
        usage = usage_map.get(item_id)
        avg_daily_usage_kg = 0.0
        if usage:
            total_out = float(usage.total_out or 0.0)
            avg_daily_usage_kg = total_out / max(low_stock_days, 1)

        # Low stock: balance < (avg_daily_usage × coverage_days), but only when usage exists
        if avg_daily_usage_kg > 0 and balance_kg >= 0:
            days_remaining = balance_kg / avg_daily_usage_kg if avg_daily_usage_kg else 999.0
            coverage_threshold_kg = avg_daily_usage_kg * low_stock_days
            is_low = balance_kg < coverage_threshold_kg * 0.3  # less than 30% of coverage target
            is_critical = balance_kg < coverage_threshold_kg * 0.1  # less than 10%
            if is_low:
                low_stock_alerts.append({
                    "item_id": item_id,
                    "item_code": item.item_code,
                    "name": item.name,
                    "category": item.category,
                    "current_balance_kg": round(balance_kg, 3),
                    "avg_daily_usage_kg": round(avg_daily_usage_kg, 3),
                    "days_remaining": round(days_remaining, 1),
                    "coverage_threshold_kg": round(coverage_threshold_kg, 3),
                    "severity": "critical" if is_critical else "warning",
                })

        # Dead stock: no transactions at all, or last transaction before cutoff
        last_txn = last_txn_map.get(item_id)
        is_dead = last_txn is None or last_txn < dead_cutoff
        if is_dead and balance_kg > 0.001:
            age_days = (now - (last_txn or now)).days if last_txn else dead_stock_days
            dead_stock_items.append({
                "item_id": item_id,
                "item_code": item.item_code,
                "name": item.name,
                "category": item.category,
                "current_balance_kg": round(balance_kg, 3),
                "estimated_value_inr": round(
                    balance_kg * float(item.current_rate_per_kg or 0.0), 2
                ),
                "last_transaction_at": last_txn.isoformat() if last_txn else None,
                "inactive_days": min(age_days, dead_stock_days),
            })

        # Turnover metrics
        txn_count = int(usage.txn_count or 0) if usage else 0
        turnover_kg = float(usage.total_out or 0.0) if usage else 0.0
        rec = reconciliations.get(item_id)
        confident = stock_confidence_for_item(balance_kg=balance_kg, reconciliation=rec)
        turnover_items.append({
            "item_id": item_id,
            "item_code": item.item_code,
            "name": item.name,
            "category": item.category,
            "current_balance_kg": round(balance_kg, 3),
            "avg_daily_out_kg": round(avg_daily_usage_kg, 3),
            "days_of_stock_on_hand": round(
                balance_kg / avg_daily_usage_kg, 1
            ) if avg_daily_usage_kg > 0 else None,
            "total_outflow_kg_30d": round(turnover_kg, 3),
            "transaction_count_30d": txn_count,
            "confidence_status": confident[0],
        })

    # Category rollup
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
            }
        balance_kg = balances.get(item.id, 0.0)
        category_summary[cat]["item_count"] += 1
        category_summary[cat]["total_balance_kg"] += balance_kg
        category_summary[cat]["total_value_inr"] += balance_kg * float(item.current_rate_per_kg or 0.0)
        category_summary[cat]["low_stock_count"] += sum(
            1 for a in low_stock_alerts if a["item_id"] == item.id
        )
        category_summary[cat]["dead_stock_count"] += sum(
            1 for d in dead_stock_items if d["item_id"] == item.id
        )

    for summary in category_summary.values():
        summary["total_balance_kg"] = round(summary["total_balance_kg"], 3)
        summary["total_value_inr"] = round(summary["total_value_inr"], 2)

    low_stock_alerts.sort(key=lambda x: x["days_remaining"])
    dead_stock_items.sort(key=lambda x: x["estimated_value_inr"], reverse=True)
    turnover_items.sort(key=lambda x: float(x["avg_daily_out_kg"] or 0), reverse=True)

    return {
        "low_stock_alerts": low_stock_alerts,
        "dead_stock": dead_stock_items,
        "turnover_analysis": {
            "items": turnover_items,
            "category_summary": list(category_summary.values()),
        },
    }


# ── Quality Tracking ─────────────────────────────────────────────────────────


def build_quality_tracking(
    db: Session,
    factory_id: str,
    *,
    days: int = 30,
) -> dict[str, Any]:
    """Analyse batch quality: rejection/defect rates, severity distribution, quality score.

    Returns:
        rejection_rate: overall and per-operator rejection stats
        severity_distribution: count of batches per severity level
        defect_categories: top defect reasons aggregated
        quality_score: composite score (0-100) based on loss %, severity, and consistency
        trend: day-by-day quality KPIs over the period
    """
    cutoff = datetime.now(timezone.utc) - timedelta(days=days)
    batches = (
        db.query(SteelProductionBatch)
        .filter(
            SteelProductionBatch.factory_id == factory_id,
            SteelProductionBatch.created_at >= cutoff,
        )
        .order_by(SteelProductionBatch.production_date.asc())
        .all()
    )

    if not batches:
        return {
            "total_batches": 0,
            "rejection_rate": {"overall_percent": 0.0, "by_operator": []},
            "severity_distribution": {"normal": 0, "watch": 0, "high": 0, "critical": 0},
            "defect_categories": [],
            "quality_score": {"overall": 0.0, "label": "insufficient_data"},
            "trend": [],
        }

    # Load operator names
    operator_ids = {b.operator_user_id for b in batches if b.operator_user_id}
    operator_map: dict[int, User] = {
        u.id: u for u in db.query(User).filter(User.id.in_(operator_ids)).all()
    } if operator_ids else {}

    # Severity distribution
    severity_counts: dict[str, int] = {"normal": 0, "watch": 0, "high": 0, "critical": 0}
    operator_stats: dict[int, dict[str, Any]] = defaultdict(
        lambda: {"user_id": 0, "name": "", "total": 0, "high_critical": 0, "total_loss_percent": 0.0}
    )

    total_batches = len(batches)
    total_loss_percent = 0.0
    total_high_critical = 0
    day_buckets: dict[str, dict[str, Any]] = {}
    defect_reasons: dict[str, int] = defaultdict(int)

    for batch in batches:
        severity = str(batch.severity or "normal")
        severity_counts[severity] = severity_counts.get(severity, 0) + 1

        loss_pct = float(batch.loss_percent or 0.0)
        total_loss_percent += loss_pct

        if severity in ("high", "critical"):
            total_high_critical += 1

        # Operator rollup
        op_id = batch.operator_user_id
        if op_id:
            op = operator_stats[op_id]
            op["user_id"] = op_id
            op["name"] = operator_map[op_id].name if op_id in operator_map else f"User {op_id}"
            op["total"] += 1
            op["high_critical"] += 1 if severity in ("high", "critical") else 0
            op["total_loss_percent"] += loss_pct

        # Defect reason sampling
        if severity in ("high", "critical"):
            reason = f"{severity} variance ({round(loss_pct, 1)}% loss)"
            defect_reasons[reason] += 1

        # Day bucket
        day_key = batch.production_date.isoformat()
        if day_key not in day_buckets:
            day_buckets[day_key] = {
                "date": day_key,
                "batch_count": 0,
                "avg_loss_percent": 0.0,
                "high_critical_count": 0,
                "quality_score": 0.0,
            }
        day_buckets[day_key]["batch_count"] += 1
        day_buckets[day_key]["avg_loss_percent"] = (
            (day_buckets[day_key]["avg_loss_percent"] * (day_buckets[day_key]["batch_count"] - 1) + loss_pct)
            / day_buckets[day_key]["batch_count"]
        )
        day_buckets[day_key]["high_critical_count"] += 1 if severity in ("high", "critical") else 0

    # Operator rejection rate
    by_operator = []
    for op_id, op in operator_stats.items():
        high_crit_pct = (op["high_critical"] / max(op["total"], 1)) * 100.0
        avg_loss = op["total_loss_percent"] / max(op["total"], 1)
        by_operator.append({
            "user_id": op_id,
            "name": op["name"],
            "batch_count": op["total"],
            "high_critical_count": op["high_critical"],
            "high_critical_percent": round(high_crit_pct, 2),
            "avg_loss_percent": round(avg_loss, 3),
        })
    by_operator.sort(key=lambda x: x["high_critical_percent"], reverse=True)

    # Overall quality score (0-100)
    avg_loss = total_loss_percent / max(total_batches, 1)
    high_crit_ratio = total_high_critical / max(total_batches, 1)
    # Score: start at 100, deduct for high avg loss and high severity ratio
    loss_penalty = min(avg_loss * 5, 40)  # up to 40 pts deduction for loss
    severity_penalty = high_crit_ratio * 50  # up to 50 pts deduction for high/critical
    # Consistency bonus: if batches are spread across many days, bonus
    consistency_bonus = min(len(day_buckets) * 2, 10)
    quality_score = max(0, min(100, 100 - loss_penalty - severity_penalty + consistency_bonus))

    if quality_score >= 80:
        label = "good"
    elif quality_score >= 50:
        label = "needs_attention"
    else:
        label = "critical"

    # Defect categories sorted
    sorted_defects = sorted(defect_reasons.items(), key=lambda x: x[1], reverse=True)[:10]
    defect_categories = [
        {"reason": reason, "count": count, "percent": round(count / max(total_high_critical, 1) * 100, 1)}
        for reason, count in sorted_defects
    ]

    # Day trend
    day_trend = []
    for day_key in sorted(day_buckets.keys()):
        d = day_buckets[day_key]
        day_score = max(0, 100 - (d["avg_loss_percent"] * 8) - (d["high_critical_count"] / max(d["batch_count"], 1)) * 60)
        d["quality_score"] = round(day_score, 1)
        d["avg_loss_percent"] = round(d["avg_loss_percent"], 3)
        day_trend.append(d)

    return {
        "total_batches": total_batches,
        "time_period_days": days,
        "rejection_rate": {
            "overall_high_critical_percent": round(
                total_high_critical / max(total_batches, 1) * 100, 2
            ),
            "overall_avg_loss_percent": round(avg_loss, 3),
            "by_operator": by_operator,
        },
        "severity_distribution": severity_counts,
        "defect_categories": defect_categories[:5],
        "quality_score": {
            "overall": round(quality_score, 1),
            "label": label,
            "loss_penalty": round(loss_penalty, 1),
            "severity_penalty": round(severity_penalty, 1),
        },
        "trend": day_trend,
    }


# ── Real Anomaly Detection ───────────────────────────────────────────────────


def build_anomaly_detection(
    db: Session,
    factory_id: str,
    *,
    days: int = 30,
) -> dict[str, Any]:
    """Detect anomalies across financial, inventory, and dispatch domains.

    Returns:
        financial_anomalies: unusual invoice/payment patterns
        inventory_anomalies: unusual stock movements, negative balances, large adjustments
        dispatch_fraud: duplicate trucks, impossible timelines, weight inconsistencies
    """
    now = datetime.now(timezone.utc)
    cutoff = now - timedelta(days=days)

    financial_anomalies: list[dict[str, Any]] = []
    inventory_anomalies: list[dict[str, Any]] = []
    dispatch_fraud_alerts: list[dict[str, Any]] = []

    # ── Financial Anomalies ──────────────────────────────────────────────

    # Invoices: unusually high amounts, overdue without payment, cancelled after dispatch
    invoices = (
        db.query(SteelSalesInvoice)
        .filter(
            SteelSalesInvoice.factory_id == factory_id,
            SteelSalesInvoice.created_at >= cutoff,
        )
        .all()
    )
    if invoices:
        invoice_amounts = [float(inv.total_amount or 0.0) for inv in invoices]
        avg_invoice = sum(invoice_amounts) / max(len(invoice_amounts), 1)
        std_invoice = (
            (sum((a - avg_invoice) ** 2 for a in invoice_amounts) / max(len(invoice_amounts), 1)) ** 0.5
        )

        for inv in invoices:
            amount = float(inv.total_amount or 0.0)
            # Statistical outlier (> 2.5 std deviations)
            if std_invoice > 0 and abs(amount - avg_invoice) > 2.5 * std_invoice:
                financial_anomalies.append({
                    "type": "invoice_outlier",
                    "severity": "high",
                    "resource_id": str(inv.id),
                    "resource_label": inv.invoice_number,
                    "detail": f"Invoice amount INR {amount:,.2f} is {abs(amount - avg_invoice) / max(std_invoice, 1):.1f} std deviations above the mean of INR {avg_invoice:,.2f}.",
                    "value": round(amount, 2),
                    "mean": round(avg_invoice, 2),
                    "detected_at": now.isoformat(),
                })

            # Overdue invoice with zero payment
            if inv.due_date and date.today() > inv.due_date:
                overdue_days = (date.today() - inv.due_date).days
                if overdue_days > 15 and inv.status in ("unpaid", "partial"):
                    financial_anomalies.append({
                        "type": "overdue_invoice",
                        "severity": "warning" if overdue_days < 30 else "critical",
                        "resource_id": str(inv.id),
                        "resource_label": inv.invoice_number,
                        "detail": f"Invoice is {overdue_days} days overdue with status '{inv.status}'.",
                        "overdue_days": overdue_days,
                        "outstanding_amount": round(amount, 2),
                        "detected_at": now.isoformat(),
                    })

    # Payments: unusually large payments, frequent reversals
    payments = (
        db.query(SteelCustomerPayment)
        .filter(
            SteelCustomerPayment.factory_id == factory_id,
            SteelCustomerPayment.created_at >= cutoff,
        )
        .all()
    )
    if payments:
        payment_amounts = [float(p.amount or 0.0) for p in payments]
        avg_payment = sum(payment_amounts) / max(len(payment_amounts), 1)
        std_payment = (
            (sum((a - avg_payment) ** 2 for a in payment_amounts) / max(len(payment_amounts), 1)) ** 0.5
        )
        for pmt in payments:
            amount = float(pmt.amount or 0.0)
            if std_payment > 0 and abs(amount - avg_payment) > 3.0 * std_payment:
                financial_anomalies.append({
                    "type": "payment_outlier",
                    "severity": "warning",
                    "resource_id": str(pmt.id),
                    "resource_label": f"Payment #{pmt.id}",
                    "detail": f"Payment amount INR {amount:,.2f} is significantly above the average of INR {avg_payment:,.2f}.",
                    "value": round(amount, 2),
                    "mean": round(avg_payment, 2),
                    "detected_at": now.isoformat(),
                })

    # ── Inventory Anomalies ──────────────────────────────────────────────

    # Large adjustments (reconciliations with high variance)
    reconciliations = (
        db.query(SteelStockReconciliation)
        .filter(
            SteelStockReconciliation.factory_id == factory_id,
            SteelStockReconciliation.counted_at >= cutoff,
        )
        .all()
    )
    for rec in reconciliations:
        variance_kg = abs(float(rec.variance_kg or 0.0))
        variance_pct = abs(float(rec.variance_percent or 0.0))
        if variance_kg > 100 or variance_pct > 10:
            inventory_anomalies.append({
                "type": "large_reconciliation_variance",
                "severity": "high" if variance_kg > 500 or variance_pct > 20 else "warning",
                "resource_id": str(rec.id),
                "resource_label": f"Reconciliation #{rec.id}",
                "detail": f"Variance of {round(variance_kg, 2)} KG ({round(variance_pct, 2)}%) on item #{rec.item_id}.",
                "variance_kg": round(variance_kg, 3),
                "variance_percent": round(variance_pct, 2),
                "mismatch_cause": rec.mismatch_cause,
                "detected_at": now.isoformat(),
            })

    # Unusual transactions: large manual adjustments
    large_adjustments = (
        db.query(SteelInventoryTransaction)
        .filter(
            SteelInventoryTransaction.factory_id == factory_id,
            SteelInventoryTransaction.transaction_type == "adjustment",
            SteelInventoryTransaction.created_at >= cutoff,
            func.abs(SteelInventoryTransaction.quantity_kg) > 500,
        )
        .all()
    )
    for txn in large_adjustments:
        inventory_anomalies.append({
            "type": "large_manual_adjustment",
            "severity": "warning",
            "resource_id": str(txn.id),
            "resource_label": f"Transaction #{txn.id}",
            "detail": f"Manual adjustment of {round(float(txn.quantity_kg), 2)} KG on item #{txn.item_id}.",
            "quantity_kg": round(float(txn.quantity_kg), 3),
            "notes": txn.notes,
            "detected_at": now.isoformat(),
        })

    # Negative balances
    balances = stock_balances_for_factory(db, factory_id)
    items_with_neg_balance = (
        db.query(SteelInventoryItem)
        .filter(
            SteelInventoryItem.factory_id == factory_id,
            SteelInventoryItem.is_active.is_(True),
        )
        .all()
    )
    item_map = {it.id: it for it in items_with_neg_balance}
    for item_id, balance_kg in balances.items():
        if balance_kg < -1.0:
            item = item_map.get(item_id)
            inventory_anomalies.append({
                "type": "negative_stock_balance",
                "severity": "critical",
                "resource_id": str(item_id),
                "resource_label": item.item_code if item else f"Item #{item_id}",
                "detail": f"Stock balance is {round(balance_kg, 2)} KG (negative). Immediate investigation required.",
                "balance_kg": round(balance_kg, 3),
                "detected_at": now.isoformat(),
            })

    # ── Dispatch Fraud Detection ─────────────────────────────────────────

    dispatches = (
        db.query(SteelDispatch)
        .filter(
            SteelDispatch.factory_id == factory_id,
            SteelDispatch.created_at >= cutoff,
        )
        .order_by(SteelDispatch.dispatch_date.asc())
        .all()
    )

    # Duplicate truck detection
    truck_date_map: dict[tuple[str, date], list[int]] = defaultdict(list)
    for disp in dispatches:
        key = (disp.truck_number.upper().strip(), disp.dispatch_date)
        truck_date_map[key].append(disp.id)

    for (truck, disp_date), ids in truck_date_map.items():
        if len(ids) > 1:
            dispatch_fraud_alerts.append({
                "type": "duplicate_truck_same_day",
                "severity": "critical",
                "resource_ids": ids,
                "resource_label": f"Truck {truck} on {disp_date.isoformat()}",
                "detail": f"Truck {truck} has {len(ids)} dispatches recorded on {disp_date.isoformat()}.",
                "dispatch_count": len(ids),
                "truck_number": truck,
                "dispatch_date": disp_date.isoformat(),
                "detected_at": now.isoformat(),
            })

    # Impossible timelines: exit before entry, delivered before dispatch
    for disp in dispatches:
        entry = coerce_utc_datetime(disp.entry_time)
        exit_t = coerce_utc_datetime(disp.exit_time)
        delivered = coerce_utc_datetime(disp.delivered_at)

        if entry and exit_t and exit_t < entry:
            dispatch_fraud_alerts.append({
                "type": "impossible_timeline",
                "severity": "high",
                "resource_id": str(disp.id),
                "resource_label": f"Dispatch #{disp.dispatch_number}",
                "detail": f"Exit time ({exit_t.isoformat()}) is before entry time ({entry.isoformat()}).",
                "detected_at": now.isoformat(),
            })

        if delivered and disp.dispatch_date:
            dispatch_date = datetime.combine(disp.dispatch_date, datetime.min.time(), tzinfo=timezone.utc)
            if delivered < dispatch_date:
                dispatch_fraud_alerts.append({
                    "type": "impossible_timeline",
                    "severity": "high",
                    "resource_id": str(disp.id),
                    "resource_label": f"Dispatch #{disp.dispatch_number}",
                    "detail": f"Delivered at ({delivered.isoformat()}) is before dispatch date ({disp.dispatch_date.isoformat()}).",
                    "detected_at": now.isoformat(),
                })

        # Weight inconsistency: total_weight differs significantly from line sum
        lines = (
            db.query(SteelDispatchLine)
            .filter(SteelDispatchLine.dispatch_id == disp.id)
            .all()
        )
        line_sum = sum(float(l.weight_kg or 0.0) for l in lines)
        if lines and abs(float(disp.total_weight_kg or 0.0) - line_sum) > 1.0:
            dispatch_fraud_alerts.append({
                "type": "weight_inconsistency",
                "severity": "warning",
                "resource_id": str(disp.id),
                "resource_label": f"Dispatch #{disp.dispatch_number}",
                "detail": f"Header weight ({round(float(disp.total_weight_kg), 2)} KG) differs from line sum ({round(line_sum, 2)} KG) by {round(abs(float(disp.total_weight_kg) - line_sum), 2)} KG.",
                "header_weight_kg": round(float(disp.total_weight_kg), 3),
                "line_sum_weight_kg": round(line_sum, 3),
                "detected_at": now.isoformat(),
            })

    # Sort by severity
    severity_order = {"critical": 0, "high": 1, "warning": 2, "info": 3}
    all_anomalies = financial_anomalies + inventory_anomalies + dispatch_fraud_alerts
    all_anomalies.sort(key=lambda a: severity_order.get(a["severity"], 99))

    return {
        "anomaly_count": len(all_anomalies),
        "time_period_days": days,
        "financial_anomalies": financial_anomalies,
        "inventory_anomalies": inventory_anomalies,
        "dispatch_fraud_alerts": dispatch_fraud_alerts,
        "all_anomalies_sorted": all_anomalies[:50],
        "summary": {
            "critical_count": sum(1 for a in all_anomalies if a["severity"] == "critical"),
            "high_count": sum(1 for a in all_anomalies if a["severity"] == "high"),
            "warning_count": sum(1 for a in all_anomalies if a["severity"] == "warning"),
        },
    }


# ── Sales Intelligence ────────────────────────────────────────────────────────


def build_sales_intelligence(
    db: Session,
    factory_id: str,
    *,
    days: int = 90,
) -> dict[str, Any]:
    """Analyse sales performance: trends, customer analytics, and fulfillment funnel.

    Returns:
        sales_trends: period-over-period revenue, volume, top customers
        customer_analytics: segmentation by risk/volume, payment behaviour
        fulfillment_funnel: invoiced -> dispatched -> delivered -> paid conversion
    """
    now = datetime.now(timezone.utc)
    cutoff = now - timedelta(days=days)
    today = date.today()

    # ── 1. Invoices (core sales data) ────────────────────────────────────

    invoices = (
        db.query(SteelSalesInvoice)
        .filter(
            SteelSalesInvoice.factory_id == factory_id,
            SteelSalesInvoice.invoice_date >= (today - timedelta(days=days)),
        )
        .order_by(SteelSalesInvoice.invoice_date.asc())
        .all()
    )

    if not invoices:
        return {
            "sales_trends": {"period": {"total_revenue_inr": 0.0, "total_weight_kg": 0.0, "invoice_count": 0, "top_customers": [], "monthly_trend": []}},
            "customer_analytics": {"total_customers": 0, "by_risk_level": [], "by_volume_tier": [], "top_by_revenue": [], "top_by_outstanding": []},
            "fulfillment_funnel": {"invoiced_count": 0, "dispatched_count": 0, "delivered_count": 0, "paid_invoices": 0, "conversion_rates": {}},
        }

    customer_ids = {inv.customer_id for inv in invoices if inv.customer_id}
    customers = (
        db.query(SteelCustomer)
        .filter(SteelCustomer.factory_id == factory_id, SteelCustomer.id.in_(customer_ids))
        .all()
    ) if customer_ids else []
    customer_map = {c.id: c for c in customers}

    # Invoice-level aggregates
    total_revenue = sum(float(inv.total_amount or 0.0) for inv in invoices)
    total_weight = sum(float(inv.total_weight_kg or 0.0) for inv in invoices)
    invoice_count = len(invoices)

    # Monthly trend
    monthly_buckets: dict[str, dict[str, Any]] = {}
    customer_revenue_map: dict[int, dict[str, Any]] = defaultdict(
        lambda: {"customer_id": 0, "customer_name": "", "revenue_inr": 0.0, "weight_kg": 0.0, "invoice_count": 0, "risk_level": "low"}
    )

    for inv in invoices:
        month_key = inv.invoice_date.strftime("%Y-%m")
        if month_key not in monthly_buckets:
            monthly_buckets[month_key] = {
                "month": month_key,
                "revenue_inr": 0.0,
                "weight_kg": 0.0,
                "invoice_count": 0,
            }
        amt = float(inv.total_amount or 0.0)
        wt = float(inv.total_weight_kg or 0.0)
        monthly_buckets[month_key]["revenue_inr"] += amt
        monthly_buckets[month_key]["weight_kg"] += wt
        monthly_buckets[month_key]["invoice_count"] += 1

        # Customer rollup
        cid = inv.customer_id
        if cid:
            cr = customer_revenue_map[cid]
            cr["customer_id"] = cid
            cust = customer_map.get(cid)
            cr["customer_name"] = cust.name if cust else f"Customer #{cid}"
            cr["revenue_inr"] += amt
            cr["weight_kg"] += wt
            cr["invoice_count"] += 1
            cr["risk_level"] = cust.risk_level if cust else "low"

    monthly_trend = []
    for month_key in sorted(monthly_buckets.keys()):
        b = monthly_buckets[month_key]
        b["revenue_inr"] = round(b["revenue_inr"], 2)
        b["weight_kg"] = round(b["weight_kg"], 3)
        monthly_trend.append(b)

    # Top customers by revenue
    top_by_revenue = sorted(customer_revenue_map.values(), key=lambda x: x["revenue_inr"], reverse=True)[:10]
    for c in top_by_revenue:
        c["revenue_inr"] = round(c["revenue_inr"], 2)
        c["weight_kg"] = round(c["weight_kg"], 3)

    # ── 2. Customer Analytics ────────────────────────────────────────────

    # Risk level segmentation
    risk_counts: dict[str, int] = defaultdict(int)
    for c in customers:
        risk_counts[c.risk_level or "low"] += 1
    by_risk_level = [
        {"risk_level": level, "count": count}
        for level, count in sorted(risk_counts.items(), key=lambda x: {"critical": 0, "high": 1, "medium": 2, "low": 3}.get(x[0], 99))
    ]

    # Volume tier segmentation
    volume_tiers: dict[str, dict[str, Any]] = {
        "high": {"label": "High Volume", "min_kg": 50000, "count": 0, "total_revenue_inr": 0.0},
        "medium": {"label": "Medium Volume", "min_kg": 10000, "count": 0, "total_revenue_inr": 0.0},
        "low": {"label": "Low Volume", "min_kg": 0, "count": 0, "total_revenue_inr": 0.0},
    }
    for c in customers:
        total_sold_kg = sum(
            float(inv.total_weight_kg or 0.0)
            for inv in invoices
            if inv.customer_id == c.id
        )
        tier_revenue = sum(
            float(inv.total_amount or 0.0)
            for inv in invoices
            if inv.customer_id == c.id
        )
        if total_sold_kg >= 50000:
            tier = volume_tiers["high"]
        elif total_sold_kg >= 10000:
            tier = volume_tiers["medium"]
        else:
            tier = volume_tiers["low"]
        tier["count"] += 1
        tier["total_revenue_inr"] += tier_revenue

    by_volume_tier = [
        {
            "label": v["label"],
            "min_kg": v["min_kg"],
            "count": v["count"],
            "total_revenue_inr": round(v["total_revenue_inr"], 2),
        }
        for v in [volume_tiers["high"], volume_tiers["medium"], volume_tiers["low"]]
    ]

    # Top customers by outstanding
    outstanding_by_customer: dict[int, dict[str, Any]] = defaultdict(
        lambda: {"customer_id": 0, "customer_name": "", "outstanding_inr": 0.0, "overdue_days": 0, "risk_level": "low"}
    )
    for inv in invoices:
        cid = inv.customer_id
        if not cid:
            continue
        if inv.status in ("unpaid", "partial"):
            oc = outstanding_by_customer[cid]
            oc["customer_id"] = cid
            cust = customer_map.get(cid)
            oc["customer_name"] = cust.name if cust else f"Customer #{cid}"
            oc["outstanding_inr"] += float(inv.total_amount or 0.0) - float(inv.paid_amount_inr or 0.0) if inv.paid_amount_inr else float(inv.total_amount or 0.0)
            if inv.due_date and today > inv.due_date:
                oc["overdue_days"] = max(oc["overdue_days"], (today - inv.due_date).days)
            oc["risk_level"] = cust.risk_level if cust else "low"

    top_by_outstanding = sorted(outstanding_by_customer.values(), key=lambda x: x["outstanding_inr"], reverse=True)[:10]
    for oc in top_by_outstanding:
        oc["outstanding_inr"] = round(oc["outstanding_inr"], 2)

    # ── 3. Fulfillment Funnel ────────────────────────────────────────────

    invoice_ids = [inv.id for inv in invoices]

    # Distinct dispatch headers for these invoices
    dispatched_headers = (
        db.query(SteelDispatch.id)
        .filter(
            SteelDispatch.invoice_id.in_(invoice_ids),
            SteelDispatch.factory_id == factory_id,
        )
        .count()
    )

    # Delivered dispatches
    delivered_count = (
        db.query(SteelDispatch.id)
        .filter(
            SteelDispatch.invoice_id.in_(invoice_ids),
            SteelDispatch.factory_id == factory_id,
            SteelDispatch.status == "delivered",
        )
        .count()
    )

    # Paid invoices (status = "paid")
    paid_invoices = sum(1 for inv in invoices if inv.status == "paid")

    invoiced_count = len(invoices)

    return {
        "sales_trends": {
            "period": {
                "total_revenue_inr": round(total_revenue, 2),
                "total_weight_kg": round(total_weight, 3),
                "invoice_count": invoice_count,
                "time_period_days": days,
            },
            "top_customers": top_by_revenue,
            "monthly_trend": monthly_trend,
        },
        "customer_analytics": {
            "total_customers": len(customers),
            "by_risk_level": by_risk_level,
            "by_volume_tier": by_volume_tier,
            "top_by_revenue": top_by_revenue,
            "top_by_outstanding": top_by_outstanding,
        },
        "fulfillment_funnel": {
            "invoiced_count": invoiced_count,
            "dispatched_count": dispatched_headers,
            "delivered_count": delivered_count,
            "paid_invoices": paid_invoices,
            "conversion_rates": {
                "invoice_to_dispatch_pct": round(dispatched_headers / max(invoiced_count, 1) * 100, 1),
                "dispatch_to_delivery_pct": round(delivered_count / max(dispatched_headers, 1) * 100, 1),
                "invoice_to_paid_pct": round(paid_invoices / max(invoiced_count, 1) * 100, 1),
            },
        },
    }


# ── Owner Dashboard (Single Pane of Glass) ──────────────────────────────────


def build_owner_dashboard(
    db: Session,
    factory: Factory,
) -> dict[str, Any]:
    """Single-pane-of-glass dashboard summarising factory performance for owners.

    Combines inventory health, production quality, anomaly pressure, and financial
    metrics into one comprehensive view with actionable alerts and recommendations.
    """
    factory_id = factory.factory_id
    now = datetime.now(timezone.utc)
    today = date.today()

    # ── 1. Quick Context ─────────────────────────────────────────────────
    items = (
        db.query(SteelInventoryItem)
        .filter(SteelInventoryItem.factory_id == factory_id, SteelInventoryItem.is_active.is_(True))
        .all()
    )
    item_ids = {it.id for it in items}
    balances = stock_balances_for_factory(db, factory_id)

    total_stock_kg = sum(balances.values())
    item_count = len(items)

    # ── 2. Production Pulse ──────────────────────────────────────────────
    today_batches = (
        db.query(SteelProductionBatch)
        .filter(
            SteelProductionBatch.factory_id == factory_id,
            SteelProductionBatch.production_date == today,
        )
        .count()
    )
    week_start = today - timedelta(days=today.weekday())
    week_batches = (
        db.query(SteelProductionBatch)
        .filter(
            SteelProductionBatch.factory_id == factory_id,
            SteelProductionBatch.production_date >= week_start,
        )
        .count()
    )
    month_start = today.replace(day=1)
    month_batches = (
        db.query(SteelProductionBatch)
        .filter(
            SteelProductionBatch.factory_id == factory_id,
            SteelProductionBatch.production_date >= month_start,
        )
        .count()
    )

    # Today's output & loss
    today_batch_rows = (
        db.query(SteelProductionBatch)
        .filter(
            SteelProductionBatch.factory_id == factory_id,
            SteelProductionBatch.production_date == today,
        )
        .all()
    )
    today_output_kg = sum(float(b.actual_output_kg or 0.0) for b in today_batch_rows)
    today_loss_kg = sum(float(b.loss_kg or 0.0) for b in today_batch_rows)
    today_loss_pct = (today_loss_kg / today_output_kg * 100) if today_output_kg else 0.0

    # ── 3. Inventory Health ──────────────────────────────────────────────
    reconciliations = latest_reconciliations_for_factory(db, factory_id)
    stale_cutoff = datetime.now(timezone.utc) - timedelta(days=DEFAULT_STALE_RECONCILIATION_DAYS)

    green_count = 0
    yellow_count = 0
    red_count = 0
    low_confidence_items_list: list[dict[str, Any]] = []

    for item in items:
        rec = reconciliations.get(item.id)
        balance_kg = balances.get(item.id, 0.0)
        confident = stock_confidence_for_item(balance_kg=balance_kg, reconciliation=rec)

        if confident[0] == "green":
            green_count += 1
        elif confident[0] == "yellow":
            yellow_count += 1
        else:
            red_count += 1
            low_confidence_items_list.append({
                "item_id": item.id,
                "item_code": item.item_code,
                "name": item.name,
                "balance_kg": round(balance_kg, 3),
                "confidence_status": confident[0],
                "confidence_reason": confident[1],
            })

    # ── 4. Anomaly Pressure ──────────────────────────────────────────────
    anomalies = build_anomaly_detection(db, factory_id, days=7)
    anomaly_summary = anomalies["summary"]
    top_anomalies = anomalies["all_anomalies_sorted"][:5]

    # ── 5. Financial Pulse ───────────────────────────────────────────────
    realization = build_steel_realization_metrics(db, factory_id=factory_id)

    # Outstanding invoices
    today_obj = date.today()
    overdue_invoices = (
        db.query(SteelSalesInvoice)
        .filter(
            SteelSalesInvoice.factory_id == factory_id,
            SteelSalesInvoice.due_date < today_obj,
            SteelSalesInvoice.status.in_(["unpaid", "partial"]),
        )
        .count()
    )
    total_overdue_amount = (
        db.query(func.sum(SteelSalesInvoice.total_amount))
        .filter(
            SteelSalesInvoice.factory_id == factory_id,
            SteelSalesInvoice.due_date < today_obj,
            SteelSalesInvoice.status.in_(["unpaid", "partial"]),
        )
        .scalar() or 0.0
    )

    # ── 6. Alerts & Recommendations ──────────────────────────────────────
    alerts: list[dict[str, str]] = []

    if red_count > 0:
        alerts.append({
            "level": "critical",
            "title": "Stock confidence issues",
            "detail": f"{red_count} item(s) have red confidence status — immediate physical count recommended.",
        })
    if today_loss_pct > 5:
        alerts.append({
            "level": "critical",
            "title": "High today loss",
            "detail": f"Today's batch loss is {round(today_loss_pct, 1)}% — above the 5% threshold.",
        })
    if anomaly_summary.get("critical_count", 0) > 0:
        alerts.append({
            "level": "critical",
            "title": "Critical anomalies detected",
            "detail": f"{anomaly_summary['critical_count']} critical anomaly(ies) in the last 7 days.",
        })
    if overdue_invoices > 3:
        alerts.append({
            "level": "warning",
            "title": f"{overdue_invoices} overdue invoices",
            "detail": f"Total overdue amount INR {float(total_overdue_amount):,.2f}.",
        })
    if anomaly_summary.get("warning_count", 0) > 3:
        alerts.append({
            "level": "warning",
            "title": "Elevated warning signals",
            "detail": f"{anomaly_summary['warning_count']} warning-level anomalies in the last 7 days.",
        })
    if today_batches == 0 and today.weekday() < 5:  # weekday with no batches
        alerts.append({
            "level": "info",
            "title": "No production today",
            "detail": "Weekday with zero batches recorded. Confirm if this is expected.",
        })

    return {
        "factory": {
            "factory_id": factory.factory_id,
            "name": factory.name,
            "factory_code": factory.factory_code,
            "industry_type": factory.industry_type,
        },
        "report_date": today.isoformat(),
        "snapshot": {
            "total_stock_kg": round(total_stock_kg, 3),
            "total_items": item_count,
            "today_batches": today_batches,
            "week_batches": week_batches,
            "month_batches": month_batches,
            "today_output_kg": round(today_output_kg, 3),
            "today_loss_kg": round(today_loss_kg, 3),
            "today_loss_percent": round(today_loss_pct, 2),
        },
        "inventory_health": {
            "green_count": green_count,
            "yellow_count": yellow_count,
            "red_count": red_count,
            "low_confidence_items": low_confidence_items_list,
        },
        "financial_pulse": {
            "realized_dispatched_revenue_inr": round(float(realization.get("realized_dispatched_revenue_inr", 0)), 2),
            "realized_dispatched_profit_inr": round(float(realization.get("realized_dispatched_profit_inr", 0)), 2),
            "realized_margin_percent": round(float(realization.get("realized_margin_percent", 0)), 2),
            "outstanding_invoice_amount_inr": round(float(realization.get("outstanding_invoice_amount_inr", 0)), 2),
            "overdue_invoice_count": overdue_invoices,
            "overdue_amount_inr": round(float(total_overdue_amount), 2),
        },
        "anomaly_pressure": {
            "critical_count": anomaly_summary.get("critical_count", 0),
            "high_count": anomaly_summary.get("high_count", 0),
            "warning_count": anomaly_summary.get("warning_count", 0),
            "top_anomalies": top_anomalies,
        },
        "alerts": alerts,
    }
