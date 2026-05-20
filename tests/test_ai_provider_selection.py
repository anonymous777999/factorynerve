from backend.ai.providers.base import RawAIResponse, TokenUsage
from backend.services import ai_router


def test_ai_router_prefers_configured_primary_provider(monkeypatch):
    monkeypatch.setenv("AI_PROVIDER", "groq")
    monkeypatch.delenv("AI_PROVIDER_CHAIN", raising=False)
    ai_router._breakers.clear()

    calls: list[str] = []

    monkeypatch.setattr(ai_router, "_has_key", lambda provider: provider in {"groq", "anthropic"})
    monkeypatch.setattr(ai_router, "governed_provider_chain", lambda providers, *, system: (providers, []))
    monkeypatch.setattr(ai_router, "allow_provider", lambda provider, *, system: True)

    def fake_retry(fn, *, provider):
        calls.append(provider)
        return fn(), 0, False

    def fake_run(provider: str, prompt: str, *, max_tokens: int) -> RawAIResponse:
        del prompt, max_tokens
        if provider == "groq":
            return RawAIResponse(
                content="groq result",
                usage=TokenUsage(total_tokens=12),
                provider="groq",
                model="groq-model",
                latency_ms=7,
            )
        raise AssertionError("Fallback provider should not be used when Groq succeeds.")

    monkeypatch.setattr(ai_router, "_retry", fake_retry)
    monkeypatch.setattr(ai_router, "_run_provider_response", fake_run)
    monkeypatch.setattr(ai_router, "_validate_text_output", lambda raw_text: raw_text)

    result = ai_router._generate_text_result(
        "hello",
        fallback="fallback",
        scope="unit-test",
        max_tokens=32,
        governance_system="executive_summary",
    )

    assert result.text == "groq result"
    assert result.provider == "groq"
    assert result.ai_used is True
    assert calls == ["groq"]
    assert ai_router.primary_provider_label().startswith("groq")
