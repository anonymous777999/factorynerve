# OCR Review Stabilization — Implementation Plan

**Date:** 2026-05-07  
**Status:** Planning Complete → Implementation Starting  
**Priority:** P0 (Launch Blockers)

---

## SITUATION ANALYSIS

### Current State
✅ **WORKING:**
- OCR extraction pipeline is stable
- Basic spreadsheet UI completed (Phase 1-5)
- Backend image storage exists (`OCR_VERIFICATION_DIR`)
- API endpoint for image serving exists
- Autosave functionality works
- Undo/redo implemented

❌ **BROKEN:**
- Image disappears on cached OCR results (blob URLs die)
- No raw mode fallback
- No renderer error boundaries
- No protection against large datasets
- OCR terminology still exposed in some places
- No versioned display contracts
- No concurrent edit protection

---

## ROOT CAUSE: IMAGE PERSISTENCE

### Current Flow (BROKEN):
1. User uploads → creates blob URL → stores in state
2. OCR processes → saves to backend with real path
3. User closes tab → blob URL dies
4. User reopens → tries to use blob URL → **IMAGE GONE**

### Backend Reality (ALREADY WORKING):
- `_save_verification_source()` saves images to disk
- `source_image_path` stored in database
- GET `/verifications/{verification_id}/source-image` serves images
- API endpoint has proper cache headers

### Frontend Issue:
- Uses temporary blob URLs instead of API endpoints
- `openRecentRecord()` tries to load from API but stores wrong URL format
- Needs consistent image loading strategy

---

## P0 IMPLEMENTATION PLAN (LAUNCH BLOCKERS)

### 1. FIX SOURCE IMAGE PERSISTENCE ✓ BACKEND READY

**Backend Status:** ✅ Already implemented correctly

**Frontend Changes Needed:**
- Remove blob URL dependencies for persisted records
- Always load images via API endpoint for saved records
- Keep blob URLs only for pre-upload preview
- Add retry logic with exponential backoff
- Show skeleton loader during image fetch

**Files to Modify:**
- `web/src/components/ocr-scan-page.tsx` (lines ~1170-1173, ~563-566)
- Add image loading utility function

**Implementation:**
```typescript
// When opening saved record:
setOriginalUrl(`/api/ocr/verifications/${record.id}/source-image`);

// NOT blob URL from record
```

---

### 2. RAW FALLBACK MODE

**Purpose:** Debug view showing exact OCR payload

**Implementation:**
- Add `view` query parameter: `?view=document|spreadsheet|raw|dense`
- Raw mode: JSON.stringify entire OCR response
- Automatic fallback on selector errors
- User-accessible via toggle button

**Files to Modify:**
- `web/src/components/ocr-scan-page.tsx` (add view state)
- New component: `web/src/components/ocr/RawDataView.tsx`

---

### 3. RENDERER FAILURE SAFETY

**Protection Layers:**
1. Error boundary around spreadsheet grid
2. Selector timeout protection (5s max)
3. Malformed section skip (don't crash)
4. Unknown section type skip
5. Fallback to raw mode on any error

**Files to Modify:**
- `web/src/components/ocr-scan-page.tsx` (add error boundary)
- New component: `web/src/components/ocr/OcrErrorBoundary.tsx`

---

### 4. ROW/COLUMN SAFETY VALVE

**Limits:**
- Max 500 rows in standard view
- Max 50 columns in standard view
- Automatic truncation with warning
- Recommend dense view for large datasets

**Implementation:**
```typescript
if (rows.length > 500 || headers.length > 50) {
  setWarning("Large document — switch to dense view");
  // Truncate display but keep data
}
```

**Files to Modify:**
- `web/src/components/ocr-scan-page.tsx` (add safety check)

---

### 5. REMOVE REMAINING OCR LEAKAGE

**Audit Needed:**
- ✅ Page title changed to "Document Scan"
- ✅ Confidence indicators refined
- ⚠️ Check for remaining "Section", "Field", "Value" exposure
- ⚠️ Verify no model names shown to normal users

**Files to Audit:**
- `web/src/components/ocr-scan-page.tsx`
- `web/src/components/ocr/edit-toolbar.tsx`
- `web/src/components/ocr/keyboard-shortcut-strip.tsx`

---

## P1 IMPLEMENTATION PLAN (POST-LAUNCH)

### 6. VERSIONED DISPLAY CONTRACTS

**Backend Change:**
```python
return {
    "display_version": 1,
    "sections": [...]
}
```

**Frontend Behavior:**
- Known version → render
- Unknown higher → fallback to raw
- Show version mismatch warning

---

### 7. MULTI-VIEW SYSTEM

**Views:**
- `document` — business-friendly formatted view
- `spreadsheet` — editable grid (current default)
- `raw` — exact OCR payload (debug)
- `dense` — virtualized compact view

**URL Persistence:**
```
?view=spreadsheet
?view=raw
```

---

### 8. AUTOSAVE IMPROVEMENTS

**Current:** Works but needs polish

**Enhancements:**
- Session recovery on crash
- Draft protection across tabs
- Squash repeated edits
- Memory safety (limit history)

---

### 9. CONCURRENT EDIT PROTECTION

**Implementation:**
```python
if client_last_updated_at < record.updated_at:
    raise HTTPException(409, "Edited elsewhere")
```

**Frontend:**
- Show reload prompt on 409
- Prevent silent overwrites

---

### 10. EXPORT ARTIFACT SAFETY

**Backend:**
- Store immutable export on approval
- Never regenerate approved exports
- Version exports with selector version

**Database:**
- Add `export_artifact_path` column
- Add `approved_display_version` column

---

## IMPLEMENTATION ORDER

### Phase A: Image Fix (Critical)
1. Fix image loading in `openRecentRecord()`
2. Add retry logic
3. Test with cached results

### Phase B: Safety (Launch Blocker)
1. Add raw fallback mode
2. Add error boundary
3. Add row/column limits
4. Test failure scenarios

### Phase C: Polish (Launch Ready)
1. Remove remaining OCR leakage
2. Test with real data
3. Smoke test all flows

### Phase D: Post-Launch (P1)
1. Versioned contracts
2. Multi-view system
3. Concurrent edit protection
4. Export artifacts

---

## FILES TO MODIFY (P0 ONLY)

### Frontend:
1. `web/src/components/ocr-scan-page.tsx` (main changes)
2. `web/src/components/ocr/OcrErrorBoundary.tsx` (new)
3. `web/src/components/ocr/RawDataView.tsx` (new)
4. `web/src/lib/ocr.ts` (add image loading utility)

### Backend:
- ✅ No changes needed for P0 (image storage already works)

---

## TESTING CHECKLIST

### P0 Tests:
- [ ] Upload new image → save → close → reopen → **image loads**
- [ ] Cached OCR result → **image loads**
- [ ] Image load fails → **shows placeholder, not broken**
- [ ] 1000 row table → **shows warning, doesn't hang**
- [ ] Malformed OCR response → **fallback to raw, doesn't crash**
- [ ] Selector error → **fallback to raw, doesn't white-screen**

---

## ROLLBACK PLAN

All P0 changes are **additive and reversible**:
1. Image loading: Conditional check, easy to revert
2. Raw mode: Feature flag controlled
3. Error boundary: Wrapper component, easy to remove
4. Safety valve: Simple threshold check

**No database migrations required for P0.**

---

## SUCCESS CRITERIA

### Must Work Before Launch:
✅ Image always loads on cached results  
✅ Large datasets don't crash browser  
✅ Errors don't white-screen the UI  
✅ Raw fallback available for support  
✅ No "OCR", "Section", "Field" exposed to users  

### Can Wait for Post-Launch:
- Multi-view system
- Concurrent edit protection  
- Export artifacts
- Dense virtualization

---

**Next Step:** Implement P0 fixes starting with image persistence.
