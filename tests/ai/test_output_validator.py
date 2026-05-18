import asyncio

from backend.ai.prompts.base import RenderedPrompt
from backend.ai.providers.base import ProviderConfig, RawAIResponse, TokenUsage
from backend.ai.validators.correction_pipeline import CorrectionPipeline
from backend.ai.validators.output_validator import AIOutputValidator


def _schema(required):
    return {
        "type": "object",
        "properties": {
            "name": {"type": "string"},
            "quantity": {"type": "integer", "minimum": 1, "maximum": 100},
            "date": {"type": "string", "format": "date-time"},
            "shift": {"type": "string"},
            "machine": {"type": "string"},
        },
        "required": required,
    }


def test_valid_json_matching_schema():
    validator = AIOutputValidator()
    result = asyncio.run(
        validator.validate(
            '{"name":"mill","quantity":5,"date":"2026-05-18T10:00:00+00:00"}',
            _schema(["name", "quantity", "date"]),
        )
    )

    assert result.ok is True
    assert result.parsed_output["quantity"] == 5


def test_json_in_markdown_block_is_extracted_and_validated():
    validator = AIOutputValidator()
    result = asyncio.run(
        validator.validate(
            '```json\n{"name":"mill","quantity":5,"date":"2026-05-18T10:00:00+00:00"}\n```',
            _schema(["name", "quantity", "date"]),
        )
    )

    assert result.ok is True
    assert result.parsed_output["name"] == "mill"


def test_invalid_json_returns_unparseable_error():
    validator = AIOutputValidator()
    result = asyncio.run(validator.validate("{bad json", _schema(["name"])))

    assert result.ok is False
    assert result.error_message == "unparseable JSON"


def test_json_missing_sixty_percent_required_fields_fails_below_confidence_threshold():
    validator = AIOutputValidator()
    result = asyncio.run(
        validator.validate(
            '{"name":"mill","quantity":5}',
            _schema(["name", "quantity", "date", "shift", "machine"]),
        )
    )

    assert result.ok is False
    assert result.confidence_score < 0.5


def test_json_missing_thirty_percent_required_fields_is_partial_but_ok():
    validator = AIOutputValidator()
    result = asyncio.run(
        validator.validate(
            '{"name":"mill","quantity":5,"date":"2026-05-18T10:00:00+00:00","shift":"night","machine":"press"}',
            _schema(["name", "quantity", "date", "shift", "machine", "operator", "location"]),
        )
    )

    assert result.ok is True
    assert result.is_partial is True


def test_numeric_field_outside_range_populates_validation_errors():
    validator = AIOutputValidator()
    result = asyncio.run(
        validator.validate(
            '{"name":"mill","quantity":500,"date":"2026-05-18T10:00:00+00:00"}',
            _schema(["name", "quantity", "date"]),
        )
    )

    assert result.ok is False
    assert any("quantity" in error for error in result.validation_errors)


def test_correction_pipeline_called_when_first_attempt_fails():
    class Provider:
        def __init__(self):
            self.calls = 0

        async def complete(self, prompt, config):
            self.calls += 1
            return RawAIResponse(
                content='{"name":"mill","quantity":5,"date":"2026-05-18T10:00:00+00:00"}',
                usage=TokenUsage(),
                provider="gemini",
                model=config.model,
                latency_ms=1,
            )

    provider = Provider()
    pipeline = CorrectionPipeline()
    result = asyncio.run(
        pipeline.attempt_correction(
            raw_content="bad",
            validation_errors=["unparseable JSON"],
            schema=_schema(["name", "quantity", "date"]),
            provider=provider,
        )
    )

    assert provider.calls == 1
    assert result.ok is True


def test_correction_pipeline_gives_up_after_two_attempts_and_returns_safe_fallback():
    class Provider:
        def __init__(self):
            self.calls = 0

        async def complete(self, prompt, config):
            self.calls += 1
            return RawAIResponse(
                content='{"quantity":500}',
                usage=TokenUsage(),
                provider="gemini",
                model=config.model,
                latency_ms=1,
            )

    provider = Provider()
    pipeline = CorrectionPipeline()
    result = asyncio.run(
        pipeline.attempt_correction(
            raw_content='{"quantity":500}',
            validation_errors=["quantity invalid"],
            schema=_schema(["name", "quantity", "date"]),
            provider=provider,
        )
    )

    assert provider.calls == 2
    assert result.ok is False
