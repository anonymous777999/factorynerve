"""Steel intelligence routes: inventory intelligence, quality tracking, anomaly detection, and owner dashboard."""

from __future__ import annotations

from datetime import date

from fastapi import APIRouter, Depends, HTTPException, Query
from sqlalchemy.orm import Session

from backend.authorization import PDP, ResourceContext
from backend.database import get_db
from backend.models.user import User, UserRole
from backend.security import get_current_user
from backend.services.steel_intelligence import (
    build_quality_tracking,
    build_anomaly_detection,
    build_owner_dashboard,
    build_sales_intelligence,
)
from backend.services.quality_intelligence import build_quality_intelligence as build_entry_quality_intelligence
from backend.services.steel_inventory_intelligence import build_inventory_intelligence
from backend.services.steel_production_intelligence import build_production_intelligence
from backend.services.steel_fraud_alert_service import (
    acknowledge_alert,
    dismiss_alert,
    get_active_alert_count,
    list_alerts,
    resolve_alert,
    start_investigation,
    sync_fraud_alerts,
)
from backend.services.steel_fraud_intelligence import build_fraud_intelligence
from backend.services.steel_scrap_loss_intelligence import build_scrap_loss_intelligence
from backend.services.steel_service import (
    require_active_steel_factory,
)


router = APIRouter(tags=["Steel Intelligence"])


@router.get("/inventory/intelligence")
def get_steel_inventory_intelligence(
    low_stock_days: int = Query(default=14, ge=1, le=90),
    dead_stock_days: int = Query(default=90, ge=1, le=365),
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
) -> dict:
    """Analyse inventory health: low-stock alerts, dead stock, turnover velocity,
    inventory valuation, slow-moving/overstocked detection, ABC analysis,
    suspicious movement flags, and reconciliation risk."""
    try:
        factory = require_active_steel_factory(db, current_user)
    except ValueError as error:
        raise HTTPException(status_code=400, detail=str(error)) from error
    PDP(db=db).require_permission(
        actor=current_user,
        permission_key="inventory.ledger.view",
        resource=ResourceContext(factory_id=factory.factory_id),
    )
    return build_inventory_intelligence(
        db,
        factory.factory_id,
        low_stock_days=low_stock_days,
        dead_stock_days=dead_stock_days,
    )


@router.get("/quality")
def get_steel_quality_tracking(
    days: int = Query(default=30, ge=1, le=365),
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
) -> dict:
    """Analyse batch quality: rejection rates, severity distribution, quality score."""
    try:
        factory = require_active_steel_factory(db, current_user)
    except ValueError as error:
        raise HTTPException(status_code=400, detail=str(error)) from error
    PDP(db=db).require_permission(
        actor=current_user,
        permission_key="inventory.ledger.view",
        resource=ResourceContext(factory_id=factory.factory_id),
    )
    return build_quality_tracking(db, factory.factory_id, days=days)


@router.get("/quality/intelligence")
def get_steel_quality_intelligence(
    days: int = Query(default=30, ge=1, le=365),
    baseline_days: int | None = Query(default=None, ge=1, le=365),
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
) -> dict:
    """Analyse entry-level structured quality data: rejection rates, defect
    categorization (by defect_reason.code), scrap vs rework tracking, and
    batch-quality integration.

    Phase 1+2 — Uses new structured quality fields on Entry (rejection_qty,
    defect_reason_id, scrap_qty_entry, rework_required) combined with existing
    SteelProductionBatch rejection/scrap data.
    """
    try:
        factory = require_active_steel_factory(db, current_user)
    except ValueError as error:
        raise HTTPException(status_code=400, detail=str(error)) from error
    pdp = PDP(db=db)
    pdp.require_permission(
        actor=current_user,
        permission_key="production.analytics.view",
        resource=ResourceContext(factory_id=factory.factory_id),
    )
    cost_decision = pdp.check_permission(
        actor=current_user,
        permission_key="production.scrap_cost.view",
        resource=ResourceContext(factory_id=factory.factory_id),
    )
    return build_entry_quality_intelligence(
        db,
        factory.factory_id,
        days=days,
        baseline_days=baseline_days,
        can_view_financials=cost_decision.is_allowed,
    )


@router.get("/anomalies")
def get_steel_anomalies(
    days: int = Query(default=30, ge=1, le=365),
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
) -> dict:
    """Detect anomalies across financial, inventory, and dispatch domains."""
    try:
        factory = require_active_steel_factory(db, current_user)
    except ValueError as error:
        raise HTTPException(status_code=400, detail=str(error)) from error
    PDP(db=db).require_permission(
        actor=current_user,
        permission_key="inventory.ledger.view",
        resource=ResourceContext(factory_id=factory.factory_id),
    )
    return build_anomaly_detection(db, factory.factory_id, days=days)


@router.get("/sales-intelligence")
def get_steel_sales_intelligence(
    days: int = Query(default=90, ge=1, le=365),
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
) -> dict:
    """Analyse sales performance: trends, customer analytics, and fulfillment funnel."""
    try:
        factory = require_active_steel_factory(db, current_user)
    except ValueError as error:
        raise HTTPException(status_code=400, detail=str(error)) from error
    PDP(db=db).require_permission(
        actor=current_user,
        permission_key="customer.record.view",
        resource=ResourceContext(factory_id=factory.factory_id),
    )
    return build_sales_intelligence(db, factory.factory_id, days=days)


@router.get("/owner/dashboard")
def get_steel_owner_dashboard(
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
) -> dict:
    """Single-pane-of-glass dashboard for factory performance (owner-only)."""
    if current_user.role not in (UserRole.OWNER, UserRole.ADMIN):
        raise HTTPException(status_code=403, detail="Owner dashboard is restricted to owner and admin roles.")
    try:
        factory = require_active_steel_factory(db, current_user)
    except ValueError as error:
        raise HTTPException(status_code=400, detail=str(error)) from error
    PDP(db=db).require_permission(
        actor=current_user,
        permission_key="admin.billing.quota.reset",
        resource=ResourceContext(factory_id=factory.factory_id),
    )
    return build_owner_dashboard(db, factory)


@router.get("/production/intelligence")
def get_steel_production_intelligence(
    days: int = Query(default=30, ge=1, le=365),
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
) -> dict:
    """Analyse production performance: throughput, shift analysis, downtime,
    batch loss, operator performance, process loss, and quality signals.

    Phase 1 — No schema changes required. All analytics are derived from
    the existing ``Entry`` (shift records) and ``SteelProductionBatch``
    (batch quality) models.
    """
    try:
        factory = require_active_steel_factory(db, current_user)
    except ValueError as error:
        raise HTTPException(status_code=400, detail=str(error)) from error
    PDP(db=db).require_permission(
        actor=current_user,
        permission_key="production.analytics.view",
        resource=ResourceContext(factory_id=factory.factory_id),
    )
    return build_production_intelligence(db, factory.factory_id, days=days)


@router.get("/scrap-loss/intelligence")
def get_steel_scrap_loss_intelligence(
    days: int = Query(default=30, ge=1, le=365),
    baseline_days: int | None = Query(default=None, ge=1, le=365),
    line_id: int | None = Query(default=None),
    machine_id: int | None = Query(default=None),
    operator_user_id: int | None = Query(default=None),
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
) -> dict:
    """Analyse scrap & loss performance: scrap volumes, trends, breakdowns
    by machine/line/operator/process, financial impact, and period-over-period
    increase drivers.

    Phase A+B — Uses existing ``SteelProductionBatch.scrap_qty_kg`` and
    ``rejection_qty_kg`` fields (no schema changes required).
    """
    try:
        factory = require_active_steel_factory(db, current_user)
    except ValueError as error:
        raise HTTPException(status_code=400, detail=str(error)) from error
    pdp = PDP(db=db)
    pdp.require_permission(
        actor=current_user,
        permission_key="production.scrap_intelligence.view",
        resource=ResourceContext(factory_id=factory.factory_id),
    )
    cost_decision = pdp.check_permission(
        actor=current_user,
        permission_key="production.scrap_cost.view",
        resource=ResourceContext(factory_id=factory.factory_id),
    )
    return build_scrap_loss_intelligence(
        db,
        factory.factory_id,
        days=days,
        baseline_days=baseline_days,
        line_id=line_id,
        machine_id=machine_id,
        operator_user_id=operator_user_id,
        can_view_financials=cost_decision.is_allowed,
    )


@router.get("/fraud/intelligence")
def get_steel_fraud_intelligence(
    days: int = Query(default=30, ge=1, le=365),
    severity: str | None = Query(default=None),
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
) -> dict:
    """Analyse theft & fraud signals: inventory loss, dispatch mismatches,
    transaction anomalies, approval risk, user behavior profiling, and
    investigation queue.

    Phase A+B — All signals are derived from existing schema (no changes required).
    Labels distinguish direct, derived, proxy, and weak signals.
    """
    try:
        factory = require_active_steel_factory(db, current_user)
    except ValueError as error:
        raise HTTPException(status_code=400, detail=str(error)) from error
    pdp = PDP(db=db)
    pdp.require_permission(
        actor=current_user,
        permission_key="production.fraud_intelligence.view",
        resource=ResourceContext(factory_id=factory.factory_id),
    )
    financial_decision = pdp.check_permission(
        actor=current_user,
        permission_key="production.fraud_financial.view",
        resource=ResourceContext(factory_id=factory.factory_id),
    )
    investigation_decision = pdp.check_permission(
        actor=current_user,
        permission_key="production.fraud_investigation.view",
        resource=ResourceContext(factory_id=factory.factory_id),
    )
    result = build_fraud_intelligence(
        db,
        factory.factory_id,
        days=days,
        severity=severity,
        can_view_financials=financial_decision.is_allowed,
        can_view_user_details=investigation_decision.is_allowed,
    )

    # Sync critical/high signals to persistent fraud alerts
    try:
        alert_counts = sync_fraud_alerts(db, factory.factory_id, factory.org_id, result)
        result["alert_counts"] = alert_counts
    except Exception:
        result["alert_counts"] = {"new_count": 0, "total_active": 0, "by_domain": {}}

    return result


# ── Fraud Alert Endpoints ──────────────────────────────────────────────────


@router.get("/fraud/alerts")
def get_steel_fraud_alerts(
    status: str | None = Query(default=None),
    domain: str | None = Query(default=None),
    severity: str | None = Query(default=None),
    limit: int = Query(default=50, ge=1, le=200),
    offset: int = Query(default=0, ge=0),
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
) -> dict:
    """List fraud alerts with optional status/domain/severity filters.

    Status options: active, acknowledged, investigating, resolved, dismissed, open (all non-terminal)
    Domain options: inventory, dispatch, transaction, approval, attendance
    """
    try:
        factory = require_active_steel_factory(db, current_user)
    except ValueError as error:
        raise HTTPException(status_code=400, detail=str(error)) from error
    pdp = PDP(db=db)
    pdp.require_permission(
        actor=current_user,
        permission_key="production.fraud_intelligence.view",
        resource=ResourceContext(factory_id=factory.factory_id),
    )
    items, total = list_alerts(
        db,
        factory.factory_id,
        status=status,
        domain=domain,
        severity=severity,
        limit=limit,
        offset=offset,
    )
    return {"items": items, "total": total, "limit": limit, "offset": offset}


@router.get("/fraud/alerts/count")
def get_steel_fraud_alerts_count(
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
) -> dict:
    """Fast count of active/acknowledged/investigating fraud alerts."""
    try:
        factory = require_active_steel_factory(db, current_user)
    except ValueError as error:
        raise HTTPException(status_code=400, detail=str(error)) from error
    pdp = PDP(db=db)
    pdp.require_permission(
        actor=current_user,
        permission_key="production.fraud_intelligence.view",
        resource=ResourceContext(factory_id=factory.factory_id),
    )
    return {"active_count": get_active_alert_count(db, factory.factory_id)}


@router.post("/fraud/alerts/{alert_id}/acknowledge")
def post_steel_fraud_alert_acknowledge(
    alert_id: int,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
) -> dict:
    """Acknowledge a fraud alert — marks it as seen by a user."""
    alert = acknowledge_alert(db, alert_id, current_user.id)
    if alert is None:
        raise HTTPException(status_code=404, detail="Alert not found or not in active state.")
    return {"status": "ok", "alert_id": alert.id, "new_status": alert.status}


@router.post("/fraud/alerts/{alert_id}/investigate")
def post_steel_fraud_alert_investigate(
    alert_id: int,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
) -> dict:
    """Move a fraud alert to investigating status."""
    alert = start_investigation(db, alert_id, current_user.id)
    if alert is None:
        raise HTTPException(status_code=404, detail="Alert not found or not in active/acknowledged state.")
    return {"status": "ok", "alert_id": alert.id, "new_status": alert.status}


@router.post("/fraud/alerts/{alert_id}/resolve")
def post_steel_fraud_alert_resolve(
    alert_id: int,
    payload: dict | None = None,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
) -> dict:
    """Resolve a fraud alert (e.g. issue was confirmed and fixed)."""
    resolution_note = (payload or {}).get("resolution_note") if payload else None
    alert = resolve_alert(db, alert_id, current_user.id, resolution_note=resolution_note)
    if alert is None:
        raise HTTPException(status_code=404, detail="Alert not found or already resolved/dismissed.")
    return {"status": "ok", "alert_id": alert.id, "new_status": alert.status}


@router.post("/fraud/alerts/{alert_id}/dismiss")
def post_steel_fraud_alert_dismiss(
    alert_id: int,
    payload: dict,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
) -> dict:
    """Dismiss a fraud alert with a reason (e.g. false positive)."""
    dismissed_reason = payload.get("dismissed_reason", "")
    if not dismissed_reason:
        raise HTTPException(status_code=400, detail="dismissed_reason is required.")
    alert = dismiss_alert(db, alert_id, current_user.id, dismissed_reason)
    if alert is None:
        raise HTTPException(status_code=404, detail="Alert not found or already resolved/dismissed.")
    return {"status": "ok", "alert_id": alert.id, "new_status": alert.status}
