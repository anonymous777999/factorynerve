# OCR Cell Structure Upgrade - Sprint 1 Plan

**Date:** 2026-05-05  
**Sprint:** Week 1 - Foundation (Zero Visual Change)  
**Goal:** Data structure upgrade with backward compatibility, invisible to users

---

## 📋 EXTRACTED REQUIREMENTS (Sprint 1 Only)

From OCR.txt - **Sprint 1 (Week 1): Foundation**

### What to Implement:
1. ✅ **Cell Adapter Function** - converts legacy `string` to structured `CellObject`
2. ✅ **Column Type Inference** - detect numeric/date/text columns
3. ✅ **Enhanced Confidence Estimation** - 3-layer confidence (OCR + structural + contextual)
4. ✅ **Number Format Detection** - Indian/International/European number parsing
5. ✅ **Backward Compatibility** - existing API responses work with old UI

### What NOT to Implement (Later Sprints):
- ❌ UI changes (Sprint 2)
- ❌ Editing (Sprint 3)
- ❌ Undo/Redo (Sprint 3)
- ❌ Persistence (Sprint 3)
- ❌ Excel enhancements (Sprint 4)
- ❌ Re-OCR safety (Sprint 4)

---

## 🔍 CURRENT IMPLEMENTATION ANALYSIS

### Backend Files Analyzed:
- `backend/ocr_utils.py` - Contains `OcrResult` dataclass
- `backend/table_scan.py` - Main OCR extraction logic
- `backend/routers/ocr.py` - API endpoints
- `backend/services/ocr_document_pipeline.py` - Pipeline orchestration
- `backend/services/ocr_confidence.py` - Confidence calculation

### What's Already Implemented:

| Feature | Status | Location | Notes |
|---------|--------|----------|-------|
| `OcrResult` dataclass | ✅ Exists | `ocr_utils.py:35` | Has `rows: list[list[str]]`, `avg_confidence`, `cell_confidence` |
| Cell-level confidence | ✅ Exists | `OcrResult.cell_confidence` | Already returns `list[list[float]]` |
| Structural confidence | ✅ Exists | `ocr_confidence.py` | `calculate_structural_confidence()` |
| Column detection | ⚠️ Partial | `ocr_utils.py` | `detect_column_centers()` exists |
| Sheets structure | ✅ Exists | Frontend | `sheets?: Array<{ columns, rows }>` already in UI |
| Number normalization | ❌ Missing | - | Only string extraction, no parsing |
| Cell objects | ❌ Missing | - | Returns flat strings, not structured objects |
| Column type inference | ❌ Missing | - | No column-level type detection |

---

## 🎯 GAP ANALYSIS

### ✅ Already Have (Don't Reimplement):
- Cell-level confidence matrix (`cell_confidence: list[list[float]]`)
- Structural confidence calculation
- Sheets structure in UI
- Backward-compatible data flow

### ❌ Missing (Need to Implement):

#### 1. Cell Object Structure
**Current:** `rows: list[list[str]]`  
**Needed:** `rows: list[list[CellObject | str]]` where:
```python
CellObject = {
    "raw": str,          # OCR output (never mutated)
    "value": str,        # Display value
    "confidence": float, # 0.0-1.0
    "cell_type": str,    # "text" | "numeric" | "date" | "empty"
    "edited": bool,      # False in Sprint 1
    "original": None,    # None in Sprint 1
    "normalized"?: float,    # For numeric cells only
    "format_hint"?: str,     # "indian" | "international" | "european"
}
```

#### 2. Cell Adapter (Render Boundary)
**Location:** New file `backend/services/ocr_cell_adapter.py`  
**Purpose:** Convert legacy string format to structured format  
**Function:**
```python
def normalize_cell(cell: str | dict, column_type: str = "text") -> dict:
    """Convert string OR object to CellObject format"""
```

#### 3. Column Type Inference
**Location:** `backend/services/ocr_cell_adapter.py`  
**Purpose:** Detect column types for entire table  
**Function:**
```python
def infer_column_types(rows: list[list[str]]) -> list[str]:
    """Returns ["text", "numeric", "date", ...] for each column"""
```

#### 4. Enhanced Confidence
**Location:** Extend `backend/services/ocr_confidence.py`  
**Purpose:** Context-aware confidence (column-type aware)  
**Function:**
```python
def estimate_cell_confidence(
    cell_text: str,
    column_type: str,
    ocr_confidence: float | None
) -> float:
    """3-layer: OCR base → structural → contextual"""
```

#### 5. Number Parser
**Location:** New file `backend/services/ocr_number_parser.py`  
**Purpose:** Parse Indian/International/European numbers safely  
**Functions:**
```python
def parse_numeric(value: str) -> dict:
    """Returns {normalized, format_hint, ambiguous}"""

def detect_number_format(s: str) -> str:
    """Returns "indian" | "international" | "european" | "ambiguous"\"
```

---

## 📝 IMPLEMENTATION PLAN (Step-by-Step)

### Step 1: Create Cell Adapter Module
**File:** `backend/services/ocr_cell_adapter.py`

```python
from typing import Any

def normalize_cell(
    cell: str | dict,
    column_type: str = "text",
    ocr_confidence: float | None = None
) -> dict:
    """
    Convert legacy string OR structured dict to CellObject.
    Backward compatible - handles both formats.
    """
    if isinstance(cell, dict):
        # Already structured - validate and return
        return {
            "raw": str(cell.get("raw", "")),
            "value": str(cell.get("value", "")),
            "confidence": float(cell.get("confidence", 0.5)),
            "cell_type": str(cell.get("cell_type", "text")),
            "edited": bool(cell.get("edited", False)),
            "original": cell.get("original"),
            **({" normalized": cell["normalized"]} if "normalized" in cell else {}),
            **( {"format_hint": cell["format_hint"]} if "format_hint" in cell else {}),
        }
    
    # Legacy string format - upgrade it
    text = str(cell)
    confidence = ocr_confidence if ocr_confidence is not None else 0.5
    
    return {
        "raw": text,
        "value": text,
        "confidence": confidence,
        "cell_type": infer_cell_type(text, column_type),
        "edited": False,
        "original": None,
    }

def infer_cell_type(value: str, column_type: str = "text") -> str:
    """Infer individual cell type"""
    if not value.strip():
        return "empty"
    # Use column type as hint, validate against content
    return column_type

def infer_column_types(rows: list[list[str]]) -> list[str]:
    """Infer type for each column based on majority content"""
    if not rows:
        return []
    
    column_count = max(len(row) for row in rows) if rows else 0
    column_types = []
    
    for col_idx in range(column_count):
        column_values = [row[col_idx] if col_idx < len(row) else "" for row in rows]
        column_types.append(_infer_single_column_type(column_values))
    
    return column_types

def _infer_single_column_type(values: list[str]) -> str:
    """Infer type from column values"""
    filled = [v.strip() for v in values if v.strip()]
    if not filled:
        return "text"
    
    # Check if mostly numeric
    numeric_count = sum(1 for v in filled if _is_numeric_like(v))
    if numeric_count / len(filled) > 0.7:
        return "numeric"
    
    # Check if mostly date
    date_count = sum(1 for v in filled if _is_date_like(v))
    if date_count / len(filled) > 0.7:
        return "date"
    
    return "text"

def _is_numeric_like(value: str) -> bool:
    """Check if value looks like a number"""
    import re
    # Remove currency symbols, spaces
    cleaned = value.replace('₹', '').replace('$', '').replace('€', '').strip()
    # Match numbers with optional commas/periods
    return bool(re.match(r'^-?[\d,. ]+$', cleaned))

def _is_date_like(value: str) -> bool:
    """Check if value looks like a date"""
    import re
    # Basic date pattern: DD/MM/YYYY, DD-MM-YYYY, etc.
    return bool(re.match(r'^\d{1,4}[/\-\.]\d{1,2}[/\-\.]\d{1,4}$', value.strip()))
```

### Step 2: Create Number Parser Module
**File:** `backend/services/ocr_number_parser.py`

```python
import re
from typing import TypedDict

class ParsedNumber(TypedDict):
    normalized: float | None
    format_hint: str | None
    ambiguous: bool

def parse_numeric(value: str, format_hint: str | None = None) -> ParsedNumber:
    """
    Parse number with format detection.
    Conservative: only normalize when confident.
    """
    cleaned = value.strip().replace('₹', '').replace('$', '').replace('€', '').replace(' ', '')
    
    if not cleaned:
        return {"normalized": None, "format_hint": None, "ambiguous": False}
    
    # Detect format if not provided
    if format_hint:
        detected_format = format_hint
    else:
        detected_format = detect_number_format(cleaned)
    
    if detected_format == "ambiguous":
        return {"normalized": None, "format_hint": "ambiguous", "ambiguous": True}
    
    try:
        if detected_format == "indian":
            # Indian: 1,00,000 or 14,00,000.50
            normalized = float(cleaned.replace(',', ''))
        elif detected_format == "european":
            # European: 1.000.000,50
            normalized = float(cleaned.replace('.', '').replace(',', '.'))
        elif detected_format == "international":
            # International: 1,000,000.50
            normalized = float(cleaned.replace(',', ''))
        else:
            # Plain number
            normalized = float(cleaned)
        
        # Return int if no decimal component
        if normalized == int(normalized):
            normalized = int(normalized)
        
        return {"normalized": normalized, "format_hint": detected_format, "ambiguous": False}
    except ValueError:
        return {"normalized": None, "format_hint": None, "ambiguous": False}

def detect_number_format(s: str) -> str:
    """Detect Indian vs International vs European number format"""
    
    # Indian format: X,XX,XXX or X,XX,XX,XXX (groups of 2 after first group)
    if re.match(r'^\d{1,2}(,\d{2})+(,\d{3})?(\.\d+)?$', s):
        return 'indian'
    
    # International: groups of 3 with comma separator, optional decimal point
    if re.match(r'^\d{1,3}(,\d{3})*(\.\d+)?$', s):
        return 'international'
    
    # European: groups of 3 with period separator, comma decimal
    if re.match(r'^\d{1,3}(\.\d{3})*(,\d+)?$', s):
        return 'european'
    
    # Ambiguous case: "1,234" could be 1234 or 1.234
    if re.match(r'^\d+,\d{2}$', s):
        return 'ambiguous'
    
    return 'plain'
```

### Step 3: Extend Confidence Calculation
**File:** `backend/services/ocr_confidence.py` (extend existing)

Add new function:
```python
def estimate_cell_confidence(
    cell_text: str,
    column_type: str | None = None,
    ocr_confidence: float | None = None
) -> float:
    """
    3-layer confidence estimation:
    1. OCR engine confidence (if available)
    2. Structural signals
    3. Contextual (column-aware)
    """
    # Layer 1: Base confidence
    if ocr_confidence is not None:
        base = ocr_confidence
    else:
        base = 0.80  # default assumption
    
    # Layer 2: Structural modifiers
    modifiers = 0.0
    
    if not cell_text.strip():
        return 0.99  # empty cells are "certain"
    
    # OCR confusion characters
    confusion_chars = {'0', 'O', '1', 'l', 'I', '5', 'S', '8', 'B', '|'}
    confusion_count = sum(1 for c in cell_text if c in confusion_chars)
    modifiers -= confusion_count * 0.03
    
    # Very short cells harder to validate
    if len(cell_text) <= 2:
        modifiers -= 0.05
    
    # Double spaces suggest OCR errors
    if '  ' in cell_text:
        modifiers -= 0.08
    
    # Layer 3: Column context
    if column_type == 'numeric':
        if not re.match(r'^[\d,.\s₹$€-]+$', cell_text):
            modifiers -= 0.15  # non-numeric in numeric column
        elif re.match(r'^[\d,]+$', cell_text):
            modifiers += 0.05  # clean number
    
    if column_type == 'date':
        if not re.match(r'^\d{1,4}[/\-\.]\d{1,2}[/\-\.]\d{1,4}$', cell_text):
            modifiers -= 0.10
    
    return max(0.0, min(1.0, base + modifiers))
```

### Step 4: Integrate into Pipeline
**File:** `backend/services/ocr_document_pipeline.py` (modify)

Add function to upgrade rows to cell objects:

```python
from backend.services.ocr_cell_adapter import normalize_cell, infer_column_types
from backend.services.ocr_number_parser import parse_numeric
from backend.services.ocr_confidence import estimate_cell_confidence

def upgrade_rows_to_cell_objects(
    rows: list[list[str]],
    cell_confidence_matrix: list[list[float]] | None = None,
    enable_cell_format: bool = False
) -> tuple[list[list[dict | str]], list[str]]:
    """
    Upgrade string rows to cell objects (if enabled).
    Returns: (upgraded_rows, column_types)
    """
    if not enable_cell_format:
        # Feature flag OFF - return strings as-is
        return rows, []
    
    # Infer column types
    column_types = infer_column_types(rows)
    
    upgraded_rows = []
    for row_idx, row in enumerate(rows):
        upgraded_row = []
        for col_idx, cell in enumerate(row):
            column_type = column_types[col_idx] if col_idx < len(column_types) else "text"
            ocr_conf = (
                cell_confidence_matrix[row_idx][col_idx]
                if cell_confidence_matrix and row_idx < len(cell_confidence_matrix) and col_idx < len(cell_confidence_matrix[row_idx])
                else None
            )
            
            # Upgrade cell
            cell_obj = normalize_cell(cell, column_type, ocr_conf)
            
            # Enhanced confidence
            cell_obj["confidence"] = estimate_cell_confidence(
                cell_obj["value"],
                column_type,
                ocr_conf
            )
            
            # Parse numeric if needed
            if column_type == "numeric" and cell_obj["value"].strip():
                parsed = parse_numeric(cell_obj["value"])
                if parsed["normalized"] is not None:
                    cell_obj["normalized"] = parsed["normalized"]
                    cell_obj["format_hint"] = parsed["format_hint"]
                elif parsed["ambiguous"]:
                    cell_obj["format_hint"] = "ambiguous"
            
            upgraded_row.append(cell_obj)
        upgraded_rows.append(upgraded_row)
    
    return upgraded_rows, column_types
```

### Step 5: Add Feature Flag
**File:** `backend/routers/ocr.py` (modify)

Add environment variable check:
```python
import os

_ENABLE_CELL_FORMAT_V2 = os.getenv("CELL_FORMAT_V2", "false").lower() == "true"
```

Modify response building to conditionally upgrade:
```python
# In preview endpoint, after getting OCR result:
if _ENABLE_CELL_FORMAT_V2:
    upgraded_rows, column_types = upgrade_rows_to_cell_objects(
        result.rows,
        result.cell_confidence,
        enable_cell_format=True
    )
    response["rows"] = upgraded_rows
    response["column_types"] = column_types
else:
    response["rows"] = result.rows  # Keep as strings
```

---

## ✅ TESTING STRATEGY

### Test 1: Backward Compatibility (Feature Flag OFF)
```bash
export CELL_FORMAT_V2=false
# Run OCR scan
# Verify: UI works as before, rows are strings
```

### Test 2: New Format (Feature Flag ON)
```bash
export CELL_FORMAT_V2=true
# Run OCR scan
# Verify: Backend returns cell objects
# Verify: UI still renders (adapter handles both formats)
```

### Test 3: Column Type Inference
```python
rows = [
    ["Name", "Amount", "Date"],
    ["Cash", "14,00,000", "2024-01-15"],
    ["Bank", "5,000", "2024-01-16"]
]
types = infer_column_types(rows)
assert types == ["text", "numeric", "date"]
```

### Test 4: Number Parsing
```python
assert parse_numeric("14,00,000")["normalized"] == 1400000
assert parse_numeric("14,00,000")["format_hint"] == "indian"
assert parse_numeric("1,000.50")["normalized"] == 1000.5
assert parse_numeric("12,34")["ambiguous"] == True
```

---

## 📊 SUCCESS CRITERIA

- [ ] Cell adapter function exists and handles both formats
- [ ] Column type inference detects numeric/date/text
- [ ] Enhanced confidence calculation works (3-layer)
- [ ] Number parser handles Indian/International/European
- [ ] Feature flag controls format (ON/OFF)
- [ ] Existing UI works with flag OFF (backward compat)
- [ ] Backend returns structured format with flag ON
- [ ] NO visual changes to UI
- [ ] NO breaking API changes

---

## 🚀 IMPLEMENTATION ORDER

1. Create `ocr_cell_adapter.py` (30 min)
2. Create `ocr_number_parser.py` (20 min)
3. Extend `ocr_confidence.py` (15 min)
4. Modify `ocr_document_pipeline.py` (20 min)
5. Add feature flag to `routers/ocr.py` (10 min)
6. Write unit tests (30 min)
7. Manual integration test (15 min)

**Total Estimated Time:** 2.5 hours

---

## 🔒 CONSTRAINTS (STRICTLY FOLLOW)

- ❌ DO NOT modify UI components
- ❌ DO NOT implement editing logic
- ❌ DO NOT implement undo/redo
- ❌ DO NOT implement persistence
- ❌ DO NOT change API contract (additive only)
- ❌ DO NOT break existing functionality
- ✅ DO use feature flag for rollback safety
- ✅ DO maintain backward compatibility
- ✅ DO keep changes minimal and focused

---

**Next Step:** Implement files in order listed above.
