"""Steel finance intelligence services: financial overview, product profitability, receivables, payables, and expenses.

Layer 1 — read-only metrics on existing sales data.
Layer 2 — expense/payable infrastructure for vendor bills and operational expenses.
All margin figures are marked with data_quality / cost_basis metadata since they
depend on mutable current rates rather than immutable snapshots.
"""

from __future__ import annotations

from collections import defaultdict
from datetime import date, datetime, timedelta, timezone
from typing import Any

from sqlalchemy import func
from sqlalchemy.orm import Session

from backend.models.steel_customer import SteelCustomer
from backend.models.steel_customer_payment import SteelCustomerPayment
from backend.models.steel_customer_payment_allocation import SteelCustomerPaymentAllocation
from backend.models.steel_dispatch import SteelDispatch
from backend.models.steel_expense import SteelExpense
from backend.models.steel_inventory_item import SteelInventoryItem
from backend.models.steel_production_batch import SteelProductionBatch
from backend.models.steel_sales_invoice import SteelSalesInvoice
from backend.models.steel_sales_invoice_line import SteelSalesInvoiceLine
from backend.models.steel_vendor import SteelVendor
from backend.models.steel_vendor_bill import SteelVendorBill
from backend.models.steel_vendor_payment import SteelVendorPayment
from backend.models.steel_vendor_payment_allocation import SteelVendorPaymentAllocation
from backend.models.steel_cash_account import SteelCashAccount
from backend.models.steel_cash_ledger_entry import SteelCashLedgerEntry
from backend.services.steel_service import build_steel_realization_metrics


# ── Financial Overview (Layer 1 + Layer 2) ─────────────────────────────────


def build_financial_overview(
    db: Session,
    factory_id: str,
    *,
    days: int = 30,
) -> dict[str, Any]:
    """Return a top-of-page financial snapshot for the factory.

    Answers:
      - Total revenue today / this week / this month
      - Realized revenue and profit
      - Gross margin
      - Pending receivables (invoice outstanding, overdue)
      - Collected cash
      - Unpaid vendor bills & total expenses
    """
    today = date.today()

    # ── Time boundaries ──────────────────────────────────────────────────
    today_start = today
    week_start = today - timedelta(days=today.weekday())
    month_start = today.replace(day=1)
    period_start = today - timedelta(days=days)

    # ── Revenue by period (invoiced amount) ──────────────────────────────
    def _revenue_in_range(start: date, end: date | None = None) -> dict[str, float]:
        q = (
            db.query(
                func.count(SteelSalesInvoice.id),
                func.sum(SteelSalesInvoice.total_amount),
                func.sum(SteelSalesInvoice.total_weight_kg),
            )
            .filter(
                SteelSalesInvoice.factory_id == factory_id,
                SteelSalesInvoice.invoice_date >= start,
            )
        )
        if end is not None:
            q = q.filter(SteelSalesInvoice.invoice_date <= end)
        row = q.first()
        return {
            "invoice_count": int(row[0] or 0),
            "revenue_inr": round(float(row[1] or 0.0), 2),
            "weight_kg": round(float(row[2] or 0.0), 3),
        }

    revenue_today = _revenue_in_range(today_start)
    revenue_week = _revenue_in_range(week_start)
    revenue_month = _revenue_in_range(month_start)
    revenue_period = _revenue_in_range(period_start)

    # ── Collected cash (customer payments) ───────────────────────────────
    def _collected_cash(start: date) -> float:
        row = (
            db.query(func.sum(SteelCustomerPayment.amount))
            .filter(
                SteelCustomerPayment.factory_id == factory_id,
                SteelCustomerPayment.payment_date >= start,
            )
            .first()
        )
        return round(float(row[0] or 0.0), 2)

    collected_today = _collected_cash(today_start)
    collected_week = _collected_cash(week_start)
    collected_month = _collected_cash(month_start)
    collected_period = _collected_cash(period_start)

    # ── Realization metrics (dispatched revenue / profit) ────────────────
    realization = build_steel_realization_metrics(db, factory_id=factory_id)

    # ── Receivables summary ──────────────────────────────────────────────
    outstanding_invoices = (
        db.query(SteelSalesInvoice)
        .filter(
            SteelSalesInvoice.factory_id == factory_id,
            SteelSalesInvoice.status.in_(["unpaid", "partial"]),
        )
        .all()
    )
    total_outstanding_inr = 0.0
    all_invoice_ids = [inv.id for inv in outstanding_invoices]
    allocation_sums: dict[int, float] = {}
    if all_invoice_ids:
        alloc_rows = (
            db.query(
                SteelCustomerPaymentAllocation.invoice_id,
                func.sum(SteelCustomerPaymentAllocation.allocated_amount),
            )
            .filter(SteelCustomerPaymentAllocation.invoice_id.in_(all_invoice_ids))
            .group_by(SteelCustomerPaymentAllocation.invoice_id)
            .all()
        )
        allocation_sums = {int(row[0]): float(row[1] or 0.0) for row in alloc_rows}

    overdue_count = 0
    total_overdue_inr = 0.0
    for inv in outstanding_invoices:
        inv_total = float(inv.total_amount or 0.0)
        paid = allocation_sums.get(inv.id, 0.0)
        outstanding = max(0.0, inv_total - paid)
        total_outstanding_inr += outstanding
        if inv.due_date and today > inv.due_date and outstanding > 0.01:
            overdue_count += 1
            total_overdue_inr += outstanding

    # ── Realized margin data ─────────────────────────────────────────────
    realized_revenue = float(realization.get("realized_dispatched_revenue_inr", 0.0))
    realized_cost = float(realization.get("realized_dispatched_cost_inr", 0.0))
    realized_profit = float(realization.get("realized_dispatched_profit_inr", 0.0))
    realized_margin = float(realization.get("realized_margin_percent", 0.0))
    realized_weight = float(realization.get("realized_dispatch_weight_kg", 0.0))

    # ── Customer count (active) ──────────────────────────────────────────
    active_customer_count = (
        db.query(func.count(SteelCustomer.id))
        .filter(
            SteelCustomer.factory_id == factory_id,
            SteelCustomer.is_active.is_(True),
        )
        .scalar() or 0
    )

    # ── All-time invoice count ───────────────────────────────────────────
    total_invoice_count = (
        db.query(func.count(SteelSalesInvoice.id))
        .filter(SteelSalesInvoice.factory_id == factory_id)
        .scalar() or 0
    )

    # ── Layer 2: Payables (unpaid vendor bills) ──────────────────────────
    unpaid_bills = _build_unpaid_bills_summary(db, factory_id, today=today)

    # ── Layer 2: Expenses (period) ───────────────────────────────────────
    period_expenses = _build_period_expenses_summary(db, factory_id, period_start)

    # ── Layer 2: Paid to vendors (period) ────────────────────────────────
    paid_to_vendors_period = _paid_to_vendors_in_range(db, factory_id, period_start)

    # ── Layer 3: Cash flow status ────────────────────────────────────────
    cash_balance = _build_cash_balance_summary(db, factory_id)

    # ── Build response ───────────────────────────────────────────────────
    return {
        "as_of": today.isoformat(),
        "period_days": days,
        "revenue": {
            "today": revenue_today,
            "this_week": revenue_week,
            "this_month": revenue_month,
            "last_n_days": revenue_period,
            "total_all_time": {
                "revenue_inr": round(
                    (revenue_today["revenue_inr"]
                     + _revenue_in_range(date(2000, 1, 1), today - timedelta(days=1))["revenue_inr"]),
                    2,
                ) if total_invoice_count > 0 else 0.0,
                "invoice_count": total_invoice_count,
            },
        },
        "collected_cash": {
            "today": collected_today,
            "this_week": collected_week,
            "this_month": collected_month,
            "last_n_days": collected_period,
        },
        "realized_metrics": {
            "dispatched_revenue_inr": realized_revenue,
            "dispatched_cost_inr": realized_cost,
            "dispatched_profit_inr": realized_profit,
            "margin_percent": round(realized_margin, 2),
            "dispatch_weight_kg": realized_weight,
            "data_quality": "estimated",
            "cost_basis": "current_batch_rate",
        },
        "receivables": {
            "total_outstanding_inr": round(total_outstanding_inr, 2),
            "overdue_count": overdue_count,
            "overdue_amount_inr": round(total_overdue_inr, 2),
            "outstanding_invoice_count": len(outstanding_invoices),
        },
        "cash_balance": cash_balance,
        "payables": unpaid_bills,
        "expenses": period_expenses,
        "paid_to_vendors": {
            "last_n_days_inr": round(paid_to_vendors_period, 2),
        },
        "context": {
            "active_customers": int(active_customer_count),
            "total_invoices_all_time": total_invoice_count,
        },
    }


# ── Layer 2: Payables Helpers ──────────────────────────────────────────────


def _build_unpaid_bills_summary(
    db: Session,
    factory_id: str,
    *,
    today: date,
) -> dict[str, Any]:
    """Compute unpaid vendor bills summary with overdue tracking."""
    unpaid_bills = (
        db.query(SteelVendorBill)
        .filter(
            SteelVendorBill.factory_id == factory_id,
            SteelVendorBill.status.in_(["unpaid", "partial"]),
        )
        .all()
    )
    bill_ids = [b.id for b in unpaid_bills]

    # Payment allocations per bill
    allocation_map: dict[int, float] = {}
    if bill_ids:
        alloc_rows = (
            db.query(
                SteelVendorPaymentAllocation.bill_id,
                func.sum(SteelVendorPaymentAllocation.allocated_amount),
            )
            .filter(SteelVendorPaymentAllocation.bill_id.in_(bill_ids))
            .group_by(SteelVendorPaymentAllocation.bill_id)
            .all()
        )
        allocation_map = {int(row[0]): float(row[1] or 0.0) for row in alloc_rows}

    total_unpaid_inr = 0.0
    total_overdue_bills_inr = 0.0
    overdue_bill_count = 0

    for bill in unpaid_bills:
        bill_total = float(bill.total_amount or 0.0)
        paid = allocation_map.get(bill.id, 0.0)
        outstanding = max(0.0, bill_total - paid)
        total_unpaid_inr += outstanding
        if bill.due_date and today > bill.due_date and outstanding > 0.01:
            overdue_bill_count += 1
            total_overdue_bills_inr += outstanding

    return {
        "total_unpaid_inr": round(total_unpaid_inr, 2),
        "overdue_bill_count": overdue_bill_count,
        "overdue_amount_inr": round(total_overdue_bills_inr, 2),
        "unpaid_bill_count": len(unpaid_bills),
    }


def _build_period_expenses_summary(
    db: Session,
    factory_id: str,
    period_start: date,
) -> dict[str, Any]:
    """Compute total expenses by category for the given period."""
    rows = (
        db.query(
            SteelExpense.category,
            func.sum(SteelExpense.total_amount),
            func.count(SteelExpense.id),
        )
        .filter(
            SteelExpense.factory_id == factory_id,
            SteelExpense.expense_date >= period_start,
        )
        .group_by(SteelExpense.category)
        .all()
    )
    total_expenses = 0.0
    categories: list[dict[str, Any]] = []
    for cat, total, count in rows:
        amt = float(total or 0.0)
        total_expenses += amt
        categories.append({
            "category": cat,
            "total_amount_inr": round(amt, 2),
            "count": int(count or 0),
        })

    # Also sum vendor bills in the period
    bill_total_row = (
        db.query(func.sum(SteelVendorBill.total_amount))
        .filter(
            SteelVendorBill.factory_id == factory_id,
            SteelVendorBill.bill_date >= period_start,
        )
        .first()
    )
    vendor_bill_total = float(bill_total_row[0] or 0.0)

    # Add expense category for vendor bills
    if vendor_bill_total > 0:
        categories.append({
            "category": "vendor_bills",
            "total_amount_inr": round(vendor_bill_total, 2),
            "count": (
                db.query(func.count(SteelVendorBill.id))
                .filter(
                    SteelVendorBill.factory_id == factory_id,
                    SteelVendorBill.bill_date >= period_start,
                )
                .scalar() or 0
            ),
        })
        total_expenses += vendor_bill_total

    return {
        "total_expenses_inr": round(total_expenses, 2),
        "categories": categories,
    }


def _paid_to_vendors_in_range(
    db: Session,
    factory_id: str,
    start: date,
) -> float:
    """Sum of all vendor payments made from start date to today."""
    row = (
        db.query(func.sum(SteelVendorPayment.amount))
        .filter(
            SteelVendorPayment.factory_id == factory_id,
            SteelVendorPayment.payment_date >= start,
        )
        .first()
    )
    return float(row[0] or 0.0)


# ── Product Profitability ──────────────────────────────────────────────────


def build_product_profitability(
    db: Session,
    factory_id: str,
    *,
    days: int = 90,
) -> dict[str, Any]:
    """Analyse profit margin per finished-good product.

    Uses estimated cost from batch production data and invoice line rates.
    All figures are labelled as estimated — a full COGS snapshot is planned
    for a later financial layer.

    Answers:
      - Profit margin by product (finished goods)
      - Highest and lowest profit products
      - Revenue and cost per unit weight
    """
    today = date.today()
    period_start = today - timedelta(days=days)

    # ── Invoice lines (revenue side) ─────────────────────────────────────
    invoices = (
        db.query(SteelSalesInvoice)
        .filter(
            SteelSalesInvoice.factory_id == factory_id,
            SteelSalesInvoice.invoice_date >= period_start,
        )
        .all()
    )
    invoice_ids = [inv.id for inv in invoices]
    if not invoice_ids:
        return _empty_product_profitability(days)

    invoice_lines = (
        db.query(SteelSalesInvoiceLine)
        .filter(SteelSalesInvoiceLine.invoice_id.in_(invoice_ids))
        .all()
    ) if invoice_ids else []

    # ── Batch-derived cost estimates ─────────────────────────────────────
    batch_ids = {line.batch_id for line in invoice_lines if line.batch_id}
    batches = (
        db.query(SteelProductionBatch)
        .filter(SteelProductionBatch.id.in_(batch_ids))
        .all()
    ) if batch_ids else []

    # ── Items (products + batch inputs for cost lookup) ─────────────────
    item_ids = {line.item_id for line in invoice_lines}
    if batch_ids:
        batch_input_ids = {batch.input_item_id for batch in batches}
        item_ids.update(batch_input_ids)
    items = (
        db.query(SteelInventoryItem)
        .filter(
            SteelInventoryItem.factory_id == factory_id,
            SteelInventoryItem.id.in_(item_ids),
        )
        .all()
    ) if item_ids else []
    item_map = {it.id: it for it in items}

    # Average cost per kg for each output item from batches
    batch_cost_map: dict[int, list[float]] = defaultdict(list)
    for batch in batches:
        output_item_id = batch.output_item_id
        actual_kg = float(batch.actual_output_kg or 0.0)
        input_kg = float(batch.input_quantity_kg or 0.0)
        input_rate = 0.0
        input_item = item_map.get(batch.input_item_id)
        if input_item and input_item.current_rate_per_kg:
            input_rate = float(input_item.current_rate_per_kg)
        cost = input_kg * input_rate
        if actual_kg > 0:
            batch_cost_map[output_item_id].append(cost / actual_kg)

    # Weighted average cost per kg by item
    avg_cost_per_kg: dict[int, float] = {}
    for output_id, costs in batch_cost_map.items():
        avg_cost_per_kg[output_id] = sum(costs) / len(costs)

    # ── Aggregate per product ────────────────────────────────────────────
    product_data: dict[int, dict[str, float | int]] = defaultdict(
        lambda: {
            "item_id": 0,
            "item_code": "",
            "item_name": "",
            "category": "",
            "total_revenue_inr": 0.0,
            "total_cost_inr": 0.0,
            "gross_profit_inr": 0.0,
            "margin_percent": 0.0,
            "total_weight_kg": 0.0,
            "avg_rate_per_kg": 0.0,
            "avg_cost_per_kg": 0.0,
            "invoice_count": 0,
        }
    )

    for line in invoice_lines:
        item = item_map.get(line.item_id)
        if not item:
            continue
        pid = line.item_id
        pd = product_data[pid]
        pd["item_id"] = pid
        pd["item_code"] = item.item_code or ""
        pd["item_name"] = item.name
        pd["category"] = item.category or ""
        revenue = float(line.line_total or 0.0)
        weight = float(line.weight_kg or 0.0)
        pd["total_revenue_inr"] = float(pd["total_revenue_inr"]) + revenue
        pd["total_weight_kg"] = float(pd["total_weight_kg"]) + weight
        pd["invoice_count"] = int(pd["invoice_count"]) + 1

        cost_per_kg = avg_cost_per_kg.get(pid)
        if cost_per_kg is None:
            cost_per_kg = float(item.current_rate_per_kg or 0.0)
        cost = weight * cost_per_kg
        pd["total_cost_inr"] = float(pd["total_cost_inr"]) + cost

    # Compute derived fields
    sorted_products: list[dict[str, Any]] = []
    for pid, pd in product_data.items():
        revenue = float(pd["total_revenue_inr"])
        cost = float(pd["total_cost_inr"])
        weight = float(pd["total_weight_kg"])
        profit = revenue - cost
        margin = (profit / revenue * 100.0) if revenue > 0 else 0.0
        avg_rate = revenue / weight if weight > 0 else 0.0
        item = item_map.get(pid)
        cost_per_kg = avg_cost_per_kg.get(pid)
        if cost_per_kg is None:
            cost_per_kg = float(item.current_rate_per_kg or 0.0) if item else 0.0

        sorted_products.append({
            "item_id": pid,
            "item_code": pd["item_code"],
            "item_name": pd["item_name"],
            "category": pd["category"],
            "total_revenue_inr": round(revenue, 2),
            "total_cost_inr": round(cost, 2),
            "gross_profit_inr": round(profit, 2),
            "margin_percent": round(margin, 2),
            "total_weight_kg": round(weight, 3),
            "avg_rate_per_kg": round(avg_rate, 2),
            "avg_cost_per_kg": round(cost_per_kg, 2),
            "invoice_count": int(pd["invoice_count"]),
            "cost_basis": "batch_derived" if pid in avg_cost_per_kg else "current_rate",
        })

    sorted_products.sort(key=lambda x: float(x["margin_percent"]), reverse=True)
    top_profitable = sorted_products[:10]
    bottom_profitable = sorted(sorted_products, key=lambda x: float(x["margin_percent"]))[:10]

    return {
        "time_period_days": days,
        "total_products_analyzed": len(sorted_products),
        "data_quality": "estimated",
        "cost_basis_summary": (
            "Costs are derived from batch input costs and current inventory item rates. "
            "They are operational estimates, not audited financial COGS."
        ),
        "products": sorted_products,
        "top_by_margin": top_profitable,
        "bottom_by_margin": bottom_profitable,
        "summary": {
            "total_revenue_inr": round(sum(float(p["total_revenue_inr"]) for p in sorted_products), 2),
            "total_cost_inr": round(sum(float(p["total_cost_inr"]) for p in sorted_products), 2),
            "total_profit_inr": round(sum(float(p["gross_profit_inr"]) for p in sorted_products), 2),
            "avg_margin_percent": round(
                sum(float(p["margin_percent"]) for p in sorted_products) / max(len(sorted_products), 1),
                2,
            ),
            "total_weight_kg": round(sum(float(p["total_weight_kg"]) for p in sorted_products), 3),
        },
    }


def _empty_product_profitability(days: int) -> dict[str, Any]:
    return {
        "time_period_days": days,
        "total_products_analyzed": 0,
        "data_quality": "estimated",
        "cost_basis_summary": "",
        "products": [],
        "top_by_margin": [],
        "bottom_by_margin": [],
        "summary": {
            "total_revenue_inr": 0.0,
            "total_cost_inr": 0.0,
            "total_profit_inr": 0.0,
            "avg_margin_percent": 0.0,
            "total_weight_kg": 0.0,
        },
    }


# ── Receivables Summary ────────────────────────────────────────────────────


def build_receivables_summary(
    db: Session,
    factory_id: str,
) -> dict[str, Any]:
    """Analyse accounts receivable: aging, outstanding, collection efficiency.

    Uses invoice totals and payment allocations for accurate outstanding.
    Does NOT rely on invoice.status alone — allocations are the financial truth.

    Answers:
      - What are pending receivables?
      - Aging buckets (current, 1-30, 31-60, 61-90, 90+)
      - Top overdue customers
      - Collection efficiency
    """
    today = date.today()

    # ── All invoices for this factory (last 3 years) ─────────────────────
    invoices = (
        db.query(SteelSalesInvoice)
        .filter(
            SteelSalesInvoice.factory_id == factory_id,
            SteelSalesInvoice.invoice_date >= today - timedelta(days=365 * 3),
        )
        .order_by(SteelSalesInvoice.invoice_date.desc())
        .all()
    )
    if not invoices:
        return _empty_receivables_summary()

    invoice_ids = [inv.id for inv in invoices]

    # ── Payment allocations per invoice ──────────────────────────────────
    alloc_rows = (
        db.query(
            SteelCustomerPaymentAllocation.invoice_id,
            func.sum(SteelCustomerPaymentAllocation.allocated_amount),
        )
        .filter(SteelCustomerPaymentAllocation.invoice_id.in_(invoice_ids))
        .group_by(SteelCustomerPaymentAllocation.invoice_id)
        .all()
    )
    paid_map: dict[int, float] = {int(row[0]): float(row[1] or 0.0) for row in alloc_rows}

    # ── Customer names ───────────────────────────────────────────────────
    customer_ids = {inv.customer_id for inv in invoices if inv.customer_id}
    customers = (
        db.query(SteelCustomer)
        .filter(SteelCustomer.id.in_(customer_ids))
        .all()
    ) if customer_ids else []
    customer_map = {c.id: c for c in customers}

    # ── Compute outstanding per invoice ──────────────────────────────────
    aging_buckets: dict[str, dict[str, Any]] = {
        "current": {"label": "Current (0\u201330 days)", "min_days": 0, "max_days": 30, "count": 0, "amount_inr": 0.0, "invoice_count": 0},
        "31_60": {"label": "31\u201360 days", "min_days": 31, "max_days": 60, "count": 0, "amount_inr": 0.0, "invoice_count": 0},
        "61_90": {"label": "61\u201390 days", "min_days": 61, "max_days": 90, "count": 0, "amount_inr": 0.0, "invoice_count": 0},
        "90_plus": {"label": "90+ days", "min_days": 91, "max_days": 9999, "count": 0, "amount_inr": 0.0, "invoice_count": 0},
    }

    overdue_customer_map: dict[int, dict[str, Any]] = defaultdict(
        lambda: {
            "customer_id": 0,
            "customer_name": "",
            "risk_level": "low",
            "outstanding_inr": 0.0,
            "overdue_inr": 0.0,
            "max_overdue_days": 0,
            "invoice_count": 0,
        }
    )

    total_outstanding = 0.0
    total_overdue = 0.0
    fully_paid_count = 0

    for inv in invoices:
        inv_total = float(inv.total_amount or 0.0)
        paid = paid_map.get(inv.id, 0.0)
        outstanding = max(0.0, inv_total - paid)

        if outstanding < 0.01:
            fully_paid_count += 1
            continue

        total_outstanding += outstanding
        due_date = inv.due_date
        if due_date and today > due_date:
            overdue_days = (today - due_date).days
        else:
            overdue_days = 0

        # Bucket
        if overdue_days <= 0:
            bucket_key = "current"
        elif overdue_days <= 30:
            bucket_key = "current"
        elif overdue_days <= 60:
            bucket_key = "31_60"
        elif overdue_days <= 90:
            bucket_key = "61_90"
        else:
            bucket_key = "90_plus"

        bucket = aging_buckets[bucket_key]
        bucket["amount_inr"] = float(bucket["amount_inr"]) + outstanding
        bucket["count"] = int(bucket["count"]) + 1
        bucket["invoice_count"] = int(bucket["invoice_count"]) + 1

        if overdue_days > 0:
            total_overdue += outstanding

        cid = inv.customer_id
        if cid and overdue_days > 0:
            oc = overdue_customer_map[cid]
            oc["customer_id"] = cid
            cust = customer_map.get(cid)
            oc["customer_name"] = cust.name if cust else f"Customer #{cid}"
            oc["risk_level"] = getattr(cust, "risk_level", "low") if cust else "low"
            oc["outstanding_inr"] = float(oc["outstanding_inr"]) + outstanding
            oc["overdue_inr"] = float(oc["overdue_inr"]) + outstanding
            oc["max_overdue_days"] = max(int(oc["max_overdue_days"]), overdue_days)
            oc["invoice_count"] = int(oc["invoice_count"]) + 1

    # Sort buckets
    bucket_order = ["current", "31_60", "61_90", "90_plus"]
    sorted_buckets = [aging_buckets[k] for k in bucket_order]

    # Top overdue customers
    top_overdue = sorted(overdue_customer_map.values(), key=lambda x: float(x["overdue_inr"]), reverse=True)[:10]
    for oc in top_overdue:
        oc["outstanding_inr"] = round(float(oc["outstanding_inr"]), 2)
        oc["overdue_inr"] = round(float(oc["overdue_inr"]), 2)

    # Collection efficiency
    total_invoice_value = sum(float(inv.total_amount or 0.0) for inv in invoices)
    total_paid = sum(paid_map.values())
    collection_efficiency = (total_paid / total_invoice_value * 100.0) if total_invoice_value > 0 else 0.0

    return {
        "as_of": today.isoformat(),
        "total_outstanding_inr": round(total_outstanding, 2),
        "total_overdue_inr": round(total_overdue, 2),
        "aging_buckets": [
            {
                "key": k,
                "label": v["label"],
                "count": int(v["count"]),
                "amount_inr": round(float(v["amount_inr"]), 2),
                "invoice_count": int(v["invoice_count"]),
            }
            for k, v in zip(bucket_order, sorted_buckets)
        ],
        "top_overdue_customers": top_overdue,
        "summary": {
            "total_invoices": len(invoices),
            "fully_paid_invoices": fully_paid_count,
            "outstanding_invoices": len(invoices) - fully_paid_count,
            "total_paid_inr": round(total_paid, 2),
            "collection_efficiency_percent": round(collection_efficiency, 2),
        },
    }


def _empty_receivables_summary() -> dict[str, Any]:
    return {
        "as_of": date.today().isoformat(),
        "total_outstanding_inr": 0.0,
        "total_overdue_inr": 0.0,
        "aging_buckets": [],
        "top_overdue_customers": [],
        "summary": {
            "total_invoices": 0,
            "fully_paid_invoices": 0,
            "outstanding_invoices": 0,
            "total_paid_inr": 0.0,
            "collection_efficiency_percent": 100.0,
        },
    }


# ── Layer 2: Payables Summary ──────────────────────────────────────────────


def build_payables_summary(
    db: Session,
    factory_id: str,
) -> dict[str, Any]:
    """Analyse accounts payable: aging, outstanding bills, collection efficiency.

    Uses bill totals and vendor payment allocations for accurate outstanding.

    Answers:
      - What are pending payables?
      - Aging buckets (current, 1-30, 31-60, 61-90, 90+)
      - Top overdue vendors
      - Payment efficiency
    """
    today = date.today()

    bills = (
        db.query(SteelVendorBill)
        .filter(
            SteelVendorBill.factory_id == factory_id,
            SteelVendorBill.bill_date >= today - timedelta(days=365 * 3),
        )
        .order_by(SteelVendorBill.bill_date.desc())
        .all()
    )
    if not bills:
        return _empty_payables_summary()

    bill_ids = [b.id for b in bills]

    # Payment allocations per bill
    alloc_rows = (
        db.query(
            SteelVendorPaymentAllocation.bill_id,
            func.sum(SteelVendorPaymentAllocation.allocated_amount),
        )
        .filter(SteelVendorPaymentAllocation.bill_id.in_(bill_ids))
        .group_by(SteelVendorPaymentAllocation.bill_id)
        .all()
    )
    paid_map: dict[int, float] = {int(row[0]): float(row[1] or 0.0) for row in alloc_rows}

    # Vendor names
    vendor_ids = {b.vendor_id for b in bills}
    vendors = (
        db.query(SteelVendor)
        .filter(SteelVendor.id.in_(vendor_ids))
        .all()
    ) if vendor_ids else []
    vendor_map = {v.id: v for v in vendors}

    aging_buckets: dict[str, dict[str, Any]] = {
        "current": {"label": "Current (0\u201330 days)", "count": 0, "amount_inr": 0.0, "bill_count": 0},
        "31_60": {"label": "31\u201360 days", "count": 0, "amount_inr": 0.0, "bill_count": 0},
        "61_90": {"label": "61\u201390 days", "count": 0, "amount_inr": 0.0, "bill_count": 0},
        "90_plus": {"label": "90+ days", "count": 0, "amount_inr": 0.0, "bill_count": 0},
    }

    overdue_vendor_map: dict[int, dict[str, Any]] = defaultdict(
        lambda: {
            "vendor_id": 0,
            "vendor_name": "",
            "outstanding_inr": 0.0,
            "overdue_inr": 0.0,
            "max_overdue_days": 0,
            "bill_count": 0,
        }
    )

    total_outstanding = 0.0
    total_overdue = 0.0
    fully_paid_count = 0

    for bill in bills:
        bill_total = float(bill.total_amount or 0.0)
        paid = paid_map.get(bill.id, 0.0)
        outstanding = max(0.0, bill_total - paid)

        if outstanding < 0.01:
            fully_paid_count += 1
            continue

        total_outstanding += outstanding
        due_date = bill.due_date
        overdue_days = (today - due_date).days if due_date and today > due_date else 0

        if overdue_days <= 0:
            bucket_key = "current"
        elif overdue_days <= 30:
            bucket_key = "current"
        elif overdue_days <= 60:
            bucket_key = "31_60"
        elif overdue_days <= 90:
            bucket_key = "61_90"
        else:
            bucket_key = "90_plus"

        bucket = aging_buckets[bucket_key]
        bucket["amount_inr"] = float(bucket["amount_inr"]) + outstanding
        bucket["count"] = int(bucket["count"]) + 1
        bucket["bill_count"] = int(bucket["bill_count"]) + 1

        if overdue_days > 0:
            total_overdue += outstanding

        vid = bill.vendor_id
        if vid and overdue_days > 0:
            ov = overdue_vendor_map[vid]
            ov["vendor_id"] = vid
            ven = vendor_map.get(vid)
            ov["vendor_name"] = ven.name if ven else f"Vendor #{vid}"
            ov["outstanding_inr"] = float(ov["outstanding_inr"]) + outstanding
            ov["overdue_inr"] = float(ov["overdue_inr"]) + outstanding
            ov["max_overdue_days"] = max(int(ov["max_overdue_days"]), overdue_days)
            ov["bill_count"] = int(ov["bill_count"]) + 1

    bucket_order = ["current", "31_60", "61_90", "90_plus"]
    sorted_buckets = [aging_buckets[k] for k in bucket_order]

    top_overdue = sorted(overdue_vendor_map.values(), key=lambda x: float(x["overdue_inr"]), reverse=True)[:10]
    for ov in top_overdue:
        ov["outstanding_inr"] = round(float(ov["outstanding_inr"]), 2)
        ov["overdue_inr"] = round(float(ov["overdue_inr"]), 2)

    total_bill_value = sum(float(b.total_amount or 0.0) for b in bills)
    total_paid = sum(paid_map.values())
    payment_efficiency = (total_paid / total_bill_value * 100.0) if total_bill_value > 0 else 0.0

    return {
        "as_of": today.isoformat(),
        "total_outstanding_inr": round(total_outstanding, 2),
        "total_overdue_inr": round(total_overdue, 2),
        "aging_buckets": [
            {
                "key": k,
                "label": v["label"],
                "count": int(v["count"]),
                "amount_inr": round(float(v["amount_inr"]), 2),
                "bill_count": int(v["bill_count"]),
            }
            for k, v in zip(bucket_order, sorted_buckets)
        ],
        "top_overdue_vendors": top_overdue,
        "summary": {
            "total_bills": len(bills),
            "fully_paid_bills": fully_paid_count,
            "outstanding_bills": len(bills) - fully_paid_count,
            "total_paid_inr": round(total_paid, 2),
            "payment_efficiency_percent": round(payment_efficiency, 2),
        },
    }


def _empty_payables_summary() -> dict[str, Any]:
    return {
        "as_of": date.today().isoformat(),
        "total_outstanding_inr": 0.0,
        "total_overdue_inr": 0.0,
        "aging_buckets": [],
        "top_overdue_vendors": [],
        "summary": {
            "total_bills": 0,
            "fully_paid_bills": 0,
            "outstanding_bills": 0,
            "total_paid_inr": 0.0,
            "payment_efficiency_percent": 100.0,
        },
    }


# ── Layer 2: Expenses Summary ──────────────────────────────────────────────


def build_expenses_summary(
    db: Session,
    factory_id: str,
    *,
    days: int = 90,
) -> dict[str, Any]:
    """Analyse operational expenses by category and trend.

    Includes both direct SteelExpense entries and SteelVendorBill totals.

    Answers:
      - Total expenses by category
      - Expenses trend over time
      - Vendor bill totals in period
    """
    today = date.today()
    period_start = today - timedelta(days=days)

    # Direct expenses by category
    expense_rows = (
        db.query(
            SteelExpense.category,
            func.sum(SteelExpense.total_amount),
            func.count(SteelExpense.id),
        )
        .filter(
            SteelExpense.factory_id == factory_id,
            SteelExpense.expense_date >= period_start,
        )
        .group_by(SteelExpense.category)
        .all()
    )

    categories: list[dict[str, Any]] = []
    total_expenses_inr = 0.0
    for cat, total, count in expense_rows:
        amt = float(total or 0.0)
        total_expenses_inr += amt
        categories.append({
            "category": cat,
            "total_amount_inr": round(amt, 2),
            "count": int(count or 0),
        })

    # Vendor bills in period (treated as expense)
    bill_row = (
        db.query(func.sum(SteelVendorBill.total_amount))
        .filter(
            SteelVendorBill.factory_id == factory_id,
            SteelVendorBill.bill_date >= period_start,
        )
        .first()
    )
    vendor_bill_total = float(bill_row[0] or 0.0)
    if vendor_bill_total > 0:
        total_expenses_inr += vendor_bill_total
        categories.append({
            "category": "vendor_bills",
            "total_amount_inr": round(vendor_bill_total, 2),
            "count": (
                db.query(func.count(SteelVendorBill.id))
                .filter(
                    SteelVendorBill.factory_id == factory_id,
                    SteelVendorBill.bill_date >= period_start,
                )
                .scalar() or 0
            ),
        })

    # Expenses by month (trend)
    monthly_trend = _build_expense_monthly_trend(db, factory_id, period_start)

    categories.sort(key=lambda x: float(x["total_amount_inr"]), reverse=True)

    return {
        "time_period_days": days,
        "total_expenses_inr": round(total_expenses_inr, 2),
        "categories": categories,
        "monthly_trend": monthly_trend,
    }


def _build_expense_monthly_trend(
    db: Session,
    factory_id: str,
    period_start: date,
) -> list[dict[str, Any]]:
    """Return expenses aggregated by month."""
    # Direct expenses by month
    exp_rows = (
        db.query(
            func.strftime("%Y-%m", SteelExpense.expense_date),
            func.sum(SteelExpense.total_amount),
            func.count(SteelExpense.id),
        )
        .filter(
            SteelExpense.factory_id == factory_id,
            SteelExpense.expense_date >= period_start,
        )
        .group_by(func.strftime("%Y-%m", SteelExpense.expense_date))
        .order_by(func.strftime("%Y-%m", SteelExpense.expense_date))
        .all()
    )

    # Vendor bills by month
    bill_rows = (
        db.query(
            func.strftime("%Y-%m", SteelVendorBill.bill_date),
            func.sum(SteelVendorBill.total_amount),
            func.count(SteelVendorBill.id),
        )
        .filter(
            SteelVendorBill.factory_id == factory_id,
            SteelVendorBill.bill_date >= period_start,
        )
        .group_by(func.strftime("%Y-%m", SteelVendorBill.bill_date))
        .order_by(func.strftime("%Y-%m", SteelVendorBill.bill_date))
        .all()
    )

    # Merge by month
    merged: dict[str, dict[str, Any]] = {}
    for month, total, count in exp_rows:
        m = str(month)
        merged.setdefault(m, {"month": m, "direct_expenses_inr": 0.0, "vendor_bills_inr": 0.0, "total_inr": 0.0, "count": 0})
        amt = float(total or 0.0)
        merged[m]["direct_expenses_inr"] = round(amt, 2)
        merged[m]["total_inr"] += amt
        merged[m]["count"] += int(count or 0)

    for month, total, count in bill_rows:
        m = str(month)
        merged.setdefault(m, {"month": m, "direct_expenses_inr": 0.0, "vendor_bills_inr": 0.0, "total_inr": 0.0, "count": 0})
        amt = float(total or 0.0)
        merged[m]["vendor_bills_inr"] = round(amt, 2)
        merged[m]["total_inr"] += amt
        merged[m]["count"] += int(count or 0)

    result = list(merged.values())
    for entry in result:
        entry["total_inr"] = round(float(entry["total_inr"]), 2)
    return result


# ── Layer 3: Cash Flow Service Functions ────────────────────────────────────


def build_cash_flow_summary(
    db: Session,
    factory_id: str,
) -> dict[str, Any]:
    """Analyse cash flow: account balances, total cash position, recent transactions.

    Answers:
      - What is the total cash/bank balance?
      - Breakdown by account type (cash, bank, digital wallet)
      - Recent ledger activity
      - Monthly inflow/outflow trend
    """
    today = date.today()

    accounts = (
        db.query(SteelCashAccount)
        .filter(
            SteelCashAccount.factory_id == factory_id,
            SteelCashAccount.is_active.is_(True),
        )
        .order_by(SteelCashAccount.account_name.asc())
        .all()
    )

    if not accounts:
        return _empty_cash_flow_summary()

    total_balance_inr = 0.0
    cash_balance_inr = 0.0
    bank_balance_inr = 0.0
    digital_balance_inr = 0.0
    account_list: list[dict[str, Any]] = []

    for acc in accounts:
        bal = float(acc.current_balance or 0.0)
        total_balance_inr += bal
        acc_type = acc.account_type or "bank"
        if acc_type == "cash":
            cash_balance_inr += bal
        elif acc_type == "digital_wallet":
            digital_balance_inr += bal
        else:
            bank_balance_inr += bal

        account_list.append({
            "id": acc.id,
            "account_name": acc.account_name,
            "account_type": acc.account_type,
            "account_number": acc.account_number,
            "bank_name": acc.bank_name,
            "current_balance": round(bal, 2),
            "currency": acc.currency,
        })

    # Recent ledger entries (last 20)
    recent_entries = _build_recent_ledger_entries(db, factory_id, limit=20)

    return {
        "as_of": today.isoformat(),
        "total_balance_inr": round(total_balance_inr, 2),
        "cash_balance_inr": round(cash_balance_inr, 2),
        "bank_balance_inr": round(bank_balance_inr, 2),
        "digital_balance_inr": round(digital_balance_inr, 2),
        "account_count": len(accounts),
        "accounts": account_list,
        "recent_entries": recent_entries,
    }


def _build_cash_balance_summary(
    db: Session,
    factory_id: str,
) -> dict[str, Any]:
    """Quick cash position snapshot for the financial overview."""
    accounts = (
        db.query(SteelCashAccount)
        .filter(
            SteelCashAccount.factory_id == factory_id,
            SteelCashAccount.is_active.is_(True),
        )
        .all()
    )

    total_balance_inr = 0.0
    cash_balance_inr = 0.0
    bank_balance_inr = 0.0
    account_count = len(accounts)

    for acc in accounts:
        bal = float(acc.current_balance or 0.0)
        total_balance_inr += bal
        acc_type = acc.account_type or "bank"
        if acc_type == "cash":
            cash_balance_inr += bal
        else:
            bank_balance_inr += bal

    return {
        "total_balance_inr": round(total_balance_inr, 2),
        "cash_in_hand_inr": round(cash_balance_inr, 2),
        "bank_balance_inr": round(bank_balance_inr, 2),
        "account_count": account_count,
    }


def _build_recent_ledger_entries(
    db: Session,
    factory_id: str,
    *,
    limit: int = 20,
) -> list[dict[str, Any]]:
    """Return the most recent ledger entries with account names."""
    entries = (
        db.query(SteelCashLedgerEntry)
        .filter(SteelCashLedgerEntry.factory_id == factory_id)
        .order_by(SteelCashLedgerEntry.entry_date.desc(), SteelCashLedgerEntry.created_at.desc())
        .limit(limit)
        .all()
    )

    account_ids = {e.account_id for e in entries}
    accounts = (
        db.query(SteelCashAccount)
        .filter(SteelCashAccount.id.in_(account_ids))
        .all()
    ) if account_ids else []
    account_map = {a.id: a for a in accounts}

    return [
        {
            "id": e.id,
            "account_id": e.account_id,
            "account_name": account_map.get(e.account_id).account_name if account_map.get(e.account_id) else None,
            "entry_date": e.entry_date.isoformat(),
            "entry_type": e.entry_type,
            "amount": round(float(e.amount or 0.0), 2),
            "balance_after": round(float(e.balance_after or 0.0), 2),
            "reference_type": e.reference_type,
            "reference_id": e.reference_id,
            "description": e.description,
            "category": e.category,
            "payment_mode": e.payment_mode,
        }
        for e in entries
    ]


def build_cash_flow_monthly_trend(
    db: Session,
    factory_id: str,
    *,
    months: int = 12,
) -> dict[str, Any]:
    """Monthly cash inflow/outflow trend for cash flow analysis."""
    today = date.today()
    period_start = today.replace(day=1)
    for _ in range(months - 1):
        period_start = period_start.replace(month=period_start.month - 1) if period_start.month > 1 else period_start.replace(year=period_start.year - 1, month=12)

    # Inflow (debit entries = money coming in)
    inflow_rows = (
        db.query(
            func.strftime("%Y-%m", SteelCashLedgerEntry.entry_date),
            func.sum(SteelCashLedgerEntry.amount),
            func.count(SteelCashLedgerEntry.id),
        )
        .filter(
            SteelCashLedgerEntry.factory_id == factory_id,
            SteelCashLedgerEntry.entry_type == "debit",
            SteelCashLedgerEntry.entry_date >= period_start,
        )
        .group_by(func.strftime("%Y-%m", SteelCashLedgerEntry.entry_date))
        .order_by(func.strftime("%Y-%m", SteelCashLedgerEntry.entry_date))
        .all()
    )

    # Outflow (credit entries = money going out)
    outflow_rows = (
        db.query(
            func.strftime("%Y-%m", SteelCashLedgerEntry.entry_date),
            func.sum(SteelCashLedgerEntry.amount),
            func.count(SteelCashLedgerEntry.id),
        )
        .filter(
            SteelCashLedgerEntry.factory_id == factory_id,
            SteelCashLedgerEntry.entry_type == "credit",
            SteelCashLedgerEntry.entry_date >= period_start,
        )
        .group_by(func.strftime("%Y-%m", SteelCashLedgerEntry.entry_date))
        .order_by(func.strftime("%Y-%m", SteelCashLedgerEntry.entry_date))
        .all()
    )

    inflow_map: dict[str, dict[str, Any]] = {
        str(row[0]): {"month": str(row[0]), "inflow_inr": round(float(row[1] or 0.0), 2), "inflow_count": int(row[2] or 0)}
        for row in inflow_rows
    }
    outflow_map: dict[str, dict[str, Any]] = {
        str(row[0]): {"month": str(row[0]), "outflow_inr": round(float(row[1] or 0.0), 2), "outflow_count": int(row[2] or 0)}
        for row in outflow_rows
    }

    all_months = sorted(set(list(inflow_map.keys()) + list(outflow_map.keys())))
    monthly_data: list[dict[str, Any]] = []
    for month_key in all_months:
        inflow = inflow_map.get(month_key, {})
        outflow = outflow_map.get(month_key, {})
        inflow_amt = inflow.get("inflow_inr", 0.0)
        outflow_amt = outflow.get("outflow_inr", 0.0)
        net = round(inflow_amt - outflow_amt, 2)
        monthly_data.append({
            "month": month_key,
            "inflow_inr": inflow_amt,
            "outflow_inr": outflow_amt,
            "net_inr": net,
            "inflow_count": inflow.get("inflow_count", 0),
            "outflow_count": outflow.get("outflow_count", 0),
        })

    total_inflow = sum(m["inflow_inr"] for m in monthly_data)
    total_outflow = sum(m["outflow_inr"] for m in monthly_data)

    return {
        "months": months,
        "total_inflow_inr": round(total_inflow, 2),
        "total_outflow_inr": round(total_outflow, 2),
        "net_inr": round(total_inflow - total_outflow, 2),
        "monthly_data": monthly_data,
    }


def _empty_cash_flow_summary() -> dict[str, Any]:
    return {
        "as_of": date.today().isoformat(),
        "total_balance_inr": 0.0,
        "cash_balance_inr": 0.0,
        "bank_balance_inr": 0.0,
        "digital_balance_inr": 0.0,
        "account_count": 0,
        "accounts": [],
        "recent_entries": [],
    }
