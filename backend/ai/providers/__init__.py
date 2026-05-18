"""Provider factory helpers for the AI service layer."""

from __future__ import annotations

import os

from backend.ai.providers.base import AbstractAIProvider, ProviderConfig
from backend.ai.providers.gemini import GeminiProvider
from backend.ai.providers.openai import OpenAIProvider


def get_provider_from_env() -> AbstractAIProvider:
    provider = (os.getenv("AI_PROVIDER") or "gemini").strip().lower()
    if provider in {"google", "gemini"}:
        return GeminiProvider()
    if provider in {"gpt", "openai"}:
        return OpenAIProvider()
    return GeminiProvider()


def get_default_provider_config() -> ProviderConfig:
    provider = (os.getenv("AI_PROVIDER") or "gemini").strip().lower()
    if provider in {"gpt", "openai"}:
        model = os.getenv("OPENAI_MODEL", "gpt-4o-mini")
    else:
        model = os.getenv("GEMINI_MODEL", "gemini-1.5-flash")
    return ProviderConfig(
        model=model,
        temperature=float(os.getenv("AI_PROVIDER_TEMPERATURE", "0.1")),
        max_tokens=int(os.getenv("AI_PROVIDER_MAX_TOKENS", "1024")),
        timeout_seconds=float(os.getenv("AI_PROVIDER_TIMEOUT_SECONDS", "20")),
    )


__all__ = ["AbstractAIProvider", "ProviderConfig", "get_default_provider_config", "get_provider_from_env"]
