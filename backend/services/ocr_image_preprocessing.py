"""OCR image preprocessing pipeline for factory document photos.

Provides robust preprocessing for handwritten weighbridge slips, stained invoices,
low-light photos, and folded/creased documents typical of factory floor conditions.

Pipeline stages (applied in order):
  1. Deskew — corrects rotated/scanned documents (up to ±15°)
  2. CLAHE — adaptive contrast enhancement for low-light / stained areas
  3. Denoise — removes sensor noise (fast Nl-Means or bilateral)
  4. Adaptive threshold — binarizes for Tesseract (background removal)
  5. Sharpening — mild unsharp mask to recover edge definition
  6. Resize — upscales small images (width < 1200px) for better OCR accuracy

The module degrades gracefully when OpenCV is unavailable by passing through
the original bytes with a warning logged.
"""

from __future__ import annotations

import io
import logging
import os
from typing import Any

import numpy as np

logger = logging.getLogger(__name__)

# Graceful import: OpenCV is preferred but optional.
try:
    import cv2

    OPENCV_AVAILABLE = True
except ImportError:
    OPENCV_AVAILABLE = False
    logger.warning("OpenCV (cv2) not available — OCR image preprocessing disabled.")

# Graceful import: Pillow for format conversion.
try:
    from PIL import Image

    PILLOW_AVAILABLE = True
except ImportError:
    PILLOW_AVAILABLE = False

# ── Configuration (tunable per deployment via env) ──────────────────────────
_MIN_WIDTH_PX = int(os.getenv("OCR_PREPROCESS_MIN_WIDTH", "1200"))
_TARGET_DPI = float(os.getenv("OCR_PREPROCESS_TARGET_DPI", "300.0"))
_CLAHE_CLIP_LIMIT = float(os.getenv("OCR_PREPROCESS_CLAHE_CLIP", "2.5"))
_CLAHE_TILE_GRID_SIZE = int(os.getenv("OCR_PREPROCESS_CLAHE_TILE", "8"))
_DENOISE_STRENGTH = float(os.getenv("OCR_PREPROCESS_DENOISE_H", "10.0"))
_DESKEW_MAX_ANGLE = float(os.getenv("OCR_PREPROCESS_DESKEW_MAX", "15.0"))
_SHARPEN_AMOUNT = float(os.getenv("OCR_PREPROCESS_SHARPEN", "0.3"))


# ── Public API ──────────────────────────────────────────────────────────────


def preprocess_image(
    image_bytes: bytes,
    *,
    apply_deskew: bool = True,
    apply_clahe: bool = True,
    apply_denoise: bool = True,
    apply_threshold: bool = True,
    apply_sharpen: bool = True,
    apply_resize: bool = True,
) -> bytes:
    """Run the full preprocessing pipeline on raw image bytes.

    Parameters
    ----------
    image_bytes : bytes
        Raw image file bytes (JPEG, PNG, TIFF, etc.).
    apply_* : bool
        Individual stage toggles (all enabled by default).

    Returns
    -------
    bytes
        Preprocessed image bytes (PNG format for lossless round-trip).
        If OpenCV is unavailable, returns the input bytes unchanged.
    """
    if not OPENCV_AVAILABLE or not image_bytes:
        return image_bytes

    try:
        arr, original_ext = _bytes_to_array(image_bytes)
        if arr is None:
            return image_bytes

        metadata: dict[str, Any] = {
            "original_shape": arr.shape,
            "stages_applied": [],
        }

        # Stage 1 — Deskew
        if apply_deskew:
            arr = _stage_deskew(arr, metadata)

        # Stage 2 — CLAHE (adaptive contrast)
        if apply_clahe:
            arr = _stage_clahe(arr, metadata)

        # Stage 3 — Denoise
        if apply_denoise:
            arr = _stage_denoise(arr, metadata)

        # Stage 4 — Adaptive threshold (binarize)
        if apply_threshold:
            arr = _stage_threshold(arr, metadata)

        # Stage 5 — Sharpening
        if apply_sharpen:
            arr = _stage_sharpen(arr, metadata)

        # Stage 6 — Resize for OCR
        if apply_resize:
            arr = _stage_resize(arr, metadata)

        logger.debug(
            "OCR preprocessing complete: stages=%s shape=%s",
            metadata["stages_applied"],
            arr.shape,
        )
        return _array_to_bytes(arr, original_ext)

    except Exception as exc:
        logger.warning("OCR image preprocessing failed (returning original): %s", exc, exc_info=True)
        return image_bytes


def preprocess_image_metadata(image_bytes: bytes) -> dict[str, Any]:
    """Analyse image quality without applying transformations.

    Returns a dict with quality heuristics useful for routing decisions
    (e.g. whether to force AI enhancement, which model tier to use).

    Enhanced in Phase 2 to include handwriting detection and a composite
    quality score suitable for cost-optimal model routing.
    """
    if not OPENCV_AVAILABLE or not image_bytes:
        return {"available": False}

    try:
        arr, _ = _bytes_to_array(image_bytes)
        if arr is None:
            return {"available": False}

        gray = arr if len(arr.shape) == 2 else cv2.cvtColor(arr, cv2.COLOR_BGR2GRAY)
        height, width = gray.shape

        # Luminance statistics
        mean_brightness = float(gray.mean())
        std_brightness = float(gray.std())

        # Laplacian variance — proxy for sharpness / blur
        laplacian_var = float(cv2.Laplacian(gray, cv2.CV_64F).var())

        # Estimate skew angle from image moments
        skew_angle = _estimate_skew(gray)

        # Detect very low contrast (stained / faded documents)
        contrast_ok = std_brightness > 25.0

        # NEW: Composite quality score (0-100) for model routing
        blur_score = min(100.0, laplacian_var / 20.0)  # Higher = sharper (div 20 gives better granularity than /5)
        brightness_score = 100.0 - abs(mean_brightness - 128.0) * 0.5  # Peak at mid-gray
        contrast_score = min(100.0, std_brightness * 2.0)
        quality_score = round(
            0.4 * blur_score + 0.3 * brightness_score + 0.3 * contrast_score,
            1,
        )

        # NEW: Handwriting detection via connected components
        handwriting_result = _detect_handwriting_simple(gray)

        return {
            "available": True,
            "width_px": width,
            "height_px": height,
            "mean_brightness": round(mean_brightness, 1),
            "std_brightness": round(std_brightness, 1),
            "laplacian_variance": round(laplacian_var, 2),
            "skew_angle_degrees": round(skew_angle, 2),
            "contrast_ok": contrast_ok,
            "needs_clahe": std_brightness < 30.0,
            "needs_denoise": laplacian_var < 50.0,
            "needs_deskew": abs(skew_angle) > 1.0,
            "needs_resize": width < _MIN_WIDTH_PX,
            # NEW: Phase 2 cost-routing fields
            "quality_score": quality_score,
            "blur_score": round(blur_score, 1),
            "brightness_score": round(brightness_score, 1),
            "contrast_score": round(contrast_score, 1),
            "has_handwriting": handwriting_result["has_handwriting"],
            "handwriting_confidence": handwriting_result["confidence"],
        }
    except Exception as exc:
        logger.warning("OCR image metadata extraction failed: %s", exc)
        return {"available": False, "error": str(exc)}


# ── Stage implementations ───────────────────────────────────────────────────


def _stage_deskew(arr: np.ndarray, metadata: dict[str, Any]) -> np.ndarray:
    """Correct document skew up to ±15°."""
    gray = arr if len(arr.shape) == 2 else cv2.cvtColor(arr, cv2.COLOR_BGR2GRAY)
    angle = _estimate_skew(gray)
    if abs(angle) < 0.5:
        return arr

    # Clamp to sane range
    angle = max(-_DESKEW_MAX_ANGLE, min(_DESKEW_MAX_ANGLE, angle))

    height, width = gray.shape
    center = (width // 2, height // 2)
    rotation_matrix = cv2.getRotationMatrix2D(center, angle, 1.0)
    rotated = cv2.warpAffine(
        arr,
        rotation_matrix,
        (width, height),
        flags=cv2.INTER_CUBIC,
        borderMode=cv2.BORDER_REPLICATE,
    )
    metadata.setdefault("stages_applied", []).append("deskew")
    metadata["deskew_angle"] = round(angle, 2)
    return rotated


def _stage_clahe(arr: np.ndarray, metadata: dict[str, Any]) -> np.ndarray:
    """Adaptive histogram equalisation for low-contrast / stained documents."""
    if len(arr.shape) == 2:
        gray = arr
        clahe = cv2.createCLAHE(
            clipLimit=_CLAHE_CLIP_LIMIT,
            tileGridSize=(_CLAHE_TILE_GRID_SIZE, _CLAHE_TILE_GRID_SIZE),
        )
        result = clahe.apply(gray)
        metadata.setdefault("stages_applied", []).append("clahe")
        return result

    # Colour image: apply CLAHE on the L channel of LAB
    lab = cv2.cvtColor(arr, cv2.COLOR_BGR2LAB)
    l_channel, a_ch, b_ch = cv2.split(lab)
    clahe = cv2.createCLAHE(
        clipLimit=_CLAHE_CLIP_LIMIT,
        tileGridSize=(_CLAHE_TILE_GRID_SIZE, _CLAHE_TILE_GRID_SIZE),
    )
    l_eq = clahe.apply(l_channel)
    merged = cv2.merge([l_eq, a_ch, b_ch])
    result = cv2.cvtColor(merged, cv2.COLOR_LAB2BGR)
    metadata.setdefault("stages_applied", []).append("clahe")
    return result


def _stage_denoise(arr: np.ndarray, metadata: dict[str, Any]) -> np.ndarray:
    """Fast Nl-Means denoising for sensor / compression noise."""
    h = _DENOISE_STRENGTH
    if len(arr.shape) == 2:
        result = cv2.fastNlMeansDenoising(arr, None, h, 7, 21)
    else:
        result = cv2.fastNlMeansDenoisingColored(arr, None, h, h, 7, 21)
    metadata.setdefault("stages_applied", []).append("denoise")
    return result


def _stage_threshold(arr: np.ndarray, metadata: dict[str, Any]) -> np.ndarray:
    """Adaptive thresholding to binarize the image for Tesseract.

    Uses Gaussian adaptive threshold on a grayscale version, then converts
    back to the original colour space if needed so downstream stages can
    continue operating on colour data.
    """
    gray = arr if len(arr.shape) == 2 else cv2.cvtColor(arr, cv2.COLOR_BGR2GRAY)
    # Gaussian adaptive threshold with block size = 31, C = 2
    binary = cv2.adaptiveThreshold(gray, 255, cv2.ADAPTIVE_THRESH_GAUSSIAN_C, cv2.THRESH_BINARY, 31, 2)

    # Morphological close to fill small gaps in text
    kernel = cv2.getStructuringElement(cv2.MORPH_RECT, (3, 3))
    binary = cv2.morphologyEx(binary, cv2.MORPH_CLOSE, kernel)

    metadata.setdefault("stages_applied", []).append("threshold")
    return binary


def _stage_sharpen(arr: np.ndarray, metadata: dict[str, Any]) -> np.ndarray:
    """Unsharp-mask sharpening to recover edge definition."""
    blurred = cv2.GaussianBlur(arr, (0, 0), 3.0)
    sharpened = cv2.addWeighted(arr, 1.0 + _SHARPEN_AMOUNT, blurred, -_SHARPEN_AMOUNT, 0)
    metadata.setdefault("stages_applied", []).append("sharpen")
    return sharpened


def _stage_resize(arr: np.ndarray, metadata: dict[str, Any]) -> np.ndarray:
    """Upscale small images to improve OCR accuracy."""
    height, width = arr.shape[:2]
    if width >= _MIN_WIDTH_PX:
        return arr

    scale = _MIN_WIDTH_PX / width
    new_width = int(width * scale)
    new_height = int(height * scale)
    result = cv2.resize(arr, (new_width, new_height), interpolation=cv2.INTER_CUBIC)
    metadata.setdefault("stages_applied", []).append("resize")
    metadata["resize_scale"] = round(scale, 3)
    return result


# ── Helpers ─────────────────────────────────────────────────────────────────


def _bytes_to_array(image_bytes: bytes) -> tuple[np.ndarray | None, str]:
    """Decode raw bytes into a numpy array, returning (array, original_ext)."""
    try:
        if PILLOW_AVAILABLE:
            img = Image.open(io.BytesIO(image_bytes))
            ext = (img.format or "PNG").lower()
            # Convert to RGB for consistent processing
            if img.mode in ("RGBA", "P", "PA"):
                img = img.convert("RGB")
            arr = np.array(img)
            # Ensure BGR order (OpenCV convention)
            if len(arr.shape) == 3 and arr.shape[2] == 3:
                arr = cv2.cvtColor(arr, cv2.COLOR_RGB2BGR)
            return arr, ext if ext in ("jpeg", "jpg", "png", "tiff", "tif") else "png"
        else:
            # Fallback: use OpenCV's imdecode
            file_bytes = np.frombuffer(image_bytes, dtype=np.uint8)
            arr = cv2.imdecode(file_bytes, cv2.IMREAD_COLOR)
            if arr is None:
                return None, "unknown"
            return arr, "png"
    except Exception:
        return None, "unknown"


def _array_to_bytes(arr: np.ndarray, original_ext: str) -> bytes:
    """Encode numpy array back to bytes (PNG for lossless round-trip)."""
    ext = original_ext if original_ext in ("png",) else "png"
    success, buffer = cv2.imencode(f".{ext}", arr)
    if not success:
        # Last-resort fallback
        success, buffer = cv2.imencode(".png", arr)
    return buffer.tobytes() if success else b""


def _detect_handwriting_simple(gray: np.ndarray) -> dict:
    """Lightweight handwriting detection using connected component analysis.

    Handwritten text has more variable component sizes and spacing than
    printed text. This heuristic is fast (~10ms) and suitable for real-time
    cost routing decisions.

    Returns dict with keys: has_handwriting (bool), confidence (float).
    """
    try:
        height, width = gray.shape
        if height < 50 or width < 50:
            return {"has_handwriting": False, "confidence": 0.0}

        # Invert if needed (dark text on light -> light text on dark)
        working = gray.copy()
        if working.mean() > 127:
            working = cv2.bitwise_not(working)

        _, binary = cv2.threshold(working, 0, 255, cv2.THRESH_BINARY + cv2.THRESH_OTSU)
        if cv2.countNonZero(binary) < 100:
            return {"has_handwriting": False, "confidence": 0.0}

        # Connected components
        num_labels, _, stats, _ = cv2.connectedComponentsWithStats(binary, connectivity=8)
        if num_labels < 5:
            return {"has_handwriting": False, "confidence": 0.0}

        # Collect component areas (filter noise and page edges)
        areas = []
        for i in range(1, num_labels):
            area = stats[i, cv2.CC_STAT_AREA]
            if 10 < area < 50000:
                areas.append(area)

        if not areas:
            return {"has_handwriting": False, "confidence": 0.0}

        # Handwriting has higher std/mean ratio for component sizes
        mean_area = float(np.mean(areas))
        std_area = float(np.std(areas))
        irregularity = std_area / mean_area if mean_area > 0 else 0.0

        # Horizontal projection profile variance
        horizontal_profile = np.sum(binary, axis=1) // 255
        text_rows = horizontal_profile > np.mean(horizontal_profile) * 0.3
        if np.sum(text_rows) > 10:
            row_indices = np.where(text_rows)[0]
            gaps = np.diff(row_indices)
            gap_variance = float(np.std(gaps)) / (float(np.mean(gaps)) + 1e-6) if len(gaps) > 0 else 0.0
        else:
            gap_variance = 0.0

        # Combined score: printed text = low irregularity, regular spacing
        has_handwriting = irregularity > 0.4 or gap_variance > 0.1
        confidence = min(1.0, max(irregularity, gap_variance * 2.0))

        return {
            "has_handwriting": has_handwriting,
            "confidence": round(confidence, 3),
        }
    except Exception:
        return {"has_handwriting": False, "confidence": 0.0}


def _estimate_skew(gray: np.ndarray) -> float:
    """Estimate the skew angle of a grayscale image using Hough lines."""
    height, width = gray.shape
    # Invert if needed (black text on white background → white text on black)
    if gray.mean() > 127:
        gray = cv2.bitwise_not(gray)

    edges = cv2.Canny(gray, 50, 150, apertureSize=3)
    lines = cv2.HoughLinesP(
        edges,
        rho=1,
        theta=np.pi / 180,
        threshold=min(100, width // 4),
        minLineLength=min(80, width // 3),
        maxLineGap=20,
    )
    if lines is None:
        return 0.0

    angles = []
    for line in lines:
        x1, y1, x2, y2 = line[0]
        if abs(x2 - x1) < 1:
            continue
        angle = np.degrees(np.arctan2(y2 - y1, x2 - x1))
        angles.append(angle)

    if not angles:
        return 0.0

    # Use median to be robust against outlier lines
    median_angle = float(np.median(angles))
    return median_angle
