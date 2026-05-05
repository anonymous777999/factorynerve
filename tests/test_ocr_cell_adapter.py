"""Minimal tests for OCR cell adapter (Phase 1)."""

import pytest
from backend.services.ocr_cell_adapter import (
    normalize_cell,
    infer_column_types,
    estimate_confidence_simple,
    _is_numeric_simple,
)


def test_normalize_cell_string_to_object():
    """Test converting legacy string to cell object."""
    cell = normalize_cell("Cash", confidence=0.85)
    
    assert cell["value"] == "Cash"
    assert cell["confidence"] == 0.85


def test_normalize_cell_already_object():
    """Test that existing objects pass through."""
    cell_obj = {"value": "Bank", "confidence": 0.92}
    result = normalize_cell(cell_obj)
    
    assert result["value"] == "Bank"
    assert result["confidence"] == 0.92


def test_normalize_cell_default_confidence():
    """Test default confidence when not provided."""
    cell = normalize_cell("Test")
    
    assert cell["value"] == "Test"
    assert cell["confidence"] == 0.5  # Default


def test_infer_column_types_numeric():
    """Test numeric column detection."""
    rows = [
        ["Name", "Amount", "ID"],
        ["Cash", "14000", "101"],
        ["Bank", "5000", "102"],
        ["Loan", "₹25,000", "103"],
    ]
    
    types = infer_column_types(rows)
    
    assert types[0] == "text"     # Name column
    assert types[1] == "numeric"  # Amount column (>60% numeric)
    assert types[2] == "numeric"  # ID column (all numeric)


def test_infer_column_types_text():
    """Test text column detection."""
    rows = [
        ["Item", "Description"],
        ["A1", "First item"],
        ["A2", "Second item"],
        ["A3", "Third item"],
    ]
    
    types = infer_column_types(rows)
    
    assert types[0] == "text"  # Mixed alphanumeric = text
    assert types[1] == "text"  # Description = text


def test_infer_column_types_empty():
    """Test empty rows."""
    types = infer_column_types([])
    assert types == []


def test_is_numeric_simple_integers():
    """Test basic integer detection."""
    assert _is_numeric_simple("123") is True
    assert _is_numeric_simple("0") is True
    assert _is_numeric_simple("-456") is True


def test_is_numeric_simple_decimals():
    """Test decimal number detection."""
    assert _is_numeric_simple("123.45") is True
    assert _is_numeric_simple("0.99") is True


def test_is_numeric_simple_formatted():
    """Test formatted numbers with commas and currency."""
    assert _is_numeric_simple("1,234") is True
    assert _is_numeric_simple("14,00,000") is True
    assert _is_numeric_simple("₹1,234") is True
    assert _is_numeric_simple("$45.67") is True


def test_is_numeric_simple_not_numeric():
    """Test non-numeric strings."""
    assert _is_numeric_simple("Cash") is False
    assert _is_numeric_simple("N/A") is False
    assert _is_numeric_simple("") is False
    assert _is_numeric_simple("abc123") is False


def test_estimate_confidence_empty_cell():
    """Test that empty cells get high confidence."""
    confidence = estimate_confidence_simple("", "text")
    assert confidence == 0.99


def test_estimate_confidence_numeric_column_numeric_value():
    """Test confidence boost for numeric value in numeric column."""
    confidence = estimate_confidence_simple("14000", "numeric", base_confidence=0.7)
    assert confidence == 0.8  # 0.7 + 0.1 boost


def test_estimate_confidence_numeric_column_text_value():
    """Test confidence penalty for text value in numeric column."""
    confidence = estimate_confidence_simple("Cash", "numeric", base_confidence=0.7)
    assert confidence == 0.5  # 0.7 - 0.2 penalty


def test_estimate_confidence_text_column():
    """Test no adjustment for text column."""
    confidence = estimate_confidence_simple("Cash", "text", base_confidence=0.7)
    assert confidence == 0.7  # No change


def test_estimate_confidence_clamping():
    """Test that confidence is clamped to 0.0-1.0."""
    # High confidence doesn't exceed 1.0
    confidence = estimate_confidence_simple("123", "numeric", base_confidence=0.95)
    assert confidence <= 1.0
    
    # Low confidence doesn't go below 0.0
    confidence = estimate_confidence_simple("Text", "numeric", base_confidence=0.1)
    assert confidence >= 0.0


def test_integration_string_rows_to_cell_objects():
    """Integration test: convert string rows to cell objects."""
    rows = [
        ["Cash", "14000"],
        ["Bank", "5000"],
    ]
    
    # Infer types
    column_types = infer_column_types(rows)
    assert column_types == ["text", "numeric"]
    
    # Convert cells
    upgraded_rows = []
    for row in rows:
        upgraded_row = []
        for col_idx, cell in enumerate(row):
            cell_obj = normalize_cell(cell, confidence=0.8)
            cell_obj["confidence"] = estimate_confidence_simple(
                cell_obj["value"],
                column_types[col_idx],
                cell_obj["confidence"]
            )
            upgraded_row.append(cell_obj)
        upgraded_rows.append(upgraded_row)
    
    # Verify structure
    assert upgraded_rows[0][0]["value"] == "Cash"
    assert upgraded_rows[0][0]["confidence"] == 0.8  # Text column, no change
    
    assert upgraded_rows[0][1]["value"] == "14000"
    assert upgraded_rows[0][1]["confidence"] == 0.9  # Numeric column + numeric value = +0.1
