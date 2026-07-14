"""Normalization helpers for structured OCR output."""

from __future__ import annotations

import ast
import json
import re
from collections import Counter
from typing import Any

_NUMBER_HEADER_TOKENS = ("amount", "amt", "qty", "quantity", "count", "number", "total", "rate", "value", "balance", "debit", "credit", "dr", "cr")
_DATE_HEADER_TOKENS = ("date", "day", "time", "month", "year")
# Confusable letter-to-digit mappings (handwritten letters that look like digits)
_CONFUSABLE_DIGIT_MAP = str.maketrans({
    "O": "0",
    "o": "0",
    "I": "1",
    "l": "1",
    "S": "5",
    "s": "5",
    "B": "8",
})

# Ambiguous digit pairs common in Indian factory handwriting.
# These are NOT 1:1 substitutions — they flag cells for review
# when a digit could plausibly be confused with another.
_AMBIGUOUS_DIGIT_PAIRS: list[tuple[str, str]] = [
    ("9", "4"),   # 9 vs 4 — very common in Indian handwriting
    ("9", "2"),   # 9 vs 2
    ("5", "6"),   # 5 vs 6
    ("0", "6"),   # 0 vs 6
    ("8", "0"),   # 8 vs 0
    ("1", "7"),   # 1 vs 7
    ("3", "8"),   # 3 vs 8
]


def extract_json_candidate(raw: str | None) -> Any | None:
    if not raw:
        return None
    text = raw.strip()
    if not text:
        return None
    if text.startswith("```"):
        stripped = []
        for line in text.splitlines():
            if line.strip().startswith("```"):
                continue
            stripped.append(line)
        text = "\n".join(stripped).strip()
    try:
        return json.loads(text)
    except json.JSONDecodeError:
        pass
    try:
        return ast.literal_eval(text)
    except (ValueError, SyntaxError):
        pass

    for opener, closer in (("{", "}"), ("[", "]")):
        depth = 0
        start_index: int | None = None
        for index, char in enumerate(text):
            if char == opener:
                if depth == 0:
                    start_index = index
                depth += 1
            elif char == closer and depth > 0:
                depth -= 1
                if depth == 0 and start_index is not None:
                    candidate = text[start_index : index + 1]
                    try:
                        return json.loads(candidate)
                    except json.JSONDecodeError:
                        try:
                            return ast.literal_eval(candidate)
                        except (ValueError, SyntaxError):
                            start_index = None
    return None


def _stringify_cell(value: Any) -> str:
    if value is None:
        return ""
    if isinstance(value, str):
        return value.strip()
    if isinstance(value, (int, float, bool)):
        return str(value)
    if isinstance(value, dict):
        label = value.get("label") or value.get("name") or value.get("title")
        nested_value = value.get("value") or value.get("content") or value.get("amount")
        if label is not None and nested_value is not None:
            return f"{_stringify_cell(label)}: {_stringify_cell(nested_value)}".strip()
        for key in ("value", "content", "text", "label", "title", "amount", "name"):
            nested = value.get(key)
            if nested is not None and not isinstance(nested, (dict, list)):
                return _stringify_cell(nested)
        return json.dumps(value, ensure_ascii=True)
    if isinstance(value, list):
        parts = [_stringify_cell(item) for item in value]
        return ", ".join(part for part in parts if part)
    return str(value).strip()


def _normalize_headers(headers: list[Any] | None, column_count: int) -> list[str]:
    normalized = [_stringify_cell(header) for header in headers or []]
    if len(normalized) < column_count:
        normalized.extend([f"Column {index}" for index in range(len(normalized) + 1, column_count + 1)])
    return [
        header if header else f"Column {index + 1}"
        for index, header in enumerate(normalized[:column_count])
    ]


def get_confidence_tier(value: Any, field_type: str | dict[str, Any]) -> str:
    profile = field_type if isinstance(field_type, dict) else {"field_type": field_type}
    kind = str(profile.get("field_type") or "text")
    text = _stringify_cell(value)
    if not text or text.strip() == "":
        return "review_required" if float(profile.get("non_empty_ratio") or 0.0) >= 0.6 else "medium"
    if _contains_severe_noise(text):
        return "review_required"
    if kind == "number":
        return _classify_number_cell(text)
    if kind == "date":
        return _classify_date_cell(text)
    if _looks_merged_cell(text, profile):
        return "review_required"
    if _looks_text_anomaly(text, profile):
        return "medium"
    return "high"


def build_cell_confidence_matrix(
    headers: list[Any] | None,
    rows: list[list[Any]] | None,
) -> list[list[float]]:
    normalized_headers = [_stringify_cell(header) for header in headers or []]
    normalized_rows = [[_stringify_cell(cell) for cell in row] for row in rows or []]
    column_count = max(len(normalized_headers), max((len(row) for row in normalized_rows), default=0))
    if column_count == 0:
        return []
    profiles = _build_column_profiles(normalized_headers, normalized_rows)

    matrix: list[list[float]] = []
    for row in normalized_rows:
        normalized_row = row + ([""] * (column_count - len(row)))
        matrix.append(
            [
                _confidence_score_for_tier(
                    get_confidence_tier(
                        normalized_row[column_index],
                        profiles[column_index],
                    )
                )
                for column_index in range(column_count)
            ]
        )
    return matrix


def build_confidence_enriched_rows(
    headers: list[Any] | None,
    rows: list[list[Any]] | None,
) -> list[list[dict[str, Any]]]:
    normalized_headers = [_stringify_cell(header) for header in headers or []]
    normalized_rows = [[_stringify_cell(cell) for cell in row] for row in rows or []]
    column_count = max(len(normalized_headers), max((len(row) for row in normalized_rows), default=0))
    if column_count == 0:
        return []
    profiles = _build_column_profiles(normalized_headers, normalized_rows)

    enriched_rows: list[list[dict[str, Any]]] = []
    for row in normalized_rows:
        normalized_row = row + ([""] * (column_count - len(row)))
        enriched_rows.append(
            [
                _build_confidence_cell(
                    normalized_row[column_index],
                    profiles[column_index],
                )
                for column_index in range(column_count)
            ]
        )
    return enriched_rows


def _build_confidence_cell(value: Any, field_type: str | dict[str, Any]) -> dict[str, Any]:
    tier = get_confidence_tier(value, field_type)
    # OCR rows were falling back to fake 100% values because the tier was never assigned at normalization time.
    return {
        "value": _stringify_cell(value),
        "confidence": _confidence_score_for_tier(tier),
        "reviewRequired": tier == "review_required",
        "source": "ocr",
    }


def _confidence_score_for_tier(tier: str) -> float:
    if tier == "review_required":
        return 0.25
    if tier == "medium":
        return 0.65
    return 0.95


def _infer_field_type(headers: list[str], rows: list[list[str]], column_index: int) -> str:
    header = headers[column_index].strip().lower() if column_index < len(headers) else ""
    if any(token in header for token in _NUMBER_HEADER_TOKENS):
        return "number"
    if any(token in header for token in _DATE_HEADER_TOKENS):
        return "date"
    column_values = [
        row[column_index].strip()
        for row in rows
        if column_index < len(row) and row[column_index].strip()
    ]
    if column_values and all(_looks_number_like(value) for value in column_values):
        return "number"
    if column_values and all(_looks_date_like(value) for value in column_values):
        return "date"
    return "text"


def _looks_number_like(value: str) -> bool:
    cleaned = _normalize_numeric_candidate(value)
    if not cleaned:
        return False
    try:
        float(cleaned)
        return True
    except ValueError:
        return False


def _normalize_numeric_candidate(value: str) -> str:
    cleaned = (
        value.replace(",", "")
        .replace(" ", "")
        .replace("Rs.", "")
        .replace("Rs", "")
        .replace("INR", "")
        .replace("USD", "")
        .replace("\u20b9", "")
        .replace("$", "")
        .replace("%", "")
    ).strip()
    if cleaned.startswith("(") and cleaned.endswith(")"):
        cleaned = f"-{cleaned[1:-1]}"
    return cleaned


def _looks_confusable_numeric(value: str) -> bool:
    if _looks_number_like(value):
        return False
    translated = value.translate(_CONFUSABLE_DIGIT_MAP)
    return _looks_number_like(translated)


def _has_ambiguous_digit_pattern(value: str) -> bool:
    """
    Check if a numeric value contains BOTH digits from a commonly-confused
    pair in Indian handwriting (e.g., 9 and 4 both present, or 1 and 7 both present).

    A clean "15000" has only "1" and "5" → not flagged.
    A potentially ambiguous "147" has both "1" and "7" → flagged.
    """
    if not value or len(value) < 2:
        return False
    for d1, d2 in _AMBIGUOUS_DIGIT_PAIRS:
        if d1 in value and d2 in value:
            return True
    return False


def _classify_number_cell(value: str) -> str:
    if _looks_number_like(value):
        # Even if it looks like a valid number, check for ambiguous handwriting
        if _has_ambiguous_digit_pattern(value):
            return "medium"
        return "high"
    if _looks_confusable_numeric(value):
        return "medium"
    if _contains_digit_alpha_noise(value) or _contains_severe_noise(value):
        return "review_required"
    return "medium"


def _classify_date_cell(value: str) -> str:
    if _looks_date_like(value):
        return "high"
    if re.search(r"\d", value) and any(token in value for token in ("/", "-", ".")):
        return "medium"
    if _contains_severe_noise(value):
        return "review_required"
    return "medium"


def _looks_date_like(value: str) -> bool:
    text = value.strip()
    if not text:
        return False
    patterns = (
        r"^\d{1,2}[/-]\d{1,2}[/-]\d{2,4}$",
        r"^\d{4}[/-]\d{1,2}[/-]\d{1,2}$",
        r"^\d{1,2}[.]\d{1,2}[.]\d{2,4}$",
        r"^\d{1,2}:\d{2}(?::\d{2})?$",
    )
    return any(re.match(pattern, text) for pattern in patterns)


def _contains_digit_alpha_noise(value: str) -> bool:
    stripped = re.sub(r"(rs\.?|inr|usd)", "", value, flags=re.IGNORECASE)
    return bool(re.search(r"\d", stripped) and re.search(r"[A-Za-z]", stripped))


def _contains_severe_noise(value: str) -> bool:
    text = value.strip()
    if not text:
        return False
    if any(token in text for token in ("\ufffd", "??", "__", "||", "\t")):
        return True
    symbol_count = sum(1 for char in text if not char.isalnum() and char not in " .,/-():%")
    return len(text) >= 4 and (symbol_count / len(text)) > 0.3


def _looks_merged_cell(value: str, profile: dict[str, Any]) -> bool:
    average_length = float(profile.get("average_length") or 0.0)
    baseline = max(average_length * 2.5, 36)
    return len(value) > baseline and bool(re.search(r"\s{2,}|[|]{1,}|[,;].*[,;]", value))


def _shape_signature(value: str) -> str:
    chars: list[str] = []
    for char in value:
        if char.isdigit():
            chars.append("9")
        elif char.isalpha():
            chars.append("A")
        elif char.isspace():
            chars.append(" ")
        else:
            chars.append(char)
    return "".join(chars)


def _looks_text_anomaly(value: str, profile: dict[str, Any]) -> bool:
    dominant_shape = str(profile.get("dominant_shape") or "")
    dominant_shape_ratio = float(profile.get("dominant_shape_ratio") or 0.0)
    if dominant_shape_ratio < 0.85 or not dominant_shape:
        return False
    shape = _shape_signature(value)
    return shape != dominant_shape and len(value) <= max(24, int((profile.get("average_length") or 0.0) * 1.8))


def _build_column_profiles(headers: list[str], rows: list[list[str]]) -> list[dict[str, Any]]:
    column_count = max(len(headers), max((len(row) for row in rows), default=0))
    if column_count == 0:
        return []

    profiles: list[dict[str, Any]] = []
    row_count = max(len(rows), 1)
    for column_index in range(column_count):
        values = [
            row[column_index].strip() if column_index < len(row) else ""
            for row in rows
        ]
        non_empty = [value for value in values if value]
        shapes = Counter(_shape_signature(value) for value in non_empty)
        dominant_shape, dominant_count = shapes.most_common(1)[0] if shapes else ("", 0)
        profiles.append(
            {
                "field_type": _infer_field_type(headers, rows, column_index),
                "non_empty_ratio": len(non_empty) / row_count,
                "average_length": (sum(len(value) for value in non_empty) / len(non_empty)) if non_empty else 0.0,
                "dominant_shape": dominant_shape,
                "dominant_shape_ratio": (dominant_count / len(non_empty)) if non_empty else 0.0,
            }
        )
    return profiles


def normalize_headers_rows(
    *,
    headers: list[Any] | None = None,
    rows: list[Any] | None = None,
) -> tuple[list[str], list[list[str]]]:
    normalized_rows: list[list[str]] = []
    max_columns = len(headers or [])
    for row in rows or []:
        if isinstance(row, dict):
            if headers:
                next_row = [_stringify_cell(row.get(header)) for header in headers]
            else:
                row_headers = list(row.keys())
                max_columns = max(max_columns, len(row_headers))
                next_row = [_stringify_cell(row.get(key)) for key in row_headers]
                headers = row_headers
        elif isinstance(row, list):
            next_row = [_stringify_cell(cell) for cell in row]
        else:
            next_row = [_stringify_cell(row)]
        normalized_rows.append(next_row)
        max_columns = max(max_columns, len(next_row))

    normalized_headers = _normalize_headers(list(headers or []), max_columns)
    if not normalized_headers and normalized_rows:
        normalized_headers = _normalize_headers([], max_columns)
    for row in normalized_rows:
        if len(row) < len(normalized_headers):
            row.extend([""] * (len(normalized_headers) - len(row)))
        elif len(row) > len(normalized_headers):
            del row[len(normalized_headers) :]
    return normalized_headers, normalized_rows


def normalize_structured_payload(
    payload: Any,
    *,
    fallback_headers: list[str] | None = None,
    fallback_rows: list[list[str]] | None = None,
    fallback_type: str = "table",
    fallback_title: str = "OCR Extraction",
) -> dict[str, Any]:
    title = fallback_title
    document_type = fallback_type
    headers: list[Any] | None = fallback_headers
    rows: list[Any] | None = fallback_rows
    raw_text: str | None = None
    warnings: list[str] = []

    candidate = payload
    if isinstance(candidate, str):
        raw_text = candidate.strip() or None
        candidate = extract_json_candidate(candidate)

    if isinstance(candidate, dict):
        document_type = _stringify_cell(candidate.get("type")) or fallback_type
        title = _stringify_cell(candidate.get("title")) or fallback_title
        raw_text = _stringify_cell(candidate.get("raw_text")) or raw_text
        if isinstance(candidate.get("headers"), list):
            headers = candidate.get("headers")
        if isinstance(candidate.get("rows"), list):
            rows = candidate.get("rows")
        elif isinstance(candidate.get("data"), list):
            rows = candidate.get("data")
        elif isinstance(candidate.get("items"), list):
            rows = candidate.get("items")
        elif isinstance(candidate.get("table"), dict):
            table = candidate.get("table") or {}
            headers = table.get("headers") if isinstance(table.get("headers"), list) else headers
            rows = table.get("rows") if isinstance(table.get("rows"), list) else rows
        if isinstance(candidate.get("warnings"), list):
            warnings = [_stringify_cell(value) for value in candidate.get("warnings")]
    elif isinstance(candidate, list):
        rows = candidate

    if isinstance(rows, list) and rows and all(isinstance(item, dict) for item in rows):
        inferred_headers: list[str] = []
        for item in rows:
            for key in item.keys():
                normalized = _stringify_cell(key)
                if normalized and normalized not in inferred_headers:
                    inferred_headers.append(normalized)
        headers = headers or inferred_headers

    normalized_headers, normalized_rows = normalize_headers_rows(headers=headers, rows=rows)
    return {
        "type": document_type or fallback_type,
        "title": title or fallback_title,
        "headers": normalized_headers,
        "rows": normalized_rows,
        "raw_text": raw_text,
        "warnings": warnings,
    }
