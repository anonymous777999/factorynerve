from __future__ import annotations

import json
import mimetypes
from datetime import datetime, timedelta, timezone
from pathlib import Path

from fastapi import Depends, File, Form, HTTPException, Request, Response, UploadFile, status
from fastapi.responses import FileResponse
from sqlalchemy.orm import Session

from backend.database import get_db
from backend.security import get_current_user
from backend.authorization import PDP, ResourceContext
from backend.authorization.pdp import build_request_context
from backend.services.approval_service import approval_service as APPROVAL_SERVICE
from backend.tenancy import resolve_org_id, resolve_factory_id
from backend.utils import sanitize_text

from backend.routers.ocr._common import (
    logger,
    router,
    _require_ocr_access,
    _log_ocr_event,
    _active_factory_id,
    _require_anthropic_api_key,
    _serialize_verification,
    _get_verification_or_404,
    _save_verification_source,
    _verification_query,
    _ALLOWED_VERIFICATION_STATUSES,
    _normalize_string_list,
    _normalize_rows,
    _normalize_scan_quality,
    _normalize_routing_meta,
    _normalize_document_hash,
    _normalize_doc_type_hint,
    _resolve_doc_type_hint,
    _parse_json_value,
    _safe_file_name,
    _build_ocr_share_token,
    _read_ocr_share_token,
    _verification_export_rows,
    _verification_export_headers,
    _verification_export_response,
    _verification_row_count,
    _apply_verification_payload,
    _read_validated_image_upload,
    _template_query,
    OcrVerificationUpdatePayload,
    OcrVerificationSubmitPayload,
    OcrVerificationDecisionPayload,
    OCR_VERIFICATION_DIR,
    _FILENAME_SAFE_RE,
    _OCR_SHARE_MAX_AGE_SECONDS,
)
from backend.metrics import OCR_EXPORT_COUNT, OCR_USER_CORRECTION_RATE
from backend.services.export_gate import validate_export_readiness
from backend.models.ocr_verification import OcrVerification
from backend.models.ocr_template import OcrTemplate
from backend.models.factory import Factory
from backend.models.user import User

@router.get("/verifications", status_code=status.HTTP_200_OK)
def list_verifications(
    verification_status: str | None = None,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
) -> list[dict]:
    _require_ocr_access(db, current_user)
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
    _require_ocr_access(db, current_user)
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
    _require_ocr_access(db, current_user)

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
        image_bytes = await _read_validated_image_upload(file)
        source_name, image_path = _save_verification_source(file.filename or source_filename, image_bytes)
    else:
        source_name = _safe_file_name(source_filename) if source_filename else None
        image_path = None

    if not parsed_reviewed_rows and not parsed_original_rows:
        raise HTTPException(status_code=400, detail="Provide OCR rows before saving a verification draft.")

    # The frontend's doc_type_hint is usually just the coarse extraction
    # shape (e.g. "table"), not a registry type_id -- classify against the
    # actual extracted text/rows so document_type_config can resolve to a
    # type-specific review layout on /ocr/verify instead of always falling
    # back to the generic table view.
    resolved_doc_type_hint = _resolve_doc_type_hint(
        _normalize_doc_type_hint(doc_type_hint),
        raw_text=raw_text,
        headers=parsed_headers,
        rows=parsed_reviewed_rows or parsed_original_rows,
    )

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
        doc_type_hint=resolved_doc_type_hint,
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
    _require_ocr_access(db, current_user)
    verification = _get_verification_or_404(db, verification_id, current_user)
    return _serialize_verification(db, verification)


@router.get("/verifications/{verification_id}/source-image")
def get_verification_source_image(
    verification_id: int,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
) -> FileResponse:
    _require_ocr_access(db, current_user)
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
    _require_ocr_access(db, current_user)
    verification = _get_verification_or_404(db, verification_id, current_user)
    # Draft/pending documents may still be exported — the workbook is watermarked
    # "DRAFT — Not approved" (see _add_draft_warning in excel_export_engine) so the
    # gate below only downgrades trust metadata, it never blocks the download itself.
    gate_result = validate_export_readiness(verification)
    if not gate_result.passed:
        blocking_msgs = [c.message for c in gate_result.blocking_issues]
        logger.info("Export gate advisory for verification id=%s: %s", verification.id, blocking_msgs)

    rows = _verification_export_rows(verification)
    headers = _verification_export_headers(verification, rows)
    trusted_export = verification.status == "approved"

    # Phase 7: Track export count
    OCR_EXPORT_COUNT.labels(format="excel").inc()
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
    _require_ocr_access(db, current_user)
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
    verification = (
        db.query(OcrVerification)
        .filter(
            OcrVerification.id == verification_id,
            OcrVerification.org_id == payload.get("org_id"),
            OcrVerification.factory_id == payload.get("factory_id"),
        )
        .first()
    )
    if not verification:
        raise HTTPException(status_code=404, detail="Verification record not found.")
    return _verification_export_response(verification)


@router.put("/verifications/{verification_id}", status_code=status.HTTP_200_OK)
def update_verification(
    verification_id: int,
    payload: OcrVerificationUpdatePayload,
    request: Request,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
) -> dict:
    PDP(db=db).require_permission(actor=current_user, permission_key="ocr.verification.edit")
    verification = _get_verification_or_404(db, verification_id, current_user)

    # Phase 7: Track user corrections when reviewed_rows differ from original_rows
    if payload.reviewed_rows is not None and verification.original_rows:
        old_original = json.dumps(verification.original_rows, sort_keys=True)
        new_reviewed = json.dumps(payload.reviewed_rows, sort_keys=True)
        if old_original != new_reviewed:
            OCR_USER_CORRECTION_RATE.set(1.0)
        else:
            OCR_USER_CORRECTION_RATE.set(0.0)

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

    resolved_doc_type_hint = payload.doc_type_hint
    if payload.doc_type_hint is not None:
        resolved_doc_type_hint = _resolve_doc_type_hint(
            _normalize_doc_type_hint(payload.doc_type_hint),
            raw_text=payload.raw_text or verification.raw_text,
            headers=headers or verification.headers,
            rows=reviewed_rows or original_rows or verification.reviewed_rows or verification.original_rows,
        )

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
        doc_type_hint=resolved_doc_type_hint,
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
    PDP(db=db).require_permission(actor=current_user, permission_key="ocr.verification.submit")
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
    request: Request,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
) -> dict:
    _require_ocr_access(db, current_user)

    # Step 1: Load verification and resolve domain-split permission
    verification = _get_verification_or_404(db, verification_id, current_user)
    doc_type = (verification.doc_type_hint or "").strip().lower()
    is_finance_doc = doc_type in {"invoice", "ledger", "payment", "receipt", "bill"}
    permission_key = (
        "ocr.verification.approve_finance" if is_finance_doc
        else "ocr.verification.approve"
    )

    pdp = PDP(db=db)
    pdp.require_permission(
        actor=current_user,
        permission_key=permission_key,
        resource=ResourceContext(factory_id=verification.factory_id),
        request_context=build_request_context(request),
    )

    # Step 2: Approval service initiation (maker-checker)
    approval_decision = APPROVAL_SERVICE.initiate_approval(db,
        actor_user_id=current_user.id,
        subject_user_id=verification.user_id,
        workflow_key="ocr.verification.approve",
        action_key=permission_key,
        resource_type="OcrVerification",
        resource_id=str(verification_id),
        org_id=verification.org_id,
        factory_id=verification.factory_id,
        current_workflow_state=verification.status,
        attributes={
            "doc_type_hint": verification.doc_type_hint,
            "avg_confidence": verification.avg_confidence,
            "is_finance_doc": is_finance_doc,
        },
        request_context=build_request_context(request),
    )

    if approval_decision.result == "denied":
        raise HTTPException(status_code=403, detail=approval_decision.reason)

    if approval_decision.result not in ("approved", "no_approval_required"):
        raise HTTPException(status_code=500, detail=f"Unexpected approval result: {approval_decision.result}")

    # Step 3: Proceed with mutation
    verification.status = "approved"
    verification.approved_at = datetime.now(timezone.utc)
    verification.approved_by = current_user.id
    verification.rejected_at = None
    verification.rejected_by = None
    verification.rejection_reason = None
    if payload.reviewer_notes is not None:
        verification.reviewer_notes = sanitize_text(payload.reviewer_notes, max_length=5000)
    verification.updated_at = datetime.now(timezone.utc)

    _log_ocr_event(
        db,
        action="OCR_VERIFICATION_APPROVED",
        details=f"Verification id={verification.id} doc_type={doc_type} finance={is_finance_doc}",
        request=request,
        user_id=current_user.id,
        org_id=verification.org_id,
        factory_id=verification.factory_id,
    )
    db.commit()
    db.refresh(verification)

    # Step 4: Notify approval system of completion
    if approval_decision.instance_id:
        APPROVAL_SERVICE.complete_approval(db, instance_id=approval_decision.instance_id)

    return _serialize_verification(db, verification)


@router.post("/verifications/{verification_id}/reject", status_code=status.HTTP_200_OK)
def reject_verification(
    verification_id: int,
    payload: OcrVerificationDecisionPayload,
    request: Request,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
) -> dict:
    _require_ocr_access(db, current_user)

    # Step 1: Load verification for context
    verification = _get_verification_or_404(db, verification_id, current_user)

    # Step 2: PDP permission check
    pdp = PDP(db=db)
    pdp.require_permission(
        actor=current_user,
        permission_key="ocr.verification.reject",
        resource=ResourceContext(factory_id=verification.factory_id),
        request_context=build_request_context(request),
    )

    # Step 3: Approval service initiation (maker-checker)
    approval_decision = APPROVAL_SERVICE.initiate_approval(db,
        actor_user_id=current_user.id,
        subject_user_id=verification.user_id,
        workflow_key="ocr.verification.reject",
        action_key="ocr.verification.reject",
        resource_type="OcrVerification",
        resource_id=str(verification_id),
        org_id=verification.org_id,
        factory_id=verification.factory_id,
        current_workflow_state=verification.status,
        request_context=build_request_context(request),
    )

    if approval_decision.result == "denied":
        raise HTTPException(status_code=403, detail=approval_decision.reason)

    if approval_decision.result not in ("approved", "no_approval_required"):
        raise HTTPException(status_code=500, detail=f"Unexpected approval result: {approval_decision.result}")

    rejection_reason = sanitize_text(payload.rejection_reason, max_length=5000)
    if not rejection_reason:
        raise HTTPException(status_code=400, detail="Rejection reason is required.")

    # Step 4: Proceed with mutation
    verification.status = "rejected"
    verification.rejected_at = datetime.now(timezone.utc)
    verification.rejected_by = current_user.id
    verification.rejection_reason = rejection_reason
    verification.approved_at = None
    verification.approved_by = None
    if payload.reviewer_notes is not None:
        verification.reviewer_notes = sanitize_text(payload.reviewer_notes, max_length=5000)
    verification.updated_at = datetime.now(timezone.utc)

    _log_ocr_event(
        db,
        action="OCR_VERIFICATION_REJECTED",
        details=f"Verification id={verification.id} reason={rejection_reason[:120]}",
        request=request,
        user_id=current_user.id,
        org_id=verification.org_id,
        factory_id=verification.factory_id,
    )
    db.commit()
    db.refresh(verification)

    # Step 5: Notify approval system of completion
    if approval_decision.instance_id:
        APPROVAL_SERVICE.complete_approval(db, instance_id=approval_decision.instance_id)

    return _serialize_verification(db, verification)
