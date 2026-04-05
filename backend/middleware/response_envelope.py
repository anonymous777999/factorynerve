"""Optional JSON response envelope middleware for API consistency."""

from __future__ import annotations

import json
from typing import Any

from fastapi import FastAPI
from starlette.requests import Request
from starlette.responses import JSONResponse, Response


def _wants_envelope(request: Request) -> bool:
    header = (request.headers.get("X-Response-Envelope") or "").strip().lower()
    if header in {"1", "true", "yes", "on", "v1"}:
        return True
    query = (request.query_params.get("envelope") or "").strip().lower()
    return query in {"1", "true", "yes", "on", "v1"}


def _is_json_response(response: Response) -> bool:
    content_type = (response.headers.get("content-type") or "").lower()
    return content_type.startswith("application/json")


def _copy_headers(source: Response, target: Response) -> None:
    for key, value in source.headers.items():
        lower = key.lower()
        if lower in {"content-length", "content-type"}:
            continue
        if lower == "set-cookie":
            continue
        target.headers[key] = value
    for cookie in source.headers.getlist("set-cookie"):
        target.headers.append("set-cookie", cookie)


def _build_error(payload: Any, status_code: int) -> dict[str, Any] | None:
    if status_code < 400:
        return None
    detail = None
    if isinstance(payload, dict):
        detail = payload.get("detail")
    return {"detail": detail or "Request failed."}


def apply_response_envelope(app: FastAPI) -> None:
    @app.middleware("http")
    async def envelope_middleware(request: Request, call_next):  # type: ignore[override]
        response = await call_next(request)
        if not _wants_envelope(request) or not _is_json_response(response):
            return response

        body = b""
        async for chunk in response.body_iterator:
            body += chunk

        payload: Any = None
        if body:
            try:
                payload = json.loads(body)
            except Exception:
                passthrough = Response(
                    content=body,
                    status_code=response.status_code,
                    media_type=response.media_type,
                )
                _copy_headers(response, passthrough)
                passthrough.background = response.background
                return passthrough

        envelope = {
            "ok": response.status_code < 400,
            "status": response.status_code,
            "data": payload if response.status_code < 400 else None,
            "error": _build_error(payload, response.status_code),
            "request_id": response.headers.get("X-Request-ID"),
        }
        wrapped = JSONResponse(envelope, status_code=response.status_code)
        _copy_headers(response, wrapped)
        wrapped.background = response.background
        return wrapped

