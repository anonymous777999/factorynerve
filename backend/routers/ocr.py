"""OCR API router for logbook extraction."""

from __future__ import annotations

import json
import logging
import mimetypes
import os
import re
import shutil
import subprocess
import uuid
from datetime import datetime, timedelta, timezone
from pathlib import Path

from fastapi import APIRouter, Depends, File, Form, HTTPException, Response, UploadFile, status, Request
from fastapi.responses import FileResponse
from itsdangerous import BadSignature, SignatureExpired, URLSafeTimedSerializer
from pydantic import BaseModel, Field
from sqlalchemy import false
from sqlalchemy.orm import Session
from anthropic import AuthenticationError, BadRequestError

from backend.database import SessionLocal, get_db, hash_ip_address
from backend.ledger_scan import (
    build_excel_bytes as ledger_build_excel_bytes,
    extract_data_from_image as ledger_extract_data,
    preprocess_image_bytes,
    validate_data as ledger_validate_data,
)
from backend.table_scan import build_table_excel_bytes, extract_table_from_image as table_extract_table_from_image
from backend.models.report import AuditLog
from backend.models.ocr_template import OcrTemplate
from backend.models.ocr_verification import OcrVerification
from backend.models.factory import Factory
from backend.ocr_utils import (
    analyze_image_quality,
    detect_column_centers,
    extract_table_from_image,
    warp_perspective,
)
from backend.security import get_current_user
from backend.rbac import is_manager_or_admin, require_any_role
from backend.models.user import User, UserRole
from backend.utils import PROJECT_ROOT, sanitize_text
from backend.ocr_limits import check_rate_limit, check_and_record_usage, check_and_record_org_usage, get_org_plan_for_usage
from backend.plans import has_plan_feature, min_plan_for_feature, org_has_ocr_access
from backend.services.background_jobs import (
    create_job,
    get_job as get_background_job,
    read_job_file,
    register_retry_handler,
    start_job,
    update_job,
    write_job_file,
)
from backend.services.ocr_document_pipeline import (
    build_structured_ocr_result,
    find_reusable_verification,
    serialize_reused_ocr_result,
)
from backend.tenancy import resolve_factory_id, resolve_org_id


logger = logging.getLogger(__name__)
router = APIRouter(tags=["OCR"])


OCR_VERIFICATION_DIR = PROJECT_ROOT / "exports" / "ocr_verifications"
_ALLOWED_VERIFICATION_STATUSES = {"draft", "pending", "approved", "rejected"}
_FILENAME_SAFE_RE = re.compile(r"[^A-Za-z0-9._-]+")
_OCR_SHARE_MAX_AGE_SECONDS = 7 * 24 * 60 * 60


class OcrVerificationUpdatePayload(BaseModel):
    template_id: int | None = None
    source_filename: str | None = Field(default=None, max_length=255)
    columns: int | None = Field(default=None, ge=1, le=12)
    language: str | None = Field(default=None, max_length=20)
    avg_confidence: float | None = Field(default=None, ge=0, le=100)
    warnings: list[str] | None = None
    scan_quality: dict | None = None
    document_hash: str | None = Field(default=None, max_length=128)
    doc_type_hint: str | None = Field(default=None, max_length=80)
    routing_meta: dict | None = None
    raw_text: str | None = Field(default=None, max_length=50000)
    headers: list[str] | None = None
    original_rows: list[list[str]] | None = None
    reviewed_rows: list[list[str]] | None = None
    raw_column_added: bool | None = None
    reviewer_notes: str | None = Field(default=None, max_length=5000)


class OcrVerificationSubmitPayload(BaseModel):
    reviewer_notes: str | None = Field(default=None, max_length=5000)


class OcrVerificationDecisionPayload(BaseModel):
    reviewer_notes: str | None = Field(default=None, max_length=5000)
    rejection_reason: str | None = Field(default=None, max_length=5000)


def _safe_file_name(filename: str | None, default_stem: str = "ocr-source") -> str:
    raw = sanitize_text(filename, max_length=120, preserve_newlines=False) or default_stem
    safe = _FILENAME_SAFE_RE.sub("_", Path(raw).name).strip("._")
    return safe or default_stem


def _ocr_share_serializer() -> URLSafeTimedSerializer:
    secret = os.getenv("AUTH_RESET_SECRET") or os.getenv("JWT_SECRET_KEY") or "dev-secret"
    return URLSafeTimedSerializer(secret_key=secret, salt="ocr-share")


def _build_ocr_share_token(verification: OcrVerification) -> str:
    return _ocr_share_serializer().dumps(
        {
            "verification_id": verification.id,
            "org_id": verification.org_id,
            "factory_id": verification.factory_id,
        }
    )


def _read_ocr_share_token(token: str) -> dict:
    try:
        return _ocr_share_serializer().loads(token, max_age=_OCR_SHARE_MAX_AGE_SECONDS)
    except SignatureExpired as error:
        raise HTTPException(status_code=410, detail="Share link expired.") from error
    except BadSignature as error:
        raise HTTPException(status_code=404, detail="Share link invalid.") from error


def _parse_json_value(raw: str | None, *, field_name: str):
    if raw in (None, ""):
        return None
    try:
        return json.loads(raw)
    except json.JSONDecodeError as error:
        raise HTTPException(status_code=400, detail=f"Invalid JSON for {field_name}.") from error


def _normalize_string_list(values: list | None, *, field_name: str) -> list[str] | None:
    if values is None:
        return None
    if not isinstance(values, list):
        raise HTTPException(status_code=400, detail=f"{field_name} must be a list.")
    cleaned: list[str] = []
    for value in values:
        text = sanitize_text(str(value) if value is not None else "", max_length=255, preserve_newlines=False) or ""
        cleaned.append(text)
    return cleaned


def _normalize_rows(values: list | None, *, field_name: str) -> list[list[str]] | None:
    if values is None:
        return None
    if not isinstance(values, list):
        raise HTTPException(status_code=400, detail=f"{field_name} must be a list of rows.")
    normalized: list[list[str]] = []
    max_columns = 0
    for row in values:
        if not isinstance(row, list):
            raise HTTPException(status_code=400, detail=f"{field_name} must be a list of rows.")
        cleaned_row = [
            sanitize_text(str(cell) if cell is not None else "", max_length=2000, preserve_newlines=False) or ""
            for cell in row
        ]
        normalized.append(cleaned_row)
        max_columns = max(max_columns, len(cleaned_row))
    for row in normalized:
        if len(row) < max_columns:
            row.extend([""] * (max_columns - len(row)))
    return normalized


def _normalize_scan_quality(values: dict | None, *, field_name: str) -> dict | None:
    if values is None:
        return None
    if not isinstance(values, dict):
        raise HTTPException(status_code=400, detail=f"{field_name} must be an object.")

    band = sanitize_text(str(values.get("confidence_band") or ""), max_length=20, preserve_newlines=False) or "unknown"
    if band not in {"high", "medium", "low", "unknown"}:
        band = "unknown"

    quality_signals = _normalize_string_list(values.get("quality_signals"), field_name=f"{field_name}.quality_signals") or []
    auto_processing = _normalize_string_list(values.get("auto_processing"), field_name=f"{field_name}.auto_processing") or []
    notes = sanitize_text(str(values.get("notes") or ""), max_length=500, preserve_newlines=False) or None
    outcome = sanitize_text(str(values.get("outcome") or ""), max_length=20, preserve_newlines=False) or "success"
    if outcome not in {"success", "partial", "failed"}:
        outcome = "success"
    next_action = sanitize_text(str(values.get("next_action") or ""), max_length=40, preserve_newlines=False) or None
    fallback_used = bool(values.get("fallback_used"))

    def _safe_int(key: str, default: int = 0, minimum: int = 0, maximum: int = 999) -> int:
        raw = values.get(key)
        try:
            parsed = int(raw)
        except (TypeError, ValueError):
            return default
        return max(minimum, min(maximum, parsed))

    raw_boxes = values.get("cell_boxes")
    cell_boxes: list[list[dict | None]] = []
    if isinstance(raw_boxes, list):
        for row in raw_boxes:
            if not isinstance(row, list):
                continue
            normalized_row: list[dict | None] = []
            for box in row:
                if not isinstance(box, dict):
                    normalized_row.append(None)
                    continue
                try:
                    x = float(box.get("x", 0.0))
                    y = float(box.get("y", 0.0))
                    width = float(box.get("width", 0.0))
                    height = float(box.get("height", 0.0))
                except (TypeError, ValueError):
                    normalized_row.append(None)
                    continue
                normalized_row.append(
                    {
                        "x": max(0.0, min(1.0, x)),
                        "y": max(0.0, min(1.0, y)),
                        "width": max(0.0, min(1.0, width)),
                        "height": max(0.0, min(1.0, height)),
                    }
                )
            cell_boxes.append(normalized_row)

    return {
        "confidence_band": band,
        "quality_signals": quality_signals,
        "auto_processing": auto_processing,
        "fallback_used": fallback_used,
        "correction_count": _safe_int("correction_count"),
        "page_count": _safe_int("page_count", default=1, minimum=1, maximum=100),
        "adjustment_count": _safe_int("adjustment_count"),
        "retake_count": _safe_int("retake_count"),
        "manual_review_recommended": bool(values.get("manual_review_recommended")),
        "outcome": outcome,
        "next_action": next_action,
        "notes": notes,
        "cell_boxes": cell_boxes or None,
    }


def _normalize_document_hash(value: str | None) -> str | None:
    normalized = sanitize_text(value, max_length=128, preserve_newlines=False)
    return normalized.lower() if normalized else None


def _normalize_doc_type_hint(value: str | None) -> str | None:
    normalized = sanitize_text(value, max_length=80, preserve_newlines=False)
    return normalized.lower() if normalized else None


def _normalize_routing_meta(values: dict | None, *, field_name: str) -> dict | None:
    if values is None:
        return None
    if not isinstance(values, dict):
        raise HTTPException(status_code=400, detail=f"{field_name} must be an object.")

    model_tier = sanitize_text(str(values.get("model_tier") or ""), max_length=20, preserve_newlines=False) or "fast"
    if model_tier not in {"fast", "balanced", "best"}:
        model_tier = "fast"
    score_reason = sanitize_text(str(values.get("score_reason") or ""), max_length=500, preserve_newlines=False) or None

    def _safe_float(key: str, default: float = 0.0, minimum: float = 0.0, maximum: float = 100.0) -> float:
        raw = values.get(key)
        try:
            parsed = float(raw)
        except (TypeError, ValueError):
            return default
        return max(minimum, min(maximum, parsed))

    return {
        "clarity_score": _safe_float("clarity_score"),
        "score_reason": score_reason,
        "model_tier": model_tier,
        "forced": bool(values.get("forced")),
        "scorer_used": bool(values.get("scorer_used")),
        "actual_cost_usd": _safe_float("actual_cost_usd", maximum=1000.0),
        "cost_saved_usd": _safe_float("cost_saved_usd", maximum=1000.0),
    }


def _save_verification_source(filename: str | None, image_bytes: bytes) -> tuple[str, str]:
    OCR_VERIFICATION_DIR.mkdir(parents=True, exist_ok=True)
    safe_name = _safe_file_name(filename)
    suffix = Path(safe_name).suffix or ".png"
    stored_name = f"{datetime.now(timezone.utc).strftime('%Y%m%d_%H%M%S_%f')}_{uuid.uuid4().hex[:8]}{suffix}"
    destination = OCR_VERIFICATION_DIR / stored_name
    destination.write_bytes(image_bytes)
    return safe_name, str(destination)


def _verification_query(db: Session, current_user: User):
    query = db.query(OcrVerification)
    org_id = resolve_org_id(current_user)
    factory_id = _active_factory_id(db, current_user)

    if current_user.role in {UserRole.ADMIN, UserRole.OWNER}:
        if org_id:
            return query.filter(OcrVerification.org_id == org_id)
        return query.filter(OcrVerification.user_id == current_user.id)

    if current_user.role == UserRole.MANAGER:
        if factory_id:
            return query.filter(OcrVerification.factory_id == factory_id)
        if org_id:
            return query.filter(OcrVerification.org_id == org_id)
        return query.filter(OcrVerification.user_id == current_user.id)

    return query.filter(OcrVerification.user_id == current_user.id)


def _serialize_verification(db: Session, verification: OcrVerification) -> dict:
    template_name = None
    if verification.template_id:
        template = db.query(OcrTemplate).filter(OcrTemplate.id == verification.template_id).first()
        if template:
            template_name = template.name
    actor_ids = {
        actor_id
        for actor_id in {verification.user_id, verification.approved_by, verification.rejected_by}
        if actor_id
    }
    actor_map = {}
    if actor_ids:
        actor_map = {
            actor.id: actor.name
            for actor in db.query(User).filter(User.id.in_(actor_ids)).all()
        }
    trusted_export = verification.status == "approved"
    export_source = "approved_review" if trusted_export else f"{verification.status}_review"
    return {
        "id": verification.id,
        "org_id": verification.org_id,
        "factory_id": verification.factory_id,
        "user_id": verification.user_id,
        "created_by_name": actor_map.get(verification.user_id),
        "template_id": verification.template_id,
        "template_name": template_name,
        "source_filename": verification.source_filename,
        "has_source_image": bool(verification.source_image_path),
        "source_image_url": f"/ocr/verifications/{verification.id}/source-image" if verification.source_image_path else None,
        "columns": verification.columns,
        "language": verification.language,
        "avg_confidence": float(verification.avg_confidence or 0),
        "warnings": verification.warnings or [],
        "scan_quality": verification.scan_quality or None,
        "document_hash": verification.document_hash,
        "doc_type_hint": verification.doc_type_hint,
        "routing_meta": verification.routing_meta or None,
        "raw_text": verification.raw_text,
        "headers": verification.headers or [],
        "original_rows": verification.original_rows or [],
        "reviewed_rows": verification.reviewed_rows or [],
        "raw_column_added": bool(verification.raw_column_added),
        "status": verification.status,
        "reviewer_notes": verification.reviewer_notes,
        "rejection_reason": verification.rejection_reason,
        "submitted_at": verification.submitted_at.isoformat() if verification.submitted_at else None,
        "approved_at": verification.approved_at.isoformat() if verification.approved_at else None,
        "rejected_at": verification.rejected_at.isoformat() if verification.rejected_at else None,
        "approved_by": verification.approved_by,
        "approved_by_name": actor_map.get(verification.approved_by) if verification.approved_by else None,
        "rejected_by": verification.rejected_by,
        "rejected_by_name": actor_map.get(verification.rejected_by) if verification.rejected_by else None,
        "trusted_export": trusted_export,
        "export_source": export_source,
        "export_url": f"/ocr/verifications/{verification.id}/export",
        "created_at": verification.created_at.isoformat() if verification.created_at else None,
        "updated_at": verification.updated_at.isoformat() if verification.updated_at else None,
    }


def _get_verification_or_404(db: Session, verification_id: int, current_user: User) -> OcrVerification:
    verification = _verification_query(db, current_user).filter(OcrVerification.id == verification_id).first()
    if not verification:
        raise HTTPException(status_code=404, detail="Verification record not found.")
    return verification


def _verification_export_rows(verification: OcrVerification) -> list[list[str]]:
    rows = verification.reviewed_rows or verification.original_rows or []
    return _normalize_rows(rows, field_name="verification_export_rows") or []


def _verification_export_headers(verification: OcrVerification, rows: list[list[str]]) -> list[str]:
    column_count = max((len(row) for row in rows), default=0, )
    column_count = max(column_count, verification.columns or 0, 1)
    normalized_headers = _normalize_string_list(verification.headers or [], field_name="verification_headers") or []
    if len(normalized_headers) < column_count:
        normalized_headers.extend([f"Column {index}" for index in range(len(normalized_headers) + 1, column_count + 1)])
    return normalized_headers[:column_count]


def _verification_export_source(verification: OcrVerification) -> str:
    return "approved_review" if verification.status == "approved" else f"{verification.status}_review"


def _verification_export_filename(verification: OcrVerification) -> str:
    base = _safe_file_name(verification.source_filename, default_stem=f"ocr-verification-{verification.id}")
    stem = Path(base).stem or f"ocr-verification-{verification.id}"
    return f"{stem}-{verification.status}.xlsx"


def _verification_export_response(verification: OcrVerification) -> Response:
    rows = _verification_export_rows(verification)
    if not rows:
        raise HTTPException(status_code=409, detail="Verification record has no rows to export.")
    headers = _verification_export_headers(verification, rows)
    excel_bytes = build_table_excel_bytes({"headers": headers, "rows": rows})
    trusted_export = verification.status == "approved"
    export_source = _verification_export_source(verification)
    filename = _verification_export_filename(verification)
    return Response(
        content=excel_bytes,
        media_type="application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
        headers={
            "Content-Disposition": f'attachment; filename="{filename}"',
            "Cache-Control": "no-store",
            "Pragma": "no-cache",
            "X-Ocr-Verification-Id": str(verification.id),
            "X-Ocr-Export-Source": export_source,
            "X-Ocr-Trusted-Export": str(trusted_export).lower(),
            "X-Total-Rows": str(len(rows)),
            "X-Total-Columns": str(len(headers)),
        },
    )


def _verification_row_count(verification: OcrVerification) -> int:
    return len(_verification_export_rows(verification))


def _apply_verification_payload(
    verification: OcrVerification,
    *,
    template_id: int | None = None,
    source_filename: str | None = None,
    columns: int | None = None,
    language: str | None = None,
    avg_confidence: float | None = None,
    warnings: list[str] | None = None,
    scan_quality: dict | None = None,
    document_hash: str | None = None,
    doc_type_hint: str | None = None,
    routing_meta: dict | None = None,
    raw_text: str | None = None,
    headers: list[str] | None = None,
    original_rows: list[list[str]] | None = None,
    reviewed_rows: list[list[str]] | None = None,
    raw_column_added: bool | None = None,
    reviewer_notes: str | None = None,
) -> None:
    if template_id is not None:
        verification.template_id = template_id
    if source_filename is not None:
        verification.source_filename = _safe_file_name(source_filename)
    if columns is not None:
        verification.columns = max(1, min(columns, 12))
    if language is not None:
        verification.language = sanitize_text(language, max_length=20, preserve_newlines=False) or verification.language
    if avg_confidence is not None:
        verification.avg_confidence = max(0.0, min(float(avg_confidence), 100.0))
    if warnings is not None:
        verification.warnings = warnings
    if scan_quality is not None:
        verification.scan_quality = scan_quality
    if document_hash is not None:
        verification.document_hash = _normalize_document_hash(document_hash)
    if doc_type_hint is not None:
        verification.doc_type_hint = _normalize_doc_type_hint(doc_type_hint)
    if routing_meta is not None:
        verification.routing_meta = routing_meta
    if raw_text is not None:
        verification.raw_text = sanitize_text(raw_text, max_length=50000)
    if headers is not None:
        verification.headers = headers
    if original_rows is not None:
        verification.original_rows = original_rows
    if reviewed_rows is not None:
        verification.reviewed_rows = reviewed_rows
    if raw_column_added is not None:
        verification.raw_column_added = bool(raw_column_added)
    if reviewer_notes is not None:
        verification.reviewer_notes = sanitize_text(reviewer_notes, max_length=5000)
    verification.updated_at = datetime.now(timezone.utc)


def _require_ocr_access(current_user: User) -> None:
    require_any_role(
        current_user,
        {UserRole.OPERATOR, UserRole.SUPERVISOR, UserRole.MANAGER, UserRole.ADMIN, UserRole.OWNER},
    )


def _require_templates_access(db: Session, current_user: User) -> None:
    org_id = resolve_org_id(current_user)
    plan = get_org_plan_for_usage(db, org_id=org_id, user_id=current_user.id)
    if has_plan_feature(plan, "templates"):
        return
    if org_has_ocr_access(db, org_id=org_id, fallback_user_id=current_user.id):
        return
    min_plan = min_plan_for_feature("templates")
    raise HTTPException(
        status_code=402,
        detail=f"Custom templates require {min_plan.title()} plan or an OCR pack.",
    )


def _parse_json_list(raw: str | None) -> list | None:
    if not raw:
        return None
    try:
        parsed = json.loads(raw)
        if isinstance(parsed, list):
            return parsed
    except json.JSONDecodeError:
        return None
    return None


def _template_query(db: Session, current_user: User):
    query = db.query(OcrTemplate)
    org_id = resolve_org_id(current_user)
    if current_user.role in {UserRole.ADMIN, UserRole.OWNER}:
        if org_id:
            factory_ids = db.query(Factory.factory_id).filter(Factory.org_id == org_id)
            return query.filter(OcrTemplate.factory_id.in_(factory_ids))
        return query.filter(OcrTemplate.factory_id.isnot(None))
    factory_id = _active_factory_id(db, current_user)
    if not factory_id:
        return query.filter(false())
    return query.filter(OcrTemplate.factory_id == factory_id)


def _active_factory_id(db: Session, current_user: User) -> str | None:
    factory_id = resolve_factory_id(db, current_user)
    return factory_id


def _active_factory_name(db: Session, current_user: User) -> str:
    factory_id = resolve_factory_id(db, current_user)
    if factory_id:
        row = db.query(Factory.name).filter(Factory.factory_id == factory_id).first()
        if row:
            return row[0]
    return current_user.factory_name


def _is_low_confidence(result) -> bool:
    try:
        return float(result.avg_confidence) < 55
    except Exception:
        return True


def _result_score(result) -> tuple[float, int, int]:
    rows = result.rows or []
    row_count = len(rows)
    cell_count = sum(1 for row in rows for cell in row if str(cell).strip())
    return (float(result.avg_confidence or 0.0), row_count, cell_count)


def _should_retry_with_fallback_language(result) -> bool:
    rows = result.rows or []
    row_count = len(rows)
    populated_cells = sum(1 for row in rows for cell in row if str(cell).strip())
    confidence = float(getattr(result, "avg_confidence", 0.0) or 0.0)

    if row_count == 0 or populated_cells == 0:
        return True
    if row_count <= 1 and populated_cells <= 2:
        return True
    if confidence < 20 and populated_cells <= 4:
        return True
    return False


def _job_urls(job_id: str) -> dict[str, str]:
    return {
        "status_url": f"/ocr/jobs/{job_id}",
        "download_url": f"/ocr/jobs/{job_id}/download",
    }


def _job_kind(mode: str) -> str:
    if mode not in {"ledger", "table"}:
        raise RuntimeError(f"Unsupported OCR job mode: {mode}")
    return f"ocr_{mode}_excel"


def _log_ocr_job_success(
    *,
    action: str,
    user_id: int,
    org_id: str | None,
    factory_id: str | None,
    details: str,
) -> None:
    with SessionLocal() as db:
        db.add(
            AuditLog(
                user_id=user_id,
                org_id=org_id,
                factory_id=factory_id,
                action=action,
                details=details,
                ip_address=None,
                timestamp=datetime.now(timezone.utc),
            )
        )
        db.commit()


def _run_ocr_excel_job(progress, *, job_id: str) -> dict[str, object]:
    job = get_background_job(job_id)
    if not job:
        raise RuntimeError("OCR job not found.")
    context = job.get("context") or {}
    mode = str(context.get("mode") or "")
    input_file = context.get("input_file")
    if not isinstance(input_file, dict):
        raise RuntimeError("OCR input file is missing.")
    stored_path = input_file.get("stored_path")
    if not stored_path:
        raise RuntimeError("OCR input file path is missing.")
    image_bytes = Path(str(stored_path)).read_bytes()

    progress(15, "Loading OCR image")
    metadata: dict[str, object]
    output_name: str
    if mode == "ledger":
        progress(35, "Preprocessing ledger image")
        base64_image = preprocess_image_bytes(image_bytes, profile=context.get("preprocess_profile"))
        progress(60, "Extracting ledger rows")
        rows = ledger_extract_data(
            base64_image,
            force_mock=bool(context.get("mock")),
            system_prompt=context.get("system_prompt"),
            user_message=context.get("user_message"),
        )
        validated = ledger_validate_data(rows)
        progress(82, "Building ledger Excel workbook")
        excel_bytes = ledger_build_excel_bytes(validated)
        metadata = dict(validated.get("metadata", {}))
        output_name = "logbook_ledger_scan.xlsx"
        action = "OCR_LEDGER_EXCEL_ASYNC"
    elif mode == "table":
        progress(35, "Extracting table grid")
        table = table_extract_table_from_image(
            image_bytes,
            system_prompt=context.get("system_prompt"),
            user_message=context.get("user_message"),
            preprocess_profile=context.get("preprocess_profile"),
        )
        progress(82, "Building table Excel workbook")
        excel_bytes = build_table_excel_bytes(table)
        metadata = {
            "total_rows": len(table.get("rows", [])),
            "total_columns": len(table.get("headers", [])),
        }
        output_name = "table_scan.xlsx"
        action = "OCR_TABLE_EXCEL_ASYNC"
    else:
        raise RuntimeError("Unsupported OCR job mode.")

    file_meta = write_job_file(
        job_id,
        filename=output_name,
        content=excel_bytes,
        media_type="application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
    )
    _log_ocr_job_success(
        action=action,
        user_id=int(job["owner_id"]),
        org_id=job.get("org_id"),
        factory_id=str(context.get("factory_id")) if context.get("factory_id") is not None else None,
        details=f"{action} completed size_bytes={context.get('size_bytes', 0)}",
    )
    return {
        "file": file_meta,
        "metadata": metadata,
        "source_filename": context.get("source_filename"),
        "mode": mode,
    }


def _queue_ocr_excel_job(
    *,
    mode: str,
    owner_id: int,
    org_id: str | None,
    factory_id: str | None,
    source_filename: str,
    content_type: str | None,
    size_bytes: int,
    mock: bool = False,
    system_prompt: str | None = None,
    user_message: str | None = None,
    preprocess_profile: str | None = None,
    image_bytes: bytes | None = None,
    input_file: dict[str, object] | None = None,
) -> dict[str, object]:
    job = create_job(
        kind=_job_kind(mode),
        owner_id=owner_id,
        org_id=org_id,
        message=f"Queued {mode} OCR export",
        context={
            "route": "/ocr",
            "mode": mode,
            "factory_id": factory_id,
            "source_filename": source_filename,
            "mock": bool(mock),
            "system_prompt": system_prompt,
            "user_message": user_message,
            "preprocess_profile": preprocess_profile,
            "size_bytes": size_bytes,
        },
        retry_context={
            "mode": mode,
            "owner_id": owner_id,
            "org_id": org_id,
            "factory_id": factory_id,
            "source_filename": source_filename,
            "size_bytes": size_bytes,
            "mock": bool(mock),
            "system_prompt": system_prompt,
            "user_message": user_message,
            "preprocess_profile": preprocess_profile,
        },
    )
    job_input = input_file
    if job_input is None:
        if image_bytes is None:
            raise RuntimeError("OCR job image bytes are required.")
        job_input = write_job_file(
            job["job_id"],
            filename=source_filename or f"{mode}-ocr-input.bin",
            content=image_bytes,
            media_type=content_type or "application/octet-stream",
        )
    context = dict(job.get("context") or {})
    context["input_file"] = job_input
    retry_context = {
        "mode": mode,
        "owner_id": owner_id,
        "org_id": org_id,
        "factory_id": factory_id,
        "source_filename": source_filename,
        "size_bytes": size_bytes,
        "mock": bool(mock),
        "system_prompt": system_prompt,
        "user_message": user_message,
        "preprocess_profile": preprocess_profile,
        "input_file": job_input,
    }
    update_job(job["job_id"], context=context, retry_context=retry_context)
    start_job(job["job_id"], lambda progress: _run_ocr_excel_job(progress, job_id=job["job_id"]))
    return job


def _retry_ocr_job(payload: dict[str, object], _source_job: object) -> dict[str, object]:
    mode = str(payload.get("mode") or "")
    input_file = payload.get("input_file")
    if not isinstance(input_file, dict):
        raise RuntimeError("The original OCR job is missing its uploaded image.")
    return _queue_ocr_excel_job(
        mode=mode,
        owner_id=int(payload["owner_id"]),
        org_id=str(payload["org_id"]) if payload.get("org_id") is not None else None,
        factory_id=str(payload.get("factory_id")) if payload.get("factory_id") is not None else None,
        source_filename=str(payload.get("source_filename") or f"{mode}-ocr-input.bin"),
        content_type=str(input_file.get("media_type") or "application/octet-stream"),
        size_bytes=int(payload.get("size_bytes") or 0),
        mock=bool(payload.get("mock")),
        system_prompt=str(payload.get("system_prompt")) if payload.get("system_prompt") is not None else None,
        user_message=str(payload.get("user_message")) if payload.get("user_message") is not None else None,
        preprocess_profile=str(payload.get("preprocess_profile")) if payload.get("preprocess_profile") is not None else None,
        input_file=input_file,
    )


register_retry_handler("ocr_ledger_excel", _retry_ocr_job)
register_retry_handler("ocr_table_excel", _retry_ocr_job)


def _log_ocr_event(
    db: Session,
    *,
    action: str,
    details: str,
    request: Request | None,
    user_id: int | None,
    org_id: str | None,
    factory_id: str | None,
) -> None:
    client_host = request.client.host if request and request.client else None
    user_agent = request.headers.get("user-agent") if request else None
    db.add(
        AuditLog(
            user_id=user_id,
            org_id=org_id,
            factory_id=factory_id,
            action=action,
            details=details,
            ip_address=hash_ip_address(client_host),
            user_agent=user_agent,
            timestamp=datetime.now(timezone.utc),
        )
    )


def _run_ocr_with_fallback(
    image_bytes: bytes,
    *,
    language: str,
    columns: int,
    column_centers: list[float] | None,
    column_keywords: list[list[str]] | None,
    enable_raw_column: bool,
) -> tuple:
    fallback_used = False
    used_language = language
    primary_language = language
    fallback_language = None

    if language == "auto":
        primary_language = "eng"
        fallback_language = "eng+hin+mar"
        used_language = primary_language

    try:
        result = extract_table_from_image(
            image_bytes,
            columns=columns,
            language=primary_language,
            column_centers=column_centers,
            column_keywords=column_keywords,
            enable_raw_column=enable_raw_column,
        )
    except Exception as error:  # pylint: disable=broad-except
        logger.error(
            "OCR extraction failed on primary pass: %s: %s",
            type(error).__name__,
            error,
            exc_info=True,
        )
        raise

    needs_fallback = _should_retry_with_fallback_language(result)
    if fallback_language and needs_fallback:
        fallback_used = True
        try:
            fallback_result = extract_table_from_image(
                image_bytes,
                columns=columns,
                language=fallback_language,
                column_centers=column_centers,
                column_keywords=column_keywords,
                enable_raw_column=enable_raw_column,
            )
            if _result_score(fallback_result) >= _result_score(result):
                result = fallback_result
                used_language = fallback_language
            else:
                used_language = primary_language
        except Exception as error:  # pylint: disable=broad-except
            logger.error(
                "OCR extraction fallback failed: %s: %s",
                type(error).__name__,
                error,
                exc_info=True,
            )
            used_language = primary_language
            if hasattr(result, "warnings"):
                result.warnings.append("Fallback OCR language failed; using primary result.")

    return result, used_language, fallback_used


@router.get("/status", status_code=status.HTTP_200_OK)
def ocr_status() -> dict:
    tesseract_path = shutil.which("tesseract")
    if not tesseract_path:
        for path in (
            Path(r"C:\Program Files\Tesseract-OCR\tesseract.exe"),
            Path(r"C:\Program Files (x86)\Tesseract-OCR\tesseract.exe"),
        ):
            if path.exists():
                tesseract_path = str(path)
                break
    if not tesseract_path:
        return {"installed": False, "message": "Tesseract not found on PATH."}
    env = os.environ.copy()
    local_app = os.getenv("LOCALAPPDATA")
    if local_app:
        candidate = Path(local_app) / "DPR.ai" / "tessdata"
        if candidate.exists():
            env["TESSDATA_PREFIX"] = str(candidate)
    try:
        version = subprocess.check_output([tesseract_path, "--version"], text=True, env=env).splitlines()[0]
        langs_raw = subprocess.check_output([tesseract_path, "--list-langs"], text=True, env=env)
        langs = [line.strip() for line in langs_raw.splitlines() if line and ":" not in line]
    except Exception:  # pylint: disable=broad-except
        version = "unknown"
        langs = []
    return {
        "installed": True,
        "path": tesseract_path,
        "version": version,
        "tessdata_prefix": env.get("TESSDATA_PREFIX"),
        "languages": langs,
    }


@router.get("/templates", status_code=status.HTTP_200_OK)
def list_templates(
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
) -> list[dict]:
    _require_ocr_access(current_user)
    _require_templates_access(db, current_user)
    templates = (
        _template_query(db, current_user)
        .filter(OcrTemplate.is_active.is_(True))
        .order_by(OcrTemplate.created_at.desc())
        .all()
    )
    return [
        {
            "id": template.id,
            "name": template.name,
            "columns": template.columns,
            "header_mode": template.header_mode,
            "language": template.language,
            "column_names": template.column_names or [],
            "column_keywords": template.column_keywords or [],
            "raw_column_label": template.raw_column_label or "Raw",
            "enable_raw_column": template.enable_raw_column,
            "created_at": template.created_at.isoformat(),
        }
        for template in templates
    ]


@router.post("/templates", status_code=status.HTTP_201_CREATED)
async def create_template(
    name: str = Form(...),
    columns: int = Form(default=3),
    header_mode: str = Form(default="first"),
    language: str = Form(default="eng"),
    column_names: str | None = Form(default=None),
    column_keywords: str | None = Form(default=None),
    raw_column_label: str | None = Form(default="Raw"),
    enable_raw_column: bool = Form(default=True),
    samples: list[UploadFile] = File(...),
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
) -> dict:
    _require_ocr_access(current_user)
    _require_templates_access(db, current_user)
    if not samples:
        raise HTTPException(status_code=400, detail="Sample images are required.")
    if columns < 1 or columns > 8:
        raise HTTPException(status_code=400, detail="Columns must be between 1 and 8.")

    sample_bytes: list[bytes] = []
    for file in samples:
        if not (file.content_type or "").startswith("image/"):
            raise HTTPException(status_code=400, detail="Only image files are supported.")
        image_bytes = await file.read()
        if len(image_bytes) > 8_000_000:
            raise HTTPException(status_code=413, detail="Image too large. Max 8MB.")
        sample_bytes.append(image_bytes)

    parsed_names = _parse_json_list(column_names)
    parsed_keywords = _parse_json_list(column_keywords)

    try:
        centers, avg_conf, warnings = detect_column_centers(sample_bytes, columns=columns, language=language)
    except RuntimeError as error:
        logger.exception("Template analysis failed.")
        raise HTTPException(status_code=400, detail=str(error)) from error
    except Exception as error:  # pylint: disable=broad-except
        logger.exception("Template analysis failed.")
        raise HTTPException(status_code=500, detail="Template analysis failed. Please verify OCR setup.") from error
    factory_id = _active_factory_id(db, current_user)
    if not factory_id:
        raise HTTPException(status_code=400, detail="Factory must be selected before creating templates.")
    template = OcrTemplate(
        factory_id=factory_id,
        factory_name=_active_factory_name(db, current_user),
        name=name.strip(),
        columns=columns,
        header_mode=header_mode,
        language=language,
        column_names=parsed_names,
        column_keywords=parsed_keywords,
        column_centers=centers,
        raw_column_label=raw_column_label or "Raw",
        enable_raw_column=enable_raw_column,
        created_by=current_user.id,
        is_active=True,
        created_at=datetime.now(timezone.utc),
        updated_at=datetime.now(timezone.utc),
    )
    db.add(template)
    db.commit()
    db.refresh(template)
    return {
        "id": template.id,
        "avg_confidence": avg_conf,
        "warnings": warnings,
        "template": {
            "id": template.id,
            "name": template.name,
            "columns": template.columns,
            "header_mode": template.header_mode,
            "language": template.language,
            "column_names": template.column_names or [],
            "column_keywords": template.column_keywords or [],
            "raw_column_label": template.raw_column_label or "Raw",
            "enable_raw_column": template.enable_raw_column,
        },
    }


@router.delete("/templates/{template_id}", status_code=status.HTTP_200_OK)
def deactivate_template(
    template_id: int,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
) -> dict:
    _require_ocr_access(current_user)
    _require_templates_access(db, current_user)
    template = (
        _template_query(db, current_user)
        .filter(OcrTemplate.id == template_id, OcrTemplate.is_active.is_(True))
        .first()
    )
    if not template:
        raise HTTPException(status_code=404, detail="Template not found.")
    template.is_active = False
    template.updated_at = datetime.now(timezone.utc)
    db.commit()
    return {"message": "Template archived."}


@router.get("/verifications", status_code=status.HTTP_200_OK)
def list_verifications(
    verification_status: str | None = None,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
) -> list[dict]:
    _require_ocr_access(current_user)
    query = _verification_query(db, current_user)
    if verification_status:
        normalized = (sanitize_text(verification_status, max_length=20, preserve_newlines=False) or "").lower()
        if normalized not in _ALLOWED_VERIFICATION_STATUSES:
            raise HTTPException(status_code=400, detail="Invalid verification status filter.")
        query = query.filter(OcrVerification.status == normalized)
    records = query.order_by(OcrVerification.updated_at.desc(), OcrVerification.id.desc()).limit(100).all()
    return [_serialize_verification(db, record) for record in records]


@router.get("/verifications/summary", status_code=status.HTTP_200_OK)
def get_verification_summary(
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
) -> dict:
    _require_ocr_access(current_user)
    records = _verification_query(db, current_user).all()

    trusted_documents = 0
    trusted_rows = 0
    pending_documents = 0
    pending_rows = 0
    rejected_documents = 0
    rejected_rows = 0
    draft_documents = 0
    draft_rows = 0
    trusted_confidence_total = 0.0
    trusted_confidence_count = 0
    last_trusted_at: datetime | None = None

    for record in records:
        row_count = _verification_row_count(record)
        if record.status == "approved":
            trusted_documents += 1
            trusted_rows += row_count
            if record.avg_confidence is not None:
                trusted_confidence_total += float(record.avg_confidence)
                trusted_confidence_count += 1
            if record.approved_at and (last_trusted_at is None or record.approved_at > last_trusted_at):
                last_trusted_at = record.approved_at
        elif record.status == "pending":
            pending_documents += 1
            pending_rows += row_count
        elif record.status == "rejected":
            rejected_documents += 1
            rejected_rows += row_count
        else:
            draft_documents += 1
            draft_rows += row_count

    decision_denominator = trusted_documents + rejected_documents
    approval_rate = (
        round((trusted_documents / decision_denominator) * 100, 1)
        if decision_denominator
        else None
    )

    return {
        "total_documents": len(records),
        "trusted_documents": trusted_documents,
        "trusted_rows": trusted_rows,
        "pending_documents": pending_documents,
        "pending_rows": pending_rows,
        "rejected_documents": rejected_documents,
        "rejected_rows": rejected_rows,
        "draft_documents": draft_documents,
        "draft_rows": draft_rows,
        "untrusted_documents": draft_documents + pending_documents + rejected_documents,
        "untrusted_rows": draft_rows + pending_rows + rejected_rows,
        "export_ready_documents": trusted_documents,
        "avg_trusted_confidence": round(trusted_confidence_total / trusted_confidence_count, 1)
        if trusted_confidence_count
        else None,
        "approval_rate": approval_rate,
        "last_trusted_at": last_trusted_at.isoformat() if last_trusted_at else None,
        "trust_note": "Only approved OCR documents count as trusted downstream data.",
    }


@router.post("/verifications", status_code=status.HTTP_201_CREATED)
async def create_verification(
    file: UploadFile | None = File(default=None),
    template_id: int | None = Form(default=None),
    source_filename: str | None = Form(default=None),
    columns: int = Form(default=3),
    language: str = Form(default="eng"),
    avg_confidence: float | None = Form(default=None),
    warnings: str | None = Form(default=None),
    scan_quality: str | None = Form(default=None),
    document_hash: str | None = Form(default=None),
    doc_type_hint: str | None = Form(default=None),
    routing_meta: str | None = Form(default=None),
    raw_text: str | None = Form(default=None),
    headers: str | None = Form(default=None),
    original_rows: str | None = Form(default=None),
    reviewed_rows: str | None = Form(default=None),
    raw_column_added: bool = Form(default=False),
    reviewer_notes: str | None = Form(default=None),
    request: Request = None,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
) -> dict:
    _require_ocr_access(current_user)

    template = None
    if template_id is not None:
        template = (
            _template_query(db, current_user)
            .filter(OcrTemplate.id == template_id, OcrTemplate.is_active.is_(True))
            .first()
        )
        if not template:
            raise HTTPException(status_code=404, detail="Template not found.")

    parsed_warnings = _normalize_string_list(_parse_json_value(warnings, field_name="warnings"), field_name="warnings") or []
    parsed_scan_quality = _normalize_scan_quality(
        _parse_json_value(scan_quality, field_name="scan_quality"),
        field_name="scan_quality",
    )
    parsed_routing_meta = _normalize_routing_meta(
        _parse_json_value(routing_meta, field_name="routing_meta"),
        field_name="routing_meta",
    )
    parsed_headers = _normalize_string_list(_parse_json_value(headers, field_name="headers"), field_name="headers") or []
    parsed_original_rows = _normalize_rows(_parse_json_value(original_rows, field_name="original_rows"), field_name="original_rows") or []
    parsed_reviewed_rows = _normalize_rows(_parse_json_value(reviewed_rows, field_name="reviewed_rows"), field_name="reviewed_rows") or parsed_original_rows

    if file is not None and file.filename:
        if not (file.content_type or "").startswith("image/"):
            raise HTTPException(status_code=400, detail="Only image files are supported.")
        image_bytes = await file.read()
        if len(image_bytes) > 8_000_000:
            raise HTTPException(status_code=413, detail="Image too large. Max 8MB.")
        source_name, image_path = _save_verification_source(file.filename or source_filename, image_bytes)
    else:
        source_name = _safe_file_name(source_filename) if source_filename else None
        image_path = None

    if not parsed_reviewed_rows and not parsed_original_rows:
        raise HTTPException(status_code=400, detail="Provide OCR rows before saving a verification draft.")

    verification = OcrVerification(
        org_id=resolve_org_id(current_user),
        factory_id=_active_factory_id(db, current_user),
        user_id=current_user.id,
        template_id=template.id if template else template_id,
        source_filename=source_name,
        source_image_path=image_path,
        columns=max(1, min(columns, 12)),
        language=sanitize_text(language, max_length=20, preserve_newlines=False) or (template.language if template else "eng"),
        avg_confidence=max(0.0, min(float(avg_confidence), 100.0)) if avg_confidence is not None else None,
        warnings=parsed_warnings,
        scan_quality=parsed_scan_quality,
        document_hash=_normalize_document_hash(document_hash),
        doc_type_hint=_normalize_doc_type_hint(doc_type_hint),
        routing_meta=parsed_routing_meta,
        raw_text=sanitize_text(raw_text, max_length=50000),
        headers=parsed_headers,
        original_rows=parsed_original_rows,
        reviewed_rows=parsed_reviewed_rows,
        raw_column_added=bool(raw_column_added),
        status="draft",
        reviewer_notes=sanitize_text(reviewer_notes, max_length=5000),
    )
    db.add(verification)
    db.commit()
    db.refresh(verification)
    if request is not None:
        _log_ocr_event(
            db,
            action="OCR_VERIFICATION_CREATED",
            details=(
                f"Verification created id={verification.id} status=draft "
                f"confidence={verification.avg_confidence or 0:.1f} "
                f"tier={(verification.routing_meta or {}).get('model_tier', 'fast')} "
                f"band={(verification.scan_quality or {}).get('confidence_band', 'unknown')} "
                f"outcome={(verification.scan_quality or {}).get('outcome', 'success')}"
            ),
            request=request,
            user_id=current_user.id,
            org_id=verification.org_id,
            factory_id=verification.factory_id,
        )
        db.commit()
    return _serialize_verification(db, verification)


@router.get("/verifications/{verification_id}", status_code=status.HTTP_200_OK)
def get_verification(
    verification_id: int,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
) -> dict:
    _require_ocr_access(current_user)
    verification = _get_verification_or_404(db, verification_id, current_user)
    return _serialize_verification(db, verification)


@router.get("/verifications/{verification_id}/source-image")
def get_verification_source_image(
    verification_id: int,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
) -> FileResponse:
    _require_ocr_access(current_user)
    verification = _get_verification_or_404(db, verification_id, current_user)
    if not verification.source_image_path:
        raise HTTPException(status_code=404, detail="Verification source image not found.")

    image_path = Path(verification.source_image_path)
    try:
        resolved_path = image_path.resolve(strict=True)
    except FileNotFoundError as error:
        raise HTTPException(status_code=404, detail="Verification source image not found.") from error

    verification_root = OCR_VERIFICATION_DIR.resolve()
    if resolved_path != verification_root and verification_root not in resolved_path.parents:
        raise HTTPException(status_code=404, detail="Verification source image not found.")

    media_type = mimetypes.guess_type(resolved_path.name)[0] or "application/octet-stream"
    return FileResponse(
        resolved_path,
        media_type=media_type,
        filename=resolved_path.name,
        headers={"Cache-Control": "private, max-age=3600"},
    )


@router.get("/verifications/{verification_id}/export", status_code=status.HTTP_200_OK)
def export_verification_excel(
    verification_id: int,
    request: Request,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
) -> Response:
    _require_ocr_access(current_user)
    verification = _get_verification_or_404(db, verification_id, current_user)
    rows = _verification_export_rows(verification)
    headers = _verification_export_headers(verification, rows)
    trusted_export = verification.status == "approved"
    _log_ocr_event(
        db,
        action="OCR_VERIFICATION_EXCEL_EXPORT",
        details=(
            f"Verification Excel export id={verification.id} "
            f"status={verification.status} trusted={str(trusted_export).lower()} "
            f"rows={len(rows)} columns={len(headers)}"
        ),
        request=request,
        user_id=current_user.id,
        org_id=verification.org_id,
        factory_id=verification.factory_id,
    )
    db.commit()
    return _verification_export_response(verification)


@router.post("/verifications/{verification_id}/share-link", status_code=status.HTTP_200_OK)
def create_verification_share_link(
    verification_id: int,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
) -> dict:
    _require_ocr_access(current_user)
    verification = _get_verification_or_404(db, verification_id, current_user)
    token = _build_ocr_share_token(verification)
    expires_at = datetime.now(timezone.utc) + timedelta(seconds=_OCR_SHARE_MAX_AGE_SECONDS)
    return {
      "url": f"/api/ocr/shared/{token}",
      "expires_at": expires_at.isoformat(),
    }


@router.get("/shared/{token}", status_code=status.HTTP_200_OK)
def export_shared_verification_excel(
    token: str,
    db: Session = Depends(get_db),
) -> Response:
    payload = _read_ocr_share_token(token)
    verification_id = int(payload.get("verification_id") or 0)
    verification = db.query(OcrVerification).filter(OcrVerification.id == verification_id).first()
    if not verification:
        raise HTTPException(status_code=404, detail="Verification record not found.")
    if payload.get("org_id") != verification.org_id or payload.get("factory_id") != verification.factory_id:
        raise HTTPException(status_code=404, detail="Share link invalid.")
    return _verification_export_response(verification)


@router.put("/verifications/{verification_id}", status_code=status.HTTP_200_OK)
def update_verification(
    verification_id: int,
    payload: OcrVerificationUpdatePayload,
    request: Request,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
) -> dict:
    _require_ocr_access(current_user)
    verification = _get_verification_or_404(db, verification_id, current_user)

    template_id = payload.template_id
    if template_id is not None:
        template = (
            _template_query(db, current_user)
            .filter(OcrTemplate.id == template_id, OcrTemplate.is_active.is_(True))
            .first()
        )
        if not template:
            raise HTTPException(status_code=404, detail="Template not found.")

    headers = _normalize_string_list(payload.headers, field_name="headers")
    warnings = _normalize_string_list(payload.warnings, field_name="warnings")
    scan_quality = _normalize_scan_quality(payload.scan_quality, field_name="scan_quality")
    routing_meta = _normalize_routing_meta(payload.routing_meta, field_name="routing_meta")
    original_rows = _normalize_rows(payload.original_rows, field_name="original_rows")
    reviewed_rows = _normalize_rows(payload.reviewed_rows, field_name="reviewed_rows")

    _apply_verification_payload(
        verification,
        template_id=template_id,
        source_filename=payload.source_filename,
        columns=payload.columns,
        language=payload.language,
        avg_confidence=payload.avg_confidence,
        warnings=warnings,
        scan_quality=scan_quality,
        document_hash=payload.document_hash,
        doc_type_hint=payload.doc_type_hint,
        routing_meta=routing_meta,
        raw_text=payload.raw_text,
        headers=headers,
        original_rows=original_rows,
        reviewed_rows=reviewed_rows,
        raw_column_added=payload.raw_column_added,
        reviewer_notes=payload.reviewer_notes,
    )

    if current_user.id == verification.user_id and verification.status in {"pending", "rejected"}:
        verification.status = "draft"
        verification.submitted_at = None
        verification.approved_at = None
        verification.approved_by = None
        verification.rejected_at = None
        verification.rejected_by = None
        verification.rejection_reason = None

    db.commit()
    _log_ocr_event(
        db,
        action="OCR_VERIFICATION_UPDATED",
        details=(
            f"Verification updated id={verification.id} status={verification.status} "
            f"confidence={verification.avg_confidence or 0:.1f} "
            f"tier={(verification.routing_meta or {}).get('model_tier', 'fast')} "
            f"band={(verification.scan_quality or {}).get('confidence_band', 'unknown')} "
            f"corrections={(verification.scan_quality or {}).get('correction_count', 0)}"
        ),
        request=request,
        user_id=current_user.id,
        org_id=verification.org_id,
        factory_id=verification.factory_id,
    )
    db.commit()
    db.refresh(verification)
    return _serialize_verification(db, verification)


@router.post("/verifications/{verification_id}/submit", status_code=status.HTTP_200_OK)
def submit_verification(
    verification_id: int,
    payload: OcrVerificationSubmitPayload,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
) -> dict:
    _require_ocr_access(current_user)
    verification = _get_verification_or_404(db, verification_id, current_user)
    if not (verification.reviewed_rows or verification.original_rows):
        raise HTTPException(status_code=400, detail="Verification draft has no OCR rows to submit.")
    verification.status = "pending"
    verification.submitted_at = datetime.now(timezone.utc)
    verification.approved_at = None
    verification.approved_by = None
    verification.rejected_at = None
    verification.rejected_by = None
    verification.rejection_reason = None
    if payload.reviewer_notes is not None:
        verification.reviewer_notes = sanitize_text(payload.reviewer_notes, max_length=5000)
    verification.updated_at = datetime.now(timezone.utc)
    db.commit()
    db.refresh(verification)
    return _serialize_verification(db, verification)


@router.post("/verifications/{verification_id}/approve", status_code=status.HTTP_200_OK)
def approve_verification(
    verification_id: int,
    payload: OcrVerificationDecisionPayload,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
) -> dict:
    _require_ocr_access(current_user)
    if not is_manager_or_admin(current_user):
        raise HTTPException(status_code=403, detail="Only managers and admins can approve verification records.")
    verification = _get_verification_or_404(db, verification_id, current_user)
    verification.status = "approved"
    verification.approved_at = datetime.now(timezone.utc)
    verification.approved_by = current_user.id
    verification.rejected_at = None
    verification.rejected_by = None
    verification.rejection_reason = None
    if payload.reviewer_notes is not None:
        verification.reviewer_notes = sanitize_text(payload.reviewer_notes, max_length=5000)
    verification.updated_at = datetime.now(timezone.utc)
    db.commit()
    db.refresh(verification)
    return _serialize_verification(db, verification)


@router.post("/verifications/{verification_id}/reject", status_code=status.HTTP_200_OK)
def reject_verification(
    verification_id: int,
    payload: OcrVerificationDecisionPayload,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
) -> dict:
    _require_ocr_access(current_user)
    if not is_manager_or_admin(current_user):
        raise HTTPException(status_code=403, detail="Only managers and admins can reject verification records.")
    verification = _get_verification_or_404(db, verification_id, current_user)
    rejection_reason = sanitize_text(payload.rejection_reason, max_length=5000)
    if not rejection_reason:
        raise HTTPException(status_code=400, detail="Rejection reason is required.")
    verification.status = "rejected"
    verification.rejected_at = datetime.now(timezone.utc)
    verification.rejected_by = current_user.id
    verification.rejection_reason = rejection_reason
    verification.approved_at = None
    verification.approved_by = None
    if payload.reviewer_notes is not None:
        verification.reviewer_notes = sanitize_text(payload.reviewer_notes, max_length=5000)
    verification.updated_at = datetime.now(timezone.utc)
    db.commit()
    db.refresh(verification)
    return _serialize_verification(db, verification)


@router.post("/logbook", status_code=status.HTTP_200_OK)
async def ocr_logbook(
    file: UploadFile = File(...),
    columns: int = Form(default=3),
    language: str = Form(default="eng"),
    template_id: int | None = Form(default=None),
    doc_type_hint: str | None = Form(default=None),
    force_model: str | None = Form(default=None),
    document_hash: str | None = Form(default=None),
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
) -> dict:
    _require_ocr_access(current_user)
    if not file.filename:
        raise HTTPException(status_code=400, detail="File is required.")
    if not (file.content_type or "").startswith("image/"):
        raise HTTPException(status_code=400, detail="Only image files are supported.")
    image_bytes = await file.read()
    if len(image_bytes) > 8_000_000:
        raise HTTPException(status_code=413, detail="Image too large. Max 8MB.")

    template = None
    if template_id is not None:
        template = (
            _template_query(db, current_user)
            .filter(OcrTemplate.id == template_id, OcrTemplate.is_active.is_(True))
            .first()
        )
        if not template:
            raise HTTPException(status_code=404, detail="Template not found.")

    reusable = find_reusable_verification(
        db,
        org_id=resolve_org_id(current_user),
        document_hash=_normalize_document_hash(document_hash),
        template_id=template.id if template else template_id,
        doc_type_hint=doc_type_hint,
    )
    if reusable is not None:
        reused_payload = {
            **serialize_reused_ocr_result(reusable, template=template),
            "template": {
                "id": template.id,
                "name": template.name,
                "columns": template.columns,
                "header_mode": template.header_mode,
                "language": template.language,
                "column_names": template.column_names or [],
                "column_keywords": template.column_keywords or [],
                "raw_column_label": template.raw_column_label or "Raw",
                "enable_raw_column": template.enable_raw_column,
            }
            if template
            else None,
        }
        return reused_payload

    try:
        result, used_language, fallback_used = _run_ocr_with_fallback(
            image_bytes,
            columns=template.columns if template else columns,
            language=template.language if template else language,
            column_centers=template.column_centers if template else None,
            column_keywords=template.column_keywords if template else None,
            enable_raw_column=bool(template.enable_raw_column) if template else False,
        )
    except RuntimeError as error:
        logger.error("OCR extraction failed: %s: %s", type(error).__name__, error, exc_info=True)
        raise HTTPException(status_code=400, detail=str(error)) from error
    except Exception as error:  # pylint: disable=broad-except
        logger.error("OCR extraction failed: %s: %s", type(error).__name__, error, exc_info=True)
        raise HTTPException(status_code=500, detail="OCR failed unexpectedly.") from error

    scan_quality_payload = None
    try:
        image_quality = analyze_image_quality(image_bytes)
        warning_band = "low" if image_quality.warnings else "high"
        scan_quality_payload = {
            "confidence_band": warning_band,
            "quality_signals": image_quality.warnings,
            "auto_processing": ["deskew", "compression"],
            "fallback_used": fallback_used,
            "correction_count": 0,
            "page_count": 1,
            "adjustment_count": 0,
            "retake_count": 0,
            "manual_review_recommended": bool(image_quality.warnings),
            "outcome": "partial" if image_quality.warnings else "success",
            "next_action": "upload_better_image" if image_quality.warnings else None,
            "notes": "Image quality may affect accuracy." if image_quality.warnings else None,
            "cell_boxes": result.cell_boxes,
        }
    except Exception as error:  # pylint: disable=broad-except
        logger.warning("OCR scan quality analysis failed: %s", error, exc_info=True)
        scan_quality_payload = None

    try:
        structured = build_structured_ocr_result(
            image_bytes,
            base_result=result,
            used_language=used_language,
            fallback_used=fallback_used,
            template=template,
            doc_type_hint=doc_type_hint,
            force_model=force_model,
        )
    except RuntimeError as error:
        logger.error("Structured OCR build failed: %s: %s", type(error).__name__, error, exc_info=True)
        raise HTTPException(status_code=502, detail=str(error)) from error
    except Exception as error:  # pylint: disable=broad-except
        logger.error("Structured OCR build failed unexpectedly: %s: %s", type(error).__name__, error, exc_info=True)
        raise HTTPException(status_code=500, detail="Structured OCR failed unexpectedly.") from error

    return {
        **structured,
        "scan_quality": scan_quality_payload,
        "template": {
            "id": template.id,
            "name": template.name,
            "columns": template.columns,
            "header_mode": template.header_mode,
            "language": template.language,
            "column_names": template.column_names or [],
            "column_keywords": template.column_keywords or [],
            "raw_column_label": template.raw_column_label or "Raw",
            "enable_raw_column": template.enable_raw_column,
        }
        if template
        else None,
    }


@router.post("/warp", status_code=status.HTTP_200_OK)
async def warp_document(
    file: UploadFile = File(...),
    corners: str | None = Form(default=None),
    current_user: User = Depends(get_current_user),
) -> Response:
    _require_ocr_access(current_user)
    if not file.filename:
        raise HTTPException(status_code=400, detail="File is required.")
    if not (file.content_type or "").startswith("image/"):
        raise HTTPException(status_code=400, detail="Only image files are supported.")
    image_bytes = await file.read()
    if len(image_bytes) > 8_000_000:
        raise HTTPException(status_code=413, detail="Image too large. Max 8MB.")

    parsed = _parse_json_value(corners, field_name="corners")
    used_corners = None
    if parsed is not None:
        if not isinstance(parsed, list) or len(parsed) != 4:
            raise HTTPException(status_code=400, detail="corners must be a list of 4 points.")
        used_corners = []
        for point in parsed:
            if not isinstance(point, (list, tuple)) or len(point) != 2:
                raise HTTPException(status_code=400, detail="Each corner must be [x,y].")
            used_corners.append([float(point[0]), float(point[1])])

    try:
        warped_bytes, applied = warp_perspective(image_bytes, corners=used_corners)
    except RuntimeError as error:
        raise HTTPException(status_code=400, detail=str(error)) from error
    except Exception as error:  # pylint: disable=broad-except
        logger.exception("Warp failed.")
        raise HTTPException(status_code=500, detail="Could not fix perspective.") from error

    headers = {"Cache-Control": "no-store", "Pragma": "no-cache"}
    if applied is not None:
        headers["X-Warp-Corners"] = json.dumps(applied)
    return Response(content=warped_bytes, media_type="image/png", headers=headers)


@router.post("/logbook-excel", status_code=status.HTTP_200_OK)
async def ocr_logbook_excel(
    file: UploadFile = File(...),
    mock: bool = Form(default=False),
    system_prompt: str | None = Form(default=None),
    user_message: str | None = Form(default=None),
    preprocess_profile: str | None = Form(default=None),
    request: Request = None,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
) -> Response:
    _require_ocr_access(current_user)
    if not file.filename:
        raise HTTPException(status_code=400, detail="File is required.")
    if not (file.content_type or "").startswith("image/"):
        raise HTTPException(status_code=400, detail="Only image files are supported.")
    image_bytes = await file.read()
    if len(image_bytes) > 8_000_000:
        raise HTTPException(status_code=413, detail="Image too large. Max 8MB.")
    org_id = resolve_org_id(current_user)
    plan = get_org_plan_for_usage(db, org_id=org_id, user_id=current_user.id)
    check_rate_limit(current_user.id, plan=plan)
    if org_id:
        check_and_record_org_usage(db, org_id=org_id, image_bytes=len(image_bytes), plan=plan)
    else:
        check_and_record_usage(db, user_id=current_user.id, image_bytes=len(image_bytes), plan=plan)

    try:
        if not preprocess_profile:
            preprocess_profile = os.getenv("LEDGER_SCAN_PREPROCESS_PROFILE")
        base64_image = preprocess_image_bytes(image_bytes, profile=preprocess_profile)
        rows = ledger_extract_data(
            base64_image,
            force_mock=mock,
            system_prompt=system_prompt,
            user_message=user_message,
        )
        validated = ledger_validate_data(rows)
        excel_bytes = ledger_build_excel_bytes(validated)
    except ValueError as error:
        logger.exception("LedgerScan JSON parsing failed.")
        raise HTTPException(status_code=400, detail=str(error)) from error
    except AuthenticationError as error:
        logger.exception("LedgerScan authentication failed.")
        raise HTTPException(status_code=401, detail="Anthropic authentication failed. Check ANTHROPIC_API_KEY.") from error
    except BadRequestError as error:
        logger.exception("LedgerScan request rejected by Anthropic.")
        message = str(error)
        if "credit balance is too low" in message.lower():
            raise HTTPException(status_code=429, detail="Anthropic API credits are too low.") from error
        raise HTTPException(status_code=400, detail=message) from error
    except RuntimeError as error:
        logger.exception("LedgerScan configuration error.")
        raise HTTPException(status_code=500, detail=str(error)) from error
    except Exception as error:  # pylint: disable=broad-except
        logger.exception("LedgerScan OCR failed.")
        raise HTTPException(status_code=500, detail="LedgerScan OCR failed unexpectedly.") from error

    metadata = validated.get("metadata", {})
    headers = {
        "Content-Disposition": "attachment; filename=logbook_ledger_scan.xlsx",
        "Cache-Control": "no-store",
        "Pragma": "no-cache",
        "X-Total-Rows": str(metadata.get("total_rows", 0)),
        "X-Total-Dr": str(metadata.get("total_dr", 0)),
        "X-Total-Cr": str(metadata.get("total_cr", 0)),
        "X-Balanced": str(bool(metadata.get("balanced"))).lower(),
        "X-Difference": str(metadata.get("difference", 0)),
        "X-Low-Confidence-Rows": json.dumps(metadata.get("low_confidence_rows", [])),
    }
    if request is not None:
        safe_name = sanitize_text(file.filename, max_length=200, preserve_newlines=False) or "unknown"
        org_id = resolve_org_id(current_user)
        factory_id = resolve_factory_id(db, current_user)
        _log_ocr_event(
            db,
            action="OCR_LEDGER_EXCEL",
            details=f"Ledger Excel generated filename={safe_name} size_bytes={len(image_bytes)}",
            request=request,
            user_id=current_user.id,
            org_id=org_id,
            factory_id=factory_id,
        )
        db.commit()
    return Response(
        content=excel_bytes,
        media_type="application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
        headers=headers,
    )


@router.post("/logbook-excel-async", status_code=status.HTTP_202_ACCEPTED)
async def ocr_logbook_excel_async(
    file: UploadFile = File(...),
    mock: bool = Form(default=False),
    system_prompt: str | None = Form(default=None),
    user_message: str | None = Form(default=None),
    preprocess_profile: str | None = Form(default=None),
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
) -> dict:
    _require_ocr_access(current_user)
    if not file.filename:
        raise HTTPException(status_code=400, detail="File is required.")
    if not (file.content_type or "").startswith("image/"):
        raise HTTPException(status_code=400, detail="Only image files are supported.")
    image_bytes = await file.read()
    if len(image_bytes) > 8_000_000:
        raise HTTPException(status_code=413, detail="Image too large. Max 8MB.")
    if not preprocess_profile:
        preprocess_profile = os.getenv("LEDGER_SCAN_PREPROCESS_PROFILE")
    org_id = resolve_org_id(current_user)
    plan = get_org_plan_for_usage(db, org_id=org_id, user_id=current_user.id)
    check_rate_limit(current_user.id, plan=plan)
    if org_id:
        check_and_record_org_usage(db, org_id=org_id, image_bytes=len(image_bytes), plan=plan)
    else:
        check_and_record_usage(db, user_id=current_user.id, image_bytes=len(image_bytes), plan=plan)
    job = _queue_ocr_excel_job(
        mode="ledger",
        owner_id=current_user.id,
        org_id=org_id,
        factory_id=resolve_factory_id(db, current_user),
        source_filename=_safe_file_name(file.filename, "ledger-ocr-input.png"),
        content_type=file.content_type,
        size_bytes=len(image_bytes),
        mock=mock,
        system_prompt=system_prompt,
        user_message=user_message,
        preprocess_profile=preprocess_profile,
        image_bytes=image_bytes,
    )
    payload = dict(job)
    payload.update(_job_urls(str(job["job_id"])))
    return payload


@router.post("/table-excel", status_code=status.HTTP_200_OK)
async def ocr_table_excel(
    file: UploadFile = File(...),
    system_prompt: str | None = Form(default=None),
    user_message: str | None = Form(default=None),
    preprocess_profile: str | None = Form(default=None),
    request: Request = None,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
) -> Response:
    _require_ocr_access(current_user)
    if not file.filename:
        raise HTTPException(status_code=400, detail="File is required.")
    if not (file.content_type or "").startswith("image/"):
        raise HTTPException(status_code=400, detail="Only image files are supported.")
    image_bytes = await file.read()
    if len(image_bytes) > 8_000_000:
        raise HTTPException(status_code=413, detail="Image too large. Max 8MB.")
    org_id = resolve_org_id(current_user)
    plan = get_org_plan_for_usage(db, org_id=org_id, user_id=current_user.id)
    check_rate_limit(current_user.id, plan=plan)
    if org_id:
        check_and_record_org_usage(db, org_id=org_id, image_bytes=len(image_bytes), plan=plan)
    else:
        check_and_record_usage(db, user_id=current_user.id, image_bytes=len(image_bytes), plan=plan)

    try:
        table = table_extract_table_from_image(
            image_bytes,
            system_prompt=system_prompt,
            user_message=user_message,
            preprocess_profile=preprocess_profile,
        )
        excel_bytes = build_table_excel_bytes(table)
    except ValueError as error:
        logger.exception("TableScan JSON parsing failed.")
        raise HTTPException(status_code=400, detail=str(error)) from error
    except AuthenticationError as error:
        logger.exception("TableScan authentication failed.")
        raise HTTPException(status_code=401, detail="Anthropic authentication failed. Check ANTHROPIC_API_KEY.") from error
    except BadRequestError as error:
        logger.exception("TableScan request rejected by Anthropic.")
        message = str(error)
        if "credit balance is too low" in message.lower():
            raise HTTPException(status_code=429, detail="Anthropic API credits are too low.") from error
        raise HTTPException(status_code=400, detail=message) from error
    except RuntimeError as error:
        logger.exception("TableScan configuration error.")
        raise HTTPException(status_code=500, detail=str(error)) from error
    except Exception as error:  # pylint: disable=broad-except
        logger.exception("TableScan OCR failed.")
        raise HTTPException(status_code=500, detail="TableScan OCR failed unexpectedly.") from error

    headers = {
        "Content-Disposition": "attachment; filename=table_scan.xlsx",
        "Cache-Control": "no-store",
        "Pragma": "no-cache",
        "X-Total-Rows": str(len(table.get("rows", []))),
        "X-Total-Columns": str(len(table.get("headers", []))),
    }
    if request is not None:
        safe_name = sanitize_text(file.filename, max_length=200, preserve_newlines=False) or "unknown"
        org_id = resolve_org_id(current_user)
        factory_id = resolve_factory_id(db, current_user)
        _log_ocr_event(
            db,
            action="OCR_TABLE_EXCEL",
            details=f"Table Excel generated filename={safe_name} size_bytes={len(image_bytes)}",
            request=request,
            user_id=current_user.id,
            org_id=org_id,
            factory_id=factory_id,
        )
        db.commit()
    return Response(
        content=excel_bytes,
        media_type="application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
        headers=headers,
    )


@router.post("/table-excel-async", status_code=status.HTTP_202_ACCEPTED)
async def ocr_table_excel_async(
    file: UploadFile = File(...),
    system_prompt: str | None = Form(default=None),
    user_message: str | None = Form(default=None),
    preprocess_profile: str | None = Form(default=None),
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
) -> dict:
    _require_ocr_access(current_user)
    if not file.filename:
        raise HTTPException(status_code=400, detail="File is required.")
    if not (file.content_type or "").startswith("image/"):
        raise HTTPException(status_code=400, detail="Only image files are supported.")
    image_bytes = await file.read()
    if len(image_bytes) > 8_000_000:
        raise HTTPException(status_code=413, detail="Image too large. Max 8MB.")
    org_id = resolve_org_id(current_user)
    plan = get_org_plan_for_usage(db, org_id=org_id, user_id=current_user.id)
    check_rate_limit(current_user.id, plan=plan)
    if org_id:
        check_and_record_org_usage(db, org_id=org_id, image_bytes=len(image_bytes), plan=plan)
    else:
        check_and_record_usage(db, user_id=current_user.id, image_bytes=len(image_bytes), plan=plan)
    job = _queue_ocr_excel_job(
        mode="table",
        owner_id=current_user.id,
        org_id=org_id,
        factory_id=resolve_factory_id(db, current_user),
        source_filename=_safe_file_name(file.filename, "table-ocr-input.png"),
        content_type=file.content_type,
        size_bytes=len(image_bytes),
        system_prompt=system_prompt,
        user_message=user_message,
        preprocess_profile=preprocess_profile,
        image_bytes=image_bytes,
    )
    payload = dict(job)
    payload.update(_job_urls(str(job["job_id"])))
    return payload


@router.get("/jobs/{job_id}", status_code=status.HTTP_200_OK)
def get_ocr_job(job_id: str, current_user: User = Depends(get_current_user)) -> dict:
    _require_ocr_access(current_user)
    payload = get_background_job(job_id, owner_id=current_user.id)
    if payload is None or not str(payload.get("kind", "")).startswith("ocr_"):
        raise HTTPException(status_code=404, detail="Job not found.")
    payload.update(_job_urls(job_id))
    return payload


@router.get("/jobs/{job_id}/download", status_code=status.HTTP_200_OK)
def download_ocr_job(job_id: str, current_user: User = Depends(get_current_user)) -> Response:
    _require_ocr_access(current_user)
    job = get_background_job(job_id, owner_id=current_user.id)
    if job is None or not str(job.get("kind", "")).startswith("ocr_"):
        raise HTTPException(status_code=404, detail="Job not found.")
    if job.get("status") != "succeeded":
        raise HTTPException(status_code=409, detail=f"Job is not ready (status: {job.get('status')}).")
    try:
        excel_bytes, file_meta = read_job_file(job_id, owner_id=current_user.id)
    except FileNotFoundError as error:
        raise HTTPException(status_code=404, detail="Result file missing.") from error
    metadata = (job.get("result") or {}).get("metadata") if isinstance(job.get("result"), dict) else {}
    headers = {
        "Content-Disposition": f'attachment; filename="{file_meta.get("filename") or "ocr_job_result.xlsx"}"',
        "Cache-Control": "no-store",
        "Pragma": "no-cache",
    }
    if str(job.get("kind")) == "ocr_ledger_excel":
        headers.update(
            {
                "X-Total-Rows": str((metadata or {}).get("total_rows", 0)),
                "X-Total-Dr": str((metadata or {}).get("total_dr", 0)),
                "X-Total-Cr": str((metadata or {}).get("total_cr", 0)),
                "X-Balanced": str(bool((metadata or {}).get("balanced"))).lower(),
                "X-Difference": str((metadata or {}).get("difference", 0)),
                "X-Low-Confidence-Rows": json.dumps((metadata or {}).get("low_confidence_rows", [])),
            }
        )
    else:
        headers.update(
            {
                "X-Total-Rows": str((metadata or {}).get("total_rows", 0)),
                "X-Total-Columns": str((metadata or {}).get("total_columns", 0)),
            }
        )
    return Response(
        content=excel_bytes,
        media_type=str(file_meta.get("media_type") or "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet"),
        headers=headers,
    )
