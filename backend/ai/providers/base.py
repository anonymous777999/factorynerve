"""Base provider protocol and typed raw response models."""

from __future__ import annotations

import asyncio
from dataclasses import dataclass, field
from typing import Any, Protocol

from backend.ai.prompts.base import RenderedPrompt


@dataclass(slots=True)
class ProviderConfig:
    model: str
    temperature: float
    max_tokens: int
    timeout_seconds: float


@dataclass(slots=True)
class TokenUsage:
    input_tokens: int = 0
    output_tokens: int = 0
    total_tokens: int = 0
    estimated_cost_usd: float = 0.0


@dataclass(slots=True)
class RawAIResponse:
    content: str | None
    usage: TokenUsage = field(default_factory=TokenUsage)
    provider: str = ""
    model: str = ""
    latency_ms: int = 0
    error: str | None = None
    status_code: int | None = None
    retryable: bool = False
    retry_count: int = 0
    metadata: dict[str, Any] = field(default_factory=dict)

    @property
    def ok(self) -> bool:
        return self.content is not None and not self.error


class AbstractAIProvider(Protocol):
    async def complete(
        self,
        prompt: RenderedPrompt,
        config: ProviderConfig,
    ) -> RawAIResponse:
        """Execute one provider call and convert all failures into a typed response."""

    async def complete_with_retry(
        self,
        prompt: RenderedPrompt,
        config: ProviderConfig,
        max_retries: int = 3,
    ) -> RawAIResponse:
        """Retry 429 and 5xx failures with 1s, 2s, 4s exponential backoff."""


def should_retry_status(status_code: int | None) -> bool:
    if status_code is None:
        return False
    return status_code == 429 or 500 <= status_code <= 599


async def retry_provider_call(
    provider: AbstractAIProvider,
    prompt: RenderedPrompt,
    config: ProviderConfig,
    *,
    max_retries: int = 3,
) -> RawAIResponse:
    backoff_seconds = 1
    response = await provider.complete(prompt, config)
    if not should_retry_status(response.status_code):
        return response

    for retry_index in range(1, max_retries + 1):
        await asyncio.sleep(backoff_seconds)
        response = await provider.complete(prompt, config)
        response.retry_count = retry_index
        if not should_retry_status(response.status_code):
            return response
        backoff_seconds *= 2
    return response
