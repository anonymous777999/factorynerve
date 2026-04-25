"""Structured OCR pipeline adapted to DPR verification flow."""

from __future__ import annotations

import logging
from typing import Any

from sqlalchemy.orm import Session

from backend.models.ocr_template import OcrTemplate
from backend.models.ocr_verification import OcrVerification
from backend.ocr_utils import OcrResult
from backend.services.ocr_normalization import normalize_structured_payload
from backend.services.ocr_routing import choose_ocr_route
from backend.table_scan import extract_table_from_image


logger = logging.getLogger(__name__)


def _title_from_hint(doc_type_hint: str | None, template: OcrTemplate | None) -> str:
    if template and template.name:
        return template.name
    normalized = (doc_type_hint or "").strip()
    if not normalized:
        return "OCR Extraction"
    return normalized.replace("-", " ").replace("_", " ").title()


def _doc_type(doc_type_hint: str | None) -> str:
    normalized = (doc_type_hint or "").strip().lower()
    return normalized or "table"


def _flatten_rows(rows: list[list[str]]) -> str | None:
    parts = [" | ".join(cell for cell in row if cell) for row in rows]
    joined = "\n".join(part for part in parts if part.strip())
    return joined or None


def serialize_reused_ocr_result(verification: OcrVerification, *, template: OcrTemplate | None = None) -> dict[str, Any]:
    title = _title_from_hint(verification.doc_type_hint, template)
    rows = verification.reviewed_rows or verification.original_rows or []
    columns = max(len(verification.headers or []), max((len(row) for row in rows), default=0), 1)
    return {
        "type": _doc_type(verification.doc_type_hint),
        "title": title,
        "headers": verification.headers or [],
        "rows": rows,
        "raw_text": verification.raw_text,
        "language": verification.language,
        "confidence": float(verification.avg_confidence or 0),
        "warnings": verification.warnings or [],
        "routing": verification.routing_meta or None,
        "columns": columns,
        "avg_confidence": float(verification.avg_confidence or 0),
        "cell_confidence": None,
        "used_language": verification.language,
        "fallback_used": False,
        "raw_column_added": bool(verification.raw_column_added),
        "reused": True,
        "reused_verification_id": verification.id,
    }


def find_reusable_verification(
    db: Session,
    *,
    org_id: str | None,
    document_hash: str | None,
    template_id: int | None,
    doc_type_hint: str | None,
) -> OcrVerification | None:
    if not org_id or not document_hash:
        return None
    query = (
        db.query(OcrVerification)
        .filter(
            OcrVerification.org_id == org_id,
            OcrVerification.document_hash == document_hash,
        )
        .order_by(OcrVerification.updated_at.desc(), OcrVerification.id.desc())
    )
    normalized_hint = _doc_type(doc_type_hint)
    candidates = query.limit(10).all()
    for candidate in candidates:
        candidate_hint = _doc_type(candidate.doc_type_hint)
        if candidate.template_id != template_id:
            continue
        if candidate_hint != normalized_hint:
            continue
        if candidate.reviewed_rows or candidate.original_rows:
            return candidate
    return None


def build_structured_ocr_result(
    image_bytes: bytes,
    *,
    base_result: OcrResult,
    used_language: str,
    fallback_used: bool,
    template: OcrTemplate | None = None,
    doc_type_hint: str | None = None,
    force_model: str | None = None,
) -> dict[str, Any]:
    route = choose_ocr_route(
        image_bytes,
        force_model=force_model,
        doc_type_hint=doc_type_hint,
        has_template=template is not None,
    )
    fallback_headers = list(template.column_names or []) if template and template.column_names else None
    normalized = normalize_structured_payload(
        {"headers": fallback_headers, "rows": base_result.rows},
        fallback_headers=fallback_headers,
        fallback_rows=base_result.rows,
        fallback_type=_doc_type(doc_type_hint),
        fallback_title=_title_from_hint(doc_type_hint, template),
    )

    tier = str(route.get("model_tier") or "fast")
    if tier in {"balanced", "best"}:
        try:
            ai_table = extract_table_from_image(image_bytes)
            candidate = normalize_structured_payload(
                ai_table,
                fallback_headers=normalized["headers"],
                fallback_rows=normalized["rows"],
                fallback_type=_doc_type(doc_type_hint),
                fallback_title=_title_from_hint(doc_type_hint, template),
            )
            if candidate["rows"]:
                normalized = candidate
        except Exception as error:  # pylint: disable=broad-except
            logger.warning("Structured OCR AI table fallback failed: %s", error)

    raw_text = normalized["raw_text"] or _flatten_rows(normalized["rows"])
    warnings = list(dict.fromkeys([*base_result.warnings, *normalized.get("warnings", [])]))
    return {
        "type": normalized["type"],
        "title": normalized["title"],
        "headers": normalized["headers"],
        "rows": normalized["rows"],
        "raw_text": raw_text,
        "language": used_language,
        "confidence": float(base_result.avg_confidence or 0),
        "warnings": warnings,
        "routing": route,
        "columns": max(len(normalized["headers"]), max((len(row) for row in normalized["rows"]), default=0), 1),
        "avg_confidence": float(base_result.avg_confidence or 0),
        "cell_confidence": base_result.cell_confidence,
        "used_language": used_language,
        "fallback_used": fallback_used,
        "raw_column_added": bool(base_result.raw_column_added),
        "reused": False,
        "reused_verification_id": None,
    }
