"""Observability endpoints for readiness and frontend error intake."""

from __future__ import annotations

import logging
import os
from typing import Any

from fastapi import APIRouter, Depends
from pydantic import BaseModel, Field
from sqlalchemy import text
from sqlalchemy.orm import Session

from backend.database import get_db
from backend.metrics import record_frontend_error, snapshot as metrics_snapshot
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
