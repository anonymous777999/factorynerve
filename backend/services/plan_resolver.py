"""Plan resolver helpers."""

from __future__ import annotations

from sqlalchemy.orm import Session

from backend.models.organization import Organization


def get_effective_plan(org_id: str, db: Session) -> str:
    """Single source of truth for org plan.
    Always use this instead of reading org.plan directly."""
    from backend.services.billing_manager import get_canonical_subscription

    subscription = get_canonical_subscription(db, org_id)
    if subscription and subscription.plan:
        return str(subscription.plan)

    organization = db.query(Organization).filter(Organization.org_id == org_id).first()
    if organization and organization.plan:
        return str(organization.plan)

    return "free"
