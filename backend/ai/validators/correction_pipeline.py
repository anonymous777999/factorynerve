"""Correction loop for invalid AI outputs."""

from __future__ import annotations

import json

from backend.ai.monitoring.telemetry import is_timeout_error, record_ai_event
from backend.ai.prompts.base import RenderedPrompt
from backend.ai.providers.base import AbstractAIProvider, ProviderConfig
from backend.ai.validators.output_validator import AIOutputValidator, ValidationResult


class CorrectionPipeline:
    def __init__(
        self,
        *,
        validator: AIOutputValidator | None = None,
        provider_config: ProviderConfig | None = None,
    ) -> None:
        self.validator = validator or AIOutputValidator()
        self.provider_config = provider_config or ProviderConfig(
            model="gemini-1.5-flash",
            temperature=0.0,
            max_tokens=1024,
            timeout_seconds=20,
        )

    async def attempt_correction(
        self,
        raw_content: str,
        validation_errors: list[str],
        schema: dict,
        provider: AbstractAIProvider,
    ) -> ValidationResult:
        current_content = raw_content
        attempt_count = 0
        last_provider = getattr(provider, "provider_name", "unknown")
        last_model = self.provider_config.model
        total_latency_ms = 0
        total_tokens = 0
        timeout_hit = False
        last_result = ValidationResult(
            ok=False,
            parsed_output=None,
            validation_errors=list(validation_errors),
            confidence_score=0.0,
            is_partial=False,
            error_message=validation_errors[0] if validation_errors else "validation_failed",
        )
        for _attempt in range(2):
            attempt_count += 1
            from backend.ai.pipelines.ocr_pipeline import sanitize_document_input

            sanitized_content = sanitize_document_input(current_content)
            correction_prompt = RenderedPrompt(
                name="validation_correction",
                prompt_text=(
                    "Your previous response had these errors: "
                    f"{validation_errors}. "
                    f"Original schema required: {json.dumps(schema, ensure_ascii=True)}. "
                    "Please correct and respond with valid JSON only.\n\n"
                    f"Previous response:\n{sanitized_content}"
                ),
                variables={"schema": schema, "validation_errors": validation_errors, "raw_content": sanitized_content},
                metadata={},
            )
            corrected = await provider.complete(correction_prompt, self.provider_config)
            last_provider = corrected.provider or last_provider
            last_model = corrected.model or last_model
            total_latency_ms += int(corrected.latency_ms or 0)
            total_tokens += int(corrected.usage.total_tokens or 0)
            timeout_hit = timeout_hit or is_timeout_error(corrected.error)
            if corrected.content is None:
                last_result = ValidationResult(
                    ok=False,
                    parsed_output=None,
                    validation_errors=list(validation_errors) + [corrected.error or "correction_provider_failure"],
                    confidence_score=0.0,
                    is_partial=False,
                    error_message=corrected.error or "correction_provider_failure",
                )
                continue
            current_content = corrected.content
            last_result = await self.validator.validate(current_content, schema)
            if last_result.ok:
                last_result.metadata = {"correction_applied": True}
                record_ai_event(
                    system="correction_pipeline",
                    operation="validation_correction",
                    provider=last_provider,
                    model=last_model,
                    latency_ms=total_latency_ms,
                    token_estimate=total_tokens,
                    fallback_used=False,
                    degraded_mode=False,
                    retry_count=max(0, attempt_count - 1),
                    timeout_hit=timeout_hit,
                    correction_applied=True,
                    confidence_score=last_result.confidence_score,
                    hallucination_blocked=False,
                    rules_engine_used=False,
                    success=True,
                )
                return last_result
            validation_errors = last_result.validation_errors
        record_ai_event(
            system="correction_pipeline",
            operation="validation_correction",
            provider=last_provider,
            model=last_model,
            latency_ms=total_latency_ms,
            token_estimate=total_tokens,
            fallback_used=False,
            degraded_mode=True,
            retry_count=max(0, attempt_count - 1),
            timeout_hit=timeout_hit,
            correction_applied=False,
            confidence_score=last_result.confidence_score,
            hallucination_blocked=False,
            rules_engine_used=False,
            success=False,
        )
        return last_result
