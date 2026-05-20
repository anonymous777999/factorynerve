"""Correction loop for invalid AI outputs."""

from __future__ import annotations

import json

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
        last_result = ValidationResult(
            ok=False,
            parsed_output=None,
            validation_errors=list(validation_errors),
            confidence_score=0.0,
            is_partial=False,
            error_message=validation_errors[0] if validation_errors else "validation_failed",
        )
        for _attempt in range(2):
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
                return last_result
            validation_errors = last_result.validation_errors
        return last_result
