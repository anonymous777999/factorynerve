from backend.services import ai_router


def test_ai_router_prefers_configured_primary_provider(monkeypatch):
    monkeypatch.setenv("AI_PROVIDER", "groq")
    monkeypatch.delenv("AI_PROVIDER_CHAIN", raising=False)
    ai_router._breakers.clear()

    calls: list[str] = []

    monkeypatch.setattr(ai_router, "_has_key", lambda provider: provider in {"groq", "anthropic"})
    monkeypatch.setattr(ai_router, "_retry", lambda fn, *, provider: fn())

    def fake_run(provider: str, prompt: str, *, max_tokens: int) -> str:
        del prompt, max_tokens
        calls.append(provider)
        if provider == "groq":
            return "groq result"
        raise AssertionError("Fallback provider should not be used when Groq succeeds.")

    monkeypatch.setattr(ai_router, "_run_provider", fake_run)

    result = ai_router._generate("hello", max_tokens=32, scope="unit-test")

    assert result == "groq result"
    assert calls == ["groq"]
    assert ai_router.primary_provider_label().startswith("groq")
