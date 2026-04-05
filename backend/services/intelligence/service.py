"""Async orchestration service for Factory Intelligence Engine."""

from __future__ import annotations

import hashlib
import json
import logging
import os
import statistics
from datetime import datetime, timedelta, timezone
from pathlib import Path
from typing import Any
from uuid import uuid4

from sqlalchemy import func
from sqlalchemy.orm import Session

from backend.ai_rate_limit import RateLimitError, check_rate_limit
from backend.cache import build_cache_key, get_json, set_json
from backend.database import SessionLocal
from backend.models.intelligence_request import IntelligenceRequest
from backend.models.intelligence_stage_usage import IntelligenceStageUsage
from backend.models.user import User
from backend.services.background_jobs import (
    create_job,
    get_job,
    register_retry_handler,
    start_job,
    update_job,
    write_job_file,
)
from backend.services.intelligence.classifier import classify_document_task
from backend.services.intelligence.preprocessing import compute_document_hash, preprocess_document, validate_upload
from backend.services.intelligence.provider import invoke_stage_model
from backend.services.intelligence.routing import (
    escalation_chain,
    json_safe,
    select_model_for_classification,
    stage_starting_tier,
)
from backend.services.intelligence.schemas import ClassificationResult, OrchestrationResult, PreprocessedDocument, StageResult
from backend.tenancy import resolve_factory_id, resolve_org_id


logger = logging.getLogger(__name__)

INTELLIGENCE_CACHE_TTL = int(os.getenv("INTELLIGENCE_CACHE_TTL_SECONDS", str(60 * 60 * 12)))
INTELLIGENCE_RATE_LIMIT = int(os.getenv("INTELLIGENCE_REQUESTS_PER_MINUTE", "10"))
JOB_KIND = "factory_intelligence"


def _now() -> datetime:
    return datetime.now(timezone.utc)


def _safe_file_name(filename: str | None, fallback: str = "factory-intelligence-input.bin") -> str:
    if not filename:
        return fallback
    cleaned = "".join(char for char in filename if char.isalnum() or char in {"-", "_", ".", " "}).strip()
    return cleaned or fallback


def _document_cache_key(document_hash: str) -> str:
    return build_cache_key("intelligence", "document", document_hash)


def _prompt_cache_key(prompt_hash: str, stage_name: str, tier: str) -> str:
    return build_cache_key("intelligence", "prompt", stage_name, tier, prompt_hash)


def _compute_prompt_hash(stage_name: str, tier: str, prompt: str) -> str:
    return hashlib.sha256(f"{stage_name}|{tier}|{prompt}".encode("utf-8")).hexdigest()


def _score_structured_payload(payload: dict[str, Any], *, extracted_fields: dict[str, Any]) -> float:
    score = 52.0
    if payload.get("structured_fields"):
        score += 12.0
    if payload.get("document_type"):
        score += 6.0
    if payload.get("operator_mapping"):
        score += 8.0
    if payload.get("normalized_entries"):
        score += 10.0
    if extracted_fields.get("primary_quantity") is not None:
        score += 6.0
    if payload.get("warnings"):
        score -= min(10.0, float(len(payload.get("warnings", []))) * 2.0)
    return max(0.0, min(99.0, score))


def _score_validation_payload(payload: dict[str, Any]) -> float:
    score = 60.0
    if payload.get("consistency") == "pass":
        score += 18.0
    if not payload.get("missing_fields"):
        score += 10.0
    score -= min(14.0, float(len(payload.get("issues", []))) * 3.0)
    return max(0.0, min(99.0, score))


def _score_anomaly_payload(payload: dict[str, Any]) -> float:
    score = 62.0
    score += min(12.0, float(len(payload.get("anomalies", []))) * 3.0)
    if payload.get("summary"):
        score += 6.0
    return max(0.0, min(99.0, score))


def _score_loss_payload(payload: dict[str, Any]) -> float:
    score = 64.0
    if payload.get("estimated_loss_inr") is not None:
        score += 14.0
    if payload.get("operator_mapping"):
        score += 8.0
    if payload.get("report_excerpt"):
        score += 6.0
    return max(0.0, min(99.0, score))


def _build_structuring_prompt(document: PreprocessedDocument) -> str:
    return (
        "You are Factory Intelligence Engine. "
        "Return ONLY valid JSON with keys: document_type, structured_fields, normalized_entries, operator_mapping, warnings. "
        "structured_fields must be a flat object. normalized_entries must be an array of row objects. "
        "Use the reduced context only and do not hallucinate missing values.\n\n"
        f"Reduced context:\n{document.reduced_text}"
    )


def _build_validation_prompt(document: PreprocessedDocument, structured: dict[str, Any]) -> str:
    return (
        "You are validating a factory document extraction. "
        "Return ONLY valid JSON with keys: consistency, missing_fields, issues, recommended_action. "
        "consistency must be pass, warning, or fail.\n\n"
        f"Reduced context:\n{document.reduced_text}\n\nStructured:\n{json.dumps(structured, ensure_ascii=True)}"
    )


def _build_anomaly_prompt(document: PreprocessedDocument, structured: dict[str, Any], validation: dict[str, Any]) -> str:
    return (
        "You are detecting anomalies in a factory document. "
        "Return ONLY valid JSON with keys: anomalies, summary, severity. "
        "anomalies must be an array of {type,message,impact}.\n\n"
        f"Reduced context:\n{document.reduced_text}\n\nStructured:\n{json.dumps(structured, ensure_ascii=True)}\n\nValidation:\n{json.dumps(validation, ensure_ascii=True)}"
    )


def _build_loss_prompt(document: PreprocessedDocument, structured: dict[str, Any], anomalies: dict[str, Any]) -> str:
    return (
        "You are estimating factory loss exposure. "
        "Return ONLY valid JSON with keys: estimated_loss_inr, basis, operator_mapping, report_excerpt. "
        "report_excerpt should be one short paragraph.\n\n"
        f"Reduced context:\n{document.reduced_text}\n\nStructured:\n{json.dumps(structured, ensure_ascii=True)}\n\nAnomalies:\n{json.dumps(anomalies, ensure_ascii=True)}"
    )


def _fallback_structuring(document: PreprocessedDocument) -> dict[str, Any]:
    structured_fields = dict(document.extracted_fields)
    structured_fields["source_filename"] = document.source_filename
    normalized_entries = []
    for row in document.ocr_rows[:20]:
        normalized_entries.append(
            {
                "raw": " | ".join(str(cell).strip() for cell in row if str(cell).strip()),
                "cells": [str(cell).strip() for cell in row if str(cell).strip()],
            }
        )
    return {
        "document_type": "factory_logbook" if document.document_kind == "image" else "factory_pdf",
        "structured_fields": structured_fields,
        "normalized_entries": normalized_entries,
        "operator_mapping": document.extracted_fields.get("operator_mapping", []),
        "warnings": document.warnings,
    }


def _fallback_validation(structured: dict[str, Any]) -> dict[str, Any]:
    missing_fields = []
    fields = structured.get("structured_fields") or {}
    for key in ("date", "operator_name", "primary_quantity"):
        if fields.get(key) in (None, "", []):
            missing_fields.append(key)
    issues = []
    if missing_fields:
        issues.append("Critical extraction fields are missing.")
    return {
        "consistency": "warning" if missing_fields else "pass",
        "missing_fields": missing_fields,
        "issues": issues,
        "recommended_action": "Review extracted fields before report generation." if missing_fields else "Ready for anomaly analysis.",
    }


def _fallback_anomalies(document: PreprocessedDocument, validation: dict[str, Any]) -> dict[str, Any]:
    anomalies: list[dict[str, Any]] = []
    if document.warnings:
        anomalies.append(
            {
                "type": "image_quality",
                "message": "Image quality warnings may reduce extraction reliability.",
                "impact": "medium",
            }
        )
    if validation.get("missing_fields"):
        anomalies.append(
            {
                "type": "missing_fields",
                "message": "Important operational fields are missing from the extracted document.",
                "impact": "high",
            }
        )
    if document.extracted_fields.get("totals_lines"):
        anomalies.append(
            {
                "type": "totals_reconciliation",
                "message": "Totals were detected and should be reconciled against line entries.",
                "impact": "medium",
            }
        )
    return {
        "anomalies": anomalies,
        "summary": "Rule-based anomaly screening completed.",
        "severity": "high" if any(item["impact"] == "high" for item in anomalies) else "medium" if anomalies else "low",
    }


def _fallback_loss(document: PreprocessedDocument, structured: dict[str, Any], anomalies: dict[str, Any]) -> dict[str, Any]:
    quantity = structured.get("structured_fields", {}).get("primary_quantity") or 0
    try:
        quantity_value = float(quantity)
    except Exception:
        quantity_value = 0.0
    anomaly_count = len(anomalies.get("anomalies", []))
    estimated_loss = round((quantity_value * 120.0) + (anomaly_count * 750.0) + (len(document.warnings) * 250.0), 2)
    return {
        "estimated_loss_inr": max(estimated_loss, 0.0),
        "basis": "Heuristic estimate using quantity, anomaly count, and image warnings.",
        "operator_mapping": structured.get("operator_mapping") or document.extracted_fields.get("operator_mapping", []),
        "report_excerpt": "Potential loss exposure was estimated from the extracted quantity, warning signals, and reconciliation risk detected in the document.",
    }


def _record_stage_usage(
    db: Session,
    *,
    request_row: IntelligenceRequest,
    stage_result: StageResult,
    task_kind: str,
    success: bool = True,
) -> None:
    db.add(
        IntelligenceStageUsage(
            intelligence_request_id=request_row.id,
            user_id=request_row.user_id,
            org_id=request_row.org_id,
            factory_id=request_row.factory_id,
            stage_name=stage_result.stage_name,
            task_kind=task_kind,
            model_tier=stage_result.model_tier,
            model_name=stage_result.model_name,
            provider=stage_result.provider,
            prompt_hash=stage_result.prompt_hash,
            prompt_tokens=stage_result.prompt_tokens,
            completion_tokens=stage_result.completion_tokens,
            total_tokens=stage_result.total_tokens,
            estimated_cost_usd=stage_result.estimated_cost_usd,
            latency_ms=stage_result.latency_ms,
            cache_hit=stage_result.cache_hit,
            success=success,
            metadata_json=json_safe({"warnings": stage_result.warnings}),
            error_message=None if success else "; ".join(stage_result.warnings),
        )
    )


def _update_request_row(
    request_row: IntelligenceRequest,
    *,
    status: str | None = None,
    task_classification: str | None = None,
    selected_model_tier: str | None = None,
    final_model_tier: str | None = None,
    confidence_score: float | None = None,
    pipeline_state: dict[str, Any] | None = None,
    normalized_result: dict[str, Any] | None = None,
    total_tokens: int | None = None,
    total_cost_usd: float | None = None,
    cached_result: bool | None = None,
    error_message: str | None = None,
) -> None:
    if status is not None:
        request_row.status = status
    if task_classification is not None:
        request_row.task_classification = task_classification
    if selected_model_tier is not None:
        request_row.selected_model_tier = selected_model_tier
    if final_model_tier is not None:
        request_row.final_model_tier = final_model_tier
    if confidence_score is not None:
        request_row.confidence_score = confidence_score
    if pipeline_state is not None:
        request_row.pipeline_state = json_safe(pipeline_state)
    if normalized_result is not None:
        request_row.normalized_result = json_safe(normalized_result)
    if total_tokens is not None:
        request_row.total_tokens = total_tokens
    if total_cost_usd is not None:
        request_row.total_cost_usd = total_cost_usd
    if cached_result is not None:
        request_row.cached_result = cached_result
    request_row.error_message = error_message
    request_row.updated_at = _now()


def _run_stage_with_escalation(
    *,
    request_row: IntelligenceRequest,
    db: Session,
    document: PreprocessedDocument,
    stage_name: str,
    initial_tier: str,
    provider_chain: list[str],
    prompt_builder,
    fallback_builder,
    confidence_scorer,
    cache_payload: dict[str, Any],
) -> StageResult:
    last_stage_result: StageResult | None = None
    for tier in escalation_chain(initial_tier):
        prompt = prompt_builder()
        prompt_hash = _compute_prompt_hash(stage_name, tier, prompt)
        cache_key = _prompt_cache_key(prompt_hash, stage_name, tier)
        cached = get_json(cache_key)
        if isinstance(cached, dict) and cached.get("payload"):
            stage_result = StageResult(
                stage_name=stage_name,
                payload=dict(cached["payload"]),
                confidence=float(cached.get("confidence", 0.0)),
                model_tier=tier,
                model_name=str(cached.get("model_name") or "cache"),
                provider=str(cached.get("provider") or "cache"),
                prompt_hash=prompt_hash,
                prompt_tokens=int(cached.get("prompt_tokens") or 0),
                completion_tokens=int(cached.get("completion_tokens") or 0),
                total_tokens=int(cached.get("total_tokens") or 0),
                estimated_cost_usd=float(cached.get("estimated_cost_usd") or 0.0),
                latency_ms=int(cached.get("latency_ms") or 0),
                cache_hit=True,
                warnings=list(cached.get("warnings") or []),
            )
        else:
            stage_result = invoke_stage_model(
                stage_name=stage_name,
                prompt=prompt,
                tier=tier,
                provider_chain=provider_chain,
                prompt_hash=prompt_hash,
                fallback_builder=fallback_builder,
            )
            stage_result.confidence = confidence_scorer(stage_result.payload)
            set_json(
                cache_key,
                {
                    "payload": json_safe(stage_result.payload),
                    "confidence": stage_result.confidence,
                    "model_name": stage_result.model_name,
                    "provider": stage_result.provider,
                    "prompt_tokens": stage_result.prompt_tokens,
                    "completion_tokens": stage_result.completion_tokens,
                    "total_tokens": stage_result.total_tokens,
                    "estimated_cost_usd": stage_result.estimated_cost_usd,
                    "latency_ms": stage_result.latency_ms,
                    "warnings": stage_result.warnings,
                    "cache_payload": cache_payload,
                },
                INTELLIGENCE_CACHE_TTL,
            )

        _record_stage_usage(db, request_row=request_row, stage_result=stage_result, task_kind=stage_name)
        last_stage_result = stage_result
        if stage_result.confidence >= 85.0 or tier == "opus":
            return stage_result
    if last_stage_result is None:
        raise RuntimeError(f"No stage result produced for {stage_name}.")
    return last_stage_result


def _build_pipeline_result(
    *,
    request_row: IntelligenceRequest,
    document: PreprocessedDocument,
    classification: ClassificationResult,
    structured_stage: StageResult,
    validation_stage: StageResult,
    anomaly_stage: StageResult,
    loss_stage: StageResult,
) -> OrchestrationResult:
    final_confidence = round(
        statistics.mean(
            [
                structured_stage.confidence,
                validation_stage.confidence,
                anomaly_stage.confidence,
                loss_stage.confidence,
            ]
        ),
        2,
    )
    pipeline_state = {
        "ocr_extraction": {
            "warnings": document.warnings,
            "row_count": len(document.ocr_rows),
            "document_kind": document.document_kind,
            "metadata": json_safe(document.metadata),
        },
        "data_structuring": {
            "confidence": structured_stage.confidence,
            "model_tier": structured_stage.model_tier,
            "provider": structured_stage.provider,
        },
        "validation": {
            "confidence": validation_stage.confidence,
            "issues": validation_stage.payload.get("issues", []),
        },
        "anomaly_detection": {
            "confidence": anomaly_stage.confidence,
            "summary": anomaly_stage.payload.get("summary"),
            "severity": anomaly_stage.payload.get("severity"),
        },
        "loss_estimation": {
            "confidence": loss_stage.confidence,
            "estimated_loss_inr": loss_stage.payload.get("estimated_loss_inr"),
        },
    }
    normalized_result = {
        "request_id": request_row.request_id,
        "document": {
            "hash": document.document_hash,
            "source_filename": document.source_filename,
            "content_type": document.content_type,
            "kind": document.document_kind,
            "size_bytes": document.size_bytes,
        },
        "preprocessing": {
            "warnings": document.warnings,
            "segments": json_safe(document.segments),
            "extracted_fields": json_safe(document.extracted_fields),
        },
        "structured_extraction": json_safe(structured_stage.payload),
        "validation": json_safe(validation_stage.payload),
        "anomalies": json_safe(anomaly_stage.payload),
        "loss_estimation": json_safe(loss_stage.payload),
        "operator_mapping": loss_stage.payload.get("operator_mapping")
        or structured_stage.payload.get("operator_mapping")
        or document.extracted_fields.get("operator_mapping", []),
        "report": {
            "summary": loss_stage.payload.get("report_excerpt"),
            "generated_at": _now().isoformat(),
        },
    }
    total_tokens = (
        structured_stage.total_tokens
        + validation_stage.total_tokens
        + anomaly_stage.total_tokens
        + loss_stage.total_tokens
    )
    total_cost = round(
        structured_stage.estimated_cost_usd
        + validation_stage.estimated_cost_usd
        + anomaly_stage.estimated_cost_usd
        + loss_stage.estimated_cost_usd,
        6,
    )
    return OrchestrationResult(
        request_id=request_row.request_id,
        job_id=request_row.job_id or "",
        task_classification=classification.complexity,
        selected_model_tier=request_row.selected_model_tier or "haiku",
        final_model_tier=loss_stage.model_tier,
        confidence_score=final_confidence,
        cached_result=False,
        document_hash=document.document_hash,
        pipeline_state=pipeline_state,
        normalized_result=normalized_result,
        total_tokens=total_tokens,
        total_cost_usd=total_cost,
    )

def _serialize_stage_usage(row: IntelligenceStageUsage) -> dict[str, Any]:
    return {
        "id": row.id,
        "stage_name": row.stage_name,
        "task_kind": row.task_kind,
        "model_tier": row.model_tier,
        "model_name": row.model_name,
        "provider": row.provider,
        "prompt_hash": row.prompt_hash,
        "prompt_tokens": row.prompt_tokens,
        "completion_tokens": row.completion_tokens,
        "total_tokens": row.total_tokens,
        "estimated_cost_usd": row.estimated_cost_usd,
        "latency_ms": row.latency_ms,
        "cache_hit": row.cache_hit,
        "success": row.success,
        "metadata": row.metadata_json,
        "error_message": row.error_message,
        "created_at": row.created_at.isoformat(),
    }


def _serialize_request_row(
    request_row: IntelligenceRequest,
    *,
    include_result: bool = False,
    include_stage_usage: bool = False,
    include_job: bool = False,
) -> dict[str, Any]:
    normalized_result = request_row.normalized_result if isinstance(request_row.normalized_result, dict) else {}
    anomalies_payload = normalized_result.get("anomalies") if isinstance(normalized_result, dict) else {}
    loss_payload = normalized_result.get("loss_estimation") if isinstance(normalized_result, dict) else {}
    anomaly_count = len(anomalies_payload.get("anomalies", [])) if isinstance(anomalies_payload, dict) else 0
    estimated_loss = loss_payload.get("estimated_loss_inr") if isinstance(loss_payload, dict) else None
    payload: dict[str, Any] = {
        "request_id": request_row.request_id,
        "job_id": request_row.job_id,
        "status": request_row.status,
        "source_filename": request_row.source_filename,
        "content_type": request_row.content_type,
        "size_bytes": request_row.size_bytes,
        "document_hash": request_row.document_hash,
        "task_classification": request_row.task_classification,
        "selected_model_tier": request_row.selected_model_tier,
        "final_model_tier": request_row.final_model_tier,
        "confidence_score": request_row.confidence_score,
        "total_tokens": request_row.total_tokens,
        "total_cost_usd": request_row.total_cost_usd,
        "cached_result": request_row.cached_result,
        "error_message": request_row.error_message,
        "created_at": request_row.created_at.isoformat(),
        "updated_at": request_row.updated_at.isoformat(),
        "insight_summary": {
            "estimated_loss_inr": estimated_loss,
            "anomaly_count": anomaly_count,
        },
    }
    if include_result:
        payload["pipeline_state"] = json_safe(request_row.pipeline_state or {})
        payload["normalized_result"] = json_safe(normalized_result)
    if include_stage_usage:
        usage_rows = sorted(request_row.stage_usage, key=lambda row: row.created_at)
        payload["stage_usage"] = [_serialize_stage_usage(row) for row in usage_rows]
    if include_job and request_row.job_id:
        payload["job"] = get_job(request_row.job_id, owner_id=request_row.user_id)
    return payload


def _cached_orchestration_payload(
    request_row: IntelligenceRequest,
    cached_payload: dict[str, Any],
) -> dict[str, Any]:
    normalized_result = json.loads(json.dumps(cached_payload.get("normalized_result") or {}))
    pipeline_state = json.loads(json.dumps(cached_payload.get("pipeline_state") or {}))
    if not isinstance(normalized_result, dict):
        normalized_result = {}
    if not isinstance(pipeline_state, dict):
        pipeline_state = {}
    normalized_result["request_id"] = request_row.request_id
    document_meta = normalized_result.get("document")
    if not isinstance(document_meta, dict):
        document_meta = {}
        normalized_result["document"] = document_meta
    document_meta["hash"] = request_row.document_hash
    document_meta["source_filename"] = request_row.source_filename
    document_meta["content_type"] = request_row.content_type
    document_meta["size_bytes"] = request_row.size_bytes
    return {
        "request_id": request_row.request_id,
        "job_id": request_row.job_id,
        "task_classification": str(cached_payload.get("task_classification") or request_row.task_classification or "simple"),
        "selected_model_tier": str(cached_payload.get("selected_model_tier") or request_row.selected_model_tier or "haiku"),
        "final_model_tier": str(cached_payload.get("final_model_tier") or request_row.final_model_tier or "haiku"),
        "confidence_score": float(cached_payload.get("confidence_score") or 0.0),
        "cached_result": True,
        "document_hash": request_row.document_hash,
        "pipeline_state": pipeline_state,
        "normalized_result": normalized_result,
        "total_tokens": int(cached_payload.get("total_tokens") or 0),
        "total_cost_usd": float(cached_payload.get("total_cost_usd") or 0.0),
    }


def _create_request_record(
    db: Session,
    *,
    request_id: str,
    job_id: str,
    current_user: User,
    org_id: str | None,
    factory_id: str | None,
    source_filename: str,
    content_type: str,
    size_bytes: int,
    document_hash: str,
    cache_key: str,
    source_file_path: str,
) -> IntelligenceRequest:
    row = IntelligenceRequest(
        request_id=request_id,
        job_id=job_id,
        org_id=org_id,
        factory_id=factory_id,
        user_id=current_user.id,
        source_filename=source_filename,
        content_type=content_type,
        size_bytes=size_bytes,
        document_hash=document_hash,
        cache_key=cache_key,
        source_file_path=source_file_path,
        status="queued",
        cached_result=False,
    )
    db.add(row)
    db.commit()
    db.refresh(row)
    return row


def _process_request_job(request_id: str, *, progress) -> dict[str, Any]:
    db = SessionLocal()
    try:
        request_row = db.query(IntelligenceRequest).filter(IntelligenceRequest.request_id == request_id).first()
        if request_row is None:
            raise LookupError("Factory Intelligence request was not found.")
        if not request_row.source_file_path:
            raise FileNotFoundError("Uploaded source file is missing.")

        source_path = Path(request_row.source_file_path)
        if not source_path.exists():
            raise FileNotFoundError("Uploaded source file is missing from storage.")

        progress(10, "Loading document")
        file_bytes = source_path.read_bytes()
        cache_key = request_row.cache_key or _document_cache_key(request_row.document_hash)
        cached_payload = get_json(cache_key)
        if isinstance(cached_payload, dict) and cached_payload.get("normalized_result"):
            cache_result = _cached_orchestration_payload(request_row, cached_payload)
            _update_request_row(
                request_row,
                status="succeeded",
                task_classification=str(cache_result["task_classification"]),
                selected_model_tier=str(cache_result["selected_model_tier"]),
                final_model_tier=str(cache_result["final_model_tier"]),
                confidence_score=float(cache_result["confidence_score"]),
                pipeline_state=dict(cache_result["pipeline_state"]),
                normalized_result=dict(cache_result["normalized_result"]),
                total_tokens=int(cache_result["total_tokens"]),
                total_cost_usd=float(cache_result["total_cost_usd"]),
                cached_result=True,
                error_message=None,
            )
            db.commit()
            progress(100, "Completed from cache")
            return cache_result

        progress(22, "Preprocessing document")
        document = preprocess_document(
            request_id=request_row.request_id,
            source_filename=request_row.source_filename or "factory-intelligence-input.bin",
            content_type=request_row.content_type or "application/octet-stream",
            file_bytes=file_bytes,
        )
        classification = classify_document_task(document)
        selection = select_model_for_classification(classification)
        _update_request_row(
            request_row,
            status="running",
            task_classification=classification.complexity,
            selected_model_tier=selection.tier,
            cached_result=False,
            error_message=None,
        )
        db.commit()

        structured_stage = _run_stage_with_escalation(
            request_row=request_row,
            db=db,
            document=document,
            stage_name="data_structuring",
            initial_tier=stage_starting_tier("data_structuring", selection.tier),
            provider_chain=list(selection.provider_chain),
            prompt_builder=lambda: _build_structuring_prompt(document),
            fallback_builder=lambda: _fallback_structuring(document),
            confidence_scorer=lambda payload: _score_structured_payload(payload, extracted_fields=document.extracted_fields),
            cache_payload={"document_hash": document.document_hash, "stage": "data_structuring"},
        )
        db.commit()
        progress(42, "Structured extraction complete")

        validation_stage = _run_stage_with_escalation(
            request_row=request_row,
            db=db,
            document=document,
            stage_name="validation",
            initial_tier=stage_starting_tier("validation", selection.tier),
            provider_chain=list(selection.provider_chain),
            prompt_builder=lambda: _build_validation_prompt(document, structured_stage.payload),
            fallback_builder=lambda: _fallback_validation(structured_stage.payload),
            confidence_scorer=_score_validation_payload,
            cache_payload={"document_hash": document.document_hash, "stage": "validation"},
        )
        db.commit()
        progress(60, "Validation complete")

        anomaly_stage = _run_stage_with_escalation(
            request_row=request_row,
            db=db,
            document=document,
            stage_name="anomaly_detection",
            initial_tier=stage_starting_tier("anomaly_detection", selection.tier),
            provider_chain=list(selection.provider_chain),
            prompt_builder=lambda: _build_anomaly_prompt(document, structured_stage.payload, validation_stage.payload),
            fallback_builder=lambda: _fallback_anomalies(document, validation_stage.payload),
            confidence_scorer=_score_anomaly_payload,
            cache_payload={"document_hash": document.document_hash, "stage": "anomaly_detection"},
        )
        db.commit()
        progress(78, "Anomaly analysis complete")

        loss_stage = _run_stage_with_escalation(
            request_row=request_row,
            db=db,
            document=document,
            stage_name="loss_estimation",
            initial_tier=stage_starting_tier("loss_estimation", selection.tier),
            provider_chain=list(selection.provider_chain),
            prompt_builder=lambda: _build_loss_prompt(document, structured_stage.payload, anomaly_stage.payload),
            fallback_builder=lambda: _fallback_loss(document, structured_stage.payload, anomaly_stage.payload),
            confidence_scorer=_score_loss_payload,
            cache_payload={"document_hash": document.document_hash, "stage": "loss_estimation"},
        )
        db.commit()
        progress(92, "Loss estimation complete")

        orchestration_result = _build_pipeline_result(
            request_row=request_row,
            document=document,
            classification=classification,
            structured_stage=structured_stage,
            validation_stage=validation_stage,
            anomaly_stage=anomaly_stage,
            loss_stage=loss_stage,
        )
        cache_result = {
            "task_classification": orchestration_result.task_classification,
            "selected_model_tier": orchestration_result.selected_model_tier,
            "final_model_tier": orchestration_result.final_model_tier,
            "confidence_score": orchestration_result.confidence_score,
            "pipeline_state": json_safe(orchestration_result.pipeline_state),
            "normalized_result": json_safe(orchestration_result.normalized_result),
            "total_tokens": orchestration_result.total_tokens,
            "total_cost_usd": orchestration_result.total_cost_usd,
        }
        set_json(cache_key, cache_result, INTELLIGENCE_CACHE_TTL)
        _update_request_row(
            request_row,
            status="succeeded",
            task_classification=orchestration_result.task_classification,
            selected_model_tier=orchestration_result.selected_model_tier,
            final_model_tier=orchestration_result.final_model_tier,
            confidence_score=orchestration_result.confidence_score,
            pipeline_state=orchestration_result.pipeline_state,
            normalized_result=orchestration_result.normalized_result,
            total_tokens=orchestration_result.total_tokens,
            total_cost_usd=orchestration_result.total_cost_usd,
            cached_result=False,
            error_message=None,
        )
        db.commit()
        progress(100, "Factory Intelligence complete")
        return {
            "request_id": orchestration_result.request_id,
            "job_id": orchestration_result.job_id,
            "task_classification": orchestration_result.task_classification,
            "selected_model_tier": orchestration_result.selected_model_tier,
            "final_model_tier": orchestration_result.final_model_tier,
            "confidence_score": orchestration_result.confidence_score,
            "cached_result": orchestration_result.cached_result,
            "document_hash": orchestration_result.document_hash,
            "pipeline_state": orchestration_result.pipeline_state,
            "normalized_result": orchestration_result.normalized_result,
            "total_tokens": orchestration_result.total_tokens,
            "total_cost_usd": orchestration_result.total_cost_usd,
        }
    except Exception as error:  # pylint: disable=broad-except
        logger.exception("Factory Intelligence job failed request_id=%s", request_id)
        request_row = db.query(IntelligenceRequest).filter(IntelligenceRequest.request_id == request_id).first()
        if request_row is not None:
            _update_request_row(request_row, status="failed", error_message=str(error))
            db.commit()
        raise
    finally:
        db.close()


_retry_handler_registered = False


def _register_retry_handler() -> None:
    global _retry_handler_registered
    if _retry_handler_registered:
        return

    def _retry_handler(retry_context: dict[str, Any], _previous_job: dict[str, Any]) -> dict[str, Any]:
        file_path = Path(str(retry_context.get("source_file_path") or ""))
        if not file_path.exists():
            raise FileNotFoundError("Retry source file is missing.")
        file_bytes = file_path.read_bytes()
        db = SessionLocal()
        try:
            user = db.query(User).filter(User.id == int(retry_context["user_id"])).first()
            if user is None:
                raise LookupError("Retry user is unavailable.")
            return enqueue_intelligence_request(
                db=db,
                current_user=user,
                filename=str(retry_context.get("source_filename") or file_path.name),
                content_type=str(retry_context.get("content_type") or "application/octet-stream"),
                file_bytes=file_bytes,
                enforce_rate_limit=False,
            )
        finally:
            db.close()

    register_retry_handler(JOB_KIND, _retry_handler)
    _retry_handler_registered = True


def enqueue_intelligence_request(
    *,
    db: Session,
    current_user: User,
    filename: str,
    content_type: str,
    file_bytes: bytes,
    enforce_rate_limit: bool = True,
) -> dict[str, Any]:
    validate_upload(filename=filename, content_type=content_type, size_bytes=len(file_bytes))
    if enforce_rate_limit:
        check_rate_limit(current_user.id, feature="factory_intelligence", limit=INTELLIGENCE_RATE_LIMIT)
    _register_retry_handler()

    request_id = uuid4().hex
    safe_name = _safe_file_name(filename)
    document_hash = compute_document_hash(file_bytes)
    cache_key = _document_cache_key(document_hash)
    org_id = resolve_org_id(current_user)
    factory_id = resolve_factory_id(db, current_user)
    cached_payload = get_json(cache_key)

    job = create_job(
        kind=JOB_KIND,
        owner_id=current_user.id,
        org_id=org_id,
        message="Queued for Factory Intelligence processing",
        context={
            "request_id": request_id,
            "source_filename": safe_name,
            "content_type": content_type,
            "document_hash": document_hash,
            "factory_id": factory_id,
            "cache_available": bool(isinstance(cached_payload, dict) and cached_payload.get("normalized_result")),
        },
    )
    file_meta = write_job_file(
        job["job_id"],
        filename=safe_name,
        content=file_bytes,
        media_type=content_type,
    )
    _create_request_record(
        db,
        request_id=request_id,
        job_id=str(job["job_id"]),
        current_user=current_user,
        org_id=org_id,
        factory_id=factory_id,
        source_filename=safe_name,
        content_type=content_type,
        size_bytes=len(file_bytes),
        document_hash=document_hash,
        cache_key=cache_key,
        source_file_path=str(file_meta["stored_path"]),
    )
    retry_context = {
        "request_id": request_id,
        "user_id": current_user.id,
        "org_id": org_id,
        "factory_id": factory_id,
        "source_filename": safe_name,
        "content_type": content_type,
        "source_file_path": str(file_meta["stored_path"]),
        "document_hash": document_hash,
    }
    update_job(
        str(job["job_id"]),
        context={
            **dict(job.get("context") or {}),
            "request_id": request_id,
            "file": file_meta,
        },
        retry_context=retry_context,
    )
    start_job(str(job["job_id"]), lambda progress: _process_request_job(request_id, progress=progress))
    return {
        "request_id": request_id,
        "job_id": str(job["job_id"]),
        "status": "queued",
        "message": "Processing started",
        "cached_result_available": bool(isinstance(cached_payload, dict) and cached_payload.get("normalized_result")),
    }


def get_intelligence_request_payload(
    *,
    db: Session,
    current_user: User,
    request_id: str,
) -> dict[str, Any] | None:
    row = (
        db.query(IntelligenceRequest)
        .filter(
            IntelligenceRequest.request_id == request_id,
            IntelligenceRequest.user_id == current_user.id,
        )
        .first()
    )
    if row is None:
        return None
    return _serialize_request_row(row, include_result=True, include_stage_usage=True, include_job=True)


def list_intelligence_requests(
    *,
    db: Session,
    current_user: User,
    limit: int = 20,
) -> list[dict[str, Any]]:
    rows = (
        db.query(IntelligenceRequest)
        .filter(IntelligenceRequest.user_id == current_user.id)
        .order_by(IntelligenceRequest.created_at.desc())
        .limit(max(1, min(limit, 50)))
        .all()
    )
    return [_serialize_request_row(row) for row in rows]


def summarize_user_intelligence_usage(
    *,
    db: Session,
    current_user: User,
    days: int = 30,
) -> dict[str, Any]:
    window_days = max(1, min(days, 365))
    cutoff = _now() - timedelta(days=window_days)
    request_query = db.query(IntelligenceRequest).filter(
        IntelligenceRequest.user_id == current_user.id,
        IntelligenceRequest.created_at >= cutoff,
    )
    total_requests = request_query.count()
    completed_requests = request_query.filter(IntelligenceRequest.status == "succeeded").count()
    cached_requests = request_query.filter(IntelligenceRequest.cached_result.is_(True)).count()
    total_tokens = int(
        db.query(func.coalesce(func.sum(IntelligenceStageUsage.total_tokens), 0))
        .filter(
            IntelligenceStageUsage.user_id == current_user.id,
            IntelligenceStageUsage.created_at >= cutoff,
        )
        .scalar()
        or 0
    )
    total_cost = round(
        float(
            db.query(func.coalesce(func.sum(IntelligenceStageUsage.estimated_cost_usd), 0.0))
            .filter(
                IntelligenceStageUsage.user_id == current_user.id,
                IntelligenceStageUsage.created_at >= cutoff,
            )
            .scalar()
            or 0.0
        ),
        6,
    )
    model_usage_rows = (
        db.query(
            IntelligenceStageUsage.model_tier,
            func.count(IntelligenceStageUsage.id),
            func.coalesce(func.sum(IntelligenceStageUsage.total_tokens), 0),
            func.coalesce(func.sum(IntelligenceStageUsage.estimated_cost_usd), 0.0),
        )
        .filter(
            IntelligenceStageUsage.user_id == current_user.id,
            IntelligenceStageUsage.created_at >= cutoff,
        )
        .group_by(IntelligenceStageUsage.model_tier)
        .all()
    )
    provider_usage_rows = (
        db.query(
            IntelligenceStageUsage.provider,
            func.count(IntelligenceStageUsage.id),
            func.coalesce(func.sum(IntelligenceStageUsage.estimated_cost_usd), 0.0),
        )
        .filter(
            IntelligenceStageUsage.user_id == current_user.id,
            IntelligenceStageUsage.created_at >= cutoff,
        )
        .group_by(IntelligenceStageUsage.provider)
        .all()
    )
    stage_usage_rows = (
        db.query(
            IntelligenceStageUsage.stage_name,
            func.count(IntelligenceStageUsage.id),
            func.coalesce(func.avg(IntelligenceStageUsage.latency_ms), 0.0),
        )
        .filter(
            IntelligenceStageUsage.user_id == current_user.id,
            IntelligenceStageUsage.created_at >= cutoff,
        )
        .group_by(IntelligenceStageUsage.stage_name)
        .all()
    )
    return {
        "user_id": current_user.id,
        "window_days": window_days,
        "total_requests": total_requests,
        "completed_requests": completed_requests,
        "cached_requests": cached_requests,
        "tokens_used": total_tokens,
        "cost_usd": total_cost,
        "average_cost_per_request_usd": round(total_cost / total_requests, 6) if total_requests else 0.0,
        "model_usage": [
            {
                "model_tier": row[0] or "unknown",
                "stage_calls": int(row[1] or 0),
                "tokens": int(row[2] or 0),
                "cost_usd": round(float(row[3] or 0.0), 6),
            }
            for row in model_usage_rows
        ],
        "provider_usage": [
            {
                "provider": row[0] or "unknown",
                "stage_calls": int(row[1] or 0),
                "cost_usd": round(float(row[2] or 0.0), 6),
            }
            for row in provider_usage_rows
        ],
        "stage_usage": [
            {
                "stage_name": row[0] or "unknown",
                "stage_calls": int(row[1] or 0),
                "average_latency_ms": int(float(row[2] or 0.0)),
            }
            for row in stage_usage_rows
        ],
    }
