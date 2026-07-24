"""FastAPI application entrypoint for DPR.ai."""

from __future__ import annotations

from contextlib import asynccontextmanager
import logging
import os
import time
from collections.abc import Callable

from fastapi import FastAPI, HTTPException
from backend.ai.monitoring.governance import governance_snapshot
from backend.ai.monitoring.telemetry import snapshot_ai_telemetry
from sqlalchemy import text
from starlette.requests import Request
from starlette.responses import Response

from backend.database import SessionLocal, engine, init_db
from backend.models.user import User
from backend.routers.analytics import router as analytics_router
from backend.routers.ai import router as ai_router
from backend.routers.alerts import router as alerts_router
from backend.routers.alert_recipients import router as alert_recipients_router
from backend.routers.attendance import router as attendance_router
from backend.routers.entries import router as entries_router
from backend.routers.emails import router as emails_router
from backend.routers.feedback import router as feedback_router
from backend.routers.intelligence import router as intelligence_router
from backend.routers.auth import router as auth_router
from backend.routers.auth_google import router as auth_google_router
from backend.routers.phone_auth import router as phone_auth_router
from backend.routers.auth_secure import router as auth_secure_router
from backend.routers.jobs import router as jobs_router
from backend.routers.reports import router as reports_router
from backend.routers.settings import router as settings_router
from backend.routers.ocr import router as ocr_router
from backend.routers.observability import router as observability_router
from backend.routers.permissions import router as permissions_router
from backend.routers.approvals import router as approvals_router
from backend.routers.whatsapp_webhook import router as whatsapp_webhook_router
from backend.routers.plans import router as plans_router
from backend.routers.billing import router as billing_router
from backend.routers.admin_billing import router as admin_billing_router
from backend.routers.admin_ai import router as admin_ai_router
from backend.routers.premium import router as premium_router
from backend.routers.steel import router as steel_router
from backend.routers.steel_intelligence import router as steel_intelligence_router
from backend.routers.steel_finance import router as steel_finance_router
from backend.routers.steel_bom import router as steel_bom_router
from backend.routers.cron import router as cron_router
from backend.routers.coil_theft import router as coil_theft_router
from backend.routers.notifications import router as notifications_router
from backend.routers.workforce_intelligence import router as workforce_intelligence_router
from backend.utils import get_config, setup_logging
from backend.metrics import (
    record_exception,
    record_request,
)
from backend.middleware.idempotency import IdempotencyMiddleware
from backend.middleware.rls_context import RLSContextMiddleware, _register_checkout_event
from backend.middleware.security import apply_security
from backend.middleware.response_envelope import apply_response_envelope
from backend.cache import build_cache_key, get_json, set_json

from backend.services.ops_alerts import (
    initialize_ops_alerting,
    record_request_exception as record_ops_request_exception,
    record_request_outcome as record_ops_request_outcome,
    shutdown_ops_alerting,
)


# ── Startup Validation (development only) ────────────────────────────────────
# When SKIP_STARTUP_VALIDATION=1, environment checks are skipped.
# When FAIL_ON_STARTUP_VALIDATION=1 (production), failures block startup.
_SKIP_VALIDATION = os.getenv("SKIP_STARTUP_VALIDATION", "").strip().lower() in ("1", "true", "yes")
_FAIL_ON_VALIDATION = os.getenv("FAIL_ON_STARTUP_VALIDATION", "").strip().lower() in ("1", "true", "yes")



# ── Role Revision Cache ──────────────────────────────────────────────────────
# Redis-backed cache for User.role_revision, with automatic fallback to
# in-memory cache when Redis is unavailable (handled by cache.py).
# role_revision changes infrequently, so a 5-minute TTL is safe.
_ROLE_REVISION_CACHE_TTL: int = 300  # 5 minutes


def _get_cached_role_revision(user_id: int) -> int | None:
    """Get cached role_revision for a user.

    Uses Redis (via cache.py) with automatic in-memory fallback.
    Returns None if not cached or TTL expired.
    """
    return get_json(build_cache_key("role_revision", user_id))


def _set_cached_role_revision(user_id: int, revision: int) -> None:
    """Cache a user's role_revision with the configured TTL.

    Persists across server restarts when Redis is available.
    Falls back to in-memory when Redis is unavailable.
    """
    set_json(build_cache_key("role_revision", user_id), revision, _ROLE_REVISION_CACHE_TTL)


# ── Metrics Rate Limiting ────────────────────────────────────────────────────
# Simple in-memory rate limit for /metrics to prevent abuse.
# Each IP can call /metrics at most once per 60 seconds.
# Cache is bounded to 1000 entries and cleaned every 100 requests.
_METRICS_RATE_LIMIT_WINDOW = 60.0  # seconds
_METRICS_RATE_LIMIT_MAX = 1  # requests per window
_METRICS_CACHE_MAX_SIZE = 1000
_metrics_rate_limit_cache: dict[str, float] = {}  # ip -> timestamp
_metrics_rate_cleanup_counter: int = 0
from backend.services.whatsapp_sender import initialize_whatsapp_sender, shutdown_whatsapp_sender
from backend.services.attendance_absence_service import (
    initialize_attendance_absence_scheduler,
    shutdown_attendance_absence_scheduler,
)
from backend.services.approval_expiry_service import (
    initialize_approval_expiry_scheduler,
    shutdown_approval_expiry_scheduler,
)
from backend.services.feedback_anomaly_detection import (
    initialize_feedback_anomaly_detector,
    shutdown_feedback_anomaly_detector,
)
from backend.services.attendance_auto_close_service import (
    initialize_attendance_auto_close_scheduler,
    shutdown_attendance_auto_close_scheduler,
)
from backend.services.email_queue_processor import start_email_processor, stop_email_processor
from backend.services.audit_archival_service import (
    initialize_audit_archival_service,
    shutdown_audit_archival_service,
)
from backend.services.billing_manager import (
    enforce_expired_grace_periods,
    normalize_subscription_states,
    recover_stale_dispatching_events,
)

try:
    import sentry_sdk  # type: ignore
    from sentry_sdk.integrations.asgi import SentryAsgiMiddleware  # type: ignore
except Exception:  # pragma: no cover - optional dependency
    sentry_sdk = None
    SentryAsgiMiddleware = None
setup_logging()
logger = logging.getLogger(__name__)
config = get_config()
if config.app_env == "production" and config.debug:
    raise RuntimeError("DEBUG must be disabled in production.")


def _run_startup_validation() -> None:
    """Run environment validation on startup (development only).

    In production, set FAIL_ON_STARTUP_VALIDATION=1 to treat
    validation failures as fatal. In development, warnings
    are logged but do not block startup.

    Executed synchronously in FastAPI's blocking startup path
    (alongside init_db(), billing recovery, etc.) so there
    is no benefit to making this async.
    """
    if _SKIP_VALIDATION:
        logger.info("Startup validation skipped via SKIP_STARTUP_VALIDATION.")
        return

    try:
        import subprocess
        import sys
        from pathlib import Path

        script = Path(__file__).resolve().parents[1] / "scripts" / "validate_env.py"
        if not script.exists():
            logger.warning("startup_validation skipped: scripts/validate_env.py not found.")
            return

        result = subprocess.run(
            [sys.executable, str(script), "--json"],
            capture_output=True, text=True, timeout=15,
            cwd=str(script.parents[1]),
        )

        if result.returncode == 0:
            logger.info("startup_validation passed.")
            return

        # Parse JSON output for details
        try:
            import json as _json
            report = _json.loads(result.stdout.strip())
            failures = report.get("failure_details", [])
            warnings = report.get("warning_details", [])
        except Exception:
            failures = []
            warnings = []

        if failures:
            for f in failures:
                logger.warning("startup_validation FAILURE: %s", f)

        if warnings:
            for w in warnings:
                logger.warning("startup_validation WARNING: %s", w)

        if _FAIL_ON_VALIDATION and failures:
            raise RuntimeError(
                f"Startup validation failed with {len(failures)} error(s): {failures[0]}"
            )

        logger.warning(
            "startup_validation completed with %d failure(s) and %d warning(s). "
            "Set SKIP_STARTUP_VALIDATION=1 to skip.",
            len(failures),
            len(warnings),
        )
    except subprocess.TimeoutExpired:
        logger.warning("startup_validation timed out after 15s.")
    except Exception as exc:
        logger.warning("startup_validation failed to run: %s", exc)


@asynccontextmanager
async def lifespan(_app: FastAPI):
    try:
        logger.info("Starting backend initialization.")

        # Run environment validation (non-blocking warnings in dev)
        _run_startup_validation()

        init_db()
        try:
            with SessionLocal() as db:
                normalized = normalize_subscription_states(db)
                expired = enforce_expired_grace_periods(db)
                recovered = await recover_stale_dispatching_events(db)
                db.commit()
                logger.info(
                    "Billing recovery completed normalized=%s expired=%s recovered=%s",
                    normalized,
                    expired,
                    recovered,
                )
        except Exception:
            logger.exception("Billing recovery failed during startup; continuing without blocking app boot.")
        initialize_whatsapp_sender()
        initialize_attendance_absence_scheduler()
        initialize_approval_expiry_scheduler()
        initialize_feedback_anomaly_detector()
        initialize_attendance_auto_close_scheduler()
        initialize_ops_alerting()
        initialize_audit_archival_service()
        start_email_processor()

        # ── rq Worker Enqueue (ARCH-03) ─────────────────────────────────
        # Feature-flagged: when RQ_WORKER_ENABLED=true, enqueue jobs to
        # the rq worker process in addition to (or instead of) the
        # existing daemon-thread schedulers. This is the dual-run phase
        # for safe migration — both paths run simultaneously.
        if os.getenv("RQ_WORKER_ENABLED", "").strip().lower() in ("1", "true", "yes"):
            try:
                from backend.workers.email_queue_worker import enqueue_email_batch
                enqueue_email_batch()
                logger.info("rq: enqueued email batch job.")
            except Exception:
                logger.exception("rq: failed to enqueue email batch job.")

            try:
                from backend.workers.attendance_auto_close import enqueue_auto_close_sweep
                enqueue_auto_close_sweep()
                logger.info("rq: enqueued auto-close sweep.")
            except Exception:
                logger.exception("rq: failed to enqueue auto-close sweep.")

            try:
                from backend.workers.approval_expiry import enqueue_approval_expiry_sweep
                enqueue_approval_expiry_sweep()
                logger.info("rq: enqueued approval expiry sweep.")
            except Exception:
                logger.exception("rq: failed to enqueue approval expiry sweep.")

            try:
                from backend.workers.feedback_anomaly import enqueue_anomaly_detection
                enqueue_anomaly_detection()
                logger.info("rq: enqueued anomaly detection.")
            except Exception:
                logger.exception("rq: failed to enqueue anomaly detection.")

        # Phase P3: Register approval completion callbacks
        try:
            from backend.services.approval_callbacks import register_all_callbacks
            register_all_callbacks()
        except Exception:
            logger.exception("Failed to register approval callbacks; continuing without blocking app boot.")

        logger.info("Backend startup completed successfully.")
        yield
    except Exception as error:  # pylint: disable=broad-except
        logger.exception("Startup initialization failed.")
        raise RuntimeError("Backend startup failed.") from error
    finally:
        shutdown_attendance_absence_scheduler()
        shutdown_approval_expiry_scheduler()
        shutdown_feedback_anomaly_detector()
        shutdown_attendance_auto_close_scheduler()
        shutdown_ops_alerting()
        shutdown_audit_archival_service()
        shutdown_whatsapp_sender()
        stop_email_processor()


app = FastAPI(title=config.app_name, version="0.3.0", lifespan=lifespan)
if sentry_sdk and os.getenv("SENTRY_DSN"):
    sentry_sdk.init(
        dsn=os.getenv("SENTRY_DSN"),
        environment=os.getenv("SENTRY_ENV", "production"),
        traces_sample_rate=float(os.getenv("SENTRY_TRACES_SAMPLE_RATE", "0.1")),
        send_default_pii=False,
    )
    if SentryAsgiMiddleware:
        app.add_middleware(SentryAsgiMiddleware)
# ── Auth Router Mounting ────────────────────────────────────────────────
# auth_secure is the canonical auth router at /auth.
# auth_legacy hosts public registration, email verification, and user
# management flows that haven't been migrated to auth_secure yet.
# auth-secure and /auth/v2 are backward-compatibility aliases.
app.include_router(auth_secure_router, prefix="/auth")
app.include_router(auth_secure_router, prefix="/auth-secure")
app.include_router(auth_secure_router, prefix="/auth/v2")
app.include_router(auth_router, prefix="/auth-legacy")
app.include_router(auth_google_router, prefix="/auth")
app.include_router(phone_auth_router, prefix="/auth")
app.include_router(permissions_router, prefix="/auth")
app.include_router(approvals_router, prefix="/api")
app.include_router(jobs_router, prefix="/jobs")
app.include_router(entries_router, prefix="/entries")
app.include_router(reports_router, prefix="/reports")
app.include_router(analytics_router, prefix="/analytics")
app.include_router(ai_router, prefix="/ai")
app.include_router(alerts_router, prefix="/alerts")
app.include_router(feedback_router, prefix="/feedback")
app.include_router(attendance_router, prefix="/attendance")
app.include_router(settings_router, prefix="/settings")
app.include_router(alert_recipients_router, prefix="/settings")
app.include_router(ocr_router, prefix="/ocr")
app.include_router(observability_router, prefix="/observability")
app.include_router(whatsapp_webhook_router, prefix="/webhooks")
app.include_router(emails_router, prefix="/emails")
app.include_router(intelligence_router, prefix="/intelligence")
app.include_router(plans_router, prefix="/plans")
app.include_router(billing_router, prefix="/billing")
app.include_router(admin_billing_router)
app.include_router(admin_ai_router)
app.include_router(premium_router, prefix="/premium")
app.include_router(steel_router, prefix="/steel")
app.include_router(steel_intelligence_router, prefix="/steel")
app.include_router(steel_finance_router, prefix="/steel")
app.include_router(steel_bom_router, prefix="/steel")
app.include_router(notifications_router)
app.include_router(workforce_intelligence_router, prefix="/intelligence")
app.include_router(cron_router)

# ── Register RLS checkout event on the DB engine so that every
# connection from the pool gets PostgreSQL RLS GUCs set according
# to the current thread's tenant context.
_register_checkout_event(engine)
logger.info("RLS checkout event registered on database engine.")

# ── Dev-only routes & middleware ──────────────────────────────────────
# The dev router and failure injection middleware are ONLY registered
# when APP_ENV=development or FORCE_FAILURES=1. They are NEVER added
# to the middleware/router stack in production, which avoids the
# BaseHTTPMiddleware ASGI compatibility issues that cause 400 errors
# on Render and other production ASGI servers.
#
# NOTE: Imports are inside the conditional block so that on Render
# (where these files don't exist in Git), the app starts without error.
_DEV_MODE_ENABLED = os.getenv("APP_ENV", "development").strip().lower() == "development" \
    or os.getenv("FORCE_FAILURES", "").strip().lower() in ("1", "true", "yes")

if _DEV_MODE_ENABLED:
    from backend.routers.dev import router as dev_router
    from backend.middleware.failure_injection import FailureInjectionMiddleware
    app.include_router(dev_router)
    app.add_middleware(FailureInjectionMiddleware)
    logger.info("Dev router and failure injection middleware registered (development mode).")

app.add_middleware(
    RLSContextMiddleware,
)
app.add_middleware(IdempotencyMiddleware)
apply_security(app)
apply_response_envelope(app)

@app.middleware("http")
async def log_requests(request: Request, call_next: Callable) -> Response:
    start = time.perf_counter()
    try:
        response = await call_next(request)
    except Exception as error:
        duration_ms = (time.perf_counter() - start) * 1000
        record_request(request.url.path, 500, duration_ms, request.method)
        record_exception()
        record_ops_request_exception(request, error, duration_ms)
        logger.exception(
            "request_failed method=%s path=%s duration_ms=%.2f",
            request.method,
            request.url.path,
            duration_ms,
            extra={
                "event": "http_request_failed",
                "method": request.method,
                "path": request.url.path,
                "status": 500,
                "duration_ms": round(duration_ms, 2),
            },
        )
        raise
    duration_ms = (time.perf_counter() - start) * 1000
    record_request(request.url.path, response.status_code, duration_ms, request.method)
    record_ops_request_outcome(request, response.status_code, duration_ms)
    logger.info(
        "request method=%s path=%s status=%s duration_ms=%.2f",
        request.method,
        request.url.path,
        response.status_code,
        duration_ms,
        extra={
            "event": "http_request",
            "method": request.method,
            "path": request.url.path,
            "status": response.status_code,
            "duration_ms": round(duration_ms, 2),
        },
    )
    return response


@app.get("/health")
def health_check() -> dict[str, str]:
    db = SessionLocal()
    try:
        logger.info("Health check endpoint called.")
        db.execute(text("SELECT 1"))
        return {"status": "ok", "service": "backend", "app": config.app_name}
    except Exception as error:  # pylint: disable=broad-except
        logger.exception("Health check failed.")
        raise HTTPException(status_code=500, detail="Internal server error.") from error
    finally:
        db.close()


@app.get("/")
def root() -> dict[str, object]:
    return {
        "status": "ok",
        "service": "backend",
        "app": config.app_name,
        "version": app.version,
        "health_url": "/health",
        "ready_url": "/observability/ready",
    }


@app.get("/metrics")
def metrics(request: Request) -> Response:
    """Prometheus metrics endpoint with rate limiting and token protection."""
    # Rate limiting: max 1 request per 60 seconds per IP (prevents abuse)
    global _metrics_rate_cleanup_counter
    client_ip = request.client.host if request.client else "unknown"
    now = time.monotonic()
    last_access = _metrics_rate_limit_cache.get(client_ip, 0.0)
    if now - last_access < _METRICS_RATE_LIMIT_WINDOW:
        raise HTTPException(
            status_code=429,
            detail=f"Metrics endpoint rate limited: max 1 request per {int(_METRICS_RATE_LIMIT_WINDOW)} seconds.",
        )
    _metrics_rate_limit_cache[client_ip] = now
    # Periodic cleanup: every 100 requests, prune expired entries to prevent
    # unbounded cache growth from different IP addresses.
    _metrics_rate_cleanup_counter += 1
    if _metrics_rate_cleanup_counter >= 100:
        _metrics_rate_cleanup_counter = 0
        cutoff = now - _METRICS_RATE_LIMIT_WINDOW * 2
        stale = [ip for ip, ts in _metrics_rate_limit_cache.items() if ts < cutoff]
        for ip in stale:
            del _metrics_rate_limit_cache[ip]

    token = os.getenv("METRICS_TOKEN")
    if not token:
        raise HTTPException(status_code=403, detail="Metrics not configured.")
    header = request.headers.get("X-Metrics-Token") or ""
    if header.strip() != token:
        raise HTTPException(status_code=403, detail="Metrics token invalid.")

    # Generate Prometheus metrics
    from prometheus_client import generate_latest, CONTENT_TYPE_LATEST
    data = generate_latest()
    return Response(content=data, media_type=CONTENT_TYPE_LATEST)
