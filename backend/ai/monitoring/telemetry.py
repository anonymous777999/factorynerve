"""Centralized lightweight AI telemetry for operational observability."""

from __future__ import annotations

from collections import Counter, deque
from dataclasses import asdict, dataclass
from datetime import datetime, timezone
import logging
import os
import threading
import time
from typing import Any

from backend.utils import request_id_var


logger = logging.getLogger(__name__)

_MAX_EVENTS = max(100, int(os.getenv("AI_TELEMETRY_MAX_EVENTS", "1000")))
_HEALTH_WINDOW_SECONDS = max(60, int(os.getenv("AI_TELEMETRY_HEALTH_WINDOW_SECONDS", "3600")))


@dataclass(slots=True)
class AIRequestEvent:
    recorded_at: str
    recorded_at_unix: float
    request_id: str
    system: str
    operation: str
    provider: str
    model: str
    latency_ms: int
    token_estimate: int
    fallback_used: bool
    degraded_mode: bool
    retry_count: int
    timeout_hit: bool
    correction_applied: bool
    confidence_score: float | None
    hallucination_blocked: bool
    rules_engine_used: bool
    success: bool


_lock = threading.Lock()
_events: deque[AIRequestEvent] = deque(maxlen=_MAX_EVENTS)


def _safe_int(value: Any, default: int = 0) -> int:
    try:
        return int(value)
    except (TypeError, ValueError):
        return default


def _safe_float(value: Any, default: float | None = None) -> float | None:
    try:
        return float(value)
    except (TypeError, ValueError):
        return default


def current_request_id() -> str:
    request_id = str(request_id_var.get() or "").strip()
    return request_id or "-"


def is_timeout_error(error: BaseException | str | None) -> bool:
    if error is None:
        return False
    message = str(error).strip().lower()
    if not message:
        return False
    return "timed out" in message or "timeout" in message


def record_ai_event(
    *,
    system: str,
    operation: str,
    provider: str,
    model: str,
    latency_ms: int,
    token_estimate: int,
    fallback_used: bool,
    degraded_mode: bool,
    retry_count: int,
    timeout_hit: bool,
    correction_applied: bool,
    confidence_score: float | None,
    hallucination_blocked: bool,
    rules_engine_used: bool,
    success: bool,
    request_id: str | None = None,
) -> None:
    try:
        from backend.ai.monitoring.governance import record_workflow_event

        recorded_at_unix = time.time()
        normalized_confidence = _safe_float(confidence_score, None)
        event = AIRequestEvent(
            recorded_at=datetime.fromtimestamp(recorded_at_unix, timezone.utc).isoformat(),
            recorded_at_unix=recorded_at_unix,
            request_id=(request_id or current_request_id()).strip() or "-",
            system=str(system or "unknown"),
            operation=str(operation or "unknown"),
            provider=str(provider or "unknown"),
            model=str(model or "unknown"),
            latency_ms=max(0, _safe_int(latency_ms, 0)),
            token_estimate=max(0, _safe_int(token_estimate, 0)),
            fallback_used=bool(fallback_used),
            degraded_mode=bool(degraded_mode),
            retry_count=max(0, _safe_int(retry_count, 0)),
            timeout_hit=bool(timeout_hit),
            correction_applied=bool(correction_applied),
            confidence_score=(round(normalized_confidence, 4) if normalized_confidence is not None else None),
            hallucination_blocked=bool(hallucination_blocked),
            rules_engine_used=bool(rules_engine_used),
            success=bool(success),
        )
        with _lock:
            _events.append(event)
        record_workflow_event(
            system=event.system,
            provider=event.provider,
            token_estimate=event.token_estimate,
            retry_count=event.retry_count,
            fallback_used=event.fallback_used,
            degraded_mode=event.degraded_mode,
            timeout_hit=event.timeout_hit,
            success=event.success,
            latency_ms=event.latency_ms,
        )
        if logger.isEnabledFor(logging.INFO):
            logger.info(
                "ai_telemetry system=%s operation=%s provider=%s model=%s latency_ms=%s tokens=%s fallback_used=%s "
                "degraded_mode=%s retry_count=%s timeout_hit=%s correction_applied=%s confidence_score=%s "
                "hallucination_blocked=%s rules_engine_used=%s success=%s",
                event.system,
                event.operation,
                event.provider,
                event.model,
                event.latency_ms,
                event.token_estimate,
                event.fallback_used,
                event.degraded_mode,
                event.retry_count,
                event.timeout_hit,
                event.correction_applied,
                event.confidence_score,
                event.hallucination_blocked,
                event.rules_engine_used,
                event.success,
                extra={
                    "event": "ai_request",
                    "ai_system": event.system,
                    "ai_operation": event.operation,
                    "ai_provider": event.provider,
                    "ai_model": event.model,
                    "ai_latency_ms": event.latency_ms,
                    "ai_token_estimate": event.token_estimate,
                    "ai_fallback_used": event.fallback_used,
                    "ai_degraded_mode": event.degraded_mode,
                    "ai_retry_count": event.retry_count,
                    "ai_timeout_hit": event.timeout_hit,
                    "ai_correction_applied": event.correction_applied,
                    "ai_confidence_score": event.confidence_score,
                    "ai_hallucination_blocked": event.hallucination_blocked,
                    "ai_rules_engine_used": event.rules_engine_used,
                    "ai_success": event.success,
                },
            )
    except Exception:
        logger.exception("AI telemetry recording failed.")


def _event_dict(event: AIRequestEvent) -> dict[str, Any]:
    payload = asdict(event)
    payload.pop("recorded_at_unix", None)
    return payload


def _aggregate_events(events: list[AIRequestEvent]) -> dict[str, Any]:
    total = len(events)
    provider_map: dict[str, dict[str, Any]] = {}
    system_map: dict[str, dict[str, Any]] = {}
    for event in events:
        provider_bucket = provider_map.setdefault(
            event.provider,
            {
                "provider": event.provider,
                "requests": 0,
                "avg_latency_ms": 0.0,
                "avg_token_estimate": 0.0,
                "fallback_used": 0,
                "degraded_mode": 0,
                "timeout_hit": 0,
                "correction_applied": 0,
                "hallucination_blocked": 0,
                "rules_engine_used": 0,
                "successes": 0,
            },
        )
        provider_bucket["requests"] += 1
        provider_bucket["avg_latency_ms"] += event.latency_ms
        provider_bucket["avg_token_estimate"] += event.token_estimate
        provider_bucket["fallback_used"] += int(event.fallback_used)
        provider_bucket["degraded_mode"] += int(event.degraded_mode)
        provider_bucket["timeout_hit"] += int(event.timeout_hit)
        provider_bucket["correction_applied"] += int(event.correction_applied)
        provider_bucket["hallucination_blocked"] += int(event.hallucination_blocked)
        provider_bucket["rules_engine_used"] += int(event.rules_engine_used)
        provider_bucket["successes"] += int(event.success)

        system_bucket = system_map.setdefault(
            event.system,
            {
                "system": event.system,
                "requests": 0,
                "avg_latency_ms": 0.0,
                "avg_token_estimate": 0.0,
                "fallback_used": 0,
                "degraded_mode": 0,
                "timeout_hit": 0,
                "correction_applied": 0,
                "hallucination_blocked": 0,
                "rules_engine_used": 0,
                "successes": 0,
            },
        )
        system_bucket["requests"] += 1
        system_bucket["avg_latency_ms"] += event.latency_ms
        system_bucket["avg_token_estimate"] += event.token_estimate
        system_bucket["fallback_used"] += int(event.fallback_used)
        system_bucket["degraded_mode"] += int(event.degraded_mode)
        system_bucket["timeout_hit"] += int(event.timeout_hit)
        system_bucket["correction_applied"] += int(event.correction_applied)
        system_bucket["hallucination_blocked"] += int(event.hallucination_blocked)
        system_bucket["rules_engine_used"] += int(event.rules_engine_used)
        system_bucket["successes"] += int(event.success)

    for collection in (provider_map, system_map):
        for bucket in collection.values():
            requests = max(1, int(bucket["requests"]))
            bucket["avg_latency_ms"] = round(float(bucket["avg_latency_ms"]) / requests, 2)
            bucket["avg_token_estimate"] = round(float(bucket["avg_token_estimate"]) / requests, 2)
            bucket["success_rate"] = round((float(bucket["successes"]) / requests) * 100.0, 2)

    return {
        "total_requests": total,
        "provider_performance": sorted(provider_map.values(), key=lambda item: item["requests"], reverse=True),
        "system_breakdown": sorted(system_map.values(), key=lambda item: item["requests"], reverse=True),
    }


def snapshot_ai_telemetry(*, recent_limit: int = 50) -> dict[str, Any]:
    try:
        with _lock:
            events = list(_events)
        aggregate = _aggregate_events(events)
        recent_events = [_event_dict(event) for event in reversed(events[-max(1, recent_limit):])]
        return {
            **aggregate,
            "recent_events": recent_events,
            "systems_seen": sorted({event.system for event in events}),
            "providers_seen": sorted({event.provider for event in events}),
        }
    except Exception:
        logger.exception("AI telemetry snapshot failed.")
        return {
            "total_requests": 0,
            "provider_performance": [],
            "system_breakdown": [],
            "recent_events": [],
            "systems_seen": [],
            "providers_seen": [],
        }


def ai_health_snapshot() -> dict[str, Any]:
    try:
        from backend.ai.monitoring.governance import governance_snapshot

        with _lock:
            events = list(_events)
        cutoff = time.time() - _HEALTH_WINDOW_SECONDS
        windowed = [event for event in events if event.recorded_at_unix >= cutoff]
        aggregate = _aggregate_events(windowed)
        total = max(1, int(aggregate["total_requests"]))
        timeout_count = sum(int(event.timeout_hit) for event in windowed)
        fallback_count = sum(int(event.fallback_used) for event in windowed)
        degraded_count = sum(int(event.degraded_mode) for event in windowed)
        success_count = sum(int(event.success) for event in windowed)
        hallucination_blocks = sum(int(event.hallucination_blocked) for event in windowed)
        correction_count = sum(int(event.correction_applied) for event in windowed)
        provider_counter = Counter(event.provider for event in windowed)
        status = "healthy"
        if not windowed:
            status = "idle"
        elif timeout_count / total >= 0.2 or success_count / total < 0.8:
            status = "degraded"
        return {
            "status": status,
            "window_seconds": _HEALTH_WINDOW_SECONDS,
            "total_requests": len(windowed),
            "success_rate": round((success_count / total) * 100.0, 2) if windowed else 0.0,
            "timeout_rate": round((timeout_count / total) * 100.0, 2) if windowed else 0.0,
            "fallback_rate": round((fallback_count / total) * 100.0, 2) if windowed else 0.0,
            "degraded_rate": round((degraded_count / total) * 100.0, 2) if windowed else 0.0,
            "hallucination_blocks": hallucination_blocks,
            "correction_count": correction_count,
            "top_provider": provider_counter.most_common(1)[0][0] if provider_counter else None,
            "providers": aggregate["provider_performance"],
            "governance": governance_snapshot(),
        }
    except Exception:
        logger.exception("AI health snapshot failed.")
        return {
            "status": "degraded",
            "window_seconds": _HEALTH_WINDOW_SECONDS,
            "total_requests": 0,
            "success_rate": 0.0,
            "timeout_rate": 0.0,
            "fallback_rate": 0.0,
            "degraded_rate": 0.0,
            "hallucination_blocks": 0,
            "correction_count": 0,
            "top_provider": None,
            "providers": [],
            "governance": {"providers": [], "suppressed_providers": [], "workflow_costs": [], "expensive_workflows": []},
        }


def ai_dashboard_payload() -> dict[str, Any]:
    try:
        from backend.ai.monitoring.governance import governance_snapshot

        snapshot = snapshot_ai_telemetry(recent_limit=25)
        health = ai_health_snapshot()
        recent_degraded = [
            event for event in snapshot["recent_events"]
            if event.get("degraded_mode") or event.get("fallback_used") or event.get("timeout_hit")
        ][:10]
        return {
            "health": health,
            "summary": {
                "total_requests": snapshot["total_requests"],
                "systems_seen": snapshot["systems_seen"],
                "providers_seen": snapshot["providers_seen"],
            },
            "provider_performance": snapshot["provider_performance"],
            "system_breakdown": snapshot["system_breakdown"],
            "governance": governance_snapshot(),
            "recent_degraded_events": recent_degraded,
            "recent_events": snapshot["recent_events"],
        }
    except Exception:
        logger.exception("AI dashboard payload failed.")
        return {
            "health": ai_health_snapshot(),
            "summary": {"total_requests": 0, "systems_seen": [], "providers_seen": []},
            "provider_performance": [],
            "system_breakdown": [],
            "recent_degraded_events": [],
            "recent_events": [],
        }
