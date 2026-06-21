"""Workforce intelligence routes: overview, worker ranking, trends, shift comparison,
cost summary, and cost rate management.

Phase 1 — No schema changes required except for the new ``WorkforceCostRate`` table.
All shift-level and worker-level analytics are derived from existing
attendance records, employee profiles, and production entry data.
"""

from __future__ import annotations

from datetime import date

from fastapi import APIRouter, Depends, HTTPException, Query
from pydantic import BaseModel, Field
from sqlalchemy.orm import Session

import logging

from fastapi import APIRouter, Depends, HTTPException, Query
from pydantic import BaseModel, Field
from sqlalchemy.orm import Session

from backend.authorization import PDP, ResourceContext
from backend.database import get_db
from backend.models.user import User
from backend.security import get_current_user
from backend.services.steel_service import require_active_steel_factory
from backend.services.workforce_intelligence import (
    build_workforce_overview,
    build_workers,
    build_worker_trend,
    list_cost_rates,
    create_cost_rate,
)
from backend.tenancy import resolve_org_id

logger = logging.getLogger(__name__)

router = APIRouter(tags=["Workforce Intelligence"])


# ═══════════════════════════════════════════════════════════════════════════════
# Overview
# ═══════════════════════════════════════════════════════════════════════════════


@router.get("/workforce/overview")
def get_workforce_overview(
    days: int = Query(default=30, ge=1, le=365),
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
) -> dict:
    """Top-level workforce KPIs: attendance, overtime, shift comparison, cost."""
    try:
        try:
            factory = require_active_steel_factory(db, current_user)
        except ValueError as error:
            raise HTTPException(status_code=400, detail=str(error)) from error
        pdp = PDP(db=db)
        pdp.require_permission(
            actor=current_user,
            permission_key="workforce.overview.view",
            resource=ResourceContext(factory_id=factory.factory_id),
        )
        cost_decision = pdp.check_permission(
            actor=current_user,
            permission_key="workforce.cost.view",
            resource=ResourceContext(factory_id=factory.factory_id),
        )
        return build_workforce_overview(
            db,
            factory.factory_id,
            days=days,
            can_view_cost=cost_decision.is_allowed,
        )
    except HTTPException:
        raise
    except Exception as exc:
        logger.exception("Workforce overview failed")
        raise HTTPException(status_code=500, detail=f"Internal error: {exc}") from exc


# ═══════════════════════════════════════════════════════════════════════════════
# Workers (ranked)
# ═══════════════════════════════════════════════════════════════════════════════


@router.get("/workforce/workers")
def get_workforce_workers(
    days: int = Query(default=30, ge=1, le=365),
    sort_by: str = Query(default="worked_minutes", pattern="^(worked_minutes|overtime|late|attendance_days|cost|name)$"),
    limit: int = Query(default=50, ge=1, le=200),
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
) -> dict:
    """Ranked worker table (sortable by attendance, overtime, cost)."""
    try:
        try:
            factory = require_active_steel_factory(db, current_user)
        except ValueError as error:
            raise HTTPException(status_code=400, detail=str(error)) from error
        pdp = PDP(db=db)
        pdp.require_permission(
            actor=current_user,
            permission_key="workforce.workers.view",
            resource=ResourceContext(factory_id=factory.factory_id),
        )
        cost_decision = pdp.check_permission(
            actor=current_user,
            permission_key="workforce.cost.view",
            resource=ResourceContext(factory_id=factory.factory_id),
        )
        return build_workers(
            db,
            factory.factory_id,
            days=days,
            sort_by=sort_by,
            limit=limit,
            can_view_cost=cost_decision.is_allowed,
        )
    except HTTPException:
        raise
    except Exception as exc:
        logger.exception("Workforce workers failed")
        raise HTTPException(status_code=500, detail=f"Internal error: {exc}") from exc


# ═══════════════════════════════════════════════════════════════════════════════
# Per-worker trend
# ═══════════════════════════════════════════════════════════════════════════════


@router.get("/workforce/workers/{user_id}/trend")
def get_workforce_worker_trend(
    user_id: int,
    days: int = Query(default=30, ge=1, le=365),
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
) -> dict:
    """Daily attendance trend for a single worker."""
    try:
        try:
            factory = require_active_steel_factory(db, current_user)
        except ValueError as error:
            raise HTTPException(status_code=400, detail=str(error)) from error
        pdp = PDP(db=db)
        pdp.require_permission(
            actor=current_user,
            permission_key="workforce.workers.view",
            resource=ResourceContext(factory_id=factory.factory_id),
        )
        cost_decision = pdp.check_permission(
            actor=current_user,
            permission_key="workforce.cost.view",
            resource=ResourceContext(factory_id=factory.factory_id),
        )
        return build_worker_trend(
            db,
            factory.factory_id,
            user_id=user_id,
            days=days,
            can_view_cost=cost_decision.is_allowed,
        )
    except HTTPException:
        raise
    except Exception as exc:
        logger.exception("Workforce worker trend failed")
        raise HTTPException(status_code=500, detail=f"Internal error: {exc}") from exc


# ═══════════════════════════════════════════════════════════════════════════════
# Shift comparison (also available via overview, but exposed independently)
# ═══════════════════════════════════════════════════════════════════════════════


@router.get("/workforce/shifts/comparison")
def get_workforce_shift_comparison(
    days: int = Query(default=30, ge=1, le=365),
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
) -> dict:
    """Morning/evening/night shift comparison: attendance, overtime, lateness."""
    try:
        try:
            factory = require_active_steel_factory(db, current_user)
        except ValueError as error:
            raise HTTPException(status_code=400, detail=str(error)) from error
        PDP(db=db).require_permission(
            actor=current_user,
            permission_key="workforce.overview.view",
            resource=ResourceContext(factory_id=factory.factory_id),
        )
        result = build_workforce_overview(db, factory.factory_id, days=days, can_view_cost=False)
        return result.get("shift_comparison", {})
    except HTTPException:
        raise
    except Exception as exc:
        logger.exception("Workforce shif comparison failed")
        raise HTTPException(status_code=500, detail=f"Internal error: {exc}") from exc


# ═══════════════════════════════════════════════════════════════════════════════
# Cost summary
# ═══════════════════════════════════════════════════════════════════════════════


@router.get("/workforce/costs/summary")
def get_workforce_cost_summary(
    days: int = Query(default=30, ge=1, le=365),
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
) -> dict:
    """Labour cost breakdown (financial roles only)."""
    try:
        try:
            factory = require_active_steel_factory(db, current_user)
        except ValueError as error:
            raise HTTPException(status_code=400, detail=str(error)) from error
        pdp = PDP(db=db)
        pdp.require_permission(
            actor=current_user,
            permission_key="workforce.cost.view",
            resource=ResourceContext(factory_id=factory.factory_id),
        )
        result = build_workforce_overview(
            db,
            factory.factory_id,
            days=days,
            can_view_cost=True,
        )
        cost = result.get("cost_summary", {})
        return {
            "as_of": result["as_of"],
            "period_days": days,
            "financial_access": True,
            **cost,
        }
    except HTTPException:
        raise
    except Exception as exc:
        logger.exception("Workforce cost summary failed")
        raise HTTPException(status_code=500, detail=f"Internal error: {exc}") from exc


# ═══════════════════════════════════════════════════════════════════════════════
# Cost rates CRUD
# ═══════════════════════════════════════════════════════════════════════════════


class CostRateCreateRequest(BaseModel):
    user_id: int | None = Field(default=None)
    role: str | None = Field(default=None, max_length=32)
    department: str | None = Field(default=None, max_length=120)
    effective_from: date
    effective_to: date | None = None
    regular_hourly_rate_inr: float = Field(gt=0, le=99999)
    overtime_multiplier: float = Field(default=1.5, ge=1.0, le=5.0)
    notes: str | None = Field(default=None, max_length=300)


@router.get("/workforce/costs/rates")
def list_workforce_cost_rates(
    limit: int = Query(default=50, ge=1, le=200),
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
) -> dict:
    """List configured labour cost rates."""
    try:
        factory = require_active_steel_factory(db, current_user)
    except ValueError as error:
        raise HTTPException(status_code=400, detail=str(error)) from error
    PDP(db=db).require_permission(
        actor=current_user,
        permission_key="workforce.cost.view",
        resource=ResourceContext(factory_id=factory.factory_id),
    )
    return {
        "items": list_cost_rates(db, factory.factory_id, limit=limit),
    }


@router.post("/workforce/costs/rates")
def create_workforce_cost_rate(
    payload: CostRateCreateRequest,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
) -> dict:
    """Create a new labour cost rate entry."""
    try:
        factory = require_active_steel_factory(db, current_user)
    except ValueError as error:
        raise HTTPException(status_code=400, detail=str(error)) from error
    PDP(db=db).require_permission(
        actor=current_user,
        permission_key="workforce.cost.manage",
        resource=ResourceContext(factory_id=factory.factory_id),
    )

    result = create_cost_rate(
        db,
        factory.factory_id,
        org_id=resolve_org_id(current_user),
        created_by_user_id=current_user.id,
        payload=payload.model_dump(),
    )
    return {"rate": result}
