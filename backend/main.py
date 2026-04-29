"""FastAPI application entrypoint for DPR.ai."""

from __future__ import annotations

from contextlib import asynccontextmanager
import logging
import os
import time
from collections.abc import Callable

from fastapi import FastAPI, HTTPException
from sqlalchemy import text
from starlette.requests import Request
from starlette.responses import Response

from backend.database import SessionLocal, init_db
from backend.routers.analytics import router as analytics_router
from backend.routers.ai import router as ai_router
from backend.routers.alerts import router as alerts_router
from backend.routers.alert_recipients import router as alert_recipients_router
from backend.routers.whatsapp_standalone import router as whatsapp_alerts_router
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
from backend.routers.plans import router as plans_router
from backend.routers.billing import router as billing_router
from backend.routers.premium import router as premium_router
from backend.routers.steel import router as steel_router
from backend.utils import get_config, setup_logging
from backend.metrics import (
    record_exception,
    record_request,
    snapshot as metrics_snapshot,
)
from backend.middleware.security import apply_security
from backend.middleware.response_envelope import apply_response_envelope
from backend.middleware.csrf_cookie import apply_cookie_csrf
from backend.services.ops_alerts import (
    initialize_ops_alerting,
    record_request_exception as record_ops_request_exception,
    record_request_outcome as record_ops_request_outcome,
    shutdown_ops_alerting,
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

@asynccontextmanager
async def lifespan(_app: FastAPI):
    try:
        logger.info("Starting backend initialization.")
        init_db()
        initialize_ops_alerting()
        logger.info("Backend startup completed successfully.")
        yield
    except Exception as error:  # pylint: disable=broad-except
        logger.exception("Startup initialization failed.")
        raise RuntimeError("Backend startup failed.") from error
    finally:
        shutdown_ops_alerting()


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
app.include_router(auth_router, prefix="/auth")
app.include_router(auth_google_router, prefix="/auth")
app.include_router(phone_auth_router, prefix="/auth")
if os.getenv("ENABLE_AUTH_SECURE", "").strip().lower() in {"1", "true", "yes", "on"}:
    app.include_router(auth_secure_router, prefix="/auth-secure")
app.include_router(jobs_router, prefix="/jobs")
app.include_router(entries_router, prefix="/entries")
app.include_router(reports_router, prefix="/reports")
app.include_router(analytics_router, prefix="/analytics")
app.include_router(ai_router, prefix="/ai")
app.include_router(alerts_router, prefix="/alerts")
app.include_router(feedback_router, prefix="/feedback")
app.include_router(whatsapp_alerts_router)
app.include_router(attendance_router, prefix="/attendance")
app.include_router(settings_router, prefix="/settings")
app.include_router(alert_recipients_router, prefix="/settings")
app.include_router(ocr_router, prefix="/ocr")
app.include_router(observability_router, prefix="/observability")
app.include_router(emails_router, prefix="/emails")
app.include_router(intelligence_router, prefix="/intelligence")
app.include_router(plans_router, prefix="/plans")
app.include_router(billing_router, prefix="/billing")
app.include_router(premium_router, prefix="/premium")
app.include_router(steel_router, prefix="/steel")

apply_security(app)
apply_response_envelope(app)
apply_cookie_csrf(app)


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


@app.get("/metrics")
def metrics(request: Request) -> dict:
    token = os.getenv("METRICS_TOKEN")
    if not token:
        raise HTTPException(status_code=403, detail="Metrics not configured.")
    header = request.headers.get("X-Metrics-Token") or ""
    if header.strip() != token:
        raise HTTPException(status_code=403, detail="Metrics token invalid.")
    return metrics_snapshot()
