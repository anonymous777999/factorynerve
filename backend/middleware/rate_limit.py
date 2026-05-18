"""In-process request rate limiting helpers."""

from __future__ import annotations

import functools
import threading
import time
from collections import defaultdict, deque
from typing import Any, Callable

from fastapi import HTTPException, Request

from backend.auth_cookies import get_access_cookie
from backend.middleware.rate_limit_middleware import extract_client_ip
from backend.security import decode_access_token

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


def authenticated_user_key(request: Request) -> str:
    token = None
    auth_header = request.headers.get("authorization") or ""
    if auth_header.lower().startswith("bearer "):
        token = auth_header.split(" ", 1)[1].strip()
    if not token:
        token = get_access_cookie(request)
    if not token:
        return "anonymous"
    try:
        payload = decode_access_token(token)
    except HTTPException:
        return "anonymous"
    return str(payload.get("sub") or "anonymous")


def webhook_ip_key(request: Request) -> str:
    return extract_client_ip(request)


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
    amount, window_seconds = _parse_limit(limit_value)
    key = (limit_value, key_func(request))
    now = time.time()
    with _fallback_lock:
        history = _fallback_hits[key]
        while history and now - history[0] >= window_seconds:
            history.popleft()
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
