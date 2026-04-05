"""Lightweight in-memory metrics store for observability."""

from __future__ import annotations

import threading
import time
from collections import defaultdict
from dataclasses import dataclass


@dataclass
class _Metrics:
    total_requests: int = 0
    total_duration_ms: float = 0.0
    total_exceptions: int = 0
    total_frontend_errors: int = 0
    started_at: float = time.time()


_lock = threading.Lock()
_metrics = _Metrics()
_status_counts: dict[int, int] = defaultdict(int)
_path_counts: dict[str, int] = defaultdict(int)
_method_counts: dict[str, int] = defaultdict(int)


def record_request(path: str, status: int, duration_ms: float, method: str = "GET") -> None:
    with _lock:
        _metrics.total_requests += 1
        _metrics.total_duration_ms += float(duration_ms)
        _status_counts[int(status)] += 1
        _path_counts[str(path)] += 1
        _method_counts[str(method).upper()] += 1


def record_exception() -> None:
    with _lock:
        _metrics.total_exceptions += 1


def record_frontend_error() -> None:
    with _lock:
        _metrics.total_frontend_errors += 1


def snapshot(limit_paths: int = 20) -> dict:
    with _lock:
        total = _metrics.total_requests
        avg_ms = (_metrics.total_duration_ms / total) if total else 0.0
        top_paths = sorted(_path_counts.items(), key=lambda item: item[1], reverse=True)[:limit_paths]
        return {
            "total_requests": total,
            "avg_response_ms": round(avg_ms, 2),
            "uptime_seconds": round(max(0.0, time.time() - _metrics.started_at), 2),
            "total_exceptions": _metrics.total_exceptions,
            "total_frontend_errors": _metrics.total_frontend_errors,
            "status_counts": dict(_status_counts),
            "method_counts": dict(_method_counts),
            "top_paths": [{"path": path, "count": count} for path, count in top_paths],
        }
