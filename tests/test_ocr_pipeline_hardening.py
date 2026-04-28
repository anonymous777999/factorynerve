from __future__ import annotations

from backend.ocr_utils import OcrResult
from backend.routers import ocr as ocr_router
from backend.services import ocr_routing
from backend.services.ocr_document_pipeline import (
    _reuse_has_remote_ai,
    build_structured_ocr_result,
)
from backend import table_scan


def test_choose_ocr_route_defaults_fast_when_quality_analysis_fails(monkeypatch):
    def boom(_image_bytes: bytes):
        raise RuntimeError("quality crash")

    monkeypatch.setattr(ocr_routing, "analyze_image_quality", boom)

    route = ocr_routing.choose_ocr_route(b"fake-image")

    assert route["model_tier"] == "fast"
    assert route["scorer_used"] is False


def test_choose_ocr_route_promotes_generic_table_to_balanced(monkeypatch):
    class Quality:
        blur_variance = 180.0
        brightness_mean = 128.0
        glare_ratio = 0.0
        warnings: list[str] = []

    monkeypatch.setattr(ocr_routing, "analyze_image_quality", lambda _image_bytes: Quality())

    route = ocr_routing.choose_ocr_route(b"fake-image", doc_type_hint="table")

    assert route["model_tier"] == "balanced"
    assert "structured table extraction requested" in route["score_reason"]


def test_table_scan_defaults_to_tesseract_without_ai_keys(monkeypatch):
    monkeypatch.delenv("TABLE_SCAN_PROVIDER", raising=False)
    monkeypatch.delenv("LEDGER_SCAN_PROVIDER", raising=False)
    monkeypatch.delenv("ANTHROPIC_API_KEY", raising=False)
    monkeypatch.delenv("BYTEZ_API_KEY", raising=False)

    assert table_scan._table_scan_provider() == "tesseract"
    assert table_scan._table_scan_provider_chain(None)[0] == "tesseract"


def test_table_scan_tesseract_provider_returns_table(monkeypatch):
    monkeypatch.setenv("TABLE_SCAN_PROVIDER", "tesseract")
    monkeypatch.setenv("TABLE_SCAN_PROVIDER_CHAIN", "tesseract")
    monkeypatch.setattr(table_scan, "preprocess_image_bytes", lambda *_args, **_kwargs: "ZmFrZQ==")
    monkeypatch.setattr(
        table_scan,
        "_call_local_tesseract",
        lambda _image_bytes: {"headers": ["Date", "Qty"], "rows": [["2026-04-28", "12"]]},
    )

    result = table_scan.extract_table_from_image(b"fake-image")

    assert result["headers"] == ["Date", "Qty"]
    assert result["rows"] == [["2026-04-28", "12"]]


def test_build_structured_ocr_result_survives_routing_failure(monkeypatch):
    monkeypatch.setattr(
        "backend.services.ocr_document_pipeline.choose_ocr_route",
        lambda *_args, **_kwargs: (_ for _ in ()).throw(RuntimeError("routing broke")),
    )
    monkeypatch.setattr(
        "backend.services.ocr_document_pipeline.extract_table_from_image",
        lambda *_args, **_kwargs: {
            "headers": ["Column 1", "Column 2"],
            "rows": [["A", "B"]],
            "provider_used": "anthropic",
            "provider_model": "claude-3-5-haiku-20241022",
            "ai_applied": True,
        },
    )

    base_result = OcrResult(rows=[["A", "B"]], avg_confidence=48.0, warnings=["low confidence"])
    result = build_structured_ocr_result(
        b"fake-image",
        base_result=base_result,
        used_language="eng",
        fallback_used=False,
        doc_type_hint="table",
    )

    assert result["rows"] == [["A", "B"]]
    assert result["routing"]["model_tier"] == "balanced"
    assert result["routing"]["provider_used"] == "anthropic"


def test_structured_ocr_result_uses_ai_enhancement_for_balanced_table_route(monkeypatch):
    monkeypatch.setattr(
        "backend.services.ocr_document_pipeline.choose_ocr_route",
        lambda *_args, **_kwargs: {
            "clarity_score": 52.0,
            "score_reason": "blur lowered clarity",
            "model_tier": "balanced",
            "forced": False,
            "scorer_used": True,
            "actual_cost_usd": 0.0035,
            "cost_saved_usd": 0.0105,
        },
    )

    calls = {"count": 0}

    def fake_ai_extract(_image_bytes: bytes, **_kwargs):
        calls["count"] += 1
        return {"headers": ["Date", "Qty"], "rows": [["2026-04-28", "12"]]}

    monkeypatch.setattr(
        "backend.services.ocr_document_pipeline.extract_table_from_image",
        fake_ai_extract,
    )

    base_result = OcrResult(
        rows=[["Date", "Qty"], ["2026-04-28", "12"]],
        avg_confidence=42.0,
        warnings=["low confidence"],
    )
    result = build_structured_ocr_result(
        b"fake-image",
        base_result=base_result,
        used_language="eng",
        fallback_used=False,
        doc_type_hint="table",
    )

    assert calls["count"] == 1
    assert result["rows"] == [["2026-04-28", "12"]]


def test_structured_ocr_result_skips_ai_enhancement_for_fast_route(monkeypatch):
    monkeypatch.setattr(
        "backend.services.ocr_document_pipeline.choose_ocr_route",
        lambda *_args, **_kwargs: {
            "clarity_score": 96.0,
            "score_reason": "very clear image",
            "model_tier": "fast",
            "forced": False,
            "scorer_used": True,
            "actual_cost_usd": 0.0008,
            "cost_saved_usd": 0.0132,
        },
    )

    calls = {"count": 0}

    def fake_ai_extract(_image_bytes: bytes, **_kwargs):
        calls["count"] += 1
        return {"headers": ["Date", "Qty"], "rows": [["2026-04-28", "12"]]}

    monkeypatch.setattr(
        "backend.services.ocr_document_pipeline.extract_table_from_image",
        fake_ai_extract,
    )

    base_result = OcrResult(
        rows=[["Date", "Qty"], ["2026-04-28", "12"]],
        avg_confidence=84.0,
        warnings=[],
    )
    result = build_structured_ocr_result(
        b"fake-image",
        base_result=base_result,
        used_language="eng",
        fallback_used=False,
        doc_type_hint="register",
    )

    assert calls["count"] == 0
    assert result["rows"] == [["Date", "Qty"], ["2026-04-28", "12"]]


def test_structured_ocr_result_uses_ai_enhancement_when_base_result_is_sparse(monkeypatch):
    monkeypatch.setattr(
        "backend.services.ocr_document_pipeline.choose_ocr_route",
        lambda *_args, **_kwargs: {
            "clarity_score": 38.0,
            "score_reason": "blur lowered clarity",
            "model_tier": "best",
            "forced": False,
            "scorer_used": True,
            "actual_cost_usd": 0.014,
            "cost_saved_usd": 0.0,
        },
    )

    calls = {"count": 0}

    def fake_ai_extract(_image_bytes: bytes, **_kwargs):
        calls["count"] += 1
        return {"headers": ["Date", "Qty"], "rows": [["2026-04-28", "12"]]}

    monkeypatch.setattr(
        "backend.services.ocr_document_pipeline.extract_table_from_image",
        fake_ai_extract,
    )

    base_result = OcrResult(
        rows=[[""]],
        avg_confidence=11.0,
        warnings=["low confidence"],
    )
    result = build_structured_ocr_result(
        b"fake-image",
        base_result=base_result,
        used_language="eng",
        fallback_used=False,
        doc_type_hint="table",
    )

    assert calls["count"] == 1
    assert result["rows"] == [["2026-04-28", "12"]]


def test_structured_ocr_result_marks_anthropic_provider(monkeypatch):
    monkeypatch.setattr(
        "backend.services.ocr_document_pipeline.choose_ocr_route",
        lambda *_args, **_kwargs: {
            "clarity_score": 61.0,
            "score_reason": "structured table extraction requested",
            "model_tier": "balanced",
            "forced": False,
            "scorer_used": True,
            "actual_cost_usd": 0.0035,
            "cost_saved_usd": 0.0105,
        },
    )
    monkeypatch.setattr(
        "backend.services.ocr_document_pipeline.extract_table_from_image",
        lambda *_args, **_kwargs: {
            "headers": ["Date", "Qty"],
            "rows": [["2026-04-28", "12"]],
            "raw_text": "Date Qty",
            "provider_used": "anthropic",
            "provider_model": "claude-3-5-haiku-20241022",
            "ai_applied": True,
        },
    )

    result = build_structured_ocr_result(
        b"fake-image",
        base_result=OcrResult(rows=[["A"]], avg_confidence=41.0, warnings=[]),
        used_language="eng",
        fallback_used=False,
        doc_type_hint="table",
    )

    assert result["routing"]["provider_used"] == "anthropic"
    assert result["routing"]["ai_applied"] is True
    assert result["rows"] == [["2026-04-28", "12"]]


def test_structured_ocr_result_requires_remote_ai_for_table(monkeypatch):
    monkeypatch.setattr(
        "backend.services.ocr_document_pipeline.choose_ocr_route",
        lambda *_args, **_kwargs: {
            "clarity_score": 61.0,
            "score_reason": "structured table extraction requested",
            "model_tier": "balanced",
            "forced": False,
            "scorer_used": True,
            "actual_cost_usd": 0.0035,
            "cost_saved_usd": 0.0105,
        },
    )
    monkeypatch.setattr(
        "backend.services.ocr_document_pipeline.extract_table_from_image",
        lambda *_args, **_kwargs: (_ for _ in ()).throw(RuntimeError("anthropic failed")),
    )

    try:
        build_structured_ocr_result(
            b"fake-image",
            base_result=OcrResult(rows=[["A"]], avg_confidence=41.0, warnings=[]),
            used_language="eng",
            fallback_used=False,
            doc_type_hint="table",
        )
    except RuntimeError as error:
        assert "AI table extraction failed" in str(error)
    else:
        raise AssertionError("Expected remote AI requirement to raise when AI extraction fails.")


def test_reuse_has_remote_ai_accepts_only_ai_backed_records():
    class VerificationStub:
        def __init__(self, routing_meta):
            self.routing_meta = routing_meta

    remote = VerificationStub({"provider_used": "anthropic", "ai_applied": True})
    local = VerificationStub({"provider_used": "tesseract", "ai_applied": False})
    missing = VerificationStub(None)

    assert _reuse_has_remote_ai(remote) is True
    assert _reuse_has_remote_ai(local) is False
    assert _reuse_has_remote_ai(missing) is False


def test_language_fallback_only_retries_when_primary_result_is_truly_sparse():
    usable = OcrResult(
        rows=[["Date", "Qty"], ["2026-04-28", "12"]],
        avg_confidence=24.0,
        warnings=["low confidence"],
    )
    sparse = OcrResult(
        rows=[[""]],
        avg_confidence=12.0,
        warnings=["low confidence"],
    )

    assert ocr_router._should_retry_with_fallback_language(usable) is False
    assert ocr_router._should_retry_with_fallback_language(sparse) is True
