import asyncio
from datetime import datetime, timedelta, timezone

from sqlalchemy import create_engine
from sqlalchemy.orm import sessionmaker

from backend.ai.caching.result_cache import AIResultCacheStore
from backend.ai.monitoring.usage_tracker import AIUsageTracker
from backend.ai.pipelines.ocr_pipeline import OCRPipeline
from backend.ai.providers.base import RawAIResponse, TokenUsage
from backend.ai.validators.output_validator import ValidationResult
from backend.database import Base
from backend.models.ai_result_cache import AIResultCache
from backend.models.ai_usage_log import AIUsageLog
from backend.models.organization import Organization


class StubProvider:
    provider_name = "stub"

    def __init__(self, responses):
        self.responses = list(responses)
        self.calls = 0

    async def complete(self, prompt, config):
        self.calls += 1
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

    async def attempt_correction(self, raw_content, validation_errors, schema, provider):
        return self.result


def _db_session():
    engine = create_engine("sqlite:///:memory:", future=True)
    Base.metadata.create_all(bind=engine)
    Session = sessionmaker(bind=engine, autoflush=False, autocommit=False, future=True)
    session = Session()
    session.add(
        Organization(
            org_id="org-1",
            name="Org 1",
            plan="free",
            ai_daily_token_cap=1000,
            ai_monthly_cost_cap_usd=10.0,
        )
    )
    session.add(
        Organization(
            org_id="org-2",
            name="Org 2",
            plan="free",
            ai_daily_token_cap=1000,
            ai_monthly_cost_cap_usd=10.0,
        )
    )
    session.commit()
    return session


def _success_raw():
    return RawAIResponse(
        content='{"name":"mill"}',
        usage=TokenUsage(input_tokens=10, output_tokens=5, total_tokens=15, estimated_cost_usd=0.01),
        provider="gemini",
        model="gemini-1.5-flash",
        latency_ms=12,
    )


def _success_validation():
    return ValidationResult(
        ok=True,
        parsed_output={"name": "mill"},
        validation_errors=[],
        confidence_score=1.0,
        is_partial=False,
    )


def test_cache_hit_returns_stored_result_provider_not_called():
    db = _db_session()
    cache = AIResultCacheStore(db)
    cache.set(
        org_id="org-1",
        document_content="doc-1",
        prompt_name="ocr_extraction",
        prompt_version="v1",
        result=OCRPipeline._failure_result(  # type: ignore[attr-defined]
            raw=_success_raw(),
            retry_count=0,
            total_latency_ms=12,
            error_message=None,
            validation_errors=[],
            confidence_score=1.0,
            extracted_fields={"name": "mill"},
            partial_extraction=False,
        ),
        ttl_seconds=3600,
    )
    provider = StubProvider([_success_raw()])
    tracker = AIUsageTracker(db)
    pipeline = OCRPipeline(
        provider=provider,
        validator=StubValidator(_success_validation()),
        correction_pipeline=StubCorrectionPipeline(_success_validation()),
        db=db,
        result_cache=cache,
        usage_tracker=tracker,
    )

    result = asyncio.run(pipeline.run("doc-1", {"type": "object"}, "org-1"))

    assert result.extracted_fields == {"name": "mill"}
    assert provider.calls == 0


def test_cache_miss_calls_provider_and_stores_result_for_next_request():
    db = _db_session()
    cache = AIResultCacheStore(db)
    provider = StubProvider([_success_raw()])
    tracker = AIUsageTracker(db)
    pipeline = OCRPipeline(
        provider=provider,
        validator=StubValidator(_success_validation()),
        correction_pipeline=StubCorrectionPipeline(_success_validation()),
        db=db,
        result_cache=cache,
        usage_tracker=tracker,
    )

    first = asyncio.run(pipeline.run("doc-2", {"type": "object"}, "org-1"))
    cached = cache.get(org_id="org-1", document_content="doc-2", prompt_name="ocr_extraction", prompt_version="v1")

    assert first.success is True
    assert provider.calls == 1
    assert cached is not None


def test_org_over_daily_token_cap_raises_before_provider_call():
    db = _db_session()
    db.query(Organization).filter(Organization.org_id == "org-1").update({"ai_daily_token_cap": 5})
    db.add(
        AIUsageLog(
            org_id="org-1",
            pipeline_name="ocr_pipeline",
            prompt_name="ocr_extraction",
            prompt_version="v1",
            model="gemini",
            input_tokens=4,
            output_tokens=4,
            estimated_cost_usd=0.01,
            cache_hit=False,
            success=True,
            latency_ms=1,
        )
    )
    db.commit()
    provider = StubProvider([_success_raw()])
    pipeline = OCRPipeline(
        provider=provider,
        validator=StubValidator(_success_validation()),
        correction_pipeline=StubCorrectionPipeline(_success_validation()),
        db=db,
        usage_tracker=AIUsageTracker(db),
        result_cache=AIResultCacheStore(db),
    )

    try:
        asyncio.run(pipeline.run("doc-3", {"type": "object"}, "org-1"))
    except Exception as error:
        assert getattr(error, "status_code", None) == 429
    else:
        raise AssertionError("Expected token cap failure")
    assert provider.calls == 0


def test_org_over_monthly_cost_cap_raises_before_provider_call():
    db = _db_session()
    db.query(Organization).filter(Organization.org_id == "org-1").update({"ai_monthly_cost_cap_usd": 0.02})
    db.add(
        AIUsageLog(
            org_id="org-1",
            pipeline_name="ocr_pipeline",
            prompt_name="ocr_extraction",
            prompt_version="v1",
            model="gemini",
            input_tokens=1,
            output_tokens=1,
            estimated_cost_usd=0.03,
            cache_hit=False,
            success=True,
            latency_ms=1,
            created_at=datetime.now(timezone.utc) - timedelta(hours=1),
        )
    )
    db.commit()
    provider = StubProvider([_success_raw()])
    pipeline = OCRPipeline(
        provider=provider,
        validator=StubValidator(_success_validation()),
        correction_pipeline=StubCorrectionPipeline(_success_validation()),
        db=db,
        usage_tracker=AIUsageTracker(db),
        result_cache=AIResultCacheStore(db),
    )

    try:
        asyncio.run(pipeline.run("doc-4", {"type": "object"}, "org-1"))
    except Exception as error:
        assert getattr(error, "status_code", None) == 429
    else:
        raise AssertionError("Expected cost cap failure")
    assert provider.calls == 0


def test_usage_tracker_logs_every_call_including_cache_hits():
    db = _db_session()
    cache = AIResultCacheStore(db)
    tracker = AIUsageTracker(db)
    cache.set(
        org_id="org-1",
        document_content="doc-5",
        prompt_name="ocr_extraction",
        prompt_version="v1",
        result=OCRPipeline._failure_result(  # type: ignore[attr-defined]
            raw=_success_raw(),
            retry_count=0,
            total_latency_ms=12,
            error_message=None,
            validation_errors=[],
            confidence_score=1.0,
            extracted_fields={"name": "mill"},
            partial_extraction=False,
        ),
        ttl_seconds=3600,
    )
    provider = StubProvider([_success_raw()])
    pipeline = OCRPipeline(
        provider=provider,
        validator=StubValidator(_success_validation()),
        correction_pipeline=StubCorrectionPipeline(_success_validation()),
        db=db,
        result_cache=cache,
        usage_tracker=tracker,
    )

    asyncio.run(pipeline.run("doc-5", {"type": "object"}, "org-1"))
    rows = db.query(AIUsageLog).all()

    assert len(rows) == 1
    assert rows[0].cache_hit is True


def test_duplicate_document_upload_returns_cached_ocr_result():
    db = _db_session()
    provider = StubProvider([_success_raw()])
    pipeline = OCRPipeline(
        provider=provider,
        validator=StubValidator(_success_validation()),
        correction_pipeline=StubCorrectionPipeline(_success_validation()),
        db=db,
        result_cache=AIResultCacheStore(db),
        usage_tracker=AIUsageTracker(db),
    )

    first = asyncio.run(pipeline.run("same-document", {"type": "object"}, "org-1"))
    second = asyncio.run(pipeline.run("same-document", {"type": "object"}, "org-1"))

    assert first.extracted_fields == second.extracted_fields
    assert provider.calls == 1
