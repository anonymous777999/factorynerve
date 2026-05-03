"""Strict OCR orchestrator for structured document extraction."""

from __future__ import annotations

import base64
import hashlib
import io
import json
import logging
import os
import re
import threading
import time
from collections import defaultdict
from datetime import datetime, timezone
from typing import Any

import numpy as np
from PIL import Image, UnidentifiedImageError
from sqlalchemy.orm import Session

from backend import ocr_utils as ocr_helpers
from backend.models.ocr_template import OcrTemplate
from backend.models.ocr_verification import OcrVerification
from backend.ocr_utils import OcrResult, extract_table_from_image as extract_local_table_from_image
from backend.services.ocr_normalization import extract_json_candidate, normalize_structured_payload


logger = logging.getLogger(__name__)

MODEL_TESSERACT = "local-tesseract"
MODEL_SONNET = "claude-sonnet-5"
MODEL_OPUS = "claude-opus-4-7"

MAX_MODEL_CALLS = 3
MAX_COST_PER_REQUEST = 0.05
DEFAULT_USER_BUDGET_USD = float(os.getenv("OCR_USER_BUDGET_USD", "1.0"))
HIGH_CONFIDENCE_THRESHOLD = 0.90
MEDIUM_CONFIDENCE_THRESHOLD = 0.70
RETRY_CONFIDENCE_THRESHOLD = 0.75
FIELD_LOW_CONFIDENCE_THRESHOLD = 0.65
MIN_TEXT_COMPONENTS = 8
MIN_IMAGE_DIMENSION = 50
MIN_IMAGE_AREA = 10_000
MIN_IMAGE_BYTES = 500
MAX_RETRY_FIELDS = 5

_AI_REQUIRED_DOC_TYPES = {"table", "sheet", "spreadsheet"}
_ALLOWED_FORMATS = {"PNG", "JPEG", "JPG", "WEBP", "GIF", "BMP", "TIFF"}
_DOC_TYPE_ALIASES = {
    "sheet": "table",
    "spreadsheet": "table",
    "ledger": "table",
    "logbook": "table",
    "register": "table",
    "id": "id_document",
    "id_card": "id_document",
    "id-document": "id_document",
}
_STRUCTURAL_REQUIRED_FIELDS = {
    "invoice": ["invoice_number", "date", "total"],
    "receipt": ["date", "total"],
    "id_document": ["full_name", "document_number"],
    "form": ["date"],
}
_SEMANTIC_KEYWORDS = {
    "invoice": ["invoice", "total", "date", "amount", "bill", "due", "qty", "price"],
    "receipt": ["total", "amount", "date", "paid", "change", "subtotal", "tax"],
    "form": ["name", "date", "address", "signature", "phone", "email"],
    "id_document": ["name", "birth", "number", "expiry", "issued"],
    "table": ["total", "date", "amount", "qty", "balance"],
    "freeform": [],
}
_NUMERIC_FIELD_NAMES = {
    "total",
    "subtotal",
    "tax",
    "amount",
    "invoice_total",
    "units",
}
_USER_BUDGET_LOCK = threading.Lock()
_USER_BUDGET_SPEND: dict[str, float] = defaultdict(float)

extraction_prompt_v1 = """You are a production OCR extraction engine.
Use the provided image and OCR text to return ONLY valid JSON.

Required JSON shape:
{{
  "document_type": "<document type>",
  "extracted_data": {{ ... }},
  "field_confidence": {{
    "<field_name>": 0.0
  }}
}}

Rules:
- Use the image as the primary source and OCR text as supporting context
- Do not include markdown or commentary
- If a field is unreadable, return null
- Keep numeric values and dates exactly as they appear when possible
- Return valid JSON only

Document type hint: {document_type}
OCR text:
{ocr_text}
"""

retry_prompt_v1 = """You are re-checking a previous OCR extraction.
Use the image and OCR text to return ONLY valid JSON.

Required JSON shape:
{{
  "document_type": "<document type>",
  "extracted_data": {{
    "<field_name>": "<value or null>"
  }},
  "field_confidence": {{
    "<field_name>": 0.0
  }}
}}

Only re-extract these low-confidence fields:
{field_names}

Previous values:
{previous_values}

Document type hint: {document_type}
OCR text:
{ocr_text}
"""


def _normalized_doc_type(doc_type_hint: str | None) -> str:
    normalized = (doc_type_hint or "").strip().lower().replace("-", "_")
    return _DOC_TYPE_ALIASES.get(normalized, normalized or "freeform")


def _title_from_hint(doc_type_hint: str | None, template: OcrTemplate | None) -> str:
    if template and template.name:
        return template.name
    normalized = (doc_type_hint or "").strip()
    if not normalized:
        return "OCR Extraction"
    return normalized.replace("-", " ").replace("_", " ").title()


def _flatten_rows(rows: list[list[str]]) -> str | None:
    lines = [" | ".join(str(cell or "").strip() for cell in row if str(cell or "").strip()) for row in rows]
    joined = "\n".join(line for line in lines if line.strip())
    return joined or None


def _stringify(value: Any) -> str:
    if value is None:
        return ""
    if isinstance(value, str):
        return value.strip()
    if isinstance(value, (int, float, bool)):
        return str(value)
    return json.dumps(value, ensure_ascii=True)


def _safe_number(value: Any) -> float | None:
    if value in (None, ""):
        return None
    if isinstance(value, (int, float)):
        return float(value)
    cleaned = re.sub(r"[^0-9.\-]", "", str(value))
    if not cleaned:
        return None
    try:
        return float(cleaned)
    except ValueError:
        return None


def _safe_date_string(value: Any) -> str | None:
    text = _stringify(value)
    return text or None


def _is_valid_date_string(value: Any) -> bool:
    text = _safe_date_string(value)
    if not text:
        return False
    for fmt in ("%Y-%m-%d", "%d-%m-%Y", "%d/%m/%Y", "%m/%d/%Y", "%d %b %Y", "%d %B %Y"):
        try:
            datetime.strptime(text, fmt)
            return True
        except ValueError:
            continue
    return False


def _parse_date(value: Any) -> datetime | None:
    text = _safe_date_string(value)
    if not text:
        return None
    for fmt in ("%Y-%m-%d", "%d-%m-%Y", "%d/%m/%Y", "%m/%d/%Y", "%d %b %Y", "%d %B %Y"):
        try:
            return datetime.strptime(text, fmt)
        except ValueError:
            continue
    return None


def _text_sanity_score(text: str) -> float:
    if not text or len(text.strip()) < 10:
        return 0.0
    words = text.split()
    if len(words) < 3:
        return 0.2

    avg_word_len = sum(len(word) for word in words) / len(words)
    alnum_ratio = sum(char.isalnum() or char.isspace() for char in text) / max(len(text), 1)
    repeated_runs = len(re.findall(r"(.)\1{4,}", text))
    alpha_like_words = [
        word
        for word in words
        if len(word) >= 3 and (sum(char.isalpha() for char in word) / max(len(word), 1)) > 0.7
    ]
    real_ratio = len(alpha_like_words) / max(len(words), 1)

    lines = [line for line in text.splitlines() if line.strip()]
    if len(lines) > 2:
        lengths = [len(line) for line in lines]
        variance_score = 1.0 if ((max(lengths) - min(lengths)) / max(max(lengths), 1)) < 0.9 else 0.5
    else:
        variance_score = 0.7

    checks = [
        1.0 if 3 <= avg_word_len <= 12 else 0.3,
        min(alnum_ratio / 0.6, 1.0),
        1.0 if repeated_runs == 0 else max(0.2, 1.0 - (repeated_runs * 0.2)),
        real_ratio,
        variance_score,
    ]
    return round(sum(checks) / len(checks), 4)


def _structure_presence_score(text: str, doc_type: str) -> float:
    keywords = _SEMANTIC_KEYWORDS.get(doc_type, [])
    if not keywords:
        return 0.7
    lowered = text.lower()
    found = sum(1 for keyword in keywords if keyword in lowered)
    ratio = found / len(keywords)
    if found >= 3:
        return min(ratio * 1.3, 1.0)
    if found >= 1:
        return 0.5
    return 0.2


def _char_distribution_score(text: str) -> float:
    if len(text) < 20:
        return 0.3
    space_ratio = text.count(" ") / len(text)
    digit_ratio = sum(char.isdigit() for char in text) / len(text)
    special_ratio = sum(not char.isalnum() and not char.isspace() for char in text) / len(text)
    space_score = 1.0 if 0.10 <= space_ratio <= 0.30 else 0.4
    digit_score = 1.0 if digit_ratio < 0.50 else 0.5
    special_score = 1.0 if special_ratio < 0.20 else 0.4
    return round((space_score + digit_score + special_score) / 3.0, 4)


def _extract_value(patterns: list[str], text: str) -> str | None:
    for pattern in patterns:
        match = re.search(pattern, text, flags=re.IGNORECASE | re.MULTILINE)
        if match:
            value = match.group(1).strip(" :.-")
            if value:
                return value
    return None


def _rule_based_extracted_data(doc_type: str, text: str, rows: list[list[str]], headers: list[str]) -> dict[str, Any]:
    extracted: dict[str, Any] = {}
    normalized_text = text or (_flatten_rows(rows) or "")

    if doc_type == "invoice":
        extracted["invoice_number"] = _extract_value(
            [r"invoice\s*(?:no|number|#)?\s*[:\-]?\s*([A-Z0-9\-\/]+)"],
            normalized_text,
        )
        extracted["date"] = _extract_value(
            [r"\bdate\b\s*[:\-]?\s*([0-9]{1,4}[\/\-][0-9]{1,2}[\/\-][0-9]{1,4})"],
            normalized_text,
        )
        extracted["total"] = _extract_value(
            [r"\btotal\b\s*[:\-]?\s*([A-Z$₹0-9,.\-]+)"],
            normalized_text,
        )
        extracted["vendor_name"] = rows[0][0] if rows and rows[0] else None
        extracted["line_items"] = rows[1:] if len(rows) > 1 else []
    elif doc_type == "receipt":
        extracted["merchant"] = rows[0][0] if rows and rows[0] else None
        extracted["date"] = _extract_value(
            [r"\bdate\b\s*[:\-]?\s*([0-9]{1,4}[\/\-][0-9]{1,2}[\/\-][0-9]{1,4})"],
            normalized_text,
        )
        extracted["total"] = _extract_value(
            [r"\btotal\b\s*[:\-]?\s*([A-Z$₹0-9,.\-]+)", r"\bamount\b\s*[:\-]?\s*([A-Z$₹0-9,.\-]+)"],
            normalized_text,
        )
        extracted["items"] = rows[1:] if len(rows) > 1 else []
    elif doc_type == "id_document":
        extracted["full_name"] = _extract_value(
            [r"\bname\b\s*[:\-]?\s*([A-Z][A-Z\s]{2,})"],
            normalized_text.upper(),
        ) or (rows[0][0] if rows and rows[0] else None)
        extracted["document_number"] = _extract_value(
            [r"\b(?:id|document|card|license|licence|number|no)\b\s*[:\-]?\s*([A-Z0-9\-]+)"],
            normalized_text,
        )
        extracted["date_of_birth"] = _extract_value(
            [r"\b(?:dob|birth|date of birth)\b\s*[:\-]?\s*([0-9]{1,4}[\/\-][0-9]{1,2}[\/\-][0-9]{1,4})"],
            normalized_text,
        )
        extracted["expiry_date"] = _extract_value(
            [r"\b(?:expiry|expires|exp)\b\s*[:\-]?\s*([0-9]{1,4}[\/\-][0-9]{1,2}[\/\-][0-9]{1,4})"],
            normalized_text,
        )
    elif doc_type == "form":
        extracted["name"] = _extract_value([r"\bname\b\s*[:\-]?\s*(.+)"], normalized_text)
        extracted["date"] = _extract_value(
            [r"\bdate\b\s*[:\-]?\s*([0-9]{1,4}[\/\-][0-9]{1,2}[\/\-][0-9]{1,4})"],
            normalized_text,
        )
        extracted["address"] = _extract_value([r"\baddress\b\s*[:\-]?\s*(.+)"], normalized_text)
        extracted["phone"] = _extract_value([r"\b(?:phone|mobile|contact)\b\s*[:\-]?\s*([\d+\-\s]+)"], normalized_text)
        extracted["email"] = _extract_value([r"\bemail\b\s*[:\-]?\s*([A-Z0-9._%+\-]+@[A-Z0-9.\-]+\.[A-Z]{2,})"], normalized_text)
        extracted["signature_present"] = "signature" in normalized_text.lower()
    elif doc_type == "table":
        extracted["headers"] = headers
        extracted["rows"] = rows
    else:
        extracted["raw_text"] = normalized_text

    return extracted


def _field_confidence_from_ocr(extracted_data: dict[str, Any], text: str, average_confidence: float) -> dict[str, float]:
    confidences: dict[str, float] = {}
    lowered = text.lower()
    for field_name, value in extracted_data.items():
        if isinstance(value, list):
            confidences[field_name] = round(max(0.45, average_confidence - 0.05), 4)
            continue
        if value in (None, "", []):
            confidences[field_name] = 0.2
            continue
        rendered = _stringify(value).lower()
        boost = 0.0
        if rendered and rendered in lowered:
            boost = 0.12
        elif rendered:
            for token in rendered.split():
                if token and token in lowered:
                    boost = 0.08
                    break
        confidences[field_name] = round(min(1.0, max(0.3, average_confidence + boost)), 4)
    return confidences


def _legacy_rows_from_extracted_data(extracted_data: dict[str, Any], fallback_rows: list[list[str]]) -> tuple[list[str], list[list[str]]]:
    headers = extracted_data.get("headers")
    rows = extracted_data.get("rows")
    if isinstance(headers, list) and isinstance(rows, list):
        normalized = normalize_structured_payload(
            {"headers": headers, "rows": rows},
            fallback_headers=[],
            fallback_rows=fallback_rows,
            fallback_type="table",
            fallback_title="OCR Extraction",
        )
        return normalized["headers"], normalized["rows"]

    if extracted_data:
        legacy_rows: list[list[str]] = []
        for key, value in extracted_data.items():
            if isinstance(value, list):
                legacy_rows.append([key, json.dumps(value, ensure_ascii=True)])
            elif isinstance(value, dict):
                legacy_rows.append([key, json.dumps(value, ensure_ascii=True)])
            else:
                legacy_rows.append([key, _stringify(value)])
        return ["Field", "Value"], legacy_rows

    normalized = normalize_structured_payload(
        {"headers": [], "rows": fallback_rows},
        fallback_headers=[],
        fallback_rows=fallback_rows,
        fallback_type="table",
        fallback_title="OCR Extraction",
    )
    return normalized["headers"], normalized["rows"]


def _estimate_cost_usd(model_name: str, prompt_text: str, completion_text: str = "") -> float:
    prompt_tokens = max(1, int(len(prompt_text or "") / 4))
    completion_tokens = max(1, int(len(completion_text or "") / 4)) if completion_text else 1
    if model_name == MODEL_OPUS:
        input_rate = 0.015
        output_rate = 0.075
    else:
        input_rate = 0.003
        output_rate = 0.015
    return round(((prompt_tokens / 1000.0) * input_rate) + ((completion_tokens / 1000.0) * output_rate), 6)


def _anthropic_api_key() -> str | None:
    key = (os.getenv("ANTHROPIC_API_KEY") or "").strip()
    return key or None


def _model_response_to_text(response: Any) -> str:
    parts = []
    for block in getattr(response, "content", []) or []:
        if getattr(block, "type", None) == "text":
            parts.append(block.text)
    return "\n".join(part.strip() for part in parts if part).strip()


def _call_anthropic_vision(image_bytes: bytes, *, prompt_text: str, model_name: str) -> tuple[dict[str, Any], str]:
    api_key = _anthropic_api_key()
    if not api_key:
        raise RuntimeError("ANTHROPIC_API_KEY is not configured.")

    import anthropic  # type: ignore

    image = Image.open(io.BytesIO(image_bytes))
    image_format = (image.format or "JPEG").upper()
    media_type = "image/jpeg"
    if image_format == "PNG":
        media_type = "image/png"
    elif image_format == "WEBP":
        media_type = "image/webp"
    elif image_format == "GIF":
        media_type = "image/gif"

    client = anthropic.Anthropic(
        api_key=api_key,
        timeout=float(os.getenv("OCR_PROVIDER_TIMEOUT_SECONDS", "30")),
    )
    response = client.messages.create(
        model=model_name,
        max_tokens=int(os.getenv("OCR_MAX_OUTPUT_TOKENS", "900")),
        temperature=0,
        messages=[
            {
                "role": "user",
                "content": [
                    {"type": "text", "text": prompt_text},
                    {
                        "type": "image",
                        "source": {
                            "type": "base64",
                            "media_type": media_type,
                            "data": base64.b64encode(image_bytes).decode("ascii"),
                        },
                    },
                ],
            }
        ],
    )
    raw_text = _model_response_to_text(response)
    payload = extract_json_candidate(raw_text)
    if not isinstance(payload, dict):
        raise ValueError("Model did not return valid JSON.")
    return payload, raw_text


def _normalize_model_payload(
    payload: dict[str, Any],
    *,
    doc_type: str,
    fallback_data: dict[str, Any],
    fallback_confidence: dict[str, float],
) -> tuple[dict[str, Any], dict[str, float]]:
    extracted_data = payload.get("extracted_data")
    if not isinstance(extracted_data, dict):
        extracted_data = {
            key: value
            for key, value in payload.items()
            if key not in {"document_type", "field_confidence", "confidence", "fields_needing_review"}
        }
    if not extracted_data:
        extracted_data = dict(fallback_data)

    field_confidence = payload.get("field_confidence")
    normalized_confidence: dict[str, float] = {}
    if isinstance(field_confidence, dict):
        for key, value in field_confidence.items():
            try:
                normalized_confidence[str(key)] = round(max(0.0, min(1.0, float(value))), 4)
            except (TypeError, ValueError):
                continue

    if not normalized_confidence:
        normalized_confidence = dict(fallback_confidence)
    for key in extracted_data.keys():
        normalized_confidence.setdefault(key, fallback_confidence.get(key, 0.55))

    if doc_type == "table":
        normalized = normalize_structured_payload(
            {"headers": extracted_data.get("headers"), "rows": extracted_data.get("rows")},
            fallback_headers=fallback_data.get("headers") if isinstance(fallback_data.get("headers"), list) else [],
            fallback_rows=fallback_data.get("rows") if isinstance(fallback_data.get("rows"), list) else [],
            fallback_type="table",
            fallback_title="OCR Extraction",
        )
        extracted_data = {"headers": normalized["headers"], "rows": normalized["rows"]}

    return extracted_data, normalized_confidence


def _reuse_has_remote_ai(candidate: OcrVerification) -> bool:
    routing = candidate.routing_meta or {}
    if not isinstance(routing, dict):
        return False
    provider = str(routing.get("provider_used") or "").strip().lower()
    return bool(routing.get("ai_applied")) and provider in {"anthropic", "bytez"}


def serialize_reused_ocr_result(verification: OcrVerification, *, template: OcrTemplate | None = None) -> dict[str, Any]:
    title = _title_from_hint(verification.doc_type_hint, template)
    rows = verification.reviewed_rows or verification.original_rows or []
    columns = max(len(verification.headers or []), max((len(row) for row in rows), default=0), 1)
    orchestrator_result = {
        "status": "complete",
        "document_type": _normalized_doc_type(verification.doc_type_hint),
        "extracted_data": {"headers": verification.headers or [], "rows": rows},
        "confidence": {
            "overall": round(float(verification.avg_confidence or 0.0) / 100.0, 4),
            "level": "HIGH" if float(verification.avg_confidence or 0.0) >= 90 else "MEDIUM",
            "fields_needing_review": [],
        },
        "processing": {
            "tier": str((verification.routing_meta or {}).get("model_tier") or "ocr"),
            "model_used": str((verification.routing_meta or {}).get("provider_model") or MODEL_TESSERACT),
            "cost": float((verification.routing_meta or {}).get("actual_cost_usd") or 0.0),
            "latency": 0,
        },
    }
    return {
        "type": _normalized_doc_type(verification.doc_type_hint),
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
        "status": orchestrator_result["status"],
        "document_type": orchestrator_result["document_type"],
        "extracted_data": orchestrator_result["extracted_data"],
        "processing": orchestrator_result["processing"],
        "orchestrator_result": orchestrator_result,
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
    normalized_hint = _normalized_doc_type(doc_type_hint)
    candidates = query.limit(10).all()
    for candidate in candidates:
        candidate_hint = _normalized_doc_type(candidate.doc_type_hint)
        if candidate.template_id != template_id:
            continue
        if candidate_hint != normalized_hint:
            continue
        if normalized_hint in _AI_REQUIRED_DOC_TYPES and not _reuse_has_remote_ai(candidate):
            continue
        if candidate.reviewed_rows or candidate.original_rows:
            return candidate
    return None


class OCROrchestrator:
    MAX_MODEL_CALLS = MAX_MODEL_CALLS
    MAX_COST_PER_REQUEST = MAX_COST_PER_REQUEST

    def __init__(self) -> None:
        self.extraction_prompt_v1 = extraction_prompt_v1
        self.retry_prompt_v1 = retry_prompt_v1

    def ingest(self, image_bytes: bytes, request_context: dict[str, Any], caller_config: dict[str, Any]) -> dict[str, Any]:
        try:
            image = Image.open(io.BytesIO(image_bytes))
            image.load()
        except (UnidentifiedImageError, OSError) as error:
            return {"ok": False, "error_code": "INVALID_FORMAT", "error_message": str(error)}

        image_format = (image.format or "").upper()
        if image_format not in _ALLOWED_FORMATS:
            return {"ok": False, "error_code": "INVALID_FORMAT", "error_message": "Unsupported image format."}

        width, height = image.size
        area = width * height
        metadata = {
            "format": image_format,
            "width": width,
            "height": height,
            "area": area,
            "size_bytes": len(image_bytes),
            "document_hash": hashlib.sha256(image_bytes).hexdigest(),
        }
        request_context["metadata"] = metadata

        if len(image_bytes) < MIN_IMAGE_BYTES or width < MIN_IMAGE_DIMENSION or height < MIN_IMAGE_DIMENSION or area < MIN_IMAGE_AREA:
            return {"ok": False, "error_code": "IMAGE_TOO_SMALL", "error_message": "Image is too small to process."}

        gray = np.array(image.convert("L"))
        variance = float(np.var(gray))
        metadata["pixel_variance"] = variance
        if variance < 50.0:
            return {"ok": False, "error_code": "BLANK_IMAGE", "error_message": "Image appears blank or solid."}

        text_components = 0
        if ocr_helpers.cv2 is not None:
            _, binary = ocr_helpers.cv2.threshold(gray, 0, 255, ocr_helpers.cv2.THRESH_BINARY_INV + ocr_helpers.cv2.THRESH_OTSU)
            num_components, _labels, stats, _centroids = ocr_helpers.cv2.connectedComponentsWithStats(binary)
            for index in range(1, num_components):
                component_area = int(stats[index, ocr_helpers.cv2.CC_STAT_AREA])
                ratio = component_area / max(area, 1)
                if 0.00005 < ratio < 0.02:
                    text_components += 1
        metadata["text_components"] = text_components
        if text_components < MIN_TEXT_COMPONENTS:
            return {"ok": False, "error_code": "NO_TEXT_REGIONS", "error_message": "No text-like regions detected."}

        return {"ok": True, "image_bytes": image_bytes, "image": image, "metadata": metadata}

    def classify(self, ingest_result: dict[str, Any], request_context: dict[str, Any], caller_config: dict[str, Any]) -> dict[str, Any]:
        metadata = ingest_result["metadata"]
        template = caller_config.get("template")
        doc_type = _normalized_doc_type(caller_config.get("doc_type_hint") or (template.doc_type_hint if template and hasattr(template, "doc_type_hint") else None))
        if doc_type == "freeform" and template and getattr(template, "columns", 0) > 1:
            doc_type = "table"

        quality_signals: list[str] = []
        quality_score = 1.0
        try:
            quality = ocr_helpers.analyze_image_quality(ingest_result["image_bytes"])
            if quality.blur_variance < 75:
                quality_signals.append("blur_detected")
                quality_score -= 0.2
            if quality.brightness_mean < 80:
                quality_signals.append("low_light")
                quality_score -= 0.15
            if quality.glare_ratio > 0.06:
                quality_signals.append("glare")
                quality_score -= 0.15
        except Exception:
            quality_score = max(0.4, min(1.0, metadata.get("pixel_variance", 50.0) / 255.0))

        classification = {
            "document_type": doc_type,
            "quality_score": round(max(0.0, min(1.0, quality_score)), 4),
            "quality_signals": quality_signals,
            "language": caller_config.get("used_language") or caller_config.get("language") or "eng",
            "template": template,
            "columns": int(getattr(template, "columns", 0) or caller_config.get("columns") or 3),
            "column_centers": getattr(template, "column_centers", None),
            "column_keywords": getattr(template, "column_keywords", None),
            "enable_raw_column": bool(getattr(template, "enable_raw_column", False) or caller_config.get("enable_raw_column", False)),
        }
        request_context["classification"] = classification
        return classification

    def extract_ocr(self, ingest_result: dict[str, Any], classification: dict[str, Any], request_context: dict[str, Any], caller_config: dict[str, Any]) -> dict[str, Any]:
        base_result = caller_config.get("base_ocr_result")
        fallback_used = bool(caller_config.get("fallback_used", False))
        requested_language = caller_config.get("used_language") or classification["language"] or "eng"
        warnings: list[str] = []

        if isinstance(base_result, OcrResult):
            table_result = base_result
            used_language = requested_language
            raw_text = _flatten_rows(base_result.rows or []) or ""
            average_confidence = round(float(base_result.avg_confidence or 0.0) / 100.0, 4)
            low_confidence_ratio = 0.0
            word_confidences: list[float] = []
        else:
            words, confidences, processed, word_warnings, used_language = ocr_helpers._extract_words_safe(
                ingest_result["image_bytes"],
                requested_language if requested_language != "auto" else "eng",
            )
            warnings.extend(word_warnings)
            if not words:
                raw_text = ocr_helpers.pytesseract.image_to_string(
                    processed,
                    lang=used_language,
                    config="--oem 1 --psm 6",
                ).strip()
            else:
                raw_text = ocr_helpers.pytesseract.image_to_string(
                    processed,
                    lang=used_language,
                    config="--oem 1 --psm 6",
                ).strip()
            if requested_language == "auto" and used_language == "eng":
                fallback_used = bool(fallback_used or used_language != requested_language)
            average_confidence = round((sum(confidences) / len(confidences)) / 100.0, 4) if confidences else 0.0
            word_confidences = [round(max(0.0, min(1.0, conf / 100.0)), 4) for conf in confidences]
            low_confidence_ratio = round(
                sum(1 for conf in word_confidences if conf < FIELD_LOW_CONFIDENCE_THRESHOLD) / max(len(word_confidences), 1),
                4,
            )
            table_result = extract_local_table_from_image(
                ingest_result["image_bytes"],
                columns=max(1, min(classification["columns"], 8)),
                language=used_language,
                column_centers=classification.get("column_centers"),
                column_keywords=classification.get("column_keywords"),
                enable_raw_column=classification.get("enable_raw_column", False),
            )
            warnings.extend(table_result.warnings or [])

        rows = table_result.rows or [[line] for line in raw_text.splitlines() if line.strip()]
        headers = [f"Column {index}" for index in range(1, max((len(row) for row in rows), default=0) + 1)]
        ocr_result = {
            "ocr_text": raw_text or (_flatten_rows(rows) or ""),
            "word_confidences": word_confidences,
            "average_confidence": average_confidence or round(float(table_result.avg_confidence or 0.0) / 100.0, 4),
            "average_confidence_pct": round(float(table_result.avg_confidence or 0.0), 2),
            "low_confidence_ratio": low_confidence_ratio,
            "rows": rows,
            "headers": headers,
            "cell_confidence": table_result.cell_confidence or [],
            "cell_boxes": table_result.cell_boxes or [],
            "warnings": list(dict.fromkeys(warnings)),
            "used_language": used_language,
            "fallback_used": fallback_used,
            "raw_column_added": bool(table_result.raw_column_added),
        }
        request_context["ocr"] = ocr_result
        return ocr_result

    def compute_confidence(self, ocr_result: dict[str, Any], classification: dict[str, Any], request_context: dict[str, Any]) -> dict[str, Any]:
        raw_confidence = round(max(0.0, min(1.0, float(ocr_result.get("average_confidence") or 0.0))), 4)
        text = ocr_result.get("ocr_text") or ""
        text_sanity = _text_sanity_score(text)
        structure_presence = _structure_presence_score(text, classification["document_type"])
        char_distribution = _char_distribution_score(text)
        composite = round(
            (raw_confidence * 0.35)
            + (text_sanity * 0.25)
            + (structure_presence * 0.20)
            + (char_distribution * 0.20),
            4,
        )
        if text_sanity < 0.30:
            composite = min(composite, 0.50)

        if composite >= HIGH_CONFIDENCE_THRESHOLD:
            level = "HIGH"
        elif composite >= MEDIUM_CONFIDENCE_THRESHOLD:
            level = "MEDIUM"
        else:
            level = "LOW"

        result = {
            "overall": composite,
            "level": level,
            "signals": {
                "ocr_confidence": raw_confidence,
                "text_sanity": text_sanity,
                "structure_presence": structure_presence,
                "character_distribution": char_distribution,
                "low_confidence_ratio": float(ocr_result.get("low_confidence_ratio") or 0.0),
            },
        }
        request_context["composite_confidence"] = result
        return result

    def route(self, confidence_result: dict[str, Any], classification: dict[str, Any], request_context: dict[str, Any]) -> dict[str, Any]:
        level = confidence_result["level"]
        if level == "HIGH":
            route = {"level": "HIGH", "tier": "ocr", "needs_sonnet": False, "needs_retry": False, "needs_opus": False}
        elif level == "MEDIUM":
            route = {"level": "MEDIUM", "tier": "sonnet", "needs_sonnet": True, "needs_retry": False, "needs_opus": False}
        else:
            route = {"level": "LOW", "tier": "sonnet", "needs_sonnet": True, "needs_retry": True, "needs_opus": True}
        request_context["route"] = route
        return route

    def call_sonnet(
        self,
        image_bytes: bytes,
        ocr_text: str,
        classification: dict[str, Any],
        request_context: dict[str, Any],
        current_result: dict[str, Any],
    ) -> dict[str, Any]:
        prompt_text = self.extraction_prompt_v1.format(
            document_type=classification["document_type"],
            ocr_text=ocr_text or "",
        )
        estimated_cost = _estimate_cost_usd(MODEL_SONNET, prompt_text)
        user_id = str(request_context.get("user_id") or "anonymous")
        with _USER_BUDGET_LOCK:
            projected_user_spend = _USER_BUDGET_SPEND[user_id] + request_context["total_cost"] + estimated_cost
        if request_context["model_calls"] >= self.MAX_MODEL_CALLS:
            request_context["model_blocked_reason"] = "MAX_MODEL_CALLS_EXCEEDED"
            return {**current_result, "status": "partial", "model_used": MODEL_TESSERACT, "tier": "ocr"}
        if request_context["total_cost"] + estimated_cost > self.MAX_COST_PER_REQUEST:
            request_context["model_blocked_reason"] = "MAX_COST_PER_REQUEST_EXCEEDED"
            return {**current_result, "status": "partial", "model_used": MODEL_TESSERACT, "tier": "ocr"}
        if projected_user_spend > float(request_context.get("user_budget_limit") or DEFAULT_USER_BUDGET_USD):
            request_context["model_blocked_reason"] = "USER_BUDGET_EXCEEDED"
            return {**current_result, "status": "partial", "model_used": MODEL_TESSERACT, "tier": "ocr"}

        started = time.perf_counter()
        request_context["model_calls"] += 1
        try:
            payload, raw_text = _call_anthropic_vision(
                image_bytes,
                prompt_text=prompt_text,
                model_name=MODEL_SONNET,
            )
            extracted_data, field_confidence = _normalize_model_payload(
                payload,
                doc_type=classification["document_type"],
                fallback_data=current_result["extracted_data"],
                fallback_confidence=current_result["field_confidence"],
            )
            actual_cost = _estimate_cost_usd(MODEL_SONNET, prompt_text, raw_text)
            latency_ms = int((time.perf_counter() - started) * 1000)
            request_context["total_cost"] = round(request_context["total_cost"] + actual_cost, 6)
            request_context["latency"] += latency_ms
            request_context["model_used"] = MODEL_SONNET
            return {
                "status": "complete",
                "tier": "sonnet",
                "model_used": MODEL_SONNET,
                "extracted_data": extracted_data,
                "field_confidence": field_confidence,
                "overall_confidence": round(sum(field_confidence.values()) / max(len(field_confidence), 1), 4),
                "raw_model_output": raw_text,
            }
        except Exception as error:
            latency_ms = int((time.perf_counter() - started) * 1000)
            request_context["latency"] += latency_ms
            request_context["sonnet_error"] = str(error)
            return {**current_result, "status": "partial", "tier": "ocr", "model_used": MODEL_TESSERACT}

    def retry_logic(
        self,
        current_result: dict[str, Any],
        image_bytes: bytes,
        ocr_text: str,
        classification: dict[str, Any],
        request_context: dict[str, Any],
    ) -> dict[str, Any]:
        field_confidence = current_result.get("field_confidence") or {}
        low_confidence_fields = [
            field_name
            for field_name, confidence in field_confidence.items()
            if float(confidence or 0.0) < RETRY_CONFIDENCE_THRESHOLD
        ]
        request_context["retries"] = int(request_context.get("retries") or 0)
        if not low_confidence_fields:
            return current_result
        if request_context["retries"] >= 1:
            return current_result
        if request_context["model_calls"] >= 2:
            return current_result
        if len(low_confidence_fields) / max(len(field_confidence), 1) > 0.50:
            return current_result
        if classification["document_type"] == "handwritten":
            return current_result

        targeted_fields = low_confidence_fields[:MAX_RETRY_FIELDS]
        prompt_text = self.retry_prompt_v1.format(
            document_type=classification["document_type"],
            field_names=", ".join(targeted_fields),
            previous_values=json.dumps(
                {field: current_result["extracted_data"].get(field) for field in targeted_fields},
                ensure_ascii=True,
                sort_keys=True,
            ),
            ocr_text=ocr_text or "",
        )
        estimated_cost = _estimate_cost_usd(MODEL_SONNET, prompt_text)
        user_id = str(request_context.get("user_id") or "anonymous")
        with _USER_BUDGET_LOCK:
            projected_user_spend = _USER_BUDGET_SPEND[user_id] + request_context["total_cost"] + estimated_cost
        if request_context["total_cost"] + estimated_cost > self.MAX_COST_PER_REQUEST:
            request_context["retry_blocked_reason"] = "MAX_COST_PER_REQUEST_EXCEEDED"
            return current_result
        if projected_user_spend > float(request_context.get("user_budget_limit") or DEFAULT_USER_BUDGET_USD):
            request_context["retry_blocked_reason"] = "USER_BUDGET_EXCEEDED"
            return current_result

        started = time.perf_counter()
        request_context["model_calls"] += 1
        request_context["retries"] = 1
        try:
            payload, raw_text = _call_anthropic_vision(
                image_bytes,
                prompt_text=prompt_text,
                model_name=MODEL_SONNET,
            )
            retry_data, retry_confidence = _normalize_model_payload(
                payload,
                doc_type=classification["document_type"],
                fallback_data=current_result["extracted_data"],
                fallback_confidence=current_result["field_confidence"],
            )
            merged_data = dict(current_result["extracted_data"])
            merged_confidence = dict(current_result["field_confidence"])
            for field_name in targeted_fields:
                if retry_confidence.get(field_name, 0.0) > merged_confidence.get(field_name, 0.0):
                    merged_data[field_name] = retry_data.get(field_name)
                    merged_confidence[field_name] = retry_confidence[field_name]
            actual_cost = _estimate_cost_usd(MODEL_SONNET, prompt_text, raw_text)
            latency_ms = int((time.perf_counter() - started) * 1000)
            request_context["total_cost"] = round(request_context["total_cost"] + actual_cost, 6)
            request_context["latency"] += latency_ms
            request_context["model_used"] = MODEL_SONNET
            return {
                "status": current_result.get("status", "partial"),
                "tier": "sonnet",
                "model_used": MODEL_SONNET,
                "extracted_data": merged_data,
                "field_confidence": merged_confidence,
                "overall_confidence": round(sum(merged_confidence.values()) / max(len(merged_confidence), 1), 4),
                "raw_model_output": raw_text,
            }
        except Exception as error:
            latency_ms = int((time.perf_counter() - started) * 1000)
            request_context["latency"] += latency_ms
            request_context["retry_error"] = str(error)
            return current_result

    def call_opus(
        self,
        current_result: dict[str, Any],
        image_bytes: bytes,
        ocr_text: str,
        classification: dict[str, Any],
        request_context: dict[str, Any],
    ) -> dict[str, Any]:
        prompt_text = self.extraction_prompt_v1.format(
            document_type=classification["document_type"],
            ocr_text=ocr_text or "",
        )
        estimated_cost = _estimate_cost_usd(MODEL_OPUS, prompt_text)
        user_id = str(request_context.get("user_id") or "anonymous")
        with _USER_BUDGET_LOCK:
            projected_user_spend = _USER_BUDGET_SPEND[user_id] + request_context["total_cost"] + estimated_cost
        if request_context["model_calls"] >= self.MAX_MODEL_CALLS:
            request_context["opus_blocked_reason"] = "MAX_MODEL_CALLS_EXCEEDED"
            return current_result
        if request_context["total_cost"] + estimated_cost > self.MAX_COST_PER_REQUEST:
            request_context["opus_blocked_reason"] = "MAX_COST_PER_REQUEST_EXCEEDED"
            return current_result
        if projected_user_spend > float(request_context.get("user_budget_limit") or DEFAULT_USER_BUDGET_USD):
            request_context["opus_blocked_reason"] = "USER_BUDGET_EXCEEDED"
            return current_result

        started = time.perf_counter()
        request_context["model_calls"] += 1
        try:
            payload, raw_text = _call_anthropic_vision(
                image_bytes,
                prompt_text=prompt_text,
                model_name=MODEL_OPUS,
            )
            extracted_data, field_confidence = _normalize_model_payload(
                payload,
                doc_type=classification["document_type"],
                fallback_data=current_result["extracted_data"],
                fallback_confidence=current_result["field_confidence"],
            )
            actual_cost = _estimate_cost_usd(MODEL_OPUS, prompt_text, raw_text)
            latency_ms = int((time.perf_counter() - started) * 1000)
            request_context["total_cost"] = round(request_context["total_cost"] + actual_cost, 6)
            request_context["latency"] += latency_ms
            request_context["model_used"] = MODEL_OPUS
            return {
                "status": "complete",
                "tier": "opus",
                "model_used": MODEL_OPUS,
                "extracted_data": extracted_data,
                "field_confidence": field_confidence,
                "overall_confidence": round(sum(field_confidence.values()) / max(len(field_confidence), 1), 4),
                "raw_model_output": raw_text,
            }
        except Exception as error:
            latency_ms = int((time.perf_counter() - started) * 1000)
            request_context["latency"] += latency_ms
            request_context["opus_error"] = str(error)
            return current_result

    def validate(self, current_result: dict[str, Any], classification: dict[str, Any], request_context: dict[str, Any]) -> dict[str, Any]:
        doc_type = classification["document_type"]
        extracted_data = current_result.get("extracted_data") or {}
        field_confidence = current_result.get("field_confidence") or {}
        issues: list[dict[str, str]] = []

        required_fields = _STRUCTURAL_REQUIRED_FIELDS.get(doc_type, [])
        for field_name in required_fields:
            value = extracted_data.get(field_name)
            if value in (None, "", []):
                issues.append({"field": field_name, "severity": "CRITICAL", "reason": f"Missing required field: {field_name}"})

        if doc_type == "invoice":
            total_value = _safe_number(extracted_data.get("total"))
            if total_value is None or total_value <= 0:
                issues.append({"field": "total", "severity": "WARNING", "reason": "Invoice total must be a positive number."})
            if not _is_valid_date_string(extracted_data.get("date")):
                issues.append({"field": "date", "severity": "WARNING", "reason": "Invoice date is invalid."})
        elif doc_type == "receipt":
            amount_value = _safe_number(extracted_data.get("total") or extracted_data.get("amount"))
            if amount_value is None:
                issues.append({"field": "total", "severity": "WARNING", "reason": "Receipt amount is missing."})
        elif doc_type == "id_document":
            if not _stringify(extracted_data.get("full_name") or extracted_data.get("name")):
                issues.append({"field": "full_name", "severity": "WARNING", "reason": "ID name is missing."})
        elif doc_type == "form":
            if extracted_data.get("date") and not _is_valid_date_string(extracted_data.get("date")):
                issues.append({"field": "date", "severity": "WARNING", "reason": "Form date is invalid."})

        for field_name, value in extracted_data.items():
            if field_name in _NUMERIC_FIELD_NAMES:
                numeric_value = _safe_number(value)
                if value not in (None, "", []) and numeric_value is None:
                    issues.append({"field": field_name, "severity": "WARNING", "reason": f"{field_name} is not a valid number."})
            if "date" in field_name and value not in (None, "", []) and not _is_valid_date_string(value):
                issues.append({"field": field_name, "severity": "WARNING", "reason": f"{field_name} is not a valid date."})

        review_fields = sorted(
            {
                field_name
                for field_name, confidence in field_confidence.items()
                if float(confidence or 0.0) < FIELD_LOW_CONFIDENCE_THRESHOLD
            }
            | {
                issue["field"]
                for issue in issues
                if issue["field"] != "_document"
            }
        )

        structural_passed = not any(issue["severity"] == "CRITICAL" for issue in issues)
        semantic_passed = not issues
        validation = {
            "structural_passed": structural_passed,
            "semantic_passed": semantic_passed,
            "issues": issues,
            "fields_needing_review": review_fields,
        }
        request_context["validation"] = validation
        return validation

    def format_output(
        self,
        request_context: dict[str, Any],
        current_result: dict[str, Any] | None = None,
        classification: dict[str, Any] | None = None,
        validation: dict[str, Any] | None = None,
    ) -> dict[str, Any]:
        overall_confidence = 0.0
        if current_result and current_result.get("field_confidence"):
            field_confidence = current_result["field_confidence"]
            overall_confidence = round(sum(field_confidence.values()) / max(len(field_confidence), 1), 4)
        elif request_context.get("composite_confidence"):
            overall_confidence = float(request_context["composite_confidence"]["overall"])

        if overall_confidence >= HIGH_CONFIDENCE_THRESHOLD:
            level = "HIGH"
        elif overall_confidence >= MEDIUM_CONFIDENCE_THRESHOLD:
            level = "MEDIUM"
        else:
            level = "LOW"

        fields_needing_review = validation.get("fields_needing_review", []) if validation else []
        status = "error" if request_context.get("error") else "complete"
        if status != "error" and (fields_needing_review or (validation and not validation["semantic_passed"])):
            status = "partial"

        total_latency_ms = int((time.perf_counter() - request_context["started_at"]) * 1000)
        request_context["latency"] = total_latency_ms
        processing = {
            "tier": current_result.get("tier", "ocr") if current_result else "ocr",
            "model_used": current_result.get("model_used", MODEL_TESSERACT) if current_result else MODEL_TESSERACT,
            "cost": round(float(request_context.get("total_cost") or 0.0), 6),
            "latency": total_latency_ms,
        }
        output = {
            "status": status,
            "document_type": classification["document_type"] if classification else request_context.get("document_type", "unknown"),
            "extracted_data": current_result.get("extracted_data", {}) if current_result else {},
            "confidence": {
                "overall": round(overall_confidence, 4),
                "level": level,
                "fields_needing_review": fields_needing_review,
            },
            "processing": processing,
        }
        if request_context.get("error"):
            output["error"] = request_context["error"]

        logger.info(
            "OCR orchestrator completed status=%s model=%s cost=%s retries=%s escalation=%s confidence=%s",
            output["status"],
            processing["model_used"],
            processing["cost"],
            request_context.get("retries", 0),
            processing["tier"] == "opus",
            output["confidence"]["overall"],
        )
        return output

    def process(self, image_bytes: bytes, caller_config: dict[str, Any] | None = None) -> dict[str, Any]:
        caller_config = caller_config or {}
        request_context: dict[str, Any] = {
            "model_calls": 0,
            "total_cost": 0.0,
            "latency": 0,
            "started_at": time.perf_counter(),
            "user_id": caller_config.get("user_id") or "anonymous",
            "user_budget_limit": float(caller_config.get("user_budget_limit") or DEFAULT_USER_BUDGET_USD),
            "retries": 0,
        }

        ingest_result = self.ingest(image_bytes, request_context, caller_config)
        if not ingest_result.get("ok"):
            request_context["error"] = {
                "code": ingest_result.get("error_code", "INGEST_FAILED"),
                "message": ingest_result.get("error_message", "Unable to ingest image."),
            }
            request_context["document_type"] = _normalized_doc_type(caller_config.get("doc_type_hint"))
            return self.format_output(request_context)

        classification = self.classify(ingest_result, request_context, caller_config)
        ocr_result = self.extract_ocr(ingest_result, classification, request_context, caller_config)
        composite_confidence = self.compute_confidence(ocr_result, classification, request_context)
        route = self.route(composite_confidence, classification, request_context)

        base_extracted_data = _rule_based_extracted_data(
            classification["document_type"],
            ocr_result["ocr_text"],
            ocr_result["rows"],
            ocr_result["headers"],
        )
        base_field_confidence = _field_confidence_from_ocr(
            base_extracted_data,
            ocr_result["ocr_text"],
            float(ocr_result.get("average_confidence") or 0.0),
        )
        current_result = {
            "status": "complete",
            "tier": "ocr",
            "model_used": MODEL_TESSERACT,
            "extracted_data": base_extracted_data,
            "field_confidence": base_field_confidence,
            "overall_confidence": composite_confidence["overall"],
        }

        if route["needs_sonnet"]:
            current_result = self.call_sonnet(
                ingest_result["image_bytes"],
                ocr_result["ocr_text"],
                classification,
                request_context,
                current_result,
            )

        if route["needs_retry"] and current_result.get("model_used") == MODEL_SONNET:
            current_result = self.retry_logic(
                current_result,
                ingest_result["image_bytes"],
                ocr_result["ocr_text"],
                classification,
                request_context,
            )

        if route["needs_opus"]:
            sonnet_confidence = float(current_result.get("overall_confidence") or 0.0)
            if current_result.get("model_used") == MODEL_SONNET and sonnet_confidence < MEDIUM_CONFIDENCE_THRESHOLD:
                current_result = self.call_opus(
                    current_result,
                    ingest_result["image_bytes"],
                    ocr_result["ocr_text"],
                    classification,
                    request_context,
                )

        validation = self.validate(current_result, classification, request_context)
        output = self.format_output(request_context, current_result=current_result, classification=classification, validation=validation)
        request_context["output"] = output

        user_id = str(request_context.get("user_id") or "anonymous")
        with _USER_BUDGET_LOCK:
            _USER_BUDGET_SPEND[user_id] += float(output["processing"]["cost"])

        return {
            "output": output,
            "request_context": request_context,
            "classification": classification,
            "ocr_result": ocr_result,
            "current_result": current_result,
            "validation": validation,
        }


def build_structured_ocr_result(
    image_bytes: bytes,
    *,
    base_result: OcrResult,
    used_language: str,
    fallback_used: bool,
    template: OcrTemplate | None = None,
    doc_type_hint: str | None = None,
    force_model: str | None = None,
    user_id: int | str | None = None,
) -> dict[str, Any]:
    orchestrator = OCROrchestrator()
    processed = orchestrator.process(
        image_bytes,
        {
            "base_ocr_result": base_result,
            "used_language": used_language,
            "fallback_used": fallback_used,
            "template": template,
            "doc_type_hint": doc_type_hint,
            "force_model": force_model,
            "user_id": user_id,
            "columns": getattr(template, "columns", 0) if template else 3,
            "enable_raw_column": bool(getattr(template, "enable_raw_column", False)) if template else False,
        },
    )

    strict_output = processed["output"]
    ocr_result = processed["ocr_result"]
    current_result = processed["current_result"]
    classification = processed["classification"]

    headers, rows = _legacy_rows_from_extracted_data(
        current_result.get("extracted_data", {}),
        ocr_result.get("rows", []),
    )
    warnings = list(dict.fromkeys((ocr_result.get("warnings") or []) + [issue["reason"] for issue in processed["validation"]["issues"]]))
    routing = {
        "clarity_score": float(processed["request_context"]["composite_confidence"]["overall"]),
        "score_reason": "Composite OCR confidence determined the final route.",
        "model_tier": current_result.get("tier", "ocr"),
        "forced": bool(force_model),
        "scorer_used": True,
        "actual_cost_usd": float(strict_output["processing"]["cost"]),
        "cost_saved_usd": round(max(0.0, MAX_COST_PER_REQUEST - float(strict_output["processing"]["cost"])), 6),
        "provider_used": "anthropic" if current_result.get("model_used") in {MODEL_SONNET, MODEL_OPUS} else "tesseract",
        "provider_model": current_result.get("model_used", MODEL_TESSERACT),
        "ai_applied": current_result.get("model_used") in {MODEL_SONNET, MODEL_OPUS},
        "ai_attempted": bool(processed["request_context"]["model_calls"]),
        "ai_degraded_to_base": current_result.get("model_used") == MODEL_TESSERACT and bool(processed["request_context"].get("model_blocked_reason") or processed["request_context"].get("sonnet_error")),
        "model_calls": int(processed["request_context"]["model_calls"]),
        "retries": int(processed["request_context"].get("retries", 0)),
    }

    return {
        "type": classification["document_type"],
        "title": _title_from_hint(doc_type_hint, template),
        "headers": headers,
        "rows": rows,
        "raw_text": ocr_result.get("ocr_text"),
        "language": used_language,
        "confidence": round(float(strict_output["confidence"]["overall"]) * 100.0, 2),
        "warnings": warnings,
        "routing": routing,
        "columns": max(len(headers), max((len(row) for row in rows), default=0), 1),
        "avg_confidence": round(float(ocr_result.get("average_confidence") or 0.0) * 100.0, 2),
        "cell_confidence": ocr_result.get("cell_confidence") or [],
        "cell_boxes": ocr_result.get("cell_boxes") or [],
        "used_language": ocr_result.get("used_language", used_language),
        "fallback_used": bool(ocr_result.get("fallback_used", fallback_used)),
        "raw_column_added": bool(ocr_result.get("raw_column_added", False)),
        "reused": False,
        "reused_verification_id": None,
        "status": strict_output["status"],
        "document_type": strict_output["document_type"],
        "extracted_data": strict_output["extracted_data"],
        "processing": strict_output["processing"],
        "orchestrator_result": strict_output,
    }
