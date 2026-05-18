"""DB-backed AI result cache with silent miss behavior."""

from __future__ import annotations

import hashlib
from dataclasses import asdict
from datetime import datetime, timedelta, timezone

from sqlalchemy.orm import Session

from backend.ai.models.results import AIResult, OCRResult
from backend.ai.providers.base import RawAIResponse, TokenUsage
from backend.models.ai_result_cache import AIResultCache


class AIResultCacheStore:
    def __init__(self, db: Session) -> None:
        self.db = db

    @staticmethod
    def build_cache_key(
        *,
        org_id: str,
        document_content: str,
        prompt_name: str,
        prompt_version: str,
    ) -> str:
        document_hash = hashlib.sha256(document_content.encode("utf-8")).hexdigest()
        return hashlib.sha256(
            f"{org_id}:{document_hash}:{prompt_name}:{prompt_version}".encode("utf-8")
        ).hexdigest()

    def get(
        self,
        *,
        org_id: str,
        document_content: str,
        prompt_name: str,
        prompt_version: str,
    ) -> OCRResult | None:
        try:
            cache_key = self.build_cache_key(
                org_id=org_id,
                document_content=document_content,
                prompt_name=prompt_name,
                prompt_version=prompt_version,
            )
            row = (
                self.db.query(AIResultCache)
                .filter(
                    AIResultCache.org_id == org_id,
                    AIResultCache.cache_key == cache_key,
                    AIResultCache.prompt_name == prompt_name,
                    AIResultCache.prompt_version == prompt_version,
                    AIResultCache.expires_at > datetime.now(timezone.utc),
                )
                .order_by(AIResultCache.created_at.desc(), AIResultCache.id.desc())
                .first()
            )
            if row is None:
                return None
            return self._deserialize_ocr_result(row.result_json)
        except Exception:
            return None

    def set(
        self,
        *,
        org_id: str,
        document_content: str,
        prompt_name: str,
        prompt_version: str,
        result: AIResult,
        ttl_seconds: int,
    ) -> None:
        try:
            cache_key = self.build_cache_key(
                org_id=org_id,
                document_content=document_content,
                prompt_name=prompt_name,
                prompt_version=prompt_version,
            )
            payload = self._serialize_result(result)
            expires_at = datetime.now(timezone.utc) + timedelta(seconds=ttl_seconds)
            row = (
                self.db.query(AIResultCache)
                .filter(AIResultCache.org_id == org_id, AIResultCache.cache_key == cache_key)
                .first()
            )
            if row is None:
                row = AIResultCache(
                    org_id=org_id,
                    cache_key=cache_key,
                    prompt_name=prompt_name,
                    prompt_version=prompt_version,
                    result_json=payload,
                    expires_at=expires_at,
                )
                self.db.add(row)
            else:
                row.result_json = payload
                row.prompt_name = prompt_name
                row.prompt_version = prompt_version
                row.expires_at = expires_at
            self.db.flush()
        except Exception:
            self.db.rollback()

    @staticmethod
    def _serialize_result(result: AIResult) -> dict:
        payload = asdict(result)
        raw_response = payload.get("raw_response")
        if raw_response is not None:
            payload["raw_response"] = raw_response
        return payload

    @staticmethod
    def _deserialize_ocr_result(payload: dict) -> OCRResult:
        raw_response_payload = payload.get("raw_response")
        raw_response = None
        if raw_response_payload is not None:
            usage_payload = raw_response_payload.get("usage") or {}
            raw_response = RawAIResponse(
                content=raw_response_payload.get("content"),
                usage=TokenUsage(
                    input_tokens=int(usage_payload.get("input_tokens") or 0),
                    output_tokens=int(usage_payload.get("output_tokens") or 0),
                    total_tokens=int(usage_payload.get("total_tokens") or 0),
                    estimated_cost_usd=float(usage_payload.get("estimated_cost_usd") or 0.0),
                ),
                provider=str(raw_response_payload.get("provider") or ""),
                model=str(raw_response_payload.get("model") or ""),
                latency_ms=int(raw_response_payload.get("latency_ms") or 0),
                error=raw_response_payload.get("error"),
                status_code=raw_response_payload.get("status_code"),
                retryable=bool(raw_response_payload.get("retryable")),
                retry_count=int(raw_response_payload.get("retry_count") or 0),
                metadata=dict(raw_response_payload.get("metadata") or {}),
            )
        return OCRResult(
            success=bool(payload.get("success")),
            raw_response=raw_response,
            validated_output=payload.get("validated_output"),
            error_message=payload.get("error_message"),
            validation_errors=list(payload.get("validation_errors") or []),
            retry_count=int(payload.get("retry_count") or 0),
            total_latency_ms=int(payload.get("total_latency_ms") or 0),
            extracted_fields=payload.get("extracted_fields"),
            confidence_score=payload.get("confidence_score"),
            partial_extraction=bool(payload.get("partial_extraction")),
        )
