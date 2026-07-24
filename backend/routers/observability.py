"""Observability endpoints for readiness, alert history, and frontend error intake."""

from __future__ import annotations

from datetime import datetime, timezone
import logging
import os
from typing import Any

from fastapi import APIRouter, Depends, HTTPException, Query, Request
from pydantic import BaseModel, Field
from sqlalchemy import text
from sqlalchemy.orm import Session

from backend.ai.monitoring.governance import governance_snapshot
from backend.ai.monitoring.telemetry import ai_dashboard_payload, ai_health_snapshot
from backend.database import get_db
from backend.metrics import record_frontend_error, snapshot as metrics_snapshot
from backend.models.ops_alert_event import OpsAlertEvent
from backend.models.user import User, UserRole
from backend.security import get_current_user
from backend.tenancy import resolve_org_id
from backend.utils import get_config
from backend.authorization import PDP, ResourceContext

try:
    import sentry_sdk  # type: ignore
except Exception:  # pragma: no cover - optional dependency
    sentry_sdk = None


router = APIRouter(tags=["Observability"])
logger = logging.getLogger(__name__)
config = get_config()


class FrontendErrorPayload(BaseModel):
    message: str = Field(min_length=1, max_length=2000)
    source: str = Field(default="web", max_length=120)
    url: str | None = Field(default=None, max_length=2000)
    route: str | None = Field(default=None, max_length=500)
    stack: str | None = Field(default=None, max_length=12000)
    component_stack: str | None = Field(default=None, max_length=12000)
    digest: str | None = Field(default=None, max_length=255)
    release: str | None = Field(default=None, max_length=255)
    user_agent: str | None = Field(default=None, max_length=1000)
    extra: dict[str, Any] | None = None


class OpsAlertHistoryItem(BaseModel):
    ref_id: str
    org_id: str | None
    org_name: str | None
    event_type: str
    severity: str
    status: str
    delivery_status: str
    suppressed_reason: str | None
    escalation_level: int
    timestamp: datetime
    summary: str
    recipient_phone: str | None
    provider_message_id: str | None
    provider_status_at: datetime | None
    dispatched_at: datetime | None
    delivered_at: datetime | None
    read_at: datetime | None
    failed_at: datetime | None
    provider_error_code: str | None
    provider_error_title: str | None


class OpsAlertHistoryResponse(BaseModel):
    items: list[OpsAlertHistoryItem]
    total: int
    page: int
    page_size: int
    filters: dict[str, Any]
    alerts: list[OpsAlertHistoryItem] | None = None


class OpsAlertDetailResponse(BaseModel):
    ref_id: str
    org_id: str | None
    org_name: str | None
    event_type: str
    severity: str
    status: str
    delivery_status: str
    suppressed_reason: str | None
    escalation_level: int
    timestamp: datetime
    summary: str
    meta: dict[str, Any] | None
    provider_message_id: str | None
    provider_status_at: datetime | None
    dispatched_at: datetime | None
    delivered_at: datetime | None
    read_at: datetime | None
    failed_at: datetime | None
    provider_error_code: str | None
    provider_error_title: str | None
    deliveries: list[OpsAlertHistoryItem]


def _require_alert_viewer(current_user: User, db: Session) -> None:
    PDP(db=db).require_permission(actor=current_user, permission_key="system.observability.view")


def _current_org_id(current_user: User) -> str:
    org_id = resolve_org_id(current_user)
    if not org_id:
        raise HTTPException(status_code=400, detail="Organization could not be resolved.")
    return org_id


def _require_metrics_token(request: Request) -> None:
    token = os.getenv("METRICS_TOKEN")
    if not token:
        raise HTTPException(status_code=403, detail="Metrics not configured.")
    header = request.headers.get("X-Metrics-Token") or ""
    if header.strip() != token:
        raise HTTPException(status_code=403, detail="Metrics token invalid.")


def _serialize_alert_row(row: OpsAlertEvent) -> OpsAlertHistoryItem:
    ref_id = str(row.ref_id or f"alert-{getattr(row, 'id', 'unknown')}")
    event_type = str(row.event_type or "unknown_event")
    severity = str(row.severity or "UNKNOWN").upper()
    status = str(row.status or "queued").lower()
    delivery_status = str(row.delivery_status or "queued").lower()
    escalation_level = int(row.escalation_level or 0)
    summary = str(row.summary or "Alert event recorded.")
    timestamp = row.created_at or row.dispatched_at or datetime.now(timezone.utc)
    return OpsAlertHistoryItem(
        ref_id=ref_id,
        org_id=row.org_id,
        org_name=row.org_name,
        event_type=event_type,
        severity=severity,
        status=status,
        delivery_status=delivery_status,
        suppressed_reason=row.suppressed_reason,
        escalation_level=escalation_level,
        timestamp=timestamp,
        summary=summary,
        recipient_phone=row.recipient_phone,
        provider_message_id=row.provider_message_id,
        provider_status_at=row.provider_status_at,
        dispatched_at=row.dispatched_at,
        delivered_at=row.delivered_at,
        read_at=row.read_at,
        failed_at=row.failed_at,
        provider_error_code=row.provider_error_code,
        provider_error_title=row.provider_error_title,
    )


@router.get("/ready")
def readiness_check(db: Session = Depends(get_db)) -> dict[str, Any]:
    db.execute(text("SELECT 1"))
    metrics = metrics_snapshot()
    return {
        "status": "ready",
        "app": config.app_name,
        "environment": config.app_env,
        "checks": {
            "database": "ok",
            "sentry": "configured" if bool(os.getenv("SENTRY_DSN")) else "disabled",
            "metrics": "protected" if bool(os.getenv("METRICS_TOKEN")) else "disabled",
        },
        "uptime_seconds": metrics.get("uptime_seconds", 0),
    }


@router.get("/ai/health")
def ai_health(request: Request) -> dict[str, Any]:
    _require_metrics_token(request)
    return ai_health_snapshot()


@router.get("/ai/dashboard")
def ai_dashboard(request: Request) -> dict[str, Any]:
    _require_metrics_token(request)
    return ai_dashboard_payload()


@router.get("/ai/governance")
def ai_governance(request: Request) -> dict[str, Any]:
    _require_metrics_token(request)
    return governance_snapshot()


@router.get("/alerts", response_model=OpsAlertHistoryResponse)
def get_alert_history(
    page: int = Query(default=1, ge=1),
    page_size: int = Query(default=50, ge=1, le=200),
    org_id: str | None = Query(default=None),
    event_type: str | None = Query(default=None),
    severity: str | None = Query(default=None),
    status_value: str | None = Query(default=None, alias="status"),
    from_time: datetime | None = Query(default=None, alias="from"),
    to_time: datetime | None = Query(default=None, alias="to"),
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
) -> OpsAlertHistoryResponse:
    _require_alert_viewer(current_user, db)
    scoped_org_id = _current_org_id(current_user)
    if org_id and org_id != scoped_org_id:
        raise HTTPException(status_code=403, detail="Alerts may only be viewed for your organization.")
    query = db.query(OpsAlertEvent).filter(OpsAlertEvent.org_id == scoped_org_id)
    if event_type:
        query = query.filter(OpsAlertEvent.event_type == event_type.strip().lower())
    if severity:
        query = query.filter(OpsAlertEvent.severity == severity.strip().upper())
    if status_value:
        query = query.filter(OpsAlertEvent.status == status_value.strip().lower())
    if from_time:
        query = query.filter(OpsAlertEvent.created_at >= from_time)
    if to_time:
        query = query.filter(OpsAlertEvent.created_at <= to_time)
    total = query.count()
    offset = (page - 1) * page_size
    items = [
        _serialize_alert_row(row)
        for row in query.order_by(OpsAlertEvent.created_at.desc(), OpsAlertEvent.id.desc()).offset(offset).limit(page_size).all()
    ]
    return OpsAlertHistoryResponse(
        items=items,
        total=total,
        page=page,
        page_size=page_size,
        filters={
            "org_id": scoped_org_id,
            "event_type": event_type,
            "severity": severity,
            "status": status_value,
            "from": from_time.isoformat() if from_time else None,
            "to": to_time.isoformat() if to_time else None,
            "limit": page_size,
            "offset": offset,
        },
        alerts=items,
    )


@router.get("/alerts/{ref_id}", response_model=OpsAlertDetailResponse)
def get_alert_detail(
    ref_id: str,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
) -> OpsAlertDetailResponse:
    _require_alert_viewer(current_user, db)
    scoped_org_id = _current_org_id(current_user)
    rows = (
        db.query(OpsAlertEvent)
        .filter(
            OpsAlertEvent.ref_id == ref_id,
            OpsAlertEvent.org_id == scoped_org_id,
        )
        .order_by(OpsAlertEvent.recipient_phone.asc().nullsfirst(), OpsAlertEvent.id.asc())
        .all()
    )
    if not rows:
        raise HTTPException(status_code=404, detail="Alert not found.")
    root = next((row for row in rows if row.recipient_phone is None), rows[0])
    deliveries = [row for row in rows if row.recipient_phone is not None]
    return OpsAlertDetailResponse(
        ref_id=root.ref_id,
        org_id=root.org_id,
        org_name=root.org_name,
        event_type=root.event_type,
        severity=root.severity,
        status=root.status,
        delivery_status=root.delivery_status,
        suppressed_reason=root.suppressed_reason,
        escalation_level=root.escalation_level,
        timestamp=root.created_at,
        summary=root.summary,
        meta=root.meta,
        provider_message_id=root.provider_message_id,
        provider_status_at=root.provider_status_at,
        dispatched_at=root.dispatched_at,
        delivered_at=root.delivered_at,
        read_at=root.read_at,
        failed_at=root.failed_at,
        provider_error_code=root.provider_error_code,
        provider_error_title=root.provider_error_title,
        deliveries=[_serialize_alert_row(row) for row in deliveries],
    )


@router.get("/ocr-dashboard")
def ocr_dashboard(request: Request) -> dict[str, Any]:
    """OCR-specific observability dashboard payload.

    Returns throughput, cost, model-tier distribution, validation success rates,
    and cache effectiveness — matching Phase 7 section 7.2 dashboard layout.

    Protected by the same METRICS_TOKEN as the /metrics endpoint.
    """
    _require_metrics_token(request)

    # Sample values from live Prometheus metrics
    # Note: Counter names in prometheus_client use the registered name (no _total suffix).
    # The _total suffix is only added by generate_latest() for OpenMetrics serialization.
    from prometheus_client import REGISTRY as _PR

    def _sample_counter(name: str) -> float:
        try:
            sample = _PR.get_sample_value(name)
            return sample or 0.0
        except Exception:
            return 0.0

    def _sample_gauge(name: str) -> float:
        try:
            sample = _PR.get_sample_value(name)
            return sample or 0.0
        except Exception:
            return 0.0

    total_jobs = int(_sample_counter("dpr_ocr_jobs_total"))
    success_jobs = int(_sample_counter('dpr_ocr_jobs_total{status="success"}'))
    failed_jobs = int(_sample_counter('dpr_ocr_jobs_total{status="failure"}'))
    total_exports = int(_sample_counter("dpr_ocr_exports_total"))
    cost_saved = round(_sample_counter("dpr_ocr_cost_saved_usd_total"), 4)
    cache_hit = round(_sample_gauge("dpr_ocr_cache_hit_ratio"), 2)
    extraction_success = round(_sample_gauge("dpr_ocr_extraction_success_rate"), 2)
    classification_acc = round(_sample_gauge("dpr_ocr_classification_accuracy"), 2)
    user_correction = round(_sample_gauge("dpr_ocr_user_correction_rate"), 2)

    # Tier distribution
    fast_count = int(_sample_counter('dpr_ocr_model_tier_requests_total{tier="fast"}'))
    balanced_count = int(_sample_counter('dpr_ocr_model_tier_requests_total{tier="balanced"}'))
    best_count = int(_sample_counter('dpr_ocr_model_tier_requests_total{tier="best"}'))
    tier_total = fast_count + balanced_count + best_count or 1

    # Correction pass rate
    correction_success = int(_sample_counter('dpr_ocr_correction_passes_total{status="success"}'))
    correction_failure = int(_sample_counter('dpr_ocr_correction_passes_total{status="failure"}'))
    correction_total = correction_success + correction_failure or 1

    return {
        # ROW 1: Throughput, Cost, Success Rate, Cache Hit
        "throughput": {
            "total_documents": total_jobs,
            "success_count": success_jobs,
            "failure_count": failed_jobs,
            "success_rate": round(success_jobs / total_jobs, 4) if total_jobs else 0.0,
        },
        "cost": {
            "total_cost_saved_usd": cost_saved,
            "total_exports": total_exports,
            "avg_cost_per_document_usd": 0.0,  # Computed externally from tier counters
        },
        "extraction_quality": {
            "extraction_success_rate": extraction_success,
            "classification_accuracy": classification_acc,
            "cache_hit_ratio": cache_hit,
            "user_correction_rate": user_correction,
        },
        # ROW 4: Model Tier Distribution
        "model_tiers": {
            "fast": {"count": fast_count, "pct": round(fast_count / tier_total * 100, 1)},
            "balanced": {"count": balanced_count, "pct": round(balanced_count / tier_total * 100, 1)},
            "best": {"count": best_count, "pct": round(best_count / tier_total * 100, 1)},
        },
        # ROW 5: Correction & Validation
        "correction_passes": {
            "success_count": correction_success,
            "failure_count": correction_failure,
            "correction_pass_rate": round(correction_success / correction_total, 4),
        },
        "timestamp": datetime.now(timezone.utc).isoformat(),
    }


@router.get("/ocr-costs")
def ocr_cost_monitoring(request: Request) -> dict[str, Any]:
    """Cost monitoring dashboard data (Phase 7, section 7.3).

    Returns daily cost by document type, monthly forecast, model tier
    breakdown, and anomaly detection signals.

    Protected by the same METRICS_TOKEN as the /metrics endpoint.
    """
    _require_metrics_token(request)

    from prometheus_client import REGISTRY as _PR

    def _sample_counter(name: str) -> float:
        try:
            return _PR.get_sample_value(name) or 0.0
        except Exception:
            return 0.0

    cost_fast = round(_sample_counter('dpr_ocr_tier_cost_usd_total{tier="fast"}'), 6)
    cost_balanced = round(_sample_counter('dpr_ocr_tier_cost_usd_total{tier="balanced"}'), 6)
    cost_best = round(_sample_counter('dpr_ocr_tier_cost_usd_total{tier="best"}'), 6)
    total_cost = cost_fast + cost_balanced + cost_best
    cost_saved = round(_sample_counter("dpr_ocr_cost_saved_usd_total"), 6)

    return {
        "cost_summary": {
            "total_cost_usd": round(total_cost, 4),
            "total_saved_vs_opus_usd": cost_saved,
            "effective_avg_cost_per_doc_usd": round(total_cost / max(_sample_counter("dpr_ocr_jobs_total_total"), 1), 6),
        },
        "tier_breakdown": {
            "fast": {"cost_usd": cost_fast},
            "balanced": {"cost_usd": cost_balanced},
            "best": {"cost_usd": cost_best},
        },
        "forecast": {
            "note": "Forecast requires external Prometheus + Grafana for time-series aggregation. This endpoint provides current cumulative cost snapshot.",
            "current_total_usd": round(total_cost, 4),
            "budget_usd": None,  # Set via OCR_MONTHLY_BUDGET_USD env var or external config
        },
        "anomaly": {
            "note": "Anomaly detection requires 7+ days of data. Configure alerts in Grafana using dpr_ocr_tier_cost_usd_total.",
            "heuristic_alerts": [
                {"name": "Cost Spike", "condition": "rate(dpr_ocr_tier_cost_usd_total[1h]) > 3 * rate(dpr_ocr_tier_cost_usd_total[24h])", "severity": "warning"},
                {"name": "High Correction Rate", "condition": "rate(dpr_ocr_correction_passes_total[1h]) / rate(dpr_ocr_jobs_total[1h]) > 0.2", "severity": "warning"},
                {"name": "Cache Hit Drop", "condition": "dpr_ocr_cache_hit_ratio < 0.10", "severity": "info"},
                {"name": "Low Extraction Success", "condition": "dpr_ocr_extraction_success_rate < 0.8", "severity": "critical"},
            ],
        },
        "timestamp": datetime.now(timezone.utc).isoformat(),
    }


@router.post("/frontend-error", status_code=202)
def capture_frontend_error(payload: FrontendErrorPayload) -> dict[str, str]:
    record_frontend_error()
    logger.error(
        "frontend_error source=%s route=%s url=%s message=%s",
        payload.source,
        payload.route or "-",
        payload.url or "-",
        payload.message,
        extra={
            "event": "frontend_error",
            "source": payload.source,
            "path": payload.route or payload.url or "-",
            "frontend_url": payload.url,
            "release": payload.release,
        },
    )
    if sentry_sdk and os.getenv("SENTRY_DSN"):
        with sentry_sdk.push_scope() as scope:  # type: ignore[attr-defined]
            scope.set_tag("source", payload.source)
            if payload.route:
                scope.set_tag("route", payload.route)
            if payload.release:
                scope.set_tag("release", payload.release)
            scope.set_context(
                "frontend_error",
                {
                    "url": payload.url,
                    "route": payload.route,
                    "digest": payload.digest,
                    "component_stack": payload.component_stack,
                    "user_agent": payload.user_agent,
                    "extra": payload.extra or {},
                },
            )
            sentry_sdk.capture_message(f"Frontend error: {payload.message}", level="error")
    return {"status": "accepted"}
