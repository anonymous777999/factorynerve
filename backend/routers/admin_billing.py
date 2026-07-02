"""Admin-only billing audit routes."""

from __future__ import annotations

from datetime import datetime, timezone

from fastapi import APIRouter, Depends, HTTPException, Query, Request
from sqlalchemy import text
from sqlalchemy.orm import Session

from backend.authorization import PDP, ResourceContext
from backend.authorization.pdp import build_request_context
from backend.database import get_db
from backend.models.subscription import Subscription
from backend.models.user import User
from backend.models.webhook_event import WebhookEvent
from backend.security import get_current_user
from backend.services.approval_service import approval_service as APPROVAL_SERVICE
from backend.services.billing_logger import log_billing_event
from backend.services.billing_manager import get_effective_subscription_status


router = APIRouter(prefix="/admin/billing", tags=["Admin Billing"])


def require_superadmin(current_user: User = Depends(get_current_user)) -> User:
    if not current_user.is_platform_admin:
        raise HTTPException(status_code=403, detail="Superadmin access required.")
    return current_user


@router.get("/events")
def get_billing_events(
    org_id: str | None = Query(default=None),
    since: datetime | None = Query(default=None),
    event_type: str | None = Query(default=None),
    _admin: User = Depends(require_superadmin),
    db: Session = Depends(get_db),
) -> list[dict[str, object]]:
    query = db.query(WebhookEvent)
    if org_id:
        query = query.filter(WebhookEvent.org_id == org_id)
    if since:
        query = query.filter(WebhookEvent.received_at >= since)
    if event_type:
        query = query.filter(WebhookEvent.event_type == event_type)
    rows = query.order_by(WebhookEvent.received_at.desc(), WebhookEvent.id.desc()).limit(100).all()
    return [
        {
            "id": row.id,
            "org_id": row.org_id,
            "razorpay_event_id": row.razorpay_event_id,
            "provider": row.provider,
            "event_id": row.event_id,
            "event_type": row.event_type,
            "status": row.status,
            "outcome": row.outcome,
            "duration_ms": row.duration_ms,
            "received_at": row.received_at,
        }
        for row in rows
    ]


@router.get("/subscriptions")
def get_billing_subscriptions(
    status: str = Query(default="past_due"),
    _admin: User = Depends(require_superadmin),
    db: Session = Depends(get_db),
) -> list[dict[str, object]]:
    raw_rows = (
        db.query(Subscription)
        .order_by(Subscription.updated_at.desc(), Subscription.id.desc())
        .limit(250)
        .all()
    )
    rows = [row for row in raw_rows if get_effective_subscription_status(row) == status][:100]
    return [
        {
            "org_id": row.org_id,
            "user_id": row.user_id,
            "plan": row.plan,
            "status": get_effective_subscription_status(row),
            "grace_period_end": row.grace_period_end_at,
            "current_period_end": row.current_period_end_at,
            "updated_at": row.updated_at,
        }
        for row in rows
    ]


@router.get("/quota")
def get_org_quota(
    org_id: str,
    _admin: User = Depends(require_superadmin),
    db: Session = Depends(get_db),
) -> dict[str, object]:
    row = db.execute(
        text(
            """
            SELECT org_id, request_count, ocr_limit, period_end
            FROM org_ocr_usage
            WHERE org_id = :org_id
            ORDER BY period_end DESC
            LIMIT 1
            """
        ),
        {"org_id": org_id},
    ).mappings().first()
    if not row:
        raise HTTPException(status_code=404, detail="Quota row not found.")
    return dict(row)


@router.post("/reset-quota/{org_id}")
def reset_org_quota(
    org_id: str,
    request: Request,
    admin_user: User = Depends(require_superadmin),
    db: Session = Depends(get_db),
) -> dict[str, object]:
    pdp = PDP(db=db)
    request_context = build_request_context(request)
    pdp.require_permission(
        actor=admin_user,
        permission_key="admin.billing.quota.reset",
        resource=ResourceContext(org_id=org_id),
        request_context=request_context,
    )

    # IP-3 critical action approval
    approval_decision = APPROVAL_SERVICE.initiate_approval(db,
        actor_user_id=admin_user.id,
        subject_user_id=admin_user.id,
        workflow_key="billing.plan.change",
        action_key="admin.billing.quota.reset",
        resource_type="OrgOcrUsage",
        resource_id=org_id,
        org_id=org_id,
        current_workflow_state="active",
        requested_change={"action": "reset_quota"},
        request_context=request_context,
    )

    if approval_decision.result == "denied":
        raise HTTPException(status_code=403, detail=approval_decision.reason)

    if approval_decision.result == "approval_required":
        return {"status": "pending_approval", "approval_instance_id": approval_decision.instance_id, "message": "Quota reset submitted for approval."}
    elif approval_decision.result not in ("approved", "no_approval_required"):
        raise HTTPException(status_code=500, detail=f"Unexpected approval result: {approval_decision.result}")

    updated = db.execute(
        text(
            """
            UPDATE org_ocr_usage
            SET request_count = 0
            WHERE org_id = :org_id
            """
        ),
        {"org_id": org_id},
    )
    db.commit()
    if updated.rowcount == 0:
        raise HTTPException(status_code=404, detail="Quota row not found.")
    log_billing_event(
        "admin.quota_reset",
        org_id,
        "success",
        admin_user_id=admin_user.id,
        performed_at=datetime.now(timezone.utc).isoformat(),
    )

    if approval_decision.instance_id:
        APPROVAL_SERVICE.complete_approval(db, instance_id=approval_decision.instance_id)

    return {"org_id": org_id, "request_count": 0, "reset_by_user_id": admin_user.id}
