"""Idempotency service — prevent duplicate processing of financial POST requests.

Usage in endpoints:

    from backend.services.idempotency_service import check_idempotency, store_idempotency

    @router.POST("/dispatches")
    def create_dispatch(..., request: Request, ...):
        # Check idempotency early — returns cached response if already processed
        cached = check_idempotency(db, request, "POST", "/steel/dispatches")
        if cached is not None:
            return JSONResponse(content=cached, status_code=200)

        # ... business logic ...

        # Store on success
        store_idempotency(db, request, "POST", "/steel/dispatches",
                          resource_type="SteelDispatch", resource_id=str(dispatch.id))
"""

from __future__ import annotations

import hashlib
import json
import random
from datetime import datetime, timedelta, timezone
from typing import Any

from fastapi import Request
from sqlalchemy.orm import Session

from backend.models.idempotency_key import IdempotencyKey


# ── Configuration ─────────────────────────────────────────────────────────────

IDEMPOTENCY_TTL_HOURS = 24          # Keys older than this are pruned
IDEMPOTENCY_PRUNING_SAMPLE_RATE = 0.1  # Only prune ~10% of requests
IDEMPOTENCY_MAX_DELETE_BATCH = 500     # Max rows to delete per prune cycle


# ── Helpers ───────────────────────────────────────────────────────────────────

def _extract_idempotency_key(request: Request) -> str | None:
    """Extract SHA-256 hashed idempotency key from header or auto-generate.

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
    try:
        body: bytes | None = getattr(request, "_body", None)
        if body is None and hasattr(request, "body"):
            # FastAPI may have already consumed the body — try to get it
            body = request.body() if callable(request.body) else None
    except Exception:
        body = None

    if body and isinstance(body, bytes) and len(body) > 0:
        raw = f"{request.method}:{request.url.path}:{hashlib.sha256(body).hexdigest()}"
        return hashlib.sha256(raw.encode("utf-8")).hexdigest()

    return None  # No key available


def _try_prune_stale_keys(db: Session) -> None:
    """Periodically delete expired idempotency keys to prevent table bloat.

    Runs on a sampling rate (~10% of calls) to avoid a DELETE on every request.
    Uses a batch limit to keep each prune cycle lightweight.
    """
    if random.random() > IDEMPOTENCY_PRUNING_SAMPLE_RATE:
        return
    cutoff = datetime.now(timezone.utc) - timedelta(hours=IDEMPOTENCY_TTL_HOURS)
    # Check if there's anything to prune before running the delete
    oldest = (
        db.query(IdempotencyKey.id)
        .filter(IdempotencyKey.created_at < cutoff)
        .limit(1)
        .first()
    )
    if oldest is None:
        return  # Nothing to prune
    db.query(IdempotencyKey).filter(
        IdempotencyKey.created_at < cutoff
    ).limit(IDEMPOTENCY_MAX_DELETE_BATCH).delete(synchronize_session=False)


# ── Public API ────────────────────────────────────────────────────────────────

def check_idempotency(
    db: Session,
    request: Request,
    method: str,
    path: str,
) -> dict[str, Any] | None:
    """Check if a request has already been processed.

    Returns the cached response dict if found (caller should return it immediately),
    or ``None`` if this is a new request that should proceed normally.
    """
    key_hash = _extract_idempotency_key(request)
    if key_hash is None:
        return None  # No idempotency key — proceed normally

    existing = (
        db.query(IdempotencyKey)
        .filter(IdempotencyKey.key_hash == key_hash)
        .first()
    )
    if existing is not None and existing.response_body:
        return json.loads(existing.response_body)

    # Opportunistic pruning (sampled, not every request)
    _try_prune_stale_keys(db)
    return None


def store_idempotency(
    db: Session,
    request: Request,
    method: str,
    path: str,
    *,
    resource_type: str | None = None,
    resource_id: str | None = None,
    response_body: dict[str, Any] | None = None,
) -> None:
    """Record that an idempotent request has been processed.

    Must be called AFTER the response is generated (after ``db.commit()``)
    so that the idempotency record is only created if the business logic succeeded.
    """
    key_hash = _extract_idempotency_key(request)
    if key_hash is None:
        return  # No idempotency key — nothing to store

    record = IdempotencyKey(
        key_hash=key_hash,
        method=method,
        path=path,
        resource_type=resource_type,
        resource_id=resource_id,
        response_status=200,
        response_body=json.dumps(response_body) if response_body else None,
    )
    db.add(record)
