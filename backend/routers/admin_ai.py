"""Superadmin AI usage visibility endpoints."""

from __future__ import annotations

from datetime import datetime, timezone

from fastapi import APIRouter, Depends, Query
from sqlalchemy import case, func
from sqlalchemy.orm import Session

from backend.database import get_db
from backend.models.ai_usage_log import AIUsageLog
from backend.models.organization import Organization
from backend.models.user import User
from backend.routers.admin_billing import require_superadmin


router = APIRouter(prefix="/admin/ai", tags=["Admin AI"])


@router.get("/usage")
def get_ai_usage(
    org_id: str | None = Query(default=None),
    since: datetime | None = Query(default=None),
    until: datetime | None = Query(default=None),
    _admin: User = Depends(require_superadmin),
    db: Session = Depends(get_db),
) -> dict[str, object]:
    start = since or datetime.now(timezone.utc).replace(hour=0, minute=0, second=0, microsecond=0)
    end = until or datetime.now(timezone.utc)
    query = db.query(AIUsageLog).filter(AIUsageLog.created_at >= start, AIUsageLog.created_at <= end)
    if org_id:
        query = query.filter(AIUsageLog.org_id == org_id)

    daily_rows = (
        query.with_entities(
            func.date(AIUsageLog.created_at).label("usage_day"),
            func.sum(AIUsageLog.input_tokens + AIUsageLog.output_tokens).label("total_tokens"),
            func.sum(AIUsageLog.estimated_cost_usd).label("total_cost"),
            func.avg(case((AIUsageLog.cache_hit.is_(True), 1.0), else_=0.0)).label("cache_hit_rate"),
        )
        .group_by(func.date(AIUsageLog.created_at))
        .order_by(func.date(AIUsageLog.created_at).desc())
        .all()
    )
    top_pipelines = (
        query.with_entities(
            AIUsageLog.pipeline_name,
            func.sum(AIUsageLog.estimated_cost_usd).label("total_cost"),
            func.sum(AIUsageLog.input_tokens + AIUsageLog.output_tokens).label("total_tokens"),
            func.avg(case((AIUsageLog.cache_hit.is_(True), 1.0), else_=0.0)).label("cache_hit_rate"),
        )
        .group_by(AIUsageLog.pipeline_name)
        .order_by(func.sum(AIUsageLog.estimated_cost_usd).desc(), AIUsageLog.pipeline_name.asc())
        .all()
    )
    return {
        "org_id": org_id,
        "since": start,
        "until": end,
        "daily_usage": [
            {
                "day": str(row.usage_day),
                "total_tokens": int(row.total_tokens or 0),
                "total_cost_usd": float(row.total_cost or 0.0),
                "cache_hit_rate": round(float(row.cache_hit_rate or 0.0), 4),
            }
            for row in daily_rows
        ],
        "top_pipelines_by_cost": [
            {
                "pipeline_name": row.pipeline_name,
                "total_cost_usd": float(row.total_cost or 0.0),
                "total_tokens": int(row.total_tokens or 0),
                "cache_hit_rate": round(float(row.cache_hit_rate or 0.0), 4),
            }
            for row in top_pipelines
        ],
    }


@router.get("/cost-summary")
def get_ai_cost_summary(
    _admin: User = Depends(require_superadmin),
    db: Session = Depends(get_db),
) -> list[dict[str, object]]:
    now = datetime.now(timezone.utc)
    month_start = datetime(now.year, now.month, 1, tzinfo=timezone.utc)
    rows = (
        db.query(
            Organization.org_id,
            Organization.name,
            func.coalesce(func.sum(AIUsageLog.estimated_cost_usd), 0.0).label("monthly_cost_usd"),
            func.coalesce(func.sum(AIUsageLog.input_tokens + AIUsageLog.output_tokens), 0).label("monthly_tokens"),
            func.avg(case((AIUsageLog.cache_hit.is_(True), 1.0), else_=0.0)).label("cache_hit_rate"),
        )
        .outerjoin(
            AIUsageLog,
            (AIUsageLog.org_id == Organization.org_id) & (AIUsageLog.created_at >= month_start),
        )
        .group_by(Organization.org_id, Organization.name)
        .order_by(func.coalesce(func.sum(AIUsageLog.estimated_cost_usd), 0.0).desc(), Organization.name.asc())
        .all()
    )
    return [
        {
            "org_id": row.org_id,
            "org_name": row.name,
            "monthly_cost_usd": float(row.monthly_cost_usd or 0.0),
            "monthly_tokens": int(row.monthly_tokens or 0),
            "cache_hit_rate": round(float(row.cache_hit_rate or 0.0), 4),
        }
        for row in rows
    ]
