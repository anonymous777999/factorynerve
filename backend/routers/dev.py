"""
dev.py — Development-only API endpoints.

These endpoints are ONLY available when APP_ENV=development or
FORCE_FAILURES=1 is set. They are never mounted in production.

Endpoints:
  GET  /dev/status        — Full system + failure mode status
  GET  /dev/failures       — List all failure modes and their status
  POST /dev/failures/{mode}/enable   — Enable a failure mode
  POST /dev/failures/{mode}/disable  — Disable a failure mode
  POST /dev/failures/enable-all      — Enable ALL failure modes
  POST /dev/failures/disable-all     — Disable ALL failure modes
  POST /dev/failures/reset           — Reset all to defaults
"""

from __future__ import annotations

import logging
import os
from typing import Any

from fastapi import APIRouter, HTTPException
from pydantic import BaseModel

from backend import failure_simulation

logger = logging.getLogger(__name__)

router = APIRouter(prefix="/dev", tags=["Development"])


def _ensure_dev_mode() -> None:
    """Block access outside development or forced mode."""
    app_env = os.getenv("APP_ENV", "development").strip().lower()
    force = os.getenv("FORCE_FAILURES", "").strip().lower() in ("1", "true", "yes")
    if app_env != "development" and not force:
        raise HTTPException(status_code=404, detail="Not found")


# ── Schemas ────────────────────────────────────────────────────────────────────


class FailureModeInfo(BaseModel):
    mode: str
    label: str
    description: str
    category: str
    active: bool
    latency_ms: int
    http_status: int | None
    source: str


class FailureStatusResponse(BaseModel):
    modes: dict[str, FailureModeInfo]
    active_count: int
    total_modes: int
    source: str
    healthy: bool
    timestamp: str


class ActionResponse(BaseModel):
    success: bool
    message: str
    mode: str | None = None
    active: bool | None = None


# ── Endpoints ─────────────────────────────────────────────────────────────────


@router.get("/failures", response_model=FailureStatusResponse)
def list_failures() -> dict[str, Any]:
    """List all failure modes and their current status."""
    _ensure_dev_mode()
    return failure_simulation.get_status()


@router.get("/status", response_model=FailureStatusResponse)
def dev_status() -> dict[str, Any]:
    """Get full development status including failure modes."""
    _ensure_dev_mode()
    return failure_simulation.get_status()


@router.post("/failures/{mode}/enable", response_model=ActionResponse)
def enable_failure(mode: str) -> dict[str, Any]:
    """Enable a specific failure mode."""
    _ensure_dev_mode()
    if mode not in failure_simulation.FAILURE_MODES:
        raise HTTPException(
            status_code=404,
            detail=f"Unknown failure mode '{mode}'. Available: {', '.join(sorted(failure_simulation.FAILURE_MODES.keys()))}",
        )
    success = failure_simulation.set_active(mode, True)
    return {
        "success": success,
        "message": f"Enabled failure mode: {failure_simulation.FAILURE_MODES[mode]['label']}",
        "mode": mode,
        "active": True,
    }


@router.post("/failures/{mode}/disable", response_model=ActionResponse)
def disable_failure(mode: str) -> dict[str, Any]:
    """Disable a specific failure mode."""
    _ensure_dev_mode()
    if mode not in failure_simulation.FAILURE_MODES:
        raise HTTPException(
            status_code=404,
            detail=f"Unknown failure mode '{mode}'. Available: {', '.join(sorted(failure_simulation.FAILURE_MODES.keys()))}",
        )
    success = failure_simulation.set_active(mode, False)
    return {
        "success": success,
        "message": f"Disabled failure mode: {failure_simulation.FAILURE_MODES[mode]['label']}",
        "mode": mode,
        "active": False,
    }


@router.post("/failures/enable-all", response_model=ActionResponse)
def enable_all_failures() -> dict[str, Any]:
    """Enable ALL failure modes for comprehensive testing."""
    _ensure_dev_mode()
    count = failure_simulation.set_all(True)
    return {
        "success": True,
        "message": f"Enabled all {count} failure modes.",
        "active": True,
    }


@router.post("/failures/disable-all", response_model=ActionResponse)
def disable_all_failures() -> dict[str, Any]:
    """Disable ALL failure modes."""
    _ensure_dev_mode()
    count = failure_simulation.set_all(False)
    return {
        "success": True,
        "message": f"Disabled all {count} failure modes.",
        "active": False,
    }


@router.post("/failures/reset", response_model=ActionResponse)
def reset_failures() -> dict[str, Any]:
    """Reset ALL failure modes to inactive (clear runtime state)."""
    _ensure_dev_mode()
    count = failure_simulation.reset_all()
    return {
        "success": True,
        "message": f"Reset {count} failure modes to inactive.",
        "active": False,
    }
