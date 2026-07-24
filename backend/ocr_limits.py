"""Per-user OCR rate limits and usage quotas."""

from __future__ import annotations

import math
import os
import threading
import time
from collections import defaultdict, deque
from datetime import datetime, timezone

from fastapi import HTTPException
from sqlalchemy import update
from sqlalchemy.exc import IntegrityError
from sqlalchemy.orm import Session


# ── Feature flag: OCR_QUOTA_ATOMIC_LOCKS ─────────────────────────────────────
# When enabled, quota checks use SELECT FOR UPDATE to serialize concurrent
# requests. The old code path (UPDATE with WHERE) is retained as a fallback.
_OCR_QUOTA_ATOMIC_LOCKS = os.getenv("OCR_QUOTA_ATOMIC_LOCKS", "true").lower() in ("1", "true", "yes", "on")

from backend.models.ocr_usage import OcrUsage
from backend.models.org_ocr_usage import OrgOcrUsage
from backend.models.user import User
from backend.plans import (
    DEFAULT_PLAN,
    get_org_ocr_scan_allowance,
    get_org_plan,
    normalize_plan,
    plan_limit,
    plan_limit_is_unlimited,
    plan_ocr_rate_limit,
)
from backend.services.plan_resolver import get_effective_plan
RATE_LIMIT_WINDOW_SECONDS = int(os.getenv("OCR_RATE_LIMIT_WINDOW_SECONDS", "60"))
OCR_CREDITS_PER_MB = int(os.getenv("OCR_CREDITS_PER_MB", "4"))


_rate_lock = threading.Lock()
_request_timestamps: dict[int, deque[float]] = defaultdict(deque)


def _period_now() -> str:
    return datetime.now(timezone.utc).strftime("%Y-%m")


def _next_reset_date(now: datetime | None = None) -> str:
    current = now or datetime.now(timezone.utc)
    year = current.year + (1 if current.month == 12 else 0)
    month = 1 if current.month == 12 else current.month + 1
    return datetime(year, month, 1, tzinfo=timezone.utc).date().isoformat()


def _compute_credits(image_bytes: int) -> int:
    if OCR_CREDITS_PER_MB <= 0:
        return 1
    mb = max(1, math.ceil(image_bytes / (1024 * 1024)))
    return mb * OCR_CREDITS_PER_MB


def _plan_limits(plan: str) -> dict[str, int]:
    plan_key = normalize_plan(plan)
    base_requests = int(plan_limit(plan_key, "ocr") or 0)
    return {
        "requests": base_requests,
        "credits": 0 if plan_limit_is_unlimited(plan_key, "ocr") else base_requests * OCR_CREDITS_PER_MB,
        "rate": plan_ocr_rate_limit(plan_key),
    }


def _effective_plan_limits(db: Session, *, org_id: str | None, plan: str) -> dict[str, int]:
    limits = _plan_limits(plan)
    if plan_limit_is_unlimited(plan, "ocr"):
        return {"requests": 0, "credits": 0, "rate": limits["rate"]}
    addon_requests = get_org_ocr_scan_allowance(db, org_id=org_id)
    total_requests = int(limits["requests"] or 0) + addon_requests
    if total_requests <= 0:
        return {"requests": -1, "credits": -1, "rate": limits["rate"]}
    return {
        "requests": total_requests,
        "credits": total_requests * OCR_CREDITS_PER_MB,
        "rate": limits["rate"],
    }


def get_user_plan(db: Session, *, user_id: int) -> str:
    user = db.query(User).filter(User.id == user_id).first()
    if user and user.org_id:
        return normalize_plan(get_effective_plan(user.org_id, db))
    return normalize_plan(DEFAULT_PLAN)


def get_org_plan_for_usage(db: Session, *, org_id: str | None, user_id: int | None = None) -> str:
    return get_org_plan(db, org_id=org_id, fallback_user_id=user_id)


def check_rate_limit(user_id: int, *, plan: str) -> None:
    max_requests = _plan_limits(plan)["rate"]
    if max_requests <= 0:
        return
    with _rate_lock:
        now = time.time()
        history = _request_timestamps[user_id]
        while history and now - history[0] > RATE_LIMIT_WINDOW_SECONDS:
            history.popleft()
        if len(history) >= max_requests:
            raise HTTPException(status_code=429, detail="OCR rate limit exceeded. Please slow down.")
        history.append(now)


def _acquire_quota_lock(db: Session, *, user_id: int, period: str) -> OcrUsage:
    """Acquire a row-level lock on the user's OCR usage row for this period.

    Creates the row if it does not exist yet. Uses the unique constraint
    (user_id, period) as the serialization point: the first concurrent
    request inserts the row successfully; subsequent requests get
    IntegrityError, roll back the failed insert, then lock the existing row.

    This eliminates the race condition where two requests both see no row,
    both create one, and both increment from 0.
    """
    try:
        usage = OcrUsage(user_id=user_id, period=period, request_count=0, credit_count=0)
        db.add(usage)
        db.flush()
    except IntegrityError:
        db.rollback()  # Roll back the failed INSERT — row was created by another transaction
        usage = (
            db.query(OcrUsage)
            .filter(OcrUsage.user_id == user_id, OcrUsage.period == period)
            .with_for_update()
            .first()
        )
        # IntegrityError guarantees the row exists (another transaction committed it).
        # If it's somehow absent, fall through to create-and-lock as a safety net.
        if not usage:
            usage = OcrUsage(user_id=user_id, period=period, request_count=0, credit_count=0)
            db.add(usage)
            db.flush()
            db.refresh(usage)
    else:
        # We created the row successfully — now lock it so the next request
        # sees our increments rather than reading request_count=0.
        db.refresh(usage)
        usage = (
            db.query(OcrUsage)
            .filter(OcrUsage.id == usage.id)
            .with_for_update()
            .first()
        )
    return usage


def _acquire_org_quota_lock(db: Session, *, org_id: str, period: str) -> OrgOcrUsage:
    """Acquire a row-level lock on the org-level OCR usage row for this period."""
    try:
        usage = OrgOcrUsage(org_id=org_id, period=period, request_count=0, credit_count=0)
        db.add(usage)
        db.flush()
    except IntegrityError:
        db.rollback()
        usage = (
            db.query(OrgOcrUsage)
            .filter(OrgOcrUsage.org_id == org_id, OrgOcrUsage.period == period)
            .with_for_update()
            .first()
        )
        # IntegrityError guarantees the row exists (another transaction committed it).
        # If it's somehow absent, fall through to create-and-lock as a safety net.
        if not usage:
            usage = OrgOcrUsage(org_id=org_id, period=period, request_count=0, credit_count=0)
            db.add(usage)
            db.flush()
            db.refresh(usage)
    else:
        # We created the row successfully — now lock it so the next request
        # sees our increments rather than reading request_count=0.
        db.refresh(usage)
        usage = (
            db.query(OrgOcrUsage)
            .filter(OrgOcrUsage.id == usage.id)
            .with_for_update()
            .first()
        )
    return usage


def _quota_exceeded_response(
    *, usage: OcrUsage | OrgOcrUsage, max_requests: int, max_credits: int, credits: int
) -> HTTPException:
    """Build a consistent 429 response when quota is exhausted."""
    current_requests = int(usage.request_count or 0)
    if max_requests > 0 and (current_requests + 1) > max_requests:
        return HTTPException(
            status_code=429,
            detail={
                "message": f"You have used all {max_requests} OCR scans for this month. Upgrade your plan for more, or wait for your quota to reset on the 1st of next month.",
                "used": current_requests,
                "limit": int(max_requests),
                "reset_date": _next_reset_date(),
                "upgrade_url": "/billing",
            },
        )
    return HTTPException(
        status_code=429,
        detail={
            "message": f"You have used all {max_credits} OCR credits for this month. Upgrade your plan for more, or wait for your quota to reset on the 1st of next month.",
            "used": int(getattr(usage, "credit_count", 0) or 0),
            "limit": int(max_credits),
            "reset_date": _next_reset_date(),
            "upgrade_url": "/billing",
        },
    )


def check_and_record_usage(db: Session, *, user_id: int, image_bytes: int, plan: str) -> dict:
    credits = _compute_credits(image_bytes)
    period = _period_now()
    limits = _effective_plan_limits(db, org_id=None, plan=plan)
    now = datetime.now(timezone.utc)
    max_requests = limits["requests"]
    max_credits = limits["credits"]
    if max_requests < 0 or max_credits < 0:
        raise HTTPException(
            status_code=403,
            detail={
                "error": "ocr_pack_required",
                "message": "Add an OCR pack in Billing to start scanning ledgers.",
                "upgrade_url": "/billing",
            },
        )
    request_limit = max_requests if max_requests > 0 else 1_000_000_000
    credit_limit = max_credits if max_credits > 0 else 1_000_000_000

    if _OCR_QUOTA_ATOMIC_LOCKS:
        # ── Lock path: SELECT FOR UPDATE serializes concurrent requests ──
        usage = _acquire_quota_lock(db, user_id=user_id, period=period)
        if usage.request_count + 1 > request_limit:
            db.rollback()
            raise _quota_exceeded_response(usage=usage, max_requests=max_requests, max_credits=max_credits, credits=credits)
        if usage.credit_count + credits > credit_limit:
            db.rollback()
            raise _quota_exceeded_response(usage=usage, max_requests=max_requests, max_credits=max_credits, credits=credits)
        usage.request_count = usage.request_count + 1
        usage.credit_count = usage.credit_count + credits
        usage.last_request_at = now
        usage.updated_at = now
        db.commit()
        return {"period": period, "requests": usage.request_count, "credits": usage.credit_count}

    # ── Legacy path: UPDATE with WHERE (retained for fallback) ──
    result = db.execute(
        update(OcrUsage)
        .where(
            OcrUsage.user_id == user_id,
            OcrUsage.period == period,
            OcrUsage.request_count + 1 <= request_limit,
            OcrUsage.credit_count + credits <= credit_limit,
        )
        .values(
            request_count=OcrUsage.request_count + 1,
            credit_count=OcrUsage.credit_count + credits,
            last_request_at=now,
            updated_at=now,
        )
    )
    if result.rowcount == 0:
        usage = (
            db.query(OcrUsage)
            .filter(OcrUsage.user_id == user_id, OcrUsage.period == period)
            .first()
        )
        if not usage:
            usage = OcrUsage(user_id=user_id, period=period, request_count=0, credit_count=0)
            db.add(usage)
            db.flush()
        result = db.execute(
            update(OcrUsage)
            .where(
                OcrUsage.user_id == user_id,
                OcrUsage.period == period,
                OcrUsage.request_count + 1 <= request_limit,
                OcrUsage.credit_count + credits <= credit_limit,
            )
            .values(
                request_count=OcrUsage.request_count + 1,
                credit_count=OcrUsage.credit_count + credits,
                last_request_at=now,
                updated_at=now,
            )
        )
        if result.rowcount == 0:
            db.rollback()
            if max_requests > 0 and (usage.request_count + 1) > max_requests:
                raise HTTPException(
                    status_code=429,
                    detail={
                        "message": f"You have used all {max_requests} OCR scans for this month. Upgrade your plan for more, or wait for your quota to reset on the 1st of next month.",
                        "used": int(usage.request_count or 0),
                        "limit": int(max_requests),
                        "reset_date": _next_reset_date(),
                        "upgrade_url": "/billing",
                    },
                )
            raise HTTPException(
                status_code=429,
                detail={
                    "message": f"You have used all {max_credits} OCR credits for this month. Upgrade your plan for more, or wait for your quota to reset on the 1st of next month.",
                    "used": int(usage.credit_count or 0),
                    "limit": int(max_credits),
                    "reset_date": _next_reset_date(),
                    "upgrade_url": "/billing",
                },
            )
    db.commit()
    usage = (
        db.query(OcrUsage)
        .filter(OcrUsage.user_id == user_id, OcrUsage.period == period)
        .first()
    )
    return {
        "period": period,
        "requests": int(usage.request_count or 0) if usage else 0,
        "credits": int(usage.credit_count or 0) if usage else 0,
    }


def check_and_record_org_usage(
    db: Session, *, org_id: str, image_bytes: int, plan: str
) -> dict:
    credits = _compute_credits(image_bytes)
    period = _period_now()
    limits = _effective_plan_limits(db, org_id=org_id, plan=plan)
    now = datetime.now(timezone.utc)
    max_requests = limits["requests"]
    max_credits = limits["credits"]
    if max_requests < 0 or max_credits < 0:
        raise HTTPException(
            status_code=403,
            detail={
                "error": "ocr_pack_required",
                "message": "Add an OCR pack in Billing to start scanning ledgers.",
                "upgrade_url": "/billing",
            },
        )
    request_limit = max_requests if max_requests > 0 else 1_000_000_000
    credit_limit = max_credits if max_credits > 0 else 1_000_000_000

    if _OCR_QUOTA_ATOMIC_LOCKS:
        # ── Lock path: SELECT FOR UPDATE serializes concurrent requests ──
        usage = _acquire_org_quota_lock(db, org_id=org_id, period=period)
        if usage.request_count + 1 > request_limit:
            db.rollback()
            raise _quota_exceeded_response(usage=usage, max_requests=max_requests, max_credits=max_credits, credits=credits)
        if usage.credit_count + credits > credit_limit:
            db.rollback()
            raise _quota_exceeded_response(usage=usage, max_requests=max_requests, max_credits=max_credits, credits=credits)
        usage.request_count = usage.request_count + 1
        usage.credit_count = usage.credit_count + credits
        usage.last_request_at = now
        usage.updated_at = now
        db.commit()
        return {
            "period": period,
            "requests": usage.request_count,
            "credits": usage.credit_count,
        }

    # ── Legacy path: UPDATE with WHERE (retained for fallback) ──
    result = db.execute(
        update(OrgOcrUsage)
        .where(
            OrgOcrUsage.org_id == org_id,
            OrgOcrUsage.period == period,
            OrgOcrUsage.request_count + 1 <= request_limit,
            OrgOcrUsage.credit_count + credits <= credit_limit,
        )
        .values(
            request_count=OrgOcrUsage.request_count + 1,
            credit_count=OrgOcrUsage.credit_count + credits,
            last_request_at=now,
            updated_at=now,
        )
    )
    if result.rowcount == 0:
        usage = (
            db.query(OrgOcrUsage)
            .filter(OrgOcrUsage.org_id == org_id, OrgOcrUsage.period == period)
            .first()
        )
        if not usage:
            usage = OrgOcrUsage(org_id=org_id, period=period, request_count=0, credit_count=0)
            db.add(usage)
            db.flush()
        result = db.execute(
            update(OrgOcrUsage)
            .where(
                OrgOcrUsage.org_id == org_id,
                OrgOcrUsage.period == period,
                OrgOcrUsage.request_count + 1 <= request_limit,
                OrgOcrUsage.credit_count + credits <= credit_limit,
            )
            .values(
                request_count=OrgOcrUsage.request_count + 1,
                credit_count=OrgOcrUsage.credit_count + credits,
                last_request_at=now,
                updated_at=now,
            )
        )
        if result.rowcount == 0:
            db.rollback()
            if max_requests > 0 and (usage.request_count + 1) > max_requests:
                raise HTTPException(
                    status_code=429,
                    detail={
                        "message": f"You have used all {max_requests} OCR scans for this month. Upgrade your plan for more, or wait for your quota to reset on the 1st of next month.",
                        "used": int(usage.request_count or 0),
                        "limit": int(max_requests),
                        "reset_date": _next_reset_date(),
                        "upgrade_url": "/billing",
                    },
                )
            raise HTTPException(
                status_code=429,
                detail={
                    "message": f"You have used all {max_credits} OCR credits for this month. Upgrade your plan for more, or wait for your quota to reset on the 1st of next month.",
                    "used": int(usage.credit_count or 0),
                    "limit": int(max_credits),
                    "reset_date": _next_reset_date(),
                    "upgrade_url": "/billing",
                },
            )
    db.commit()
    usage = (
        db.query(OrgOcrUsage)
        .filter(OrgOcrUsage.org_id == org_id, OrgOcrUsage.period == period)
        .first()
    )
    return {
        "period": period,
        "requests": int(usage.request_count or 0) if usage else 0,
        "credits": int(usage.credit_count or 0) if usage else 0,
    }


def get_usage_summary(db: Session, *, user_id: int, plan: str | None = None) -> dict:
    """Return combined OCR + AI feature usage for a user.

    If an explicit plan is provided (already normalized at the caller),
    use it for computing limits so that the display matches the active
    subscription/organization plan. Otherwise, fall back to the per-user
    plan row as before.
    """
    from backend.feature_limits import get_feature_usage_summary

    if plan:
        plan = normalize_plan(plan)
    else:
        plan = get_user_plan(db, user_id=user_id)
    user = db.query(User).filter(User.id == user_id).first()
    limits = _effective_plan_limits(db, org_id=getattr(user, "org_id", None), plan=plan)
    period = _period_now()
    usage = (
        db.query(OcrUsage)
        .filter(OcrUsage.user_id == user_id, OcrUsage.period == period)
        .first()
    )
    summary = {
        "plan": plan,
        "period": period,
        "requests_used": usage.request_count if usage else 0,
        "credits_used": usage.credit_count if usage else 0,
        "max_requests": limits["requests"],
        "max_credits": limits["credits"],
        "rate_limit_per_minute": limits["rate"],
    }
    summary.update(get_feature_usage_summary(db, user_id=user_id, plan=plan))
    return summary


def get_org_usage_summary(db: Session, *, org_id: str, plan: str) -> dict:
    from backend.feature_limits import get_org_feature_usage_summary

    limits = _effective_plan_limits(db, org_id=org_id, plan=plan)
    period = _period_now()
    usage = (
        db.query(OrgOcrUsage)
        .filter(OrgOcrUsage.org_id == org_id, OrgOcrUsage.period == period)
        .first()
    )
    summary = {
        "plan": plan,
        "period": period,
        "requests_used": usage.request_count if usage else 0,
        "credits_used": usage.credit_count if usage else 0,
        "max_requests": limits["requests"],
        "max_credits": limits["credits"],
        "rate_limit_per_minute": limits["rate"],
    }
    summary.update(get_org_feature_usage_summary(db, org_id=org_id, plan=plan))
    return summary
