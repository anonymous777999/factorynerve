"""Provider calls with retries, fallback, and JSON normalization."""

from __future__ import annotations

import asyncio
import json
import logging
import os
import time
from typing import Any, Callable

from backend.ai.monitoring.governance import allow_provider, cap_retry_attempts, governed_provider_chain, record_provider_attempt
from backend.ai.validators.output_validator import AIOutputValidator
from backend.services.intelligence.routing import (
    estimate_cost_usd,
    estimate_tokens,
    provider_has_key,
    resolve_model_name,
)
from backend.services.intelligence.schemas import StageResult
from backend.utils import get_config


logger = logging.getLogger(__name__)
config = get_config()
_VALIDATOR = AIOutputValidator()

RETRY_ATTEMPTS = max(1, int(os.getenv("INTELLIGENCE_RETRY_ATTEMPTS", "2")))
RETRY_BACKOFF_SECONDS = float(os.getenv("INTELLIGENCE_RETRY_BACKOFF_SECONDS", "1.2"))


def _extract_json_object(raw_text: str) -> dict[str, Any] | None:
    start = raw_text.find("{")
    end = raw_text.rfind("}")
    if start == -1 or end == -1 or end <= start:
        return None
    blob = raw_text[start : end + 1]
    try:
        parsed = json.loads(blob)
    except Exception:
        return None
    return parsed if isinstance(parsed, dict) else None


def _call_anthropic(prompt: str, *, model_name: str) -> str:
    import anthropic  # type: ignore

    client = anthropic.Anthropic(api_key=config.anthropic_api_key, timeout=25)
    messages_api = client.messages
    response = messages_api.create(
        model=model_name,
        max_tokens=int(os.getenv("INTELLIGENCE_MAX_OUTPUT_TOKENS", "700")),
        messages=[{"role": "user", "content": prompt}],
    )
    parts = getattr(response, "content", []) or []
    text_chunks = [getattr(item, "text", "") for item in parts if getattr(item, "text", "")]
    return "\n".join(chunk.strip() for chunk in text_chunks if chunk).strip()


def _call_openai(prompt: str, *, model_name: str) -> str:
    from openai import OpenAI  # type: ignore

    client = OpenAI(
        api_key=config.openai_api_key,
        timeout=float(os.getenv("INTELLIGENCE_PROVIDER_TIMEOUT_SECONDS", "25")),
    )
    response = client.chat.completions.create(
        model=model_name,
        temperature=0.1,
        max_tokens=int(os.getenv("INTELLIGENCE_MAX_OUTPUT_TOKENS", "700")),
        messages=[{"role": "user", "content": prompt}],
    )
    return (response.choices[0].message.content or "").strip()


def _call_groq(prompt: str, *, model_name: str) -> str:
    import groq  # type: ignore

    client = groq.Groq(api_key=config.groq_api_key, timeout=25)
    response = client.chat.completions.create(
        model=model_name,
        temperature=0.1,
        max_tokens=int(os.getenv("INTELLIGENCE_MAX_OUTPUT_TOKENS", "700")),
        messages=[{"role": "user", "content": prompt}],
    )
    return (response.choices[0].message.content or "").strip()


def _provider_callable(provider: str) -> Callable[[str, str], str]:
    if provider == "anthropic":
        return lambda prompt, model_name: _call_anthropic(prompt, model_name=model_name)
    if provider == "openai":
        return lambda prompt, model_name: _call_openai(prompt, model_name=model_name)
    if provider == "groq":
        return lambda prompt, model_name: _call_groq(prompt, model_name=model_name)
    raise RuntimeError(f"Unsupported provider: {provider}")


def _infer_schema(value: Any) -> dict[str, Any]:
    if isinstance(value, dict):
        return {
            "type": "object",
            "properties": {str(key): _infer_schema(item) for key, item in value.items()},
            "required": [str(key) for key in value.keys()],
        }
    if isinstance(value, list):
        item_schema = _infer_schema(value[0]) if value else {"type": "string"}
        return {"type": "array", "items": item_schema}
    if isinstance(value, bool):
        return {"type": "boolean"}
    if isinstance(value, int) and not isinstance(value, bool):
        return {"type": "integer"}
    if isinstance(value, float):
        return {"type": "number"}
    return {"type": "string"}


def invoke_stage_model(
    *,
    stage_name: str,
    prompt: str,
    tier: str,
    provider_chain: list[str],
    prompt_hash: str,
    fallback_builder: Callable[[], dict[str, Any]],
) -> StageResult:
    last_error = ""
    governed_chain, _suppressed = governed_provider_chain(provider_chain, system=stage_name)
    max_attempts = cap_retry_attempts(RETRY_ATTEMPTS, mode="intelligence")
    for provider in governed_chain:
        if not provider_has_key(provider):
            continue
        if not allow_provider(provider, system=stage_name):
            last_error = f"{provider} suppressed by governance"
            continue
        model_name = resolve_model_name(provider, tier)
        runner = _provider_callable(provider)
        for attempt in range(1, max_attempts + 1):
            started = time.perf_counter()
            try:
                raw_text = runner(prompt, model_name)
                parsed = _extract_json_object(raw_text)
                if parsed is None:
                    raise ValueError("Model did not return valid JSON.")
                validated = asyncio.run(_VALIDATOR.validate(json.dumps(parsed), _infer_schema(parsed)))
                if not validated.ok or validated.parsed_output is None:
                    raise ValueError("Model output did not pass validation.")
                parsed = validated.parsed_output
                prompt_tokens = estimate_tokens(prompt)
                completion_tokens = estimate_tokens(raw_text)
                latency_ms = int((time.perf_counter() - started) * 1000)
                record_provider_attempt(
                    provider=provider,
                    system=stage_name,
                    success=True,
                    latency_ms=latency_ms,
                    timeout_hit=False,
                    degraded=False,
                )
                return StageResult(
                    stage_name=stage_name,
                    payload=parsed,
                    confidence=0.0,
                    model_tier=tier,
                    model_name=model_name,
                    provider=provider,
                    prompt_hash=prompt_hash,
                    prompt_tokens=prompt_tokens,
                    completion_tokens=completion_tokens,
                    total_tokens=prompt_tokens + completion_tokens,
                    estimated_cost_usd=estimate_cost_usd(tier, prompt_tokens, completion_tokens),
                    latency_ms=latency_ms,
                    retry_count=max(0, attempt - 1),
                )
            except Exception as error:  # pylint: disable=broad-except
                last_error = str(error)
                record_provider_attempt(
                    provider=provider,
                    system=stage_name,
                    success=False,
                    latency_ms=int((time.perf_counter() - started) * 1000),
                    timeout_hit="timeout" in str(error).lower(),
                    degraded=True,
                )
                logger.warning(
                    "Factory Intelligence provider failed stage=%s provider=%s tier=%s attempt=%s error=%s",
                    stage_name,
                    provider,
                    tier,
                    attempt,
                    error,
                )
                if attempt < max_attempts:
                    time.sleep(RETRY_BACKOFF_SECONDS * attempt)

    fallback_payload = fallback_builder()
    fallback_text = json.dumps(fallback_payload, sort_keys=True)
    prompt_tokens = estimate_tokens(prompt)
    completion_tokens = estimate_tokens(fallback_text)
    return StageResult(
        stage_name=stage_name,
        payload=fallback_payload,
        confidence=0.0,
        model_tier=tier,
        model_name="rules-engine",
        provider="fallback",
        prompt_hash=prompt_hash,
        prompt_tokens=prompt_tokens,
        completion_tokens=completion_tokens,
        total_tokens=prompt_tokens + completion_tokens,
        estimated_cost_usd=0.0,
        latency_ms=0,
        retry_count=max(0, max_attempts - 1) if last_error else 0,
        warnings=[last_error] if last_error else [],
    )
