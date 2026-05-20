"""AI routing with provider fallback, retries, and circuit breaker."""

from __future__ import annotations

import json
import logging
import os
import re
import threading
import time
from concurrent.futures import ThreadPoolExecutor, TimeoutError as FutureTimeout
from dataclasses import dataclass
from decimal import Decimal, InvalidOperation
from functools import lru_cache
from pathlib import Path
from typing import Any, Callable

from backend.ai.monitoring.governance import allow_provider, cap_retry_attempts, governed_provider_chain, record_provider_attempt
from backend.ai.monitoring.telemetry import is_timeout_error, record_ai_event
from backend.ai.prompts.base import RenderedPrompt
from backend.ai.providers.base import ProviderConfig, RawAIResponse, TokenUsage
from backend.ai.providers.openai import OpenAIProvider
from backend.ai.validators.output_validator import AIOutputValidator
from backend.utils import get_config


logger = logging.getLogger(__name__)
APP_CONFIG = get_config()
_TEXT_VALIDATOR = AIOutputValidator()


def _env_float(key: str, default: float) -> float:
    raw = os.getenv(key)
    if raw is None:
        return default
    try:
        return float(raw)
    except ValueError:
        return default


def _env_int(key: str, default: int) -> int:
    raw = os.getenv(key)
    if raw is None:
        return default
    try:
        return int(raw)
    except ValueError:
        return default


AI_TIMEOUT_SECONDS = _env_float("AI_PROVIDER_TIMEOUT_SECONDS", 20.0)
AI_RETRY_ATTEMPTS = _env_int("AI_PROVIDER_RETRY_ATTEMPTS", 3)
AI_RETRY_BACKOFF = _env_float("AI_PROVIDER_RETRY_BACKOFF_SECONDS", 1.5)
AI_CB_THRESHOLD = _env_int("AI_CIRCUIT_BREAKER_THRESHOLD", 3)
AI_CB_COOLDOWN = _env_int("AI_CIRCUIT_BREAKER_COOLDOWN_SECONDS", 180)
AI_THREAD_WORKERS = _env_int("AI_THREAD_WORKERS", 4)

_EXECUTOR = ThreadPoolExecutor(max_workers=AI_THREAD_WORKERS)
_BREAKER_LOCK = threading.Lock()


def _normalize_provider(value: str | None) -> str:
    key = (value or "").strip().lower()
    if key in {"claude", "anthropic"}:
        return "anthropic"
    if key in {"gpt", "openai"}:
        return "openai"
    if key == "groq":
        return "groq"
    return ""


def _provider_chain() -> list[str]:
    chain_env = os.getenv("AI_PROVIDER_CHAIN")
    raw_candidates: list[str] = []
    if chain_env:
        raw_candidates.extend(item.strip() for item in chain_env.split(","))
    else:
        raw_candidates.append(os.getenv("AI_PROVIDER", "groq"))
    raw_candidates.extend(["groq", "anthropic", "openai"])

    providers: list[str] = []
    seen: set[str] = set()
    for item in raw_candidates:
        normalized = _normalize_provider(item)
        if normalized and normalized not in seen:
            providers.append(normalized)
            seen.add(normalized)
    return providers


def _call_with_timeout(fn: Callable[[], Any], timeout: float) -> Any:
    future = _EXECUTOR.submit(fn)
    try:
        return future.result(timeout=timeout)
    except FutureTimeout as error:
        raise TimeoutError("AI provider timed out.") from error


def _retry(fn: Callable[[], RawAIResponse], *, provider: str) -> tuple[RawAIResponse, int, bool]:
    last_error: Exception | None = None
    timeout_hit = False
    max_attempts = cap_retry_attempts(max(1, AI_RETRY_ATTEMPTS), mode="router")
    for attempt in range(1, max_attempts + 1):
        try:
            response = fn()
            record_provider_attempt(
                provider=provider,
                system="router_provider",
                success=True,
                latency_ms=int(response.latency_ms or 0),
                timeout_hit=is_timeout_error(response.error),
                degraded=False,
            )
            return response, max(0, attempt - 1), timeout_hit
        except Exception as error:  # pylint: disable=broad-except
            last_error = error
            timeout_hit = timeout_hit or is_timeout_error(error)
            record_provider_attempt(
                provider=provider,
                system="router_provider",
                success=False,
                latency_ms=0,
                timeout_hit=is_timeout_error(error),
                degraded=True,
            )
            logger.warning("AI provider failed (%s) attempt=%s error=%s", provider, attempt, error)
            if attempt < max_attempts:
                time.sleep(AI_RETRY_BACKOFF * attempt)
    if last_error:
        raise last_error
    raise RuntimeError(f"{provider} failed unexpectedly.")


@dataclass(slots=True)
class CircuitBreaker:
    failures: int = 0
    open_until: float = 0.0

    def allow(self) -> bool:
        return not (self.open_until and time.time() < self.open_until)

    def record_success(self) -> None:
        self.failures = 0
        self.open_until = 0.0

    def record_failure(self) -> None:
        self.failures += 1
        if self.failures >= AI_CB_THRESHOLD:
            self.open_until = time.time() + AI_CB_COOLDOWN
            self.failures = 0


@dataclass(slots=True)
class _GenerationResult:
    text: str
    ai_used: bool
    degraded_mode: bool
    provider: str
    model: str
    latency_ms: int
    token_estimate: int
    fallback_used: bool
    retry_count: int
    timeout_hit: bool
    rules_engine_used: bool


_breakers: dict[tuple[str, str], CircuitBreaker] = {}


def _breaker_for(provider: str, scope: str) -> CircuitBreaker:
    key = (provider, scope)
    with _BREAKER_LOCK:
        breaker = _breakers.get(key)
        if breaker is None:
            breaker = CircuitBreaker()
            _breakers[key] = breaker
        return breaker


def primary_provider_label() -> str:
    chain = _provider_chain()
    return "->".join(chain) if chain else "fallback"


def _has_key(provider: str) -> bool:
    if provider == "groq":
        return bool((APP_CONFIG.groq_api_key or "").strip())
    if provider == "anthropic":
        return bool((APP_CONFIG.anthropic_api_key or "").strip())
    if provider == "openai":
        return bool((APP_CONFIG.openai_api_key or "").strip())
    return False


def has_any_key() -> bool:
    return any(_has_key(provider) for provider in _provider_chain())


def _safe_text(text: str | None) -> str:
    return (text or "").strip()


def _estimate_tokens(text: str) -> int:
    return max(1, len(text) // 4) if text else 0


def _text_output_schema() -> dict[str, Any]:
    return {
        "type": "object",
        "properties": {"text": {"type": "string"}},
        "required": ["text"],
    }


def _validate_text_output(raw_text: str) -> str:
    try:
        from asyncio import run

        validated = run(
            _TEXT_VALIDATOR.validate(
                json.dumps({"text": _safe_text(raw_text)}),
                _text_output_schema(),
            )
        )
    except Exception as error:  # pylint: disable=broad-except
        logger.warning("AI text validation failed before schema check: %s", error)
        return ""
    if not validated.ok or not validated.parsed_output:
        logger.warning("AI text validation rejected response: %s", validated.validation_errors)
        return ""
    return _safe_text(validated.parsed_output.get("text"))


def _summary_fallback(data: dict[str, Any]) -> str:
    produced = data.get("units_produced", 0)
    target = data.get("units_target", 0)
    downtime = data.get("downtime_minutes", 0)
    shift = data.get("shift", "shift")
    date_label = data.get("date", "today")
    perf = (produced / target * 100) if target else 0
    issues = []
    if target and produced < 0.8 * target:
        issues.append("production below 80% of target")
    if downtime and int(downtime) > 60:
        issues.append("downtime above 60 minutes")
    issue_text = "Key issues: " + ", ".join(issues) + "." if issues else "No major issues reported."
    return (
        f"Summary for {date_label} ({shift} shift): Produced {produced} of {target} units "
        f"({perf:.1f}%). Downtime {downtime} minutes. {issue_text} "
        f"Focus on stabilizing throughput for the next shift."
    ).strip()


def _email_fallback(data: dict[str, Any]) -> str:
    lines = data.get("raw_lines") or []
    header = lines[0] if lines else "DPR Summary"
    bullets = "\n".join([f"- {line}" for line in lines[1:]]) if len(lines) > 1 else "- No metrics recorded."
    next_steps = "Please review blockers, confirm corrective actions, and share any support needed."
    return f"Hello Team,\n\n{header}\n{bullets}\n\n{next_steps}\n\nRegards,\nDPR.ai".strip()


PROMPTS_DIR = Path(__file__).resolve().parents[1] / "prompts"


@lru_cache(maxsize=8)
def _load_prompt(name: str, fallback: str) -> str:
    path = PROMPTS_DIR / name
    try:
        return path.read_text(encoding="utf-8").strip()
    except Exception:
        return fallback.strip()


def build_summary_prompt(data: dict[str, Any]) -> str:
    template = _load_prompt(
        "summary.txt",
        (
            "You are a factory operations analyst. Write a concise, clear shift summary in 3-5 sentences.\n"
            "Include production vs target, downtime, manpower, and quality issues if any.\n"
            "Use practical language for factory managers and mention next-shift focus.\n\n"
            "Data: {data}"
        ),
    )
    return template.format(data=data)


def build_email_prompt(summary: dict[str, Any]) -> str:
    raw_lines = summary.get("raw_lines") or []
    raw = "\n".join(raw_lines)
    template = _load_prompt(
        "email.txt",
        (
            "You are a professional operations assistant. Write a short email to management.\n"
            "Use a greeting, bullet list for key metrics, highlight top performer and most downtime,\n"
            "and include 1-2 action items. Keep it under 150 words, factory-specific tone.\n\n"
            "Raw summary data:\n{raw}"
        ),
    )
    return template.format(raw=raw)


def _provider_temperature() -> float:
    return 0.2


def _status_code_from_error(error: Exception) -> int | None:
    for attr in ("status_code", "code", "status"):
        value = getattr(error, attr, None)
        try:
            if value is not None:
                return int(value)
        except (TypeError, ValueError):
            continue
    return None


def _build_prompt(prompt: str) -> RenderedPrompt:
    return RenderedPrompt(
        name="legacy_ai_router_text",
        prompt_text=prompt,
        version="legacy",
        metadata={},
    )


def _build_provider_config(provider: str, *, max_tokens: int) -> ProviderConfig:
    if provider == "groq":
        model = os.getenv("GROQ_MODEL", "llama-3.1-8b-instant")
    elif provider == "anthropic":
        model = os.getenv("ANTHROPIC_MODEL", "claude-3-5-sonnet-20240620")
    else:
        model = os.getenv("OPENAI_MODEL", "gpt-4o-mini")
    return ProviderConfig(
        model=model,
        temperature=_provider_temperature(),
        max_tokens=max_tokens,
        timeout_seconds=AI_TIMEOUT_SECONDS,
    )


class _AnthropicCompatProvider:
    provider_name = "anthropic"

    async def complete(self, prompt: RenderedPrompt, config: ProviderConfig) -> RawAIResponse:
        started = time.perf_counter()
        try:
            import anthropic  # type: ignore

            api_key = (prompt.metadata or {}).get("api_key") or APP_CONFIG.anthropic_api_key
            if not api_key:
                raise RuntimeError("AI provider credential missing.")
            client = anthropic.Anthropic(api_key=api_key, timeout=config.timeout_seconds)
            response = client.messages.create(
                model=config.model,
                max_tokens=config.max_tokens,
                messages=[{"role": "user", "content": prompt.prompt_text}],
            )
            parts = getattr(response, "content", []) or []
            text_chunks = [getattr(item, "text", "") for item in parts if getattr(item, "text", "")]
            content = "\n".join(chunk.strip() for chunk in text_chunks if chunk).strip() or None
            usage = getattr(response, "usage", None)
            input_tokens = int(getattr(usage, "input_tokens", 0) or 0)
            output_tokens = int(getattr(usage, "output_tokens", 0) or 0)
            return RawAIResponse(
                content=content,
                usage=TokenUsage(
                    input_tokens=max(0, input_tokens),
                    output_tokens=max(0, output_tokens),
                    total_tokens=max(0, input_tokens + output_tokens),
                    estimated_cost_usd=0.0,
                ),
                provider=self.provider_name,
                model=config.model,
                latency_ms=int((time.perf_counter() - started) * 1000),
                metadata={"prompt_name": prompt.name},
            )
        except Exception as error:  # pylint: disable=broad-except
            return RawAIResponse(
                content=None,
                usage=TokenUsage(input_tokens=_estimate_tokens(prompt.prompt_text), total_tokens=_estimate_tokens(prompt.prompt_text)),
                provider=self.provider_name,
                model=config.model,
                latency_ms=int((time.perf_counter() - started) * 1000),
                error=str(error),
                status_code=_status_code_from_error(error),
                metadata={"prompt_name": prompt.name},
            )


class _GroqCompatProvider:
    provider_name = "groq"

    async def complete(self, prompt: RenderedPrompt, config: ProviderConfig) -> RawAIResponse:
        started = time.perf_counter()
        try:
            import groq  # type: ignore

            api_key = APP_CONFIG.groq_api_key
            if not api_key:
                raise RuntimeError("AI provider credential missing.")
            client = groq.Groq(api_key=api_key, timeout=config.timeout_seconds)
            response = client.chat.completions.create(
                model=config.model,
                messages=[{"role": "user", "content": prompt.prompt_text}],
                temperature=config.temperature,
                max_tokens=config.max_tokens,
            )
            content = _safe_text(response.choices[0].message.content) or None
            usage = getattr(response, "usage", None)
            prompt_tokens = int(getattr(usage, "prompt_tokens", 0) or 0)
            completion_tokens = int(getattr(usage, "completion_tokens", 0) or 0)
            total_tokens = int(getattr(usage, "total_tokens", 0) or 0) or (prompt_tokens + completion_tokens)
            return RawAIResponse(
                content=content,
                usage=TokenUsage(
                    input_tokens=max(0, prompt_tokens),
                    output_tokens=max(0, completion_tokens),
                    total_tokens=max(0, total_tokens),
                    estimated_cost_usd=0.0,
                ),
                provider=self.provider_name,
                model=config.model,
                latency_ms=int((time.perf_counter() - started) * 1000),
                metadata={"prompt_name": prompt.name},
            )
        except Exception as error:  # pylint: disable=broad-except
            return RawAIResponse(
                content=None,
                usage=TokenUsage(input_tokens=_estimate_tokens(prompt.prompt_text), total_tokens=_estimate_tokens(prompt.prompt_text)),
                provider=self.provider_name,
                model=config.model,
                latency_ms=int((time.perf_counter() - started) * 1000),
                error=str(error),
                status_code=_status_code_from_error(error),
                metadata={"prompt_name": prompt.name},
            )


_OPENAI_PROVIDER = OpenAIProvider()
_ANTHROPIC_PROVIDER = _AnthropicCompatProvider()
_GROQ_PROVIDER = _GroqCompatProvider()


def _provider_impl(provider: str) -> Any:
    if provider == "groq":
        return _GROQ_PROVIDER
    if provider == "anthropic":
        return _ANTHROPIC_PROVIDER
    if provider == "openai":
        return _OPENAI_PROVIDER
    raise RuntimeError(f"Unknown provider {provider}")


def _run_provider_response(provider: str, prompt: str, *, max_tokens: int) -> RawAIResponse:
    provider_impl = _provider_impl(provider)
    rendered_prompt = _build_prompt(prompt)
    provider_config = _build_provider_config(provider, max_tokens=max_tokens)

    def _invoke() -> RawAIResponse:
        from asyncio import run

        response = run(provider_impl.complete(rendered_prompt, provider_config))
        if response.content:
            return response
        raise RuntimeError(response.error or "AI provider returned no content.")

    return _call_with_timeout(_invoke, AI_TIMEOUT_SECONDS)


def _generate_text_result(
    prompt: str,
    *,
    fallback: str,
    scope: str | None,
    max_tokens: int,
    governance_system: str,
) -> _GenerationResult:
    scope_key = scope or "global"
    chain, suppressed = governed_provider_chain(_provider_chain(), system=governance_system)
    content = ""
    used_provider = "rules-engine"
    used_model = "rules-engine"
    latency_ms = 0
    token_estimate = _estimate_tokens(prompt) + _estimate_tokens(fallback)
    retry_count = 0
    timeout_hit = False
    degraded_mode = False
    fallback_used = False
    attempts_before_success = 0
    if suppressed:
        degraded_mode = True
        fallback_used = True

    for provider in chain:
        if not _has_key(provider):
            degraded_mode = True
            continue
        if not allow_provider(provider, system=governance_system):
            degraded_mode = True
            fallback_used = True
            attempts_before_success += 1
            continue
        breaker = _breaker_for(provider, scope_key)
        if not breaker.allow():
            degraded_mode = True
            fallback_used = True
            continue
        try:
            response, response_retry_count, response_timeout_hit = _retry(
                lambda: _run_provider_response(provider, prompt, max_tokens=max_tokens),
                provider=provider,
            )
            timeout_hit = timeout_hit or response_timeout_hit or is_timeout_error(response.error)
            validated = _validate_text_output(response.content or "")
            if validated:
                content = validated
                used_provider = response.provider or provider
                used_model = response.model or _build_provider_config(provider, max_tokens=max_tokens).model
                latency_ms = int(response.latency_ms or 0)
                token_estimate = int(response.usage.total_tokens or (_estimate_tokens(prompt) + _estimate_tokens(validated)))
                retry_count = max(retry_count, response.retry_count, response_retry_count)
                fallback_used = fallback_used or attempts_before_success > 0 or provider != chain[0]
                breaker.record_success()
                break
            record_provider_attempt(
                provider=provider,
                system=governance_system,
                success=False,
                latency_ms=int(response.latency_ms or 0),
                timeout_hit=is_timeout_error(response.error),
                degraded=True,
            )
            breaker.record_failure()
            degraded_mode = True
            fallback_used = True
        except Exception as error:  # pylint: disable=broad-except
            breaker.record_failure()
            record_provider_attempt(
                provider=provider,
                system=governance_system,
                success=False,
                latency_ms=0,
                timeout_hit=is_timeout_error(error),
                degraded=True,
            )
            timeout_hit = timeout_hit or is_timeout_error(error)
            degraded_mode = True
            fallback_used = True
            attempts_before_success += 1
            logger.warning("Provider %s failed: %s", provider, error)
            continue

    if content:
        return _GenerationResult(
            text=content,
            ai_used=True,
            degraded_mode=degraded_mode,
            provider=used_provider,
            model=used_model,
            latency_ms=latency_ms,
            token_estimate=token_estimate,
            fallback_used=fallback_used,
            retry_count=retry_count,
            timeout_hit=timeout_hit,
            rules_engine_used=False,
        )
    return _GenerationResult(
        text=_safe_text(fallback),
        ai_used=False,
        degraded_mode=True,
        provider="rules-engine",
        model="rules-engine",
        latency_ms=0,
        token_estimate=_estimate_tokens(prompt) + _estimate_tokens(fallback),
        fallback_used=True,
        retry_count=retry_count,
        timeout_hit=timeout_hit,
        rules_engine_used=True,
    )


_NUMBER_PATTERN = re.compile(r"(?<![A-Za-z])[-+]?\d+(?:\.\d+)?")


def _normalize_numeric_token(value: Any) -> str | None:
    if isinstance(value, bool) or value is None:
        return None
    try:
        normalized = Decimal(str(value).strip())
    except (InvalidOperation, ValueError, TypeError):
        return None
    normalized = normalized.normalize()
    rendered = format(normalized, "f")
    if "." in rendered:
        rendered = rendered.rstrip("0").rstrip(".")
    return rendered or "0"


def _collect_source_numbers(value: Any, sink: set[str]) -> None:
    normalized = _normalize_numeric_token(value)
    if normalized is not None:
        sink.add(normalized)
    if isinstance(value, dict):
        for item in value.values():
            _collect_source_numbers(item, sink)
        return
    if isinstance(value, list):
        for item in value:
            _collect_source_numbers(item, sink)
        return
    if isinstance(value, str):
        for match in _NUMBER_PATTERN.findall(value):
            normalized_match = _normalize_numeric_token(match)
            if normalized_match is not None:
                sink.add(normalized_match)


def _find_hallucinated_numbers(text: str, source_payload: dict[str, Any]) -> list[str]:
    source_numbers: set[str] = set()
    _collect_source_numbers(source_payload, source_numbers)
    unsupported: list[str] = []
    seen: set[str] = set()
    for match in _NUMBER_PATTERN.findall(text):
        normalized = _normalize_numeric_token(match)
        if normalized is None or normalized in source_numbers or normalized in seen:
            continue
        seen.add(normalized)
        unsupported.append(match)
    return unsupported


def _generic_summary_fallback(data: dict[str, Any]) -> str:
    shift = data.get("shift") or "scheduled"
    date_label = data.get("date") or "the reported"
    quality = "Quality issues were reported." if data.get("quality_issues") else "No quality issues were reported."
    return (
        f"Summary for {date_label} ({shift} shift): DPR data was recorded and reviewed. "
        f"{quality} Please refer to the source DPR fields for exact figures and follow-up actions."
    ).strip()


def _generic_email_fallback(summary: dict[str, Any]) -> str:
    header = "DPR update is available for review."
    if summary.get("date") or summary.get("shift"):
        date_label = summary.get("date") or "the reported"
        shift = summary.get("shift") or "scheduled"
        header = f"DPR update for {date_label} ({shift} shift) is available for review."
    return (
        "Hello Team,\n\n"
        f"{header}\n"
        "Please review the recorded DPR details in the system for exact metrics, issues, and next actions.\n\n"
        "Regards,\nDPR.ai"
    ).strip()


def generate_summary(
    data: dict[str, Any],
    *,
    scope: str | None = None,
    telemetry_system: str = "entry_summary",
) -> str:
    prompt = build_summary_prompt(data)
    result = _generate_text_result(
        prompt,
        fallback=_summary_fallback(data),
        scope=scope,
        max_tokens=220,
        governance_system=telemetry_system,
    )
    hallucination_blocked = False
    final_text = result.text
    if result.ai_used:
        hallucinated_numbers = _find_hallucinated_numbers(result.text, data)
        if hallucinated_numbers:
            hallucination_blocked = True
            logger.warning(
                "AI summary numeric validation failed scope=%s unsupported_numbers=%s",
                scope or "global",
                hallucinated_numbers,
            )
            final_text = _generic_summary_fallback(data)
            result = _GenerationResult(
                text=final_text,
                ai_used=False,
                degraded_mode=True,
                provider="rules-engine",
                model="rules-engine",
                latency_ms=result.latency_ms,
                token_estimate=result.token_estimate,
                fallback_used=True,
                retry_count=result.retry_count,
                timeout_hit=result.timeout_hit,
                rules_engine_used=True,
            )
    record_ai_event(
        system=telemetry_system,
        operation="generate_summary",
        provider=result.provider,
        model=result.model,
        latency_ms=result.latency_ms,
        token_estimate=result.token_estimate,
        fallback_used=result.fallback_used,
        degraded_mode=result.degraded_mode,
        retry_count=result.retry_count,
        timeout_hit=result.timeout_hit,
        correction_applied=False,
        confidence_score=None,
        hallucination_blocked=hallucination_blocked,
        rules_engine_used=result.rules_engine_used,
        success=bool(final_text),
    )
    return final_text


def generate_email(
    summary: dict[str, Any],
    *,
    scope: str | None = None,
    telemetry_system: str = "email_generation",
) -> str:
    prompt = build_email_prompt(summary)
    result = _generate_text_result(
        prompt,
        fallback=_email_fallback(summary),
        scope=scope,
        max_tokens=360,
        governance_system=telemetry_system,
    )
    hallucination_blocked = False
    final_text = result.text
    if result.ai_used:
        hallucinated_numbers = _find_hallucinated_numbers(result.text, summary)
        if hallucinated_numbers:
            hallucination_blocked = True
            logger.warning(
                "AI email numeric validation failed scope=%s unsupported_numbers=%s",
                scope or "global",
                hallucinated_numbers,
            )
            final_text = _generic_email_fallback(summary)
            result = _GenerationResult(
                text=final_text,
                ai_used=False,
                degraded_mode=True,
                provider="rules-engine",
                model="rules-engine",
                latency_ms=result.latency_ms,
                token_estimate=result.token_estimate,
                fallback_used=True,
                retry_count=result.retry_count,
                timeout_hit=result.timeout_hit,
                rules_engine_used=True,
            )
    record_ai_event(
        system=telemetry_system,
        operation="generate_email",
        provider=result.provider,
        model=result.model,
        latency_ms=result.latency_ms,
        token_estimate=result.token_estimate,
        fallback_used=result.fallback_used,
        degraded_mode=result.degraded_mode,
        retry_count=result.retry_count,
        timeout_hit=result.timeout_hit,
        correction_applied=False,
        confidence_score=None,
        hallucination_blocked=hallucination_blocked,
        rules_engine_used=result.rules_engine_used,
        success=bool(final_text),
    )
    return final_text


def generate_text(
    prompt: str,
    *,
    fallback: str,
    scope: str | None = None,
    max_tokens: int = 260,
    telemetry_system: str = "generic_text",
) -> tuple[str, bool, bool, str]:
    """Return (text, ai_used, degraded_mode, provider)."""
    result = _generate_text_result(
        prompt,
        fallback=fallback,
        scope=scope,
        max_tokens=max_tokens,
        governance_system=telemetry_system,
    )
    record_ai_event(
        system=telemetry_system,
        operation="generate_text",
        provider=result.provider,
        model=result.model,
        latency_ms=result.latency_ms,
        token_estimate=result.token_estimate,
        fallback_used=result.fallback_used,
        degraded_mode=result.degraded_mode,
        retry_count=result.retry_count,
        timeout_hit=result.timeout_hit,
        correction_applied=False,
        confidence_score=None,
        hallucination_blocked=False,
        rules_engine_used=result.rules_engine_used,
        success=bool(result.text),
    )
    return result.text, result.ai_used, result.degraded_mode, result.provider
