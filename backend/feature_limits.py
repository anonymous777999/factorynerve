"""Per-user AI feature limits and usage tracking."""

from __future__ import annotations

from datetime import datetime, timezone

from fastapi import HTTPException
from sqlalchemy import update
from sqlalchemy.orm import Session

from backend.models.feature_usage import FeatureUsage
from backend.models.org_feature_usage import OrgFeatureUsage
from backend.plans import get_plan, min_plan_for_feature, normalize_plan, plan_limit_is_unlimited


FEATURES = ("summary", "email", "smart")


def _period_key(now: datetime | None = None) -> str:
    current = now or datetime.now(timezone.utc)
    return current.strftime("%Y-%m")


def _plan_limits(plan: str) -> dict[str, int]:
    key = normalize_plan(plan)
    catalog = get_plan(key)
    limits = catalog.get("limits", {})
    return {
        "summary": int(limits.get("summary", 0)),
        "email": int(limits.get("email", 0)),
        "smart": int(limits.get("smart", 0)),
    }


def _display_limit(plan: str, feature_key: str) -> int:
    limit = int(_plan_limits(plan).get(feature_key, 0))
    if limit > 0:
        return limit
    if plan_limit_is_unlimited(plan, feature_key):
        return 0
    return -1


def _next_reset_date(now: datetime | None = None) -> str:
    current = now or datetime.now(timezone.utc)
    year = current.year + (1 if current.month == 12 else 0)
    month = 1 if current.month == 12 else current.month + 1
    return datetime(year, month, 1, tzinfo=timezone.utc).date().isoformat()


def _feature_label(feature_key: str) -> str:
    labels = {
        "summary": "AI summaries",
        "email": "AI emails",
        "smart": "Smart inputs",
    }
    return labels.get(feature_key, feature_key.title())


def check_and_record_feature_usage(
    db: Session,
    *,
    user_id: int,
    feature: str,
    plan: str,
    increment: int = 1,
) -> dict[str, int | str]:
    feature_key = (feature or "").strip().lower()
    if feature_key not in FEATURES:
        raise HTTPException(status_code=400, detail="Unknown feature usage type.")
    if int(increment) <= 0:
        raise HTTPException(status_code=400, detail="Usage increment must be a positive integer.")
    limits = _plan_limits(plan)
    max_allowed = int(limits.get(feature_key, 0))
    if max_allowed == 0:
        if plan_limit_is_unlimited(plan, feature_key):
            return {"period": _period_key(), "used": 0, "max": 0}
        current_plan = normalize_plan(plan).title()
        min_plan = min_plan_for_feature(feature_key).title()
        raise HTTPException(
            status_code=403,
            detail=f"{_feature_label(feature_key)} is not available on the {current_plan} plan. Upgrade to {min_plan} or higher to unlock this.",
        )

    period = _period_key()
    now = datetime.now(timezone.utc)
    result = db.execute(
        update(FeatureUsage)
        .where(
            FeatureUsage.user_id == user_id,
            FeatureUsage.period == period,
            FeatureUsage.feature == feature_key,
            FeatureUsage.request_count + int(increment) <= max_allowed,
        )
        .values(
            request_count=FeatureUsage.request_count + int(increment),
            last_request_at=now,
            updated_at=now,
        )
    )
    if result.rowcount == 0:
        usage = (
            db.query(FeatureUsage)
            .filter(
                FeatureUsage.user_id == user_id,
                FeatureUsage.period == period,
                FeatureUsage.feature == feature_key,
            )
            .first()
        )
        if not usage:
            usage = FeatureUsage(
                user_id=user_id,
                period=period,
                feature=feature_key,
                request_count=0,
            )
            db.add(usage)
            db.flush()
        result = db.execute(
            update(FeatureUsage)
            .where(
                FeatureUsage.user_id == user_id,
                FeatureUsage.period == period,
                FeatureUsage.feature == feature_key,
                FeatureUsage.request_count + int(increment) <= max_allowed,
            )
            .values(
                request_count=FeatureUsage.request_count + int(increment),
                last_request_at=now,
                updated_at=now,
            )
        )
        if result.rowcount == 0:
            db.rollback()
            used = int(usage.request_count or 0)
            limit = int(max_allowed)
            raise HTTPException(
                status_code=429,
                detail={
                    "message": f"You have used all {limit} {_feature_label(feature_key)} for this month. Upgrade your plan for more, or wait for your quota to reset on the 1st of next month.",
                    "used": used,
                    "limit": limit,
                    "reset_date": _next_reset_date(),
                    "upgrade_url": "/billing",
                },
            )
    db.commit()
    usage = (
        db.query(FeatureUsage)
        .filter(
            FeatureUsage.user_id == user_id,
            FeatureUsage.period == period,
            FeatureUsage.feature == feature_key,
        )
        .first()
    )
    used = int(usage.request_count or 0) if usage else 0
    return {"period": period, "used": used, "max": max_allowed}


def check_and_record_org_feature_usage(
    db: Session,
    *,
    org_id: str,
    feature: str,
    plan: str,
    increment: int = 1,
) -> dict[str, int | str]:
    feature_key = (feature or "").strip().lower()
    if feature_key not in FEATURES:
        raise HTTPException(status_code=400, detail="Unknown feature usage type.")
    if int(increment) <= 0:
        raise HTTPException(status_code=400, detail="Usage increment must be a positive integer.")
    limits = _plan_limits(plan)
    max_allowed = int(limits.get(feature_key, 0))
    if max_allowed == 0:
        if plan_limit_is_unlimited(plan, feature_key):
            return {"period": _period_key(), "used": 0, "max": 0}
        current_plan = normalize_plan(plan).title()
        min_plan = min_plan_for_feature(feature_key).title()
        raise HTTPException(
            status_code=403,
            detail=f"{_feature_label(feature_key)} is not available on the {current_plan} plan. Upgrade to {min_plan} or higher to unlock this.",
        )

    period = _period_key()
    now = datetime.now(timezone.utc)
    result = db.execute(
        update(OrgFeatureUsage)
        .where(
            OrgFeatureUsage.org_id == org_id,
            OrgFeatureUsage.period == period,
            OrgFeatureUsage.feature == feature_key,
            OrgFeatureUsage.request_count + int(increment) <= max_allowed,
        )
        .values(
            request_count=OrgFeatureUsage.request_count + int(increment),
            last_request_at=now,
            updated_at=now,
        )
    )
    if result.rowcount == 0:
        usage = (
            db.query(OrgFeatureUsage)
            .filter(
                OrgFeatureUsage.org_id == org_id,
                OrgFeatureUsage.period == period,
                OrgFeatureUsage.feature == feature_key,
            )
            .first()
        )
        if not usage:
            usage = OrgFeatureUsage(
                org_id=org_id,
                period=period,
                feature=feature_key,
                request_count=0,
            )
            db.add(usage)
            db.flush()
        result = db.execute(
            update(OrgFeatureUsage)
            .where(
                OrgFeatureUsage.org_id == org_id,
                OrgFeatureUsage.period == period,
                OrgFeatureUsage.feature == feature_key,
                OrgFeatureUsage.request_count + int(increment) <= max_allowed,
            )
            .values(
                request_count=OrgFeatureUsage.request_count + int(increment),
                last_request_at=now,
                updated_at=now,
            )
        )
        if result.rowcount == 0:
            db.rollback()
            used = int(usage.request_count or 0)
            limit = int(max_allowed)
            raise HTTPException(
                status_code=429,
                detail={
                    "message": f"You have used all {limit} {_feature_label(feature_key)} for this month. Upgrade your plan for more, or wait for your quota to reset on the 1st of next month.",
                    "used": used,
                    "limit": limit,
                    "reset_date": _next_reset_date(),
                    "upgrade_url": "/billing",
                },
            )
    db.commit()
    usage = (
        db.query(OrgFeatureUsage)
        .filter(
            OrgFeatureUsage.org_id == org_id,
            OrgFeatureUsage.period == period,
            OrgFeatureUsage.feature == feature_key,
        )
        .first()
    )
    used = int(usage.request_count or 0) if usage else 0
    return {"period": period, "used": used, "max": max_allowed}


def get_feature_usage_summary(db: Session, *, user_id: int, plan: str) -> dict:
    period = _period_key()
    limits = _plan_limits(plan)
    rows = (
        db.query(FeatureUsage)
        .filter(FeatureUsage.user_id == user_id, FeatureUsage.period == period)
        .all()
    )
    used_map = {row.feature: int(row.request_count or 0) for row in rows}
    return {
        "period": period,
        "summary_used": used_map.get("summary", 0),
        "email_used": used_map.get("email", 0),
        "smart_used": used_map.get("smart", 0),
        "summary_limit": _display_limit(plan, "summary"),
        "email_limit": _display_limit(plan, "email"),
        "smart_limit": _display_limit(plan, "smart"),
    }


def get_org_feature_usage_summary(db: Session, *, org_id: str, plan: str) -> dict:
    period = _period_key()
    limits = _plan_limits(plan)
    rows = (
        db.query(OrgFeatureUsage)
        .filter(OrgFeatureUsage.org_id == org_id, OrgFeatureUsage.period == period)
        .all()
    )
    used_map = {row.feature: int(row.request_count or 0) for row in rows}
    return {
        "period": period,
        "summary_used": used_map.get("summary", 0),
        "email_used": used_map.get("email", 0),
        "smart_used": used_map.get("smart", 0),
        "summary_limit": _display_limit(plan, "summary"),
        "email_limit": _display_limit(plan, "email"),
        "smart_limit": _display_limit(plan, "smart"),
    }
