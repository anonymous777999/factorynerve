"""Summary generation service using the typed provider layer."""

from __future__ import annotations

import json

from backend.ai.models.results import SummaryResult
from backend.ai.prompts.registry import PromptRegistry
from backend.ai.providers import get_default_provider_config
from backend.ai.providers.base import AbstractAIProvider
from backend.ai.validators.output_validator import AIOutputValidator


class SummaryService:
    def __init__(self, provider: AbstractAIProvider, registry: PromptRegistry | None = None) -> None:
        self.provider = provider
        self.registry = registry or PromptRegistry()
        self.validator = AIOutputValidator()

    async def summarize(self, entry_payload: dict) -> SummaryResult:
        prompt = self.registry.render("entry_summary", {"entry_payload": entry_payload})
        raw = await self.provider.complete_with_retry(prompt, get_default_provider_config())
        text = (raw.content or "").strip() or None
        validated_output = None
        validation_errors: list[str] = []
        if text:
            validated = await self.validator.validate(
                json.dumps({"summary_text": text}),
                {
                    "type": "object",
                    "properties": {"summary_text": {"type": "string"}},
                    "required": ["summary_text"],
                },
            )
            validated_output = validated.parsed_output if validated.ok else None
            validation_errors = validated.validation_errors
            text = (validated_output or {}).get("summary_text") if validated_output else None
        return SummaryResult(
            success=bool(text),
            raw_response=raw,
            validated_output=validated_output,
            error_message=raw.error if not text else None,
            validation_errors=validation_errors if text is None else validation_errors,
            retry_count=raw.retry_count,
            total_latency_ms=raw.latency_ms,
            summary_text=text,
            word_count=len(text.split()) if text else None,
        )
