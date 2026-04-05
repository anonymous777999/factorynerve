"""Lightweight per-user rate limits for AI-heavy actions."""

from __future__ import annotations

import os
import threading
import time
from collections import defaultdict, deque


class RateLimitError(RuntimeError):
    """Raised when a per-user AI rate limit is exceeded."""

    def __init__(self, detail: str) -> None:
        super().__init__(detail)
        self.detail = detail


_RATE_LOCK = threading.Lock()
_HISTORY: dict[tuple[str, int], deque[float]] = defaultdict(deque)

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
    now = time.time()
    key = (feature_key, int(user_id))
    with _RATE_LOCK:
        history = _HISTORY[key]
        while history and now - history[0] > window:
            history.popleft()
        if len(history) >= max_events:
            raise RateLimitError(f"Too many {feature_key} requests. Please slow down.")
        history.append(now)
