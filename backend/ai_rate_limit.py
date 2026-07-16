"""Per-user rate limits for AI-heavy actions — DB-backed with in-memory fallback."""

from __future__ import annotations

import os

from sqlalchemy.orm import Session

from backend.auth_security.db_rate_limit import RateLimitError, check_rate_limit as _db_check

DEFAULT_WINDOW_SECONDS = int(os.getenv("AI_RATE_LIMIT_WINDOW_SECONDS", "60"))
DEFAULT_LIMITS = {
    "summary": int(os.getenv("SUMMARY_RATE_LIMIT_PER_MINUTE", "8")),
    "email": int(os.getenv("EMAIL_RATE_LIMIT_PER_MINUTE", "6")),
}


def check_rate_limit(
    user_id: int,
    *,
    feature: str,
    limit: int | None = None,
    window_seconds: int | None = None,
    db: Session | None = None,
) -> None:
    feature_key = (feature or "").strip().lower()
    max_events = int(DEFAULT_LIMITS.get(feature_key, 0) if limit is None else limit)
    if max_events <= 0:
        return
    window = int(DEFAULT_WINDOW_SECONDS if window_seconds is None else window_seconds)
    key = f"ai:{feature_key}:{int(user_id)}"
    # Reuse the caller's request-scoped session when provided. Opening a second
    # SessionLocal here to run `SELECT ... FOR UPDATE` on the rate_limits table
    # while the request's own transaction is still open contends for the same
    # rows/locks on the shared connection pool and can stall the request until
    # the DB lock times out (observed as a multi-second hang on /ai endpoints
    # that consume the "summary" quota). Running the check on the request
    # session keeps it in one transaction and avoids the self-contention.
    _db_check(key=key, max_requests=max_events, window_seconds=window, db=db)

