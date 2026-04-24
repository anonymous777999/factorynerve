"""CSRF protection for cookie-based JWT auth."""

from __future__ import annotations

from collections.abc import Callable

from fastapi import FastAPI
from starlette.requests import Request
from starlette.responses import JSONResponse, Response

from backend.auth_cookies import (
    get_access_cookie,
    get_csrf_cookie,
    get_refresh_cookie,
    require_csrf,
    set_csrf_cookie,
)


SAFE_METHODS = {"GET", "HEAD", "OPTIONS"}


def _is_exempt(path: str) -> bool:
    if path in {"/health", "/metrics"}:
        return True
    if path == "/observability/frontend-error":
        return True
    if path.startswith("/auth/google"):
        return True
    if path.startswith("/auth-secure"):
        return True
    if path in {"/auth/login", "/auth/register", "/auth/password/forgot", "/auth/password/reset"}:
        return True
    return False


def apply_cookie_csrf(app: FastAPI) -> None:
    def _attach_missing_csrf_cookie(request: Request, response: Response) -> Response:
        if get_csrf_cookie(request):
            return response
        if not (get_access_cookie(request) or get_refresh_cookie(request)):
            return response
        csrf = set_csrf_cookie(response=response, request=request)
        response.headers.setdefault("X-CSRF-Token", csrf)
        return response

    @app.middleware("http")
    async def cookie_csrf_middleware(request: Request, call_next: Callable) -> Response:
        if request.method in SAFE_METHODS or _is_exempt(request.url.path):
            response = await call_next(request)
            return _attach_missing_csrf_cookie(request, response)

        if request.headers.get("Authorization"):
            return await call_next(request)

        access_cookie = get_access_cookie(request)
        refresh_cookie = get_refresh_cookie(request)

        if not access_cookie and not (request.url.path == "/auth/refresh" and refresh_cookie):
            return await call_next(request)

        try:
            require_csrf(request)
        except Exception as error:
            detail = getattr(error, "detail", "CSRF validation failed.")
            return JSONResponse(status_code=403, content={"detail": detail})

        return await call_next(request)
