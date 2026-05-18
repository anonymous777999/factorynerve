"""OpenAI provider adapter for parity with Gemini-backed services."""

from __future__ import annotations

import asyncio
import time
from typing import Any

from backend.ai.prompts.base import RenderedPrompt
from backend.ai.providers.base import ProviderConfig, RawAIResponse, TokenUsage, retry_provider_call
from backend.utils import get_config


OPENAI_INPUT_COST_PER_1K = 0.00015
OPENAI_OUTPUT_COST_PER_1K = 0.00060


def _safe_int(value: Any) -> int:
    try:
        return max(0, int(value or 0))
    except (TypeError, ValueError):
        return 0


def _extract_status_code(error: Exception) -> int | None:
    for attr in ("status_code", "code", "status"):
        value = getattr(error, attr, None)
        try:
            if value is not None:
                return int(value)
        except (TypeError, ValueError):
            continue
    return None


class OpenAIProvider:
    provider_name = "openai"

    async def complete(self, prompt: RenderedPrompt, config: ProviderConfig) -> RawAIResponse:
        started = time.perf_counter()
        try:
            from openai import OpenAI  # type: ignore

            config_values = get_config()
            client = OpenAI(
                api_key=(prompt.metadata or {}).get("api_key") or config_values.openai_api_key,
                timeout=config.timeout_seconds,
            )
            response = await asyncio.to_thread(
                lambda: client.chat.completions.create(
                    model=config.model,
                    temperature=config.temperature,
                    max_tokens=config.max_tokens,
                    messages=[{"role": "user", "content": prompt.prompt_text}],
                )
            )
            content = (response.choices[0].message.content or "").strip() or None
            prompt_tokens = _safe_int(getattr(response.usage, "prompt_tokens", 0))
            completion_tokens = _safe_int(getattr(response.usage, "completion_tokens", 0))
            total_tokens = _safe_int(getattr(response.usage, "total_tokens", 0)) or (prompt_tokens + completion_tokens)
            estimated_cost = round(
                (prompt_tokens / 1000.0) * OPENAI_INPUT_COST_PER_1K
                + (completion_tokens / 1000.0) * OPENAI_OUTPUT_COST_PER_1K,
                8,
            )
            return RawAIResponse(
                content=content,
                usage=TokenUsage(
                    input_tokens=prompt_tokens,
                    output_tokens=completion_tokens,
                    total_tokens=total_tokens,
                    estimated_cost_usd=max(0.0, estimated_cost),
                ),
                provider=self.provider_name,
                model=config.model,
                latency_ms=int((time.perf_counter() - started) * 1000),
                metadata={"prompt_name": prompt.name},
            )
        except Exception as error:  # pylint: disable=broad-except
            return RawAIResponse(
                content=None,
                usage=TokenUsage(),
                provider=self.provider_name,
                model=config.model,
                latency_ms=int((time.perf_counter() - started) * 1000),
                error=str(error),
                status_code=_extract_status_code(error),
                retryable=False,
                metadata={"prompt_name": prompt.name},
            )

    async def complete_with_retry(self, prompt: RenderedPrompt, config: ProviderConfig, max_retries: int = 3) -> RawAIResponse:
        return await retry_provider_call(self, prompt, config, max_retries=max_retries)
