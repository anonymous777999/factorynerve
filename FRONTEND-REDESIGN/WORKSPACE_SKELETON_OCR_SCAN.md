# OCR Scan — Workspace Skeleton Architecture
# FactoryNerve OS | Phase 3 Skeleton Specification | Phase C, Item 5
# Route: /ocr/scan
# Generated: 2026-06-03
# Status: DRAFT

---

## 1. WORKSPACE OVERVIEW

### 1.1 Identity

| Field | Value |
|---|---|
| Route | `/ocr/scan` |
| Workspace Name | OCR Scan — Document Extraction Workstation |
| Operational Role | Immersive document scanning and extraction workspace. Operator uploads or captures a paper document image, the Anthropic pipeline extracts tabular data, and the operator reviews/corrects extracted cells against the source image before saving as a draft (`OcrVerification`) for supervisor approval. Four sequential steps: Upload → Processing → Preview & Edit → Export. |
| Business Impact | If this workspace fails, paper documents cannot enter the digital workflow. OCR is the primary ingestion mechanism for factory floor production sheets, delivery challans, and shift records. Blocked OCR means blocked reporting, export, and audit trails for document-heavy workflows. |
| User Population | Operator (primary — daily document scanning). Supervisor (secondary — may scan on behalf). The `canUseOcrScan` check gates access. |
| Peak Usage Context | Continuous throughout the shift — operators scan documents as they receive them. High-frequency workspace: 5–30 scans/day per factory per the topology. |
| Predecessor Workspaces | `/work-queue` (linked from OCR section), AppShell nav |
| Successor Workspaces | `/ocr/verify` (supervisor reviews the saved OcrVerification draft), `/ocr/history` (list of past scans), `/ocr/jobs/[jobId]` (if job was tracked) |

### 1.2 Operational Importance

OCR scan is the paper-to-digital gateway. Every physical document that needs to enter the FactoryNerve data model passes through this workspace. The three-pane workstation layout (source image viewer + editable spreadsheet + review rail) is purpose-built for a specific operator task: compare what the AI extracted against what the physical document says, correct any discrepancies, and save a verified draft. The design must minimize context-switching between the image and the extracted table — the operator's eyes must be able to move between source and data without losing their position in either.

### 1.3 Current State Failures

- Failure 1: Workspace header uses `factory-ocr-header__eyebrow` with "Document Scan" and a subtitle "Queue-first OCR intake with persistent source context, extraction telemetry, and operator correction flow." — marketing prose above an immersive work tool. Telemetry section ("Queue visibility / Correction focus / Stage state") adds complexity with no operator value in the header.
- Failure 2: Review rail zone headers use `text-[11px] font-semibold uppercase tracking-[0.18em]` and `text-[11px] font-semibold uppercase tracking-[0.14em]` — typography violations in the most-read zone of the workstation.
- Failure 3: Source image panel header uses `uppercase tracking-[0.18em]` for "Source image" label — same violation.
- Failure 4: Sheet workspace panel header uses `uppercase tracking-[0.18em]` for "OCR spreadsheet" label.
- Failure 5: Stage bar pills use `factory-ocr-stagepill__index` + `factory-ocr-stagepill__label` with `data-state` — this is a custom stepper implementation that is functionally equivalent to a system step indicator, but isolated in the OCR CSS system.
- Failure 6: Cache/reuse banner (when result is loaded from AI result cache) renders with raw `rounded-[22px] border-2` and emoji (🔄 ⚡ ⚠️) in the disabled code path — inconsistent surface treatment and inappropriate emoji use in an industrial interface.
- Failure 7: View mode toggle (Spreadsheet / Raw) uses custom `rounded-full ... bg-accent text-white` active state buttons — non-standard tab implementation, same pattern as the custom tabs eliminated in `/attendance/review`.
- Failure 8: Processing stage uses `ProgressIndicator` component — this is a correct structural pattern and should be preserved. Not a failure.
- Failure 9: Upload `UploadBox` on desktop / `MobileEntry` on mobile — correct device-adaptive pattern. Not a failure.
- Failure 10: The `factory-ocr-header__subtitle` description is a developer-facing description of the architecture ("Queue-first OCR intake with persistent source context, extraction telemetry, and operator correction flow") — not an operator-facing label. The header body text serves no operational function.

---

## 2. WORKSPACE CLASSIFICATION

| Dimension | Classification | Rationale |
|---|---|---|
| Workspace Type | Immersive Scanner | TYPE 6 — physical scan workflow, AppShell sidebar minimized, camera-primary, minimal chrome, step-by-step flow. |
| Workflow Category | Execution | Operator performs a physical operation (scan) and reviews the result. Sequential completion. |
| Operational Behavior | Mixed (Form-Driven → Realtime → Data-Dense) | Upload phase is form-driven; processing phase is realtime (progress tracking); preview phase is data-dense (editable cell grid). |
| Data Density | LOW → VERY HIGH | Upload: LOW. Processing: LOW. Preview: VERY HIGH (full editable spreadsheet + source image + review rail). |
| Realtime Complexity | MEDIUM | Processing stage polls job status. Preview stage has no realtime — user edits are local state until saved. |
| AI Complexity | HIGH | Three-tier Anthropic model selection (Haiku/Sonnet/Opus). Confidence matrix per cell. Reprocessing on demand. AI result cache detection. |
| Audit Complexity | MEDIUM | Every `OcrVerification` state transition writes an `OcrAuditEvent`. The draft save here is the first event. |
| Decision Pressure | HIGH | Operators scan documents under time pressure on the factory floor. Upload and processing must be fast. Preview corrections must be low-friction. |

**Classification Implication:** IMMERSIVE SCANNER + HIGH AI complexity + VERY HIGH data density at preview stage = a workspace that must adapt structurally across its four states. The Upload state should feel almost empty — nothing between the operator and the upload action. The Processing state shows a progress indicator only. The Preview state is a full three-pane workstation. The Export state adds an action rail. This is not one layout — it is four sequential layouts that share a step indicator and a status banner. Each state must be specified separately.

---

## 3. BACKEND OPERATIONAL MAPPING

### 3.1 API Surface

| Endpoint | Method | Purpose | Permission | Key Response Fields | Error States |
|---|---|---|---|---|---|
| `POST /ocr/table-excel` | POST | Upload image → Anthropic extraction → returns `OcrPreviewResult` | Any auth (canUseOcr) | `headers`, `rows`, `sheets`, `language`, `avgConfidence`, `warnings`, `scanQuality`, `routingMeta`, `tokenUsage` | 400 (no table found), 413 (file too large >8MB), 422 (unsupported format), 429 (quota exceeded), 500 (extraction failed), timeout |
| `GET /ocr/templates` | GET | Fetch factory-specific column templates | Any auth | `OcrTemplate[]` — id, name, columns | 403 (no factory context) |
| `POST /ocr/verifications` | POST | Save extracted data as `OcrVerification` draft | Any auth | `OcrVerificationRecord` — id, status=draft, headers, rows, confidence_matrix | 400, 422 |
| `GET /ocr/verifications` | GET | List recent verifications (for "recent records" UI) | Any auth | `OcrVerificationRecord[]` | empty list |
| `GET /ocr/verifications/{id}` | GET | Load an existing draft for continuation | Any auth | Full `OcrVerificationRecord` with cells + routingMeta | 404 |
| `PUT /ocr/verifications/{id}` | PUT | Update draft with edits | Any auth | Updated `OcrVerificationRecord` | 400, 404 |
| `POST /ocr/verifications/{id}/excel-export` | POST | Generate and stream XLSX download | Any auth | Binary file response | 404 |

**OCR quota system:** `check_and_record_usage()` + `check_and_record_org_usage()` called on every `POST /ocr/table-excel`. 429 = quota exceeded. The frontend must surface quota exceeded as a user-friendly message, not a raw 429.

### 3.2 Entity Relationship Map

```
OcrPreviewResult (transient — returned from POST /ocr/table-excel, not persisted directly)
  ├── headers: string[]
  ├── rows: OcrCell[][]
  ├── sheets?: [{columns, rows}]
  ├── avgConfidence: number | null (0.0–1.0)
  ├── warnings: string[]
  ├── scanQuality: { confidence_band, cell_boxes[][] }
  ├── routingMeta: { provider_used, selected_model, processing_time_ms, model_tier }
  └── tokenUsage: { input_tokens, output_tokens, estimated_cost, display_name }

OcrVerification (persisted via POST /ocr/verifications)
  ├── id (primary key — used for draft persistence and export)
  ├── status: draft | pending | approved | rejected
  ├── headers: string[]
  ├── original_rows: OcrCell[][] (AI extraction — immutable once saved)
  ├── reviewed_rows: OcrCell[][] (operator corrections)
  ├── confidence_matrix: number[][] (per-cell confidence 0.0–1.0)
  ├── avg_confidence: number
  ├── source_filename: string
  ├── warnings: string[]
  └── OcrAuditEvent[] (written on every state transition)

OcrTemplate (from GET /ocr/templates)
  ├── id, name
  └── columns: column definition array (used to pre-configure header names)

AiResultCache (transparent — detected via result.cached=true, result.reused=true)
  └── result.cacheAgeHours — how old the cached result is
  └── result.cacheTrust: "high" | "low"
```

**Primary entity:** `OcrVerification` — created on first save; updated on each cell edit (debounced autosave).
**Relationship implication for UI:** Until `POST /ocr/verifications` succeeds, the `savedId` is null. The export button requires a `savedId`. The draft must be saved before export can proceed.

### 3.3 Workflow State Machine

```
[no file]
  └──[file chosen / camera captured]──► [processing]
        └──[Anthropic extraction completes]──► [preview]
              └──[operator edits cells]──► [preview, draftDirty=true]
                    └──[autosave or explicit save]──► [draft saved, savedId set]
                          └──[approve extraction]──► [export]
                                └──[download XLSX]──► [complete]
                                └──[navigate to /ocr/verify?verification_id=N]──► [supervisor workflow]

[extraction fails]──► [upload, status=error]
[quota exceeded]───► [upload, status=warning — quota message]
[cache hit]────────► [preview, result.cached=true]
[draft loaded (URL ?id=)]──► [preview or export, savedId set]
```

**Frontend implication per step:**
- `upload`: Show UploadBox (desktop) or MobileEntry (mobile). Recent records strip. Template selector.
- `processing`: Show ProgressIndicator only. No other content.
- `preview`: Show three-pane workstation (source viewer + sheet workspace + review rail). Show cache notice if `result.cached`. Autosave on cell edits.
- `export`: Preview state + ExportPanel in action rail. "Open review workflow" link if savedId exists.

### 3.4 Realtime Contracts

| System | Transport | Update Rate | Zones Affected | Stale State Handling |
|---|---|---|---|---|
| Extraction progress (`processingStage` state) | Client-side state transitions | ~1s per stage | ProgressIndicator zone | N/A — local state machine |
| Draft autosave (`draftDirty` state) | Debounced POST/PUT | On cell edit (debounced 1.5s) | `savingDraft` busy state on save indicator | If save fails: `draftSaveError` shown; operator can continue editing |
| Cache age detection | API response field | On extraction result | Cache notice banner (conditional) | N/A — one-time detection |

No WebSocket or SSE. The extraction call is synchronous HTTP (Anthropic is called synchronously within the backend request handler).

### 3.5 AI System Contracts

| AI System | Input | Output | Confidence | Latency | Fallback |
|---|---|---|---|---|---|
| Anthropic extraction (Haiku/Sonnet/Opus) | Image file (PNG/JPG/TIFF/PDF/HEIC) | `OcrPreviewResult` with headers, rows, confidence matrix | Per-cell confidence (0.0–1.0), avg_confidence overall | Haiku: fast (<2s) / Sonnet: medium (2–8s) / Opus: slow (8–20s) | 500 error returned (no graceful AI fallback — extraction fails if Anthropic fails) |
| Confidence tier system | Cell confidence score | "high" (≥0.85) / "medium" (0.60–0.84) / "review_required" (<0.60) | N/A — output IS the confidence | 0ms (computed client-side from confidence matrix) | Show "—" if confidence_matrix is empty |
| AI result cache | Document hash | Cached `OcrPreviewResult` | cacheTrust: "high" / "low" | 0ms (cache hit) | Falls through to fresh extraction if cache miss |

**AI display rules:**
- `review_required` cells: highlighted in sheet grid (existing `showLowConfidence` toggle controls visibility)
- `avgConfidence` displayed in review rail as one of three labels: "Verified" (high), "Check" (medium), "Review" (review_required)
- `routingMeta.model_tier` displayed as the model used — sentence case, not raw model ID
- All AI indicators are static — no pulse, no glow, no animation
- Cache notice uses token surface styling — not raw rgba or emoji

### 3.6 Permission Matrix

| Role | Access scan | Upload file | Camera capture | Edit cells | Save draft | Export XLSX |
|---|---|---|---|---|---|---|
| attendance | ✗ (role gate) | ✗ | ✗ | ✗ | ✗ | ✗ |
| operator | ✓ | ✓ | ✓ | ✓ | ✓ | ✓ |
| supervisor | ✓ | ✓ | ✓ | ✓ | ✓ | ✓ |
| manager | ✓ | ✓ | ✓ | ✓ | ✓ | ✓ |
| admin | ✓ | ✓ | ✓ | ✓ | ✓ | ✓ |
| owner | ✓ | ✓ | ✓ | ✓ | ✓ | ✓ |
| accountant | ✗ (role gate) | ✗ | ✗ | ✗ | ✗ | ✗ |

**Permission implication:** `canUseOcrScan` gates the workspace. Role-gate screen for accountant/attendance roles. All other roles have full access. No zone-level permission differentiation within the workspace.

---

## 4. WORKSPACE STRUCTURAL ANATOMY

### 4.1 Layout Pattern

**SEQUENTIAL WIZARD** (with SPLIT WORKSPACE at preview/export step)

The workspace progresses through four sequential states. The outer shell is constant (step indicator + status banner). The inner content zone switches entirely based on `step` state:

- `upload` step: FULL-WIDTH COMMAND — single upload zone
- `processing` step: FULL-WIDTH COMMAND — single progress indicator
- `preview` step: SPLIT WORKSPACE — three-pane workstation (source | sheet | review rail)
- `export` step: SPLIT WORKSPACE — same three-pane + export action rail below

**Pattern selection justification:** The four states have fundamentally different layout needs. Attempting to show all zones at all times would create a dense, confusing workspace in the upload state and a cramped workspace in the preview state. SEQUENTIAL WIZARD isolates each step to its necessary content. The SPLIT WORKSPACE at preview/export directly inherits from the workstation's already-established three-pane layout.

**AppShell sidebar behavior:** The current implementation does NOT hide the AppShell sidebar via a route flag (the `immersiveScannerRoute` flag mentioned in the topology was not found in code). The workspace exists within the standard AppShell. The three-pane layout must account for sidebar width at desktop widths. The `max-w-7xl` workspace container handles this correctly at standard sidebar widths.

**Structural reduction note:**
- Header section "telemetry" strip (Queue visibility / Correction focus / Stage state) eliminated — these are developer-facing diagnostics, not operator signals.
- Header subtitle "Queue-first OCR intake with persistent source context, extraction telemetry, and operator correction flow" eliminated — developer description, not operator guidance.
- Cache notice emoji (🔄 ⚡ ⚠️) eliminated — replaced with token surface badges.
- View mode toggle buttons (custom rounded-full accent-bg) replaced with system Tabs primitive or SegmentedControl.
- All `uppercase tracking-[*em]` zone labels replaced with sentence case 13px/500 Inter UI.

---

### 4.2 Zone Definitions

The workspace has a persistent outer shell and four step-specific inner zones. All zones are defined below.

---

#### ZONE: OCR Workspace Shell (Persistent — All Steps)

| Property | Value |
|---|---|
| Operational Role | Persistent chrome across all four steps: step indicator, workspace title, and status/error banner. |
| Attention Priority | 3 |
| Position | Top |
| Width | full-width |
| Height | content-driven — step indicator ~48px + banner when present |
| Sticky Behavior | not sticky (the workspace content is not long enough to require sticky header in upload/processing steps) |
| Collapse Behavior | never |
| Scroll Behavior | inherits shell |
| Density Mode | compact |
| Existence Justification | `OcrFlowStep` state — the operator must always know which of the four steps they are on. The step indicator provides this. Status/error banners communicate extraction results. |

**Contents:**
- Workspace title: "OCR scan" — 16px / weight 500 / sentence case. No subtitle.
- Step indicator (4 steps): 1 Upload → 2 Processing → 3 Preview & edit → 4 Export — uses `factory-ocr-stagepill` component; step state: done/current/idle
- Status banner: single-line feedback for extraction status (success/warning/error) — appears below step indicator when `status` is non-empty. Uses token surface styling, not custom factory-ocr CSS.
- Draft save error: separate warning banner for autosave failures — `draftSaveError` state

**Acceptance Criteria:**
- [ ] Step indicator shows correct step state (done/current/idle) for all 4 steps
- [ ] Workspace title is "OCR scan" — no subtitle, no header eyebrow
- [ ] Status banner uses token surface variables — no raw rgba, no emoji
- [ ] No "telemetry" metrics strip in the header

---

#### ZONE: Upload Zone (Step: upload)

| Property | Value |
|---|---|
| Operational Role | Entry point for the operator. File upload via drag-drop or click (desktop) or camera/file select (mobile). Recent drafts accessible for continuation. Template selector for pre-configured column headers. |
| Attention Priority | 1 |
| Position | Below OCR Workspace Shell |
| Width | full-width (desktop: max-w-2xl centered) |
| Height | content-driven |
| Sticky Behavior | not sticky |
| Collapse Behavior | N/A — only visible at upload step |
| Scroll Behavior | inherits shell |
| Density Mode | default — upload is a single focused action; more space aids clarity |
| Existence Justification | `step === "upload"` — this is the initial workspace state. Without this zone, the operator has no entry point. |

**Contents (desktop — UploadBox component):**
- Primary upload area: drag-drop zone with "Drop image or PDF here" — click triggers hidden `<input type="file">`. Accepts PNG/JPG/TIFF/HEIC/PDF.
- Camera capture button: "Use camera" — opens `CameraCapture` overlay
- Remote URL input: "Import from URL" — text input + "Import" button
- Template selector: Select component — "No template / [template names]" — pre-configures column headers
- Recent records strip: compact list of last 4-6 `OcrVerificationRecord` drafts — button per record, click reopens draft

**Contents (mobile — MobileEntry component):**
- Two large tap targets: "Take photo" (camera) / "Upload file" (file picker)
- Recent records: compact chip list below the tap targets

**Acceptance Criteria:**
- [ ] Desktop renders UploadBox component; mobile renders MobileEntry component (device-adaptive via `useOcrDevice`)
- [ ] File input accepts image/png, image/jpeg, image/tiff, image/heic, application/pdf
- [ ] Template selector renders only when factory has templates (GET /ocr/templates returns non-empty)
- [ ] Recent records strip renders when `recentRecords.length > 0`
- [ ] Clicking a recent record opens the existing draft (GET /ocr/verifications/{id})
- [ ] Camera button opens CameraCapture overlay (fullscreen camera component)

---

#### ZONE: Processing Zone (Step: processing)

| Property | Value |
|---|---|
| Operational Role | Full-width progress indicator during Anthropic extraction. Operator waits — no other actions available. |
| Attention Priority | 1 |
| Position | Below OCR Workspace Shell |
| Width | full-width (max-w-2xl centered) |
| Height | content-driven |
| Sticky Behavior | not sticky |
| Collapse Behavior | N/A — only visible at processing step |
| Scroll Behavior | inherits shell |
| Density Mode | default |
| Existence Justification | `step === "processing"` — the extraction takes 2–20 seconds; the operator must see progress feedback to know the system is working. |

**Contents (ProgressIndicator component — existing):**
- Thumbnail of the uploaded image (source preview at small size)
- Stage progression: uploaded → preprocess → detect → extract → confidence
- Current stage label and description
- Processing warning message if `processingWarning` is non-null (e.g., "Source looks heavily compressed")

**Acceptance Criteria:**
- [ ] ProgressIndicator renders with thumbnail + stage labels
- [ ] Stage transitions are reflected in the indicator as `processingStage` state advances
- [ ] `processingWarning` message renders below the indicator when non-null
- [ ] No other content or actions visible during processing — single focused indicator

---

#### ZONE: OCR Workstation — Source Image Panel (Step: preview + export)

| Property | Value |
|---|---|
| Operational Role | Displays the source document image with zoom/pan controls, magnifier, and active-cell bounding box overlay. Operator compares extracted data in the sheet panel against this image. |
| Attention Priority | 1 |
| Position | Left third of the three-pane workstation (~33% width, CSS grid `ocr-workstation-grid`) |
| Width | ~33% (responsive — collapses on compact desktop and mobile) |
| Height | fill-remaining — independent scroll within the panel |
| Sticky Behavior | panel header sticky within the panel |
| Collapse Behavior | collapsible to the right via `reviewRailCollapsed`-style toggle — not used in source panel currently |
| Scroll Behavior | independent scroll (panning the source image scrolls within the panel, not the page) |
| Density Mode | N/A — image viewer, not a data surface |
| Existence Justification | `step === "preview" OR step === "export"` AND `resultPreview !== null` — the source image is the ground truth against which extracted data is verified. Without it, the operator cannot correct extraction errors. |

**Contents:**
- Panel header: "Source image" label (13px/500/sentence-case) + scan quality badge (static — "Blurry scan" danger / "{band} quality" success)
- Source toolbar: Zoom –/+ buttons + "Fit width" + "Fit height" + "Magnifier" toggle + "Reset"
- Image viewer: scrollable/pannable container — `<img>` with pointer drag-to-pan. `transform: scale(zoom)`.
- Active cell bounding box: `<div>` overlay positioned by `boundingBox` state — highlights the cell being edited in the sheet panel on the source image. Uses `--status-info-border` border, `--status-info-bg/40` background tint.
- Magnifier lens: floating `<div>` with `background-image` zoom at pointer position — renders when `magnifierEnabled=true`
- Image load error notice: "Image load issue. Retrying…" — bottom-left of viewer, uses token warning styles

**Acceptance Criteria:**
- [ ] Panel header uses sentence-case label — no uppercase tracking
- [ ] Scan quality badge is static (no animation) — uses token surface variables
- [ ] Zoom toolbar is keyboard accessible (buttons have accessible labels)
- [ ] Active cell bounding box updates as `activeCell` state changes
- [ ] Panel header uses 13px/weight 500/Inter UI

---

#### ZONE: OCR Workstation — Sheet Workspace Panel (Step: preview + export)

| Property | Value |
|---|---|
| Operational Role | Editable spreadsheet grid showing extracted headers and rows. Operator corrects incorrect cell values, adds/removes rows, toggles confidence overlays. The primary data editing surface. |
| Attention Priority | 1 |
| Position | Center of three-pane workstation (~45% width) |
| Width | ~45% (largest panel — primary editing surface) |
| Height | fill-remaining — independent scroll within the panel |
| Sticky Behavior | sheet header sticky within the panel (column headers stay visible while scrolling rows) |
| Collapse Behavior | never |
| Scroll Behavior | independent scroll |
| Density Mode | compact — cell editing requires maximum rows visible |
| Existence Justification | `editableHeaders[]` + `editableRows[][]` — this is where the extracted data lives and where the operator corrects it. |

**Contents:**
- Panel header: "OCR spreadsheet" label (13px/500/sentence-case) + view mode control (SegmentedControl: Spreadsheet / Raw)
- Edit toolbar: `EditToolbar` component — undo/redo/add-row/add-column/toggle-header-row/toggle-confidence
- Sheet scroll area:
  - Spreadsheet view: `OcrSpreadsheetGrid` (TanStack-based) or `DataTableGrid` (legacy) — feature flag gated
  - Raw view: `RawDataView` — JSON debug output
- Low-confidence cell highlight: cells with `confidence < 0.60` shown with `showLowConfidence` overlay
- Active cell indicator: selected cell highlighted with `ring-1 ring-border-focus`
- `KeyboardShortcutStrip`: shows keyboard shortcut hints for common cell operations

**Acceptance Criteria:**
- [ ] Panel header uses sentence-case label — no uppercase tracking
- [ ] View mode control uses system SegmentedControl or Tabs primitive — NOT custom rounded-full accent buttons
- [ ] EditToolbar renders with undo/redo correctly disabled when history is exhausted
- [ ] Low-confidence cells are visually differentiated when `showLowConfidence=true` — structural treatment (border/background), not color-only
- [ ] Active cell selection communicates to Source Image Panel via `setActiveCell` callback

---

#### ZONE: OCR Workstation — Review Rail (Step: preview + export)

| Property | Value |
|---|---|
| Operational Role | Context panel showing extraction quality metrics (avg confidence, unresolved cells, suspicious rows, correction count), reprocess controls, and primary step-advancement actions (Approve extraction / Export). Collapsible to save screen space. |
| Attention Priority | 2 |
| Position | Right of three-pane workstation (~22% width) |
| Width | ~22% fixed (collapses to `ocr-rail-peek` button when `reviewRailCollapsed=true`) |
| Height | fill-remaining — independent scroll |
| Sticky Behavior | rail header sticky within the rail |
| Collapse Behavior | collapsible to right edge via eye toggle button (`EyeOff` icon). Collapsed state renders as a slim "Review rail" button to re-expand. |
| Scroll Behavior | independent scroll |
| Density Mode | compact |
| Existence Justification | `resultPreview.avgConfidence` + `visibleLowConfidenceCount` + `suspiciousRowCount` — quality metrics that guide the operator's correction priority. The Approve extraction / Try another image actions must be in one location — the rail provides this canonical action location. |

**Contents:**
- Rail header: "Review rail" label (13px/500/sentence-case) + current step label ("Verification active" / "Ready for export") + collapse button (EyeOff icon)
- Quality metrics:
  - Average confidence: "Verified" / "Check" / "Review" — semantic label from `formatConfidence()`. Static badge.
  - Unresolved cells: count of `review_required` cells — danger token when > 0, success when 0.
  - Suspicious rows: count of rows with low-confidence cells — warning token when > 0.
  - Corrections: count of user edits vs. original extraction.
- Linked focus context: current active cell label ("R3: Column Name") — updates as `activeCell` changes.
- Inspection notes: scan quality warnings as compact chips (e.g., "Low quality", "Possible rotation").
- Reprocess section: Model select (Auto / Haiku / Sonnet / Opus) + "Reprocess OCR" button.
- Action buttons: "Delete selected row", "Approve extraction" (step preview→export), "Reopen review" (step export→preview), "Try another image" (reset).

**Acceptance Criteria:**
- [ ] Rail header uses sentence-case labels — no uppercase tracking
- [ ] Confidence badge is static — no pulse, no glow, no animation
- [ ] Collapse/expand toggle works correctly; collapsed state shows slim `ocr-rail-peek` button
- [ ] "Approve extraction" button is only visible at `step = "preview"`; "Reopen review" only at `step = "export"`
- [ ] Inspection notes chips use token surface variables — not raw rgba colors
- [ ] Quality metrics use token semantic colors: danger for critical, warning for elevated, success for clean

---

#### ZONE: Export Action Rail (Step: export only — below workstation)

| Property | Value |
|---|---|
| Operational Role | Export controls and downstream workflow navigation. Download XLSX/CSV/JSON/PDF. Share link generation. Link to `/ocr/verify` workflow. |
| Attention Priority | 1 (at export step — this IS the terminal action) |
| Position | Below the three-pane workstation grid |
| Width | full-width |
| Height | content-driven |
| Sticky Behavior | not sticky |
| Collapse Behavior | N/A — only visible at export step |
| Scroll Behavior | inherits shell |
| Density Mode | default |
| Existence Justification | `step === "export"` + `savedId` — operators must be able to export their work. The ExportPanel component handles this. The "Open review workflow" link is the handoff to the supervisor verification path. |

**Contents (ExportPanel component — existing):**
- Export XLSX button (primary) — `handleDownloadExcel()`
- Download CSV, JSON, PDF buttons (secondary)
- Copy to clipboard button
- Share link generator: `ShareLinkGenerator` component — generate/copy time-limited share link
- "Open review workflow" link button: renders only when `savedId` is non-null — navigates to `/ocr/verify?verification_id={savedId}`

**Acceptance Criteria:**
- [ ] Export buttons disabled when `excelBusy=true` or `savingDraft=true`
- [ ] "Open review workflow" link only renders when `savedId` is non-null
- [ ] ExportPanel uses existing `ExportPanel` component — not reimplemented

---

#### ZONE: Cache Notice Banner (Conditional — Step: preview)

| Property | Value |
|---|---|
| Operational Role | Notifies operator when the extraction result was served from the AI result cache (same document scanned before). Provides "Scan fresh" action. |
| Attention Priority | 2 |
| Position | Between OCR Workspace Shell and the three-pane workstation (only visible at preview step) |
| Width | full-width |
| Height | fixed: 52px (single-row compact notice) |
| Sticky Behavior | not sticky |
| Collapse Behavior | hidden when `!resultPreview.cached` |
| Scroll Behavior | inherits shell |
| Density Mode | compact |
| Existence Justification | `resultPreview.cached = true` — the operator must know when they are reviewing a cached result, not a fresh extraction. Cache trust level (high/low) drives the appropriate urgency. |

**Contents:**
- Cache trust badge: "Cached result" (info token) or "Low trust cache" (warning token) — sentence case, no emoji
- Age label: "N hours old" — 12px / JetBrains Mono
- "Scan fresh" button: outline — calls `handleRerunWithSelectedModel(forceRefresh=true)` with confirmation modal if `result.userCorrected=true`

**Acceptance Criteria:**
- [ ] Zone hidden when `resultPreview.cached = false` or `resultPreview = null`
- [ ] Uses token surface variables — no `border-2 rounded-[22px] bg-amber-50/80` raw values
- [ ] No emoji in this zone
- [ ] Age uses JetBrains Mono format

---

### 4.3 Zone Interaction Rules

```yaml
zone_interactions:
  - trigger: File chosen (chooseFile called)
    effect: step → "processing"; processingStage → "uploaded"; all upload zone content replaced by ProgressIndicator
    reason: Sequential wizard — upload completion advances the step

  - trigger: Extraction completes (processFile resolves)
    effect: step → "preview"; resultPreview populated; workstation three-pane layout renders
    reason: Sequential wizard — processing completion advances the step

  - trigger: activeCell changes in Sheet Workspace
    effect: Source Image Panel bounding box updates to highlight corresponding cell position
    reason: The bounding box overlay creates spatial connection between sheet and source image

  - trigger: Cell edited in Sheet Workspace
    effect: draftDirty = true; debounced autosave fires after 1.5s; review rail correction count increments
    reason: Edits must be persisted before export

  - trigger: draftDirty = true and 1.5s debounce fires
    effect: persistStructuredDraft() called; savingDraft=true; draft save indicator in shell shows
    reason: Autosave contract — operator should not need to explicitly save

  - trigger: "Approve extraction" button clicked (review rail, step=preview)
    effect: step → "export"; ExportPanel visible below workstation; "Approve extraction" hidden; "Reopen review" visible
    reason: Sequential wizard — preview approval advances to export step

  - trigger: reviewRailCollapsed toggled
    effect: Review rail collapses to slim "Review rail" peek button; sheet workspace and source panel expand to fill
    reason: Power users scanning many rows need maximum table width; rail can be temporarily hidden

  - trigger: resultPreview.cached = true (cache hit)
    effect: Cache Notice Banner renders between shell and workstation
    reason: Cache transparency — operator must see provenance of the result

  - trigger: "Try another image" button (review rail)
    effect: resetFlow() called; step → "upload"; all preview state cleared
    reason: Operator abandons current extraction and starts over

  - trigger: selectedModel changes (review rail select)
    effect: selectedModel state updates; "Reprocess OCR" button enabled if rerunSourceFile is set
    reason: Model selection gates the reprocess action

  - trigger: "Reprocess OCR" clicked (review rail)
    effect: step → "processing"; handleRerunWithSelectedModel(selectedModel) called; processingStage restarts
    reason: Operator re-extracts with a different model for better accuracy
```

---

## 5. OPERATIONAL ATTENTION HIERARCHY

### 5.1 Scan Flow

```
UPLOAD STEP:
LEVEL 1 (0–200ms): Drop zone (dominant visual target) — or camera/upload buttons on mobile
LEVEL 2 (200ms–1s): File type hint / drag indicator
LEVEL 3 (1s+): Recent records, template selector

PROCESSING STEP:
LEVEL 1 (immediate): Processing stage indicator — operator needs to know extraction is running
LEVEL 2: Stage label and progress (uploaded → detect → extract → confidence)
LEVEL 3+: N/A — nothing else shown

PREVIEW STEP:
LEVEL 1 (0–200ms): Review rail — unresolved cells count (danger badge) and avg confidence
  — Operator's first question: "How many cells need my attention?"
LEVEL 2 (200ms–1s): Source image and sheet grid — visual alignment of document vs. extracted data
LEVEL 3 (1s–3s): Specific low-confidence cells in the sheet (highlighted)
LEVEL 4 (3s+): Individual cell corrections, zoom controls, reprocess

EXPORT STEP:
LEVEL 1 (immediate): "Export XLSX" primary button — the terminal action
LEVEL 2: Other export formats, share link
LEVEL 3: "Open review workflow" link — handoff to supervisor
```

### 5.2 Persistent Visibility Requirements

| Element | Reason It Must Persist |
|---|---|
| Step indicator (all steps) | Operator must always know where they are in the 4-step flow |
| Status banner (when non-empty) | Extraction errors and warnings must be visible across steps |
| Review rail quality metrics (preview/export) | Operator's correction priority depends on seeing unresolved cell count at all times |

### 5.3 Contextual Visibility Rules

```yaml
contextual_rules:
  - condition: step = "upload"
    shows: Upload Zone (UploadBox desktop / MobileEntry mobile)
    hides: Processing Zone, Workstation, Cache Notice, Export Rail

  - condition: step = "processing"
    shows: Processing Zone (ProgressIndicator)
    hides: Upload Zone, Workstation, Cache Notice, Export Rail

  - condition: step = "preview" AND resultPreview != null
    shows: OCR Workstation (3 panels), Cache Notice if cached=true
    hides: Upload Zone, Processing Zone, Export Rail

  - condition: step = "export" AND resultPreview != null
    shows: OCR Workstation (3 panels) + Export Action Rail
    hides: Upload Zone, Processing Zone

  - condition: reviewRailCollapsed = true
    shows: ocr-rail-peek button (slim strip)
    hides: Review Rail full content

  - condition: resultPreview.cached = true AND step = "preview"
    shows: Cache Notice Banner
    hides: nothing (additive)

  - condition: savedId = null
    shows: nothing — "Open review workflow" link hidden
    hides: "Open review workflow" link in Export Panel
    reason: Can only link to verification if it has been saved

  - condition: activeCell != null AND boundingBox computed
    shows: Bounding box overlay on Source Image
    hides: nothing (additive overlay)

  - condition: canUseOcr = false
    shows: Role-gate screen
    hides: Entire workspace
```

---

## 6. TABLE & DATA STRATEGY

The Sheet Workspace Panel contains the editable spreadsheet — this is not a standard DataTable. It is a specialized OCR editing grid managed by `OcrSpreadsheetGrid` (TanStack-based) or `DataTableGrid` (legacy). The spec documents the structural requirements; the grid implementation is owned by the OCR-specific components.

### 6.1 Sheet Grid Role

| Field | Value |
|---|---|
| Primary Purpose | Display and edit AI-extracted tabular data; allow operators to correct AI errors before saving |
| Scanning Pattern | Anomaly-first — low-confidence cells are highlighted to guide the operator's attention |
| Primary Decision | Is this cell value correct? If not, edit it. |
| Action Trigger | Low-confidence highlight (showLowConfidence=true) draws attention to cells needing verification |
| Row Volume | Typical: 5–50 rows / Max: 200+ rows / Virtualization: handled by OcrSpreadsheetGrid |

### 6.2 Cell State Specification

```yaml
cell_states:
  normal: standard surface-card background — AI extracted, confidence ≥ 0.60
  low_confidence: warning-token border + background tint (when showLowConfidence=true)
  review_required: danger-token border + background (confidence < 0.60)
  active: ring-1 ring-border-focus — currently selected cell
  corrected: success-token subtle treatment — cell has been edited from AI extraction
  header: surface-panel background — column header row (sticky top)
```

### 6.3 Inline Actions

```yaml
inline_actions:
  primary:
    action: Cell click → sets activeCell; cell double-click / keyboard Enter → enters edit mode
    trigger_condition: any cell in the sheet
    placement: entire cell is the click target
  secondary:
    action: Row delete via "Delete selected row" button in review rail (not inline)
    trigger_condition: activeCell is non-null
    placement: review rail action group
  destructive:
    action: Row deletion
    confirmation_required: no (undo available via Ctrl+Z)
    authorized_roles: all
    placement: review rail — never inline
```

---

## 7. FORM & INPUT STRATEGY

No traditional form on this workspace. The upload zone has a file input and URL input. The review rail has a model select and action buttons. The sheet grid is an editing surface. None of these constitute a form in the traditional sense.

The only form-like group is the URL import in UploadBox:

```yaml
field_groups:
  - group: URL Import (upload step only)
    operational_purpose: Allow importing a document from a URL instead of file upload
    fields:
      - name: remoteUrl
        type: text input
        required: no
        validation_rules: Must be a valid HTTP/HTTPS URL; image or PDF at the URL
        tab_order: 3 (after drop zone and camera button)
        default_value: ""
        error_message: Could not download this image. Check the URL and try again.
```

---

## 8. AI & AUDIT VISIBILITY STRATEGY

### 8.1 AI Placement Map

```yaml
ai_placements:
  - system: Anthropic extraction (confidence matrix)
    zone: Sheet Workspace Panel — per-cell visual treatment
    position_within_zone: inline in each cell (border/background when low confidence)
    display_trigger: immediately on preview step load when showLowConfidence=true
    confidence_display: structural cell treatment — not percentage labels per cell
    confidence_placement: inline in cell
    reasoning_text: no
    accept_action: operator edits the cell to correct it; confidence treated as "resolved"
    reject_action: N/A — operator simply edits
    unavailable_state: if confidence_matrix is empty, all cells render as normal (no highlight)
    static_only: true

  - system: Avg confidence / quality summary
    zone: Review Rail — quality metrics section
    position_within_zone: top of rail body, three metric rows
    display_trigger: on preview step load
    confidence_display: text label — "Verified" / "Check" / "Review" (from formatConfidence())
    confidence_placement: inline in metric row
    reasoning_text: no
    accept_action: operator proceeds to Approve extraction
    reject_action: operator runs Reprocess OCR
    unavailable_state: show "—" if avgConfidence is null
    static_only: true

  - system: Routing meta (model used, processing time)
    zone: Review Rail — inspection notes section (or processing diagnostics section in export step)
    position_within_zone: below quality metrics
    display_trigger: on preview step load when routingMeta is non-null
    confidence_display: model tier label (sentence case)
    confidence_placement: inline in context row
    reasoning_text: no (model name only — not full reasoning)
    unavailable_state: omit if routingMeta is null
    static_only: true
```

### 8.2 Audit Visibility Map

```yaml
audit:
  placement: Not shown on scan page — audit events are written on save/submit/approve/reject
  trigger: OcrAuditEvent written on POST /ocr/verifications (draft save). Visible in /ocr/verify.
  events_logged:
    - draft_created: written when POST /ocr/verifications succeeds
  detail_level: not surfaced on scan workspace — visible in verify workspace
  authorized_roles: N/A on this workspace
  realtime_updates: N/A
  max_events_shown: N/A
```

### 8.3 Anomaly Visibility

```yaml
anomaly:
  detection_source: AI (confidence matrix from Anthropic extraction)
  placement:
    - Sheet Workspace Panel: per-cell treatment (low confidence cells highlighted)
    - Review Rail: unresolved cells count + suspicious rows count
    - Source Image Panel: scan quality badge ("Blurry scan" danger / quality band label)
    - Cache Notice Banner: cache trust level when cached=true
  severity_levels:
    - review_required (confidence < 0.60):
      structural_treatment: danger-token cell border + tint; counted in "Unresolved cells" metric
      action_required: yes — operator should edit this cell
    - medium confidence (0.60–0.84):
      structural_treatment: warning-token cell border (when showLowConfidence=true)
      action_required: conditional — operator should verify
    - blurry scan (scanQualityBand = "low"):
      structural_treatment: danger badge in source panel header (static)
      action_required: yes — operator should consider rescanning
  dismissible: yes — operator can toggle showLowConfidence to hide low-confidence highlights
  persistence: until operator corrects the cell (changes confidence to "corrected" source)
```

---

## 9. DENSITY, SPACING & LAYOUT RHYTHM

### 9.1 Density Mode

```yaml
density:
  upload_step: default — single upload zone needs comfortable spacing
  processing_step: default — centered progress indicator
  preview_step: compact — sheet grid needs maximum cell visibility
  export_step: compact — same as preview
  operator_switchable: no — density is step-driven
  specs:
    table_row_height:
      compact: 36px (sheet grid rows)
    cell_padding:
      compact: 8px horizontal / 6px vertical (sheet cells)
```

### 9.2 Spacing Rhythm

```yaml
spacing:
  section_gap: 12px — between outer shell and step content zones
  workstation_panel_gap: 0px — panels share borders, no gap between them
  panel_header_height: 44px — each workstation panel header
  review_rail_width: 220px (collapsed to 32px peek strip)
  source_panel_width: ~33% of workstation grid
  sheet_panel_width: ~45% of workstation grid (fills remaining after rail and source)
  sticky_header_height: 48px — AppShell topbar (not workspace-specific)
  step_indicator_height: 48px
```

### 9.3 Typography Specification

```yaml
typography:
  workspace_title: 16px / weight 500 / Inter UI / sentence case — "OCR scan"
  step_label: 13px / weight 500 / Inter UI / sentence case — "Upload", "Processing", "Preview & edit", "Export"
  panel_header_label: 13px / weight 500 / Inter UI / sentence case
    # Replaces ALL uppercase tracking labels in panel headers
  panel_subheader: 13px / weight 400 / Inter UI / text-secondary
  status_badge: 11px / weight 600 / Inter UI / sentence case
  ai_reasoning: N/A (no reasoning text)
  numeric_data: 13px / tabular-nums
  timestamp: 12px / JetBrains Mono  # cache age, processing time
  error_message: 12px / weight 400 / Inter UI
  quality_metric_label: 12px / weight 500 / Inter UI / sentence case
  quality_metric_value: 13px / weight 600 / Inter UI
  cell_content: 13px / weight 400 / Inter UI  # sheet cells
  header_cell: 12px / weight 600 / Inter UI / sentence case  # column headers
```

**Typography violations to fix — count from current implementation:**
- `text-[11px] font-semibold uppercase tracking-[0.18em]`: 4+ instances in panel headers → all replaced with 13px/500 sentence case
- `text-[11px] font-semibold uppercase tracking-[0.14em]`: 3+ instances in rail context labels → replaced
- `text-[11px] font-semibold uppercase tracking-[0.12em]`: 1 instance in scan quality badge → replaced
- All replaced with sentence-case system typography

### 9.4 Surface Token Hierarchy

```yaml
surfaces:
  workspace_background: var(--surface-app)
  workstation_panel: var(--surface-panel)  # each of the three panels
  panel_header: var(--surface-shell)       # panel header strip
  sheet_cell: var(--surface-card)          # normal cells
  sheet_header: var(--surface-panel)       # column header row (sticky)
  source_viewer: var(--surface-shell)      # image viewer background
  review_rail: var(--surface-panel)        # right rail
  status_banner_success: var(--status-success-bg) / var(--status-success-border) / var(--status-success-fg)
  status_banner_warning: var(--status-warning-bg) / var(--status-warning-border) / var(--status-warning-fg)
  status_banner_error: var(--status-danger-bg) / var(--status-danger-border) / var(--status-danger-fg)
  cache_notice_info: var(--status-info-bg) / var(--status-info-border) / var(--status-info-fg)
  cache_notice_warning: var(--status-warning-bg) / var(--status-warning-border) / var(--status-warning-fg)
```

---

## 10. RESPONSIVE & OPERATOR ADAPTATION

### 10.1 Desktop Workstation (Primary Target)

```yaml
desktop_workstation:
  min_width: 1280px
  optimal_width: 1440px–1920px
  workstation_layout: three-pane CSS grid — source (33%) | sheet (45%) | rail (22%)
  density_mode: compact at preview/export
  notes: At 1440px with AppShell sidebar (~240px), available width is ~1200px for the workstation. Three panels at 33/45/22% = ~396px / ~540px / ~264px. This is workable — sheet panel at 540px comfortably shows 6+ columns.
```

### 10.2 Compact Desktop (Secondary)

```yaml
compact_desktop:
  width_range: 1024px–1279px
  density_mode: compact
  adaptations:
    - Review Rail: collapses by default at this width (reviewRailCollapsed=true initial state)
    - Source Panel: narrows to 30%
    - Sheet Panel: expands to fill remaining (~70% when rail collapsed)
  degraded_functionality: no — rail still accessible via peek button
```

### 10.3 Mobile / Tablet (Degraded Mode)

```yaml
mobile:
  width_range: <768px
  strategy: sequential — upload uses MobileEntry; workstation panels stack vertically (source → sheet → rail)
  operational_continuity: upload and extraction preserved; sheet editing on mobile is difficult but functional
  zones_hidden: none — all zones stack
  touch_targets: 44px minimum for all toolbar buttons, rail actions, upload tap areas
  workstation_layout: stacked vertical — source panel full-width first, then sheet, then collapsed rail
  device_adaptive: useOcrDevice hook drives MobileEntry vs UploadBox
```

### 10.4 Rail Collapse Behavior

```yaml
rail_collapse:
  review_rail:
    collapse_trigger: manual toggle (EyeOff button in rail header) OR viewport < 1100px
    collapsed_state: slim "Review rail" peek button on right edge (~32px)
    reinvoke_method: click peek button to expand
  source_panel:
    collapse_trigger: N/A — source panel does not collapse in current design
    note: At viewport < 768px, source panel stacks above sheet (full-width)
```

---

## 11. COMPONENT MAPPING

```yaml
component_mapping:
  workspace_container:
    component: factory-ocr-shell (existing CSS class system) within WorkstationShell wrapper
    reason: OCR workspace has its own CSS architecture (factory-ocr-* classes). The outer WorkstationShell provides AppShell integration; the inner factory-ocr-shell manages the workstation grid layout.

  step_indicator:
    component: factory-ocr-stagepill (existing) — 4 pill indicators with done/current/idle states
    props_required: STEP_LABELS array, current step, step state per pill
    note: This component is architecturally sound. Retain as-is. No uppercase in step labels.

  upload_zone:
    component: UploadBox (desktop) / MobileEntry (mobile) — existing specialized components
    props_required: disabled, fileName, recentRecords, remoteUrl, onUploadFile, onOpenRecent
    note: Both components are purpose-built and architecturally correct. Retain.

  processing_zone:
    component: ProgressIndicator — existing component
    props_required: thumbnailSrc, stage, warning
    note: Correct pattern. Retain.

  camera_overlay:
    component: CameraCapture — existing fullscreen overlay component
    props_required: onClose, onCapture, onUploadInstead
    note: Correct pattern. Retain.

  workstation_panels:
    component: ocr-workstation-grid (existing CSS grid class)
    note: Three-panel CSS grid is structurally correct. The grid definition (ocr-workstation-panel, ocr-source-workspace, ocr-sheet-workspace, ocr-review-rail classes) drives layout. Retain.

  sheet_grid:
    component: OcrSpreadsheetGrid (TanStack, feature-flag = USE_TANSTACK_TABLE=true) / DataTableGrid (legacy)
    props_required: rows, headers, activeCell, onActiveCellChange, onCellEdit, isReadOnly=false
    note: Both implementations are purpose-built for OCR cell editing. Retain.

  edit_toolbar:
    component: EditToolbar — existing
    props_required: canUndo, canRedo, headerRowEnabled, showLowConfidence, all handlers
    note: Correct. Retain.

  keyboard_strip:
    component: KeyboardShortcutStrip — existing
    props_required: lowConfidenceCount, totalCells, editedCount
    note: Correct. Retain.

  export_panel:
    component: ExportPanel — existing
    props_required: rowCount, columnCount, correctionCount, busy, onDownloadExcel, onDownloadCsv, etc.
    note: Correct. Retain.

  share_link:
    component: ShareLinkGenerator — existing
    note: Correct. Retain.

  view_mode_toggle:
    component: SegmentedControl (system primitive) OR Tabs (system primitive)
    current_problem: Custom rounded-full accent-bg toggle buttons — NOT using system primitives
    replacement: Use system SegmentedControl with "Spreadsheet" and "Raw" options
    why: Consistent with system interaction language; matches tab elimination in other Phase C workspaces

  status_banner:
    component: StatusBanner (token-styled) — replaces `factory-ocr-status` custom class
    note: factory-ocr-status class should map to token surface variables, not custom CSS color values

  cache_notice:
    component: InlineAlert (info/warning variant) — replaces current `rounded-[22px] border-2 bg-amber-50` raw styling
    note: Token-compliant surface required

Missing components — new primitive candidates:
  None. All required components exist. The view mode toggle replacement (SegmentedControl) already exists as a system primitive.
```

---

## 12. OPERATIONAL PROBLEMS SOLVED

```yaml
problem_resolutions:
  - problem: Header section "telemetry" strip with "Queue visibility / Correction focus / Stage state" diagnostic metrics.
    root_cause: Developer-facing diagnostics surfaced as header content.
    structural_solution: Telemetry strip eliminated (Section 4.1). Quality metrics live in the Review Rail where they belong — as actionable signals at the point of editing, not as header decoration.
    section_reference: Section 4.1, Section 4.2 (Review Rail)
    measurable_outcome: Header shows only workspace title + step indicator. Developer metrics not visible to operators.

  - problem: Header subtitle "Queue-first OCR intake with persistent source context, extraction telemetry, and operator correction flow."
    root_cause: Developer architecture description used as UI copy.
    structural_solution: Subtitle eliminated (Section 4.1, Section 4.2 OCR Workspace Shell acceptance criteria). No subtitle on this workspace.
    section_reference: Section 4.1, Section 4.2
    measurable_outcome: Workspace shell shows title + step indicator only. Zero developer-facing prose.

  - problem: Panel headers use uppercase tracking labels ("SOURCE IMAGE", "OCR SPREADSHEET", "REVIEW RAIL") with 0.14–0.18em tracking.
    root_cause: Custom factory-ocr CSS system predating the typography constitution.
    structural_solution: All panel header labels replaced with 13px/weight 500/Inter UI/sentence case (Section 9.3). "Source image", "OCR spreadsheet", "Review rail".
    section_reference: Section 9.3
    measurable_outcome: Zero uppercase tracking labels in panel headers. ~7 violations eliminated.

  - problem: View mode toggle (Spreadsheet / Raw) uses custom rounded-full accent-bg active state buttons.
    root_cause: Predates system SegmentedControl component; authored as custom toggle.
    structural_solution: View mode toggle uses system SegmentedControl (Section 11). Consistent with tab elimination in other Phase C workspaces.
    section_reference: Section 11
    measurable_outcome: View mode toggle uses system primitive. Keyboard navigation correct. Consistent with system interaction language.

  - problem: Cache notice uses raw `rounded-[22px] border-2 bg-amber-50/80` + emoji (⚡ ⚠️ 🔄).
    root_cause: Quick implementation using Tailwind color classes and emoji for visual differentiation.
    structural_solution: Cache Notice Banner zone (Section 4.2) uses InlineAlert component with token surface variables. Cache trust drives info vs. warning token. No emoji.
    section_reference: Section 4.2 (Cache Notice Banner), Section 9.4
    measurable_outcome: Cache notice uses token surfaces. Zero raw color classes. Zero emoji in the workspace.

  - problem: Scan quality badge in source panel header uses uppercase tracking-[0.12em].
    root_cause: Same factory-ocr CSS typography pattern applied to badge labels.
    structural_solution: Scan quality badge uses StatusBadge component with sentence-case label (Section 9.3). "Blurry scan" / "High quality".
    section_reference: Section 9.3, Section 4.2 (Source Image Panel)
    measurable_outcome: Quality badge in sentence case. Consistent with system badge typography.
```

---

## 13. IMPLEMENTATION HANDOFF

### 13.1 Build Sequence

```yaml
implementation_sequence:
  step_1: Workspace container scaffold — WorkstationShell + factory-ocr-shell + OCR Workspace Shell (step indicator + status banner slot). All step zones as empty divs with correct show/hide logic based on `step` state.

  step_2: Step indicator — factory-ocr-stagepill × 4 with done/current/idle state logic. Step labels: "Upload" / "Processing" / "Preview & edit" / "Export". Sentence case confirmed.

  step_3: Upload Zone — UploadBox (desktop, device flag) + MobileEntry (mobile). File input ref, camera overlay integration, recent records strip, template selector (conditional on templates.length > 0).

  step_4: Processing Zone — ProgressIndicator with thumbnailSrc, stage, warning props. Stage machine: uploaded → preprocess → detect → extract → confidence.

  step_5: OCR Workstation — three-pane CSS grid (ocr-workstation-grid). Source Image Panel with image viewer, zoom toolbar, bounding box overlay. Sheet Workspace Panel with edit toolbar, view mode SegmentedControl (system primitive), OcrSpreadsheetGrid/DataTableGrid. Review Rail with quality metrics (sentence case labels), collapse toggle.

  step_6: AI quality metrics in Review Rail — avgConfidence display ("Verified"/"Check"/"Review" labels — static, no animation), unresolved cells count (danger/success token), suspicious rows (warning/success token), correction count. All static badge treatment.

  step_7: Review rail actions — "Approve extraction" (preview→export), "Try another image" (resetFlow), "Delete selected row", model select + "Reprocess OCR".

  step_8: Export Action Rail — ExportPanel component + "Open review workflow" link (conditional on savedId). Visible only at export step.

  step_9: Cache Notice Banner — InlineAlert with info/warning variant. "Scan fresh" button with ConfirmationModal when userCorrected=true. Age in JetBrains Mono. Sentence case labels.

  step_10: Autosave system — draftDirty flag + persistStructuredDraft() debounced. Draft save error banner.

  step_11: Keyboard shortcuts — Ctrl+Z (undo), Ctrl+Y / Ctrl+Shift+Z (redo), Ctrl+S (save). Global keydown listener during preview/export steps.

  step_12: Responsive adaptations — reviewRailCollapsed default true below 1100px. Mobile stacked layout. MobileEntry device detection.
```

### 13.2 Critical Constraints

```yaml
critical_constraints:
  - Panel header labels must use sentence case — no uppercase tracking: reason: typography law; ~7 violations in current implementation
  - View mode toggle must use system SegmentedControl primitive: reason: custom toggle is non-standard; same pattern eliminated in Phase C workspaces
  - Cache notice must use token surface variables — no raw rgba/Tailwind color classes or emoji: reason: surface token law; emoji is inappropriate for industrial UI
  - All AI confidence indicators are static — no pulse, no glow, no animation: reason: blueprint law
  - OcrSpreadsheetGrid / DataTableGrid are retained as-is — do not replace: reason: purpose-built for OCR cell editing; no system primitive covers this use case
  - UploadBox / MobileEntry / CameraCapture / ProgressIndicator / ExportPanel / EditToolbar / ShareLinkGenerator are all retained: reason: all architecturally correct; only styling fixes needed
  - factory-ocr CSS system is retained for layout (grid, panel positioning): reason: the three-pane workstation grid is not replicated by general system primitives
  - Telemetry strip (header diagnostics) must be eliminated: reason: developer-facing content in operator UI
  - Header subtitle must be eliminated: reason: developer description, not operator guidance
  - Do not modify AppShell scroll architecture: reason: AppShell doctrine
  - All spacing follows 4px base scale: reason: blueprint law
```

### 13.3 Open Questions

```yaml
open_questions:
  - question: The topology describes /ocr/scan as having its AppShell sidebar hidden ("immersiveScannerRoute" flag). This flag was not found in the current codebase via grep. Should the three-pane workstation layout assume the full viewport width (sidebar hidden), or should it account for the ~240px sidebar? The current implementation uses max-w-7xl which works with the sidebar visible.
    blocking: no — max-w-7xl pattern works with sidebar. Proceed with sidebar visible. If sidebar-hide behavior is desired, it requires a separate AppShell configuration change.
    owner: frontend team
    decision_needed_by: before step 5 in 13.1

  - question: USE_TANSTACK_TABLE feature flag controls which spreadsheet grid renders (OcrSpreadsheetGrid vs DataTableGrid). Should the skeleton spec this as always-OcrSpreadsheetGrid going forward, or preserve the flag-gated dual path?
    blocking: no — preserve flag-gated path for now; migration to single grid can be a separate task
    owner: frontend team
    decision_needed_by: before step 5 in 13.1
```

---

## ACCEPTANCE CRITERIA (SPEC COMPLETENESS)

- [x] All 13 sections fully populated — no empty fields, no placeholders
- [x] Every layout zone has a documented existence justification tied to a backend entity or operator need
- [x] Every layout zone has explicit, testable acceptance criteria
- [x] Every component mapped to existing primitives — retained OCR-specific components documented; view mode toggle flagged for replacement with SegmentedControl
- [x] Every operational failure from Section 1.3 has a resolution in Section 12
- [x] Reduction audit completed — telemetry strip, header subtitle, uppercase panel labels, custom toggle, emoji cache notice all documented
- [x] No anti-patterns (no gradients, no glow, no pulse on AI indicators, no uppercase labels in spec, no rgba inline)
- [x] All spacing values follow 4px scale
- [x] All surfaces reference token variables only
- [x] Typography follows approved system exactly — sentence case panel headers specified
- [x] Backend API endpoints verified (confirmed in lib/ocr.ts and topology Section 4.1)
- [x] Permission matrix complete (canUseOcr gate)
- [x] Open questions populated (2 questions, 0 blocking)
- [x] All AI elements marked static: true — confidence indicators, quality badges
- [x] Implementation handoff sequence complete and ordered (12 steps)

---

## POST-GENERATION VALIDATION

```yaml
self_validation:
  operational_integrity:
    - [x] Every zone traces to a specific backend entity or API endpoint
    - [x] Every zone justified by specific operator need (telemetry strip eliminated; subtitle eliminated)
    - [x] No visual-composition-only zones
    - [x] Reduction audit complete — 5 structural reductions documented in Section 12

  law_compliance:
    - [x] All spacing follows 4px base scale
    - [x] All surfaces use CSS token variables — no raw rgba/color classes in spec
    - [x] All text labels sentence case — 7 uppercase tracking violations documented
    - [x] All font specs from approved type system
    - [x] All AI elements static — confidence badges, quality metrics: static: true

  kiro_readiness:
    - [x] Kiro can produce working code without clarifying questions
    - [x] All acceptance criteria are testable
    - [x] Build sequence complete and ordered (12 steps)
    - [x] No blocking open questions

  anti_pattern_check:
    - [x] No gradients
    - [x] No glow effects
    - [x] No pulsing on non-loading elements (AI confidence indicators specified as static)
    - [x] No UPPERCASE labels in the spec — all sentence case
    - [x] No marketing typography
    - [x] No emoji in UI spec
    - [x] No raw rgba inline styles (all token surfaces)
    - [x] No decorative panels

  structural_integrity:
    - [x] Zone interaction rules cover all step transitions and all cross-panel interactions
    - [x] Permission matrix complete
    - [x] Responsive adaptations defined for all breakpoints
    - [x] All Section 12 resolutions reference specific spec sections

  precedent_consistency:
    - [x] View mode toggle replacement (SegmentedControl) consistent with tab/toggle elimination in Phase C
    - [x] Cache notice banner token treatment consistent with alert banner patterns in Phase C
    - [x] AI static indicators consistent with Phase C AI trust doctrine
```

---

## 4A. VISUAL STRUCTURAL HIERARCHY BLUEPRINT

### A. Desktop Structural Blueprint (1440px)

```
UPLOAD STEP:
┌──────────────────────────────────────────────────────────────────────────────┐
│  APPSHELL TOPBAR                                                              │
├──────────────────────────────────────────────────────────────────────────────┤
│  OCR WORKSPACE SHELL                                                          │
│  OCR scan │ ①Upload ──── ②Processing ──── ③Preview & edit ──── ④Export       │
├──────────────────────────────────────────────────────────────────────────────┤
│  UPLOAD ZONE [centered, max-w-2xl]                                            │
│  ┌──────────────────────────────────────────────────────────────────────────┐│
│  │  Drop image or PDF here  /  Use camera  /  Import from URL               ││
│  │  [Template: No template ▾]                                                ││
│  └──────────────────────────────────────────────────────────────────────────┘│
│  Recent: [doc_2241.jpg]  [shift_report_03jun.jpg]  [challans_batch.pdf]       │
└──────────────────────────────────────────────────────────────────────────────┘

PROCESSING STEP:
┌──────────────────────────────────────────────────────────────────────────────┐
│  OCR WORKSPACE SHELL                                                          │
│  OCR scan │ ①Upload ✓ ──── ②Processing ● ──── ③Preview & edit ──── ④Export   │
├──────────────────────────────────────────────────────────────────────────────┤
│  PROGRESS INDICATOR [centered, max-w-lg]                                      │
│  [thumbnail] → Uploading → Preprocessing → Detecting → Extracting → Scoring  │
└──────────────────────────────────────────────────────────────────────────────┘

PREVIEW / EXPORT STEP:
┌──────────────────────────────────────────────────────────────────────────────┐
│  OCR WORKSPACE SHELL                                                          │
│  OCR scan │ ①Upload ✓ ── ②Processing ✓ ── ③Preview & edit ● ── ④Export       │
│  [STATUS BANNER — conditional]                                                │
│  [CACHE NOTICE — conditional, info/warning token]                             │
├──────────────────────┬──────────────────────────────┬────────────────────────┤
│  SOURCE IMAGE [P:1]  │  OCR SPREADSHEET [P:1]        │  REVIEW RAIL [P:2]     │
│  ~33%                │  ~45%                         │  ~22%                  │
│  ─────────────────── │  ──────────────────────────── │  ───────────────────── │
│  Source image        │  OCR spreadsheet  [Spr|Raw]   │  Review rail       [⊘]│
│  [scan quality badge]│  ─────────────────────────── │  ───────────────────── │
│  [Zoom-][100%][Zoom+]│  [EditToolbar: undo/redo/+row]│  Average confidence    │
│  [Fit W][Fit H][Mag] │                               │    ● Verified          │
│  ─────────────────── │  ┌─────────────────────────┐ │  Unresolved cells      │
│  [source image       │  │ Col A  │ Col B  │ Col C  │ │    ● 0                 │
│   with zoom/pan]     │  │ 12.4   │ ABJ    │ 03 Jun │ │  Suspicious rows       │
│                      │  │ [⚠low] │ done   │ 03 Jun │ │    ● 2                 │
│  [bounding box       │  │ 11.9   │ ABK    │ 04 Jun │ │  Corrections           │
│   overlay on active  │  │ ...    │ ...    │ ...    │ │    ● 4                 │
│   cell if set]       │  └─────────────────────────┘ │  ───────────────────── │
│                      │  [KeyboardShortcutStrip]      │  Linked focus          │
│                      │                               │  R2: Column B          │
│                      │                               │  ───────────────────── │
│                      │                               │  Reprocess mode        │
│                      │                               │  [Auto routing ▾]      │
│                      │                               │  [Reprocess OCR]       │
│                      │                               │  ───────────────────── │
│                      │                               │  [Delete selected row] │
│                      │                               │  [Approve extraction]  │
│                      │                               │  [Try another image]   │
├──────────────────────┴──────────────────────────────┴────────────────────────┤
│  EXPORT ACTION RAIL [export step only]                                        │
│  [Export XLSX ●] [CSV] [JSON] [PDF] [Copy] │ [Share link] │ [Open review →]   │
└──────────────────────────────────────────────────────────────────────────────┘

[P:1] = primary attention (source image + sheet grid — operator alternates)
[P:2] = secondary attention (review rail — quality signals)
⊘ = collapse button (EyeOff icon)
⚠low = low-confidence cell treatment (warning token border + tint)
```

---

### B. Visual Attention Flow Map

```
UPLOAD step:
  Scan 1 (0–200ms): Drop zone (dominant visual target)
  Scan 2 (200ms–1s): "Use camera" button (mobile-first operators)
  Scan 3 (1s+): Recent records, template selector

PROCESSING step:
  Scan 1 (immediate): Stage progression bar — "Extracting..." current stage
  — Only one thing to look at; operator waits

PREVIEW step:
  Scan 1 (0–200ms): Review rail — unresolved cells count (danger badge if > 0)
    — Answers: "How much work do I have to do?" before reading any data
  Scan 2 (200ms–1s): Sheet grid — low-confidence cells highlighted (warning tint)
    — Operator navigates to the first problematic cell
  Scan 3 (1s–3s): Source image — zoom to verify the cell against the physical document
  Scan 4 (3s+): Individual cell correction, reprocess decision

EXPORT step:
  Scan 1 (0–200ms): "Export XLSX" primary button — the terminal action
  Scan 2 (200ms–1s): Other export formats
  Scan 3 (1s+): "Open review workflow" link — handoff to supervisor

Spatial relationship design: Source image and sheet grid are side-by-side so the
operator's eyes move horizontally between document and data without vertical scrolling.
The active cell bounding box on the source image creates a visual pointer — "this
highlighted cell in the sheet corresponds to this region of the document."
This is the core UX contract of the three-pane workstation.
```

---

### C. Spacing & Rhythm Visualization

```
UPLOAD STEP — breathable (single focused action):
  Upload zone: 24px internal padding — inviting drop target
  Zone max-width: 672px centered — focused, not overwhelming

PROCESSING STEP — minimal:
  Progress indicator: centered, 16px internal padding
  No competing elements

PREVIEW STEP — dense where needed, breathable at boundaries:
  Workstation panel headers: 44px — clear zone identification
  Between panels: 1px border separator (no gap) — unified workstation surface
  Sheet cells: 8px/6px compact padding — maximum row visibility
  Review rail metrics: 12px between each metric row — legible without waste
  Panel top/left/right padding: 16px — consistent interior breathing room

Between workstation and export rail: 16px — visual transition from editing to publishing
Export rail internal padding: 20px — comfortable action surface
```

---

### D. Component Nesting Hierarchy

```
WorkstationShell ("OCR scan")
  ├── factory-ocr-shell
  │     ├── OCR Workspace Shell
  │     │     ├── WorkspaceTitle ("OCR scan")
  │     │     ├── StepIndicator (factory-ocr-stagepill × 4)
  │     │     ├── [Conditional] StatusBanner (success/warning/error token)
  │     │     └── [Conditional] DraftSaveError banner (warning token)
  │     │
  │     ├── [step="upload"] UploadBox / MobileEntry
  │     │     ├── UploadBox (desktop)
  │     │     │     ├── DragDropZone
  │     │     │     ├── Button ("Use camera")
  │     │     │     ├── Input + Button (URL import)
  │     │     │     ├── [Conditional] Select (template)
  │     │     │     └── [Conditional] RecentRecordStrip
  │     │     └── MobileEntry (mobile)
  │     │           ├── TapTarget ("Take photo")
  │     │           ├── TapTarget ("Upload file")
  │     │           └── [Conditional] RecentChips
  │     │
  │     ├── [step="processing"] ProgressIndicator
  │     │     ├── ThumbnailPreview
  │     │     ├── StageBar (uploaded/preprocess/detect/extract/confidence)
  │     │     └── [Conditional] ProcessingWarning
  │     │
  │     ├── [step="preview"|"export"]
  │     │     ├── [Conditional] CacheNoticeBanner (InlineAlert)
  │     │     │     ├── TrustBadge (info/warning token, sentence case)
  │     │     │     ├── AgeLabel (JetBrains Mono)
  │     │     │     └── Button ("Scan fresh" — outline)
  │     │     │
  │     │     └── ocr-workstation-grid (CSS grid)
  │     │           ├── SourceImagePanel (ocr-source-workspace)
  │     │           │     ├── PanelHeader (13px/500, sentence case + ScanQualityBadge)
  │     │           │     ├── SourceToolbar (Zoom/Fit/Magnifier buttons)
  │     │           │     └── SourceViewer (scrollable image + bounding box overlay)
  │     │           │
  │     │           ├── SheetWorkspacePanel (ocr-sheet-workspace)
  │     │           │     ├── PanelHeader (13px/500, sentence case + SegmentedControl)
  │     │           │     ├── EditToolbar
  │     │           │     ├── SheetScrollArea
  │     │           │     │     ├── OcrSpreadsheetGrid (USE_TANSTACK_TABLE=true)
  │     │           │     │     ├── DataTableGrid (USE_TANSTACK_TABLE=false)
  │     │           │     │     └── RawDataView (viewMode="raw")
  │     │           │     └── KeyboardShortcutStrip
  │     │           │
  │     │           └── ReviewRail (ocr-review-rail)
  │     │                 ├── RailHeader (13px/500, sentence case + EyeOff collapse)
  │     │                 ├── QualityMetrics (confidence / unresolved / suspicious / corrections)
  │     │                 ├── LinkedFocusContext (active cell label)
  │     │                 ├── InspectionNotes (warning chips, token-styled)
  │     │                 ├── ReprocessSection (model Select + Reprocess button)
  │     │                 └── ActionGroup (Delete row / Approve / Reopen / Try another)
  │     │
  │     └── [step="export"] ExportActionRail
  │           ├── ExportPanel (XLSX/CSV/JSON/PDF/Copy)
  │           ├── ShareLinkGenerator
  │           └── [savedId != null] Link → /ocr/verify?verification_id={savedId}
  │
  └── ConfirmationModal (replace scan confirmation — portal)
      └── CameraCapture (camera overlay — portal)
```

---

### E. Responsive Collapse Blueprint

```
1440px+ (Full workstation — three panes visible):
┌─────────────────────────────────────────────────────────────────────┐
│  SOURCE [~33%] │  SHEET GRID [~45%]  │  REVIEW RAIL [~22%]         │
└─────────────────────────────────────────────────────────────────────┘

1024px–1279px (Compact desktop — rail collapses by default):
┌──────────────────────────────────────────────────────┬──────────────┐
│  SOURCE [~35%]  │  SHEET GRID [~65%]                 │  Rail ▶ peek │
└──────────────────────────────────────────────────────┴──────────────┘
Rail collapsed to slim 32px peek button. Sheet expands to fill.
Operator can re-expand rail on demand.

<768px (Mobile — stacked sequential):
┌─────────────────────────────────────────────┐
│  STEP INDICATOR [horizontal, scrollable]     │
├─────────────────────────────────────────────┤
│  [upload step] MobileEntry                   │
│  Two large tap targets (camera / file)        │
│  Recent chips                                 │
├─────────────────────────────────────────────┤
│  [preview step] SOURCE IMAGE [full-width]    │
├─────────────────────────────────────────────┤
│  [preview step] SHEET GRID [full-width]      │
│  EditToolbar + OcrSpreadsheetGrid            │
├─────────────────────────────────────────────┤
│  [preview step] REVIEW RAIL [collapsed]      │
│  Quality metrics inline (no side panel)      │
│  Action buttons: Approve / Try another       │
└─────────────────────────────────────────────┘
Three-pane horizontal layout is abandoned on mobile.
Panels stack vertically. All critical actions preserved.
Touch targets 44px minimum.
```

---

### F. Structural Consistency Validation

```yaml
structural_validation:
  - [x] All zones justified by operational necessity (telemetry strip and subtitle eliminated)
  - [x] Visual dominance: source image + sheet grid both P:1 — operator alternates between them (correct for comparison task)
  - [x] Spacing rhythm follows density specs (compact for preview; default for upload)
  - [x] Responsive adaptations preserve all critical operations (camera, upload, cell editing, export all mobile-accessible)
  - [x] Component nesting hierarchy matches Section 11
  - [x] No over-zoning — 7 zones across 4 steps; all operationally justified
  - [x] OCR-specific components retained (UploadBox, ProgressIndicator, OcrSpreadsheetGrid, EditToolbar, ExportPanel)
  - [x] No custom toggle buttons — view mode uses SegmentedControl
  - [x] Blueprint matches SEQUENTIAL WIZARD + SPLIT WORKSPACE pattern declared in Section 4.1
```

---

## KIRO TASK CHAINING

```yaml
downstream_tasks:
  task_1:
    name: "OCR Scan — Shell + Step Indicator"
    source: Section 4.2 (OCR Workspace Shell)
    output: WorkstationShell + factory-ocr-shell + step indicator (4 pills, done/current/idle). Status banner slot. No content yet.

  task_2:
    name: "OCR Scan — Upload Zone"
    source: Section 4.2 (Upload Zone)
    output: UploadBox (desktop) + MobileEntry (mobile). File input ref. Template selector (conditional). Recent records strip. Camera overlay integration.

  task_3:
    name: "OCR Scan — Processing Zone"
    source: Section 4.2 (Processing Zone), Section 3.3
    output: ProgressIndicator with stage machine. processingStage state transitions. Processing warning banner.

  task_4:
    name: "OCR Scan — Workstation Layout"
    source: Section 4.1, Section 4.2 (workstation zones)
    output: ocr-workstation-grid CSS grid. Three-pane layout (source/sheet/rail). Panel headers with sentence-case labels. Placeholder content in each pane.

  task_5:
    name: "OCR Scan — Source Image Panel"
    source: Section 4.2 (Source Image Panel)
    output: Image viewer with zoom/pan/magnifier. Bounding box overlay. Scan quality badge (static, token surfaces). Image load error handling.

  task_6:
    name: "OCR Scan — Sheet Grid + Edit Toolbar"
    source: Section 4.2 (Sheet Workspace Panel), Section 6
    output: OcrSpreadsheetGrid/DataTableGrid (feature-flagged). EditToolbar. View mode SegmentedControl (system primitive — replaces custom toggle). KeyboardShortcutStrip. Low-confidence cell treatment.

  task_7:
    name: "OCR Scan — Review Rail"
    source: Section 4.2 (Review Rail), Section 8.1
    output: Quality metrics (sentence-case labels, static badges, token colors). Collapse/expand toggle. Reprocess section. Action buttons (Approve/Try another/Delete row).

  task_8:
    name: "OCR Scan — Extraction pipeline"
    source: Section 3.1, Section 3.3
    output: POST /ocr/table-excel with file. Stage machine wiring. Result parsing (extractPreviewTable). Error handling (humanExtractError). Quota exceeded handling.

  task_9:
    name: "OCR Scan — Draft persistence + autosave"
    source: Section 3.3, Section 8.2
    output: POST /ocr/verifications (first save). PUT /ocr/verifications/{id} (updates). draftDirty + 1.5s debounce. draftSaveError banner. savedId state.

  task_10:
    name: "OCR Scan — Export Rail + Cash Notice"
    source: Section 4.2 (Export Action Rail, Cache Notice Banner)
    output: ExportPanel + ShareLinkGenerator. "Open review workflow" link (conditional). Cache notice InlineAlert (token surfaces, no emoji, JetBrains Mono age).

  task_11:
    name: "OCR Scan — Keyboard shortcuts + history"
    source: Section 13.1 step 11
    output: Ctrl+Z undo, Ctrl+Y redo, Ctrl+S save. History stack (historyRef, historyIndexRef).

  task_12:
    name: "OCR Scan — Responsive + permission gate"
    source: Section 3.6, Section 10
    output: canUseOcr role gate. reviewRailCollapsed default true below 1100px. Mobile stacked layout. Touch targets 44px.
```

---

*Status: COMPLETE — all 13 sections populated, all acceptance criteria met, post-generation validation passed.*
*Phase C progress: 5/8 complete — /approvals ✓, /attendance/live ✓, /attendance/review ✓, /attendance/reports ✓, /ocr/scan ✓*
*Next: /ocr/history — Phase C, Item 6.*
