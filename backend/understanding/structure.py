"""Structural analysis of extracted OCR tables.

Computes structure once, server-side, so every frontend review view reads the
same answer instead of re-deriving it with per-view regexes. Dependency-free
pure functions over list[str] / list[list[str]]; callers treat a raised
exception as "no structure detected" and fall back to the flat table.
"""

from __future__ import annotations

import re
from typing import Any

COL_TYPE_LABEL = "label"
COL_TYPE_AMOUNT = "amount"
COL_TYPE_QUANTITY = "quantity"
COL_TYPE_DATE = "date"
COL_TYPE_TEXT = "text"

_AMOUNT_TOKEN_RE = re.compile(
    r"^\(?\s*(?:rs\.?|inr|₹|\$)?\s*[0-9][0-9,]*(?:\.[0-9]+)?\s*(?:dr|cr)?\.?\s*\)?$",
    re.IGNORECASE,
)
_DATE_TOKEN_RE = re.compile(
    r"^\s*\d{1,4}[\-/.]\d{1,2}[\-/.]\d{1,4}\s*$"
    r"|^\s*\d{1,2}[\-/.\s][A-Za-z]{3,9}[\-/.\s]\d{2,4}\s*$",
)
_INT_TOKEN_RE = re.compile(r"^\s*\d{1,4}\s*$")

_HEADER_AMOUNT_KW = re.compile(
    r"amount|total|price|rate|value|debit|credit|\bdr\b|\bcr\b|balance|net|tax|gst|cgst|sgst|igst|payable|cost",
    re.IGNORECASE,
)
_HEADER_QTY_KW = re.compile(r"qty|quantity|units?|nos?\b|count|weight|kgs?|tonnes?|mt\b", re.IGNORECASE)
_HEADER_DATE_KW = re.compile(r"date|\bdt\b|period|day\b", re.IGNORECASE)
_HEADER_LABEL_KW = re.compile(
    r"particular|description|field|label|item|product|narration|details?|name|account|head",
    re.IGNORECASE,
)
_TOTAL_ROW_RE = re.compile(
    r"^\s*(grand\s+)?(sub[-\s]?)?total\b"
    r"|^\s*balance\s*(b/?f|c/?f|forward|carried|brought|due)?\b"
    r"|^\s*amount\s+due\b"
    r"|^\s*net\s+(payable|amount|total)\b"
    r"|^\s*closing\s+balance\b"
    r"|^\s*opening\s+balance\b",
    re.IGNORECASE,
)


def _clean(value: Any) -> str:
    return str(value if value is not None else "").strip()


def _is_amount(token: str) -> bool:
    token = token.strip()
    if not token or token in {"-", "—", "–"}:
        return False
    return bool(_AMOUNT_TOKEN_RE.match(token))


def _is_date(token: str) -> bool:
    return bool(_DATE_TOKEN_RE.match(token.strip()))


def _is_int(token: str) -> bool:
    return bool(_INT_TOKEN_RE.match(token.strip()))


def classify_column(header: str, column_values: list[str]) -> str:
    """Semantic type of a column from its header text and value sample."""
    header = _clean(header)
    non_empty = [v for v in (c.strip() for c in column_values) if v]

    if header:
        if _HEADER_DATE_KW.search(header) and not _HEADER_AMOUNT_KW.search(header):
            return COL_TYPE_DATE
        if _HEADER_AMOUNT_KW.search(header):
            return COL_TYPE_AMOUNT
        if _HEADER_QTY_KW.search(header):
            return COL_TYPE_QUANTITY
        if _HEADER_LABEL_KW.search(header):
            return COL_TYPE_LABEL

    if not non_empty:
        return COL_TYPE_TEXT

    total = len(non_empty)
    amount_ratio = sum(1 for v in non_empty if _is_amount(v)) / total
    date_ratio = sum(1 for v in non_empty if _is_date(v)) / total
    int_ratio = sum(1 for v in non_empty if _is_int(v)) / total

    if date_ratio >= 0.6:
        return COL_TYPE_DATE
    if amount_ratio >= 0.6:
        return COL_TYPE_AMOUNT
    if int_ratio >= 0.6:
        return COL_TYPE_QUANTITY
    return COL_TYPE_TEXT


def _looks_like_header_row(row: list[str]) -> bool:
    """A header row is mostly non-empty, mostly non-numeric text with keywords."""
    cells = [_clean(c) for c in row]
    non_empty = [c for c in cells if c]
    if len(non_empty) < 2:
        return False
    numeric = sum(1 for c in non_empty if _is_amount(c) or _is_date(c) or _is_int(c))
    if numeric / len(non_empty) > 0.3:
        return False
    keyword_hits = sum(
        1
        for c in non_empty
        if _HEADER_AMOUNT_KW.search(c)
        or _HEADER_QTY_KW.search(c)
        or _HEADER_DATE_KW.search(c)
        or _HEADER_LABEL_KW.search(c)
    )
    return keyword_hits >= 1


def is_total_row(row: list[str]) -> bool:
    for cell in row:
        text = _clean(cell)
        if text:
            return bool(_TOTAL_ROW_RE.match(text))
    return False


def detect_key_value(headers: list[str], rows: list[list[str]]) -> bool:
    """Two-column table whose left column holds labels and right holds values."""
    if len(headers) != 2:
        widths = {len(row) for row in rows if row}
        if not rows or widths != {2}:
            return False
    header_text = " ".join(_clean(h).lower() for h in headers)
    if _HEADER_LABEL_KW.search(header_text) or "value" in header_text:
        return True
    left = [_clean(row[0]) for row in rows if len(row) >= 1]
    non_empty_left = [c for c in left if c]
    if len(non_empty_left) < 2:
        return False
    left_numeric = sum(1 for c in non_empty_left if _is_amount(c) or _is_date(c) or _is_int(c))
    return left_numeric / len(non_empty_left) < 0.3


def analyze_structure(
    headers: list[str] | None,
    rows: list[list[str]] | None,
    *,
    doc_type: str | None = None,
) -> dict[str, Any]:
    """Compute a structure payload for a flat extracted table.

    Keys: layout ("key_value"|"table"), has_header_row, column_types,
    total_row_indices, row_roles ("data"|"total"), key_value_pairs.
    Never raises for well-formed input; callers fall back to the flat table.
    """
    headers = [_clean(h) for h in (headers or [])]
    norm_rows: list[list[str]] = [[_clean(c) for c in (row or [])] for row in (rows or [])]

    width = max([len(headers), *[len(r) for r in norm_rows]], default=0)
    for row in norm_rows:
        if len(row) < width:
            row.extend([""] * (width - len(row)))
    while len(headers) < width:
        headers.append("")

    columns = [[row[i] for row in norm_rows] for i in range(width)]
    column_types = [classify_column(headers[i], columns[i]) for i in range(width)]

    total_row_indices = [i for i, row in enumerate(norm_rows) if is_total_row(row)]
    total_set = set(total_row_indices)
    row_roles = ["total" if i in total_set else "data" for i in range(len(norm_rows))]

    has_header_row = bool(headers) and any(h for h in headers) and _looks_like_header_row(headers)

    is_kv = detect_key_value(headers, norm_rows)
    key_value_pairs: list[dict[str, Any]] = []
    if is_kv:
        for idx, row in enumerate(norm_rows):
            if len(row) >= 2 and (row[0] or row[1]):
                key_value_pairs.append({"key": row[0], "value": row[1], "row_index": idx})

    return {
        "layout": "key_value" if is_kv else "table",
        "has_header_row": has_header_row,
        "column_types": column_types,
        "total_row_indices": total_row_indices,
        "row_roles": row_roles,
        "key_value_pairs": key_value_pairs,
        "doc_type": doc_type or "",
    }
