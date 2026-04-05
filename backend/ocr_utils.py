"""OCR utilities for extracting tabular data from logbook images."""

from __future__ import annotations

from dataclasses import dataclass
import io
import os
import shutil
from pathlib import Path
from typing import Iterable

import numpy as np
from PIL import Image


try:
    import cv2  # type: ignore
except Exception as error:  # pylint: disable=broad-except
    cv2 = None
    _CV2_IMPORT_ERROR = error
else:
    _CV2_IMPORT_ERROR = None


try:
    import pytesseract  # type: ignore
except Exception as error:  # pylint: disable=broad-except
    pytesseract = None
    _TESS_IMPORT_ERROR = error
else:
    _TESS_IMPORT_ERROR = None


@dataclass(slots=True)
class OcrResult:
    rows: list[list[str]]
    avg_confidence: float
    warnings: list[str]
    raw_column_added: bool = False
    cell_confidence: list[list[float]] | None = None


@dataclass(slots=True)
class ImageQuality:
    blur_variance: float
    brightness_mean: float
    glare_ratio: float
    warnings: list[str]


def analyze_image_quality(image_bytes: bytes) -> ImageQuality:
    """Heuristic quality checks to guide non-technical users."""
    _require_ocr_dependencies()
    if cv2 is None:
        raise RuntimeError("OpenCV is required for OCR preprocessing.")
    image = Image.open(io.BytesIO(image_bytes)).convert("RGB")
    img = np.array(image)
    gray = cv2.cvtColor(img, cv2.COLOR_RGB2GRAY)

    # Blur detection via Laplacian variance.
    blur_variance = float(cv2.Laplacian(gray, cv2.CV_64F).var())

    # Brightness via mean grayscale.
    brightness_mean = float(np.mean(gray))

    # Glare: ratio of near-white pixels (specular highlights / reflection).
    glare_ratio = float(np.mean(gray >= 245))

    warnings: list[str] = []
    if blur_variance < 75:
        warnings.append("blur_detected")
    if brightness_mean < 80:
        warnings.append("low_light")
    if glare_ratio > 0.06:
        warnings.append("glare")

    return ImageQuality(
        blur_variance=blur_variance,
        brightness_mean=brightness_mean,
        glare_ratio=glare_ratio,
        warnings=warnings,
    )


def _order_points(points: np.ndarray) -> np.ndarray:
    # Points: (4,2) -> order TL, TR, BR, BL
    s = points.sum(axis=1)
    diff = np.diff(points, axis=1).reshape(-1)
    tl = points[np.argmin(s)]
    br = points[np.argmax(s)]
    tr = points[np.argmin(diff)]
    bl = points[np.argmax(diff)]
    return np.array([tl, tr, br, bl], dtype=np.float32)


def auto_detect_document_corners(image_bytes: bytes) -> list[list[float]] | None:
    _require_ocr_dependencies()
    if cv2 is None:
        raise RuntimeError("OpenCV is required for OCR preprocessing.")
    image = Image.open(io.BytesIO(image_bytes)).convert("RGB")
    img = np.array(image)
    gray = cv2.cvtColor(img, cv2.COLOR_RGB2GRAY)
    gray = cv2.GaussianBlur(gray, (5, 5), 0)
    edges = cv2.Canny(gray, 60, 180)
    contours, _ = cv2.findContours(edges, cv2.RETR_LIST, cv2.CHAIN_APPROX_SIMPLE)
    contours = sorted(contours, key=cv2.contourArea, reverse=True)[:8]
    for contour in contours:
        peri = cv2.arcLength(contour, True)
        approx = cv2.approxPolyDP(contour, 0.02 * peri, True)
        if len(approx) == 4:
            pts = approx.reshape(4, 2).astype(np.float32)
            ordered = _order_points(pts)
            return ordered.tolist()
    return None


def warp_perspective(
    image_bytes: bytes,
    *,
    corners: list[list[float]] | None = None,
    max_side: int = 1600,
) -> tuple[bytes, list[list[float]] | None]:
    """Warp image to a top-down view using 4 corners (pixels).

    If corners is None, attempts auto-detection.
    Returns (warped_image_bytes_png, used_corners_pixels).
    """
    _require_ocr_dependencies()
    if cv2 is None:
        raise RuntimeError("OpenCV is required for OCR preprocessing.")

    image = Image.open(io.BytesIO(image_bytes)).convert("RGB")
    img = np.array(image)
    used = corners
    if used is None:
        used = auto_detect_document_corners(image_bytes)
    if used is None:
        return image_bytes, None

    pts = np.array(used, dtype=np.float32)
    if pts.shape != (4, 2):
        raise RuntimeError("Corners must be 4 points.")
    pts = _order_points(pts)

    (tl, tr, br, bl) = pts
    width_a = np.linalg.norm(br - bl)
    width_b = np.linalg.norm(tr - tl)
    height_a = np.linalg.norm(tr - br)
    height_b = np.linalg.norm(tl - bl)
    max_w = int(max(width_a, width_b))
    max_h = int(max(height_a, height_b))
    max_w = max(40, max_w)
    max_h = max(40, max_h)

    # Downscale output for speed (but keep enough detail for OCR).
    scale = 1.0
    if max(max_w, max_h) > max_side:
        scale = max_side / float(max(max_w, max_h))
        max_w = int(max_w * scale)
        max_h = int(max_h * scale)

    dst = np.array(
        [[0, 0], [max_w - 1, 0], [max_w - 1, max_h - 1], [0, max_h - 1]],
        dtype=np.float32,
    )
    matrix = cv2.getPerspectiveTransform(pts, dst)
    warped = cv2.warpPerspective(img, matrix, (max_w, max_h))

    # Encode as PNG.
    ok, encoded = cv2.imencode(".png", cv2.cvtColor(warped, cv2.COLOR_RGB2BGR))
    if not ok:
        raise RuntimeError("Could not encode warped image.")
    return encoded.tobytes(), pts.tolist()


def _detect_tessdata_prefix() -> str | None:
    env_prefix = os.getenv("TESSDATA_PREFIX")
    if env_prefix:
        prefix_path = Path(env_prefix)
        if prefix_path.name.lower() != "tessdata":
            candidate = prefix_path / "tessdata"
            if candidate.exists():
                return str(candidate)
        return env_prefix
    local_app = os.getenv("LOCALAPPDATA")
    if local_app:
        candidate = Path(local_app) / "DPR.ai" / "tessdata"
        if candidate.exists():
            return str(candidate)
    return None


def _require_ocr_dependencies() -> None:
    if pytesseract is None:
        raise RuntimeError(f"pytesseract is not available: {_TESS_IMPORT_ERROR}")
    if cv2 is None:
        raise RuntimeError(f"opencv is not available: {_CV2_IMPORT_ERROR}")
    if not shutil.which("tesseract"):
        win_paths = [
            Path(r"C:\Program Files\Tesseract-OCR\tesseract.exe"),
            Path(r"C:\Program Files (x86)\Tesseract-OCR\tesseract.exe"),
        ]
        for path in win_paths:
            if path.exists():
                pytesseract.pytesseract.tesseract_cmd = str(path)
                break
    tessdata_prefix = os.getenv("TESSDATA_PREFIX") or _detect_tessdata_prefix()
    if tessdata_prefix:
        prefix_path = Path(tessdata_prefix)
        if prefix_path.name.lower() != "tessdata":
            candidate = prefix_path / "tessdata"
            if candidate.exists():
                tessdata_prefix = str(candidate)
        os.environ["TESSDATA_PREFIX"] = tessdata_prefix
    try:
        pytesseract.get_tesseract_version()
    except Exception as error:  # pylint: disable=broad-except
        raise RuntimeError("Tesseract OCR is not installed or not reachable.") from error


def _preprocess_image(image: Image.Image) -> np.ndarray:
    if cv2 is None:
        raise RuntimeError("OpenCV is required for OCR preprocessing.")
    rgb = image.convert("RGB")
    img = np.array(rgb)
    gray = cv2.cvtColor(img, cv2.COLOR_RGB2GRAY)
    gray = cv2.medianBlur(gray, 3)
    thresh = cv2.adaptiveThreshold(
        gray,
        255,
        cv2.ADAPTIVE_THRESH_GAUSSIAN_C,
        cv2.THRESH_BINARY,
        31,
        5,
    )
    return thresh


def _kmeans_1d(values: Iterable[float], k: int, iterations: int = 12) -> list[float]:
    values = list(values)
    if not values:
        return []
    values.sort()
    if k <= 1:
        return [sum(values) / len(values)]
    k = min(k, len(values))
    if k <= 1:
        return [sum(values) / len(values)]
    centers = []
    for i in range(k):
        idx = int(i * (len(values) - 1) / (k - 1))
        centers.append(values[idx])
    for _ in range(iterations):
        clusters: list[list[float]] = [[] for _ in range(k)]
        for value in values:
            nearest = min(range(k), key=lambda j: abs(value - centers[j]))
            clusters[nearest].append(value)
        for j in range(k):
            if clusters[j]:
                centers[j] = sum(clusters[j]) / len(clusters[j])
    centers.sort()
    return centers


def _extract_words(image_bytes: bytes, language: str) -> tuple[list[dict[str, float | str]], list[float], np.ndarray]:
    _require_ocr_dependencies()
    if pytesseract is None:
        raise RuntimeError("pytesseract is not available.")
    image = Image.open(io.BytesIO(image_bytes))
    processed = _preprocess_image(image)
    config = "--oem 1 --psm 6"
    data = pytesseract.image_to_data(
        processed,
        output_type=pytesseract.Output.DICT,
        lang=language,
        config=config,
    )
    words: list[dict[str, float | str]] = []
    confidences: list[float] = []
    num_items = len(data.get("text", []))
    for idx in range(num_items):
        text = str(data["text"][idx]).strip()
        if not text:
            continue
        conf_raw = data.get("conf", [0])[idx]
        try:
            conf = float(conf_raw)
        except (TypeError, ValueError):
            conf = 0.0
        x = float(data["left"][idx])
        y = float(data["top"][idx])
        w = float(data["width"][idx])
        h = float(data["height"][idx])
        words.append(
            {
                "text": text,
                "x": x,
                "y": y,
                "w": w,
                "h": h,
                "xc": x + (w / 2),
                "yc": y + (h / 2),
                "conf": conf,
            }
        )
        if conf >= 0:
            confidences.append(conf)
    return words, confidences, processed





def _extract_words_safe(image_bytes: bytes, language: str) -> tuple[list[dict[str, float | str]], list[float], np.ndarray, list[str], str]:
    warnings: list[str] = []
    try:
        words, confs, processed = _extract_words(image_bytes, language)
        return words, confs, processed, warnings, language
    except Exception as error:  # pylint: disable=broad-except
        if language != "eng":
            try:
                words, confs, processed = _extract_words(image_bytes, "eng")
                warnings.append("Requested OCR language unavailable. Fell back to English.")
                return words, confs, processed, warnings, "eng"
            except Exception:
                raise RuntimeError(f"OCR failed for language '{language}'. {error}") from error
        raise


def detect_column_centers(
    images: list[bytes],
    *,
    columns: int,
    language: str = "eng",
) -> tuple[list[float], float, list[str]]:
    if language == "auto":
        language = "eng+hin+mar"
    if columns < 1:
        columns = 1
    if columns > 8:
        columns = 8
    all_centers: list[float] = []
    confidences: list[float] = []
    warnings: list[str] = []
    for image_bytes in images:
        words, confs, _processed, warn, _used = _extract_words_safe(image_bytes, language)
        warnings.extend(warn)
        all_centers.extend([float(word["xc"]) for word in words])
        confidences.extend(confs)
    if not all_centers:
        warnings.append("No text found in samples. Template may be inaccurate.")
        return [], 0.0, warnings
    centers = _kmeans_1d(all_centers, columns)
    avg_conf = float(sum(confidences) / len(confidences)) if confidences else 0.0
    if avg_conf and avg_conf < 55:
        warnings.append("Low OCR confidence in samples. Please review.")
    return centers, avg_conf, warnings


def extract_table_from_image(
    image_bytes: bytes,
    *,
    columns: int = 3,
    language: str = "eng",
    column_centers: list[float] | None = None,
    column_keywords: list[list[str]] | None = None,
    enable_raw_column: bool = False,
) -> OcrResult:
    _require_ocr_dependencies()
    if pytesseract is None:
        raise RuntimeError("pytesseract is not available.")

    warnings: list[str] = []
    quality = analyze_image_quality(image_bytes)
    warnings.extend(quality.warnings)

    words, confidences, processed, warn, used_lang = _extract_words_safe(image_bytes, language)
    warnings.extend(warn)
    if not words:
        raw_text = pytesseract.image_to_string(processed, lang=used_lang, config="--oem 1 --psm 6")
        lines = [line.strip() for line in raw_text.splitlines() if line.strip()]
        if not lines:
            return OcrResult(rows=[], avg_confidence=0.0, warnings=["No text detected."])
        rows = [[line] for line in lines]
        return OcrResult(rows=rows, avg_confidence=0.0, warnings=["Fallback to plain text."])

    heights = [word["h"] for word in words]
    median_height = float(np.median(heights)) if heights else 12.0
    row_threshold = max(10.0, median_height * 0.8)

    words.sort(key=lambda w: (w["yc"], w["xc"]))
    rows: list[list[dict[str, float | str]]] = []
    current_row: list[dict[str, float | str]] = []
    current_center = None
    for word in words:
        yc = float(word["yc"])
        if current_center is None:
            current_center = yc
            current_row.append(word)
            continue
        if abs(yc - current_center) <= row_threshold:
            current_row.append(word)
            current_center = (current_center * (len(current_row) - 1) + yc) / len(current_row)
        else:
            rows.append(current_row)
            current_row = [word]
            current_center = yc
    if current_row:
        rows.append(current_row)

    if column_centers:
        centers = sorted(column_centers)
    else:
        if columns < 1:
            columns = 1
        if columns > 8:
            columns = 8
        x_centers = [float(word["xc"]) for row in rows for word in row]
        centers = _kmeans_1d(x_centers, columns) or [0.0]

    spacing = None
    if len(centers) > 1:
        diffs = [centers[i + 1] - centers[i] for i in range(len(centers) - 1)]
        spacing = float(np.median(diffs))
    raw_column_added = False

    table_rows: list[list[str]] = []
    table_conf: list[list[float]] = []
    for row in rows:
        row_cols = [""] * (len(centers) + (1 if enable_raw_column else 0))
        row_conf = [0.0] * (len(centers) + (1 if enable_raw_column else 0))
        row_counts = [0] * (len(centers) + (1 if enable_raw_column else 0))
        row_sorted = sorted(row, key=lambda w: float(w["xc"]))
        for word in row_sorted:
            xc = float(word["xc"])
            text = str(word["text"]).strip()
            if not text:
                continue
            conf = float(word.get("conf") or 0.0) if isinstance(word, dict) else 0.0
            keyword_idx = None
            if column_keywords:
                text_lower = text.lower()
                for idx, keywords in enumerate(column_keywords):
                    for keyword in keywords:
                        if keyword and keyword.lower() in text_lower:
                            keyword_idx = idx
                            break
                    if keyword_idx is not None:
                        break
            if keyword_idx is not None and keyword_idx < len(centers):
                col_idx = keyword_idx
            else:
                col_idx = min(range(len(centers)), key=lambda i: abs(xc - centers[i]))
                if enable_raw_column and spacing:
                    if abs(xc - centers[col_idx]) > spacing * 0.6:
                        col_idx = len(centers)
                        raw_column_added = True
            if row_cols[col_idx]:
                row_cols[col_idx] += f" {text}"
            else:
                row_cols[col_idx] = text
            row_conf[col_idx] += max(0.0, min(100.0, conf))
            row_counts[col_idx] += 1
        table_rows.append(row_cols)
        table_conf.append(
            [
                (row_conf[i] / row_counts[i]) if row_counts[i] else 0.0
                for i in range(len(row_cols))
            ]
        )

    avg_conf = float(sum(confidences) / len(confidences)) if confidences else 0.0
    if avg_conf and avg_conf < 55:
        warnings.append("Low OCR confidence. Please review carefully.")

    return OcrResult(
        rows=table_rows,
        avg_confidence=avg_conf,
        warnings=warnings,
        raw_column_added=raw_column_added,
        cell_confidence=table_conf,
    )
