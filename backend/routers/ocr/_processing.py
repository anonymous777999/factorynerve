from __future__ import annotations

import json
import os
from datetime import datetime, timezone

from fastapi import Depends, File, Form, HTTPException, Request, Response, UploadFile, status
from fastapi.responses import JSONResponse
from sqlalchemy.orm import Session
from anthropic import AuthenticationError, BadRequestError

from backend.database import get_db
from backend.security import get_current_user
from backend.tenancy import resolve_factory_id, resolve_org_id
from backend.utils import HIGH_CONFIDENCE_THRESHOLD, LOW_CONFIDENCE_THRESHOLD, normalize_confidence, sanitize_text
from backend.ocr_utils import analyze_image_quality, warp_perspective
from backend.dependencies.quota import refund_ocr_quota, require_ocr_quota
from backend.dependencies.subscription import require_active_subscription
from backend.ledger_scan import (
    build_excel_bytes as ledger_build_excel_bytes,
    extract_data_from_image as ledger_extract_data,
    preprocess_image_bytes,
    validate_data as ledger_validate_data,
)
from backend.models.ocr_template import OcrTemplate
from backend.services.background_jobs import get_job as get_background_job, read_job_file
from backend.services.ocr_document_pipeline import (
    build_structured_ocr_result,
    find_reusable_verification,
    serialize_reused_ocr_result,
)

from backend.routers.ocr._common import (
    logger,
    router,
    TableExcelRouteError,
    _require_ocr_access,
    _log_ocr_event,
    _active_factory_id,
    _table_excel_error,
    _normalize_table_excel_value,
    _normalize_string_list,
    _parse_json_value,
    _table_preview_title,
    _table_preview_doc_type,
    _extract_table_excel_scalar,
    _serialize_verification,
    _get_verification_or_404,
    _save_verification_source,
    _run_table_preview_pipeline,
    _run_ocr_with_fallback,
    _run_table_excel_pipeline,
    _queue_ocr_excel_job,
    _job_urls,
    _read_validated_image_upload,
    _read_image_upload_for_mock,
    _safe_file_name,
    _normalize_document_hash,
    _normalize_doc_type_hint,
    _template_query,
    _reject_mock_ocr,
    _inspect_table_excel_image,
    _read_table_excel_upload,
    _table_excel_response_headers,
    _TABLE_EXCEL_MODEL_TO_TIER,
    OCR_VERIFICATION_DIR,
    _FILENAME_SAFE_RE,
    _OCR_SHARE_MAX_AGE_SECONDS,
)
from backend.models.ocr_verification import OcrVerification
from backend.models.factory import Factory
from backend.models.user import User

@router.post("/logbook", status_code=status.HTTP_200_OK)
async def ocr_logbook(
    file: UploadFile = File(...),
    columns: int = Form(default=3),
    language: str = Form(default="eng"),
    template_id: int | None = Form(default=None),
    doc_type_hint: str | None = Form(default=None),
    model: str | None = Form(default=None),
    force_model: str | None = Form(default=None),
    document_hash: str | None = Form(default=None),
    force_refresh: bool = Form(default=False),
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
) -> dict:
    _require_ocr_access(db, current_user)
    image_bytes = await _read_validated_image_upload(file)
    requested_doc_type = _normalize_doc_type_hint(doc_type_hint) or "table"
    requested_model = sanitize_text(model or force_model, max_length=80, preserve_newlines=False) or None
    logger.info(
        "[OCR] /ocr/logbook received filename=%s requested_model=%s document_hash=%s force_refresh=%s",
        file.filename or "unknown",
        requested_model or "auto",
        _normalize_document_hash(document_hash) or "none",
        force_refresh,
    )

    template = None
    if template_id is not None:
        template = (
            _template_query(db, current_user)
            .filter(OcrTemplate.id == template_id, OcrTemplate.is_active.is_(True))
            .first()
        )
        if not template:
            raise HTTPException(status_code=404, detail="Template not found.")

    reusable = None
    if not force_refresh:
        normalized_hash = _normalize_document_hash(document_hash)
        org_id_for_lookup = resolve_org_id(current_user)
        logger.info(
            "[OCR-CACHE-DEBUG] Lookup | hash=%s | org=%s | template=%s | doc_type=%s",
            normalized_hash,
            org_id_for_lookup,
            template.id if template else template_id,
            requested_doc_type,
        )
        reusable = find_reusable_verification(
            db,
            org_id=org_id_for_lookup,
            document_hash=normalized_hash,
            template_id=template.id if template else template_id,
            doc_type_hint=requested_doc_type,
            requested_model=requested_model,
        )
    if reusable is not None:
        logger.info(
            "[OCR] Reusing cached verification id=%s requested_model=%s provider_model=%s",
            reusable.id,
            requested_model or "auto",
            (reusable.routing_meta or {}).get("provider_model"),
        )
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

    # Handle force_refresh and rate limiting
    previous_record = None
    if force_refresh:
        previous_record = find_reusable_verification(
            db,
            org_id=resolve_org_id(current_user),
            document_hash=_normalize_document_hash(document_hash),
            template_id=template.id if template else template_id,
            doc_type_hint=requested_doc_type,
            requested_model=requested_model,
        )
        if previous_record:
            # Check rate limit (3 per hour)
            routing = previous_record.routing_meta or {}
            reprocess_count = int(routing.get("reprocess_count", 0))
            last_reprocessed = routing.get("last_reprocessed_at")
            
            if last_reprocessed:
                try:
                    last_dt = datetime.fromisoformat(last_reprocessed)
                    if last_dt.tzinfo is None:
                        last_dt = last_dt.replace(tzinfo=timezone.utc)
                    if (datetime.now(timezone.utc) - last_dt).total_seconds() < 3600:
                        if reprocess_count >= 3:
                            raise HTTPException(
                                status_code=429, 
                                detail="Reprocess limit reached. Try again later."
                            )
                except (ValueError, TypeError):
                    pass

    requested_language = template.language if template else language

    if requested_doc_type in {"table", "sheet", "spreadsheet", "logbook", "ledger", "register"}:
        fallback_used = False
        try:
            structured = _run_table_preview_pipeline(
                image_bytes,
                content_type=file.content_type,
                filename=file.filename,
                template=template,
                doc_type_hint=requested_doc_type,
                requested_model=requested_model,
                language=requested_language,
            )
        except TableExcelRouteError as error:
            logger.error("Structured table preview failed: %s", error.payload, exc_info=True)
            raise HTTPException(status_code=error.status_code, detail=error.payload.get("error")) from error
        except Exception as error:  # pylint: disable=broad-except
            logger.error("Structured table preview failed unexpectedly: %s: %s", type(error).__name__, error, exc_info=True)
            raise HTTPException(status_code=500, detail=f"Structured OCR failed: {error}") from error
    else:
        try:
            result, used_language, fallback_used = _run_ocr_with_fallback(
                image_bytes,
                columns=template.columns if template else columns,
                language=requested_language,
                column_centers=template.column_centers if template else None,
                column_keywords=template.column_keywords if template else None,
                enable_raw_column=bool(template.enable_raw_column) if template else False,
                allow_fallback=True,
            )
        except RuntimeError as error:
            logger.error("OCR extraction failed: %s: %s", type(error).__name__, error, exc_info=True)
            raise HTTPException(status_code=400, detail=str(error)) from error
        except Exception as error:  # pylint: disable=broad-except
            logger.error("OCR extraction failed: %s: %s", type(error).__name__, error, exc_info=True)
            raise HTTPException(status_code=500, detail=f"OCR failed: {error}") from error

        try:
            structured = build_structured_ocr_result(
                image_bytes,
                base_result=result,
                used_language=used_language,
                fallback_used=fallback_used,
                template=template,
                doc_type_hint=requested_doc_type,
                force_model=requested_model,
            )
        except RuntimeError as error:
            logger.error("Structured OCR build failed: %s: %s", type(error).__name__, error, exc_info=True)
            raise HTTPException(status_code=502, detail=str(error)) from error
        except Exception as error:  # pylint: disable=broad-except
            logger.error("Structured OCR build failed unexpectedly: %s: %s", type(error).__name__, error, exc_info=True)
            raise HTTPException(status_code=500, detail=f"Structured OCR failed: {error}") from error

    scan_quality_payload = None
    try:
        image_quality = analyze_image_quality(image_bytes)
        warning_count = len(image_quality.warnings or [])
        avg_conf = (normalize_confidence(structured.get("avg_confidence")) or 0.0)
        fallback_active = bool(fallback_used or structured.get("_fallback_active"))
        correction_applied = bool(structured.get("_correction_applied"))
        
        if fallback_active or warning_count >= 2 or avg_conf < LOW_CONFIDENCE_THRESHOLD:
            warning_band = "low"
        elif warning_count == 1 or avg_conf < HIGH_CONFIDENCE_THRESHOLD:
            warning_band = "medium"
        else:
            warning_band = "high"
            
        scan_quality_payload = {
            "confidence_band": warning_band,
            "quality_signals": image_quality.warnings,
            "auto_processing": ["deskew", "compression"],
            "fallback_used": fallback_active,
            "ai_corrected": correction_applied,
            "degraded_mode": bool(fallback_active or avg_conf < LOW_CONFIDENCE_THRESHOLD),
            "correction_count": 1 if correction_applied else 0,
            "page_count": 1,
            "adjustment_count": 0,
            "retake_count": 0,
            "manual_review_recommended": bool(fallback_active or warning_count >= 2 or avg_conf < LOW_CONFIDENCE_THRESHOLD),
            "outcome": "partial" if warning_count else "success",
            "next_action": "upload_better_image" if warning_count >= 2 else "verify_numbers_manually" if correction_applied else None,
            "notes": "Image quality or AI confidence may affect accuracy." if (warning_count or correction_applied) else None,
            "cell_boxes": structured.get("cell_boxes"),
            "provider_trust": "verified" if (not correction_applied and avg_conf >= HIGH_CONFIDENCE_THRESHOLD) else "experimental",
        }
    except Exception as error:  # pylint: disable=broad-except
        logger.warning("OCR scan quality analysis failed: %s", error, exc_info=True)
        scan_quality_payload = None

    final_payload = {
        **structured,
        "scan_quality": scan_quality_payload,
        "ai_metadata": {
            "provider_model": structured.get("_provider_model"),
            "selected_tier": _TABLE_EXCEL_MODEL_TO_TIER.get(structured.get("_provider_model")),
            "correction_applied": bool(structured.get("_correction_applied")),
            "fallback_active": bool(fallback_used or structured.get("_fallback_active")),
        },
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
        "reused": False,
        "cached": False,
        "reprocess_count": 0,
        "reprocess_limit": 3,
        "cache_trust": "high"
        if (normalize_confidence(structured.get("avg_confidence")) or 0.0)
        >= LOW_CONFIDENCE_THRESHOLD
        else "low",
    }

    if previous_record:
        # Comparison logic
        old_conf = normalize_confidence(previous_record.avg_confidence)
        new_conf = normalize_confidence(structured.get("avg_confidence"))

        routing = previous_record.routing_meta or {}
        new_reprocess_count = int(routing.get("reprocess_count", 0)) + 1

        # Add reprocess metadata
        final_payload["reprocess_count"] = new_reprocess_count
        final_payload["previous_confidence"] = old_conf
        final_payload["last_reprocessed_at"] = datetime.now(timezone.utc).isoformat()

        if "routing" in final_payload:
            final_payload["routing"]["reprocess_count"] = new_reprocess_count
            final_payload["routing"][
                "last_reprocessed_at"
            ] = final_payload["last_reprocessed_at"]
            final_payload["routing"]["previous_confidence"] = old_conf

        if old_conf is not None and new_conf is not None:
            if new_conf < old_conf:
                final_payload["confidence_dropped"] = True
            else:
                final_payload["confidence_improved"] = True

    return final_payload


@router.post("/warp", status_code=status.HTTP_200_OK)
async def warp_document(
    db: Session = Depends(get_db),
    file: UploadFile = File(...),
    corners: str | None = Form(default=None),
    current_user: User = Depends(get_current_user),
) -> Response:
    _require_ocr_access(db, current_user)
    image_bytes = await _read_validated_image_upload(file)

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


@router.post(
    "/logbook-excel",
    status_code=status.HTTP_200_OK,
    dependencies=[Depends(require_active_subscription), Depends(require_ocr_quota)],
)
async def ocr_logbook_excel(
    file: UploadFile = File(...),
    mock: bool = Form(default=False),
    model: str | None = Form(default=None),
    system_prompt: str | None = Form(default=None),
    user_message: str | None = Form(default=None),
    preprocess_profile: str | None = Form(default=None),
    request: Request = None,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
) -> Response:
    _require_ocr_access(db, current_user)
    requested_model = sanitize_text(model, max_length=80, preserve_newlines=False) or None
    try:
        if mock:
            _reject_mock_ocr()
            image_bytes = await _read_image_upload_for_mock(file)
        else:
            image_bytes = await _read_validated_image_upload(file)
        if not preprocess_profile:
            preprocess_profile = os.getenv("LEDGER_SCAN_PREPROCESS_PROFILE")
        base64_image = preprocess_image_bytes(image_bytes, profile=preprocess_profile)
        rows, model_meta = ledger_extract_data(
            base64_image,
            force_mock=mock,
            model=requested_model,
            system_prompt=system_prompt,
            user_message=user_message,
        )
        validated = ledger_validate_data(rows)
        excel_bytes = ledger_build_excel_bytes(validated)
    except ValueError as error:
        logger.exception("LedgerScan JSON parsing failed.")
        refund_ocr_quota(db, org_id=resolve_org_id(current_user), user_id=current_user.id, reason="ocr_logbook_excel_validation")
        raise HTTPException(status_code=400, detail=str(error)) from error
    except AuthenticationError as error:
        logger.exception("LedgerScan authentication failed.")
        refund_ocr_quota(db, org_id=resolve_org_id(current_user), user_id=current_user.id, reason="ocr_logbook_excel_auth")
        raise HTTPException(status_code=401, detail="Structured OCR authentication failed.") from error
    except BadRequestError as error:
        logger.exception("LedgerScan request rejected by Anthropic.")
        refund_ocr_quota(db, org_id=resolve_org_id(current_user), user_id=current_user.id, reason="ocr_logbook_excel_bad_request")
        message = str(error)
        if "credit balance is too low" in message.lower():
            raise HTTPException(status_code=429, detail="Anthropic API credits are too low.") from error
        raise HTTPException(status_code=400, detail=message) from error
    except RuntimeError as error:
        logger.exception("LedgerScan configuration error.")
        refund_ocr_quota(db, org_id=resolve_org_id(current_user), user_id=current_user.id, reason="ocr_logbook_excel_runtime")
        raise HTTPException(status_code=500, detail=str(error)) from error
    except Exception as error:  # pylint: disable=broad-except
        logger.exception("LedgerScan OCR failed.")
        refund_ocr_quota(db, org_id=resolve_org_id(current_user), user_id=current_user.id, reason="ocr_logbook_excel_unexpected")
        raise HTTPException(status_code=500, detail="LedgerScan OCR failed unexpectedly.") from error

    metadata = validated.get("metadata", {})
    metadata = dict(metadata)
    metadata.update(model_meta)
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
        "X-Requested-Model": str(metadata.get("requested_model", requested_model or "")),
        "X-Model-Used": str(metadata.get("model_used", "")),
        "X-Input-Tokens": str((metadata.get("token_usage") or {}).get("input_tokens", 0)),
        "X-Output-Tokens": str((metadata.get("token_usage") or {}).get("output_tokens", 0)),
        "X-Total-Tokens": str((metadata.get("token_usage") or {}).get("total_tokens", 0)),
        "X-Estimated-Cost": str((metadata.get("token_usage") or {}).get("estimated_cost", 0)),
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


@router.post(
    "/logbook-excel-async",
    status_code=status.HTTP_202_ACCEPTED,
    dependencies=[Depends(require_active_subscription), Depends(require_ocr_quota)],
)
async def ocr_logbook_excel_async(
    file: UploadFile = File(...),
    mock: bool = Form(default=False),
    model: str | None = Form(default=None),
    system_prompt: str | None = Form(default=None),
    user_message: str | None = Form(default=None),
    preprocess_profile: str | None = Form(default=None),
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
) -> dict:
    _require_ocr_access(db, current_user)
    requested_model = sanitize_text(model, max_length=80, preserve_newlines=False) or None
    org_id = resolve_org_id(current_user)
    try:
        if mock:
            _reject_mock_ocr()
            image_bytes = await _read_image_upload_for_mock(file)
        else:
            image_bytes = await _read_validated_image_upload(file)
        if not preprocess_profile:
            preprocess_profile = os.getenv("LEDGER_SCAN_PREPROCESS_PROFILE")
        job = _queue_ocr_excel_job(
            mode="ledger",
            owner_id=current_user.id,
            org_id=org_id,
            factory_id=resolve_factory_id(db, current_user),
            source_filename=_safe_file_name(file.filename, "ledger-ocr-input.png"),
            content_type=file.content_type,
            size_bytes=len(image_bytes),
            mock=mock,
            requested_model=requested_model,
            system_prompt=system_prompt,
            user_message=user_message,
            preprocess_profile=preprocess_profile,
            image_bytes=image_bytes,
        )
    except Exception:
        refund_ocr_quota(db, org_id=org_id, user_id=current_user.id, reason="ocr_logbook_excel_async_failed")
        raise
    payload = dict(job)
    payload.update(_job_urls(str(job["job_id"])))
    return payload


@router.post(
    "/table-excel",
    status_code=status.HTTP_200_OK,
    dependencies=[Depends(require_active_subscription), Depends(require_ocr_quota)],
)
async def ocr_table_excel(
    file: UploadFile | None = File(default=None),
    image: UploadFile | None = File(default=None),
    model: str | None = Form(default=None),
    system_prompt: str | None = Form(default=None),
    user_message: str | None = Form(default=None),
    preprocess_profile: str | None = Form(default=None),
    request: Request = None,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
) -> Response:
    _require_ocr_access(db, current_user)
    del preprocess_profile
    requested_model = sanitize_text(model, max_length=80, preserve_newlines=False) or None
    try:
        upload, image_bytes = await _read_table_excel_upload(file, image)
    except TableExcelRouteError as error:
        refund_ocr_quota(db, org_id=resolve_org_id(current_user), user_id=current_user.id, reason="ocr_table_excel_upload_failed")
        return JSONResponse(status_code=error.status_code, content=error.payload)

    try:
        excel_bytes, metadata = _run_table_excel_pipeline(
            image_bytes,
            content_type=upload.content_type,
            filename=upload.filename,
            requested_model=requested_model,
            system_prompt=system_prompt,
            user_message=user_message,
        )
    except TableExcelRouteError as error:
        logger.warning("Table Excel OCR failed status=%s error=%s", error.status_code, error.payload.get("error"))
        refund_ocr_quota(db, org_id=resolve_org_id(current_user), user_id=current_user.id, reason="ocr_table_excel_pipeline_failed")
        return JSONResponse(status_code=error.status_code, content=error.payload)
    except Exception as error:  # pylint: disable=broad-except
        logger.exception("[OCR] Error: Table Excel OCR failed unexpectedly")
        refund_ocr_quota(db, org_id=resolve_org_id(current_user), user_id=current_user.id, reason="ocr_table_excel_unexpected")
        return JSONResponse(status_code=500, content={"error": f"Table Excel OCR failed: {error}"})

    headers = _table_excel_response_headers(metadata, filename="output.xlsx")
    if request is not None:
        safe_name = sanitize_text(upload.filename, max_length=200, preserve_newlines=False) or "unknown"
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


@router.post(
    "/table-excel-async",
    status_code=status.HTTP_202_ACCEPTED,
    dependencies=[Depends(require_active_subscription), Depends(require_ocr_quota)],
)
async def ocr_table_excel_async(
    file: UploadFile | None = File(default=None),
    image: UploadFile | None = File(default=None),
    model: str | None = Form(default=None),
    system_prompt: str | None = Form(default=None),
    user_message: str | None = Form(default=None),
    preprocess_profile: str | None = Form(default=None),
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
) -> dict:
    _require_ocr_access(db, current_user)
    del preprocess_profile
    requested_model = sanitize_text(model, max_length=80, preserve_newlines=False) or None
    try:
        upload, image_bytes = await _read_table_excel_upload(file, image)
        inspection = _inspect_table_excel_image(
            image_bytes,
            content_type=upload.content_type,
            filename=upload.filename,
        )
    except TableExcelRouteError as error:
        refund_ocr_quota(db, org_id=resolve_org_id(current_user), user_id=current_user.id, reason="ocr_table_excel_async_upload_failed")
        return JSONResponse(status_code=error.status_code, content=error.payload)
    if int(inspection["image_quality_score"]) < 30:
        refund_ocr_quota(db, org_id=resolve_org_id(current_user), user_id=current_user.id, reason="ocr_table_excel_async_quality_failed")
        return JSONResponse(
            status_code=400,
            content={
                "error": "Image too vague or low quality to process",
                "imageQualityScore": int(inspection["image_quality_score"]),
            },
        )
    org_id = resolve_org_id(current_user)
    try:
        job = _queue_ocr_excel_job(
            mode="table",
            owner_id=current_user.id,
            org_id=org_id,
            factory_id=resolve_factory_id(db, current_user),
            source_filename=_safe_file_name(upload.filename, "table-ocr-input.png"),
            content_type=upload.content_type,
            size_bytes=len(image_bytes),
            requested_model=requested_model,
            system_prompt=system_prompt,
            user_message=user_message,
            image_bytes=image_bytes,
        )
    except Exception:
        refund_ocr_quota(db, org_id=org_id, user_id=current_user.id, reason="ocr_table_excel_async_queue_failed")
        raise
    payload = dict(job)
    payload.update(_job_urls(str(job["job_id"])))
    return payload


@router.get(
    "/jobs/{job_id}",
    status_code=status.HTTP_200_OK,
    dependencies=[Depends(require_active_subscription)],
)
def get_ocr_job(
    job_id: str,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
) -> dict:
    from backend.authorization import PDP
    PDP(db=db).require_permission(actor=current_user, permission_key="ocr.job.view")
    payload = get_background_job(job_id, owner_id=current_user.id)
    if payload is None or not str(payload.get("kind", "")).startswith("ocr_"):
        raise HTTPException(status_code=404, detail="Job not found.")
    payload.update(_job_urls(job_id))
    return payload


@router.get(
    "/jobs/{job_id}/download",
    status_code=status.HTTP_200_OK,
    dependencies=[Depends(require_active_subscription)],
)
def download_ocr_job(
    job_id: str,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
) -> Response:
    from backend.authorization import PDP
    PDP(db=db).require_permission(actor=current_user, permission_key="ocr.job.view")
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
                "X-Image-Quality-Score": str((metadata or {}).get("image_quality_score", "")),
                "X-Model-Used": str((metadata or {}).get("model_used", "")),
            }
        )
    return Response(
        content=excel_bytes,
        media_type=str(file_meta.get("media_type") or "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet"),
        headers=headers,
    )
