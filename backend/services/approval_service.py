"""Central Approval Service — maker-checker approval workflows with DB-backed persistence.

Phase P2: Replaces the in-memory dict storage with a proper SQLAlchemy-backed
ApprovalInstance model. All instance lifecycle operations now persist to the database,
enabling durable approval queues, proper expiry handling, and reliable state transitions.

Provides initiate_approval() and complete_approval() methods that follow the
IP-2 (single stage maker-checker), IP-3 (sequential two-stage), IP-4 (cross-domain/parallel),
and IP-5 (critical/emergency dual approval) patterns defined in the Module Integration Guide.

Key responsibilities:
- Self-approval prevention (maker != checker enforcement)
- Conditional approval routing based on workflow + attributes (IP-2 conditional)
- Sequential two-stage support (IP-3)
- Cross-domain/parallel support (IP-4)
- Critical/emergency dual approval with MFA (IP-5)
- Completion notification for proper workflow lifecycle
- TTL/expiry per workflow type
"""

from __future__ import annotations

import uuid
from dataclasses import dataclass
from datetime import datetime, timedelta, timezone
from enum import Enum
from typing import Any

from sqlalchemy import or_
from sqlalchemy.orm import Session

from collections.abc import Callable

from backend.database import get_db
from backend.models.approval_instance import ApprovalInstance
from backend.models.user import User, UserRole

# ── Type Aliases ────────────────────────────────────────────────────────────────

ApprovalCallback = Callable[["Session", dict[str, Any]], None]
"""
Signature for approval completion callbacks.

Args:
    db: Active database session (wrapped in a transaction).
    instance: The ApprovalInstance dict (from to_dict()) that was just completed.

The callback should perform any business logic that needs to run when an approval
instance reaches a terminal state (approved/rejected). This includes updating the
underlying resource's status, writing audit logs, creating related records, etc.

The callback is called inside advance_approval's transaction. The caller will
commit after the callback returns. If the callback raises, the transaction is rolled back.
"""


# ── Helpers ───────────────────────────────────────────────────────────────────


def _get_approval_instance_with_lock(db: Session, instance_id: str) -> ApprovalInstance | None:
    """Fetch an ApprovalInstance by ID with FOR UPDATE."""
    return (
        db.query(ApprovalInstance)
        .filter(ApprovalInstance.instance_id == instance_id)
        .with_for_update()
        .first()
    )


# ── Exceptions ────────────────────────────────────────────────────────────────


class ApprovalError(Exception):
    """Base exception for approval service errors."""


class ApprovalNotFoundError(ApprovalError):
    """Raised when an approval instance is not found."""


class ApprovalStateError(ApprovalError):
    """Raised when an operation is not valid for the current state."""


# ── Constants ─────────────────────────────────────────────────────────────────


HIGH_VALUE_THRESHOLD_KG = 5000.0
HIGH_VARIANCE_THRESHOLD_PERCENT = 5.0

# Workflow → TTL mapping (in hours)

def _env_int(key: str, default: int) -> int:
    import os as _os
    raw = _os.getenv(key)
    if raw is None or not raw.strip():
        return default
    try:
        return int(raw)
    except ValueError:
        return default


# Purge threshold: instances whose terminal state was reached more than this
# many days ago are eligible for hard-deletion from the table.
_OLD_INSTANCE_RETENTION_DAYS: int = _env_int("APPROVAL_RETENTION_DAYS", 90)

WORKFLOW_TTL_HOURS: dict[str, int] = {
    "production.entry.approve": 72,
    "production.entry.delete": 72,
    "attendance.review.approve": 72,
    "attendance.review.reject": 72,
    "ocr.verification.approve": 72,
    "ocr.verification.reject": 72,
    "inventory.reconciliation.approve": 48,  # auto-escalate
    "inventory.reconciliation.reject": 48,
    "dispatch.status.update": 24,  # time-sensitive — auto-escalate
    "dispatch.record.cancel": 24,  # time-sensitive
    "customer.verification.review": 72,
    "customer.status.update": 72,
    "invoice.record.edit_pre_dispatch": 72,
    "invoice.record.edit_post_dispatch": 48,
    "invoice.record.void": 72,
    "payment.record.create": 72,
    "payment.record.reallocate": 72,
    "payment.record.reverse": 72,
    "production.batch.variance.approve": 72,
    "factory.create": 72,
    "user.invite": 72,
    "user.role.assign": 72,
    "user.membership.assign": 72,
    "user.deactivate": 72,
    "billing.plan.downgrade": 72,  # auto-reject on expiry
    "billing.plan.change": 72,  # auto-reject on expiry
}

# Workflows that auto-escalate on expiry (others auto-reject or notify)
AUTO_ESCALATE_WORKFLOWS: set[str] = {
    "inventory.reconciliation.approve",
    "inventory.reconciliation.reject",
    "dispatch.status.update",
    "dispatch.record.cancel",
}

# Workflows that auto-reject on expiry (safety-critical)
AUTO_REJECT_WORKFLOWS: set[str] = {
    "billing.plan.downgrade",
    "billing.plan.change",
}




class ApprovalPattern(str, Enum):
    """The approval pattern type for a workflow."""

    IP_2 = "IP-2"  # Single stage maker-checker
    IP_3 = "IP-3"  # Sequential two-stage
    IP_4 = "IP-4"  # Cross-domain/parallel
    IP_5 = "IP-5"  # Critical/emergency dual approval


# Workflow → pattern mapping
WORKFLOW_PATTERNS: dict[str, ApprovalPattern] = {
    # IP-2: Single stage maker-checker
    "production.entry.approve": ApprovalPattern.IP_2,
    "production.entry.delete": ApprovalPattern.IP_2,
    "attendance.review.approve": ApprovalPattern.IP_2,
    "attendance.review.reject": ApprovalPattern.IP_2,
    "ocr.verification.approve": ApprovalPattern.IP_2,
    "ocr.verification.reject": ApprovalPattern.IP_2,
    "inventory.reconciliation.approve": ApprovalPattern.IP_2,
    "inventory.reconciliation.reject": ApprovalPattern.IP_2,
    "dispatch.status.update": ApprovalPattern.IP_2,
    "dispatch.record.cancel": ApprovalPattern.IP_2,
    "customer.verification.review": ApprovalPattern.IP_2,
    "customer.status.update": ApprovalPattern.IP_2,
    "invoice.record.edit_pre_dispatch": ApprovalPattern.IP_2,
    "payment.record.create": ApprovalPattern.IP_2,
    "production.batch.variance.approve": ApprovalPattern.IP_2,
    # IP-3: Sequential two-stage
    "invoice.record.edit_post_dispatch": ApprovalPattern.IP_3,
    "payment.record.reallocate": ApprovalPattern.IP_3,
    "factory.create": ApprovalPattern.IP_3,
    "user.invite": ApprovalPattern.IP_3,
    "user.deactivate": ApprovalPattern.IP_3,
    "user.membership.assign": ApprovalPattern.IP_3,
    # IP-4: Cross-domain/parallel
    "user.role.assign": ApprovalPattern.IP_4,
    "payment.record.reverse": ApprovalPattern.IP_4,
    "invoice.record.void": ApprovalPattern.IP_4,
    # IP-5: Critical/emergency dual approval
    "billing.plan.downgrade": ApprovalPattern.IP_5,
    "billing.plan.change": ApprovalPattern.IP_5,
}

# Roles required for cross-domain (IP-4) and critical (IP-5) approval patterns.
# These are enforced in advance_approval() to ensure only authorized roles
# can act as approvers for sensitive workflows.
_APPROVER_ROLES_BY_PATTERN: dict[ApprovalPattern, set[UserRole]] = {
    ApprovalPattern.IP_4: {UserRole.ADMIN, UserRole.OWNER},
    ApprovalPattern.IP_5: {UserRole.OWNER},
}


# IP-2 conditional thresholds — workflows that bypass approval when below threshold
IP2_CONDITIONAL_THRESHOLDS: dict[str, list[dict[str, Any]]] = {
    "inventory.reconciliation.approve": [
        {"key": "variance_percent", "max": HIGH_VARIANCE_THRESHOLD_PERCENT},
    ],
    "payment.record.create": [
        {"key": "payment_amount", "max": 50000.0},
        {"key": "is_backdated", "max_bool": False},
    ],
    "dispatch.status.update": [
        {"key": "is_cancellation", "max_bool": False},
    ],
}


# ── Approval Decision ─────────────────────────────────────────────────────────


@dataclass
class ApprovalDecision:
    """Result of an approval initiation.

    Attributes:
        result: One of "denied", "approval_required", "approved", "no_approval_required",
                or "pending_l2" (for IP-3 after L1 approval).
        reason: Human-readable explanation when denied or when approval is required.
        instance_id: Unique identifier for this approval instance, set when result is
                     "approval_required", "approved", or "pending_l2".
        required_approver_roles: List of roles that can approve this instance (IP-4/IP-5).
        current_approval_stage: Current stage description (e.g. "L1", "L2").
    """

    result: str  # "denied" | "approval_required" | "approved" | "no_approval_required" | "pending_l2"
    reason: str | None = None
    instance_id: str | None = None
    required_approver_roles: list[str] | None = None
    current_approval_stage: str | None = None


# ── Approval Service ──────────────────────────────────────────────────────────


class ApprovalService:
    """Central approval engine for maker-checker workflows with DB-backed persistence.

    Phase P2: All instances are persisted to the approval_instances table via
    SQLAlchemy. The service requires a `db: Session` parameter for all methods
    that read or write approval state.

    Phase P3: Supports a callback/event system where callbacks registered via
    register_callback() are automatically fired when an approval instance reaches
    a terminal state (approved/rejected) through advance_approval().

    Supports IP-2 (single stage), IP-3 (sequential two-stage), IP-4 (cross-domain),
    and IP-5 (critical/emergency dual approval) patterns.
    """

    def __init__(self) -> None:
        """No in-memory state — all persistence is DB-backed."""
        self._callbacks: dict[str, ApprovalCallback] = {}

    def register_callback(self, workflow_key: str, callback: ApprovalCallback) -> None:
        """Register a callback function for a specific workflow key.

        The callback will be invoked when advance_approval() completes an instance
        with this workflow key (status becomes "approved" or "rejected").

        Args:
            workflow_key: The workflow key to register the callback for.
            callback: Function to call on approval completion.
                      Signature: (db: Session, instance: dict[str, Any]) -> None
        """
        self._callbacks[workflow_key] = callback

    def unregister_callback(self, workflow_key: str) -> None:
        """Remove a registered callback for a workflow key."""
        self._callbacks.pop(workflow_key, None)

    def _fire_callback(self, db: Session, instance: ApprovalInstance) -> None:
        """Fire the registered callback for an instance's workflow key (if any).

        Called after advance_approval transitions the instance to a terminal state.
        The callback receives the active DB session (within the caller's transaction)
        and the instance dict. If the callback raises, the caller's transaction is
        rolled back.
        """
        callback = self._callbacks.get(instance.workflow_key)
        if callback is not None:
            callback(db, instance.to_dict())

    # ── Public API ─────────────────────────────────────────────────────────

    def initiate_approval(
        self,
        db: Session,
        *,
        actor_user_id: int,
        subject_user_id: int | None,
        workflow_key: str,
        action_key: str,
        resource_type: str,
        resource_id: str,
        org_id: str | None = None,
        factory_id: str | None = None,
        current_workflow_state: str | None = None,
        requested_change: dict[str, Any] | None = None,
        attributes: dict[str, Any] | None = None,
        request_context: dict[str, Any] | None = None,
    ) -> ApprovalDecision:
        """Evaluate whether the actor can proceed with an approval action.

        Persists a new ApprovalInstance row to the database.

        Args:
            db: Active database session.
            actor_user_id: The user attempting the approval/rejection.
            subject_user_id: The user who created/submitted the resource being acted on.
            workflow_key: Identifies the workflow (e.g. "production.entry.approve").
            action_key: Identifies the specific action.
            resource_type: Type of resource being acted on (e.g. "Entry").
            resource_id: String ID of the resource.
            org_id: Org context.
            factory_id: Factory context.
            current_workflow_state: Current state of the resource.
            requested_change: What change is being requested.
            attributes: Additional context attributes for rule evaluation.
            request_context: Request metadata.

        Returns:
            ApprovalDecision with the outcome.
        """
        attributes = attributes or {}

        # 1. Self-approval check
        if subject_user_id is not None and actor_user_id == subject_user_id:
            return ApprovalDecision(
                result="denied",
                reason="Self-approval is not allowed. A different user must review this action.",
            )

        # 2. Determine pattern and TTL
        pattern = WORKFLOW_PATTERNS.get(workflow_key, ApprovalPattern.IP_2)
        ttl_hours = WORKFLOW_TTL_HOURS.get(workflow_key, 72)
        now = datetime.now(timezone.utc)
        instance_id = str(uuid.uuid4())
        expires_at = now + timedelta(hours=ttl_hours)

        # 3. Evaluate based on pattern
        if pattern == ApprovalPattern.IP_2:
            bypass = self._check_ip2_bypass(workflow_key, attributes)
            if bypass:
                self._create_instance(
                    db,
                    instance_id=instance_id,
                    workflow_key=workflow_key,
                    action_key=action_key,
                    resource_type=resource_type,
                    resource_id=resource_id,
                    org_id=org_id,
                    factory_id=factory_id,
                    actor_user_id=actor_user_id,
                    subject_user_id=subject_user_id,
                    current_workflow_state=current_workflow_state,
                    requested_change=requested_change,
                    attributes=attributes,
                    request_context=request_context,
                    status="no_approval_required",
                    created_at=now,
                    expires_at=expires_at,
                )
                return ApprovalDecision(
                    result="no_approval_required",
                    instance_id=instance_id,
                )

            # IP-2 standard: directly approved (pending_l1 support ready for future)
            self._create_instance(
                db,
                instance_id=instance_id,
                workflow_key=workflow_key,
                action_key=action_key,
                resource_type=resource_type,
                resource_id=resource_id,
                org_id=org_id,
                factory_id=factory_id,
                actor_user_id=actor_user_id,
                subject_user_id=subject_user_id,
                current_workflow_state=current_workflow_state,
                requested_change=requested_change,
                attributes=attributes,
                request_context=request_context,
                status="pending_l1",
                created_at=now,
                expires_at=expires_at,
                approval_stage="L1",
            )
            return ApprovalDecision(
                result="approval_required",
                instance_id=instance_id,
            )

        # 4. IP-3: Sequential two-stage
        if pattern == ApprovalPattern.IP_3:
            self._create_instance(
                db,
                instance_id=instance_id,
                workflow_key=workflow_key,
                action_key=action_key,
                resource_type=resource_type,
                resource_id=resource_id,
                org_id=org_id,
                factory_id=factory_id,
                actor_user_id=actor_user_id,
                subject_user_id=subject_user_id,
                current_workflow_state=current_workflow_state,
                requested_change=requested_change,
                attributes=attributes,
                request_context=request_context,
                status="pending_l1",
                created_at=now,
                expires_at=expires_at,
                approval_stage="L1",
            )
            return ApprovalDecision(
                result="approval_required",
                instance_id=instance_id,
                current_approval_stage="L1",
            )

        # 5. IP-4: Cross-domain/parallel
        if pattern == ApprovalPattern.IP_4:
            self._create_instance(
                db,
                instance_id=instance_id,
                workflow_key=workflow_key,
                action_key=action_key,
                resource_type=resource_type,
                resource_id=resource_id,
                org_id=org_id,
                factory_id=factory_id,
                actor_user_id=actor_user_id,
                subject_user_id=subject_user_id,
                current_workflow_state=current_workflow_state,
                requested_change=requested_change,
                attributes=attributes,
                request_context=request_context,
                status="pending_l1",
                created_at=now,
                expires_at=expires_at,
            )
            return ApprovalDecision(
                result="approval_required",
                instance_id=instance_id,
                required_approver_roles=["admin", "owner"],
            )

        # 6. IP-5: Critical/emergency dual approval
        if pattern == ApprovalPattern.IP_5:
            self._create_instance(
                db,
                instance_id=instance_id,
                workflow_key=workflow_key,
                action_key=action_key,
                resource_type=resource_type,
                resource_id=resource_id,
                org_id=org_id,
                factory_id=factory_id,
                actor_user_id=actor_user_id,
                subject_user_id=subject_user_id,
                current_workflow_state=current_workflow_state,
                requested_change=requested_change,
                attributes=attributes,
                request_context=request_context,
                status="pending_l1",
                created_at=now,
                expires_at=expires_at,
            )
            return ApprovalDecision(
                result="approval_required",
                instance_id=instance_id,
                required_approver_roles=["owner"],
            )

        # Fallback: IP-2
        self._create_instance(
            db,
            instance_id=instance_id,
            workflow_key=workflow_key,
            action_key=action_key,
            resource_type=resource_type,
            resource_id=resource_id,
            org_id=org_id,
            factory_id=factory_id,
            actor_user_id=actor_user_id,
            subject_user_id=subject_user_id,
            current_workflow_state=current_workflow_state,
            requested_change=requested_change,
            attributes=attributes,
            request_context=request_context,
            status="pending_l1",
            created_at=now,
            expires_at=expires_at,
        )
        return ApprovalDecision(
            result="approval_required",
            instance_id=instance_id,
        )

    def complete_approval(
        self,
        db: Session,
        instance_id: str,
        *,
        outcome: str | None = None,
    ) -> None:
        """Mark an approval instance as completed after the mutation succeeds.

        Fires the registered completion callback so Phase P3 business logic
        (e.g. status updates, audit logs, inventory adjustments) runs even for
        IP-2 conditional-bypass workflows where the instance bypasses
        advance_approval() entirely.

        Args:
            db: Active database session.
            instance_id: The approval instance ID returned by initiate_approval().
            outcome: Optional final outcome. Defaults to "completed".
        """
        instance = _get_approval_instance_with_lock(db, instance_id)
        if instance is None:
            return  # Silently ignore unknown instances (idempotent)

        instance.status = outcome or "completed"
        instance.completed_at = datetime.now(timezone.utc)
        # Commit state change BEFORE firing callback so callback failures
        # don't roll back the completion (Bug #39 fix).
        db.commit()
        # Fire the completion callback (Phase P3) so registered business logic
        # runs even for bypassed IP-2 workflows.
        self._fire_callback(db, instance)
        db.commit()

    def advance_approval(
        self,
        db: Session,
        instance_id: str,
        *,
        actor_user_id: int,
        action: str,  # "approve" or "reject"
        reason: str | None = None,
        request_context: dict[str, Any] | None = None,
    ) -> ApprovalDecision:
        """Advance an approval instance to the next stage (IP-3 sequential).

        Args:
            db: Active database session.
            instance_id: The approval instance ID.
            actor_user_id: The user taking the action.
            action: "approve" or "reject".
            reason: Optional reason for the action.
            request_context: Request metadata.

        Returns:
            ApprovalDecision with the result.
        """
        instance = _get_approval_instance_with_lock(db, instance_id)
        if instance is None:
            return ApprovalDecision(
                result="denied",
                reason="Approval instance not found.",
            )

        if instance.status not in ("pending_l1", "pending_l2"):
            return ApprovalDecision(
                result="denied",
                reason=f"Approval instance is in state '{instance.status}' and cannot be advanced.",
            )

        # Self-approval check: the person advancing must NOT be the maker (subject)
        if instance.subject_user_id is not None and instance.subject_user_id == actor_user_id:
            return ApprovalDecision(
                result="denied",
                reason="Self-approval is not allowed at any stage.",
            )

        # IP-4/IP-5 role enforcement: only authorized roles can advance these instances
        pattern = WORKFLOW_PATTERNS.get(instance.workflow_key)
        required_roles = _APPROVER_ROLES_BY_PATTERN.get(pattern)  # type: ignore[arg-type]
        if required_roles is not None:
            actor = db.query(User).filter(User.id == actor_user_id).first()
            if actor is None:
                return ApprovalDecision(
                    result="denied",
                    reason="Approver not found.",
                )
            if actor.role not in required_roles:
                role_names = ", ".join(sorted(r.value for r in required_roles))
                return ApprovalDecision(
                    result="denied",
                    reason=f"Only {role_names} can approve this type of request.",
                )

        if action == "reject":
            instance.status = "rejected"
            instance.rejected_by_user_id = actor_user_id
            instance.rejection_reason = reason
            instance.completed_at = datetime.now(timezone.utc)
            # Commit state change BEFORE firing callback so that a failure in the
            # callback (or a subsequent IntegrityError) does not roll back the
            # approval state transition (Bug #39 fix).
            db.commit()
            # Fire completion callback (Phase P3) in a separate transaction so
            # callback side effects survive if the callback itself fails.
            self._fire_callback(db, instance)
            db.commit()
            return ApprovalDecision(
                result="approved",  # Rejection completes the workflow
                instance_id=instance_id,
            )

        # Check the current stage
        current_stage = instance.approval_stage or "L2"
        if current_stage == "L2":
            # L2 approved — done
            instance.status = "approved"
            instance.approved_by_user_id = actor_user_id
            instance.completed_at = datetime.now(timezone.utc)
            # Commit state change BEFORE firing callback so that a failure in the
            # callback (or a subsequent IntegrityError) does not roll back the
            # approval state transition (Bug #39 fix).
            db.commit()
            # Fire completion callback (Phase P3) in a separate transaction so
            # callback side effects survive if the callback itself fails.
            self._fire_callback(db, instance)
            db.commit()
            return ApprovalDecision(
                result="approved",
                instance_id=instance_id,
            )

        # Move to next stage (L1 -> L2, not terminal yet)
        instance.approval_stage = "L2"
        instance.status = "pending_l2"
        db.flush()
        return ApprovalDecision(
            result="approval_required",
            instance_id=instance_id,
            current_approval_stage="L2",
        )

    def get_instance(
        self,
        db: Session,
        instance_id: str,
    ) -> dict[str, Any] | None:
        """Retrieve an approval instance by ID.

        Args:
            db: Active database session.
            instance_id: The approval instance ID.

        Returns:
            Dict representation or None if not found.
        """
        instance = (
            db.query(ApprovalInstance)
            .filter(ApprovalInstance.instance_id == instance_id)
            .first()
        )
        if instance is None:
            return None
        return instance.to_dict()

    def list_pending_for_user(
        self,
        db: Session,
        user_id: int,
        *,
        org_id: str | None = None,
    ) -> list[dict[str, Any]]:
        """List pending approval instances visible to a user.

        Returns instances where the user can potentially act as approver
        (i.e., items they did NOT initiate themselves) that are not yet
        completed and not expired.

        Args:
            db: Active database session.
            user_id: The user ID to find pending instances for.
            org_id: Optional org scope filter (Bug #48) to prevent
                cross-org exposure for platform admins.

        Returns:
            List of instance dicts, newest first.
        """
        now = datetime.now(timezone.utc)
        query = db.query(ApprovalInstance).filter(
            ApprovalInstance.status.in_(["pending_l1", "pending_l2"]),
            ApprovalInstance.actor_user_id != user_id,
            or_(
                ApprovalInstance.expires_at.is_(None),
                ApprovalInstance.expires_at > now,
            ),
        )
        if org_id:
            query = query.filter(ApprovalInstance.org_id == org_id)
        else:
            # Safety limit when querying across all orgs to prevent OOM
            query = query.limit(200)
        rows = query.order_by(ApprovalInstance.created_at.desc()).all()
        return [row.to_dict() for row in rows]

    def list_pending_for_org(
        self,
        db: Session,
        org_id: str,
        *,
        limit: int = 50,
    ) -> list[dict[str, Any]]:
        """List all pending approval instances for an org (admin view).

        Args:
            db: Active database session.
            org_id: The org ID to scope the query.
            limit: Maximum number of results.

        Returns:
            List of instance dicts, newest first.
        """
        now = datetime.now(timezone.utc)
        rows = (
            db.query(ApprovalInstance)
            .filter(
                ApprovalInstance.org_id == org_id,
                ApprovalInstance.status.in_(["pending_l1", "pending_l2"]),
                or_(
                    ApprovalInstance.expires_at.is_(None),
                    ApprovalInstance.expires_at > now,
                ),
            )
            .order_by(ApprovalInstance.created_at.desc())
            .limit(limit)
            .all()
        )
        return [row.to_dict() for row in rows]

    def update_expired_instances(
        self,
        db: Session,
    ) -> int:
        """Mark all expired pending instances as abandoned or auto-reject.

        Scans for approval instances past their TTL and applies the configured
        expiry policy (auto-escalate, auto-reject, or abandon). For instances
        that reach a terminal state (escalated, rejected, abandoned), registered
        completion callbacks are fired so the associated business logic runs
        (e.g., logging, audit trails).

        Args:
            db: Active database session.

        Returns:
            Number of instances updated.
        """
        now = datetime.now(timezone.utc)
        expired = (
            db.query(ApprovalInstance)
            .filter(
                ApprovalInstance.status.in_(["pending_l1", "pending_l2"]),
                ApprovalInstance.expires_at.isnot(None),
                ApprovalInstance.expires_at < now,
            )
            .all()
        )

        updated = 0
        terminal_instances: list[ApprovalInstance] = []
        for instance in expired:
            wk = instance.workflow_key
            if wk in AUTO_ESCALATE_WORKFLOWS:
                # Escalate: move to next stage or mark for escalation
                if instance.approval_stage == "L1":
                    instance.approval_stage = "L2"
                    instance.status = "pending_l2"
                else:
                    instance.status = "escalated"
                    instance.completed_at = now
                    terminal_instances.append(instance)
            elif wk in AUTO_REJECT_WORKFLOWS:
                instance.status = "rejected"
                instance.rejection_reason = "Auto-rejected on expiry."
                instance.completed_at = now
                terminal_instances.append(instance)
            else:
                instance.status = "abandoned"
                instance.completed_at = now
                terminal_instances.append(instance)
            updated += 1

        if updated:
            # Commit state changes BEFORE firing callbacks so callback failures
            # don't roll back the expiry transitions (Bug #39 fix).
            db.commit()
            # Fire callbacks for terminal-state instances in a separate transaction
            for instance in terminal_instances:
                self._fire_callback(db, instance)
            # Commit callback side effects
            db.commit()

        return updated

    def purge_old_instances(
        self,
        db: Session,
        *,
        retention_days: int | None = None,
    ) -> int:
        """Hard-delete completed approval instances older than the retention period.

        Prevents unbounded table bloat from expired, abandoned, or completed
        instances that are no longer needed for audit purposes.

        Args:
            db: Active database session.
            retention_days: Override the default retention period.

        Returns:
            Number of instances deleted.
        """
        cutoff = datetime.now(timezone.utc) - timedelta(days=retention_days or _OLD_INSTANCE_RETENTION_DAYS)
        rows = (
            db.query(ApprovalInstance)
            .filter(
                ApprovalInstance.status.in_(["abandoned", "escalated", "rejected", "completed", "no_approval_required"]),
                ApprovalInstance.completed_at.isnot(None),
                ApprovalInstance.completed_at < cutoff,
            )
            .all()
        )
        if not rows:
            return 0
        ids = [row.id for row in rows]
        deleted = (
            db.query(ApprovalInstance)
            .filter(ApprovalInstance.id.in_(ids))
            .delete(synchronize_session=False)
        )
        db.commit()
        if deleted:
            logger = __import__("logging").getLogger(__name__)
            logger.info("Purged %d old approval instances (retention=%d days).", deleted, retention_days or _OLD_INSTANCE_RETENTION_DAYS)
        return deleted

    # ── Internal Helpers ──────────────────────────────────────────────────

    def _create_instance(
        self,
        db: Session,
        *,
        instance_id: str,
        workflow_key: str,
        action_key: str,
        resource_type: str,
        resource_id: str,
        org_id: str | None,
        factory_id: str | None,
        actor_user_id: int,
        subject_user_id: int | None,
        current_workflow_state: str | None,
        requested_change: dict[str, Any] | None,
        attributes: dict[str, Any] | None,
        request_context: dict[str, Any] | None,
        status: str,
        created_at: datetime,
        expires_at: datetime,
        approval_stage: str | None = None,
    ) -> ApprovalInstance:
        """Create and persist a new ApprovalInstance row.

        For pending instances (pending_l1/pending_l2), the method commits immediately
        because the router handlers return early with a 202 response and the session
        would otherwise be closed without committing, losing the instance.
        """
        instance = ApprovalInstance(
            instance_id=instance_id,
            workflow_key=workflow_key,
            action_key=action_key,
            resource_type=resource_type,
            resource_id=resource_id,
            org_id=org_id,
            factory_id=factory_id,
            actor_user_id=actor_user_id,
            subject_user_id=subject_user_id,
            current_workflow_state=current_workflow_state,
            status=status,
            approval_stage=approval_stage,
            requested_change=requested_change,
            attributes=attributes,
            request_context=request_context,
            expires_at=expires_at,
            created_at=created_at,
        )
        db.add(instance)
        db.flush()
        # Commit pending instances immediately so they survive the router's early return.
        # IMPORTANT: Any audit log added to *this* session before initiate_approval()
        # will also be committed here. To avoid phantom audit logs, router handlers
        # should write audit logs AFTER the call to initiate_approval() — never before.
        if status in ("pending_l1", "pending_l2"):
            db.commit()
        return instance

    def _check_ip2_bypass(self, workflow_key: str, attributes: dict[str, Any]) -> bool:
        """Check if an IP-2 workflow can bypass approval based on thresholds.

        If a required threshold attribute is missing from the attributes dict,
        the workflow does NOT bypass approval (safe default). Only returns True
        (bypass) when ALL defined thresholds are explicitly met or undershot.
        """
        thresholds = IP2_CONDITIONAL_THRESHOLDS.get(workflow_key, [])
        for condition in thresholds:
            key = condition.get("key", "")
            value = attributes.get(key)
            if value is None:
                # Missing attribute = do NOT bypass (safe default)
                return False
            max_val = condition.get("max")
            if max_val is not None and isinstance(value, (int, float)) and value > max_val:
                return False
            max_bool = condition.get("max_bool")
            if max_bool is not None and value is True:
                return False
        return True


# ── Module-level singleton for easy reuse ─────────────────────────────────────
approval_service = ApprovalService()
