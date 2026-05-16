"""Normalization helpers for structured OCR output."""

from __future__ import annotations

import ast
import json
from typing import Any


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
    if isinstance(value, (dict, list)):
        return json.dumps(value, ensure_ascii=True)
    return str(value).strip()


def _normalize_headers(headers: list[Any] | None, column_count: int) -> list[str]:
    normalized = [_stringify_cell(header) for header in headers or []]
    if len(normalized) < column_count:
        normalized.extend([f"Column {index}" for index in range(len(normalized) + 1, column_count + 1)])
    return [
        header if header else f"Column {index + 1}"
        for index, header in enumerate(normalized[:column_count])
    ]


def get_confidence_tier(value: Any, field_type: str) -> str:
    text = _stringify_cell(value)
    if not text or text.strip() == "":
        return "review_required"
    if field_type == "number" and _looks_number_like(text) is False:
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

    matrix: list[list[float]] = []
    for row in normalized_rows:
        normalized_row = row + ([""] * (column_count - len(row)))
        matrix.append(
            [
                _confidence_score_for_tier(
                    get_confidence_tier(
                        normalized_row[column_index],
                        _infer_field_type(normalized_headers, normalized_rows, column_index),
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

    enriched_rows: list[list[dict[str, Any]]] = []
    for row in normalized_rows:
        normalized_row = row + ([""] * (column_count - len(row)))
        enriched_rows.append(
            [
                _build_confidence_cell(
                    normalized_row[column_index],
                    _infer_field_type(normalized_headers, normalized_rows, column_index),
                )
                for column_index in range(column_count)
            ]
        )
    return enriched_rows


def _build_confidence_cell(value: Any, field_type: str) -> dict[str, Any]:
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
    if any(token in header for token in ("amount", "amt", "qty", "quantity", "count", "number", "total", "rate", "value", "balance")):
        return "number"
    column_values = [
        row[column_index].strip()
        for row in rows
        if column_index < len(row) and row[column_index].strip()
    ]
    if column_values and all(_looks_number_like(value) for value in column_values):
        return "number"
    return "text"


def _looks_number_like(value: str) -> bool:
    cleaned = (
        value.replace(",", "")
        .replace(" ", "")
        .replace("Rs.", "")
        .replace("INR", "")
        .replace("\u20b9", "")
        .replace("$", "")
    )
    if not cleaned:
        return False
    try:
        float(cleaned)
        return True
    except ValueError:
        return False


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
