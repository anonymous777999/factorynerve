"""Model tier routing and cost estimation for Factory Intelligence."""

from __future__ import annotations

import os
from typing import Any

from backend.services.intelligence.schemas import ClassificationResult, ModelSelection, ModelTier


TIER_ORDER: dict[str, int] = {"haiku": 0, "sonnet": 1, "opus": 2}
DEFAULT_PROVIDER_CHAIN = ["anthropic", "openai", "groq"]


def _is_configured_secret(value: str | None) -> bool:
    normalized = (value or "").strip()
    if not normalized:
        return False
    return normalized.lower() not in {"test", "dummy", "placeholder", "example"}


def provider_chain() -> list[str]:
    raw = (os.getenv("INTELLIGENCE_PROVIDER_CHAIN") or "").strip()
    if not raw:
        return list(DEFAULT_PROVIDER_CHAIN)
    chain: list[str] = []
    seen: set[str] = set()
    for item in raw.split(","):
        normalized = item.strip().lower()
        if normalized and normalized not in seen:
            chain.append(normalized)
            seen.add(normalized)
    return chain or list(DEFAULT_PROVIDER_CHAIN)


def select_model_for_classification(classification: ClassificationResult) -> ModelSelection:
    if classification.complexity == "simple":
        tier: ModelTier = "haiku"
        reasoning = "Simple extraction and low-risk formatting should use the cheapest tier first."
    elif classification.complexity == "medium":
        tier = "sonnet"
        reasoning = "Structured parsing with moderate ambiguity needs a balanced reasoning tier."
    else:
        tier = "opus"
        reasoning = "Complex documents with likely anomalies should start on the highest reasoning tier."
    return ModelSelection(tier=tier, provider_chain=provider_chain(), reasoning=reasoning)


def stage_starting_tier(stage_name: str, selected_tier: str) -> str:
    if stage_name in {"validation", "anomaly_detection", "loss_estimation"} and TIER_ORDER[selected_tier] < TIER_ORDER["sonnet"]:
        return "sonnet"
    return selected_tier


def escalation_chain(start_tier: str) -> list[str]:
    if start_tier == "haiku":
        return ["haiku", "sonnet", "opus"]
    if start_tier == "sonnet":
        return ["sonnet", "opus"]
    return ["opus"]


def resolve_model_name(provider: str, tier: str) -> str:
    key = provider.strip().lower()
    if key == "anthropic":
        return os.getenv(f"INTELLIGENCE_{tier.upper()}_MODEL", {
            "haiku": "claude-3-5-haiku-latest",
            "sonnet": "claude-3-5-sonnet-latest",
            "opus": "claude-3-opus-latest",
        }[tier])
    if key == "openai":
        return os.getenv(f"INTELLIGENCE_OPENAI_{tier.upper()}_MODEL", {
            "haiku": "gpt-4o-mini",
            "sonnet": "gpt-4.1-mini",
            "opus": "gpt-4.1",
        }[tier])
    if key == "groq":
        return os.getenv(f"INTELLIGENCE_GROQ_{tier.upper()}_MODEL", {
            "haiku": "llama-3.1-8b-instant",
            "sonnet": "llama-3.3-70b-versatile",
            "opus": "llama-3.3-70b-versatile",
        }[tier])
    return f"{provider}:{tier}"


def provider_has_key(provider: str) -> bool:
    key = provider.strip().lower()
    if key == "anthropic":
        return _is_configured_secret(os.getenv("ANTHROPIC_API_KEY"))
    if key == "openai":
        return _is_configured_secret(os.getenv("OPENAI_API_KEY"))
    if key == "groq":
        return _is_configured_secret(os.getenv("GROQ_API_KEY"))
    return False


def estimate_tokens(text: str) -> int:
    return max(1, int(len(text or "") / 4))


def estimate_cost_usd(tier: str, prompt_tokens: int, completion_tokens: int) -> float:
    input_rate = float(os.getenv(f"INTELLIGENCE_{tier.upper()}_INPUT_COST_PER_1K", {
        "haiku": "0.0010",
        "sonnet": "0.0030",
        "opus": "0.0150",
    }[tier]))
    output_rate = float(os.getenv(f"INTELLIGENCE_{tier.upper()}_OUTPUT_COST_PER_1K", {
        "haiku": "0.0025",
        "sonnet": "0.0150",
        "opus": "0.0750",
    }[tier]))
    return round(((prompt_tokens / 1000.0) * input_rate) + ((completion_tokens / 1000.0) * output_rate), 6)


def json_safe(value: Any) -> Any:
    if isinstance(value, dict):
        return {str(key): json_safe(item) for key, item in value.items()}
    if isinstance(value, list):
        return [json_safe(item) for item in value]
    return value
