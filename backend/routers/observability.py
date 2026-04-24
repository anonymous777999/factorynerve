"""Observability endpoints for readiness, alert history, and frontend error intake."""

from __future__ import annotations

from datetime import datetime
import logging
import os
from typing import Any

from fastapi import APIRouter, Depends, HTTPException, Query
from pydantic import BaseModel, Field
from sqlalchemy import text
from sqlalchemy.orm import Session

from backend.database import get_db
from backend.metrics import record_frontend_error, snapshot as metrics_snapshot
from backend.models.ops_alert_event import OpsAlertEvent
from backend.models.user import User, UserRole
from backend.rbac import require_any_role
from backend.security import get_current_user
from backend.tenancy import resolve_org_id
from backend.utils import get_config

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


class OpsAlertHistoryResponse(BaseModel):
    alerts: list[OpsAlertHistoryItem]
    total: int
    filters: dict[str, Any]


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
    deliveries: list[OpsAlertHistoryItem]


def _require_alert_viewer(current_user: User) -> None:
    require_any_role(current_user, {UserRole.ADMIN, UserRole.OWNER})


def _current_org_id(current_user: User) -> str:
    org_id = resolve_org_id(current_user)
    if not org_id:
        raise HTTPException(status_code=400, detail="Organization could not be resolved.")
    return org_id


def _serialize_alert_row(row: OpsAlertEvent) -> OpsAlertHistoryItem:
    return OpsAlertHistoryItem(
        ref_id=row.ref_id,
        org_id=row.org_id,
        org_name=row.org_name,
        event_type=row.event_type,
        severity=row.severity,
        status=row.status,
        delivery_status=row.delivery_status,
        suppressed_reason=row.suppressed_reason,
        escalation_level=row.escalation_level,
        timestamp=row.created_at,
        summary=row.summary,
        recipient_phone=row.recipient_phone,
    )


@router.get("/ready")
def readiness_check(db: Session = Depends(get_db)) -> dict[str, Any]:
    db.execute(text("SELECT 1"))
    metrics = metrics_snapshot(limit_paths=5)
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


@router.get("/alerts", response_model=OpsAlertHistoryResponse)
def get_alert_history(
    limit: int = Query(default=50, ge=1, le=200),
    offset: int = Query(default=0, ge=0),
    org_id: str | None = Query(default=None),
    event_type: str | None = Query(default=None),
    severity: str | None = Query(default=None),
    status_value: str | None = Query(default=None, alias="status"),
    from_time: datetime | None = Query(default=None, alias="from"),
    to_time: datetime | None = Query(default=None, alias="to"),
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
) -> OpsAlertHistoryResponse:
    _require_alert_viewer(current_user)
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
    rows = query.order_by(OpsAlertEvent.created_at.desc(), OpsAlertEvent.id.desc()).offset(offset).limit(limit).all()
    return OpsAlertHistoryResponse(
        alerts=[_serialize_alert_row(row) for row in rows],
        total=total,
        filters={
            "org_id": scoped_org_id,
            "event_type": event_type,
            "severity": severity,
            "status": status_value,
            "from": from_time.isoformat() if from_time else None,
            "to": to_time.isoformat() if to_time else None,
            "limit": limit,
            "offset": offset,
        },
    )


@router.get("/alerts/{ref_id}", response_model=OpsAlertDetailResponse)
def get_alert_detail(
    ref_id: str,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
) -> OpsAlertDetailResponse:
    _require_alert_viewer(current_user)
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
        deliveries=[_serialize_alert_row(row) for row in deliveries],
    )


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
