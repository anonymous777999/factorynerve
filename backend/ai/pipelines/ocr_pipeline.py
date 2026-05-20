"""OCR pipeline with typed provider, validation, correction, and usage logging."""

from __future__ import annotations

import logging
import os
import re
import time
from typing import Callable

from fastapi import HTTPException
from sqlalchemy.orm import Session

from backend.ai.caching.result_cache import AIResultCacheStore
from backend.ai.models.results import OCRResult
from backend.ai.monitoring.telemetry import is_timeout_error, record_ai_event
from backend.ai.monitoring.usage_tracker import AIUsageTracker
from backend.ai.prompts.registry import PromptRegistry
from backend.ai.providers import get_default_provider_config
from backend.ai.providers.base import AbstractAIProvider, RawAIResponse, TokenUsage
from backend.ai.validators.correction_pipeline import CorrectionPipeline
from backend.ai.validators.output_validator import AIOutputValidator, ValidationResult


logger = logging.getLogger(__name__)

_INJECTION_PATTERNS = [
    r"ignore (all |previous )?instructions?",
    r"system\s*:",
    r"<\|.*?\|>",
    r"you are now",
    r"new instructions?",
]


def sanitize_document_input(text: str) -> str:
    sanitized = text
    for pattern in _INJECTION_PATTERNS:
        sanitized = re.sub(pattern, "[REDACTED]", sanitized, flags=re.IGNORECASE)
    return sanitized


class OCRPipeline:
    def __init__(
        self,
        provider: AbstractAIProvider,
        registry: PromptRegistry | None = None,
        validator: AIOutputValidator | None = None,
        correction_pipeline: CorrectionPipeline | None = None,
        usage_logger: Callable[..., None] | None = None,
        db: Session | None = None,
        result_cache: AIResultCacheStore | None = None,
        usage_tracker: AIUsageTracker | None = None,
        pipeline_name: str = "ocr_pipeline",
    ) -> None:
        self.provider = provider
        self.registry = registry or PromptRegistry()
        self.validator = validator or AIOutputValidator()
        self.correction_pipeline = correction_pipeline or CorrectionPipeline(
            validator=self.validator,
            provider_config=get_default_provider_config(),
        )
        self.usage_logger = usage_logger or self._default_usage_logger
        self.db = db
        self.result_cache = result_cache or (AIResultCacheStore(db) if db is not None else None)
        self.usage_tracker = usage_tracker or (AIUsageTracker(db) if db is not None else None)
        self.pipeline_name = pipeline_name

    async def run(
        self,
        document_text: str,
        extraction_schema: dict,
        org_id: str,
    ) -> OCRResult:
        started = time.perf_counter()
        raw: RawAIResponse | None = None
        validated: ValidationResult | None = None
        prompt = None
        correction_applied = False

        def _record(result: OCRResult, *, provider: str, model: str, token_estimate: int, timeout_hit: bool) -> None:
            record_ai_event(
                system="ocr",
                operation="extract_document",
                provider=provider,
                model=model,
                latency_ms=result.total_latency_ms,
                token_estimate=token_estimate,
                fallback_used=False,
                degraded_mode=not result.success or result.partial_extraction,
                retry_count=result.retry_count,
                timeout_hit=timeout_hit,
                correction_applied=correction_applied,
                confidence_score=result.confidence_score,
                hallucination_blocked=False,
                rules_engine_used=False,
                success=result.success,
            )

        try:
            sanitized_text = sanitize_document_input(document_text)
            prompt = self.registry.render(
                "ocr_extraction",
                {"document_text": sanitized_text, "extraction_schema": extraction_schema},
            )
            if self.usage_tracker is not None:
                await self.usage_tracker.check_org_daily_token_cap(org_id)
                await self.usage_tracker.check_org_monthly_cost_cap(org_id)
            if self.result_cache is not None:
                cached = self.result_cache.get(
                    org_id=org_id,
                    document_content=document_text,
                    prompt_name=prompt.name,
                    prompt_version=prompt.version,
                )
                if cached is not None:
                    if cached.raw_response is not None:
                        self._track_usage(
                            org_id=org_id,
                            prompt_name=prompt.name,
                            prompt_version=prompt.version,
                            raw=cached.raw_response,
                            cache_hit=True,
                            success=cached.success,
                        )
                    _record(
                        cached,
                        provider=(cached.raw_response.provider if cached.raw_response is not None else "cache"),
                        model=(cached.raw_response.model if cached.raw_response is not None else "cache"),
                        token_estimate=(cached.raw_response.usage.total_tokens if cached.raw_response is not None else 0),
                        timeout_hit=is_timeout_error(cached.error_message),
                    )
                    return cached
            raw = await self.provider.complete_with_retry(prompt, get_default_provider_config())
            if raw.content is None:
                self._log_usage(org_id=org_id, raw=raw, reason=raw.error or "provider_failure")
                self._track_usage(
                    org_id=org_id,
                    prompt_name=prompt.name,
                    prompt_version=prompt.version,
                    raw=raw,
                    cache_hit=False,
                    success=False,
                )
                failure = self._failure_result(
                    raw=raw,
                    retry_count=raw.retry_count,
                    total_latency_ms=int((time.perf_counter() - started) * 1000),
                    error_message=raw.error or "provider_failure",
                    validation_errors=[raw.error or "provider_failure"],
                )
                _record(
                    failure,
                    provider=raw.provider or getattr(self.provider, "provider_name", "unknown"),
                    model=raw.model or get_default_provider_config().model,
                    token_estimate=raw.usage.total_tokens,
                    timeout_hit=is_timeout_error(raw.error),
                )
                return failure
            validated = await self.validator.validate(raw.content, extraction_schema)
            if not validated.ok:
                validated = await self.correction_pipeline.attempt_correction(
                    raw_content=raw.content,
                    validation_errors=validated.validation_errors,
                    schema=extraction_schema,
                    provider=self.provider,
                )
                correction_applied = bool(validated.metadata.get("correction_applied"))

            self._log_usage(
                org_id=org_id,
                raw=raw,
                reason="validated" if validated.ok else validated.error_message or "validation_failed",
            )
            self._track_usage(
                org_id=org_id,
                prompt_name=prompt.name,
                prompt_version=prompt.version,
                raw=raw,
                cache_hit=False,
                success=validated.ok,
            )
            if not validated.ok:
                logger.warning(
                    "AI pipeline failure org_id=%s pipeline=ocr_pipeline reason=%s retry_count=%s final_confidence=%s",
                    org_id,
                    validated.error_message or "validation_failed",
                    raw.retry_count,
                    validated.confidence_score,
                )
                failure = self._failure_result(
                    raw=raw,
                    retry_count=raw.retry_count,
                    total_latency_ms=int((time.perf_counter() - started) * 1000),
                    error_message="extraction_failed_after_retry",
                    validation_errors=validated.validation_errors,
                    confidence_score=validated.confidence_score,
                    extracted_fields=validated.parsed_output or {},
                    partial_extraction=validated.is_partial,
                )
                _record(
                    failure,
                    provider=raw.provider or getattr(self.provider, "provider_name", "unknown"),
                    model=raw.model or get_default_provider_config().model,
                    token_estimate=raw.usage.total_tokens,
                    timeout_hit=is_timeout_error(raw.error) or is_timeout_error(validated.error_message),
                )
                return failure

            result = OCRResult(
                success=validated.ok,
                raw_response=raw,
                validated_output=validated.parsed_output,
                error_message=None,
                validation_errors=[],
                retry_count=raw.retry_count,
                total_latency_ms=int((time.perf_counter() - started) * 1000),
                extracted_fields=validated.parsed_output,
                confidence_score=validated.confidence_score,
                partial_extraction=validated.is_partial,
            )
            if self.result_cache is not None and result.success:
                ttl_seconds = int(os.getenv("AI_CACHE_TTL_OCR_SECONDS", str(60 * 60 * 24)))
                self.result_cache.set(
                    org_id=org_id,
                    document_content=document_text,
                    prompt_name=prompt.name,
                    prompt_version=prompt.version,
                    result=result,
                    ttl_seconds=ttl_seconds,
                )
            _record(
                result,
                provider=raw.provider or getattr(self.provider, "provider_name", "unknown"),
                model=raw.model or get_default_provider_config().model,
                token_estimate=raw.usage.total_tokens,
                timeout_hit=is_timeout_error(raw.error),
            )
            return result
        except HTTPException:
            raise
        except Exception as error:  # pylint: disable=broad-except
            fallback_raw = raw or RawAIResponse(
                content=None,
                usage=TokenUsage(),
                provider=getattr(self.provider, "provider_name", "unknown"),
                model=get_default_provider_config().model,
                latency_ms=int((time.perf_counter() - started) * 1000),
                error=str(error),
            )
            self._log_usage(org_id=org_id, raw=fallback_raw, reason=str(error))
            self._track_usage(
                org_id=org_id,
                prompt_name=prompt.name if prompt is not None else "ocr_extraction",
                prompt_version=prompt.version if prompt is not None else "v1",
                raw=fallback_raw,
                cache_hit=False,
                success=False,
            )
            logger.exception(
                "AI pipeline failure org_id=%s pipeline=ocr_pipeline reason=%s retry_count=%s final_confidence=%s",
                org_id,
                str(error),
                fallback_raw.retry_count,
                getattr(validated, "confidence_score", None),
            )
            failure = self._failure_result(
                raw=fallback_raw,
                retry_count=fallback_raw.retry_count,
                total_latency_ms=int((time.perf_counter() - started) * 1000),
                error_message="extraction_failed_after_retry",
                validation_errors=[str(error)],
            )
            _record(
                failure,
                provider=fallback_raw.provider or getattr(self.provider, "provider_name", "unknown"),
                model=fallback_raw.model or get_default_provider_config().model,
                token_estimate=fallback_raw.usage.total_tokens,
                timeout_hit=is_timeout_error(error),
            )
            return failure

    def _log_usage(self, *, org_id: int, raw: RawAIResponse, reason: str) -> None:
        self.usage_logger(
            org_id=org_id,
            tokens=raw.usage.total_tokens,
            cost_usd=raw.usage.estimated_cost_usd,
            model=raw.model,
            provider=raw.provider,
            success=raw.content is not None,
            reason=reason,
        )

    def _track_usage(
        self,
        *,
        org_id: str,
        prompt_name: str,
        prompt_version: str,
        raw: RawAIResponse,
        cache_hit: bool,
        success: bool,
    ) -> None:
        if self.usage_tracker is None:
            return
        self.usage_tracker.log_raw_response(
            org_id=org_id,
            pipeline_name=self.pipeline_name,
            prompt_name=prompt_name,
            prompt_version=prompt_version,
            raw=raw,
            cache_hit=cache_hit,
            success=success,
        )

    @staticmethod
    def _default_usage_logger(**payload: object) -> None:
        logger.info(
            "AI usage org_id=%s provider=%s model=%s total_tokens=%s cost_usd=%s success=%s reason=%s",
            payload.get("org_id"),
            payload.get("provider"),
            payload.get("model"),
            payload.get("tokens"),
            payload.get("cost_usd"),
            payload.get("success"),
            payload.get("reason"),
        )

    @staticmethod
    def _failure_result(
        *,
        raw: RawAIResponse,
        retry_count: int,
        total_latency_ms: int,
        error_message: str,
        validation_errors: list[str],
        confidence_score: float | None = 0.0,
        extracted_fields: dict | None = None,
        partial_extraction: bool = False,
    ) -> OCRResult:
        return OCRResult(
            success=False,
            raw_response=raw,
            validated_output=extracted_fields,
            error_message=error_message,
            validation_errors=validation_errors,
            retry_count=retry_count,
            total_latency_ms=total_latency_ms,
            extracted_fields=extracted_fields or {},
            confidence_score=confidence_score,
            partial_extraction=partial_extraction,
        )
