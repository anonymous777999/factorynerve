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
import os
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
from backend.models.user import User
from backend.models.user_factory_role import UserFactoryRole

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


def _on_user_deactivate_completed(db: Session, instance: dict[str, Any]) -> None:
    """Deactivate the user when approval completes."""
    resource_id = instance.get("resource_id")
    actor_user_id = (
        instance.get("approved_by_user_id")
        or instance.get("rejected_by_user_id")
        or instance.get("actor_user_id")
    )
    final_status = instance.get("status")

    if not resource_id:
        return

    try:
        user_id = int(resource_id)
    except (ValueError, TypeError):
        return

    from backend.models.user import User
    user = db.query(User).filter(User.id == user_id).first()
    if not user:
        logger.warning("on_user_deactivate_completed: user %s not found", user_id)
        return

    if final_status == "approved":
        user.is_active = False
        user.profile_picture = None
        # Revoke all v2 sessions so the user is immediately logged out
        try:
            from backend.models.auth_user import AuthUser
            from backend.auth_security.sessions import revoke_all_sessions as _revoke_sessions
            _auth = db.query(AuthUser).filter(
                AuthUser.email == user.email,
                AuthUser.is_active.is_(True),
            ).first()
            if _auth:
                _revoke_sessions(db, user_id=_auth.id)
        except Exception:
            logger.exception("Failed to revoke sessions for deactivated user %s", user_id)
        logger.info("User %s deactivated via approval completion", user_id)

    _write_audit(
        db,
        user_id=actor_user_id,
        org_id=instance.get("org_id"),
        factory_id=instance.get("factory_id"),
        action=f"USER_DEACTIVATED_VIA_APPROVAL_{final_status.upper()}",
        details=f"user_id={user.id} role={user.role.value} status={final_status}",
    )
    db.flush()


def _on_user_reactivate_completed(db: Session, instance: dict[str, Any]) -> None:
    """Reactivate a user when the approval completes."""
    resource_id = instance.get("resource_id")
    actor_user_id = (
        instance.get("approved_by_user_id")
        or instance.get("rejected_by_user_id")
        or instance.get("actor_user_id")
    )
    final_status = instance.get("status")

    if not resource_id:
        return

    try:
        user_id = int(resource_id)
    except (ValueError, TypeError):
        return

    user = db.query(User).filter(User.id == user_id).first()
    if not user:
        logger.warning("on_user_reactivate_completed: user %s not found", user_id)
        return

    if final_status != "approved":
        logger.info("User %s reactivation was %s — no action taken.", user_id, final_status)
        _write_audit(
            db,
            user_id=actor_user_id,
            org_id=instance.get("org_id"),
            factory_id=instance.get("factory_id"),
            action=f"USER_REACTIVATE_{final_status.upper()}",
            details=f"user_id={user.id} email={user.email} status={final_status}",
        )
        db.flush()
        return

    # ── Approval granted — reactivate ─────────────────────────────────
    user.is_active = True
    logger.info("User %s reactivated via approval completion", user_id)

    _write_audit(
        db,
        user_id=actor_user_id,
        org_id=instance.get("org_id"),
        factory_id=instance.get("factory_id"),
        action="USER_REACTIVATED_VIA_APPROVAL",
        details=f"user_id={user.id} email={user.email} role={user.role.value}",
    )
    db.flush()

    # Send notification email (best-effort)
    try:
        from backend.email_utils import queue_and_send_email
        queue_and_send_email(
            to_emails=[user.email],
            subject="Your FactoryNerve account has been reactivated",
            body=(
                f"Hi {user.name},\n\n"
                f"Your FactoryNerve account has been reactivated.\n\n"
                "You can now log in with your existing credentials.\n\n"
                f"Login page: {os.getenv('FRONTEND_URL', 'https://dpr.ai')}/login\n"
            ),
            user_id=user.id,
            factory_name=user.factory_name,
        )
    except Exception:
        logger.exception("Failed to send reactivation notification email to %s", user.email)


def _on_user_invite_completed(db: Session, instance: dict[str, Any]) -> None:
    """Create the invited user when the approval completes.

    Reads the invitation data from ``requested_change`` (email, name, role)
    and the resource_id for additional context.  On approval, creates the
    User record, assigns a UserFactoryRole, and sends an invitation email.
    On rejection, simply logs the outcome.
    """
    resource_id = instance.get("resource_id", "")
    requested_change = instance.get("requested_change") or {}
    final_status = instance.get("status", "unknown")
    org_id = instance.get("org_id")
    factory_id = instance.get("factory_id")
    actor_user_id = (
        instance.get("approved_by_user_id")
        or instance.get("rejected_by_user_id")
        or instance.get("actor_user_id")
    )

    email = (requested_change.get("email") or "").lower().strip()
    name = requested_change.get("name", "Invited User")
    role_value = requested_change.get("role", "attendance")

    if not email:
        logger.warning("on_user_invite_completed: no email in requested_change")
        return

    if final_status != "approved":
        logger.info(
            "User invitation for %s was %s (resource=%s) — no user created.",
            email, final_status, resource_id,
        )
        _write_audit(
            db,
            user_id=actor_user_id,
            org_id=org_id,
            factory_id=factory_id,
            action=f"USER_INVITE_{final_status.upper()}",
            details=f"invite_email={email} role={role_value} resource={resource_id}",
        )
        db.flush()
        return

    # ── Approval granted — create the user ─────────────────────────────
    from backend.security import hash_password
    from backend.services.user_code_service import next_user_code, is_user_code_collision, MAX_USER_CODE_ATTEMPTS
    import secrets

    # Guard: skip if user already exists (idempotent)
    existing = db.query(User).filter(User.email == email).first()
    if existing:
        logger.info("on_user_invite_completed: user %s already exists — skipping creation", email)
        return

    from backend.models.factory import Factory
    factory = db.query(Factory).filter(Factory.factory_id == factory_id, Factory.is_active.is_(True)).first()
    if not factory:
        logger.warning("on_user_invite_completed: factory %s not found", factory_id)
        return

    from backend.models.user import UserRole
    try:
        role_enum = UserRole(role_value)
    except ValueError:
        logger.warning("on_user_invite_completed: invalid role=%s", role_value)
        return

    temp_password = secrets.token_urlsafe(16)
    now = datetime.now(timezone.utc)

    user = User(
        org_id=org_id,
        name=name,
        email=email,
        password_hash=hash_password(temp_password),
        role=role_enum,
        factory_name=factory.name,
        factory_code=factory.factory_code,
        is_active=True,
        email_verified_at=now,
    )

    # Generate unique user_code
    from sqlalchemy.exc import IntegrityError
    last_error: IntegrityError | None = None
    for _ in range(MAX_USER_CODE_ATTEMPTS):
        user.user_code = next_user_code(db, org_id=org_id)
        try:
            with db.begin_nested():
                db.add(user)
                db.flush()
            break
        except IntegrityError as error:
            last_error = error
            if not is_user_code_collision(error):
                raise
    else:
        logger.error("on_user_invite_completed: failed to generate user_code for %s", email)
        return

    # Assign factory role
    db.add(UserFactoryRole(
        user_id=user.id,
        factory_id=factory_id,
        org_id=org_id,
        role=role_enum,
    ))

    _write_audit(
        db,
        user_id=actor_user_id,
        org_id=org_id,
        factory_id=factory_id,
        action="USER_INVITE_CREATED",
        details=f"user_id={user.id} email={email} role={role_value}",
    )

    db.flush()

    # Send invitation email (best-effort — do not block on failure)
    try:
        from backend.email_utils import queue_and_send_email
        queue_and_send_email(
            to_emails=[email],
            subject="You've been invited to join FactoryNerve",
            body=(
                f"You've been invited to join {factory.name} on FactoryNerve.\n\n"
                f"Your account has been created with the role: {role_value}.\n\n"
                f"Temporary password: {temp_password}\n\n"
                "Please log in and change your password immediately.\n\n"
                f"Login page: {os.getenv('FRONTEND_URL', 'https://dpr.ai')}/login\n"
            ),
            user_id=user.id,
            factory_name=factory.name,
        )
    except Exception:
        logger.exception("Failed to send invitation email to %s", email)

    logger.info("User %s (%s) created via approval callback with role=%s", name, email, role_value)


def _on_dispatch_create_completed(db: Session, instance: dict[str, Any]) -> None:
    """Create inventory movements when a dispatch creation is approved.

    Reads the dispatch resource_id from the approval instance and posts
    inventory transactions for each dispatch line. Idempotent: skips if
    inventory has already been posted for this dispatch.
    """
    resource_id = instance.get("resource_id")
    final_status = instance.get("status")

    if not resource_id:
        return

    # Rejection means no inventory action needed
    if final_status == "rejected":
        logger.info("on_dispatch_create_completed: dispatch %s creation was rejected", resource_id)
        return

    # Try to parse the dispatch ID from the resource_id (format: "pending-{user_id}-{timestamp}")
    # If it's a pending resource_id, the actual dispatch hasn't been created yet, so
    # the inventory posting happens in the main flow via complete_approval -> _fire_callback.
    # The main create_steel_dispatch() will call complete_approval AFTER creating the
    # dispatch, which fires this callback. At that point, resource_id will be the actual
    # dispatch ID.
    requested_change = instance.get("requested_change") or {}
    # The resource_id is updated to the real dispatch ID by the caller
    # (create_steel_dispatch) after the dispatch is created.
    dispatch_id = instance.get("resource_id")
    if not dispatch_id or dispatch_id.startswith("pending-"):
        return

    actor_user_id = (
        instance.get("approved_by_user_id")
        or instance.get("rejected_by_user_id")
        or instance.get("actor_user_id")
    )

    try:
        d_id = int(dispatch_id)
    except (ValueError, TypeError):
        return

    dispatch = db.query(SteelDispatch).filter(SteelDispatch.id == d_id).first()
    if not dispatch:
        logger.warning("on_dispatch_create_completed: dispatch %s not found", d_id)
        return

    # Idempotent: skip if inventory already posted
    from backend.services.steel_service import coerce_utc_datetime
    if coerce_utc_datetime(dispatch.inventory_posted_at) is not None:
        logger.info("on_dispatch_create_completed: dispatch %s already has inventory posted", d_id)
        return

    # Lock and post inventory movements
    locked = (
        db.query(SteelDispatch)
        .filter(SteelDispatch.id == dispatch.id)
        .with_for_update()
        .first()
    )
    if locked is None or coerce_utc_datetime(locked.inventory_posted_at) is not None:
        return

    # Update dispatch status from "pending" to the final requested status
    # The original status is stored in _final_status by create_steel_dispatch()
    final_status = requested_change.get("_final_status", requested_change.get("status", "dispatched"))
    if locked.status in ("pending", "draft"):
        locked.status = final_status
        _write_audit(
            db,
            user_id=actor_user_id,
            org_id=instance.get("org_id"),
            factory_id=instance.get("factory_id"),
            action="STEEL_DISPATCH_STATUS_FINALIZED",
            details=f"dispatch_id={locked.id} status={final_status} (pending->final on approval)",
        )

    lines = (
        db.query(backend.models.steel_dispatch_line.SteelDispatchLine)
        .filter(backend.models.steel_dispatch_line.SteelDispatchLine.dispatch_id == dispatch.id)
        .all()
    )
    for line in lines:
        db.add(
            backend.models.steel_inventory_transaction.SteelInventoryTransaction(
                org_id=dispatch.org_id,
                factory_id=dispatch.factory_id,
                item_id=line.item_id,
                transaction_type="dispatch_out",
                quantity_kg=-float(line.weight_kg or 0.0),
                reference_type="steel_dispatch",
                reference_id=dispatch.dispatch_number,
                notes=f"Auto-posted on approval for dispatch {dispatch.dispatch_number}",
                created_by_user_id=actor_user_id,
            )
        )
    locked.inventory_posted_at = datetime.now(timezone.utc)

    _write_audit(
        db,
        user_id=actor_user_id,
        org_id=instance.get("org_id"),
        factory_id=instance.get("factory_id"),
        action="STEEL_DISPATCH_INVENTORY_POSTED",
        details=f"dispatch_id={dispatch.id} number={dispatch.dispatch_number} posted via approval",
    )
    db.flush()
    logger.info("Posted inventory movements for dispatch %s via approval callback", dispatch.dispatch_number)


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
    "dispatch.record.create": _on_dispatch_create_completed,
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
    "user.invite": _on_user_invite_completed,
    "user.role.assign": _on_generic_completed,
    "user.membership.assign": _on_generic_completed,
    "user.reactivate": _on_user_reactivate_completed,
    "user.deactivate": _on_user_deactivate_completed,
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
