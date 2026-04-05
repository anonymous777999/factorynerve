"""Provider calls with retries, fallback, and JSON normalization."""

from __future__ import annotations

import json
import logging
import os
import time
from typing import Any, Callable

from backend.services.intelligence.routing import (
    estimate_cost_usd,
    estimate_tokens,
    provider_has_key,
    resolve_model_name,
)
from backend.services.intelligence.schemas import StageResult


logger = logging.getLogger(__name__)

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

    client = anthropic.Anthropic(api_key=os.getenv("ANTHROPIC_API_KEY"))
    response = client.messages.create(
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
        api_key=os.getenv("OPENAI_API_KEY"),
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

    client = groq.Groq(api_key=os.getenv("GROQ_API_KEY"))
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
    for provider in provider_chain:
        if not provider_has_key(provider):
            continue
        model_name = resolve_model_name(provider, tier)
        runner = _provider_callable(provider)
        for attempt in range(1, RETRY_ATTEMPTS + 1):
            started = time.perf_counter()
            try:
                raw_text = runner(prompt, model_name)
                parsed = _extract_json_object(raw_text)
                if parsed is None:
                    raise ValueError("Model did not return valid JSON.")
                prompt_tokens = estimate_tokens(prompt)
                completion_tokens = estimate_tokens(raw_text)
                latency_ms = int((time.perf_counter() - started) * 1000)
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
                )
            except Exception as error:  # pylint: disable=broad-except
                last_error = str(error)
                logger.warning(
                    "Factory Intelligence provider failed stage=%s provider=%s tier=%s attempt=%s error=%s",
                    stage_name,
                    provider,
                    tier,
                    attempt,
                    error,
                )
                if attempt < RETRY_ATTEMPTS:
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
        warnings=[last_error] if last_error else [],
    )
