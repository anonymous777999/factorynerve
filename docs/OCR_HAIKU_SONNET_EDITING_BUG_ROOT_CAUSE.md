# OCR Editing Bug: Haiku Works, Sonnet Fails - Root Cause Analysis

**Date**: 2026-05-08  
**Status**: ROOT CAUSE IDENTIFIED  
**Severity**: P0 - Blocks Sonnet/Opus usage

---

## Executive Summary

**Problem**: OCR results from Haiku are editable, but Sonnet/Opus results are NOT editable in the review UI.

**Root Cause**: The `stringifySheetCell()` function in `web/src/components/ocr-scan-page.tsx` **does not handle all response structures that Sonnet/Opus return**, causing cells to remain as complex objects instead of being normalized to strings. When these malformed cells reach the `OcrSpreadsheetGrid` component, the `normalizeCell()` function fails silently, breaking edit functionality.

**Impact**: Users cannot edit Sonnet/Opus OCR results, making these premium models unusable for review workflows.

---

## Data Flow Analysis

### Full Flow Trace

```
Backend OCR Response (model-specific structure)
    ↓
extractPreviewTable() [line 306-342]
    ↓
stringifySheetCell() [line 231-300] ← **DIVERGENCE POINT**
    ↓
editableRows state
    ↓
OcrSpreadsheetGrid component [line 1930-1943]
    ↓
normalizeCell() [line 25-30] ← **FAILURE POINT**
    ↓
Cell onClick handler [line 112-117] ← **EDITING BLOCKED**
```

---

## The Critical Functions

### 1. `extractPreviewTable()` (ocr-scan-page.tsx:306-342)

**Purpose**: Normalize backend OCR response to frontend-compatible format

```typescript
function extractPreviewTable(result: OcrPreviewResult) {
  const sheet = (result as StructuredPreviewResult).sheets?.[0];
  const sheetHeaders = Array.isArray(sheet?.columns)
    ? sheet.columns.map((col) => stringifySheetCell(col))
    : [];
  const sheetRows = Array.isArray(sheet?.rows)
    ? sheet.rows.map((row) =>
      Array.isArray(row) ? row.map((cell) => stringifySheetCell(cell)) : [stringifySheetCell(row)],
    )
    : [];
  // ... normalization logic
  const normalizedRows = sourceRows.map((row) =>
    Array.from({ length: columnCount }, (_, index) => stringifySheetCell(row[index])),  // ← Line 323-324
  );
  
  return {
    headers: normalizedHeaders,
    rows: normalizedRows,  // ← MUST be string[][] or OcrCell[][]
  };
}
```

**Contract**: Must return `rows` as either:
- `string[][]` (plain strings)
- `OcrCell[][]` where `OcrCell = string | { value: string, confidence: number }`

---

### 2. `stringifySheetCell()` (ocr-scan-page.tsx:231-300)

**Purpose**: Convert ANY backend cell value to a string

```typescript
function stringifySheetCell(value: unknown): string {
  if (value == null) return "";
  if (typeof value === "string") return value;
  if (typeof value === "number" || typeof value === "boolean") return String(value);

  // Handle cell objects from backend (Phase 1 cell structure)
  if (isCellObject(value)) {
    return stringifySheetCell(value.value); // Recursively stringify the value
  }

  // Handle structured section objects (header, table, total, form)
  if (typeof value === "object" && value !== null) {
    const obj = value as Record<string, unknown>;

    if ("type" in obj) {
      const sectionType = String(obj.type || "").toLowerCase();
      
      // ← HANDLES: header, total, field, table sections
      
      if (sectionType === "table" || sectionType === "grid") {
        // ← PROBLEM: Returns summary like "Table (3×4)" instead of actual data
        if (Array.isArray(obj.rows) && obj.rows.length > 0) {
          const firstRow = obj.rows[0];
          if (Array.isArray(firstRow) && firstRow.length > 0) {
            return stringifySheetCell(firstRow[0]);  // ← Returns first cell
          }
        }
        // ← Returns dimensions as string
        return rows && cols ? `Table (${rows}×${cols})` : "Table";
      }
    }

    // Extract common value/text/content fields
    if ("value" in obj && obj.value != null) {
      return stringifySheetCell(obj.value);
    }
    // ... other extractions
  }

  // Fallback: stringify as JSON (last resort) ← **PROBLEM FOR SONNET**
  try {
    return JSON.stringify(value);
  } catch {
    return String(value);
  }
}
```

**The Bug**: 
1. Sonnet/Opus return **more complex nested structures**
2. `stringifySheetCell()` hits the JSON.stringify fallback
3. Returns `"{"key":"value"}"` instead of extractable data
4. These JSON strings are stored in `editableRows`

---

### 3. `normalizeCell()` (OcrSpreadsheetGrid.tsx:25-30)

**Purpose**: Extract display value and confidence from cell

```typescript
function normalizeCell(cell: OcrCell): { value: string; confidence: number } {
    if (typeof cell === "string") {
        return { value: cell, confidence: 100 };
    }
    return { value: cell.value, confidence: cell.confidence };  // ← ASSUMES CELL OBJECT
}
```

**The Failure**:
- If `cell` is a JSON string like `"{"nested":"data"}"`, it's treated as a regular string ✅
- If `cell` is an **unhandled object structure**, `cell.value` returns `undefined` ❌
- Component renders empty cells that cannot be edited

---

## Model-Specific Response Differences

### Haiku Response Structure ✅
```json
{
  "type": "table",
  "headers": ["Column 1", "Column 2"],
  "rows": [
    ["simple string", "another string"],
    ["value1", "value2"]
  ]
}
```
→ `stringifySheetCell()` returns strings directly  
→ Cells editable ✅

---

### Sonnet Response Structure ❌
```json
{
  "type": "table",
  "headers": ["Column 1", "Column 2"],
  "rows": [
    [
      {"type": "cell", "value": "data", "metadata": {"source": "ocr"}},
      {"type": "field", "label": "Amount", "value": 1234.56}
    ]
  ]
}
```
→ `stringifySheetCell()` **may hit JSON.stringify fallback**  
→ Returns `"{"type":"cell","value":"data","metadata":{"source":"ocr"}}"`  
→ Cells NOT editable ❌

---

## Why Editing Breaks

1. **Malformed cells reach the grid**:
   - Sonnet cells are complex objects or JSON strings
   - Grid component expects strings or `{value, confidence}` objects

2. **`normalizeCell()` fails silently**:
   ```typescript
   const { value, confidence } = normalizeCell(cell);
   // If cell is {"type":"cell",...}, cell.value is undefined
   // value = undefined, confidence = undefined
   ```

3. **Click handler receives undefined values**:
   ```typescript
   onClick={() => {
       if (!isReadOnly) {
           setEditingCell({ rowIndex, columnIndex });
           setDraftValue(value);  // ← value = undefined
       }
   }}
   ```

4. **Input renders empty, edits don't save**:
   - Empty `draftValue` looks like a blank cell
   - User types but sees no change
   - On blur, nothing saves because original `value === draftValue`

---

## The Fix Strategy

### Option A: Enhance `stringifySheetCell()` (RECOMMENDED)

**File**: `web/src/components/ocr-scan-page.tsx`

```typescript
function stringifySheetCell(value: unknown): string {
  if (value == null) return "";
  if (typeof value === "string") return value;
  if (typeof value === "number" || typeof value === "boolean") return String(value);

  if (isCellObject(value)) {
    return stringifySheetCell(value.value);
  }

  if (typeof value === "object" && value !== null) {
    const obj = value as Record<string, unknown>;

    // NEW: Handle generic cell objects with value/content/text
    if ("value" in obj && obj.value != null) {
      return stringifySheetCell(obj.value);
    }
    if ("content" in obj && obj.content != null) {
      return String(obj.content);
    }
    if ("text" in obj && obj.text != null) {
      return String(obj.text);
    }

    // Handle typed sections
    if ("type" in obj) {
      const sectionType = String(obj.type || "").toLowerCase();
      
      // NEW: Handle "cell" type explicitly
      if (sectionType === "cell") {
        if ("value" in obj) return stringifySheetCell(obj.value);
        if ("content" in obj) return String(obj.content);
        if ("text" in obj) return String(obj.text);
      }

      // Existing handlers for header, total, field, table...
      if (sectionType === "header" || sectionType === "heading") {
        return String(obj.title || obj.label || obj.text || obj.value || "");
      }
      
      // ... rest of handlers
    }

    // NEW: Try harder to extract scalar value before JSON fallback
    const scalarKeys = ["value", "content", "text", "label", "title", "amount", "data"];
    for (const key of scalarKeys) {
      if (key in obj && obj[key] != null && typeof obj[key] !== "object") {
        return String(obj[key]);
      }
    }

    // LAST RESORT: JSON stringify (but log warning)
    console.warn("[OCR] Unhandled cell structure, falling back to JSON:", obj);
    return JSON.stringify(value);
  }

  return String(value);
}
```

**Benefits**:
- Fixes Sonnet/Opus compatibility
- Maintains Haiku compatibility
- No backend changes needed
- Backward compatible

---

### Option B: Backend Normalization (NOT RECOMMENDED)

Enforce flat string responses from backend for all models.

**Why NOT**:
- Requires backend changes
- Breaks export metadata
- Loses confidence data
- Against review layer architecture

---

## Testing Requirements

### Test Matrix

| Model | Image | Expected Behavior |
|-------|-------|-------------------|
| Haiku | ledger.png | ✅ Cells editable |
| Sonnet | ledger.png | ✅ Cells editable |
| Opus | ledger.png | ✅ Cells editable |
| Haiku | invoice.png | ✅ Cells editable |
| Sonnet | invoice.png | ✅ Cells editable |

### Verification Steps

1. Upload test image
2. Run with Haiku → verify cells editable
3. Re-run same image with Sonnet → verify cells editable
4. Re-run same image with Opus → verify cells editable
5. Make edits in each mode → verify saves work
6. Export from each mode → verify Excel correct

---

## Implementation Plan

1. ✅ **Diagnosis complete** - Root cause identified
2. **Enhance `stringifySheetCell()`** - Add better object value extraction
3. **Add console logging** - Warn about unhandled structures
4. **Test with all models** - Verify fix across Haiku/Sonnet/Opus
5. **Verify exports still work** - No regression in export pipeline
6. **Document new cell handling** - Update type contracts

---

## Success Criteria

✅ **DONE** means:

1. ✅ Same image produces editable cells for ALL models
2. ✅ Haiku results remain editable (no regression)
3. ✅ Sonnet results become editable (bug fixed)
4. ✅ Opus results become editable (bug fixed)
5. ✅ Cell edits save correctly for all models
6. ✅ Export pipeline unaffected
7. ✅ No new TypeScript errors
8. ✅ Console warnings for truly unhandled structures

---

## Related Files

- `web/src/components/ocr-scan-page.tsx` - **FIX HERE**
- `web/src/components/ocr/OcrSpreadsheetGrid.tsx` - Consumer (no changes)
- `backend/services/ocr_document_pipeline.py` - Backend (no changes)
- `backend/routers/ocr.py` - API layer (no changes)

---

## Next Steps

**IMMEDIATE ACTION**: Enhance `stringifySheetCell()` function with better object value extraction logic as shown in Option A above.
