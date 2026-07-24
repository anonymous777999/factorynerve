# OCR Backend Stabilization Analysis & Implementation Plan

**Date:** 2026-05-08  
**Scope:** Backend OCR extraction/export pipeline stabilization  
**Priority:** P0 - Production Stability Critical

---

## EXECUTIVE SUMMARY

### Current State Assessment

**✅ What's Working:**
- Frontend UI is stable (Phase 1-5 complete per audit reports)
- Basic OCR extraction works (Tesseract, Anthropic, Bytez providers)
- JSON normalization helpers exist
- Excel export functions are present
- Error boundaries in place on frontend

**❌ Critical Issues Identified:**

1. **JSON Blob Problem**: AI responses written directly into Excel cells as raw strings instead of being parsed into rows
2. **Schema Inconsistency**: Different models (Sonnet, Haiku, Opus) return different column names
3. **Silent Failures**: OCR runs fail without proper logging or retry handling
4. **Export Corruption**: Excel exports contain corrupted row structures, JSON blobs in cells
5. **Lost Metadata**: Confidence scores and metadata not preserved consistently through pipeline
6. **Missing Observability**: Failures not surfaced to users or logged properly

---

## ROOT CAUSE ANALYSIS

### Issue #1: JSON Blob in Excel Cells

**Location:** `backend/table_scan.py` line 625-670 (`_excel_safe_value`)

**Problem:**
```python
# Phase 3: Check if this is a cell object with normalized numeric value
if isinstance(value, dict):
    # If cell has normalized value, use it for Excel (true numeric cell)
    if "normalized" in value and value["normalized"] is not None:
        try:
            return float(value["normalized"])
        except (ValueError, TypeError):
            pass  # Fall through to use display value
    
    # If it's a cell object with display value, extract it
    if "value" in value:
        display_value = value["value"]
        # ... process
    else:
        # OTHER dict/list -> serialize
        value = json.dumps(value, ensure_ascii=False, default=str)
```

**Analysis:**
- Function handles cell objects correctly
- BUT: If AI returns unexpected dict structure without "value" key, it serializes entire dict to JSON string
- This JSON string then gets written directly into Excel cell
- No validation that dicts are proper cell objects before export

**Root Cause:** Lack of strict schema validation before Excel conversion

---

### Issue #2: Schema Inconsistency

**Location:** Multiple points in pipeline

**Problem Flow:**
1. `table_scan.py` line 447-503: `_normalize_table()` - attempts normalization but too permissive
2. `ocr_normalization.py` line 110-169: `normalize_structured_payload()` - handles various formats but no canonical schema
3. No enforcement of standard column names across models

**Evidence from Code:**
```python
# table_scan.py line 447
def _normalize_table(data: Any) -> dict | None:
    if not isinstance(data, dict):
        return None
    
    headers = data.get("headers")
    rows = data.get("rows")
    # ... minimal validation, no schema enforcement
```

**Root Cause:** No canonical schema definition or mapping layer between AI outputs and export

---

### Issue #3: Silent Failures

**Location:** Multiple locations lack proper error handling

**Examples:**

1. **OCR extraction failures:**
```python
# ocr_document_pipeline.py line 631
if _should_run_ai_table_enhancement(base_result, route, doc_type_hint=doc_type_hint):
    route_meta["ai_attempted"] = True
    try:
        logger.info("Structured OCR attempting AI enhancement...")
        ai_table = extract_table_from_image(...)
        # ... process result
    except Exception as error:  # TOO BROAD
        if ai_required and _structured_rows_usable(normalized.get("rows") or []):
            route_meta["ai_degraded_to_base"] = True
            # ... log but continue
        elif ai_required:
            raise RuntimeError("AI table extraction failed...") from error
        else:
            logger.warning("...")  # SILENT FAILURE for non-required
```

2. **Missing structured error logging:**
- No consistent error context (image filename, model used, timestamp)
- No failure reason categorization
- No retry attempt tracking
- Errors not stored for debugging

**Root Cause:** Inconsistent error handling, no centralized logging structure

---

### Issue #4: Export Corruption

**Location:** Excel generation in `table_scan.py`

**Problem Areas:**

1. **Row normalization issues:**
```python
# line 460-501
for row in rows:
    if isinstance(row, dict) and headers:
        row_list = [row.get(header) for header in headers]
    elif isinstance(row, list):
        row_list = row
    else:
        row_list = [row]
    
    normalized_rows.append(row_list)
    max_cols = max(max_cols, len(row_list))
```
- No validation that row length matches headers
- No detection of corrupted row structures
- Silent padding/truncation without warnings

2. **Duplicate row detection missing:**
- No deduplication logic
- Header rows can be repeated in data
- Summary rows mixed with data rows

**Root Cause:** Insufficient validation before Excel generation

---

### Issue #5: Lost Confidence Metadata

**Location:** Multiple pipeline stages

**Problem:**
```python
# ocr_document_pipeline.py line 790-800
if _ENABLE_CELL_FORMAT_V2:
    try:
        final_rows = _upgrade_rows_to_cell_objects(
            normalized_rows,
            base_result.cell_confidence
        )
        logger.info("Cell format V2 enabled: upgraded %d rows to cell objects", len(final_rows))
    except Exception as error:
        logger.warning("Cell object upgrade failed; using string rows: %s", error, exc_info=True)
        final_rows = normalized_rows  # FALLS BACK TO STRING ROWS - CONFIDENCE LOST
```

**Issues:**
- Confidence upgrade is optional (feature flag)
- Fallback to string rows loses ALL confidence data
- Excel export may or may not preserve confidence depending on feature flag
- No guarantee confidence survives the full pipeline

**Root Cause:** Confidence preservation not mandatory, too many fallback paths

---

### Issue #6: Missing Observability

**Location:** Logging infrastructure

**Current State:**
- Basic `logger.info()` and `logger.warning()` calls exist
- No structured error context
- No `/logs/ocr_failures/` directory creation
- No persistent failure tracking

**Required Structure (per user requirements):**
```
/logs/ocr_failures/
├── {timestamp}_{verification_id}.json
    ├── image_filename
    ├── raw_ai_response
    ├── parsed_response
    ├── model_used
    ├── stack_trace
    ├── timestamp
    ├── failure_reason
```

**Root Cause:** Logging infrastructure never implemented

---

## CANONICAL SCHEMA DEFINITION

### Required Standard Schema

Per user requirements, enforce this EXACT schema across ALL models:

```python
CANONICAL_LEDGER_SCHEMA = [
    "date",           # Date of transaction
    "particulars",    # Description
    "calculation",    # Optional calculation field
    "dr_cr",          # Debit/Credit indicator: "Dr" or "Cr"
    "amount",         # Numeric amount
    "confidence",     # Confidence score (0.0-1.0)
]
```

**Rules:**
- No extra columns allowed
- No renamed columns allowed
- Missing values become empty strings
- Preserve consistent column order
- Confidence MUST be preserved

---

## IMPLEMENTATION PLAN

### PHASE 1: JSON Parsing Fixes (HIGH PRIORITY)

#### Task 1.1: Add Schema Validator
**File:** `backend/services/ocr_schema_validator.py` (NEW)

```python
"""Strict schema validation and normalization for OCR outputs."""

from typing import Any, List, Dict, Optional
import logging

logger = logging.getLogger(__name__)

CANONICAL_LEDGER_SCHEMA = [
    "date",
    "particulars", 
    "calculation",
    "dr_cr",
    "amount",
    "confidence",
]

def validate_and_normalize_schema(
    data: Any,
    *,
    canonical_schema: List[str],
    allow_extra_columns: bool = False
) -> Dict[str, Any]:
    """
    Validate and normalize AI response to canonical schema.
    
    Returns:
        {
            "valid": True/False,
            "headers": [...],
            "rows": [[...]],
            "warnings": [...],
            "errors": [...]
        }
    """
    # Implementation details below
```

**Implementation:**
- Parse AI response (list/dict/string)
- Map variant column names to canonical schema
- Detect and reject extra columns (unless allowed)
- Ensure consistent column order
- Preserve confidence scores
- Return validation result with warnings/errors

#### Task 1.2: Add Column Mapping Layer
**File:** `backend/services/ocr_schema_validator.py`

```python
# Mapping of AI model variants to canonical schema
COLUMN_MAPPINGS = {
    "description": "particulars",
    "desc": "particulars",
    "particular": "particulars",
    "narration": "particulars",
    "details": "particulars",
    
    "dr": "dr_cr",
    "cr": "dr_cr",
    "debit": "dr_cr",
    "credit": "dr_cr",
    "type": "dr_cr",
    
    "value": "amount",
    "amt": "amount",
    "sum": "amount",
    
    # ... more mappings
}

def map_columns_to_canonical(headers: List[str]) -> List[str]:
    """Map variant column names to canonical schema."""
    # Normalize and map
```

#### Task 1.3: Fix Excel Safe Value Logic
**File:** `backend/table_scan.py` line 625-670

**Changes:**
```python
def _excel_safe_value(value: Any) -> Any:
    """
    Phase 3: Enhanced to use normalized numeric values for Excel cells.
    
    STRICT RULES:
    - Cell objects (dict with "value" key): Extract display value
    - Numeric values: Return as number
    - Strings: Sanitize and escape formulas
    - INVALID dicts: Log error, return "[INVALID DATA]", don't serialize to JSON
    """
    if value is None:
        return ""
    
    # ... existing logic
    
    # Phase 3: Check if this is a cell object
    if isinstance(value, dict):
        # STRICT: Only process known cell object structures
        if "value" in value or "normalized" in value:
            # Existing logic OK
            pass
        else:
            # INVALID STRUCTURE - DO NOT SERIALIZE TO JSON
            logger.error(
                "Invalid cell object structure in Excel export: %s. "
                "This indicates upstream parsing failure.",
                value
            )
            return "[INVALID DATA]"  # Visible error marker
```

**Goal:** Stop writing JSON blobs to cells, surface corruption visibly

---

### PHASE 2: Schema Enforcement Layer (HIGH PRIORITY)

#### Task 2.1: Integrate Schema Validator into Pipeline
**File:** `backend/services/ocr_document_pipeline.py`

**Location:** After AI extraction, before normalization (around line 641)

```python
# AFTER:
ai_table = extract_table_from_image(...)

# ADD SCHEMA VALIDATION:
from backend.services.ocr_schema_validator import validate_and_normalize_schema, CANONICAL_LEDGER_SCHEMA

validation_result = validate_and_normalize_schema(
    ai_table,
    canonical_schema=CANONICAL_LEDGER_SCHEMA,
    allow_extra_columns=False
)

if not validation_result["valid"]:
    logger.error(
        "Schema validation failed: %s",
        validation_result["errors"]
    )
    # Store failure for observability
    _log_ocr_failure(
        image_filename=...,
        raw_response=ai_table,
        model_used=...,
        failure_reason="schema_validation_failed",
        errors=validation_result["errors"]
    )
    
    if ai_required:
        raise RuntimeError(f"Schema validation failed: {validation_result['errors']}")

# Use validated data
candidate = {
    "headers": validation_result["headers"],
    "rows": validation_result["rows"],
    "warnings": validation_result["warnings"]
}
```

#### Task 2.2: Add Pre-Export Validation
**File:** `backend/table_scan.py`

**Location:** Before `build_table_excel_bytes()` (line 1031)

```python
def build_table_excel_bytes(
    table: dict[str, Any],
    *,
    sheet_name: str = "Table",
    metadata: dict[str, Any] | None = None,
    include_totals: bool = True,
) -> bytes:
    """Build Excel workbook with PRE-EXPORT VALIDATION."""
    
    # NEW: Validate before export
    validation_errors = _validate_table_structure(table)
    if validation_errors:
        logger.error("Table structure invalid before export: %s", validation_errors)
        raise ValueError(f"Cannot export invalid table: {validation_errors}")
    
    # Existing logic continues...
```

---

### PHASE 3: Export Stabilization (HIGH PRIORITY)

#### Task 3.1: Add Row Structure Validation
**File:** `backend/table_scan.py`

```python
def _validate_table_structure(table: dict[str, Any]) -> List[str]:
    """
    Validate table structure before Excel export.
    
    Checks:
    - Headers exist and are strings
    - Rows exist and are lists
    - All rows have same length as headers
    - No JSON objects in cells (should be flattened)
    - No duplicate rows
    - Headers not repeated in data
    """
    errors = []
    
    headers = table.get("headers")
    rows = table.get("rows")
    
    if not isinstance(headers, list):
        errors.append("Headers must be a list")
    if not isinstance(rows, list):
        errors.append("Rows must be a list")
    
    if errors:
        return errors
    
    # Check row lengths
    expected_cols = len(headers)
    for idx, row in enumerate(rows):
        if not isinstance(row, list):
            errors.append(f"Row {idx} is not a list: {type(row)}")
            continue
        
        if len(row) != expected_cols:
            errors.append(
                f"Row {idx} has {len(row)} columns, expected {expected_cols}"
            )
        
        # Check for dict/object cells
        for col_idx, cell in enumerate(row):
            if isinstance(cell, (dict, list)):
                errors.append(
                    f"Cell ({idx}, {col_idx}) contains complex object: {type(cell)}. "
                    "Should be flattened before export."
                )
    
    # Check for duplicate rows (potential header repetition)
    seen_rows = set()
    for idx, row in enumerate(rows):
        row_tuple = tuple(str(cell) for cell in row)
        if row_tuple in seen_rows:
            errors.append(f"Row {idx} is duplicate")
        seen_rows.add(row_tuple)
    
    return errors
```

#### Task 3.2: Suppress Repeated Headers
**File:** `backend/services/ocr_layout_analysis.py` (ALREADY EXISTS, line 23)

**Review:** Function `suppress_repeated_headers()` already implemented
**Action:** Ensure it's called consistently in pipeline

#### Task 3.3: Improve Excel Generation
**File:** `backend/table_scan.py` line 1031-1122

**Changes:**
- Add try/catch around workbook generation
- Log any Excel generation failures
- Validate final workbook before returning bytes
- Add corruption detection

---

### PHASE 4: Retry + Error Handling (HIGH PRIORITY)

#### Task 4.1: Create Structured Error Logger
**File:** `backend/services/ocr_error_logging.py` (NEW)

```python
"""Structured error logging for OCR operations."""

import json
import logging
from datetime import datetime, timezone
from pathlib import Path
from typing import Any, Dict, Optional
import traceback

logger = logging.getLogger(__name__)

OCR_FAILURES_DIR = Path("logs/ocr_failures")
OCR_FAILURES_DIR.mkdir(parents=True, exist_ok=True)

def log_ocr_failure(
    *,
    image_filename: str,
    raw_ai_response: Any,
    parsed_response: Any,
    model_used: str,
    failure_reason: str,
    verification_id: Optional[int] = None,
    additional_context: Optional[Dict[str, Any]] = None,
) -> str:
    """
    Log OCR failure with full context.
    
    Returns:
        Path to logged failure file
    """
    timestamp = datetime.now(timezone.utc)
    timestamp_str = timestamp.strftime("%Y%m%d_%H%M%S")
    
    failure_id = f"{timestamp_str}"
    if verification_id:
        failure_id += f"_{verification_id}"
    
    failure_file = OCR_FAILURES_DIR / f"{failure_id}.json"
    
    failure_data = {
        "timestamp": timestamp.isoformat(),
        "image_filename": image_filename,
        "verification_id": verification_id,
        "model_used": model_used,
        "failure_reason": failure_reason,
        "raw_ai_response": _serialize_safely(raw_ai_response),
        "parsed_response": _serialize_safely(parsed_response),
        "stack_trace": traceback.format_exc(),
        "additional_context": additional_context or {},
    }
    
    try:
        with open(failure_file, "w", encoding="utf-8") as f:
            json.dump(failure_data, f, indent=2, ensure_ascii=False)
        
        logger.error(
            "OCR failure logged: %s (reason: %s, model: %s)",
            failure_file,
            failure_reason,
            model_used
        )
        
        return str(failure_file)
    except Exception as e:
        logger.exception("Failed to log OCR failure to disk: %s", e)
        return ""

def _serialize_safely(obj: Any) -> Any:
    """Serialize objects safely for JSON logging."""
    if obj is None:
        return None
    if isinstance(obj, (str, int, float, bool)):
        return obj
    if isinstance(obj, (list, tuple)):
        return [_serialize_safely(item) for item in obj]
    if isinstance(obj, dict):
        return {str(k): _serialize_safely(v) for k, v in obj.items()}
    return str(obj)
```

#### Task 4.2: Add Retry Logic Wrapper
**File:** `backend/services/ocr_retry.py` (NEW)

```python
"""Retry logic for OCR operations."""

import logging
import time
from typing import Any, Callable, TypeVar, Optional

logger = logging.getLogger(__name__)

T = TypeVar('T')

def retry_with_backoff(
    func: Callable[[], T],
    *,
    max_retries: int = 3,
    initial_delay: float = 1.0,
    backoff_factor: float = 2.0,
    exceptions: tuple = (Exception,),
    operation_name: str = "operation",
) -> T:
    """
    Retry function with exponential backoff.
    
    Args:
        func: Function to retry
        max_retries: Maximum number of retry attempts
        initial_delay: Initial delay in seconds
        backoff_factor: Multiplier for delay after each retry
        exceptions: Tuple of exceptions to catch and retry
        operation_name: Name for logging
    
    Returns:
        Result from successful function call
    
    Raises:
        Last exception if all retries exhausted
    """
    last_exception = None
    delay = initial_delay
    
    for attempt in range(max_retries + 1):
        try:
            result = func()
            if attempt > 0:
                logger.info(
                    "%s succeeded on attempt %d/%d",
                    operation_name,
                    attempt + 1,
                    max_retries + 1
                )
            return result
        
        except exceptions as e:
            last_exception = e
            
            if attempt < max_retries:
                logger.warning(
                    "%s failed on attempt %d/%d: %s. Retrying in %.1fs...",
                    operation_name,
                    attempt + 1,
                    max_retries + 1,
                    e,
                    delay
                )
                time.sleep(delay)
                delay *= backoff_factor
            else:
                logger.error(
                    "%s failed after %d attempts: %s",
                    operation_name,
                    max_retries + 1,
                    e
                )
    
    # All retries exhausted
    raise last_exception
```

#### Task 4.3: Integrate Retry Logic
**File:** `backend/services/ocr_document_pipeline.py`

**Wrap AI extraction calls:**
```python
from backend.services.ocr_retry import retry_with_backoff
from backend.services.ocr_error_logging import log_ocr_failure

# Around line 641
try:
    ai_table = retry_with_backoff(
        lambda: extract_table_from_image(
            image_bytes,
            provider_preference="anthropic",
            allow_local_fallback=False,
            model_tier=str(route.get("model_tier") or "balanced"),
            requested_model=requested_model,
        ),
        max_retries=3,
        initial_delay=1.0,
        operation_name="AI table extraction"
    )
except Exception as error:
    # Log structured failure
    log_ocr_failure(
        image_filename=f"verification_{verification_id}.jpg",
        raw_ai_response=None,
        parsed_response=None,
        model_used=route_meta.get("provider_model", "unknown"),
        failure_reason="ai_extraction_failed",
        verification_id=verification_id,
        additional_context={"error": str(error)}
    )
    
    # Existing error handling continues...
```

---

### PHASE 5: Confidence Preservation (HIGH PRIORITY)

#### Task 5.1: Make Cell Format V2 Mandatory
**File:** `backend/services/ocr_document_pipeline.py`

**Change:** Remove feature flag, make confidence preservation mandatory

```python
# Line 47-48: REMOVE feature flag
# _ENABLE_CELL_FORMAT_V2 = os.getenv("CELL_FORMAT_V2", "true").lower() == "true"

# Line 791: MAKE MANDATORY
# if _ENABLE_CELL_FORMAT_V2:  # REMOVE THIS CHECK
try:
    final_rows = _upgrade_rows_to_cell_objects(
        normalized_rows,
        base_result.cell_confidence
    )
    logger.info("Upgraded %d rows to cell objects with confidence", len(final_rows))
except Exception as error:
    logger.error("Cell object upgrade FAILED - confidence will be lost: %s", error, exc_info=True)
    # DO NOT FALLBACK - raise error instead
    raise RuntimeError("Failed to preserve confidence scores") from error
```

#### Task 5.2: Validate Confidence in Export
**File:** `backend/table_scan.py`

**Add confidence validation:**
```python
def _validate_confidence_preserved(rows: list[list[Any]]) -> bool:
    """Check if confidence scores are preserved in cell objects."""
    if not rows:
        return True
    
    # Check first row structure
    first_row = rows[0]
    if not first_row:
        return True
    
    first_cell = first_row[0]
    
    # If using cell objects, they should have confidence
    if isinstance(first_cell, dict):
        has_confidence = "confidence" in first_cell
        if not has_confidence:
            logger.warning("Cell objects missing confidence scores")
        return has_confidence
    
    # String rows = confidence lost
    logger.warning("Using string rows - confidence not preserved")
    return False
```

---

### PHASE 6: Validation Layer (MEDIUM PRIORITY)

#### Task 6.1: Pre-Export Validation Suite
**File:** `backend/services/ocr_validators.py` (NEW)

```python
"""Comprehensive validation suite for OCR pipeline."""

from typing import Any, Dict, List

def validate_ocr_pipeline_output(
    data: Dict[str, Any],
    *,
    require_confidence: bool = True,
    max_rows: int = 10000,
    max_columns: int = 100,
) -> Dict[str, Any]:
    """
    Comprehensive validation before export.
    
    Returns:
        {
            "valid": bool,
            "errors": List[str],
            "warnings": List[str],
            "stats": Dict[str, Any]
        }
    """
    errors = []
    warnings = []
    
    # Required fields
    if "headers" not in data:
        errors.append("Missing 'headers' field")
    if "rows" not in data:
        errors.append("Missing 'rows' field")
    
    if errors:
        return {"valid": False, "errors": errors, "warnings": [], "stats": {}}
    
    headers = data["headers"]
    rows = data["rows"]
    
    # Validate row counts
    if len(rows) > max_rows:
        warnings.append(f"Row count ({len(rows)}) exceeds recommended maximum ({max_rows})")
    
    if len(rows) == 0:
        warnings.append("No data rows found")
    
    # Validate column counts
    if len(headers) > max_columns:
        warnings.append(f"Column count ({len(headers)}) exceeds recommended maximum ({max_columns})")
    
    # Validate row structures
    for idx, row in enumerate(rows):
        if not isinstance(row, list):
            errors.append(f"Row {idx} is not a list")
            continue
        
        if len(row) != len(headers):
            errors.append(f"Row {idx} has {len(row)} columns, expected {len(headers)}")
        
        # Check confidence if required
        if require_confidence and idx == 0:  # Check first row
            if row and isinstance(row[0], dict):
                if "confidence" not in row[0]:
                    warnings.append("Cell objects missing confidence scores")
            elif row:
                warnings.append("Using string cells - confidence not preserved")
    
    # Detect suspicious patterns
    if len(rows) > 1:
        # Check for repeated header row
        header_str = str(headers)
        first_row_str = str(rows[0])
        if header_str.lower() == first_row_str.lower():
            warnings.append("First data row appears to be header repetition")
    
    stats = {
        "row_count": len(rows),
        "column_count": len(headers),
        "error_count": len(errors),
        "warning_count": len(warnings),
    }
    
    return {
        "valid": len(errors) == 0,
        "errors": errors,
        "warnings": warnings,
        "stats": stats
    }
```

---

### PHASE 7: Acceptance Tests (CRITICAL)

#### Task 7.1: Create Test Suite
**File:** `tests/test_ocr_export_stabilization.py` (NEW)

```python
"""Tests for OCR export stabilization."""

import pytest
import json
from backend.services.ocr_schema_validator import (
    validate_and_normalize_schema,
    CANONICAL_LEDGER_SCHEMA,
)
from backend.table_scan import build_table_excel_bytes, _excel_safe_value
from openpyxl import load_workbook
from io import BytesIO

class TestJSONParsing:
    """Test JSON parsing fixes."""
    
    def test_valid_json_parsing(self):
        """Valid JSON should parse correctly."""
        ai_response = [
            {
                "date": "2024-01-01",
                "particulars": "Opening Balance",
                "dr_cr": "Dr",
                "amount": "5000",
                "confidence": 0.95
            }
        ]
        
        result = validate_and_normalize_schema(
            ai_response,
            canonical_schema=CANONICAL_LEDGER_SCHEMA
        )
        
        assert result["valid"]
        assert len(result["rows"]) == 1
        assert len(result["errors"]) == 0
    
    def test_malformed_json(self):
        """Malformed JSON should be handled safely."""
        ai_response = "{ incomplete json"
        
        result = validate_and_normalize_schema(
            ai_response,
            canonical_schema=CANONICAL_LEDGER_SCHEMA
        )
        
        assert not result["valid"]
        assert len(result["errors"]) > 0
    
    def test_missing_columns(self):
        """Missing columns should be filled with empty strings."""
        ai_response = [
            {
                "date": "2024-01-01",
                "particulars": "Test",
                # Missing: calculation, dr_cr, amount, confidence
            }
        ]
        
        result = validate_and_normalize_schema(
            ai_response,
            canonical_schema=CANONICAL_LEDGER_SCHEMA,
            allow_extra_columns=False
        )
        
        assert result["valid"]
        row = result["rows"][0]
        assert len(row) == len(CANONICAL_LEDGER_SCHEMA)
        assert row[2] == ""  # calculation
        assert row[3] == ""  # dr_cr

class TestSchemaNormalization:
    """Test schema normalization."""
    
    def test_column_name_mapping(self):
        """Variant column names should map to canonical schema."""
        ai_response = [
            {
                "date": "2024-01-01",
                "description": "Test",  # Should map to "particulars"
                "debit": "Dr",           # Should map to "dr_cr"
                "value": "1000",         # Should map to "amount"
                "confidence": 0.9
            }
        ]
        
        result = validate_and_normalize_schema(
            ai_response,
            canonical_schema=CANONICAL_LEDGER_SCHEMA
        )
        
        assert result["valid"]
        assert result["headers"] == CANONICAL_LEDGER_SCHEMA
    
    def test_extra_columns_rejected(self):
        """Extra columns should be rejected when not allowed."""
        ai_response = [
            {
                "date": "2024-01-01",
                "particulars": "Test",
                "extra_field": "Should be rejected",
                "confidence": 0.9
            }
        ]
        
        result = validate_and_normalize_schema(
            ai_response,
            canonical_schema=CANONICAL_LEDGER_SCHEMA,
            allow_extra_columns=False
        )
        
        assert not result["valid"]
        assert "extra_field" in str(result["errors"])

class TestExcelExport:
    """Test Excel export generation."""
    
    def test_excel_export_generation(self):
        """Excel export should generate valid workbook."""
        table_data = {
            "headers": CANONICAL_LEDGER_SCHEMA,
            "rows": [
                ["2024-01-01", "Test Entry", "", "Dr", "1000", "0.95"]
            ]
        }
        
        excel_bytes = build_table_excel_bytes(table_data)
        
        # Load and verify
        wb = load_workbook(BytesIO(excel_bytes))
        ws = wb.active
        
        # Check headers
        assert ws.cell(1, 1).value == "date"
        assert ws.cell(1, 6).value == "confidence"
        
        # Check data
        assert ws.cell(2, 1).value == "2024-01-01"
        assert ws.cell(2, 5).value == "1000"
    
    def test_no_json_blobs_in_cells(self):
        """Excel cells should not contain JSON strings."""
        # This tests the fix for the main issue
        table_data = {
            "headers": ["col1"],
            "rows": [
                ["normal value"],
                [{"should": "not be serialized"}],  # Invalid structure
            ]
        }
        
        # Should either reject or convert safely
        try:
            excel_bytes = build_table_excel_bytes(table_data)
            wb = load_workbook(BytesIO(excel_bytes))
            ws = wb.active
            
            # Check that cell contains error marker, not JSON blob
            cell_value = ws.cell(3, 1).value
            assert cell_value == "[INVALID DATA]" or isinstance(cell_value, str)
            assert not cell_value.startswith("{")
        except ValueError:
            # Alternatively, should reject invalid structure
            pass

class TestRetryLogic:
    """Test retry and error handling."""
    
    def test_retry_succeeds_on_second_attempt(self):
        """Retry logic should succeed after transient failure."""
        from backend.services.ocr_retry import retry_with_backoff
        
        call_count = 0
        
        def flaky_function():
            nonlocal call_count
            call_count += 1
            if call_count < 2:
                raise RuntimeError("Transient failure")
            return "success"
        
        result = retry_with_backoff(
            flaky_function,
            max_retries=3,
            initial_delay=0.1,
            operation_name="test"
        )
        
        assert result == "success"
        assert call_count == 2
    
    def test_retry_fails_after_max_attempts(self):
        """Retry logic should fail after max attempts."""
        from backend.services.ocr_retry import retry_with_backoff
        
        def always_fails():
            raise RuntimeError("Permanent failure")
        
        with pytest.raises(RuntimeError):
            retry_with_backoff(
                always_fails,
                max_retries=2,
                initial_delay=0.1,
                operation_name="test"
            )

class TestConfidencePreservation:
    """Test confidence score preservation."""
    
    def test_confidence_preserved_through_pipeline(self):
        """Confidence scores should survive full pipeline."""
        # This tests end-to-end confidence preservation
        pass  # TODO: Implement integration test

class TestValidationLayer:
    """Test validation layer."""
    
    def test_validation_detects_malformed_rows(self):
        """Validation should detect malformed row structures."""
        from backend.services.ocr_validators import validate_ocr_pipeline_output
        
        data = {
            "headers": ["col1", "col2"],
            "rows": [
                ["val1", "val2"],
                ["val1"],  # Malformed - missing column
            ]
        }
        
        result = validate_ocr_pipeline_output(data)
        
        assert not result["valid"]
        assert any("columns" in err.lower() for err in result["errors"])
    
    def test_validation_detects_suspicious_row_count(self):
        """Validation should warn about unusual patterns."""
        from backend.services.ocr_validators import validate_ocr_pipeline_output
        
        data = {
            "headers": ["col1"],
            "rows": [[f"val{i}"] for i in range(20000)]  # Excessive rows
        }
        
        result = validate_ocr_pipeline_output(data, max_rows=10000)
        
        assert len(result["warnings"]) > 0
        assert any("exceed" in w.lower() for w in result["warnings"])

class TestDuplicatePrevention:
    """Test duplicate row prevention."""
    
    def test_duplicate_rows_detected(self):
        """Duplicate rows should be detected."""
        # TODO: Implement test
        pass
```

---

## IMPLEMENTATION TIMELINE

### Week 1: Core Fixes
- [ ] Day 1-2: Implement schema validator and column mapping
- [ ] Day 2-3: Fix Excel safe value logic
- [ ] Day 3-4: Add pre-export validation
- [ ] Day 4-5: Integration testing

### Week 2: Infrastructure
- [ ] Day 1-2: Implement structured error logging
- [ ] Day 2-3: Add retry logic
- [ ] Day 3-4: Make confidence preservation mandatory
- [ ] Day 4-5: Create test suite

### Week 3: Validation & Testing
- [ ] Day 1-2: Implement validation layer
- [ ] Day 2-3: Run acceptance tests
- [ ] Day 3-4: Fix discovered issues
- [ ] Day 4-5: End-to-end verification

---

## SUCCESS CRITERIA

### Definition of Done

**DONE means:**
- ✅ No raw JSON blobs in Excel cells
- ✅ Same schema across all models (canonical enforcement)
- ✅ Stable exports (no corruption)
- ✅ Retry logic works (transient failures handled)
- ✅ Failures logged properly (structured /logs/)
- ✅ Rows exported correctly (validation passes)
- ✅ Pipeline survives malformed outputs safely
- ✅ Confidence scores preserved end-to-end
- ✅ All acceptance tests pass

---

## ROLLBACK PLAN

All changes are **modular and reversible**:

1. **Schema validator**: Optional parameter, can be disabled
2. **Error logging**: Additive, no breaking changes
3. **Retry logic**: Wrapper function, easy to remove
4. **Validation layer**: Pre-export check, can be skipped
5. **Excel fixes**: Defensive coding, safe fallbacks

**No database migrations required.**

---

## FILES TO CREATE/MODIFY

### New Files:
1. `backend/services/ocr_schema_validator.py` - Schema validation and mapping
2. `backend/services/ocr_error_logging.py` - Structured error logging
3. `backend/services/ocr_retry.py` - Retry logic wrapper
4. `backend/services/ocr_validators.py` - Comprehensive validation suite
5. `tests/test_ocr_export_stabilization.py` - Test suite
6. `logs/ocr_failures/` - Directory for failure logs (auto-created)

### Modified Files:
1. `backend/services/ocr_document_pipeline.py` - Integrate schema validation, retry logic
2. `backend/table_scan.py` - Fix `_excel_safe_value`, add validation
3. `backend/services/ocr_normalization.py` - Enhance normalization
4. `backend/routers/ocr.py` - Add error logging to routes

---

**Next Step:** Begin implementation with Phase 1, Task 1.1 (Schema Validator)
