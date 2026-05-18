"""OCR quota enforcement dependencies."""

from __future__ import annotations

import time

from fastapi import Depends, HTTPException
from sqlalchemy import text
from sqlalchemy.orm import Session

from backend.database import get_db
from backend.models.subscription import Subscription
from backend.models.user import User
from backend.security import get_current_user
from backend.services.billing_logger import duration_ms_since, log_billing_event
from backend.services.billing_manager import get_effective_subscription_status


def _current_timestamp_sql(db: Session) -> str:
    return "CURRENT_TIMESTAMP" if db.bind and db.bind.dialect.name == "sqlite" else "NOW()"


def refund_ocr_quota(
    db: Session,
    *,
    org_id: str,
    user_id: int | None = None,
    reason: str,
) -> None:
    timestamp_sql = _current_timestamp_sql(db)
    db.execute(
        text(
            f"""
            UPDATE org_ocr_usage
            SET request_count = CASE WHEN request_count > 0 THEN request_count - 1 ELSE 0 END
            WHERE org_id = :org_id
              AND period_end > {timestamp_sql}
            """
        ),
        {"org_id": org_id},
    )
    db.commit()
    log_billing_event(
        "quota.refund",
        org_id,
        "success",
        user_id=user_id,
        reason=reason,
    )


async def require_ocr_quota(
    user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
) -> dict[str, object]:
    started_at = time.perf_counter()
    subscription = (
        db.query(Subscription)
        .filter(Subscription.org_id == user.org_id)
        .order_by(Subscription.updated_at.desc(), Subscription.id.desc())
        .first()
    )
    if subscription and get_effective_subscription_status(subscription) == "past_due":
        log_billing_event(
            "quota.decrement",
            user.org_id,
            "blocked",
            user_id=user.id,
            reason="past_due",
            duration_ms=duration_ms_since(started_at),
        )
        raise HTTPException(
            status_code=402,
            detail={
                "code": "PAST_DUE",
                "grace_ends": subscription.grace_period_end_at.isoformat()
                if subscription.grace_period_end_at
                else None,
            },
        )

    timestamp_sql = _current_timestamp_sql(db)
    result = db.execute(
        text(
            f"""
            UPDATE org_ocr_usage
            SET request_count = request_count + 1
            WHERE org_id = :org_id
              AND request_count < ocr_limit
              AND period_end > {timestamp_sql}
            RETURNING request_count, ocr_limit, period_end
            """
        ),
        {"org_id": user.org_id},
    )
    row = result.mappings().first()
    db.commit()
    if not row:
        log_billing_event(
            "quota.decrement",
            user.org_id,
            "blocked",
            user_id=user.id,
            reason="quota_exhausted",
            duration_ms=duration_ms_since(started_at),
        )
        raise HTTPException(
            status_code=429,
            detail={"code": "QUOTA_EXHAUSTED", "org_id": user.org_id},
        )
    # This single UPDATE is atomic because the database evaluates the limit predicate and
    # increments the counter in one write statement; a read-then-write flow lets concurrent
    # requests observe the same remaining quota and both decrement it, which is the bypass.
    log_billing_event(
        "quota.decrement",
        user.org_id,
        "success",
        user_id=user.id,
        request_count=row["request_count"],
        ocr_limit=row["ocr_limit"],
        period_end=str(row["period_end"]),
        duration_ms=duration_ms_since(started_at),
    )
    return dict(row)
