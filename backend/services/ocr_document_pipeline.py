"""Structured OCR pipeline adapted to DPR verification flow."""

from __future__ import annotations

import json
import logging
from typing import Any

from sqlalchemy.orm import Session

from backend.models.ocr_template import OcrTemplate
from backend.models.ocr_verification import OcrVerification
from backend.ocr_utils import OcrResult
from backend.services.anthropic_usage import normalize_anthropic_model_name
from backend.services.ocr_confidence import calculate_structural_confidence
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
    parts = [" | ".join(cell for cell in row if cell) for row in rows]
    joined = "\n".join(part for part in parts if part.strip())
    return joined or None


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
    requested_model: str | None = None,
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
        if not _reuse_matches_requested_model(candidate, requested_model):
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
    normalized_headers = normalized.get("headers") or []
    normalized_rows = normalized.get("rows") or []
    confidence_payload = calculate_structural_confidence(
        {
            "headers": normalized_headers,
            "rows": normalized_rows,
        }
    )
    avg_confidence = float(confidence_payload.get("score") or 0.0)
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
        "token_usage": route_meta.get("usage") if isinstance(route_meta.get("usage"), dict) else None,
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
    }
