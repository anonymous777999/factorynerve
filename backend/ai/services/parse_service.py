"""Smart-input parsing service using the typed provider layer."""

from __future__ import annotations

from backend.ai.models.results import AIResult
from backend.ai.pipelines.ocr_pipeline import sanitize_document_input
from backend.ai.prompts.registry import PromptRegistry
from backend.ai.providers import get_default_provider_config
from backend.ai.providers.base import AbstractAIProvider
from backend.ai.validators.output_validator import AIOutputValidator


class ParseService:
    def __init__(
        self,
        provider: AbstractAIProvider,
        registry: PromptRegistry | None = None,
        validator: AIOutputValidator | None = None,
    ) -> None:
        self.provider = provider
        self.registry = registry or PromptRegistry()
        self.validator = validator or AIOutputValidator()

    async def parse_document(self, document_text: str, expected_schema: dict) -> AIResult:
        sanitized_text = sanitize_document_input(document_text)
        prompt = self.registry.render(
            "smart_input_parse",
            {"document_text": sanitized_text, "expected_schema": expected_schema},
        )
        raw = await self.provider.complete_with_retry(prompt, get_default_provider_config())
        if raw.content is None:
            return AIResult(
                success=False,
                raw_response=raw,
                validated_output=None,
                error_message=raw.error or "provider_error",
                validation_errors=[raw.error or "provider_error"],
                retry_count=raw.retry_count,
                total_latency_ms=raw.latency_ms,
            )
        validated = await self.validator.validate(raw.content, expected_schema)
        return AIResult(
            success=validated.ok,
            raw_response=raw,
            validated_output=validated.parsed_output,
            error_message=validated.error_message,
            validation_errors=validated.validation_errors,
            retry_count=raw.retry_count,
            total_latency_ms=raw.latency_ms,
        )
