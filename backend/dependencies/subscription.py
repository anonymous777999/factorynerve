"""Subscription access dependencies."""

from __future__ import annotations

from datetime import datetime, timezone

from fastapi import Depends, HTTPException
from sqlalchemy.orm import Session

from backend.database import get_db
from backend.models.subscription import Subscription
from backend.models.user import User
from backend.security import get_current_user
from backend.services.billing_manager import (
    get_canonical_subscription,
    get_active_subscription,
    get_effective_subscription_status,
    normalize_subscription_record,
)


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
    return get_canonical_subscription(db, org_id)


async def require_active_subscription(
    user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
) -> Subscription:
    sub = _load_subscription(db, user.org_id)
    if not sub:
        raise HTTPException(status_code=402, detail={"code": "NO_SUBSCRIPTION"})
    if normalize_subscription_record(db, sub):
        db.commit()
        db.refresh(sub)
    effective_status = get_effective_subscription_status(sub)
    if effective_status == "past_due":
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
    if effective_status in ("suspended", "cancelled", "inactive"):
        raise HTTPException(status_code=403, detail={"code": effective_status.upper()})
    if effective_status not in {"trialing", "active"}:
        raise HTTPException(status_code=403, detail={"code": "SUBSCRIPTION_INVALID"})
    return sub
