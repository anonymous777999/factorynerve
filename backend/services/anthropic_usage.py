"""Anthropic model normalization, verification, usage extraction, and cost helpers."""

from __future__ import annotations

from decimal import Decimal, ROUND_HALF_UP
import logging
import os
from typing import Any, Mapping


ANTHROPIC_MODEL_HAIKU = "claude-haiku-4-5-20251001"
ANTHROPIC_MODEL_SONNET = "claude-sonnet-4-6"
ANTHROPIC_MODEL_OPUS = "claude-opus-4-7"

_MILLION = Decimal("1000000")
_COST_QUANTUM = Decimal("0.000001")
_UNKNOWN_TOKEN_VALUE = -1
_DEFAULT_MAX_RETRIES = 3
_DEFAULT_MAX_COST_USD = 0.50
_DEFAULT_CONFIDENCE_THRESHOLD = 60.0
_UPGRADE_PATH = [
    ANTHROPIC_MODEL_HAIKU,
    ANTHROPIC_MODEL_SONNET,
    ANTHROPIC_MODEL_OPUS,
]
logger = logging.getLogger(__name__)

_MODEL_SELECTION_ALIASES: dict[str, str] = {
    "fast": ANTHROPIC_MODEL_HAIKU,
    "haiku": ANTHROPIC_MODEL_HAIKU,
    ANTHROPIC_MODEL_HAIKU: ANTHROPIC_MODEL_HAIKU,
    "claude-haiku-4-5": ANTHROPIC_MODEL_HAIKU,
    "balanced": ANTHROPIC_MODEL_SONNET,
    "sonnet": ANTHROPIC_MODEL_SONNET,
    ANTHROPIC_MODEL_SONNET: ANTHROPIC_MODEL_SONNET,
    "claude-sonnet-5": ANTHROPIC_MODEL_SONNET,
    "claude-sonnet-4-20250514": ANTHROPIC_MODEL_SONNET,
    "claude-sonnet-4-5-20250929": ANTHROPIC_MODEL_SONNET,
    "best": ANTHROPIC_MODEL_OPUS,
    "opus": ANTHROPIC_MODEL_OPUS,
    "oppus": ANTHROPIC_MODEL_OPUS,  # Fix Bug #17: common typo
    ANTHROPIC_MODEL_OPUS: ANTHROPIC_MODEL_OPUS,
    "claude-3-5-haiku-20241022": "claude-3-5-haiku-20241022",
    "claude-haiku-4-5-20251001": ANTHROPIC_MODEL_HAIKU,
    "claude-3-5-sonnet-20241022": "claude-3-5-sonnet-20241022",
}

_MODEL_PRICING: dict[str, dict[str, Decimal | str]] = {
    ANTHROPIC_MODEL_HAIKU: {
        "display_name": "Claude Haiku 4.5",
        "input_per_million_usd": Decimal("1"),
        "output_per_million_usd": Decimal("5"),
    },
    ANTHROPIC_MODEL_SONNET: {
        "display_name": "Claude Sonnet 4.6",
        "input_per_million_usd": Decimal("3"),
        "output_per_million_usd": Decimal("15"),
    },
    ANTHROPIC_MODEL_OPUS: {
        "display_name": "Claude Opus 4.7",
        "input_per_million_usd": Decimal("5"),
        "output_per_million_usd": Decimal("25"),
    },
    "claude-3-5-haiku-20241022": {
        "display_name": "Claude Haiku 3.5",
        "input_per_million_usd": Decimal("0.8"),
        "output_per_million_usd": Decimal("4"),
    },
    "claude-sonnet-4-20250514": {
        "display_name": "Claude Sonnet 4",
        "input_per_million_usd": Decimal("3"),
        "output_per_million_usd": Decimal("15"),
    },
    "claude-sonnet-4-5-20250929": {
        "display_name": "Claude Sonnet 4.5",
        "input_per_million_usd": Decimal("3"),
        "output_per_million_usd": Decimal("15"),
    },
    "claude-3-5-sonnet-20241022": {
        "display_name": "Claude Sonnet 3.5",
        "input_per_million_usd": Decimal("3"),
        "output_per_million_usd": Decimal("15"),
    },
}


def normalize_anthropic_model_name(value: str | None) -> str | None:
    normalized = (value or "").strip().lower()
    if not normalized or normalized == "auto":
        return None
    return _MODEL_SELECTION_ALIASES.get(normalized)


def resolve_anthropic_model_tier(model_name: str | None) -> str:
    normalized = normalize_anthropic_model_name(model_name) or (model_name or "").strip().lower()
    if normalized in {ANTHROPIC_MODEL_HAIKU, "claude-haiku-4-5", "claude-3-5-haiku-20241022"}:
        return "fast"
    if normalized in {
        ANTHROPIC_MODEL_SONNET,
        "claude-sonnet-5",
        "claude-sonnet-4-20250514",
        "claude-sonnet-4-5-20250929",
        "claude-3-5-sonnet-20241022",
    }:
        return "balanced"
    if normalized == ANTHROPIC_MODEL_OPUS:
        return "best"
    return "balanced"


def get_next_anthropic_model_upgrade(model_name: str | None) -> str | None:
    normalized = normalize_anthropic_model_name(model_name) or (model_name or "").strip().lower()
    if normalized not in _UPGRADE_PATH:
        return None
    current_index = _UPGRADE_PATH.index(normalized)
    if current_index + 1 >= len(_UPGRADE_PATH):
        return None
    return _UPGRADE_PATH[current_index + 1]


def get_ocr_max_retries() -> int:
    raw = os.getenv("MAX_RETRIES", str(_DEFAULT_MAX_RETRIES)).strip()
    try:
        return max(1, int(raw))
    except ValueError:
        return _DEFAULT_MAX_RETRIES


def get_ocr_max_cost_usd() -> float:
    raw = os.getenv("MAX_COST_USD", str(_DEFAULT_MAX_COST_USD)).strip()
    try:
        return max(0.0, float(raw))
    except ValueError:
        return _DEFAULT_MAX_COST_USD


def get_ocr_confidence_threshold() -> float:
    raw = os.getenv("CONFIDENCE_THRESHOLD", str(_DEFAULT_CONFIDENCE_THRESHOLD)).strip()
    try:
        return max(0.0, min(100.0, float(raw)))
    except ValueError:
        return _DEFAULT_CONFIDENCE_THRESHOLD


def is_production_env() -> bool:
    env_mode = (os.getenv("ENV_MODE") or "").strip().lower()
    app_env = (os.getenv("APP_ENV") or "").strip().lower()
    return env_mode == "production" or app_env == "production"


def get_anthropic_pricing(model_name: str | None) -> dict[str, Any]:
    normalized = normalize_anthropic_model_name(model_name) or (model_name or "").strip().lower()
    pricing = _MODEL_PRICING.get(normalized) or _MODEL_PRICING[ANTHROPIC_MODEL_SONNET]
    return {
        "model": normalized or ANTHROPIC_MODEL_SONNET,
        "display_name": str(pricing["display_name"]),
        "input_per_million_usd": float(pricing["input_per_million_usd"]),
        "output_per_million_usd": float(pricing["output_per_million_usd"]),
    }


def extract_response_model(response_payload: Any) -> str | None:
    raw_model = response_payload.get("model") if isinstance(response_payload, Mapping) else getattr(response_payload, "model", None)
    normalized = normalize_anthropic_model_name(str(raw_model or ""))
    if normalized:
        return normalized
    if raw_model is None:
        return None
    text = str(raw_model).strip()
    return text or None


def verify_anthropic_response_model(
    requested_model: str | None,
    response_payload: Any,
    *,
    context: str,
) -> str:
    normalized_requested = normalize_anthropic_model_name(requested_model) or (requested_model or "").strip().lower()
    actual_model = extract_response_model(response_payload)
    normalized_actual = normalize_anthropic_model_name(actual_model) or (actual_model or "").strip().lower()
    if normalized_requested and normalized_actual and normalized_requested != normalized_actual:
        message = (
            f"{context} model mismatch. Requested={normalized_requested}, actual={normalized_actual}."
        )
        if is_production_env():
            raise ValueError(message)
        logger.warning("%s Continuing because environment is non-production.", message)
    return normalized_actual or normalized_requested or actual_model or requested_model or ""


def extract_anthropic_usage(response_payload: Any) -> dict[str, int | bool | str]:
    usage = response_payload.get("usage") if isinstance(response_payload, Mapping) else getattr(response_payload, "usage", None)
    if usage is None:
        return _handle_unknown_usage("Anthropic response did not include usage.")

    getter = usage.get if isinstance(usage, Mapping) else lambda key, default=None: getattr(usage, key, default)
    raw_input = getter("input_tokens", None)
    raw_output = getter("output_tokens", None)
    if raw_input is None or raw_output is None:
        return _handle_unknown_usage("Anthropic response usage was missing input/output token values.")

    input_tokens = _coerce_token_value(raw_input)
    output_tokens = _coerce_token_value(raw_output)
    if input_tokens is None or output_tokens is None:
        return _handle_unknown_usage("Anthropic response usage contained invalid token values.")

    return {
        "input_tokens": input_tokens,
        "output_tokens": output_tokens,
        "cache_creation_input_tokens": _coerce_optional_token_value(getter("cache_creation_input_tokens", 0)),
        "cache_read_input_tokens": _coerce_optional_token_value(getter("cache_read_input_tokens", 0)),
        "verified": True,
        "source": "api_response",
    }


def calculate_anthropic_cost(
    model_name: str | None,
    *,
    input_tokens: int,
    output_tokens: int,
) -> dict[str, Any]:
    pricing = get_anthropic_pricing(model_name)
    if input_tokens < 0 or output_tokens < 0:
        return {
            "input_cost": 0.0,
            "output_cost": 0.0,
            "estimated_cost": 0.0,
            "pricing": pricing,
            "verified": False,
        }
    input_price = Decimal(str(pricing["input_per_million_usd"]))
    output_price = Decimal(str(pricing["output_per_million_usd"]))
    input_cost = (Decimal(input_tokens) / _MILLION) * input_price
    output_cost = (Decimal(output_tokens) / _MILLION) * output_price
    total_cost = (input_cost + output_cost).quantize(_COST_QUANTUM, rounding=ROUND_HALF_UP)
    return {
        "input_cost": float(input_cost.quantize(_COST_QUANTUM, rounding=ROUND_HALF_UP)),
        "output_cost": float(output_cost.quantize(_COST_QUANTUM, rounding=ROUND_HALF_UP)),
        "estimated_cost": float(total_cost),
        "pricing": pricing,
        "verified": True,
    }


def build_anthropic_usage_summary(
    model_name: str | None,
    response_payload: Any,
    *,
    processing_time_ms: int | None = None,
) -> dict[str, Any]:
    usage = extract_anthropic_usage(response_payload)
    total_tokens = (
        int(usage["input_tokens"]) + int(usage["output_tokens"])
        if bool(usage.get("verified"))
        else _UNKNOWN_TOKEN_VALUE
    )
    cost = calculate_anthropic_cost(
        model_name,
        input_tokens=int(usage["input_tokens"]),
        output_tokens=int(usage["output_tokens"]),
    )
    return {
        "model": model_name,
        "display_name": cost["pricing"]["display_name"],
        "input_tokens": usage["input_tokens"],
        "output_tokens": usage["output_tokens"],
        "cache_creation_input_tokens": usage["cache_creation_input_tokens"],
        "cache_read_input_tokens": usage["cache_read_input_tokens"],
        "total_tokens": total_tokens,
        "input_cost": cost["input_cost"],
        "output_cost": cost["output_cost"],
        "estimated_cost": cost["estimated_cost"],
        "currency": "USD",
        "processing_time_ms": processing_time_ms,
        "verified": bool(usage.get("verified")),
        "source": usage.get("source"),
    }


def merge_anthropic_usage_summaries(
    final_model: str | None,
    summaries: list[dict[str, Any]],
    *,
    processing_time_ms: int | None = None,
) -> dict[str, Any]:
    verified = bool(summaries) and all(bool(item.get("verified", True)) for item in summaries)
    if not verified:
        cost = calculate_anthropic_cost(final_model, input_tokens=-1, output_tokens=-1)
        return {
            "model": final_model,
            "display_name": cost["pricing"]["display_name"],
            "input_tokens": _UNKNOWN_TOKEN_VALUE,
            "output_tokens": _UNKNOWN_TOKEN_VALUE,
            "cache_creation_input_tokens": _UNKNOWN_TOKEN_VALUE,
            "cache_read_input_tokens": _UNKNOWN_TOKEN_VALUE,
            "total_tokens": _UNKNOWN_TOKEN_VALUE,
            "input_cost": 0.0,
            "output_cost": 0.0,
            "estimated_cost": 0.0,
            "currency": "USD",
            "request_count": len(summaries),
            "processing_time_ms": processing_time_ms,
            "verified": False,
            "source": "unknown",
        }

    input_tokens = sum(_coerce_optional_token_value(item.get("input_tokens")) for item in summaries)
    output_tokens = sum(_coerce_optional_token_value(item.get("output_tokens")) for item in summaries)
    total_tokens = sum(_coerce_optional_token_value(item.get("total_tokens")) for item in summaries)
    cache_creation = sum(_coerce_optional_token_value(item.get("cache_creation_input_tokens")) for item in summaries)
    cache_read = sum(_coerce_optional_token_value(item.get("cache_read_input_tokens")) for item in summaries)
    estimated_cost = sum(Decimal(str(item.get("estimated_cost") or 0)) for item in summaries)
    cost = calculate_anthropic_cost(
        final_model,
        input_tokens=input_tokens,
        output_tokens=output_tokens,
    )
    return {
        "model": final_model,
        "display_name": cost["pricing"]["display_name"],
        "input_tokens": input_tokens,
        "output_tokens": output_tokens,
        "cache_creation_input_tokens": cache_creation,
        "cache_read_input_tokens": cache_read,
        "total_tokens": total_tokens,
        "input_cost": cost["input_cost"],
        "output_cost": cost["output_cost"],
        "estimated_cost": float(estimated_cost.quantize(_COST_QUANTUM, rounding=ROUND_HALF_UP)),
        "currency": "USD",
        "request_count": len(summaries),
        "processing_time_ms": processing_time_ms,
        "verified": True,
        "source": "api_response",
    }


def serialize_anthropic_response_debug(response_payload: Any) -> dict[str, Any]:
    if isinstance(response_payload, Mapping):
        payload = dict(response_payload)
    elif hasattr(response_payload, "model_dump"):
        payload = response_payload.model_dump(mode="json")
    else:
        payload = {}
        for key in ("id", "model", "role", "type", "stop_reason", "stop_sequence"):
            payload[key] = getattr(response_payload, key, None)

    usage = extract_anthropic_usage(payload or response_payload)
    return {
        "id": payload.get("id"),
        "type": payload.get("type"),
        "role": payload.get("role"),
        "model": payload.get("model"),
        "stop_reason": payload.get("stop_reason"),
        "stop_sequence": payload.get("stop_sequence"),
        "usage": {
            "input_tokens": usage["input_tokens"],
            "output_tokens": usage["output_tokens"],
            "cache_creation_input_tokens": usage["cache_creation_input_tokens"],
            "cache_read_input_tokens": usage["cache_read_input_tokens"],
            "total_tokens": (
                int(usage["input_tokens"]) + int(usage["output_tokens"])
                if bool(usage.get("verified"))
                else _UNKNOWN_TOKEN_VALUE
            ),
            "verified": bool(usage.get("verified")),
            "source": usage.get("source"),
        },
    }


def estimate_max_anthropic_cost(
    model_name: str | None,
    *,
    estimated_input_tokens: int = 5000,
    max_output_tokens: int = 4096,
) -> dict[str, Any]:
    return calculate_anthropic_cost(
        model_name,
        input_tokens=estimated_input_tokens,
        output_tokens=max_output_tokens,
    )


def would_exceed_cost_limit(accumulated_cost_usd: float, next_model: str | None) -> bool:
    worst_case = estimate_max_anthropic_cost(next_model)
    return float(accumulated_cost_usd) + float(worst_case["estimated_cost"]) > get_ocr_max_cost_usd()


def _coerce_int(value: Any) -> int:
    try:
        return max(0, int(value))
    except (TypeError, ValueError):
        return 0


def _coerce_token_value(value: Any) -> int | None:
    try:
        coerced = int(value)
    except (TypeError, ValueError):
        return None
    if coerced < 0:
        return None
    return coerced


def _coerce_optional_token_value(value: Any) -> int:
    coerced = _coerce_token_value(value)
    return coerced if coerced is not None else 0


def _handle_unknown_usage(message: str) -> dict[str, int | bool | str]:
    if is_production_env():
        raise ValueError(message)
    logger.warning("%s Continuing with unverified token usage because environment is non-production.", message)
    return {
        "input_tokens": _UNKNOWN_TOKEN_VALUE,
        "output_tokens": _UNKNOWN_TOKEN_VALUE,
        "cache_creation_input_tokens": _UNKNOWN_TOKEN_VALUE,
        "cache_read_input_tokens": _UNKNOWN_TOKEN_VALUE,
        "verified": False,
        "source": "unknown",
    }
