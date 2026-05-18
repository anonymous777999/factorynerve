"""Subscription access dependencies."""

from __future__ import annotations

from datetime import datetime, timezone

from fastapi import Depends, HTTPException
from sqlalchemy.orm import Session

from backend.database import get_db
from backend.models.subscription import Subscription
from backend.models.user import User
from backend.security import get_current_user
from backend.services.billing_manager import get_active_subscription


def _as_utc(value: datetime | None) -> datetime | None:
    if value is None:
        return None
    if value.tzinfo is None:
        return value.replace(tzinfo=timezone.utc)
    return value.astimezone(timezone.utc)


def _load_subscription(db: Session, org_id: str) -> Subscription | None:
    active = get_active_subscription(db, org_id)
    if active:
        return active
    return (
        db.query(Subscription)
        .filter(Subscription.org_id == org_id)
        .order_by(Subscription.updated_at.desc(), Subscription.id.desc())
        .first()
    )


async def require_active_subscription(
    user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
) -> Subscription:
    sub = _load_subscription(db, user.org_id)
    if not sub:
        raise HTTPException(status_code=402, detail={"code": "NO_SUBSCRIPTION"})
    if sub.status == "past_due":
        grace_ends = _as_utc(sub.grace_period_end_at)
        if grace_ends and grace_ends > datetime.now(timezone.utc):
            return sub
        raise HTTPException(
            status_code=402,
            detail={
                "code": "PAST_DUE",
                "grace_ends": grace_ends.isoformat() if grace_ends else None,
            },
        )
    if sub.status in ("suspended", "cancelled"):
        raise HTTPException(status_code=403, detail={"code": sub.status.upper()})
    return sub
