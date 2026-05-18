"""Structured billing event logger."""

from __future__ import annotations

import json
import re
import sys
import time
from datetime import datetime, timezone
from typing import Any


_SENSITIVE_KEYS = {"card", "cvv", "upi", "upi_id", "vpa", "pan", "phone", "phone_number", "recipient_phone"}
_PAYMENT_ID_KEYS = {
    "payment_id",
    "provider_payment_id",
    "razorpay_payment_id",
    "provider_message_id",
    "event_id",
    "razorpay_event_id",
}
_PHONE_RE = re.compile(r"\+?\d[\d -]{5,}\d")


def _mask_phone(value: str) -> str:
    digits = "".join(char for char in value if char.isdigit())
    if len(digits) <= 4:
        return "***"
    return f"***{digits[-2:]}"


def _mask_payment_id(value: Any) -> str | Any:
    if value is None:
        return None
    text = str(value)
    return text[:8]


def _sanitize_value(key: str, value: Any) -> Any:
    lowered = key.lower()
    if lowered in _PAYMENT_ID_KEYS:
        return _mask_payment_id(value)
    if lowered in _SENSITIVE_KEYS:
        if value is None:
            return None
        if "phone" in lowered:
            return _mask_phone(str(value))
        return "[REDACTED]"
    if isinstance(value, dict):
        return {str(child_key): _sanitize_value(str(child_key), child_value) for child_key, child_value in value.items()}
    if isinstance(value, (list, tuple, set)):
        return [_sanitize_value(key, child_value) for child_value in value]
    if isinstance(value, str):
        return _PHONE_RE.sub(lambda match: _mask_phone(match.group(0)), value)
    return value


def log_billing_event(
    event_type: str,
    org_id: str | None,
    outcome: str,
    *,
    duration_ms: int | float = 0,
    **kwargs: Any,
) -> None:
    payload = {
        "event_type": event_type,
        "org_id": org_id,
        "outcome": outcome,
        "timestamp_utc": datetime.now(timezone.utc).isoformat(),
        "duration_ms": round(float(duration_ms), 2),
    }
    payload.update({str(key): _sanitize_value(str(key), value) for key, value in kwargs.items()})
    print(json.dumps(payload, separators=(",", ":"), sort_keys=True), file=sys.stdout, flush=True)


def duration_ms_since(started_at: float) -> float:
    return (time.perf_counter() - started_at) * 1000.0
