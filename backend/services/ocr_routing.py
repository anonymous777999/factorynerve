"""Routing helpers for OCR extraction tiers."""

from __future__ import annotations

from typing import Literal

from backend.ocr_utils import analyze_image_quality


OcrModelTier = Literal["fast", "balanced", "best"]

_TIER_COSTS = {"fast": 0.0008, "balanced": 0.0035, "best": 0.014}


def _clamp(value: float, minimum: float = 0.0, maximum: float = 100.0) -> float:
    return max(minimum, min(maximum, value))


def _forced_route(force_model: str | None) -> OcrModelTier | None:
    normalized = (force_model or "").strip().lower()
    if normalized in {"fast", "balanced", "best"}:
        return normalized  # type: ignore[return-value]
    return None


def choose_ocr_route(
    image_bytes: bytes,
    *,
    force_model: str | None = None,
    doc_type_hint: str | None = None,
    has_template: bool = False,
) -> dict[str, object]:
    forced_tier = _forced_route(force_model)
    if forced_tier is not None:
        actual_cost = _TIER_COSTS[forced_tier]
        return {
            "clarity_score": 100.0,
            "score_reason": f"Route forced to {forced_tier}.",
            "model_tier": forced_tier,
            "forced": True,
            "scorer_used": False,
            "actual_cost_usd": actual_cost,
            "cost_saved_usd": round(_TIER_COSTS["best"] - actual_cost, 6),
        }

    quality = analyze_image_quality(image_bytes)
    score = 92.0
    reasons: list[str] = []
    if quality.blur_variance < 110:
        score -= 28
        reasons.append("blur lowered clarity")
    if quality.brightness_mean < 92:
        score -= 12
        reasons.append("low light lowered clarity")
    if quality.glare_ratio > 0.04:
        score -= 10
        reasons.append("glare lowered clarity")
    if has_template:
        score += 8
        reasons.append("template improved extraction confidence")
    if (doc_type_hint or "").strip().lower() in {"logbook", "register", "ledger"}:
        score += 4
        reasons.append("known document type")

    clarity_score = round(_clamp(score), 1)
    if clarity_score >= 82:
        tier: OcrModelTier = "fast"
    elif clarity_score >= 58:
        tier = "balanced"
    else:
        tier = "best"

    actual_cost = _TIER_COSTS[tier]
    return {
        "clarity_score": clarity_score,
        "score_reason": "; ".join(reasons) or "Default route based on image clarity.",
        "model_tier": tier,
        "forced": False,
        "scorer_used": True,
        "actual_cost_usd": actual_cost,
        "cost_saved_usd": round(_TIER_COSTS["best"] - actual_cost, 6),
    }

