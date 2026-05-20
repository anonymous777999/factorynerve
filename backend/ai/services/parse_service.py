"""Smart-input parsing service using the typed provider layer."""

from __future__ import annotations

from backend.ai.monitoring.telemetry import is_timeout_error, record_ai_event
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
            record_ai_event(
                system="smart_input",
                operation="typed_parse",
                provider=raw.provider or getattr(self.provider, "provider_name", "unknown"),
                model=raw.model or get_default_provider_config().model,
                latency_ms=raw.latency_ms,
                token_estimate=raw.usage.total_tokens,
                fallback_used=False,
                degraded_mode=True,
                retry_count=raw.retry_count,
                timeout_hit=is_timeout_error(raw.error),
                correction_applied=False,
                confidence_score=0.0,
                hallucination_blocked=False,
                rules_engine_used=False,
                success=False,
            )
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
        record_ai_event(
            system="smart_input",
            operation="typed_parse",
            provider=raw.provider or getattr(self.provider, "provider_name", "unknown"),
            model=raw.model or get_default_provider_config().model,
            latency_ms=raw.latency_ms,
            token_estimate=raw.usage.total_tokens,
            fallback_used=False,
            degraded_mode=not validated.ok or validated.is_partial,
            retry_count=raw.retry_count,
            timeout_hit=is_timeout_error(raw.error),
            correction_applied=False,
            confidence_score=validated.confidence_score,
            hallucination_blocked=False,
            rules_engine_used=False,
            success=validated.ok,
        )
        return AIResult(
            success=validated.ok,
            raw_response=raw,
            validated_output=validated.parsed_output,
            error_message=validated.error_message,
            validation_errors=validated.validation_errors,
            retry_count=raw.retry_count,
            total_latency_ms=raw.latency_ms,
        )
