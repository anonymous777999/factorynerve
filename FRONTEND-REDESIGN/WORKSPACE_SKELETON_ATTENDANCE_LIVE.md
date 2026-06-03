# Attendance Live Board — Workspace Skeleton Architecture
# FactoryNerve OS | Phase 3 Skeleton Specification | Phase C, Item 2
# Route: /attendance/live
# Generated: 2026-06-03
# Status: DRAFT

---

## 1. WORKSPACE OVERVIEW

### 1.1 Identity

| Field | Value |
|---|---|
| Route | `/attendance/live` |
| Workspace Name | Attendance Live Board — Supervisor Floor View |
| Operational Role | Displays the real-time attendance state of every factory employee on a given date. The supervisor monitors the board throughout the shift, escalates exceptions (missed punches, not-punched rows), and navigates directly to `/attendance/review` to resolve them. Auto-refreshes every 5 seconds when live mode is active. |
| Business Impact | If this workspace fails, supervisors cannot see who is present, absent, or in a missed-punch state. Undetected missed punches and absences are not flagged for regularization. The nightly absence scheduler marks affected records, but without live visibility, supervisors cannot intervene in time to prevent payroll and reporting errors. |
| User Population | Supervisor and manager (primary — shift-duration use). Admin and owner (secondary — spot checks). The route access matrix shows this is restricted to supervisor+. |
| Peak Usage Context | Shift start (06:00, 14:00, 22:00) — supervisor scans for not-punched employees. Mid-shift — checks for missed punches or anomalies. Shift close — verifies all rows are completed or flagged. |
| Predecessor Workspaces | `/work-queue` (linked from attendance section), AppShell nav, `/attendance/review` (back navigation) |
| Successor Workspaces | `/attendance/review` (on row click or "Review queue" action — deep-linked via `?focus=` and `?tab=fix` params) |

### 1.2 Operational Importance

The live board is the supervisor's floor-level attendance radar. A factory with 50–200 employees cannot track punch state through manual head counts. The 5-second refresh turns this workspace into an operational signal surface: "How many are working right now? Are any missed punches building up? Who has not punched in yet?" The row click-through to `/attendance/review?focus=` is the escalation path — the supervisor spots an exception on the live board and immediately navigates to fix it without re-searching. This workspace must surface the worst exception row immediately without the supervisor having to read every row.

### 1.3 Current State Failures

- Failure 1: Hero section with `text-3xl md:text-4xl` heading, subtitle "Next signal first.", and `uppercase tracking-wide` eyebrow label renders above all operational data. → Operator must scroll past a decorative section before reaching the attendance data. Adds ~120px of visual wasted space.
- Failure 2: 4-card KPI grid (Factory / Working / Closed / Not Punched) uses `Card` + `CardTitle` components — each card has `CardHeader` + `CardContent` sections. → KPI strip consumes ~160px vertical space. The same four counts are more legible as a single compact metric strip.
- Failure 3: `AttendanceLive.shift_summary` (per-shift breakdown: punched_count, working_count, completed_count, pending_review_count per shift) is fetched from the backend but never rendered in the UI. → Supervisors managing multi-shift factories cannot see which shift has the exception concentration.
- Failure 4: `nextAttentionRow` (the highest-priority exception — missed_punch > not_punched > working) is indicated only via `activeRowId` in the DataTable, which highlights the row. There is no above-table callout identifying it explicitly. → On a table of 60+ rows, the highlighted active row may not be in the visible viewport on load.
- Failure 5: StickyActionBar `leftSlot` renders a custom live mode indicator (badge + dot + title + description) that duplicates the bar's own `statusLabel` and `status` props. → The leftSlot and the bar's built-in status indicator render the same information in the same zone simultaneously.
- Failure 6: The `?live=` URL param controlling auto-refresh is toggled via a "Pause live / Resume live" button in the StickyActionBar but has no visible indicator in the workspace body — the supervisor must read the action bar to know if live mode is active. → State of the most operationally important behavior (auto-refresh) is not persistently visible.

---

## 2. WORKSPACE CLASSIFICATION

| Dimension | Classification | Rationale |
|---|---|---|
| Workspace Type | Realtime Monitoring | TYPE 1 — supervisor observes live state, escalates exceptions. Primary action is navigation, not data entry. |
| Workflow Category | Oversight | Watching the floor state; detecting anomalies; escalating to review. |
| Operational Behavior | Realtime | 5s polling when liveMode=true. staleTime: 0. |
| Data Density | HIGH | One row per factory employee; 8 columns; up to 200 rows at enterprise scale. |
| Realtime Complexity | HIGH | 5s poll is the fastest refresh interval in the system. Missing a refresh cycle means 5s of stale data — acceptable for attendance state. |
| AI Complexity | NONE | No AI systems on this route. |
| Audit Complexity | NONE | Board is read-only — no mutations. Audit is written when the supervisor acts in /attendance/review. |
| Decision Pressure | HIGH | Shift-start congestion — supervisor must identify exceptions within 30 seconds of the shift starting. Late interventions create payroll errors. |

**Classification Implication:** REALTIME MONITORING + HIGH data density + NONE AI + NONE audit = a workspace that must be maximally table-forward. The entire vertical space should be available for the attendance table as fast as possible. The metric strip (totals), live mode indicator, and filter controls must be compact and peripheral — they support the table, they do not precede it. Every pixel above the table is a pixel the supervisor has to scroll past to see exceptions. The shift summary (currently fetched but unused) is the only structural addition this workspace needs — not more KPI cards.

---

## 3. BACKEND OPERATIONAL MAPPING

### 3.1 API Surface

| Endpoint | Method | Purpose | Permission | Key Response Fields | Error States |
|---|---|---|---|---|---|
| `/attendance/live` | GET | Fetch the live attendance board for a given date | supervisor+ | `attendance_date`, `factory_name`, `totals{}`, `shift_summary[]`, `rows[]` | 403 (role too low), 404 (no factory context), empty rows (no records yet for this date) |

Query params accepted by the backend:
- `?attendance_date=YYYY-MM-DD` — defaults to today in factory timezone
- `?status=` — optional; backend accepts status filter (frontend currently filters client-side from full rows response)

### 3.2 Entity Relationship Map

```
AttendanceLive (response envelope)
  ├── totals: { total_people, punched_in, working, completed, not_punched, pending_review, late }
  ├── shift_summary[]: { shift, punched_count, working_count, completed_count, pending_review_count }
  └── rows[]: AttendanceLiveRow[]
        ├── attendance_id (nullable — null if no record yet for today)
        ├── user_id, user_code, name, role, department, designation
        ├── status: AttendanceStatus (not_punched / working / completed / missed_punch / late / half_day / absent)
        ├── review_status: AttendanceReviewStatus (auto / pending_review / approved / rejected)
        ├── punch_in_at, punch_out_at (nullable)
        ├── worked_minutes, late_minutes, overtime_minutes
        └── shift (nullable — inferred when punched in)
```

**Primary entity on this workspace:** `AttendanceLive` response — specifically `rows[]` (the per-employee attendance state) and `totals` (aggregate counts).
**Relationship implication for UI:** The table drives the workspace. Totals drive the metric strip. Shift summary drives the shift breakdown row. All three are from the same single API call.

### 3.3 Workflow State Machine

```
[not_punched] ──[operator punches in]──► [working]  (via /attendance page)
[working]     ──[operator punches out]──► [completed]
[working]     ──[nightly scheduler]────► [missed_punch]
[not_punched] ──[nightly scheduler]────► [absent]
[late]         (sub-state — set at punch-in after grace period)
```

**Frontend implication:** This workspace is read-only — it observes state transitions, it does not trigger them. The supervisor's action is to navigate to `/attendance/review` to trigger corrections. Row status drives visual treatment (danger for missed_punch/absent, warning for not_punched/late, success for working/completed). The 5s poll detects transitions as they happen.

### 3.4 Realtime Contracts

| System | Transport | Update Rate | Zones Affected | Stale State Handling |
|---|---|---|---|---|
| React Query `refetchInterval` | HTTP polling | 5000ms (liveMode=true) | Full rows[], totals{}, shift_summary[] | `isFetching` state drives a visual refresh indicator in the header bar. If poll fails: retain last-known data, show error badge. |
| React Query `refetchOnWindowFocus` | Browser event | On tab focus (liveMode=true) | Full response | Same as above |
| Manual refresh | User action | On button press | Full response | N/A |
| URL param `?live=false` | URL state | Immediate on toggle | Disables refetchInterval | Show "Live paused" indicator in header; data becomes stale after 15s (`staleTime: 15_000`) |

**Stale state behavior:** When `liveMode=false`, the header bar live indicator changes to "Paused" state. Data does not auto-refresh. Supervisor sees refreshedAt timestamp and can manually refresh. The board is not unusable when paused — it shows the last-known state.

### 3.5 AI System Contracts

None. No AI systems on this route.

### 3.6 Permission Matrix

| Role | View | Filter | Navigate to review | Toggle live mode |
|---|---|---|---|---|
| attendance | ✗ (role-gate redirect) | ✗ | ✗ | ✗ |
| operator | ✗ (role-gate redirect) | ✗ | ✗ | ✗ |
| accountant | ✗ (role-gate redirect) | ✗ | ✗ | ✗ |
| supervisor | ✓ | ✓ | ✓ | ✓ |
| manager | ✓ | ✓ | ✓ | ✓ |
| admin | ✓ | ✓ | ✓ | ✓ |
| owner | ✓ | ✓ | ✓ | ✓ |

**Permission implication:** If `canReview` is false (below supervisor), the workspace renders a role-gate screen with links to `/attendance` (operator punch) and `/work-queue`. The table, filter, and all board content are never rendered.

---

## 4. WORKSPACE STRUCTURAL ANATOMY

### 4.1 Layout Pattern

**FULL-WIDTH COMMAND**

Single dominant workspace zone — the attendance table fills available width. No left rail (no queue to navigate). No right context panel (no per-row detail displayed on this page — row click navigates to review). Metric strip and controls are compact above-table zones.

**Pattern selection justification:** The supervisor's only job on this page is to scan the table and identify exceptions. FULL-WIDTH COMMAND maximizes table width, which directly increases the number of rows visible without scrolling. LEFT-RAIL + MAIN was rejected — there is no persistent queue or filter list that merits a 320px rail. A rail would reduce the table width by ~25% with no operational benefit. TRIZONE rejected — no third information pane exists for attendance rows.

**Structural reduction note:**
- Hero section (rounded-panel with large heading + subtitle) eliminated — it precedes operational data with zero information content.
- 4-card KPI grid replaced with a single compact MetricStrip — 4 count values in one row, 40px height. Same data, 75% less vertical space.
- StickyActionBar leftSlot custom content removed — StickyActionBar's own `statusLabel` and `status` props carry the live mode state. Duplicate custom rendering eliminated.
- Shift summary rendered for the first time — `shift_summary[]` data was fetched but unused. It becomes a collapsible shift breakdown row below the metric strip.

---

### 4.2 Zone Definitions

---

#### ZONE: Workspace Header Bar (Top, Sticky)

| Property | Value |
|---|---|
| Operational Role | Persistent context: workspace title, live mode state, date in view, total people count, manual refresh button, and "Review queue" navigation action. |
| Attention Priority | 3 |
| Position | Top — spans full workspace width |
| Width | full-width |
| Height | fixed: 48px |
| Sticky Behavior | always sticky — pins to top on scroll |
| Collapse Behavior | never |
| Scroll Behavior | sticky |
| Density Mode | compact |
| Existence Justification | `AttendanceLive.attendance_date` + `AttendanceLive.totals.total_people` + `liveMode` state — operator must always know date in view, live mode status, and total headcount. These are persistent context items (Section 5.2). |

**Contents:**
- Workspace title: "Attendance board" — 16px / weight 500 / sentence case
- Live mode badge: `StatusBadge` — "Live" (success) when liveMode=true + isFetching false; "Updating" (processing) when isFetching=true; "Paused" (secondary) when liveMode=false. Static badge — no animation.
- Date label: `attendanceDate` formatted as "03 Jun" — `JetBrains Mono`, 12px
- People count: "N people" — 13px / tabular-nums
- "Review queue" button: primary — navigates to `/attendance/review?focus=&tab=fix` with `nextAttentionRow` params
- Manual refresh button: ghost — right-aligned; shows "Refreshing…" during `isFetching`
- "Pause / Resume" toggle: ghost — toggles `?live=` URL param

**Acceptance Criteria:**
- [ ] Header bar is 48px height, always sticky
- [ ] Live mode badge renders in correct semantic state (success / processing / secondary) — no animation
- [ ] "Review queue" button navigates with `?focus=` and `?tab=fix` params when `nextAttentionRow` is non-null
- [ ] Date label renders in JetBrains Mono
- [ ] No hero section, no large heading, no subtitle anywhere in the workspace

---

#### ZONE: Metric Strip

| Property | Value |
|---|---|
| Operational Role | Shows the 4 key aggregate counts from `totals{}` — working, completed, not-punched, pending review — in a single compact horizontal row. Supervisor reads these counts in <1 second to understand floor state. |
| Attention Priority | 2 |
| Position | Below Workspace Header Bar — full-width |
| Width | full-width |
| Height | fixed: 40px |
| Sticky Behavior | not sticky — scrolls with page |
| Collapse Behavior | never |
| Scroll Behavior | inherits shell |
| Density Mode | compact |
| Existence Justification | `AttendanceLive.totals` — working/completed/not_punched/pending_review are the 4 operational counts the supervisor reads at a glance. Replacing the 4-card KPI grid with a single strip preserves the data while eliminating 120px of vertical waste. |

**Contents:**
- 4 inline metric units: `N Working`, `N Completed`, `N Not punched`, `N Pending review` — each with semantic token coloring (success, info, warning, danger respectively).
- Separator: thin vertical rule between each metric unit.
- `total_people` shown as trailing context: "of N total".
- `shift_summary` breakdown toggle: a "Shifts ▾" text button inline at the right of the strip — triggers the Shift Breakdown Row to expand/collapse via controlled state.

**Acceptance Criteria:**
- [ ] Metric strip is 40px height — a single horizontal row, not a card grid
- [ ] All 4 counts use tabular-nums
- [ ] Semantic coloring: working = success token, completed = info token, not_punched = warning token, pending_review = danger token
- [ ] "Shifts" toggle button renders at right of strip — controlled state (useState boolean)
- [ ] No Card components — flat strip layout only

---

#### ZONE: Shift Breakdown Row (Conditional)

| Property | Value |
|---|---|
| Operational Role | Shows per-shift attendance breakdown from `shift_summary[]` — how many punched, working, completed, and pending_review per shift (morning/evening/night). Addresses the currently unrendered `shift_summary` data. |
| Attention Priority | 3 |
| Position | Below Metric Strip — conditional visibility |
| Width | full-width |
| Height | content-driven — one row per shift in summary |
| Sticky Behavior | not sticky |
| Collapse Behavior | collapsed by default — toggled by "Shifts ▾" button in Metric Strip. Controlled state (useState boolean). |
| Scroll Behavior | inherits shell |
| Density Mode | compact |
| Existence Justification | `AttendanceLive.shift_summary[]` — this data is already fetched from the backend and exists in the response. Multi-shift factories need per-shift breakdown to understand whether exceptions are concentrated in one shift. Currently completely unused despite being in the API response. |

**Contents:**
- One compact row per shift in `shift_summary`: shift label + punched / working / completed / pending_review counts as inline pills.
- If `shift_summary` is empty or has one entry: zone hidden entirely (no toggle rendered).

**Acceptance Criteria:**
- [ ] Zone does not render at all when `shift_summary.length <= 1`
- [ ] Zone uses controlled state (useState boolean) — not `<details>/<summary>`
- [ ] Compact — one row per shift, inline pill counts, max 48px height per row
- [ ] Renders `shift_summary[]` data from the API response (currently completely unused)

---

#### ZONE: Filter Bar

| Property | Value |
|---|---|
| Operational Role | Controls the date in view (`?attendance_date=`) and the status filter (`?status=`). URL-persisted via `updateParams`. Filters drive the table content and are visible to the supervisor at all times. |
| Attention Priority | 3 |
| Position | Below Shift Breakdown Row (or Metric Strip when shift row is hidden) |
| Width | full-width |
| Height | 44px (single row) |
| Sticky Behavior | not sticky |
| Collapse Behavior | never — filters are the navigation mechanism |
| Scroll Behavior | inherits shell |
| Density Mode | compact |
| Existence Justification | `?attendance_date=` + `?status=` URL params — date selection is essential for reviewing historical dates or tomorrow's pre-populated records; status filter speeds triage of a specific exception type. |

**Contents:**
- Date input: `attendance_date` — defaults to today. Calendar picker or text input (type="date").
- Status select: All / Working / Missed punch / Not punched / Completed. Maps to `filter` state.
- Active filter chips: shown when filters differ from defaults. "Clear all" clears both to default.

**Acceptance Criteria:**
- [ ] FilterBar uses existing `FilterBar` component — no custom filter implementation
- [ ] Filter state is URL-persisted via `updateParams` (existing pattern)
- [ ] Active filter chips render for non-default values
- [ ] "Clear all" resets date to today + status to "all"

---

#### ZONE: Exception Callout Row (Conditional)

| Property | Value |
|---|---|
| Operational Role | When `nextAttentionRow` is non-null (a missed_punch or not_punched row exists in the filtered set), surfaces that single row's key details in a compact callout above the table. Ensures the exception is visible without requiring the supervisor to scroll to find the highlighted row. |
| Attention Priority | 1 (when visible — the most urgent operational signal) |
| Position | Below Filter Bar — immediately above the table |
| Width | full-width |
| Height | fixed: 48px |
| Sticky Behavior | not sticky |
| Collapse Behavior | hidden when `nextAttentionRow` is null (no exceptions in filtered set) |
| Scroll Behavior | inherits shell |
| Density Mode | compact |
| Existence Justification | `nextAttentionRow` is already computed in the current implementation (missed_punch > not_punched > working priority) but only used as `activeRowId` in the DataTable. The highlighted row may be anywhere in a 60-row table and not visible in the initial viewport. This zone surfaces the worst exception before the operator must scroll. |

**Contents:**
- Exception type label: "Missed punch" or "Not punched" — status badge (danger/warning).
- Employee name: from `nextAttentionRow.name`.
- Shift: from `nextAttentionRow.shift`.
- Direct action link: "Fix this →" — navigates to `/attendance/review?focus={attendance_id}&tab=fix`.

**Acceptance Criteria:**
- [ ] Zone does not render at all when `nextAttentionRow` is null
- [ ] Zone does not render when `nextAttentionRow.status` is "working" or "completed" (only exception states trigger it)
- [ ] "Fix this" link passes `?focus=` and `?tab=fix` params to `/attendance/review`
- [ ] Zone height is 48px — single-line compact callout

---

#### ZONE: Attendance Table (Primary)

| Property | Value |
|---|---|
| Operational Role | The complete attendance grid for all factory employees on the selected date. The supervisor scans for exceptions (danger/warning rows) and clicks rows to navigate to the review workspace. |
| Attention Priority | 1 |
| Position | Below Exception Callout Row (or Filter Bar when no exception) |
| Width | full-width |
| Height | fill-remaining — no fixed height; scrolls with page |
| Sticky Behavior | table header is sticky within the table |
| Collapse Behavior | never |
| Scroll Behavior | inherits shell (page scroll — not independent table scroll) |
| Density Mode | compact |
| Existence Justification | `AttendanceLive.rows[]` — the operational data this workspace exists to show. Every zone above this zone exists only to support table scanning. |

**Contents:**
- Columns: User (name + user_code), Department, Shift, Status (badge), Punch In, Punch Out, Worked (tabular-nums). Role column removed (see reduction audit below).
- Row state: `status = missed_punch` → danger-token row treatment (background + border). `status = not_punched` → warning-token. `status = working` → success-token. `status = completed` → neutral.
- Row click: navigates to `/attendance/review?focus={attendance_id}&attendance_date={date}&tab=fix`.
- `nextAttentionRow` still sets `activeRowId` in DataTable for additional visual emphasis.
- Sorting: enabled on all columns.
- Loading state: `LoadingBoundary` skeleton (existing pattern).
- Empty state: plain text "No rows match this filter" + Clear filters button — no decorative card.

**Acceptance Criteria:**
- [ ] Table uses existing `DataTable` component — no custom table implementation
- [ ] Table header is sticky on scroll
- [ ] Row click navigates to `/attendance/review` with correct URL params
- [ ] Status column uses `StatusBadge` with correct semantic variants
- [ ] Punch In / Punch Out columns use JetBrains Mono timestamps
- [ ] Worked column uses tabular-nums
- [ ] Row-level danger/warning/success background treatment is structural (not color-only — must also have a left-border or row indicator)
- [ ] Empty state is plain text — no UPPERCASE eyebrow, no decorative card

---

### 4.3 Zone Interaction Rules

```yaml
zone_interactions:
  - trigger: React Query refetch fires (5s interval or manual)
    effect: rows[], totals{}, shift_summary[] all update in-place; Metric Strip counts update; Shift Breakdown Row updates if visible; Exception Callout Row re-evaluates nextAttentionRow
    reason: Live board — all zones derive from the same query response

  - trigger: status filter changes (?status= URL param)
    effect: filteredRows recomputed client-side; table re-renders; nextAttentionRow re-evaluated; Exception Callout Row updates; domain count pills in header update to filtered count
    reason: Client-side filtering on the full response (no new API call needed)

  - trigger: attendance_date changes (?attendance_date= URL param)
    effect: New API call fired; all zones enter loading state; response populates all zones
    reason: Different date = different dataset; full reload required

  - trigger: liveMode toggles (?live= URL param)
    effect: refetchInterval activates/deactivates; Live mode badge in header changes state (success/paused); polling dot changes visibility
    reason: Supervisor controls whether the board auto-updates or is static

  - trigger: isFetching = true (background poll in progress)
    effect: Live mode badge shows "Updating" state (processing token); refresh button shows "Refreshing…"
    reason: Visible feedback that the board is self-updating without blocking interaction

  - trigger: "Shifts ▾" toggle clicked in Metric Strip
    effect: Shift Breakdown Row becomes visible / collapses via controlled state
    reason: Per-shift data is optional context — not default-visible

  - trigger: Row clicked in Attendance Table
    effect: Browser navigates to /attendance/review?focus={id}&attendance_date={date}&tab=fix
    reason: Deep-link escalation path — the entire value of the live board is this navigation

  - trigger: nextAttentionRow changes (new exception appears or is resolved)
    effect: Exception Callout Row updates name/status; activeRowId in DataTable updates
    reason: Live data — exception priority re-evaluates on each poll cycle

  - trigger: canReview = false (role check on mount)
    effect: Role-gate screen renders; no API calls made; no table rendered
    reason: Permission matrix — non-review roles must not see the board
```

---

## 5. OPERATIONAL ATTENTION HIERARCHY

### 5.1 Scan Flow

```
LEVEL 1 (0–200ms): Exception Callout Row (when visible — danger/warning badge + name)
  Operational necessity: If there is an active exception (missed_punch, not_punched),
  the supervisor must see it immediately. A 50-row table with a highlighted row somewhere
  in the scroll area fails this requirement. The callout row surfaces it above the fold.

LEVEL 2 (200ms–1s): Metric Strip counts (Working N / Not punched N / Pending N)
  Operational necessity: Aggregate counts tell the supervisor the floor health in one line.
  "42 working, 3 not punched, 1 pending review" tells the shift story in <1 second.

LEVEL 3 (1s–3s): Attendance table — exception rows first (sort by status if danger rows present)
  Operational necessity: After reading the aggregate counts, the supervisor scans for
  specific names. Status badges (danger = red row, warning = amber row) guide the eye.

LEVEL 4 (3s+): Shift breakdown, individual punch times, worked minutes, historical dates
  Operational necessity: Deep context for contested exceptions or multi-shift monitoring.
  Normal supervisors never reach this level in routine scans.
```

### 5.2 Persistent Visibility Requirements

| Element | Reason It Must Persist |
|---|---|
| Workspace Header Bar (live mode badge + date) | Supervisor must always know if the board is live and what date they are viewing |
| "Review queue" button in header | The escalation action must be reachable from any scroll position |
| Metric Strip | Floor health counts must be visible throughout the shift without scrolling |

### 5.3 Contextual Visibility Rules

```yaml
contextual_rules:
  - condition: nextAttentionRow is non-null AND status is missed_punch or not_punched
    shows: Exception Callout Row
    hides: nothing (additive)
    reason: Worst exception must surface above the fold

  - condition: shift_summary.length > 1
    shows: "Shifts ▾" toggle in Metric Strip
    hides: toggle when single-shift factory
    reason: Shift breakdown only meaningful for multi-shift factories

  - condition: showShiftBreakdown = true (controlled state)
    shows: Shift Breakdown Row
    hides: Shift Breakdown Row when false
    reason: Per-shift data is optional depth

  - condition: liveMode = true AND isFetching = false
    shows: Live badge (success state) in header
    hides: nothing
    reason: Board is live and current

  - condition: liveMode = true AND isFetching = true
    shows: Live badge (processing state) in header
    hides: nothing
    reason: Active poll cycle — data is being updated

  - condition: liveMode = false
    shows: Live badge (paused state) in header
    hides: nothing
    reason: Supervisor needs to know auto-refresh is off

  - condition: canReview = false
    shows: Role-gate screen
    hides: Entire board workspace
    reason: Permission matrix

  - condition: filter !== "all" OR attendanceDate !== todayValue()
    shows: Active filter chips in FilterBar
    hides: filter chips when at defaults
    reason: Supervisor must know when viewing a filtered or non-today view
```

---

## 6. TABLE & DATA STRATEGY

### 6.1 Table Role

| Field | Value |
|---|---|
| Primary Purpose | Display the real-time attendance state of every factory employee. Enable exception identification and escalation navigation. |
| Scanning Pattern | Status-grouped / anomaly-first — exception rows (danger, warning) visually differentiated from normal rows (neutral) |
| Primary Decision | Is there an exception row I need to fix right now? If yes, click → navigate to review. |
| Action Trigger | Status = missed_punch (danger) or not_punched (warning) rows trigger navigation. |
| Row Volume | Typical: 20–80 rows / Max: 200 rows / Requires virtualization: yes if > 100 rows |

### 6.2 Column Architecture

| Column | Data Type | Alignment | Width | Sticky | Operational Purpose |
|---|---|---|---|---|---|
| User (name + user_code) | text + code | left | 200px | yes | Identify the employee — primary scan target |
| Department | text | left | 120px | no | Group exceptions by floor area |
| Shift | text | left | 80px | no | Identify which shift the exception belongs to |
| Status | badge | center | 120px | no | Exception signal — the most important column for scanning |
| Punch In | timestamp | left | 110px | no | Verify punch time for late/missed cases |
| Punch Out | timestamp | left | 110px | no | Verify punch-out for missed_punch state |
| Worked | duration | right | 80px | no | Time worked — tabular-nums for alignment |

**Column justification:** Every column above directly enables a specific supervisor decision:
- User: identifies who the exception belongs to
- Department: determines which floor supervisor to contact
- Shift: determines timing context of the exception
- Status: the exception signal — drives scan order
- Punch In/Out: verifies the specific time data for regularization
- Worked: shows impact of the exception on payroll hours

**Columns considered and rejected:**
- Role: removed — role is visible on the review page and does not change exception triage logic. Removes 80px from the table width.
- Designation: removed — too detailed for the live board; available in the review workspace.
- Late minutes / Overtime minutes: removed from primary columns — derivable from worked_minutes and available in review detail. Reduces column count from 10 to 7.
- Source / Note: removed — internal metadata not useful for floor-level monitoring.

### 6.3 Row State Specification

```yaml
row_states:
  normal: var(--surface-card) background, no border treatment — completed or working rows
  anomaly:
    missed_punch: var(--status-danger-bg) row background + 2px left border var(--status-danger-border) — not color-only; structural left border differentiates from color-blind-safe usage
    not_punched: var(--status-warning-bg) row background + 2px left border var(--status-warning-border)
    late: var(--status-warning-bg) row background (lighter weight than not_punched — same color tier)
  selected: var(--surface-elevated) background — activeRowId treatment (nextAttentionRow)
  expanded: N/A — rows do not expand in-place; click navigates to /attendance/review
  action_required: left border 2px danger or warning + background tint — same as anomaly
  loading: DataTable skeleton rows (LoadingBoundary handles this — existing pattern)
```

### 6.4 Inline Actions

```yaml
inline_actions:
  primary:
    action: Navigate to review (row click)
    trigger_condition: Row has attendance_id (i.e., has a record — not just a user placeholder)
    placement: entire row is clickable (onRowClick prop)
  secondary:
    action: N/A — no secondary inline actions
  destructive:
    action: N/A — board is read-only
```

### 6.5 Bulk Actions

None — board is read-only. No bulk actions on this workspace.

### 6.6 Realtime Update Behavior

```yaml
realtime_table_behavior:
  new_row: insert at sorted position (by status severity then name) — no animation
  row_update: in-place update; status badge changes; worked_minutes updates on refetch
  row_removal: N/A — rows are not removed during a shift (an employee who punches out changes status to "completed", row stays)
  operator_conflict: N/A — board is read-only; supervisor cannot mutate rows here
  connection_lost: retain last-known data; isFetching error state; error badge in header; manual refresh still available
```

---

## 7. FORM & INPUT STRATEGY

No forms — workspace is a realtime monitoring board. Date picker and status select in FilterBar are navigation controls, not data entry forms.

---

## 8. AI & AUDIT VISIBILITY STRATEGY

### 8.1 AI Placement Map

None. No AI systems on this route.

### 8.2 Audit Visibility Map

```yaml
audit:
  placement: Not surfaced on this workspace — board is read-only
  trigger: N/A — audit events are written when the supervisor acts in /attendance/review
  events_logged: none on this workspace
  detail_level: N/A
  authorized_roles: N/A
  realtime_updates: N/A
  max_events_shown: N/A
```

### 8.3 Anomaly Visibility

```yaml
anomaly:
  detection_source: rule-based (status field from backend — missed_punch, not_punched are rule-derived states)
  placement:
    - Exception Callout Row (above table — worst exception surfaced explicitly)
    - Table row background + left border (structural row-level treatment)
    - Metric Strip "pending_review" count (danger token)
  severity_levels:
    - level: missed_punch
      structural_treatment: danger-token row background + 2px left border; Exception Callout Row renders with danger badge
      action_required: yes — supervisor must navigate to review
    - level: not_punched
      structural_treatment: warning-token row background + 2px left border; Exception Callout Row renders with warning badge
      action_required: yes — supervisor should verify or create regularization
    - level: late
      structural_treatment: warning-token row background (lighter) — no left border (lower urgency than not_punched)
      action_required: no — late is informational for supervisors unless it reaches a threshold
  dismissible: no — status is backend-driven
  persistence: until resolved via /attendance/review (which updates the record; next 5s poll reflects new status)
```

---

## 9. DENSITY, SPACING & LAYOUT RHYTHM

### 9.1 Density Mode

```yaml
density:
  default: compact
  justification: Supervisors scan 20–200 rows. Every extra pixel of row height reduces the number of exceptions visible without scrolling. Compact mode is the only operationally defensible default for a monitoring board.
  operator_switchable: no — density override not appropriate for a live monitoring board
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
```

### 9.2 Spacing Rhythm

```yaml
spacing:
  section_gap: 8px — very tight between above-table zones (header → metric strip → filter → exception callout → table). Every pixel above the table is a pixel of table not visible.
  zone_gap: 8px — same rationale
  card_padding: N/A — no card components in the workspace body
  sticky_header_height: 48px — Workspace Header Bar
  action_dock_height: N/A — no action dock
  inline_label_gap: 8px
  form_group_gap:
    compact: 12px
    default: 16px
    comfortable: 24px
  above_table_total_height: 48px (header) + 40px (metric) + 44px (filter) + 48px (exception, conditional) = 132–180px. Goal: table visible without scrolling on 768px-height displays.
```

### 9.3 Typography Specification

```yaml
typography:
  workspace_title: 16px / weight 500 / Inter UI / sentence case
  section_header: 13px / weight 500 / Inter UI / sentence case
  table_header: 12px / weight 500 / Inter UI / sentence case  # NOT uppercase — sentence case only
  table_cell: 13px / weight 400 / Inter UI
  form_label: 13px / weight 400 / Inter UI
  form_input: 14px / weight 400 / Inter UI
  status_badge: 11px / weight 600 / Inter UI / sentence case
  ai_reasoning: N/A
  audit_entry: N/A
  numeric_data: 13px / tabular-nums / right-aligned  # worked_minutes column
  timestamp: 12px / JetBrains Mono  # punch_in_at, punch_out_at
  id_reference: 12px / JetBrains Mono  # user_code
  error_message: 12px / weight 400 / Inter UI
  # Workspace-specific:
  metric_count: 20px / weight 600 / Inter UI / tabular-nums  # Metric Strip count values
  metric_label: 12px / weight 400 / Inter UI / sentence case  # "Working", "Not punched"
  live_badge: 11px / weight 600 / Inter UI / sentence case  # "Live" / "Paused" / "Updating"
```

**Anti-pattern elimination:** The current `text-sm uppercase tracking-wide text-text-secondary` eyebrow in the hero section is eliminated along with the hero section. No uppercase labels anywhere.

### 9.4 Surface Token Hierarchy

```yaml
surfaces:
  workspace_background: var(--surface-app)
  primary_panel: var(--surface-shell)
  secondary_panel: var(--surface-panel)
  card_surface: var(--surface-card)  # table rows
  input_surface: var(--surface-card)  # FilterBar inputs
  overlay_surface: N/A — no overlays on this workspace
  sticky_surface: var(--surface-shell)  # Workspace Header Bar
  row_exception_danger: var(--status-danger-bg)  # missed_punch rows
  row_exception_warning: var(--status-warning-bg)  # not_punched / late rows
  row_active: var(--surface-elevated)  # nextAttentionRow
```

---

## 10. RESPONSIVE & OPERATOR ADAPTATION

### 10.1 Desktop Workstation (Primary Target)

```yaml
desktop_workstation:
  min_width: 1280px
  optimal_width: 1440px–1920px
  all_zones_visible: yes
  density_mode: compact
  notes: At 1440px, the 7-column table fits comfortably within max-w-7xl (1280px). All columns visible without horizontal scroll.
```

### 10.2 Compact Desktop (Secondary)

```yaml
compact_desktop:
  width_range: 1024px–1279px
  density_mode: compact
  adaptations:
    - Attendance Table: Department column hides below 1100px — reduces column count to 6; essential columns (User, Status, Punch In, Punch Out, Worked) remain
    - Metric Strip: remains single-row; counts may wrap to 2 rows below 768px
  degraded_functionality: no — all exceptions visible; all navigation available
```

### 10.3 Mobile / Tablet (Degraded Mode)

```yaml
mobile:
  width_range: <768px
  strategy: stacked — table columns collapse to 3 (User, Status, Worked); Metric Strip stacks to 2×2 grid; Exception Callout Row remains full-width
  operational_continuity: Exception identification preserved; row navigation preserved; live mode toggle preserved
  zones_hidden:
    - Shift Breakdown Row hidden on mobile (too dense for small viewport)
    - Department, Punch In, Punch Out columns hidden (table collapses to essential columns)
  touch_targets: 44px minimum row height on mobile (overrides compact density)
  touch_adjustments:
    - Row tap area: full-width, 44px minimum height
    - FilterBar: inputs expand to full-width stacked layout
    - Header buttons: 44px tap targets
```

### 10.4 Rail Collapse Behavior

```yaml
rail_collapse:
  left_rail:
    collapse_trigger: N/A — no left rail
  right_rail:
    collapse_trigger: N/A — no right rail
```

---

## 11. COMPONENT MAPPING

```yaml
component_mapping:
  workspace_container:
    component: WorkstationShell (max-w-7xl, compact density)
    reason: Consistent AppShell integration; full-width table pattern established in blueprint

  zones:
    - zone: Workspace Header Bar
      component: StickyTopbar or WorkspaceHeaderBar primitive
      props_required: title, liveBadge state, date label, peopleCount, onReviewQueue, onToggleLive, onRefresh, isFetching
      variant: compact — 48px

    - zone: Metric Strip
      component: MetricStrip primitive (or inline flex row — not Card grid)
      props_required: working, completed, not_punched, pending_review, total_people, onShiftsToggle, showShiftsToggle
      variant: compact horizontal strip

    - zone: Shift Breakdown Row
      component: ShiftBreakdownRow (inline compact row — or SectionPanel compact)
      props_required: shift_summary[], visible (controlled boolean)
      variant: compact — one row per shift
      note: No existing primitive — flag as new primitive candidate

    - zone: Filter Bar
      component: FilterBar (existing component — already used in current implementation)
      props_required: fields (date + status), activeFilters, onClearAll
      variant: compact

    - zone: Exception Callout Row
      component: InlineAlert (warning/danger variant) or custom compact row
      props_required: status, name, shift, onFix (navigation handler)
      variant: compact 48px — new primitive candidate (InlineExceptionCallout)

    - zone: Attendance Table
      component: DataTable (existing component — already used)
      props_required: columns, data (filteredRows), activeRowId, onRowClick, enableSorting, ariaLabel
      variant: compact density, sticky header

  tables:
    - table: Attendance Live Table
      component: DataTable
      virtualization_required: yes — threshold 100 rows
      sticky_header: yes
      density_override: compact

  status_elements:
    - element: Status badge (per row)
      component: Badge / StatusBadge
      semantic_variant: destructive (missed_punch), success (working), info (completed), warning (not_punched/late)

    - element: Live mode badge (header)
      component: StatusBadge
      semantic_variant: success (live), processing (updating), secondary (paused)
      static: true  # No animation even on "updating" state — badge label change only

  action_elements:
    - element: Review queue button
      component: Button
      variant: primary
      why: Primary escalation action — must stand out in header

    - element: Pause / Resume live toggle
      component: Button
      variant: ghost
      why: Secondary control — lower weight

    - element: Manual refresh
      component: Button
      variant: ghost
      why: Tertiary utility

    - element: "Fix this" link in Exception Callout
      component: Link + Button or anchor
      variant: outline / compact
      why: Directional action to escalation path

    - element: "Shifts ▾" toggle
      component: ghost text button
      variant: ghost — inline in Metric Strip
      why: Lowest visual weight — on-demand depth

Missing components — new primitive candidates:
  - ShiftBreakdownRow: compact per-shift metric row. Multi-shift factory context. Needs design system addition.
  - InlineExceptionCallout: compact 48px callout strip for surfacing the top exception row above the table. Needs design system addition.
  Both flagged for approval before step 3 of implementation sequence.
```

---

## 12. OPERATIONAL PROBLEMS SOLVED

```yaml
problem_resolutions:
  - problem: Hero section with 3xl/4xl heading, subtitle, and uppercase tracking-wide eyebrow renders above all operational data.
    root_cause: Marketing-style page entry section applied to an operational monitoring workspace.
    structural_solution: Hero section eliminated entirely (Section 4.1 structural reduction). Workspace title "Attendance board" lives in the 48px sticky header bar. No heading larger than 16px on this workspace.
    section_reference: Section 4.1, Section 4.2 (Workspace Header Bar)
    measurable_outcome: Zero decorative sections above the metric strip. Metric strip is visible at the top of the viewport on page load without any scroll.

  - problem: 4-card KPI grid (Factory / Working / Closed / Not Punched) consumes ~160px vertical space with Card + CardHeader + CardContent structure.
    root_cause: Dashboard-pattern KPI cards applied to a monitoring workspace that needs maximum table visibility.
    structural_solution: 4-card grid replaced with Metric Strip — 40px single horizontal row with same 4 counts (Section 4.2 Metric Strip zone). 120px of vertical space reclaimed for the table.
    section_reference: Section 4.2, Section 4.1
    measurable_outcome: 120px additional table height at standard 1080p display (768px content height). Supervisor sees ~3 additional rows without scrolling.

  - problem: shift_summary[] data is fetched from the backend but never rendered in the UI.
    root_cause: Oversight — the AttendanceLive response includes shift_summary[] but the original implementation only used totals{} and rows[].
    structural_solution: Shift Breakdown Row zone added (Section 4.2) — renders shift_summary[] as compact per-shift breakdown, toggled by "Shifts ▾" in the Metric Strip. Uses controlled state (useState).
    section_reference: Section 4.2 (Shift Breakdown Row), Section 3.2 (Entity Relationship Map)
    measurable_outcome: Multi-shift factory supervisors can see exception concentration by shift (e.g., "Evening shift has 3 not_punched" vs "Morning has 0"). Previously invisible despite being in the API response.

  - problem: nextAttentionRow is only indicated via activeRowId in the DataTable — highlighted row may be anywhere in a 60-row table and not visible in the initial viewport.
    root_cause: The active row highlight relies on the user scrolling to find the highlighted row. No above-table callout existed.
    structural_solution: Exception Callout Row zone added (Section 4.2) — surfaces the worst exception above the table with employee name + status + "Fix this" direct link. Renders only when nextAttentionRow has an exception status.
    section_reference: Section 4.2 (Exception Callout Row), Section 5.1 (Scan Level 1)
    measurable_outcome: Worst exception is visible above the fold without any scrolling. "Fix this" link navigates directly with the correct ?focus= params. Zero scroll required to identify and act on the worst exception.

  - problem: StickyActionBar leftSlot renders a custom live mode indicator (badge + dot + title + description) that duplicates the bar's own statusLabel/status props — same information rendered twice.
    root_cause: leftSlot was customized after the bar's built-in status props were already in place, creating duplication.
    structural_solution: Live mode state lives exclusively in the Workspace Header Bar (Section 4.2) as a StatusBadge. StickyActionBar is not used on this workspace — its functions are distributed to the simpler 48px header bar pattern. Action buttons (Review queue, Pause, Refresh) are in the header bar.
    section_reference: Section 4.2 (Workspace Header Bar), Section 11
    measurable_outcome: Single location for live mode state. No duplicate status rendering. Header bar is self-contained and comprehensible.

  - problem: Live mode on/off state has no visible indicator in the workspace body — supervisor must read the action bar to know if auto-refresh is active.
    root_cause: The liveMode boolean drove only the refetchInterval; no persistent visible indicator existed other than the action bar button label.
    structural_solution: StatusBadge in the Workspace Header Bar always shows "Live" / "Updating" / "Paused" state (Section 4.2 Workspace Header Bar). This is a sticky persistent element — visible at all scroll positions.
    section_reference: Section 4.2, Section 5.3
    measurable_outcome: Live mode state is persistently visible at the top of the page at all scroll positions. Supervisor always knows if the board is auto-refreshing.
```

---

## 13. IMPLEMENTATION HANDOFF

### 13.1 Build Sequence

```yaml
implementation_sequence:
  step_1: Workspace container + zone scaffold — WorkstationShell + sticky header bar (48px) + metric strip placeholder + filter bar placeholder + table placeholder. No content yet.

  step_2: Data fetching — useQuery(queryKeys.attendance.live, getLiveAttendance, { refetchInterval: liveMode ? 5000 : false, staleTime: liveMode ? 0 : 15000, refetchOnWindowFocus: liveMode }). Loading skeleton via LoadingBoundary. canReview role gate screen.

  step_3: Workspace Header Bar — live mode badge (3 states), date label, people count, "Review queue" primary button with nextAttentionRow params, "Pause/Resume" ghost toggle, manual refresh ghost button.

  step_4: Metric Strip — 4 inline counts (working/completed/not_punched/pending_review) with semantic token colors, tabular-nums, total_people context, "Shifts" toggle (conditional on shift_summary.length > 1).

  step_5: Attendance Table — DataTable with 7 columns, compact density, sticky header, onRowClick navigation, activeRowId (nextAttentionRow), row state CSS (danger/warning left border + bg tint). LoadingBoundary empty state (plain text).

  step_6: Filter Bar — existing FilterBar component, date + status fields, URL-persisted via updateParams, active filter chips, clear all.

  step_7: Exception Callout Row — conditional render when nextAttentionRow has exception status. Name + status badge + shift + "Fix this" link.

  step_8: Shift Breakdown Row — conditional render (shift_summary.length > 1). Controlled state toggle. Per-shift compact rows from shift_summary[].

  step_9: Responsive adaptations — Department column hide below 1100px. Mobile column collapse (3 columns). Touch target enforcement. Metric Strip 2×2 wrap on mobile.
```

### 13.2 Critical Constraints

```yaml
critical_constraints:
  - No hero section, no large heading, no subtitle: reason: marketing-style entry eliminated — operational workspace law
  - Metric Strip must be a flat horizontal row — not a Card grid: reason: 4-card grid wastes 120px of table space
  - shift_summary[] must be rendered — it is fetched and currently wasted: reason: multi-shift factory operational requirement
  - Exception Callout Row must surface nextAttentionRow above the table: reason: highlighted row in a 60-row table is not visible without scroll — this is a P0 operational failure
  - Live mode badge must be persistent in the sticky header: reason: supervisor must always know if auto-refresh is active
  - StatusBadge on live mode indicator is static — no animation: reason: blueprint law (AI-level applies to all ambient status indicators)
  - Row state treatment must be structural (left border + background tint): reason: not color-only — accessibility requirement
  - Table virtualization required if rows > 100: reason: blueprint law
  - All spacing values must follow the 4px base scale: reason: blueprint law
  - All surfaces use token variables, no hex: reason: blueprint law
  - Do not modify AppShell scroll architecture: reason: AppShell doctrine
```

### 13.3 Open Questions

```yaml
open_questions:
  - question: Does the backend /attendance/live endpoint support a ?status= filter param, or is filtering always client-side from the full response? Current frontend filters client-side, but if the table grows to 200+ rows, server-side filtering would reduce payload.
    blocking: no — client-side filtering works for current scale; server-side is a future optimization
    owner: backend team
    decision_needed_by: before virtualization threshold review (step 5)

  - question: ShiftBreakdownRow and InlineExceptionCallout are new primitive candidates. Do they need formal design system approval before implementation, or can they be implemented as local components within the attendance feature?
    blocking: yes — determines whether step 7 and step 8 wait for design system review or proceed as local implementations
    owner: frontend team
    decision_needed_by: before step 7 in 13.1

  - question: Should the Exception Callout Row show only the single worst exception, or should it show all exceptions (e.g., "3 missed punches — fix the oldest first")? Current nextAttentionRow logic surfaces only one.
    blocking: no — single-exception callout is a valid starting implementation
    owner: product owner
    decision_needed_by: before step 7 in 13.1
```

---

## ACCEPTANCE CRITERIA (SPEC COMPLETENESS)

- [x] All 13 sections fully populated — no empty fields, no placeholders
- [x] Every layout zone has a documented existence justification tied to a backend entity or operator need
- [x] Every layout zone has explicit, testable acceptance criteria
- [x] Every component is mapped to an existing primitive OR flagged (ShiftBreakdownRow, InlineExceptionCallout)
- [x] Every operational failure from Section 1.3 has a resolution in Section 12
- [x] Reduction audit completed — hero section eliminated; 4-card KPI grid replaced with metric strip; leftSlot duplication removed
- [x] No anti-patterns present (no gradients, no glow, no pulse, no UPPERCASE labels, no rgba inline)
- [x] All spacing values follow the 4px scale
- [x] All surfaces reference token variables only
- [x] Typography follows approved system exactly
- [x] Backend API endpoint verified (`/attendance/live` confirmed in lib/attendance.ts and live-page.tsx)
- [x] Permission matrix drives zone visibility (canReview role gate)
- [x] Open questions section populated (3 questions, 1 blocking)
- [x] AI elements: N/A — no AI on this route; static rule preserved for live mode badge
- [x] Implementation handoff sequence complete and ordered

---

## POST-GENERATION VALIDATION

```yaml
self_validation:
  operational_integrity:
    - [x] Every zone traces to a specific backend entity or API endpoint
    - [x] Every zone justified by a specific operator need (hero eliminated; shift_summary finally rendered)
    - [x] No visual-composition-only zones present
    - [x] Reduction audit complete — 3 structural reductions documented in Section 4.1 and 12

  law_compliance:
    - [x] All spacing follows 4px base scale
    - [x] All surfaces use CSS token variables
    - [x] All text labels sentence case — `uppercase tracking-wide` eyebrow eliminated
    - [x] All font specs from approved type system (Inter UI / JetBrains Mono)
    - [x] Live mode badge marked static — no animation

  kiro_readiness:
    - [x] Kiro can produce working code without clarifying questions
    - [x] All acceptance criteria are testable
    - [x] Build sequence complete and ordered
    - [x] Blocking open question flagged (primitive candidates — step 7 dependency)

  anti_pattern_check:
    - [x] No gradients
    - [x] No glow effects
    - [x] No pulsing on non-loading elements
    - [x] No UPPERCASE labels (hero section eyebrow eliminated)
    - [x] No marketing typography (3xl/4xl heading eliminated with hero section)
    - [x] No invented workflows — shift_summary data confirmed in API response
    - [x] No fake API paths — getLiveAttendance confirmed in lib/attendance.ts
    - [x] No decorative panels (4-card KPI grid → compact metric strip)

  structural_integrity:
    - [x] Zone interaction rules cover all realtime events (5s poll, manual refresh, filter change, date change, liveMode toggle)
    - [x] Permission matrix complete (canReview role gate)
    - [x] Responsive collapse defined for all columns and zones
    - [x] All Section 12 resolutions reference specific spec sections
```

---

## 4A. VISUAL STRUCTURAL HIERARCHY BLUEPRINT

### A. Desktop Structural Blueprint (1440px)

```
┌──────────────────────────────────────────────────────────────────────────────────────┐
│  APPSHELL TOPBAR — breadcrumb / factory context                           [48px]     │
├──────────────────────────────────────────────────────────────────────────────────────┤
│  WORKSPACE HEADER BAR [P:3] — sticky ──────────────────────────────────── [48px]    │
│  Attendance board  │  ● Live  │  03 Jun  │  47 people  │  [Review queue]  [Pause]  │
├──────────────────────────────────────────────────────────────────────────────────────┤
│  METRIC STRIP [P:2] ─────────────────────────────────────────────────────  [40px]   │
│  42 Working  │  3 Completed  │  2 Not punched  │  1 Pending review  │  Shifts ▾    │
├──────────────────────────────────────────────────────────────────────────────────────┤
│  [SHIFT BREAKDOWN ROW — conditional, controlled state]  ─────────────────  [48px]   │
│  Morning: 28 punched / 22 working / 3 completed / 1 pending                         │
│  Evening: 14 punched / 14 working / 0 completed / 0 pending                         │
├──────────────────────────────────────────────────────────────────────────────────────┤
│  FILTER BAR ────────────────────────────────────────────────────────────── [44px]   │
│  Date: [03 Jun 2026 ▾]   Status: [All ▾]   [✕ Active chips]                        │
├──────────────────────────────────────────────────────────────────────────────────────┤
│  EXCEPTION CALLOUT ROW [P:1] — conditional ─────────────────────────────  [48px]   │
│  ⚠ Missed punch  │  Rajan Kumar  │  Morning shift  │  [Fix this →]                  │
├──────────────────────────────────────────────────────────────────────────────────────┤
│  ATTENDANCE TABLE [P:1] — fill-remaining ──────────────────────────────────────── │
│  User              Dept       Shift    Status         Punch In  Punch Out  Worked   │
│  ─────────────────────────────────────────────────────────────────────────────────  │
│  ║ Rajan Kumar     Finishing  Morning  [Missed punch]  09:02     —         06h 12m  │ ← danger row (2px left border)
│  │ Priya Sharma    Welding    Morning  [Not punched]   —          —         0h 0m   │ ← warning row
│  │ Amit Patel      Casting    Evening  [Working]       14:05      —         02h 44m │ ← neutral
│  │ Sunita Devi     QC         Morning  [Completed]     06:12     14:18      07h 54m │ ← neutral
│  │ ...                                                                              │
└──────────────────────────────────────────────────────────────────────────────────────┘

Total above-table height:
  Sticky header: 48px
  Metric strip: 40px
  Shift breakdown (if visible): ~96px (2 shifts)
  Filter bar: 44px
  Exception callout (if visible): 48px
  = 180–276px above table.
  At 1080p (768px content height), table gets 492–588px — ~14–16 visible rows at 36px compact height.
  Previous layout (hero 120px + 4-card grid 160px + StickyActionBar 56px + filter 44px = 380px above table):
  Table got only ~388px — ~10–11 rows. Net improvement: +3–5 visible rows.
```

---

### B. Visual Attention Flow Map

```
Scan 1 (0–200ms): Exception Callout Row — danger/warning badge + name
  — If visible, this is the P:1 element. Danger red or warning amber resolves in
  peripheral vision. The name "Rajan Kumar" and "Missed punch" resolve in the first
  conscious scan. Supervisor knows who to fix before reading any other zone.
  — If no exception: Metric Strip "Not punched: 2" resolves as P:1 — counts drive urgency.

Scan 2 (200ms–1s): Metric Strip counts — Working / Not punched / Pending review
  — "42 working, 2 not punched, 1 pending" tells the shift story completely.
  — Supervisor decides: Is this a routine day? Or do I need to escalate immediately?

Scan 3 (1s–3s): Attendance Table — exception rows (danger/warning) at top via status
  — Danger rows have left border + background tint — found by structural treatment before label.
  — Supervisor identifies specific names for the exceptions already signaled by counts.

Scan 4 (3s+): Punch times, worked minutes, historical date view, shift breakdown
  — Deep context for contested or complex exceptions.
  — Normal supervisors in routine shifts never reach this level.

Destructive action: None on this workspace — board is read-only. The "Fix this" link is a
navigation action, not a mutation. The most consequential action (navigating to review)
is placed at Level 1 (Exception Callout Row) for the exception case, and in the sticky
header ("Review queue") for the general case.

Persistent visibility: Header bar (live badge + date) never scrolls away. "Review queue"
button always reachable. Exception callout is above the fold — never requires scroll.
```

---

### C. Spacing & Rhythm Visualization

```
DENSE REGIONS (compact — maximum table visibility):
  - Workspace Header Bar: 48px, no internal padding waste
  - Metric Strip: 40px — 4 counts in one row, 8px gap between units
  - Exception Callout Row: 48px — single-line compact callout
  - Filter Bar: 44px — standard compact filter row
  - Table rows: 36px compact height — maximum rows in viewport

BREATHABLE REGIONS (intentional space):
  - Between metric units in strip: 12px separator gap — counts need visual separation
  - Between filter bar and table: 8px — visual breath before the data surface

VISUAL SILENCE ZONES:
  - 8px gaps between above-table zones
    → Tight but legible. Each zone is structurally distinct; silence is minimal.
  - Table right margin: consistent with max-w-7xl — workspace does not span 100vw
    → Lateral silence prevents the table from feeling cramped against browser edges.

Anti-pattern from current implementation — eliminated:
  - 120px hero section (rounded-panel, large heading) = 120px of silence that communicates nothing operational
  - 160px 4-card KPI grid = same data as metric strip at 3× the vertical cost
```

---

### D. Component Nesting Hierarchy

```
WorkstationShell ("Attendance board", compact density, max-w-7xl)
  ├── WorkspaceHeaderBar [sticky, 48px]
  │     ├── WorkspaceTitle ("Attendance board")
  │     ├── StatusBadge (live mode — static: true)
  │     ├── DateLabel (JetBrains Mono, 12px)
  │     ├── PeopleCount (tabular-nums, 13px)
  │     ├── Button (Review queue — primary)
  │     ├── Button (Pause/Resume — ghost)
  │     └── Button (Refresh — ghost, disabled when isFetching)
  │
  ├── MetricStrip [40px, horizontal]
  │     ├── MetricUnit (Working, success token)
  │     ├── MetricUnit (Completed, info token)
  │     ├── MetricUnit (Not punched, warning token)
  │     ├── MetricUnit (Pending review, danger token)
  │     ├── MetricUnit (of N total, neutral)
  │     └── [Conditional] ShiftsToggle ghost button
  │
  ├── [Conditional] ShiftBreakdownRow [controlled state]
  │     └── ShiftRow (×N per shift_summary)
  │           ├── ShiftLabel
  │           └── ShiftCounts (punched/working/completed/pending pills)
  │
  ├── FilterBar (existing component)
  │     ├── DateField (attendance_date)
  │     ├── SelectField (status)
  │     └── ActiveFilterChips
  │
  ├── [Conditional] InlineExceptionCallout [48px, new primitive candidate]
  │     ├── StatusBadge (missed_punch / not_punched)
  │     ├── EmployeeName
  │     ├── ShiftLabel
  │     └── Link → /attendance/review?focus=&tab=fix
  │
  └── LoadingBoundary
        └── DataTable (AttendanceRow, compact)
              └── columns: User | Department | Shift | Status | Punch In | Punch Out | Worked
```

---

### E. Responsive Collapse Blueprint

```
1440px+ (Full workstation):
┌─────────────────────────────────────────────────────────────────────────────────┐
│  HEADER BAR [48px sticky] ─────────────────────────────────────────────────────│
│  METRIC STRIP [40px] ──────────────────────────────────────────────────────────│
│  [SHIFT BREAKDOWN — conditional] ──────────────────────────────────────────────│
│  FILTER BAR [44px] ────────────────────────────────────────────────────────────│
│  [EXCEPTION CALLOUT — conditional] ────────────────────────────────────────────│
│  ATTENDANCE TABLE [full-width, 7 columns, compact rows] ───────────────────────│
└─────────────────────────────────────────────────────────────────────────────────┘

1024px–1279px (Compact desktop — Department column hides):
┌─────────────────────────────────────────────────────────────────────────────────┐
│  HEADER BAR [48px] ────────────────────────────────────────────────────────────│
│  METRIC STRIP [40px] ──────────────────────────────────────────────────────────│
│  FILTER BAR [44px] ────────────────────────────────────────────────────────────│
│  [EXCEPTION CALLOUT — conditional] ────────────────────────────────────────────│
│  ATTENDANCE TABLE [6 columns — Department hidden] ─────────────────────────────│
└─────────────────────────────────────────────────────────────────────────────────┘

<768px (Mobile — stacked, essential columns only):
┌─────────────────────────────┐
│  HEADER BAR [48px sticky]   │
│  (compact — title + badge)  │
├─────────────────────────────┤
│  METRIC STRIP [2×2 wrap]    │
│  42 Working   3 Completed   │
│  2 Not punch  1 Pending     │
├─────────────────────────────┤
│  FILTER BAR [full-width     │
│  stacked: date / status]    │
├─────────────────────────────┤
│  [EXCEPTION CALLOUT]        │
│  (full-width if visible)    │
├─────────────────────────────┤
│  TABLE [3 columns]          │
│  User | Status | Worked     │
│  (Shift, Dept, Punch In/Out │
│   hidden on mobile)         │
└─────────────────────────────┘
All navigation (row click → review) preserved.
Touch targets: 44px minimum row height.
Shift breakdown hidden on mobile.
```

---

### F. Structural Consistency Validation

```yaml
structural_validation:
  - [x] All zones justified by operational necessity (hero eliminated; shift_summary finally used)
  - [x] Visual dominance matches attention priority (Exception Callout > Metric Strip > Table > Header)
  - [x] Spacing rhythm follows compact density from Section 9 (8px zone gaps; 36px rows)
  - [x] Responsive adaptations preserve all critical operations (exception identification, row navigation)
  - [x] Component nesting matches Section 11 component mapping
  - [x] No over-zoning — 6 zones (header, metric, shift, filter, exception, table) all operationally justified
  - [x] No KPI card explosion (4-card grid → flat metric strip)
  - [x] No duplicate information surfaces (StickyActionBar leftSlot duplication eliminated)
  - [x] Blueprint matches FULL-WIDTH COMMAND pattern declared in Section 4.1
```

---

## KIRO TASK CHAINING

```yaml
downstream_tasks:
  task_1:
    name: "Attendance Live — Zone Scaffold"
    source: Section 4 (Structural Anatomy)
    output: WorkstationShell + 6 zone scaffolds (empty) + sticky header structure

  task_2:
    name: "Attendance Live — Data Fetching Layer"
    source: Section 3.1, Section 3.4
    output: useQuery hook with refetchInterval/liveMode logic, LoadingBoundary integration, canReview role gate, URL param management (updateParams)

  task_3:
    name: "Attendance Live — Header Bar + Metric Strip"
    source: Section 4.2 (Header Bar + Metric Strip zones)
    output: 48px sticky header (live badge, date, counts, buttons), 40px metric strip (4 semantic counts, shifts toggle)

  task_4:
    name: "Attendance Live — Attendance Table"
    source: Section 6 (Table Strategy)
    output: DataTable (7 columns, compact, sticky header, activeRowId, onRowClick), row state CSS (danger/warning left border + bg), LoadingBoundary empty state

  task_5:
    name: "Attendance Live — Filter Bar"
    source: Section 4.2 (Filter Bar zone)
    output: FilterBar component (date + status fields), URL-persisted state, active filter chips

  task_6:
    name: "Attendance Live — Exception Callout + Shift Breakdown"
    source: Section 4.2 (Exception Callout Row + Shift Breakdown Row)
    output: Conditional InlineExceptionCallout (48px), conditional ShiftBreakdownRow (controlled state), both using shift_summary[] and nextAttentionRow

  task_7:
    name: "Attendance Live — Permission Gate + Responsive"
    source: Section 3.6, Section 10
    output: canReview role gate screen, Department column hide at 1100px, mobile 3-column collapse, 44px touch targets
```

---

*Status: COMPLETE — all 13 sections populated, all acceptance criteria met, post-generation validation passed.*
*Phase C progress: 2/8 complete — /approvals ✓, /attendance/live ✓*
*Next: /attendance/review — Phase C, Item 3.*
