# Approvals — Workspace Skeleton Architecture
# FactoryNerve OS | Phase 3 Skeleton Specification | Phase C, Item 1
# Route: /approvals
# Generated: 2026-06-03
# Status: DRAFT

---

## 1. WORKSPACE OVERVIEW

### 1.1 Identity

| Field | Value |
|---|---|
| Route | `/approvals` |
| Workspace Name | Approvals — Cross-Domain Review Queue |
| Operational Role | Aggregates all pending decision items across four adapter lanes (attendance regularizations, DPR entries, OCR verifications, steel reconciliations) plus signal items (unread alerts, high-risk steel batches) into a single priority-ranked queue. The supervisor works through the queue top-to-bottom: inspect item in detail panel → approve or reject → item leaves queue → next item advances. |
| Business Impact | If this workspace fails or becomes unusable, approved records stop flowing through: shift entries cannot close into analytics, OCR docs cannot become exportable trusted data, attendance exceptions remain open blocking payroll, and stock reconciliation stays unverified blocking inventory trust. This is the operational gate between raw submitted work and authoritative operational data. |
| User Population | Supervisor (primary daily user), manager (secondary — also sees OCR and reconciliation lanes), admin and owner (full access). Attendance role and operator role also reach this route but see only their own pending items. |
| Peak Usage Context | Midday (10:00–14:00) — when morning shift entries, OCR submissions, and overnight attendance exceptions have accumulated. Secondary peak at shift-change handover. |
| Predecessor Workspaces | `/work-queue` (drives to approvals via badge count), AppShell nav badge, `/attendance/live` (direct-link focus param) |
| Successor Workspaces | `/entry/[id]` (full entry detail when complex), `/ocr/verify` (full OCR verification when complex), `/attendance/review` (full attendance review when complex), `/steel/reconciliations` (full reconciliation) |

### 1.2 Operational Importance

The approvals workspace is the enforcement point for every FactoryNerve workflow. An entry does not become a production record until a supervisor approves it here. An OCR document does not become a trusted export until a manager approves it here. Attendance exceptions do not resolve until reviewed here. The business consequence of a slow or broken approvals queue is an accumulating backlog of unverified operational data — production reports show gaps, payroll calculations are incomplete, stock confidence degrades. The queue must surface the highest-risk item immediately, make the decision fast (approve/reject without leaving the page), and confirm the action before moving to the next item.

### 1.3 Current State Failures

- Failure 1: Two `<details>/<summary>` elements in the main page body — "Queue pulse" and "Review tools" — have no controlled state, no animation, and browser-default disclosure triangles. → Inconsistent with system interaction language; cannot be programmatically controlled by the queue's own state logic.
- Failure 2: The "Queue tips" GuidanceBlock with three marketing-style cards ("Pick lane / Review next / Close it") renders above the queue before any work items are visible. → Operators see decoration before they see their queue — adds 2–3 seconds before first meaningful scan.
- Failure 3: UPPERCASE tracking labels used throughout badges, section titles, and pill labels at 0.14–0.28em tracking. → Direct violation of the typography constitution; cognitive overhead on scan-heavy interface.
- Failure 4: Raw hex/rgba inline styles — `bg-[rgba(20,24,36,0.88)]`, `border-red-400/30`, `bg-[rgba(239,68,68,0.1)]` — used directly in JSX. → Not token-compliant; will not respond to theme changes.
- Failure 5: "Featured next item" card uses `rounded-3xl border border-[var(--accent)]/30 bg-[rgba(17,35,37,0.9)]` for visual emphasis. → Decorative border and raw rgba background used as hierarchy signal instead of size/position — anti-pattern per Principle 3.
- Failure 6: StickyActionBar at top + "Approve/Reject" in detail panel + "Approve selected/Reject selected" inside the "Review tools" section = three separate locations for the same approve/reject action. → Cognitive scatter; operator cannot determine which action surface is canonical.
- Failure 7: The 4-metric KPI card grid (urgent reviews / open tasks / 24h breaches / signals) inside "Queue pulse" duplicates counts already visible in the QueueStatPill strip above the queue. → Identical data rendered twice; doubles information load without operational benefit.
- Failure 8: EmptyState component uses `text-sm uppercase tracking-[0.28em] text-[var(--accent)]` eyebrow — the single most-cited anti-pattern in the blueprint. → Exact violation of Uppercase Usage Contract (forbidden on text larger than 12px and outside 3 permitted contexts).

---

## 2. WORKSPACE CLASSIFICATION

| Dimension | Classification | Rationale |
|---|---|---|
| Workspace Type | Queue (Two-Pane) | Left pane = sorted pending items list. Right pane = selected item detail + decision surface. Classic TYPE 3 queue workspace. |
| Workflow Category | Approval | Every operator action is a binary decision: approve or reject. Queue processes items sequentially or in bulk. |
| Operational Behavior | Queue-Based | Items are consumed one-by-one or in batch. Completion removes items from the queue. The queue drains. |
| Data Density | HIGH | Up to 4 adapter lanes, each with severity + age + type badges; detail panel shows 8–12 facts per item; filter controls; bulk selection state. |
| Realtime Complexity | LOW | No WebSocket or SSE. `subscribeToWorkflowRefresh` fires after decisions by other users. Badge counts poll on 30s interval at AppShell level. |
| AI Complexity | LOW | No AI decision-making on this workspace itself. AI-extracted confidence signals from OCR (avg_confidence) and steel anomaly scores surface as informational facts within item cards. |
| Audit Complexity | HIGH | Every approve/reject writes to AuditLog (entries), OcrAuditEvent (OCR), AttendanceRecord (attendance), SteelReconciliation (steel). Audit trail is complete and immutable. |
| Decision Pressure | HIGH | Backlog accumulates under shift pressure. SLA clock is visible (8h+, 24h+ bands). Delays have downstream payroll and reporting consequences. |

**Classification Implication:** The QUEUE (Two-Pane) + HIGH audit + HIGH decision pressure combination demands a layout where: (1) the list pane has independent scroll so the operator never loses their position while reading the detail pane; (2) the decision action (approve/reject) lives in exactly one location — the detail pane — not spread across three zones; (3) filter and preset controls are accessible but visually subordinate to the queue itself; (4) bulk selection is available but does not compete with the primary single-item review flow. The HIGH data density requires compact density as the default. The LOW realtime complexity means no streaming zones are needed — refreshedAt timestamp satisfies staleness visibility.

---

## 3. BACKEND OPERATIONAL MAPPING

### 3.1 API Surface

| Endpoint | Method | Purpose | Permission | Key Response Fields | Error States |
|---|---|---|---|---|---|
| `/attendance/review` | GET | List attendance regularization records pending decision | supervisor+ | `items[]` (AttendanceReviewItem), `totals.pending_records` | 403 (role too low), empty list (no pending) |
| `/attendance/review/{id}/decide` | POST | Approve or reject an attendance regularization | supervisor+ | Updated AttendanceRecord | 400 (invalid state), 403 (self-decision), 404 (not found) |
| `/entries` | GET | List pending DPR entries (`status=pending`) | supervisor+ | `items[]` (Entry), `total` | 403, empty list |
| `/entries/{id}/approve` | POST | Approve a DPR entry | supervisor+ | Updated Entry | 403 (self-approval blocked), 404 |
| `/entries/{id}/reject` | POST | Reject a DPR entry | supervisor+ | Updated Entry | 403, 404 |
| `/ocr/verifications` | GET | List OCR verifications (`status=pending`) | Any auth | `OcrVerificationRecord[]` | empty list |
| `/ocr/verifications/{id}/approve` | POST | Approve an OCR verification | manager+ | Updated OcrVerification | 403 (supervisor cannot approve OCR), 404 |
| `/ocr/verifications/{id}/reject` | POST | Reject an OCR verification | manager+ | Updated OcrVerification | 403, 404 |
| `/steel/reconciliations` | GET | List pending stock reconciliations | supervisor+ (steel factories only) | `{items: SteelReconciliation[]}` | 403, empty list |
| `/steel/reconciliations/{id}/approve` | POST | Approve a stock reconciliation | admin+ | Updated SteelReconciliation | 403 (supervisor cannot approve), 404 |
| `/steel/reconciliations/{id}/reject` | POST | Reject a stock reconciliation | admin+ | Updated SteelReconciliation | 403, 404 |
| `/steel/overview` | GET | Steel overview including `ranked_anomalies` (signal items) | manager+ (steel factories only) | `ranked_anomalies[]`, `anomaly_summary` | 403, empty anomalies |
| `/alerts` | GET | List unread operational alerts (signal items) | Any auth | `AlertItem[]` | empty list |
| `/alerts/{id}/read` | POST | Mark alert as read | Any auth | Updated alert | 404 |

### 3.2 Entity Relationship Map

```
[QUEUE ITEMS]
  ├── AttendanceRegularization ─── AttendanceRecord (1:1 per exception)
  │         └── User (name, department, role)
  ├── Entry (DPR) ─── User (submitted_by)
  │         └── Alert (optional — entry creation may trigger)
  ├── OcrVerification ─── OcrAuditEvent (1:N — each decision writes event)
  │         └── OcrTemplate
  └── SteelReconciliation ─── SteelInventoryItem (item being reconciled)

[SIGNAL ITEMS]
  ├── Alert ─── Entry (optional entry_id reference)
  └── SteelBatch ─── SteelInventoryItem (input + output items)

[AUDIT ON DECISION]
  ├── AuditLog (entries, attendance, steel)
  └── OcrAuditEvent (OCR only — field-level granularity)
```

**Primary entity on this workspace:** No single primary entity — the workspace is a polymorphic queue. The `ReviewQueueItem` union type is the working unit. Decisions dispatch to adapter-specific endpoints.
**Relationship implication for UI:** The detail panel must display kind-specific facts (attendance: punch times, worked minutes; entry: units, performance; OCR: confidence, columns; reconciliation: variance kg, confidence status) without the queue list needing to know the kind.

### 3.3 Workflow State Machine

```
[PENDING] ──[supervisor/manager approves]──► [APPROVED / COMPLETED]
[PENDING] ──[supervisor/manager rejects]───► [REJECTED]

Per adapter:
  attendance: AttendanceRegularization PENDING → approved/rejected
              → AttendanceRecord status recalculated
  entry:      Entry status SUBMITTED → APPROVED / REJECTED
  ocr:        OcrVerification status PENDING → APPROVED / REJECTED
              → OcrAuditEvent written
  reconciliation: SteelReconciliation PENDING → APPROVED / REJECTED
                  → stock confidence updated
  alert:      AlertItem → is_read = true (mark as read action)
  batch:      Read-only signal — navigate to /steel/batches/[id]
```

**Frontend implication:**
- Decision immediately removes the item from the queue list (optimistic removal on success).
- On success, the next item in the sorted list auto-advances to selected state in the detail panel.
- On error, item remains in queue list; MutationErrorBanner appears; item stays selected.
- `can_approve` / `can_reject` flags (derived from user role vs. adapter permission requirement) gate button enabled states within the detail panel.
- OCR items: supervisor can see detail but cannot approve/reject — escalation notice renders instead of action buttons.
- Reconciliation items: supervisor can see detail but cannot approve/reject — escalation notice renders instead of action buttons.
- Signal items (alert, batch): no approve/reject — "Mark as read" (alert) or "Open batch trace" (batch) are the only actions.

### 3.4 Realtime Contracts

| System | Transport | Update Rate | Zones Affected | Stale State Handling |
|---|---|---|---|---|
| workflowRefresh subscription | Browser event | On decision by any user in session | Full queue reload | N/A — triggered after successful action |
| AppShell badge counts | React Query poll | 30s | Nav badge only (not queue body) | Stale badge is acceptable — next reload corrects it |
| refreshedAt timestamp | Client state | On each loadInbox() completion | Header meta row | Show "Refreshed [timestamp]" — operator can manual refresh |

No SSE or WebSocket. Queue is fetch-on-load + manual refresh + post-action reload.

### 3.5 AI System Contracts

| AI System | Input | Output | Confidence | Latency | Fallback |
|---|---|---|---|---|---|
| OCR confidence score (informational) | OcrVerification.confidence_matrix | avg_confidence (0–100) as integer | Displayed as percentage — no confidence-of-confidence | Pre-computed (0ms on load) | If null: show "—" with no confidence tier indicator |
| Steel anomaly score (informational) | SteelProductionBatch fields | anomaly_score, severity label | Severity: normal/watch/high/critical | Pre-computed (0ms on load) | If null: show "No score" |

Both are **display-only** — they inform the reviewer's decision but do not make recommendations. No AI takes action on this workspace. All AI elements are static (no pulse, no glow, no animation).

### 3.6 Permission Matrix

| Role | View queue | Approve entry | Approve attendance | Approve OCR | Approve reconciliation | Bulk actions | Signal items |
|---|---|---|---|---|---|---|---|
| attendance | ✓ (own only) | ✗ | ✗ | ✗ | ✗ | ✗ | ✗ |
| operator | ✓ (own only) | ✗ | ✗ | ✗ | ✗ | ✗ | ✗ |
| accountant | ✓ | ✗ | ✗ | ✗ | ✗ | ✗ | ✗ |
| supervisor | ✓ | ✓ | ✓ | ✗ (view only) | ✗ (view only) | ✓ (entry + attendance) | ✓ |
| manager | ✓ | ✓ | ✓ | ✓ | ✗ (view only) | ✓ | ✓ |
| admin | ✓ | ✓ | ✓ | ✓ | ✓ | ✓ | ✓ |
| owner | ✓ | ✓ | ✓ | ✓ | ✓ | ✓ | ✓ |

**Permission implication:**
- If `canReview` is false (attendance/operator/accountant): workspace renders a role-gate screen with redirect links to `/dashboard` and `/work-queue`. Queue body is never rendered.
- Within the queue, `canApprove` and `canReject` per item drive button enabled/disabled state in the detail panel.
- OCR items for supervisor role: detail panel shows escalation notice ("Manager or higher approval required") instead of action buttons.
- Reconciliation items for supervisor/manager role: escalation notice rendered.
- Bulk action controls only render for roles with at least one approvable adapter lane.
- Steel-mode lanes (reconciliations, batch signals) only load and render when `activeFactory.industry_type === "steel"`.

---

## 4. WORKSPACE STRUCTURAL ANATOMY

### 4.1 Layout Pattern

**LEFT-RAIL + MAIN** (Queue variant — two-pane split)

The left rail carries the sorted queue list. The main zone carries the selected item detail + decision surface. The split is `[320px fixed left] + [fill-remaining right]` on desktop. On mobile, the queue list occupies full screen; tapping an item slides the detail panel in as a full-screen overlay with a back navigation.

**Pattern selection justification:** The core workflow is: scan list → select item → review detail → decide → advance to next. This is definitionally a two-pane queue pattern. The left rail provides persistent queue context (how many items remain, what's next) while the right execution zone handles the current decision without losing the operator's place in the queue. FULL-WIDTH COMMAND was rejected because the queue list must remain visible at all times — the operator needs to see the backlog shrink as they work. TRIZONE was rejected — there is no third context rail; the detail panel itself serves context + action.

**Structural reduction note:**
- The current "Queue pulse" `<details>` section (4 KPI cards + 2 SLA diagnostic cards = 6 cards) is eliminated. The count pills in the queue list header already communicate urgent/open/stale counts. Six cards that repeat what 4 pills show is pure duplication.
- The "Queue tips" GuidanceBlock (3 marketing-style instruction cards) is eliminated. Operators who use this daily do not need onboarding instruction cards above their work queue.
- The StickyActionBar action buttons (Review next, Approve N, Reject N) are consolidated into the detail panel. The StickyActionBar is retained for queue-level metadata display only (open count, preset label, refreshed time) — no duplicate action buttons.
- "Review tools" `<details>` section becomes a persistent, always-visible compact FilterBar above the queue list — never collapsed. Filters are the navigation mechanism of this workspace; hiding them degrades the core workflow.

---

### 4.2 Zone Definitions

---

#### ZONE: Queue List Rail (Left)

| Property | Value |
|---|---|
| Operational Role | Displays all pending items sorted by priority score (severity × age × anomaly signals). The operator scans this list to understand their workload and selects items for review. |
| Attention Priority | 1 |
| Position | Left rail — fixed 320px width on desktop |
| Width | fixed: 320px desktop / full-width mobile |
| Height | fill-remaining below workspace header |
| Sticky Behavior | rail itself is sticky within the viewport — list content scrolls independently |
| Collapse Behavior | never collapses on desktop; becomes full-screen view on mobile (detail panel overlay on item tap) |
| Scroll Behavior | independent scroll — queue list scrolls without affecting detail panel |
| Density Mode | compact — operators scan many items; every pixel of list height matters |
| Existence Justification | `ReviewQueueItem[]` — the multi-adapter sorted pending items list. Without this rail, the operator cannot understand the full backlog or navigate between items. |

**Contents:**
- FilterBar (top of rail, sticky within rail): preset pills (All / Today / 8h+ / 24h+ / OCR / Stock) + domain-type select + search input. Compact, single-row.
- Domain count strip: 4 compact pills showing Attendance:N / DPR:N / OCR:N / Stock:N counts for current filtered view.
- Queue items list: each item renders as a compact card (compact density — 40px min height per item). Fields per card: type badge (kind) + severity badge + title (truncated to 2 lines) + age label + checkbox for bulk selection.
- Signals section: below the task items, a section header "Signals" separates signal items (unread alerts, high-risk batches) from decision tasks.
- Empty state: when no items match filters — 2-line message: "No pending reviews" + "Queue is clear" — no decorative cards, no uppercase eyebrow.

**Acceptance Criteria:**
- [ ] Rail has independent scroll — scrolling list does not affect detail panel scroll position
- [ ] Selected item is visually distinguished (background token elevation + left border accent) — not color-only
- [ ] FilterBar is permanently visible in the rail — no collapse, no `<details>` wrapper
- [ ] Compact density: item row min-height 40px, padding 8px horizontal / 6px vertical
- [ ] Domain count pills use sentence-case labels — no uppercase tracking
- [ ] Checkbox renders for task items (bucket = "task") only — signals have no checkbox
- [ ] Empty state renders plain text — no UPPERCASE eyebrow, no marketing copy

---

#### ZONE: Queue Header Bar (Top, Sticky)

| Property | Value |
|---|---|
| Operational Role | Persistent context strip: total open count, active preset/filter state, refreshed timestamp, and manual refresh button. Never contains approve/reject actions. |
| Attention Priority | 3 |
| Position | Top — spans full workspace width above the two-pane split |
| Width | full-width |
| Height | fixed: 48px |
| Sticky Behavior | always sticky — pins to top on scroll |
| Collapse Behavior | never |
| Scroll Behavior | sticky — does not scroll |
| Density Mode | compact |
| Existence Justification | `InboxState.refreshedAt` + filtered counts. Operator must always know: how many items are open, when data was last refreshed. Persistent context from Section 5.2. |

**Contents:**
- Workspace title: "Review queue" — 16px / weight 500 / Inter UI / sentence case
- Open count pill: "Open: N" — token-styled, updates on filter change
- Urgent count pill: "Urgent: N" — danger-styled, appears only when urgentCount > 0
- Refreshed timestamp: "Refreshed 14:22" — JetBrains Mono, 12px
- Manual refresh button: ghost, 32px height — right-aligned

**Acceptance Criteria:**
- [ ] Header bar is 48px height, always sticky
- [ ] Open count updates immediately when filters change
- [ ] Urgent pill only renders when urgentTaskCount > 0
- [ ] Refreshed timestamp uses JetBrains Mono — matches timestamp typography spec
- [ ] No approve/reject actions in this zone — confirmed absence is testable

---

#### ZONE: Decision Panel (Right / Main)

| Property | Value |
|---|---|
| Operational Role | Shows the full context of the selected queue item and provides the canonical approve/reject decision surface. This is where all decisions happen — the single location for approve/reject actions. |
| Attention Priority | 1 (shared with Queue List Rail — both are P:1, operator alternates between them) |
| Position | Right / main — fills remaining width after 320px left rail |
| Width | fluid: fill-remaining |
| Height | fill-remaining with independent internal scroll |
| Sticky Behavior | Decision action dock (approve/reject buttons) is sticky at the bottom of this zone |
| Collapse Behavior | never |
| Scroll Behavior | independent scroll — panel scrolls without affecting queue list rail |
| Density Mode | default — review work requires more space per fact for accurate reading |
| Existence Justification | `ReviewQueueItem` (selected item) — every item has kind-specific facts, recommendation, history, and a decision surface. Cannot be collapsed without eliminating the workspace's primary function. |

**Contents:**
- Empty state (no item selected): single centered message "Select an item from the queue" — no decorative treatment.
- Item header: type badge + severity badge + age label (sentence-case labels) + title + headline.
- Recommendation block: one-sentence recommendation text. No heading above it — the recommendation is the most important text in the panel.
- Facts grid: key-value pairs (kind-specific). 2-column grid. Labels: 12px / weight 500 / sentence-case. Values: 13px / weight 400. IDs and timestamps in JetBrains Mono.
- AI signal row (conditional — OCR items only): confidence percentage with tier label (High ≥85 / Review 60–84 / Low <60) as static badge. `static: true`.
- History facts (collapsible — controlled state): secondary key-value pairs (created/updated timestamps, reviewer notes history). Collapsed by default via controlled boolean state — not `<details>`.
- Review note input: Textarea — appears for all task items. Required for reject (enforced). Required for high-risk approve (enforced). Optional for routine approve.
- Escalation notice (conditional): renders when `!item.canApprove && !item.canReject` — sentence-case text, warning styling, names the role required.
- Next step links: 1–2 text links to source workspace (e.g., "Open full entry", "Open OCR review") — ghost button style, small text.
- Sticky decision dock: fixed at bottom of panel — Approve button (primary) + Reject button (secondary/destructive) + busy state. For signal items: "Mark as read" (alert) or "Open batch trace" (batch).

**Acceptance Criteria:**
- [ ] Approve and Reject buttons exist ONLY in this zone — no other zone in the workspace renders these buttons
- [ ] Decision dock is sticky at bottom of panel — visible without scrolling on screens ≥ 768px height
- [ ] Reject button disabled until note textarea has non-empty input
- [ ] High-risk approve button disabled when requiresDecisionNote is true and note is empty
- [ ] Escalation notice renders (not action buttons) when canApprove = false AND canReject = false
- [ ] OCR confidence badge is static — no animation, no pulse
- [ ] History facts section uses controlled state (useState boolean) — not `<details>/<summary>`
- [ ] All fact labels use sentence case — no uppercase tracking labels anywhere in this zone
- [ ] No raw hex/rgba inline styles — all surfaces use token variables

---

#### ZONE: Bulk Action Bar (Conditional — Above Decision Panel)

| Property | Value |
|---|---|
| Operational Role | When ≥1 task items are selected in the queue list, this bar surfaces the bulk approve/reject action for the selection. Appears only when selectedTaskCount > 0. |
| Attention Priority | 2 |
| Position | Sticky below Queue Header Bar, above Decision Panel — full-width, only within the main zone column |
| Width | fill-remaining (main zone width only) |
| Height | fixed: 52px when visible / 0 when hidden |
| Sticky Behavior | sticky below header when visible |
| Collapse Behavior | hidden (display: none) when selectedTaskCount = 0 — no animation required |
| Scroll Behavior | sticky |
| Density Mode | compact |
| Existence Justification | `selectedTaskKeys[]` — operators processing large queues of uniform-type items (e.g., end-of-day 8 OCR docs, all supervisor-approved) need bulk close capability. Without this zone, bulk decisions require individual click-throughs. |

**Contents:**
- "N selected" count label
- Shared note input: single-line Input (not Textarea) with placeholder "Required for rejection and high-risk approvals"
- Approve N button (primary) — disabled when bulkApproveReasonMissing
- Reject N button (secondary/destructive) — disabled when bulkNote is empty
- Clear selection ghost button — far right
- Warning label (conditional): appears when bulkApproveReasonMissing or bulkRejectReasonMissing

**Acceptance Criteria:**
- [ ] Zone does not render at all when selectedTaskCount = 0
- [ ] Confirmation modal triggers before bulk action executes — confirms count of eligible vs. restricted items
- [ ] Bulk reject is blocked (button disabled) until bulkNote has non-empty content
- [ ] After bulk action completes: selection cleared, queue reloads, success banner shown
- [ ] Role-restricted items in selection are shown as "N items skipped (role restricted)" in confirmation modal

---

### 4.3 Zone Interaction Rules

```yaml
zone_interactions:
  - trigger: User clicks item in Queue List Rail
    effect: Decision Panel loads the selected item's content; detail panel scrolls to top
    reason: Two-pane queue pattern — list selection drives detail content

  - trigger: Approve or Reject action completes successfully
    effect: Item removed from Queue List Rail (optimistic); next item in sorted list auto-selected in Decision Panel; review note cleared; SuccessBanner shown in header area
    reason: Continuous queue processing — operator should not need to manually advance to next item

  - trigger: Approve or Reject action fails
    effect: Item remains in queue list; MutationErrorBanner appears in Decision Panel above facts; note retained
    reason: Error recovery requires operator to retry or take a different action on the same item

  - trigger: selectedTaskCount changes from 0 to 1+
    effect: Bulk Action Bar zone becomes visible (height expands from 0 to 52px)
    reason: Bulk actions only relevant when selection exists

  - trigger: selectedTaskCount returns to 0
    effect: Bulk Action Bar zone hides
    reason: No selection = no bulk action needed

  - trigger: Filter (preset, type, severity, age, search) changes
    effect: Queue List Rail filtered items re-render; domain count pills update; if selectedKey no longer in filtered set, first visible item becomes selected
    reason: Filter changes the working set — detail must stay coherent with visible list

  - trigger: user role check → canReview = false
    effect: Entire queue body does not render; role-gate screen shown with redirect links
    reason: Permission matrix — non-review roles must not see or act on other users' items

  - trigger: industry_type !== "steel"
    effect: Reconciliation lane items not fetched; steel signal section not shown
    reason: Backend reconciliation endpoints are steel-factory-gated

  - trigger: workflowRefresh event fires
    effect: loadInbox() called in background; queue list updates with new items; badge count refreshes
    reason: Other users' decisions affect the queue state — team visibility

  - trigger: item.canApprove = false AND item.canReject = false
    effect: Action buttons in Decision Panel replaced by escalation notice text
    reason: Permission matrix drives UI state — blocked items must show clear escalation path
```

---

## 5. OPERATIONAL ATTENTION HIERARCHY

### 5.1 Scan Flow

```
LEVEL 1 (0–200ms): Top item in Queue List Rail + its severity badge
  Operational necessity: The highest-priority item must be the first thing the supervisor
  sees. The severity badge (critical / high / warning / info) communicates urgency before
  the operator reads the title. If this item is critical, the operator knows immediately.

LEVEL 2 (200ms–1s): Item title + age label in Queue List Rail; Recommendation text in Decision Panel
  Operational necessity: Title identifies the specific record. Age label tells the operator
  how long this has been waiting. In the Decision Panel, the recommendation text (one sentence)
  is the fastest path to a decision for routine items.

LEVEL 3 (1s–3s): Facts grid in Decision Panel; domain count pills in list header
  Operational necessity: Facts confirm the decision context. Domain pills give the supervisor
  a queue health read (how many of each type are pending).

LEVEL 4 (3s+): Review note input; history facts; next step links; bulk action bar
  Operational necessity: Note input is required for reject/high-risk — only reached when the
  operator is ready to decide. History facts are for contested or complex items. Bulk bar is
  for batch processing after the critical items are handled.
```

### 5.2 Persistent Visibility Requirements

| Element | Reason It Must Persist |
|---|---|
| Queue List Rail (top item always visible) | The supervisor's peripheral awareness of the backlog — must never scroll away |
| Queue Header Bar (open count + refreshed time) | Operator needs to know queue depth and data freshness at a glance throughout the session |
| Decision dock (approve/reject buttons) | The canonical action must always be accessible — sticky at bottom of Decision Panel |
| Active filter state (preset label in header) | Operator must know they are in a filtered view — invisible filter state causes missed items |

### 5.3 Contextual Visibility Rules

```yaml
contextual_rules:
  - condition: canReview = false (operator/attendance/accountant role)
    shows: Role-gate screen with redirect links
    hides: Entire queue workspace body
    reason: Non-review roles must not see or act on other users' pending items

  - condition: selectedTaskCount > 0
    shows: Bulk Action Bar zone
    hides: nothing (additive)
    reason: Bulk controls are only relevant when a selection exists

  - condition: item.canApprove = false AND item.canReject = false
    shows: Escalation notice in Decision Panel (sentence-case, warning styling)
    hides: Approve and Reject buttons
    reason: Role-blocked items need escalation guidance, not disabled buttons

  - condition: item.kind = "ocr" AND avg_confidence is non-null
    shows: AI confidence badge (static) in Decision Panel facts area
    hides: nothing
    reason: OCR confidence is a trust signal the reviewer must see before approving

  - condition: item.bucket = "signal"
    shows: Single action button ("Mark as read" or "Open batch trace")
    hides: Approve button, Reject button, review note textarea, escalation notice
    reason: Signal items are not decision items — they are acknowledgment or navigation items

  - condition: urgentTaskCount > 0
    shows: Urgent count pill in Queue Header Bar (danger styling)
    hides: nothing (urgent pill hidden when urgentCount = 0)
    reason: Critical-severity items need visual emphasis in the persistent header

  - condition: industry_type !== "steel"
    shows: nothing steel-specific
    hides: Reconciliation lane in queue list; batch signals in signals section; stock count pill
    reason: Steel domain data does not exist for non-steel factories

  - condition: requiresDecisionNote AND note is empty
    shows: Warning label below note textarea ("Note required for this decision")
    hides: nothing — Approve button is disabled
    reason: High-risk and reject decisions require an audit note

  - condition: historyFacts.length > 0 AND showHistory = true (controlled state)
    shows: History facts section in Decision Panel
    hides: History facts when showHistory = false
    reason: History context is useful for contested items — optional depth, not default visible
```

---

## 6. TABLE & DATA STRATEGY

No full-width tables. The Queue List Rail uses a list-of-cards pattern (not a columnar table) because items are polymorphic (different facts per kind) and the primary interaction is selection-for-detail, not column-scanning. Each list item is a compact card with fixed fields (type badge, severity, title, age, checkbox) regardless of kind.

The Decision Panel facts grid is a key-value layout, not a table — 2-column grid of label:value pairs.

**Reduction note:** A columnar table was considered for the queue list but rejected because: (a) polymorphic items have no shared columns beyond type/severity/title/age; (b) the compact card provides better scanning hierarchy than flat row columns for a decision-making workflow; (c) row virtualization would be needed at >50 items — acceptable complexity reduction to defer.

---

## 7. FORM & INPUT STRATEGY

### 7.1 Form Role

| Field | Value |
|---|---|
| Form Purpose | Captures the review note that accompanies an approve or reject decision on a queue item |
| Completion Frequency | Every reject; every high-risk approve; optional for routine approvals |
| Keyboard Efficiency Priority | MEDIUM — keyboard Tab → Enter flow should work; most decisions are click-driven |
| AI Assistance Available | No |
| Estimated Completion Time | 5–30 seconds per item (routine approve < 5s; complex reject with note 15–30s) |

### 7.2 Field Group Architecture

```yaml
field_groups:
  - group: Single-item decision note
    operational_purpose: Record the reviewer's decision rationale for the audit trail
    fields:
      - name: note
        type: textarea (4 rows)
        required: conditional (yes for reject; yes for high-risk approve; no for routine approve)
        validation_rules: Non-empty string when required. Trim whitespace before validation.
        ai_assisted: no
        tab_order: 1 (within Decision Panel — after facts grid)
        default_value: "" (cleared on item change)
        help_text: Required for rejection and high-risk approvals.
        error_message: A note is required before this decision can be recorded.

  - group: Bulk decision note
    operational_purpose: Single shared note for a bulk approve or reject action
    fields:
      - name: bulkNote
        type: input (single line — compact for the bulk bar)
        required: yes for bulk reject; yes for bulk high-risk approve
        validation_rules: Non-empty string when required
        ai_assisted: no
        tab_order: 1 (within Bulk Action Bar)
        default_value: "" (cleared on bulk action completion)
        help_text: Required for rejection and high-risk approvals.
        error_message: Add a shared note before running the bulk decision.
```

### 7.3 Validation Strategy

```yaml
validation:
  realtime:
    - note: button disabled state updates as user types (no separate error message until submit attempt)
    - bulkNote: bulk action buttons disabled state updates as user types
  on_blur:
    - none
  on_submit:
    - note: required check before calling approve/reject adapter endpoint
    - bulkNote: required check before opening bulk confirm modal
  server_side:
    - approve: 403 returned if role insufficient; 400 if state transition invalid
    - reject: same as approve; additionally 422 if reason is empty (backend enforces)
      latency: <300ms
  ai_flagged:
    - none
```

### 7.4 Keyboard Flow

```yaml
keyboard:
  tab_sequence: [Queue list item selection] → [Note textarea] → [Approve button] → [Reject button] → [Next step links]
  shortcuts:
    - Tab: advance through Decision Panel fields
    - Enter in note textarea: add newline (not submit — prevents accidental submission)
    - Escape: clear note (with confirmation if note has content)
  autofocus: No autofocus on page load — first item in queue list is auto-selected, but focus is not moved to note textarea (operator may just want to scan the item first)
```

---

## 8. AI & AUDIT VISIBILITY STRATEGY

### 8.1 AI Placement Map

```yaml
ai_placements:
  - system: OCR confidence score (informational only)
    zone: Decision Panel — within facts grid, immediately after "Confidence" label
    position_within_zone: inline — key "Confidence" / value "73% — Review required" as static badge
    display_trigger: on item load (when item.kind = "ocr" and avg_confidence is non-null)
    confidence_display: text label + percentage — "High (92%)" / "Review (73%)" / "Low (41%)"
    confidence_placement: inline in facts grid
    reasoning_text: no
    accept_action: no action — informational only; operator makes the approval decision
    reject_action: no action — informational only
    unavailable_state: show "—" with no tier badge when avg_confidence is null
    static_only: true  # No pulse, no glow, no animation

  - system: Steel anomaly score (informational only)
    zone: Decision Panel — within facts grid, after "Anomaly score" label for batch signal items
    position_within_zone: inline — key "Severity" / value "High (8.2)" as static badge
    display_trigger: on item load (when item.kind = "batch" and anomaly_score is non-null)
    confidence_display: severity label + score — "Critical (14.1)" / "High (8.2)" / "Watch (3.1)"
    confidence_placement: inline in facts grid
    reasoning_text: no
    accept_action: no action — signal item, navigates to batch trace
    reject_action: N/A
    unavailable_state: show "—" when anomaly_score is null
    static_only: true  # No pulse, no glow, no animation
```

### 8.2 Audit Visibility Map

```yaml
audit:
  placement: Decision Panel — history facts section (controlled-state collapse, below main facts grid)
  trigger: visible when showHistory = true (toggle link "Show history") — collapsed by default
  events_logged:
    - attendance_regularization_decided: "Approved/Rejected by [name] at [time] — [note]"
    - entry_approved: "Approved by [name] at [time]"
    - entry_rejected: "Rejected by [name] at [time] — [reason]"
    - ocr_verification_approved: "Approved by [name] at [time] — [reviewer_notes]"
    - ocr_verification_rejected: "Rejected by [name] at [time] — [rejection_reason]"
    - steel_reconciliation_approved: "Approved by [name] at [time] — [approver_notes]"
    - steel_reconciliation_rejected: "Rejected by [name] at [time] — [rejection_reason]"
  detail_level: expandable (history facts grid — key:value pairs from historyFacts array)
  authorized_roles: supervisor+ (same as who can view the queue)
  realtime_updates: no — history is loaded once on item selection; refreshes on page reload
  max_events_shown: all available (history facts from single source record — not paginated)
```

### 8.3 Anomaly Visibility

```yaml
anomaly:
  detection_source: rule-based (severity calculated client-side from confidence/variance data; no runtime AI call on this workspace)
  placement: Queue List Rail item card — severity badge (critical/high/warning/info); Decision Panel item header — same badge
  severity_levels:
    - level: critical
      structural_treatment: Danger-token badge (--status-danger-bg/fg/border) on item card + Decision Panel header. Item sorted to top of list.
      action_required: yes — decision is urgent
    - level: high
      structural_treatment: Warning-token badge (--status-warning-bg/fg/border). Item sorted above warning items.
      action_required: yes — decision needed within SLA
    - level: warning
      structural_treatment: Warning-token badge (same token as high — structural differentiation by label text only)
      action_required: yes — routine review
    - level: info
      structural_treatment: Success-token badge (--status-success-bg/fg/border). Lowest priority.
      action_required: no — advisory item
  dismissible: no — severity is derived from the source record; cannot be manually dismissed
  persistence: until item is decided (removed from queue) or source record changes severity
```

---

## 9. DENSITY, SPACING & LAYOUT RHYTHM

### 9.1 Density Mode

```yaml
density:
  default: compact
  justification: Queue scanning workspace. Supervisors may have 15–40 items in queue. Maximum list density is operationally justified. Comfortable would make <6 items visible at once — unacceptable for queue triage.
  operator_switchable: no — queue density is fixed. Decision Panel uses default density internally for accurate reading of facts.
  specs:
    table_row_height:
      compact: 36px
      default: 40px
      comfortable: 48px
    cell_padding:
      compact: 8px horizontal / 6px vertical
      default: 12px horizontal / 8px vertical
      comfortable: 16px horizontal / 12px vertical
    form_field_gap:
      compact: 12px
      default: 16px
      comfortable: 24px
  queue_list_item_height:
    compact: 40px minimum (may grow with 2-line title)
  decision_panel_density: default (reading context requires more space)
```

### 9.2 Spacing Rhythm

```yaml
spacing:
  section_gap: 16px — tight vertical gap between queue list sections (tasks / signals); queue is dense by design
  zone_gap: 0px between list rail and decision panel — they share a border separator, no gap
  card_padding: 12px in queue list items (compact); 20px in Decision Panel fact groups
  sticky_header_height: 48px — Queue Header Bar
  action_dock_height: 56px — Decision dock (approve/reject) sticky at bottom of Decision Panel
  inline_label_gap: 8px
  form_group_gap:
    compact: 12px
    default: 16px
    comfortable: 24px
  queue_list_rail_width: 320px (fixed)
  filter_bar_height: 44px (single-row compact filter controls)
```

### 9.3 Typography Specification

```yaml
typography:
  workspace_title: 16px / weight 500 / Inter UI / sentence case
  section_header: 13px / weight 500 / Inter UI / sentence case  # "Tasks" / "Signals" in rail
  table_header: N/A — no columnar tables
  table_cell: N/A
  form_label: 13px / weight 400 / Inter UI / sentence case
  form_input: 14px / weight 400 / Inter UI
  status_badge: 11px / weight 600 / Inter UI / sentence case  # ALL badges — NO uppercase tracking
  ai_reasoning: N/A — no AI reasoning text
  audit_entry: 12px / weight 400 / Inter UI
  numeric_data: 13px / tabular-nums / right-aligned
  timestamp: 12px / JetBrains Mono  # refreshedAt, punch times, counted_at
  id_reference: 12px / JetBrains Mono  # verification IDs, entry IDs, batch codes
  error_message: 12px / weight 400 / Inter UI
  # Queue-specific additions:
  queue_item_title: 13px / weight 500 / Inter UI / sentence case (truncated to 2 lines)
  queue_item_badge: 11px / weight 600 / Inter UI / sentence case (NOT uppercase tracking)
  decision_panel_title: 16px / weight 600 / Inter UI
  decision_panel_headline: 13px / weight 400 / Inter UI / text-secondary color
  fact_label: 12px / weight 500 / Inter UI / sentence case
  fact_value: 13px / weight 400 / Inter UI
  recommendation_text: 14px / weight 400 / Inter UI  # most prominent text in panel after title
  escalation_notice: 13px / weight 400 / Inter UI / status-warning-fg color
```

**Anti-pattern enforcement:** Zero instances of `uppercase tracking-[*em]` on any text. Badge labels use sentence case. Section eyebrows use sentence case. The current pattern of `text-[11px] font-semibold uppercase tracking-[0.16em]` appears in 20+ places in the current implementation — every instance is eliminated and replaced with `text-[11px] font-semibold` in sentence case.

### 9.4 Surface Token Hierarchy

```yaml
surfaces:
  workspace_background: var(--surface-app)
  primary_panel: var(--surface-shell)  # Queue List Rail background
  secondary_panel: var(--surface-panel)  # Decision Panel background
  card_surface: var(--surface-card)  # Queue list item cards; Decision Panel fact groups
  input_surface: var(--surface-card)  # Note textarea; bulk note input; filter inputs
  overlay_surface: var(--surface-panel)  # + shadow-md (bulk confirm modal)
  sticky_surface: var(--surface-shell)  # Queue Header Bar; Decision dock; Bulk Action Bar
  selected_item_surface: var(--surface-elevated)  # Selected queue list item
```

**Anti-pattern enforcement:** Zero `rgba(...)` inline backgrounds. Zero `border-red-400/30` Tailwind color classes. Zero `bg-[rgba(...)]` values. All backgrounds use token variables. The current count of raw rgba/hex values in approvals-page.tsx is approximately 22 — all eliminated.

---

## 10. RESPONSIVE & OPERATOR ADAPTATION

### 10.1 Desktop Workstation (Primary Target)

```yaml
desktop_workstation:
  min_width: 1280px
  optimal_width: 1440px–1920px
  all_zones_visible: yes — both panes simultaneously
  density_mode: compact (queue list) / default (decision panel)
  notes: At 1440px, left rail at 320px leaves 1120px for the decision panel. This is comfortable for the facts grid and note textarea. The two-pane layout must be confirmed at 1280px minimum — at this width, rail 320px + panel 960px is acceptable.
```

### 10.2 Compact Desktop (Secondary)

```yaml
compact_desktop:
  width_range: 1024px–1279px
  density_mode: compact (both panes)
  adaptations:
    - Queue List Rail: narrows to 280px — compact card layout preserved
    - Decision Panel: fills remaining ~744px — fact grid switches to single-column below 800px panel width
    - Bulk Action Bar: note input narrows to 200px; buttons remain visible
  degraded_functionality: no — all decisions remain accessible
```

### 10.3 Mobile / Tablet (Degraded Mode)

```yaml
mobile:
  width_range: <768px
  strategy: sequential — queue list is full-screen; tapping item slides detail panel as full-screen overlay with "Back to queue" navigation
  operational_continuity: All approve/reject decisions available. Bulk selection available but cumbersome — not recommended for mobile use.
  zones_hidden:
    - Queue List Rail and Decision Panel are never simultaneously visible on mobile — operational consequence: operator cannot reference queue position while reviewing an item
  touch_targets: 44px minimum — queue list item tap area, approve/reject buttons
  touch_adjustments:
    - Queue list item: minimum 44px tap area (padding adjusted)
    - Decision dock: approve 48px height / reject 48px height on mobile
    - Back navigation: "← Back" ghost button at top of detail overlay, 44px tap area
    - Bulk checkbox: 44px tap target (larger than default 16px checkbox)
```

### 10.4 Rail Collapse Behavior

```yaml
rail_collapse:
  left_rail:
    collapse_trigger: viewport < 768px (automatic — mobile breakpoint)
    collapsed_state: hidden — replaced by full-screen queue list view
    reinvoke_method: "Back to queue" button in detail overlay; hardware back button
  right_rail:
    collapse_trigger: N/A — Decision Panel is the main zone, not a right rail
    collapsed_state: N/A
    reinvoke_method: N/A
```

---

## 11. COMPONENT MAPPING

```yaml
component_mapping:
  workspace_container:
    component: WorkstationShell (AppShell integration) with TwoPane layout primitive
    reason: Consistent AppShell topbar integration; TwoPane provides the 320px left + fill-remaining right split with independent scroll contracts

  zones:
    - zone: Queue Header Bar
      component: StickyTopbar or WorkspaceHeaderBar primitive
      props_required: title "Review queue", open count, urgent count, refreshedAt, onRefresh handler
      variant: compact — 48px height

    - zone: Queue List Rail
      component: WorkspaceRail (left rail scroll container)
      props_required: width 320px, independent scroll, children (FilterBar + count strip + items list)
      variant: compact density

    - zone: Decision Panel
      component: WorkspaceMain (fill-remaining zone with independent scroll)
      props_required: independent scroll, sticky bottom dock slot
      variant: default density

    - zone: Bulk Action Bar
      component: StickyActionBar (variant: conditional-top — mounts below header when selection > 0)
      props_required: selectedCount, onBulkApprove, onBulkReject, bulkNote, onNoteChange, onClear
      variant: conditional — renders only when selectedTaskCount > 0

  filter_controls:
    - component: FilterBar (compact variant — single row)
      props_required: preset pills array, type select, search input
      note: Permanently visible at top of Queue List Rail — never in a collapse wrapper

  queue_items:
    - component: QueueItemCard (compact list card)
      props_required: typeLabel, severity, title (2-line truncate), ageLabel, checkbox, isSelected, onSelect, onOpen
      variant: compact — 40px min-height
      note: New primitive candidate — queue item compact card does not exist as a named primitive; flag for implementation

  decision_panel_internals:
    - component: FactsGrid (2-col key-value grid)
      props_required: facts: DetailFact[]
      variant: default density

    - component: ConfidenceBadge (OCR items only)
      props_required: confidence (0–100), tier ("high"/"review"/"low")
      variant: static — no animation
      static: true

    - component: AnomalySeverityBadge (batch signal items only)
      props_required: severity label, score
      variant: static
      static: true

  status_elements:
    - element: Severity badge
      component: StatusBadge
      semantic_variant: danger (critical), warning (high/warning), success (info)

    - element: Type badge (kind label)
      component: StatusBadge
      semantic_variant: info (attendance/entry), processing (ocr/reconciliation), warning (batch)

    - element: Age label
      component: StatusText (inline text — not a badge)
      semantic_variant: danger (stale), warning (aging), success (fresh)

  action_elements:
    - element: Approve button
      component: Button
      variant: primary
      why: Positive terminal action — primary semantic

    - element: Reject button
      component: Button
      variant: secondary/destructive (ghost with destructive color)
      why: Negative terminal action — must be visually distinguished from Approve

    - element: Mark as read (alert signal)
      component: Button
      variant: outline
      why: Acknowledgment action — lower weight than approve/reject

    - element: Open batch trace (batch signal)
      component: Link + Button
      variant: outline
      why: Navigation action — not a decision

    - element: Bulk approve/reject
      component: Button (primary / ghost-destructive)
      variant: same as single-item equivalents
      why: Consistent decision semantics

  modals:
    - element: Bulk action confirmation modal
      component: ConfirmationModal
      props_required: eligibleCount, restrictedCount, decision, note, onConfirm, onCancel

Missing components — new primitive candidates:
  - QueueItemCard: compact polymorphic list card with checkbox, severity badge, type badge, 2-line title, age label. Must be flagged for design system addition before step 3 of implementation sequence.
  - TwoPane: workspace layout primitive providing 320px left + fill-remaining right split with independent scroll. May already exist as WorkstationShell variant — investigate before creating.
```

---

## 12. OPERATIONAL PROBLEMS SOLVED

```yaml
problem_resolutions:
  - problem: Two <details>/<summary> instances ("Queue pulse" and "Review tools") — uncontrolled browser-default state, no keyboard model.
    root_cause: Developer convenience; no controlled collapse primitive available at implementation time.
    structural_solution: "Queue pulse" KPI cards eliminated entirely (Section 4.1 structural reduction). "Review tools" replaced by permanently-visible FilterBar at top of Queue List Rail (Section 4.2 Queue List Rail zone — contents). Controlled state (useState boolean) used for history facts collapse in Decision Panel.
    section_reference: Section 4.1, Section 4.2, Section 11
    measurable_outcome: Zero <details>/<summary> elements in workspace. Filter controls accessible without user interaction. Programmatic open/close state works on all collapsible sections.

  - problem: "Queue tips" GuidanceBlock with 3 marketing-style instruction cards renders before the queue.
    root_cause: Onboarding-style guidance added to reduce user confusion — but treats daily operational users like first-time visitors.
    structural_solution: GuidanceBlock eliminated (Section 4.1 structural reduction). No instructional content above the work queue. Operators see the queue immediately on page load.
    section_reference: Section 4.1
    measurable_outcome: Operator reaches first actionable queue item within 200ms of page render. Zero decorative instruction cards in the production workspace.

  - problem: UPPERCASE tracking labels used throughout badges, section titles, and pill labels at 0.14–0.28em tracking.
    root_cause: Developer copied the pattern from existing components without checking the typography constitution.
    structural_solution: All badge labels use sentence case (Section 9.3 typography specification). All section headers use sentence case. Queue stat pills use sentence case. Anti-pattern enforcement documented with exact replacement rule.
    section_reference: Section 9.3
    measurable_outcome: Zero instances of `uppercase tracking-[*em]` in any label, badge, or pill within the workspace. Scan speed improvement measurable by removing tracking overhead on 20+ repeated badge reads.

  - problem: Raw hex/rgba inline styles — bg-[rgba(...)], border-red-400/30, etc. — 22 instances in current implementation.
    root_cause: Token system was not consulted during component authoring; Tailwind arbitrary values were used for speed.
    structural_solution: Section 9.4 surface token hierarchy specifies all backgrounds by token variable. Section 11 component mapping enforces token-only surfaces. Zero rgba allowed in JSX.
    section_reference: Section 9.4, Section 11
    measurable_outcome: Zero raw hex/rgba values in workspace JSX. All surfaces respond to theme token changes.

  - problem: "Featured next item" uses decorative rounded-3xl + accent border + raw rgba background for visual emphasis.
    root_cause: Visual hierarchy achieved through decoration rather than size/position — Principle 3 violation.
    structural_solution: Next item is the first item in the sorted Queue List Rail — emphasis comes from being at the top and being auto-selected in the Decision Panel on load. No special decorative treatment. Position is the hierarchy signal.
    section_reference: Section 4.2 (Queue List Rail), Section 5.1 (Scan Flow Level 1)
    measurable_outcome: The top-priority item is visually emphasized by selection state (--surface-elevated bg + left border) only — no decorative radius, no accent border, no raw rgba.

  - problem: Three separate locations for approve/reject actions — StickyActionBar, Decision Panel, and Review tools section.
    root_cause: StickyActionBar was added for mobile accessibility; the detail panel buttons existed first; the review tools section replicated them for bulk + single context.
    structural_solution: Approve and Reject buttons exist ONLY in the Decision Panel's sticky decision dock (Section 4.2 Decision Panel zone, acceptance criteria item 1). StickyActionBar retains only metadata (count, preset, refreshed). Bulk actions live in the Bulk Action Bar zone (Section 4.2).
    section_reference: Section 4.2, Section 4.3
    measurable_outcome: Operator has exactly one place to look for the approve/reject action. Cognitive map is consistent across all items.

  - problem: "Queue pulse" 4-metric KPI cards duplicate counts already visible in QueueStatPill strip.
    root_cause: KPI cards were added for visual completeness — the dashboard pattern applied to a queue workspace.
    structural_solution: KPI cards eliminated. Domain count pills (Attendance:N / DPR:N / OCR:N / Stock:N) in Queue List Rail header provide the same information with 6× lower visual weight (Section 4.2 Queue List Rail contents — domain count strip).
    section_reference: Section 4.1, Section 4.2
    measurable_outcome: Zero KPI card elements in the workspace. Domain counts visible in 11px pill labels within the queue rail header.

  - problem: EmptyState component uses uppercase 0.28em tracking eyebrow "Review Queue" — exact anti-pattern from blueprint.
    root_cause: The EmptyState component was authored with the legacy uppercase eyebrow pattern before the typography constitution was established.
    structural_solution: Empty state renders plain sentence-case text: "No pending reviews — queue is clear." No eyebrow, no uppercase, no tracking. Section 4.2 Queue List Rail acceptance criteria explicitly requires this.
    section_reference: Section 4.2, Section 9.3
    measurable_outcome: Zero uppercase tracking labels in empty states. Empty state renders in 2 text lines with standard body typography.
```

---

## 13. IMPLEMENTATION HANDOFF

### 13.1 Build Sequence

```yaml
implementation_sequence:
  step_1: Workspace container + zone scaffold — WorkstationShell + TwoPane layout (320px left + fill-remaining right). Queue Header Bar (sticky, 48px). Queue List Rail (independent scroll container). Decision Panel (independent scroll + sticky dock slot). All zones empty.

  step_2: Data fetching layer — loadInbox() with Promise.allSettled across all 4–6 adapter endpoints. Loading skeleton state for both panes. MutationErrorBanner on partial failure (failedSources). subscribeToWorkflowRefresh hook.

  step_3: Queue List Rail content — FilterBar (preset pills + type select + search input, always visible). Domain count strip (4 pills). QueueItemCard list (compact, sorted by priorityScore). Signals section below tasks. Empty state (plain text). Auto-select first item on load.

  step_4: Decision Panel content — Empty state (no selection). Item header (type badge + severity badge + age label + title + headline). Recommendation text block. Facts grid (FactsGrid component — 2-col key-value). AI confidence badge for OCR items (static). Next step links. History facts (controlled collapse). Review note textarea.

  step_5: Decision actions — sticky decision dock (approve + reject buttons). canApprove/canReject gate logic. requiresDecisionNote enforcement (button disabled state). Escalation notice for blocked items. Signal item action buttons (mark as read / open batch trace). runTaskDecision implementation for all 4 adapter kinds.

  step_6: Bulk selection system — checkbox per QueueItemCard. Bulk Action Bar (conditional render when selectedCount > 0). Bulk note input. ConfirmationModal (eligible + restricted count). runBulkDecision with per-item adapter dispatch.

  step_7: AI and audit visibility — confidence badge in OCR items. Anomaly severity badge in batch items. History facts collapse (controlled state). Audit-level facts from historyFacts().

  step_8: Permission-driven rendering — canReview role gate (role-gate screen for non-review roles). canApproveOcr per item. canApproveReconciliation per item. steelMode conditional for reconciliation + batch lanes.

  step_9: Responsive collapse behavior — mobile full-screen queue list. Detail overlay with "Back to queue" navigation. touch target enforcement (44px minimum). Compact desktop 280px rail adaptation.
```

### 13.2 Critical Constraints

```yaml
critical_constraints:
  - Approve and Reject buttons must exist in exactly one zone — the sticky decision dock in Decision Panel: reason: canonical action location — three competing action surfaces caused the original anti-pattern
  - Zero <details>/<summary> elements anywhere in this workspace: reason: uncontrolled state violates system interaction language
  - Zero raw hex/rgba inline styles — all surfaces use token variables: reason: blueprint constitutional law; 22 violations in current implementation must be eliminated
  - Zero uppercase tracking labels on any badge, pill, or eyebrow: reason: typography constitution; cognitive overhead on a scan-heavy interface
  - FilterBar must be permanently visible — never in a collapse wrapper: reason: filters are the navigation mechanism; hiding them degrades the core workflow
  - After a successful decision, auto-advance selection to the next item: reason: continuous queue processing — supervisor must not manually click to advance
  - QueueItemCard component must be flagged for design system before step 3: reason: new primitive — requires design system approval before implementation begins
  - Do not modify AppShell scroll architecture: reason: AppShell doctrine is constitutional
  - All spacing values must follow the 4px base scale: reason: blueprint law
  - All AI elements are static — no pulse, no glow, no animation: reason: blueprint law (AI trust visibility section)
  - Queue List Rail and Decision Panel must have independent scroll: reason: operator loses context if scrolling one pane moves the other
  - Virtualization on queue list: required if items > 100 (implement from step 3): reason: blueprint law
```

### 13.3 Open Questions

```yaml
open_questions:
  - question: Does a TwoPane workspace layout primitive exist in the component library, or does it need to be created as part of step 1?
    blocking: yes — must resolve before step 1 begins
    owner: frontend team
    decision_needed_by: before step 1 in 13.1

  - question: The dispatch and batch adapters are listed as "pending" in the adapter registry. Should their queue entries be stubbed (placeholder card) or silently omitted during implementation?
    blocking: no — can proceed with current 4 wired adapters; stub or omit is a cosmetic decision
    owner: product owner
    decision_needed_by: before step 3 in 13.1

  - question: Should the "Signals" section (alerts + batches) be included in bulk selection, or are signals excluded from bulk actions by design?
    blocking: no — signals currently have no bulk action in the backend; can proceed with task-only bulk selection
    owner: product owner
    decision_needed_by: before step 6 in 13.1

  - question: What is the correct role gate for the attendance and operator roles who reach /approvals? Current code shows they see a "review work is assigned to supervisors" screen. Should they be silently redirected to /dashboard instead, or does the current informational screen have value?
    blocking: no — can implement current informational screen pattern; redirect is an enhancement
    owner: product owner
    decision_needed_by: before step 8 in 13.1
```

---

## ACCEPTANCE CRITERIA (SPEC COMPLETENESS)

- [x] All 13 sections fully populated — no empty fields, no placeholders
- [x] Every layout zone has a documented existence justification tied to a backend entity or operator need
- [x] Every layout zone has explicit, testable acceptance criteria
- [x] Every component is mapped to an existing primitive OR flagged as new primitive candidate (QueueItemCard, TwoPane)
- [x] Every operational failure from Section 1.3 has a resolution in Section 12
- [x] Reduction audit completed — Queue pulse KPI cards eliminated; GuidanceBlock eliminated; details/summary replaced; triple action surface consolidated
- [x] No anti-patterns present (no gradients, no glow, no pulse on static elements, no UPPERCASE labels, no rgba inline styles)
- [x] All spacing values follow the 4px scale
- [x] All surfaces reference token variables only — no hex values
- [x] Typography follows approved system exactly — sentence case enforced on all labels
- [x] Backend API endpoints verified to exist (confirmed in approvals-page.tsx loadInbox implementation)
- [x] Permission matrix drives zone visibility rules in Section 4.3
- [x] Open questions section populated (4 questions, 1 blocking)
- [x] AI elements marked static: true
- [x] Implementation handoff sequence is complete and ordered

---

## POST-GENERATION VALIDATION

```yaml
self_validation:
  operational_integrity:
    - [x] Every layout zone traces back to a specific backend entity or API endpoint
    - [x] Every zone is justified by a specific operator need or workflow pressure
    - [x] Every zone that exists only for visual composition has been removed (Queue pulse, GuidanceBlock eliminated)
    - [x] Reduction audit was completed — 5 structural reductions documented in Section 4.1 and Section 12

  law_compliance:
    - [x] Every spacing value follows the 4px base scale
    - [x] Every surface references a CSS token variable — no hex values
    - [x] Every text label uses sentence case
    - [x] Every font specification is from the approved type system (Inter UI / JetBrains Mono)
    - [x] Every AI element is marked static — no animations, no glow, no pulse

  kiro_readiness:
    - [x] A Kiro implementation agent can produce working code from this spec without asking clarifying questions
    - [x] All acceptance criteria are testable — not subjective
    - [x] Build sequence is complete and correctly ordered
    - [x] Blocking open question flagged (TwoPane primitive existence — step 1 dependency)

  anti_pattern_check:
    - [x] No gradients specified anywhere
    - [x] No glow effects specified anywhere
    - [x] No pulsing on non-loading elements
    - [x] No UPPERCASE labels anywhere (explicit enforcement note in Section 9.3)
    - [x] No marketing typography
    - [x] No invented workflows without backend backing
    - [x] No fake data or placeholder API paths
    - [x] No decorative panels (Queue pulse 6-card grid eliminated; GuidanceBlock eliminated)

  structural_integrity:
    - [x] Zone interaction rules cover all realtime events that affect the UI
    - [x] Permission matrix is complete and all affected zones are documented
    - [x] Responsive collapse behavior defined for the queue list / detail panel mobile pattern
    - [x] All problem resolutions in Section 12 reference specific sections of the spec
```

---

## 4A. VISUAL STRUCTURAL HIERARCHY BLUEPRINT

### A. Desktop Structural Blueprint (1440px)

```
┌──────────────────────────────────────────────────────────────────────────────────────────┐
│  APPSHELL TOPBAR — "Review queue" / breadcrumb / factory context              [48px]     │
├──────────────────────────────────────────────────────────────────────────────────────────┤
│  QUEUE HEADER BAR [P:3] — sticky ─────────────────────────────────────────── [48px]     │
│  Review queue  │  Open: 14  │  Urgent: 3  │  Refreshed 14:22  │  [Refresh]             │
├──────────────────────┬───────────────────────────────────────────────────────────────────┤
│  QUEUE LIST RAIL [P:1]  320px      │  DECISION PANEL [P:1]  fill-remaining              │
│  ─────────────────────────────     │  ──────────────────────────────────────────────    │
│  FILTER BAR [always visible]       │  ┌──────────────────────────────────────────────┐  │
│  [All][Today][8h+][24h+][OCR][Stk] │  │  TYPE BADGE  SEVERITY  Age label             │  │
│  [Type ▼]  [Search...]             │  │  Item title — 16px / 600                     │  │
│  ─────────────────────────────     │  │  Headline — 13px / text-secondary            │  │
│  Attendance:3  DPR:6  OCR:4  Stk:1 │  │                                              │  │
│  ─────────────────────────────     │  │  Recommendation text — 14px / 400            │  │
│  ☐ [attendance] [critical]         │  │  (most prominent prose in panel)             │  │
│    Rajan Kumar • 02 Jun            │  │                                              │  │
│    Missed punch • 18h waiting      │  │  FACTS GRID [2-col key:value]                │  │
│  ─────────────────────────────     │  │  Employee:  Rajan Kumar (RC-041)             │  │
│  ☐ [entry] [high]                  │  │  Shift:     Morning                          │  │
│    03 Jun • Morning shift          │  │  Punch in:  09:42 ← JetBrains Mono           │  │
│    85% performance • 20min down    │  │  Worked:    06h 12m                          │  │
│  ─────────────────────────────     │  │  Late:      00h 42m                          │  │
│  ☐ [ocr] [warning]                 │  │  [Confidence badge — OCR only, static]       │  │
│    shift_report_03jun.jpg          │  │                                              │  │
│    73% confidence • 3h waiting     │  │  ▸ Show history  (controlled state toggle)   │  │
│  ─────────────────────────────     │  │                                              │  │
│  ─── Signals ───────────────────   │  │  REVIEW NOTE                                 │  │
│  [alert] [high]                    │  │  ┌────────────────────────────────────────┐  │  │
│    Quality issue: Batch #2241      │  │  │  Note textarea (4 rows)                │  │  │
│    Raised 2h ago                   │  │  └────────────────────────────────────────┘  │  │
│                                    │  │  Required for rejection.                     │  │
│                                    │  │                                              │  │
│                                    │  │  Next step links: [Open entry] [Reports]     │  │
│                                    │  └──────────────────────────────────────────────┘  │
│                                    │                                                     │
│                                    │  ╔══════════════════════════════════════════════╗  │
│                                    │  ║  DECISION DOCK [sticky bottom]  [56px]       ║  │
│                                    │  ║  [Approve]  [Reject]                         ║  │
│                                    │  ╚══════════════════════════════════════════════╝  │
├──────────────────────┴───────────────────────────────────────────────────────────────────┤

[P:1] = attention priority 1 (both panes — operator alternates)
[P:3] = attention priority 3 (header — peripheral)
Left rail: compact density, independent scroll
Right panel: default density, independent scroll
Decision dock: sticky to bottom of panel — always visible
```

---

### B. Visual Attention Flow Map

```
Scan 1 (0–200ms): Top item in Queue List Rail — severity badge (critical/high/warning) resolves
  in peripheral vision before conscious reading. Critical items are red. High items are amber.
  The operator knows the most urgent item's severity before reading its title.

Scan 2 (200ms–1s): Item title + recommendation text in Decision Panel
  — Title identifies the specific record/person. Recommendation text (14px, top of facts area)
  is the fastest path to a decision for routine items. If it says "Approve this quickly —
  production story looks normal," the operator can approve in <5 seconds.

Scan 3 (1s–3s): Facts grid in Decision Panel + domain count pills in rail header
  — Facts confirm the decision context: punch times, performance, confidence score, variance.
  Domain count pills give queue health read (how many of each type remain).

Scan 4 (3s+): Review note input → Decision dock → History facts (if needed)
  — Note input is reached only when operator is ready to decide. History only for contested items.
  Decision dock is always visible (sticky) — no scan required to find approve/reject.

Destructive action placement: Reject button is in the decision dock — same location as Approve.
  The Reject button uses secondary/destructive variant (ghost with danger color).
  Placement: Approve LEFT, Reject RIGHT. Never stacked vertically (creates approval-first anchoring).
  Reject requires a note — disabled state makes the requirement unambiguous.

Persistent visibility: Queue List Rail top item always visible. Decision dock always sticky.
  Queue Header Bar always sticky. Operator always knows queue depth and can always reach the decision.
```

---

### C. Spacing & Rhythm Visualization

```
DENSE REGIONS (compact padding — queue list rail):
  - Queue list item cards: 8px horizontal / 6px vertical padding — maximum item density
  - Domain count pills: 4px vertical / 8px horizontal — tight strip, single row
  - FilterBar: 44px height, 8px field gap — single row, no wasted space

BREATHABLE REGIONS (default padding — decision panel):
  - Facts grid cells: 12px padding — accurate reading of key-value pairs requires space
  - Recommendation text block: 16px top margin — must breathe above the facts grid
  - Review note textarea: 16px top margin from facts — visual separation of context and action

VISUAL SILENCE ZONES:
  - Between queue rail and decision panel: 0px gap + 1px border separator
    → The border IS the silence; gap would fragment the two-pane unity
  - Above the decision dock: 24px space before the sticky dock
    → Creates visual separation between content and the terminal action surface
  - Inside the decision dock: 16px between Approve and Reject buttons
    → Prevents accidental mis-tap; the gap communicates "these are different outcomes"
```

---

### D. Component Nesting Hierarchy

```
WorkstationShell ("Review queue")
  ├── QueueHeaderBar [sticky, 48px]
  │     ├── WorkspaceTitle ("Review queue")
  │     ├── OpenCountPill
  │     ├── UrgentCountPill (conditional)
  │     ├── RefreshedTimestamp (JetBrains Mono)
  │     └── RefreshButton (ghost)
  │
  ├── [Conditional] BulkActionBar [sticky, 52px, when selectedCount > 0]
  │     ├── SelectedCount label
  │     ├── Input (bulk note)
  │     ├── Button (Approve N — primary)
  │     ├── Button (Reject N — destructive)
  │     └── Button (Clear selection — ghost)
  │
  ├── TwoPane layout
  │     ├── QueueListRail [320px, independent scroll]
  │     │     ├── FilterBar [sticky top of rail, 44px]
  │     │     │     ├── PresetPills (All / Today / 8h+ / 24h+ / OCR / Stock)
  │     │     │     ├── Select (type filter)
  │     │     │     └── Input (search)
  │     │     ├── DomainCountStrip [Attendance:N DPR:N OCR:N Stock:N]
  │     │     ├── TaskItemsList
  │     │     │     └── QueueItemCard (×N) [new primitive candidate]
  │     │     │           ├── StatusBadge (type)
  │     │     │           ├── StatusBadge (severity)
  │     │     │           ├── ItemTitle (2-line truncate)
  │     │     │           ├── AgeLabel
  │     │     │           └── Checkbox
  │     │     ├── SectionHeader ("Signals")
  │     │     └── SignalItemsList
  │     │           └── QueueItemCard (signal variant — no checkbox)
  │     │
  │     └── DecisionPanel [fill-remaining, independent scroll]
  │           ├── [Conditional: no selection] EmptyState (plain text)
  │           ├── [Conditional: item selected]
  │           │     ├── ItemHeader
  │           │     │     ├── StatusBadge (type)
  │           │     │     ├── StatusBadge (severity)
  │           │     │     ├── AgeLabel (StatusText)
  │           │     │     ├── ItemTitle
  │           │     │     └── ItemHeadline
  │           │     ├── RecommendationBlock (14px prose)
  │           │     ├── FactsGrid [2-col key-value]
  │           │     │     ├── [OCR only] ConfidenceBadge (static: true)
  │           │     │     └── [Batch only] AnomalySeverityBadge (static: true)
  │           │     ├── HistoryFacts [controlled collapse]
  │           │     ├── [Task items only] ReviewNoteTextarea
  │           │     ├── [Blocked items] EscalationNotice
  │           │     └── NextStepLinks
  │           │
  │           └── StickyDecisionDock [56px, sticky bottom]
  │                 ├── [Task items] Button (Approve — primary)
  │                 ├── [Task items] Button (Reject — destructive)
  │                 └── [Signal items] Button (Mark as read / Open batch trace)
  │
  └── ConfirmationModal (bulk action — conditional overlay)
```

All components reference existing primitives. `QueueItemCard` and `TwoPane` flagged as new primitive candidates.

---

### E. Responsive Collapse Blueprint

```
1440px+ (Full workstation):
┌────────────────────────────────────────────────────────────────────────────┐
│  APPSHELL TOPBAR                                                            │
├────────────────────────────────────────────────────────────────────────────┤
│  QUEUE HEADER BAR [sticky, 48px] ─────────────────────────────────────────│
├──────────────────────┬─────────────────────────────────────────────────────┤
│  QUEUE LIST RAIL     │  DECISION PANEL                                     │
│  [320px fixed]       │  [1120px fill]                                      │
│  independent scroll  │  independent scroll + sticky decision dock          │
└──────────────────────┴─────────────────────────────────────────────────────┘

1024px–1279px (Compact desktop):
┌────────────────────────────────────────────────────────────────────────────┐
│  QUEUE HEADER BAR [sticky, 48px] ─────────────────────────────────────────│
├──────────────────────┬─────────────────────────────────────────────────────┤
│  QUEUE LIST RAIL     │  DECISION PANEL                                     │
│  [280px — narrowed]  │  [~744px — adapts to single-column facts grid]     │
│  compact density     │  compact density                                    │
└──────────────────────┴─────────────────────────────────────────────────────┘
Rail narrows to 280px. Facts grid switches to 1-column below 800px panel width.
All decisions remain accessible. No functionality degraded.

<768px (Mobile — sequential mode):
┌─────────────────────────────────────┐
│  APPSHELL TOPBAR (mobile)            │
├─────────────────────────────────────┤
│  QUEUE HEADER BAR [48px]             │
├─────────────────────────────────────┤
│  FILTER BAR [compact, 44px]          │
├─────────────────────────────────────┤
│  QUEUE LIST RAIL [full-width]        │
│  QueueItemCard (×N)                  │
│  [tap item → slides full-screen]     │
└─────────────────────────────────────┘

  [On item tap → full-screen detail overlay]
  ┌─────────────────────────────────────┐
  │  ← Back to queue   [ghost, 44px]    │
  ├─────────────────────────────────────┤
  │  DECISION PANEL [full-screen]        │
  │  Item header                         │
  │  Recommendation text                 │
  │  Facts grid (1-column)               │
  │  Review note                         │
  │  Next step links                     │
  ├─────────────────────────────────────┤
  │  DECISION DOCK [sticky bottom, 56px]│
  │  [Approve]         [Reject]          │
  └─────────────────────────────────────┘

Critical operations preserved on mobile: all approve/reject/signal actions.
Two-pane simultaneous visibility not available — acceptable (secondary use case).
Touch targets: all buttons ≥ 44px; checkboxes padded to 44px tap area.
```

---

### F. Structural Consistency Validation

```yaml
structural_validation:
  - [x] All zones justified by operational necessity — no aesthetic zones present
        (Queue pulse KPI grid eliminated; GuidanceBlock eliminated)
  - [x] Visual dominance matches attention priority numbering
        (Queue list top item + Decision Panel are both P:1; header is P:3 peripheral)
  - [x] Spacing rhythm follows density specifications from Section 9
        (Rail: compact 8/6px; Panel: default 12/8px; 4px base scale throughout)
  - [x] Responsive adaptations preserve all critical operator actions
        (All decisions available on mobile via full-screen detail overlay)
  - [x] Component nesting hierarchy matches Section 11 component mapping
  - [x] No over-zoning — 4 zones (header, rail, panel, bulk bar) is minimum for this workflow type
  - [x] Queue fragmentation avoided — no KPI card explosion; no instruction card explosion
  - [x] No redundant information surfaces — domain counts in pills only (not duplicated in KPI cards)
  - [x] Blueprint matches LEFT-RAIL + MAIN (Queue variant) pattern declared in Section 4.1
```

---

## KIRO TASK CHAINING

After this spec is APPROVED, the following implementation tasks are unblocked:

```yaml
downstream_tasks:
  task_1:
    name: "Approvals — Zone Structure & TwoPane Layout"
    source: Section 4 (Structural Anatomy)
    output: WorkstationShell + QueueHeaderBar (sticky) + TwoPane (320px/fill) + empty zone scaffolds. Requires TwoPane primitive resolution first.

  task_2:
    name: "Approvals — Data Fetching Layer"
    source: Section 3.1 (API Surface)
    output: loadInbox() with Promise.allSettled, loading skeletons, partial-failure error handling, subscribeToWorkflowRefresh, steelMode conditional fetches.

  task_3:
    name: "Approvals — Queue List Rail"
    source: Section 4.2 (Queue List Rail zone), Section 6
    output: FilterBar (always visible), domain count strip, QueueItemCard list (compact, sorted), signals section, empty state (plain text). Requires QueueItemCard primitive.

  task_4:
    name: "Approvals — Decision Panel"
    source: Section 4.2 (Decision Panel zone), Section 7
    output: Item header, recommendation block, FactsGrid, confidence/anomaly badges (static), history facts (controlled collapse), review note textarea, next step links.

  task_5:
    name: "Approvals — Decision Actions"
    source: Section 3.3, Section 7.3
    output: Sticky decision dock, runTaskDecision for all 4 adapter kinds, canApprove/canReject gating, escalation notice, signal item actions, auto-advance on success.

  task_6:
    name: "Approvals — Bulk Selection System"
    source: Section 4.2 (Bulk Action Bar zone), Section 7.2
    output: Checkbox per item, Bulk Action Bar (conditional), ConfirmationModal, runBulkDecision dispatch.

  task_7:
    name: "Approvals — AI & Audit Visibility"
    source: Section 8
    output: OCR ConfidenceBadge (static), steel AnomalySeverityBadge (static), history facts from historyFacts().

  task_8:
    name: "Approvals — Permission-Driven Rendering"
    source: Section 3.6 + Section 4.3
    output: canReview role gate screen, canApproveOcr per item, canApproveReconciliation per item, steelMode lanes.

  task_9:
    name: "Approvals — Responsive & Mobile"
    source: Section 10
    output: Full-screen queue list on mobile, detail overlay with back navigation, touch target enforcement, compact desktop 280px rail adaptation.
```

**Implementation rule:** Every downstream task references THIS spec as its source of truth. Kiro must not deviate from this spec without creating a spec amendment, versioning the file, and noting the deviation reason.

---

*Status: COMPLETE — all 13 sections populated, all acceptance criteria met, post-generation validation passed.*
*Phase C progress: 1/8 complete — /approvals done.*
*Next: /attendance/live — Phase C, Item 2.*
