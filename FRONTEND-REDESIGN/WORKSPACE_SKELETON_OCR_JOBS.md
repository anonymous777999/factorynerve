# OCR Job Status — Workspace Skeleton Architecture
# FactoryNerve OS | Phase 3 Skeleton Specification | Phase C, Item 7
# Route: /ocr/jobs/[jobId]
# Generated: 2026-06-03
# Status: DRAFT

---

## 1. WORKSPACE OVERVIEW

### 1.1 Identity

| Field | Value |
|---|---|
| Route | `/ocr/jobs/[jobId]` |
| Workspace Name | OCR Job Status — Background Job Detail |
| Operational Role | Shows the live status of a single background OCR job: queue state, progress percentage, phase message, timestamps, result metadata (row count, columns), and contextual error detail. Provides Cancel (when running) and Retry (when failed/canceled) actions. Auto-polls every 3 seconds while the job is active. |
| Business Impact | If this workspace fails, operators cannot track the status of submitted OCR jobs or act on failures. A failed job that is not retried means the document never enters the OCR verification pipeline, blocking downstream reporting and export. |
| User Population | Operator (job owner — checks their own submitted job). Supervisor and manager (oversight). All roles with OCR access. |
| Peak Usage Context | Immediately after submitting a scan job — operator waits for processing to complete. Also: when a job fails and the operator needs to retry. |
| Predecessor Workspaces | `/ocr/scan` (job initiated there), JobsDrawer in AppShell (links to this page per job) |
| Successor Workspaces | `/ocr/history` (after job completes — review the saved verification), `/ocr/verify` (after job completes — open the verification draft) |

### 1.2 Operational Importance

OCR job status is the feedback loop between submission and result. An operator who submits a scan cannot proceed to verification until the job finishes. If the job fails, they need to know why and whether they can retry without re-scanning. This workspace provides that feedback in a single focused view — job state, progress, and the exact error message when something goes wrong. The 3-second poll ensures the operator sees real-time progress without manual refresh.

### 1.3 Current State Failures

- Failure 1: `OcrPage` renders alongside the job status view — the job start form, runtime status cards, template manager, and template creation form all render on `/ocr/jobs/[jobId]`. An operator arrives to check a specific job and sees the entire OCR admin workspace. → The [jobId] URL contract is broken — this page should show one job, not the full OCR admin tool.
- Failure 2: Header section uses `rounded-[2rem]` + `backdrop-blur` + `bg-[rgba(20,24,36,0.88)]` + `shadow-2xl` + `text-sm uppercase tracking-[0.28em]` eyebrow — every anti-pattern simultaneously.
- Failure 3: `OcrGuideCard` renders with `className="border-[var(--border-strong)] bg-[linear-gradient(180deg,...)]"` — inline gradient forbidden at every phase.
- Failure 4: Progress bar uses `bg-[var(--accent)]` — legacy alias, not semantic token.
- Failure 5: Job error section uses `border-red-500/30 bg-[rgba(239,68,68,0.08)]` — raw Tailwind color class and raw rgba inline.
- Failure 6: Status feedback renders as bare `<div className="text-sm text-green-400">` and `text-red-400` — raw Tailwind color classes; should use `SuccessBanner` / `MutationErrorBanner` feedback primitives.
- Failure 7: Job status/progress KPI values (Status: N / Progress: N%) use `rounded-2xl border bg-[var(--card-strong)]` custom containers — factory-ocr pattern, not token-compliant surfaces.

---

## 2. WORKSPACE CLASSIFICATION

| Dimension | Classification | Rationale |
|---|---|---|
| Workspace Type | Entity Detail | TYPE 5 — single job entity with status, progress, metadata, and actions. |
| Workflow Category | Oversight | Operator monitors job progress; acts on completion or failure. |
| Operational Behavior | Realtime | 3s poll while job is active (queued/running/canceling). Static when terminal (succeeded/failed/canceled). |
| Data Density | LOW | One job: status, progress %, message, timestamps, 2–6 metadata rows, error (conditional). |
| Realtime Complexity | HIGH | 3-second polling interval while active — fastest poll in the system after /attendance/live. |
| AI Complexity | NONE | No AI on the job status workspace itself — AI was consumed upstream during the extraction. |
| Audit Complexity | NONE | Read-only except for cancel/retry actions. No audit trail surfaced here. |
| Decision Pressure | MEDIUM | Operator waits for job completion. If job fails, quick retry decision is needed. |

**Classification Implication:** LOW data density + HIGH realtime = a workspace that must be maximally simple. A single focused job status card with a live progress bar, a status badge, and conditional action buttons. Nothing else. The full OCR admin workspace (job start form, runtime cards, template manager) belongs on a separate admin route — not embedded at the per-job URL. The [jobId] route must be surgically simplified.

---

## 3. BACKEND OPERATIONAL MAPPING

### 3.1 API Surface

| Endpoint | Method | Purpose | Permission | Key Response Fields | Error States |
|---|---|---|---|---|---|
| `GET /ocr/jobs/{jobId}` | GET | Fetch current state of a specific OCR job | Any auth | `OcrJobPayload` | 404 (job not found or expired after server restart), 403 |
| `POST /jobs/{jobId}/cancel` | POST | Cancel a running/queued job | Any auth (job owner) | `JobRecord` (updated) | 400 (not cancelable), 404 |
| `POST /jobs/{jobId}/retry` | POST | Retry a failed/canceled job | Any auth (job owner) | `JobRecord` (updated) | 400 (not retryable), 404 |
| `GET /ocr/jobs/{jobId}/download` | GET | Download the completed job result file | Any auth | Binary blob + filename | 404 (no file), 400 (job not succeeded) |

**Critical backend note:** Jobs are stored in-memory in the background job system (`background_jobs.py`). After a server restart, all job IDs are lost — `GET /ocr/jobs/{jobId}` returns 404. The frontend must handle 404 gracefully as "job expired / not found" rather than as an error state requiring user action.

### 3.2 Entity Relationship Map

```
OcrJobPayload (from GET /ocr/jobs/{jobId})
  ├── job_id: string
  ├── kind: "ocr_ledger_excel" | "ocr_table_excel"
  ├── status: "queued" | "running" | "canceling" | "succeeded" | "failed" | "canceled"
  ├── progress: number (0–100)
  ├── message: string (human-readable stage description)
  ├── created_at: string, updated_at: string
  ├── error?: string | null (only when status = "failed")
  ├── can_cancel?: boolean (true when queued/running)
  ├── can_retry?: boolean (true when failed/canceled)
  ├── context?: { mode, source_filename, route }
  └── result?: {
        metadata?: { total_rows, total_columns, total_dr, total_cr, balanced }
        file?: { filename, media_type, size_bytes }
      }
```

**Primary entity:** `OcrJobPayload` — single job record.
**Relationship implication for UI:** Everything in this workspace derives from one API call. No secondary fetches. The `result.metadata` drives the metadata facts grid. `result.file` enables the download button.

### 3.3 Workflow State Machine

```
[queued]    ──[processing begins]──► [running]
[running]   ──[completes]──────────► [succeeded]
[running]   ──[error occurs]────────► [failed]
[running]   ──[cancel requested]────► [canceling]
[canceling] ──[cancel confirmed]────► [canceled]
[failed]    ──[retry action]─────────► [queued] (new run)
[canceled]  ──[retry action]─────────► [queued] (new run)
```

**Frontend implication per status:**
- `queued` / `running` / `canceling`: 3s poll active. Progress bar animates based on `progress` value. Cancel button visible (`can_cancel=true`).
- `succeeded`: Poll stops. Download button renders if `result.file` exists. Metadata facts visible.
- `failed`: Poll stops. Error message block visible. Retry button renders (`can_retry=true`).
- `canceled`: Poll stops. Retry button renders. "Job canceled" status message.

### 3.4 Realtime Contracts

| System | Transport | Update Rate | Zones Affected | Stale State Handling |
|---|---|---|---|---|
| `setInterval` polling | HTTP (GET /ocr/jobs/{jobId}) | 3000ms | Full job state | If fetch fails: retain last state, show error banner. Stop polling if 3 consecutive failures. |
| Status-driven poll stop | Client logic | On status change | Interval cleared | N/A — once terminal status reached, interval is cleared via useEffect cleanup |

### 3.5 AI System Contracts

None on this workspace. AI was consumed during the extraction phase upstream.

### 3.6 Permission Matrix

| Role | View job | Cancel job | Retry job | Download result |
|---|---|---|---|---|
| attendance | ✗ (role gate) | ✗ | ✗ | ✗ |
| accountant | ✗ (role gate) | ✗ | ✗ | ✗ |
| operator | ✓ | ✓ (own jobs) | ✓ (own jobs) | ✓ |
| supervisor | ✓ | ✓ | ✓ | ✓ |
| manager | ✓ | ✓ | ✓ | ✓ |
| admin | ✓ | ✓ | ✓ | ✓ |
| owner | ✓ | ✓ | ✓ | ✓ |

**Permission implication:** `canUseOcrWorkspace` gates the workspace. Role-gate screen for blocked roles. Cancel/retry actions are available to any role that can view the job — the backend enforces job ownership separately.

---

## 4. WORKSPACE STRUCTURAL ANATOMY

### 4.1 Layout Pattern

**FULL-WIDTH COMMAND**

Single focused job status card, centered, max-w-2xl. No rails, no sidebars, no secondary sections. The workspace exists for one purpose: show the state of one job.

**Pattern selection justification:** ONE entity + LOW data density = maximum reduction. The current `OcrPage` renders a full admin workspace alongside the job status. This is a structural mismatch — the [jobId] URL implies a detail view of one record, not a multi-section admin tool. The spec creates a purpose-built job detail layout. The job start form, template manager, and runtime status belong on an admin/settings page, not here.

**Structural reduction note:**
- OCR job start form (mode select + file input + "Run OCR Queue") eliminated from this route.
- OCR runtime status cards (3 cards: Runtime / Languages / Template Access) eliminated.
- Template manager (existing templates list) eliminated.
- Template creation form eliminated.
- OcrGuideCard eliminated.
- Header section with marketing copy, uppercase eyebrow, backdrop-blur, rgba bg eliminated.
- All of the above belong on a future `/ocr/admin` or `/settings` route — not on the per-job URL.
- What remains: job status card (progress, metadata, actions) + status/error banner.

---

### 4.2 Zone Definitions

---

#### ZONE: Workspace Header Bar (Top, Sticky)

| Property | Value |
|---|---|
| Operational Role | Workspace title + job kind label + navigation back to OCR history. |
| Attention Priority | 3 |
| Position | Top — full-width |
| Width | full-width |
| Height | fixed: 48px |
| Sticky Behavior | always sticky |
| Collapse Behavior | never |
| Scroll Behavior | sticky |
| Density Mode | compact |
| Existence Justification | `OcrJobPayload.job_id` + `OcrJobPayload.kind` — operator must know which job they are viewing and have a path back to the history list. |

**Contents:**
- Workspace title: "Job status" — 16px / weight 500 / sentence case
- Job kind label: "Ledger OCR" or "Table scan" — derived from `job.kind` — 13px / text-secondary
- "OCR history" back link: ghost text link — navigates to `/ocr/history`
- Poll indicator: small "Updating" badge (processing token, static) when `isFetching=true` and job is active status

**Acceptance Criteria:**
- [ ] Header 48px, always sticky
- [ ] Job kind label renders in sentence case, text-secondary
- [ ] "OCR history" back link always visible
- [ ] Poll indicator is static — no animation, no pulse

---

#### ZONE: Job Status Card (Primary)

| Property | Value |
|---|---|
| Operational Role | The complete job detail: status badge, progress bar, phase message, timestamps, result metadata, error detail, and action buttons. Everything the operator needs to understand the job and act on it. |
| Attention Priority | 1 |
| Position | Below Workspace Header Bar — centered, max-w-2xl |
| Width | max-w-2xl centered / full-width below 672px |
| Height | content-driven |
| Sticky Behavior | not sticky |
| Collapse Behavior | never |
| Scroll Behavior | inherits shell |
| Density Mode | default — single-record detail; comfortable reading |
| Existence Justification | `OcrJobPayload` — all fields of the job entity are displayed here. |

**Contents:**
- Status badge: `StatusBadge` — "Queued" (warning) / "Running" (processing) / "Canceling" (warning) / "Succeeded" (success) / "Failed" (danger) / "Canceled" (secondary). Sentence case.
- Progress bar: 8px height bar from `var(--status-processing-bg)` (track) to `var(--status-processing-icon)` (fill). Renders only when status is queued/running/canceling. Fills to `job.progress` percent. Static element — transitions via CSS width, not animation.
- Phase message: `job.message` — 13px / weight 400 / text-secondary. The human-readable stage description ("Extracting table rows…").
- Timestamps row: Created: [JetBrains Mono] / Updated: [JetBrains Mono]
- Source file context: `job.context?.source_filename` if present — 12px / text-secondary
- Metadata facts grid (conditional — renders when `job.result?.metadata` exists and status = succeeded):
  - For `ocr_ledger_excel`: Rows, Dr Total, Cr Total, Difference, Balanced (Yes/No), Low confidence rows
  - For `ocr_table_excel`: Rows, Columns
  - 2-column key:value grid, same FactsGrid component as other detail panels
- Error block (conditional — renders when `job.error` is non-null):
  - `MutationErrorBanner` with `job.error` message — token surface (danger), not raw rgba/Tailwind red
- Action buttons:
  - Download result: primary — renders when `status = "succeeded"` AND `result.file` exists
  - Cancel job: secondary/outline — renders when `can_cancel = true` (status = queued/running)
  - Retry job: secondary/outline — renders when `can_retry = true` (status = failed/canceled)
  - "Open in history": ghost link button — always present when job_id is set

**Acceptance Criteria:**
- [ ] Status badge uses sentence-case labels — no uppercase
- [ ] Progress bar uses token variables only — no `bg-[var(--accent)]`, no raw rgba
- [ ] Error block uses `MutationErrorBanner` — no `text-red-400` or `border-red-500/30`
- [ ] Metadata facts grid uses existing FactsGrid component — not raw card divs
- [ ] Status badge is static — no pulse, no glow
- [ ] Download button only renders when `result.file` exists
- [ ] Cancel / Retry buttons are conditionally rendered based on `can_cancel` / `can_retry` flags
- [ ] Timestamps use JetBrains Mono

---

#### ZONE: Not Found / Expired State (Conditional)

| Property | Value |
|---|---|
| Operational Role | Handles the 404 case — job expired after server restart or invalid jobId. |
| Attention Priority | 1 (when visible) |
| Position | Replaces Job Status Card when job is null and not loading |
| Width | max-w-2xl centered |
| Height | content-driven |
| Sticky Behavior | not sticky |
| Collapse Behavior | N/A |
| Scroll Behavior | inherits shell |
| Density Mode | default |
| Existence Justification | `OcrJobPayload` = null after 404 — backend jobs are in-memory; server restarts expire all job IDs. Operator must know this is expected behavior. |

**Contents:**
- Title: "Job not found"
- Body: "This job may have expired. Background jobs do not survive server restarts." — sentence case, plain text
- "OCR history" link button — navigates to `/ocr/history`

**Acceptance Criteria:**
- [ ] Not Found state renders when `isError=true` OR `job=null` AND loading is complete
- [ ] Uses `EmptyState` component — no raw Card/CardContent
- [ ] Body text explains the server-restart expiry behavior
- [ ] "OCR history" link always present

---

### 4.3 Zone Interaction Rules

```yaml
zone_interactions:
  - trigger: job.status in ["queued", "running", "canceling"] on mount or poll
    effect: 3s interval active; progress bar width updates; phase message updates; status badge updates
    reason: Live job tracking

  - trigger: job.status transitions to terminal ("succeeded", "failed", "canceled")
    effect: Interval cleared; polling stops; action buttons update (Download / Retry as appropriate)
    reason: No need to poll once terminal status reached

  - trigger: "Cancel job" button clicked
    effect: cancelJob(job.job_id) called; busy=true; status badge → "Canceling"; poll continues until canceled
    reason: Cancel is asynchronous — canceling state persists until confirmed

  - trigger: "Retry job" button clicked
    effect: retryJob(job.job_id) called; job resets to queued state; poll resumes
    reason: Retry creates a new run in the same job record

  - trigger: "Download result" button clicked
    effect: downloadOcrJob(job.job_id) called; downloadBusy=true; triggerBlobDownload on completion
    reason: Result file available after succeeded status

  - trigger: GET /ocr/jobs/{jobId} returns 404
    effect: Not Found state renders; interval cleared
    reason: Job expired or invalid jobId
```

---

## 5. OPERATIONAL ATTENTION HIERARCHY

### 5.1 Scan Flow

```
LEVEL 1 (0–200ms): Status badge + progress bar
  — "Running" (processing token) + animated progress bar = job is in progress.
  — "Succeeded" (success token) + Download button = job is done, ready to retrieve.
  — "Failed" (danger token) + Retry button = job needs intervention.

LEVEL 2 (200ms–1s): Phase message + progress percentage
  — "Extracting table rows (47%)" tells the operator exactly where in the pipeline they are.

LEVEL 3 (1s–3s): Timestamps + source file context
  — Created/updated times confirm the job is for the right document.

LEVEL 4 (3s+): Metadata facts (on success) + error message (on failure)
  — Row count and column count confirm the extraction scope.
  — Error text explains why the job failed.
```

### 5.2 Persistent Visibility Requirements

| Element | Reason It Must Persist |
|---|---|
| Status badge | Operator must always see current job state without scrolling |
| Progress bar (when active) | Visual confirmation that processing is continuing |
| Action buttons | Download/Cancel/Retry must be immediately accessible |

### 5.3 Contextual Visibility Rules

```yaml
contextual_rules:
  - condition: status in ["queued", "running", "canceling"]
    shows: Progress bar + Cancel button (if can_cancel=true)
    hides: Download button, Retry button, metadata facts

  - condition: status = "succeeded" AND result.file exists
    shows: Download button + metadata facts
    hides: Progress bar, Cancel button, Retry button, error block

  - condition: status = "failed" AND job.error non-null
    shows: MutationErrorBanner (error message) + Retry button
    hides: Progress bar, Cancel button, Download button

  - condition: status = "canceled"
    shows: Retry button
    hides: Progress bar, Cancel button, Download button, error block

  - condition: isFetching = true AND status is active
    shows: "Updating" poll badge in header (static, processing token)
    hides: nothing (additive)

  - condition: job = null AND !isLoading
    shows: Not Found state
    hides: Job Status Card
```

---

## 6. TABLE & DATA STRATEGY

No tables — single entity detail workspace. Metadata facts use a 2-column key:value grid (FactsGrid), not a columnar table.

---

## 7. FORM & INPUT STRATEGY

No forms — this is a read/action workspace. The only inputs are the three action buttons (Cancel, Retry, Download). See Section 4.2 action button specifications.

---

## 8. AI & AUDIT VISIBILITY STRATEGY

### 8.1 AI Placement Map

None. No AI on this workspace.

### 8.2 Audit Visibility Map

```yaml
audit:
  placement: Not surfaced — job status changes are system-driven, not user-audited
  events_logged: none visible on this workspace
```

### 8.3 Anomaly Visibility

```yaml
anomaly:
  detection_source: rule-based (status = "failed" is the only anomaly signal)
  placement: Job Status Card — MutationErrorBanner renders when job.error is non-null
  severity_levels:
    - failed: danger token — MutationErrorBanner with job.error message
  dismissible: no — cleared when operator retries the job
  persistence: until retry is triggered
```

---

## 9. DENSITY, SPACING & LAYOUT RHYTHM

### 9.1 Density Mode

```yaml
density:
  default: default — single-record reading workspace; comfortable spacing
  operator_switchable: no
```

### 9.2 Spacing Rhythm

```yaml
spacing:
  above_card: 24px — workspace header to card
  card_padding: 24px — internal card padding
  section_gap: 16px — between card sections (status / progress / timestamps / metadata)
  sticky_header_height: 48px
  progress_bar_height: 8px
```

### 9.3 Typography Specification

```yaml
typography:
  workspace_title: 16px / weight 500 / Inter UI / sentence case — "Job status"
  job_kind_label: 13px / weight 400 / Inter UI / text-secondary / sentence case
  status_badge: 11px / weight 600 / Inter UI / sentence case
  phase_message: 13px / weight 400 / Inter UI / text-secondary
  fact_label: 12px / weight 500 / Inter UI / sentence case
  fact_value: 13px / weight 400 / Inter UI
  timestamp: 12px / JetBrains Mono
  source_filename: 12px / weight 400 / Inter UI / text-secondary
  error_message: 12px / weight 400 / Inter UI (via MutationErrorBanner)
```

### 9.4 Surface Token Hierarchy

```yaml
surfaces:
  workspace_background: var(--surface-app)
  job_status_card: var(--surface-card)
  progress_track: var(--status-processing-bg)
  progress_fill: var(--status-processing-icon)
  metadata_facts: var(--surface-shell)
  sticky_header: var(--surface-shell)
```

---

## 10. RESPONSIVE & OPERATOR ADAPTATION

### 10.1 Desktop Workstation

```yaml
desktop_workstation:
  min_width: 1280px
  layout: max-w-2xl centered card — narrow focus on single entity
  density_mode: default
```

### 10.2 Compact Desktop

```yaml
compact_desktop:
  width_range: 1024px–1279px
  adaptations: none needed — max-w-2xl card works at all desktop widths
```

### 10.3 Mobile / Tablet

```yaml
mobile:
  width_range: <768px
  strategy: full-width card, all content stacked
  touch_targets: 44px minimum for action buttons
```

### 10.4 Rail Collapse Behavior

```yaml
rail_collapse:
  N/A — no rails on this workspace
```

---

## 11. COMPONENT MAPPING

```yaml
component_mapping:
  workspace_container:
    component: WorkstationShell (max-w-2xl centered content)
    reason: Standard AppShell integration

  zones:
    - zone: Workspace Header Bar
      component: StickyTopbar / WorkspaceHeaderBar (48px)
      props_required: title "Job status", jobKindLabel, onBack (→ /ocr/history), isFetching

    - zone: Job Status Card
      component: SectionPanel or surface-card div (24px padding)
      props_required: job (OcrJobPayload), onCancel, onRetry, onDownload, busy, downloadBusy

    - zone: Not Found State
      component: EmptyState (existing — already used in role-gate screens)
      props_required: title "Job not found", description (server-restart explanation), action (OCR history link)

  status_elements:
    - element: Status badge
      component: StatusBadge
      semantic_variants:
        queued: warning
        running: processing
        canceling: warning
        succeeded: success
        failed: danger
        canceled: secondary
      static: true

    - element: Poll indicator ("Updating")
      component: StatusBadge (processing token, inline in header)
      static: true  # No animation even during active polling

  progress_bar:
    component: ProgressBar primitive (or inline div pattern)
    props: value=job.progress (0–100), track=var(--status-processing-bg), fill=var(--status-processing-icon)
    visible_when: status in [queued, running, canceling]
    note: CSS width transition only — no animation library. Not a pulsing skeleton.

  metadata_facts:
    component: FactsGrid (same 2-col key:value primitive from /approvals and /attendance/review detail panels)
    props_required: facts: Array<{label, value}>
    visible_when: status = "succeeded" AND result.metadata exists

  error_display:
    component: MutationErrorBanner (existing feedback primitive)
    replaces: raw `<div className="bg-[rgba(239,68,68,0.08)]">` — not token-compliant
    visible_when: status = "failed" AND job.error is non-null

  action_elements:
    - element: Download result
      component: Button (primary)
      visible_when: status = "succeeded" AND result.file exists
      disabled_when: downloadBusy = true

    - element: Cancel job
      component: Button (outline)
      visible_when: can_cancel = true
      disabled_when: busy = true

    - element: Retry job
      component: Button (outline)
      visible_when: can_retry = true
      disabled_when: busy = true

    - element: Open in history
      component: Link + Button (ghost)
      visible_when: always (when job is loaded)

  feedback:
    - component: MutationErrorBanner (replace raw text-red-400 div)
    - component: SuccessBanner (replace raw text-green-400 div)

Missing components: None. All requirements covered by existing primitives.
```

---

## 12. OPERATIONAL PROBLEMS SOLVED

```yaml
problem_resolutions:
  - problem: OcrPage renders job start form, runtime cards, template manager alongside job status on /ocr/jobs/[jobId].
    root_cause: The [jobId] route used OcrPage as a convenience — the full OCR admin workspace was already built.
    structural_solution: /ocr/jobs/[jobId] renders a purpose-built OcrJobStatusPage (new component) that only shows one job entity. The job start form, runtime cards, template manager, and OcrGuideCard are not rendered here. They belong on an admin/settings route.
    section_reference: Section 4.1, Section 4.2
    measurable_outcome: Operator arriving at /ocr/jobs/[jobId] sees exactly the job status for that job ID. Zero unrelated sections.

  - problem: Header section with backdrop-blur + bg-[rgba(20,24,36,0.88)] + uppercase tracking-[0.28em] + shadow-2xl.
    root_cause: Same OcrPage legacy header applied globally.
    structural_solution: Header eliminated with the full OcrPage replacement. Workspace Header Bar (48px, token surfaces only) is the new chrome.
    section_reference: Section 4.2 (Workspace Header Bar)
    measurable_outcome: Zero backdrop-blur, zero rgba backgrounds, zero uppercase tracking.

  - problem: OcrGuideCard with inline gradient bg-[linear-gradient(180deg,...)].
    root_cause: Gradient applied directly to the component via className prop.
    structural_solution: OcrGuideCard eliminated from this route entirely. Not relevant to job status viewing.
    section_reference: Section 4.1
    measurable_outcome: Zero gradient values in the workspace.

  - problem: Progress bar uses bg-[var(--accent)] — legacy alias.
    root_cause: Legacy --accent alias used instead of semantic processing token.
    structural_solution: Progress bar fill uses var(--status-processing-icon). Track uses var(--status-processing-bg). Section 9.4 and Section 11.
    section_reference: Section 9.4, Section 11
    measurable_outcome: Zero legacy alias usage. Progress bar responds to processing semantic token.

  - problem: Job error section uses border-red-500/30 + bg-[rgba(239,68,68,0.08)] — raw Tailwind color and rgba.
    root_cause: Error block authored inline without using the MutationErrorBanner primitive.
    structural_solution: MutationErrorBanner component used for all error display (Section 11 error_display).
    section_reference: Section 11, Section 4.2 (Job Status Card)
    measurable_outcome: Zero raw rgba or Tailwind color classes for error display.

  - problem: Status/success feedback as bare <div className="text-sm text-green-400"> / text-red-400.
    root_cause: Inline text divs used instead of feedback primitives.
    structural_solution: SuccessBanner and MutationErrorBanner used for all feedback (Section 11 feedback).
    section_reference: Section 11
    measurable_outcome: Zero raw color classes for feedback text.
```

---

## 13. IMPLEMENTATION HANDOFF

### 13.1 Build Sequence

```yaml
implementation_sequence:
  step_1: Create OcrJobStatusPage component (new file — replaces OcrPage for this route). WorkstationShell + 48px sticky header (title, job kind, back link). Job status card zone scaffold.

  step_2: Data fetching — useQuery for getOcrJob(jobId). 3s poll interval when status is active (stale-then-refetch or refetchInterval). Cleanup on terminal status. Handle 404 → Not Found EmptyState.

  step_3: Job Status Card — StatusBadge (6 variants, sentence case). Progress bar (token surfaces, CSS width). Phase message. Timestamps (JetBrains Mono). Source filename context.

  step_4: Metadata facts — FactsGrid rendered when status=succeeded and result.metadata exists. Ledger vs table metadata variant logic.

  step_5: Error block — MutationErrorBanner when job.error is non-null.

  step_6: Action buttons — Download (conditional on result.file). Cancel (conditional on can_cancel). Retry (conditional on can_retry). All with busy state handling.

  step_7: Poll indicator in header ("Updating" static badge during active fetches).

  step_8: Update /ocr/jobs/[jobId]/page.tsx to import and render OcrJobStatusPage instead of OcrPage. Pass jobId as prop.

  step_9: Responsive behavior — full-width card on mobile. 44px touch targets on action buttons.
```

### 13.2 Critical Constraints

```yaml
critical_constraints:
  - OcrPage must NOT render on this route — purpose-built OcrJobStatusPage replaces it: reason: structural mismatch — per-job URL must show per-job detail only
  - Zero backdrop-blur, zero rgba backgrounds, zero gradient values: reason: blueprint law
  - Progress bar uses token variables only (--status-processing-*): reason: no legacy --accent alias
  - Error display uses MutationErrorBanner: reason: existing feedback primitive compliance
  - Status badge is static — no animation: reason: blueprint law
  - Poll indicator is static — no animation: reason: blueprint law (even updating indicators must not pulse)
  - 404 is handled gracefully as "job expired" — not as a system error: reason: backend in-memory jobs expire on restart; operator must understand this
  - Do not modify AppShell scroll architecture: reason: AppShell doctrine
```

### 13.3 Open Questions

```yaml
open_questions:
  - question: The OcrPage component serves both the job status view and the legacy OCR admin workspace. When this route switches to OcrJobStatusPage, the legacy job start form and template manager lose their home. Should these be moved to /settings/ocr or /ocr/admin, or retired in favor of the newer /ocr/scan workflow?
    blocking: no — can proceed with OcrJobStatusPage for /ocr/jobs/[jobId]. The legacy admin workspace is a separate migration decision.
    owner: product owner
    decision_needed_by: before step 8 in 13.1

  - question: Should the poll stop after N consecutive 404s (server restart) or on the first 404? Current proposed behavior is stop on first 404 and show not-found state.
    blocking: no — stop on first 404 is the correct UX behavior
    owner: frontend team
    decision_needed_by: before step 2 in 13.1
```

---

## ACCEPTANCE CRITERIA (SPEC COMPLETENESS)

- [x] All 13 sections fully populated — no empty fields, no placeholders
- [x] Every layout zone has a documented existence justification tied to a backend entity or operator need
- [x] Every layout zone has explicit, testable acceptance criteria
- [x] Every component mapped to existing primitives — StatusBadge, FactsGrid, MutationErrorBanner, SuccessBanner, EmptyState, Button all existing
- [x] Every operational failure from Section 1.3 has a resolution in Section 12
- [x] Reduction audit completed — OcrPage full admin workspace, backdrop-blur header, OcrGuideCard gradient, raw color classes all eliminated
- [x] No anti-patterns (no gradients, no glow, no pulse, no UPPERCASE, no rgba, no --accent alias)
- [x] All spacing values follow 4px scale
- [x] All surfaces reference token variables only
- [x] Typography follows approved system — JetBrains Mono on timestamps, sentence case on status badge
- [x] Backend API endpoints verified (getOcrJob, cancelJob, retryJob, downloadOcrJob confirmed in lib/ocr.ts + lib/jobs.ts)
- [x] Permission matrix complete (canUseOcrWorkspace gate)
- [x] Open questions populated (2 questions, 0 blocking)
- [x] AI elements: N/A
- [x] Implementation handoff sequence complete and ordered (9 steps)

---

## POST-GENERATION VALIDATION

```yaml
self_validation:
  operational_integrity:
    - [x] Every zone traces to a specific backend entity or API endpoint
    - [x] Every zone justified by specific operator need
    - [x] No visual-composition-only zones (OcrGuideCard, runtime cards, template manager eliminated)
    - [x] Reduction audit complete — 6 structural reductions in Section 12

  law_compliance:
    - [x] All spacing follows 4px base scale
    - [x] All surfaces use CSS token variables — no rgba, no Tailwind color classes
    - [x] All text labels sentence case — uppercase tracking-[0.28em] eyebrow eliminated
    - [x] Progress bar uses --status-processing-* not --accent alias
    - [x] No AI elements — N/A

  kiro_readiness:
    - [x] Kiro can produce working code without clarifying questions
    - [x] All acceptance criteria are testable
    - [x] Build sequence complete (9 steps)
    - [x] No blocking open questions

  anti_pattern_check:
    - [x] No gradients (OcrGuideCard gradient eliminated)
    - [x] No glow or pulse (StatusBadge static, poll indicator static)
    - [x] No UPPERCASE labels
    - [x] No backdrop-blur on non-overlay
    - [x] No raw rgba inline
    - [x] No legacy --accent alias usage
    - [x] No OcrPage admin workspace on per-job URL

  structural_integrity:
    - [x] Zone interactions cover all status transitions and action triggers
    - [x] Permission matrix complete
    - [x] Responsive defined (max-w-2xl card pattern)
    - [x] All Section 12 resolutions reference specific spec sections
```

---

## 4A. VISUAL STRUCTURAL HIERARCHY BLUEPRINT

### A. Desktop Structural Blueprint (1440px)

```
┌──────────────────────────────────────────────────────────────────────────────┐
│  APPSHELL TOPBAR                                                              │
├──────────────────────────────────────────────────────────────────────────────┤
│  WORKSPACE HEADER BAR [sticky, 48px]                                         │
│  Job status  │  Table scan  │  ← OCR history         │  ● Updating (cond.)  │
├──────────────────────────────────────────────────────────────────────────────┤
│                                                                               │
│       ┌──────────────────────────────────────────────────────────┐           │
│       │  JOB STATUS CARD [P:1] — max-w-2xl centered             │           │
│       │  ────────────────────────────────────────────────────── │           │
│       │                                                           │           │
│       │  ● Running  [processing badge]                           │           │
│       │                                                           │           │
│       │  ████████████████████░░░░░░░░░░  64%                    │           │
│       │  [progress bar — var(--status-processing-icon) fill]     │           │
│       │                                                           │           │
│       │  Extracting table rows and building Excel sheet…         │           │
│       │                                                           │           │
│       │  Created    03 Jun 2026 14:18  ← JetBrains Mono         │           │
│       │  Updated    03 Jun 2026 14:19  ← JetBrains Mono         │           │
│       │  Source     shift_report_03jun.jpg                       │           │
│       │                                                           │           │
│       │  [Cancel job]  [Open in history]                         │           │
│       │                                                           │           │
│       │  ──── (on succeeded) ────────────────────────────────── │           │
│       │  Rows      47         Columns    8                       │           │
│       │  FactsGrid 2-col key:value                               │           │
│       │  [Download Excel result ●]  [Open in history]            │           │
│       │                                                           │           │
│       │  ──── (on failed) ──────────────────────────────────── │           │
│       │  ┌─────────────────────────────────────────────────┐   │           │
│       │  │  MutationErrorBanner: "No table found in image" │   │           │
│       │  └─────────────────────────────────────────────────┘   │           │
│       │  [Retry job]  [Open in history]                          │           │
│       │                                                           │           │
│       └──────────────────────────────────────────────────────────┘           │
│                                                                               │
└──────────────────────────────────────────────────────────────────────────────┘
```

### B. Visual Attention Flow Map

```
Scan 1 (0–200ms): Status badge + progress bar
  — "Running" processing token + filled bar = job in progress. No action needed.
  — "Succeeded" success token + Download button = done. Action: Download.
  — "Failed" danger token + error message = problem. Action: Retry.

Scan 2 (200ms–1s): Phase message + progress percentage
  — Confirms the extraction stage. "64%" tells operator roughly when to expect completion.

Scan 3 (1s–3s): Timestamps + source filename
  — Confirms this is the right job for the right document.

Scan 4 (3s+): Metadata facts (rows/columns on success) or error message details (on failure)
```

### C. Spacing & Rhythm Visualization

```
BREATHABLE (single focused card):
  Card padding: 24px all sides
  Between status badge and progress bar: 16px
  Between progress bar and phase message: 8px
  Between phase message and timestamps: 16px
  Between timestamps and action buttons: 24px
  Progress bar height: 8px — subtle but legible
```

### D. Component Nesting Hierarchy

```
WorkstationShell ("Job status")
  ├── WorkspaceHeaderBar [sticky, 48px]
  │     ├── WorkspaceTitle ("Job status")
  │     ├── JobKindLabel (sentence case, text-secondary)
  │     ├── BackLink (← OCR history)
  │     └── [Conditional] StatusBadge ("Updating", processing, static)
  │
  ├── [Conditional: !job && !isLoading] EmptyState (not found)
  │     └── Link → /ocr/history
  │
  └── [Conditional: job] SectionPanel (Job Status Card, max-w-2xl)
        ├── StatusBadge (6-variant semantic map, static)
        ├── [Active status] ProgressBar (token surfaces)
        ├── PhaseMessage (13px/400/text-secondary)
        ├── TimestampsRow (JetBrains Mono)
        ├── SourceFilename (12px/400/text-secondary, conditional)
        ├── [Succeeded] FactsGrid (metadata)
        ├── [Failed] MutationErrorBanner (job.error)
        └── ActionGroup
              ├── [Succeeded + file] Button (Download — primary)
              ├── [can_cancel] Button (Cancel — outline)
              ├── [can_retry] Button (Retry — outline)
              └── Link + Button (Open in history — ghost)
```

### E. Responsive Collapse Blueprint

```
1440px+ (desktop):
┌──────────────────────────────────────────────────────────────┐
│  HEADER BAR [48px sticky]                                     │
│  JOB STATUS CARD [max-w-2xl centered, 24px padding]          │
└──────────────────────────────────────────────────────────────┘

<768px (mobile — full-width card):
┌─────────────────────────────────────┐
│  HEADER BAR [48px]                   │
│  JOB STATUS CARD [full-width]        │
│  Status + progress + actions         │
└─────────────────────────────────────┘
Touch targets: 44px minimum on action buttons.
```

### F. Structural Consistency Validation

```yaml
structural_validation:
  - [x] All zones justified (OcrPage admin sections eliminated)
  - [x] Visual dominance: Job Status Card P:1, header P:3
  - [x] Spacing rhythm: default density, 24px card padding, 4px base scale
  - [x] Responsive: max-w-2xl card works at all viewport widths
  - [x] Component nesting matches Section 11
  - [x] No over-zoning — 2 zones (header + status card)
  - [x] No admin workspace sections on per-job URL
  - [x] Blueprint matches FULL-WIDTH COMMAND pattern declared in Section 4.1
```

---

## KIRO TASK CHAINING

```yaml
downstream_tasks:
  task_1:
    name: "OCR Jobs — New OcrJobStatusPage Component"
    source: Section 4.1, Section 4.2
    output: New OcrJobStatusPage component. WorkstationShell + header bar + job status card scaffold. Remove OcrPage from this route.

  task_2:
    name: "OCR Jobs — Data Fetching + Poll"
    source: Section 3.1, Section 3.4
    output: useQuery(getOcrJob, { refetchInterval: 3000 when active }). 404 handling → EmptyState. Terminal status clears interval.

  task_3:
    name: "OCR Jobs — Status Card Content"
    source: Section 4.2 (Job Status Card), Section 9
    output: StatusBadge (6 variants, static). ProgressBar (token surfaces, CSS width). PhaseMessage. Timestamps (JetBrains Mono). SourceFilename.

  task_4:
    name: "OCR Jobs — Conditional Content"
    source: Section 4.2, Section 5.3
    output: FactsGrid on succeeded. MutationErrorBanner on failed. Download/Cancel/Retry/History buttons with busy state and conditional rendering.

  task_5:
    name: "OCR Jobs — Route Update"
    source: Section 13.1 step 8
    output: Update /ocr/jobs/[jobId]/page.tsx to import OcrJobStatusPage instead of OcrPage.
```

---

*Status: COMPLETE — all 13 sections populated, all acceptance criteria met, post-generation validation passed.*
*Phase C progress: 7/8 complete — /approvals ✓ /attendance/live ✓ /attendance/review ✓ /attendance/reports ✓ /ocr/scan ✓ /ocr/history ✓ /ocr/jobs/[jobId] ✓*
*Next: /ocr/verify — Phase C, Item 8. Final Phase C workspace.*
