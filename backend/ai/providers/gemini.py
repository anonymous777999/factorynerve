"""Gemini provider adapter for the typed AI service layer."""

from __future__ import annotations

import asyncio
import time
from typing import Any

from backend.ai.prompts.base import RenderedPrompt
from backend.ai.providers.base import ProviderConfig, RawAIResponse, TokenUsage, retry_provider_call
from backend.utils import get_config


GEMINI_INPUT_COST_PER_1K = 0.000075
GEMINI_OUTPUT_COST_PER_1K = 0.00030


def _safe_int(value: Any) -> int:
    try:
        return max(0, int(value or 0))
    except (TypeError, ValueError):
        return 0


def _estimate_text_tokens(text: str) -> int:
    return max(1, len(text) // 4) if text else 0


def _extract_status_code(error: Exception) -> int | None:
    for attr in ("status_code", "code", "status"):
        value = getattr(error, attr, None)
        try:
            if value is not None:
                return int(value)
        except (TypeError, ValueError):
            continue
    return None


def _build_usage(response: Any, content: str) -> TokenUsage:
    usage_meta = (
        getattr(response, "usage_metadata", None)
        or getattr(response, "usage", None)
        or {}
    )
    prompt_tokens = _safe_int(
        getattr(usage_meta, "prompt_token_count", None)
        or getattr(usage_meta, "input_tokens", None)
        or (usage_meta.get("prompt_token_count") if isinstance(usage_meta, dict) else None)
        or (usage_meta.get("input_tokens") if isinstance(usage_meta, dict) else None)
    )
    completion_tokens = _safe_int(
        getattr(usage_meta, "candidates_token_count", None)
        or getattr(usage_meta, "output_tokens", None)
        or (usage_meta.get("candidates_token_count") if isinstance(usage_meta, dict) else None)
        or (usage_meta.get("output_tokens") if isinstance(usage_meta, dict) else None)
    )
    total_tokens = _safe_int(
        getattr(usage_meta, "total_token_count", None)
        or (usage_meta.get("total_token_count") if isinstance(usage_meta, dict) else None)
    )
    if prompt_tokens == 0:
        prompt_tokens = _estimate_text_tokens(content)
    if completion_tokens == 0:
        completion_tokens = _estimate_text_tokens(content)
    if total_tokens == 0:
        total_tokens = prompt_tokens + completion_tokens
    estimated_cost = round(
        (prompt_tokens / 1000.0) * GEMINI_INPUT_COST_PER_1K
        + (completion_tokens / 1000.0) * GEMINI_OUTPUT_COST_PER_1K,
        8,
    )
    return TokenUsage(
        input_tokens=prompt_tokens,
        output_tokens=completion_tokens,
        total_tokens=total_tokens,
        estimated_cost_usd=max(0.0, estimated_cost),
    )


class GeminiProvider:
    provider_name = "gemini"

    async def complete(
        self,
        prompt: RenderedPrompt,
        config: ProviderConfig,
    ) -> RawAIResponse:
        started = time.perf_counter()
        try:
            import google.generativeai as genai  # type: ignore

            async def _invoke() -> Any:
                config_values = get_config()
                api_key = (
                    prompt.metadata.get("api_key") if prompt.metadata else None
                ) or config_values.gemini_api_key
                if api_key:
                    genai.configure(api_key=api_key)
                return await asyncio.to_thread(
                    lambda: genai.GenerativeModel(config.model).generate_content(prompt.prompt_text)
                )

            response = await asyncio.wait_for(_invoke(), timeout=config.timeout_seconds)
            content = str(getattr(response, "text", "") or "").strip() or None
            usage = _build_usage(response, prompt.prompt_text if content is None else content)
            return RawAIResponse(
                content=content,
                usage=usage,
                provider=self.provider_name,
                model=config.model,
                latency_ms=int((time.perf_counter() - started) * 1000),
                metadata={"prompt_name": prompt.name},
            )
        except Exception as error:  # pylint: disable=broad-except
            status_code = _extract_status_code(error)
            return RawAIResponse(
                content=None,
                usage=TokenUsage(
                    input_tokens=_estimate_text_tokens(prompt.prompt_text),
                    output_tokens=0,
                    total_tokens=_estimate_text_tokens(prompt.prompt_text),
                    estimated_cost_usd=0.0,
                ),
                provider=self.provider_name,
                model=config.model,
                latency_ms=int((time.perf_counter() - started) * 1000),
                error=str(error),
                status_code=status_code,
                retryable=status_code == 429 or (status_code is not None and 500 <= status_code <= 599),
                metadata={"prompt_name": prompt.name},
            )

    async def complete_with_retry(
        self,
        prompt: RenderedPrompt,
        config: ProviderConfig,
        max_retries: int = 3,
    ) -> RawAIResponse:
        return await retry_provider_call(self, prompt, config, max_retries=max_retries)
