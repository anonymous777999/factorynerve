"""OCR quota enforcement dependencies."""

from __future__ import annotations

import time

from fastapi import Depends, HTTPException
from sqlalchemy import text
from sqlalchemy.orm import Session

from backend.database import get_db
from backend.feature_limits import check_and_record_org_feature_usage
from backend.models.organization import Organization
from backend.models.subscription import Subscription
from backend.models.user import User
from backend.plans import get_org_whatsapp_message_allowance
from backend.security import get_current_user
from backend.services.billing_logger import duration_ms_since, log_billing_event
from backend.services.billing_manager import get_canonical_subscription, get_effective_subscription_status
from backend.services.plan_resolver import get_effective_plan
from backend.tenancy import resolve_org_id


def _current_timestamp_sql(db: Session) -> str:
    return "CURRENT_TIMESTAMP" if db.bind and db.bind.dialect.name == "sqlite" else "NOW()"


def get_current_org(
    user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
) -> Organization:
    org_id = resolve_org_id(user)
    if not org_id:
        raise HTTPException(status_code=400, detail="Organization not found for current user.")
    org = db.query(Organization).filter(Organization.org_id == org_id).first()
    if not org:
        raise HTTPException(status_code=404, detail="Organization not found.")
    return org


def consume_ai_quota(db: Session, *, org_id: str, feature: str) -> None:
    check_and_record_org_feature_usage(
        db=db,
        org_id=org_id,
        feature=feature,
        plan=get_effective_plan(org_id, db),
    )


def require_ai_quota(feature: str):
    def _dependency(
        org: Organization = Depends(get_current_org),
        db: Session = Depends(get_db),
    ):
        try:
            consume_ai_quota(db, org_id=org.org_id, feature=feature)
        except HTTPException as error:
            if error.status_code == 429:
                reason = error.detail
                raise HTTPException(
                    status_code=429,
                    detail={"error": "quota_exceeded", "feature": feature, "reason": reason},
                ) from error
            raise

    return Depends(_dependency)


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
    subscription = get_canonical_subscription(db, user.org_id)
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


async def require_whatsapp_quota(
    user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
) -> dict[str, object]:
    """Check and decrement WhatsApp message quota atomically.

    Works like require_ocr_quota but checks org_whatsapp_usage.message_count
    against message_limit. If no row exists or message_limit is 0, blocks.
    """
    started_at = time.perf_counter()
    subscription = get_canonical_subscription(db, user.org_id)
    if subscription and get_effective_subscription_status(subscription) == "past_due":
        log_billing_event(
            "whatsapp_quota.decrement",
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
            UPDATE org_whatsapp_usage
            SET message_count = message_count + 1
            WHERE org_id = :org_id
              AND message_count < message_limit
              AND period_end > {timestamp_sql}
            RETURNING message_count, message_limit, period_end
            """
        ),
        {"org_id": user.org_id},
    )
    row = result.mappings().first()
    db.commit()
    if not row:
        log_billing_event(
            "whatsapp_quota.decrement",
            user.org_id,
            "blocked",
            user_id=user.id,
            reason="quota_exhausted_or_no_pack",
            duration_ms=duration_ms_since(started_at),
        )
        raise HTTPException(
            status_code=429,
            detail={
                "code": "WHATSAPP_QUOTA_EXHAUSTED",
                "org_id": user.org_id,
                "message": "Your WhatsApp message quota is exhausted or no WhatsApp pack is active. Add a WhatsApp pack in Billing to continue sending alerts.",
                "upgrade_url": "/billing",
            },
        )
    log_billing_event(
        "whatsapp_quota.decrement",
        user.org_id,
        "success",
        user_id=user.id,
        message_count=row["message_count"],
        message_limit=row["message_limit"],
        period_end=str(row["period_end"]),
        duration_ms=duration_ms_since(started_at),
    )
    return dict(row)


def refund_whatsapp_quota(
    db: Session,
    *,
    org_id: str,
    user_id: int | None = None,
    reason: str,
) -> None:
    """Decrement WhatsApp message count on send failure so quota is not wasted."""
    timestamp_sql = _current_timestamp_sql(db)
    db.execute(
        text(
            f"""
            UPDATE org_whatsapp_usage
            SET message_count = CASE WHEN message_count > 0 THEN message_count - 1 ELSE 0 END
            WHERE org_id = :org_id
              AND period_end > {timestamp_sql}
            """
        ),
        {"org_id": org_id},
    )
    db.commit()
    log_billing_event(
        "whatsapp_quota.refund",
        org_id,
        "success",
        user_id=user_id,
        reason=reason,
    )
