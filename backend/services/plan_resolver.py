"""Plan resolver helpers."""

from __future__ import annotations

from sqlalchemy.orm import Session

from backend.models.subscription import Subscription
from backend.models.organization import Organization


def get_effective_plan(org_id: str, db: Session) -> str:
    """Single source of truth for org plan.
    Prefers Subscription.plan when available; falls back to Organization.plan."""
    subscription = (
        db.query(Subscription)
        .filter(
            Subscription.org_id == org_id,
            Subscription.status.in_(("active", "trialing")),
        )
        .order_by(Subscription.created_at.desc(), Subscription.id.desc())
        .first()
    )
    if subscription and subscription.plan:
        return str(subscription.plan)
    org = db.query(Organization).filter(Organization.org_id == org_id).first()
    if org and org.plan:
        return str(org.plan)
    return "pilot"
