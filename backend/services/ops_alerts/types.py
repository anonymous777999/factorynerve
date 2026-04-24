"""Types shared across the ops alerting subsystem."""

from __future__ import annotations

from dataclasses import dataclass, field
from datetime import datetime, timezone
from enum import Enum
from typing import Any


class AlertSeverity(str, Enum):
    LOW = "LOW"
    MEDIUM = "MEDIUM"
    HIGH = "HIGH"
    CRITICAL = "CRITICAL"


class AlertEventType(str, Enum):
    SERVER_EXCEPTION = "server_exception"
    SERVER_5XX_SPIKE = "server_5xx_spike"
    OCR_FAILURE_SPIKE = "ocr_failure_spike"
    PAYMENT_FAILURE = "payment_failure"
    PAYMENT_WEBHOOK_ERROR = "payment_webhook_error"
    AUTH_ANOMALY = "auth_anomaly"
    ABNORMAL_ERROR_RATE = "abnormal_error_rate"
    DAILY_SUMMARY = "daily_summary"

    @property
    def label(self) -> str:
        labels = {
            AlertEventType.SERVER_EXCEPTION: "Server/API Failure",
            AlertEventType.SERVER_5XX_SPIKE: "5xx Spike",
            AlertEventType.OCR_FAILURE_SPIKE: "OCR Failure Spike",
            AlertEventType.PAYMENT_FAILURE: "Payment Failure",
            AlertEventType.PAYMENT_WEBHOOK_ERROR: "Payment Webhook Error",
            AlertEventType.AUTH_ANOMALY: "Unauthorized Access Pattern",
            AlertEventType.ABNORMAL_ERROR_RATE: "Abnormal Error Rate",
            AlertEventType.DAILY_SUMMARY: "Daily Alert Summary",
        }
        return labels[self]

    @property
    def ref_prefix(self) -> str:
        prefixes = {
            AlertEventType.SERVER_EXCEPTION: "srv",
            AlertEventType.SERVER_5XX_SPIKE: "5xx",
            AlertEventType.OCR_FAILURE_SPIKE: "ocr",
            AlertEventType.PAYMENT_FAILURE: "pay",
            AlertEventType.PAYMENT_WEBHOOK_ERROR: "payhook",
            AlertEventType.AUTH_ANOMALY: "auth",
            AlertEventType.ABNORMAL_ERROR_RATE: "errrate",
            AlertEventType.DAILY_SUMMARY: "daily",
        }
        return prefixes[self]


@dataclass(slots=True)
class AlertCandidate:
    event_type: AlertEventType
    severity: AlertSeverity
    summary: str
    dedup_key: str
    meta: dict[str, Any] = field(default_factory=dict)
    storage_meta: dict[str, Any] | None = None
    timestamp: datetime = field(default_factory=lambda: datetime.now(timezone.utc))
    cooldown_seconds: int = 600
    ref_id: str | None = None
    org_id: str | None = None
    org_name: str | None = None
    group_key: str | None = None
    is_summary: bool = False
    escalation_level: int = 0
    to_number: str | None = None


@dataclass(slots=True)
class AlertDispatchResult:
    success: bool
    provider: str
    retryable: bool = False
    error: str | None = None
    external_id: str | None = None
    status_code: int | None = None
