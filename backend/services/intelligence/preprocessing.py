"""Input validation and token-reduction helpers for Factory Intelligence."""

from __future__ import annotations

import hashlib
import re
from typing import Any

from backend.ocr_utils import extract_table_from_image
from backend.services.intelligence.schemas import PreprocessedDocument


ALLOWED_CONTENT_TYPES = {
    "image/png",
    "image/jpeg",
    "image/jpg",
    "image/webp",
    "application/pdf",
}
MAX_UPLOAD_BYTES = 8_000_000

DATE_PATTERNS = [
    re.compile(r"\b\d{1,2}[/-]\d{1,2}[/-]\d{2,4}\b"),
    re.compile(r"\b\d{4}[/-]\d{1,2}[/-]\d{1,2}\b"),
]
SHIFT_PATTERN = re.compile(r"\b(morning|evening|night|day)\b", re.IGNORECASE)
ID_PATTERN = re.compile(r"\b(?:dispatch|invoice|register|log|gate)[\s:#-]*([A-Z0-9/-]{3,})\b", re.IGNORECASE)
QUANTITY_PATTERN = re.compile(r"\b(\d+(?:\.\d+)?)\s*(?:tons?|mt|kg|pcs|pieces|qty|quantity)?\b", re.IGNORECASE)
OPERATOR_PATTERN = re.compile(r"\b(?:operator|driver|supervisor|reviewer|machine)\s*[:#-]?\s*([A-Za-z0-9 .#/-]{2,40})", re.IGNORECASE)
TOTALS_PATTERN = re.compile(r"\b(total|grand total|closing|balance|net|amount)\b", re.IGNORECASE)


def validate_upload(*, filename: str | None, content_type: str | None, size_bytes: int) -> None:
    if not filename:
        raise ValueError("File is required.")
    normalized_type = (content_type or "").strip().lower()
    if normalized_type not in ALLOWED_CONTENT_TYPES:
        raise ValueError("Only PNG, JPG, WEBP, or PDF files are supported.")
    if size_bytes <= 0:
        raise ValueError("Uploaded file is empty.")
    if size_bytes > MAX_UPLOAD_BYTES:
        raise ValueError("Image too large. Max 8MB.")


def compute_document_hash(file_bytes: bytes) -> str:
    return hashlib.sha256(file_bytes).hexdigest()


def _clean_line(line: str) -> str:
    compact = re.sub(r"\s+", " ", (line or "").strip())
    compact = re.sub(r"[^\w\s:/#.,()-]", "", compact)
    return compact.strip()


def _extract_pdf_text_hints(file_bytes: bytes) -> str:
    decoded = file_bytes.decode("latin-1", errors="ignore")
    text_runs = re.findall(r"\(([^\(\)]{2,200})\)", decoded)
    if text_runs:
        return "\n".join(_clean_line(run) for run in text_runs[:120] if _clean_line(run))
    printable = re.findall(r"[A-Za-z0-9:/#.,()% -]{5,}", decoded)
    return "\n".join(_clean_line(run) for run in printable[:120] if _clean_line(run))


def _segment_lines(lines: list[str]) -> dict[str, list[str]]:
    if not lines:
        return {"header": [], "entries": [], "totals": []}
    header = lines[: min(3, len(lines))]
    totals = [line for line in lines if TOTALS_PATTERN.search(line)]
    totals_set = set(totals)
    entries = [line for line in lines[3:] if line not in totals_set]
    return {
        "header": header,
        "entries": entries[:24],
        "totals": totals[:6],
    }


def _extract_obvious_fields(text: str, segments: dict[str, list[str]]) -> dict[str, Any]:
    fields: dict[str, Any] = {}
    for pattern in DATE_PATTERNS:
        match = pattern.search(text)
        if match:
            fields["date"] = match.group(0)
            break
    shift_match = SHIFT_PATTERN.search(text)
    if shift_match:
        fields["shift"] = shift_match.group(1).lower()
    id_match = ID_PATTERN.search(text)
    if id_match:
        fields["document_id"] = id_match.group(1)
    quantities = [float(match.group(1)) for match in QUANTITY_PATTERN.finditer(text[:5000])]
    if quantities:
        fields["quantity_values"] = quantities[:6]
        fields["primary_quantity"] = quantities[0]
    operators = [match.group(1).strip() for match in OPERATOR_PATTERN.finditer(text)]
    if operators:
        fields["operator_mapping"] = operators[:4]
        fields["operator_name"] = operators[0]
    if segments.get("totals"):
        fields["totals_lines"] = segments["totals"]
    if segments.get("header"):
        fields["header_lines"] = segments["header"]
    return fields


def _reduce_context(lines: list[str], segments: dict[str, list[str]], fields: dict[str, Any]) -> str:
    compact_sections: list[str] = []
    if fields:
        key_pairs = [f"{key}: {value}" for key, value in fields.items() if key not in {"header_lines", "totals_lines"}]
        if key_pairs:
            compact_sections.append("obvious_fields:\n" + "\n".join(key_pairs[:12]))
    for label in ("header", "entries", "totals"):
        values = segments.get(label) or []
        if values:
            compact_sections.append(f"{label}:\n" + "\n".join(values[:12]))
    if not compact_sections and lines:
        compact_sections.append("document:\n" + "\n".join(lines[:18]))
    reduced = "\n\n".join(compact_sections)
    return reduced[:5000]


def preprocess_document(
    *,
    request_id: str,
    source_filename: str,
    content_type: str,
    file_bytes: bytes,
) -> PreprocessedDocument:
    validate_upload(filename=source_filename, content_type=content_type, size_bytes=len(file_bytes))
    document_hash = compute_document_hash(file_bytes)
    document_kind = "pdf" if content_type == "application/pdf" else "image"
    warnings: list[str] = []
    lines: list[str] = []
    ocr_rows: list[list[str]] = []
    metadata: dict[str, Any] = {"document_kind": document_kind}

    if document_kind == "image":
        ocr_result = extract_table_from_image(
            file_bytes,
            columns=5,
            language="auto",
            enable_raw_column=True,
        )
        warnings.extend(list(ocr_result.warnings or []))
        ocr_rows = [list(map(str, row)) for row in (ocr_result.rows or [])]
        lines = [_clean_line(" | ".join(cell for cell in row if str(cell).strip())) for row in ocr_rows]
        lines = [line for line in lines if line]
        metadata["ocr_avg_confidence"] = float(ocr_result.avg_confidence or 0.0)
        metadata["ocr_row_count"] = len(ocr_rows)
        metadata["raw_column_added"] = bool(getattr(ocr_result, "raw_column_added", False))
    else:
        pdf_text = _extract_pdf_text_hints(file_bytes)
        lines = [line for line in (_clean_line(line) for line in pdf_text.splitlines()) if line]
        warnings.append("pdf_text_extraction_limited")
        metadata["pdf_hint_line_count"] = len(lines)

    segments = _segment_lines(lines)
    raw_text = "\n".join(lines)
    extracted_fields = _extract_obvious_fields(raw_text, segments)
    reduced_text = _reduce_context(lines, segments, extracted_fields)
    return PreprocessedDocument(
        request_id=request_id,
        document_hash=document_hash,
        source_filename=source_filename,
        content_type=content_type,
        document_kind=document_kind,
        size_bytes=len(file_bytes),
        raw_text=raw_text,
        reduced_text=reduced_text,
        ocr_rows=ocr_rows,
        segments=segments,
        extracted_fields=extracted_fields,
        warnings=warnings,
        metadata=metadata,
    )
