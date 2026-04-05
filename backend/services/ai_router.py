"""AI routing with provider fallback, retries, and circuit breaker."""

from __future__ import annotations

import logging
import os
import time
from functools import lru_cache
from pathlib import Path
from concurrent.futures import ThreadPoolExecutor, TimeoutError as FutureTimeout
from dataclasses import dataclass
from typing import Any, Callable


logger = logging.getLogger(__name__)


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


def _call_with_timeout(fn: Callable[[], str], timeout: float) -> str:
    future = _EXECUTOR.submit(fn)
    try:
        return future.result(timeout=timeout)
    except FutureTimeout as error:
        raise TimeoutError("AI provider timed out.") from error


def _retry(fn: Callable[[], str], *, provider: str) -> str:
    last_error: Exception | None = None
    for attempt in range(1, max(1, AI_RETRY_ATTEMPTS) + 1):
        try:
            return fn()
        except Exception as error:  # pylint: disable=broad-except
            last_error = error
            logger.warning("AI provider failed (%s) attempt=%s error=%s", provider, attempt, error)
            if attempt < AI_RETRY_ATTEMPTS:
                time.sleep(AI_RETRY_BACKOFF * attempt)
    if last_error:
        raise last_error
    raise RuntimeError(f"{provider} failed unexpectedly.")


@dataclass
class CircuitBreaker:
    failures: int = 0
    open_until: float = 0.0

    def allow(self) -> bool:
        if self.open_until and time.time() < self.open_until:
            return False
        return True

    def record_success(self) -> None:
        self.failures = 0
        self.open_until = 0.0

    def record_failure(self) -> None:
        self.failures += 1
        if self.failures >= AI_CB_THRESHOLD:
            self.open_until = time.time() + AI_CB_COOLDOWN
            self.failures = 0


_breakers: dict[tuple[str, str], CircuitBreaker] = {}


def _breaker_for(provider: str, scope: str) -> CircuitBreaker:
    key = (provider, scope)
    breaker = _breakers.get(key)
    if not breaker:
        breaker = CircuitBreaker()
        _breakers[key] = breaker
    return breaker


def primary_provider_label() -> str:
    chain = _provider_chain()
    return "->".join(chain) if chain else "fallback"


def _has_key(provider: str) -> bool:
    if provider == "groq":
        return bool((os.getenv("GROQ_API_KEY") or "").strip())
    if provider == "anthropic":
        return bool((os.getenv("ANTHROPIC_API_KEY") or "").strip())
    if provider == "openai":
        return bool((os.getenv("OPENAI_API_KEY") or "").strip())
    return False


def has_any_key() -> bool:
    return any(_has_key(provider) for provider in _provider_chain())


def _call_groq(prompt: str, *, max_tokens: int) -> str:
    try:
        import groq  # type: ignore
    except Exception as error:
        raise RuntimeError("Groq SDK not installed.") from error
    api_key = os.getenv("GROQ_API_KEY")
    if not api_key:
        raise RuntimeError("GROQ_API_KEY missing.")
    client = groq.Groq(api_key=api_key)
    resp = client.chat.completions.create(
        model=os.getenv("GROQ_MODEL", "llama-3.1-8b-instant"),
        messages=[{"role": "user", "content": prompt}],
        temperature=0.2,
        max_tokens=max_tokens,
    )
    return resp.choices[0].message.content.strip()


def _call_anthropic(prompt: str, *, max_tokens: int) -> str:
    try:
        import anthropic  # type: ignore
    except Exception as error:
        raise RuntimeError("Anthropic SDK not installed.") from error
    api_key = os.getenv("ANTHROPIC_API_KEY")
    if not api_key:
        raise RuntimeError("ANTHROPIC_API_KEY missing.")
    client = anthropic.Anthropic(api_key=api_key)
    resp = client.messages.create(
        model=os.getenv("ANTHROPIC_MODEL", "claude-3-5-sonnet-20240620"),
        max_tokens=max_tokens,
        messages=[{"role": "user", "content": prompt}],
    )
    return resp.content[0].text.strip()


def _call_openai(prompt: str, *, max_tokens: int) -> str:
    try:
        from openai import OpenAI  # type: ignore
    except Exception as error:
        raise RuntimeError("OpenAI SDK not installed.") from error
    api_key = os.getenv("OPENAI_API_KEY")
    if not api_key:
        raise RuntimeError("OPENAI_API_KEY missing.")
    client = OpenAI(api_key=api_key, timeout=AI_TIMEOUT_SECONDS)
    resp = client.chat.completions.create(
        model=os.getenv("OPENAI_MODEL", "gpt-4o-mini"),
        messages=[{"role": "user", "content": prompt}],
        temperature=0.2,
        max_tokens=max_tokens,
    )
    return resp.choices[0].message.content.strip()


def _safe_text(text: str | None) -> str:
    return (text or "").strip()


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
    return (
        f"Hello Team,\n\n{header}\n{bullets}\n\n{next_steps}\n\nRegards,\nDPR.ai"
    ).strip()


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


def _run_provider(provider: str, prompt: str, *, max_tokens: int) -> str:
    if provider == "groq":
        return _call_with_timeout(lambda: _call_groq(prompt, max_tokens=max_tokens), AI_TIMEOUT_SECONDS)
    if provider == "anthropic":
        return _call_with_timeout(lambda: _call_anthropic(prompt, max_tokens=max_tokens), AI_TIMEOUT_SECONDS)
    if provider == "openai":
        return _call_with_timeout(lambda: _call_openai(prompt, max_tokens=max_tokens), AI_TIMEOUT_SECONDS)
    raise RuntimeError(f"Unknown provider {provider}")


def _generate(prompt: str, *, max_tokens: int, scope: str) -> str:
    for provider in _provider_chain():
        if not _has_key(provider):
            continue
        breaker = _breaker_for(provider, scope)
        if not breaker.allow():
            logger.warning("Circuit breaker open for %s. Skipping provider.", provider)
            continue
        try:
            content = _retry(lambda: _run_provider(provider, prompt, max_tokens=max_tokens), provider=provider)
            content = _safe_text(content)
            if not content:
                raise ValueError("Empty response.")
            breaker.record_success()
            return content
        except Exception as error:  # pylint: disable=broad-except
            breaker.record_failure()
            logger.warning("Provider %s failed: %s", provider, error)
            continue
    return ""


def generate_summary(data: dict[str, Any], *, scope: str | None = None) -> str:
    scope_key = scope or "global"
    prompt = build_summary_prompt(data)
    content = _generate(prompt, max_tokens=220, scope=scope_key)
    if content:
        return content
    return _summary_fallback(data)


def generate_email(summary: dict[str, Any], *, scope: str | None = None) -> str:
    scope_key = scope or "global"
    prompt = build_email_prompt(summary)
    content = _generate(prompt, max_tokens=360, scope=scope_key)
    if content:
        return content
    return _email_fallback(summary)


def generate_text(
    prompt: str,
    *,
    fallback: str,
    scope: str | None = None,
    max_tokens: int = 260,
) -> tuple[str, bool]:
    scope_key = scope or "global"
    content = _generate(prompt, max_tokens=max_tokens, scope=scope_key)
    if content:
        return content, True
    return _safe_text(fallback), False
