"""Threshold detection utilities for operational alerts."""

from __future__ import annotations

from collections import Counter, deque
from collections.abc import Iterable
from datetime import datetime
import hashlib


def build_exception_fingerprint(*, path: str, error: Exception) -> str:
    payload = f"{path}|{error.__class__.__module__}|{error.__class__.__name__}"
    return hashlib.sha256(payload.encode("utf-8")).hexdigest()[:12]


def evaluate_5xx_spike(
    *,
    total_requests: int,
    error_requests: int,
    min_count: int,
    min_percent: float,
) -> dict | None:
    if total_requests <= 0 or error_requests < min_count:
        return None
    error_percent = (error_requests / total_requests) * 100.0
    if error_percent < min_percent:
        return None
    return {
        "total_requests": total_requests,
        "error_requests": error_requests,
        "error_percent": round(error_percent, 2),
        "threshold_count": min_count,
        "threshold_percent": min_percent,
    }


def evaluate_abnormal_error_rate(
    *,
    total_requests: int,
    error_requests: int,
    min_requests: int,
    warn_percent: float,
    critical_percent: float,
) -> dict | None:
    if total_requests < min_requests or total_requests <= 0:
        return None
    error_percent = (error_requests / total_requests) * 100.0
    if error_percent < warn_percent:
        return None
    severity = "critical" if error_percent >= critical_percent else "high"
    threshold = critical_percent if severity == "critical" else warn_percent
    return {
        "severity": severity,
        "total_requests": total_requests,
        "error_requests": error_requests,
        "error_percent": round(error_percent, 2),
        "threshold_percent": threshold,
    }


def evaluate_ocr_failure_spike(
    *,
    failures: Iterable[dict],
    min_failures: int,
) -> dict | None:
    failure_list = list(failures)
    failure_count = len(failure_list)
    if failure_count < min_failures:
        return None
    errors = Counter(str(item.get("error") or "unknown") for item in failure_list)
    top_error, top_error_count = errors.most_common(1)[0]
    sample_job_id = next((str(item.get("job_id")) for item in failure_list if item.get("job_id")), None)
    return {
        "failure_count": failure_count,
        "threshold": min_failures,
        "top_error": top_error,
        "top_error_count": top_error_count,
        "sample_job_id": sample_job_id,
    }


def evaluate_auth_anomaly(
    *,
    attempts: int,
    threshold: int,
) -> dict | None:
    if attempts < threshold:
        return None
    return {"attempts": attempts, "threshold": threshold}


def count_recent_statuses(
    events: deque[tuple[float, int]],
    *,
    now_ts: float,
    window_seconds: int,
) -> tuple[int, int]:
    total = 0
    errors = 0
    cutoff = now_ts - max(1, window_seconds)
    for timestamp, status_code in events:
        if timestamp < cutoff:
            continue
        total += 1
        if status_code >= 500:
            errors += 1
    return total, errors


def trim_deque(events: deque, *, now_ts: float, window_seconds: int) -> None:
    cutoff = now_ts - max(1, window_seconds)
    while events and events[0][0] < cutoff:
        events.popleft()


def isoformat_timestamp(value: datetime | None) -> str | None:
    if value is None:
        return None
    return value.isoformat(timespec="seconds")
