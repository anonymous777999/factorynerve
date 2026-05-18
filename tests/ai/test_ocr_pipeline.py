import asyncio

from backend.ai.pipelines.ocr_pipeline import OCRPipeline
from backend.ai.providers.base import ProviderConfig, RawAIResponse, TokenUsage
from backend.ai.validators.output_validator import ValidationResult


class StubProvider:
    provider_name = "stub"

    def __init__(self, responses):
        self.responses = list(responses)

    async def complete(self, prompt, config):
        return self.responses.pop(0)

    async def complete_with_retry(self, prompt, config, max_retries=3):
        return await self.complete(prompt, config)


class StubValidator:
    def __init__(self, result):
        self.result = result

    async def validate(self, raw_content, expected_schema):
        return self.result


class StubCorrectionPipeline:
    def __init__(self, result):
        self.result = result
        self.called = 0

    async def attempt_correction(self, raw_content, validation_errors, schema, provider):
        self.called += 1
        return self.result


def _raw_success(content='{"name":"mill"}'):
    return RawAIResponse(
        content=content,
        usage=TokenUsage(input_tokens=10, output_tokens=5, total_tokens=15, estimated_cost_usd=0.01),
        provider="gemini",
        model="gemini-1.5-flash",
        latency_ms=12,
    )


def test_pipeline_returns_success_on_valid_provider_response():
    usage_events = []
    pipeline = OCRPipeline(
        provider=StubProvider([_raw_success()]),
        validator=StubValidator(
            ValidationResult(
                ok=True,
                parsed_output={"name": "mill"},
                validation_errors=[],
                confidence_score=1.0,
                is_partial=False,
            )
        ),
        correction_pipeline=StubCorrectionPipeline(
            ValidationResult(ok=True, parsed_output={"name": "mill"}, validation_errors=[], confidence_score=1.0, is_partial=False)
        ),
        usage_logger=lambda **payload: usage_events.append(payload),
    )

    result = asyncio.run(pipeline.run("ocr text", {"type": "object", "properties": {"name": {"type": "string"}}}, 7))

    assert result.success is True
    assert result.extracted_fields == {"name": "mill"}
    assert usage_events[0]["org_id"] == 7


def test_pipeline_returns_failure_when_provider_returns_none_content():
    usage_events = []
    pipeline = OCRPipeline(
        provider=StubProvider([
            RawAIResponse(
                content=None,
                usage=TokenUsage(total_tokens=3, estimated_cost_usd=0.0),
                provider="gemini",
                model="gemini-1.5-flash",
                latency_ms=5,
                error="provider down",
                status_code=503,
            )
        ]),
        validator=StubValidator(ValidationResult(ok=False, parsed_output=None, validation_errors=["unused"], confidence_score=0.0, is_partial=False)),
        correction_pipeline=StubCorrectionPipeline(
            ValidationResult(ok=False, parsed_output=None, validation_errors=["unused"], confidence_score=0.0, is_partial=False)
        ),
        usage_logger=lambda **payload: usage_events.append(payload),
    )

    result = asyncio.run(pipeline.run("ocr text", {"type": "object"}, 9))

    assert result.success is False
    assert result.error_message == "provider down"
    assert usage_events[0]["org_id"] == 9


def test_pipeline_logs_usage_on_success_and_failure_paths():
    usage_events = []
    success_pipeline = OCRPipeline(
        provider=StubProvider([_raw_success()]),
        validator=StubValidator(ValidationResult(ok=True, parsed_output={"name": "mill"}, validation_errors=[], confidence_score=1.0, is_partial=False)),
        correction_pipeline=StubCorrectionPipeline(
            ValidationResult(ok=True, parsed_output={"name": "mill"}, validation_errors=[], confidence_score=1.0, is_partial=False)
        ),
        usage_logger=lambda **payload: usage_events.append(payload),
    )
    failure_pipeline = OCRPipeline(
        provider=StubProvider([
            RawAIResponse(content=None, usage=TokenUsage(total_tokens=1), provider="gemini", model="gemini", latency_ms=1, error="boom", status_code=503)
        ]),
        validator=StubValidator(ValidationResult(ok=False, parsed_output=None, validation_errors=["boom"], confidence_score=0.0, is_partial=False)),
        correction_pipeline=StubCorrectionPipeline(
            ValidationResult(ok=False, parsed_output=None, validation_errors=["boom"], confidence_score=0.0, is_partial=False)
        ),
        usage_logger=lambda **payload: usage_events.append(payload),
    )

    asyncio.run(success_pipeline.run("ocr text", {"type": "object"}, 1))
    asyncio.run(failure_pipeline.run("ocr text", {"type": "object"}, 1))

    assert len(usage_events) == 2
    assert {event["success"] for event in usage_events} == {True, False}


def test_pipeline_never_raises_regardless_of_provider_failure_mode():
    class ExplodingProvider(StubProvider):
        async def complete_with_retry(self, prompt, config, max_retries=3):
            raise RuntimeError("unexpected failure")

    pipeline = OCRPipeline(
        provider=ExplodingProvider([]),
        validator=StubValidator(ValidationResult(ok=False, parsed_output=None, validation_errors=["unused"], confidence_score=0.0, is_partial=False)),
        correction_pipeline=StubCorrectionPipeline(
            ValidationResult(ok=False, parsed_output=None, validation_errors=["unused"], confidence_score=0.0, is_partial=False)
        ),
        usage_logger=lambda **payload: None,
    )

    result = asyncio.run(pipeline.run("ocr text", {"type": "object"}, 4))

    assert result.success is False
    assert result.error_message == "extraction_failed_after_retry"
