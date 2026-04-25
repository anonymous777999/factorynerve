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

