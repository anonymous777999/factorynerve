"""Simple in-memory rate limiting utilities."""

from __future__ import annotations

import threading
import time
from collections import defaultdict, deque

from backend.cache import get_redis_client


class RateLimitError(RuntimeError):
    def __init__(self, detail: str) -> None:
        super().__init__(detail)
        self.detail = detail


_lock = threading.Lock()
_buckets: dict[str, deque[float]] = defaultdict(deque)


def check_rate_limit(*, key: str, max_requests: int, window_seconds: int) -> None:
    if max_requests <= 0:
        return
    redis_client = get_redis_client()
    if redis_client is not None:
        redis_key = f"auth-rate-limit:{key}"
        try:  # pragma: no cover - depends on Redis availability
            current = int(redis_client.incr(redis_key))
            if current == 1:
                redis_client.expire(redis_key, max(1, window_seconds))
            if current > max_requests:
                raise RateLimitError("Too many attempts. Please try again later.")
            return
        except RateLimitError:
            raise
        except Exception:
            pass
    now = time.time()
    with _lock:
        history = _buckets[key]
        while history and now - history[0] > window_seconds:
            history.popleft()
        if len(history) >= max_requests:
            raise RateLimitError("Too many attempts. Please try again later.")
        history.append(now)


def reset_rate_limit(*, key: str) -> None:
    redis_client = get_redis_client()
    if redis_client is not None:
        try:  # pragma: no cover - depends on Redis availability
            redis_client.delete(f"auth-rate-limit:{key}")
            return
        except Exception:
            pass
    with _lock:
        _buckets.pop(key, None)
