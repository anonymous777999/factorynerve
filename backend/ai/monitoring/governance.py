"""Lightweight centralized AI governance and operational controls."""

from __future__ import annotations

from collections import Counter, deque
from dataclasses import dataclass, field
import logging
import os
import threading
import time
from typing import Any


logger = logging.getLogger(__name__)

_HEALTH_WINDOW_SECONDS = max(60, int(os.getenv("AI_GOVERNANCE_WINDOW_SECONDS", "1800")))
_COOLDOWN_SECONDS = max(30, int(os.getenv("AI_GOVERNANCE_COOLDOWN_SECONDS", "180")))
_FAILURE_THRESHOLD = max(2, int(os.getenv("AI_GOVERNANCE_FAILURE_THRESHOLD", "4")))
_TIMEOUT_THRESHOLD = max(2, int(os.getenv("AI_GOVERNANCE_TIMEOUT_THRESHOLD", "3")))
_DEGRADED_THRESHOLD = max(2, int(os.getenv("AI_GOVERNANCE_DEGRADED_THRESHOLD", "4")))
_MAX_PROVIDER_CHAIN_ATTEMPTS = max(1, int(os.getenv("AI_GOVERNANCE_MAX_PROVIDER_CHAIN_ATTEMPTS", "3")))
_MAX_ROUTER_RETRIES = max(1, int(os.getenv("AI_GOVERNANCE_MAX_ROUTER_RETRIES", "3")))
_MAX_TYPED_RETRIES = max(0, int(os.getenv("AI_GOVERNANCE_MAX_TYPED_RETRIES", "3")))
_MAX_INTELLIGENCE_RETRIES = max(1, int(os.getenv("AI_GOVERNANCE_MAX_INTELLIGENCE_RETRIES", "2")))
_DEGRADED_LATENCY_MS = max(500, int(os.getenv("AI_GOVERNANCE_DEGRADED_LATENCY_MS", "12000")))
_EXPENSIVE_WORKFLOW_TOKENS = max(100, int(os.getenv("AI_GOVERNANCE_EXPENSIVE_WORKFLOW_TOKENS", "4000")))


@dataclass(slots=True)
class ProviderAttempt:
    recorded_at_unix: float
    success: bool
    timeout_hit: bool
    degraded: bool
    latency_ms: int


@dataclass(slots=True)
class ProviderState:
    provider: str
    total_attempts: int = 0
    successes: int = 0
    failures: int = 0
    timeouts: int = 0
    degraded_responses: int = 0
    fallback_frequency: int = 0
    retry_events: int = 0
    retry_amplification: int = 0
    total_latency_ms: int = 0
    open_until: float = 0.0
    suppress_reason: str | None = None
    last_event_at: float = 0.0
    suppressed_on_event_at: float = 0.0
    recent_attempts: deque[ProviderAttempt] = field(default_factory=lambda: deque(maxlen=200))


@dataclass(slots=True)
class WorkflowState:
    system: str
    requests: int = 0
    token_estimate: int = 0
    provider_usage: Counter[str] = field(default_factory=Counter)
    retry_events: int = 0
    retry_amplification: int = 0
    degraded_events: int = 0
    fallback_events: int = 0


_lock = threading.Lock()
_provider_states: dict[str, ProviderState] = {}
_workflow_states: dict[str, WorkflowState] = {}


def _state_for(provider: str) -> ProviderState:
    normalized = str(provider or "unknown").strip() or "unknown"
    state = _provider_states.get(normalized)
    if state is None:
        state = ProviderState(provider=normalized)
        _provider_states[normalized] = state
    return state


def _workflow_for(system: str) -> WorkflowState:
    normalized = str(system or "unknown").strip() or "unknown"
    state = _workflow_states.get(normalized)
    if state is None:
        state = WorkflowState(system=normalized)
        _workflow_states[normalized] = state
    return state


def _prune_recent(state: ProviderState, now: float) -> list[ProviderAttempt]:
    cutoff = now - _HEALTH_WINDOW_SECONDS
    recent = [attempt for attempt in state.recent_attempts if attempt.recorded_at_unix >= cutoff]
    while state.recent_attempts and state.recent_attempts[0].recorded_at_unix < cutoff:
        state.recent_attempts.popleft()
    return recent


def _compute_health_score(state: ProviderState, *, recent: list[ProviderAttempt]) -> float:
    if not recent:
        return 100.0
    total = max(1, len(recent))
    timeouts = sum(int(item.timeout_hit) for item in recent)
    failures = sum(int(not item.success) for item in recent)
    degraded = sum(int(item.degraded) for item in recent)
    avg_latency = sum(item.latency_ms for item in recent) / total
    score = 100.0
    score -= (timeouts / total) * 45.0
    score -= (failures / total) * 30.0
    score -= (degraded / total) * 15.0
    if avg_latency >= _DEGRADED_LATENCY_MS:
        score -= min(20.0, ((avg_latency - _DEGRADED_LATENCY_MS) / _DEGRADED_LATENCY_MS) * 20.0)
    if state.open_until and state.open_until > time.time():
        score = min(score, 20.0)
    return round(max(0.0, min(100.0, score)), 2)


def _apply_suppression_if_needed(state: ProviderState, *, recent: list[ProviderAttempt], now: float) -> None:
    if state.open_until > now:
        return
    if state.last_event_at <= state.suppressed_on_event_at:
        return
    total = max(1, len(recent))
    timeout_count = sum(int(item.timeout_hit) for item in recent)
    failure_count = sum(int(not item.success) for item in recent)
    degraded_count = sum(int(item.degraded) for item in recent)
    reason = None
    if timeout_count >= _TIMEOUT_THRESHOLD:
        reason = "timeout_storm"
    elif failure_count >= _FAILURE_THRESHOLD:
        reason = "provider_outage"
    elif degraded_count >= _DEGRADED_THRESHOLD and degraded_count / total >= 0.6:
        reason = "degraded_instability"
    if reason:
        state.open_until = now + _COOLDOWN_SECONDS
        state.suppress_reason = reason
        state.suppressed_on_event_at = state.last_event_at


def cap_retry_attempts(requested: int, *, mode: str) -> int:
    safe_requested = max(0, int(requested or 0))
    if mode == "typed":
        return min(safe_requested, _MAX_TYPED_RETRIES)
    if mode == "intelligence":
        return min(max(1, safe_requested), _MAX_INTELLIGENCE_RETRIES)
    return min(max(1, safe_requested), _MAX_ROUTER_RETRIES)


def allow_provider(provider: str, *, system: str | None = None) -> bool:
    del system
    try:
        now = time.time()
        with _lock:
            state = _state_for(provider)
            recent = _prune_recent(state, now)
            _apply_suppression_if_needed(state, recent=recent, now=now)
            if state.open_until and state.open_until <= now:
                state.open_until = 0.0
                state.suppress_reason = None
            return not state.open_until or state.open_until <= now
    except Exception:
        logger.exception("AI governance allow-provider check failed provider=%s", provider)
        return True


def governed_provider_chain(
    providers: list[str],
    *,
    system: str,
) -> tuple[list[str], list[str]]:
    allowed: list[str] = []
    suppressed: list[str] = []
    try:
        for provider in providers:
            if len(allowed) >= _MAX_PROVIDER_CHAIN_ATTEMPTS:
                suppressed.append(provider)
                continue
            if allow_provider(provider, system=system):
                allowed.append(provider)
            else:
                suppressed.append(provider)
        return allowed, suppressed
    except Exception:
        logger.exception("AI governance provider-chain check failed system=%s", system)
        return list(providers[:_MAX_PROVIDER_CHAIN_ATTEMPTS]), []


def record_provider_attempt(
    *,
    provider: str,
    system: str,
    success: bool,
    latency_ms: int = 0,
    timeout_hit: bool = False,
    degraded: bool = False,
) -> None:
    try:
        now = time.time()
        with _lock:
            state = _state_for(provider)
            state.total_attempts += 1
            state.successes += int(success)
            state.failures += int(not success)
            state.timeouts += int(timeout_hit)
            state.degraded_responses += int(degraded)
            state.total_latency_ms += max(0, int(latency_ms or 0))
            state.last_event_at = now
            state.recent_attempts.append(
                ProviderAttempt(
                    recorded_at_unix=now,
                    success=bool(success),
                    timeout_hit=bool(timeout_hit),
                    degraded=bool(degraded) or bool(timeout_hit) or not bool(success),
                    latency_ms=max(0, int(latency_ms or 0)),
                )
            )
            recent = _prune_recent(state, now)
            _apply_suppression_if_needed(state, recent=recent, now=now)
            _workflow_for(system)
    except Exception:
        logger.exception("AI governance attempt recording failed provider=%s system=%s", provider, system)


def record_workflow_event(
    *,
    system: str,
    provider: str,
    token_estimate: int,
    retry_count: int,
    fallback_used: bool,
    degraded_mode: bool,
    timeout_hit: bool,
    success: bool,
    latency_ms: int,
) -> None:
    try:
        with _lock:
            workflow = _workflow_for(system)
            workflow.requests += 1
            workflow.token_estimate += max(0, int(token_estimate or 0))
            workflow.provider_usage[str(provider or "unknown")] += 1
            workflow.retry_events += int(int(retry_count or 0) > 0)
            workflow.retry_amplification += max(0, int(retry_count or 0))
            workflow.degraded_events += int(degraded_mode)
            workflow.fallback_events += int(fallback_used)

            state = _state_for(provider)
            state.fallback_frequency += int(fallback_used)
            state.retry_events += int(int(retry_count or 0) > 0)
            state.retry_amplification += max(0, int(retry_count or 0))
            state.degraded_responses += int(degraded_mode)
            if latency_ms:
                state.total_latency_ms += max(0, int(latency_ms))
            if timeout_hit or not success:
                state.last_event_at = time.time()
    except Exception:
        logger.exception("AI governance workflow recording failed system=%s provider=%s", system, provider)


def governance_snapshot() -> dict[str, Any]:
    try:
        now = time.time()
        with _lock:
            provider_states = list(_provider_states.values())
            workflow_states = list(_workflow_states.values())
        provider_health: list[dict[str, Any]] = []
        suppressed_providers: list[dict[str, Any]] = []
        for state in provider_states:
            recent = [attempt for attempt in state.recent_attempts if attempt.recorded_at_unix >= now - _HEALTH_WINDOW_SECONDS]
            total_recent = max(1, len(recent))
            timeout_count = sum(int(item.timeout_hit) for item in recent)
            degraded_count = sum(int(item.degraded) for item in recent)
            avg_latency = round(sum(item.latency_ms for item in recent) / total_recent, 2) if recent else 0.0
            payload = {
                "provider": state.provider,
                "health_score": _compute_health_score(state, recent=recent),
                "suppressed": bool(state.open_until and state.open_until > now),
                "suppress_reason": state.suppress_reason,
                "suppressed_until": round(state.open_until, 3) if state.open_until and state.open_until > now else None,
                "recent_attempts": len(recent),
                "timeout_frequency": round((timeout_count / total_recent) * 100.0, 2) if recent else 0.0,
                "degraded_frequency": round((degraded_count / total_recent) * 100.0, 2) if recent else 0.0,
                "fallback_frequency": state.fallback_frequency,
                "retry_amplification": state.retry_amplification,
                "avg_latency_ms": avg_latency,
                "recent_instability": timeout_count + degraded_count + max(0, len(recent) - sum(int(item.success) for item in recent)),
            }
            provider_health.append(payload)
            if payload["suppressed"]:
                suppressed_providers.append(payload)

        workflow_costs: list[dict[str, Any]] = []
        expensive_workflows: list[dict[str, Any]] = []
        for state in workflow_states:
            avg_tokens = round(state.token_estimate / max(1, state.requests), 2)
            top_provider = state.provider_usage.most_common(1)[0][0] if state.provider_usage else None
            payload = {
                "system": state.system,
                "requests": state.requests,
                "total_token_estimate": state.token_estimate,
                "avg_token_estimate": avg_tokens,
                "provider_usage_frequency": dict(state.provider_usage),
                "retry_events": state.retry_events,
                "retry_amplification_cost": state.retry_amplification,
                "fallback_events": state.fallback_events,
                "degraded_events": state.degraded_events,
                "top_provider": top_provider,
            }
            workflow_costs.append(payload)
            if avg_tokens >= _EXPENSIVE_WORKFLOW_TOKENS or state.retry_amplification >= 3:
                expensive_workflows.append(payload)

        provider_health.sort(key=lambda item: (item["health_score"], -item["recent_attempts"], item["provider"]))
        workflow_costs.sort(key=lambda item: item["total_token_estimate"], reverse=True)
        expensive_workflows.sort(key=lambda item: (item["avg_token_estimate"], item["retry_amplification_cost"]), reverse=True)
        return {
            "rules": {
                "window_seconds": _HEALTH_WINDOW_SECONDS,
                "cooldown_seconds": _COOLDOWN_SECONDS,
                "failure_threshold": _FAILURE_THRESHOLD,
                "timeout_threshold": _TIMEOUT_THRESHOLD,
                "degraded_threshold": _DEGRADED_THRESHOLD,
                "max_provider_chain_attempts": _MAX_PROVIDER_CHAIN_ATTEMPTS,
                "max_router_retries": _MAX_ROUTER_RETRIES,
                "max_typed_retries": _MAX_TYPED_RETRIES,
                "max_intelligence_retries": _MAX_INTELLIGENCE_RETRIES,
                "degraded_latency_ms": _DEGRADED_LATENCY_MS,
                "expensive_workflow_tokens": _EXPENSIVE_WORKFLOW_TOKENS,
            },
            "providers": provider_health,
            "suppressed_providers": suppressed_providers,
            "workflow_costs": workflow_costs,
            "expensive_workflows": expensive_workflows[:10],
        }
    except Exception:
        logger.exception("AI governance snapshot failed.")
        return {
            "rules": {
                "window_seconds": _HEALTH_WINDOW_SECONDS,
                "cooldown_seconds": _COOLDOWN_SECONDS,
                "failure_threshold": _FAILURE_THRESHOLD,
                "timeout_threshold": _TIMEOUT_THRESHOLD,
                "degraded_threshold": _DEGRADED_THRESHOLD,
                "max_provider_chain_attempts": _MAX_PROVIDER_CHAIN_ATTEMPTS,
                "max_router_retries": _MAX_ROUTER_RETRIES,
                "max_typed_retries": _MAX_TYPED_RETRIES,
                "max_intelligence_retries": _MAX_INTELLIGENCE_RETRIES,
                "degraded_latency_ms": _DEGRADED_LATENCY_MS,
                "expensive_workflow_tokens": _EXPENSIVE_WORKFLOW_TOKENS,
            },
            "providers": [],
            "suppressed_providers": [],
            "workflow_costs": [],
            "expensive_workflows": [],
        }
