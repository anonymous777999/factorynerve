"""Decision intelligence for factory owner dashboard (P0-7).

Identifies top cost problems, generates focus recommendations, and computes
period-over-period trends so the owner knows where to act first.
"""

from __future__ import annotations

from collections import defaultdict
from datetime import date, datetime, timedelta, timezone
from typing import Any

from sqlalchemy import func
from sqlalchemy.orm import Session

from backend.models.entry import Entry
from backend.models.factory import Factory
from backend.models.steel_dispatch import SteelDispatch
from backend.models.steel_inventory_item import SteelInventoryItem
from backend.models.steel_inventory_transaction import SteelInventoryTransaction
from backend.models.steel_production_batch import SteelProductionBatch
from backend.models.steel_sales_invoice import SteelSalesInvoice
from backend.models.steel_stock_reconciliation import SteelStockReconciliation
from backend.services.steel_intelligence import (
    build_anomaly_detection,
    build_owner_dashboard,
)
from backend.services.steel_service import stock_balances_for_factory


# ── Public API ──────────────────────────────────────────────────────────────


def build_decision_dashboard(
    db: Session,
    factory: Factory,
) -> dict[str, Any]:
    """Comprehensive decision dashboard with cost analysis, trends, and focus areas.

    Combines the existing owner dashboard with three new analytical layers:
      1. Top cost problems — ranked by estimated financial impact
      2. Focus recommendations — what the owner should do today
      3. Period-over-period trends — week and month comparisons
    """
    dashboard = build_owner_dashboard(db, factory)
    factory_id = factory.factory_id

    top_problems = _build_top_cost_problems(db, factory_id)
    focus = _build_focus_recommendations(db, factory_id, dashboard)
    trends = _build_period_trends(db, factory_id)
    health_score, health_label = _compute_decision_health_score(
        dashboard, top_problems, trends,
    )

    return {
        **dashboard,
        "decision_intelligence": {
            "top_cost_problems": top_problems,
            "focus_recommendations": focus,
            "period_trends": trends,
            "health_score": {
                "score": health_score,
                "label": health_label,
                "max_score": 100,
            },
            "generated_at": datetime.now(timezone.utc).isoformat(),
        },
    }


# ── Top Cost Problems ───────────────────────────────────────────────────────


def _build_top_cost_problems(
    db: Session,
    factory_id: str,
) -> list[dict[str, Any]]:
    """Identify and rank the top 5 problems costing the factory money.

    Each problem includes:
      - category: e.g. "scrap_loss", "downtime", "variance_leakage", "overdue_receivables"
      - title: human-readable name
      - estimated_loss_inr: monetary impact estimate
      - detail: context about the problem
      - recommendation: what to do about it
    """
    problems: list[dict[str, Any]] = []
    now = datetime.now(timezone.utc)
    today = date.today()
    month_start = today.replace(day=1)
    last_month_start = (month_start - timedelta(days=1)).replace(day=1)

    # ── 1. Scrap loss cost (from production batches this month) ──────────
    month_batches = (
        db.query(SteelProductionBatch)
        .filter(
            SteelProductionBatch.factory_id == factory_id,
            SteelProductionBatch.production_date >= month_start,
        )
        .all()
    )
    total_scrap_kg = sum(float(b.scrap_qty_kg or 0.0) for b in month_batches)
    total_rejection_kg = sum(float(b.rejection_qty_kg or 0.0) for b in month_batches)
    # Estimate value using output item rates
    output_item_ids = {b.output_item_id for b in month_batches if b.output_item_id}
    item_rates = {}
    if output_item_ids:
        items = (
            db.query(SteelInventoryItem)
            .filter(SteelInventoryItem.id.in_(list(output_item_ids)))
            .all()
        )
        item_rates = {it.id: float(it.current_rate_per_kg or 0.0) for it in items}
    scrap_value = sum(
        float(b.scrap_qty_kg or 0.0) * item_rates.get(b.output_item_id or 0, 0.0)
        for b in month_batches
    )
    rejection_value = sum(
        float(b.rejection_qty_kg or 0.0) * item_rates.get(b.output_item_id or 0, 0.0)
        for b in month_batches
    )
    total_scrap_cost = scrap_value + rejection_value
    if total_scrap_cost > 0:
        problems.append({
            "category": "scrap_loss",
            "title": "Scrap & Rejection Loss",
            "estimated_loss_inr": round(total_scrap_cost, 2),
            "scrap_kg": round(total_scrap_kg, 2),
            "rejection_kg": round(total_rejection_kg, 2),
            "detail": (
                f"{round(total_scrap_kg + total_rejection_kg, 1)} kg of material "
                f"valued at INR {total_scrap_cost:,.2f} was scrapped or rejected "
                f"this month."
            ),
            "recommendation": (
                "Investigate the machines and operators with highest scrap rates. "
                "Consider process adjustments or material quality checks."
            ),
        })

    # ── 2. Batch variance / leakage cost ────────────────────────────────
    total_variance_value = sum(
        float(b.variance_value_inr or 0.0) for b in month_batches
    )
    if total_variance_value > 0:
        problems.append({
            "category": "variance_leakage",
            "title": "Production Variance Loss",
            "estimated_loss_inr": round(total_variance_value, 2),
            "detail": (
                f"Batch input-output variance cost INR {total_variance_value:,.2f} "
                f"this month — material that was input but not accounted for in output."
            ),
            "recommendation": (
                "Review high-variance batches by operator. Check weighbridge "
                "calibration and material handling procedures."
            ),
        })

    # ── 3. Downtime cost (from Entry/DPR data) ──────────────────────────
    month_entries = (
        db.query(Entry)
        .filter(
            Entry.factory_id == factory_id,
            Entry.date >= month_start,
            Entry.is_active.is_(True),
        )
        .all()
    )
    total_downtime_min = sum(e.downtime_minutes for e in month_entries)
    # Estimate cost: assume each minute of downtime costs INR 50 (labour + overhead)
    downtime_cost_estimate = total_downtime_min * 50.0
    if total_downtime_min > 60:
        problems.append({
            "category": "downtime",
            "title": "Production Downtime Cost",
            "estimated_loss_inr": round(downtime_cost_estimate, 2),
            "downtime_minutes": total_downtime_min,
            "detail": (
                f"{total_downtime_min} minutes of downtime recorded this month, "
                f"estimated cost INR {downtime_cost_estimate:,.2f} "
                f"(at INR 50/min labour & overhead)."
            ),
            "recommendation": (
                "Analyze downtime reasons by shift. Address the top 3 causes "
                "with preventive maintenance or process changes."
            ),
        })

    # ── 4. Overdue receivables ──────────────────────────────────────────
    overdue_invoices = (
        db.query(SteelSalesInvoice)
        .filter(
            SteelSalesInvoice.factory_id == factory_id,
            SteelSalesInvoice.due_date < today,
            SteelSalesInvoice.status.in_(["unpaid", "partial"]),
        )
        .all()
    )
    total_overdue = sum(float(inv.total_amount or 0.0) - float(inv.paid_amount_inr or 0.0) for inv in overdue_invoices)
    if total_overdue > 0:
        max_overdue_days = max(
            ((today - inv.due_date).days) for inv in overdue_invoices
            if inv.due_date
        ) if overdue_invoices else 0
        problems.append({
            "category": "overdue_receivables",
            "title": "Overdue Receivables",
            "estimated_loss_inr": round(total_overdue, 2),
            "overdue_invoice_count": len(overdue_invoices),
            "max_overdue_days": max_overdue_days,
            "detail": (
                f"{len(overdue_invoices)} invoices totaling INR {total_overdue:,.2f} "
                f"are overdue (oldest by {max_overdue_days} days). "
                f"This ties up working capital."
            ),
            "recommendation": (
                "Prioritize collection calls on the largest overdue accounts. "
                "Consider stopping dispatch to chronically late payers."
            ),
        })

    # ── 5. Inventory dead stock cost ────────────────────────────────────
    balances = stock_balances_for_factory(db, factory_id)
    items = (
        db.query(SteelInventoryItem)
        .filter(
            SteelInventoryItem.factory_id == factory_id,
            SteelInventoryItem.is_active.is_(True),
        )
        .all()
    )
    dead_cutoff = now - timedelta(days=90)
    total_dead_value = 0.0
    dead_item_count = 0
    for item in items:
        last_txn = (
            db.query(func.max(SteelInventoryTransaction.created_at))
            .filter(
                SteelInventoryTransaction.factory_id == factory_id,
                SteelInventoryTransaction.item_id == item.id,
            )
            .scalar()
        )
        if last_txn is None or last_txn < dead_cutoff:
            bal = balances.get(item.id, 0.0)
            if bal > 0.001:
                dead_item_count += 1
                total_dead_value += bal * float(item.current_rate_per_kg or 0.0)
    if total_dead_value > 0:
        problems.append({
            "category": "dead_stock",
            "title": "Dead Stock Value",
            "estimated_loss_inr": round(total_dead_value, 2),
            "dead_item_count": dead_item_count,
            "detail": (
                f"{dead_item_count} items with no movement in 90+ days "
                f"have a combined value of INR {total_dead_value:,.2f}."
            ),
            "recommendation": (
                "Consider discounting or repurposing dead stock. "
                "Review purchasing patterns to prevent future overstock."
            ),
        })

    # Sort by estimated loss descending, take top 5
    problems.sort(key=lambda p: p["estimated_loss_inr"], reverse=True)
    return problems[:5]


# ── Focus Recommendations ────────────────────────────────────────────────────


def _build_focus_recommendations(
    db: Session,
    factory_id: str,
    dashboard: dict[str, Any],
) -> list[dict[str, Any]]:
    """Generate actionable focus recommendations for the owner.

    Each recommendation includes:
      - priority: 1 (highest) to 5 (lowest)
      - area: what domain it relates to
      - action: what to do
      - reason: why this matters
      - estimated_impact_inr: potential savings if addressed
    """
    recommendations: list[dict[str, Any]] = []
    today = date.today()
    now = datetime.now(timezone.utc)

    # Check alerts from dashboard
    alerts = dashboard.get("alerts", [])
    anomaly_pressure = dashboard.get("anomaly_pressure", {})
    financial_pulse = dashboard.get("financial_pulse", {})
    snapshot = dashboard.get("snapshot", {})

    # Critical alerts get top priority
    for alert in alerts:
        level = alert.get("level", "")
        if level == "critical":
            recommendations.append({
                "priority": 1,
                "area": "immediate",
                "action": alert.get("title", "Critical issue detected"),
                "reason": alert.get("detail", ""),
                "estimated_impact_inr": None,
            })

    # Anomaly pressure
    critical_anomalies = anomaly_pressure.get("critical_count", 0)
    high_anomalies = anomaly_pressure.get("high_count", 0)
    if critical_anomalies > 0:
        recommendations.append({
            "priority": 1,
            "area": "anomaly_investigation",
            "action": f"Investigate {critical_anomalies} critical anomaly signal(s)",
            "reason": (
                f"{critical_anomalies} critical anomalies detected in the last 7 days. "
                "These may indicate theft, fraud, or systemic issues."
            ),
            "estimated_impact_inr": None,
        })
    if high_anomalies > 0 and not any(
        r["area"] == "anomaly_investigation" for r in recommendations
    ):
        recommendations.append({
            "priority": 2,
            "area": "anomaly_review",
            "action": f"Review {high_anomalies} high-priority anomaly signal(s)",
            "reason": (
                f"{high_anomalies} high-priority anomalies need review "
                "to prevent escalation."
            ),
            "estimated_impact_inr": None,
        })

    # Production gaps
    today_loss_pct = snapshot.get("today_loss_percent", 0)
    if today_loss_pct > 5:
        recommendations.append({
            "priority": 2,
            "area": "production_quality",
            "action": "Address high production loss",
            "reason": (
                f"Today's batch loss is {today_loss_pct}% — each 1% reduction "
                "saves significant material cost."
            ),
            "estimated_impact_inr": None,
        })

    # Financial focus
    margin = financial_pulse.get("realized_margin_percent", 0)
    overdue = financial_pulse.get("overdue_amount_inr", 0)
    if margin < 10 and margin > 0:
        recommendations.append({
            "priority": 3,
            "area": "profitability",
            "action": "Improve profit margin",
            "reason": (
                f"Current realized margin is {margin}%. "
                "Review pricing, material costs, and operational efficiency."
            ),
            "estimated_impact_inr": None,
        })
    if overdue > 10000:
        recommendations.append({
            "priority": 3,
            "area": "collections",
            "action": "Follow up on overdue payments",
            "reason": f"INR {overdue:,.2f} in overdue invoices ties up working capital.",
            "estimated_impact_inr": round(overdue, 2),
        })

    # Inventory confidence issues
    inv_health = dashboard.get("inventory_health", {})
    red_count = inv_health.get("red_count", 0)
    if red_count > 0:
        recommendations.append({
            "priority": 4,
            "area": "inventory_accuracy",
            "action": f"Reconcile {red_count} red-confidence inventory item(s)",
            "reason": (
                "Red confidence indicates significant stock mismatch. "
                "This can lead to stockouts or theft going undetected."
            ),
            "estimated_impact_inr": None,
        })

    # Weekday with no production
    today_batches = snapshot.get("today_batches", 0)
    if today_batches == 0 and today.weekday() < 5:
        recommendations.append({
            "priority": 5,
            "area": "production_monitoring",
            "action": "Confirm production status for today",
            "reason": "No batches recorded on a weekday. Verify if this is expected.",
            "estimated_impact_inr": None,
        })

    # Deduplicate by action title
    seen_titles: set[str] = set()
    unique_recommendations: list[dict[str, Any]] = []
    for rec in recommendations:
        title = rec["action"]
        if title not in seen_titles:
            seen_titles.add(title)
            unique_recommendations.append(rec)

    # Sort by priority
    unique_recommendations.sort(key=lambda r: r["priority"])
    return unique_recommendations[:10]


# ── Period Trends ────────────────────────────────────────────────────────────


def _build_period_trends(
    db: Session,
    factory_id: str,
) -> dict[str, Any]:
    """Compare KPIs between current and previous periods.

    Returns:
        week_over_week: comparison of this week vs last week
        month_over_month: comparison of this month vs last month
        key_metrics: absolute values for each period
    """
    today = date.today()
    now = datetime.now(timezone.utc)

    # ── Date ranges ─────────────────────────────────────────────────────
    # Current week (Mon-today), Previous week
    week_start = today - timedelta(days=today.weekday())
    prev_week_start = week_start - timedelta(days=7)
    prev_week_end = week_start - timedelta(days=1)

    # Current month, Previous month
    month_start = today.replace(day=1)
    prev_month_start = (month_start - timedelta(days=1)).replace(day=1)
    prev_month_end = month_start - timedelta(days=1)

    def _week_data(start: date, end: date) -> dict[str, float]:
        return _aggregate_period(db, factory_id, start, end)

    def _month_data(start: date, end: date) -> dict[str, float]:
        return _aggregate_period(db, factory_id, start, end)

    current_week = _week_data(week_start, today)
    prev_week = _week_data(prev_week_start, prev_week_end)
    current_month = _month_data(month_start, today)
    prev_month = _month_data(prev_month_start, prev_month_end)

    def _pct_change(current: float, previous: float) -> float | None:
        if previous == 0:
            return None if current == 0 else 100.0
        return round((current - previous) / previous * 100, 1)

    def _build_comparison(
        current: dict[str, float],
        previous: dict[str, float],
    ) -> dict[str, Any]:
        return {
            "production_batches": {
                "current": int(current.get("batch_count", 0)),
                "previous": int(previous.get("batch_count", 0)),
                "change_pct": _pct_change(
                    current.get("batch_count", 0), previous.get("batch_count", 0)
                ),
            },
            "output_kg": {
                "current": round(current.get("output_kg", 0), 2),
                "previous": round(previous.get("output_kg", 0), 2),
                "change_pct": _pct_change(
                    current.get("output_kg", 0), previous.get("output_kg", 0)
                ),
            },
            "loss_kg": {
                "current": round(current.get("loss_kg", 0), 2),
                "previous": round(previous.get("loss_kg", 0), 2),
                "change_pct": _pct_change(
                    current.get("loss_kg", 0), previous.get("loss_kg", 0)
                ),
            },
            "revenue_inr": {
                "current": round(current.get("revenue_inr", 0), 2),
                "previous": round(previous.get("revenue_inr", 0), 2),
                "change_pct": _pct_change(
                    current.get("revenue_inr", 0), previous.get("revenue_inr", 0)
                ),
            },
            "overdue_inr": {
                "current": round(current.get("overdue_inr", 0), 2),
                "previous": round(previous.get("overdue_inr", 0), 2),
                "change_pct": _pct_change(
                    current.get("overdue_inr", 0), previous.get("overdue_inr", 0)
                ),
            },
            "downtime_minutes": {
                "current": int(current.get("downtime_minutes", 0)),
                "previous": int(previous.get("downtime_minutes", 0)),
                "change_pct": _pct_change(
                    current.get("downtime_minutes", 0),
                    previous.get("downtime_minutes", 0),
                ),
            },
        }

    return {
        "week_over_week": _build_comparison(current_week, prev_week),
        "month_over_month": _build_comparison(current_month, prev_month),
        "current_week_range": {
            "start": week_start.isoformat(),
            "end": today.isoformat(),
        },
        "previous_week_range": {
            "start": prev_week_start.isoformat(),
            "end": prev_week_end.isoformat(),
        },
        "current_month_range": {
            "start": month_start.isoformat(),
            "end": today.isoformat(),
        },
        "previous_month_range": {
            "start": prev_month_start.isoformat(),
            "end": prev_month_end.isoformat(),
        },
    }


def _aggregate_period(
    db: Session,
    factory_id: str,
    start: date,
    end: date,
) -> dict[str, float]:
    """Aggregate KPIs for a date range."""
    if start > end:
        return {
            "batch_count": 0.0, "output_kg": 0.0, "loss_kg": 0.0,
            "revenue_inr": 0.0, "overdue_inr": 0.0, "downtime_minutes": 0.0,
        }

    # Batches
    batches = (
        db.query(SteelProductionBatch)
        .filter(
            SteelProductionBatch.factory_id == factory_id,
            SteelProductionBatch.production_date >= start,
            SteelProductionBatch.production_date <= end,
        )
        .all()
    )
    batch_count = float(len(batches))
    output_kg = sum(float(b.actual_output_kg or 0.0) for b in batches)
    loss_kg = sum(float(b.loss_kg or 0.0) for b in batches)

    # Invoices
    invoices = (
        db.query(SteelSalesInvoice)
        .filter(
            SteelSalesInvoice.factory_id == factory_id,
            SteelSalesInvoice.invoice_date >= start,
            SteelSalesInvoice.invoice_date <= end,
        )
        .all()
    )
    revenue_inr = sum(float(inv.total_amount or 0.0) for inv in invoices)

    # Overdue at the END of the period
    overdue_invoices = (
        db.query(SteelSalesInvoice)
        .filter(
            SteelSalesInvoice.factory_id == factory_id,
            SteelSalesInvoice.due_date < end,  # overdue as of end of period
            SteelSalesInvoice.status.in_(["unpaid", "partial"]),
        )
        .all()
    )
    overdue_inr = sum(
        float(inv.total_amount or 0.0) - float(inv.paid_amount_inr or 0.0)
        for inv in overdue_invoices
    )

    # Downtime from Entry records
    entries = (
        db.query(Entry)
        .filter(
            Entry.factory_id == factory_id,
            Entry.date >= start,
            Entry.date <= end,
            Entry.is_active.is_(True),
        )
        .all()
    )
    downtime_minutes = float(sum(e.downtime_minutes for e in entries))

    return {
        "batch_count": batch_count,
        "output_kg": output_kg,
        "loss_kg": loss_kg,
        "revenue_inr": revenue_inr,
        "overdue_inr": max(overdue_inr, 0.0),
        "downtime_minutes": downtime_minutes,
    }


# ── Health Score ────────────────────────────────────────────────────────────


def _compute_decision_health_score(
    dashboard: dict[str, Any],
    top_problems: list[dict[str, Any]],
    trends: dict[str, Any],
) -> tuple[int, str]:
    """Compute a composite health score (0-100) with label.

    Factors:
      - Problem burden (-5 per active problem, capped at -25)
      - Trend direction (improving/declining metrics)
      - Existing anomaly pressure
      - Financial margin
    """
    # Start at 75 (healthy baseline, not perfect — there's always room)
    score = 75

    # Deduct for each cost problem
    problem_deduction = min(len(top_problems) * 5, 25)
    score -= problem_deduction

    # Deduct for critical anomalies
    anomaly_pressure = dashboard.get("anomaly_pressure", {})
    critical = anomaly_pressure.get("critical_count", 0)
    high = anomaly_pressure.get("high_count", 0)
    score -= min(critical * 8, 24)
    score -= min(high * 3, 15)

    # Adjust for trends
    wow = trends.get("week_over_week", {})
    output_change = (wow.get("output_kg") or {}).get("change_pct")
    loss_change = (wow.get("loss_kg") or {}).get("change_pct")
    if output_change is not None and output_change > 0:
        score += min(int(output_change / 2), 10)
    if loss_change is not None and loss_change < 0:
        score += 5  # loss decreasing = good

    # Financial margin bonus
    fin = dashboard.get("financial_pulse", {})
    margin = fin.get("realized_margin_percent", 0) or 0
    if margin > 15:
        score += 5
    elif margin < 5 and margin > 0:
        score -= 5

    # Clamp and label
    score = max(0, min(100, score))
    if score >= 80:
        label = "good"
    elif score >= 60:
        label = "needs_attention"
    elif score >= 40:
        label = "at_risk"
    else:
        label = "critical"

    return score, label
