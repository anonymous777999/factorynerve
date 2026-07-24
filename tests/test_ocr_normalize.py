from __future__ import annotations

from backend.routers import ocr as ocr_router
from backend.routers.ocr._common import _normalize_ragged_rows


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


class TestNormalizeRaggedRows:
    """Tests for _normalize_ragged_rows merged-cell/ragged array handling."""

    def test_normalize_ragged_rows_pads_short_rows(self):
        """Short rows are padded to match the widest row."""
        headers = ["Item", "Qty", "Rate", "Amount"]
        rows = [
            ["Bolt", "5", "10", "50"],
            ["Nut", "3", "8", "24"],
            ["Total", "", "", "74"],  # Short row
        ]
        result_headers, result_rows, warnings = _normalize_ragged_rows(headers, rows)

        assert result_headers == ["Item", "Qty", "Rate", "Amount"]
        assert len(result_rows[2]) == 4  # Padded to 4 columns
        assert result_rows[2] == ["Total", "", "", "74"]
        assert len(warnings) == 0  # Not a heading row

    def test_normalize_ragged_rows_detects_merged_heading_rows(self):
        """Single-cell rows that look like section headings are detected as merged cells."""
        headers = ["Item", "Amount"]
        rows = [
            ["TRADING ACCOUNT"],  # Merged heading
            ["Opening Stock", "5000"],
            ["Purchase", "10000"],
            ["BALANCE SHEET"],  # Another merged heading
            ["Cash", "8000"],
        ]
        result_headers, result_rows, warnings = _normalize_ragged_rows(headers, rows)

        assert len(result_headers) == 2  # Headers unchanged
        assert len(result_rows) == 5  # Same number of rows
        # Merged rows padded
        assert result_rows[0] == ["TRADING ACCOUNT", ""]
        assert result_rows[3] == ["BALANCE SHEET", ""]
        # Data rows unchanged
        assert result_rows[1] == ["Opening Stock", "5000"]
        assert len(warnings) > 0  # Should have detected merged rows

    def test_normalize_ragged_rows_skips_total_rows(self):
        """Rows with total/summary keywords are NOT treated as merged headings."""
        headers = ["Item", "Debit", "Credit"]
        rows = [
            ["Opening", "5000", ""],
            ["Sales", "", "10000"],
            ["Total"],  # Total keyword row — should NOT be treated as heading
        ]
        result_headers, result_rows, warnings = _normalize_ragged_rows(headers, rows)

        # Total row should be padded, but no merged-row warning
        assert len(result_rows) == 3
        assert result_rows[2] == ["Total", "", ""]
        # No heading detection warning since "Total" is excluded
        if warnings:
            # If warnings exist, they should NOT mention "Total"
            assert all("Total" not in w for w in warnings)

    def test_normalize_ragged_rows_extends_headers_when_rows_are_wider(self):
        """When data rows have more columns than headers, headers are extended."""
        headers = ["Name"]
        rows = [
            ["Item1", "100", "2024-01-01"],
            ["Item2", "200", "2024-01-02"],
        ]
        result_headers, result_rows, warnings = _normalize_ragged_rows(headers, rows)

        assert len(result_headers) == 3
        assert result_headers[1] == "Column 2"
        assert result_headers[2] == "Column 3"
        assert len(result_rows[0]) == 3
        assert len(warnings) == 0

    def test_normalize_ragged_rows_handles_single_row_tables(self):
        """Single-row tables are handled gracefully."""
        headers = ["Name", "Value"]
        rows = [["Single", "42"]]
        result_headers, result_rows, warnings = _normalize_ragged_rows(headers, rows)

        assert result_headers == ["Name", "Value"]
        assert result_rows == [["Single", "42"]]
        assert len(warnings) == 0

    def test_normalize_ragged_rows_handles_empty_rows(self):
        """Empty row list returns empty result without error."""
        headers = ["Name", "Value"]
        result_headers, result_rows, warnings = _normalize_ragged_rows(headers, [])

        assert result_headers == ["Name", "Value"]
        assert result_rows == []
        assert len(warnings) == 0

    def test_normalize_ragged_rows_normalizes_via_extracted_json(self):
        """Integration test: _normalize_table_excel_extracted_json calls ragged rows."""
        result = ocr_router._normalize_table_excel_extracted_json(
            {
                "type": "table",
                "headers": ["Item"],
                "rows": [
                    ["SALES ACCOUNT"],  # Merged heading
                    ["Revenue", "5000", "Cost", "3000"],
                    ["GROSS PROFIT"],  # Another merged heading
                ],
            }
        )

        assert result["type"] == "table"
        assert len(result["headers"]) == 4  # Extended to match widest row
        assert result["rows"][0] == ["SALES ACCOUNT", "", "", ""]  # Padded
        assert result["rows"][1] == ["Revenue", "5000", "Cost", "3000"]  # As-is
        assert result["rows"][2] == ["GROSS PROFIT", "", "", ""]  # Padded
        assert "warnings" in result  # Should have detected merged rows
