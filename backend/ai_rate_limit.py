"""Per-user rate limits for AI-heavy actions — DB-backed with in-memory fallback."""

from __future__ import annotations

import os

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
) -> None:
    feature_key = (feature or "").strip().lower()
    max_events = int(DEFAULT_LIMITS.get(feature_key, 0) if limit is None else limit)
    if max_events <= 0:
        return
    window = int(DEFAULT_WINDOW_SECONDS if window_seconds is None else window_seconds)
    key = f"ai:{feature_key}:{int(user_id)}"
    _db_check(key=key, max_requests=max_events, window_seconds=window)
