"""Meta WhatsApp Cloud API webhook verification and delivery reconciliation."""

from __future__ import annotations

import asyncio
from datetime import datetime, timezone
import hashlib
import hmac
import json
import logging
import os
import threading
import time
from typing import Any

from fastapi import APIRouter, HTTPException, Request
from fastapi.responses import Response

from backend.phone_utils import mask_phone_number
from backend.services.ops_alerts.service import apply_whatsapp_delivery_update


router = APIRouter(tags=["WhatsApp Webhooks"])
logger = logging.getLogger(__name__)

_WEBHOOK_EVENT_CACHE_LOCK = threading.Lock()
_WEBHOOK_EVENT_CACHE: dict[str, float] = {}
_WEBHOOK_EVENT_CACHE_WINDOW_SECONDS = 24 * 60 * 60
_STATUS_MAP = {
    "sent": "dispatched",
    "delivered": "delivered",
    "read": "read",
    "failed": "failed",
}


def _webhook_verify_token() -> str:
    return (os.getenv("META_WA_WEBHOOK_VERIFY_TOKEN") or "").strip()


def _app_secret() -> str:
    return (os.getenv("META_WA_APP_SECRET") or "").strip()


def _prune_event_cache(now_monotonic: float) -> None:
    cutoff = now_monotonic - _WEBHOOK_EVENT_CACHE_WINDOW_SECONDS
    expired = [key for key, processed_at in _WEBHOOK_EVENT_CACHE.items() if processed_at < cutoff]
    for key in expired:
        _WEBHOOK_EVENT_CACHE.pop(key, None)


def _is_duplicate_event(event_key: str) -> bool:
    now_monotonic = time.monotonic()
    with _WEBHOOK_EVENT_CACHE_LOCK:
        _prune_event_cache(now_monotonic)
        return event_key in _WEBHOOK_EVENT_CACHE


def _remember_event(event_key: str) -> None:
    now_monotonic = time.monotonic()
    with _WEBHOOK_EVENT_CACHE_LOCK:
        _prune_event_cache(now_monotonic)
        _WEBHOOK_EVENT_CACHE[event_key] = now_monotonic


def _build_expected_signature(*, payload: bytes, secret: str) -> str:
    digest = hmac.new(secret.encode("utf-8"), payload, hashlib.sha256).hexdigest()
    return f"sha256={digest}"


def _verify_signature(*, payload: bytes, signature_header: str | None) -> bool:
    provided = str(signature_header or "").strip()
    secret = _app_secret()
    if not secret or not provided:
        return False
    expected = _build_expected_signature(payload=payload, secret=secret)
    return hmac.compare_digest(expected, provided)


def _coerce_status_timestamp(raw_timestamp: Any) -> datetime | None:
    value = str(raw_timestamp or "").strip()
    if not value:
        return None
    try:
        return datetime.fromtimestamp(int(value), tz=timezone.utc)
    except (TypeError, ValueError, OSError):
        return None


def _normalize_recipient_phone(raw_value: Any) -> str | None:
    digits = "".join(char for char in str(raw_value or "").strip() if char.isdigit())
    if not digits:
        return None
    return f"+{digits}"


def _extract_failure_details(status_item: dict[str, Any]) -> tuple[str | None, str | None, str | None]:
    errors = status_item.get("errors")
    if not isinstance(errors, list) or not errors:
        return None, None, None
    first_error = errors[0] if isinstance(errors[0], dict) else {}
    error_code = str(first_error.get("code") or "").strip() or None
    error_title = str(first_error.get("title") or first_error.get("error_title") or "").strip() or None
    details = first_error.get("error_data") if isinstance(first_error.get("error_data"), dict) else {}
    detail_message = str(details.get("details") or "").strip()
    message = str(first_error.get("message") or "").strip()
    failure_reason = detail_message or message or error_title
    return error_code, error_title, failure_reason or None


def _payload_excerpt(status_item: dict[str, Any]) -> dict[str, Any]:
    excerpt: dict[str, Any] = {}
    for key in ("id", "status", "timestamp", "recipient_id", "conversation", "pricing", "errors"):
        if key in status_item:
            excerpt[key] = status_item[key]
    return excerpt


def _iter_status_updates(payload: dict[str, Any]) -> list[dict[str, Any]]:
    updates: list[dict[str, Any]] = []
    entries = payload.get("entry")
    if not isinstance(entries, list):
        return updates
    for entry in entries:
        if not isinstance(entry, dict):
            continue
        changes = entry.get("changes")
        if not isinstance(changes, list):
            continue
        for change in changes:
            if not isinstance(change, dict):
                continue
            value = change.get("value")
            if not isinstance(value, dict):
                continue
            statuses = value.get("statuses")
            if not isinstance(statuses, list):
                continue
            for status_item in statuses:
                if isinstance(status_item, dict):
                    updates.append(status_item)
    return updates


def _process_webhook_payload(payload: dict[str, Any]) -> dict[str, int]:
    processed = 0
    ignored = 0
    duplicates = 0
    stale = 0

    for status_item in _iter_status_updates(payload):
        raw_provider_message_id = str(status_item.get("id") or "").strip()
        raw_status = str(status_item.get("status") or "").strip().lower()
        raw_timestamp = str(status_item.get("timestamp") or "").strip()
        event_key = ":".join(part for part in (raw_provider_message_id, raw_status, raw_timestamp) if part)

        if not raw_provider_message_id or raw_status not in _STATUS_MAP:
            ignored += 1
            continue
        if event_key and _is_duplicate_event(event_key):
            duplicates += 1
            continue

        recipient_phone = _normalize_recipient_phone(status_item.get("recipient_id"))
        error_code, error_title, failure_reason = _extract_failure_details(status_item)
        result = apply_whatsapp_delivery_update(
            provider_message_id=raw_provider_message_id,
            delivery_status=_STATUS_MAP[raw_status],
            status_timestamp=_coerce_status_timestamp(status_item.get("timestamp")),
            recipient_phone=recipient_phone,
            error_code=error_code,
            error_title=error_title,
            failure_reason=failure_reason,
            payload_excerpt=_payload_excerpt(status_item),
        )
        processed += int(result.get("updated", 0))
        ignored += int(result.get("ignored", 0)) if result.get("reason") != "stale" else 0
        stale += int(result.get("ignored", 0)) if result.get("reason") == "stale" else 0
        if event_key and (result.get("updated", 0) or result.get("ignored", 0)):
            _remember_event(event_key)

        logger.info(
            "whatsapp_webhook_event org_id=%s to=%s provider_message_id=%s event_type=status delivery_state=%s retry_decision=%s failure_reason=%s",
            result.get("org_id"),
            mask_phone_number(recipient_phone),
            raw_provider_message_id,
            _STATUS_MAP[raw_status],
            "no_retry" if _STATUS_MAP[raw_status] == "failed" else "n/a",
            failure_reason or "-",
        )

    return {
        "processed": processed,
        "ignored": ignored,
        "duplicates": duplicates,
        "stale": stale,
    }


@router.get("/whatsapp")
async def verify_whatsapp_webhook(request: Request) -> Response:
    verify_token = _webhook_verify_token()
    if not verify_token:
        logger.warning("whatsapp_webhook_verify_rejected reason=verify_token_missing")
        raise HTTPException(status_code=403, detail="Webhook verification denied.")

    mode = request.query_params.get("hub.mode", "").strip()
    challenge = request.query_params.get("hub.challenge", "")
    provided_token = request.query_params.get("hub.verify_token", "").strip()
    if mode != "subscribe" or not hmac.compare_digest(provided_token, verify_token):
        logger.warning("whatsapp_webhook_verify_rejected reason=token_mismatch mode=%s", mode or "-")
        raise HTTPException(status_code=403, detail="Webhook verification denied.")

    logger.info("whatsapp_webhook_verified mode=%s", mode)
    return Response(content=challenge, media_type="text/plain")


@router.post("/whatsapp")
async def receive_whatsapp_webhook(request: Request) -> dict[str, Any]:
    raw_body = await request.body()
    signature_header = request.headers.get("X-Hub-Signature-256")

    if not _app_secret():
        logger.error("whatsapp_webhook_rejected reason=app_secret_missing")
        raise HTTPException(status_code=503, detail="Webhook secret not configured.")
    if not signature_header:
        logger.warning("whatsapp_webhook_rejected reason=signature_missing")
        raise HTTPException(status_code=401, detail="Invalid webhook signature.")
    if not _verify_signature(payload=raw_body, signature_header=signature_header):
        logger.warning("whatsapp_webhook_rejected reason=signature_invalid")
        raise HTTPException(status_code=401, detail="Invalid webhook signature.")

    try:
        payload = json.loads(raw_body.decode("utf-8"))
    except json.JSONDecodeError:
        logger.warning("whatsapp_webhook_rejected reason=malformed_json")
        raise HTTPException(status_code=400, detail="Malformed webhook payload.")

    if not isinstance(payload, dict):
        logger.info("whatsapp_webhook_ignored reason=non_object_payload")
        return {"status": "ignored", "processed": 0, "ignored": 1, "duplicates": 0, "stale": 0}

    try:
        result = await asyncio.to_thread(_process_webhook_payload, payload)
    except Exception:  # pylint: disable=broad-except
        logger.exception("whatsapp_webhook_processing_failed")
        return {"status": "ignored", "processed": 0, "ignored": 1, "duplicates": 0, "stale": 0}

    return {"status": "ok", **result}
