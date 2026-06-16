"""Single outbound WhatsApp sender for the backend."""

from __future__ import annotations

import asyncio
from concurrent.futures import Future
from dataclasses import dataclass
from datetime import datetime, timedelta, timezone
import logging
import os
import threading
import time
from typing import Any

import httpx

from backend.database import SessionLocal
from backend.models.ops_alert_event import OpsAlertEvent
from backend.phone_utils import mask_phone_number, normalize_phone_e164


logger = logging.getLogger(__name__)
_META_PROVIDER_NAME = "meta"
_RUNTIME_LOCK = threading.Lock()
_RUNTIME_READY = threading.Event()
_RUNTIME_LOOP: asyncio.AbstractEventLoop | None = None
_RUNTIME_THREAD: threading.Thread | None = None
_HTTP_CLIENT: httpx.AsyncClient | None = None
_DEDUP_LOCK = threading.Lock()
_DEDUP_CACHE: dict[tuple[str, str, str], float] = {}
_ALLOWED_MODES = {"disabled", "mock", "meta"}


@dataclass(frozen=True)
class SenderConfig:
    mode: str
    phone_number_id: str
    access_token: str
    api_version: str
    timeout_seconds: float
    daily_send_cap: int
    dedup_window_seconds: int
    default_language: str


@dataclass(slots=True)
class MessageResult:
    provider_message_id: str | None
    status: str
    provider_response: dict[str, Any]
    error_message: str | None
    attempt_count: int = 1


def _env_float(name: str, default: float) -> float:
    raw = os.getenv(name)
    if raw is None or not raw.strip():
        return default
    try:
        return float(raw)
    except ValueError:
        return default


def _env_int(name: str, default: int) -> int:
    raw = os.getenv(name)
    if raw is None or not raw.strip():
        return default
    try:
        return int(raw)
    except ValueError:
        return default


def _normalize_mode(value: str | None) -> str:
    mode = str(value or "").strip().lower()
    if mode in _ALLOWED_MODES:
        return mode
    return "disabled"


def sender_provider_name() -> str:
    mode = _normalize_mode(os.getenv("WHATSAPP_PROVIDER_MODE"))
    if mode == "meta":
        return _META_PROVIDER_NAME
    return mode


def _load_config() -> tuple[SenderConfig, list[str]]:
    mode = _normalize_mode(os.getenv("WHATSAPP_PROVIDER_MODE"))
    api_version = (os.getenv("META_WA_API_VERSION") or "v19.0").strip() or "v19.0"
    config = SenderConfig(
        mode=mode,
        phone_number_id=(os.getenv("META_WA_PHONE_NUMBER_ID") or "").strip(),
        access_token=(os.getenv("META_WA_ACCESS_TOKEN") or "").strip(),
        api_version=api_version,
        timeout_seconds=max(1.0, _env_float("WHATSAPP_TIMEOUT_SECONDS", 10.0)),
        daily_send_cap=max(1, _env_int("WA_DAILY_SEND_CAP", 500)),
        dedup_window_seconds=max(1, _env_int("WA_DEDUP_WINDOW_SECONDS", 300)),
        default_language=(os.getenv("META_WA_TEMPLATE_LANGUAGE") or "en_US").strip() or "en_US",
    )
    missing: list[str] = []
    if config.mode == "meta":
        if not config.phone_number_id:
            missing.append("META_WA_PHONE_NUMBER_ID")
        if not config.access_token:
            missing.append("META_WA_ACCESS_TOKEN")
        if not config.api_version:
            missing.append("META_WA_API_VERSION")
    return config, missing


def _normalize_recipient_phone(phone_number: str) -> tuple[str, str]:
    normalized_e164 = normalize_phone_e164(str(phone_number or "").replace("whatsapp:", ""))
    recipient_digits = normalized_e164.lstrip("+")
    if not recipient_digits.isdigit():
        raise ValueError("Phone number must be a valid E.164 number.")
    return normalized_e164, recipient_digits


def _coerce_body_variables(template_params: dict[str, Any]) -> list[str]:
    raw_values = template_params.get("body_variables", template_params.get("body"))
    if raw_values is None:
        return []
    if isinstance(raw_values, dict):
        iterable = list(raw_values.values())
    elif isinstance(raw_values, (list, tuple)):
        iterable = list(raw_values)
    else:
        iterable = [raw_values]
    return [str(value if value is not None else "").strip() for value in iterable]


def _coerce_authentication_code(template_params: dict[str, Any]) -> str:
    return str(template_params.get("code") or "").strip()


def _is_authentication_template(template_params: dict[str, Any]) -> bool:
    return bool(template_params.get("auth_template"))


def _dedup_disabled(template_params: dict[str, Any]) -> bool:
    return bool(template_params.get("disable_dedup"))


def _build_template_payload(
    *,
    to_digits: str,
    template_name: str,
    template_params: dict[str, Any],
    default_language: str,
) -> dict[str, Any]:
    normalized_template_name = str(template_name or "").strip()
    if not normalized_template_name:
        raise ValueError("template_name is required.")
    language = str(template_params.get("language") or default_language).strip() or default_language
    is_auth_template = _is_authentication_template(template_params)
    payload: dict[str, Any] = {
        "messaging_product": "whatsapp",
        "to": to_digits,
        "type": "template",
        "template": {
            "name": normalized_template_name,
            "language": {"code": language},
        },
    }

    if is_auth_template:
        code = _coerce_authentication_code(template_params)
        if not code:
            raise ValueError("Authentication template code is required.")
        payload["template"]["components"] = [
            {
                "type": "body",
                "parameters": [
                    {"type": "text", "text": code},
                ],
            },
            {
                "type": "button",
                "sub_type": "url",
                "index": "0",
                "parameters": [
                    {"type": "text", "text": code},
                ],
            },
        ]
        return payload

    body_variables = _coerce_body_variables(template_params)
    if body_variables:
        payload["template"]["components"] = [
            {
                "type": "body",
                "parameters": [
                    {"type": "text", "text": value}
                    for value in body_variables
                ],
            }
        ]
    return payload


def _extract_provider_message_id(payload: dict[str, Any]) -> str | None:
    messages = payload.get("messages")
    if isinstance(messages, list) and messages:
        first_message = messages[0]
        if isinstance(first_message, dict) and first_message.get("id"):
            return str(first_message["id"])
    if payload.get("message_id"):
        return str(payload["message_id"])
    return None


def _extract_meta_error_message(*, response: httpx.Response | None, payload: dict[str, Any]) -> str:
    error = payload.get("error")
    if isinstance(error, dict):
        message = str(error.get("message") or "").strip()
        error_type = str(error.get("type") or "").strip()
        error_code = error.get("code")
        if message and error_type and error_code is not None:
            return f"{error_type} ({error_code}): {message}"[:500]
        if message:
            return message[:500]
    if response is not None:
        return (response.text.strip() or f"Meta returned HTTP {response.status_code}")[:500]
    return "WhatsApp provider request failed."


def _org_key(org_id: str | int | None) -> str:
    cleaned = str(org_id or "").strip()
    return cleaned or "__global__"


def _dedup_cache_key(org_id: str | int | None, recipient_phone: str, template_name: str) -> tuple[str, str, str]:
    return (
        _org_key(org_id),
        recipient_phone,
        str(template_name or "").strip().lower(),
    )


def _prune_dedup_cache(now_monotonic: float, window_seconds: int) -> None:
    cutoff = now_monotonic - max(1, window_seconds)
    expired_keys = [key for key, sent_at in _DEDUP_CACHE.items() if sent_at < cutoff]
    for key in expired_keys:
        _DEDUP_CACHE.pop(key, None)


def _recent_duplicate_exists(*, org_id: str | int | None, recipient_phone: str, template_name: str, window_seconds: int) -> bool:
    cache_key = _dedup_cache_key(org_id, recipient_phone, template_name)
    now_monotonic = time.monotonic()
    with _DEDUP_LOCK:
        _prune_dedup_cache(now_monotonic, window_seconds)
        sent_at = _DEDUP_CACHE.get(cache_key)
        return sent_at is not None and (now_monotonic - sent_at) < max(1, window_seconds)


def _remember_successful_send(*, org_id: str | int | None, recipient_phone: str, template_name: str) -> None:
    cache_key = _dedup_cache_key(org_id, recipient_phone, template_name)
    with _DEDUP_LOCK:
        _DEDUP_CACHE[cache_key] = time.monotonic()


def _count_recent_dispatched_sync(*, org_id: str | int | None, lookback_hours: int = 24) -> int:
    cutoff = datetime.now(timezone.utc) - timedelta(hours=lookback_hours)
    with SessionLocal() as db:
        query = db.query(OpsAlertEvent).filter(
            OpsAlertEvent.recipient_phone.isnot(None),
            OpsAlertEvent.delivery_status.in_(("dispatching", "dispatched", "delivered", "read")),
            OpsAlertEvent.created_at >= cutoff,
        )
        org_key = _org_key(org_id)
        if org_key == "__global__":
            query = query.filter(OpsAlertEvent.org_id.is_(None))
        else:
            query = query.filter(OpsAlertEvent.org_id == org_key)
        return int(query.count())


async def _daily_cap_exceeded(*, org_id: str | int | None, daily_send_cap: int) -> bool:
    if daily_send_cap <= 0:
        return False
    sent_count = await asyncio.to_thread(
        _count_recent_dispatched_sync,
        org_id=org_id,
    )
    return sent_count >= daily_send_cap


async def _ensure_http_client() -> httpx.AsyncClient:
    global _HTTP_CLIENT
    if _HTTP_CLIENT is None:
        timeout_seconds = max(1.0, _env_float("WHATSAPP_TIMEOUT_SECONDS", 10.0))
        _HTTP_CLIENT = httpx.AsyncClient(
            timeout=httpx.Timeout(timeout_seconds),
            limits=httpx.Limits(max_connections=20, max_keepalive_connections=20),
        )
    return _HTTP_CLIENT


async def _close_http_client() -> None:
    global _HTTP_CLIENT
    if _HTTP_CLIENT is not None:
        await _HTTP_CLIENT.aclose()
        _HTTP_CLIENT = None


def _sender_loop() -> None:
    global _RUNTIME_LOOP
    loop = asyncio.new_event_loop()
    asyncio.set_event_loop(loop)
    _RUNTIME_LOOP = loop
    _RUNTIME_READY.set()
    try:
        loop.run_forever()
    finally:
        loop.run_until_complete(_close_http_client())
        loop.close()
        _RUNTIME_LOOP = None


def initialize_whatsapp_sender() -> None:
    global _RUNTIME_THREAD
    with _RUNTIME_LOCK:
        if _RUNTIME_THREAD is not None and _RUNTIME_THREAD.is_alive():
            return
        _RUNTIME_READY.clear()
        _RUNTIME_THREAD = threading.Thread(
            target=_sender_loop,
            name="whatsapp-sender-loop",
            daemon=True,
        )
        _RUNTIME_THREAD.start()
    _RUNTIME_READY.wait(timeout=5.0)


def shutdown_whatsapp_sender() -> None:
    global _RUNTIME_THREAD
    with _RUNTIME_LOCK:
        loop = _RUNTIME_LOOP
        thread = _RUNTIME_THREAD
        _RUNTIME_THREAD = None
        _RUNTIME_READY.clear()
    if loop is None or thread is None:
        return
    try:
        asyncio.run_coroutine_threadsafe(_close_http_client(), loop).result(timeout=5.0)
    finally:
        loop.call_soon_threadsafe(loop.stop)
        thread.join(timeout=5.0)


def _submit_to_runtime(coro: Any) -> Future:
    initialize_whatsapp_sender()
    loop = _RUNTIME_LOOP
    if loop is None:
        raise RuntimeError("WhatsApp sender runtime is unavailable.")
    return asyncio.run_coroutine_threadsafe(coro, loop)


def _meta_messages_url(config: SenderConfig) -> str:
    return f"https://graph.facebook.com/{config.api_version}/{config.phone_number_id}/messages"


def _success_result(
    *,
    provider_mode: str,
    template_name: str,
    org_id: str | int | None,
    masked_phone: str,
    provider_response: dict[str, Any],
    provider_message_id: str | None,
    attempt_count: int,
) -> MessageResult:
    logger.info(
        "whatsapp_send_completed org_id=%s to=%s template=%s mode=%s status=sent attempt=%s reason=-",
        org_id,
        masked_phone,
        template_name,
        provider_mode,
        attempt_count,
    )
    return MessageResult(
        provider_message_id=provider_message_id,
        status="sent",
        provider_response=provider_response,
        error_message=None,
        attempt_count=attempt_count,
    )


def _refused_result(
    *,
    provider_mode: str,
    template_name: str,
    org_id: str | int | None,
    masked_phone: str,
    status: str,
    reason: str,
    provider_response: dict[str, Any],
) -> MessageResult:
    logger.info(
        "whatsapp_send_completed org_id=%s to=%s template=%s mode=%s status=%s attempt=0 reason=%s",
        org_id,
        masked_phone,
        template_name,
        provider_mode,
        status,
        reason,
    )
    return MessageResult(
        provider_message_id=None,
        status=status,
        provider_response=provider_response,
        error_message=reason,
        attempt_count=0,
    )


def _failed_result(
    *,
    provider_mode: str,
    template_name: str,
    org_id: str | int | None,
    masked_phone: str,
    reason: str,
    provider_response: dict[str, Any],
    attempt_count: int,
) -> MessageResult:
    logger.warning(
        "whatsapp_send_completed org_id=%s to=%s template=%s mode=%s status=failed attempt=%s reason=%s",
        org_id,
        masked_phone,
        template_name,
        provider_mode,
        attempt_count,
        reason,
    )
    return MessageResult(
        provider_message_id=None,
        status="failed",
        provider_response=provider_response,
        error_message=reason,
        attempt_count=attempt_count,
    )


async def _perform_send(
    *,
    to: str,
    template_name: str,
    template_params: dict[str, Any],
    org_id: str | int | None,
) -> MessageResult:
    config, missing = _load_config()
    provider_mode = config.mode

    try:
        normalized_phone, recipient_digits = _normalize_recipient_phone(to)
    except ValueError as error:
        return _failed_result(
            provider_mode=provider_mode,
            template_name=template_name,
            org_id=org_id,
            masked_phone=mask_phone_number(to),
            reason=str(error),
            provider_response={"provider": sender_provider_name(), "reason": "invalid_phone"},
            attempt_count=0,
        )

    masked_phone = mask_phone_number(normalized_phone)

    try:
        payload = _build_template_payload(
            to_digits=recipient_digits,
            template_name=template_name,
            template_params=template_params or {},
            default_language=config.default_language,
        )
    except ValueError as error:
        return _failed_result(
            provider_mode=provider_mode,
            template_name=template_name,
            org_id=org_id,
            masked_phone=masked_phone,
            reason=str(error),
            provider_response={"provider": sender_provider_name(), "reason": "template_invalid"},
            attempt_count=0,
        )

    if provider_mode == "disabled":
        return _refused_result(
            provider_mode=provider_mode,
            template_name=template_name,
            org_id=org_id,
            masked_phone=masked_phone,
            status="disabled",
            reason="WhatsApp sender is disabled.",
            provider_response={"provider": "disabled", "mode": "disabled"},
        )

    if missing:
        return _failed_result(
            provider_mode=provider_mode,
            template_name=template_name,
            org_id=org_id,
            masked_phone=masked_phone,
            reason="Missing WhatsApp configuration: " + ", ".join(missing),
            provider_response={"provider": sender_provider_name(), "reason": "config_missing", "missing": missing},
            attempt_count=0,
        )

    if not _dedup_disabled(template_params):
        if _recent_duplicate_exists(
            org_id=org_id,
            recipient_phone=normalized_phone,
            template_name=template_name,
            window_seconds=config.dedup_window_seconds,
        ):
            return _refused_result(
                provider_mode=provider_mode,
                template_name=template_name,
                org_id=org_id,
                masked_phone=masked_phone,
                status="suppressed",
                reason="Duplicate send suppressed inside dedup window.",
                provider_response={"provider": sender_provider_name(), "reason": "duplicate_suppressed"},
            )

    if await _daily_cap_exceeded(org_id=org_id, daily_send_cap=config.daily_send_cap):
        return _refused_result(
            provider_mode=provider_mode,
            template_name=template_name,
            org_id=org_id,
            masked_phone=masked_phone,
            status="suppressed",
            reason="Daily WhatsApp send cap reached.",
            provider_response={"provider": sender_provider_name(), "reason": "daily_cap_exceeded"},
        )

    if provider_mode == "mock":
        provider_message_id = f"mock-{int(time.time() * 1000)}"
        provider_response = {
            "provider": "mock",
            "mode": "mock",
            "message_id": provider_message_id,
            "status": "accepted",
            "template": template_name,
        }
        _remember_successful_send(org_id=org_id, recipient_phone=normalized_phone, template_name=template_name)
        return _success_result(
            provider_mode=provider_mode,
            template_name=template_name,
            org_id=org_id,
            masked_phone=masked_phone,
            provider_response=provider_response,
            provider_message_id=provider_message_id,
            attempt_count=1,
        )

    client = await _ensure_http_client()
    headers = {
        "Authorization": f"Bearer {config.access_token}",
        "Content-Type": "application/json",
    }
    url = _meta_messages_url(config)

    attempt_count = 0
    while attempt_count < 2:
        attempt_count += 1
        try:
            response = await client.post(url, headers=headers, json=payload)
        except httpx.TimeoutException as error:
            return _failed_result(
                provider_mode=provider_mode,
                template_name=template_name,
                org_id=org_id,
                masked_phone=masked_phone,
                reason=f"Request timed out: {error}",
                provider_response={"provider": _META_PROVIDER_NAME, "reason": "timeout"},
                attempt_count=attempt_count,
            )
        except httpx.HTTPError as error:
            return _failed_result(
                provider_mode=provider_mode,
                template_name=template_name,
                org_id=org_id,
                masked_phone=masked_phone,
                reason=f"HTTP transport error: {error}",
                provider_response={"provider": _META_PROVIDER_NAME, "reason": "http_error"},
                attempt_count=attempt_count,
            )

        try:
            response_payload = response.json()
            provider_response = response_payload if isinstance(response_payload, dict) else {"payload": response_payload}
        except Exception:  # pylint: disable=broad-except
            provider_response = {"text": response.text}
        provider_response["provider"] = _META_PROVIDER_NAME
        provider_response["http_status"] = response.status_code

        if response.is_success:
            provider_message_id = _extract_provider_message_id(provider_response)
            _remember_successful_send(org_id=org_id, recipient_phone=normalized_phone, template_name=template_name)
            return _success_result(
                provider_mode=provider_mode,
                template_name=template_name,
                org_id=org_id,
                masked_phone=masked_phone,
                provider_response=provider_response,
                provider_message_id=provider_message_id,
                attempt_count=attempt_count,
            )

        error_message = _extract_meta_error_message(response=response, payload=provider_response)
        if response.status_code >= 500 and attempt_count == 1:
            logger.warning(
                "whatsapp_send_retry org_id=%s to=%s template=%s mode=%s status=retry attempt=%s reason=%s",
                org_id,
                masked_phone,
                template_name,
                provider_mode,
                attempt_count,
                error_message,
            )
            continue
        return _failed_result(
            provider_mode=provider_mode,
            template_name=template_name,
            org_id=org_id,
            masked_phone=masked_phone,
            reason=error_message,
            provider_response=provider_response,
            attempt_count=attempt_count,
        )

    return _failed_result(
        provider_mode=provider_mode,
        template_name=template_name,
        org_id=org_id,
        masked_phone=masked_phone,
        reason="Unexpected sender failure.",
        provider_response={"provider": _META_PROVIDER_NAME, "reason": "unknown"},
        attempt_count=attempt_count,
    )


async def send_message(
    to: str,
    template_name: str,
    template_params: dict[str, Any],
    org_id: str | int | None,
) -> MessageResult:
    try:
        future = _submit_to_runtime(
            _perform_send(
                to=to,
                template_name=template_name,
                template_params=template_params,
                org_id=org_id,
            )
        )
        return await asyncio.wrap_future(future)
    except Exception as error:  # pylint: disable=broad-except
        logger.exception(
            "whatsapp_send_runtime_failure org_id=%s to=%s template=%s mode=%s",
            org_id,
            mask_phone_number(to),
            template_name,
            sender_provider_name(),
        )
        return MessageResult(
            provider_message_id=None,
            status="failed",
            provider_response={"provider": sender_provider_name(), "reason": "runtime_failure"},
            error_message=str(error).strip() or "Sender runtime failure.",
            attempt_count=0,
        )


def send_message_blocking(
    *,
    to: str,
    template_name: str,
    template_params: dict[str, Any],
    org_id: str | int | None,
    timeout_seconds: float | None = None,
) -> MessageResult:
    future = _submit_to_runtime(
        _perform_send(
            to=to,
            template_name=template_name,
            template_params=template_params,
            org_id=org_id,
        )
    )
    wait_timeout = timeout_seconds or max(5.0, _env_float("WHATSAPP_TIMEOUT_SECONDS", 10.0) + 2.0)
    return future.result(timeout=wait_timeout)
