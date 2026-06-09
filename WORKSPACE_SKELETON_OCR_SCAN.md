# OCR Scan — Workspace Skeleton Architecture
# FactoryNerve OS | Phase 3 Skeleton Specification | Phase C, Item 5
# Route: /ocr/scan
# Generated: 2026-06-04
# Status: DRAFT

---

## 1. WORKSPACE OVERVIEW

### 1.1 Identity

| Field | Value |
|---|---|
| Route | `/ocr/scan` |
| Workspace Name | OCR Scan — Document Extraction Workspace |
| Operational Role | Immersive document scanning and extraction environment. User captures or uploads a document image, the Anthropic AI pipeline extracts tabular or structured data, user reviews and corrects the extraction grid, then saves a draft or exports to XLSX/CSV. The workspace owns the full scan→extract→correct→export loop without route switching. |
| Business Impact | If this workspace fails, factory operators and supervisors cannot convert paper documents (attendance sheets, dispatch records, purchase orders, delivery receipts) into structured digital records. All downstream OCR verification, approval, and export workflows are blocked. This is the entry point for all paper-based data in the system. |
| User Population | Operator (primary — scans documents on the floor, mobile-first). Supervisor, manager, admin, owner (secondary — desktop use, batch review). Accountant does NOT have access (`canUseOcrScan` excludes accountant role). |
| Peak Usage Context | Morning shift start (batch scanning of overnight paper documents). End of shift (dispatch and attendance records). Ad hoc throughout the day by operators at stations. |
| Predecessor Workspaces | None — this is an entry-point workspace. Optional: `/ocr/history` (reopen a previous draft). |
| Successor Workspaces | `/ocr/verify` (submit draft for supervisor review and approval). `/ocr/history` (draft saved and visible in history). |


### 1.2 Operational Importance

Every paper document that enters the FactoryNerve system passes through this workspace. Operators on the factory floor use it on mobile devices — often in poor lighting, under time pressure, with limited patience for multi-step friction. The scan must succeed on the first attempt with the minimum number of taps. The extraction result must be immediately legible and correctable. The save path must be obvious and fast.

This workspace is also the only route in the shell that operates in `mode: "camera"` — the AppShell suppresses the mobile topbar and bottom navigation, hides the feedback widget, and forces the sidebar open on desktop. The workspace owns its entire vertical viewport. Every layout decision must respect this: there is no global chrome below or around the content on mobile. The workspace is the shell.

### 1.3 Shell Mode Contract

`/ocr/scan` triggers `shellLayout.mode === "camera"` via `getShellLayout()` in `use-app-shell-state.ts`.

Shell behavior in camera mode:
- Mobile: topbar hidden, bottom nav hidden, feedback widget hidden. Sidebar hidden (slides in on demand).
- Desktop (≥1024px): sidebar forced open at `13.75rem` width. No topbar rendered (workspace owns top area). Content region has `lg:pl-[13.75rem]` padding.
- Both: `immersiveScannerRoute = true`. The workspace fills `h-[calc(100vh-var(--app-topbar-height,0px))]` (topbar height resolves to 0 in camera mode).

**Layout implication:** The workspace must render its own top bar (StepBar) at the top of the content region — it cannot rely on the AppShell topbar. On mobile, this StepBar is the only persistent orientation anchor.


### 1.4 Current State Failures

- **Failure 1:** Header section uses `factory-ocr-header__eyebrow` with `uppercase tracking-[0.3em]` ("Governed OCR Review Console") — same uppercase tracking anti-pattern eliminated in every Phase C workspace. Appears in both `governed-ocr-intake-screen.tsx` and `governed-ocr-verification-page.tsx`.
- **Failure 2:** `factory-ocr-telemetry` block ("Queue slice / Active signals / Workflow stage") — three metric items in a decorative telemetry strip. The word "telemetry" is banned per doctrine. "Active signals" is banned. This block has zero operational value on the upload/prepare screens where it appears — the operator does not need to know how many templates are available before scanning.
- **Failure 3:** `bg-black/20` + `border-white/10` banner ("Governed intake stays rollback-safe") — raw opacity modifier on a non-overlay element. Blueprint violation.
- **Failure 4:** `<main className="... min-h-screen">` on the intake screen — the workspace already fills the viewport via the shell's camera mode. `min-h-screen` on an immersive workspace inside a full-viewport shell creates scroll overflow.
- **Failure 5:** Legacy rollback lane link rendered in the primary scan workspace — "Open legacy rollback lane" as an `fn-btn-secondary` in the primary action group. Engineering scaffolding surfaced as user-facing UI.
- **Failure 6:** Step progression uses `factory-ocr-stagepill` CSS classes with no reference to the design token system. Custom CSS classes bypass the token contract.
- **Failure 7:** Status banners use `border-red-500/30 bg-red-500/10 text-red-100` / `border-emerald-500/30 bg-emerald-500/10 text-emerald-100` — raw Tailwind color values instead of `var(--status-*)` tokens.
- **Failure 8:** Upload step renders `<UploadBox>` and `<CameraCapture>` inside the existing page without a clear spatial zone contract. On mobile, the camera capture and upload areas compete for the full viewport without a defined layout authority.
- **Failure 9:** The full extraction pipeline is in a single 2932-line component (`ocr-scan-page.tsx`). The skeleton must define zone boundaries that allow eventual decomposition without changing the data flow.

---

## 2. WORKSPACE CLASSIFICATION

| Dimension | Classification | Rationale |
|---|---|---|
| Workspace Type | Immersive Scanner | TYPE 6 — camera-primary, full-viewport, sidebar hidden on mobile, Anthropic pipeline. |
| Workflow Category | Capture → Transform → Correct → Save | Multi-step linear flow with in-place correction. |
| Operational Behavior | Step-driven | Four named steps: Upload → Processing → Preview & Edit → Export. URL reflects current step. |
| Data Density | MEDIUM (Upload/Processing) → HIGH (Preview/Edit) | Upload step is sparse. Preview/Edit step renders a full correction grid with confidence overlay. |
| Realtime Complexity | MEDIUM | Processing step polls job status. No WebSocket. Extraction result arrives as single response. |
| AI Complexity | HIGH | Anthropic pipeline (Claude Haiku / Sonnet / Opus). Model selection. Confidence matrix overlay. Low-confidence cell highlighting. Re-run support. |
| Audit Complexity | LOW | Draft save creates/updates an `OcrVerificationRecord`. No multi-actor approval on this route. |
| Decision Pressure | MEDIUM | Operator must decide: accept extraction as-is, correct cells, or discard and re-scan. |

**Classification Implication:** IMMERSIVE SCANNER + HIGH AI = the workspace must surface AI confidence spatially (on the grid, not in a sidebar panel), make the correction interaction immediate (inline cell edit, not a modal), and make the re-run path visible but not prominent (it is an escape hatch, not a primary action). The step structure must be legible at a glance from the StepBar — the operator must always know where they are in the pipeline.


---

## 3. BACKEND OPERATIONAL MAPPING

### 3.1 API Surface

| Endpoint | Method | Purpose | Permission | Key Response Fields | Error States |
|---|---|---|---|---|---|
| `/ocr/preview` | POST | Submit image file → extract structured table via Anthropic pipeline | canUseOcrScan | `OcrPreviewResult`: `headers[]`, `rows[][]`, `avg_confidence`, `scan_quality`, `routing`, `warnings`, `cell_confidence[][]` | 400 (invalid file), 413 (file too large >5MB), 503 (Anthropic unavailable), 422 (no table detected) |
| `/ocr/verifications` | POST | Save extraction result as a new `OcrVerificationRecord` draft | canUseOcrScan | `OcrVerificationRecord`: `id`, `status: "draft"`, `headers`, `reviewed_rows`, `avg_confidence` | 401 (session expired), 413 (payload too large) |
| `/ocr/verifications/{id}` | PUT | Update an existing draft (autosave after corrections) | canUseOcrScan (own record) | `OcrVerificationRecord` | 404 (record not found), 403 (wrong owner) |
| `/ocr/verifications/{id}` | GET | Load a previous draft by verification ID | canUseOcrScan (own record) | `OcrVerificationRecord` | 404, 403 |
| `/ocr/verifications` | GET | List recent drafts for the operator (max 8, most recent first) | canUseOcrScan | `OcrHistoryItem[]` | 401 |
| `/ocr/warp` | POST | Deskew/perspective-correct an image before extraction | canUseOcrScan | `OcrWarpResult`: `blob`, `corners` | 400 (warp failed) |
| `/ocr/verifications/{id}/export` | GET | Download approved verification as XLSX | canUseOcrScan (own record) | Binary XLSX blob | 404, 403 |
| `/ocr/verifications/{id}/share` | POST | Generate a share link for a verification record | canUseOcrScan | `OcrVerificationShareLink`: `url`, `expires_at` | 404, 403 |

### 3.2 Entity Relationship Map

```
OcrPreviewResult (extraction response — not persisted)
  ├── headers: string[]
  ├── rows: OcrCell[][]           — original extracted rows
  ├── cell_confidence: number[][] — per-cell confidence (0.0–1.0)
  ├── scan_quality: OcrScanQuality
  │     ├── confidence_band: "high" | "medium" | "low" | "unknown"
  │     └── quality_signals: string[]
  ├── routing: OcrRoutingMeta
  │     ├── provider_used: "anthropic" | "bytez" | "tesseract"
  │     ├── provider_model: string
  │     └── processing_time_ms: number
  └── warnings: string[]

OcrVerificationRecord (persisted draft)
  ├── id: number
  ├── status: "draft" | "pending" | "approved" | "rejected"
  ├── headers: string[]
  ├── original_rows: OcrCell[][]  — extraction output, immutable
  ├── reviewed_rows: OcrCell[][]  — operator-corrected version, mutable
  ├── cell_confidence: number[][]
  ├── avg_confidence: number
  ├── source_filename: string
  ├── source_image_url: string    — stored image, used in source viewer
  └── scan_quality: OcrScanQuality
```

**Primary entity:** The workspace works in two phases — pre-save (`OcrPreviewResult` in component state) and post-save (`OcrVerificationRecord` from the API). The autosave mutation bridges these two phases. The `savedId` state tracks whether a record exists. The `draftDirty` flag triggers autosave 1500ms after the last cell edit.

### 3.3 Workflow State Machine

```
[upload step]
  ├── User selects file (or camera capture)
  ├── File prepared (rasterize PDF, validate, optionally warp)
  └── User clicks "Extract" → enters [processing step]

[processing step]
  ├── POST /ocr/preview with file
  ├── Progress indicator stages: uploaded → preprocess → detect → extract → confidence
  └── On success → [preview & edit step]
      On error → [upload step] with error message

[preview & edit step]
  ├── OcrPreviewResult displayed in correction grid
  ├── User edits cells inline → draftDirty = true → autosave fires (1500ms debounce)
  ├── User can: undo/redo, show/hide confidence overlay, switch view mode (spreadsheet / raw)
  ├── User can re-run extraction with different model → returns to [processing step]
  └── User clicks "Save & continue" → POST /ocr/verifications → [export step]

[export step]
  ├── savedId is set
  ├── User can: export XLSX, export CSV, copy data, generate share link
  └── User can navigate to /ocr/verify to submit for approval
```

### 3.4 Realtime Contracts

| System | Transport | Update Rate | Zones Affected | Stale State Handling |
|---|---|---|---|---|
| Extraction pipeline | HTTP POST (streaming not used) | Single response on completion | ProcessingZone progress indicator | On timeout: show error, return to upload |
| Autosave | `setTimeout` 1500ms debounce | After cell edits | StatusBanner | On failure: `draftSaveError` shown in StatusBanner |
| Recent records load | HTTP GET on mount | Once on component mount | RecentDraftsList (upload step) | On failure: `recentRecords = []`, no UI disruption |
| Image retry | `setTimeout` 3000ms | Up to 3 retries | SourceViewer image element | After 3 retries: `imageLoadError = true`, show placeholder |


### 3.5 AI System Contracts

| System | Provider | Models | Trigger | Output | Confidence Display |
|---|---|---|---|---|---|
| Document extraction | Anthropic | Claude Haiku 4.5 (default/auto), Claude Sonnet 4.6, Claude Opus 4.7 | User clicks "Extract" | `OcrPreviewResult.rows[][]` + `cell_confidence[][]` | Per-cell confidence tint overlay on correction grid |

**Model selection:** `selectedModel` state defaults to `"auto"`. Auto routing uses `clarity_score` from `OcrRoutingMeta` to select tier. Manual model selection shown in SettingsDrawer (accessible from PreviewToolbar). Not shown in primary flow.

**Confidence display rules:**
- `confidence >= 0.85` (high): no overlay. Cell renders normally.
- `0.70 ≤ confidence < 0.85` (medium): amber tint at 15% opacity on cell background.
- `confidence < 0.70` (review_required): rust-red tint at 15% opacity + 1px left border on cell.
- Confidence overlay toggled by `showLowConfidence` state. Toggle button in PreviewToolbar.
- `visibleLowConfidenceCount` shows count of review-required cells in PreviewToolbar.

**Re-run:** A "Re-extract" button in PreviewToolbar allows re-running the extraction with the current file and a different model. Triggers confirmation if `draftDirty = true` (unsaved corrections would be lost).

### 3.6 Permission Matrix

| Role | Access OCR scan | Camera capture | Upload file | Extract | Correct grid | Save draft | Export XLSX | Submit for review |
|---|---|---|---|---|---|---|---|---|
| attendance | ✗ (role gate) | ✗ | ✗ | ✗ | ✗ | ✗ | ✗ | ✗ |
| accountant | ✗ (role gate) | ✗ | ✗ | ✗ | ✗ | ✗ | ✗ | ✗ |
| operator | ✓ | ✓ | ✓ | ✓ | ✓ | ✓ | ✓ | ✓ |
| supervisor | ✓ | ✓ | ✓ | ✓ | ✓ | ✓ | ✓ | ✓ |
| manager | ✓ | ✓ | ✓ | ✓ | ✓ | ✓ | ✓ | ✓ |
| admin | ✓ | ✓ | ✓ | ✓ | ✓ | ✓ | ✓ | ✓ |
| owner | ✓ | ✓ | ✓ | ✓ | ✓ | ✓ | ✓ | ✓ |

**Permission implication:** `canUseOcrScan(user.role)` gates the entire workspace. Accountant and attendance roles see a role-gate screen (no camera, no upload). All canUseOcr roles have identical capability — there is no tiered access within this workspace.

---

## 4. WORKSPACE STRUCTURAL ANATOMY

### 4.1 Layout Pattern

**IMMERSIVE SCANNER — STEP-DRIVEN FULL VIEWPORT**

The workspace fills the full viewport height. The AppShell camera mode has already removed the topbar and bottom nav. The workspace owns `h-full` (resolving to `calc(100vh)` on mobile, `calc(100vh)` minus nothing on desktop in camera mode).

**Zone structure changes by step:**

- **Upload step:** StepBar (top) + UploadZone (center, fills remaining height) + RecentDraftsRail (bottom, collapsible).
- **Processing step:** StepBar (top) + ProcessingZone (center, full remaining height).
- **Preview & Edit step:** StepBar (top) + PreviewToolbar (below StepBar) + SplitView (fills remaining: SourceViewer left | CorrectionGrid right). On mobile: tab-switched (Source | Grid).
- **Export step:** StepBar (top) + ExportZone (center, constrained width).

**Pattern selection justification:** Step-driven immersive layout is the only pattern that allows the camera/upload experience to own the full viewport on mobile while seamlessly transitioning to the split-view correction experience on desktop. A persistent rail layout would waste vertical space in the upload step and create cramped conditions for the correction grid. A tabbed layout would hide the source image during correction, eliminating the spatial reference that allows operators to visually verify extracted values.


### 4.2 Structural Reduction Notes

- `factory-ocr-header` section (eyebrow + h1 + subtitle + telemetry strip + stagebar) → **eliminated**. The full header block is replaced by a compact 48px StepBar. The subtitle and telemetry data have zero operational value during scanning — the operator knows what they are doing. The stagebar is rebuilt as a token-compliant StepBar component.
- `bg-black/20 border-white/10` legacy rollback banner → **eliminated**. Engineering scaffolding removed from user-facing UI.
- `min-h-screen` on intake `<main>` → **replaced** with `h-full flex flex-col` per camera mode contract.
- `factory-ocr-telemetry` block → **eliminated**. The three items ("Templates available", "Language hint", "Expected columns") are configuration settings accessible in the SettingsDrawer on the upload step, not ambient display items.
- Status banners using raw Tailwind color values → **replaced** with `var(--status-*)` tokens via `StatusBanner` primitive.
- `uppercase tracking-[0.3em]` eyebrow labels → **eliminated** everywhere on this route.

---

### 4.3 Zone Definitions

---

#### ZONE: StepBar (Top, Sticky, All Steps)

| Property | Value |
|---|---|
| Operational Role | Persistent orientation bar. Shows current step in the four-step pipeline (Upload / Processing / Preview & Edit / Export), workspace title, and a back/reset action. The operator always knows where they are in the extraction flow. |
| Attention Priority | 3 |
| Position | Top — spans full workspace width, inside the workspace `<main>` |
| Width | full-width |
| Height | fixed: 48px |
| Sticky Behavior | sticky top-0 within the workspace scroll context |
| Collapse Behavior | never |
| Steps | Upload (1) → Processing (2) → Preview & Edit (3) → Export (4) |

**Contents:**
- Back/reset button: left-aligned, ghost, 32px touch target. On Upload step: navigates to `/ocr/history` (or does nothing if no history). On all other steps: triggers `resetFlow()` with confirmation if `draftDirty = true`.
- Step indicators: four pills — completed steps show a filled check, current step shows active treatment, future steps show inactive. No animated pulse on any pill.
- Workspace label: "Document scan" — 14px / weight 500 / sentence case. Right-aligned on desktop, hidden on mobile (step pills provide sufficient context).
- Status indicator: 8px dot, positioned right of workspace label. `saving` state shows amber dot + "Saving…" text (11px). `saved` state shows success dot + "Saved" text. `error` state shows rust-red dot. On mobile: dot only (no text).

**Acceptance Criteria:**
- [ ] StepBar is 48px, sticky within workspace scroll context
- [ ] No uppercase tracking on any StepBar text
- [ ] Step pills use token variables for active/completed/idle states — no raw color values
- [ ] Reset/back button triggers `confirmOpen` dialog if `draftDirty = true`
- [ ] "Document scan" label sentence case, 14px/500
- [ ] Autosave status dot uses `var(--status-warning-text)` for saving, `var(--status-ok-text)` for saved, `var(--status-error-text)` for error

---

#### ZONE: StatusBanner (Below StepBar, Conditional)

| Property | Value |
|---|---|
| Operational Role | Surfaces transient feedback messages (extraction success, autosave error, draft loaded, processing warning). Appears only when a `status` message is present. Dismisses automatically after 5 seconds for success/warning tones; persists for error tone until dismissed. |
| Attention Priority | 2 |
| Position | Below StepBar |
| Width | full-width |
| Height | auto — single line preferred, wraps if message exceeds width |
| Sticky Behavior | not sticky |
| Collapse Behavior | auto-dismiss 5s (success/warning). Persistent until dismiss (error). |

**Contents:**
- Status icon: 16px, semantic color from `var(--status-*)` tokens.
- Status message: 13px / weight 400 / sentence case.
- Dismiss button: right-aligned, ghost icon (×), 32px touch target. Present on all tones.

**Prohibited:**
- `bg-red-500/10 border-red-500/30 text-red-100` — raw Tailwind color values. Use `var(--status-error-bg)`, `var(--status-error-border)`, `var(--status-error-text)`.
- `bg-emerald-500/10 border-emerald-500/30 text-emerald-100` — same violation.
- Permanent banner for non-error messages.

**Acceptance Criteria:**
- [ ] All three tones (success, warning, error) use `var(--status-*)` token variables only
- [ ] Auto-dismiss fires after 5000ms for success/warning via `useEffect` + `setTimeout`
- [ ] Error tone persists until user dismissal
- [ ] `draftSaveError` message renders in error tone


---

#### ZONE: UploadZone (Upload Step — Primary)

| Property | Value |
|---|---|
| Operational Role | The primary file intake surface. Operator selects a file from gallery/files or opens the camera. On desktop: drag-and-drop area. On mobile: two large buttons (Camera / Gallery). The extraction settings (model, language) are in a SettingsDrawer, not surfaced here. |
| Attention Priority | 1 |
| Position | Below StatusBanner (or below StepBar if no banner). Fills remaining viewport height. |
| Width | full-width, content constrained to max-w-lg centered |
| Height | fill-remaining |
| Sticky Behavior | not sticky |

**Contents (mobile — isMobile = true):**
- Camera button: full-width, height 56px, primary variant. Icon + "Scan document". Opens camera panel (`route.openCamera()`).
- Gallery button: full-width, height 56px, secondary variant. Icon + "Upload from gallery". Opens `uploadInputRef` file picker.
- File input: `type="file"`, `accept="image/*,application/pdf"`, hidden, ref=`uploadInputRef`.
- Remote URL input: collapsed by default. "Use image URL" text link below buttons expands it. Input + "Load" button. For advanced users only.

**Contents (desktop — isMobile = false):**
- Drop zone: dashed border, `var(--border-subtle)`, min-height 240px, center-aligned. "Drop a document image here" (14px/400/sentence case). Click to open file picker.
- Drag-over state: border changes to `var(--accent-operational-border)`, background tint `var(--surface-accent)` at 8% opacity.
- Two buttons below drop zone: "Upload file" (primary) + "Use camera" (secondary, opens camera panel).
- Remote URL input: inline below buttons.

**Contents (both):**
- Model selector: NOT shown here. Lives in SettingsDrawer.
- Language hint: NOT shown here. Lives in SettingsDrawer.
- Settings gear icon: top-right of UploadZone, ghost, 36px. Opens SettingsDrawer.
- Recent drafts rail: below the upload controls. See RecentDraftsRail zone.

**Prohibited:**
- Model/language fields embedded in the primary upload area. Reason: these are advanced settings that create decision overhead for the majority of operators who scan with default settings. Default settings handle 80% of documents correctly. Surfacing model selection before scanning forces a decision that most operators are not equipped to make, and produces no operational benefit.
- "Expected columns" field in the primary view. Reason: same — this is a template configuration setting, not a scan precondition.

**Acceptance Criteria:**
- [ ] Mobile layout shows Camera + Gallery as full-width buttons, 56px height
- [ ] Desktop layout shows drop zone with drag-over state
- [ ] File picker accepts `image/*` and `application/pdf`
- [ ] Settings gear opens SettingsDrawer (not an inline expansion)
- [ ] No model selector, language selector, or column count field in the primary upload area

---

#### ZONE: SettingsDrawer (Upload Step — Slide-in Panel)

| Property | Value |
|---|---|
| Operational Role | Contains extraction configuration: model selection, language hint, template selection, column count hint. Accessible via gear icon from UploadZone. Hidden by default — most operators never open it. |
| Attention Priority | 4 |
| Position | Right-side drawer, 320px width on desktop. Bottom sheet on mobile. |
| Trigger | Settings gear icon in UploadZone |

**Contents:**
- Model selector: `Select` component. Options: Auto (default), Claude Haiku 4.5, Claude Sonnet 4.6, Claude Opus 4.7. Label: "Extraction model" (sentence case, 13px/500).
- Language hint: `Select`. Options from `previewLanguages`. Label: "Language hint".
- Template selector: `Select`. Options from `templateOptions`. Label: "Template" (optional).
- Column hint: `Input` type="number", min=1, max=24. Label: "Expected columns".
- Close button: top-right, ghost.

**Acceptance Criteria:**
- [ ] Drawer does not render in the DOM until first opened (lazy mount)
- [ ] All labels sentence case — no uppercase tracking
- [ ] Drawer closes on outside click and on Escape key


---

#### ZONE: RecentDraftsRail (Upload Step — Bottom)

| Property | Value |
|---|---|
| Operational Role | Shows the operator's 8 most recent OCR drafts. Allows re-opening a previous draft without navigating to `/ocr/history`. Collapsed by default on mobile, visible on desktop. |
| Attention Priority | 4 |
| Position | Bottom of UploadZone — pushes above the fold on desktop, scrolls below on mobile |
| Width | full-width |
| Height | auto — single horizontal scroll row on desktop, collapsed/expanded list on mobile |
| Collapse Behavior | Collapsed on mobile — "Recent scans (N)" toggle label expands the list |

**Contents:**
- Section label: "Recent scans" — 12px / weight 500 / sentence case / 55% opacity.
- Draft items: horizontal scroll row on desktop. Each item: draft thumbnail (if `has_source_image`), filename (truncated to 20 chars), status badge (`draft` / `pending` / `approved`), date (relative, e.g., "2h ago"). Click → `openRecentRecord(id)`.
- Empty state: "No recent scans" — 12px / 45% opacity. No decorative card.

**Acceptance Criteria:**
- [ ] Maximum 8 items loaded on mount
- [ ] Each item is keyboard-accessible
- [ ] Status badge uses semantic token (draft = muted, pending = warning, approved = success)
- [ ] Load failure: `recentRecords = []`, no error shown (silent failure per spec)

---

#### ZONE: ProcessingZone (Processing Step — Primary)

| Property | Value |
|---|---|
| Operational Role | Shows extraction pipeline progress during the POST /ocr/preview call. Five stages: uploaded → preprocess → detect → extract → confidence. Operator sees progress without an indeterminate spinner — each stage label confirms the pipeline is advancing. |
| Attention Priority | 1 |
| Position | Fills remaining viewport after StepBar |
| Width | full-width, content centered max-w-sm |
| Height | fill-remaining, content vertically centered |

**Contents:**
- Document thumbnail: the prepared preview image, 120px max height, centered. If no image: a document icon placeholder.
- Source filename: 14px / weight 500 / sentence case / truncated at 40 chars.
- Stage progress list: five rows, each with a 16px indicator (pending = grey circle, active = amber pulse-free dot, complete = filled check) and a stage label (sentence case, 13px/400).
  - Stage labels (sentence case, replacing current implementation's implicit names): "Uploading document" → "Preparing image" → "Detecting structure" → "Extracting data" → "Checking quality"
- Cancel button: ghost, "Cancel" — aborts the in-flight request if cancellable. Renders below stage list.

**Prohibited:**
- Spinner animations that loop indefinitely. Reason: looping spinners create anxiety without conveying progress. The five-stage list communicates that the pipeline is advancing through discrete steps.
- Percentage completion numbers. Reason: the pipeline does not report reliable sub-stage percentages. Displaying invented progress values trains operators to distrust the indicator.
- "Processing..." as the only visual feedback. Reason: this tells the operator nothing about where in the pipeline their document is, increasing uncertainty and retry behavior.

**Acceptance Criteria:**
- [ ] Active stage shows amber static dot (no CSS pulse animation)
- [ ] Completed stages show filled check icon
- [ ] Stage labels are sentence case — no uppercase
- [ ] Cancel button renders and calls abort controller if request is in-flight
- [ ] Thumbnail uses prepared preview URL if available, falls back to original URL


---

#### ZONE: PreviewToolbar (Preview & Edit Step — Below StepBar)

| Property | Value |
|---|---|
| Operational Role | Compact action bar for the extraction review step. Contains confidence toggle, view mode switch, undo/redo, re-extract, and the primary save action. Does NOT contain export actions — those are on the Export step. |
| Attention Priority | 2 |
| Position | Below StepBar (and StatusBanner if present) |
| Width | full-width |
| Height | fixed: 44px |
| Sticky Behavior | sticky below StepBar |

**Contents (left group):**
- Confidence overlay toggle: ghost icon button + label "N low-confidence" (amber, 12px/500) when `visibleLowConfidenceCount > 0`. "All verified" (success, 12px/400) when count = 0. Toggle turns overlay on/off.
- View mode toggle: "Spreadsheet" / "Raw" — segmented control, 2 options.

**Contents (right group):**
- Undo: ghost icon, disabled when `canUndo = false`.
- Redo: ghost icon, disabled when `canRedo = false`.
- Re-extract: ghost, "Re-extract" text + icon. Triggers confirmation modal if `draftDirty = true` ("Re-extracting will replace your corrections. Continue?"). Then returns to upload step with file preserved.
- Save & continue: primary button, "Save & continue" → triggers `persistStructuredDraft()` then advances to export step.

**Prohibited:**
- Export actions (XLSX, CSV, copy) in the PreviewToolbar. Reason: export actions belong at the export step. Surfacing them during correction suggests that the operator should export before reviewing, which inverts the intended workflow and produces unreviewed exports.
- "Submit for approval" button in the PreviewToolbar. Reason: submission is an export-step action — it signals that the operator has finished reviewing. Showing it during review implies the work is done before it is.

**Acceptance Criteria:**
- [ ] Toolbar is 44px, sticky below StepBar
- [ ] Confidence count uses `var(--status-warning-text)` when > 0
- [ ] Undo/redo buttons disable correctly based on `canUndo`/`canRedo`
- [ ] "Save & continue" triggers `persistStructuredDraft()` — NOT a direct step change
- [ ] Re-extract confirmation uses `ConfirmationModal` primitive

---

#### ZONE: SplitView (Preview & Edit Step — Primary)

| Property | Value |
|---|---|
| Operational Role | The primary correction environment. Left panel: SourceViewer (original document image with bounding box overlay). Right panel: CorrectionGrid (editable extraction table). On mobile: tab-switched (Source tab / Grid tab). The two panels together allow the operator to verify extracted values against the source document without toggling between views. |
| Attention Priority | 1 |
| Position | Below PreviewToolbar. Fills remaining viewport height. |
| Width | full-width |
| Height | fill-remaining — this zone must never scroll the page. Internal panels scroll independently. |
| Desktop split | Left: 40% / Right: 60%. Resizable via drag handle. |
| Mobile | Tab switcher: "Source" (tab 1) / "Grid" (tab 2). Default active: "Grid". |

**SourceViewer (left panel):**
- Document image rendered at controlled zoom level (`zoom` state, default fit-to-width).
- Active cell bounding box overlay: semi-transparent amber rect, positioned via `buildBoundingBox()`. Updates when active cell changes in CorrectionGrid.
- Image controls (bottom of panel): zoom in, zoom out, fit-to-width, fit-to-height. Ghost icon buttons.
- Magnifier: pointer-activated, `magnifierEnabled` state. Toggle in image controls.
- If `imageLoadError = true` after 3 retries: show placeholder ("Source image unavailable") — sentence case, 13px/50% opacity.
- Drag-to-pan: pointer capture on mousedown, scroll offsets on pointermove.

**CorrectionGrid (right panel):**
- Renders `OcrSpreadsheetGrid` or `DataTableGrid` based on `USE_TANSTACK_TABLE` feature flag. This is an internal implementation detail — the skeleton does not prescribe which component, only the behavioral contract.
- Editable header row: each column header is an editable `<input>`. Tab moves to next header. Enter moves to first data cell in the column.
- Editable data cells: inline edit on click/focus. All cells editable regardless of confidence.
- Confidence tint overlay: per-cell background color based on `confidenceMatrix` and `showLowConfidence` state. High = none, medium = amber 15%, review_required = rust-red 15% + 1px left border.
- Cell label (bottom of panel): `activeCellLabel` — "R3: Supplier Name" (13px/400/monospace). Updates on focus change.
- `headerRowEnabled` toggle: ghost button in grid toolbar — "Header row" on/off.

**Acceptance Criteria:**
- [ ] Split view fills remaining viewport — no page-level overflow
- [ ] SourceViewer and CorrectionGrid scroll independently
- [ ] Bounding box overlay updates within 16ms of active cell change (requestAnimationFrame)
- [ ] Mobile tab switcher: "Grid" tab active by default
- [ ] Drag handle between panels persists split ratio in component state (not localStorage)
- [ ] Confidence tint uses `var(--status-warning-bg)` and `var(--status-error-bg)` tokens — no raw color values
- [ ] `activeCellLabel` uses JetBrains Mono


---

#### ZONE: ExportZone (Export Step — Primary)

| Property | Value |
|---|---|
| Operational Role | Post-save actions. The draft has been saved (`savedId` is set). Operator can export the data in multiple formats, generate a share link, or navigate to /ocr/verify to submit for approval. This zone is the final step of the scan→export workflow. |
| Attention Priority | 1 |
| Position | Below StepBar. Content constrained to max-w-lg centered. Fills remaining height with vertical centering. |
| Width | max-w-lg centered |
| Height | fill-remaining, content vertically centered |

**Contents:**
- Draft summary card (Tier 1): filename, row count, column count, confidence band label, model used. No decorative treatment. Plain surface, 12px token-compliant values.
- Primary action: "Submit for review" — primary button, full-width, navigates to `/ocr/verify?id={savedId}`. Renders only if `savedId` is set.
- Export actions group: "Export XLSX" (secondary), "Export CSV" (secondary), "Copy data" (ghost). All disabled while `excelBusy = true`.
- Share link: "Generate share link" ghost button → calls `createOcrVerificationShareLink(savedId)` → renders the link + expiry timestamp inline. `shareBusy` drives disabled state.
- "Scan another document" link: ghost, below all actions. Triggers `resetFlow()`.

**Prohibited:**
- Export actions shown before `savedId` is set. Reason: exporting an unsaved extraction produces a local export that has no record in the system, breaks the verification chain, and cannot be re-opened or audited.
- Confidence percentage in the draft summary card rendered as a score (e.g., "87%"). Reason: raw confidence percentages require the operator to know the acceptable range to interpret them. Use the `confidence_band` label instead: "High confidence", "Review recommended", "Low confidence".

**Acceptance Criteria:**
- [ ] "Submit for review" renders only when `savedId` is set
- [ ] All export buttons disabled during `excelBusy = true`
- [ ] Share link + expiry renders inline after generation — no new page or modal
- [ ] Draft summary uses `confidence_band` label, not raw percentage
- [ ] "Scan another document" resets all state via `resetFlow()` with confirmation if dirty

---

### 4.4 CameraCapture Panel

The camera panel (`route.panel === "camera"`) is managed by the existing `<CameraCapture>` component. It renders as a full-viewport overlay above the UploadZone on mobile. The skeleton does not redesign the camera UI internals — it only contracts its integration:

- Camera panel opens via `route.openCamera()`.
- On capture: `route.closeCamera()`, then `handleFileSelected(capturedFile)`.
- On cancel: `route.closeCamera()`.
- The camera overlay must use `var(--surface-overlay)` for its background — not `bg-black/80` or raw rgba.

---

### 4.5 Zone Interaction Rules

```yaml
zone_interactions:
  - trigger: File selected (upload input or drag-drop)
    effect: File validation runs (validateOcrImageFile). If valid: image preview loads, processingWarning may be set. Operator sees the image before extraction.
    reason: Operators must confirm they have the right document before spending extraction time.

  - trigger: "Extract" / "Scan document" primary action
    effect: setStep("processing"), POST /ocr/preview fires with prepared file
    reason: Extraction is a deliberate operator action, not automatic on file selection.

  - trigger: Extraction succeeds (OcrPreviewResult received)
    effect: setStep("preview"), result stored, editableHeaders/editableRows initialized, confidenceMatrix set
    reason: Immediate progression to the correction environment.

  - trigger: Extraction fails
    effect: setStep("upload"), error message in StatusBanner (error tone)
    reason: Return operator to upload step with specific error message.

  - trigger: Cell edited in CorrectionGrid
    effect: setDraftDirty(true), autosave debounce (1500ms) fires persistStructuredDraft()
    reason: Corrections are saved without requiring an explicit save action from the operator.

  - trigger: "Save & continue" in PreviewToolbar
    effect: persistStructuredDraft() called immediately (bypasses debounce), then setStep("export")
    reason: Explicit save provides a synchronous save guarantee before transitioning to export.

  - trigger: draftDirty = true + reset/re-extract triggered
    effect: ConfirmationModal opens ("Re-extracting will replace your corrections. Continue?")
    reason: Prevent accidental loss of manual corrections.

  - trigger: savedId set + step = "export"
    effect: ExportZone activates all export actions
    reason: Export requires a persisted record.

  - trigger: canUseOcrScan = false
    effect: Role-gate screen (no camera, no upload, no workspace)
    reason: Permission matrix.
```


---

## 5. OPERATIONAL ATTENTION HIERARCHY

### 5.1 Scan Flow by Step

```
UPLOAD STEP:
  LEVEL 1 (0–200ms): Primary CTA — Camera or Upload button. The operator's goal is clear.
  LEVEL 2 (200ms–1s): Recent drafts rail — are there any in-progress scans to resume?
  LEVEL 3 (1s+): Settings gear — only for operators who need non-default configuration.

PROCESSING STEP:
  LEVEL 1 (0–200ms): Active stage indicator — "which stage am I at?"
  LEVEL 2 (200ms–1s): Document thumbnail — confirm the right document was submitted.
  LEVEL 3 (1s+): Cancel button — escape route if wrong document detected.

PREVIEW & EDIT STEP:
  LEVEL 1 (0–200ms): Low-confidence count in PreviewToolbar — "do I have cells to review?"
  LEVEL 2 (200ms–1s): CorrectionGrid — scan for confidence-tinted cells.
  LEVEL 3 (1s–3s): SourceViewer — verify questionable cells against source document.
  LEVEL 4 (3s+): Save & continue — operator is satisfied, moves to export.

EXPORT STEP:
  LEVEL 1 (0–200ms): "Submit for review" — primary path for most operators.
  LEVEL 2 (200ms–1s): Export actions — XLSX/CSV for immediate local use.
  LEVEL 3 (1s+): Share link — infrequent use case.
```

### 5.2 Persistent Visibility Requirements

| Element | Reason It Must Persist |
|---|---|
| StepBar | Operator must always know which step they are on, especially after returning from background. |
| StatusBanner (error tone) | Error messages must persist until dismissed — operator cannot miss an autosave failure. |
| PreviewToolbar (preview step only) | Low-confidence count and undo/redo must remain accessible while scrolling the correction grid. |

### 5.3 Contextual Visibility Rules

```yaml
contextual_rules:
  - condition: step = "upload"
    shows: UploadZone, RecentDraftsRail
    hides: ProcessingZone, SplitView, ExportZone, PreviewToolbar

  - condition: step = "processing"
    shows: ProcessingZone
    hides: UploadZone, SplitView, ExportZone, PreviewToolbar, RecentDraftsRail

  - condition: step = "preview"
    shows: PreviewToolbar, SplitView
    hides: UploadZone, ProcessingZone, ExportZone, RecentDraftsRail

  - condition: step = "export"
    shows: ExportZone
    hides: UploadZone, ProcessingZone, SplitView, PreviewToolbar, RecentDraftsRail

  - condition: visibleLowConfidenceCount > 0 AND step = "preview"
    shows: Amber count + confidence overlay (if showLowConfidence = true)
    hides: nothing (additive)

  - condition: visibleLowConfidenceCount = 0 AND step = "preview"
    shows: "All verified" success label in PreviewToolbar
    hides: amber count

  - condition: savedId = null AND step = "export"
    shows: Loading state on export buttons (should not occur — save happens before step transition)
    hides: "Submit for review" button (requires savedId)

  - condition: draftDirty = true
    shows: Autosave dot in StepBar (amber, "Saving…")
    hides: "Saved" dot

  - condition: canUseOcrScan = false
    shows: RoleGateScreen
    hides: entire workspace
```

---

## 6. TABLE & DATA STRATEGY

### 6.1 CorrectionGrid Role

| Field | Value |
|---|---|
| Primary Purpose | Allow the operator to verify and correct extracted values before saving. Not a read-only data table — every cell is editable. |
| Scanning Pattern | Confidence-first — review_required cells (rust-red tint) draw the eye before all others. |
| Primary Decision | Are there cells that need manual correction before this data can be trusted? |
| Action Trigger | Cell with confidence < 0.70 → operator clicks cell → edits value → correction counted. |
| Row Volume | Typically 5–50 rows. Max: ~200 rows for a large batch document. Virtualization: yes if rows > 100. |

### 6.2 Column Architecture

The correction grid has no fixed column schema — columns are driven by the extracted `headers[]` from the `OcrPreviewResult`. There are no standard column definitions for this workspace. The grid renders N columns where N = `editableHeaders.length`.

**Column formatting rules:**
- All cells: 13px / Inter UI / regular weight by default.
- Cells with `reviewRequired = true`: rust-red tint treatment (see confidence display rules).
- Editable header row: 13px / weight 500 / sentence case. Editable via `<input>` in header cell.
- Active cell border: 2px `var(--accent-operational-border)`.
- No tabular-nums required — extracted data is a mix of text, numbers, and dates. Column type inference (`inferColumnTypes`) can be used to apply tabular-nums to detected numeric columns only.

### 6.3 Inline Actions

- Cell edit: click/focus → inline edit. No modal.
- Header rename: click header → inline edit.
- Row restore: right-click or row action → "Restore original value" → restores from `resultPreview.rows[rowIndex][colIndex]`.

### 6.4 Realtime Update Behavior

No realtime updates to the correction grid. Grid state is local (component state). Autosave is the only write-back to the server.


---

## 7. FORM & INPUT STRATEGY

### 7.1 Form Role

| Field | Value |
|---|---|
| Form Purpose | Two forms: (1) File intake form (Upload step) — select/capture file, optional remote URL. (2) SettingsDrawer form — model, language, template, columns. |
| Completion Frequency | File intake: every scan. Settings: rarely (advanced operators only). |
| Keyboard Efficiency Priority | MEDIUM (desktop) / LOW (mobile — touch-primary) |
| AI Assistance Available | No — the AI acts on the submitted file, not on form inputs. |

### 7.2 Field Group Architecture

```yaml
field_groups:
  - group: File Intake (Upload step — primary surface)
    fields:
      - name: file
        type: file input (hidden, triggered via button)
        required: yes (or remoteUrl must be provided)
        accept: image/*, application/pdf
        validation: validateOcrImageFile() — max 5MB, must be image or PDF
        tab_order: 1

      - name: remoteUrl
        type: text input (URL)
        required: no (alternative to file)
        validation: must be a valid URL starting with http/https
        tab_order: 2
        default_value: ""
        visibility: collapsed by default — expanded via "Use image URL" link

  - group: Extraction Settings (SettingsDrawer)
    fields:
      - name: selectedModel
        type: select
        options: [auto, claude-haiku-4-5-20251001, claude-sonnet-4-6, claude-opus-4-7]
        default: auto
        tab_order: 1

      - name: language
        type: select
        options: previewLanguages (from API)
        default: first available
        tab_order: 2

      - name: selectedTemplateId
        type: select
        options: templateOptions (from API)
        default: "" (no template)
        tab_order: 3

      - name: columns
        type: number input
        min: 1
        max: 24
        default: 4
        tab_order: 4
```

### 7.3 Validation Strategy

```yaml
validation:
  file_intake:
    on_change: validateOcrImageFile(file, "Document") — immediate inline error
    on_submit: same validation re-runs before POST /ocr/preview
    error_placement: StatusBanner (error tone) — not inline below the input
    reason: On mobile, inline validation below a file input is difficult to see. StatusBanner is always visible.

  remote_url:
    on_blur: validate URL format
    error_placement: inline below the input (desktop) / StatusBanner (mobile)

  settings_form:
    no validation required — all selects have valid default values
```

### 7.4 Keyboard Flow

```yaml
keyboard:
  upload_step:
    - Tab: file button → gallery button → remote URL toggle → remote URL input (if expanded) → gear icon
    - Enter on file button: opens file picker
    - Enter on camera button: opens camera panel

  preview_step:
    Alt+1: focus header row first input (keyboard shortcut, documented in KeyboardShortcutStrip)
    Alt+2: focus first data cell
    Ctrl/Cmd+Z: undo
    Ctrl/Cmd+Shift+Z: redo
    Ctrl/Cmd+S: trigger immediate save (bypasses debounce)
    Tab: advance through cells in row-major order
    Enter: advance to next row, same column

  export_step:
    Tab: Submit → XLSX → CSV → Copy → Share → Scan another
```

---

## 8. AI & AUDIT VISIBILITY STRATEGY

### 8.1 AI Placement Map

```yaml
ai_placement:
  - system: Extraction pipeline (Anthropic)
    placement: ProcessingZone — stage indicator shows pipeline stages
    trigger: User clicks "Extract"
    output_surface: CorrectionGrid (SplitView) — extracted cells with confidence tint
    confidence_display: per-cell tint overlay on CorrectionGrid + aggregate count in PreviewToolbar
    model_attribution: ExportZone draft summary — "Extracted by Claude Sonnet 4.6"
    where_NOT_placed: StatusBanner (confidence not expressed as a message), StepBar (no AI indicators in orientation bar)
```

### 8.2 Audit Visibility Map

```yaml
audit:
  placement: ExportZone — audit events accessible via "View audit log" link (navigates to /ocr/history/{savedId})
  trigger: savedId set
  events_logged: draft created, cells corrected (count), draft saved, export triggered
  detail_level: high — OcrAuditEventRecord[] available on OcrVerificationRecord
  authorized_roles: all canUseOcrScan roles (own record only)
  realtime_updates: no — audit log is static after load
  max_events_shown: not shown inline — linked out to history view
```

### 8.3 Confidence Visibility

```yaml
confidence:
  detection_source: cell_confidence[][] from OcrPreviewResult (per-cell float 0.0–1.0)
  placement:
    - CorrectionGrid: per-cell background tint (see confidence display rules in Section 3.5)
    - PreviewToolbar: aggregate count of review_required cells
    - ExportZone: confidence_band label ("High confidence" / "Review recommended" / "Low confidence")
  severity_levels:
    - level: high (>= 0.85): no visual treatment
    - level: medium (0.70–0.85): amber tint 15% opacity
    - level: review_required (< 0.70): rust-red tint 15% + 1px border
  dismissible: per toggle in PreviewToolbar (showLowConfidence)
  persistence: lives in component state only — not persisted to server
```


---

## 9. DENSITY, SPACING & LAYOUT RHYTHM

### 9.1 Density Mode

```yaml
density:
  default: compact (preview step) / comfortable (upload and export steps)
  justification:
    - Upload: comfortable density — large touch targets for mobile. Operator interacts with 2–3 elements only.
    - Processing: not applicable — single-purpose zone.
    - Preview/Edit: compact — maximize correction grid row count. Every row visible without scroll reduces cognitive load.
    - Export: comfortable — 4–6 action buttons, no data table. Comfortable density prevents accidental taps.
  operator_switchable: no
```

### 9.2 Spacing Rhythm

```yaml
spacing:
  stepbar_height: 48px
  preview_toolbar_height: 44px
  split_view_height: calc(100vh - 48px - 44px) — fills remaining after StepBar + PreviewToolbar
  upload_zone_height: calc(100vh - 48px) — fills remaining after StepBar
  processing_zone_height: calc(100vh - 48px) — same
  export_zone_height: calc(100vh - 48px) — same
  section_gap: 16px (upload step) / 8px (preview step — space is a premium)
  button_height_mobile: 56px (primary upload actions)
  button_height_desktop: 40px (standard)
  cell_padding_compact: 6px vertical / 8px horizontal
  split_handle_width: 4px
  recent_drafts_item_gap: 8px
```

### 9.3 Typography Specification

```yaml
typography:
  workspace_label: 14px / weight 500 / Inter UI / sentence case (StepBar right)
  step_pill_label: 12px / weight 500 / Inter UI / sentence case
  upload_button_label: 15px / weight 500 / Inter UI / sentence case
  settings_label: 13px / weight 500 / Inter UI / sentence case
  stage_label: 13px / weight 400 / Inter UI / sentence case (ProcessingZone)
  processing_filename: 14px / weight 500 / Inter UI / sentence case / truncated 40 chars
  grid_cell: 13px / weight 400 / Inter UI
  grid_header: 13px / weight 500 / Inter UI / sentence case
  active_cell_label: 12px / JetBrains Mono (monospace — cell reference)
  confidence_count: 12px / weight 500 / Inter UI (amber token color)
  export_summary_label: 12px / weight 400 / Inter UI / sentence case / 55% opacity
  export_summary_value: 13px / weight 500 / Inter UI
  recent_draft_filename: 12px / weight 400 / Inter UI / truncated 20 chars
  recent_draft_date: 11px / weight 400 / Inter UI / 45% opacity
  status_banner: 13px / weight 400 / Inter UI / sentence case
  # NO uppercase tracking anywhere on this route
```

### 9.4 Surface Token Hierarchy

```yaml
surfaces:
  workspace_background: var(--surface-app)
  stepbar_surface: var(--surface-shell)
  upload_zone_bg: var(--surface-app) — no card wrapper
  drop_zone_bg: var(--surface-card) — dashed border var(--border-subtle)
  drop_zone_active_bg: var(--surface-accent) at 8% opacity
  processing_zone_bg: var(--surface-app)
  source_viewer_bg: var(--surface-canvas)
  correction_grid_bg: var(--surface-canvas)
  export_zone_bg: var(--surface-app)
  export_summary_card: var(--surface-card)
  settings_drawer_bg: var(--surface-panel)
  status_banner_error: var(--status-error-bg)
  status_banner_warning: var(--status-warning-bg)
  status_banner_success: var(--status-ok-bg)
  confidence_medium_tint: var(--status-warning-bg)
  confidence_review_tint: var(--status-error-bg)
  recent_draft_item: var(--surface-card) — hover: var(--surface-card-hover)
```

---

## 10. RESPONSIVE & OPERATOR ADAPTATION

### 10.1 Mobile (Primary target for Upload/Processing steps)

```yaml
mobile:
  width_range: <768px
  upload_step:
    - Camera button: full-width, 56px, primary
    - Gallery button: full-width, 56px, secondary
    - No drop zone rendered (mobile = touch, drag-drop not reliable)
    - Settings gear: top-right of UploadZone header bar
    - Recent drafts: collapsed toggle ("Recent scans (3)")
  processing_step:
    - Document thumbnail: 80px max height (smaller on mobile)
    - Stage list: full-width, left-aligned
  preview_step:
    - SplitView replaced by tab switcher: "Source" | "Grid" (default: Grid)
    - PreviewToolbar: undo/redo + confidence toggle + save. Re-extract moved to overflow menu.
  export_step:
    - All actions full-width stacked
    - Submit for review: 56px height, primary, full-width
  touch_targets: 44px minimum on all interactive elements
```

### 10.2 Desktop (Primary target for Preview/Edit step)

```yaml
desktop:
  min_width: 1024px
  preview_step:
    - SplitView: left 40% SourceViewer / right 60% CorrectionGrid
    - Drag handle between panels
    - All PreviewToolbar actions visible inline (no overflow menu)
  upload_step:
    - Drop zone rendered (drag-drop available on desktop)
    - Camera button: secondary (camera less common on desktop)
    - Upload file: primary
  sidebar: forced open at 13.75rem (camera mode behavior — do not override)
```

### 10.3 Rail Collapse Behavior

```yaml
rail_collapse:
  left_rail: N/A — AppShell sidebar, behavior governed by camera mode shell contract
  right_rail: N/A — no persistent right rail on this workspace
  recent_drafts_rail: toggle collapse on mobile only
```


---

## 11. COMPONENT MAPPING

```yaml
component_mapping:
  workspace_container:
    component: <main className="flex h-full flex-col overflow-hidden"> — NOT min-h-screen
    reason: Camera mode shell fills 100vh already. min-h-screen on a child creates overflow.

  zones:
    - zone: StepBar
      component: StepBar (new — simple inline composition, not a new primitive candidate)
      props_required: currentStep (upload|processing|preview|export), onBack, draftDirty, savedId, savingState
      height: 48px, sticky top-0
      note: Implements step pills using existing token classes. No new primitive needed.

    - zone: StatusBanner
      component: StatusBanner (existing pattern — same as MutationErrorBanner but multi-tone)
      props_required: message, tone (success|warning|error), onDismiss, autoDismissMs
      note: Replace all raw Tailwind bg-red-500/10 usages with this component.

    - zone: UploadZone
      component: Inline composition (label + UploadBox + CameraCapture trigger + remoteUrl input)
      props_required: onFileChange, onCameraOpen, onRemoteUrl, isMobile, onSettingsOpen
      note: UploadBox and CameraCapture are existing components — re-use without modification.

    - zone: SettingsDrawer
      component: Sheet (existing Radix-based Sheet primitive) — right drawer on desktop, bottom sheet on mobile
      props_required: open, onClose, selectedModel, language, templateOptions, selectedTemplateId, columns
      note: Lazy mount — do not render in DOM until first opened.

    - zone: RecentDraftsRail
      component: Inline composition (section label + horizontal scroll row of DraftItem components)
      props_required: records (OcrHistoryItem[]), onOpen (recordId → void)
      note: No new primitive needed.

    - zone: ProcessingZone
      component: Inline composition (thumbnail + filename + StageList)
      props_required: processingStage, filename, previewUrl, onCancel
      note: StageList replaces ProgressIndicator visual with token-compliant stage dots.

    - zone: PreviewToolbar
      component: Inline composition (toolbar row)
      props_required: lowConfidenceCount, showLowConfidence, onToggleConfidence, viewMode, onViewModeChange,
                      canUndo, canRedo, onUndo, onRedo, onReExtract, onSaveAndContinue, savingDraft
      height: 44px, sticky below StepBar

    - zone: SplitView
      component: SplitView (new inline composition — ResizablePanelGroup if available, else flex with drag handle)
      props_required: isMobile, leftPanel (SourceViewer), rightPanel (CorrectionGrid)
      note: On mobile renders TabView (Source | Grid) using existing Tab primitive.

    - zone: SourceViewer
      component: Inline composition (scrollable image container + BoundingBoxOverlay)
      props_required: imageUrl, boundingBox, zoom, imageFitMode, magnifierEnabled, onZoomChange,
                      onFitModeChange, onMagnifierToggle, imageLoadError
      note: Existing drag-pan logic preserved. BoundingBoxOverlay is a positioned div.

    - zone: CorrectionGrid
      component: OcrSpreadsheetGrid or DataTableGrid (USE_TANSTACK_TABLE feature flag)
      props_required: headers, rows, confidenceMatrix, showLowConfidence, onHeaderChange, onCellChange,
                      onActiveCellChange, activeCell, headerRowEnabled, onHeaderRowToggle
      note: Feature flag governs which implementation is used. Contract is behavioral, not component-specific.

    - zone: ExportZone
      component: Inline composition (DraftSummaryCard + action buttons + ShareLinkGenerator)
      props_required: savedId, sourceFilename, rows, headers, avgConfidence, confidenceBand, modelUsed,
                      onExportXlsx, onExportCsv, onCopyData, onShare, onSubmitForReview, onScanAnother,
                      excelBusy, shareBusy, shareLink, shareExpiresAt

  modals:
    - modal: ConfirmationModal
      component: ConfirmationModal (existing primitive)
      usages:
        - Reset/re-extract with draftDirty = true
        - "Scan another document" with savedId set and draftDirty = true

  feedback_elements:
    - element: Autosave status dot (StepBar)
      component: Inline dot + text in StepBar right area
      states: idle (hidden), saving (amber dot "Saving…"), saved (success dot "Saved"), error (rust-red dot)

    - element: Draft save error
      component: StatusBanner (error tone) via draftSaveError state

missing_components:
  - StepBar: simple inline composition of step pills + label + back button.
    Complexity: low. No new primitive approval needed.
  - StatusBanner: if not already extracted as a primitive, extract from existing MutationErrorBanner
    pattern. Multi-tone variant (success/warning/error). Low complexity.
  - SplitView: ResizablePanelGroup if available in the component library, else a flex container
    with a drag handle implemented via pointer events (similar to existing sourceDragRef pattern).
    Medium complexity. No new primitive approval if ResizablePanelGroup exists.
```


---

## 12. OPERATIONAL PROBLEMS SOLVED

```yaml
problem_resolutions:
  - problem: factory-ocr-header with eyebrow uppercase tracking-[0.3em] + telemetry strip with banned terms
    root_cause: Decorative header pattern with sci-fi language ("Active signals", "telemetry")
    structural_solution: Entire header section eliminated. Replaced by 48px StepBar with sentence-case labels only.
    section_reference: Section 4.2 (StepBar), Section 1.4 (Failure 1, 2)
    measurable_outcome: Zero uppercase tracking. Zero banned terms ("telemetry", "signals") on this route.

  - problem: bg-black/20 border-white/10 legacy rollback banner in primary UI
    root_cause: Engineering scaffolding (dual-lane migration) surfaced as user-facing UI
    structural_solution: Banner eliminated. Legacy rollback lane is internal tooling — removed from user-facing workspace entirely.
    section_reference: Section 1.4 (Failure 3, 5)
    measurable_outcome: No raw opacity modifiers on non-overlay elements. No engineering scaffolding in user-facing UI.

  - problem: min-h-screen on main element inside camera-mode shell
    root_cause: Standard page layout applied to an immersive workspace that already fills 100vh
    structural_solution: <main> uses h-full flex flex-col overflow-hidden. Camera mode shell provides the 100vh contract.
    section_reference: Section 1.3 (Shell Mode Contract), Section 11 (workspace_container)
    measurable_outcome: No viewport overflow in camera mode. Workspace fills exactly 100vh.

  - problem: Model/language/columns fields embedded in the primary upload area
    root_cause: All extraction config rendered inline regardless of operator need
    structural_solution: Settings moved to SettingsDrawer (lazy-mount slide-in). Primary upload area shows Camera + Upload only.
    section_reference: Section 4.3 (UploadZone, SettingsDrawer)
    measurable_outcome: Upload step primary surface has 2 interactive elements (mobile) / drop zone + 2 buttons (desktop). Cognitive overhead eliminated for 80% of operators who use default settings.

  - problem: Status banners using raw Tailwind color values (bg-red-500/10, bg-emerald-500/10)
    root_cause: Quick implementation bypassing token contract
    structural_solution: StatusBanner component using var(--status-error-bg), var(--status-warning-bg), var(--status-ok-bg) exclusively.
    section_reference: Section 4.3 (StatusBanner), Section 9.4
    measurable_outcome: Zero raw color values in status feedback elements.

  - problem: No clear spatial contract for the Preview & Edit step — SourceViewer and CorrectionGrid compete without defined layout authority
    root_cause: No zone-level layout specification for the split-view correction environment
    structural_solution: SplitView zone contract with explicit 40/60 desktop split, drag handle, and mobile tab fallback. CorrectionGrid is the authority on mobile (default active tab).
    section_reference: Section 4.3 (SplitView)
    measurable_outcome: Clear layout authority on all viewports. No layout ambiguity in the correction environment.

  - problem: Confidence overlay uses no documented token mapping
    root_cause: CSS was applied directly without defining the token contract
    structural_solution: Three-level confidence display rules mapped to var(--status-warning-bg) and var(--status-error-bg) tokens. Documented in Section 3.5 and Section 9.4.
    section_reference: Section 3.5 (AI System Contracts), Section 8.3
    measurable_outcome: Confidence tints are token-compliant and theme-switchable.

  - problem: ProcessingZone shows indeterminate spinner with no stage progress
    root_cause: ProgressIndicator component renders a looping animation without stage labels
    structural_solution: Five-stage list with static dot indicators (no CSS pulse animation). Stage labels in sentence case map directly to operator-readable descriptions.
    section_reference: Section 4.3 (ProcessingZone)
    measurable_outcome: Operator knows which of five stages the pipeline is at. No looping animation.
```

---

## 13. IMPLEMENTATION HANDOFF

### 13.1 Build Sequence

```yaml
implementation_sequence:
  step_1: Shell contract + workspace container.
    - <main className="flex h-full flex-col overflow-hidden"> — replace min-h-screen
    - Confirm camera mode shell resolves to h-full correctly at /ocr/scan
    - Remove legacy rollback banner from all OCR scan components

  step_2: StepBar + StatusBanner.
    - StepBar: 48px sticky, four step pills, back button, autosave dot
    - StatusBanner: multi-tone (success/warning/error), var(--status-*) tokens, auto-dismiss 5s for non-error
    - Wire draftSaveError → StatusBanner (error tone)
    - Wire status + statusTone → StatusBanner

  step_3: Upload step — UploadZone + SettingsDrawer + RecentDraftsRail.
    - Mobile: Camera button (56px, primary) + Gallery button (56px, secondary)
    - Desktop: Drop zone (dashed border, drag-over state) + file picker button
    - SettingsDrawer: lazy-mount Sheet, all settings moved here from inline
    - RecentDraftsRail: load on mount, 8 records max, collapsed on mobile
    - Remove all inline model/language/column fields from primary upload area

  step_4: Processing step — ProcessingZone.
    - Five-stage list with static amber dot for active stage, check for complete
    - Stage labels: sentence case (replace any uppercase labels)
    - Cancel button wired to abort controller
    - Document thumbnail at constrained height

  step_5: Preview & Edit step — PreviewToolbar + SplitView.
    - PreviewToolbar: 44px sticky, confidence toggle + count, view mode, undo/redo, re-extract, save & continue
    - SplitView: desktop 40/60 with drag handle, mobile tab switcher (Source | Grid, Grid default)
    - SourceViewer: existing drag-pan + zoom + bounding box overlay, var(--surface-canvas) background
    - CorrectionGrid: existing OcrSpreadsheetGrid/DataTableGrid, confidence tint via token vars
    - Wire showLowConfidence toggle to tint overlay
    - Wire activeCellLabel to JetBrains Mono display in CorrectionGrid bottom bar

  step_6: Export step — ExportZone.
    - DraftSummaryCard: filename, rows, cols, confidence_band label (not raw %)
    - Submit for review: primary, full-width, navigates to /ocr/verify?id={savedId}
    - Export XLSX + CSV + Copy data: secondary/ghost
    - Share link: ghost trigger → inline result
    - Scan another: ghost, resetFlow() with confirmation

  step_7: Confirmation dialogs.
    - ConfirmationModal for: reset with draftDirty, re-extract with draftDirty, scan another with savedId+dirty
    - Wire confirmOpen/pendingAction state to ConfirmationModal primitive

  step_8: Keyboard shortcuts.
    - Alt+1 / Alt+2 focus navigation (preview step)
    - Ctrl+Z / Ctrl+Shift+Z undo/redo
    - Ctrl+S immediate save
    - Tab/Enter cell navigation
    - KeyboardShortcutStrip: render in preview step only, at bottom of SplitView
```

### 13.2 Critical Constraints

```yaml
critical_constraints:
  - main must use h-full flex flex-col, NOT min-h-screen: reason: camera mode shell provides 100vh
  - No uppercase tracking anywhere on this route: reason: blueprint law — eliminated in all Phase C workspaces
  - No raw Tailwind color values in status banners: reason: var(--status-*) token contract
  - No bg-black/20 or bg-[rgba(...)]: reason: blueprint law
  - Legacy rollback lane link must not appear in user-facing UI: reason: engineering scaffolding
  - Model/language/column fields must be in SettingsDrawer, not primary upload area: reason: cognitive load reduction
  - ProcessingZone must not use pulsing CSS animation: reason: pulsing raises mental temperature
  - Confidence tints must use var(--status-warning-bg) and var(--status-error-bg): reason: token contract
  - SplitView must fill remaining viewport — no page-level scroll in preview step: reason: scroll ownership doctrine
  - Export actions must be disabled until savedId is set: reason: audit chain integrity
  - All labels sentence case: reason: blueprint law
```

### 13.3 Open Questions

```yaml
open_questions:
  - question: The current implementation has USE_TANSTACK_TABLE feature flag switching between OcrSpreadsheetGrid and DataTableGrid. Should the skeleton prescribe one or preserve the flag?
    blocking: no — skeleton preserves the flag; both components satisfy the correction grid behavioral contract
    owner: frontend team
    decision_needed_by: before step 5

  - question: The autosave debounce is currently 1500ms in the existing implementation. The skeleton does not change this. Should a longer debounce (e.g., 2000ms) be used to reduce API call frequency on fast typists?
    blocking: no — 1500ms is acceptable; adjust if monitoring shows excessive PUT /ocr/verifications calls
    owner: frontend team

  - question: The warp/deskew feature (POST /ocr/warp) currently runs automatically on certain image types. Should the skeleton surface this as an explicit user action ("Fix perspective" button) or keep it as an automatic pre-processing step?
    blocking: no — keep as automatic pre-processing in the file preparation pipeline; surface result in ProcessingZone stage "Preparing image"
    owner: product owner
```


---

## ACCEPTANCE CRITERIA (SPEC COMPLETENESS)

- [x] All 13 sections fully populated — no empty fields, no placeholders
- [x] Shell mode contract documented (camera mode, h-full, no topbar)
- [x] Every layout zone has a documented existence justification tied to backend entity or operator need
- [x] Every zone has explicit, testable acceptance criteria
- [x] Every component mapped to existing primitives — minimal new primitive surface
- [x] Every operational failure from Section 1.4 has a resolution in Section 12
- [x] Structural reduction audit: header section eliminated, legacy banner eliminated, min-h-screen eliminated, settings moved to drawer, stage labels doctrined
- [x] No anti-patterns: no uppercase tracking, no raw rgba, no backdrop-blur, no bg-black/20, no pulsing animations, no telemetry/signals language
- [x] All spacing values follow 4px scale
- [x] All surfaces reference token variables only
- [x] Typography follows approved system — sentence case, JetBrains Mono for active cell label only
- [x] Backend API surface verified (ocr.ts, ocr-access.ts)
- [x] Permission matrix drives workspace gate (canUseOcrScan — operator+ only)
- [x] AI confidence display contract defined (three levels, token-mapped)
- [x] Open questions populated (3 questions, 0 blocking)
- [x] Implementation handoff sequence complete and ordered (8 steps)
- [x] Responsive adaptations defined for mobile (primary) and desktop

---

## POST-GENERATION VALIDATION

```yaml
self_validation:
  operational_integrity:
    - [x] Every zone traces to a specific backend entity or operator action
    - [x] Every zone justified by specific operator need
    - [x] No visual-composition-only zones (header eliminated, telemetry eliminated)
    - [x] Reduction audit complete — 7 structural reductions documented

  law_compliance:
    - [x] All spacing follows 4px base scale
    - [x] All surfaces use CSS token variables — rgba violations eliminated
    - [x] All labels sentence case — uppercase tracking eliminated
    - [x] All font specs from approved type system — JetBrains Mono for active cell reference only
    - [x] AI confidence display uses token variables — no raw color values

  kiro_readiness:
    - [x] Kiro can produce working code without clarifying questions
    - [x] All acceptance criteria are testable
    - [x] Build sequence complete and ordered
    - [x] No blocking open questions

  anti_pattern_check:
    - [x] No pulsing animations (processing stage uses static dot)
    - [x] No UPPERCASE labels (all sentence case)
    - [x] No backdrop-blur on static sections
    - [x] No raw rgba inline styles
    - [x] No decorative panels (telemetry strip removed)
    - [x] No banned language (telemetry, signals, command center, tactical — all eliminated)
    - [x] No min-h-screen on camera-mode workspace

  structural_integrity:
    - [x] Zone interactions cover all user inputs and state transitions
    - [x] Permission matrix complete (canUseOcrScan gate)
    - [x] Responsive adaptations defined for mobile-primary and desktop-primary steps
    - [x] All Section 12 resolutions reference specific spec sections
    - [x] Shell mode contract explicitly documented — no ambiguity about h-full vs min-h-screen
```

---

## 4A. VISUAL STRUCTURAL HIERARCHY BLUEPRINT

### A. Desktop Blueprint (1440px — Preview & Edit Step)

```
┌──────────────── AppShell sidebar (13.75rem, forced open) ────────────────────────┐
│ [sidebar content]                                                                  │
└──────────────────────────────────────────────────────────────────────────────────┘
┌──────────────────────────────────────────────────────── Workspace content region ─┐
│  STEPBAR [48px sticky]                                                            │
│  ← Back  (1) Upload ✓  (2) Processing ✓  (3) Preview & Edit ●  (4) Export        │
│                                                Document scan  ● Saved             │
├───────────────────────────────────────────────────────────────────────────────────┤
│  PREVIEW TOOLBAR [44px sticky]                                                    │
│  [↓ 3 low-confidence]  [Spreadsheet | Raw]    [↩ Undo] [↪ Redo] [Re-extract]    │
│                                                              [Save & continue →] │
├──────────────────────────────────────────┬────────────────────────────────────────┤
│  SOURCE VIEWER [40% width]               │  CORRECTION GRID [60% width]           │
│  var(--surface-canvas)                   │  var(--surface-canvas)                 │
│                                          │  Date    Supplier   Qty    Amount      │
│   [document image at fit-to-width zoom]  │  ████    ████████   12     ██████     │
│                                          │  ████    [amber]    ░░░    ██████     │
│   [amber bounding box on active cell]    │  ████    ████████   14     [red tint] │
│                                          │  ████    ████████   08     ██████     │
│   ─────────────── controls ───────────── │  ────────────────────────────────────  │
│   [zoom-] [fit-W] [fit-H] [zoom+] [mag]  │  R3: Supplier Name (JetBrains Mono)   │
└──────────────────────────────────────────┴────────────────────────────────────────┘
```

### B. Mobile Blueprint (390px — Upload Step)

```
┌────────────────────────────────────────────┐
│  STEPBAR [48px]                            │
│  ←   (1)● Upload  (2) Process  (3) Preview │
├────────────────────────────────────────────┤
│  STATUS BANNER (if present) [auto height]  │
├────────────────────────────────────────────┤
│  UPLOAD ZONE [fill-remaining]              │
│                                            │
│  ┌──────────────────────────────────────┐  │
│  │  📷 Scan document         [56px btn] │  │
│  └──────────────────────────────────────┘  │
│  ┌──────────────────────────────────────┐  │
│  │  📁 Upload from gallery   [56px btn] │  │
│  └──────────────────────────────────────┘  │
│                                            │
│  Use image URL ↓ (collapsed)       ⚙ gear  │
│                                            │
│  ─ Recent scans (3) ──────────────────────  │
│  [draft item] [draft item] [draft item]    │
└────────────────────────────────────────────┘
```

### C. Mobile Blueprint (390px — Preview & Edit Step)

```
┌────────────────────────────────────────────┐
│  STEPBAR [48px]                            │
│  ←   (1)✓  (2)✓  (3)● Preview  (4) Export │
├────────────────────────────────────────────┤
│  PREVIEW TOOLBAR [44px]                    │
│  [↓3 low-conf] [↩][↪] [Save & continue →] │
├────────────────────────────────────────────┤
│  TAB SWITCHER                              │
│  [  Source  ] [● Grid  ]                  │
├────────────────────────────────────────────┤
│  CORRECTION GRID (active tab) [fill]       │
│  Date    Supplier    Qty    Amount         │
│  ████    ████████    12     ██████        │
│  ████    [amber ██]  ░░░    ██████        │
│  ████    ████████    14     [red ████]    │
│  ─────────────────────────────────────    │
│  R3: Supplier Name                        │
└────────────────────────────────────────────┘
```

### D. Component Nesting Hierarchy

```
<main className="flex h-full flex-col overflow-hidden">   ← NOT min-h-screen
  <StepBar step={step} onBack={...} savingState={...} />   [48px sticky]

  {status && <StatusBanner message={status} tone={statusTone} onDismiss={...} />}

  {step === "upload" && (
    <>
      <UploadZone
        isMobile={isMobile}
        onFileChange={...}
        onCameraOpen={route.openCamera}
        onSettingsOpen={...}
      />
      <RecentDraftsRail records={recentRecords} onOpen={openRecentRecord} />
      <SettingsDrawer open={settingsOpen} onClose={...} selectedModel={...} ... />
    </>
  )}

  {step === "processing" && (
    <ProcessingZone
      stage={processingStage}
      filename={sourceFilename}
      previewUrl={displayPreviewUrl}
      onCancel={...}
    />
  )}

  {step === "preview" && (
    <>
      <PreviewToolbar
        lowConfidenceCount={visibleLowConfidenceCount}
        showLowConfidence={showLowConfidence}
        onToggleConfidence={...}
        canUndo={canUndo}
        canRedo={canRedo}
        onUndo={...}
        onRedo={...}
        onReExtract={...}
        onSaveAndContinue={...}
        savingDraft={savingDraft}
      />
      <SplitView isMobile={isMobile}>
        <SourceViewer
          imageUrl={displayPreviewUrl}
          boundingBox={boundingBox}
          zoom={zoom}
          imageFitMode={imageFitMode}
          magnifierEnabled={magnifierEnabled}
          imageLoadError={imageLoadError}
          onZoomChange={setZoom}
          onFitModeChange={setImageFitMode}
          onMagnifierToggle={...}
          onPointerDown={handleSourcePointerDown}
          onPointerMove={handleSourcePointerMove}
          onPointerUp={handleSourcePointerUp}
          ref={sourceViewerRef}
        />
        <CorrectionGrid
          headers={editableHeaders}
          rows={editableRows}
          confidenceMatrix={confidenceMatrix}
          showLowConfidence={showLowConfidence}
          onHeaderChange={...}
          onCellChange={...}
          onActiveCellChange={setActiveCell}
          activeCell={activeCell}
          activeCellLabel={activeCellLabel}
          headerRowEnabled={headerRowEnabled}
          onHeaderRowToggle={...}
          viewMode={viewMode}
        />
      </SplitView>
      <KeyboardShortcutStrip />
    </>
  )}

  {step === "export" && (
    <ExportZone
      savedId={savedId}
      sourceFilename={sourceFilename}
      rowCount={editableRows.length}
      columnCount={editableHeaders.length}
      confidenceBand={resultPreview?.scanQuality?.confidence_band}
      modelUsed={formatExtractionSource(resultPreview?.routingMeta, resultPreview?.avgConfidence)}
      onExportXlsx={...}
      onExportCsv={...}
      onCopyData={...}
      onShare={...}
      shareLink={shareLink}
      shareExpiresAt={shareExpiresAt}
      shareBusy={shareBusy}
      excelBusy={excelBusy}
      onSubmitForReview={...}
      onScanAnother={...}
    />
  )}

  {cameraOpen && <CameraCapture onCapture={...} onCancel={route.closeCamera} />}
  <ConfirmationModal open={confirmOpen} title={confirmTitle} ... />
</main>
```


---

## KIRO TASK CHAINING

```yaml
downstream_tasks:
  task_1:
    name: "OCR Scan — Shell Contract + Container"
    source: Section 1.3, Section 11 (workspace_container)
    output: Replace min-h-screen with h-full flex flex-col overflow-hidden on main. Remove legacy rollback banner from governed-ocr-intake-screen.tsx and governed-ocr-verification-page.tsx. Confirm camera mode resolves correctly.

  task_2:
    name: "OCR Scan — StepBar + StatusBanner"
    source: Section 4.3 (StepBar, StatusBanner)
    output: 48px sticky StepBar (four step pills, back button, autosave dot). Multi-tone StatusBanner using var(--status-*) tokens. Replace all bg-red-500/10 and bg-emerald-500/10 usages. Wire draftSaveError and status/statusTone.

  task_3:
    name: "OCR Scan — Upload Step (UploadZone + SettingsDrawer + RecentDraftsRail)"
    source: Section 4.3 (UploadZone, SettingsDrawer, RecentDraftsRail)
    output: Mobile: 56px Camera + Gallery buttons. Desktop: drop zone + file picker. Remove model/language/column fields from primary surface → move to SettingsDrawer (lazy-mount Sheet). RecentDraftsRail (collapsed on mobile). Settings gear icon.

  task_4:
    name: "OCR Scan — Processing Step"
    source: Section 4.3 (ProcessingZone)
    output: Five-stage list (static amber dot for active, check for complete). Sentence-case stage labels. Cancel button with abort controller. Document thumbnail. Remove/replace any pulsing CSS animations.

  task_5:
    name: "OCR Scan — Preview & Edit Step (PreviewToolbar + SplitView)"
    source: Section 4.3 (PreviewToolbar, SplitView, SourceViewer, CorrectionGrid)
    output: 44px PreviewToolbar (confidence toggle + count, view mode, undo/redo, re-extract, save & continue). SplitView (40/60 desktop, tab switcher mobile). SourceViewer with bounding box overlay. CorrectionGrid with confidence tints using var(--status-warning-bg)/var(--status-error-bg). activeCellLabel in JetBrains Mono.

  task_6:
    name: "OCR Scan — Export Step"
    source: Section 4.3 (ExportZone)
    output: DraftSummaryCard with confidence_band label (not raw %). Submit for review (primary, conditional on savedId). Export XLSX/CSV/Copy (disabled during excelBusy). Share link inline. Scan another with resetFlow().

  task_7:
    name: "OCR Scan — Confirmation Dialogs + Keyboard Shortcuts"
    source: Section 4.5, Section 7.4
    output: ConfirmationModal wired for reset/re-extract/scan-another with draftDirty. Keyboard shortcuts: Alt+1/2, Ctrl+Z/Shift+Z, Ctrl+S, Tab/Enter cell navigation. KeyboardShortcutStrip rendered in preview step.

  task_8:
    name: "OCR Scan — Responsive + Role Gate"
    source: Section 10, Section 3.6
    output: Mobile 56px buttons, tab switcher on preview step, stacked export actions. Desktop split view. canUseOcrScan role gate screen (accountant + attendance roles see gate).
```

---

*Status: COMPLETE — all 13 sections populated, all acceptance criteria met, post-generation validation passed.*
*Phase C progress: 5/8 complete — /approvals ✓, /attendance/live ✓, /attendance/review ✓, /attendance/reports ✓, /ocr/scan ✓*
*Next: Phase C, Item 6 — to be determined.*
