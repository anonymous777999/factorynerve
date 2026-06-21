"""Approval completion callbacks — automatically fire when advance_approval completes.

Phase P3: Each workflow key has a registered callback that executes the
appropriate business logic when an approval instance reaches a terminal state
(approved or rejected). This replaces the Phase P1/P2 pattern of calling
complete_approval() manually in router handlers.

Callback signature:
    (db: Session, instance: dict[str, Any]) -> None

The callback receives the active database session and the ApprovalInstance dict.
It should perform all business logic needed (status changes, audit logs, etc.)
and call db.commit() to persist the changes.
"""

from __future__ import annotations

import logging
from datetime import datetime, timezone
from typing import Any

from sqlalchemy.orm import Session

from backend.models.entry import Entry
from backend.models.report import AuditLog
from backend.models.steel_stock_reconciliation import SteelStockReconciliation
from backend.models.steel_inventory_transaction import SteelInventoryTransaction
from backend.models.steel_customer import SteelCustomer
from backend.models.steel_dispatch import SteelDispatch
from backend.models.attendance_record import AttendanceRecord

logger = logging.getLogger(__name__)


# ── Helpers ───────────────────────────────────────────────────────────────


def _write_audit(
    db: Session,
    *,
    user_id: int | None,
    org_id: str | None,
    factory_id: str | None,
    action: str,
    details: str,
) -> None:
    """Write an audit log entry."""
    db.add(
        AuditLog(
            user_id=user_id,
            org_id=org_id,
            factory_id=factory_id,
            action=action,
            details=details,
            ip_address=None,
            timestamp=datetime.now(timezone.utc),
        )
    )


# ── Steel Callbacks ───────────────────────────────────────────────────────


def _on_reconciliation_completed(db: Session, instance: dict[str, Any]) -> None:
    """Update reconciliation status when approval completes."""
    resource_id = instance.get("resource_id")
    requested_change = instance.get("requested_change") or {}
    new_status = requested_change.get("new_status", "approved")
    org_id = instance.get("org_id")
    factory_id = instance.get("factory_id")
    actor_user_id = (
        instance.get("approved_by_user_id")
        or instance.get("rejected_by_user_id")
        or instance.get("actor_user_id")  # Fallback for bypass path
    )

    if not resource_id:
        logger.warning("on_reconciliation_completed: no resource_id")
        return

    try:
        recon_id = int(resource_id)
    except (ValueError, TypeError):
        logger.warning("on_reconciliation_completed: invalid resource_id=%s", resource_id)
        return

    row = db.query(SteelStockReconciliation).filter(SteelStockReconciliation.id == recon_id).first()
    if not row:
        logger.warning("on_reconciliation_completed: reconciliation %s not found", recon_id)
        return

    if new_status == "approved":
        row.status = "approved"
        row.approved_by_user_id = actor_user_id
        row.approved_at = datetime.now(timezone.utc)

        # Create inventory adjustment transaction for variance (idempotent:
        # skip if a transaction with the same reference already exists)
        if abs(float(row.variance_kg or 0.0)) > 0.0001:
            existing_txn = (
                db.query(SteelInventoryTransaction)
                .filter(
                    SteelInventoryTransaction.reference_type == "steel_reconciliation",
                    SteelInventoryTransaction.reference_id == str(row.id),
                )
                .first()
            )
            if existing_txn is None:
                mismatch_cause = row.mismatch_cause or "other"
                db.add(
                    SteelInventoryTransaction(
                        org_id=row.org_id,
                        factory_id=row.factory_id,
                        item_id=row.item_id,
                        transaction_type="adjustment",
                        quantity_kg=float(row.variance_kg),
                        reference_type="steel_reconciliation",
                        reference_id=str(row.id),
                        notes=f"Ledger correction from reconciliation #{row.id} ({mismatch_cause})",
                        created_by_user_id=actor_user_id,
                    )
                )

        _write_audit(
            db,
            user_id=actor_user_id,
            org_id=org_id,
            factory_id=factory_id,
            action="STEEL_STOCK_RECONCILIATION_APPROVED",
            details=f"reconciliation_id={row.id} item_id={row.item_id} variance_kg={float(row.variance_kg or 0.0):.3f}",
        )
    elif new_status == "rejected":
        row.status = "rejected"
        row.rejected_by_user_id = actor_user_id
        row.rejected_at = datetime.now(timezone.utc)

        _write_audit(
            db,
            user_id=actor_user_id,
            org_id=org_id,
            factory_id=factory_id,
            action="STEEL_STOCK_RECONCILIATION_REJECTED",
            details=f"reconciliation_id={row.id} item_id={row.item_id}",
        )

    db.flush()


def _on_customer_verification_completed(db: Session, instance: dict[str, Any]) -> None:
    """Update customer verification status when approval completes."""
    resource_id = instance.get("resource_id")
    requested_change = instance.get("requested_change") or {}
    decision = requested_change.get("decision", "approve")
    actor_user_id = (
        instance.get("approved_by_user_id")
        or instance.get("rejected_by_user_id")
        or instance.get("actor_user_id")  # Fallback for bypass path
    )

    if not resource_id:
        return

    try:
        customer_id = int(resource_id)
    except (ValueError, TypeError):
        return

    customer = db.query(SteelCustomer).filter(SteelCustomer.id == customer_id).first()
    if not customer:
        logger.warning("on_customer_verification_completed: customer %s not found", customer_id)
        return

    if decision == "approve":
        customer.verification_status = "verified"
        customer.verified_by_user_id = actor_user_id
        customer.verified_at = datetime.now(timezone.utc)
        customer.mismatch_reason = None
    else:
        customer.verification_status = "rejected"
        customer.verified_by_user_id = None
        customer.verified_at = None

    _write_audit(
        db,
        user_id=actor_user_id,
        org_id=instance.get("org_id"),
        factory_id=instance.get("factory_id"),
        action="STEEL_CUSTOMER_VERIFICATION_REVIEWED",
        details=f"customer_id={customer.id} decision={decision} status={customer.verification_status}",
    )
    db.flush()


def _on_dispatch_status_completed(db: Session, instance: dict[str, Any]) -> None:
    """Update dispatch status when approval completes."""
    resource_id = instance.get("resource_id")
    requested_change = instance.get("requested_change") or {}
    new_status = requested_change.get("new_status")
    actor_user_id = (
        instance.get("approved_by_user_id")
        or instance.get("rejected_by_user_id")
        or instance.get("actor_user_id")  # Fallback for bypass path
    )

    if not resource_id or not new_status:
        return

    # Rejection means the dispatch status update was rejected - no action needed
    if instance.get("status") == "rejected":
        logger.info("on_dispatch_status_completed: dispatch %s status change was rejected", resource_id)
        return

    try:
        dispatch_id = int(resource_id)
    except (ValueError, TypeError):
        return

    dispatch = db.query(SteelDispatch).filter(SteelDispatch.id == dispatch_id).first()
    if not dispatch:
        logger.warning("on_dispatch_status_completed: dispatch %s not found", dispatch_id)
        return

    dispatch.status = new_status
    if new_status == "delivered":
        dispatch.delivered_at = datetime.now(timezone.utc)
        dispatch.delivered_by_user_id = actor_user_id

    _write_audit(
        db,
        user_id=actor_user_id,
        org_id=instance.get("org_id"),
        factory_id=instance.get("factory_id"),
        action="STEEL_DISPATCH_STATUS_UPDATED",
        details=f"dispatch={dispatch.dispatch_number} status={new_status}",
    )
    db.flush()


# ── Entry Callbacks ────────────────────────────────────────────────────────


def _on_entry_completed(db: Session, instance: dict[str, Any]) -> None:
    """Update entry status when approval completes."""
    resource_id = instance.get("resource_id")
    requested_change = instance.get("requested_change") or {}
    new_status = requested_change.get("new_status", "approved")
    actor_user_id = (
        instance.get("approved_by_user_id")
        or instance.get("rejected_by_user_id")
        or instance.get("actor_user_id")  # Fallback for bypass path
    )

    if not resource_id:
        return

    try:
        entry_id = int(resource_id)
    except (ValueError, TypeError):
        return

    entry = db.query(Entry).filter(Entry.id == entry_id).first()
    if not entry:
        logger.warning("on_entry_completed: entry %s not found", entry_id)
        return

    entry.status = new_status

    _write_audit(
        db,
        user_id=actor_user_id,
        org_id=instance.get("org_id"),
        factory_id=instance.get("factory_id"),
        action=f"ENTRY_{new_status.upper()}",
        details=f"entry_id={entry.id} status={new_status}",
    )
    db.flush()


# ── Fallback Logger ───────────────────────────────────────────────────────


def _on_attendance_review_completed(db: Session, instance: dict[str, Any]) -> None:
    """Update attendance record review_status when approval completes."""
    resource_id = instance.get("resource_id")
    new_status_terminal = instance.get("status")  # "approved" or "rejected"
    if not resource_id or not new_status_terminal:
        return
    try:
        record_id = int(resource_id)
    except (ValueError, TypeError):
        return
    record = db.query(AttendanceRecord).filter(AttendanceRecord.id == record_id).first()
    if not record:
        logger.warning("on_attendance_review_completed: record %s not found", record_id)
        return
    record.review_status = new_status_terminal
    if new_status_terminal == "approved":
        record.approved_by_user_id = (
            instance.get("approved_by_user_id") or instance.get("actor_user_id")
        )
        record.approved_at = datetime.now(timezone.utc)
    _write_audit(
        db,
        user_id=instance.get("approved_by_user_id") or instance.get("actor_user_id"),
        org_id=instance.get("org_id"),
        factory_id=instance.get("factory_id"),
        action=f"ATTENDANCE_REVIEW_{new_status_terminal.upper()}",
        details=f"attendance_id={record.id} status={new_status_terminal}",
    )
    db.flush()


def _on_generic_completed(db: Session, instance: dict[str, Any]) -> None:
    """Fallback callback for workflow keys without a specific handler."""
    workflow_key = instance.get("workflow_key", "unknown")
    resource_type = instance.get("resource_type", "unknown")
    resource_id = instance.get("resource_id", "unknown")
    final_status = instance.get("status", "unknown")

    logger.info(
        "Approval completed: workflow=%s resource=%s/%s status=%s",
        workflow_key,
        resource_type,
        resource_id,
        final_status,
    )


# ── Callback Registry ─────────────────────────────────────────────────────

# Map of workflow_key -> callback function
APPROVAL_CALLBACKS: dict[str, Any] = {
    # Steel
    "inventory.reconciliation.approve": _on_reconciliation_completed,
    "inventory.reconciliation.reject": _on_reconciliation_completed,
    "customer.verification.review": _on_customer_verification_completed,
    "dispatch.status.update": _on_dispatch_status_completed,
    # Production entries
    "production.entry.approve": _on_entry_completed,
    "production.entry.delete": _on_entry_completed,
    # Fallback for all registered workflow keys not listed above
    "production.batch.variance.approve": _on_generic_completed,
    "invoice.record.edit_pre_dispatch": _on_generic_completed,
    "invoice.record.edit_post_dispatch": _on_generic_completed,
    "invoice.record.void": _on_generic_completed,
    "payment.record.create": _on_generic_completed,
    "payment.record.reallocate": _on_generic_completed,
    "payment.record.reverse": _on_generic_completed,
    # Attendance — update record.review_status on completion
    "attendance.review.approve": _on_attendance_review_completed,
    "attendance.review.reject": _on_attendance_review_completed,
    # OCR
    "ocr.verification.approve": _on_generic_completed,
    "ocr.verification.reject": _on_generic_completed,
    # Settings
    "factory.create": _on_generic_completed,
    "user.invite": _on_generic_completed,
    "user.role.assign": _on_generic_completed,
    "user.membership.assign": _on_generic_completed,
    "user.deactivate": _on_generic_completed,
    # Billing
    "billing.plan.downgrade": _on_generic_completed,
    "billing.plan.change": _on_generic_completed,
}


def register_all_callbacks() -> None:
    """Register all approval callbacks with the central ApprovalService.

    Called during application startup (main.py lifespan).
    """
    from backend.services.approval_service import approval_service

    for workflow_key, callback in APPROVAL_CALLBACKS.items():
        approval_service.register_callback(workflow_key, callback)

    logger.info("Registered %d approval completion callbacks", len(APPROVAL_CALLBACKS))
