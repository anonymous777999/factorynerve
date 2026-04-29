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
_DEFAULT_ROUTE = {
    "clarity_score": 0.0,
    "score_reason": "Routing fallback used.",
    "model_tier": "fast",
    "forced": False,
    "scorer_used": False,
    "actual_cost_usd": 0.0008,
    "cost_saved_usd": 0.0132,
}
_AI_REQUIRED_DOC_TYPES = {"table", "sheet", "spreadsheet"}


def _populated_cell_count(rows: list[list[str]] | None) -> int:
    if not rows:
        return 0
    return sum(1 for row in rows for cell in row if str(cell or "").strip())


def _structured_rows_usable(rows: list[list[str]] | None) -> bool:
    row_count = len(rows or [])
    populated_cells = _populated_cell_count(rows)
    if row_count == 0 or populated_cells == 0:
        return False
    if row_count <= 1 and populated_cells <= 2:
        return False
    return True


def _should_run_ai_table_enhancement(
    base_result: OcrResult,
    route: dict[str, Any],
    *,
    doc_type_hint: str | None = None,
) -> bool:
    tier = str(route.get("model_tier") or "fast")
    if tier not in {"balanced", "best"}:
        return False

    if bool(route.get("forced")):
        return True

    if _doc_type(doc_type_hint) in {"table", "sheet", "spreadsheet"}:
        return True

    rows = base_result.rows or []
    row_count = len(rows)
    populated_cells = _populated_cell_count(rows)
    avg_confidence = float(base_result.avg_confidence or 0.0)

    if row_count == 0 or populated_cells == 0:
        return True
    if row_count <= 1 and populated_cells <= 4:
        return True
    if avg_confidence < 24 and populated_cells <= 8:
        return True
    if avg_confidence < 18:
        return True
    return False


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


def _requires_remote_table_ai(doc_type_hint: str | None) -> bool:
    return _doc_type(doc_type_hint) in _AI_REQUIRED_DOC_TYPES


def _reuse_has_remote_ai(candidate: OcrVerification) -> bool:
    routing = candidate.routing_meta or {}
    if not isinstance(routing, dict):
        return False
    return bool(routing.get("ai_applied")) and str(routing.get("provider_used") or "").strip().lower() in {
        "anthropic",
        "bytez",
    }


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
        "scan_quality": verification.scan_quality or None,
        "routing": verification.routing_meta or None,
        "columns": columns,
        "avg_confidence": float(verification.avg_confidence or 0),
        "cell_confidence": None,
        "cell_boxes": (verification.scan_quality or {}).get("cell_boxes"),
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
        if normalized_hint in _AI_REQUIRED_DOC_TYPES and not _reuse_has_remote_ai(candidate):
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
    try:
        route = choose_ocr_route(
            image_bytes,
            force_model=force_model,
            doc_type_hint=doc_type_hint,
            has_template=template is not None,
        )
    except Exception as error:  # pylint: disable=broad-except
        logger.warning("Structured OCR routing failed; using fast tier defaults: %s", error, exc_info=True)
        route = dict(_DEFAULT_ROUTE)
    fallback_headers = list(template.column_names or []) if template and template.column_names else None
    normalized = normalize_structured_payload(
        {"headers": fallback_headers, "rows": base_result.rows or []},
        fallback_headers=fallback_headers,
        fallback_rows=base_result.rows or [],
        fallback_type=_doc_type(doc_type_hint),
        fallback_title=_title_from_hint(doc_type_hint, template),
    )
    route_meta = dict(route or _DEFAULT_ROUTE)
    route_meta.setdefault("provider_used", "tesseract")
    route_meta.setdefault("provider_model", "local-tesseract")
    route_meta.setdefault("ai_applied", False)
    route_meta.setdefault("ai_attempted", False)
    route_meta.setdefault("ai_degraded_to_base", False)
    ai_required = _requires_remote_table_ai(doc_type_hint)
    extra_warnings: list[str] = []
    if ai_required and str(route_meta.get("model_tier") or "fast") == "fast":
        route_meta["model_tier"] = "balanced"
        route_meta["score_reason"] = (
            f"{route_meta.get('score_reason') or 'Routing fallback used.'}; "
            "structured table extraction forced through remote AI"
        )
        route = route_meta

    if _should_run_ai_table_enhancement(base_result, route, doc_type_hint=doc_type_hint):
        route_meta["ai_attempted"] = True
        try:
            logger.info(
                "Structured OCR attempting AI enhancement tier=%s doc_type=%s rows=%s avg_confidence=%.2f",
                route.get("model_tier"),
                _doc_type(doc_type_hint),
                len(base_result.rows or []),
                float(base_result.avg_confidence or 0.0),
            )
            ai_table = extract_table_from_image(
                image_bytes,
                provider_preference="anthropic",
                allow_local_fallback=False,
                model_tier=str(route.get("model_tier") or "balanced"),
            )
            candidate = normalize_structured_payload(
                ai_table,
                fallback_headers=normalized["headers"],
                fallback_rows=normalized["rows"],
                fallback_type=_doc_type(doc_type_hint),
                fallback_title=_title_from_hint(doc_type_hint, template),
            )
            if candidate["rows"]:
                logger.info(
                    "Structured OCR AI enhancement applied rows=%s columns=%s",
                    len(candidate["rows"]),
                    len(candidate["headers"]),
                )
                normalized = candidate
                route_meta["provider_used"] = ai_table.get("provider_used") or "anthropic"
                route_meta["provider_model"] = ai_table.get("provider_model") or route_meta.get("provider_model")
                route_meta["ai_applied"] = bool(ai_table.get("ai_applied", True))
            else:
                logger.info("Structured OCR AI enhancement returned no rows; keeping base OCR result.")
        except Exception as error:  # pylint: disable=broad-except
            if ai_required and _structured_rows_usable(normalized.get("rows") or []):
                route_meta["ai_degraded_to_base"] = True
                route_meta["ai_failure_reason"] = type(error).__name__
                extra_warnings.append("AI enhancement unavailable; using local OCR result.")
                logger.warning(
                    "Structured OCR AI enhancement failed; using base OCR result instead: %s",
                    error,
                    exc_info=True,
                )
            elif ai_required:
                raise RuntimeError("AI table extraction failed for this scan. Please retry.") from error
            else:
                logger.warning("Structured OCR AI table fallback failed: %s", error, exc_info=True)
    elif ai_required:
        if _structured_rows_usable(normalized.get("rows") or []):
            route_meta["ai_degraded_to_base"] = True
            route_meta["ai_failure_reason"] = "not_scheduled"
            extra_warnings.append("AI enhancement unavailable; using local OCR result.")
            logger.warning("Structured OCR AI enhancement was not scheduled; keeping usable base OCR result.")
        else:
            raise RuntimeError("AI table extraction was not scheduled for this scan.")

    raw_text = normalized.get("raw_text") or _flatten_rows(normalized.get("rows") or [])
    warnings = list(
        dict.fromkeys(
            [
                *(base_result.warnings or []),
                *(normalized.get("warnings") or []),
                *extra_warnings,
            ]
        )
    )
    normalized_headers = normalized.get("headers") or []
    normalized_rows = normalized.get("rows") or []
    avg_confidence = float(base_result.avg_confidence or 0)
    return {
        "type": normalized.get("type") or _doc_type(doc_type_hint),
        "title": normalized.get("title") or _title_from_hint(doc_type_hint, template),
        "headers": normalized_headers,
        "rows": normalized_rows,
        "raw_text": raw_text,
        "language": used_language,
        "confidence": avg_confidence,
        "warnings": warnings,
        "routing": route_meta,
        "columns": max(len(normalized_headers), max((len(row) for row in normalized_rows), default=0), 1),
        "avg_confidence": avg_confidence,
        "cell_confidence": base_result.cell_confidence or [],
        "cell_boxes": base_result.cell_boxes or [],
        "used_language": used_language,
        "fallback_used": fallback_used,
        "raw_column_added": bool(base_result.raw_column_added),
        "reused": False,
        "reused_verification_id": None,
    }
