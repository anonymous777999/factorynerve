"""Cookie helpers for JWT auth (web frontend)."""

from __future__ import annotations

import logging
import os
import secrets
from typing import Any

from fastapi import HTTPException, Request, status

from backend.utils import get_config


logger = logging.getLogger(__name__)


ACCESS_COOKIE = os.getenv("JWT_ACCESS_COOKIE", "dpr_access")
REFRESH_COOKIE = os.getenv("JWT_REFRESH_COOKIE", "dpr_refresh")
CSRF_COOKIE = os.getenv("JWT_CSRF_COOKIE", "dpr_csrf")
CSRF_HEADER = os.getenv("JWT_CSRF_HEADER", "X-CSRF-Token")

COOKIE_SAMESITE = os.getenv("JWT_COOKIE_SAMESITE", "Strict")
COOKIE_DOMAIN = os.getenv("JWT_COOKIE_DOMAIN") or None
COOKIE_PATH = os.getenv("JWT_COOKIE_PATH", "/")

REFRESH_TOKEN_DAYS = min(int(os.getenv("REFRESH_TOKEN_DAYS", "7")), 7)


def _env_cookie_secure() -> bool | None:
    raw = os.getenv("JWT_COOKIE_SECURE")
    if raw is None:
        return None
    return raw.strip().lower() in {"1", "true", "yes", "on"}


def _should_use_secure_cookie(request: Request | None) -> bool:
    override = _env_cookie_secure()
    if override is not None:
        return override
    config = get_config()
    if config.app_env == "production":
        return True
    if request is not None:
        return request.url.scheme == "https"
    return False


def _normalize_cookie_domain(value: str | None) -> str | None:
    if not value:
        return None
    cleaned = value.strip().lower().lstrip(".")
    if not cleaned:
        return None
    if ":" in cleaned:
        cleaned = cleaned.split(":", 1)[0].strip()
    return cleaned or None


def _resolve_cookie_domain(request: Request | None) -> str | None:
    configured = _normalize_cookie_domain(COOKIE_DOMAIN)
    if not configured:
        return None
    if request is None:
        return configured

    host = (request.url.hostname or "").strip().lower().rstrip(".")
    if not host:
        return configured

    if host == configured or host.endswith(f".{configured}"):
        return configured

    # Common production misconfiguration: cookie domain is pinned to `www`
    # while users authenticate on the apex domain. In that case, widen the
    # cookie to the shared parent domain so the session survives the redirect.
    if configured.startswith("www."):
        apex = configured[4:]
        if host == apex or host.endswith(f".{apex}"):
            logger.warning(
                "JWT_COOKIE_DOMAIN=%s does not match request host %s; using parent domain %s instead.",
                configured,
                host,
                apex,
            )
            return apex

    logger.warning(
        "Ignoring JWT_COOKIE_DOMAIN=%s for request host %s because the domains do not match.",
        configured,
        host,
    )
    return None


def _cookie_kwargs(
    *, httponly: bool, max_age: int | None = None, request: Request | None = None
) -> dict[str, Any]:
    payload: dict[str, Any] = {
        "httponly": httponly,
        "secure": _should_use_secure_cookie(request),
        "samesite": COOKIE_SAMESITE,
        "path": COOKIE_PATH,
    }
    cookie_domain = _resolve_cookie_domain(request)
    if cookie_domain:
        payload["domain"] = cookie_domain
    if max_age is not None:
        payload["max_age"] = max_age
    return payload


def _access_max_age() -> int:
    config = get_config()
    return int(config.jwt_access_token_minutes * 60)


def _refresh_max_age() -> int:
    return int(REFRESH_TOKEN_DAYS * 86400)


def generate_csrf_token() -> str:
    return secrets.token_urlsafe(32)


def set_auth_cookies(
    *,
    response,
    access_token: str,
    refresh_token: str,
    csrf_token: str | None = None,
    request: Request | None = None,
) -> str:
    csrf = csrf_token or generate_csrf_token()
    response.set_cookie(
        ACCESS_COOKIE,
        access_token,
        **_cookie_kwargs(httponly=True, max_age=_access_max_age(), request=request),
    )
    response.set_cookie(
        REFRESH_COOKIE,
        refresh_token,
        **_cookie_kwargs(httponly=True, max_age=_refresh_max_age(), request=request),
    )
    response.set_cookie(
        CSRF_COOKIE,
        csrf,
        **_cookie_kwargs(httponly=False, max_age=_refresh_max_age(), request=request),
    )
    return csrf


def clear_auth_cookies(*, response, request: Request | None = None) -> None:
    cookie_domain = _resolve_cookie_domain(request)
    response.delete_cookie(ACCESS_COOKIE, path=COOKIE_PATH, domain=cookie_domain)
    response.delete_cookie(REFRESH_COOKIE, path=COOKIE_PATH, domain=cookie_domain)
    response.delete_cookie(CSRF_COOKIE, path=COOKIE_PATH, domain=cookie_domain)


def get_access_cookie(request: Request) -> str | None:
    return request.cookies.get(ACCESS_COOKIE)


def get_refresh_cookie(request: Request) -> str | None:
    return request.cookies.get(REFRESH_COOKIE)


def require_csrf(request: Request) -> None:
    csrf_header = (request.headers.get(CSRF_HEADER) or "").strip()
    csrf_cookie = (request.cookies.get(CSRF_COOKIE) or "").strip()
    if not csrf_header or not csrf_cookie or csrf_header != csrf_cookie:
        raise HTTPException(status_code=status.HTTP_403_FORBIDDEN, detail="CSRF validation failed.")


def wants_cookie_auth(request: Request) -> bool:
    header = (request.headers.get("X-Use-Cookies") or "").strip().lower()
    if header in {"1", "true", "yes", "on"}:
        return True
    query = (request.query_params.get("use_cookies") or "").strip().lower()
    return query in {"1", "true", "yes", "on"}
