# OCR Review Layer Architecture - Root Cause Analysis

**Date**: 2026-05-08  
**Status**: Root cause identified, fix in progress

## Executive Summary

The OCR review/edit workflow is broken due to an **incomplete metadata architecture migration**. The system attempted to transition from "plain strings + separate confidence matrix" to "embedded cell objects" but:

1. Cell object upgrade is **correctly disabled** in runtime (to prevent compatibility issues)
2. Confidence metadata exists but **gets lost in the API response layer**
3. Review helpers exist but **aren't connected to API serialization**
4. Frontend can handle metadata but **doesn't receive it consistently**

**The root cause is NOT a runtime structure problem - it's a metadata association problem.**

---

## Current Architecture Analysis

### 1. OCR Runtime Layer (✅ CORRECT - DO NOT MODIFY)

**File**: `backend/services/ocr_document_pipeline.py`

```python
# Lines 792-808: Cell object upgrade DISABLED by default
_ENABLE_CELL_FORMAT_V2 = False  # Correct!
final_rows = normalized_rows  # Plain strings

# Line 823: Confidence stored separately
"cell_confidence": base_result.cell_confidence or [],
"cell_boxes": base_result.cell_boxes or [],
```

**Status**: ✅ **CORRECT** - Runtime returns plain string rows + separate metadata arrays.

### 2. Database Storage Layer (⚠️ INCOMPLETE)

**File**: `backend/models/ocr_verification.py`

```python
# Lines 32-34
original_rows = Column(JSON, nullable=True)  # Can store strings OR objects
reviewed_rows = Column(JSON, nullable=True)  # Can store strings OR objects
scan_quality = Column(JSON, nullable=True)   # Stores some metadata
```

**Problem**: 
- No dedicated columns for `cell_confidence_matrix`, `cell_bbox_matrix`, `cell_source_matrix`
- Metadata gets stored in `scan_quality` JSON but not systematically
- No clear separation between "rows" and "review metadata"

### 3. API Serialization Layer (❌ BROKEN - METADATA LOST HERE)

**File**: `backend/routers/ocr.py`

```python
# Lines 1716-1719: Verification serialization
"headers": verification.headers or [],
"original_rows": verification.original_rows or [],
"reviewed_rows": verification.reviewed_rows or [],
"raw_column_added": bool(verification.raw_column_added),
```

**Problem**: 
- ❌ Does NOT include `cell_confidence_matrix`
- ❌ Does NOT include `cell_bbox_matrix`
- ❌ Does NOT include `cell_source_matrix`
- ❌ Frontend receives rows but loses ALL metadata

### 4. Review Cell Helpers (✅ EXIST BUT NOT USED)

**File**: `backend/services/ocr_review_cells.py`

```python
# Lines 103-112: Metadata extraction helpers EXIST
def build_confidence_matrix(rows)  # ✅ Exists
def build_source_matrix(rows)      # ✅ Exists
def build_bbox_matrix(rows)        # ✅ Exists
```

**Problem**: 
- ✅ Helpers exist and work correctly
- ❌ NOT called in `_serialize_verification` 
- ❌ NOT called in verification export endpoints
- ❌ Metadata extraction disconnected from API layer

### 5. Frontend State (⚠️ PARTIALLY WORKS)

**File**: `web/src/components/ocr-scan-page.tsx`

```typescript
// Lines 574-575: Frontend stores confidence separately
const [resultPreview, setResultPreview] = useState<ResultPreview | null>(null);
const [confidenceMatrix, setConfidenceMatrix] = useState<number[][]>([]);

// Line 1033: Sets confidence from scan result
setConfidenceMatrix(result.cell_confidence || []);
```

**Problem**:
- ✅ Frontend CAN handle separate confidence matrix
- ❌ When loading saved verification, confidence matrix is MISSING
- ❌ Edits update rows but confidence metadata disconnected

---

## The Architectural Mistake

**Previous mistake**: Attempted to inject structured cell objects into OCR runtime rows.
- ❌ Broke compatibility with existing code expecting plain strings
- ❌ Required changes across entire codebase
- ❌ Tests failed

**Current mistake**: Disabled cell objects but **didn't implement the metadata layer properly**.
- ✅ Runtime returns plain strings (correct)
- ❌ Metadata gets lost between database and API
- ❌ Review helpers exist but aren't used
- ❌ No systematic metadata storage/retrieval

---

## Where Metadata Gets Lost (Data Flow Trace)

```
┌─────────────────────────────────────────────────────────────────┐
│ OCR RUNTIME (ocr_document_pipeline.py)                          │
│ ✅ Returns: { rows: string[][], cell_confidence: number[][] }  │
└───────────────────────┬─────────────────────────────────────────┘
                        │
                        ▼
┌─────────────────────────────────────────────────────────────────┐
│ SAVE TO DATABASE (routers/ocr.py:create_verification_draft)     │
│ ✅ Saves: original_rows (strings)                               │
│ ⚠️  Saves: scan_quality (contains cell_boxes but NOT confidence)│
│ ❌ LOST: cell_confidence matrix not explicitly saved            │
└───────────────────────┬─────────────────────────────────────────┘
                        │
                        ▼
┌─────────────────────────────────────────────────────────────────┐
│ API RESPONSE (routers/ocr.py:_serialize_verification)           │
│ ✅ Returns: original_rows, reviewed_rows                        │
│ ❌ LOST: cell_confidence NOT extracted from rows or DB          │
│ ❌ LOST: cell_bbox NOT extracted                                │
│ ❌ LOST: cell_source NOT extracted                              │
└───────────────────────┬─────────────────────────────────────────┘
                        │
                        ▼
┌─────────────────────────────────────────────────────────────────┐
│ FRONTEND (ocr-scan-page.tsx)                                    │
│ ✅ Receives: rows                                               │
│ ❌ Missing: confidenceMatrix (empty array)                      │
│ ❌ Missing: bbox data                                           │
│ ❌ Missing: source tracking                                     │
└───────────────────────┬─────────────────────────────────────────┘
                        │
                        ▼
┌─────────────────────────────────────────────────────────────────┐
│ USER EDITS → SAVE (update_verification)                         │
│ ✅ Saves: reviewed_rows (updated strings)                       │
│ ❌ LOST: All confidence metadata from original scan             │
│ ❌ LOST: No tracking of which cells were edited                 │
└───────────────────────┬─────────────────────────────────────────┘
                        │
                        ▼
┌─────────────────────────────────────────────────────────────────┐
│ EXPORT (export_verification_excel)                              │
│ ✅ Uses: reviewed_rows or original_rows                         │
│ ❌ LOST: No confidence highlighting in Excel                    │
│ ❌ LOST: No indication of low-confidence cells                  │
└─────────────────────────────────────────────────────────────────┘
```

---

## The Correct Review-Layer Architecture

### Design Principle

```
OCR Runtime (plain strings)
     ↓
Separate Metadata Layer (confidence, bbox, source)
     ↓
Review State (editable rows + preserved metadata)
     ↓
Export Layer (rows + optional metadata overlay)
```

### Required Changes

#### 1. Database Schema Enhancement

Add dedicated metadata columns to `OcrVerification`:

```python
# NEW columns needed
cell_confidence_matrix = Column(JSON, nullable=True)  # [[float]]
cell_bbox_matrix = Column(JSON, nullable=True)        # [[{x,y,w,h}]]
cell_source_matrix = Column(JSON, nullable=True)      # [[string]]
```

**Why**: Explicit storage prevents metadata loss, enables version tracking.

#### 2. API Serialization Fix

**File**: `backend/routers/ocr.py` - `_serialize_verification()`

```python
def _serialize_verification(db, verification):
    # ... existing code ...
    
    # NEW: Extract metadata matrices using existing helpers
    rows = verification.reviewed_rows or verification.original_rows or []
    confidence_matrix = build_confidence_matrix(rows)
    bbox_matrix = build_bbox_matrix(rows)
    source_matrix = build_source_matrix(rows)
    
    return {
        # ... existing fields ...
        "cell_confidence": confidence_matrix,  # NEW
        "cell_boxes": bbox_matrix,             # NEW
        "cell_sources": source_matrix,         # NEW
    }
```

**Why**: Connects existing helpers to API layer, frontend receives metadata.

#### 3. Save Workflow Fix

**File**: `backend/routers/ocr.py` - `create_verification_draft()` and `update_verification()`

```python
# When saving from OCR scan
verification.cell_confidence_matrix = result.get("cell_confidence")
verification.cell_bbox_matrix = result.get("cell_boxes")

# When user edits a cell
# Mark edited cells with source="corrected" and confidence=1.0
```

**Why**: Preserves original OCR metadata, tracks manual corrections.

#### 4. Frontend Integration

**File**: `web/src/components/ocr-scan-page.tsx`

```typescript
// When loading saved verification
setConfidenceMatrix(record.cell_confidence || []);

// When user edits
// Update confidence for edited cell to 100%
// Update source to "corrected"
```

**Why**: Maintains metadata consistency, UI shows confidence correctly.

---

## Implementation Plan

### Phase 1: Database Schema Migration (REQUIRED)

```sql
ALTER TABLE ocr_verifications 
ADD COLUMN cell_confidence_matrix JSON,
ADD COLUMN cell_bbox_matrix JSON,
ADD COLUMN cell_source_matrix JSON;
```

### Phase 2: API Layer Updates (SAFE)

1. Update `_serialize_verification()` to extract metadata matrices
2. Update `create_verification_draft()` to save metadata
3. Update `update_verification()` to preserve/update metadata
4. **NO changes to OCR runtime** (stays plain strings)

### Phase 3: Frontend Integration (SAFE)

1. Update verification load to use `cell_confidence` from API
2. Update edit handler to mark cells as "corrected"
3. Add confidence persistence on save
4. **Backward compatible** (handles missing metadata gracefully)

### Phase 4: Export Enhancement (OPTIONAL)

1. Add confidence highlighting to Excel exports
2. Add "edited cells" indicator
3. Add metadata sheet for audit trail

---

## Success Criteria

✅ **DONE** means:

1. ✅ OCR runtime remains stable (plain strings)
2. ✅ All existing tests still pass
3. ✅ Confidence metadata preserved through save/load cycle
4. ✅ Edited cells tracked with source="corrected"
5. ✅ Frontend displays confidence correctly
6. ✅ No structured cell objects in runtime paths
7. ✅ Exports work correctly
8. ✅ Review architecture extensible without breaking compatibility

---

## Next Steps

1. ✅ Create database migration for new metadata columns
2. ✅ Update API serialization to include metadata
3. ✅ Update save workflows to preserve metadata
4. ✅ Update frontend to use metadata from API
5. ✅ Run tests to verify no regressions
6. ✅ Manually verify full OCR workflow

**Status**: Ready to implement Phase 1 (database migration)
