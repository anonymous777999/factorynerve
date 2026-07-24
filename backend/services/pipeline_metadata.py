"""Single source of truth for pipeline quality metadata (P0-3 fix).

Consolidates the three+ scattered fallback boolean flags (fallback_used,
_fallback_active, ai_degraded_to_base) into one authoritative dataclass
that gets propagated through all pipeline paths — including cache serialization.

Usage:
    meta = PipelineMetadata(tesseract_fallback_used=True)
    result["pipeline_metadata"] = meta.to_dict()
    # On read-back:
    meta = PipelineMetadata.from_dict(result.get("pipeline_metadata", {}))
    if meta.tesseract_fallback_used:
        warnings.append("Local OCR fallback was used.")
"""

from __future__ import annotations

from dataclasses import dataclass, field
from typing import Any


@dataclass
class PipelineMetadata:
    """Authoritative pipeline quality state.

    Every boolean flag that affects confidence, trust, or user-visible
    warnings lives here — not as scattered ``fallback_used`` parameters
    or hardcoded ``False`` literals in cache serializers.
    """

    # ── AI stage ─────────────────────────────────────────────────────────
    ai_attempted: bool = False
    ai_succeeded: bool = False
    ai_degraded_to_base: bool = False
    ai_failure_reason: str | None = None

    # ── Tesseract / local OCR stage ──────────────────────────────────────
    tesseract_fallback_used: bool = False
    preprocessing_applied: bool = False
    preprocessing_stages: str | None = None
    tesseract_confidence: float | None = None

    # ── Preprocessing stage ──────────────────────────────────────────────
    deskew_applied: bool = False
    layout_analysis_failed: bool = False

    # ── Cache stage ──────────────────────────────────────────────────────
    cache_hit: bool = False
    cache_trust: str | None = None  # "high", "low"

    # ── Handwriting detection (P0-4) ─────────────────────────────────────
    handwriting_detected: bool = False
    handwriting_confidence: float | None = None

    # ── Derived helpers ──────────────────────────────────────────────────

    @property
    def effective_confidence_penalty(self) -> float:
        """Combined confidence penalty from all degradation sources.

        Returns a multiplier (0.0–1.0) to apply to the structural score.
        1.0 = no penalty, 0.0 = completely unreliable.

        Uses ``round(..., 4)`` to avoid floating-point drift (e.g.,
        1.0 - 0.7 == 0.30000000000000004 without rounding).
        """
        penalties: list[float] = []
        if self.ai_degraded_to_base:
            penalties.append(0.4)
        if self.tesseract_fallback_used:
            penalties.append(0.3)
        if self.layout_analysis_failed:
            penalties.append(0.15)
        if self.cache_hit and self.cache_trust == "low":
            penalties.append(0.2)
        return round(1.0 - sum(penalties), 4)

    @property
    def user_visible_warnings(self) -> list[str]:
        """Warnings to surface to the end-user based on pipeline state."""
        warnings: list[str] = []
        if self.ai_degraded_to_base:
            warnings.append("AI enhancement unavailable; using base OCR result.")
        if self.tesseract_fallback_used:
            warnings.append("Local OCR fallback was used; accuracy may be lower.")
        if self.handwriting_detected:
            warnings.append("Handwritten text detected — manual review recommended before export.")
        return warnings

    @property
    def review_required(self) -> bool:
        """Whether the result requires human review before trusted export."""
        return (
            self.ai_degraded_to_base
            or self.tesseract_fallback_used
            or self.handwriting_detected
            or (self.cache_trust == "low")
        )

    # ── Serialization ────────────────────────────────────────────────────

    def to_dict(self) -> dict[str, Any]:
        """Serialize to a JSON-safe dict for storage in routing_meta or cross_validation."""
        return {
            "ai_attempted": self.ai_attempted,
            "ai_succeeded": self.ai_succeeded,
            "ai_degraded_to_base": self.ai_degraded_to_base,
            "ai_failure_reason": self.ai_failure_reason,
            "tesseract_fallback_used": self.tesseract_fallback_used,
            "tesseract_confidence": self.tesseract_confidence,
            "deskew_applied": self.deskew_applied,
            "layout_analysis_failed": self.layout_analysis_failed,
            "cache_hit": self.cache_hit,
            "cache_trust": self.cache_trust,
            "handwriting_detected": self.handwriting_detected,
            "handwriting_confidence": self.handwriting_confidence,
        }

    @staticmethod
    def from_dict(data: dict[str, Any] | None) -> PipelineMetadata:
        """Deserialize from a dict (safe for missing keys)."""
        if not data:
            return PipelineMetadata()
        return PipelineMetadata(
            ai_attempted=bool(data.get("ai_attempted", False)),
            ai_succeeded=bool(data.get("ai_succeeded", False)),
            ai_degraded_to_base=bool(data.get("ai_degraded_to_base", False)),
            ai_failure_reason=str(data["ai_failure_reason"]) if data.get("ai_failure_reason") else None,
            tesseract_fallback_used=bool(data.get("tesseract_fallback_used", False)),
            tesseract_confidence=float(data["tesseract_confidence"]) if data.get("tesseract_confidence") is not None else None,
            deskew_applied=bool(data.get("deskew_applied", False)),
            layout_analysis_failed=bool(data.get("layout_analysis_failed", False)),
            cache_hit=bool(data.get("cache_hit", False)),
            cache_trust=str(data["cache_trust"]) if data.get("cache_trust") in ("high", "low") else None,
            handwriting_detected=bool(data.get("handwriting_detected", False)),
            handwriting_confidence=float(data["handwriting_confidence"]) if data.get("handwriting_confidence") is not None else None,
        )
