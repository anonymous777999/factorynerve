"""
Test suite for OCR Final Stabilization Architecture.

This module tests the new layout analysis, structural grouping, and selector bridge
implementations introduced in the final OCR stabilization architecture.
"""

from __future__ import annotations

import pytest
from backend.services.ocr_layout_analysis import (
    canonicalize_bounding_box,
    suppress_repeated_headers,
    prune_empty_columns,
    calculate_layout_confidence,
    detect_heading_rows,
    detect_dual_column_structure,
    analyze_layout,
)
from backend.services.ocr_structural_grouping import (
    group_single_block,
    group_dual_column,
    group_key_value,
    analyze_and_group,
    apply_selector_bridge,
)


class TestBoundingBoxCanonicalization:
    """Test Phase 2: Bounding box canonicalization."""
    
    def test_canonicalize_dict_x1_y1_x2_y2(self):
        """Test canonicalization of x1, y1, x2, y2 format."""
        box = {"x1": 10, "y1": 20, "x2": 50, "y2": 60}
        result = canonicalize_bounding_box(box)
        
        assert result is not None
        assert result["x1"] == 10
        assert result["y1"] == 20
        assert result["x2"] == 50
        assert result["y2"] == 60
        assert result["center_x"] == 30
        assert result["center_y"] == 40
        assert result["width"] == 40
        assert result["height"] == 40
    
    def test_canonicalize_dict_left_top_right_bottom(self):
        """Test canonicalization of left, top, right, bottom format."""
        box = {"left": 10, "top": 20, "right": 50, "bottom": 60}
        result = canonicalize_bounding_box(box)
        
        assert result is not None
        assert result["x1"] == 10
        assert result["y1"] == 20
        assert result["x2"] == 50
        assert result["y2"] == 60
    
    def test_canonicalize_dict_x_y_width_height(self):
        """Test canonicalization of x, y, width, height format."""
        box = {"x": 10, "y": 20, "width": 40, "height": 40}
        result = canonicalize_bounding_box(box)
        
        assert result is not None
        assert result["x1"] == 10
        assert result["y1"] == 20
        assert result["x2"] == 50
        assert result["y2"] == 60
    
    def test_canonicalize_list_format(self):
        """Test canonicalization of list format [x1, y1, x2, y2]."""
        box = [10, 20, 50, 60]
        result = canonicalize_bounding_box(box)
        
        assert result is not None
        assert result["x1"] == 10
        assert result["y1"] == 20
        assert result["x2"] == 50
        assert result["y2"] == 60
    
    def test_canonicalize_invalid_box(self):
        """Test that invalid boxes return None."""
        assert canonicalize_bounding_box(None) is None
        assert canonicalize_bounding_box({}) is None
        assert canonicalize_bounding_box([1, 2]) is None


class TestRepeatedHeaderSuppression:
    """Test Phase 1: Repeated header suppression."""
    
    def test_suppress_repeated_single_cell_headers(self):
        """Test suppression of repeated single-cell headers."""
        rows = [
            ["Trading Account"],
            ["Trading Account"],
            ["Trading Account"],
            ["Opening Stock", "5000"],
            ["Trading Account"],
            ["Purchase", "10000"],
        ]
        
        cleaned_rows, warnings = suppress_repeated_headers(rows)
        
        # Should suppress consecutive repeated headers (3 repeats)
        assert len(cleaned_rows) < len(rows)
        assert len(warnings) > 0
        assert "Trading Account" in warnings[0]
    
    def test_preserve_data_rows(self):
        """Test that data rows are preserved."""
        rows = [
            ["Item", "Amount"],
            ["Stock", "5000"],
            ["Purchase", "10000"],
        ]
        
        cleaned_rows, warnings = suppress_repeated_headers(rows)
        
        assert len(cleaned_rows) == len(rows)
        assert len(warnings) == 0


class TestEmptyColumnPruning:
    """Test Phase 1: Empty column pruning."""
    
    def test_prune_mostly_empty_columns(self):
        """Test pruning of columns that are mostly empty."""
        headers = ["Name", "Empty1", "Value", "Empty2"]
        rows = [
            ["Item1", "", "100", ""],
            ["Item2", "", "200", ""],
            ["Item3", "", "300", ""],
            ["Item4", "", "400", ""],
        ]
        
        pruned_headers, pruned_rows, warnings = prune_empty_columns(headers, rows, threshold=0.8)
        
        # Should remove Empty1 and Empty2 columns
        assert len(pruned_headers) == 2
        assert "Empty1" not in pruned_headers
        assert "Empty2" not in pruned_headers
        assert len(warnings) > 0
    
    def test_keep_columns_with_data(self):
        """Test that columns with sufficient data are kept."""
        headers = ["Name", "Value"]
        rows = [
            ["Item1", "100"],
            ["Item2", "200"],
            ["Item3", "300"],
        ]
        
        pruned_headers, pruned_rows, warnings = prune_empty_columns(headers, rows)
        
        assert len(pruned_headers) == len(headers)
        assert len(warnings) == 0


class TestLayoutConfidence:
    """Test Phase 1: Layout confidence calculation."""
    
    def test_high_confidence_clean_table(self):
        """Test high confidence for clean table structure."""
        headers = ["Name", "Amount", "Date"]
        rows = [
            ["Item1", "100", "2024-01-01"],
            ["Item2", "200", "2024-01-02"],
            ["Item3", "300", "2024-01-03"],
        ]
        
        confidence = calculate_layout_confidence(headers, rows, heuristics_applied=["structural_grouping"])
        
        assert confidence >= 0.6  # Should have decent confidence
    
    def test_low_confidence_irregular_structure(self):
        """Test low confidence for irregular structure."""
        headers = ["Col1"]
        rows = [
            ["A"],
            ["B", "C"],
            ["D", "E", "F"],
        ]
        
        confidence = calculate_layout_confidence(headers, rows, heuristics_applied=["repeated_header_suppression"])
        
        assert confidence < 0.5  # Should have low confidence


class TestHeadingDetection:
    """Test Heuristic 1: Heading continuity detection."""
    
    def test_detect_single_cell_headings(self):
        """Test detection of single-cell headings."""
        rows = [
            ["TRADING ACCOUNT"],
            ["Item", "Amount"],
            ["Stock", "5000"],
        ]
        
        heading_indices = detect_heading_rows(rows)
        
        assert 0 in heading_indices  # First row is a heading
    
    def test_detect_repeated_headings(self):
        """Test detection of repeated identical cells."""
        rows = [
            ["Section A", "Section A"],
            ["Data1", "Value1"],
        ]
        
        heading_indices = detect_heading_rows(rows)
        
        assert 0 in heading_indices


class TestDualColumnDetection:
    """Test Heuristic 2: Dual-column structure detection."""
    
    def test_detect_dual_numeric_columns(self):
        """Test detection of dual numeric column structure."""
        rows = [
            ["Particular", "Debit", "Credit"],
            ["Opening Balance", "5000", ""],
            ["Sales", "", "10000"],
            ["Purchase", "8000", ""],
        ]
        
        is_dual = detect_dual_column_structure(rows)
        
        assert is_dual  # Should detect dual-column structure
    
    def test_reject_single_column(self):
        """Test that single-column tables are not detected as dual."""
        rows = [
            ["Item"],
            ["Value1"],
            ["Value2"],
        ]
        
        is_dual = detect_dual_column_structure(rows)
        
        assert not is_dual


class TestLayoutAnalysis:
    """Test Phase 3: Layout analysis."""
    
    def test_analyze_simple_table(self):
        """Test layout analysis of simple table."""
        headers = ["Name", "Value"]
        rows = [
            ["Item1", "100"],
            ["Item2", "200"],
        ]
        
        result = analyze_layout(headers, rows)
        
        assert result["layout_confidence"] > 0
        assert result["layout_type"] in ["single_block", "table"]
        assert "processing_time_ms" in result
    
    def test_analyze_dual_column_ledger(self):
        """Test layout analysis of dual-column ledger."""
        headers = ["Particular", "Debit", "Credit"]
        rows = [
            ["Opening", "5000", ""],
            ["Sales", "", "10000"],
            ["Purchase", "8000", ""],
        ]
        
        result = analyze_layout(headers, rows)
        
        assert result["layout_type"] == "dual_column"
        assert "dual_column_detected" in result["heuristics_applied"]


class TestStructuralGrouping:
    """Test Phase 4: Structural grouping."""
    
    def test_group_single_block(self):
        """Test single block grouping."""
        headers = ["Name", "Value"]
        rows = [["Item", "100"]]
        
        group = group_single_block(headers, rows, "Test Table")
        
        assert group["group_type"] == "single_block"
        assert group["title"] == "Test Table"
        assert group["confidence"] >= 0.8
    
    def test_group_dual_column(self):
        """Test dual-column grouping."""
        headers = ["Particular", "Debit", "Credit"]
        rows = [["Opening", "5000", ""]]
        
        group = group_dual_column(headers, rows, "Ledger")
        
        assert group["group_type"] == "dual_column"
        assert group["confidence"] >= 0.8
    
    def test_group_key_value(self):
        """Test key-value grouping."""
        rows = [
            ["Name", "John"],
            ["Age", "30"],
        ]
        
        group = group_key_value(rows, "Form Data")
        
        assert group["group_type"] == "key_value_block"
        assert len(group["headers"]) == 2
        assert group["headers"] == ["Field", "Value"]


class TestSelectorBridge:
    """Test Phase 5: Selector bridge."""
    
    def test_bridge_single_block(self):
        """Test selector bridge for single block."""
        group = group_single_block(["A", "B"], [["1", "2"]], "Test")
        output = apply_selector_bridge(group)
        
        assert output["type"] == "table"
        assert "headers" in output
        assert "rows" in output
    
    def test_bridge_dual_column(self):
        """Test selector bridge for dual-column."""
        group = group_dual_column(["Particular", "Dr", "Cr"], [["Item", "100", "200"]], "Ledger")
        output = apply_selector_bridge(group)
        
        assert output["type"] == "table"
        assert output["layout_type"] == "dual_column"
    
    def test_bridge_key_value(self):
        """Test selector bridge for key-value."""
        group = group_key_value([["Key", "Value"]], "Form")
        output = apply_selector_bridge(group)
        
        assert output["type"] == "key_value"
        assert output["layout_type"] == "key_value"


class TestIntegration:
    """Integration tests for complete pipeline."""
    
    def test_trading_account_document(self):
        """Test complete pipeline with trading account document."""
        # Simulate Trading Account with repeated headers
        headers = ["Particular", "Amount"]
        rows = [
            ["Trading Account"],
            ["Trading Account"],
            ["Opening Stock", "5000"],
            ["Trading Account"],
            ["Purchase", "10000"],
        ]
        
        # Phase 1: Suppress repeated headers
        cleaned_rows, warnings = suppress_repeated_headers(rows)
        
        # Phase 3: Analyze layout
        layout_result = analyze_layout(headers, cleaned_rows)
        
        # Phase 4-5: Group and bridge
        grouping = analyze_and_group(headers, cleaned_rows, layout_result, "Trading Account")
        
        assert len(cleaned_rows) < len(rows)  # Headers suppressed
        assert len(warnings) > 0  # Warnings generated
        assert grouping["primary_group"] is not None
        assert layout_result["layout_confidence"] > 0
    
    def test_balance_sheet_dual_column(self):
        """Test complete pipeline with balance sheet."""
        headers = ["Particular", "Assets", "Liabilities"]
        rows = [
            ["Cash", "10000", ""],
            ["Bank Loan", "", "5000"],
            ["Stock", "8000", ""],
        ]
        
        # Phase 3: Analyze layout
        layout_result = analyze_layout(headers, rows)
        
        # Verify dual-column detection
        assert layout_result["layout_type"] == "dual_column"
        assert "dual_column_detected" in layout_result["heuristics_applied"]
        
        # Phase 4-5: Group and bridge
        grouping = analyze_and_group(headers, rows, layout_result, "Balance Sheet")
        bridge_output = apply_selector_bridge(grouping["primary_group"])
        
        assert bridge_output["layout_type"] == "dual_column"
        assert bridge_output["type"] == "table"


if __name__ == "__main__":
    pytest.main([__file__, "-v"])
