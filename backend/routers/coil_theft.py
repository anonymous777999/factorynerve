"""Coil theft detection router."""

from __future__ import annotations

from datetime import date, datetime, timezone
from typing import Optional

from fastapi import APIRouter, Depends, HTTPException, Query, status
from pydantic import BaseModel
from sqlalchemy.orm import Session

from backend.authorization import PDP, ResourceContext
from backend.database import get_db
from backend.dependencies.quota import consume_ai_quota
from backend.database import SessionLocal
from backend.models.alert import Alert, AlertReadSchema
from backend.models.user import User, UserRole
from backend.services.coil_theft_service import detect_coil_theft
from backend.services.background_jobs import create_job, start_job
from backend.tenancy import resolve_factory_id, resolve_org_id
import os
from backend.plans import get_org_plan, normalize_plan, plan_rank
from backend.security import get_current_user

router = APIRouter(tags=["coil-theft"])

COIL_THEFT_MIN_PLAN = "pilot"


def _require_min_plan(db: Session, current_user: User, *, feature_name: str) -> str:
    org_id = resolve_org_id(current_user)
    plan = get_org_plan(db, org_id=org_id, fallback_user_id=current_user.id)
    min_plan = normalize_plan(os.getenv("COIL_THEFT_MIN_PLAN") or COIL_THEFT_MIN_PLAN)
    if plan_rank(plan) < plan_rank(min_plan):
        raise HTTPException(
            status_code=402,
            detail=f"{feature_name} is not available on the {plan.title()} plan. Upgrade to {min_plan.title()} or higher to unlock this.",
        )
    return plan


def _consume_quota(db: Session, current_user: User, *, quota_feature: str, plan: str) -> None:
    # Placeholder: implement actual quota consumption if needed
    # For now, we just call the AI quota function as an example
    from backend.ai_rate_limit import check_rate_limit, RateLimitError
    from backend.tenancy import resolve_org_id
    try:
        check_rate_limit(current_user.id, feature=quota_feature)
    except RateLimitError as error:
        raise HTTPException(status_code=429, detail=error.detail) from error
    org_id = resolve_org_id(current_user)
    if org_id:
        from backend.services.ai_router import consume_ai_quota
        consume_ai_quota(db, org_id=org_id, feature=quota_feature)


class CoilTheftDetectionResponse(BaseModel):
    job_id: str
    status: str
    message: str


@router.post("/detect", response_model=CoilTheftDetectionResponse)
def trigger_coil_theft_detection(
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
) -> CoilTheftDetectionResponse:
    """Manually trigger coil theft detection as a background job."""
    # Authorization: only roles that can view alerts or manage fraud?
    # We'll reuse AI anomalies permission for simplicity.
    pdp = PDP(db=db)
    factory_id = resolve_factory_id(db, current_user)
    pdp.require_permission(
        actor=current_user,
        permission_key="ai.anomalies.view",
        resource=ResourceContext(factory_id=factory_id) if factory_id else None,
    )
    # Plan check
    plan = _require_min_plan(db, current_user, feature_name="Coil theft detection")
    # Consume quota (using summary quota as proxy)
    _consume_quota(db, current_user, quota_feature="summary", plan=plan)

    # Create background job
    job = create_job(
        kind="coil_theft_detection",
        owner_id=current_user.id,
        org_id=resolve_org_id(current_user),
        message="Queued coil theft detection",
        context={
            "route": "/coil-theft/detect",
        },
        retry_context={
            "owner_id": current_user.id,
            "org_id": resolve_org_id(current_user),
            "factory_id": factory_id,
        },
    )

    def worker(progress_callback):
        # Simulate work
        progress_callback(10, "Starting coil theft detection")
        with SessionLocal() as job_db:
            # Re-resolve tenant context
            job_user = job_db.query(User).filter(User.id == current_user.id).first()
            if not job_user:
                raise RuntimeError("User is no longer available for coil theft detection.")
            job_user.active_org_id = resolve_org_id(job_user)
            job_user.active_factory_id = resolve_factory_id(job_db, job_user)
            progress_callback(50, "Running detection")
            alerts = detect_coil_theft(
                job_db,
                org_id=resolve_org_id(job_user),
                factory_id=resolve_factory_id(job_db, job_user),
            )
            progress_callback(90, f"Generated {len(alerts)} alerts")
            # Optionally persist result
            result = {"alerts_generated": len(alerts)}
            progress_callback(100, "Completed")
            return result

    start_job(job["job_id"], worker)
    return CoilTheftDetectionResponse(
        job_id=job["job_id"],
        status=job["status"],
        message=job["message"],
    )


@router.get("/alerts", response_model=list[AlertReadSchema])
def get_coil_theft_alerts(
    limit: int = Query(default=50, ge=1, le=200),
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
) -> list[AlertReadSchema]:
    """Fetch recent coil theft alerts."""
    pdp = PDP(db=db)
    factory_id = resolve_factory_id(db, current_user)
    pdp.require_permission(
        actor=current_user,
        permission_key="ai.anomalies.view",
        resource=ResourceContext(factory_id=factory_id) if factory_id else None,
    )
    org_id = resolve_org_id(current_user)
    query = db.query(Alert).filter(Alert.alert_type == "coil_theft_suspicion")
    if org_id:
        # Alerts are linked to entries; we need to join Entry to filter by org.
        from backend.models.entry import Entry
        query = query.join(Entry, Alert.entry_id == Entry.id).filter(Entry.org_id == org_id)
    alerts = query.order_by(Alert.created_at.desc()).limit(limit).all()
    return alerts