"""
failure_injection.py — FastAPI middleware for failure simulation.

Runs on every request when failure modes are active. Can:
- Block requests with error responses (permission, OCR, upload failures)
- Inject artificial latency (slow network, DB lock)
- Set thread-local env overrides (Redis, AI, email)
- Log the injected failure for debugging

Only active when APP_ENV=development or when FORCE_FAILURES=1 is set.
"""

from __future__ import annotations

import logging
import os
import threading
from collections.abc import Callable

from starlette.middleware.base import BaseHTTPMiddleware, Request, Response
from starlette.responses import JSONResponse

from backend import failure_simulation

logger = logging.getLogger(__name__)

# ── Thread-local env override context ─────────────────────────────────────────
# We store original env var values so they can be restored after each request.
_env_overrides_local = threading.local()


def _should_activate() -> bool:
    """Failure injection only runs in dev or when explicitly forced."""
    app_env = os.getenv("APP_ENV", "development").strip().lower()
    force = os.getenv("FORCE_FAILURES", "").strip().lower() in ("1", "true", "yes")
    return app_env == "development" or force


def _apply_env_overrides() -> None:
    """Apply failure-driven env var overrides for this request.

    Stores original values so they can be restored after the request.
    """
    overrides = failure_simulation.env_overrides()
    if not overrides:
        return

    originals: dict[str, str | None] = {}
    for key, value in overrides.items():
        originals[key] = os.environ.get(key)
        os.environ[key] = value

    _env_overrides_local.originals = originals


def _restore_env_overrides() -> None:
    """Restore env vars to their original values after the request."""
    originals = getattr(_env_overrides_local, "originals", None)
    if not originals:
        return

    for key, original_value in originals.items():
        if original_value is None:
            os.environ.pop(key, None)
        else:
            os.environ[key] = original_value

    _env_overrides_local.originals = {}


class FailureInjectionMiddleware(BaseHTTPMiddleware):
    """FastAPI middleware that injects simulated failures.

    Uses BaseHTTPMiddleware so the dispatch() method receives the simpler
    (request, call_next) pattern instead of raw ASGI (scope, receive, send).

    Runs on every request when failure modes are active.
    Checks each failure mode and either:
    - Returns an error response immediately
    - Injects latency before passing to the next handler
    - Sets env var overrides for downstream services

    Place this middleware near the top of the middleware stack
    so it runs before authentication/security middleware.
    """

    async def dispatch(self, request: Request, call_next: Callable) -> Response:
        if not _should_activate():
            return await call_next(request)

        path = request.url.path

        # Skip failure injection for dev endpoints and health checks
        if path.startswith(("/dev/", "/health", "/observability/ready")):
            return await call_next(request)

        # ── Step 1: Apply env var overrides ──────────────────────────────
        _apply_env_overrides()

        # ── Step 2: Check if path should be blocked ──────────────────────
        should_block, status_code, detail = failure_simulation.should_block_path(path)
        if should_block:
            _restore_env_overrides()
            logger.warning(
                "failure_simulation: BLOCKED %s %s — %s (status=%s)",
                request.method,
                path,
                detail,
                status_code,
            )
            return JSONResponse(
                status_code=status_code,
                content={
                    "detail": detail,
                    "failure_simulation": True,
                    "failure_mode": _identify_blocking_mode(path),
                },
                headers={"X-Failure-Simulation": _identify_blocking_mode(path) or "true"},
            )

        # ── Step 3: Inject network latency ───────────────────────────────
        failure_simulation.inject_network_latency()

        # ── Step 4: Inject DB latency (if applicable) ────────────────────
        failure_simulation.inject_db_latency()

        # ── Step 5: Process the request ──────────────────────────────────
        try:
            response = await call_next(request)

            # Add failure simulation header when any modes are active
            if failure_simulation.get_status()["active_count"] > 0:
                response.headers["X-Failure-Simulation"] = "active"

            return response
        finally:
            # ── Step 6: Restore env vars ────────────────────────────────
            _restore_env_overrides()


def _identify_blocking_mode(path: str) -> str | None:
    """Identify which failure mode is blocking a path.

    Checks each mode that can block requests and returns the
    highest-priority matching mode name.
    Priority order MUST match should_block_path() in failure_simulation.py:
      1. ocr_fail
      2. permission_deny
      3. expired_session
      4. worker_crash
      5. queue_backlog
      6. large_upload
    """
    modes = failure_simulation.get_status()["modes"]
    path_lower = path.lower()

    # 1. OCR failure
    if path_lower.startswith("/ocr/") and modes.get("ocr_fail", {}).get("active"):
        return "ocr_fail"

    # 2. Permission denial (all protected paths)
    for protected_prefix in failure_simulation.PROTECTED_PATHS:
        if path_lower.startswith(protected_prefix):
            if modes.get("permission_deny", {}).get("active"):
                return "permission_deny"
            if modes.get("expired_session", {}).get("active"):
                return "expired_session"
            break

    # 3. Worker crash (/jobs/, /cron/, /intelligence/)
    if path_lower.startswith(("/jobs/", "/cron/", "/intelligence/")) and modes.get("worker_crash", {}).get("active"):
        return "worker_crash"

    # 4. Queue backlog (/jobs/ only)
    if path_lower.startswith("/jobs/") and modes.get("queue_backlog", {}).get("active"):
        return "queue_backlog"

    # 5. Large upload (/ocr/, /settings/)
    if path_lower.startswith(("/ocr/", "/settings/")) and modes.get("large_upload", {}).get("active"):
        return "large_upload"

    return None



def is_path_protected(path: str) -> bool:
    """Check if a path is auth-protected (for failure targeting)."""
    return any(path.startswith(p) for p in failure_simulation.PROTECTED_PATHS)
