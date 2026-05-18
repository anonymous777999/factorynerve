"""AI usage ledger plus org cap enforcement."""

from __future__ import annotations

from datetime import datetime, timedelta, timezone

from fastapi import HTTPException
from sqlalchemy import func
from sqlalchemy.orm import Session

from backend.ai.providers.base import RawAIResponse
from backend.models.ai_usage_log import AIUsageLog
from backend.models.organization import Organization


class AIUsageTracker:
    def __init__(self, db: Session) -> None:
        self.db = db

    async def check_org_daily_token_cap(self, org_id: str) -> None:
        org = self.db.query(Organization).filter(Organization.org_id == org_id, Organization.is_active.is_(True)).first()
        if org is None:
            return
        since = datetime.now(timezone.utc) - timedelta(hours=24)
        used_tokens = int(
            self.db.query(
                func.coalesce(func.sum(AIUsageLog.input_tokens + AIUsageLog.output_tokens), 0)
            )
            .filter(AIUsageLog.org_id == org_id, AIUsageLog.created_at >= since)
            .scalar()
            or 0
        )
        if used_tokens >= int(org.ai_daily_token_cap):
            raise HTTPException(
                status_code=429,
                detail={"code": "AI_QUOTA_EXCEEDED", "org_id": org_id},
            )

    async def check_org_monthly_cost_cap(self, org_id: str) -> None:
        org = self.db.query(Organization).filter(Organization.org_id == org_id, Organization.is_active.is_(True)).first()
        if org is None:
            return
        now = datetime.now(timezone.utc)
        month_start = datetime(now.year, now.month, 1, tzinfo=timezone.utc)
        used_cost = float(
            self.db.query(func.coalesce(func.sum(AIUsageLog.estimated_cost_usd), 0.0))
            .filter(AIUsageLog.org_id == org_id, AIUsageLog.created_at >= month_start)
            .scalar()
            or 0.0
        )
        if used_cost >= float(org.ai_monthly_cost_cap_usd):
            raise HTTPException(
                status_code=429,
                detail={"code": "AI_COST_CAP_EXCEEDED", "org_id": org_id},
            )

    def log_usage(
        self,
        *,
        org_id: str,
        pipeline_name: str,
        prompt_name: str,
        prompt_version: str,
        model: str,
        input_tokens: int,
        output_tokens: int,
        estimated_cost_usd: float,
        cache_hit: bool,
        success: bool,
        latency_ms: int,
    ) -> None:
        self.db.add(
            AIUsageLog(
                org_id=org_id,
                pipeline_name=pipeline_name,
                prompt_name=prompt_name,
                prompt_version=prompt_version,
                model=model,
                input_tokens=max(0, int(input_tokens)),
                output_tokens=max(0, int(output_tokens)),
                estimated_cost_usd=max(0.0, float(estimated_cost_usd)),
                cache_hit=cache_hit,
                success=success,
                latency_ms=max(0, int(latency_ms)),
            )
        )
        self.db.flush()

    def log_raw_response(
        self,
        *,
        org_id: str,
        pipeline_name: str,
        prompt_name: str,
        prompt_version: str,
        raw: RawAIResponse,
        cache_hit: bool,
        success: bool,
    ) -> None:
        self.log_usage(
            org_id=org_id,
            pipeline_name=pipeline_name,
            prompt_name=prompt_name,
            prompt_version=prompt_version,
            model=raw.model,
            input_tokens=raw.usage.input_tokens,
            output_tokens=raw.usage.output_tokens,
            estimated_cost_usd=raw.usage.estimated_cost_usd,
            cache_hit=cache_hit,
            success=success,
            latency_ms=raw.latency_ms,
        )
