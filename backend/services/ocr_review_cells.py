"""Helpers for preserving OCR cell metadata through review and export."""

from __future__ import annotations

from collections.abc import Sequence
from typing import Any

from backend.utils import sanitize_text

_ALLOWED_CELL_SOURCES = {"ocr", "ai", "corrected", "manual", "unknown"}


def is_review_cell(value: Any) -> bool:
    return isinstance(value, dict) and "value" in value


def cell_display_value(value: Any) -> str:
    if is_review_cell(value):
        return sanitize_text(str(value.get("value") or ""), max_length=2000, preserve_newlines=False) or ""
    return sanitize_text(str(value) if value is not None else "", max_length=2000, preserve_newlines=False) or ""


def cell_confidence(value: Any) -> float | None:
    if not is_review_cell(value):
        return None
    raw = value.get("confidence")
    try:
        confidence = float(raw)
    except (TypeError, ValueError):
        return None
    if confidence > 1:
        confidence = confidence / 100.0
    return max(0.0, min(1.0, confidence))


def cell_source(value: Any) -> str | None:
    if not is_review_cell(value):
        return None
    raw = sanitize_text(str(value.get("source") or ""), max_length=20, preserve_newlines=False) or ""
    lowered = raw.lower()
    if lowered in _ALLOWED_CELL_SOURCES:
        return lowered
    return None


def cell_bbox(value: Any) -> dict[str, float] | None:
    if not is_review_cell(value):
        return None
    raw = value.get("bbox")
    if not isinstance(raw, dict):
        return None
    try:
        x = float(raw.get("x", 0.0))
        y = float(raw.get("y", 0.0))
        width = float(raw.get("width", 0.0))
        height = float(raw.get("height", 0.0))
    except (TypeError, ValueError):
        return None
    return {
        "x": max(0.0, min(1.0, x)),
        "y": max(0.0, min(1.0, y)),
        "width": max(0.0, min(1.0, width)),
        "height": max(0.0, min(1.0, height)),
    }


def normalize_review_cell(value: Any) -> str | dict[str, Any]:
    if is_review_cell(value):
        normalized: dict[str, Any] = {
            "value": cell_display_value(value),
        }
        confidence = cell_confidence(value)
        if confidence is not None:
            normalized["confidence"] = confidence
        bbox = cell_bbox(value)
        if bbox is not None:
            normalized["bbox"] = bbox
        source = cell_source(value)
        if source is not None:
            normalized["source"] = source
        raw_normalized = value.get("normalized")
        if isinstance(raw_normalized, (int, float)):
            normalized["normalized"] = float(raw_normalized)
        review_required = value.get("reviewRequired")
        if isinstance(review_required, bool):
            normalized["reviewRequired"] = review_required
        return normalized
    return cell_display_value(value)


def normalize_review_rows(values: list | None, *, field_name: str) -> list[list[str | dict[str, Any]]] | None:
    if values is None:
        return None
    if not isinstance(values, list):
        raise TypeError(f"{field_name} must be a list of rows.")
    normalized: list[list[str | dict[str, Any]]] = []
    max_columns = 0
    for row in values:
        if not isinstance(row, list):
            raise TypeError(f"{field_name} must be a list of rows.")
        cleaned_row = [normalize_review_cell(cell) for cell in row]
        normalized.append(cleaned_row)
        max_columns = max(max_columns, len(cleaned_row))
    for row in normalized:
        if len(row) < max_columns:
            row.extend([""] * (max_columns - len(row)))
    return normalized


def build_confidence_matrix(rows: Sequence[Sequence[Any]]) -> list[list[float | None]]:
    return [[cell_confidence(cell) for cell in row] for row in rows]


def build_source_matrix(rows: Sequence[Sequence[Any]]) -> list[list[str | None]]:
    return [[cell_source(cell) for cell in row] for row in rows]


def build_bbox_matrix(rows: Sequence[Sequence[Any]]) -> list[list[dict[str, float] | None]]:
    return [[cell_bbox(cell) for cell in row] for row in rows]
