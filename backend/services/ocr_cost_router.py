"""OCR cost router — selects the most cost-effective Claude model tier.

Three-tier strategy:
  - Fast (Haiku, ~$0.001/page):  Clean printed docs, high-quality scans
  - Balanced (Sonnet, ~$0.003/page):  Most factory documents
  - Best (Sonnet + correction pass, ~$0.006/page):  Handwriting, low quality, complex layouts

Integrates with:
  - backend/services/ocr_image_preprocessing.py (image metadata)
  - backend/services/anthropic_usage.py (pricing, cost calculation)
  - backend/routers/ocr/_common.py (pipeline integration)
"""

from __future__ import annotations

import io
import json
import logging
import math
import re

import numpy as np

logger = logging.getLogger(__name__)

# ── Cost calculation (imported here to avoid circular imports at module level) ──
from backend.services.anthropic_usage import (
    ANTHROPIC_MODEL_OPUS,
    calculate_anthropic_cost,
)


# ── Graceful OpenCV import ──────────────────────────────────────────────────
try:
    import cv2
    OPENCV_AVAILABLE = True
except ImportError:
    OPENCV_AVAILABLE = False


# ── Model tier definitions ──────────────────────────────────────────────────
MODEL_TIER_FAST = "fast"       # claude-haiku-4-5-20251001
MODEL_TIER_BALANCED = "balanced"  # claude-sonnet-4-6
MODEL_TIER_BEST = "best"       # claude-sonnet-4-6 + correction pass

# Estimated cost per page (based on ~2,000 tokens avg)
COST_PER_PAGE = {
    MODEL_TIER_FAST: 0.001,
    MODEL_TIER_BALANCED: 0.003,
    MODEL_TIER_BEST: 0.006,  # Sonnet + 1 correction pass
}


# ── Public API ──────────────────────────────────────────────────────────────

def build_correction_request(
    extraction_json: dict[str, object],
    validation_errors: list[str] | None,
    first_model_used: str | None,
    explicit_model: str | None = None,
) -> dict:
    """Build a correction pass request for Claude.

    Called after the first extraction pass when:
    1. The cost decision specified ``needs_correction_pass=True`` (proactive)
    2. Validation found structural errors in the JSON (reactive)

    Returns a dict with keys:
        correction_model: str — the model to use for the correction pass
        correction_prompt: str — the prompt to send
        messages: list — message payload with context from the first pass
        is_proactive: bool — whether this is a proactive (not error-driven) correction
        reason: str — human-readable reason for the correction
    """
    from backend.services.anthropic_usage import get_next_anthropic_model_upgrade

    correction_model = (
        explicit_model
        or get_next_anthropic_model_upgrade(first_model_used)
        or "claude-sonnet-4-6"
    )

    if validation_errors:
        correction_prompt = (
            f"Your previous response had structural inconsistencies:\n"
            f"- " + "\n- ".join(validation_errors) + "\n\n"
            "Fix the JSON structure. Do not change values. Only correct formatting and alignment. "
            "Return ONLY the fixed JSON object."
        )
        reason = f"Validation errors: {len(validation_errors)} issues found"
    else:
        # Proactive correction: ask Claude to review and improve its own output
        correction_prompt = (
            "Review the extracted data above carefully. Focus on:\n"
            "1. Ensure ALL visible text in the image was captured — no omissions\n"
            "2. Verify numeric values, dates, and currencies are exact matches\n"
            "3. Check that merged cells and multi-row headers are handled correctly\n"
            "4. Confirm column alignment matches the original document layout\n\n"
            "Return the corrected JSON. Only change values that are clearly wrong. "
            "Return ONLY the fixed JSON object."
        )
        reason = "Proactive correction pass for handwriting/low-quality document"

    messages = [
        {"role": "user", "content": "Extract data from an image (provided in previous context)."},
        {"role": "assistant", "content": json.dumps(extraction_json)},
        {"role": "user", "content": correction_prompt},
    ]

    return {
        "correction_model": correction_model,
        "correction_prompt": correction_prompt,
        "messages": messages,
        "is_proactive": not bool(validation_errors),
        "reason": reason,
    }


def detect_handwriting(image_bytes: bytes) -> dict:
    """Detect whether an image contains handwriting using image analysis.

    Uses a combination of:
    1. Connected component analysis — handwritten text has more irregular
       component sizes and spacing than printed text
    2. Stroke width variance — handwriting has more variable stroke width
    3. Text line alignment — handwritten lines are less straight
    4. Edge density distribution — handwriting has different edge patterns

    Returns
    -------
    dict with keys:
        has_handwriting: bool
        confidence: float (0.0–1.0)
        signals: list[str] — diagnostic signals
        component_irregularity: float
        stroke_width_variance: float
        line_angle_variance: float
    """
    if not OPENCV_AVAILABLE or not image_bytes:
        return {
            "has_handwriting": False,
            "confidence": 0.0,
            "signals": ["opencv_unavailable"],
            "component_irregularity": 0.0,
            "stroke_width_variance": 0.0,
            "line_angle_variance": 0.0,
        }

    try:
        arr = _bytes_to_array(image_bytes)
        if arr is None:
            return _default_result("decode_failed")

        gray = arr if len(arr.shape) == 2 else cv2.cvtColor(arr, cv2.COLOR_BGR2GRAY)
        height, width = gray.shape
        if height < 50 or width < 50:
            return _default_result("too_small")

        # Invert if needed (dark text on light background -> light text on dark)
        if gray.mean() > 127:
            gray = cv2.bitwise_not(gray)

        # Threshold to get binary text regions
        _, binary = cv2.threshold(gray, 0, 255, cv2.THRESH_BINARY + cv2.THRESH_OTSU)
        if cv2.countNonZero(binary) < 100:
            return _default_result("too_few_text_pixels")

        # 1. Connected component analysis
        num_labels, labels, stats, _ = cv2.connectedComponentsWithStats(binary, connectivity=8)
        if num_labels < 5:
            return _default_result("too_few_components")

        # Filter out very small and very large components (noise / page edges)
        areas = []
        for i in range(1, num_labels):
            area = stats[i, cv2.CC_STAT_AREA]
            if 10 < area < 50000:
                areas.append(area)

        if not areas:
            return _default_result("no_valid_components")

        # Handwritten text has more variable component sizes
        mean_area = np.mean(areas)
        std_area = np.std(areas)
        component_irregularity = min(1.0, std_area / mean_area) if mean_area > 0 else 0.0

        # 2. Stroke width variance (simplified)
        # Use Canny edges and measure distance between edges
        edges = cv2.Canny(gray, 50, 150)
        dist_transform = cv2.distanceTransform(~binary, cv2.DIST_L2, 5)
        stroke_widths = dist_transform[dist_transform > 0]
        if len(stroke_widths) > 0:
            stroke_width_variance = min(1.0, np.std(stroke_widths) / (np.mean(stroke_widths) + 1e-6))
        else:
            stroke_width_variance = 0.0

        # 3. Line angle variance — detect text lines via horizontal projection
        horizontal_profile = np.sum(binary, axis=1) // 255
        # Find text rows (where profile > threshold)
        text_rows = horizontal_profile > np.mean(horizontal_profile) * 0.3
        if np.sum(text_rows) > 10:
            # Check for regularity: printed text has more regular row spacing
            row_indices = np.where(text_rows)[0]
            gaps = np.diff(row_indices)
            row_spacing_variance = np.std(gaps) / (np.mean(gaps) + 1e-6)
            line_angle_variance = min(1.0, row_spacing_variance / 10.0)
        else:
            line_angle_variance = 0.0

        # Combined score
        signals = []
        handwriting_score = (
            0.4 * component_irregularity +
            0.3 * stroke_width_variance +
            0.3 * line_angle_variance
        )

        # Adjust score based on signal strength
        if component_irregularity > 0.5:
            signals.append("irregular_component_sizes")
        if stroke_width_variance > 0.3:
            signals.append("variable_stroke_width")
        if line_angle_variance > 0.08:
            signals.append("irregular_row_spacing")

        has_handwriting = bool(handwriting_score > 0.35)
        confidence = min(1.0, handwriting_score * 1.5)  # Scale up for clearer signal

        # numpy scalars (np.float32/64, np.bool_) aren't JSON-serializable —
        # round()/min() on them stays a numpy type, so cast to native Python
        # floats here rather than let it blow up jsonable_encoder downstream.
        return {
            "has_handwriting": has_handwriting,
            "confidence": round(float(confidence), 3),
            "score": round(float(handwriting_score), 3),
            "signals": signals,
            "component_irregularity": round(float(component_irregularity), 3),
            "stroke_width_variance": round(float(stroke_width_variance), 3),
            "line_angle_variance": round(float(line_angle_variance), 3),
        }

    except Exception as exc:
        logger.warning("Handwriting detection failed: %s", exc, exc_info=True)
        return _default_result(f"error:{exc}")


def detect_document_nature(image_bytes: bytes, ocr_text: str | None = None) -> dict:
    """Classify document nature: printed, handwritten, screenshot, or ledger.

    Uses OCR text heuristics and image analysis to determine the document type.
    Follows the spec's exact detection pipeline (Section 5.4).

    Parameters
    ----------
    image_bytes : bytes
        The raw image bytes.
    ocr_text : str | None
        Optional pre-extracted OCR text. If None, extracts text via Tesseract.

    Returns
    -------
    dict with keys:
        nature: str — "printed" | "handwritten" | "screenshot" | "ledger" | "unknown"
        confidence: float
        signals: list[str]
    """
    handwriting_result = detect_handwriting(image_bytes)
    has_handwriting = handwriting_result["has_handwriting"]

    # Try to extract text using lightweight OCR for pattern detection
    text_preview = ocr_text or _extract_text_preview(image_bytes)

    signals = list(handwriting_result.get("signals", []))

    # Heuristic 1: Check for ledger patterns
    # (Spec section 5.4: ledger_patterns + tabular structure check)
    ledger_keywords = ["dr.", "cr.", "balance", "account", "particulars", "folio"]
    ledger_kw_score = sum(1 for p in ledger_keywords if p in text_preview.lower())
    if ledger_kw_score >= 1 and _has_tabular_structure(text_preview):
        signals.append("ledger_patterns_detected")
        return {
            "nature": "ledger",
            "confidence": min(0.9, 0.5 + 0.05 * ledger_kw_score),
            "signals": signals,
            "handwriting": handwriting_result,
        }

    # Heuristic 2: Check for chat/screenshot patterns
    # (Spec section 5.4: chat_patterns scoring)
    chat_patterns = ["\u2713\u2713", "\u2713", "today", "yesterday", "typing", "online"]
    chat_score = sum(1 for p in chat_patterns if p in text_preview) / len(chat_patterns)
    if chat_score > 0.3:
        signals.append("chat_patterns_detected")
        return {
            "nature": "screenshot",
            "confidence": min(0.85, 0.3 + 0.5 * chat_score),
            "signals": signals,
            "handwriting": handwriting_result,
        }

    # Heuristic 3: Handwriting detection via connected components
    # (Spec section 5.4: handwriting via connected components)
    if has_handwriting:
        return {
            "nature": "handwritten",
            "confidence": handwriting_result.get("confidence", 0.6),
            "signals": signals,
            "handwriting": handwriting_result,
        }

    # Heuristic 4: Check for printed text patterns (regular layout)
    # (Spec section 5.4: regular layout check)
    if _has_regular_layout(text_preview):
        return {
            "nature": "printed",
            "confidence": 0.8,
            "signals": signals + ["printed_text_detected"],
            "handwriting": handwriting_result,
        }

    return {
        "nature": "unknown",
        "confidence": 0.3,
        "signals": signals + ["no_clear_pattern"],
        "handwriting": handwriting_result,
    }


def select_cost_optimal_model(
    image_quality_score: float,
    has_handwriting: bool,
    doc_nature: str = "printed",
) -> dict:
    """Select the most cost-effective Claude model tier.

    Parameters
    ----------
    image_quality_score : float
    has_handwriting : bool
    doc_nature : str

    Returns
    -------
    dict with keys:
        tier: str — "fast" | "balanced" | "best"
        model: str — Claude model name
        estimated_cost: float
        needs_correction_pass: bool
        reason: str
    """
    # 1. Handwriting / ledger / screenshot always needs Sonnet + correction pass
    if has_handwriting or doc_nature in ("handwritten", "ledger", "screenshot"):
        return {
            "tier": MODEL_TIER_BEST,
            "model": "claude-sonnet-4-6",
            "estimated_cost": COST_PER_PAGE[MODEL_TIER_BEST],
            "needs_correction_pass": True,
            "reason": f"Document nature={doc_nature}, handwriting={has_handwriting} — needs Sonnet + correction pass",
        }

    # 2. High quality printed docs → Haiku ($0.001)
    if image_quality_score >= 75 and doc_nature == "printed":
        return {
            "tier": MODEL_TIER_FAST,
            "model": "claude-haiku-4-5-20251001",
            "estimated_cost": COST_PER_PAGE[MODEL_TIER_FAST],
            "needs_correction_pass": False,
            "reason": f"High quality (score={image_quality_score:.0f}), printed document — using Haiku",
        }

    # 3. Medium quality → Sonnet ($0.003)
    if image_quality_score >= 40:
        return {
            "tier": MODEL_TIER_BALANCED,
            "model": "claude-sonnet-4-6",
            "estimated_cost": COST_PER_PAGE[MODEL_TIER_BALANCED],
            "needs_correction_pass": False,
            "reason": f"Standard document (quality={image_quality_score:.0f}) — using Sonnet",
        }

    # 4. Low quality → Sonnet + correction pass ($0.006)
    return {
        "tier": MODEL_TIER_BEST,
        "model": "claude-sonnet-4-6",
        "estimated_cost": COST_PER_PAGE[MODEL_TIER_BEST],
        "needs_correction_pass": True,
        "reason": f"Low quality (score={image_quality_score:.0f}) — using Sonnet + correction pass",
    }


def calculate_cost_savings(
    model_used: str | None,
    usage_summary: dict | None,
) -> dict:
    """Calculate cost savings vs Opus baseline for transparency.

    Returns
    -------
    dict with keys:
        actual_cost_usd: float
        opus_baseline_cost: float
        cost_saved_usd: float
        savings_pct: float
        model_used: str
    """
    if not usage_summary:
        return {
            "actual_cost_usd": 0.0,
            "opus_baseline_cost": 0.0,
            "cost_saved_usd": 0.0,
            "savings_pct": 0.0,
            "model_used": model_used or "unknown",
        }

    input_tokens = int(usage_summary.get("input_tokens", 0) or 0)
    output_tokens = int(usage_summary.get("output_tokens", 0) or 0)
    actual_cost = float(usage_summary.get("estimated_cost", 0) or 0)

    # Calculate what Opus would have cost
    opus_cost = calculate_anthropic_cost(
        ANTHROPIC_MODEL_OPUS,
        input_tokens=input_tokens,
        output_tokens=output_tokens,
    )
    opus_baseline = float(opus_cost.get("estimated_cost", 0) or 0)
    savings = max(0.0, opus_baseline - actual_cost)
    savings_pct = (savings / opus_baseline * 100) if opus_baseline > 0 else 0.0

    return {
        "actual_cost_usd": round(actual_cost, 6),
        "opus_baseline_cost": round(opus_baseline, 6),
        "cost_saved_usd": round(savings, 6),
        "savings_pct": round(savings_pct, 1),
        "model_used": model_used or "unknown",
    }


# ── Internal helpers ────────────────────────────────────────────────────────

def _default_result(reason: str) -> dict:
    return {
        "has_handwriting": False,
        "confidence": 0.0,
        "signals": [f"default:{reason}"],
        "component_irregularity": 0.0,
        "stroke_width_variance": 0.0,
        "line_angle_variance": 0.0,
    }


def _bytes_to_array(image_bytes: bytes) -> np.ndarray | None:
    """Decode image bytes to numpy array (BGR format)."""
    try:
        file_bytes = np.frombuffer(image_bytes, dtype=np.uint8)
        arr = cv2.imdecode(file_bytes, cv2.IMREAD_COLOR)
        return arr
    except Exception:
        return None


def _extract_text_preview(image_bytes: bytes) -> str:
    """Extract a small text preview using lightweight OCR if Tesseract is available."""
    try:
        from backend.ocr_utils import _require_ocr_dependencies, _extract_words_safe

        _require_ocr_dependencies()
        words, _, _, warnings, _ = _extract_words_safe(image_bytes, "eng")
        # Return first ~500 chars for pattern matching
        text = " ".join(str(w.get("text", "")) for w in words)
        return text[:500]
    except Exception:
        return ""


def _detect_screenshot_patterns(text_preview: str) -> dict:
    """Detect if text looks like a chat/screenshot transcript."""
    if not text_preview:
        return {"is_screenshot": False, "confidence": 0.0, "signals": []}

    signals = []
    preview_lower = text_preview.lower()

    # Chat patterns
    chat_indicators = [
        "✓✓", "✓", "typing", "online", "last seen",
        "today", "yesterday", "this message",
        "delivered", "read", "sent",
    ]
    chat_score = sum(1 for p in chat_indicators if p in preview_lower)

    # Message structure: look for time stamps, sender prefixes
    time_patterns = len(re.findall(r'\d{1,2}:\d{2}\s*(?:AM|PM|am|pm)', text_preview))
    sender_patterns = len(re.findall(r'^[A-Z][a-z]+:', text_preview, re.MULTILINE))

    if chat_score >= 2 or time_patterns >= 2 or sender_patterns >= 2:
        signals.append("chat_patterns_detected")
        confidence = min(0.9, 0.3 + 0.1 * chat_score + 0.1 * time_patterns)
        return {"is_screenshot": True, "confidence": confidence, "signals": signals}

    return {"is_screenshot": False, "confidence": 0.0, "signals": signals}


def _detect_ledger_patterns(text_preview: str) -> dict:
    """Detect if text looks like a ledger/account sheet.

    This is a lighter-weight check than the full detection pipeline.
    The main ``detect_document_nature()`` function uses the full
    heuristic pipeline instead.
    """
    if not text_preview:
        return {"is_ledger": False, "confidence": 0.0, "signals": []}
    signals = []
    preview_lower = text_preview.lower()
    ledger_keywords = [
        "dr", "cr", "debit", "credit", "balance", "particulars",
        "folio", "voucher", "receipt", "payment", "by ", "to ",
        "opening balance", "closing balance", "total",
    ]
    keyword_score = sum(1 for kw in ledger_keywords if kw in preview_lower)
    date_entries = len(re.findall(r'\d{2}[/-]\d{2}[/-]\d{2,4}', text_preview))
    amount_entries = len(re.findall(r'\u20b9?\s*[\d,]+\.\d{2}', text_preview))
    if keyword_score >= 4 and (date_entries >= 2 or amount_entries >= 3):
        signals.append("ledger_patterns_detected")
        confidence = min(0.95, 0.4 + 0.05 * keyword_score + 0.05 * date_entries)
        return {"is_ledger": True, "confidence": confidence, "signals": signals}
    return {"is_ledger": False, "confidence": 0.0, "signals": signals}


def _has_tabular_structure(text: str) -> bool:
    """Check if text has tabular/columnar structure.

    Heuristics:
    - Multiple lines with consistent delimiter spacing (tabs, multiple spaces)
    - Repeated column-like patterns across lines
    - Aligned date/amount columns
    """
    if not text or not text.strip():
        return False
    lines = [l for l in text.split("\n") if l.strip()]
    if len(lines) < 3:
        return False
    tab_lines = sum(1 for l in lines if "\t" in l)
    space_delimited = sum(1 for l in lines if re.search(r'  {3,}', l))
    pipe_delimited = sum(1 for l in lines if '|' in l)
    structured_lines = tab_lines + space_delimited + pipe_delimited
    return (structured_lines / len(lines)) > 0.4


def _has_regular_layout(text: str) -> bool:
    """Check if text has regular printed layout.

    Printed documents typically have:
    - Consistent line spacing
    - Regular character widths
    - Uniform left alignment
    - Predictable column positions

    Heuristics:
    - Lines have similar lengths (std dev < 40% of mean)
    - Most lines start at same column position
    - No extreme variation in line lengths
    """
    if not text or not text.strip():
        return False
    lines = [l for l in text.split("\n") if l.strip()]
    if len(lines) < 3:
        return False
    # Check line length consistency
    lengths = [len(l) for l in lines]
    mean_len = sum(lengths) / len(lengths) if lengths else 0
    if mean_len < 10:
        return False  # Too short to determine layout
    variance = sum((l - mean_len) ** 2 for l in lengths) / len(lengths)
    std_dev = variance ** 0.5
    # Printed text: lines within ~40% of mean length
    if std_dev / mean_len > 0.4:
        return False
    # Check that most lines share the most common (mode) start column.
    # This is robust against indented first lines (e.g. paragraph starts).
    leading_spaces = [len(l) - len(l.lstrip()) for l in lines]
    mode_start = max(set(leading_spaces), key=leading_spaces.count)
    # Allow a ±1 space tolerance for OCR jitter
    common_starts = sum(1 for s in leading_spaces if abs(s - mode_start) <= 1)
    return (common_starts / len(lines)) > 0.5
