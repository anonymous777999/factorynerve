"""
Comprehensive test suite for OCR Document Intelligence Pipeline

Tests all critical functionality with concrete inputs and expected outputs.
No abstract category tests - every test has specific input/output pairs.
"""

import json
import pytest
from datetime import datetime, timezone

# Import modules under test
from backend.services.ocr_schema_validator import (
    detect_response_format,
    parse_json_response,
    parse_text_response,
    detect_document_type,
    flatten_value,
    normalize_column_name,
    normalize_rows,
    normalize_rows_generic_table,
    normalize_rows_unknown_document,
    validate_rows_before_export,
    SchemaValidator,
    NormalizedRow,
    RowMetadata,
    ExportValidationError,
)
from backend.services.anthropic_usage import normalize_anthropic_model_name
from backend.services.ocr_retry_logic import (
    calculate_retry_delay,
    is_retryable_http_error,
    is_retryable_exception,
    is_retryable_failure_reason,
)


# ==============================================================================
# TEST 1: JSON blob detection and flattening (Bug #16)
# ==============================================================================

def test_json_blob_is_flattened_to_rows():
    """
    Critical test: Ensure JSON blobs are parsed to rows, not written as single cell.
    
    This was the exact bug found in Sonnet exports - responses came back as JSON
    but were being written as a single cell containing the JSON string.
    """
    # Exact format that was causing the bug
    raw = json.dumps({
        "entries": [
            {"particulars": "Cash A/c", "debit": "10000", "credit": ""},
            {"particulars": "To Capital A/c", "debit": "", "credit": "10000"}
        ]
    })
    
    # Step 1: Detect format
    format_type = detect_response_format(raw)
    assert format_type == 'json', "Should detect JSON format"
    
    # Step 2: Parse JSON
    rows = parse_json_response(raw)
    assert rows is not None, "Should successfully parse JSON"
    assert len(rows) == 2, f"Should extract 2 rows, got {len(rows)}"
    
    # Step 3: Verify row data
    assert rows[0]["particulars"] == "Cash A/c"
    assert rows[0]["debit"] == "10000"
    
    # Step 4: Normalize rows
    validator = SchemaValidator()
    metadata_base = {"model": "sonnet", "source_image": "test.jpg"}
    normalized = normalize_rows(rows, "ledger", validator, metadata_base)
    
    assert len(normalized) == 2, f"Should have 2 normalized rows, got {len(normalized)}"
    assert normalized[0].data["particulars"] == "Cash A/c"
    assert normalized[0].data["debit"] == "10000"
    
    # Step 5: CRITICAL - ensure no JSON string in cell values
    for row in normalized:
        for key, value in row.data.items():
            if value is not None:
                value_str = str(value).strip()
                assert not value_str.startswith('{'), f"Found raw JSON in cell: {value_str[:50]}"
                assert not value_str.startswith('['), f"Found raw JSON array in cell: {value_str[:50]}"


def test_text_format_detection():
    """Test that text responses are detected correctly"""
    text_response = "Name | ID | Amount\nJohn | 123 | 500\nJane | 456 | 750"
    
    format_type = detect_response_format(text_response)
    assert format_type == 'text', "Should detect text format"
    
    rows = parse_text_response(text_response)
    assert len(rows) == 2, f"Should parse 2 data rows, got {len(rows)}"
    assert rows[0]["Name"] == "John"


# ==============================================================================
# TEST 2: Model name normalization (Bug #17)
# ==============================================================================

def test_oppus_normalized_to_opus():
    """Test that common typo 'oppus' is normalized to 'opus'"""
    assert normalize_anthropic_model_name("oppus") == "claude-opus-4-7"
    assert normalize_anthropic_model_name("Oppus") == "claude-opus-4-7"
    assert normalize_anthropic_model_name("OPPUS") == "claude-opus-4-7"


def test_model_name_case_insensitive():
    """Test that model name normalization is case-insensitive"""
    assert normalize_anthropic_model_name("Sonnet") == "claude-sonnet-4-6"
    assert normalize_anthropic_model_name("HAIKU") == "claude-haiku-4-5-20251001"
    assert normalize_anthropic_model_name("opus") == "claude-opus-4-7"


def test_unknown_model_returns_none():
    """Test that unknown model names return None"""
    assert normalize_anthropic_model_name("gpt4") is None
    assert normalize_anthropic_model_name("unknown") is None
    assert normalize_anthropic_model_name("") is None


# ==============================================================================
# TEST 3: Confidence is metadata, not data column (Bug #1)
# ==============================================================================

def test_confidence_is_metadata_not_data():
    """
    Critical test: Confidence must NEVER appear as a data column.
    
    It belongs in RowMetadata, not in the data dict alongside document fields.
    """
    # Raw row with confidence field (using ledger schema columns)
    raw_rows = [
        {"particulars": "Sales", "debit": "1000", "credit": "", "confidence": 0.95}
    ]
    
    validator = SchemaValidator()
    metadata_base = {
        "confidence": 0.95,  # Confidence goes in metadata
        "model": "sonnet",
        "source_image": "test.jpg"
    }
    
    normalized = normalize_rows(raw_rows, "ledger", validator, metadata_base)
    
    assert len(normalized) == 1
    
    # CRITICAL: confidence must NOT be in data
    assert "confidence" not in normalized[0].data, "Confidence should not be in data columns"
    
    # Confidence should be in metadata
    assert normalized[0].meta.confidence == 0.95, "Confidence should be in metadata"
    
    # Data should only have document fields (ledger schema columns)
    assert "particulars" in normalized[0].data
    assert "debit" in normalized[0].data
    assert "credit" in normalized[0].data


# ==============================================================================
# TEST 4: generic_table uses first row as headers (Bug #12)
# ==============================================================================

def test_generic_table_dynamic_headers():
    """
    Test that generic_table extracts headers from first row.
    
    Headers should be normalized: lowercase, spaces→underscores, special chars removed.
    """
    raw_rows = [
        ["Item Name", "Price (₹)", "Qty"],
        ["Pen", "10", "50"],
        ["Notebook", "45", "20"]
    ]
    
    validator = SchemaValidator()
    metadata_base = {"model": "haiku", "source_image": "test.jpg"}
    
    normalized = normalize_rows_generic_table(raw_rows, validator, metadata_base)
    
    assert len(normalized) == 2, f"Should have 2 data rows, got {len(normalized)}"
    
    # Check normalized header names
    assert "item_name" in normalized[0].data, "Should have normalized 'item_name' column"
    assert "price" in normalized[0].data, "Should have normalized 'price' column"
    assert "qty" in normalized[0].data, "Should have normalized 'qty' column"
    
    # Check data values
    assert normalized[0].data["item_name"] == "Pen"
    assert normalized[0].data["price"] == "10"
    assert normalized[0].data["qty"] == "50"


def test_column_name_normalization():
    """Test column name normalization edge cases"""
    assert normalize_column_name("Item Name") == "item_name"
    assert normalize_column_name("Price (₹)") == "price"
    assert normalize_column_name("Tax %") == "tax"
    assert normalize_column_name("Sr. No.") == "sr_no"
    assert normalize_column_name("  Multiple   Spaces  ") == "multiple_spaces"


# ==============================================================================
# TEST 5: unknown_document preserves structure safely (Bug #13)
# ==============================================================================

def test_unknown_document_preserved_safely():
    """
    Test that unknown documents are preserved with flattened nested structures.
    
    Nested dicts/lists must be flattened, not written as JSON blobs.
    """
    raw_rows = [
        {"field_a": "val1", "nested": {"x": 1, "y": 2}},
        {"field_a": "val2", "nested": ["item1", "item2"]}
    ]
    
    validator = SchemaValidator()
    metadata_base = {"model": "opus", "source_image": "test.jpg"}
    
    normalized = normalize_rows_unknown_document(raw_rows, validator, metadata_base)
    
    assert len(normalized) == 2
    
    # Check metadata
    assert normalized[0].meta.doc_type == "unknown_document"
    
    # CRITICAL: nested dict must be flattened, not JSON string
    nested_value = normalized[0].data.get("nested")
    assert isinstance(nested_value, str), "Nested value should be flattened to string"
    assert not nested_value.startswith('{'), "Should not be raw JSON"
    assert "x:1" in nested_value, "Should contain flattened key-value pairs"
    assert "y:2" in nested_value, "Should contain flattened key-value pairs"
    
    # Check list flattening
    nested_list = normalized[1].data.get("nested")
    assert isinstance(nested_list, str)
    assert "item1" in nested_list
    assert "item2" in nested_list


def test_flatten_value_edge_cases():
    """Test flatten_value with various input types"""
    # Primitives pass through
    assert flatten_value("text") == "text"
    assert flatten_value(123) == 123
    assert flatten_value(45.67) == 45.67
    assert flatten_value(None) is None
    
    # Dict flattens
    result = flatten_value({"a": 1, "b": 2})
    assert isinstance(result, str)
    assert "a:1" in result
    assert "b:2" in result
    
    # List flattens
    result = flatten_value(["x", "y", "z"])
    assert result == "x, y, z"


# ==============================================================================
# TEST 6: Export validation blocks raw JSON cells (Bug #16)
# ==============================================================================

def test_export_rejects_json_in_cells():
    """
    Test that export validation catches raw JSON strings in cells.
    
    This is the final safety check before writing to Excel.
    """
    # Create rows with a JSON string that slipped through
    bad_rows = [
        NormalizedRow(
            data={"particulars": '{"raw": "json", "nested": "data"}'},
            meta=RowMetadata(model="sonnet", source_image="test.jpg")
        )
    ]
    
    errors = validate_rows_before_export(bad_rows)
    
    # Should detect the JSON string
    assert len(errors) > 0, "Should detect JSON in cell"
    assert any("json" in err.lower() for err in errors), "Error should mention JSON"


def test_export_validates_column_consistency():
    """Test that all rows must have same columns"""
    rows = [
        NormalizedRow(
            data={"col1": "val1", "col2": "val2"},
            meta=RowMetadata(model="haiku", source_image="test.jpg")
        ),
        NormalizedRow(
            data={"col1": "val1", "col3": "val3"},  # Different columns!
            meta=RowMetadata(model="haiku", source_image="test.jpg")
        )
    ]
    
    errors = validate_rows_before_export(rows)
    assert len(errors) > 0, "Should detect column mismatch"
    assert any("column" in err.lower() for err in errors)


# ==============================================================================
# TEST 7: Retry logic - non-retryable failures (Bug #3, #4)
# ==============================================================================

def test_json_parse_error_not_retryable():
    """
    Test that JSON parse errors are NOT retryable.
    
    Retrying won't fix a structurally broken response.
    """
    assert not is_retryable_failure_reason("json_parse_error")
    assert not is_retryable_failure_reason("schema_mismatch")
    assert not is_retryable_failure_reason("empty_response")


def test_transient_errors_are_retryable():
    """Test that network/timeout errors ARE retryable"""
    # HTTP status codes
    assert is_retryable_http_error(429), "HTTP 429 should be retryable"
    assert is_retryable_http_error(503), "HTTP 503 should be retryable"
    assert is_retryable_http_error(504), "HTTP 504 should be retryable"
    
    # Non-retryable HTTP codes
    assert not is_retryable_http_error(400), "HTTP 400 should not be retryable"
    assert not is_retryable_http_error(401), "HTTP 401 should not be retryable"
    assert not is_retryable_http_error(403), "HTTP 403 should not be retryable"
    
    # Exception types
    assert is_retryable_exception(TimeoutError())
    assert is_retryable_exception(ConnectionError())
    assert not is_retryable_exception(ValueError())


def test_retry_delay_exponential_backoff():
    """Test that retry delay follows exponential backoff"""
    # Without jitter for predictable testing
    delay0 = calculate_retry_delay(0, base_delay=1.0, max_delay=30.0, jitter=False)
    delay1 = calculate_retry_delay(1, base_delay=1.0, max_delay=30.0, jitter=False)
    delay2 = calculate_retry_delay(2, base_delay=1.0, max_delay=30.0, jitter=False)
    
    # Should double each time: 1s → 2s → 4s
    assert delay0 == 1.0
    assert delay1 == 2.0
    assert delay2 == 4.0
    
    # Should cap at max_delay
    delay_huge = calculate_retry_delay(100, base_delay=1.0, max_delay=30.0, jitter=False)
    assert delay_huge == 30.0


# ==============================================================================
# TEST 8: Document type detection
# ==============================================================================

def test_detect_ledger_document():
    """Test ledger document detection"""
    text = "Journal Entry with Dr and Cr columns showing debit and credit particulars"
    doc_type = detect_document_type(text)
    assert doc_type == "ledger"


def test_detect_invoice_document():
    """Test invoice document detection"""
    text = "Tax Invoice No. INV-001 with CGST, SGST, HSN code and qty, rate"
    doc_type = detect_document_type(text)
    assert doc_type == "invoice"


def test_detect_unknown_document():
    """Test unknown document detection"""
    text = "Some random text with no recognizable keywords"
    doc_type = detect_document_type(text)
    assert doc_type == "unknown_document"


# ==============================================================================
# TEST 9: Schema loading and validation
# ==============================================================================

def test_schema_validator_loads_config():
    """Test that SchemaValidator loads schemas from config"""
    validator = SchemaValidator()
    
    # Should have loaded schemas
    assert len(validator.schemas) > 0, "Should load schemas from config"
    assert "ledger" in validator.schemas
    assert "invoice" in validator.schemas
    assert "generic_table" in validator.schemas


def test_schema_validator_returns_columns():
    """Test getting columns for document type"""
    validator = SchemaValidator()
    
    required, optional = validator.get_columns("ledger")
    
    # Ledger should have these columns based on config
    assert "date" in required
    assert "particulars" in required
    assert "debit" in required
    assert "credit" in required


def test_schema_validator_unknown_type_fallback():
    """Test that unknown types fall back gracefully"""
    validator = SchemaValidator()
    
    schema = validator.get_schema("nonexistent_type")
    
    # Should return unknown_document schema as fallback
    assert schema is not None
    assert schema.get("columns") == []


# ==============================================================================
# TEST 10: Integration test - end to end
# ==============================================================================

def test_end_to_end_json_to_normalized_rows():
    """
    Integration test: Full pipeline from JSON response to normalized rows.
    
    Tests the complete flow that would happen in production.
    """
    # Step 1: Receive JSON response from API
    raw_api_response = json.dumps({
        "entries": [
            {"date": "2024-01-01", "particulars": "Cash", "debit": "5000", "credit": ""},
            {"date": "2024-01-01", "particulars": "Sales", "debit": "", "credit": "5000"},
        ]
    })
    
    # Step 2: Detect format
    fmt = detect_response_format(raw_api_response)
    assert fmt == 'json'
    
    # Step 3: Parse JSON
    rows = parse_json_response(raw_api_response)
    assert rows is not None
    assert len(rows) == 2
    
    # Step 4: Detect document type (would use OCR text in production)
    doc_type = detect_document_type("ledger with debit credit entries")
    assert doc_type == "ledger"
    
    # Step 5: Normalize rows with schema
    validator = SchemaValidator()
    metadata = {
        "confidence": 0.92,
        "model": "claude-sonnet-4-6",
        "source_image": "ledger_scan.jpg",
        "bbox_json": json.dumps({"x": 10, "y": 20, "width": 100, "height": 50}),
    }
    
    normalized = normalize_rows(rows, doc_type, validator, metadata)
    
    # Verify normalized structure
    assert len(normalized) == 2
    assert isinstance(normalized[0], NormalizedRow)
    
    # Verify data is clean
    assert "date" in normalized[0].data
    assert "particulars" in normalized[0].data
    assert "debit" in normalized[0].data
    assert "credit" in normalized[0].data
    
    # Verify metadata is separate
    assert normalized[0].meta.confidence == 0.92
    assert normalized[0].meta.model == "claude-sonnet-4-6"
    assert normalized[0].meta.doc_type == "ledger"
    
    # Step 6: Validate before export
    errors = validate_rows_before_export(normalized)
    assert len(errors) == 0, f"Should have no validation errors, got: {errors}"


if __name__ == "__main__":
    pytest.main([__file__, "-v", "--tb=short"])
