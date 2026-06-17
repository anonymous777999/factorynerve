# Workflow 3: OCR Scan → Verify → Submit Pipeline

## Operational Workflow Regression & Friction Audit

**Date:** June 17, 2026
**Auditor:** Buffy (Senior UX Auditor / Workflow Engineer)
**Workflow ID:** W-03
**Priority:** CRITICAL

---

## Phase 1 — Workflow Mapping

### Flow Diagram

```
/ocr (redirects to /ocr/scan)
  │
  ├── Scan Path: /ocr/scan?step=upload
  │     │
  │     ├── Upload (step=upload)
  │     │     ├── File picker / drag-and-drop / camera capture
  │     │     ├── Remote URL import
  │     │     └── Recent records (quick resume)
  │     │
  │     ├── Processing (step=processing)
  │     │     ├── Preprocess (prepare, warp/deskew)
  │     │     ├── Detect (OCR extraction)
  │     │     ├── Extract (AI parsing)
  │     │     └── Confidence (quality scoring)
  │     │
  │     ├── Preview & Edit (step=preview)
  │     │     ├── Source image viewer (left panel)
  │     │     ├── Editable data table (right panel)
  │     │     ├── Edit toolbar (undo/redo, add row/col, header toggle)
  │     │     ├── Confidence indicators (per-cell badges)
  │     │     ├── Low-confidence highlighting
  │     │     ├── Model selector + re-run
  │     │     ├── Token usage / cost display
  │     │     └── Autosave (900ms debounce)
  │     │
  │     └── Export (step=export)
  │           ├── Excel download
  │           ├── CSV download
  │           ├── JSON download
  │           ├── PDF download
  │           ├── Clipboard copy (for Sheets)
  │           └── Share link generation
  │
  ├── Verify Path: /ocr/verify
  │     │
  │     ├── Workspace: intake (step=2)
  │     │     ├── Upload image / select template
  │     │     ├── Preview OCR
  │     │     └── Create durable draft
  │     │
  │     ├── Workspace: review (step=3-4)
  │     │     ├── Document queue (left sidebar)
  │     │     ├── Trust & audit section
  │     │     ├── Document viewer (image comparison)
  │     │     ├── Issue detection & priority queue
  │     │     ├── Field-level correction grid
  │     │     ├── Reviewer notes
  │     │     ├── Safe cleanup (whitespace fix)
  │     │     ├── Submit for approval
  │     │     ├── Approve / Reject
  │     │     └── Export (Excel/CSV/PDF/Markdown)
  │     │
  │     └── Workspace polling + refresh
  │
  └── History Path: /ocr/history
        └── Browse, search, reopen past verifications
```

### Starting Page
`/ocr/scan` or `/ocr/verify` (depends on role: operator vs supervisor)

### End Page
- **Operator:** `/ocr/scan?step=export` (downloads Excel, done)
- **Supervisor:** `/ocr/verify?verification_id=X&workspace=review` (approves, provides trusted export)

### Goal
Capture paper documents (logbooks, invoices, production sheets) via OCR → correct any misreads → verify accuracy → export as trusted data → optionally submit for approval workflow.

### Required Permissions
| Role | Scan | Verify | Approve |
|------|------|--------|---------|
| Operator | ✅ (depends on factory access) | ❌ | ❌ |
| Supervisor | ✅ | ✅ | ❌ |
| Manager | ✅ | ✅ | ✅ |
| Admin | ✅ | ✅ | ✅ |
| Owner | ✅ | ✅ | ✅ |

### Required Data
- Image file (PNG, JPG, TIFF, PDF, HEIC) — max 8 MB
- Optional: OCR template for repeat layouts
- Optional: Language hint
- Optional: Model selection (Auto / Haiku / Sonnet / Opus)

### Dependencies
- Tesseract OCR runtime on backend (optional, for fallback)
- Anthropic API (primary extraction engine)
- Bytez AI API (alternative provider)
- Warp/perspective correction API
- Backend session (cookie auth)

### Success Conditions
- ✅ Data extracted and displayed correctly
- ✅ All low-confidence cells reviewed/corrected
- ✅ Draft saved (autosave or manual)
- ✅ Export downloaded (any format)
- ✅ (Optional) Verified → Approved → Trusted export status

---

## Phase 2 — Click Audit

### Path A: Operator Scan → Export (no verification)

| Step | Action | Clicks | Notes |
|------|--------|--------|-------|
| 1 | Navigate to /ocr/scan | 1 | From dashboard or nav |
| 2 | Click upload box / file picker | 1 | |
| 3 | Browse and select file | 2 | OS file picker |
| 4 | Wait for processing (auto, no click) | 0 | Automatic |
| 5 | Review extracted data | 0 | Visual scan |
| 6 | Edit cells as needed | Varies | 2 clicks per cell edit |
| 7 | Click "Continue to export" | 1 | |
| 8 | Click "Download Excel" | 1 | |
| **Total** | | **6+** | + edits |

**Current Click Count:** 6+ (varies by number of corrections)
**Ideal Click Count:** 3 (upload → review → export)
**Extra Clicks:** 3+ (toolbar toggles, model selection, advanced options)

### Path B: Supervisor Verify → Approve (with approval workflow)

| Step | Action | Clicks | Notes |
|------|--------|--------|-------|
| 1 | Navigate to /ocr/verify | 1 | |
| 2 | Select document from queue | 1 | |
| 3 | Review trust & audit section | 0 | Informational |
| 4 | Review source image | 0 | Visual scan |
| 5 | Review issue queue | 0 | Scroll/click through issues |
| 6 | Click through critical issues | N | 1 per issue |
| 7 | Mark issues as checked | N | 1 per issue |
| 8 | Edit flagged fields | N | 2 per cell edit |
| 9 | Type reviewer notes | 0 | Keyboard input |
| 10 | Click "Approve" | 1 | |
| 11 | Confirm if critical issues remain | 1 | Override flow |
| **Total** | | **4 + N** | N = issues × 2-3 clicks |

**Current Click Count (5 issues):** ~15-20 clicks
**Ideal Click Count:** 4 (select → review → approve → confirm)
**Extra Clicks:** 10-16 (issue-by-issue checking)

### Path C: Fresh Intake → Create Draft → Export (v2 route)

| Step | Action | Clicks | Notes |
|------|--------|--------|-------|
| 1 | Navigate to /ocr/verify | 1 | |
| 2 | Click "Quick intake" | 1 | |
| 3 | Click "Step 2: Intake" | 1 | Step navigation |
| 4 | Fill file, template, columns, language | 0 | Keyboard |
| 5 | Click "Read and create draft" | 1 | |
| 6 | Click "Step 3: Review" | 1 | Step navigation |
| 7 | Edit cells | Varies | |
| 8 | Click "Save draft" | 1 | |
| 9 | Click "Step 4: Decision" | 1 | |
| 10 | Click "Submit for approval" | 1 | |
| 11 | Switch to approver role | 1 | Role context switch |
| 12 | Navigate to /ocr/verify | 1 | |
| 13 | Select document from queue | 1 | |
| 14 | Click "Approve" | 1 | |
| **Total** | | **12+** | + edits |

**Current Click Count:** 12+
**Ideal Click Count:** 6 (intake → read → review → submit → open → approve)
**Extra Clicks:** 6+ (step navigation, workspace switching, queue re-selection)

---

### Click Efficiency Score: **4/10**

The scan path is reasonable (6 clicks for basic flow). The verify path is bloated by:
- **Per-issue checking** — each issue requires manual "Mark checked" click
- **Step navigation tabs** — steps 1-4 require clicking between them
- **Workspace switching** — intake vs review requires URL param toggle
- **Queue re-selection** — after creating draft, must navigate step tabs to review

---

## Phase 3 — Context Switching Audit

### Context Switches Measured

| Transition | Count | Severity |
|------------|-------|----------|
| Dashboard → /ocr/scan | 1 | Low |
| /ocr/scan upload → processing (auto) | 0 | None |
| /ocr/scan processing → preview (auto) | 0 | None |
| Source image panel ↔ data table | Ongoing | Low-Medium |
| /ocr/scan → /ocr/verify | 1 | **HIGH** |
| /ocr/verify queue → document detail | 1 | Low |
| Document viewer → issues queue | Ongoing | Medium |
| Issues queue → fix fields | Ongoing | Medium |
| Review notes → approve/reject | 1 | Low |
| Draft/intake → queue (step tabs) | 1 | **HIGH** |

### Context Switching Score: **6/10**

Key pain points:
1. **Scan ↔ Verify split** — The biggest switch. An operator scans on `/ocr/scan`, then the reviewer works on `/ocr/verify`. These are different routes with different UI paradigms (light theme scan vs dark theme verify). The cognitive shift between bright scan interface and dark review interface creates unnecessary friction.
2. **Image ↔ Data comparison** — Users must constantly cross-reference the left-panel image with the right-panel data grid. The active cell bounding box overlay helps, but scrolling can lose sync.
3. **Issue → Fix → Mark** — The issues tab, fix tab, and "Mark checked" flow requires mental state tracking: "Which issue am I on? Did I mark it? Where is the next one?"
4. **Step tabs** — Steps 1-4 in v2 route require explicit navigation clicks. The user must context-switch between "queue selection mode" and "review mode" and "decision mode."

---

## Phase 4 — Operational Pressure Test

### Scenario: 100 workers waiting, supervisor receiving calls, end-of-month deadline

**Simulation assumptions:**
- 30 logbook pages to scan and verify
- Internet latency: 2-3s per API call
- User is distracted (phone ringing, workers approaching)
- Time pressure: "The Excel needs to be in the owner's inbox in 10 minutes"

**Can the task still be completed quickly?**

**Scanning phase:** ✅ Mostly yes. Upload → auto-process → review grid is fairly streamlined. The 90-second timeout is generous for large documents. Cached results help on repeat scans.

**Verification phase:** ❌ Struggles under pressure.

**Failure modes identified:**

1. **Issue overload — critical issue spread** (RISK: CRITICAL)
   - Under pressure, a user may see 15 flagged issues and panic-skip the review
   - The system does not allow "batch approve" — each issue must be individually checked
   - No auto-approve if confidence is high enough
   - IMPACT: User either wastes 5 minutes clicking individual checks, or force-approves with override and risks bad data

2. **Draft save failure — no recovery guidance** (RISK: HIGH)
   - If autosave fails (900ms debounce), the user sees "Autosave failed" toast but no clear path to retry
   - Under pressure, users may close the browser and lose edits
   - No "Retry now" button on the error toast

3. **Mobile workspace tabs — easy to lose state** (RISK: MEDIUM)
   - Mobile users switch between "document", "issues", "fix" tabs
   - If they fix a cell on "fix" tab, then switch to "issues" to mark checked, the selected issue can de-sync
   - No warning that switching tabs while editing may lose unsaved changes

4. **Re-run loses position** (RISK: MEDIUM)
   - Clicking "Re-run with [model]" starts a fresh scan
   - Previous edits are lost (with confirmation dialog, but the user is under pressure and may confirm hastily)
   - No "Compare before/after" view

5. **Multiple open drafts — queue state confusion** (RISK: HIGH)
   - The queue shows all statuses mixed together
   - Under pressure, a user might re-open a document they already approved and re-approve it (waste audit trail)
   - The "Open next document" button is helpful but doesn't filter by status

### Operational Pressure Score: **5/10**

---

## Phase 5 — Reliability Audit

### Race Conditions

| Issue | Severity | Description |
|-------|----------|-------------|
| Autosave + manual save race | MEDIUM | 900ms debounce autosave + manual "Save draft" can fire simultaneously. The update API is sequential (awaits), but the state may be stale between calls. |
| Image retry race | LOW | Image retry uses `setTimeout` with exponential backoff, but the cleanup in `useEffect` may not catch all edge cases if component unmounts mid-retry |
| Polling + user action race | LOW | Job polling (3s interval) could fire during a cancel/retry action |

### Double Submission

| Guard | Present? | Assessment |
|-------|----------|------------|
| Disabled button during save | ✅ | `busy` flag disables action buttons |
| Client_request_id (offline queue) | ✅ | On entry page, but NOT on OCR save |
| Backend idempotency | ⚠️ Partial | Document hash dedup on logbook preview, but NOT on verification save |

### Refresh Failures

| Failure Mode | Recovery | Assessment |
|--------------|----------|------------|
| Browser refresh mid-edit | ✅ UI state persisted via `localStorage` | Good — `saveOcrUiState` / `loadOcrUiState` |
| Browser refresh on verify page | ✅ Route state via URL params | Good — step + verification_id in URL |
| Session expiration mid-scan | ❌ Partial | Image upload state lost; must re-upload |
| Server crash mid-processing | ✅ Retry on 503 | Good — `withOcrWakeRetry` |

### Lost Form State

| Scenario | Risk | Assessment |
|----------|------|------------|
| Draft dirty → navigate away | HIGH | No `beforeunload` warning on scan page. Edits could be lost. |
| Tab close with unsaved edits | HIGH | No `beforeunload` handler detected |
| Model re-run replaces preview | MEDIUM | Confirmation dialog shown, but no "restore previous" option |

### Reliability Score: **7/10**

Strengths: localStorage persistence, URL-param routing, autosave, 503 retry
Weaknesses: No beforeunload guard, no idempotency key on verification save, polling-based job status (could miss transitions)

---

## Phase 6 — Consistency Audit

### Terminology Inconsistencies

| Term in scan page | Term in verify page | Issue |
|-------------------|---------------------|-------|
| "Scan & Review" | "Review OCR documents" | Different page titles for connected flows |
| "step" URL param | "workspace" URL param | Different routing conventions |
| `step=upload/preview/export` | `workspace=intake/review` | Different state model |
| "Scan" (button) | "Intake" (button) | Different labels for essentially same action |
| "Preview & Edit" | "Review workspace" | Different labels for same action |
| "Export" | "Decision" | Step 4 label mismatch |

### UI/UX Inconsistencies

| Element | Scan page | Verify page | Issue |
|---------|-----------|-------------|-------|
| Theme | Light (white/gray) | Dark (black/navy) | Different visual languages for connected workflow |
| Table editing | Inline cell editing | Input per cell + row actions | Different interaction patterns |
| Status display | Banner at top of page | Inline within card | Different info hierarchy |
| Error handling | Inline status + retry button | ErrorBanner component | Different patterns |
| Export buttons | ExportPanel component | Inline buttons | Different visual grouping |
| Confirmation | Custom dialog | No confirmation | Inconsistent feedback |

### Styling Inconsistencies

- Scan page uses `#185FA5` (blue accent) throughout
- Verify page uses CSS variables (`--accent`, `--muted`, `--text`) with dark theme
- Scan page uses `rounded-[28px]` borders; verify page uses `rounded-[1.35rem]` and `rounded-[1.45rem]`
- Scan page uses `shadow-[0_24px_64px_...]`; verify page uses `shadow-2xl`

### Consistency Score: **3/10**

The scan and verify pages were clearly built at different times with different design systems. They need visual and interaction unification.

---

## Phase 7 — Human Error Audit

### Error Scenarios Tested

| Scenario | Risk | Recovery |
|----------|------|----------|
| Wrong image uploaded | HIGH | ❌ Must click "Try another image" (button exists, but flow resets completely) |
| Accidental cell edit | MEDIUM | ✅ Undo (Ctrl+Z) available with full history |
| Missing required field | MEDIUM | ✅ Flagged as issue in verify page, but not in scan page |
| Double-click submit | MEDIUM | ✅ Buttons disabled during busy state |
| Close browser mid-edit | HIGH | ✅ localStorage saves state, but only if step has changed. No beforeunload handler. |
| Keyboard confusion | LOW | ✅ Keyboard shortcuts documented in shortcut strip |
| Delete row by accident | MEDIUM | ✅ Undo available, but no "Are you sure?" prompt |
| Approve without checking all issues | CRITICAL | ✅ Needs override if critical issues remain, but only checks note length (≥20 chars) — easily bypassed |

### Human Error Score: **6/10**

Strengths: Undo/redo, keyboard shortcuts, busy-state guards, confidence indicators
Weaknesses: No beforeunload handler, no delete confirmation, override bypass via short notes, scan page lacks field-level validation

---

## Phase 8 — Multi-Role Workflow Audit

### Operator Role

| Check | Result |
|-------|--------|
| Can scan documents? | ✅ |
| Can edit extracted cells? | ✅ |
| Can export? | ✅ (Excel, CSV, JSON, PDF) |
| Can submit for verification? | ❌ (must be done by supervisor) |
| Can see confidence indicators? | ✅ |
| Can re-run with different model? | ✅ |
| **Friction:** Must switch to /ocr/verify to submit — no handoff button | ⚠️ HIGH |

### Supervisor Role

| Check | Result |
|-------|--------|
| Can scan documents? | ✅ |
| Can review and edit? | ✅ |
| Can submit for approval? | ✅ |
| Can approve? | ❌ (must be Manager/Admin/Owner) |
| Can reject? | ✅ |
| **Friction:** Cannot approve, must escalate. Rejection notes become permanent audit trail. | ⚠️ MEDIUM |

### Manager / Admin / Owner Role

| Check | Result |
|-------|--------|
| Can approve? | ✅ |
| Can reject? | ✅ |
| Can override critical issues? | ✅ (via short reviewer notes) |
| Can export approved data? | ✅ (trusted export) |
| **Friction:** Override threshold is only 20 chars of notes — too easy to bypass | ⚠️ HIGH |

### Role Transition Pain Points

1. **Operator → Supervisor handoff** — No in-app handoff button. Operator must tell supervisor "go to /ocr/verify"
2. **Supervisor → Manager approval** — No notification mechanism. Manager must poll the queue
3. **Rejected → Fixed → Resubmitted** — No clear indicator that a document was previously rejected
4. **Audit trail visibility** — Only visible inside the verify page, not in scan history

### Multi-Role Score: **4/10**

---

## Phase 9 — Regression Risk Analysis

| Change | Risk | Reasoning |
|--------|------|-----------|
| AI model upgrade | HIGH | Different models return different cell structures (string vs object). The `stringifySheetCell` and `normalizeToString` functions handle multiple formats but could break with unexpected changes |
| API response envelope change | HIGH | If `/ocr/logbook` or `/ocr/verifications` API changes response format, the frontend has complex parsing logic that could fail in hard-to-detect ways |
| localStorage schema change | MEDIUM | UI state persistence uses a large object with many fields. Adding/removing fields could cause hydration errors for users with stale state |
| CSS variable rename | MEDIUM | Verify page uses CSS variables extensively. Renaming could break the entire dark theme |
| Permission model change | MEDIUM | Role-based access gating in multiple places — `canUseOcrScan`, `canUseOcrVerification`, `canApproveOcrVerification` |
| Offline/localStorage removal | LOW | If localStorage is cleared, users lose mid-edit state. Recoverable via re-upload |
| Backend job API change | MEDIUM | Job polling, cancel, retry all depend on specific status transitions |

### Overall Regression Risk: **HIGH**

The OCR pipeline has the most complex frontend code in the app. Multiple data format transformations, localStorage serialization, and three different rendering paths (DataTableGrid, OcrSpreadsheetGrid, raw view) compound the regression surface.

---

## Phase 10 — Operational Efficiency Score

| Metric | Score (0-10) | Notes |
|--------|--------------|-------|
| Click Efficiency | 4 | Scan is okay (6 clicks). Verify needs 15-20 clicks for a typical review |
| Navigation Efficiency | 5 | Three sub-pages (scan, verify, history) adds overhead. Step tabs in v2 are click-heavy |
| Reliability | 7 | Autosave, localStorage, and URL routing are strong. No beforeunload guard is a gap |
| Consistency | 3 | Light theme scan vs dark theme verify. Different component APIs. Different terminology |
| Error Resistance | 6 | Undo/redo, busy guards, confidence indicators are good. No delete confirm, bypassable override |
| High Pressure Usability | 5 | Issue-by-issue checking is a bottleneck. No batch operations. Image↔data sync can break |
| Learnability | 6 | Scan page is intuitive (upload → process → review → export). Verify page has a learning curve (queue, issues, fix tabs, trust section) |
| Speed | 6 | Processing is fast with caching. Autosave is 900ms debounce which feels snappy. Full verify cycle is slow due to per-issue checking |

### Total Score: **42/80 (52.5%)**

---

## Critical Findings

### CRITICAL: Scan-Verify workflow split creates a handoff gap
**Issue:** The scan flow (`/ocr/scan`) and verify flow (`/ocr/verify`) are separate routes with different UI paradigms. An operator who scans a document cannot hand it off to a reviewer without navigating away. The reviewer must manually search the queue for the new document.
**Impact:** Documents can get lost between scan and verify. No notification system exists.
**Recommendation:** Add a "Send for review" button in the scan page's export step that creates/opens the verify page with the new verification ID pre-selected.

### CRITICAL: Verify page issue-by-issue checking is a bottleneck
**Issue:** Each flagged issue requires the user to click the issue, review it, click "Mark checked", and move to the next. For a document with 15 issues, that's 30+ clicks.
**Under pressure:** User skips or force-approves, defeating the purpose of verification.
**Recommendation:** Add a "Review all" mode that shows all flagged cells inline with keyboard navigation (Tab through fields), reducing to 1 click per field + 1 batch "Mark all checked".

### HIGH: No beforeunload handler on scan or verify pages
**Issue:** If a user closes the browser tab while editing OCR data, there's no warning. localStorage persistence helps but only for the scan page's UI state, not the verify page's draft edits.
**Impact:** Data loss on accidental tab close or browser crash.
**Recommendation:** Add `beforeunload` handler on both pages when there are unsaved edits (`draftDirty` or `dirty` state).

### HIGH: Verify page override bypass
**Issue:** The approve override check only requires reviewer notes to be ≥20 characters. A user can type "Everything looks fine" (19 chars) + "a" and bypass critical issue review.
**Impact:** Weak guardrail defeats the purpose of the critical issue system.
**Recommendation:** Require at least 3 critical issues to be explicitly "Marked checked" before override is available, plus a minimum 40-character justification.

### HIGH: No in-app notification for approval workflow
**Issue:** When a document moves through the OCR pipeline (scan → submit → approve/reject), the next person in the chain has no notification. They must manually check the queue.
**Impact:** Documents stall in "pending" state until someone happens to check the queue.
**Recommendation:** Add notification triggers for OCR state transitions (submitted → notify approvers, approved → notify submitter, rejected → notify submitter).

### MEDIUM: Theme/consistency gap between scan and verify
**Issue:** Scan page uses light theme; verify page uses dark theme. Different border radius, spacing, and component patterns.
**Impact:** Cognitive load when switching between pages. Learning curve for new users who must understand two different UI languages.
**Recommendation:** Unify the visual design between scan and verify pages. Use the same component library, color scheme, and spacing scale.

### MEDIUM: No batch operations in verify
**Issue:** No "Select all" → "Mark all checked" or "Approve all" across multiple queue documents.
**Impact:** Supervisors reviewing 20+ documents must repeat the same click cycle for each one.
**Recommendation:** Add multi-select in the queue with batch approve/reject/export actions.

---

## Recommended Improvements (Priority Order)

1. **🔴 Send for review button on scan page export** — Bridge the scan→verify gap
2. **🔴 Batch issue resolution in verify** — "Review all" mode with Tab navigation through flagged cells
3. **🟡 beforeunload handlers** — Prevent data loss on both scan and verify pages
4. **🟡 Strengthen approval override** — Require explicit issue checks + 40-char justification
5. 🟡 Notification hooks for OCR workflow transitions
6. 🟡 Visual unification of scan and verify pages
7. 🟢 Batch queue operations (multi-select + bulk approve/reject)
8. 🟢 Confirm dialog for row deletion (currently no "Are you sure?")
9. 🟢 Add client_request_id for idempotent verification saves
10. 🟢 "Retry save" button on autosave error toast

---

## Before vs After Workflow (Critical Fix)

### Before (Current)
```
Scan → [No handoff] → Verify → [15+ clicks on issues] → [Override bypass] → Approve
```

### After (Suggested)
```
Scan → [Send for review button] → Verify → [Tab-through flagged cells, 1 click per field]
→ [Batch "Mark all checked"] → [Override requires 3 explicit checks + 40-char note] → Approve
```

**Reduction:** From 20+ clicks to ~8 clicks for a typical document with 15 issues.
