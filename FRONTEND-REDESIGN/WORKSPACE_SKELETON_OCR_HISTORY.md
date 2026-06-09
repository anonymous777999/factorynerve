# OCR History — Workspace Skeleton Architecture
# FactoryNerve OS | Phase 3 Skeleton Specification | Phase C, Item 6
# Route: /ocr/history
# Generated: 2026-06-03
# Status: DRAFT

---

## 1. WORKSPACE OVERVIEW

### 1.1 Identity

| Field | Value |
|---|---|
| Route | `/ocr/history` |
| Workspace Name | OCR History — Document Verification Archive |
| Operational Role | Lists all `OcrVerification` records for the factory, filterable by status, confidence tier, export state, document type, reviewer, and date range. Operators check the status of documents they submitted. Supervisors and managers audit export quality and pending reviews. Row selection shows a detail panel with confidence meter and audit event timeline. |
| Business Impact | If this workspace fails, operators cannot verify whether their submitted documents were approved or rejected. Managers cannot audit which documents have export failures or low-confidence issues. The history workspace is the accountability surface for the OCR pipeline — it shows what was processed, by whom, with what outcome. |
| User Population | Operator (checks their own submitted documents). Supervisor and manager (audits factory-wide OCR quality). Admin and owner (full archive access). The `canUseOcrScan` flag gates access. |
| Peak Usage Context | After batch scanning sessions — operators verify their submissions were accepted. End of day/week — managers audit export failures and pending reviews. |
| Predecessor Workspaces | `/ocr/scan` (after submitting a draft, operator navigates here to check status) |
| Successor Workspaces | `/ocr/verify` (row "Open" action — navigates to verification workspace for the selected record) |

### 1.2 Operational Importance

The history workspace is the only place where operators and managers can see the complete picture of OCR documents: what was scanned, what was approved, what needs re-review, and what failed export. Without it, there is no visibility into the pipeline's health. The audit event timeline per record provides the evidentiary chain — who approved a document, when, and with what reviewer notes. This is essential for compliance tracing when a document's data enters downstream reporting.

### 1.3 Current State Failures

- Failure 1: Dual metric display — main content area has 4 `factory-ocr-data-card` stats (Documents tracked / Approved / Pending / Rejected) AND the sideContent has "Audit workspace" with 4 overlapping `factory-ocr-data-card` metrics (Records tracked / Low confidence / Export failures / Latest update). → Same information rendered twice in different vocabulary; one set must be eliminated.
- Failure 2: Filter section uses raw `<select>` and `<input>` elements with `className="input w-full"` — bypasses the system `Select` and `Input` component primitives.
- Failure 3: Filter container uses `rounded-[0.45rem]` — custom border-radius outside the token system's standard radius values.
- Failure 4: Table container uses inline `style={{ height: "calc(100vh - 500px)", minHeight: "400px" }}` — magic number viewport calculation that breaks when any zone above the table changes height.
- Failure 5: OcrShell subtitle "Reopen past runs, check their status, and download the latest export." — marketing copy, not operational guidance. Not useful to a daily-use operator.
- Failure 6: `factory-ocr-data-card` components in stats grid and side panel use the `factory-ocr-*` CSS system — not using token-compliant MetricStrip or system card patterns established in Phase C precedent.
- Failure 7: Side panel "Selected record" section shows `ConfidenceMeter` component — this is an AI-confidence display element that needs to be confirmed as static (no animation).

---

## 2. WORKSPACE CLASSIFICATION

| Dimension | Classification | Rationale |
|---|---|---|
| Workspace Type | Entity List | TYPE 4 — browse, filter, and act on a list of OcrVerification records. Detail panel on row selection. |
| Workflow Category | Record | Review historical OCR results; navigate to the verification workflow for specific records. |
| Operational Behavior | Data-Dense | Paginated/filtered list + confidence scores + audit timeline per selected record. |
| Data Density | HIGH | Multi-filter controls, 5-column table, side panel with confidence meter and audit events. |
| Realtime Complexity | NONE | Static list query. No polling. Filters drive backend refetches via React Query. |
| AI Complexity | LOW | Pre-computed confidence scores displayed as informational signals. No runtime AI calls. |
| Audit Complexity | MEDIUM | `OcrAuditEvent[]` per record — displayed in side panel when record is selected. |
| Decision Pressure | LOW | Browsing and status verification. No binary decisions required on this workspace. |

**Classification Implication:** ENTITY LIST + LOW decision pressure + NONE realtime = a workspace that inherits the left-rail + main pattern from prior Phase C workspaces — but the "left rail" in this case is actually a right-side detail panel (sideContent prop via OcrShell). The structural law is: filters are visible at all times above the table; the side panel provides per-record context without navigating away; the primary action (Open) navigates to the full verification workspace. The dual metric duplication must be resolved — one metric strip in the header, not two separate fact grids.

---

## 3. BACKEND OPERATIONAL MAPPING

### 3.1 API Surface

| Endpoint | Method | Purpose | Permission | Key Response Fields | Error States |
|---|---|---|---|---|---|
| `GET /ocr/verifications` | GET | Filtered list of OcrVerification records | Any auth (canUseOcr) | `OcrHistoryItem[]` (list variant) | 403, empty list |
| `GET /ocr/verifications/{id}` | GET | Full record detail including `audit_events[]` | Any auth | `OcrVerificationRecord` with `audit_events` | 404 |
| `POST /ocr/verifications/{id}/excel-export` | POST | Download XLSX export | Any auth | Binary file blob | 404, 500 |

**Filter query params accepted by `GET /ocr/verifications`:**
- `?search=` — filename, doc_type_hint, status
- `?status=` — all / pending / approved / rejected / draft
- `?export_state=` — all / pending / exported / failed / json_generated
- `?document_type=` — derived from `doc_type_hint`
- `?reviewer_id=` — filter by reviewer user_id
- `?min_confidence=` / `?max_confidence=` — confidence tier bounds (0.0–1.0)
- `?updated_after=` / `?updated_before=` — date range filters

### 3.2 Entity Relationship Map

```
OcrHistoryItem (list variant — lightweight)
  ├── id, source_filename, doc_type_hint
  ├── status: draft | pending | approved | rejected
  ├── export_state: pending | exported | failed | json_generated
  ├── avg_confidence: number (0.0–1.0)
  ├── warnings: string[]
  ├── reviewed_by_name, approved_by_name, exported_by_name
  └── created_at, updated_at

OcrVerificationRecord (full detail — fetched on row selection)
  ├── all OcrHistoryItem fields
  ├── headers: string[], original_rows, reviewed_rows, cell_confidence
  ├── audit_events: OcrAuditEvent[]
  │     ├── id, event_type, actor, reviewer_notes, created_at
  └── rejection_reason, reviewer_notes, routing_meta
```

**Primary entity on this workspace:** `OcrHistoryItem[]` (list). `OcrVerificationRecord` (selected row detail — lazy-loaded).
**Relationship implication for UI:** The table renders `OcrHistoryItem[]` (lightweight). The detail panel fetches `OcrVerificationRecord` only when a row is selected (`useOcrVerifyDetailQuery(activeSelectedRecordId)`) — lazy loading audit_events on demand.

### 3.3 Workflow State Machine

```
[draft]    — created at scan, not yet submitted
[pending]  — submitted by operator, awaiting supervisor review
[approved] — supervisor approved in /ocr/verify
[rejected] — supervisor rejected

Export state:
[pending]          — not yet exported
[exported]         — XLSX downloaded successfully
[failed]           — export attempt failed
[json_generated]   — JSON export only
```

**Frontend implication per status:**
- `draft`: "Open" action navigates to `/ocr/verify?id={id}&step=3&pane=workspace` (review step)
- `pending`: "Open" navigates to `/ocr/verify?id={id}&step=4&pane=workspace` (approve/export step)
- `approved`/`rejected`: "Open" navigates to `/ocr/verify?id={id}&step=4&pane=workspace` (read-only)
- "Excel" action available for all statuses — downloads the current export

### 3.4 Realtime Contracts

No realtime on this workspace. Filters trigger React Query refetch via `useOcrHistoryQuery(filters)`. No polling interval. Data refreshes when filters change or user manually navigates away and back.

### 3.5 AI System Contracts

| AI System | Input | Output | Confidence | Latency | Fallback |
|---|---|---|---|---|---|
| Confidence display | `avg_confidence` (pre-computed) | Tier label + percentage | Displayed as integer percentage | 0ms — pre-computed | Show "—" if null |

`ConfidenceMeter` component in the side panel — static display, no animation, no runtime AI call.
`static_only: true` — no pulse, no glow, no animation.

### 3.6 Permission Matrix

| Role | View list | View detail | Download export | Open in verify |
|---|---|---|---|---|
| attendance | ✗ (role gate) | ✗ | ✗ | ✗ |
| operator | ✓ | ✓ | ✓ | ✓ |
| supervisor | ✓ | ✓ | ✓ | ✓ |
| manager | ✓ | ✓ | ✓ | ✓ |
| admin | ✓ | ✓ | ✓ | ✓ |
| owner | ✓ | ✓ | ✓ | ✓ |
| accountant | ✗ (role gate) | ✗ | ✗ | ✗ |

**Permission implication:** `canUseOcrScan` gates the workspace. Role-gate screen (using EmptyState primitive — already correct in current implementation) for blocked roles.
t e s t 
 
 
---

## 4. WORKSPACE STRUCTURAL ANATOMY

### 4.1 Layout Pattern

**LEFT-RAIL + MAIN** (Entity List variant � right detail panel)

The main zone carries the filter controls + table. The right rail (via OcrShell's sideContent prop) carries the selected-record detail panel and audit timeline. Split: [fill-remaining main] + [320px fixed right rail].

**Pattern selection justification:** The sideContent/right-rail pattern in OcrShell is structurally correct. Row selection drives detail without navigation. This is TYPE 4 entity list behaviour � list on the left, detail on the right. The pattern is retained. What changes: (1) dual metrics eliminated � one metric strip in the workspace header, not two fact grids; (2) filter section uses system Select/Input primitives; (3) table height calculation replaced with lex-grow fill pattern.

**Structural reduction note:**
- Main content 4-card stats grid (actory-ocr-data-card � 4) eliminated � counts moved to a compact metric strip in the workspace header bar.
- sideContent "Audit workspace" panel (Records tracked / Low confidence / Export failures / Latest update) eliminated � duplicates the header metric strip.
- OcrShell subtitle eliminated � marketing copy.
- Table style={{ height: calc(100vh - 500px) }} replaced with CSS flex fill pattern.
- Raw <select>/<input> filter elements replaced with system Select and Input primitives.

---

## 4. WORKSPACE STRUCTURAL ANATOMY

### 4.1 Layout Pattern

**LEFT-RAIL + MAIN** (List + Right-Detail variant)

Primary zone: filter bar + history table (fill-remaining width).
Secondary zone: selected record detail panel (fixed right rail, ~300px).

The current `OcrShell` renders a `sideContent` prop as a right panel. This pattern is structurally correct for an entity list workspace where row selection drives contextual detail. It is retained and governed.

**Pattern selection justification:** The operator's workflow is: filter list → identify record → read detail/audit → act (Open / Excel). The detail panel eliminates a navigation hop — the audit timeline, confidence score, and reviewer name are visible immediately on row click without leaving the table context. FULL-WIDTH COMMAND rejected — the side panel adds real operational value (audit events, confidence context). Two-pane is warranted.

**Structural reduction note:**
- "Audit workspace" section in the side panel (Records tracked / Low confidence / Export failures / Latest update) eliminated — it duplicates the metric strip in the header with different labels for the same data.
- OcrShell subtitle eliminated — no operational value.
- Raw `<select>`/`<input>` elements replaced with system Select/Input primitives.
- `factory-ocr-data-card` grid replaced with token-compliant MetricStrip in the workspace header.
- Inline `style={{ height: "calc(100vh - 500px)" }}` eliminated — table uses `flex-1 min-h-0` fill pattern within a flex container.
- `rounded-[0.45rem]` filter container replaced with standard `var(--surface-panel)` / `border-default`.

---

### 4.2 Zone Definitions

---

#### ZONE: Workspace Header Bar (Top, Sticky)

| Property | Value |
|---|---|
| Operational Role | Workspace title + compact metric strip (approved/pending/rejected/low-confidence counts) + navigation to /ocr/scan. |
| Attention Priority | 3 |
| Position | Top — spans full workspace width |
| Width | full-width |
| Height | fixed: 48px |
| Sticky Behavior | always sticky |
| Collapse Behavior | never |
| Scroll Behavior | sticky |
| Density Mode | compact |
| Existence Justification | `summary` derived counts — supervisor needs persistent queue health signal without scrolling. |

**Contents:**
- Workspace title: "OCR history" — 16px / weight 500 / sentence case. No subtitle.
- Compact metric strip (inline): Approved: N (success token) | Pending: N (warning token) | Rejected: N (danger token) | Low confidence: N (warning token, renders only when > 0)
- "New scan" link button: outline — navigates to `/ocr/scan`
- "Scan again" is the primary operator action from this workspace.

**Acceptance Criteria:**
- [ ] Header 48px, always sticky
- [ ] Metric counts use tabular-nums
- [ ] "Low confidence" count only renders when `auditTriage.lowConfidence > 0`
- [ ] No subtitle below the workspace title
- [ ] No factory-ocr-data-card elements in this zone — flat inline metric units only

---

#### ZONE: Filter Bar (Below Header)

| Property | Value |
|---|---|
| Operational Role | 7-field filter set controlling the table query: status, export state, document type, reviewer, confidence tier, date range from/to, and search. |
| Attention Priority | 2 |
| Position | Below Workspace Header Bar |
| Width | full-width |
| Height | content-driven — two compact rows (~80px) |
| Sticky Behavior | not sticky |
| Collapse Behavior | never — filters are the navigation mechanism |
| Scroll Behavior | inherits shell |
| Density Mode | compact |
| Existence Justification | `OcrVerificationListFilters` — 7 independent filter dimensions. Without persistent filters, operators cannot isolate pending documents or managers cannot find export failures. |

**Contents:**
- Row 1: Status select + Export state select + Document type select + Reviewer select
- Row 2: Confidence select + Updated after date + Updated before date + Reset filters button
- Search input: `DataTableToolbar` component (existing — renders inside the DataTable via `renderToolbar` prop)
- All selects use system `Select` primitive — not raw `<select className="input">`
- All date inputs use system `Input` primitive (type="date") — not raw `<input className="input">`

**Acceptance Criteria:**
- [ ] All 4 selects in Row 1 use system Select component
- [ ] Both date inputs use system Input component (type="date")
- [ ] Filter container uses `var(--surface-panel)` background and `var(--border-default)` border — no `rounded-[0.45rem]`
- [ ] Reset filters button clears all 7 filter fields to default values
- [ ] Search input is inside DataTableToolbar rendered within the DataTable — not duplicated outside

---

#### ZONE: History Table + Detail Panel (Main Split)

| Property | Value |
|---|---|
| Operational Role | Left: DataTable of OcrHistoryItem records. Right: selected record detail (confidence, audit events, actions). |
| Attention Priority | 1 |
| Position | Below Filter Bar — fills remaining viewport height |
| Width | full-width — internal split: table (~fill) + detail panel (300px fixed right) |
| Height | fill-remaining — `flex-1 min-h-0` flex pattern. No inline pixel heights. |
| Sticky Behavior | table column headers sticky within the table scroll area |
| Collapse Behavior | detail panel collapses when no record is selected (shows "Select a row" placeholder) |
| Scroll Behavior | table scrolls independently; detail panel scrolls independently |
| Density Mode | compact |
| Existence Justification | `OcrHistoryItem[]` + `OcrVerificationRecord` (on selection) — the table is the primary data surface; the detail panel provides audit context without navigation. |

**Contents — History Table (DataTable component):**
- 5 columns: Document (filename + confidence %) | Type (doc_type_hint) | Status (Badge) | Updated (timestamp) | Actions (Open + Excel)
- Left status stripe on Document column: color bar indicating status (exists in current implementation — keep)
- DataTable `enableVirtualization` when records.length > 20 (already correct — retain)
- `enableStickyFirstColumn` — document column sticky left on horizontal scroll
- Row click sets `selectedRecordId` — drives detail panel content
- Empty state: `EmptyState` component (already used — retain)
- Loading state: loading placeholder rows (not inline text)

**Contents — Detail Panel (right, ~300px):**
- Section: "Selected record" — document name, type, status badge, `ConfidenceMeter` (static)
- Section: "Review lineage" — `OcrAuditEvent[]` timeline (fetched lazily on selection via `useOcrVerifyDetailQuery`)
  - Each event: event_type label + actor name + timestamp (JetBrains Mono) + reviewer_notes if present
  - Max 6 events shown; "Show all" link if more
- Section removed: "Audit workspace" (Records tracked / Low confidence / Export failures) — these are now in the header metric strip

**Acceptance Criteria:**
- [ ] Table fills remaining height without inline style pixel calculations
- [ ] `flex-1 min-h-0` pattern used — no `height: calc(100vh - Npx)`
- [ ] Detail panel renders "Select a row to see details" when no row is selected
- [ ] `ConfidenceMeter` is static — `static: true`, no animation
- [ ] Audit event timestamps use JetBrains Mono, 12px
- [ ] "Audit workspace" duplicate metric section does not exist in detail panel
- [ ] Detail panel lazy-fetches full record only when row is selected — not on page load

---

### 4.3 Zone Interaction Rules

```yaml
zone_interactions:
  - trigger: Row clicked in History Table
    effect: selectedRecordId set; detail panel loads selected record; useOcrVerifyDetailQuery fires for full record detail
    reason: Lazy-load audit events on demand — not pre-loaded for all records

  - trigger: Any filter changes (status / export state / type / reviewer / confidence / dates)
    effect: useOcrHistoryQuery refetches with new filters; table re-renders; selectedRecordId resets to first record in new result set
    reason: Filter changes the working set

  - trigger: Search value changes (debounced 300ms)
    effect: Same as filter change — new query issued after 300ms pause
    reason: Debounce prevents per-keystroke API calls

  - trigger: records list changes (filter result arrives)
    effect: activeSelectedRecordId falls back to records[0]?.id if current selection no longer in set
    reason: Selected record must always be in the visible set

  - trigger: "Reset filters" button clicked
    effect: All 7 filter fields reset to defaults; query refires with empty filters
    reason: Quick path back to unfiltered view

  - trigger: "Excel" action clicked on a row
    effect: downloadOcrVerificationExport(id) called; busyId set; notification appears on completion
    reason: Direct download without navigating away from the list

  - trigger: "Open" action clicked on a row
    effect: Navigate to /ocr/verify?id={id}&step={3 or 4}&pane=workspace
    reason: Deep-link to the verification workspace for the selected document

  - trigger: canAccess = false
    effect: Role-gate EmptyState renders; no API calls; no table
    reason: Permission matrix
```

---

## 5. OPERATIONAL ATTENTION HIERARCHY

### 5.1 Scan Flow

```
LEVEL 1 (0–200ms): Header metric strip — Pending: N count
  — If pending > 0, supervisor sees immediately that documents need review.
  — Operator sees their own submissions' status at a glance.

LEVEL 2 (200ms–1s): Table — status column and document names
  — Status Badge (approved/pending/rejected) drives scan order.
  — Left status stripe on document row reinforces status before reading text.

LEVEL 3 (1s–3s): Detail panel — confidence meter + audit events for selected record
  — Manager auditing a specific document reads the review lineage here.

LEVEL 4 (3s+): Filter controls — narrowing to specific status / confidence / date range
  — Used when the list is large; normal daily use may not require filtering.
```

### 5.2 Persistent Visibility Requirements

| Element | Reason It Must Persist |
|---|---|
| Workspace Header Bar (metric counts) | Queue health check without scrolling — "how many pending docs?" |
| "New scan" button in header | Primary forward action always reachable |

### 5.3 Contextual Visibility Rules

```yaml
contextual_rules:
  - condition: auditTriage.lowConfidence > 0
    shows: "Low confidence: N" metric unit in header (warning token)
    hides: Low confidence metric unit when count = 0
    reason: Only actionable when non-zero

  - condition: selectedRecordId is null
    shows: "Select a row to see details" in detail panel
    hides: ConfidenceMeter, audit events, reviewer info
    reason: Detail content depends on selection

  - condition: detailQuery.isLoading (lazy fetch in progress)
    shows: Skeleton in detail panel
    hides: Detail content
    reason: Async fetch for audit_events

  - condition: busyId = record.id
    shows: "Downloading…" in the Excel button for that row
    hides: "Excel" label
    reason: Download in progress indicator

  - condition: canAccess = false
    shows: EmptyState role-gate screen
    hides: Entire workspace body
    reason: Permission matrix
```

---

## 6. TABLE & DATA STRATEGY

### 6.1 Table Role

| Field | Value |
|---|---|
| Primary Purpose | Browse the complete OCR document history; identify records by status and confidence for follow-up. |
| Scanning Pattern | Status-grouped — operators and supervisors scan by status badge first (pending = needs action, rejected = needs investigation). |
| Primary Decision | Which documents need action (pending), have issues (rejected/low-confidence), or are ready to export (approved)? |
| Action Trigger | Pending status → "Open" navigates to verify. Approved → "Excel" downloads export. |
| Row Volume | Typical: 20–200 rows / Max: 1000+ (cursor-paginated) / Virtualization: enabled at > 20 rows |

### 6.2 Column Architecture

| Column | Data Type | Alignment | Width | Sticky | Operational Purpose |
|---|---|---|---|---|---|
| Document | filename + confidence % | left | 220px | yes (left) | Identifies the record; confidence % gives quick quality signal |
| Type | doc_type_hint | left | 100px | no | Categorizes the document (table / invoice / challan) |
| Status | badge | center | 110px | no | Primary decision signal — approved / pending / rejected / draft |
| Updated | timestamp | left | 140px | no | Recency — most recently updated documents surface issues |
| Actions | Open + Excel | right | 160px | no | Direct workflow actions without selecting row |

**Columns considered and rejected:**
- `avg_confidence` as a standalone column: rejected — it's already shown inside the Document cell as a secondary line. Separate column would duplicate.
- `export_state` column: rejected — low operator value; surfaced only in filter, not as a visible column. Available in detail panel if needed.
- `reviewed_by_name` column: rejected — available in detail panel on row selection. Adding it to the table increases width without changing scan behavior.

### 6.3 Row State Specification

```yaml
row_states:
  normal: var(--surface-card) background — approved or draft records
  anomaly:
    pending: left status stripe var(--status-warning-icon) — needs review (existing pattern, retain)
    rejected: left status stripe var(--status-danger-icon) — needs investigation
    approved: left status stripe var(--status-success-icon) — complete
  selected: var(--surface-elevated) bg — row being inspected in detail panel
  expanded: N/A — no row expansion, detail in side panel
  loading: DataTable skeleton rows via existing DataTable loading state
```

### 6.4 Inline Actions

```yaml
inline_actions:
  primary:
    action: Open (navigate to /ocr/verify)
    trigger_condition: all statuses
    placement: always visible, right-aligned in Actions column
  secondary:
    action: Excel (download XLSX export)
    trigger_condition: all statuses (export available for all records)
    placement: always visible, right of Open button
  destructive:
    action: none
```

### 6.5 Bulk Actions

None — history is a read/navigate workspace. No bulk mutations.

### 6.6 Realtime Update Behavior

No realtime. Table data is static between filter changes. No poll interval.

---

## 7. FORM & INPUT STRATEGY

No form on this workspace. Filter controls are navigation inputs, not data entry.

The only inputs are the filter fields. See Section 4.2 Filter Bar for the field group.

---

## 8. AI & AUDIT VISIBILITY STRATEGY

### 8.1 AI Placement Map

```yaml
ai_placements:
  - system: OCR confidence (pre-computed avg_confidence)
    zone: History Table — Document column, second line ("N% confidence")
    position_within_zone: below filename in document cell
    display_trigger: on table render — value always present
    confidence_display: integer percentage ("73% confidence") — no tier label in table
    confidence_placement: inline in Document cell, 11px tabular-nums, text-secondary
    reasoning_text: no
    accept_action: N/A — display only
    reject_action: N/A
    unavailable_state: show "—%" if avg_confidence is null
    static_only: true

  - system: ConfidenceMeter (detail panel)
    zone: Detail Panel — "Selected record" section
    position_within_zone: below document name and status
    display_trigger: on row selection when selectedRecord is loaded
    confidence_display: visual meter bar + tier label (Verified / Check / Review)
    confidence_placement: below type/status meta
    reasoning_text: no
    accept_action: N/A — display only
    unavailable_state: hide meter if avg_confidence is null
    static_only: true  # No animation, no pulse
```

### 8.2 Audit Visibility Map

```yaml
audit:
  placement: Detail Panel — "Review lineage" section
  trigger: on row selection → useOcrVerifyDetailQuery lazy-fetches OcrAuditEvent[]
  events_logged:
    - verification_submitted: "Submitted by [actor] at [time]"
    - verification_approved: "Approved by [actor] at [time] — [reviewer_notes]"
    - verification_rejected: "Rejected by [actor] at [time] — [rejection_reason]"
  detail_level: summary (event_type + actor + timestamp + notes when present)
  authorized_roles: all canAccess roles
  realtime_updates: no — loaded once on row selection
  max_events_shown: 6 visible; "Show all" link if more
```

### 8.3 Anomaly Visibility

```yaml
anomaly:
  detection_source: rule-based (avg_confidence < 0.60 = low confidence; export_state = "failed")
  placement:
    - Header metric strip: "Low confidence: N" (warning token, conditional on > 0)
    - Table document cell: "N% confidence" secondary line — operator reads this during scan
    - Confidence filter: allows filtering to low tier only
  severity_levels:
    - low confidence (avg_confidence < 0.60): warning token on confidence display
    - export failure (export_state = "failed"): not shown inline in table — surfaced via export state filter
  dismissible: no — driven by record data
  persistence: until record is reprocessed in /ocr/verify with better scan quality
```

---

## 9. DENSITY, SPACING & LAYOUT RHYTHM

### 9.1 Density Mode

```yaml
density:
  default: compact
  justification: Archive list with potentially 100+ records. Compact keeps more rows visible without scrolling.
  operator_switchable: no
  specs:
    table_row_height:
      compact: 40px (Document cell has two lines — name + confidence — needs slightly more than 36px)
    cell_padding:
      compact: 8px horizontal / 6px vertical
    form_field_gap:
      compact: 12px
```

### 9.2 Spacing Rhythm

```yaml
spacing:
  section_gap: 8px — between filter bar and table split zone
  zone_gap: 0px between table and detail panel — shared border separator
  card_padding: N/A — no card wrappers
  sticky_header_height: 48px
  action_dock_height: N/A — no action dock
  filter_bar_height: ~80px (2 rows × 40px)
  detail_panel_width: 300px (fixed)
  detail_panel_padding: 16px internal
```

### 9.3 Typography Specification

```yaml
typography:
  workspace_title: 16px / weight 500 / Inter UI / sentence case — "OCR history"
  table_header: 12px / weight 500 / Inter UI / sentence case
  table_cell: 13px / weight 400 / Inter UI
  document_name: 13px / weight 500 / Inter UI (primary line in document cell)
  confidence_inline: 11px / tabular-nums / text-secondary (second line in document cell)
  status_badge: 11px / weight 600 / Inter UI / sentence case
  timestamp: 12px / JetBrains Mono (Updated column + audit event timestamps)
  audit_event_label: 13px / weight 500 / Inter UI / sentence case
  audit_event_actor: 12px / weight 400 / Inter UI / text-secondary
  metric_count: 13px / tabular-nums / weight 600 (header metric strip)
  metric_label: 12px / weight 400 / Inter UI / sentence case
  filter_label: 13px / weight 400 / Inter UI / sentence case
  error_message: 12px / weight 400 / Inter UI
```

### 9.4 Surface Token Hierarchy

```yaml
surfaces:
  workspace_background: var(--surface-app)
  filter_bar: var(--surface-panel)
  filter_bar_border: var(--border-default)
  table_background: var(--surface-card)
  table_header: var(--surface-shell)
  table_row_selected: var(--surface-elevated)
  detail_panel: var(--surface-panel)
  detail_section: var(--surface-card)
  audit_event_card: var(--surface-shell)
  sticky_header: var(--surface-shell)
```

---

## 10. RESPONSIVE & OPERATOR ADAPTATION

### 10.1 Desktop Workstation (Primary Target)

```yaml
desktop_workstation:
  min_width: 1280px
  optimal_width: 1440px–1920px
  layout: table (fill) + detail panel (300px right)
  density_mode: compact
  notes: At 1440px, table gets ~1140px and detail panel gets 300px. 5-column table fits comfortably.
```

### 10.2 Compact Desktop (Secondary)

```yaml
compact_desktop:
  width_range: 1024px–1279px
  density_mode: compact
  adaptations:
    - Detail panel: narrows to 260px
    - Type column: hides below 1100px (reduces to 4-column table)
  degraded_functionality: no — all actions remain accessible
```

### 10.3 Mobile / Tablet (Degraded Mode)

```yaml
mobile:
  width_range: <768px
  strategy: stacked — detail panel moves below table; filter bar collapses to single-column
  operational_continuity: list browsing and Open/Excel actions preserved; detail visible below table
  zones_hidden: none — stacked layout
  touch_targets: 44px minimum (Open, Excel buttons; filter selects)
```

### 10.4 Rail Collapse Behavior

```yaml
rail_collapse:
  detail_panel:
    collapse_trigger: no explicit collapse — panel shows placeholder when no row selected
    collapsed_state: "Select a row to see details" placeholder text
    reinvoke_method: click any table row
```

---

## 11. COMPONENT MAPPING

```yaml
component_mapping:
  workspace_container:
    component: OcrShell (existing — retain, but remove subtitle prop)
    reason: OcrShell handles the two-zone layout (main + sideContent). Structurally correct.
    props_change: Remove `subtitle` prop from OcrShell usage. Replace sideContent "Audit workspace" section with "Selected record" + "Review lineage" only.

  zones:
    - zone: Workspace Header Bar
      component: OcrShell title + inline MetricStrip pattern
      note: OcrShell already renders the title. Add metric strip below title inside OcrShell's header slot if available, or as the first child of main content before the filter bar.

    - zone: Filter Bar
      component: Inline grid of system Select (×4) + system Input (×2, type="date") + Button (reset)
      note: Replaces raw <select className="input"> with system Select primitive. Filter container uses var(--surface-panel) + border-default.

    - zone: History Table
      component: DataTable (existing — already used, already correct)
      props_required: columns, data, getRowId, selectedRowId, onRowClick, enableGlobalSearch, enableStickyFirstColumn, enableVirtualization, renderToolbar (DataTableToolbar)
      note: Table fill pattern: remove inline style, use flex-1 min-h-0 inside flex container

    - zone: Detail Panel
      component: OcrShell sideContent prop — div with two sections
      sections:
        - "Selected record": ConfidenceMeter (static) + document meta
        - "Review lineage": OcrAuditEvent[] timeline
      note: Remove "Audit workspace" section entirely from sideContent

  tables:
    - table: OCR History
      component: DataTable
      virtualization_required: yes — threshold 20 rows (already implemented — retain)
      sticky_header: yes
      density_override: compact

  ai_elements:
    - element: ConfidenceMeter (detail panel)
      component: ConfidenceMeter (existing shared/ai component)
      variant: showLabel=true
      static: true  # No animation, no pulse

    - element: Confidence % in document cell
      component: inline text — tabular-nums, text-secondary
      static: true

  status_elements:
    - element: Status badge in Status column
      component: Badge (existing — already uses correct status mapping)
      semantic_variant: synced (approved), processing (pending), error (rejected), draft (draft)
      note: Already correct in current implementation — retain

  action_elements:
    - element: Open button
      component: Button (size="compact", variant="outline") — already correct
    - element: Excel button
      component: Button (size="compact", variant="outline", disabled when busyId) — already correct
    - element: New scan link
      component: Link + Button (outline) in header bar
    - element: Reset filters
      component: Button (size="compact", variant="outline") — already correct

Missing components — new primitive candidates: None. All requirements covered by existing primitives.
```

---

## 12. OPERATIONAL PROBLEMS SOLVED

```yaml
problem_resolutions:
  - problem: Dual metric display — "Audit workspace" in sideContent duplicates the 4-card stats grid in main content.
    root_cause: Stats grid added to main content; "Audit workspace" added independently to sideContent — no coordination.
    structural_solution: "Audit workspace" section removed from sideContent (Section 4.2 detail panel). Metric counts moved to Workspace Header Bar as compact inline strip (Section 4.2 header zone). Single source of truth.
    section_reference: Section 4.2, Section 12
    measurable_outcome: Zero duplicate metric display. Header metric strip is the single location for queue health counts.

  - problem: Filter section uses raw <select>/<input> with className="input w-full" — bypasses system primitives.
    root_cause: Filters authored before system Select/Input primitives were adopted, or bypassed for speed.
    structural_solution: Filter Bar zone (Section 4.2) specifies system Select (×4) and system Input (×2, type="date") for all filter fields.
    section_reference: Section 4.2 (Filter Bar), Section 11
    measurable_outcome: All 6 filter inputs use system primitives. Consistent focus states, keyboard navigation, and accessibility behavior.

  - problem: Filter container uses rounded-[0.45rem] — custom radius outside the token system.
    root_cause: Factory-ocr CSS radius value applied directly.
    structural_solution: Filter container uses var(--surface-panel) background and var(--border-default) border with standard system border-radius (Section 9.4).
    section_reference: Section 9.4
    measurable_outcome: Zero custom border-radius values in the workspace.

  - problem: Table container uses inline style height: calc(100vh - 500px) — brittle magic-number height.
    root_cause: Developer calculated the height manually based on the zones above the table at the time of authoring.
    structural_solution: Table and detail panel sit inside a flex container with flex-1 min-h-0. The table uses DataTable's existing scrollAreaClassName="flex-1 min-h-0" pattern to fill available height without pixel math (Section 4.2, Section 11).
    section_reference: Section 4.2, Section 11
    measurable_outcome: Table fills remaining viewport height correctly regardless of content above it changing. Zero inline style pixel calculations.

  - problem: OcrShell subtitle "Reopen past runs, check their status, and download the latest export." — marketing copy.
    root_cause: Subtitle added to provide context but is marketing-style prose.
    structural_solution: subtitle prop removed from OcrShell usage (Section 11 component mapping note). Workspace title "OCR history" is sufficient.
    section_reference: Section 4.2, Section 11
    measurable_outcome: Zero subtitle copy visible to operators.

  - problem: factory-ocr-data-card components in stats grid — not token-compliant.
    root_cause: Factory-ocr CSS system used for metric cards in the main content area.
    structural_solution: Main content 4-card stats grid replaced by compact inline metric strip in the Workspace Header Bar (Section 4.2). Token surfaces only.
    section_reference: Section 4.2 (Header zone), Section 9.4
    measurable_outcome: Zero factory-ocr-data-card elements in the main content area.

  - problem: ConfidenceMeter in detail panel — not confirmed as static (could animate).
    root_cause: Animation status of ConfidenceMeter component not specified.
    structural_solution: Section 8.1 and Section 11 explicitly mark ConfidenceMeter as static: true — no animation, no pulse.
    section_reference: Section 8.1, Section 11
    measurable_outcome: ConfidenceMeter renders as a static bar with label. No animation on any AI confidence display element in this workspace.
```

---

## 13. IMPLEMENTATION HANDOFF

### 13.1 Build Sequence

```yaml
implementation_sequence:
  step_1: OcrShell wrapper — remove subtitle prop. Add metric strip slot in header area. Keep sideContent structure but strip "Audit workspace" section from it.

  step_2: Data fetching — useOcrHistoryQuery(filters, enabled). useOcrVerifyDetailQuery(activeSelectedRecordId, enabled) lazy. Derived summary counts (approved/pending/rejected). auditTriage (lowConfidence, exportFailures).

  step_3: Workspace Header Bar — compact metric strip (Approved:N / Pending:N / Rejected:N / Low confidence:N conditional). "New scan" link button. Token-only surfaces.

  step_4: Filter Bar — system Select × 4 (Row 1) + system Input × 2 + reset Button (Row 2). var(--surface-panel) container. State wiring for all 7 filter fields. 300ms debounce on search (via useDebouncedValue — already implemented).

  step_5: History Table — DataTable with 5 columns. flex-1 min-h-0 fill pattern (remove inline style). enableVirtualization at 20 rows. enableStickyFirstColumn. onRowClick sets selectedRecordId. selectedRowId drives row highlight.

  step_6: Detail Panel (sideContent) — "Selected record" section with ConfidenceMeter (static: true) + document meta. "Review lineage" section with OcrAuditEvent[] timeline (JetBrains Mono timestamps). Lazy detail fetch state handling (skeleton while loading).

  step_7: Inline actions — Open button (navigate to /ocr/verify with correct step param). Excel button (downloadOcrVerificationExport + transferBlob + notification). busyId state for loading indicator.

  step_8: Notifications — toast/banner system for download success/error (existing notifications state pattern — retain).

  step_9: Permission gate and responsive behavior — canAccess EmptyState screen. Detail panel below table on mobile. Filter bar single-column on mobile. Touch targets 44px.
```

### 13.2 Critical Constraints

```yaml
critical_constraints:
  - Remove "Audit workspace" section from sideContent entirely — metrics live in header bar only: reason: no duplicate data display
  - Table must use flex-1 min-h-0 fill — no inline style pixel calculations: reason: brittle magic numbers break on any layout change
  - All filter inputs use system Select/Input primitives — no raw HTML elements: reason: system primitive compliance
  - ConfidenceMeter is static — no animation: reason: blueprint law for AI confidence displays
  - Filter container uses token surface variables — no rounded-[0.45rem]: reason: token compliance
  - OcrShell subtitle prop must be empty or omitted: reason: no marketing copy in operational workspace
  - Do not modify AppShell scroll architecture: reason: AppShell doctrine
  - All spacing values follow 4px base scale: reason: blueprint law
```

### 13.3 Open Questions

```yaml
open_questions:
  - question: The OcrHistoryPage uses cursor-based pagination (OcrHistoryPage.has_more, next_cursor) in the type definitions but the current implementation appears to load all records without cursor controls. Should the table have "Load more" / infinite scroll, or is the current flat-list approach acceptable for the expected record volume?
    blocking: no — flat-list acceptable for current scale; cursor pagination is a future enhancement
    owner: backend team + product owner
    decision_needed_by: before step 5 in 13.1

  - question: Should the detail panel "Review lineage" show ALL audit events with a scroll, or cap at 6 with a "Show all" link to /ocr/verify? The spec says cap at 6 — confirm this is acceptable.
    blocking: no — cap at 6 with link is the correct balance between context and space
    owner: product owner
    decision_needed_by: before step 6 in 13.1
```

---

## ACCEPTANCE CRITERIA (SPEC COMPLETENESS)

- [x] All 13 sections fully populated — no empty fields, no placeholders
- [x] Every layout zone has a documented existence justification tied to a backend entity or operator need
- [x] Every layout zone has explicit, testable acceptance criteria
- [x] Every component mapped to existing primitives — OcrShell, DataTable, Select, Input, Badge, ConfidenceMeter all existing
- [x] Every operational failure from Section 1.3 has a resolution in Section 12
- [x] Reduction audit completed — dual metrics, raw HTML inputs, inline pixel height, factory-ocr cards, subtitle all eliminated
- [x] No anti-patterns (no gradients, no glow, no pulse on AI elements, no UPPERCASE, no rgba inline)
- [x] All spacing values follow 4px scale
- [x] All surfaces reference token variables only
- [x] Typography follows approved system — JetBrains Mono on timestamps, tabular-nums on confidence
- [x] Backend API endpoints verified (useOcrHistoryQuery, useOcrVerifyDetailQuery confirmed in component)
- [x] Permission matrix complete (canUseOcrScan gate via EmptyState — already correct)
- [x] Open questions populated (2 questions, 0 blocking)
- [x] AI elements marked static: true (ConfidenceMeter, inline confidence %)
- [x] Implementation handoff sequence complete and ordered (9 steps)

---

## POST-GENERATION VALIDATION

```yaml
self_validation:
  operational_integrity:
    - [x] Every zone traces to a specific backend entity or API endpoint
    - [x] Every zone justified by specific operator need (duplicate audit workspace eliminated)
    - [x] No visual-composition-only zones
    - [x] Reduction audit complete — 6 structural reductions documented in Section 12

  law_compliance:
    - [x] All spacing follows 4px base scale
    - [x] All surfaces use CSS token variables
    - [x] All text labels sentence case
    - [x] All font specs from approved type system — JetBrains Mono on timestamps
    - [x] All AI elements static — ConfidenceMeter and inline % confirmed static

  kiro_readiness:
    - [x] Kiro can produce working code without clarifying questions
    - [x] All acceptance criteria are testable
    - [x] Build sequence complete (9 steps)
    - [x] No blocking open questions

  anti_pattern_check:
    - [x] No gradients
    - [x] No glow or pulse on ConfidenceMeter
    - [x] No uppercase tracking labels
    - [x] No marketing subtitle
    - [x] No raw HTML form inputs — all system primitives
    - [x] No inline pixel height calculations
    - [x] No factory-ocr-data-card in main content

  structural_integrity:
    - [x] Zone interactions cover all filter/selection/download scenarios
    - [x] Permission matrix complete
    - [x] Responsive adaptations defined (detail panel stacks on mobile)
    - [x] All Section 12 resolutions reference specific spec sections
```

---

## 4A. VISUAL STRUCTURAL HIERARCHY BLUEPRINT

### A. Desktop Structural Blueprint (1440px)

```
┌──────────────────────────────────────────────────────────────────────────────────────┐
│  APPSHELL TOPBAR                                                           [48px]    │
├──────────────────────────────────────────────────────────────────────────────────────┤
│  WORKSPACE HEADER BAR [P:3] — sticky ──────────────────────────────────── [48px]    │
│  OCR history  │  Approved: 47  Pending: 3  Rejected: 2  ⚠ Low conf: 4  │ [New scan]│
├──────────────────────────────────────────────────────────────────────────────────────┤
│  FILTER BAR ────────────────────────────────────────────────────────────── [~80px]  │
│  [Status ▾]  [Export ▾]  [Document type ▾]  [Reviewer ▾]                           │
│  [Confidence ▾]  [Updated after]  [Updated before]  [Reset filters]                 │
├────────────────────────────────────────────────────────────────┬─────────────────────┤
│  HISTORY TABLE [P:1] — flex-1 fill                             │  DETAIL PANEL [P:2] │
│  ─────────────────────────────────────────────────────────────  │  300px fixed right  │
│  [Search...              ]  ← DataTableToolbar                 │  ─────────────────  │
│  Document          Type  Status    Updated         Actions     │  Selected record    │
│  ──────────────────────────────────────────────────────────── │  shift_report.jpg   │
│  │ shift_report_03j  table  [Pending] 03 Jun 14:22  [Open][XL]│  table • pending    │
│  │ challans_jun01    inv    [Approved] 02 Jun 10:11 [Open][XL] │  ConfidenceMeter ●  │
│  ● delivery_04.pdf  table  [Pending] 04 Jun 09:00  [Open][XL] │  73% — Check        │
│  │ batch_record.jpg  table  [Approved] 01 Jun 16:44 [Open][XL]│  ─────────────────  │
│  │ ocr_draft_02.jpg  table  [Draft]   30 May 11:30  [Open][XL]│  Review lineage     │
│  │ ...                                                         │  Submitted          │
│                                                                 │  Kumar • 09:00      │
│                                                                 │  Approved           │
│                                                                 │  Singh • 10:11      │
└────────────────────────────────────────────────────────────────┴─────────────────────┘

● = selected row (var(--surface-elevated))
│ = left status stripe (success/warning/danger/border-subtle by status)
[XL] = Excel download button
```

---

### B. Visual Attention Flow Map

```
Scan 1 (0–200ms): Header metric strip — "Pending: 3" warning token
  — Supervisor sees immediately how many documents need review action.
  — Operator checks if their submitted doc shows "Approved".

Scan 2 (200ms–1s): Table — Status column badges + Document names
  — Status badges (Pending = warning, Rejected = danger) guide the eye before reading filenames.
  — Left status stripe reinforces status signal structurally.

Scan 3 (1s–3s): Detail Panel — ConfidenceMeter + reviewer info for selected row
  — Manager auditing a specific document reads confidence and who approved it.

Scan 4 (3s+): Filter controls — narrowing to pending / low-confidence / date range
  — Used when list is large or when hunting for specific documents.

Destructive actions: None. No deletions, no status mutations on this workspace.
Primary forward action: "Open" navigates to /ocr/verify with the full verification context.
```

---

### C. Spacing & Rhythm Visualization

```
DENSE REGIONS (compact):
  - Table rows: 40px (Document cell needs 2 lines — filename + confidence %)
  - Filter bar: 8px field gap, 40px row height per row

BREATHABLE REGIONS:
  - Detail panel sections: 16px internal padding — accurate reading of audit events
  - Between filter bar and table: 8px — minimal gap, table is primary surface

VISUAL SILENCE:
  - Between table and detail panel: 1px border separator (no gap)
    → Unified surface — two columns of one workspace, not separate cards
```

---

### D. Component Nesting Hierarchy

```
WorkstationShell
  └── OcrShell (title="OCR history", subtitle omitted)
        ├── [Header area] MetricStrip (inline: Approved/Pending/Rejected/Low-conf)
        │     └── Link + Button ("New scan" — outline)
        │
        ├── [Main content]
        │     ├── FilterBar
        │     │     ├── Row 1: Select×4 (Status / Export / Type / Reviewer)
        │     │     └── Row 2: Select (Confidence) + Input×2 (dates) + Button (Reset)
        │     │
        │     └── flex container (flex-1 min-h-0)
        │           └── DataTable (OcrHistoryItem, compact)
        │                 ├── DataTableToolbar (search input)
        │                 └── columns: Document | Type | Status | Updated | Actions
        │                       └── Actions: Button (Open) + Button (Excel)
        │
        └── [sideContent — 300px right rail]
              ├── Section: "Selected record"
              │     ├── DocumentName (13px/500)
              │     ├── TypeMeta (12px/400, text-secondary)
              │     ├── StatusBadge
              │     └── ConfidenceMeter (static: true)
              │
              └── Section: "Review lineage"
                    └── OcrAuditEvent[] (max 6)
                          ├── EventLabel (13px/500, sentence case)
                          ├── ActorName (12px/400, text-secondary)
                          └── Timestamp (12px, JetBrains Mono)
```

---

### E. Responsive Collapse Blueprint

```
1440px+ (full workstation):
┌──────────────────────────────────────────────┬──────────────────────┐
│  TABLE (fill-remaining) + filters above       │  DETAIL PANEL 300px  │
└──────────────────────────────────────────────┴──────────────────────┘

1024px–1279px (compact — detail panel narrows, Type column hides):
┌──────────────────────────────────────────────┬─────────────────────┐
│  TABLE (fill, 4 columns)                      │  DETAIL 260px       │
└──────────────────────────────────────────────┴─────────────────────┘

<768px (mobile — stacked):
┌─────────────────────────────────────┐
│  HEADER BAR [48px]                   │
├─────────────────────────────────────┤
│  FILTER BAR [single-column stacked] │
├─────────────────────────────────────┤
│  TABLE [full-width, scrollable]      │
├─────────────────────────────────────┤
│  DETAIL PANEL [below table]          │
│  (selected record details stacked)  │
└─────────────────────────────────────┘
All actions (Open, Excel) preserved on mobile.
Touch targets 44px minimum.
```

---

### F. Structural Consistency Validation

```yaml
structural_validation:
  - [x] All zones justified by operational necessity (duplicate audit workspace eliminated)
  - [x] Visual dominance: table + detail panel P:1; header P:3 (peripheral)
  - [x] Spacing rhythm follows compact density from Section 9
  - [x] Responsive adaptations preserve all critical operations (Open, Excel, filter)
  - [x] Component nesting matches Section 11
  - [x] No over-zoning — 3 zones (header, filter, table+detail) all operationally justified
  - [x] No duplicate metric surfaces
  - [x] No inline pixel height calculations
  - [x] Blueprint matches LEFT-RAIL + MAIN (right-detail variant) pattern declared in Section 4.1
```

---

## KIRO TASK CHAINING

```yaml
downstream_tasks:
  task_1:
    name: "OCR History — Shell + Header Metric Strip"
    source: Section 4.2 (Header Bar zone)
    output: OcrShell with subtitle removed. Compact metric strip (Approved/Pending/Rejected/Low-conf). "New scan" link.

  task_2:
    name: "OCR History — Data Fetching"
    source: Section 3.1, Section 3.4
    output: useOcrHistoryQuery with filter state. useOcrVerifyDetailQuery lazy on selection. Derived summary + auditTriage counts.

  task_3:
    name: "OCR History — Filter Bar"
    source: Section 4.2 (Filter Bar zone), Section 11
    output: System Select × 4 (Row 1) + Select + Input × 2 + Reset Button (Row 2). var(--surface-panel) container. All filter state wiring. 300ms search debounce.

  task_4:
    name: "OCR History — History Table"
    source: Section 6 (Table Strategy), Section 11
    output: DataTable with 5 columns. flex-1 min-h-0 fill pattern (remove inline style). enableVirtualization. enableStickyFirstColumn. onRowClick → setSelectedRecordId. selectedRowId drive.

  task_5:
    name: "OCR History — Detail Panel"
    source: Section 4.2 (Detail Panel), Section 8
    output: sideContent with "Selected record" (ConfidenceMeter static, meta) + "Review lineage" (audit events timeline, JetBrains Mono timestamps). Remove "Audit workspace" section.

  task_6:
    name: "OCR History — Inline Actions + Notifications"
    source: Section 6.4, Section 11
    output: Open button (navigate with step param). Excel button (download + notification). busyId per-row loading state.

  task_7:
    name: "OCR History — Permission Gate + Responsive"
    source: Section 3.6, Section 10
    output: canAccess EmptyState gate. Detail panel below table on mobile. Filter bar single-column. Touch targets 44px.
```

---

*Status: COMPLETE — all 13 sections populated, all acceptance criteria met, post-generation validation passed.*
*Phase C progress: 6/8 complete — /approvals ✓ /attendance/live ✓ /attendance/review ✓ /attendance/reports ✓ /ocr/scan ✓ /ocr/history ✓*
*Next: /ocr/jobs/[jobId] — Phase C, Item 7.*
