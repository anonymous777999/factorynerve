"""Operational alert orchestration and trigger entrypoints."""

from __future__ import annotations

from collections import defaultdict, deque
from dataclasses import dataclass
from datetime import date, datetime, time as dt_time, timedelta, timezone
import logging
import os
import secrets
import threading
import time
from typing import Any

from fastapi import Request

from backend.database import SessionLocal, hash_ip_address
from backend.models.ops_alert_daily_summary import OpsAlertDailySummary
from backend.models.ops_alert_event import OpsAlertEvent
from backend.models.organization import Organization
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
from backend.services.ops_alerts.rate_limit import build_org_rate_limiter, build_rate_limiter
from backend.services.ops_alerts.types import AlertCandidate, AlertEventType, AlertSeverity
from backend.utils import get_config


logger = logging.getLogger(__name__)

_service_lock = threading.Lock()
_service: "OpsAlertService | None" = None
AUTH_ALERT_PATHS = frozenset({"/auth/login", "/auth-secure/login"})
SEVERITY_ORDER = {
    AlertSeverity.LOW: 1,
    AlertSeverity.MEDIUM: 2,
    AlertSeverity.HIGH: 3,
    AlertSeverity.CRITICAL: 4,
}


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
    org_rate_limit_window_seconds: int
    org_rate_limit_normal_max: int
    org_rate_limit_critical_max: int
    escalation_window_seconds: int
    escalation_high_repeat_count: int
    escalation_critical_repeat_count: int
    daily_summary_hour_utc: int
    daily_summary_minute_utc: int


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
    return OpsAlertSettings(
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
        org_rate_limit_window_seconds=_to_int(os.getenv("ALERT_ORG_RATE_LIMIT_WINDOW_SECONDS"), 600),
        org_rate_limit_normal_max=_to_int(os.getenv("ALERT_ORG_RATE_LIMIT_NORMAL_MAX"), 20),
        org_rate_limit_critical_max=_to_int(os.getenv("ALERT_ORG_RATE_LIMIT_CRITICAL_MAX"), 50),
        escalation_window_seconds=_to_int(os.getenv("ALERT_ESCALATION_WINDOW_SECONDS"), 1800),
        escalation_high_repeat_count=_to_int(os.getenv("ALERT_ESCALATION_HIGH_REPEAT_COUNT"), 3),
        escalation_critical_repeat_count=_to_int(os.getenv("ALERT_ESCALATION_CRITICAL_REPEAT_COUNT"), 5),
        daily_summary_hour_utc=_to_int(os.getenv("ALERT_DAILY_SUMMARY_HOUR_UTC"), 18),
        daily_summary_minute_utc=_to_int(os.getenv("ALERT_DAILY_SUMMARY_MINUTE_UTC"), 0),
    )


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


def _request_org_id(request: Request | None) -> str | None:
    if request is None:
        return None
    org_id = getattr(request.state, "org_id", None)
    if org_id is None:
        return None
    cleaned = str(org_id).strip()
    return cleaned or None


def _request_org_name(request: Request | None) -> str | None:
    if request is None:
        return None
    org_name = getattr(request.state, "org_name", None)
    if org_name is None:
        return None
    cleaned = str(org_name).strip()
    return cleaned or None


class OpsAlertService:
    def __init__(self, settings: OpsAlertSettings, *, provider=None) -> None:
        self.settings = settings
        self._lock = threading.Lock()
        self._request_events: deque[tuple[float, int]] = deque()
        self._ocr_failures: deque[tuple[float, dict[str, Any]]] = deque()
        self._auth_failures: dict[str, deque[tuple[float, dict[str, Any]]]] = defaultdict(deque)
        self._group_events: dict[str, deque[float]] = defaultdict(deque)
        self._rate_limiter = build_rate_limiter()
        self._org_rate_limiter = build_org_rate_limiter()
        self._summary_stop = threading.Event()
        self._summary_thread: threading.Thread | None = None
        self._last_summary_date: date | None = None
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
        if self._summary_thread is None:
            self._summary_stop.clear()
            self._summary_thread = threading.Thread(
                target=self._summary_loop,
                name="ops-alert-summary",
                daemon=True,
            )
            self._summary_thread.start()

    def stop(self) -> None:
        self._summary_stop.set()
        if self._summary_thread is not None:
            self._summary_thread.join(timeout=2.0)
            self._summary_thread = None
        self._dispatcher.stop()

    def emit_alert_candidate(self, candidate: AlertCandidate) -> None:
        if not self.settings.enabled:
            _log_alert_suppressed(event_type=candidate.event_type.value, reason="disabled")
            return
        if not candidate.ref_id:
            candidate.ref_id = _generate_ref_id(candidate.event_type, candidate.timestamp)
        if candidate.org_id and not candidate.org_name:
            candidate.org_name = self._resolve_org_name(candidate.org_id)
        self._apply_escalation(candidate)
        if not self._org_limit_allows(candidate):
            self._dispatcher.record_suppressed(candidate, reason="org_rate_limited")
            return
        if not self._rate_limiter.acquire(candidate.dedup_key, candidate.cooldown_seconds):
            self._dispatcher.record_suppressed(candidate, reason="dedupe_cooldown")
            return
        if not self._dispatcher.enqueue(candidate):
            drop_reason = "dispatcher_stopped"
            if getattr(self._dispatcher, "_accepting", True):
                drop_reason = "queue_full"
            self._dispatcher.record_drop(candidate, reason=drop_reason)
            self._rate_limiter.release(candidate.dedup_key)

    def record_request_exception(self, request: Request, error: Exception, duration_ms: float) -> None:
        path = request.url.path
        org_id = _request_org_id(request)
        fingerprint = build_exception_fingerprint(path=path, error=error)
        message = (
            f"Unhandled {error.__class__.__name__} on {request.method} {path}. "
            f"Check recent deploys and logs before the failure spreads."
        )
        candidate = AlertCandidate(
            event_type=AlertEventType.SERVER_EXCEPTION,
            severity=AlertSeverity.CRITICAL,
            summary=message,
            dedup_key=f"t1:exception:{org_id or 'global'}:{path}:{fingerprint}",
            group_key=f"t1:exception-group:{org_id or 'global'}:{path}:{fingerprint}",
            cooldown_seconds=self.settings.default_cooldown_seconds,
            org_id=org_id,
            org_name=_request_org_name(request),
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
                    group_key="t1:5xx-spike-group",
                    cooldown_seconds=self.settings.default_cooldown_seconds,
                    meta={
                        "errors": spike["error_requests"],
                        "requests": spike["total_requests"],
                        "error_rate": f"{spike['error_percent']}%",
                        "window": f"{int(self.settings.t1_5xx_window_seconds / 60)}m",
                        "threshold": spike["threshold_count"],
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
                    group_key="t5:error-rate-group",
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
        org_id: str | None = None,
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
                dedup_key=f"t2:ocr-failure-spike:{org_id or 'global'}",
                group_key=f"t2:ocr-failure-spike-group:{org_id or 'global'}",
                cooldown_seconds=self.settings.default_cooldown_seconds,
                org_id=org_id,
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
        org_id: str | None = None,
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
                dedup_key=f"t3:payment:{org_id or 'global'}:{dedup_id}",
                group_key=f"t3:payment-group:{org_id or 'global'}:{dedup_id}",
                cooldown_seconds=30 * 60,
                org_id=org_id,
                meta={
                    "event": event_type,
                    "order_id": _mask_identifier(order_id or "-"),
                    "payment_id": _mask_identifier(payment_id or "-"),
                    "user_id": _mask_identifier(user_id or "-"),
                    "error": _stringify_error(error_message or "payment failed"),
                },
                storage_meta={
                    "event": event_type,
                    "org_id": org_id or "-",
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
        org_id: str | None = None,
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
                dedup_key=f"t3:webhook:{org_id or 'global'}:{kind}",
                group_key=f"t3:webhook-group:{org_id or 'global'}:{kind}",
                cooldown_seconds=self.settings.default_cooldown_seconds,
                org_id=org_id,
                meta={
                    "kind": kind,
                    "order_id": _mask_identifier(order_id or "-"),
                    "error": _stringify_error(error_message),
                },
                storage_meta={
                    "kind": kind,
                    "org_id": org_id or "-",
                    "order_id": order_id or "-",
                    "error": _stringify_error(error_message),
                },
            )
        )

    def record_auth_failure(self, request: Request, *, status_code: int, reason: str | None = None) -> None:
        if not self.settings.enabled:
            return
        org_id = _request_org_id(request)
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
                dedup_key=f"t4:auth:{org_id or 'global'}:{ip_hash}",
                group_key=f"t4:auth-group:{org_id or 'global'}:{ip_hash}",
                cooldown_seconds=15 * 60,
                org_id=org_id,
                org_name=_request_org_name(request),
                meta={
                    "attempts": attempt_count,
                    "window": f"{int(self.settings.t4_auth_window_seconds / 60)}m",
                    "threshold": self.settings.t4_auth_min_attempts,
                    "ip": raw_ip,
                    "endpoint": last_path or "-",
                    "status": status_code,
                },
                storage_meta={
                    "org_id": org_id or "-",
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

    def run_daily_summary_once(self, *, summary_date: date | None = None) -> int:
        target_date = summary_date or datetime.now(timezone.utc).date()
        start_dt = datetime.combine(target_date, dt_time.min, tzinfo=timezone.utc)
        end_dt = start_dt + timedelta(days=1)
        sent_count = 0
        with SessionLocal() as db:
            rows = (
                db.query(OpsAlertEvent)
                .filter(
                    OpsAlertEvent.created_at >= start_dt,
                    OpsAlertEvent.created_at < end_dt,
                    OpsAlertEvent.recipient_phone.is_(None),
                    OpsAlertEvent.is_summary.is_(False),
                    OpsAlertEvent.org_id.isnot(None),
                )
                .order_by(OpsAlertEvent.created_at.asc())
                .all()
            )
            grouped: dict[str, list[OpsAlertEvent]] = defaultdict(list)
            for row in rows:
                if row.org_id:
                    grouped[row.org_id].append(row)
            for org_id, org_rows in grouped.items():
                total_alerts = len(org_rows)
                if total_alerts <= 0:
                    continue
                critical_count = sum(1 for row in org_rows if row.severity == AlertSeverity.CRITICAL.value)
                high_count = sum(1 for row in org_rows if row.severity == AlertSeverity.HIGH.value)
                event_counts: dict[str, int] = {}
                for row in org_rows:
                    event_counts[row.event_type] = event_counts.get(row.event_type, 0) + 1
                top_event_type = max(event_counts.items(), key=lambda item: item[1])[0] if event_counts else None
                org_name = next((row.org_name for row in org_rows if row.org_name), None) or self._resolve_org_name(org_id)
                message_body = (
                    f"{total_alerts} alerts recorded for {target_date.isoformat()}. "
                    f"Critical: {critical_count}, high: {high_count}. "
                    f"Top event: {top_event_type or 'n/a'}."
                )
                existing = (
                    db.query(OpsAlertDailySummary)
                    .filter(
                        OpsAlertDailySummary.org_id == org_id,
                        OpsAlertDailySummary.summary_date == target_date,
                    )
                    .first()
                )
                if existing is None:
                    existing = OpsAlertDailySummary(
                        org_id=org_id,
                        org_name=org_name,
                        summary_date=target_date,
                        total_alerts=total_alerts,
                        critical_count=critical_count,
                        high_count=high_count,
                        top_event_type=top_event_type,
                        message_body=message_body,
                    )
                    db.add(existing)
                else:
                    existing.org_name = org_name
                    existing.total_alerts = total_alerts
                    existing.critical_count = critical_count
                    existing.high_count = high_count
                    existing.top_event_type = top_event_type
                    existing.message_body = message_body
                db.commit()
                severity = AlertSeverity.CRITICAL if critical_count > 0 else AlertSeverity.HIGH if high_count > 0 else AlertSeverity.MEDIUM
                self.emit_alert_candidate(
                    AlertCandidate(
                        event_type=AlertEventType.DAILY_SUMMARY,
                        severity=severity,
                        summary=message_body,
                        dedup_key=f"daily-summary:{org_id}:{target_date.isoformat()}",
                        group_key=f"daily-summary-group:{org_id}",
                        cooldown_seconds=24 * 60 * 60,
                        org_id=org_id,
                        org_name=org_name,
                        is_summary=True,
                        meta={
                            "summary_date": target_date.isoformat(),
                            "total_alerts": total_alerts,
                            "critical": critical_count,
                            "high": high_count,
                            "top_event_type": top_event_type or "-",
                        },
                    )
                )
                sent_count += 1
        return sent_count

    def _summary_loop(self) -> None:
        while not self._summary_stop.wait(30.0):
            try:
                self._run_daily_summary_if_due()
            except Exception:  # pylint: disable=broad-except
                logger.exception("Daily ops alert summary failed.")

    def _run_daily_summary_if_due(self, *, now: datetime | None = None) -> None:
        current = now or datetime.now(timezone.utc)
        if current.hour < self.settings.daily_summary_hour_utc:
            return
        if current.hour == self.settings.daily_summary_hour_utc and current.minute < self.settings.daily_summary_minute_utc:
            return
        run_date = current.date()
        with self._lock:
            if self._last_summary_date == run_date:
                return
            self._last_summary_date = run_date
        self.run_daily_summary_once(summary_date=run_date)

    def _apply_escalation(self, candidate: AlertCandidate) -> None:
        if not candidate.group_key:
            return
        now_ts = candidate.timestamp.timestamp()
        with self._lock:
            bucket = self._group_events[candidate.group_key]
            bucket.append(now_ts)
            cutoff = now_ts - max(1, self.settings.escalation_window_seconds)
            while bucket and bucket[0] < cutoff:
                bucket.popleft()
            repeat_count = len(bucket)
        candidate.escalation_level = repeat_count if repeat_count > 1 else 0
        if repeat_count >= self.settings.escalation_critical_repeat_count:
            self._raise_severity(candidate, AlertSeverity.CRITICAL)
        elif repeat_count >= self.settings.escalation_high_repeat_count:
            self._raise_severity(candidate, AlertSeverity.HIGH)

    def _raise_severity(self, candidate: AlertCandidate, severity: AlertSeverity) -> None:
        if SEVERITY_ORDER[severity] > SEVERITY_ORDER[candidate.severity]:
            candidate.severity = severity

    def _org_limit_allows(self, candidate: AlertCandidate) -> bool:
        org_key = candidate.org_id or "__global__"
        severity_bucket = "critical" if candidate.severity == AlertSeverity.CRITICAL else "normal"
        limit = (
            self.settings.org_rate_limit_critical_max
            if severity_bucket == "critical"
            else self.settings.org_rate_limit_normal_max
        )
        return self._org_rate_limiter.acquire(
            org_key,
            severity_bucket=severity_bucket,
            window_seconds=self.settings.org_rate_limit_window_seconds,
            limit=limit,
        )

    def _resolve_org_name(self, org_id: str | None) -> str | None:
        if not org_id:
            return None
        try:
            with SessionLocal() as db:
                org = db.query(Organization).filter(Organization.org_id == org_id).first()
                if org is None:
                    return None
                return str(org.name or "").strip() or None
        except Exception:  # pylint: disable=broad-except
            logger.exception("Failed to resolve organization name for alert org_id=%s.", org_id)
            return None


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


def record_ocr_failure(
    job_id: str,
    error: str | None,
    *,
    org_id: str | None = None,
    attempts: int | None = None,
    max_attempts: int | None = None,
) -> None:
    if _service is None:
        return
    _service.record_ocr_failure(job_id=job_id, error=error, org_id=org_id, attempts=attempts, max_attempts=max_attempts)


def record_payment_failure(
    *,
    event_type: str,
    order_id: str | None = None,
    payment_id: str | None = None,
    user_id: int | None = None,
    org_id: str | None = None,
    error_message: str | None = None,
) -> None:
    if _service is None:
        return
    _service.record_payment_failure(
        event_type=event_type,
        order_id=order_id,
        payment_id=payment_id,
        user_id=user_id,
        org_id=org_id,
        error_message=error_message,
    )


def record_payment_webhook_error(
    *,
    kind: str,
    error_message: str,
    org_id: str | None = None,
    order_id: str | None = None,
) -> None:
    if _service is None:
        return
    _service.record_payment_webhook_error(kind=kind, error_message=error_message, org_id=org_id, order_id=order_id)


def record_auth_failure(request: Request, *, status_code: int, reason: str | None = None) -> None:
    if _service is None:
        return
    _service.record_auth_failure(request, status_code=status_code, reason=reason)


def run_daily_summary_once(*, summary_date: date | None = None) -> int:
    if _service is None:
        return 0
    return _service.run_daily_summary_once(summary_date=summary_date)
