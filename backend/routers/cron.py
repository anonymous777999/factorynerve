"""Cron job endpoints for external schedulers (cron-job.org, GitHub Actions).

All endpoints are protected by a shared ``CRON_SECRET_TOKEN`` env var to
prevent unauthorized invocation.
"""

from __future__ import annotations

import logging
import os
from datetime import datetime, timezone

from fastapi import APIRouter, Depends, HTTPException, Header

from backend.database import SessionLocal
from backend.services.email_queue_processor import get_email_processor
from backend.services.ops_alerts import run_daily_summary_once
from backend.services.attendance_auto_close_service import (
    get_auto_close_service,
    run_auto_close_sweep_once,
)

logger = logging.getLogger(__name__)

router = APIRouter(tags=["Cron"])

CRON_SECRET = os.getenv("CRON_SECRET_TOKEN", "")


async def verify_cron_secret(x_cron_secret: str = Header(..., alias="X-Cron-Secret")) -> None:
    if not CRON_SECRET:
        raise HTTPException(status_code=503, detail="Cron secret not configured.")
    if x_cron_secret.strip() != CRON_SECRET:
        raise HTTPException(status_code=403, detail="Invalid cron secret.")


@router.post("/cron/daily-maintenance", dependencies=[Depends(verify_cron_secret)])
def run_daily_maintenance() -> dict:
    """Clean expired tokens and apply due plan downgrades.

    Schedule: daily at 2:00 AM IST (20:30 UTC previous day).
    """
    try:
        from scripts.daily_maintenance import run as run_maintenance

        result = run_maintenance()
        logger.info("Daily maintenance completed: %s", result)
        return {"status": "ok", **result}
    except Exception as exc:
        logger.exception("Daily maintenance failed.")
        raise HTTPException(status_code=500, detail=str(exc)) from exc


@router.post("/cron/process-email-queue", dependencies=[Depends(verify_cron_secret)])
def process_email_queue() -> dict:
    """Process one batch of pending/failed emails from the queue.

    Schedule: every 5 minutes.
    """
    try:
        processor = get_email_processor()
        if processor is None:
            return {"status": "ok", "processed": 0, "message": "Processor not started"}
        count = processor.process_batch()
        return {"status": "ok", "processed": count}
    except Exception as exc:
        logger.exception("Email queue processing via cron failed.")
        raise HTTPException(status_code=500, detail=str(exc)) from exc


@router.post("/cron/daily-summary", dependencies=[Depends(verify_cron_secret)])
def run_daily_summary() -> dict:
    """Generate and dispatch daily ops alert summaries.

    Schedule: daily at 6:00 PM IST (12:30 UTC).
    """
    try:
        count = run_daily_summary_once()
        return {"status": "ok", "summaries_sent": count}
    except Exception as exc:
        logger.exception("Daily summary via cron failed.")
        raise HTTPException(status_code=500, detail=str(exc)) from exc


@router.post("/cron/auto-close-attendance", dependencies=[Depends(verify_cron_secret)])
def trigger_auto_close_attendance() -> dict:
    """Manually trigger an attendance auto-close sweep.

    Scans all active factories for missed punch-outs and closes them
    using shift end times. Reports per-factory results.

    Schedule: every 5 minutes or on-demand via external cron.
    """
    try:
        results = run_auto_close_sweep_once()
        total_closed = sum(r.get("closed_count", 0) for r in results)
        return {
            "status": "ok",
            "total_closed": total_closed,
            "factories_affected": len(results),
            "results": results,
        }
    except Exception as exc:
        logger.exception("Auto-close attendance via cron failed.")
        raise HTTPException(status_code=500, detail=str(exc)) from exc


@router.get("/cron/auto-close-attendance/status", dependencies=[Depends(verify_cron_secret)])
def auto_close_attendance_status() -> dict:
    """Inspect the attendance auto-close scheduler status."""
    try:
        svc = get_auto_close_service()
        if svc is None:
            return {
                "status": "ok",
                "scheduler_running": False,
                "message": "Scheduler is not running (disabled via env var or not started).",
            }
        return {
            "status": "ok",
            "scheduler_running": True,
            "poll_interval_seconds": svc.poll_interval_seconds,
            "stale_hours": svc.stale_hours,
        }
    except Exception as exc:
        logger.exception("Auto-close status check failed.")
        raise HTTPException(status_code=500, detail=str(exc)) from exc


@router.get("/cron/health", dependencies=[Depends(verify_cron_secret)])
def cron_health() -> dict:
    """Health check for external cron-job.org monitoring."""
    return {
        "status": "ok",
        "service": "cron",
        "timestamp": datetime.now(timezone.utc).isoformat(),
    }
