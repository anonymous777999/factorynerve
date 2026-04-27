from __future__ import annotations

from backend.ocr_utils import OcrResult
from backend.routers import ocr as ocr_router
from backend.services import ocr_routing
from backend.services.ocr_document_pipeline import build_structured_ocr_result
from backend import table_scan


def test_choose_ocr_route_defaults_fast_when_quality_analysis_fails(monkeypatch):
    def boom(_image_bytes: bytes):
        raise RuntimeError("quality crash")

    monkeypatch.setattr(ocr_routing, "analyze_image_quality", boom)

    route = ocr_routing.choose_ocr_route(b"fake-image")

    assert route["model_tier"] == "fast"
    assert route["scorer_used"] is False


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

    base_result = OcrResult(rows=[["A", "B"]], avg_confidence=48.0, warnings=["low confidence"])
    result = build_structured_ocr_result(
        b"fake-image",
        base_result=base_result,
        used_language="eng",
        fallback_used=False,
        doc_type_hint="table",
    )

    assert result["rows"] == [["A", "B"]]
    assert result["routing"]["model_tier"] == "fast"


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
