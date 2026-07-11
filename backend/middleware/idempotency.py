"""Idempotency middleware — prevents duplicate processing of mutating POST/PUT/PATCH requests.

Usage:
    from backend.middleware.idempotency import IdempotencyMiddleware
    app.add_middleware(IdempotencyMiddleware)

How it works:
    1. Client sends ``Idempotency-Key`` header with a unique key per user action.
    2. Middleware checks if the key was already processed (returns cached response).
    3. If new, proceeds with the request and caches the response on success.
    4. Auto-generates a body-hash-based key when no header is provided.

Safe methods (GET, HEAD, OPTIONS) are never intercepted.
"""

from __future__ import annotations

import hashlib
import json
import logging
from collections.abc import Callable
from datetime import datetime, timezone, timedelta
from typing import Any

from fastapi import Request, Response
from starlette.middleware.base import BaseHTTPMiddleware
from starlette.responses import JSONResponse

from backend.database import SessionLocal
from backend.models.idempotency_key import IdempotencyKey


logger = logging.getLogger(__name__)

# ── Configuration ─────────────────────────────────────────────────────────────

IDEMPOTENCY_TTL_HOURS = 24
IDEMPOTENCY_PRUNING_SAMPLE_RATE = 0.05  # Only prune ~5% of requests
IDEMPOTENCY_MAX_DELETE_BATCH = 500

# Methods that are never idempotency-checked
SAFE_METHODS = frozenset({"GET", "HEAD", "OPTIONS", "DELETE"})

# Paths that should always bypass idempotency checks
BYPASS_PREFIXES = (
    "/health",
    "/metrics",
    "/observability",
    "/webhooks",
)


# ── Helpers ───────────────────────────────────────────────────────────────────


def _should_bypass(path: str) -> bool:
    """Check if the request path should bypass idempotency checks."""
    return path.startswith(BYPASS_PREFIXES)


async def _extract_key_hash(request: Request) -> str | None:
    """Extract or generate an idempotency key hash. (async — awaits request.body())

    Priority:
    1. ``Idempotency-Key`` header (SHA-256 hashed before storage)
    2. Auto-generated from method + path + request body SHA-256

    Returns ``None`` if neither is available (request proceeds without idempotency).
    """
    # Priority 1: explicit header
    header_key = request.headers.get("Idempotency-Key", "").strip()
    if header_key:
        return hashlib.sha256(header_key.encode("utf-8")).hexdigest()

    # Priority 2: auto-generate from body
    # NOTE: request.body() is an async coroutine in Starlette — MUST be awaited.
    # Starlette caches the result in request._body after the first read, so
    # downstream handlers can still access it via await request.body().
    try:
        body = await request.body()
    except Exception:
        body = None

    if body and isinstance(body, bytes) and len(body) > 0:
        raw = f"{request.method}:{request.url.path}:{hashlib.sha256(body).hexdigest()}"
        return hashlib.sha256(raw.encode("utf-8")).hexdigest()

    return None  # No key available


def _try_prune_stale_keys() -> None:
    """Periodically delete expired idempotency keys to prevent table bloat."""
    import random
    if random.random() > IDEMPOTENCY_PRUNING_SAMPLE_RATE:
        return
    try:
        db = SessionLocal()
        try:
            cutoff = datetime.now(timezone.utc) - timedelta(hours=IDEMPOTENCY_TTL_HOURS)
            db.query(IdempotencyKey).filter(
                IdempotencyKey.created_at < cutoff
            ).limit(IDEMPOTENCY_MAX_DELETE_BATCH).delete(synchronize_session=False)
            db.commit()
        finally:
            db.close()
    except Exception:
        logger.exception("Idempotency key pruning failed")


# ── Middleware ────────────────────────────────────────────────────────────────


class IdempotencyMiddleware(BaseHTTPMiddleware):
    """FastAPI middleware that provides idempotency for mutating endpoints.

    Intercepts POST/PUT/PATCH requests with an ``Idempotency-Key`` header (or
    auto-generates one from the request body) and returns cached responses for
    duplicate requests within the TTL window.
    """

    async def dispatch(self, request: Request, call_next: Callable) -> Response:
        # ── Bypass checks for safe methods and health endpoints ──────
        if request.method in SAFE_METHODS or _should_bypass(request.url.path):
            return await call_next(request)

        # ── Extract or generate idempotency key ──────────────────────
        key_hash = await _extract_key_hash(request)
        if key_hash is None:
            # No key available — proceed normally without idempotency
            return await call_next(request)

        # ── Check cache ──────────────────────────────────────────────
        try:
            db = SessionLocal()
            try:
                existing = (
                    db.query(IdempotencyKey)
                    .filter(IdempotencyKey.key_hash == key_hash)
                    .first()
                )
                if existing is not None and existing.response_body:
                    logger.debug(
                        "Idempotency hit: key=%s path=%s",
                        key_hash[:12],
                        request.url.path,
                    )
                    return JSONResponse(
                        content=json.loads(existing.response_body),
                        status_code=existing.response_status or 200,
                        headers={"X-Idempotency-Replay": "true"},
                    )
            finally:
                db.close()
        except Exception:
            logger.exception("Idempotency check failed — proceeding without cache")
            # Don't block the request on cache failures

        # ── Process request ──────────────────────────────────────────
        response = await call_next(request)

        # ── Cache only successful mutating responses ─────────────────
        if response.status_code < 500 and response.status_code != 429:
            try:
                db = SessionLocal()
                try:
                    body = b""
                    if hasattr(response, "body"):
                        body = response.body
                    elif isinstance(response, JSONResponse):
                        body = response.body if hasattr(response, "body") else b""

                    response_body = None
                    if body:
                        try:
                            response_body = json.dumps(json.loads(body))
                        except (ValueError, TypeError):
                            response_body = body.decode("utf-8", errors="replace")

                    record = IdempotencyKey(
                        key_hash=key_hash,
                        method=request.method,
                        path=request.url.path,
                        resource_type=None,
                        resource_id=None,
                        response_status=response.status_code,
                        response_body=response_body,
                    )
                    db.add(record)
                    db.commit()
                except Exception:
                    db.rollback()
                    logger.exception("Failed to store idempotency key")
                finally:
                    db.close()
            except Exception:
                logger.exception("Idempotency store failed — response already sent")

        # Opportunistic pruning
        _try_prune_stale_keys()

        return response
