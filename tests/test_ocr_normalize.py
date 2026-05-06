from __future__ import annotations

from backend.routers import ocr as ocr_router


def test_normalize_table_excel_value_preserves_plain_scalars():
    assert ocr_router._normalize_table_excel_value("hello") == "hello"
    assert ocr_router._normalize_table_excel_value(123) == "123"
    assert ocr_router._normalize_table_excel_value("") == ""


def test_normalize_table_excel_value_extracts_priority_scalar_keys():
    assert ocr_router._normalize_table_excel_value({"value": "₹1,500"}) == "₹1,500"
    assert ocr_router._normalize_table_excel_value({"text": "Invoice No."}) == "Invoice No."
    assert ocr_router._normalize_table_excel_value({"content": "2024-01-15"}) == "2024-01-15"
    assert ocr_router._normalize_table_excel_value({"label": "GST"}) == "GST"
    assert ocr_router._normalize_table_excel_value({"amount": 2500.0, "currency": "INR"}) == "2500.0"


def test_normalize_table_excel_value_extracts_nested_totals():
    assert (
        ocr_router._normalize_table_excel_value(
            {"totals": {"grand_total": {"value": "₹5000"}}}
        )
        == "₹5000"
    )


def test_normalize_table_excel_value_flattens_lists_of_structured_values():
    assert (
        ocr_router._normalize_table_excel_value(
            [{"text": "Item"}, {"text": "Qty"}]
        )
        == "Item, Qty"
    )
    assert (
        ocr_router._normalize_table_excel_value(["A", "B", "C"])
        == "A, B, C"
    )
    assert (
        ocr_router._normalize_table_excel_value(
            ["A", {"text": "B"}, {"value": "C"}]
        )
        == "A, B, C"
    )


def test_normalize_table_excel_value_returns_empty_for_empty_structures():
    assert ocr_router._normalize_table_excel_value(None) == ""
    assert ocr_router._normalize_table_excel_value({}) == ""
    assert ocr_router._normalize_table_excel_value([]) == ""


def test_normalize_table_excel_value_skips_metadata_fields():
    assert (
        ocr_router._normalize_table_excel_value(
            {"value": "X", "confidence": 0.9, "bbox": [1, 2, 3, 4]}
        )
        == "X"
    )
    assert (
        ocr_router._normalize_table_excel_value(
            {"confidence": 0.9, "bbox": [1, 2, 3, 4]}
        )
        == ""
    )


def test_normalize_table_excel_value_preserves_unicode():
    assert (
        ocr_router._normalize_table_excel_value({"value": "कुल राशि ₹१,५००"})
        == "कुल राशि ₹१,५००"
    )


def test_normalize_table_excel_value_falls_back_to_deepest_scalar():
    assert (
        ocr_router._normalize_table_excel_value({"foo": {"bar": "baz"}})
        == "baz"
    )


def test_normalize_table_excel_value_respects_depth_cap():
    assert (
        ocr_router._normalize_table_excel_value(
            {"a": {"b": {"c": {"d": {"value": "too deep"}}}}}
        )
        == ""
    )


def test_normalize_table_excel_extracted_json_flattens_structured_cells():
    normalized = ocr_router._normalize_table_excel_extracted_json(
        {
            "type": "table",
            "headers": [{"text": "Item"}, {"label": "Qty"}],
            "rows": [
                [{"value": "Steel Rod"}, {"amount": 12, "currency": "INR"}],
                [[{"text": "A"}, {"text": "B"}], {"totals": {"grand_total": {"value": "₹5000"}}}],
            ],
        }
    )

    assert normalized == {
        "type": "table",
        "headers": ["Item", "Qty"],
        "rows": [["Steel Rod", "12"], ["A, B", "₹5000"]],
    }
