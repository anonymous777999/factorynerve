"""Handwriting detection for OCR pipeline (P0-4 fix).

Detects whether an uploaded document image contains handwritten text using
heuristic signals from Tesseract output:

1. **Confidence distribution** — handwriting produces low mean confidence with
   high variance (some characters crisp, some illegible).
2. **Character height variance** — handwritten text has irregular character
   heights; printed text is uniform.

The detector is intentionally lightweight (no ML model) to run within the OCR
request. When handwriting is detected, the document is routed to require
human review rather than attempting automated extraction.
"""

from __future__ import annotations

import logging
import os
import statistics
from dataclasses import dataclass
from typing import Any

from backend.ocr_utils import _extract_words_safe


logger = logging.getLogger(__name__)

# ── Feature flag: OCR_HANDWRITING_DETECTION_ENABLED ─────────────────────────
# When enabled, runs handwriting detection after Tesseract extraction and marks
# documents as requiring human review when handwriting is suspected.
_OCR_HANDWRITING_DETECTION_ENABLED = os.getenv("OCR_HANDWRITING_DETECTION_ENABLED", "false").lower() in (
    "1", "true", "yes", "on"
)

# Heuristic thresholds (tuned for factory ledger/logbook scans)
_HANDWRITING_MEAN_CONF_THRESHOLD = 40.0   # Mean Tesseract conf below this → suspect
_HANDWRITING_CONF_VARIANCE_THRESHOLD = 500.0  # Variance above this → suspect
_HANDWRITING_HEIGHT_CV_THRESHOLD = 0.5   # Height coeff-of-variation above this → suspect
_HANDWRITING_CONFIDENCE_FLOOR = 30.0     # Hard floor: mean conf below this = definitely handwriting


@dataclass
class HandwritingResult:
    """Result of handwriting detection.

    Attributes:
        is_handwriting: Whether the image is classified as handwritten.
        confidence: Confidence score (0.0 = certainly printed, 1.0 = certainly handwritten).
        explanation: Human-readable reason for the classification.
    """
    is_handwriting: bool = False
    confidence: float = 0.0
    explanation: str = ""

    def to_dict(self) -> dict[str, Any]:
        return {
            "is_handwriting": self.is_handwriting,
            "confidence": round(self.confidence, 2),
            "explanation": self.explanation,
        }


class HandwritingDetector:
    """Heuristic handwriting detector for OCR pipeline.

    Uses three signals from Tesseract output:
    - Mean word-level confidence
    - Confidence variance
    - Character height coefficient of variation

    No ML model required — runs in <100ms on typical document images.
    """

    def detect(self, image_bytes: bytes, language: str = "eng") -> HandwritingResult:
        """Run handwriting detection on an image.

        Returns a ``HandwritingResult`` with ``is_handwriting`` boolean and
        ``confidence`` score (0.0–1.0).

        Note: This method is intentionally synchronous (no ML model). If a
        future ML model requires async I/O, wrap the call with
        ``asyncio.to_thread()`` at the call site.
        """
        if not _OCR_HANDWRITING_DETECTION_ENABLED:
            return HandwritingResult(
                is_handwriting=False,
                confidence=0.0,
                explanation="Handwriting detection is disabled (OCR_HANDWRITING_DETECTION_ENABLED=false).",
            )

        try:
            words, confidences, _processed, _warnings, _used_lang = _extract_words_safe(image_bytes, language)
            if not words or not confidences:
                return HandwritingResult(
                    is_handwriting=False,
                    confidence=0.0,
                    explanation="No words extracted — cannot determine handwriting.",
                )

            return self._heuristic_classify(words, confidences)
        except Exception as error:
            logger.warning("Handwriting detection failed: %s", error, exc_info=True)
            return HandwritingResult(
                is_handwriting=False,
                confidence=0.0,
                explanation=f"Detection error: {error}",
            )

    def _heuristic_classify(
        self, words: list[dict[str, float | str]], confidences: list[float]
    ) -> HandwritingResult:
        """Classify as handwriting vs printed using heuristic thresholds."""
        mean_conf = statistics.mean(confidences) if confidences else 0.0
        variance = statistics.variance(confidences) if len(confidences) > 1 else 0.0

        # Extract character heights from bounding boxes
        heights = [float(w.get("h", 0)) for w in words if isinstance(w.get("h"), (int, float)) and float(w.get("h", 0)) > 0]
        height_cv = 0.0
        if len(heights) > 1:
            height_mean = statistics.mean(heights)
            if height_mean > 0:
                height_cv = statistics.stdev(heights) / height_mean

        # ── Classification logic ──────────────────────────────────────────
        signals: list[str] = []

        # Hard floor: mean confidence very low → definitely handwriting
        if mean_conf < _HANDWRITING_CONFIDENCE_FLOOR:
            signals.append(f"mean_conf={mean_conf:.1f} < floor={_HANDWRITING_CONFIDENCE_FLOOR}")
            return HandwritingResult(
                is_handwriting=True,
                confidence=0.85,
                explanation="; ".join(signals),
            )

        # Strong signal: low mean + high variance + high height CV
        if mean_conf < _HANDWRITING_MEAN_CONF_THRESHOLD:
            signals.append(f"mean_conf={mean_conf:.1f} < {_HANDWRITING_MEAN_CONF_THRESHOLD}")
            if variance > _HANDWRITING_CONF_VARIANCE_THRESHOLD:
                signals.append(f"variance={variance:.1f} > {_HANDWRITING_CONF_VARIANCE_THRESHOLD}")
            if height_cv > _HANDWRITING_HEIGHT_CV_THRESHOLD:
                signals.append(f"height_cv={height_cv:.3f} > {_HANDWRITING_HEIGHT_CV_THRESHOLD}")

            # At least two signals = handwriting
            if len(signals) >= 2:
                return HandwritingResult(
                    is_handwriting=True,
                    confidence=0.75,
                    explanation="; ".join(signals),
                )

        return HandwritingResult(
            is_handwriting=False,
            confidence=0.0,
            explanation=f"mean_conf={mean_conf:.1f}, variance={variance:.1f}, height_cv={height_cv:.3f} — below thresholds",
        )
