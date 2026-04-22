"""Simple in-memory rate limiting utilities."""

from __future__ import annotations

import threading
import time
from collections import defaultdict, deque


class RateLimitError(RuntimeError):
    def __init__(self, detail: str) -> None:
        super().__init__(detail)
        self.detail = detail


_lock = threading.Lock()
_buckets: dict[str, deque[float]] = defaultdict(deque)


def check_rate_limit(*, key: str, max_requests: int, window_seconds: int) -> None:
    if max_requests <= 0:
        return
    now = time.time()
    with _lock:
        history = _buckets[key]
        while history and now - history[0] > window_seconds:
            history.popleft()
        if len(history) >= max_requests:
            raise RateLimitError("Too many attempts. Please try again later.")
        history.append(now)
