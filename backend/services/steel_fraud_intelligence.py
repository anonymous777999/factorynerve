"""Theft / Fraud Intelligence — Phase A+B: direct and derived signals from existing schema.

All analytics are read-only. No schema changes required.
Every signal carries severity, confidence, evidence basis, and recommended action.

Labels honestly distinguish direct, derived, proxy, and weak signals.
"""

from __future__ import annotations

from collections import defaultdict
from datetime import date, datetime, timedelta, timezone
from typing import Any

from sqlalchemy import func
from sqlalchemy.orm import Session

from backend.models.approval_instance import ApprovalInstance
from backend.models.attendance_record import AttendanceRecord
from backend.models.steel_dispatch import SteelDispatch
from backend.models.steel_dispatch_line import SteelDispatchLine
from backend.models.steel_inventory_item import SteelInventoryItem
from backend.models.steel_inventory_transaction import SteelInventoryTransaction
from backend.models.steel_sales_invoice import SteelSalesInvoice
from backend.models.steel_stock_reconciliation import SteelStockReconciliation
from backend.models.report import AuditLog
from backend.models.user import User

DEFAULT_PERIOD_DAYS = 30
MAX_PERIOD_DAYS = 365

MISSING_INVENTORY_THRESHOLD_KG = 100.0
MISSING_INVENTORY_THRESHOLD_PCT = 5.0

DISPATCH_WEIGHT_MISMATCH_THRESHOLD_KG = 10.0
DISPATCH_AFTER_TIMING_SECONDS = 60  # dispatch marked delivered less than 60s after creation

APPROVAL_FAST_THRESHOLD_MINUTES = 5
APPROVAL_DOMINANCE_THRESHOLD_PCT = 70.0

ATTENDANCE_SHORT_THRESHOLD_MINUTES = 180
ATTENDANCE_EXCESSIVE_OT_THRESHOLD_MINUTES = 240
ATTENDANCE_CHRONIC_LATE_THRESHOLD = 30
ATTENDANCE_CHRONIC_LATE_MIN_OCCURRENCES = 3
ATTENDANCE_REVIEWER_DOMINANCE_THRESHOLD_PCT = 70.0
ATTENDANCE_AUTO_CLUSTER_THRESHOLD = 10

TRANSACTION_REFERENCE_MINIMUM = 5  # minimum transactions to compute baseline
TRANSACTION_OUTLIER_MULTIPLIER = 3.0


def build_fraud_intelligence(
    db: Session,
    factory_id: str,
    *,
    days: int = DEFAULT_PERIOD_DAYS,
    can_view_financials: bool = False,
    can_view_user_details: bool = False,
    severity: str | None = None,
) -> dict[str, Any]:
    """Comprehensive theft & fraud intelligence for steel factories.

    Args:
        db: SQLAlchemy session.
        factory_id: Target factory.
        days: Number of days for the analysis period.
        can_view_financials: Whether the caller can see financial loss estimates.
        can_view_user_details: Whether the caller can see named user profiles.
        severity: Optional filter (e.g. "critical", "high").

    Returns:
        A dictionary with all fraud intelligence sections.
    """
    today = date.today()
    cutoff = today - timedelta(days=days)

    inventory_loss_signals = _build_inventory_loss_signals(db, factory_id, cutoff, today)
    dispatch_mismatch_signals = _build_dispatch_mismatch_signals(db, factory_id, cutoff)
    transaction_anomalies = _build_transaction_anomalies(db, factory_id, cutoff)
    approval_risk_signals = _build_approval_risk_signals(db, factory_id, cutoff)
    attendance_risk_signals = _build_attendance_risk_signals(db, factory_id, cutoff, today)
    user_behavior = _build_user_behavior_signals(db, factory_id, cutoff, inventory_loss_signals, dispatch_mismatch_signals, transaction_anomalies, approval_risk_signals, attendance_risk_signals)
    investigation_queue = _build_investigation_queue(db, factory_id, cutoff, inventory_loss_signals, dispatch_mismatch_signals, transaction_anomalies, approval_risk_signals, attendance_risk_signals)
    data_confidence = _build_fraud_confidence(db, factory_id, cutoff)

    # ── Severity filter ──────────────────────────────────────────────────
    if severity:
        inventory_loss_signals["signals"] = [s for s in inventory_loss_signals["signals"] if s.get("severity") == severity]
        dispatch_mismatch_signals["signals"] = [s for s in dispatch_mismatch_signals["signals"] if s.get("severity") == severity]
        transaction_anomalies["signals"] = [s for s in transaction_anomalies["signals"] if s.get("severity") == severity]
        approval_risk_signals["signals"] = [s for s in approval_risk_signals["signals"] if s.get("severity") == severity]
        attendance_risk_signals["signals"] = [s for s in attendance_risk_signals["signals"] if s.get("severity") == severity]
        investigation_queue = [i for i in investigation_queue if i.get("severity") == severity]

    # ── Redact financials ────────────────────────────────────────────────
    if not can_view_financials:
        inventory_loss_signals = _redact_financials(inventory_loss_signals)
        dispatch_mismatch_signals = _redact_financials(dispatch_mismatch_signals)
        transaction_anomalies = _redact_financials(transaction_anomalies)
        approval_risk_signals = _redact_financials(approval_risk_signals)
        attendance_risk_signals = _redact_financials(attendance_risk_signals)
        investigation_queue = [_redact_financials_signal(i) for i in investigation_queue]
        data_confidence["financial_valuation"] = "restricted"

    # ── Redact user identifiers ──────────────────────────────────────────
    if not can_view_user_details:
        user_behavior = _redact_user_details(user_behavior)
        attendance_risk_signals = _redact_user_details_in_signals(attendance_risk_signals)
        investigation_queue = [_redact_user_details_signal(i) for i in investigation_queue]

    # ── Build summary ────────────────────────────────────────────────────
    summary = _build_fraud_summary(
        inventory_loss_signals,
        dispatch_mismatch_signals,
        transaction_anomalies,
        approval_risk_signals,
        attendance_risk_signals,
        investigation_queue,
    )

    return {
        "as_of": today.isoformat(),
        "period_days": min(days, MAX_PERIOD_DAYS),
        "financial_access": can_view_financials,
        "user_detail_access": can_view_user_details,
        "summary": summary,
        "inventory_loss_signals": inventory_loss_signals,
        "dispatch_mismatch_signals": dispatch_mismatch_signals,
        "transaction_anomalies": transaction_anomalies,
        "approval_risk_signals": approval_risk_signals,
        "attendance_risk_signals": attendance_risk_signals,
        "user_behavior_signals": user_behavior,
        "investigation_queue": investigation_queue,
        "data_confidence": data_confidence,
    }


# ── Severity Helpers ────────────────────────────────────────────────────────

def _severity_from_score(score: float) -> str:
    if score >= 8:
        return "critical"
    if score >= 5:
        return "high"
    if score >= 3:
        return "medium"
    return "low"


# ── Section 1: Inventory Loss Signals ───────────────────────────────────────

def _build_inventory_loss_signals(
    db: Session,
    factory_id: str,
    cutoff: date,
    today: date,
) -> dict[str, Any]:
    """Detect inventory shortage patterns from reconciliations and transactions."""
    reconciliations = (
        db.query(SteelStockReconciliation)
        .filter(
            SteelStockReconciliation.factory_id == factory_id,
            SteelStockReconciliation.counted_at >= cutoff,
        )
        .all()
    )

    items = db.query(SteelInventoryItem).filter(SteelInventoryItem.factory_id == factory_id).all()
    item_map = {it.id: it for it in items}

    # Count reconciliations per item, track repeated shortages
    item_recon_count: dict[int, int] = defaultdict(int)
    item_negative_count: dict[int, int] = defaultdict(int)
    item_total_variance: dict[int, float] = defaultdict(float)
    high_variance_recons: list[SteelStockReconciliation] = []

    for r in reconciliations:
        item_id = r.item_id
        item_recon_count[item_id] += 1
        variance = float(r.variance_kg or 0.0)
        item_total_variance[item_id] += variance
        if variance < 0:
            item_negative_count[item_id] += 1

        abs_variance = abs(variance)
        var_pct = abs(float(r.variance_percent or 0.0))
        if abs_variance > MISSING_INVENTORY_THRESHOLD_KG and var_pct > MISSING_INVENTORY_THRESHOLD_PCT:
            high_variance_recons.append(r)

    signals: list[dict[str, Any]] = []

    # Signal 1: High-variance reconciliations
    for r in high_variance_recons:
        item = item_map.get(r.item_id)
        item_name = item.name if item else f"Item #{r.item_id}"
        item_code = item.item_code if item else ""
        variance = float(r.variance_kg or 0.0)
        var_pct = float(r.variance_percent or 0.0)
        score = min(abs(variance) / MISSING_INVENTORY_THRESHOLD_KG, 10.0) * 0.6 + min(var_pct / MISSING_INVENTORY_THRESHOLD_PCT, 10.0) * 0.4
        severity = _severity_from_score(score)

        signals.append({
            "signal_type": "high_inventory_variance",
            "severity": severity,
            "confidence": "direct",
            "item_id": r.item_id,
            "item_name": item_name,
            "item_code": item_code,
            "variance_kg": round(variance, 2),
            "variance_percent": round(var_pct, 2),
            "confidence_status": r.confidence_status,
            "mismatch_cause": r.mismatch_cause,
            "estimated_loss_inr": _estimate_loss_inr(item, abs(variance)),
            "occurrence_count_30d": item_recon_count.get(r.item_id, 1),
            "evidence_summary": f"Reconciliation #{r.id}: physical={float(r.physical_qty_kg or 0.0):.1f}kg vs system={float(r.system_qty_kg or 0.0):.1f}kg",
            "recommended_action": "Immediate recount and investigate cause of variance.",
        })

    # Signal 2: Repeated shortages on same item
    for item_id in item_negative_count:
        count = item_negative_count[item_id]
        if count >= 2 and item_recon_count[item_id] >= 2:
            item = item_map.get(item_id)
            score = min(count * 2, 10.0)
            signals.append({
                "signal_type": "repeated_shortage",
                "severity": _severity_from_score(score),
                "confidence": "direct",
                "item_id": item_id,
                "item_name": item.name if item else f"Item #{item_id}",
                "item_code": item.item_code if item else "",
                "variance_kg": round(item_total_variance[item_id], 2),
                "variance_percent": None,
                "shortage_count": count,
                "estimated_loss_inr": _estimate_loss_inr(item, abs(item_total_variance[item_id])),
                "occurrence_count_30d": count,
                "evidence_summary": f"{count} negative reconciliation(s) for this item in the period.",
                "recommended_action": "Review reconciliation history and consider cycle count.",
            })

    signals.sort(key=lambda s: s.get("variance_kg", 0) if isinstance(s.get("variance_kg"), (int, float)) else 0, reverse=True)

    return {
        "signals": signals[:20],
        "total_signals": len(signals),
        "high_variance_reconciliation_count": len(high_variance_recons),
        "items_with_repeated_shortage": len([i for i in item_negative_count if item_negative_count[i] >= 2]),
        "data_quality": "direct" if reconciliations else "insufficient_data",
    }


def _estimate_loss_inr(item: Any, kg: float) -> float | None:
    if item and hasattr(item, "current_rate_per_kg") and item.current_rate_per_kg:
        return round(float(item.current_rate_per_kg) * kg, 2)
    return None


# ── Section 2: Dispatch Mismatch Signals ─────────────────────────────────────

def _build_dispatch_mismatch_signals(
    db: Session,
    factory_id: str,
    cutoff: date,
) -> dict[str, Any]:
    """Detect dispatch quantity mismatches and timing anomalies."""
    dispatches = (
        db.query(SteelDispatch)
        .filter(
            SteelDispatch.factory_id == factory_id,
            SteelDispatch.dispatch_date >= cutoff,
        )
        .all()
    )

    dispatch_ids = [d.id for d in dispatches]
    lines = (
        db.query(SteelDispatchLine)
        .filter(SteelDispatchLine.dispatch_id.in_(dispatch_ids))
        .all()
    ) if dispatch_ids else []
    line_map: dict[int, list[SteelDispatchLine]] = defaultdict(list)
    for ln in lines:
        line_map[ln.dispatch_id].append(ln)

    signals: list[dict[str, Any]] = []

    for d in dispatches:
        dispatch_lines = line_map.get(d.id, [])
        sum_lines = sum(float(ln.weight_kg or 0.0) for ln in dispatch_lines)
        header_weight = float(d.total_weight_kg or 0.0)

        # Check 1: Header vs line total
        if abs(sum_lines - header_weight) > DISPATCH_WEIGHT_MISMATCH_THRESHOLD_KG:
            signals.append({
                "signal_type": "dispatch_weight_mismatch",
                "severity": "high",
                "confidence": "direct",
                "dispatch_id": d.id,
                "dispatch_number": d.dispatch_number,
                "header_weight_kg": round(header_weight, 2),
                "line_total_kg": round(sum_lines, 2),
                "delta_kg": round(abs(sum_lines - header_weight), 2),
                "evidence_summary": f"Dispatch {d.dispatch_number}: header {header_weight:.1f}kg ≠ sum of lines {sum_lines:.1f}kg",
                "recommended_action": "Review dispatch lines and correct weight mismatch.",
            })

        # Check 2: Impossible timestamps (exit before entry)
        if d.entry_time and d.exit_time and d.exit_time < d.entry_time:
            signals.append({
                "signal_type": "impossible_dispatch_timing",
                "severity": "high",
                "confidence": "direct",
                "dispatch_id": d.id,
                "dispatch_number": d.dispatch_number,
                "entry_time": d.entry_time.isoformat() if d.entry_time else None,
                "exit_time": d.exit_time.isoformat() if d.exit_time else None,
                "evidence_summary": f"Dispatch {d.dispatch_number}: exit {d.exit_time} before entry {d.entry_time}",
                "recommended_action": "Verify gate pass timestamps.",
            })

        # Check 3: Delivered but no delivered_at
        if d.status == "delivered" and d.delivered_at is None:
            signals.append({
                "signal_type": "delivered_no_timestamp",
                "severity": "medium",
                "confidence": "direct",
                "dispatch_id": d.id,
                "dispatch_number": d.dispatch_number,
                "status": d.status,
                "evidence_summary": f"Dispatch {d.dispatch_number} marked delivered but no delivered_at timestamp.",
                "recommended_action": "Update delivery timestamp or correct dispatch status.",
            })

        # Check 4: Suspiciously fast delivery
        if d.created_at and d.delivered_at:
            duration = (d.delivered_at - d.created_at).total_seconds()
            if duration > 0 and duration < DISPATCH_AFTER_TIMING_SECONDS:
                signals.append({
                    "signal_type": "suspiciously_fast_dispatch",
                    "severity": "high",
                    "confidence": "derived",
                    "dispatch_id": d.id,
                    "dispatch_number": d.dispatch_number,
                    "duration_seconds": round(duration),
                    "evidence_summary": f"Dispatch {d.dispatch_number} delivered {duration:.0f}s after creation.",
                    "recommended_action": "Verify dispatch timeline and delivery proof.",
                })

    signals.sort(key=lambda s: s.get("delta_kg", 0) if isinstance(s.get("delta_kg"), (int, float)) else 0, reverse=True)

    return {
        "signals": signals[:20],
        "total_signals": len(signals),
        "data_quality": "direct" if dispatches else "insufficient_data",
    }


# ── Section 3: Transaction Anomalies ────────────────────────────────────────

def _build_transaction_anomalies(
    db: Session,
    factory_id: str,
    cutoff: date,
) -> dict[str, Any]:
    """Detect suspicious inventory transactions."""
    transactions = (
        db.query(SteelInventoryTransaction)
        .filter(
            SteelInventoryTransaction.factory_id == factory_id,
            SteelInventoryTransaction.created_at >= cutoff,
        )
        .all()
    )

    signals: list[dict[str, Any]] = []

    # Group by user for burst detection
    user_txn: dict[int | None, list[SteelInventoryTransaction]] = defaultdict(list)
    for t in transactions:
        user_txn[t.created_by_user_id].append(t)

    # Check 1: Reference-less manual adjustments
    ref_less = [t for t in transactions if t.transaction_type == "adjustment" and not t.reference_type]
    for t in ref_less[:10]:
        qty = float(t.quantity_kg or 0.0)
        if abs(qty) > MISSING_INVENTORY_THRESHOLD_KG:
            signals.append({
                "signal_type": "reference_less_adjustment",
                "severity": "high" if abs(qty) > MISSING_INVENTORY_THRESHOLD_KG * 10 else "medium",
                "confidence": "direct",
                "transaction_id": t.id,
                "quantity_kg": round(qty, 2),
                "direction": t.direction,
                "item_id": t.item_id,
                "created_by_user_id": t.created_by_user_id,
                "evidence_summary": f"Adjustment of {qty:.1f}kg without reconciliation or dispatch reference.",
                "recommended_action": "Verify adjustment reason and link to supporting document.",
            })

    # Check 2: Large round-number transactions
    for t in transactions:
        qty = float(t.quantity_kg or 0.0)
        if abs(qty) >= 1000.0 and qty == round(qty, 0):
            signals.append({
                "signal_type": "suspicious_round_quantity",
                "severity": "medium",
                "confidence": "proxy",
                "transaction_id": t.id,
                "quantity_kg": round(qty, 2),
                "transaction_type": t.transaction_type,
                "created_by_user_id": t.created_by_user_id,
                "evidence_summary": f"Transaction of exactly {qty:.0f}kg (round number) — type: {t.transaction_type}",
                "recommended_action": "Verify transaction against physical movement.",
            })

    # Check 3: Burst of manual adjustments by same user
    for user_id, txns in user_txn.items():
        if user_id is None or len(txns) < TRANSACTION_REFERENCE_MINIMUM:
            continue
        adjustments = [t for t in txns if t.transaction_type == "adjustment" and not t.reference_type]
        if len(adjustments) >= TRANSACTION_REFERENCE_MINIMUM:
            total_qty = sum(abs(float(t.quantity_kg or 0.0)) for t in adjustments)
            signals.append({
                "signal_type": "adjustment_burst",
                "severity": "high" if len(adjustments) >= 10 else "medium",
                "confidence": "derived",
                "user_id": user_id,
                "adjustment_count": len(adjustments),
                "total_quantity_kg": round(total_qty, 2),
                "evidence_summary": f"User {user_id}: {len(adjustments)} reference-less adjustments in period (total {total_qty:.1f}kg).",
                "recommended_action": "Review user's adjustment history and assign authorization check.",
            })

    signals.sort(key=lambda s: abs(s.get("quantity_kg", 0)) if isinstance(s.get("quantity_kg"), (int, float)) else 0, reverse=True)

    return {
        "signals": signals[:20],
        "total_signals": len(signals),
        "reference_less_adjustment_count": len(ref_less),
        "adjustment_burst_users": len([u for u, txns in user_txn.items() if u is not None and len([t for t in txns if t.transaction_type == "adjustment" and not t.reference_type]) >= TRANSACTION_REFERENCE_MINIMUM]),
        "data_quality": "direct" if transactions else "insufficient_data",
    }


# ── Section 4: Approval Risk Signals ────────────────────────────────────────

def _build_approval_risk_signals(
    db: Session,
    factory_id: str,
    cutoff: date,
) -> dict[str, Any]:
    """Detect approval pattern anomalies."""
    instances = (
        db.query(ApprovalInstance)
        .filter(
            ApprovalInstance.factory_id == factory_id,
            ApprovalInstance.created_at >= cutoff,
        )
        .all()
    )

    signals: list[dict[str, Any]] = []

    if not instances:
        return {"signals": [], "total_signals": 0, "data_quality": "insufficient_data"}

    # Check 1: Too-fast approvals
    for inst in instances:
        if inst.created_at and inst.completed_at and inst.status in ("approved", "rejected"):
            duration = (inst.completed_at - inst.created_at).total_seconds() / 60.0
            if 0 < duration < APPROVAL_FAST_THRESHOLD_MINUTES:
                signals.append({
                    "signal_type": "approval_too_fast",
                    "severity": "medium",
                    "confidence": "derived",
                    "instance_id": inst.instance_id,
                    "workflow_key": inst.workflow_key,
                    "resource_type": inst.resource_type,
                    "duration_minutes": round(duration, 1),
                    "actor_user_id": inst.actor_user_id,
                    "approved_by_user_id": inst.approved_by_user_id,
                    "evidence_summary": f"{inst.workflow_key} for {inst.resource_type} #{inst.resource_id} approved in {duration:.1f} minutes.",
                    "recommended_action": "Review if sufficient due diligence was done for this approval.",
                })

    # Check 2: Maker-checker pair dominance
    pair_counts: dict[tuple[int | None, int | None], int] = defaultdict(int)
    for inst in instances:
        if inst.actor_user_id and inst.approved_by_user_id:
            pair = (inst.actor_user_id, inst.approved_by_user_id)
            pair_counts[pair] += 1

    if pair_counts:
        total = sum(pair_counts.values())
        for pair, count in pair_counts.items():
            pct = count / total * 100
            if pct >= APPROVAL_DOMINANCE_THRESHOLD_PCT and count >= 3:
                signals.append({
                    "signal_type": "maker_checker_dominance",
                    "severity": "medium",
                    "confidence": "derived",
                    "maker_user_id": pair[0],
                    "checker_user_id": pair[1],
                    "pair_count": count,
                    "pair_percent": round(pct, 1),
                    "evidence_summary": f"Maker {pair[0]} → Checker {pair[1]} accounts for {count}/{total} approvals ({pct:.0f}%).",
                    "recommended_action": "Review if approval segregation is effective.",
                })

    # Check 3: Sensitive workflow concentration
    sensitive_workflows = {"user.role.assign", "user.deactivate", "invoice.record.void", "billing.plan.downgrade", "dispatch.record.cancel"}
    workflow_actor_counts: dict[str, dict[int, int]] = defaultdict(lambda: defaultdict(int))
    for inst in instances:
        if inst.workflow_key in sensitive_workflows and inst.approved_by_user_id:
            workflow_actor_counts[inst.workflow_key][inst.approved_by_user_id] += 1

    for wf, actors in workflow_actor_counts.items():
        total_for_wf = sum(actors.values())
        for user_id, count in actors.items():
            pct = count / total_for_wf * 100
            if pct >= APPROVAL_DOMINANCE_THRESHOLD_PCT and count >= 2:
                signals.append({
                    "signal_type": "sensitive_workflow_concentration",
                    "severity": "high",
                    "confidence": "derived",
                    "workflow_key": wf,
                    "user_id": user_id,
                    "approval_count": count,
                    "approval_percent": round(pct, 1),
                    "evidence_summary": f"User {user_id} approved {count}/{total_for_wf} {wf} requests ({pct:.0f}%).",
                    "recommended_action": "Distribute sensitive approvals across multiple authorized approvers.",
                })

    # Check 4: Expiry/escalation abuse
    escalations = [inst for inst in instances if inst.status in ("escalated", "abandoned")]
    if escalations:
        signals.append({
            "signal_type": "expiry_escalation_cluster",
            "severity": "medium",
            "confidence": "direct",
            "escalation_count": len(escalations),
            "evidence_summary": f"{len(escalations)} approvals reached expiry/escalation in the period.",
            "recommended_action": "Review approval TTL settings and approver availability.",
        })

    signals.sort(key=lambda s: s.get("duration_minutes", 0) if isinstance(s.get("duration_minutes"), (int, float)) else 0)

    return {
        "signals": signals[:20],
        "total_signals": len(signals),
        "fast_approval_count": len([s for s in signals if s["signal_type"] == "approval_too_fast"]),
        "dominant_pair_count": len([s for s in signals if s["signal_type"] == "maker_checker_dominance"]),
        "data_quality": "direct" if instances else "insufficient_data",
    }


# ── Section 5: Attendance Risk Signals ──────────────────────────────────

def _build_attendance_risk_signals(
    db: Session,
    factory_id: str,
    cutoff: date,
    today: date,
) -> dict[str, Any]:
    """Detect attendance fraud signals from attendance records and review patterns.

    Detection patterns:
    1. Ghost attendance — status="working" but missing both punch_in and punch_out
    2. Missing punch-out — has punch_in but no punch_out (left without recording)
    3. Suspiciously short attendance — worked_minutes far below shift expectation
    4. Excessive overtime — overtime_minutes well above normal threshold
    5. Chronic lateness — same user with repeated late arrivals
    6. Self-approval — user approving their own attendance (maker-checker violation)
    7. Reviewer concentration — same person approving >70% of reviewed records
    8. Bulk auto-source — large number of auto-source records with no manual review
    9. Never-reviewed records — many records stuck in "auto" review_status
    """
    records = (
        db.query(AttendanceRecord)
        .filter(
            AttendanceRecord.factory_id == factory_id,
            AttendanceRecord.attendance_date >= cutoff,
        )
        .all()
    )

    signals: list[dict[str, Any]] = []

    if not records:
        return {"signals": [], "total_signals": 0, "data_quality": "insufficient_data"}

    total_working = [r for r in records if r.status == "working"]
    total_reviewed = [r for r in records if r.review_status != "auto"]

    # ── Check 1: Ghost attendance (working but no punch in/out) ──────────
    ghost = [r for r in total_working if r.punch_in_at is None and r.punch_out_at is None]
    for r in ghost[:5]:
        signals.append({
            "signal_type": "ghost_attendance",
            "severity": "high",
            "confidence": "direct",
            "user_id": r.user_id,
            "attendance_date": r.attendance_date.isoformat(),
            "shift": r.shift,
            "source": r.source,
            "worked_minutes": r.worked_minutes,
            "evidence_summary": f"User {r.user_id} marked 'working' on {r.attendance_date} ({r.shift}) but has no punch in/out times.",
            "recommended_action": "Verify if the employee actually reported for duty on this date.",
        })

    # ── Check 2: Missing punch-out (has punch-in but no punch-out) ──────
    missing_out = [r for r in total_working if r.punch_in_at is not None and r.punch_out_at is None]
    for r in missing_out[:5]:
        signals.append({
            "signal_type": "missing_punch_out",
            "severity": "medium",
            "confidence": "direct",
            "user_id": r.user_id,
            "attendance_date": r.attendance_date.isoformat(),
            "shift": r.shift,
            "punch_in_at": r.punch_in_at.isoformat() if r.punch_in_at else None,
            "evidence_summary": f"User {r.user_id} punched in on {r.attendance_date} but has no punch-out time.",
            "recommended_action": "Check if employee forgot to punch out or left early without notice.",
        })

    # ── Check 3: Suspiciously short attendance ──────────────────────────
    short = [r for r in total_working if r.worked_minutes > 0 and r.worked_minutes < ATTENDANCE_SHORT_THRESHOLD_MINUTES]
    for r in short[:5]:
        score = min((ATTENDANCE_SHORT_THRESHOLD_MINUTES - r.worked_minutes) / 30.0, 8.0)
        signals.append({
            "signal_type": "suspiciously_short_attendance",
            "severity": _severity_from_score(score),
            "confidence": "derived",
            "user_id": r.user_id,
            "attendance_date": r.attendance_date.isoformat(),
            "shift": r.shift,
            "worked_minutes": r.worked_minutes,
            "evidence_summary": f"User {r.user_id} worked only {r.worked_minutes} min on {r.attendance_date} ({r.shift} shift) — below {ATTENDANCE_SHORT_THRESHOLD_MINUTES} min threshold.",
            "recommended_action": "Verify actual hours worked against shift schedule.",
        })

    # ── Check 4: Excessive overtime ────────────────────────────────────
    high_ot = [r for r in total_working if r.overtime_minutes > ATTENDANCE_EXCESSIVE_OT_THRESHOLD_MINUTES]
    for r in high_ot[:5]:
        score = min(r.overtime_minutes / ATTENDANCE_EXCESSIVE_OT_THRESHOLD_MINUTES * 5.0, 8.0)
        signals.append({
            "signal_type": "excessive_overtime",
            "severity": _severity_from_score(score),
            "confidence": "direct",
            "user_id": r.user_id,
            "attendance_date": r.attendance_date.isoformat(),
            "shift": r.shift,
            "overtime_minutes": r.overtime_minutes,
            "evidence_summary": f"User {r.user_id} logged {r.overtime_minutes} min overtime on {r.attendance_date}.",
            "recommended_action": "Review if overtime was authorized and necessary.",
        })

    # ── Check 5: Chronic lateness ──────────────────────────────────────
    late_users: dict[int, list[AttendanceRecord]] = defaultdict(list)
    for r in records:
        if r.late_minutes > ATTENDANCE_CHRONIC_LATE_THRESHOLD:
            late_users[r.user_id].append(r)
    for user_id, late_records in late_users.items():
        if len(late_records) >= ATTENDANCE_CHRONIC_LATE_MIN_OCCURRENCES:
            avg_late = sum(r.late_minutes for r in late_records) / len(late_records)
            score = min(len(late_records) * 1.5, 7.0)
            signals.append({
                "signal_type": "chronic_lateness",
                "severity": _severity_from_score(score),
                "confidence": "direct",
                "user_id": user_id,
                "late_occurrences": len(late_records),
                "avg_late_minutes": round(avg_late, 0),
                "evidence_summary": f"User {user_id} was late ({late_records[0].late_minutes}+ min) on {len(late_records)} days in the period.",
                "recommended_action": "Discuss attendance expectations and consider disciplinary process if pattern continues.",
            })

    # ── Check 6: Self-approval (maker-checker violation) ────────────────
    self_approved = [r for r in records if r.approved_by_user_id is not None and r.approved_by_user_id == r.user_id]
    if self_approved:
        signals.append({
            "signal_type": "self_approval_attendance",
            "severity": "high",
            "confidence": "direct",
            "self_approval_count": len(self_approved),
            "evidence_summary": f"{len(self_approved)} attendance records were approved by the same user who owns them — maker-checker violation.",
            "recommended_action": "Configure approval workflows to prevent self-approval for attendance.",
        })

    # ── Check 7: Reviewer concentration ────────────────────────────────
    if total_reviewed:
        reviewer_counts: dict[int | None, int] = defaultdict(int)
        for r in total_reviewed:
            reviewer_counts[r.approved_by_user_id] += 1
        total_reviewed_count = len(total_reviewed)
        for reviewer_id, count in reviewer_counts.items():
            if reviewer_id is not None:
                pct = count / total_reviewed_count * 100
                if pct >= ATTENDANCE_REVIEWER_DOMINANCE_THRESHOLD_PCT and count >= 5:
                    signals.append({
                        "signal_type": "attendance_reviewer_concentration",
                        "severity": "medium",
                        "confidence": "direct",
                        "reviewer_user_id": reviewer_id,
                        "review_count": count,
                        "review_percent": round(pct, 1),
                        "evidence_summary": f"Reviewer {reviewer_id} approved {count}/{total_reviewed_count} attendance records ({pct:.0f}%).",
                        "recommended_action": "Distribute attendance reviews across multiple authorized reviewers.",
                    })

    # ── Check 8: Bulk auto-source cluster ─────────────────────────────
    auto_records = [r for r in records if r.source == "auto"]
    if len(auto_records) >= ATTENDANCE_AUTO_CLUSTER_THRESHOLD:
        never_reviewed = [r for r in auto_records if r.review_status == "auto"]
        signals.append({
            "signal_type": "bulk_auto_attendance",
            "severity": "medium",
            "confidence": "derived",
            "auto_count": len(auto_records),
            "never_reviewed_count": len(never_reviewed),
            "evidence_summary": f"{len(auto_records)} attendance records sourced from 'auto' — {len(never_reviewed)} of which were never manually reviewed.",
            "recommended_action": "Review auto-generated attendance records and ensure periodic manual audits.",
        })

    signals.sort(key=lambda s: {"critical": 0, "high": 1, "medium": 2, "low": 3}.get(s.get("severity", "low"), 4))

    # Count unique users involved
    unique_users = set()
    for s in signals:
        uid = s.get("user_id") or s.get("reviewer_user_id")
        if uid is not None:
            unique_users.add(uid)

    return {
        "signals": signals[:20],
        "total_signals": len(signals),
        "ghost_attendance_count": len(ghost),
        "missing_punch_out_count": len(missing_out),
        "short_attendance_count": len(short),
        "excessive_ot_count": len(high_ot),
        "chronic_lateness_users": len(late_users),
        "self_approval_count": len(self_approved),
        "auto_record_count": len(auto_records),
        "unique_users_flagged": len(unique_users),
        "data_quality": "direct" if records else "insufficient_data",
    }


# ── Section 6: Investigation Queue ────────────────────────────────────────

def _build_investigation_queue(
    db: Session,
    factory_id: str,
    cutoff: date,
    inventory_loss: dict[str, Any],
    dispatch_mismatch: dict[str, Any],
    transaction_anomalies: dict[str, Any],
    approval_risk: dict[str, Any],
    attendance_risk: dict[str, Any],
) -> list[dict[str, Any]]:
    """Build a ranked list of items needing investigation across all domains."""
    queue: list[dict[str, Any]] = []

    def _add_signals(signals: list[dict[str, Any]], domain: str) -> None:
        for sig in signals:
            if sig.get("severity") in ("critical", "high"):
                queue.append({
                    "domain": domain,
                    "signal_type": sig.get("signal_type", "unknown"),
                    "severity": sig.get("severity", "high"),
                    "confidence": sig.get("confidence", "derived"),
                    "summary": sig.get("evidence_summary", ""),
                    "recommended_action": sig.get("recommended_action", ""),
                    "resource_type": sig.get("resource_type"),
                    "resource_id": sig.get("instance_id") or sig.get("dispatch_id") or sig.get("transaction_id"),
                    "actor_user_id": sig.get("actor_user_id") or sig.get("user_id") or sig.get("created_by_user_id"),
                })

    _add_signals(inventory_loss.get("signals", []), "inventory")
    _add_signals(dispatch_mismatch.get("signals", []), "dispatch")
    _add_signals(transaction_anomalies.get("signals", []), "transaction")
    _add_signals(approval_risk.get("signals", []), "approval")
    _add_signals(attendance_risk.get("signals", []), "attendance")

    # Add escalations
    escalations = (
        db.query(ApprovalInstance)
        .filter(
            ApprovalInstance.factory_id == factory_id,
            ApprovalInstance.status == "escalated",
            ApprovalInstance.completed_at >= cutoff,
        )
        .all()
    )
    for e in escalations:
        queue.append({
            "domain": "approval",
            "signal_type": "escalated_approval",
            "severity": "high",
            "confidence": "direct",
            "summary": f"Approval {e.instance_id} ({e.workflow_key}) was escalated — exceeded TTL without resolution.",
            "recommended_action": "Review why the approval expired and reassign.",
            "resource_type": e.resource_type,
            "resource_id": e.instance_id,
            "actor_user_id": e.actor_user_id,
        })

    queue.sort(key=lambda x: {"critical": 0, "high": 1, "medium": 2, "low": 3}.get(x.get("severity", "low"), 4))
    return queue[:10]


# ── Section 6: User Behavior Signals ────────────────────────────────────────

def _build_user_behavior_signals(
    db: Session,
    factory_id: str,
    cutoff: date,
    inventory_loss: dict[str, Any],
    dispatch_mismatch: dict[str, Any],
    transaction_anomalies: dict[str, Any],
    approval_risk: dict[str, Any],
    attendance_risk: dict[str, Any],
) -> list[dict[str, Any]]:
    """Score users by risky action concentration."""
    # Collect user IDs from all signal sections
    user_scores: dict[int, dict[str, Any]] = {}

    def _track(user_id: int, signal_type: str, weight: float) -> None:
        if user_id not in user_scores:
            user_scores[user_id] = {
                "user_id": user_id,
                "risk_score": 0.0,
                "signal_counts": defaultdict(int),
                "top_signals": [],
            }
        user_scores[user_id]["risk_score"] += weight
        user_scores[user_id]["signal_counts"][signal_type] += 1

    def _collect_user(sig: dict[str, Any], signal_type: str, weight: float) -> None:
        uid = sig.get("user_id") or sig.get("created_by_user_id") or sig.get("actor_user_id") or sig.get("maker_user_id")
        if uid is not None:
            _track(uid, signal_type, weight)
        # Also track checker if present
        cid = sig.get("checker_user_id") or sig.get("approved_by_user_id")
        if cid is not None:
            _track(cid, signal_type, weight * 0.5)

    for sig in inventory_loss.get("signals", []):
        _collect_user(sig, "inventory_loss", 3.0)
    for sig in dispatch_mismatch.get("signals", []):
        _collect_user(sig, "dispatch_mismatch", 2.5)
    for sig in transaction_anomalies.get("signals", []):
        _collect_user(sig, "transaction_anomaly", 3.0)
    for sig in approval_risk.get("signals", []):
        _collect_user(sig, "approval_risk", 2.0)
    for sig in attendance_risk.get("signals", []):
        _collect_user(sig, "attendance_risk", 2.5)

    # Load user names
    user_ids = list(user_scores.keys())
    user_map: dict[int, User] = {
        u.id: u for u in db.query(User).filter(User.id.in_(user_ids)).all()
    } if user_ids else {}

    profiles: list[dict[str, Any]] = []
    for uid, data in user_scores.items():
        user = user_map.get(uid)
        score = min(data["risk_score"], 100.0)
        band = "critical" if score >= 50 else "high" if score >= 25 else "medium" if score >= 10 else "low"
        top_signals = sorted(data["signal_counts"].items(), key=lambda x: x[1], reverse=True)[:3]
        profiles.append({
            "user_id": uid,
            "display_name": user.name if user else f"User {uid}",
            "risk_score": round(score, 1),
            "risk_band": band,
            "top_signals": [f"{count}x {stype.replace('_', ' ')}" for stype, count in top_signals],
            "confidence": "derived",
        })

    profiles.sort(key=lambda p: p["risk_score"], reverse=True)
    return profiles[:20]


# ── Summary ─────────────────────────────────────────────────────────────────

def _build_fraud_summary(
    inventory_loss: dict[str, Any],
    dispatch_mismatch: dict[str, Any],
    transaction_anomalies: dict[str, Any],
    approval_risk: dict[str, Any],
    attendance_risk: dict[str, Any],
    investigation_queue: list[dict[str, Any]],
) -> dict[str, Any]:
    """High-level fraud intelligence KPIs."""
    all_signals = (
        inventory_loss.get("signals", [])
        + dispatch_mismatch.get("signals", [])
        + transaction_anomalies.get("signals", [])
        + approval_risk.get("signals", [])
        + attendance_risk.get("signals", [])
    )
    critical = sum(1 for s in all_signals if s.get("severity") == "critical")
    high = sum(1 for s in all_signals if s.get("severity") == "high")
    medium = sum(1 for s in all_signals if s.get("severity") == "medium")

    return {
        "total_signals": len(all_signals),
        "critical_count": critical,
        "high_count": high,
        "medium_count": medium,
        "inventory_loss_count": inventory_loss.get("total_signals", 0),
        "dispatch_mismatch_count": dispatch_mismatch.get("total_signals", 0),
        "transaction_anomaly_count": transaction_anomalies.get("total_signals", 0),
        "approval_risk_count": approval_risk.get("total_signals", 0),
        "attendance_risk_count": attendance_risk.get("total_signals", 0),
        "investigation_queue_count": len(investigation_queue),
        "data_quality": "active" if all_signals else "no_signals_detected",
    }


# ── Data Confidence ─────────────────────────────────────────────────────────

def _build_fraud_confidence(
    db: Session,
    factory_id: str,
    cutoff: date,
) -> dict[str, Any]:
    """Report which fraud detection dimensions are available."""
    has_reconciliation = db.query(SteelStockReconciliation).filter(
        SteelStockReconciliation.factory_id == factory_id,
        SteelStockReconciliation.counted_at >= cutoff,
    ).first() is not None

    has_dispatch = db.query(SteelDispatch).filter(
        SteelDispatch.factory_id == factory_id,
        SteelDispatch.dispatch_date >= cutoff,
    ).first() is not None

    has_transactions = db.query(SteelInventoryTransaction).filter(
        SteelInventoryTransaction.factory_id == factory_id,
        SteelInventoryTransaction.created_at >= cutoff,
    ).first() is not None

    has_approvals = db.query(ApprovalInstance).filter(
        ApprovalInstance.factory_id == factory_id,
        ApprovalInstance.created_at >= cutoff,
    ).first() is not None

    has_attendance = db.query(AttendanceRecord).filter(
        AttendanceRecord.factory_id == factory_id,
        AttendanceRecord.attendance_date >= cutoff,
    ).first() is not None

    return {
        "inventory_reconciliation_signals": "direct" if has_reconciliation else "unavailable",
        "dispatch_mismatch_signals": "direct" if has_dispatch else "unavailable",
        "transaction_reference_quality": "partial" if has_transactions else "unavailable",
        "approval_behavior_signals": "direct" if has_approvals else "unavailable",
        "attendance_risk_signals": "direct" if has_attendance else "unavailable",
        "user_behavior_profiling": "derived" if has_approvals or has_transactions else "unavailable",
        "theft_confirmation": "not_supported",
        "financial_valuation": "estimated_current_rate" if has_reconciliation else "no_data",
        "missing_fields": [
            field
            for field, present in [
                ("weighbridge.actual_weight", False),
                ("stock_transfer.entity", False),
                ("dispatch.pod_verification", False),
                ("approval.mfa_evidence", False),
                ("attendance.location_confidence", False),
                ("fraud_case_management", False),
            ]
            if not present
        ],
    }


# ── Redaction Helpers ───────────────────────────────────────────────────────

def _redact_financials(section: dict[str, Any]) -> dict[str, Any]:
    """Set all financial fields to None in a section."""
    for sig in section.get("signals", []):
        sig["estimated_loss_inr"] = None
    return section


def _redact_financials_signal(sig: dict[str, Any]) -> dict[str, Any]:
    """Set financial fields to None in a single signal dict."""
    sig["estimated_loss_inr"] = None
    return sig


def _redact_user_details(profiles: list[dict[str, Any]]) -> list[dict[str, Any]]:
    """Anonymize user identifiers in behavior profiles."""
    for p in profiles:
        p["display_name"] = f"User #{p['user_id']}"
    return profiles


def _redact_user_details_signal(sig: dict[str, Any]) -> dict[str, Any]:
    """Anonymize user identifiers in a single signal."""
    for key in ("actor_user_id", "user_id", "maker_user_id", "checker_user_id", "created_by_user_id", "approved_by_user_id"):
        if key in sig and sig[key] is not None:
            sig[key] = None
    return sig


def _redact_user_details_in_signals(section: dict[str, Any]) -> dict[str, Any]:
    """Anonymize user identifiers in all signals within a section."""
    for sig in section.get("signals", []):
        _redact_user_details_signal(sig)
    return section
