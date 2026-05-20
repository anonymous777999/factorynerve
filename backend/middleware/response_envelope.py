"""Optional JSON response envelope middleware for API consistency."""

from __future__ import annotations

import json
from typing import Any

from fastapi import FastAPI
from starlette.requests import Request
from starlette.responses import JSONResponse, Response


def _wants_envelope(request: Request) -> bool:
    header = (request.headers.get("X-Response-Envelope") or "").strip().lower()
    if header in {"0", "false", "no", "off"}:
        return False
    query = (request.query_params.get("envelope") or "").strip().lower()
    if query in {"0", "false", "no", "off"}:
        return False
    return True


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


def _is_enveloped(payload: Any) -> bool:
    return isinstance(payload, dict) and "success" in payload and ("data" in payload or "error" in payload)


def _normalize_error(payload: Any, status_code: int) -> dict[str, Any]:
    detail = payload.get("detail") if isinstance(payload, dict) and "detail" in payload else payload
    code = "error"
    message = "Request failed."
    details: Any = None

    if isinstance(detail, list):
        code = "validation_error" if status_code == 422 else "error"
        message = "Validation failed." if status_code == 422 else "Request failed."
        details = detail
    elif isinstance(detail, dict):
        code = str(detail.get("code") or detail.get("error") or "error")
        message = str(
            detail.get("message")
            or detail.get("detail")
            or detail.get("error_description")
            or "Request failed."
        )
        details = detail
    elif isinstance(detail, str):
        code = "validation_error" if status_code == 422 else "error"
        message = detail
        details = detail
    elif detail is not None:
        details = detail

    return {
        "success": False,
        "error": {
            "code": code,
            "message": message,
            "details": details,
        },
    }


def _normalize_success(payload: Any) -> dict[str, Any]:
    return {
        "success": True,
        "data": payload,
    }


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

        if _is_enveloped(payload):
            wrapped_payload = payload
        elif response.status_code >= 400:
            wrapped_payload = _normalize_error(payload, response.status_code)
        else:
            wrapped_payload = _normalize_success(payload)

        wrapped = JSONResponse(wrapped_payload, status_code=response.status_code)
        _copy_headers(response, wrapped)
        wrapped.background = response.background
        return wrapped
