"""Helpers for steel inventory trust, batch variance, and owner overview."""

from __future__ import annotations

from collections import defaultdict
from datetime import date, datetime, timedelta, timezone
import re

from sqlalchemy.orm import Session

from backend.models.factory import Factory
from backend.models.steel_dispatch import SteelDispatch
from backend.models.steel_dispatch_line import SteelDispatchLine
from backend.models.steel_inventory_item import SteelInventoryItem
from backend.models.steel_inventory_transaction import SteelInventoryTransaction
from backend.models.steel_production_batch import SteelProductionBatch
from backend.models.steel_sales_invoice import SteelSalesInvoice
from backend.models.steel_sales_invoice_line import SteelSalesInvoiceLine
from backend.models.steel_stock_reconciliation import SteelStockReconciliation
from backend.models.user import User
from backend.tenancy import resolve_factory_id, resolve_org_id


STEEL_CATEGORIES = {"raw_material", "wip", "finished_goods"}
STEEL_DISPLAY_UNITS = {"kg", "ton"}
STEEL_TRANSACTION_TYPES = {"inward", "adjustment", "dispatch_out", "production_issue", "production_output"}
STEEL_BATCH_SEVERITIES = ("normal", "watch", "high", "critical")


def coerce_utc_datetime(value: datetime | None) -> datetime | None:
    if value is None:
        return None
    if value.tzinfo is None or value.tzinfo.utcoffset(value) is None:
        return value.replace(tzinfo=timezone.utc)
    return value.astimezone(timezone.utc)


def require_active_steel_factory(db: Session, user: User) -> Factory:
    factory_id = resolve_factory_id(db, user)
    if not factory_id:
        raise ValueError("No active factory selected.")
    factory = (
        db.query(Factory)
        .filter(Factory.factory_id == factory_id, Factory.org_id == resolve_org_id(user), Factory.is_active.is_(True))
        .first()
    )
    if not factory:
        raise ValueError("Active factory not found.")
    if (factory.industry_type or "").strip().lower() != "steel":
        raise ValueError("Switch to a steel factory to use the steel operations module.")
    return factory


def normalize_steel_category(value: str | None) -> str:
    key = str(value or "").strip().lower()
    if key not in STEEL_CATEGORIES:
        raise ValueError("Category must be raw_material, wip, or finished_goods.")
    return key


def normalize_display_unit(value: str | None) -> str:
    key = str(value or "kg").strip().lower()
    if key not in STEEL_DISPLAY_UNITS:
        raise ValueError("Display unit must be kg or ton.")
    return key


def normalize_transaction_type(value: str | None) -> str:
    key = str(value or "").strip().lower()
    if key not in STEEL_TRANSACTION_TYPES:
        raise ValueError("Invalid steel inventory transaction type.")
    return key


def stock_balances_for_factory(db: Session, factory_id: str) -> dict[int, float]:
    balances: dict[int, float] = defaultdict(float)
    rows = (
        db.query(SteelInventoryTransaction.item_id, SteelInventoryTransaction.quantity_kg)
        .filter(SteelInventoryTransaction.factory_id == factory_id)
        .all()
    )
    for item_id, quantity_kg in rows:
        balances[int(item_id)] += float(quantity_kg or 0.0)
    return dict(balances)


def latest_reconciliations_for_factory(db: Session, factory_id: str) -> dict[int, SteelStockReconciliation]:
    rows = (
        db.query(SteelStockReconciliation)
        .filter(
            SteelStockReconciliation.factory_id == factory_id,
            SteelStockReconciliation.status == "approved",
        )
        .order_by(SteelStockReconciliation.item_id.asc(), SteelStockReconciliation.counted_at.desc())
        .all()
    )
    latest: dict[int, SteelStockReconciliation] = {}
    for row in rows:
        latest.setdefault(int(row.item_id), row)
    return latest


def stock_reconciliation_summary_for_factory(
    db: Session,
    factory_id: str,
    *,
    stale_days: int = 14,
    mismatch_tolerance_kg: float = 0.001,
) -> dict[str, object]:
    active_item_ids = {
        int(row[0])
        for row in db.query(SteelInventoryItem.id)
        .filter(SteelInventoryItem.factory_id == factory_id, SteelInventoryItem.is_active.is_(True))
        .all()
    }
    latest_approved = latest_reconciliations_for_factory(db, factory_id)
    cutoff = stale_reconciliation_cutoff(days=stale_days)

    reviewed_items = 0
    matched_items = 0
    mismatch_items = 0
    stale_reviews = 0

    for item_id in active_item_ids:
        row = latest_approved.get(item_id)
        if row is None:
            stale_reviews += 1
            continue

        reviewed_items += 1
        variance_kg = abs(float(row.variance_kg or 0.0))
        if variance_kg <= mismatch_tolerance_kg:
            matched_items += 1
        else:
            mismatch_items += 1

        counted_at = coerce_utc_datetime(row.counted_at)
        if counted_at is None or counted_at < cutoff:
            stale_reviews += 1

    pending_reviews = (
        db.query(SteelStockReconciliation)
        .filter(
            SteelStockReconciliation.factory_id == factory_id,
            SteelStockReconciliation.status == "pending",
        )
        .count()
    )

    latest_any_row = (
        db.query(SteelStockReconciliation.counted_at)
        .filter(SteelStockReconciliation.factory_id == factory_id)
        .order_by(SteelStockReconciliation.counted_at.desc(), SteelStockReconciliation.id.desc())
        .first()
    )
    latest_any_review = coerce_utc_datetime(latest_any_row[0]) if latest_any_row and latest_any_row[0] else None

    accuracy_percent = round((matched_items / reviewed_items) * 100.0, 2) if reviewed_items else 0.0

    return {
        "active_items": len(active_item_ids),
        "reviewed_items": reviewed_items,
        "matched_items": matched_items,
        "mismatch_items": mismatch_items,
        "pending_reviews": int(pending_reviews or 0),
        "stale_reviews": stale_reviews,
        "stale_sla_days": stale_days,
        "accuracy_percent": accuracy_percent,
        "last_review_at": latest_any_review.isoformat() if latest_any_review else None,
    }


def stock_confidence_for_item(
    *,
    balance_kg: float,
    reconciliation: SteelStockReconciliation | None,
) -> tuple[str, str]:
    if balance_kg < -0.001:
        return ("red", "Ledger balance is negative and must be investigated immediately.")
    if reconciliation is None:
        return ("yellow", "Awaiting first physical reconciliation.")

    counted_at = coerce_utc_datetime(reconciliation.counted_at) or datetime.now(timezone.utc)
    age_days = max(0, (datetime.now(timezone.utc) - counted_at).days)
    variance_percent = abs(float(reconciliation.variance_percent or 0.0))

    if variance_percent <= 1.0 and age_days <= 7:
        return ("green", "Recent physical count matches the live ledger.")
    if variance_percent <= 3.0 and age_days <= 14:
        return ("yellow", "Small variance detected. Reconcile again soon.")
    return ("red", "Stock mismatch is above tolerance or reconciliation is stale.")


def severity_from_variance(variance_percent: float) -> str:
    if variance_percent <= 1.0:
        return "normal"
    if variance_percent <= 3.0:
        return "watch"
    if variance_percent <= 5.0:
        return "high"
    return "critical"


def normalized_steel_factory_code(factory: Factory) -> str:
    raw = str(factory.factory_code or factory.name or "STEEL").upper()
    compact = re.sub(r"[^A-Z0-9]+", "", raw)
    return compact[:8] or "STEEL"


def generate_batch_code(db: Session, factory: Factory, when: datetime | None = None) -> str:
    current = when or datetime.now(timezone.utc)
    prefix = f"ST-{normalized_steel_factory_code(factory)}-{current.year}-"
    existing = (
        db.query(SteelProductionBatch.batch_code)
        .filter(
            SteelProductionBatch.batch_code.like(f"{prefix}%"),
        )
        .order_by(SteelProductionBatch.id.desc())
        .first()
    )
    sequence = 1
    if existing and existing[0]:
        tail = str(existing[0]).split("-")[-1]
        if tail.isdigit():
            sequence = int(tail) + 1
    return f"{prefix}{sequence:03d}"


def generate_invoice_number(db: Session, factory: Factory, when: datetime | None = None) -> str:
    current = when or datetime.now(timezone.utc)
    prefix = f"SINV-{normalized_steel_factory_code(factory)}-{current.year}-"
    from backend.models.steel_sales_invoice import SteelSalesInvoice

    existing = (
        db.query(SteelSalesInvoice.invoice_number)
        .filter(SteelSalesInvoice.invoice_number.like(f"{prefix}%"))
        .order_by(SteelSalesInvoice.id.desc())
        .first()
    )
    sequence = 1
    if existing and existing[0]:
        tail = str(existing[0]).split("-")[-1]
        if tail.isdigit():
            sequence = int(tail) + 1
    return f"{prefix}{sequence:03d}"


def generate_dispatch_number(db: Session, factory: Factory, when: datetime | None = None) -> str:
    current = when or datetime.now(timezone.utc)
    prefix = f"SDISP-{normalized_steel_factory_code(factory)}-{current.year}-"
    from backend.models.steel_dispatch import SteelDispatch

    existing = (
        db.query(SteelDispatch.dispatch_number)
        .filter(SteelDispatch.dispatch_number.like(f"{prefix}%"))
        .order_by(SteelDispatch.id.desc())
        .first()
    )
    sequence = 1
    if existing and existing[0]:
        tail = str(existing[0]).split("-")[-1]
        if tail.isdigit():
            sequence = int(tail) + 1
    return f"{prefix}{sequence:03d}"


def generate_gate_pass_number(db: Session, factory: Factory, when: datetime | None = None) -> str:
    current = when or datetime.now(timezone.utc)
    prefix = f"GP-{normalized_steel_factory_code(factory)}-{current.year}-"
    from backend.models.steel_dispatch import SteelDispatch

    existing = (
        db.query(SteelDispatch.gate_pass_number)
        .filter(SteelDispatch.gate_pass_number.like(f"{prefix}%"))
        .order_by(SteelDispatch.id.desc())
        .first()
    )
    sequence = 1
    if existing and existing[0]:
        tail = str(existing[0]).split("-")[-1]
        if tail.isdigit():
            sequence = int(tail) + 1
    return f"{prefix}{sequence:03d}"


def serialize_stock_row(
    item: SteelInventoryItem,
    *,
    balance_kg: float,
    reconciliation: SteelStockReconciliation | None,
) -> dict[str, object]:
    confidence_status, confidence_reason = stock_confidence_for_item(
        balance_kg=balance_kg,
        reconciliation=reconciliation,
    )
    counted_at = coerce_utc_datetime(reconciliation.counted_at) if reconciliation else None
    return {
        "item_id": item.id,
        "item_code": item.item_code,
        "name": item.name,
        "category": item.category,
        "base_unit": item.base_unit,
        "display_unit": item.display_unit,
        "current_rate_per_kg": item.current_rate_per_kg,
        "stock_balance_kg": round(float(balance_kg or 0.0), 3),
        "stock_balance_ton": round(float(balance_kg or 0.0) / 1000.0, 3),
        "confidence_status": confidence_status,
        "confidence_reason": confidence_reason,
        "last_reconciliation_at": counted_at.isoformat() if counted_at else None,
        "last_variance_kg": round(float(reconciliation.variance_kg or 0.0), 3) if reconciliation else None,
        "last_variance_percent": round(float(reconciliation.variance_percent or 0.0), 3) if reconciliation else None,
    }


def serialize_batch(batch: SteelProductionBatch, *, input_item: SteelInventoryItem | None, output_item: SteelInventoryItem | None, operator: User | None) -> dict[str, object]:
    created_at = coerce_utc_datetime(batch.created_at) or datetime.now(timezone.utc)
    input_rate_per_kg = float(input_item.current_rate_per_kg or 0.0) if input_item else 0.0
    output_rate_per_kg = float(output_item.current_rate_per_kg or 0.0) if output_item else 0.0
    input_quantity_kg = float(batch.input_quantity_kg or 0.0)
    actual_output_kg = float(batch.actual_output_kg or 0.0)
    estimated_input_cost_inr = input_quantity_kg * input_rate_per_kg
    estimated_output_value_inr = actual_output_kg * output_rate_per_kg
    estimated_gross_profit_inr = estimated_output_value_inr - estimated_input_cost_inr
    profit_per_kg_inr = estimated_gross_profit_inr / actual_output_kg if actual_output_kg else 0.0
    variance_percent = float(batch.variance_percent or 0.0)
    variance_kg = float(batch.variance_kg or 0.0)
    variance_value_inr = float(batch.variance_value_inr or 0.0)
    loss_percent = float(batch.loss_percent or 0.0)
    severity = str(batch.severity or "normal")
    severity_weight = {
        "normal": 0.25,
        "watch": 1.0,
        "high": 2.0,
        "critical": 3.5,
    }.get(severity, 0.25)
    anomaly_score = (
        severity_weight * 1000.0
        + (variance_percent * 24.0)
        + (loss_percent * 6.0)
        + (variance_kg * 0.2)
        + (variance_value_inr * 0.01)
    )
    return {
        "id": batch.id,
        "batch_code": batch.batch_code,
        "production_date": batch.production_date.isoformat(),
        "input_item_id": batch.input_item_id,
        "input_item_name": input_item.name if input_item else None,
        "output_item_id": batch.output_item_id,
        "output_item_name": output_item.name if output_item else None,
        "operator_user_id": batch.operator_user_id,
        "operator_name": operator.name if operator else None,
        "input_quantity_kg": round(input_quantity_kg, 3),
        "expected_output_kg": round(float(batch.expected_output_kg or 0.0), 3),
        "actual_output_kg": round(actual_output_kg, 3),
        "loss_kg": round(float(batch.loss_kg or 0.0), 3),
        "loss_percent": round(loss_percent, 3),
        "variance_kg": round(variance_kg, 3),
        "variance_percent": round(variance_percent, 3),
        "variance_value_inr": round(variance_value_inr, 2),
        "severity": severity,
        "input_rate_per_kg": round(input_rate_per_kg, 2),
        "output_rate_per_kg": round(output_rate_per_kg, 2),
        "estimated_input_cost_inr": round(estimated_input_cost_inr, 2),
        "estimated_output_value_inr": round(estimated_output_value_inr, 2),
        "estimated_gross_profit_inr": round(estimated_gross_profit_inr, 2),
        "profit_per_kg_inr": round(profit_per_kg_inr, 2),
        "anomaly_score": round(anomaly_score, 2),
        "variance_reason": variance_reason(severity, variance_percent),
        "status": batch.status,
        "notes": batch.notes,
        "created_at": created_at.isoformat(),
    }


def variance_reason(severity: str, variance_percent: float) -> str:
    if severity == "normal":
        return "Actual output is within the normal loss band for this batch."
    if severity == "watch":
        return f"Variance is elevated at {round(float(variance_percent or 0.0), 2)}% and should be reviewed."
    if severity == "high":
        return f"Variance is high at {round(float(variance_percent or 0.0), 2)}%. Investigate material loss or process drift."
    return f"Variance is critical at {round(float(variance_percent or 0.0), 2)}%. Escalate immediately for leakage or batch-control review."


def build_steel_realization_metrics(
    db: Session,
    *,
    factory_id: str,
    target_date: date | None = None,
) -> dict[str, float | int]:
    batch_rows = (
        db.query(SteelProductionBatch)
        .filter(SteelProductionBatch.factory_id == factory_id)
        .all()
    )
    if batch_rows:
        item_ids = {batch.input_item_id for batch in batch_rows} | {batch.output_item_id for batch in batch_rows}
        item_map = {
            item.id: item
            for item in db.query(SteelInventoryItem)
            .filter(SteelInventoryItem.factory_id == factory_id, SteelInventoryItem.id.in_(item_ids))
            .all()
        }
    else:
        item_map = {}

    batch_cost_per_output_kg: dict[int, float] = {}
    output_item_cost_rollup: dict[int, dict[str, float]] = defaultdict(lambda: {"input_cost": 0.0, "output_kg": 0.0})
    for batch in batch_rows:
        input_item = item_map.get(batch.input_item_id)
        input_rate = float(input_item.current_rate_per_kg or 0.0) if input_item else 0.0
        input_cost = float(batch.input_quantity_kg or 0.0) * input_rate
        actual_output_kg = float(batch.actual_output_kg or 0.0)
        if actual_output_kg <= 0:
            continue
        batch_cost_per_output_kg[int(batch.id)] = input_cost / actual_output_kg
        rollup = output_item_cost_rollup[int(batch.output_item_id)]
        rollup["input_cost"] += input_cost
        rollup["output_kg"] += actual_output_kg

    output_item_average_cost_per_kg = {
        item_id: (row["input_cost"] / row["output_kg"]) if row["output_kg"] else 0.0
        for item_id, row in output_item_cost_rollup.items()
    }

    invoices_query = db.query(SteelSalesInvoice).filter(SteelSalesInvoice.factory_id == factory_id)
    if target_date is not None:
        invoices_query = invoices_query.filter(SteelSalesInvoice.invoice_date == target_date)
    invoice_rows = invoices_query.all()
    invoice_ids = [int(row.id) for row in invoice_rows]
    invoice_lines = (
        db.query(SteelSalesInvoiceLine)
        .filter(SteelSalesInvoiceLine.invoice_id.in_(invoice_ids))
        .all()
        if invoice_ids
        else []
    )
    invoice_line_map = {int(row.id): row for row in invoice_lines}

    dispatch_query = (
        db.query(SteelDispatchLine, SteelDispatch)
        .join(SteelDispatch, SteelDispatch.id == SteelDispatchLine.dispatch_id)
        .filter(SteelDispatch.factory_id == factory_id)
    )
    if target_date is not None:
        dispatch_query = dispatch_query.filter(SteelDispatch.dispatch_date == target_date)
    dispatch_rows = dispatch_query.all()

    realized_dispatched_revenue_inr = 0.0
    realized_dispatched_cost_inr = 0.0
    realized_dispatch_weight_kg = 0.0
    dispatch_ids: set[int] = set()
    for dispatch_line, dispatch in dispatch_rows:
        dispatch_ids.add(int(dispatch.id))
        invoice_line = invoice_line_map.get(int(dispatch_line.invoice_line_id))
        weight_kg = float(dispatch_line.weight_kg or 0.0)
        rate_per_kg = float(invoice_line.rate_per_kg or 0.0) if invoice_line else 0.0
        realized_dispatched_revenue_inr += weight_kg * rate_per_kg
        realized_dispatch_weight_kg += weight_kg

        batch_id = int(dispatch_line.batch_id) if dispatch_line.batch_id else (int(invoice_line.batch_id) if invoice_line and invoice_line.batch_id else None)
        output_item_id = int(dispatch_line.item_id)
        unit_cost_per_kg = (
            batch_cost_per_output_kg.get(batch_id)
            if batch_id is not None
            else output_item_average_cost_per_kg.get(output_item_id, 0.0)
        )
        if unit_cost_per_kg is None:
            unit_cost_per_kg = output_item_average_cost_per_kg.get(output_item_id, 0.0)
        realized_dispatched_cost_inr += weight_kg * float(unit_cost_per_kg or 0.0)

    realized_invoiced_amount_inr = sum(float(row.total_amount or 0.0) for row in invoice_rows)
    realized_invoiced_weight_kg = sum(float(row.total_weight_kg or 0.0) for row in invoice_rows)
    realized_dispatched_profit_inr = realized_dispatched_revenue_inr - realized_dispatched_cost_inr
    realized_margin_percent = (
        (realized_dispatched_profit_inr / realized_dispatched_revenue_inr) * 100.0
        if realized_dispatched_revenue_inr
        else 0.0
    )
    outstanding_invoice_amount_inr = max(0.0, realized_invoiced_amount_inr - realized_dispatched_revenue_inr)
    outstanding_invoice_weight_kg = max(0.0, realized_invoiced_weight_kg - realized_dispatch_weight_kg)

    return {
        "invoice_count": len(invoice_rows),
        "dispatch_count": len(dispatch_ids),
        "realized_invoiced_amount_inr": round(realized_invoiced_amount_inr, 2),
        "realized_invoiced_weight_kg": round(realized_invoiced_weight_kg, 3),
        "realized_dispatched_revenue_inr": round(realized_dispatched_revenue_inr, 2),
        "realized_dispatched_cost_inr": round(realized_dispatched_cost_inr, 2),
        "realized_dispatched_profit_inr": round(realized_dispatched_profit_inr, 2),
        "realized_dispatch_weight_kg": round(realized_dispatch_weight_kg, 3),
        "realized_margin_percent": round(realized_margin_percent, 3),
        "outstanding_invoice_amount_inr": round(outstanding_invoice_amount_inr, 2),
        "outstanding_invoice_weight_kg": round(outstanding_invoice_weight_kg, 3),
    }


def build_steel_overview(db: Session, factory: Factory) -> dict[str, object]:
    items = (
        db.query(SteelInventoryItem)
        .filter(SteelInventoryItem.factory_id == factory.factory_id, SteelInventoryItem.is_active.is_(True))
        .order_by(SteelInventoryItem.category.asc(), SteelInventoryItem.name.asc())
        .all()
    )
    balances = stock_balances_for_factory(db, factory.factory_id)
    reconciliations = latest_reconciliations_for_factory(db, factory.factory_id)
    stock_rows = [
        serialize_stock_row(
            item,
            balance_kg=balances.get(item.id, 0.0),
            reconciliation=reconciliations.get(item.id),
        )
        for item in items
    ]

    category_totals = {"raw_material_kg": 0.0, "wip_kg": 0.0, "finished_goods_kg": 0.0}
    confidence_counts = {"green": 0, "yellow": 0, "red": 0}
    for row in stock_rows:
        category_key = f"{row['category']}_kg"
        if category_key in category_totals:
            category_totals[category_key] += float(row["stock_balance_kg"])
        confidence_counts[str(row["confidence_status"])] += 1

    batches = (
        db.query(SteelProductionBatch)
        .filter(SteelProductionBatch.factory_id == factory.factory_id)
        .order_by(SteelProductionBatch.production_date.desc(), SteelProductionBatch.created_at.desc())
        .limit(50)
        .all()
    )
    item_map = {item.id: item for item in items}
    operator_ids = {batch.operator_user_id for batch in batches if batch.operator_user_id}
    operator_map = {
        row.id: row
        for row in db.query(User).filter(User.id.in_(operator_ids)).all()
    } if operator_ids else {}

    serialized_batches = [
        serialize_batch(
            batch,
            input_item=item_map.get(batch.input_item_id),
            output_item=item_map.get(batch.output_item_id),
            operator=operator_map.get(batch.operator_user_id),
        )
        for batch in batches
    ]

    operator_rollup: dict[int, dict[str, object]] = {}
    day_rollup: dict[str, dict[str, object]] = {}
    batch_rollup: list[dict[str, object]] = []
    anomaly_counts = {"watch": 0, "high": 0, "critical": 0}
    total_estimated_input_cost_inr = 0.0
    total_estimated_output_value_inr = 0.0
    total_estimated_gross_profit_inr = 0.0
    total_variance_kg = 0.0
    total_variance_value_inr = 0.0
    ranked_anomaly_candidates: list[dict[str, object]] = []
    for batch in serialized_batches:
        severity = str(batch["severity"])
        loss_percent = float(batch["loss_percent"])
        variance_kg = float(batch["variance_kg"])
        variance_value_inr = float(batch["variance_value_inr"])
        estimated_gross_profit_inr = float(batch["estimated_gross_profit_inr"])
        anomaly_score = float(batch["anomaly_score"])

        total_estimated_input_cost_inr += float(batch["estimated_input_cost_inr"])
        total_estimated_output_value_inr += float(batch["estimated_output_value_inr"])
        total_estimated_gross_profit_inr += estimated_gross_profit_inr
        total_variance_kg += variance_kg
        total_variance_value_inr += variance_value_inr

        if severity in anomaly_counts:
            anomaly_counts[severity] += 1
            ranked_anomaly_candidates.append(
                {
                    "batch": batch,
                    "anomaly_score": anomaly_score,
                    "reason": batch["variance_reason"],
                    "estimated_leakage_value_inr": round(variance_value_inr, 2),
                }
            )

        operator_id = int(batch["operator_user_id"]) if batch.get("operator_user_id") else None
        if operator_id:
            current = operator_rollup.setdefault(
                operator_id,
                {
                    "user_id": operator_id,
                    "name": batch.get("operator_name") or f"User {operator_id}",
                    "batch_count": 0,
                    "high_risk_batches": 0,
                    "critical_batches": 0,
                    "total_variance_kg": 0.0,
                    "total_variance_value_inr": 0.0,
                    "total_estimated_gross_profit_inr": 0.0,
                    "total_loss_percent": 0.0,
                    "highest_anomaly_score": 0.0,
                },
            )
            current["batch_count"] = int(current["batch_count"]) + 1
            current["high_risk_batches"] = int(current["high_risk_batches"]) + (1 if severity in {"high", "critical"} else 0)
            current["critical_batches"] = int(current["critical_batches"]) + (1 if severity == "critical" else 0)
            current["total_variance_kg"] = float(current["total_variance_kg"]) + variance_kg
            current["total_variance_value_inr"] = float(current["total_variance_value_inr"]) + variance_value_inr
            current["total_estimated_gross_profit_inr"] = (
                float(current["total_estimated_gross_profit_inr"]) + estimated_gross_profit_inr
            )
            current["total_loss_percent"] = float(current["total_loss_percent"]) + loss_percent
            current["highest_anomaly_score"] = max(float(current["highest_anomaly_score"]), anomaly_score)

        day = str(batch["production_date"])
        daily = day_rollup.setdefault(
            day,
            {
                "date": day,
                "batch_count": 0,
                "high_risk_batches": 0,
                "total_variance_kg": 0.0,
                "total_variance_value_inr": 0.0,
                "total_estimated_gross_profit_inr": 0.0,
                "total_loss_percent": 0.0,
            },
        )
        daily["batch_count"] = int(daily["batch_count"]) + 1
        daily["high_risk_batches"] = int(daily["high_risk_batches"]) + (1 if severity in {"high", "critical"} else 0)
        daily["total_variance_kg"] = float(daily["total_variance_kg"]) + variance_kg
        daily["total_variance_value_inr"] = float(daily["total_variance_value_inr"]) + variance_value_inr
        daily["total_estimated_gross_profit_inr"] = (
            float(daily["total_estimated_gross_profit_inr"]) + estimated_gross_profit_inr
        )
        daily["total_loss_percent"] = float(daily["total_loss_percent"]) + loss_percent

        batch_rollup.append(
            {
                "id": batch["id"],
                "batch_code": batch["batch_code"],
                "production_date": batch["production_date"],
                "operator_name": batch.get("operator_name"),
                "severity": severity,
                "loss_percent": round(loss_percent, 3),
                "variance_kg": round(variance_kg, 3),
                "variance_value_inr": round(variance_value_inr, 2),
                "estimated_gross_profit_inr": round(estimated_gross_profit_inr, 2),
                "anomaly_score": round(anomaly_score, 2),
                "reason": batch["variance_reason"],
            }
        )

    total_batches = len(serialized_batches)
    average_loss_percent = (
        sum(float(batch["loss_percent"]) for batch in serialized_batches) / total_batches if total_batches else 0.0
    )
    high_severity_count = sum(1 for batch in serialized_batches if batch["severity"] in {"high", "critical"})
    top_loss_batch = max(serialized_batches, key=lambda row: float(row["variance_value_inr"]), default=None)
    best_profit_batch = max(serialized_batches, key=lambda row: float(row["estimated_gross_profit_inr"]), default=None)
    lowest_profit_batch = min(serialized_batches, key=lambda row: float(row["estimated_gross_profit_inr"]), default=None)

    responsibility_by_operator = []
    for row in operator_rollup.values():
        batch_count = int(row["batch_count"]) or 1
        responsibility_by_operator.append(
            {
                "user_id": int(row["user_id"]),
                "name": str(row["name"]),
                "batch_count": int(row["batch_count"]),
                "high_risk_batches": int(row["high_risk_batches"]),
                "critical_batches": int(row["critical_batches"]),
                "total_variance_kg": round(float(row["total_variance_kg"]), 3),
                "total_variance_value_inr": round(float(row["total_variance_value_inr"]), 2),
                "total_estimated_gross_profit_inr": round(float(row["total_estimated_gross_profit_inr"]), 2),
                "average_loss_percent": round(float(row["total_loss_percent"]) / batch_count, 3),
                "highest_anomaly_score": round(float(row["highest_anomaly_score"]), 2),
            }
        )
    responsibility_by_operator.sort(
        key=lambda item: (
            float(item["total_variance_value_inr"]),
            float(item["highest_anomaly_score"]),
            float(item["total_variance_kg"]),
        ),
        reverse=True,
    )

    day_timeline = []
    for row in day_rollup.values():
        batch_count = int(row["batch_count"]) or 1
        day_timeline.append(
            {
                "date": str(row["date"]),
                "batch_count": int(row["batch_count"]),
                "high_risk_batches": int(row["high_risk_batches"]),
                "total_variance_kg": round(float(row["total_variance_kg"]), 3),
                "total_variance_value_inr": round(float(row["total_variance_value_inr"]), 2),
                "total_estimated_gross_profit_inr": round(float(row["total_estimated_gross_profit_inr"]), 2),
                "average_loss_percent": round(float(row["total_loss_percent"]) / batch_count, 3),
            }
        )
    responsibility_by_day = sorted(
        day_timeline,
        key=lambda item: (
            float(item["total_variance_value_inr"]),
            float(item["total_variance_kg"]),
            str(item["date"]),
        ),
        reverse=True,
    )[:7]
    loss_by_day = sorted(day_timeline, key=lambda item: str(item["date"]), reverse=True)[:7]

    responsibility_by_batch = sorted(
        batch_rollup,
        key=lambda item: (
            float(item["anomaly_score"]),
            float(item["variance_value_inr"]),
            float(item["variance_kg"]),
        ),
        reverse=True,
    )[:7]

    ranked_anomalies = []
    for index, candidate in enumerate(
        sorted(
            ranked_anomaly_candidates,
            key=lambda item: (
                float(item["anomaly_score"]),
                float(item["estimated_leakage_value_inr"]),
                float(item["batch"]["variance_kg"]),
            ),
            reverse=True,
        )[:6],
        start=1,
    ):
        ranked_anomalies.append(
            {
                "rank": index,
                "anomaly_score": round(float(candidate["anomaly_score"]), 2),
                "reason": str(candidate["reason"]),
                "estimated_leakage_value_inr": round(float(candidate["estimated_leakage_value_inr"]), 2),
                "batch": candidate["batch"],
            }
        )

    gross_margin_percent = (
        (total_estimated_gross_profit_inr / total_estimated_output_value_inr) * 100.0
        if total_estimated_output_value_inr
        else 0.0
    )
    realization_metrics = build_steel_realization_metrics(db, factory_id=factory.factory_id)

    return {
        "factory": {
            "factory_id": factory.factory_id,
            "name": factory.name,
            "factory_code": factory.factory_code,
            "industry_type": factory.industry_type,
            "workflow_template_key": factory.workflow_template_key,
        },
        "inventory_totals": {
            **{key: round(value, 3) for key, value in category_totals.items()},
            "total_kg": round(sum(category_totals.values()), 3),
            "total_ton": round(sum(category_totals.values()) / 1000.0, 3),
        },
        "confidence_counts": confidence_counts,
        "batch_metrics": {
            "total_batches": total_batches,
            "average_loss_percent": round(average_loss_percent, 3),
            "high_severity_batches": high_severity_count,
        },
        "profit_summary": {
            "estimated_input_cost_inr": round(total_estimated_input_cost_inr, 2),
            "estimated_output_value_inr": round(total_estimated_output_value_inr, 2),
            "estimated_gross_profit_inr": round(total_estimated_gross_profit_inr, 2),
            "gross_margin_percent": round(gross_margin_percent, 3),
            "average_profit_per_batch_inr": round(
                total_estimated_gross_profit_inr / total_batches if total_batches else 0.0,
                2,
            ),
            **realization_metrics,
            "best_profit_batch": best_profit_batch,
            "lowest_profit_batch": lowest_profit_batch,
        },
        "anomaly_summary": {
            "watch_batches": anomaly_counts["watch"],
            "high_batches": anomaly_counts["high"],
            "critical_batches": anomaly_counts["critical"],
            "ranked_batch_count": len(ranked_anomalies),
            "total_variance_kg": round(total_variance_kg, 3),
            "total_estimated_leakage_value_inr": round(total_variance_value_inr, 2),
            "highest_anomaly_score": ranked_anomalies[0]["anomaly_score"] if ranked_anomalies else 0.0,
            "highest_risk_operator": responsibility_by_operator[0] if responsibility_by_operator else None,
            "highest_loss_day": responsibility_by_day[0] if responsibility_by_day else None,
        },
        "top_loss_batch": top_loss_batch,
        "top_operator_losses": responsibility_by_operator[:5],
        "loss_by_day": loss_by_day,
        "anomaly_batches": [entry["batch"] for entry in ranked_anomalies if entry["batch"]["severity"] in {"high", "critical"}][:5],
        "ranked_anomalies": ranked_anomalies,
        "responsibility_analytics": {
            "by_operator": responsibility_by_operator[:5],
            "by_day": responsibility_by_day,
            "by_batch": responsibility_by_batch,
        },
        "low_confidence_items": [row for row in stock_rows if row["confidence_status"] != "green"][:6],
    }


def recent_steel_batches(db: Session, factory_id: str, *, limit: int = 20) -> list[SteelProductionBatch]:
    return (
        db.query(SteelProductionBatch)
        .filter(SteelProductionBatch.factory_id == factory_id)
        .order_by(SteelProductionBatch.production_date.desc(), SteelProductionBatch.created_at.desc())
        .limit(limit)
        .all()
    )


def recent_transactions(db: Session, factory_id: str, *, limit: int = 20) -> list[SteelInventoryTransaction]:
    return (
        db.query(SteelInventoryTransaction)
        .filter(SteelInventoryTransaction.factory_id == factory_id)
        .order_by(SteelInventoryTransaction.created_at.desc())
        .limit(limit)
        .all()
    )


def stale_reconciliation_cutoff(days: int = 14) -> datetime:
    return datetime.now(timezone.utc) - timedelta(days=days)
