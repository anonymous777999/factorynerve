from __future__ import annotations

from io import BytesIO

from PIL import Image

from backend.ocr_utils import OcrResult
from backend.services import ocr_document_pipeline as pipeline


def _png_bytes(*, width: int = 180, height: int = 120, color: tuple[int, int, int] = (255, 255, 255)) -> bytes:
    image = Image.new("RGB", (width, height), color=color)
    buffer = BytesIO()
    image.save(buffer, format="PNG")
    return buffer.getvalue()


def test_compute_confidence_caps_when_text_sanity_is_catastrophic():
    orchestrator = pipeline.OCROrchestrator()
    confidence = orchestrator.compute_confidence(
        {
            "ocr_text": "!!!!!!!!!!!!",
            "average_confidence": 0.99,
            "low_confidence_ratio": 0.0,
        },
        {"document_type": "invoice"},
        {},
    )

    assert confidence["overall"] <= 0.5
    assert confidence["level"] == "LOW"


def test_process_high_confidence_skips_ai(monkeypatch):
    orchestrator = pipeline.OCROrchestrator()
    events: list[str] = []

    monkeypatch.setattr(
        pipeline.OCROrchestrator,
        "ingest",
        lambda self, image_bytes, request_context, caller_config: {
            "ok": True,
            "image_bytes": image_bytes,
            "metadata": {"document_hash": "abc"},
        },
    )
    monkeypatch.setattr(
        pipeline.OCROrchestrator,
        "classify",
        lambda self, ingest_result, request_context, caller_config: {
            "document_type": "invoice",
            "language": "eng",
            "columns": 3,
            "column_centers": None,
            "column_keywords": None,
            "enable_raw_column": False,
        },
    )
    monkeypatch.setattr(
        pipeline.OCROrchestrator,
        "extract_ocr",
        lambda self, ingest_result, classification, request_context, caller_config: {
            "ocr_text": "Invoice 123 Date 2026-05-01 Total 450.00",
            "average_confidence": 0.96,
            "rows": [["Invoice", "123"], ["Date", "2026-05-01"], ["Total", "450.00"]],
            "headers": ["Column 1", "Column 2"],
            "cell_confidence": [],
            "cell_boxes": [],
            "warnings": [],
            "used_language": "eng",
            "fallback_used": False,
            "raw_column_added": False,
        },
    )
    monkeypatch.setattr(
        pipeline.OCROrchestrator,
        "compute_confidence",
        lambda self, ocr_result, classification, request_context: {"overall": 0.95, "level": "HIGH", "signals": {}},
    )

    def fail_sonnet(self, image_bytes, ocr_text, classification, request_context, current_result):
        events.append("sonnet")
        raise AssertionError("Sonnet should not be called for HIGH confidence.")

    monkeypatch.setattr(pipeline.OCROrchestrator, "call_sonnet", fail_sonnet)

    result = orchestrator.process(_png_bytes())

    assert events == []
    assert result["output"]["status"] == "complete"
    assert result["output"]["processing"]["model_used"] == pipeline.MODEL_TESSERACT
    assert result["request_context"]["model_calls"] == 0


def test_process_low_route_runs_sonnet_retry_then_opus_in_order(monkeypatch):
    orchestrator = pipeline.OCROrchestrator()
    events: list[str] = []

    monkeypatch.setattr(
        pipeline.OCROrchestrator,
        "ingest",
        lambda self, image_bytes, request_context, caller_config: {
            "ok": True,
            "image_bytes": image_bytes,
            "metadata": {"document_hash": "abc"},
        },
    )
    monkeypatch.setattr(
        pipeline.OCROrchestrator,
        "classify",
        lambda self, ingest_result, request_context, caller_config: {
            "document_type": "invoice",
            "language": "eng",
            "columns": 3,
            "column_centers": None,
            "column_keywords": None,
            "enable_raw_column": False,
        },
    )
    monkeypatch.setattr(
        pipeline.OCROrchestrator,
        "extract_ocr",
        lambda self, ingest_result, classification, request_context, caller_config: {
            "ocr_text": "Invoice blurry text",
            "average_confidence": 0.32,
            "rows": [["Invoice blurry text"]],
            "headers": ["Column 1"],
            "cell_confidence": [],
            "cell_boxes": [],
            "warnings": [],
            "used_language": "eng",
            "fallback_used": False,
            "raw_column_added": False,
        },
    )
    monkeypatch.setattr(
        pipeline.OCROrchestrator,
        "compute_confidence",
        lambda self, ocr_result, classification, request_context: {"overall": 0.42, "level": "LOW", "signals": {}},
    )

    def fake_sonnet(self, image_bytes, ocr_text, classification, request_context, current_result):
        events.append("sonnet")
        request_context["model_calls"] += 1
        return {
            "status": "partial",
            "tier": "sonnet",
            "model_used": pipeline.MODEL_SONNET,
            "extracted_data": {"invoice_number": "INV-1", "date": None, "total": "100"},
            "field_confidence": {"invoice_number": 0.88, "date": 0.41, "total": 0.62},
            "overall_confidence": 0.63,
        }

    def fake_retry(self, current_result, image_bytes, ocr_text, classification, request_context):
        events.append("retry")
        request_context["model_calls"] += 1
        return {
            **current_result,
            "field_confidence": {"invoice_number": 0.88, "date": 0.55, "total": 0.68},
            "overall_confidence": 0.67,
        }

    def fake_opus(self, current_result, image_bytes, ocr_text, classification, request_context):
        events.append("opus")
        request_context["model_calls"] += 1
        return {
            "status": "complete",
            "tier": "opus",
            "model_used": pipeline.MODEL_OPUS,
            "extracted_data": {"invoice_number": "INV-1", "date": "2026-05-01", "total": "100"},
            "field_confidence": {"invoice_number": 0.92, "date": 0.9, "total": 0.93},
            "overall_confidence": 0.9167,
        }

    monkeypatch.setattr(pipeline.OCROrchestrator, "call_sonnet", fake_sonnet)
    monkeypatch.setattr(pipeline.OCROrchestrator, "retry_logic", fake_retry)
    monkeypatch.setattr(pipeline.OCROrchestrator, "call_opus", fake_opus)

    result = orchestrator.process(_png_bytes())

    assert events == ["sonnet", "retry", "opus"]
    assert result["output"]["processing"]["model_used"] == pipeline.MODEL_OPUS
    assert result["output"]["status"] == "complete"


def test_call_sonnet_respects_cost_limit_before_model_call(monkeypatch):
    orchestrator = pipeline.OCROrchestrator()
    request_context = {
        "model_calls": 0,
        "total_cost": pipeline.MAX_COST_PER_REQUEST,
        "latency": 0,
        "user_id": "user-1",
        "user_budget_limit": 1.0,
    }
    current_result = {
        "status": "complete",
        "tier": "ocr",
        "model_used": pipeline.MODEL_TESSERACT,
        "extracted_data": {"total": "100"},
        "field_confidence": {"total": 0.5},
    }

    def fail_call(*args, **kwargs):
        raise AssertionError("Model call should be blocked before execution.")

    monkeypatch.setattr(pipeline, "_call_anthropic_vision", fail_call)

    result = orchestrator.call_sonnet(
        _png_bytes(),
        "Total 100",
        {"document_type": "receipt"},
        request_context,
        current_result,
    )

    assert result["model_used"] == pipeline.MODEL_TESSERACT
    assert request_context["model_calls"] == 0
    assert request_context["model_blocked_reason"] == "MAX_COST_PER_REQUEST_EXCEEDED"


def test_retry_logic_only_merges_higher_confidence_fields(monkeypatch):
    orchestrator = pipeline.OCROrchestrator()
    request_context = {
        "model_calls": 1,
        "total_cost": 0.0,
        "latency": 0,
        "user_id": "user-2",
        "user_budget_limit": 1.0,
        "retries": 0,
    }
    current_result = {
        "status": "partial",
        "tier": "sonnet",
        "model_used": pipeline.MODEL_SONNET,
        "extracted_data": {"invoice_number": "INV-1", "date": None, "total": "99"},
        "field_confidence": {"invoice_number": 0.91, "date": 0.42, "total": 0.8},
        "overall_confidence": 0.676,
    }

    monkeypatch.setattr(
        pipeline,
        "_call_anthropic_vision",
        lambda image_bytes, prompt_text, model_name: (
            {
                "document_type": "invoice",
                "extracted_data": {"date": "2026-05-02", "total": "98"},
                "field_confidence": {"date": 0.89, "total": 0.4},
            },
            '{"document_type":"invoice"}',
        ),
    )

    result = orchestrator.retry_logic(
        current_result,
        _png_bytes(),
        "Invoice INV-1 Date 2026-05-02 Total 99",
        {"document_type": "invoice"},
        request_context,
    )

    assert result["extracted_data"]["date"] == "2026-05-02"
    assert result["extracted_data"]["total"] == "99"
    assert result["field_confidence"]["date"] == 0.89
    assert result["field_confidence"]["total"] == 0.8
    assert request_context["retries"] == 1


def test_validate_flags_structural_and_semantic_issues():
    orchestrator = pipeline.OCROrchestrator()

    validation = orchestrator.validate(
        {
            "extracted_data": {"invoice_number": "INV-9", "date": "99/99/9999", "total": "-1"},
            "field_confidence": {"invoice_number": 0.92, "date": 0.4, "total": 0.5},
        },
        {"document_type": "invoice"},
        {},
    )

    assert validation["structural_passed"] is True
    assert validation["semantic_passed"] is False
    assert "date" in validation["fields_needing_review"]
    assert "total" in validation["fields_needing_review"]


def test_build_structured_ocr_result_returns_legacy_and_strict_payload(monkeypatch):
    base_result = OcrResult(rows=[["Invoice", "INV-1"]], avg_confidence=88.0, warnings=[])

    monkeypatch.setattr(
        pipeline.OCROrchestrator,
        "process",
        lambda self, image_bytes, caller_config=None: {
            "output": {
                "status": "complete",
                "document_type": "invoice",
                "extracted_data": {"invoice_number": "INV-1", "date": "2026-05-01", "total": "100"},
                "confidence": {"overall": 0.91, "level": "HIGH", "fields_needing_review": []},
                "processing": {"tier": "sonnet", "model_used": pipeline.MODEL_SONNET, "cost": 0.004, "latency": 1200},
            },
            "request_context": {
                "composite_confidence": {"overall": 0.91},
                "model_calls": 1,
                "retries": 0,
            },
            "classification": {"document_type": "invoice"},
            "ocr_result": {
                "ocr_text": "Invoice INV-1 Date 2026-05-01 Total 100",
                "rows": [["Invoice", "INV-1"]],
                "cell_confidence": [],
                "cell_boxes": [],
                "used_language": "eng",
                "fallback_used": False,
                "raw_column_added": False,
                "warnings": [],
                "average_confidence": 0.88,
            },
            "current_result": {
                "tier": "sonnet",
                "model_used": pipeline.MODEL_SONNET,
                "extracted_data": {"invoice_number": "INV-1", "date": "2026-05-01", "total": "100"},
            },
            "validation": {"issues": []},
        },
    )

    result = pipeline.build_structured_ocr_result(
        _png_bytes(),
        base_result=base_result,
        used_language="eng",
        fallback_used=False,
        doc_type_hint="invoice",
        user_id=123,
    )

    assert result["status"] == "complete"
    assert result["processing"]["model_used"] == pipeline.MODEL_SONNET
    assert result["document_type"] == "invoice"
    assert result["orchestrator_result"]["confidence"]["level"] == "HIGH"
    assert result["rows"] == [
        ["invoice_number", "INV-1"],
        ["date", "2026-05-01"],
        ["total", "100"],
    ]


def test_reuse_has_remote_ai_accepts_only_ai_backed_records():
    class VerificationStub:
        def __init__(self, routing_meta):
            self.routing_meta = routing_meta

    assert pipeline._reuse_has_remote_ai(VerificationStub({"provider_used": "anthropic", "ai_applied": True})) is True
    assert pipeline._reuse_has_remote_ai(VerificationStub({"provider_used": "tesseract", "ai_applied": False})) is False
    assert pipeline._reuse_has_remote_ai(VerificationStub(None)) is False
