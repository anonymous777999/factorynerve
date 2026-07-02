"""In-process request rate limiting helpers."""

from __future__ import annotations

import functools
import threading
import time
from collections import defaultdict, deque
from typing import Any, Callable

from fastapi import HTTPException, Request

from backend.middleware.rate_limit_middleware import extract_client_ip

try:
    from slowapi import Limiter
    from slowapi.errors import RateLimitExceeded
except Exception:  # pragma: no cover - local fallback for environments without slowapi installed
    Limiter = None

    class RateLimitExceeded(Exception):
        """Fallback slowapi-compatible exception."""

        def __init__(self, detail: str = "Rate limit exceeded.") -> None:
            super().__init__(detail)
            self.detail = detail


_fallback_lock = threading.Lock()
_fallback_hits: dict[tuple[str, str], deque[float]] = defaultdict(deque)
_fallback_last_prune = 0.0


def authenticated_user_key(request: Request) -> str:
    return extract_client_ip(request)


def webhook_ip_key(request: Request) -> str:
    return extract_client_ip(request)


# Environment-variable-backed rate limits, resolved per-request so that
# configuration changes take effect without a server restart.
_ENV_LIMIT_CACHE: dict[str, str] = {}
_ENV_LIMIT_LOCK = threading.Lock()


def resolve_rate_limit(env_var: str, default: str) -> str:
    """Read a rate-limit string from an env var, cached per var name."""
    with _ENV_LIMIT_LOCK:
        cached = _ENV_LIMIT_CACHE.get(env_var)
        if cached is not None:
            return cached
        import os as _os
        value = (_os.getenv(env_var) or default).strip()
        _ENV_LIMIT_CACHE[env_var] = value
        return value


def invalidate_rate_limit_cache() -> None:
    """Force re-read of env vars on next resolve_rate_limit call."""
    with _ENV_LIMIT_LOCK:
        _ENV_LIMIT_CACHE.clear()


limiter = Limiter(key_func=authenticated_user_key, headers_enabled=True) if Limiter else None


def _parse_limit(limit_value: str) -> tuple[int, int]:
    amount_raw, window_raw = limit_value.split("/", 1)
    amount = int(amount_raw.strip())
    window_name = window_raw.strip().lower()
    window_seconds = {
        "second": 1,
        "minute": 60,
        "hour": 3600,
        "day": 86400,
    }.get(window_name.rstrip("s"))
    if window_seconds is None:
        raise ValueError(f"Unsupported rate window: {limit_value}")
    return amount, window_seconds


def _fallback_enforce(limit_value: str, key_func: Callable[[Request], str], request: Request) -> None:
    global _fallback_last_prune
    amount, window_seconds = _parse_limit(limit_value)
    key = (limit_value, key_func(request))
    now = time.time()
    with _fallback_lock:
        if now - _fallback_last_prune >= 60 or len(_fallback_hits) > 4096:
            stale_keys = [
                history_key
                for history_key, history in _fallback_hits.items()
                if not history or now - history[-1] >= 3600
            ]
            for history_key in stale_keys:
                _fallback_hits.pop(history_key, None)
            _fallback_last_prune = now
        history = _fallback_hits[key]
        while history and now - history[0] >= window_seconds:
            history.popleft()
        if not history:
            _fallback_hits.pop(key, None)
            history = _fallback_hits[key]
        if len(history) >= amount:
            raise HTTPException(status_code=429, detail="Rate limit exceeded.")
        history.append(now)


def rate_limit(limit_value: str, *, key_func: Callable[[Request], str]) -> Callable[[Callable[..., Any]], Callable[..., Any]]:
    def decorator(func: Callable[..., Any]) -> Callable[..., Any]:
        limited = limiter.limit(limit_value, key_func=key_func)(func) if limiter else func

        @functools.wraps(limited)
        async def async_wrapper(*args: Any, **kwargs: Any) -> Any:
            request = kwargs.get("request")
            if request is None:
                for arg in args:
                    if isinstance(arg, Request):
                        request = arg
                        break
            if request is None:
                raise RuntimeError("Rate-limited routes must accept a Request parameter.")
            if limiter is None:
                _fallback_enforce(limit_value, key_func, request)
            try:
                return await limited(*args, **kwargs)
            except RateLimitExceeded as error:
                raise HTTPException(status_code=429, detail=str(getattr(error, "detail", error))) from error

        return async_wrapper

    return decorator
