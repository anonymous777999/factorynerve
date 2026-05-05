# OCR UI Rendering Bug - Root Cause Analysis

**Date:** 2026-05-05  
**Issue:** UI shows old "Preview & Edit" interface instead of new table rendering

---

## 🔍 DATA FLOW TRACE

```
previewOcrLogbook() → result
  ↓
extractPreviewTable(result) → { sheets, headers, rows }
  ↓
nextPreview.sheets = sheets
  ↓
setResultPreview(nextPreview)
  ↓
const sheet = resultPreview?.sheets?.[0]
  ↓
RENDER DECISION: sheet?.columns?.length && sheet.rows
  ↓
IF TRUE → New table (lines 1513-1550)
IF FALSE → Old DataTableGrid (lines 1551-1564)
```

---

## 🐛 ROOT CAUSE #1: Sheet Generation Logic Bug

**Location:** [`web/src/components/ocr-scan-page.tsx:199-201`](web/src/components/ocr-scan-page.tsx:199)

### Current Code (BROKEN)
```typescript
sheets: sheetHeaders.length || sheetRows.length
  ? [{ columns: normalizedHeaders, rows: normalizedRows }]
  : undefined,
```

### Why It Fails
1. Condition checks `sheetHeaders.length || sheetRows.length`
2. If BOTH are empty (0), condition is `0 || 0` = `0` (falsy)
3. But fallback logic populates `normalizedRows` from `result.rows`
4. So `normalizedRows` HAS data, but condition still evaluates to FALSE
5. Result: `sheets` is set to `undefined` even though data exists!

### Example Failure Case
```typescript
// Backend returns:
result.sheets = undefined  // or []
result.rows = [["A", "B"], ["C", "D"]]  // Has data!

// In extractPreviewTable():
sheetHeaders = []  // No sheet.columns
sheetRows = []     // No sheet.rows
// Fallback kicks in:
normalizedRows = [["A", "B"], ["C", "D"]]  // Has data!

// But condition:
sheets: 0 || 0 ? [...] : undefined
// Result: sheets = undefined ❌
```

### Correct Fix
```typescript
sheets: normalizedRows.length
  ? [{ columns: normalizedHeaders, rows: normalizedRows }]
  : undefined
```

**Rationale:** Check the FINAL normalized data, not the raw sheet extraction.

---

## 🐛 ROOT CAUSE #2: Render Condition Bug

**Location:** [`web/src/components/ocr-scan-page.tsx:1513`](web/src/components/ocr-scan-page.tsx:1513)

### Current Code (BROKEN)
```typescript
{sheet?.columns?.length && sheet.rows ? (
```

### Why It Fails
1. `sheet?.columns?.length` checks if columns array has length > 0
2. If `columns` is `[]` (empty array), `columns.length` = `0` (falsy)
3. Even if `rows` has data, condition fails
4. Renders fallback UI instead of new table

### Example Failure Case
```typescript
sheet = {
  columns: [],  // Empty but valid
  rows: [["A", "B"], ["C", "D"]]  // Has data!
}

// Condition:
sheet?.columns?.length && sheet.rows
// = 0 && truthy
// = 0 (falsy) ❌
// Renders OLD UI even though rows exist!
```

### Correct Fix
```typescript
{sheet && sheet.rows && sheet.rows.length > 0 ? (
```

**Rationale:** Only check if sheet exists and rows have data. Don't require columns to have length.

---

## 📊 BEFORE vs AFTER

### BEFORE (Broken Behavior)
```
Backend → normalizedRows = [data]
         ↓
extractPreviewTable() → sheets = undefined ❌
         ↓
Render condition → FALSE ❌
         ↓
UI shows: "Preview & Edit" (old interface) ❌
```

### AFTER (Fixed Behavior)
```
Backend → normalizedRows = [data]
         ↓
extractPreviewTable() → sheets = [{ columns: [...], rows: [...] }] ✅
         ↓
Render condition → TRUE ✅
         ↓
UI shows: New structured table ✅
```

---

## 🧪 DEBUG LOGS REQUIRED

### Location 1: Inside `extractPreviewTable()` (Line ~197)
```typescript
console.log("EXTRACT OUTPUT:", {
  sheetHeaders,
  sheetRows,
  normalizedHeaders,
  normalizedRows,
  willCreateSheets: normalizedRows.length > 0
});
```

### Location 2: Before Rendering (Line ~1437)
```typescript
console.log("DEBUG resultPreview:", resultPreview);
console.log("DEBUG sheets:", resultPreview?.sheets);
console.log("DEBUG sheet:", resultPreview?.sheets?.[0]);
console.log("DEBUG condition check:", {
  hasSheet: !!sheet,
  hasRows: !!sheet?.rows,
  rowCount: sheet?.rows?.length,
  willRenderNewTable: !!(sheet && sheet.rows && sheet.rows.length > 0)
});
```

---

## 📝 EXACT CODE CHANGES

### Change 1: Fix `extractPreviewTable()`

**File:** `web/src/components/ocr-scan-page.tsx`  
**Lines:** 178-205

```typescript
function extractPreviewTable(result: OcrPreviewResult) {
  const sheet = (result as StructuredPreviewResult).sheets?.[0];
  const sheetHeaders = Array.isArray(sheet?.columns)
    ? sheet.columns.map((column, index) => stringifySheetCell(column).trim() || `Column ${index + 1}`)
    : [];
  const sheetRows = Array.isArray(sheet?.rows)
    ? sheet.rows.map((row) =>
      Array.isArray(row) ? row.map((cell) => stringifySheetCell(cell)) : [stringifySheetCell(row)],
    )
    : [];
  const fallbackHeaders = result.headers?.length
    ? result.headers
    : defaultHeaders(Math.max(result.columns || 0, ...(result.rows || []).map((row) => row.length), 1));
  const headers = sheetHeaders.length ? sheetHeaders : fallbackHeaders;
  const sourceRows = sheetRows.length ? sheetRows : result.rows || [];
  const columnCount = Math.max(headers.length, ...sourceRows.map((row) => row.length), 1);
  const normalizedHeaders = Array.from({ length: columnCount }, (_, index) => headers[index] || `Column ${index + 1}`);
  const normalizedRows = sourceRows.map((row) =>
    Array.from({ length: columnCount }, (_, index) => stringifySheetCell(row[index])),
  );
  
  // ADD DEBUG LOG HERE
  console.log("EXTRACT OUTPUT:", {
    sheetHeaders,
    sheetRows,
    normalizedHeaders,
    normalizedRows,
    willCreateSheets: normalizedRows.length > 0
  });
  
  return {
    sheets: normalizedRows.length  // ← FIXED: Check normalized data, not raw
      ? [{ columns: normalizedHeaders, rows: normalizedRows }]
      : undefined,
    headers: normalizedHeaders,
    rows: normalizedRows,
  };
}
```

### Change 2: Fix Render Condition

**File:** `web/src/components/ocr-scan-page.tsx`  
**Lines:** 1437-1564

```typescript
{(step === "preview" || step === "export") && resultPreview ? (
  <div className="space-y-5">
    <div className="grid gap-5 xl:grid-cols-[minmax(0,1fr)_minmax(0,1fr)]">
      {/* ... source image section ... */}
      
      <div className="space-y-4">
        <EditToolbar ... />
        
        {/* ADD DEBUG LOG HERE */}
        {(() => {
          console.log("DEBUG resultPreview:", resultPreview);
          console.log("DEBUG sheets:", resultPreview?.sheets);
          console.log("DEBUG sheet:", resultPreview?.sheets?.[0]);
          console.log("DEBUG condition check:", {
            hasSheet: !!sheet,
            hasRows: !!sheet?.rows,
            rowCount: sheet?.rows?.length,
            willRenderNewTable: !!(sheet && sheet.rows && sheet.rows.length > 0)
          });
          return null;
        })()}

        {sheet && sheet.rows && sheet.rows.length > 0 ? (  // ← FIXED CONDITION
          <div className="overflow-hidden rounded-[28px] border border-[#e3e8ef] bg-white shadow-[0_18px_54px_rgba(15,23,42,0.05)]">
            <div className="overflow-auto">
              <table className="min-w-full border-collapse">
                {/* ... new table rendering ... */}
              </table>
            </div>
          </div>
        ) : (
          <DataTableGrid
            headers={editableHeaders}
            rows={editableRows}
            {/* ... old grid fallback ... */}
          />
        )}
```

---

## ✅ VERIFICATION CHECKLIST

After applying fixes:

1. ✅ `sheets` is populated when `normalizedRows` has data
2. ✅ Render condition evaluates TRUE when rows exist
3. ✅ New table UI renders instead of old "Preview & Edit"
4. ✅ Console logs show:
   - `sheets: [{ columns: [...], rows: [...] }]`
   - `willRenderNewTable: true`
5. ✅ Fallback UI still works when no data exists

---

## 🎯 SUMMARY

| Issue | Location | Fix |
|-------|----------|-----|
| Sheet generation fails | Line 199 | Check `normalizedRows.length` instead of `sheetHeaders.length \|\| sheetRows.length` |
| Render condition fails | Line 1513 | Check `sheet && sheet.rows && sheet.rows.length > 0` instead of `sheet?.columns?.length && sheet.rows` |

**Impact:** These two bugs combined prevent the new table UI from ever rendering, even when structured data exists.
