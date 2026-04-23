"""Operational alert orchestration and trigger entrypoints."""

from __future__ import annotations

from collections import defaultdict, deque
from dataclasses import dataclass
from datetime import datetime, timezone
import logging
import os
import secrets
import threading
import time
from typing import Any

from fastapi import Request

from backend.database import hash_ip_address
from backend.services.ops_alerts.detectors import (
    build_exception_fingerprint,
    count_recent_statuses,
    evaluate_5xx_spike,
    evaluate_abnormal_error_rate,
    evaluate_auth_anomaly,
    evaluate_ocr_failure_spike,
    trim_deque,
)
from backend.services.ops_alerts.dispatcher import AlertDispatcher
from backend.services.ops_alerts.providers import build_provider
from backend.services.ops_alerts.rate_limit import build_rate_limiter
from backend.services.ops_alerts.types import AlertCandidate, AlertEventType, AlertSeverity
from backend.utils import get_config


logger = logging.getLogger(__name__)

_service_lock = threading.Lock()
_service: "OpsAlertService | None" = None
AUTH_ALERT_PATHS = frozenset({"/auth/login", "/auth-secure/login"})


def _to_bool(value: str | None, default: bool = False) -> bool:
    if value is None:
        return default
    return value.strip().lower() in {"1", "true", "yes", "on"}


def _to_int(value: str | None, default: int) -> int:
    if value is None or not str(value).strip():
        return default
    return int(value)


def _to_float(value: str | None, default: float) -> float:
    if value is None or not str(value).strip():
        return default
    return float(value)


def _parse_csv(value: str | None, *, default: tuple[str, ...]) -> tuple[str, ...]:
    if value is None or not value.strip():
        return default
    parts = tuple(part.strip().lower() for part in value.split(",") if part.strip())
    return parts or default


def _mask_identifier(value: object, *, prefix: int = 3, suffix: int = 4) -> str:
    raw = str(value or "").strip()
    if not raw or raw == "-":
        return "-"
    if len(raw) <= prefix + suffix:
        return "*" * max(4, len(raw))
    return f"{raw[:prefix]}***{raw[-suffix:]}"


@dataclass(frozen=True)
class OpsAlertSettings:
    app_name: str
    app_env: str
    deployment_env: str
    allowed_deployment_envs: tuple[str, ...]
    alerts_requested: bool
    enabled: bool
    provider_name: str
    timezone_name: str
    dispatch_workers: int
    retry_attempts: int
    retry_backoff_seconds: float
    default_cooldown_seconds: int
    t1_5xx_window_seconds: int
    t1_5xx_min_count: int
    t1_5xx_min_percent: float
    t2_ocr_window_seconds: int
    t2_ocr_min_failures: int
    t4_auth_window_seconds: int
    t4_auth_min_attempts: int
    t5_error_window_seconds: int
    t5_min_requests: int
    t5_warn_percent: float
    t5_critical_percent: float


def build_alert_settings() -> OpsAlertSettings:
    config = get_config()
    app_name = (os.getenv("ALERT_APP_NAME") or os.getenv("APP_NAME") or config.app_name).strip() or config.app_name
    app_env = (os.getenv("APP_ENV") or config.app_env or "development").strip().lower()
    alerts_requested = _to_bool(os.getenv("ALERTS_ENABLED"), False)
    deployment_env = (
        os.getenv("DEPLOYMENT_ENV")
        or os.getenv("RENDER_ENV")
        or os.getenv("VERCEL_ENV")
        or app_env
    ).strip().lower()
    allowed_deployment_envs = _parse_csv(os.getenv("ALERT_ALLOWED_ENVS"), default=("production",))
    enabled = alerts_requested and app_env == "production" and deployment_env in allowed_deployment_envs
    provider_name = (os.getenv("ALERTS_PROVIDER") or "twilio").strip().lower()
    timezone_name = (os.getenv("ALERT_TIMEZONE") or "Asia/Kolkata").strip() or "Asia/Kolkata"
    settings = OpsAlertSettings(
        app_name=app_name,
        app_env=app_env,
        deployment_env=deployment_env,
        allowed_deployment_envs=allowed_deployment_envs,
        alerts_requested=alerts_requested,
        enabled=enabled,
        provider_name=provider_name,
        timezone_name=timezone_name,
        dispatch_workers=_to_int(os.getenv("ALERT_DISPATCH_WORKERS"), 2),
        retry_attempts=_to_int(os.getenv("ALERT_RETRY_ATTEMPTS"), 3),
        retry_backoff_seconds=_to_float(os.getenv("ALERT_RETRY_BACKOFF_SECONDS"), 1.5),
        default_cooldown_seconds=_to_int(os.getenv("ALERT_DEFAULT_COOLDOWN_SECONDS"), 600),
        t1_5xx_window_seconds=_to_int(os.getenv("ALERT_T1_5XX_WINDOW_SECONDS"), 300),
        t1_5xx_min_count=_to_int(os.getenv("ALERT_T1_5XX_MIN_COUNT"), 10),
        t1_5xx_min_percent=_to_float(os.getenv("ALERT_T1_5XX_MIN_PERCENT"), 5.0),
        t2_ocr_window_seconds=_to_int(os.getenv("ALERT_T2_OCR_WINDOW_SECONDS"), 300),
        t2_ocr_min_failures=_to_int(os.getenv("ALERT_T2_OCR_MIN_FAILURES"), 10),
        t4_auth_window_seconds=_to_int(os.getenv("ALERT_T4_AUTH_WINDOW_SECONDS"), 600),
        t4_auth_min_attempts=_to_int(os.getenv("ALERT_T4_AUTH_MIN_ATTEMPTS"), 8),
        t5_error_window_seconds=_to_int(os.getenv("ALERT_T5_ERROR_WINDOW_SECONDS"), 300),
        t5_min_requests=_to_int(os.getenv("ALERT_T5_MIN_REQUESTS"), 100),
        t5_warn_percent=_to_float(os.getenv("ALERT_T5_WARN_PERCENT"), 5.0),
        t5_critical_percent=_to_float(os.getenv("ALERT_T5_CRITICAL_PERCENT"), 15.0),
    )
    return settings


def _generate_ref_id(event_type: AlertEventType, timestamp: datetime) -> str:
    return f"{event_type.ref_prefix}-{int(timestamp.timestamp())}-{secrets.token_hex(2)[:3]}"


def _stringify_error(error: object) -> str:
    return str(error).strip() or error.__class__.__name__


def resolve_client_ip(request: Request | None) -> str | None:
    if request is None:
        return None
    trust_proxy = _to_bool(os.getenv("TRUST_PROXY"), False)
    if trust_proxy:
        forwarded_for = request.headers.get("x-forwarded-for", "")
        if forwarded_for.strip():
            return forwarded_for.split(",")[0].strip() or None
    if request.client:
        return request.client.host
    return None


def is_auth_alert_path(path: str) -> bool:
    normalized = (path or "").strip().lower()
    return normalized in AUTH_ALERT_PATHS


def _log_alert_suppressed(*, event_type: str, reason: str) -> None:
    logger.info(
        "alert_suppressed event_type=%s reason=%s",
        event_type,
        reason,
        extra={
            "event": "alert_suppressed",
            "alert_event_type": event_type,
            "alert_reason": reason,
        },
    )


class OpsAlertService:
    def __init__(self, settings: OpsAlertSettings, *, provider=None) -> None:
        self.settings = settings
        self._lock = threading.Lock()
        self._request_events: deque[tuple[float, int]] = deque()
        self._ocr_failures: deque[tuple[float, dict[str, Any]]] = deque()
        self._auth_failures: dict[str, deque[tuple[float, dict[str, Any]]]] = defaultdict(deque)
        self._rate_limiter = build_rate_limiter()
        resolved_provider = provider or build_provider(settings.provider_name)
        self._dispatcher = AlertDispatcher(
            provider=resolved_provider,
            app_name=settings.app_name,
            env_name=settings.app_env,
            timezone_name=settings.timezone_name,
            worker_count=settings.dispatch_workers,
            retry_attempts=settings.retry_attempts,
            retry_backoff_seconds=settings.retry_backoff_seconds,
        )

    def start(self) -> None:
        self._dispatcher.start()

    def stop(self) -> None:
        self._dispatcher.stop()

    def emit_alert_candidate(self, candidate: AlertCandidate) -> None:
        if not self.settings.enabled:
            _log_alert_suppressed(event_type=candidate.event_type.value, reason="disabled")
            return
        if not candidate.ref_id:
            candidate.ref_id = _generate_ref_id(candidate.event_type, candidate.timestamp)
        if not self._rate_limiter.acquire(candidate.dedup_key, candidate.cooldown_seconds):
            return
        if not self._dispatcher.enqueue(candidate):
            drop_reason = "dispatcher_stopped"
            if getattr(self._dispatcher, "_accepting", True):
                drop_reason = "queue_full"
            self._dispatcher.record_drop(candidate, reason=drop_reason)
            self._rate_limiter.release(candidate.dedup_key)

    def record_request_exception(self, request: Request, error: Exception, duration_ms: float) -> None:
        path = request.url.path
        fingerprint = build_exception_fingerprint(path=path, error=error)
        message = (
            f"Unhandled {error.__class__.__name__} on {request.method} {path}. "
            f"Check recent deploys and logs before the failure spreads."
        )
        candidate = AlertCandidate(
            event_type=AlertEventType.SERVER_EXCEPTION,
            severity=AlertSeverity.CRITICAL,
            summary=message,
            dedup_key=f"t1:exception:{path}:{fingerprint}",
            cooldown_seconds=self.settings.default_cooldown_seconds,
            meta={
                "path": path,
                "method": request.method,
                "error_class": error.__class__.__name__,
                "error": _stringify_error(error),
                "duration_ms": round(duration_ms, 2),
            },
        )
        self.emit_alert_candidate(candidate)
        self.record_request_outcome(request, 500, duration_ms)

    def record_request_outcome(self, request: Request, status_code: int, duration_ms: float) -> None:
        if not self.settings.enabled:
            return
        now_ts = time.time()
        path = request.url.path
        with self._lock:
            self._request_events.append((now_ts, int(status_code)))
            max_window = max(self.settings.t1_5xx_window_seconds, self.settings.t5_error_window_seconds)
            trim_deque(self._request_events, now_ts=now_ts, window_seconds=max_window)
            t1_total, t1_errors = count_recent_statuses(
                self._request_events,
                now_ts=now_ts,
                window_seconds=self.settings.t1_5xx_window_seconds,
            )
            t5_total, t5_errors = count_recent_statuses(
                self._request_events,
                now_ts=now_ts,
                window_seconds=self.settings.t5_error_window_seconds,
            )
        if is_auth_alert_path(path) and int(status_code) in {401, 403}:
            self.record_auth_failure(request, status_code=status_code)
        spike = evaluate_5xx_spike(
            total_requests=t1_total,
            error_requests=t1_errors,
            min_count=self.settings.t1_5xx_min_count,
            min_percent=self.settings.t1_5xx_min_percent,
        )
        if spike:
            self.emit_alert_candidate(
                AlertCandidate(
                    event_type=AlertEventType.SERVER_5XX_SPIKE,
                    severity=AlertSeverity.HIGH,
                    summary=(
                        f"{spike['error_requests']} server errors in the last "
                        f"{int(self.settings.t1_5xx_window_seconds / 60)} minutes exceeded the configured threshold."
                    ),
                    dedup_key="t1:5xx-spike",
                    cooldown_seconds=self.settings.default_cooldown_seconds,
                    meta={
                        "errors": spike["error_requests"],
                        "requests": spike["total_requests"],
                        "error_rate": f"{spike['error_percent']}%",
                        "window": f"{int(self.settings.t1_5xx_window_seconds / 60)}m",
                        "threshold": self.settings.t1_5xx_min_count,
                    },
                )
            )
        abnormal = evaluate_abnormal_error_rate(
            total_requests=t5_total,
            error_requests=t5_errors,
            min_requests=self.settings.t5_min_requests,
            warn_percent=self.settings.t5_warn_percent,
            critical_percent=self.settings.t5_critical_percent,
        )
        if abnormal:
            severity = AlertSeverity.CRITICAL if abnormal["severity"] == "critical" else AlertSeverity.HIGH
            self.emit_alert_candidate(
                AlertCandidate(
                    event_type=AlertEventType.ABNORMAL_ERROR_RATE,
                    severity=severity,
                    summary=(
                        f"Server error rate reached {abnormal['error_percent']}% across the last "
                        f"{int(self.settings.t5_error_window_seconds / 60)} minutes."
                    ),
                    dedup_key=f"t5:error-rate:{severity.value.lower()}",
                    cooldown_seconds=self.settings.default_cooldown_seconds,
                    meta={
                        "errors": abnormal["error_requests"],
                        "requests": abnormal["total_requests"],
                        "error_rate": f"{abnormal['error_percent']}%",
                        "window": f"{int(self.settings.t5_error_window_seconds / 60)}m",
                        "threshold": f"{abnormal['threshold_percent']}%",
                    },
                )
            )

    def record_ocr_failure(
        self,
        *,
        job_id: str,
        error: str | None,
        attempts: int | None = None,
        max_attempts: int | None = None,
    ) -> None:
        if not self.settings.enabled:
            return
        now_ts = time.time()
        failure = {
            "job_id": job_id,
            "error": _stringify_error(error or "unknown"),
            "attempts": attempts,
            "max_attempts": max_attempts,
        }
        with self._lock:
            self._ocr_failures.append((now_ts, failure))
            trim_deque(self._ocr_failures, now_ts=now_ts, window_seconds=self.settings.t2_ocr_window_seconds)
            current_failures = [item for _, item in self._ocr_failures]
        spike = evaluate_ocr_failure_spike(
            failures=current_failures,
            min_failures=self.settings.t2_ocr_min_failures,
        )
        if not spike:
            return
        self.emit_alert_candidate(
            AlertCandidate(
                event_type=AlertEventType.OCR_FAILURE_SPIKE,
                severity=AlertSeverity.HIGH,
                summary=(
                    f"{spike['failure_count']} OCR extraction failures in the last "
                    f"{int(self.settings.t2_ocr_window_seconds / 60)} minutes exceeded the threshold of "
                    f"{self.settings.t2_ocr_min_failures}."
                ),
                dedup_key="t2:ocr-failure-spike",
                cooldown_seconds=self.settings.default_cooldown_seconds,
                meta={
                    "failures": spike["failure_count"],
                    "window": f"{int(self.settings.t2_ocr_window_seconds / 60)}m",
                    "threshold": spike["threshold"],
                    "top_error": spike["top_error"],
                    "sample_job_id": spike["sample_job_id"] or job_id,
                },
            )
        )

    def record_payment_failure(
        self,
        *,
        event_type: str,
        order_id: str | None = None,
        payment_id: str | None = None,
        user_id: int | None = None,
        error_message: str | None = None,
    ) -> None:
        if not self.settings.enabled:
            return
        dedup_id = payment_id or order_id or "unknown"
        self.emit_alert_candidate(
            AlertCandidate(
                event_type=AlertEventType.PAYMENT_FAILURE,
                severity=AlertSeverity.HIGH,
                summary=(
                    f"Razorpay reported a payment failure for {_mask_identifier(payment_id or order_id or 'unknown')}."
                ),
                dedup_key=f"t3:payment:{dedup_id}",
                cooldown_seconds=30 * 60,
                meta={
                    "event": event_type,
                    "order_id": _mask_identifier(order_id or "-"),
                    "payment_id": _mask_identifier(payment_id or "-"),
                    "user_id": _mask_identifier(user_id or "-"),
                    "error": _stringify_error(error_message or "payment failed"),
                },
                storage_meta={
                    "event": event_type,
                    "order_id": order_id or "-",
                    "payment_id": payment_id or "-",
                    "user_id": user_id or "-",
                    "error": _stringify_error(error_message or "payment failed"),
                },
            )
        )

    def record_payment_webhook_error(
        self,
        *,
        kind: str,
        error_message: str,
        order_id: str | None = None,
    ) -> None:
        if not self.settings.enabled:
            return
        self.emit_alert_candidate(
            AlertCandidate(
                event_type=AlertEventType.PAYMENT_WEBHOOK_ERROR,
                severity=AlertSeverity.CRITICAL,
                summary=(
                    f"Payment webhook processing failed during {kind}. Investigate provider state and webhook delivery immediately."
                ),
                dedup_key=f"t3:webhook:{kind}",
                cooldown_seconds=self.settings.default_cooldown_seconds,
                meta={
                    "kind": kind,
                    "order_id": _mask_identifier(order_id or "-"),
                    "error": _stringify_error(error_message),
                },
                storage_meta={
                    "kind": kind,
                    "order_id": order_id or "-",
                    "error": _stringify_error(error_message),
                },
            )
        )

    def record_auth_failure(self, request: Request, *, status_code: int, reason: str | None = None) -> None:
        if not self.settings.enabled:
            return
        raw_ip = resolve_client_ip(request) or "unknown"
        ip_hash = hash_ip_address(raw_ip) or "unknown"
        now_ts = time.time()
        item = {
            "path": request.url.path,
            "status_code": int(status_code),
            "reason": reason or "",
        }
        with self._lock:
            bucket = self._auth_failures[ip_hash]
            bucket.append((now_ts, item))
            trim_deque(bucket, now_ts=now_ts, window_seconds=self.settings.t4_auth_window_seconds)
            attempt_count = len(bucket)
            last_path = bucket[-1][1].get("path") if bucket else request.url.path
        anomaly = evaluate_auth_anomaly(
            attempts=attempt_count,
            threshold=self.settings.t4_auth_min_attempts,
        )
        if not anomaly:
            return
        self.emit_alert_candidate(
            AlertCandidate(
                event_type=AlertEventType.AUTH_ANOMALY,
                severity=AlertSeverity.HIGH,
                summary=(
                    f"{attempt_count} unauthorized responses from the same IP in the last "
                    f"{int(self.settings.t4_auth_window_seconds / 60)} minutes exceeded the threshold of "
                    f"{self.settings.t4_auth_min_attempts}."
                ),
                dedup_key=f"t4:auth:{ip_hash}",
                cooldown_seconds=15 * 60,
                meta={
                    "attempts": attempt_count,
                    "window": f"{int(self.settings.t4_auth_window_seconds / 60)}m",
                    "threshold": self.settings.t4_auth_min_attempts,
                    "ip": raw_ip,
                    "endpoint": last_path or "-",
                    "status": status_code,
                },
                storage_meta={
                    "attempts": attempt_count,
                    "window": f"{int(self.settings.t4_auth_window_seconds / 60)}m",
                    "threshold": self.settings.t4_auth_min_attempts,
                    "ip_hash": ip_hash,
                    "endpoint": last_path or "-",
                    "status": status_code,
                    "reason": reason or "",
                },
            )
        )


def initialize_ops_alerting() -> None:
    global _service
    settings = build_alert_settings()
    with _service_lock:
        if _service is not None:
            return
        if settings.alerts_requested and not settings.enabled:
            logger.warning(
                "Ops alerting requested but suppressed app_env=%s deployment_env=%s allowed=%s.",
                settings.app_env,
                settings.deployment_env,
                ",".join(settings.allowed_deployment_envs),
                extra={
                    "event": "alerting_disabled",
                    "app_env": settings.app_env,
                    "deployment_env": settings.deployment_env,
                    "allowed_envs": ",".join(settings.allowed_deployment_envs),
                },
            )
        if not settings.enabled:
            logger.info("Ops alerting disabled for env=%s.", settings.app_env)
            return
        provider = build_provider(settings.provider_name)
        provider.validate_config()
        service = OpsAlertService(settings, provider=provider)
        service.start()
        _service = service
        logger.info("Ops alerting initialized provider=%s.", settings.provider_name)


def shutdown_ops_alerting() -> None:
    global _service
    with _service_lock:
        if _service is None:
            return
        _service.stop()
        _service = None


def is_ops_alerting_enabled() -> bool:
    return _service is not None and _service.settings.enabled


def emit_alert_candidate(candidate: AlertCandidate) -> None:
    if _service is None:
        _log_alert_suppressed(event_type=candidate.event_type.value, reason="service_uninitialized")
        return
    _service.emit_alert_candidate(candidate)


def send_alert(candidate: AlertCandidate) -> None:
    emit_alert_candidate(candidate)


def record_request_outcome(request: Request, status_code: int, duration_ms: float) -> None:
    if _service is None:
        return
    _service.record_request_outcome(request, status_code, duration_ms)


def record_request_exception(request: Request, error: Exception, duration_ms: float) -> None:
    if _service is None:
        return
    _service.record_request_exception(request, error, duration_ms)


def record_ocr_failure(job_id: str, error: str | None, *, attempts: int | None = None, max_attempts: int | None = None) -> None:
    if _service is None:
        return
    _service.record_ocr_failure(job_id=job_id, error=error, attempts=attempts, max_attempts=max_attempts)


def record_payment_failure(
    *,
    event_type: str,
    order_id: str | None = None,
    payment_id: str | None = None,
    user_id: int | None = None,
    error_message: str | None = None,
) -> None:
    if _service is None:
        return
    _service.record_payment_failure(
        event_type=event_type,
        order_id=order_id,
        payment_id=payment_id,
        user_id=user_id,
        error_message=error_message,
    )


def record_payment_webhook_error(*, kind: str, error_message: str, order_id: str | None = None) -> None:
    if _service is None:
        return
    _service.record_payment_webhook_error(kind=kind, error_message=error_message, order_id=order_id)


def record_auth_failure(request: Request, *, status_code: int, reason: str | None = None) -> None:
    if _service is None:
        return
    _service.record_auth_failure(request, status_code=status_code, reason=reason)
