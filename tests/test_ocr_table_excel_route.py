from __future__ import annotations

import base64
import json
from io import BytesIO

import pytest
from openpyxl import load_workbook
from PIL import Image

from backend.routers import ocr as ocr_router


def _make_image_bytes(fmt: str, size: tuple[int, int]) -> bytes:
    image = Image.effect_noise(size, 100).convert("RGB")
    output = BytesIO()
    save_kwargs = {"quality": 90} if fmt == "JPEG" else {}
    image.save(output, format=fmt, **save_kwargs)
    return output.getvalue()


def test_inspect_table_excel_image_scores_large_jpeg_as_high_quality():
    image_bytes = _make_image_bytes("JPEG", (720, 720))

    inspection = ocr_router._inspect_table_excel_image(
        image_bytes,
        content_type="image/jpeg",
        filename="scan.jpg",
    )

    assert inspection["image_quality_score"] == 90
    assert inspection["image_mime_type"] == "image/jpeg"
    assert ocr_router._select_table_excel_model(90) == ocr_router._TABLE_EXCEL_MODEL_HAIKU
    assert ocr_router._select_table_excel_model(60) == ocr_router._TABLE_EXCEL_MODEL_SONNET
    assert ocr_router._select_table_excel_model(30) == ocr_router._TABLE_EXCEL_MODEL_OPUS


def test_run_table_excel_pipeline_rejects_low_quality_image():
    tiny_png = _make_image_bytes("PNG", (40, 40))

    with pytest.raises(ocr_router.TableExcelRouteError) as exc_info:
        ocr_router._run_table_excel_pipeline(
            tiny_png,
            content_type="image/png",
            filename="tiny.png",
            system_prompt=None,
            user_message=None,
        )

    assert exc_info.value.status_code == 400
    assert exc_info.value.payload["error"] == "Image too vague or low quality to process"
    assert exc_info.value.payload["imageQualityScore"] == 20


def test_call_table_excel_anthropic_uses_expected_payload(monkeypatch):
    image_bytes = _make_image_bytes("PNG", (720, 720))
    captured: dict[str, object] = {}

    class FakeResponse:
        status_code = 200

        def json(self):
            return {
                "content": [
                    {
                        "type": "text",
                        "text": json.dumps({"type": "table", "headers": ["Name"], "rows": [["Amit"]]}),
                    }
                ]
            }

    def fake_post(url, *, headers=None, json=None, timeout=None):
        captured["url"] = url
        captured["headers"] = headers
        captured["json"] = json
        captured["timeout"] = timeout
        return FakeResponse()

    monkeypatch.setattr(ocr_router.requests, "post", fake_post)

    extracted = ocr_router._call_table_excel_anthropic(
        image_bytes,
        image_mime_type="image/png",
        selected_model=ocr_router._TABLE_EXCEL_MODEL_SONNET,
        system_prompt=None,
        user_message=None,
    )

    assert captured["url"] == "https://api.anthropic.com/v1/messages"
    assert captured["headers"]["Content-Type"] == "application/json"
    assert captured["headers"]["x-api-key"] == "test"
    assert captured["headers"]["anthropic-version"] == "2023-06-01"
    assert captured["json"]["model"] == ocr_router._TABLE_EXCEL_MODEL_SONNET
    assert captured["json"]["max_tokens"] == 4096
    message = captured["json"]["messages"][0]["content"]
    assert message[0]["type"] == "image"
    assert message[0]["source"]["type"] == "base64"
    assert message[0]["source"]["media_type"] == "image/png"
    assert message[0]["source"]["data"] == base64.b64encode(image_bytes).decode("utf-8")
    assert message[1]["type"] == "text"
    assert "return ONLY valid JSON" in message[1]["text"]
    assert extracted == {"type": "table", "headers": ["Name"], "rows": [["Amit"]]}


def test_run_table_excel_pipeline_builds_excel_from_form_response(monkeypatch):
    image_bytes = _make_image_bytes("JPEG", (720, 720))

    class FakeResponse:
        status_code = 200

        def json(self):
            return {
                "content": [
                    {
                        "type": "text",
                        "text": json.dumps(
                            {
                                "type": "form",
                                "fields": [
                                    {"label": "Invoice No", "value": "INV-1001"},
                                    {"label": "Amount", "value": "12500"},
                                ],
                            }
                        ),
                    }
                ]
            }

    monkeypatch.setattr(ocr_router.requests, "post", lambda *args, **kwargs: FakeResponse())

    excel_bytes, metadata = ocr_router._run_table_excel_pipeline(
        image_bytes,
        content_type="image/jpeg",
        filename="form.jpg",
        system_prompt=None,
        user_message=None,
    )

    workbook = load_workbook(BytesIO(excel_bytes))
    sheet = workbook.active

    assert sheet.title == "Extracted Data"
    assert sheet["A1"].value == "Field"
    assert sheet["B1"].value == "Value"
    assert sheet["A2"].value == "Invoice No"
    assert sheet["B2"].value == "INV-1001"
    assert sheet["A3"].value == "Amount"
    assert sheet["B3"].value == "12500"
    assert metadata["extracted_type"] == "form"
    assert metadata["total_rows"] == 2
    assert metadata["total_columns"] == 2
    assert metadata["image_quality_score"] == 90
    assert metadata["model_used"] == ocr_router._TABLE_EXCEL_MODEL_HAIKU


def test_run_table_preview_pipeline_returns_structured_rows_and_anthropic_routing(monkeypatch):
    image_bytes = _make_image_bytes("JPEG", (720, 720))

    class FakeResponse:
        status_code = 200

        def json(self):
            return {
                "content": [
                    {
                        "type": "text",
                        "text": json.dumps(
                            {
                                "type": "table",
                                "headers": ["Date", "Amount"],
                                "rows": [["2026-04-29", "1250"]],
                            }
                        ),
                    }
                ]
            }

    monkeypatch.setattr(ocr_router.requests, "post", lambda *args, **kwargs: FakeResponse())

    payload = ocr_router._run_table_preview_pipeline(
        image_bytes,
        content_type="image/jpeg",
        filename="scan.jpg",
        template=None,
        doc_type_hint="table",
        force_model="best",
        language="auto",
    )

    assert payload["type"] == "table"
    assert payload["headers"] == ["Date", "Amount"]
    assert payload["rows"] == [["2026-04-29", "1250"]]
    assert payload["routing"]["provider_used"] == "anthropic"
    assert payload["routing"]["provider_model"] == ocr_router._TABLE_EXCEL_MODEL_OPUS
    assert payload["routing"]["model_tier"] == "best"
    assert payload["routing"]["forced"] is True
    assert payload["routing"]["ai_applied"] is True
    assert payload["used_language"] == "auto"
