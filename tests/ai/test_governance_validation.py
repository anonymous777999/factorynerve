from __future__ import annotations

import asyncio
from concurrent.futures import ThreadPoolExecutor
from types import SimpleNamespace

from fastapi.testclient import TestClient

from backend.ai.monitoring import governance as governance_module
from backend.ai.monitoring import telemetry as telemetry_module
from backend.ai.monitoring.governance import (
    allow_provider,
    cap_retry_attempts,
    governance_snapshot,
    governed_provider_chain,
    record_provider_attempt,
)
from backend.ai.monitoring.telemetry import ai_dashboard_payload, ai_health_snapshot, record_ai_event
from backend.ai.pipelines.ocr_pipeline import OCRPipeline
from backend.ai.providers.base import ProviderConfig, RawAIResponse, TokenUsage, retry_provider_call
from backend.ai.prompts.base import RenderedPrompt
from backend.ai.services.parse_service import ParseService
from backend.ai.validators.correction_pipeline import CorrectionPipeline
from backend.ai.validators.output_validator import ValidationResult
from backend.main import app


def _reset_state() -> None:
    with governance_module._lock:
        governance_module._provider_states.clear()
        governance_module._workflow_states.clear()
    with telemetry_module._lock:
        telemetry_module._events.clear()


class SequenceProvider:
    provider_name = "gemini"

    def __init__(self, responses):
        self.responses = list(responses)
        self.calls = 0

    async def complete(self, prompt, config):
        del prompt, config
        self.calls += 1
        next_item = self.responses.pop(0)
        if isinstance(next_item, Exception):
            raise next_item
        return next_item

    async def complete_with_retry(self, prompt, config, max_retries=3):
        del max_retries
        return await self.complete(prompt, config)


class StaticValidator:
    def __init__(self, result: ValidationResult):
        self.result = result

    async def validate(self, raw_content, expected_schema):
        del raw_content, expected_schema
        return self.result


def test_provider_suppresses_after_timeout_storm_and_recovers(monkeypatch):
    _reset_state()
    timeline = {"now": 1_000.0}
    monkeypatch.setattr(governance_module.time, "time", lambda: timeline["now"])

    record_provider_attempt(provider="groq", system="executive_summary", success=False, timeout_hit=True, degraded=True, latency_ms=25_000)
    record_provider_attempt(provider="groq", system="executive_summary", success=False, timeout_hit=True, degraded=True, latency_ms=25_000)
    record_provider_attempt(provider="groq", system="executive_summary", success=False, timeout_hit=True, degraded=True, latency_ms=25_000)

    assert allow_provider("groq", system="executive_summary") is False

    timeline["now"] += governance_module._COOLDOWN_SECONDS + 1
    assert allow_provider("groq", system="executive_summary") is True


def test_governed_provider_chain_skips_suppressed_provider_only(monkeypatch):
    _reset_state()
    timeline = {"now": 2_000.0}
    monkeypatch.setattr(governance_module.time, "time", lambda: timeline["now"])

    for _ in range(governance_module._TIMEOUT_THRESHOLD):
        record_provider_attempt(provider="groq", system="nlq", success=False, timeout_hit=True, degraded=True, latency_ms=30_000)

    allowed, suppressed = governed_provider_chain(["groq", "anthropic", "openai"], system="nlq")

    assert "groq" not in allowed
    assert "groq" in suppressed
    assert allowed == ["anthropic", "openai"]


def test_retry_caps_remain_bounded_for_typed_provider(monkeypatch):
    _reset_state()
    async def immediate_sleep(_seconds):
        return None

    monkeypatch.setattr("backend.ai.providers.base.asyncio.sleep", immediate_sleep)

    class FlakyProvider:
        provider_name = "gemini"

        def __init__(self):
            self.calls = 0

        async def complete(self, prompt, config):
            del prompt, config
            self.calls += 1
            return RawAIResponse(
                content=None,
                usage=TokenUsage(),
                provider="gemini",
                model="gemini-1.5-flash",
                latency_ms=1,
                error="rate limited",
                status_code=429,
                retryable=True,
            )

    provider = FlakyProvider()
    response = asyncio.run(
        retry_provider_call(
            provider,
            SimpleNamespace(prompt_text="hello"),
            ProviderConfig(model="gemini-1.5-flash", temperature=0.0, max_tokens=32, timeout_seconds=2),
            max_retries=99,
        )
    )

    assert provider.calls == 1 + cap_retry_attempts(99, mode="typed")
    assert response.retry_count == cap_retry_attempts(99, mode="typed")


def test_router_fallback_chain_terminates_and_marks_degraded(monkeypatch):
    _reset_state()
    from backend.services import ai_router

    ai_router._breakers.clear()
    monkeypatch.setattr(ai_router, "_provider_chain", lambda: ["groq", "anthropic", "openai"])
    monkeypatch.setattr(ai_router, "_has_key", lambda provider: True)
    monkeypatch.setattr(ai_router, "governed_provider_chain", lambda providers, *, system: (["anthropic"], ["groq", "openai"]))
    monkeypatch.setattr(ai_router, "allow_provider", lambda provider, *, system: provider == "anthropic")
    monkeypatch.setattr(ai_router, "_validate_text_output", lambda raw_text: raw_text)

    def fake_retry(fn, *, provider):
        return fn(), 1, False

    def fake_run(provider: str, prompt: str, *, max_tokens: int):
        del prompt, max_tokens
        return RawAIResponse(
            content=f"{provider} ok",
            usage=TokenUsage(total_tokens=22),
            provider=provider,
            model=f"{provider}-model",
            latency_ms=9,
        )

    monkeypatch.setattr(ai_router, "_retry", fake_retry)
    monkeypatch.setattr(ai_router, "_run_provider_response", fake_run)

    result = ai_router._generate_text_result(
        "hello",
        fallback="fallback",
        scope="unit-test",
        max_tokens=24,
        governance_system="recommendations",
    )

    assert result.text == "anthropic ok"
    assert result.provider == "anthropic"
    assert result.degraded_mode is True
    assert result.fallback_used is True
    assert result.retry_count == 1


def test_intelligence_stage_skips_suppressed_provider_and_uses_fallback(monkeypatch):
    _reset_state()
    from backend.services.intelligence import provider as intelligence_provider

    monkeypatch.setattr(intelligence_provider, "provider_has_key", lambda provider: True)
    monkeypatch.setattr(intelligence_provider, "resolve_model_name", lambda provider, tier: f"{provider}-{tier}")

    def fake_runner(provider_name: str):
        def _runner(prompt: str, model_name: str) -> str:
            del prompt
            if provider_name == "anthropic":
                return '{"ok": true}'
            raise RuntimeError(f"{provider_name} should have been suppressed")

        return _runner

    async def fake_validate(payload, schema):
        del payload, schema
        return SimpleNamespace(ok=True, parsed_output={"ok": True})

    monkeypatch.setattr(intelligence_provider, "_provider_callable", fake_runner)
    monkeypatch.setattr(intelligence_provider, "_VALIDATOR", SimpleNamespace(validate=fake_validate))

    for _ in range(governance_module._TIMEOUT_THRESHOLD):
        record_provider_attempt(provider="groq", system="data_structuring", success=False, timeout_hit=True, degraded=True, latency_ms=30_000)

    result = intelligence_provider.invoke_stage_model(
        stage_name="data_structuring",
        prompt="hello",
        tier="haiku",
        provider_chain=["groq", "anthropic"],
        prompt_hash="hash",
        fallback_builder=lambda: {"fallback": True},
    )

    assert result.provider == "anthropic"
    assert result.payload == {"ok": True}
    assert result.retry_count == 0


def test_telemetry_failure_is_isolated_from_ocr_flow(monkeypatch):
    _reset_state()
    monkeypatch.setattr(governance_module, "record_workflow_event", lambda **kwargs: (_ for _ in ()).throw(RuntimeError("telemetry down")))

    provider = SequenceProvider(
        [
            RawAIResponse(
                content='{"name":"mill"}',
                usage=TokenUsage(total_tokens=10),
                provider="gemini",
                model="gemini-1.5-flash",
                latency_ms=3,
            )
        ]
    )
    pipeline = OCRPipeline(
        provider=provider,
        validator=StaticValidator(
            ValidationResult(
                ok=True,
                parsed_output={"name": "mill"},
                validation_errors=[],
                confidence_score=0.92,
                is_partial=False,
            )
        ),
        correction_pipeline=SimpleNamespace(
            attempt_correction=lambda **kwargs: ValidationResult(
                ok=True,
                parsed_output={"name": "mill"},
                validation_errors=[],
                confidence_score=0.92,
                is_partial=False,
            )
        ),
        usage_logger=lambda **kwargs: None,
    )

    result = asyncio.run(pipeline.run("ocr text", {"type": "object"}, "org-1"))

    assert result.success is True
    assert result.extracted_fields == {"name": "mill"}


def test_parse_service_respects_governance_suppression_without_crashing():
    _reset_state()
    for _ in range(governance_module._TIMEOUT_THRESHOLD):
        record_provider_attempt(provider="gemini", system="typed_provider", success=False, timeout_hit=True, degraded=True, latency_ms=20_000)

    class GovernanceAwareProvider:
        provider_name = "gemini"

        async def complete(self, prompt, config):
            del prompt, config
            return RawAIResponse(
                content='{"ok": true}',
                usage=TokenUsage(total_tokens=4),
                provider="gemini",
                model="gemini-1.5-flash",
                latency_ms=1,
            )

        async def complete_with_retry(self, prompt, config, max_retries=3):
            return await retry_provider_call(self, prompt, config, max_retries=max_retries)

    service = ParseService(
        provider=GovernanceAwareProvider(),
        validator=StaticValidator(ValidationResult(ok=True, parsed_output={"ok": True}, validation_errors=[], confidence_score=1.0, is_partial=False)),
    )
    result = asyncio.run(service.parse_document("hello", {"type": "object"}))

    assert result.success is False
    assert result.error_message
    assert "suppressed" in (result.error_message or "").lower()


def test_correction_pipeline_records_retry_and_succeeds():
    _reset_state()
    provider = SequenceProvider(
        [
            RawAIResponse(content='{"bad": true}', usage=TokenUsage(total_tokens=6), provider="gemini", model="gemini", latency_ms=4),
            RawAIResponse(content='{"ok": true}', usage=TokenUsage(total_tokens=8), provider="gemini", model="gemini", latency_ms=5),
        ]
    )

    class CorrectionValidator:
        def __init__(self):
            self.calls = 0

        async def validate(self, raw_content, schema):
            del schema
            self.calls += 1
            if self.calls == 1:
                return ValidationResult(ok=False, parsed_output=None, validation_errors=["bad json"], confidence_score=0.2, is_partial=False)
            return ValidationResult(ok=True, parsed_output={"ok": True}, validation_errors=[], confidence_score=0.9, is_partial=False)

    pipeline = CorrectionPipeline(validator=CorrectionValidator(), provider_config=ProviderConfig(model="gemini", temperature=0.0, max_tokens=64, timeout_seconds=2))
    result = asyncio.run(
        pipeline.attempt_correction(
            raw_content='{"broken": true}',
            validation_errors=["schema mismatch"],
            schema={"type": "object"},
            provider=provider,
        )
    )

    assert result.ok is True
    dashboard = ai_dashboard_payload()
    correction_events = [event for event in dashboard["recent_events"] if event["system"] == "correction_pipeline"]
    assert correction_events
    assert correction_events[0]["retry_count"] == 1
    assert correction_events[0]["correction_applied"] is True


def test_whatsapp_and_summary_telemetry_provider_attribution(monkeypatch):
    _reset_state()
    from backend.services import ai_router

    ai_router._breakers.clear()
    monkeypatch.setattr(ai_router, "_provider_chain", lambda: ["groq"])
    monkeypatch.setattr(ai_router, "_has_key", lambda provider: True)
    monkeypatch.setattr(ai_router, "governed_provider_chain", lambda providers, *, system: (providers, []))
    monkeypatch.setattr(ai_router, "allow_provider", lambda provider, *, system: True)
    monkeypatch.setattr(ai_router, "_validate_text_output", lambda raw_text: raw_text)
    monkeypatch.setattr(
        ai_router,
        "_retry",
        lambda fn, *, provider: (
            RawAIResponse(
                content="summary ok",
                usage=TokenUsage(total_tokens=17),
                provider="groq",
                model="groq-model",
                latency_ms=6,
            ),
            0,
            False,
        ),
    )
    monkeypatch.setattr(ai_router, "_run_provider_response", lambda provider, prompt, *, max_tokens: RawAIResponse(content="unused", usage=TokenUsage(total_tokens=17), provider=provider, model="groq-model", latency_ms=6))

    text = ai_router.generate_summary({"date": "2026-05-20", "shift": "A", "units_produced": 10, "units_target": 12, "downtime_minutes": 3})
    assert text

    record_ai_event(
        system="whatsapp_parsing",
        operation="parse_export",
        provider="rules-engine",
        model="rules-engine",
        latency_ms=2,
        token_estimate=0,
        fallback_used=False,
        degraded_mode=False,
        retry_count=0,
        timeout_hit=False,
        correction_applied=False,
        confidence_score=1.0,
        hallucination_blocked=False,
        rules_engine_used=True,
        success=True,
    )
    snapshot = ai_dashboard_payload()
    systems = {event["system"]: event["provider"] for event in snapshot["recent_events"] if event["system"] in {"entry_summary", "whatsapp_parsing"}}
    assert systems["entry_summary"] == "groq"
    assert systems["whatsapp_parsing"] == "rules-engine"


def test_observability_governance_endpoint_isolated(monkeypatch):
    _reset_state()
    monkeypatch.setenv("METRICS_TOKEN", "secret-token")
    client = TestClient(app)
    try:
        response = client.get("/observability/ai/governance", headers={"X-Metrics-Token": "secret-token"})
    finally:
        client.close()

    assert response.status_code == 200
    payload = response.json()
    assert "rules" in payload.get("data", payload)
    assert "providers" in payload.get("data", payload)


def test_governance_and_telemetry_hot_path_overhead_stays_small():
    _reset_state()

    def emit_events():
        for _ in range(200):
            record_provider_attempt(provider="groq", system="executive_summary", success=True, timeout_hit=False, degraded=False, latency_ms=5)
            record_ai_event(
                system="executive_summary",
                operation="generate_text",
                provider="groq",
                model="groq-model",
                latency_ms=5,
                token_estimate=20,
                fallback_used=False,
                degraded_mode=False,
                retry_count=0,
                timeout_hit=False,
                correction_applied=False,
                confidence_score=0.9,
                hallucination_blocked=False,
                rules_engine_used=False,
                success=True,
            )

    with ThreadPoolExecutor(max_workers=4) as executor:
        futures = [executor.submit(emit_events) for _ in range(4)]
        for future in futures:
            future.result()

    snapshot = governance_snapshot()
    dashboard = ai_dashboard_payload()
    assert dashboard["summary"]["total_requests"] >= 800
    assert snapshot["providers"]
    assert snapshot["workflow_costs"]
    assert len(dashboard["recent_events"]) <= 25
    assert telemetry_module._events.maxlen >= len(dashboard["recent_events"])
