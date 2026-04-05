"""Security middleware utilities (CORS, HTTPS, rate limiting, headers)."""

from __future__ import annotations

import os
import threading
import time
import uuid
from collections import defaultdict, deque
from collections.abc import Callable

from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware
from fastapi.middleware.gzip import GZipMiddleware
try:
    from starlette.middleware.proxy_headers import ProxyHeadersMiddleware  # type: ignore
except Exception:  # pragma: no cover
    ProxyHeadersMiddleware = None
from starlette.requests import Request
from starlette.responses import RedirectResponse
from starlette.responses import JSONResponse, Response

from backend.security import decode_access_token
from backend.utils import request_id_var


def _parse_origins(raw: str | None) -> list[str]:
    if raw:
        items = [item.strip() for item in raw.split(",") if item.strip()]
        if items:
            return items
    return [
        "http://localhost:8502",
        "http://127.0.0.1:8502",
        "http://localhost:3000",
        "http://127.0.0.1:3000",
        "http://192.168.213.1:3000",
    ]


def _env_bool(key: str, default: bool = False) -> bool:
    raw = os.getenv(key)
    if raw is None:
        return default
    return raw.strip().lower() in {"1", "true", "yes", "on"}


def _env_int(key: str, default: int) -> int:
    raw = os.getenv(key)
    if raw is None:
        return default
    try:
        return int(raw)
    except ValueError:
        return default


def _env_float(key: str, default: float) -> float:
    raw = os.getenv(key)
    if raw is None:
        return default
    try:
        return float(raw)
    except ValueError:
        return default


def _request_is_https(request: Request) -> bool:
    if request.url.scheme == "https":
        return True
    forwarded_proto = (request.headers.get("x-forwarded-proto") or "").split(",")[0].strip().lower()
    return forwarded_proto == "https"


def apply_security(app: FastAPI) -> None:
    cors_origins = _parse_origins(os.getenv("CORS_ALLOWED_ORIGINS"))
    cors_allow_credentials = _env_bool("CORS_ALLOW_CREDENTIALS", True)
    app.add_middleware(
        CORSMiddleware,
        allow_origins=cors_origins,
        allow_credentials=cors_allow_credentials,
        allow_methods=["GET", "POST", "PUT", "PATCH", "DELETE", "OPTIONS"],
        allow_headers=[
            "Authorization",
            "Content-Type",
            "X-Request-ID",
            "X-Response-Envelope",
            "X-CSRF-Token",
            "X-Use-Cookies",
        ],
    )
    app.add_middleware(GZipMiddleware, minimum_size=1000)
    if _env_bool("TRUST_PROXY", False) and ProxyHeadersMiddleware:
        app.add_middleware(ProxyHeadersMiddleware, trusted_hosts="*")
    force_https = _env_bool("FORCE_HTTPS", False)
    https_exempt_paths = {"/health", "/observability/ready"}

    rate_limit_window = _env_float("RATE_LIMIT_WINDOW_SECONDS", 60.0)
    rate_limit_max = _env_int("RATE_LIMIT_MAX_REQUESTS", 120)
    max_request_bytes = _env_int("MAX_REQUEST_BYTES", 12_000_000)
    hsts_max_age = _env_int("HSTS_MAX_AGE", 31_536_000)

    lock = threading.Lock()
    request_timestamps: dict[str, deque[float]] = defaultdict(deque)

    def _rate_key(request: Request) -> str:
        auth = request.headers.get("Authorization") or ""
        token = ""
        if auth.startswith("Bearer "):
            token = auth.replace("Bearer ", "", 1).strip()
        if token:
            try:
                payload = decode_access_token(token)
                org_id = payload.get("org_id")
                user_id = payload.get("sub")
                if org_id:
                    return f"org:{org_id}"
                if user_id:
                    return f"user:{user_id}"
            except Exception:
                pass
        ip_address = request.client.host if request.client else "unknown"
        return f"ip:{ip_address}"

    def _rate_limit_exceeded(key: str) -> bool:
        with lock:
            now = time.time()
            history = request_timestamps[key]
            while history and now - history[0] > rate_limit_window:
                history.popleft()
            if len(history) >= rate_limit_max:
                return True
            history.append(now)
            return False

    @app.middleware("http")
    async def attach_request_id(request: Request, call_next: Callable) -> Response:
        request_id = request.headers.get("X-Request-ID") or str(uuid.uuid4())
        token = request_id_var.set(request_id)
        try:
            response = await call_next(request)
        finally:
            request_id_var.reset(token)
        response.headers["X-Request-ID"] = request_id
        return response

    @app.middleware("http")
    async def force_https_redirect(request: Request, call_next: Callable) -> Response:
        if force_https and request.url.path not in https_exempt_paths and not _request_is_https(request):
            target = str(request.url.replace(scheme="https"))
            return RedirectResponse(url=target, status_code=307)
        return await call_next(request)

    @app.middleware("http")
    async def rate_limit_requests(request: Request, call_next: Callable) -> Response:
        if request.url.path != "/health":
            key = _rate_key(request)
            if _rate_limit_exceeded(key):
                return JSONResponse(status_code=429, content={"detail": "Too many requests. Please slow down."})
        return await call_next(request)

    @app.middleware("http")
    async def request_size_limit(request: Request, call_next: Callable) -> Response:
        if request.method in {"POST", "PUT", "PATCH"}:
            content_length = request.headers.get("content-length")
            if content_length:
                try:
                    if int(content_length) > max_request_bytes:
                        return JSONResponse(status_code=413, content={"detail": "Request too large."})
                except ValueError:
                    return JSONResponse(status_code=400, content={"detail": "Invalid Content-Length header."})
        return await call_next(request)

    @app.middleware("http")
    async def security_headers(request: Request, call_next: Callable) -> Response:
        response = await call_next(request)
        response.headers.setdefault("X-Content-Type-Options", "nosniff")
        response.headers.setdefault("X-Frame-Options", "DENY")
        response.headers.setdefault("Referrer-Policy", "no-referrer")
        response.headers.setdefault("Permissions-Policy", "geolocation=(), microphone=(), camera=(self)")
        response.headers.setdefault("Cross-Origin-Resource-Policy", "same-site")
        if _env_bool("FORCE_HTTPS", False):
            response.headers.setdefault("Strict-Transport-Security", f"max-age={hsts_max_age}; includeSubDomains")
        return response
