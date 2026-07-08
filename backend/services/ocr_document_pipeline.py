"""Structured OCR pipeline adapted to DPR verification flow."""

from __future__ import annotations

import json
import logging
import os
from typing import Any

from sqlalchemy.orm import Session
from datetime import datetime, timezone
from backend.models.ocr_template import OcrTemplate
from backend.models.ocr_verification import OcrVerification
from backend.ocr_utils import OcrResult
from backend.understanding.classifier import classify as classify_document
from backend.understanding.normalizer import normalize as normalize_understanding
from backend.understanding.parser_registry import parse_document
from backend.services.anthropic_usage import normalize_anthropic_model_name
from backend.services.ocr_confidence import calculate_structural_confidence
from backend.services.ocr_confidence import calculate_factual_confidence


# ── Feature flag: OCR_NEW_CONFIDENCE_ENABLED ─────────────────────────────────
# When enabled, surfaces factual_confidence alongside structural avg_confidence.
# Factual confidence blends cross-validation discrepancies into the score:
#   - Unvalidated: capped at 50% of structural
#   - Blocked (>30% discrepancy): floored at 10%
#   - Needs review: penalized proportionally
# When disabled, factual_confidence is omitted from the output (backward compat).
_OCR_NEW_CONFIDENCE_ENABLED = os.getenv("OCR_NEW_CONFIDENCE_ENABLED", "true").lower() in ("1", "true", "yes", "on")
from backend.services.ocr_normalization import normalize_structured_payload
from backend.services.ocr_normalization import (
    build_cell_confidence_matrix,
    build_confidence_enriched_rows,
)
from backend.services.ocr_routing import choose_ocr_route
from backend.services.ocr_layout_analysis import (
    suppress_repeated_headers,
    prune_empty_columns,
    analyze_layout,
    calculate_layout_confidence,
)
from backend.services.ocr_structural_grouping import (
    analyze_and_group,
    apply_selector_bridge,
)
from backend.table_scan import extract_table_from_image
from backend.utils import normalize_confidence
from backend.services.ocr_cross_validator import OcrCrossValidator, CrossValidationResult
from backend.services.pipeline_metadata import PipelineMetadata
from backend.services.ocr_image_preprocessing import preprocess_image, preprocess_image_metadata
from backend.validators import OcrValidationPipeline, ValidationResult
from backend.metrics import (
    OCR_CACHE_HIT_RATIO,
    OCR_EXTRACTION_SUCCESS_RATE,
)


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


def _build_validation_from_verification(verification: OcrVerification) -> dict | None:
    """Run the validation pipeline against stored verification data.

    Reconstructs the validation result from the stored headers/rows.
    Returns None if no validation can be run (no rows/headers).
    """
    headers = verification.headers or []
    rows = verification.reviewed_rows or verification.original_rows or []
    if not headers and not rows:
        return None
    try:
        pipeline = OcrValidationPipeline()
        result = pipeline.validate(
            headers=headers,
            rows=rows,
            doc_type=verification.doc_type_hint,
            cross_validation=verification.cross_validation,
        )
        return result.to_dict()
    except Exception:
        logger.warning("Validation from cache failed for verification id=%s", verification.id, exc_info=True)
        return None


# Feature flag for cell object structure (Phase 1)
# IMPORTANT: Cell objects should ONLY exist in export/metadata layers
# DO NOT enable in main runtime to preserve backward compatibility
_ENABLE_CELL_FORMAT_V2 = os.getenv("CELL_FORMAT_V2", "false").lower() == "true"


def _upgrade_rows_to_cell_objects(
    rows: list[list[str]],
    cell_confidence_matrix: list[list[float]] | None = None,
) -> list[list[dict[str, Any]]]:
    """
    Phase 1 & 3: Minimal cell object upgrade with numeric normalization.
    
    Converts string rows to structured cell objects with:
    - value: str (display value - preserved)
    - confidence: float (0.0-1.0)
    - normalized: float | None (Phase 3: safe numeric value for calculations)
    
    Args:
        rows: List of string rows
        cell_confidence_matrix: Optional OCR confidence matrix
    
    Returns:
        List of rows with cell objects (including normalized where applicable)
    """
    # Import here to avoid circular dependencies
    from backend.services.ocr_cell_adapter import (
        normalize_cell,
        infer_column_types,
        estimate_confidence_simple,
    )
    
    if not rows:
        return []
    
    # Infer column types
    column_types = infer_column_types(rows)
    
    # Upgrade each cell
    upgraded_rows = []
    for row_idx, row in enumerate(rows):
        upgraded_row = []
        for col_idx, cell in enumerate(row):
            # Get column type
            column_type = column_types[col_idx] if col_idx < len(column_types) else "text"
            
            # Get OCR confidence if available
            ocr_conf = None
            if cell_confidence_matrix and row_idx < len(cell_confidence_matrix):
                if col_idx < len(cell_confidence_matrix[row_idx]):
                    ocr_conf = cell_confidence_matrix[row_idx][col_idx]
            
            # Phase 3: Enable numeric normalization for numeric columns
            add_normalized = (column_type == "numeric")
            
            # Normalize to cell object (with optional numeric normalization)
            cell_obj = normalize_cell(cell, confidence=ocr_conf, add_normalized=add_normalized)
            
            # Enhance confidence with context
            cell_obj["confidence"] = estimate_confidence_simple(
                cell_obj["value"],
                column_type,
                cell_obj["confidence"]
            )
            
            upgraded_row.append(cell_obj)
        
        upgraded_rows.append(upgraded_row)
    
    return upgraded_rows


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


def _reuse_matches_requested_model(candidate: OcrVerification, requested_model: str | None) -> bool:
    normalized_requested = normalize_anthropic_model_name(requested_model)
    if not normalized_requested:
        return True
    routing = candidate.routing_meta or {}
    if not isinstance(routing, dict):
        return False
    provider_model = normalize_anthropic_model_name(str(routing.get("provider_model") or ""))
    selected_model = normalize_anthropic_model_name(str(routing.get("selected_model") or ""))
    requested_meta_model = normalize_anthropic_model_name(str(routing.get("requested_model") or ""))
    return normalized_requested in {provider_model, selected_model, requested_meta_model}


def _flatten_rows(rows: list[list[str]]) -> str | None:
    parts = ["\t".join(cell for cell in row if cell) for row in rows]
    joined = "\n".join(part for part in parts if part.strip())
    return joined or None


def _apply_document_understanding(payload: dict[str, Any]) -> dict[str, Any]:
    try:
        rows = payload.get("rows") or []
        text = str(payload.get("raw_text") or _flatten_rows(rows) or "")
        classified = classify_document(text)
        # classify() returns [(doc_type, confidence), ...] sorted by confidence;
        # normalize into an understanding dict (older versions returned a dict).
        if isinstance(classified, dict):
            understanding = dict(classified)
            doc_type = str(understanding.get("doc_type") or "generic")
        else:
            candidates = [
                (str(item[0]), float(item[1]))
                for item in (classified or [])
                if isinstance(item, (list, tuple)) and len(item) >= 2
            ]
            doc_type = candidates[0][0] if candidates else "generic"
            understanding = {
                "doc_type": doc_type,
                "confidence": candidates[0][1] if candidates else 0.0,
                "candidates": [
                    {"doc_type": dt, "confidence": conf} for dt, conf in candidates
                ],
            }
        parsed = parse_document(doc_type, rows)
        normalized = normalize_understanding(parsed)
        sheets = normalized.get("sheets") if isinstance(normalized, dict) else []
        if not sheets or not isinstance(sheets[0], dict):
            return payload
        first_sheet = sheets[0]
        return {
            **payload,
            "headers": [str(value) for value in first_sheet.get("columns") or []],
            "rows": [[str(cell) for cell in row] for row in first_sheet.get("rows") or []],
            "sheets": sheets,
            "understanding": understanding,
        }
    except Exception as error:  # pylint: disable=broad-except
        logger.warning("Document understanding failed; using original OCR rows: %s", error, exc_info=True)
        return payload


def _stringify_report_value(value: Any) -> str:
    if value is None:
        return ""
    if isinstance(value, str):
        return value.strip()
    if isinstance(value, (int, float, bool)):
        return str(value)
    if isinstance(value, (dict, list)):
        return json.dumps(value, ensure_ascii=True, default=str)
    return str(value).strip()


def _section_title(section: Any, index: int) -> str:
    if isinstance(section, dict):
        for key in ("title", "name", "label", "heading", "section_title"):
            value = _stringify_report_value(section.get(key))
            if value:
                return value
        section_type = _stringify_report_value(section.get("type") or section.get("kind"))
        if section_type:
            return section_type.replace("_", " ").replace("-", " ").title()
    return f"Section {index}"


def _flatten_metadata_map(metadata: dict[str, Any] | None, *, prefix: str = "") -> dict[str, str]:
    flattened: dict[str, str] = {}
    for key, value in (metadata or {}).items():
        normalized_key = _stringify_report_value(key) or "metadata"
        composed_key = f"{prefix}.{normalized_key}" if prefix else normalized_key
        if isinstance(value, dict):
            nested = _flatten_metadata_map(value, prefix=composed_key)
            if nested:
                flattened.update(nested)
            else:
                flattened[composed_key] = "{}"
        elif isinstance(value, list):
            flattened[composed_key] = json.dumps(value, ensure_ascii=True, default=str)
        else:
            flattened[composed_key] = _stringify_report_value(value)
    return flattened


def _section_to_table(section: Any, index: int) -> dict[str, Any]:
    title = _section_title(section, index)
    if isinstance(section, dict):
        section_type = _stringify_report_value(section.get("type") or section.get("kind")).lower() or "section"
        if section_type == "form" and isinstance(section.get("fields"), list):
            rows = [
                [
                    _stringify_report_value(field.get("label") if isinstance(field, dict) else ""),
                    _stringify_report_value(field.get("value") if isinstance(field, dict) else field),
                ]
                for field in section.get("fields") or []
            ]
            return {"title": title, "type": "form", "headers": ["Field", "Value"], "rows": rows}
        if section_type == "text" and isinstance(section.get("lines"), list):
            rows = [[_stringify_report_value(line)] for line in section.get("lines") or []]
            return {"title": title, "type": "text", "headers": ["Text"], "rows": rows}
        if isinstance(section.get("table"), dict):
            normalized = normalize_structured_payload(
                section.get("table"),
                fallback_type="table",
                fallback_title=title,
            )
            return {
                "title": title,
                "type": section_type or normalized.get("type") or "table",
                "headers": normalized.get("headers") or [],
                "rows": normalized.get("rows") or [],
            }
        normalized = normalize_structured_payload(
            section,
            fallback_type=section_type or "table",
            fallback_title=title,
        )
        if normalized.get("rows"):
            return {
                "title": title,
                "type": section_type or normalized.get("type") or "table",
                "headers": normalized.get("headers") or [],
                "rows": normalized.get("rows") or [],
            }
        scalar_pairs = [
            [str(key), _stringify_report_value(value)]
            for key, value in section.items()
            if key not in {"title", "name", "label", "heading", "section_title", "type", "kind"}
            and not isinstance(value, (dict, list))
        ]
        if scalar_pairs:
            return {"title": title, "type": section_type or "form", "headers": ["Field", "Value"], "rows": scalar_pairs}
        return {
            "title": title,
            "type": section_type or "section",
            "headers": ["Section"],
            "rows": [[json.dumps(section, ensure_ascii=True, default=str)]],
        }

    normalized = normalize_structured_payload(
        section,
        fallback_type="table",
        fallback_title=title,
    )
    return {
        "title": title,
        "type": normalized.get("type") or "table",
        "headers": normalized.get("headers") or [],
        "rows": normalized.get("rows") or [],
    }


def transform_sections_to_report_input(
    payload: Any,
    *,
    title: str | None = None,
    metadata: dict[str, Any] | None = None,
) -> dict[str, Any]:
    source = payload if isinstance(payload, dict) else {}
    sections = source.get("sections") if isinstance(source.get("sections"), list) else payload if isinstance(payload, list) else None
    report_title = title or _stringify_report_value(source.get("title")) or "OCR Extraction"
    report_metadata = {
        **_flatten_metadata_map(source.get("metadata") if isinstance(source.get("metadata"), dict) else {}),
        **_flatten_metadata_map(metadata),
    }
    if isinstance(source, dict):
        for key, value in source.items():
            if key in {"sections", "tables", "metadata", "title"}:
                continue
            if not isinstance(value, (dict, list)):
                report_metadata.setdefault(str(key), _stringify_report_value(value))

    if sections is None:
        normalized = normalize_structured_payload(
            payload,
            fallback_title=report_title,
        )
        tables = [
            {
                "title": report_title,
                "type": normalized.get("type") or "table",
                "headers": normalized.get("headers") or [],
                "rows": normalized.get("rows") or [],
            }
        ]
    else:
        tables = [_section_to_table(section, index + 1) for index, section in enumerate(sections)]

    totals = {
        "table_count": len(tables),
        "row_count": sum(len(table.get("rows") or []) for table in tables),
        "column_count": max((len(table.get("headers") or []) for table in tables), default=0),
        "section_count": len(sections or tables),
    }
    return {
        "title": report_title,
        "metadata": report_metadata,
        "tables": tables,
        "totals": totals,
    }


def format_for_ui(response: Any) -> dict[str, Any]:
    if not isinstance(response, dict):
        normalized = normalize_structured_payload(response)
        return {
            **normalized,
            "metadata": {},
            "tables": [
                {
                    "title": normalized.get("title") or "OCR Extraction",
                    "type": normalized.get("type") or "table",
                    "headers": normalized.get("headers") or [],
                    "rows": normalized.get("rows") or [],
                }
            ],
            "totals": {
                "table_count": 1,
                "row_count": len(normalized.get("rows") or []),
                "column_count": len(normalized.get("headers") or []),
                "section_count": 1,
            },
        }

    if isinstance(response.get("tables"), list):
        report = dict(response)
    else:
        report = transform_sections_to_report_input(response)

    tables = [table for table in report.get("tables", []) if isinstance(table, dict)]
    flat_metadata = _flatten_metadata_map(report.get("metadata") if isinstance(report.get("metadata"), dict) else {})
    if len(tables) <= 1:
        table = tables[0] if tables else {"title": report.get("title") or "OCR Extraction", "headers": [], "rows": [], "type": "table"}
        headers = [str(value) for value in table.get("headers") or []]
        rows = [[str(cell) for cell in row] for row in table.get("rows") or []]
    else:
        headers = ["Section"]
        for table in tables:
            for header in table.get("headers") or []:
                normalized_header = _stringify_report_value(header)
                if normalized_header and normalized_header not in headers:
                    headers.append(normalized_header)
        rows = []
        for table in tables:
            table_headers = [_stringify_report_value(header) for header in table.get("headers") or []]
            for row in table.get("rows") or []:
                mapped = {
                    table_headers[index]: _stringify_report_value(cell)
                    for index, cell in enumerate(row)
                    if index < len(table_headers)
                }
                rows.append([_stringify_report_value(table.get("title"))] + [mapped.get(header, "") for header in headers[1:]])

    normalized = normalize_structured_payload(
        {
            "type": "table",
            "title": report.get("title") or "OCR Extraction",
            "headers": headers,
            "rows": rows,
            "raw_text": report.get("raw_text"),
        },
        fallback_title=report.get("title") or "OCR Extraction",
    )
    if not normalized.get("raw_text"):
        metadata_lines = [f"{key}: {value}" for key, value in flat_metadata.items() if value]
        row_text = _flatten_rows(normalized.get("rows") or [])
        normalized["raw_text"] = "\n".join(line for line in [*metadata_lines, row_text or ""] if line).strip() or None
    return {
        **report,
        "type": report.get("type") or "table",
        "title": report.get("title") or normalized.get("title") or "OCR Extraction",
        "metadata": flat_metadata,
        "headers": normalized.get("headers") or [],
        "rows": normalized.get("rows") or [],
        "raw_text": normalized.get("raw_text"),
        "warnings": report.get("warnings") or [],
        "columns": max(len(normalized.get("headers") or []), max((len(row) for row in normalized.get("rows") or []), default=0), 1),
    }


def serialize_reused_ocr_result(verification: OcrVerification, *, template: OcrTemplate | None = None) -> dict[str, Any]:
    title = _title_from_hint(verification.doc_type_hint, template)
    rows = verification.reviewed_rows or verification.original_rows or []
    columns = max(len(verification.headers or []), max((len(row) for row in rows), default=0), 1)

    # Calculate cache age
    now = datetime.now(timezone.utc)
    created_at = verification.created_at
    if created_at.tzinfo is None:
        created_at = created_at.replace(tzinfo=timezone.utc)
    age_seconds = (now - created_at).total_seconds()
    age_hours = int(age_seconds // 3600)

    # Determine cache trust
    confidence = normalize_confidence(verification.avg_confidence) or 0.0
    warnings = verification.warnings or []
    scan_quality = verification.scan_quality or {}
    review_required = scan_quality.get("confidence_band") == "low" or bool(warnings)
    
    # Smart trust policy: lower trust only when document-level signals suggest a risky extraction.
    cache_trust = "high"
    # Tightened: single warning on medium confidence now triggers low trust (Bug #24)
    if review_required or (scan_quality.get("confidence_band") == "medium" and len(warnings) >= 1):
        cache_trust = "low"

    # user_corrected if reviewed_rows differs from original_rows
    # (Checking if reviewed_rows is not just a copy of original_rows)
    user_corrected = False
    if verification.reviewed_rows and verification.original_rows:
        if json.dumps(verification.reviewed_rows, sort_keys=True) != json.dumps(verification.original_rows, sort_keys=True):
            user_corrected = True

    routing = verification.routing_meta or {}
    reprocess_count = int(routing.get("reprocess_count", 0))
    
    # Get layout confidence from scan_quality if available (NEW)
    layout_confidence = scan_quality.get("layout_confidence", 0.5)

    # NEW (P0-2): Factual confidence from cached cross-validation
    # Recompute factual confidence from the stored cross-validation dictionary
    # so cached results show the same dual-score system as fresh results.
    factual_confidence_payload: dict[str, Any] | None = None
    if _OCR_NEW_CONFIDENCE_ENABLED:
        cv = verification.cross_validation or {}
        if isinstance(cv, dict) and cv.get("status"):
            # Cross-validation data exists — rebuild factual score from cached state
            status = str(cv.get("status") or "unvalidated")
            if status == "verified":
                factual_score = confidence
            elif status == "blocked":
                factual_score = 10.0
            elif status == "needs_review":
                factual_score = max(10.0, confidence * 0.8)
            else:
                factual_score = min(confidence * 0.5, 50.0)
            factual_confidence_payload = {
                "score": round(factual_score, 1),
                "status": status,
                "discrepancies": int(cv.get("discrepancies", 0) or 0),
                "explanation": str(cv.get("explanation") or "Cached cross-validation data."),
            }
        else:
            # No cached cross-validation — cap at 50% to indicate unverified
            factual_confidence_payload = {
                "score": round(min(confidence * 0.5, 50.0), 1),
                "status": "unvalidated",
                "discrepancies": 0,
                "explanation": "No cross-validation data available for cached result.",
            }

    return {
        "type": _doc_type(verification.doc_type_hint),
        "title": title,
        "headers": verification.headers or [],
        "rows": rows,
        "raw_text": verification.raw_text,
        "language": verification.language,
        "confidence": confidence,
        "warnings": warnings,
        "scan_quality": scan_quality,
        "routing": routing,
        "columns": columns,
        "avg_confidence": confidence,
        "layout_confidence": layout_confidence,  # NEW: Layout confidence from cache
        "layout_type": scan_quality.get("layout_type", "unknown"),  # NEW: Cached layout type
        "cell_confidence": None,
        "cell_boxes": scan_quality.get("cell_boxes"),
        "used_language": verification.language,
        "fallback_used": False,
        "raw_column_added": bool(verification.raw_column_added),
        "reused": True,
        "reused_verification_id": verification.id,
        "cross_validation": verification.cross_validation,
        "factual_confidence": factual_confidence_payload if _OCR_NEW_CONFIDENCE_ENABLED else None,
        "pipeline_metadata": cached_meta.to_dict(),
        "cached": True,
        "cache_created_at": created_at.isoformat(),
        "cache_age_hours": age_hours,
        "cache_trust": cache_trust,
        "ttl_hours": 24 if cache_trust == "low" else 168,
        "reprocess_count": reprocess_count,
        "reprocess_limit": 3,
        "ai_degraded_to_base": routing.get("ai_degraded_to_base", False),
        "user_corrected": user_corrected,
        "review_required": review_required,
        "last_reprocessed_at": routing.get("last_reprocessed_at"),
        "previous_confidence": routing.get("previous_confidence"),
        "model": routing.get("provider_model") or routing.get("selected_model") or "local-tesseract",
        "validation": _build_validation_from_verification(verification),
    }


def find_reusable_verification(
    db: Session,
    *,
    org_id: str | None,
    document_hash: str | None,
    template_id: int | None,
    doc_type_hint: str | None,
    requested_model: str | None = None,
) -> OcrVerification | None:
    if not org_id or not document_hash:
        OCR_CACHE_HIT_RATIO.set(0.0)
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
        if not _reuse_matches_requested_model(candidate, requested_model):
            continue
        if candidate.reviewed_rows or candidate.original_rows:
            # Cache hit — update hit ratio
            OCR_CACHE_HIT_RATIO.set(1.0)
            return candidate
    OCR_CACHE_HIT_RATIO.set(0.0)
    return None


def build_structured_ocr_result(
    image_bytes: bytes,
    *,
    base_result: OcrResult,
    used_language: str,
    fallback_used: bool = False,
    template: OcrTemplate | None = None,
    doc_type_hint: str | None = None,
    force_model: str | None = None,
    pipeline_metadata: PipelineMetadata | None = None,
) -> dict[str, Any]:
    """Build a structured OCR result from a local Tesseract base result.

    Parameters
    ----------
    pipeline_metadata :
        Consolidated pipeline quality state (P0-3). When provided, the value of
        ``pipeline_metadata.tesseract_fallback_used`` takes precedence over the
        legacy ``fallback_used`` parameter. New code should prefer passing
        ``pipeline_metadata`` instead of the individual bool.
    """
    # Merge legacy fallback_used into PipelineMetadata for backward compatibility.
    # A caller-supplied PipelineMetadata takes precedence and is preserved;
    # only create a fresh one when the caller didn't pass any.
    if pipeline_metadata is not None:
        if fallback_used:
            pipeline_metadata.tesseract_fallback_used = True
        fallback_used = pipeline_metadata.tesseract_fallback_used
    else:
        pipeline_metadata = PipelineMetadata(tesseract_fallback_used=fallback_used)

    # Preprocess image for better OCR on factory documents (P0-1)
    try:
        preprocessed = preprocess_image(image_bytes)
        if preprocessed is not None and preprocessed != image_bytes:
            image_bytes = preprocessed
            pipeline_metadata.preprocessing_applied = True
    except Exception as exc:
        logger.warning("OCR preprocessing failed: %s", exc)
        pipeline_metadata.preprocessing_applied = False

    requested_model = normalize_anthropic_model_name(force_model)
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
    route_meta.setdefault("requested_model", requested_model)
    route_meta.setdefault("selected_model", requested_model)
    route_meta.setdefault("ai_applied", False)
    route_meta.setdefault("ai_attempted", False)
    route_meta.setdefault("ai_degraded_to_base", False)
    ai_debug_response: dict[str, Any] | None = None
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
                requested_model=requested_model,
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
                route_meta["requested_model"] = ai_table.get("requested_model") or route_meta.get("requested_model")
                route_meta["selected_model"] = ai_table.get("selected_model") or route_meta.get("selected_model")
                route_meta["ai_applied"] = bool(ai_table.get("ai_applied", True))
                if isinstance(ai_table.get("token_usage"), dict):
                    route_meta["usage"] = ai_table.get("token_usage")
                if isinstance(ai_table.get("debug_response"), dict):
                    ai_debug_response = ai_table.get("debug_response")
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
    normalized = _apply_document_understanding(
        {
            "type": normalized.get("type") or _doc_type(doc_type_hint),
            "title": normalized.get("title") or _title_from_hint(doc_type_hint, template),
            "headers": normalized.get("headers") or [],
            "rows": normalized.get("rows") or [],
            "raw_text": raw_text,
        }
    )
    normalized_headers = normalized.get("headers") or []
    normalized_rows = normalized.get("rows") or []
    
    # ==================================================================
    # PHASE 1-5: NEW LAYOUT & STRUCTURAL ANALYSIS PIPELINE
    # ==================================================================

    # Phase 1: Safe immediate fixes
    phase1_warnings = []

    # 1. Repeated header suppression
    try:
        normalized_rows, suppression_warnings = suppress_repeated_headers(
            normalized_rows,
            base_result.cell_boxes
        )
        phase1_warnings.extend(suppression_warnings)
    except Exception as error:  # pylint: disable=broad-except
        logger.warning("Repeated header suppression failed: %s", error, exc_info=True)

    # 2. Empty column pruning
    try:
        normalized_headers, normalized_rows, pruning_warnings = prune_empty_columns(
            normalized_headers,
            normalized_rows,
            threshold=0.8
        )
        phase1_warnings.extend(pruning_warnings)
    except Exception as error:  # pylint: disable=broad-except
        logger.warning("Empty column pruning failed: %s", error, exc_info=True)

    # Phase 2-3: Layout analysis (with bounding box canonicalization built-in)
    try:
        layout_analysis_result = analyze_layout(
            normalized_headers,
            normalized_rows,
            base_result.cell_boxes
        )
    except Exception as error:  # pylint: disable=broad-except
        logger.warning("Layout analysis failed: %s", error, exc_info=True)
        # Provide fallback values to allow pipeline to continue
        layout_analysis_result = {
            "layout_confidence": 0.5,
            "layout_type": "unknown",
            "processing_time_ms": 0.0,
            "heuristics_applied": [],
            "warnings": [f"Layout analysis skipped due to error: {str(error)}"]
        }

    # Phase 4-5: Structural grouping and selector bridge
    try:
        structural_grouping = analyze_and_group(
            normalized_headers,
            normalized_rows,
            layout_analysis_result,
            title=normalized.get("title") or _title_from_hint(doc_type_hint, template)
        )
    except Exception as error:  # pylint: disable=broad-except
        logger.warning("Structural grouping failed: %s", error, exc_info=True)
        # Provide fallback values
        structural_grouping = {
            "primary_group": None,
            "grouping_strategy": "unknown",
            "warnings": [f"Structural grouping skipped due to error: {str(error)}"]
        }

    # Apply selector bridge to get generic contract
    if structural_grouping.get("primary_group"):
        try:
            bridge_output = apply_selector_bridge(structural_grouping["primary_group"])
            # Update normalized data with bridge output
            normalized_headers = bridge_output.get("headers", normalized_headers)
            normalized_rows = bridge_output.get("rows", normalized_rows)
        except Exception as error:  # pylint: disable=broad-except
            logger.warning("Selector bridge failed: %s", error, exc_info=True)
            warnings.append(f"Selector bridge skipped due to error: {str(error)}")
            # Continue with unmodified normalized data

    # Collect all warnings
    warnings.extend(phase1_warnings)
    warnings.extend(layout_analysis_result.get("warnings", []))
    warnings.extend(structural_grouping.get("warnings", []))
    
    # ==================================================================
    # END NEW PIPELINE - Continue with existing confidence calculation
    # ==================================================================
    
    raw_text = normalized.get("raw_text") or _flatten_rows(normalized_rows)
    confidence_payload = calculate_structural_confidence(
        {
            "headers": normalized_headers,
            "rows": normalized_rows,
        }
    )
    avg_confidence = float(confidence_payload.get("score") or 0.0)
    
    # Get layout confidence from analysis
    layout_confidence = layout_analysis_result.get("layout_confidence", 0.5)
    
    heuristic_confidence_matrix = build_cell_confidence_matrix(normalized_headers, normalized_rows)
    final_rows = build_confidence_enriched_rows(normalized_headers, normalized_rows)

    # ==================================================================
    # CROSS-VALIDATION: Compare AI-enhanced rows against Tesseract base
    # ==================================================================
    cross_validation_result: CrossValidationResult | None = None
    base_rows_for_validation = base_result.rows or []
    if base_rows_for_validation and normalized_rows:
        try:
            validator = OcrCrossValidator()
            cross_validation_result = validator.validate(
                image_bytes=image_bytes,
                ai_extracted_rows=normalized_rows,
                tesseract_rows=base_rows_for_validation,
            )
            
            # Adjust confidence based on cross-validation
            # We use the score from the result if we want to influence avg_confidence directly,
            # but here we'll follow the plan to use it to augment warnings and metadata.
            if cross_validation_result.status == "blocked":
                avg_confidence *= 0.5
                warnings.append(f"CRITICAL: {cross_validation_result.explanation}")
            elif cross_validation_result.status == "needs_review":
                avg_confidence *= 0.8
                warnings.append(f"WARNING: {cross_validation_result.explanation}")
            
        except Exception as error:  # pylint: disable=broad-except
            logger.warning("Cross-validation failed: %s", error, exc_info=True)
    
    # ==================================================================
    # END CROSS-VALIDATION
    # ==================================================================

    # NEW (P0-2): Surface factual confidence alongside structural confidence
    # Factual confidence measures truth-against-image via cross-validation.
    # When cross-validation didn't run (no Tesseract rows), factual is capped
    # at 50% of structural to indicate lack of verification.
    factual_confidence_payload: dict[str, Any] | None = None
    if _OCR_NEW_CONFIDENCE_ENABLED:
        if cross_validation_result is not None:
            factual_confidence_payload = calculate_factual_confidence(
                result=cross_validation_result,
                structural_confidence=avg_confidence,
            )
        else:
            # No cross-validation ran — signal unverified with a synthetic result
            factual_confidence_payload = {
                "score": round(min(avg_confidence * 0.5, 50.0), 1),
                "status": "unvalidated",
                "discrepancies": 0,
                "explanation": "No cross-validation data available. Factual confidence capped at 50% of structural.",
            }

    # Phase 4: Run multi-stage validation pipeline
    validation_result: ValidationResult | None = None
    try:
        pipeline = OcrValidationPipeline()
        validation_result = pipeline.validate(
            headers=normalized_headers,
            rows=normalized_rows,
            doc_type=doc_type_hint,
            data={"headers": normalized_headers, "rows": normalized_rows},
            cross_validation=cross_validation_result.to_dict() if cross_validation_result else None,
        )
        for issue in validation_result.all_issues:
            if issue.severity == "error":
                warnings.append(f"VALIDATION: {issue.message}")
        # Phase 7: Track extraction success rate
        OCR_EXTRACTION_SUCCESS_RATE.set(1.0 if validation_result.passed else 0.0)
    except Exception as val_err:
        logger.warning("Validation pipeline failed: %s", val_err, exc_info=True)
        validation_result = None
        OCR_EXTRACTION_SUCCESS_RATE.set(0.0)

    # NEW (P0-3): Update pipeline metadata with AI result
    pipeline_metadata.ai_attempted = route_meta.get("ai_attempted", False)
    pipeline_metadata.ai_succeeded = route_meta.get("ai_applied", False)
    pipeline_metadata.ai_degraded_to_base = route_meta.get("ai_degraded_to_base", False)
    pipeline_metadata.ai_failure_reason = route_meta.get("ai_failure_reason")

    return {
        "type": normalized.get("type") or _doc_type(doc_type_hint),
        "title": normalized.get("title") or _title_from_hint(doc_type_hint, template),
        "headers": normalized_headers,
        "rows": final_rows,
        "raw_text": raw_text,
        "language": used_language,
        "confidence": avg_confidence,
        "warnings": warnings,
        "routing": route_meta,
        "columns": max(len(normalized_headers), max((len(row) for row in normalized_rows), default=0), 1),
        "avg_confidence": avg_confidence,
        "layout_confidence": layout_confidence,  # NEW: Layout understanding confidence
        "layout_type": layout_analysis_result.get("layout_type", "unknown"),  # NEW: Detected layout type
        "cell_confidence": heuristic_confidence_matrix,
        "cell_boxes": base_result.cell_boxes or [],
        "used_language": used_language,
        "fallback_used": fallback_used,
        "raw_column_added": bool(base_result.raw_column_added),
        "token_usage": route_meta.get("usage") if isinstance(route_meta.get("usage"), dict) else None,
        "sheets": normalized.get("sheets") if isinstance(normalized.get("sheets"), list) else None,
        "understanding": normalized.get("understanding") if isinstance(normalized.get("understanding"), dict) else None,
        "layout_analysis": {  # NEW: Layout analysis metadata
            "processing_time_ms": layout_analysis_result.get("processing_time_ms", 0.0),
            "heuristics_applied": layout_analysis_result.get("heuristics_applied", []),
            "grouping_strategy": structural_grouping.get("grouping_strategy", "unknown"),
        },
        "debug": {
            "requested_model": route_meta.get("requested_model"),
            "selected_model": route_meta.get("selected_model"),
            "final_model_used": route_meta.get("provider_model"),
            "processing_time_ms": (route_meta.get("usage") or {}).get("processing_time_ms")
            if isinstance(route_meta.get("usage"), dict)
            else None,
            "token_usage": route_meta.get("usage") if isinstance(route_meta.get("usage"), dict) else None,
            "model_attempts": [],
            "raw_api_response": ai_debug_response,
        }
        if route_meta.get("provider_used") == "anthropic"
        else None,
        "reused": False,
        "reused_verification_id": None,
        "ai_degraded_to_base": route_meta.get("ai_degraded_to_base", False),
        "cross_validation": cross_validation_result.to_dict() if cross_validation_result else None,
        "factual_confidence": factual_confidence_payload if _OCR_NEW_CONFIDENCE_ENABLED else None,
        "pipeline_metadata": pipeline_metadata.to_dict(),
        "validation": validation_result.to_dict() if validation_result else None,
    }
