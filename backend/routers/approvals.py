"""Approval router — queue management and sequential advancement for maker-checker workflows.

Provides two endpoints:
- GET /approvals/queue/me — Returns pending approval items for the current user.
- POST /approvals/{instance_id}/advance — Advance an approval instance (approve/reject).

These endpoints support the IP-3 (sequential two-stage) pattern where an L1 approval
creates a pending L2 instance that must be advanced by the next authority.
"""

from __future__ import annotations

from datetime import datetime, timezone
from typing import Any

from fastapi import APIRouter, Depends, HTTPException
from pydantic import BaseModel, Field
from sqlalchemy.orm import Session

from backend.authorization import PDP, PermissionCatalog
from backend.authorization.pdp import build_request_context
from backend.database import get_db
from backend.models.user import User
from backend.security import get_current_user
from backend.services.approval_service import approval_service as APPROVAL_SERVICE
from backend.tenancy import resolve_org_id


router = APIRouter(prefix="/approvals", tags=["Approvals"])


class ApprovalActionRequest(BaseModel):
    """Request payload for advancing an approval instance."""

    action: str = Field(description="'approve' or 'reject'")
    reason: str | None = Field(default=None, max_length=500)


class ApprovalQueueItem(BaseModel):
    """A single item in the approval queue."""

    instance_id: str
    workflow_key: str
    action_key: str
    resource_type: str
    resource_id: str
    summary: str | None = None
    requested_by: dict[str, Any] | None = None
    submitted_at: str | None = None
    due_at: str | None = None
    priority: str | None = None
    attributes: dict[str, Any] | None = None
    current_approval_stage: str | None = None
    can_approve: bool = True
    can_escalate: bool = False
    can_delegate: bool = True


class ApprovalQueueResponse(BaseModel):
    """Response payload for the approval queue endpoint."""

    items: list[ApprovalQueueItem]
    total: int
    page: int
    page_size: int


class ApprovalActionResponse(BaseModel):
    """Response payload for the approval advance endpoint."""

    status: str
    instance_id: str
    decision: str | None = None
    message: str | None = None


def _build_summary(instance: dict[str, Any]) -> str:
    """Build a human-readable summary for an approval instance."""
    workflow_key = instance.get("workflow_key", "")
    resource_type = instance.get("resource_type", "")
    resource_id = instance.get("resource_id", "")
    requested_change = instance.get("requested_change") or {}

    summaries = {
        "production.entry.approve": f"Production entry #{resource_id} approval",
        "production.entry.delete": f"Production entry #{resource_id} deletion",
        "attendance.review.approve": f"Attendance review #{resource_id} approval",
        "attendance.review.reject": f"Attendance review #{resource_id} rejection",
        "ocr.verification.approve": f"OCR verification #{resource_id} approval",
        "ocr.verification.reject": f"OCR verification #{resource_id} rejection",
        "inventory.reconciliation.approve": f"Stock reconciliation #{resource_id} approval",
        "inventory.reconciliation.reject": f"Stock reconciliation #{resource_id} rejection",
        "dispatch.status.update": f"Dispatch #{resource_id} status update",
        "dispatch.record.cancel": f"Dispatch #{resource_id} cancellation",
        "customer.verification.review": f"Customer verification #{resource_id} review",
        "customer.status.update": f"Customer #{resource_id} status update",
        "invoice.record.edit_pre_dispatch": f"Invoice #{resource_id} pre-dispatch edit",
        "invoice.record.edit_post_dispatch": f"Invoice #{resource_id} post-dispatch edit",
        "payment.record.create": f"Payment for invoice #{resource_id}",
        "payment.record.reallocate": f"Payment reallocation #{resource_id}",
        "payment.record.reverse": f"Payment reversal #{resource_id}",
        "production.batch.variance.approve": f"Batch #{resource_id} variance approval",
        "factory.create": f"New factory '{requested_change.get('name', '')}'",
        "user.invite": f"Invite user",
        "user.role.assign": f"Role change for user #{resource_id}",
        "user.membership.assign": f"Factory access change for user #{resource_id}",
        "user.deactivate": f"Deactivate user #{resource_id}",
        "billing.plan.downgrade": f"Plan downgrade",
        "billing.plan.change": f"Plan change",
    }
    return summaries.get(workflow_key, f"{resource_type} #{resource_id}")


def _build_priority(instance: dict[str, Any]) -> str:
    """Determine the priority of an approval instance based on workflow key."""
    high_priority = {
        "dispatch.status.update",
        "dispatch.record.cancel",
        "billing.plan.downgrade",
        "billing.plan.change",
    }
    medium_priority = {
        "inventory.reconciliation.approve",
        "inventory.reconciliation.reject",
        "payment.record.reverse",
        "invoice.record.edit_post_dispatch",
    }
    wk = instance.get("workflow_key", "")
    if wk in high_priority:
        return "high"
    if wk in medium_priority:
        return "medium"
    return "normal"


@router.get("/queue/me", response_model=ApprovalQueueResponse)
def get_my_approval_queue(
    page: int = 1,
    page_size: int = 20,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
) -> ApprovalQueueResponse:
    """Return pending approval items for the current user.

    The frontend caches this response and polls every 30s.
    """
    org_id = resolve_org_id(current_user)
    all_items = APPROVAL_SERVICE.list_pending_for_user(db, user_id=current_user.id, org_id=org_id)
    total = len(all_items)

    # Paginate
    offset = (page - 1) * page_size
    page_items = all_items[offset : offset + page_size]

    items: list[ApprovalQueueItem] = []
    for instance in page_items:
        submitted_at = instance.get("created_at")
        expires_at = instance.get("expires_at")

        # Check if user has permission to approve via PDP
        action_key = instance.get("action_key", "")
        can_approve = True
        try:
            pdp = PDP(db=db)
            pdp.require_permission(
                actor=current_user,
                permission_key=action_key,
            )
        except Exception as error:
            can_approve = False

        items.append(
            ApprovalQueueItem(
                instance_id=instance.get("instance_id", ""),
                workflow_key=instance.get("workflow_key", ""),
                action_key=action_key,
                resource_type=instance.get("resource_type", ""),
                resource_id=instance.get("resource_id", ""),
                summary=_build_summary(instance),
                requested_by=(
                    {"user_id": instance.get("subject_user_id")}
                    if instance.get("subject_user_id")
                    else None
                ),
                submitted_at=submitted_at,
                due_at=expires_at,
                priority=_build_priority(instance),
                attributes=instance.get("attributes"),
                current_approval_stage=instance.get("approval_stage"),
                can_approve=can_approve,
                can_escalate=instance.get("workflow_key") in {
                    "inventory.reconciliation.approve",
                    "dispatch.status.update",
                },
                can_delegate=True,
            )
        )

    return ApprovalQueueResponse(
        items=items,
        total=total,
        page=page,
        page_size=page_size,
    )


@router.post("/{instance_id}/advance", response_model=ApprovalActionResponse)
def advance_approval(
    instance_id: str,
    payload: ApprovalActionRequest,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
) -> ApprovalActionResponse:
    """Advance an approval instance to the next stage.

    Supports:
    - Approve: advances L1→L2 or completes at L2
    - Reject: terminates the workflow immediately
    """
    # Verify the instance exists
    instance = APPROVAL_SERVICE.get_instance(db, instance_id)
    if not instance:
        raise HTTPException(status_code=404, detail="Approval instance not found.") from error

    # Self-approval guard: the person who created the request cannot also advance it
    subject_user_id = instance.get("subject_user_id")
    if subject_user_id is not None and subject_user_id == current_user.id:
        raise HTTPException(
            status_code=403,
            detail="Self-approval is not allowed at any stage. A different user must review this request.",
        )

    # Check that the current user has the required permission
    action_key = instance.get("action_key", "")
    try:
        pdp = PDP(db=db)
        pdp.require_permission(
            actor=current_user,
            permission_key=action_key,
        )
    except Exception as exc:
        raise HTTPException(
            status_code=403,
            detail="You do not have permission to act on this approval request.",
        ) from exc

    # Validate action
    action = (payload.action or "").strip().lower()
    if action not in ("approve", "reject"):
        raise HTTPException(
            status_code=400,
            detail="Action must be 'approve' or 'reject'.",
        )

    # Advance the approval
    result = APPROVAL_SERVICE.advance_approval(db, 
        instance_id=instance_id,
        actor_user_id=current_user.id,
        action=action,
        reason=payload.reason,
        request_context={"user_id": current_user.id},
    )

    if result.result == "denied":
        raise HTTPException(status_code=403, detail=result.reason)

    if result.result == "approval_required":
        return ApprovalActionResponse(
            status="pending_further_approval",
            instance_id=instance_id,
            message=result.reason or "Awaiting next-level approval.",
        )

    return ApprovalActionResponse(
        status="completed",
        instance_id=instance_id,
        decision=action,
        message="Approval completed." if action == "approve" else "Request rejected.",
    )
