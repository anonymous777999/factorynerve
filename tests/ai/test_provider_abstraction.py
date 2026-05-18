import asyncio
from types import SimpleNamespace

from backend.ai.prompts.base import RenderedPrompt
from backend.ai.providers.base import ProviderConfig, RawAIResponse, TokenUsage
from backend.ai.providers.gemini import GeminiProvider


def _prompt() -> RenderedPrompt:
    return RenderedPrompt(name="test", prompt_text="hello", variables={}, metadata={"api_key": "test-key"})


def _config() -> ProviderConfig:
    return ProviderConfig(model="gemini-1.5-flash", temperature=0.1, max_tokens=200, timeout_seconds=5)


def test_gemini_provider_returns_raw_ai_response_on_success(monkeypatch):
    import google.generativeai as genai  # type: ignore

    class FakeModel:
        def __init__(self, _model_name):
            pass

        def generate_content(self, _prompt):
            return SimpleNamespace(
                text='{"ok": true}',
                usage_metadata=SimpleNamespace(
                    prompt_token_count=10,
                    candidates_token_count=5,
                    total_token_count=15,
                ),
            )

    monkeypatch.setattr(genai, "configure", lambda **_kwargs: None)
    monkeypatch.setattr(genai, "GenerativeModel", FakeModel)

    provider = GeminiProvider()
    response = asyncio.run(provider.complete(_prompt(), _config()))

    assert isinstance(response, RawAIResponse)
    assert response.content == '{"ok": true}'
    assert response.provider == "gemini"
    assert response.usage.total_tokens == 15


def test_gemini_provider_returns_failure_response_on_5xx(monkeypatch):
    import google.generativeai as genai  # type: ignore

    class FakeError(Exception):
        status_code = 503

    class FakeModel:
        def __init__(self, _model_name):
            pass

        def generate_content(self, _prompt):
            raise FakeError("temporary outage")

    monkeypatch.setattr(genai, "configure", lambda **_kwargs: None)
    monkeypatch.setattr(genai, "GenerativeModel", FakeModel)

    provider = GeminiProvider()
    response = asyncio.run(provider.complete(_prompt(), _config()))

    assert isinstance(response, RawAIResponse)
    assert response.content is None
    assert response.status_code == 503
    assert response.error == "temporary outage"


def test_complete_with_retry_retries_exactly_three_times_on_429():
    class FakeProvider(GeminiProvider):
        def __init__(self):
            self.calls = 0

        async def complete(self, prompt, config):
            self.calls += 1
            return RawAIResponse(
                content=None,
                usage=TokenUsage(),
                provider="gemini",
                model=config.model,
                latency_ms=1,
                error="rate limited",
                status_code=429,
                retryable=True,
            )

    provider = FakeProvider()
    response = asyncio.run(provider.complete_with_retry(_prompt(), _config(), max_retries=3))

    assert provider.calls == 4
    assert response.content is None
    assert response.status_code == 429
    assert response.retry_count == 3


def test_complete_with_retry_does_not_retry_on_400():
    class FakeProvider(GeminiProvider):
        def __init__(self):
            self.calls = 0

        async def complete(self, prompt, config):
            self.calls += 1
            return RawAIResponse(
                content=None,
                usage=TokenUsage(),
                provider="gemini",
                model=config.model,
                latency_ms=1,
                error="bad request",
                status_code=400,
                retryable=False,
            )

    provider = FakeProvider()
    response = asyncio.run(provider.complete_with_retry(_prompt(), _config(), max_retries=3))

    assert provider.calls == 1
    assert response.status_code == 400


def test_estimated_cost_is_non_negative_for_valid_response(monkeypatch):
    import google.generativeai as genai  # type: ignore

    class FakeModel:
        def __init__(self, _model_name):
            pass

        def generate_content(self, _prompt):
            return SimpleNamespace(
                text='{"ok": true}',
                usage_metadata=SimpleNamespace(
                    prompt_token_count=1,
                    candidates_token_count=1,
                    total_token_count=2,
                ),
            )

    monkeypatch.setattr(genai, "configure", lambda **_kwargs: None)
    monkeypatch.setattr(genai, "GenerativeModel", FakeModel)

    provider = GeminiProvider()
    response = asyncio.run(provider.complete(_prompt(), _config()))

    assert response.usage.estimated_cost_usd >= 0.0
