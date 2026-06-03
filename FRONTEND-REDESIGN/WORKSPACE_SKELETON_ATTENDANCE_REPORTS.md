# Attendance Reports — Workspace Skeleton Architecture
# FactoryNerve OS | Phase 3 Skeleton Specification | Phase C, Item 4
# Route: /attendance/reports
# Generated: 2026-06-03
# Status: DRAFT

---

## 1. WORKSPACE OVERVIEW

### 1.1 Identity

| Field | Value |
|---|---|
| Route | `/attendance/reports` |
| Workspace Name | Attendance Reports — Date-Range Summary |
| Operational Role | Generates and displays a date-range attendance summary for accountants and managers. Shows aggregate totals (present, completed, pending review, late, overtime) and a per-day breakdown table. The primary workflow is: select date range → read aggregate totals → scan daily breakdown → identify anomaly dates. |
| Business Impact | If this workspace fails, accountants cannot generate the attendance summary needed for payroll processing. Missing or incorrect attendance data in this report directly causes incorrect salary calculations. This is the bridge between attendance records and payroll — it must be accurate and accessible before each payroll cycle closes. |
| User Population | Accountant (primary — daily-to-weekly payroll use). Supervisor, manager, admin, owner (secondary — oversight and spot checks). The topology confirms accountant is the primary role for this route. |
| Peak Usage Context | End of pay period — last 2–3 days before payroll closes. Mid-month for managers doing progress checks. Daily for accountants tracking attendance trends. |
| Predecessor Workspaces | `/attendance/review` (once queue is cleared, accountant reviews the report), `/work-queue` |
| Successor Workspaces | External payroll system (data is read from this page and entered or exported manually), `/attendance/review` (if pending_review count is non-zero) |

### 1.2 Operational Importance

The attendance report is a compliance and payroll document. Every `pending_review` record visible in this report represents an unresolved attendance exception that will produce an incorrect payroll calculation if it reaches the payroll system unresolved. The accountant uses this workspace to confirm that the review queue has been cleared (pending_review = 0) before running payroll. The daily breakdown table allows the accountant to identify which specific days have anomalies — then escalate to a supervisor to resolve them before the deadline.

### 1.3 Current State Failures

- Failure 1: Hero section uses `rounded-[2rem]` + `backdrop-blur` + `bg-[rgba(20,24,36,0.9)]` + `shadow-2xl` + `text-sm uppercase tracking-[0.3em]` eyebrow — four simultaneous violations (raw rgba, backdrop-blur on non-overlay, uppercase tracking, decorative rounded corners). → Every listed anti-pattern in the blueprint violated in a single element.
- Failure 2: "Report tools" section inside a `<details>/<summary>` embedded within the hero — navigation links and refresh button hidden behind browser-default disclosure. → Accountant must expand a `<details>` to access the refresh button and navigation links on every page load.
- Failure 3: Date range picker is a separate `Card` component below the hero, with its own `CardHeader` ("Report Range") and a separate "Update report" `Button` below the inputs. → Three interaction steps to change the date range: open the card, change dates, click update. The date inputs should directly trigger a reload.
- Failure 4: A second "Update report" / "Refresh" button in `CardContent` below the inputs duplicates the button in the hero's `<details>`. → Same action rendered twice.
- Failure 5: 4-card KPI grid (Present / Closed / Pending / Late+Overtime) with `Card` + `CardHeader` + `CardTitle` + `CardContent` structure — same dashboard-pattern KPI explosion eliminated in prior workspaces. 4 cards × 3 zones each = excessive structural overhead for 4 count values.
- Failure 6: Daily breakdown uses a raw custom `<table>` (not the `DataTable` component) — no sticky header, no sorting, no virtualization, no tabular-nums on numeric cells.
- Failure 7: Table date column uses `formatDate()` output without JetBrains Mono — dates in a data table should use monospace for alignment.
- Failure 8: The `refreshing` state renders as a standalone `<div>` notification (not using `MutationErrorBanner` or the established feedback primitive pattern) — inconsistent feedback treatment.

---

## 2. WORKSPACE CLASSIFICATION

| Dimension | Classification | Rationale |
|---|---|---|
| Workspace Type | Operational Reporting | TYPE 9 — user generates, filters, and reads a structured report. No decisions, no mutations. |
| Workflow Category | Record | Read-only review of aggregated data for compliance and payroll purposes. |
| Operational Behavior | Form-Driven | Date range inputs drive the entire data surface. |
| Data Density | HIGH | 8-column daily breakdown table; up to 30+ rows for monthly ranges; 6 aggregate totals. |
| Realtime Complexity | LOW | 30s background poll. No WebSocket. Data freshness is important but not live-critical. |
| AI Complexity | NONE | No AI systems on this route. |
| Audit Complexity | NONE | Workspace is read-only — no mutations, no audit writes. |
| Decision Pressure | LOW | No binary decisions required. Accountant reads the data; escalates to supervisor if issues found. |

**Classification Implication:** OPERATIONAL REPORTING + HIGH data density + LOW realtime + NONE AI/audit = a workspace that must be maximally table-forward, with the date range control immediately accessible (no hidden in `<details>`), and the 4 aggregate totals presented as a compact metric strip rather than a KPI card explosion. The accountant's primary interaction after arriving is: (1) confirm or adjust date range, (2) read totals, (3) scan the daily table for anomalies. This 3-step workflow must map directly to the vertical layout sequence: date controls → totals → table. Nothing else belongs between them.

---

## 3. BACKEND OPERATIONAL MAPPING

### 3.1 API Surface

| Endpoint | Method | Purpose | Permission | Key Response Fields | Error States |
|---|---|---|---|---|---|
| `/attendance/reports/summary` | GET | Fetch date-range attendance summary (`?date_from=`, `?date_to=`) | supervisor+ / accountant | `AttendanceReportSummary`: `factory_name`, `date_from`, `date_to`, `totals{}`, `days[]` | 403 (role too low), empty days (no records in range), 400 (invalid date range) |

### 3.2 Entity Relationship Map

```
AttendanceReportSummary (response envelope)
  ├── factory_id, factory_name
  ├── date_from, date_to (echo of requested range)
  ├── totals:
  │     ├── total_people
  │     ├── present_records    — number of punch-in events in range
  │     ├── completed_records  — records with punch-out completed
  │     ├── pending_review     — exceptions not yet resolved
  │     ├── late_records       — late arrivals in range
  │     └── overtime_records   — overtime events in range
  └── days[]: AttendanceReportDay[]
        ├── attendance_date
        ├── total_people
        ├── punched_in
        ├── completed
        ├── not_punched
        ├── pending_review
        ├── late
        └── overtime
```

**Primary entity:** `AttendanceReportSummary` — the full response. `days[]` drives the table. `totals{}` drives the metric strip. Both from a single API call.
**Relationship implication for UI:** Date range inputs → API call → response populates both totals strip and daily table simultaneously. No secondary data fetching required.

### 3.3 Workflow State Machine

```
[dateFrom, dateTo] ──[API call]──► [payload loaded]
                                     ├── totals{} → metric strip
                                     └── days[] → daily table

[dateFrom changes] ──[reload triggered]──► [new payload]
[dateTo changes]   ──[reload triggered]──► [new payload]
```

**Frontend implication:** Date inputs trigger a new `loadReports()` call on `useEffect` dependency change. The `loadReports` callback is memoized with `dateFrom` and `dateTo` as dependencies — changing either input fires a new fetch automatically. No separate "Update report" button needed. The current implementation requires a manual button click — this must be removed.

### 3.4 Realtime Contracts

| System | Transport | Update Rate | Zones Affected | Stale State Handling |
|---|---|---|---|---|
| `setInterval` polling | HTTP | 30000ms | Full payload (totals + days) | Retain last-known data on background poll failure; `refreshing` state drives header indicator |
| `visibilitychange` event | Browser | On tab focus | Full payload | Same |
| Date input change | User action | Immediate | Full payload (new fetch) | Loading skeleton during new fetch |

### 3.5 AI System Contracts

None. No AI systems on this route.

### 3.6 Permission Matrix

| Role | View report | Change date range | Navigate to review | Navigate to live board |
|---|---|---|---|---|
| attendance | ✗ (role gate) | ✗ | ✗ | ✗ |
| operator | ✗ (role gate) | ✗ | ✗ | ✗ |
| accountant | ✓ | ✓ | ✓ (review queue link) | ✗ (no live board access) |
| supervisor | ✓ | ✓ | ✓ | ✓ |
| manager | ✓ | ✓ | ✓ | ✓ |
| admin | ✓ | ✓ | ✓ | ✓ |
| owner | ✓ | ✓ | ✓ | ✓ |

**Permission implication:** `canSeeReports` gates the entire workspace. Role-gate screen for operator/attendance roles. The "Live board" navigation link renders only for supervisor+ roles — accountants do not have access to `/attendance/live`. The "Review queue" link renders for all `canSeeReports` roles.

---

## 4. WORKSPACE STRUCTURAL ANATOMY

### 4.1 Layout Pattern

**FULL-WIDTH COMMAND**

Single dominant workspace zone — the daily breakdown table fills available width. No left rail (no queue to navigate). No right context panel (no per-row detail needed — data is aggregate). Date range controls and aggregate totals are compact above-table zones.

**Pattern selection justification:** The accountant's workflow is linear: set range → read totals → scan table. There is no item selection, no two-pane decision, no persistent queue. FULL-WIDTH COMMAND maximizes table width — the 8-column daily table needs horizontal space. LEFT-RAIL + MAIN rejected — no persistent filter list or queue exists to justify a rail.

**Structural reduction note:**
- Hero section (rounded-[2rem], backdrop-blur, rgba background, large heading, uppercase eyebrow) eliminated — all 4 anti-patterns concentrated in one element, zero operational content.
- "Report tools" `<details>` inside the hero eliminated — navigation links and refresh move to the workspace header bar.
- Separate "Report Range" Card eliminated — date inputs merge into a compact DateRangeBar zone directly above the metric strip.
- Separate "Update report" Button eliminated — date input onChange fires reload automatically via `useEffect` dependency.
- Second duplicate refresh button eliminated.
- 4-card KPI grid replaced with a single compact MetricStrip — same 4 counts, 75% less vertical space.
- Raw custom `<table>` replaced with `DataTable` component — sticky header, tabular-nums, proper typography.

---

### 4.2 Zone Definitions

---

#### ZONE: Workspace Header Bar (Top, Sticky)

| Property | Value |
|---|---|
| Operational Role | Persistent context: workspace title, date range in view, refreshed timestamp, manual refresh, and navigation links (Review queue, Live board for supervisor+). |
| Attention Priority | 3 |
| Position | Top — spans full workspace width |
| Width | full-width |
| Height | fixed: 48px |
| Sticky Behavior | always sticky |
| Collapse Behavior | never |
| Scroll Behavior | sticky |
| Density Mode | compact |
| Existence Justification | `AttendanceReportSummary.date_from/date_to` + `lastUpdatedAt` — accountant must always know which date range is in view and when data was last refreshed, especially during background polls. |

**Contents:**
- Workspace title: "Attendance reports" — 16px / weight 500 / sentence case
- Date range label: "03 Jun – 10 Jun" — 13px / JetBrains Mono (echoes active range at a glance)
- Refreshed timestamp: "Updated 14:22" — 12px / JetBrains Mono; shows "Refreshing…" during poll
- "Review queue" link button: outline — navigates to `/attendance/review` (all canSeeReports roles)
- "Live board" link button: outline — renders only for supervisor+ roles; navigates to `/attendance/live`
- Manual refresh button: ghost — right-aligned

**Acceptance Criteria:**
- [ ] Header bar 48px, always sticky
- [ ] Date range label uses JetBrains Mono — updates when date inputs change
- [ ] "Live board" link renders only for supervisor, manager, admin, owner roles
- [ ] Refreshed timestamp uses JetBrains Mono
- [ ] No `<details>/<summary>` in this zone

---

#### ZONE: Date Range Bar

| Property | Value |
|---|---|
| Operational Role | Controls the date range that drives the entire report. Accountant adjusts start/end dates; the report reloads automatically on input change. |
| Attention Priority | 2 |
| Position | Below Workspace Header Bar |
| Width | full-width |
| Height | fixed: 52px (single row — two date inputs + label) |
| Sticky Behavior | not sticky |
| Collapse Behavior | never |
| Scroll Behavior | inherits shell |
| Density Mode | compact |
| Existence Justification | `dateFrom` + `dateTo` state — the entire report is driven by these two values. They must be immediately accessible, not hidden inside a Card or `<details>`. |

**Contents:**
- Section label: "Date range" — 13px / weight 500 / sentence case (inline left of inputs)
- Date from input: `type="date"`, value=`dateFrom`, onChange triggers `setDateFrom`
- Date to input: `type="date"`, value=`dateTo`, onChange triggers `setDateTo`
- Quick preset buttons (right-aligned): "7 days" / "14 days" / "30 days" — ghost buttons, set `dateFrom` to N days ago and `dateTo` to today
- No "Update report" button — `useEffect` on `[dateFrom, dateTo]` fires `loadReports` automatically

**Acceptance Criteria:**
- [ ] Date inputs trigger automatic reload on change — no manual submit button
- [ ] Quick preset buttons render as compact ghost buttons (7 / 14 / 30 days)
- [ ] Both inputs use existing `Input` primitive (type="date")
- [ ] Zone is 52px height, single horizontal row on desktop
- [ ] No Card wrapper, no CardHeader, no CardContent

---

#### ZONE: Metric Strip

| Property | Value |
|---|---|
| Operational Role | Shows the 5 key aggregate totals from `totals{}` — present, completed, pending review, late, overtime — in a single compact horizontal row. Accountant reads these to understand the period's attendance health before scanning the daily table. |
| Attention Priority | 1 |
| Position | Below Date Range Bar |
| Width | full-width |
| Height | fixed: 40px |
| Sticky Behavior | not sticky |
| Collapse Behavior | never |
| Scroll Behavior | inherits shell |
| Density Mode | compact |
| Existence Justification | `AttendanceReportSummary.totals{}` — the 5 aggregate counts are the first thing an accountant reads to assess whether the period is clean or has issues. The `pending_review` count is the single most operationally important number — if it is non-zero, payroll cannot close. |

**Contents:**
- 5 inline metric units: `N Present`, `N Completed`, `N Pending review`, `N Late`, `N Overtime`
- Semantic token coloring: present = success, completed = info, pending_review = danger (if > 0) or muted (if 0), late = warning, overtime = warning
- `pending_review > 0` renders a "Resolve exceptions →" text link (danger token) immediately after the pending count — navigates to `/attendance/review`
- Separator: thin vertical rule between units
- Total people context: "of N total" trailing label

**Acceptance Criteria:**
- [ ] Metric strip is 40px height — single horizontal row, not a card grid
- [ ] All 5 counts use tabular-nums
- [ ] `pending_review` uses danger token when > 0, muted token when 0
- [ ] "Resolve exceptions →" link renders only when `pending_review > 0`
- [ ] No Card components — flat strip layout only

---

#### ZONE: Daily Breakdown Table (Primary)

| Property | Value |
|---|---|
| Operational Role | The complete per-day attendance breakdown for the selected date range. Accountant scans for days with high `not_punched`, `pending_review`, or `late` counts — these are anomaly dates requiring escalation. |
| Attention Priority | 1 |
| Position | Below Metric Strip |
| Width | full-width |
| Height | fill-remaining — no fixed height |
| Sticky Behavior | table header sticky within the table |
| Collapse Behavior | never |
| Scroll Behavior | inherits shell |
| Density Mode | compact |
| Existence Justification | `AttendanceReportSummary.days[]` — the per-day breakdown is the operational instrument of this workspace. Every other zone exists only to control or summarize what this table shows. |

**Contents:**
- 8 columns: Date, Assigned, Punched in, Completed, Not punched, Pending review, Late, Overtime
- Row anomaly treatment: rows where `pending_review > 0` receive warning-token left border + background tint (structural, not color-only)
- All numeric columns use tabular-nums, right-aligned
- Date column: JetBrains Mono, 12px
- Empty state: "No attendance data for this date range" — plain sentence-case text, no decorative card
- Loading state: DataTable skeleton (LoadingBoundary)
- Sorting: enabled (click column header to sort)

**Acceptance Criteria:**
- [ ] Table uses `DataTable` component — not raw `<table>/<thead>/<tbody>`
- [ ] Table header is sticky on scroll
- [ ] All numeric cells use tabular-nums and right-align
- [ ] Date column uses JetBrains Mono
- [ ] Rows with `pending_review > 0` have warning-token left border + background — structural row treatment
- [ ] Column headers use sentence case — no uppercase tracking
- [ ] Sorting enabled on all columns
- [ ] Empty state is plain sentence-case text
- [ ] Virtualization required if `days.length > 100` (threshold for >3 months range)

---

### 4.3 Zone Interaction Rules

```yaml
zone_interactions:
  - trigger: dateFrom input changes
    effect: loadReports() fires via useEffect dependency; all zones enter loading state; payload updates on response
    reason: Date inputs are the primary control — automatic reload removes the friction of a manual button

  - trigger: dateTo input changes
    effect: Same as dateFrom change
    reason: Same

  - trigger: Quick preset button clicked ("7 days" / "14 days" / "30 days")
    effect: setDateFrom to N days ago; setDateTo to today; useEffect fires loadReports()
    reason: Common date ranges should be reachable in one click

  - trigger: 30s background poll fires
    effect: loadReports({ background: true }) — payload updates silently; header bar refreshed timestamp updates
    reason: Report data stays current without operator intervention

  - trigger: payload.totals.pending_review > 0
    effect: pending_review metric unit renders in danger token; "Resolve exceptions →" link appears in Metric Strip
    reason: Payroll-blocking condition — must be visible and actionable immediately

  - trigger: canSeeReports = false
    effect: Role-gate screen renders; no API call; no workspace content
    reason: Permission matrix
```

---

## 5. OPERATIONAL ATTENTION HIERARCHY

### 5.1 Scan Flow

```
LEVEL 1 (0–200ms): Metric Strip — pending_review count
  Operational necessity: The accountant's first question every time they open this page is
  "Is there anything in pending review?" If pending_review > 0, the danger token and
  "Resolve exceptions →" link resolve before conscious reading. The accountant knows
  immediately whether payroll can proceed.

LEVEL 2 (200ms–1s): Metric Strip — present, completed, late, overtime counts
  Operational necessity: After confirming pending_review is 0, the accountant reads the
  period totals to verify the range looks correct (total_people, present_records match expectations).

LEVEL 3 (1s–3s): Date Range Bar — verify the range in view
  Operational necessity: Accountant confirms the date range matches the pay period they intend
  to review. Adjusts if necessary.

LEVEL 4 (3s+): Daily Breakdown Table — scan for anomaly rows
  Operational necessity: Row-level anomaly detection. Accountant looks for days where
  not_punched or pending_review > 0 — these need supervisor escalation before payroll.
```

### 5.2 Persistent Visibility Requirements

| Element | Reason It Must Persist |
|---|---|
| Workspace Header Bar (date range label + refreshed time) | Accountant must always know which period they are viewing and when data was last refreshed |
| Metric Strip pending_review count | Payroll-blocking condition — must be visible throughout the session |

### 5.3 Contextual Visibility Rules

```yaml
contextual_rules:
  - condition: payload.totals.pending_review > 0
    shows: Danger token on pending_review metric unit + "Resolve exceptions →" link
    hides: Muted/success token on pending_review
    reason: Payroll-blocking condition needs immediate visual signal

  - condition: payload.totals.pending_review = 0
    shows: Muted or success token on pending_review metric unit
    hides: "Resolve exceptions →" link
    reason: No exceptions — accountant can proceed to payroll

  - condition: user.role = supervisor / manager / admin / owner
    shows: "Live board" link in header
    hides: "Live board" for accountant role (no /attendance/live access)
    reason: Permission matrix

  - condition: day.pending_review > 0 in a table row
    shows: Warning-token left border + background tint on that row
    hides: nothing (additive structural treatment)
    reason: Anomaly date — accountant must escalate this specific day

  - condition: refreshing = true
    shows: "Refreshing…" text in header bar timestamp area
    hides: Last-updated timestamp
    reason: Feedback that background refresh is in progress

  - condition: payload = null AND !pageLoading (error state)
    shows: MutationErrorBanner with error message
    hides: nothing (additive)
    reason: Data fetch failed — accountant must know and be able to retry
```

---

## 6. TABLE & DATA STRATEGY

### 6.1 Table Role

| Field | Value |
|---|---|
| Primary Purpose | Show per-day attendance breakdown for the selected range, enabling accountants to identify anomaly dates before payroll. |
| Scanning Pattern | Anomaly-first — rows with `pending_review > 0` are structurally differentiated (warning treatment) so the accountant's eye finds them before reading any values. |
| Primary Decision | Which specific dates have unresolved exceptions that block payroll? |
| Action Trigger | Row with `pending_review > 0` → accountant navigates to `/attendance/review` to escalate. |
| Row Volume | Typical: 7–30 rows / Max: 90–365 rows / Requires virtualization: yes if > 100 rows |

### 6.2 Column Architecture

| Column | Data Type | Alignment | Width | Sticky | Operational Purpose |
|---|---|---|---|---|---|
| Date | date string | left | 120px | yes | Identifies the specific day — the primary scan reference |
| Assigned | integer | right | 80px | no | Total people expected that day — baseline for context |
| Punched in | integer | right | 90px | no | How many actually showed up |
| Completed | integer | right | 90px | no | How many completed their shift |
| Not punched | integer | right | 100px | no | How many never punched — absent signal |
| Pending review | integer | right | 120px | no | Exceptions not resolved — the payroll-blocking column |
| Late | integer | right | 60px | no | Late arrivals — secondary concern |
| Overtime | integer | right | 80px | no | Overtime events — payroll cost signal |

**Column justification:** Every column maps to a payroll calculation input. "Pending review" is the most operationally important — it is the only one that blocks payroll closure. "Not punched" signals absent employees. The others (late, overtime) affect pay calculations. No decorative columns.

**Columns considered and rejected:** None — all 8 columns from the current implementation are operationally justified. The existing column set is correct; the formatting and structural treatment are what needed fixing.

### 6.3 Row State Specification

```yaml
row_states:
  normal: var(--surface-card) background, no border treatment — days with no exceptions
  anomaly:
    pending_review_gt_0: var(--status-warning-bg) row background + 2px left border var(--status-warning-border) — not color-only
  selected: N/A — no row selection on this workspace (read-only, no detail panel)
  expanded: N/A — rows do not expand
  action_required: same as anomaly treatment (pending_review > 0 = action required by supervisor)
  loading: DataTable skeleton rows via LoadingBoundary
```

### 6.4 Inline Actions

None — table is read-only. No row-level buttons, no inline edits, no click navigation from rows.

### 6.5 Bulk Actions

None — read-only workspace.

### 6.6 Realtime Update Behavior

```yaml
realtime_table_behavior:
  new_row: N/A — date range is fixed; no rows are added during viewing
  row_update: in-place update on background poll (pending_review count may decrease as supervisor resolves exceptions)
  row_removal: N/A
  operator_conflict: N/A — read-only
  connection_lost: retain last-known data; error banner shown; manual refresh still available
```

---

## 7. FORM & INPUT STRATEGY

### 7.1 Form Role

| Field | Value |
|---|---|
| Form Purpose | Set the date range that drives the report data fetch |
| Completion Frequency | Once per session (set range, read report) |
| Keyboard Efficiency Priority | LOW — accountants typically click date pickers; keyboard entry supported |
| AI Assistance Available | No |
| Estimated Completion Time | 5–10 seconds to set a date range |

### 7.2 Field Group Architecture

```yaml
field_groups:
  - group: Date Range
    operational_purpose: Define the reporting period for the attendance summary
    fields:
      - name: dateFrom
        type: date input (type="date")
        required: yes (defaults to 6 days ago)
        validation_rules: Must be a valid date; must be before or equal to dateTo
        ai_assisted: no
        tab_order: 1
        default_value: dateDaysAgo(6)
        help_text: none
        error_message: Start date must be before the end date.

      - name: dateTo
        type: date input (type="date")
        required: yes (defaults to today)
        validation_rules: Must be a valid date; must be after or equal to dateFrom
        ai_assisted: no
        tab_order: 2
        default_value: todayValue()
        help_text: none
        error_message: End date must be after the start date.
```

### 7.3 Validation Strategy

```yaml
validation:
  realtime:
    - dateFrom: if dateFrom > dateTo, swap values or show inline warning; do not fire API call with invalid range
    - dateTo: same
  on_blur:
    - none
  on_submit:
    - N/A — no submit button; onChange fires the reload
  server_side:
    - 400 returned if date range is invalid (backend enforces)
      latency: <300ms
  ai_flagged:
    - none
```

### 7.4 Keyboard Flow

```yaml
keyboard:
  tab_sequence: [Date from input] → [Date to input] → [7 days preset] → [14 days] → [30 days] → [Refresh button]
  shortcuts:
    - Tab: advance through date inputs
  autofocus: none — accountant arrives and reads the current state first
```

---

## 8. AI & AUDIT VISIBILITY STRATEGY

### 8.1 AI Placement Map

None. No AI systems on this route.

### 8.2 Audit Visibility Map

```yaml
audit:
  placement: Not surfaced — workspace is read-only, no mutations
  trigger: N/A
  events_logged: none on this workspace
  detail_level: N/A
  authorized_roles: N/A
  realtime_updates: N/A
  max_events_shown: N/A
```

### 8.3 Anomaly Visibility

```yaml
anomaly:
  detection_source: rule-based (pending_review > 0 is the only operational anomaly signal on this workspace)
  placement:
    - Metric Strip: pending_review count in danger token + "Resolve exceptions →" link when > 0
    - Daily table: warning-token row treatment for days where pending_review > 0
  severity_levels:
    - level: payroll-blocking (pending_review > 0)
      structural_treatment: Metric strip danger token + table row warning left border + bg tint
      action_required: yes — supervisor must resolve before payroll; accountant navigates to /attendance/review
  dismissible: no — clears automatically when supervisor resolves exceptions and report refreshes
  persistence: until resolved by supervisor via /attendance/review; report reflects new state on next poll
```

---

## 9. DENSITY, SPACING & LAYOUT RHYTHM

### 9.1 Density Mode

```yaml
density:
  default: compact
  justification: Report table with up to 30+ rows needs maximum row visibility. Accountants reading a monthly payroll report benefit from compact density to avoid excessive scrolling.
  operator_switchable: no
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
  section_gap: 12px — tight between above-table zones; every pixel above the table reduces visible rows
  zone_gap: 8px — between metric strip and date range bar
  card_padding: N/A — no card components in workspace body
  sticky_header_height: 48px — Workspace Header Bar
  action_dock_height: N/A — no action dock
  inline_label_gap: 8px
  form_group_gap:
    compact: 12px
    default: 16px
    comfortable: 24px
  above_table_total_height: 48px (header) + 52px (date range) + 40px (metric) = 140px. At 1080p (768px content height), table gets ~628px — ~17 rows at 36px compact.
```

### 9.3 Typography Specification

```yaml
typography:
  workspace_title: 16px / weight 500 / Inter UI / sentence case
  section_header: 13px / weight 500 / Inter UI / sentence case
  table_header: 12px / weight 500 / Inter UI / sentence case  # NOT uppercase — sentence case only
  table_cell: 13px / weight 400 / Inter UI
  form_label: 13px / weight 400 / Inter UI / sentence case
  form_input: 14px / weight 400 / Inter UI
  status_badge: 11px / weight 600 / Inter UI / sentence case
  ai_reasoning: N/A
  audit_entry: N/A
  numeric_data: 13px / tabular-nums / right-aligned  # ALL 7 numeric columns in the table
  timestamp: 12px / JetBrains Mono  # date column, refreshed timestamp, date range label in header
  id_reference: N/A
  error_message: 12px / weight 400 / Inter UI
  # Workspace-specific:
  metric_count: 20px / weight 600 / tabular-nums  # 5 counts in Metric Strip
  metric_label: 12px / weight 400 / Inter UI / sentence case
  date_range_label: 13px / JetBrains Mono  # in header bar — echoes active range
```

**Anti-pattern count from current implementation:**
- `uppercase tracking-[0.3em]`: 1 instance (hero eyebrow) → eliminated with hero
- `backdrop-blur`: 1 instance (hero section) → eliminated
- `bg-[rgba(20,24,36,0.9)]`: 1 instance (hero) → eliminated
- `rounded-[2rem]` + `shadow-2xl` decorative treatment: 1 → eliminated
- All table cells lacking `tabular-nums`: 7 numeric columns → all corrected
- Date column lacking JetBrains Mono: 1 → corrected

### 9.4 Surface Token Hierarchy

```yaml
surfaces:
  workspace_background: var(--surface-app)
  primary_panel: var(--surface-shell)
  secondary_panel: var(--surface-panel)
  card_surface: var(--surface-card)  # table rows
  input_surface: var(--surface-card)  # date inputs
  overlay_surface: N/A — no modals
  sticky_surface: var(--surface-shell)  # header bar
  anomaly_row_bg: var(--status-warning-bg)  # rows with pending_review > 0
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
  notes: At 1440px, the 8-column table fits comfortably within max-w-7xl. All columns visible without horizontal scroll.
```

### 10.2 Compact Desktop (Secondary)

```yaml
compact_desktop:
  width_range: 1024px–1279px
  density_mode: compact
  adaptations:
    - Daily Breakdown Table: Overtime column hides below 1100px (lowest priority column)
    - Date Range Bar: remains single row; quick preset buttons may wrap below 900px
  degraded_functionality: no — all essential columns (Date, Punched in, Pending review, Not punched) remain visible
```

### 10.3 Mobile / Tablet (Degraded Mode)

```yaml
mobile:
  width_range: <768px
  strategy: stacked — all zones stack vertically; table becomes horizontally scrollable
  operational_continuity: Date range selection and metric strip preserved; table scrollable horizontally
  zones_hidden: none — all zones render but table may require horizontal scroll
  touch_targets: 44px minimum for date inputs and preset buttons
  touch_adjustments:
    - Date Range Bar: inputs expand to full-width stacked layout
    - Metric Strip: wraps to 2×3 grid on mobile
    - Table: horizontal scroll via ResponsiveScrollArea wrapper
    - Quick presets: full-width on mobile
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
    reason: Consistent AppShell integration; full-width table layout

  zones:
    - zone: Workspace Header Bar
      component: StickyTopbar / WorkspaceHeaderBar
      props_required: title "Attendance reports", dateRangeLabel (JetBrains Mono), refreshedAt, onRefresh, reviewQueueHref, liveBoardHref (conditional supervisor+)
      variant: compact 48px

    - zone: Date Range Bar
      component: DateRangeBar (inline flex row — existing Input primitives)
      props_required: dateFrom, dateTo, onFromChange, onToChange, onPreset (7/14/30 days)
      variant: compact 52px
      note: No existing dedicated primitive — implement as inline flex with label + 2x Input + 3x ghost Button. Simple enough to not require a new primitive.

    - zone: Metric Strip
      component: MetricStrip primitive (same as /attendance/live — reuse pattern)
      props_required: present, completed, pending_review, late, overtime, total_people, onResolveClick (pending > 0)
      variant: compact 40px horizontal strip

    - zone: Daily Breakdown Table
      component: DataTable (existing component)
      props_required: columns (8), data (days[]), enableSorting, ariaLabel
      variant: compact density, sticky header

  tables:
    - table: Daily Breakdown
      component: DataTable
      virtualization_required: yes — threshold 100 rows (>3 months range)
      sticky_header: yes
      density_override: compact

  status_elements:
    - element: pending_review metric unit (danger state)
      component: MetricUnit with StatusBadge or token-colored text
      semantic_variant: danger (when > 0), muted (when 0)

  action_elements:
    - element: "Resolve exceptions →" link
      component: Link (text link — not a full Button; 13px, danger token color)
      variant: inline text link
      why: Should not compete visually with the data; contextual escalation path

    - element: Quick preset buttons (7d / 14d / 30d)
      component: Button
      variant: ghost, compact (px-3 py-1.5 text-xs)
      why: One-click preset; ghost weight keeps focus on the table

    - element: Review queue link
      component: Link + Button
      variant: outline

    - element: Live board link (supervisor+ only)
      component: Link + Button
      variant: outline

    - element: Manual refresh
      component: Button
      variant: ghost

  feedback_elements:
    - element: Error banner
      component: MutationErrorBanner (existing pattern)
      note: Replaces the current standalone `<div>` error rendering

    - element: Refreshing indicator
      component: Header bar timestamp text change ("Refreshing…") — not a separate banner

Missing components — new primitive candidates:
  None. DateRangeBar can be implemented as a simple inline composition of existing primitives (label + Input + Input + preset buttons). No new component approval needed.
```

---

## 12. OPERATIONAL PROBLEMS SOLVED

```yaml
problem_resolutions:
  - problem: Hero section with rounded-[2rem] + backdrop-blur + bg-[rgba(20,24,36,0.9)] + shadow-2xl + uppercase tracking-[0.3em] eyebrow — 4 simultaneous violations in one element.
    root_cause: Marketing-style entry section with every visual embellishment pattern applied simultaneously.
    structural_solution: Hero section eliminated entirely (Section 4.1 structural reduction). Workspace title "Attendance reports" lives in the 48px sticky header bar. Zero decorative treatment.
    section_reference: Section 4.1, Section 4.2 (Workspace Header Bar)
    measurable_outcome: Zero backdrop-blur, zero rgba backgrounds, zero uppercase tracking, zero oversized headings on this workspace.

  - problem: "Report tools" `<details>/<summary>` inside the hero — refresh button and navigation links hidden on every load.
    root_cause: Navigation tools treated as secondary content, collapsed by default.
    structural_solution: Navigation links (Review queue, Live board) move to Workspace Header Bar (Section 4.2). Refresh button in header bar. Always visible. No collapse.
    section_reference: Section 4.2 (Workspace Header Bar)
    measurable_outcome: Refresh button and navigation links accessible without any interaction. Zero `<details>` elements on this workspace.

  - problem: Separate "Report Range" Card with "Update report" button — 3 interaction steps to change the date range.
    root_cause: Date range inputs treated as a form requiring explicit submit.
    structural_solution: Date Range Bar zone (Section 4.2) — compact inline row. `useEffect` on `[dateFrom, dateTo]` fires `loadReports` automatically on input change. No submit button. Quick preset buttons for common ranges.
    section_reference: Section 4.2 (Date Range Bar), Section 3.3 (Workflow State Machine)
    measurable_outcome: Date range change requires 1 interaction (change the input). No Card wrapper, no CardHeader, no button.

  - problem: Second duplicate "Update report" / "Refresh" button in the Card's CardContent.
    root_cause: Refresh capability added in two separate locations without removing the first.
    structural_solution: Single refresh button in Workspace Header Bar (Section 4.2). No duplicate. Automatic reload on date change eliminates most manual refresh need anyway.
    section_reference: Section 4.2
    measurable_outcome: Single refresh location. Duplicate button eliminated.

  - problem: 4-card KPI grid consuming ~160px of vertical space for 4 count values.
    root_cause: Dashboard KPI card pattern applied to a reporting workspace.
    structural_solution: Metric Strip (Section 4.2) — 40px single horizontal row with same 5 counts. 120px of vertical space reclaimed for the table.
    section_reference: Section 4.2 (Metric Strip), Section 4.1
    measurable_outcome: Table visible approximately 3–4 rows higher on standard 1080p displays.

  - problem: Raw custom `<table>` — no sticky header, no sorting, no tabular-nums on numeric cells, no JetBrains Mono on date column.
    root_cause: Custom table implementation without reference to the DataTable component or typography spec.
    structural_solution: DataTable component (Section 4.2 Daily Breakdown Table, Section 11). Sticky header enforced. All 7 numeric columns use tabular-nums + right-align. Date column uses JetBrains Mono. Sorting enabled.
    section_reference: Section 4.2, Section 6.2, Section 9.3
    measurable_outcome: Table header sticky on scroll. All numeric columns aligned and tabular. Date column monospace. Column headers sentence case.

  - problem: `refreshing` state rendered as standalone `<div>` notification — inconsistent with MutationErrorBanner feedback pattern.
    root_cause: Quick implementation; did not use the established feedback primitive.
    structural_solution: `refreshing` state reflected in header bar timestamp ("Refreshing…" text) — no separate banner. Errors use `MutationErrorBanner` (Section 11 feedback_elements).
    section_reference: Section 4.2 (Workspace Header Bar), Section 5.3
    measurable_outcome: Single consistent feedback pattern. No standalone `<div>` notification banners.
```

---

## 13. IMPLEMENTATION HANDOFF

### 13.1 Build Sequence

```yaml
implementation_sequence:
  step_1: Workspace container scaffold — WorkstationShell + sticky header bar (48px) + date range bar placeholder + metric strip placeholder + table placeholder.

  step_2: Data fetching — `getAttendanceReportSummary(dateFrom, dateTo)`. `useEffect` on `[dateFrom, dateTo]` fires `loadReports`. `canSeeReports` role gate. 30s background poll with `visibilitychange`. Loading skeleton via LoadingBoundary.

  step_3: Workspace Header Bar — title, date range label (JetBrains Mono, echoes active range), refreshed timestamp, "Review queue" link, conditional "Live board" link (supervisor+ only), manual refresh ghost button.

  step_4: Date Range Bar — inline flex row with "Date range" label + 2x date Input + 3x quick preset ghost buttons (7d/14d/30d). onChange handlers trigger setDateFrom/setDateTo.

  step_5: Metric Strip — 5 inline metric units from totals{}. Tabular-nums. Semantic tokens (danger for pending_review > 0). "Resolve exceptions →" text link when pending_review > 0.

  step_6: Daily Breakdown Table — DataTable with 8 columns. Compact density. Sticky header. Sorting enabled. Row anomaly treatment (warning token for pending_review > 0 rows). Date column JetBrains Mono. Numeric columns tabular-nums + right-align. LoadingBoundary empty state (plain sentence-case text).

  step_7: Error handling and feedback — MutationErrorBanner for fetch errors. "Refreshing…" state in header bar. Role-gate screen for non-canSeeReports users.

  step_8: Responsive adaptations — Overtime column hide below 1100px. Date Range Bar full-width stacked on mobile. Metric Strip 2×3 wrap on mobile. Table horizontal scroll via existing ResponsiveScrollArea wrapper. Touch targets 44px.
```

### 13.2 Critical Constraints

```yaml
critical_constraints:
  - No hero section, no large heading, no backdrop-blur: reason: 4 simultaneous violations eliminated
  - No Card wrappers around the date range inputs: reason: adds structural overhead with no operational benefit
  - Date inputs must trigger automatic reload on onChange — no submit button: reason: removes 1 unnecessary interaction per date range change
  - All numeric table columns must use tabular-nums: reason: financial/payroll data alignment — typography law
  - Date column must use JetBrains Mono: reason: timestamp typography spec
  - Table must use DataTable component — not raw <table>: reason: sticky header, sorting, and virtualization require DataTable
  - pending_review danger token must render when > 0: reason: payroll-blocking condition must be immediately visible
  - Zero <details>/<summary> elements: reason: uncontrolled state — eliminated in all Phase C workspaces
  - All surfaces use token variables, no hex/rgba: reason: blueprint law
  - Virtualization required if days.length > 100: reason: blueprint law (>3 months range possible)
  - Do not modify AppShell scroll architecture: reason: AppShell doctrine
```

### 13.3 Open Questions

```yaml
open_questions:
  - question: Should changing dateFrom/dateTo fire the API call immediately on every keystroke (controlled input with onChange) or only on blur/Enter? Immediate onChange may fire many redundant calls while the user is typing a year (e.g., typing "2026" fires 4 requests).
    blocking: no — implement with debounce (300ms) on onChange; date picker UI (calendar widget) fires cleanly on selection
    owner: frontend team
    decision_needed_by: before step 4 in 13.1

  - question: The topology confirms accountant role has access to /attendance/reports but NOT /attendance/live. Should the "Review queue" link in the workspace header navigate to /attendance/review for accountants (they can read but not act on it — canReview is false for accountants)?
    blocking: no — accountant should see the link but will hit the role-gate screen at /attendance/review. The link is still useful to communicate where to escalate. Proceed with linking to /attendance/review for all canSeeReports roles.
    owner: product owner
    decision_needed_by: before step 3 in 13.1
```

---

## ACCEPTANCE CRITERIA (SPEC COMPLETENESS)

- [x] All 13 sections fully populated — no empty fields, no placeholders
- [x] Every layout zone has a documented existence justification tied to a backend entity or operator need
- [x] Every layout zone has explicit, testable acceptance criteria
- [x] Every component mapped to existing primitives — no new primitive candidates required
- [x] Every operational failure from Section 1.3 has a resolution in Section 12
- [x] Reduction audit completed — hero section, Report Range Card, 4-card KPI grid, duplicate refresh button, `<details>` wrapper all eliminated
- [x] No anti-patterns (no gradients, no glow, no pulse, no UPPERCASE labels, no rgba/backdrop-blur)
- [x] All spacing values follow 4px scale
- [x] All surfaces reference token variables only
- [x] Typography follows approved system — tabular-nums on all numeric cells, JetBrains Mono on date column
- [x] Backend API endpoint verified (getAttendanceReportSummary confirmed in lib/attendance.ts)
- [x] Permission matrix drives zone visibility (canSeeReports gate, supervisor+ live board link)
- [x] Open questions populated (2 questions, 0 blocking)
- [x] AI elements: N/A
- [x] Implementation handoff sequence complete and ordered

---

## POST-GENERATION VALIDATION

```yaml
self_validation:
  operational_integrity:
    - [x] Every zone traces to a specific backend entity or API endpoint
    - [x] Every zone justified by specific operator need
    - [x] No visual-composition-only zones (hero eliminated; card wrappers eliminated)
    - [x] Reduction audit complete — 7 structural reductions documented

  law_compliance:
    - [x] All spacing follows 4px base scale
    - [x] All surfaces use CSS token variables — rgba violations eliminated
    - [x] All labels sentence case — uppercase tracking-[0.3em] eliminated
    - [x] All font specs from approved type system — tabular-nums, JetBrains Mono specified
    - [x] No AI elements — N/A

  kiro_readiness:
    - [x] Kiro can produce working code without clarifying questions
    - [x] All acceptance criteria are testable
    - [x] Build sequence complete and ordered
    - [x] No blocking open questions

  anti_pattern_check:
    - [x] No gradients
    - [x] No glow effects
    - [x] No pulsing
    - [x] No UPPERCASE labels (tracking-[0.3em] eyebrow eliminated)
    - [x] No marketing typography (3xl/4xl heading eliminated with hero)
    - [x] No backdrop-blur on static sections (hero eliminated)
    - [x] No raw rgba inline styles (bg-[rgba(20,24,36,0.9)] eliminated)
    - [x] No decorative panels (Report Range Card removed; 4-card KPI grid removed)

  structural_integrity:
    - [x] Zone interactions cover all user inputs (dateFrom/dateTo changes, preset buttons, manual refresh)
    - [x] Permission matrix complete (canSeeReports gate, supervisor+ live board link)
    - [x] Responsive adaptations defined (Overtime column hide, mobile stacked layout)
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
│  Attendance reports  │  27 May–03 Jun  │  Updated 14:22  │  [Review queue]  [Refresh]│
├──────────────────────────────────────────────────────────────────────────────────────┤
│  DATE RANGE BAR [P:2] ──────────────────────────────────────────────────── [52px]   │
│  Date range  [27 May 2026]  to  [03 Jun 2026]   [7d]  [14d]  [30d]                  │
├──────────────────────────────────────────────────────────────────────────────────────┤
│  METRIC STRIP [P:1] ────────────────────────────────────────────────────── [40px]   │
│  312 Present │ 298 Completed │ ⚠ 3 Pending review → Resolve │ 14 Late │ 6 Overtime  │
├──────────────────────────────────────────────────────────────────────────────────────┤
│  DAILY BREAKDOWN TABLE [P:1] — fill-remaining ─────────────────────────────────────│
│  Date        Assigned  Punched in  Completed  Not punched  Pending  Late  Overtime  │
│  ──────────────────────────────────────────────────────────────────────────────────  │
│  27 May 2026     47        45          44           2           0     3       2      │
│  28 May 2026     47        46          44           1           0     4       1      │
│  ║ 29 May 2026   47        43          39           4           3     6       0  ←── warning row (pending > 0)
│  30 May 2026     47        47          46           0           0     2       3      │
│  31 May 2026     47        46          44           1           0     1       2      │
│  01 Jun 2026     47        44          43           3           0     3       1      │
│  ...                                                                                 │
└──────────────────────────────────────────────────────────────────────────────────────┘

Total above-table height: 48px + 52px + 40px = 140px
At 1080p (768px content height): table gets ~628px ≈ 17 rows at compact 36px
Previous layout (hero ~130px + 4 KPI cards ~160px + Report Range Card ~100px = ~390px above table):
Table only got ~378px ≈ 10 rows. Net improvement: +7 visible rows.

║ = warning row treatment (2px left border var(--status-warning-border) + var(--status-warning-bg))
```

---

### B. Visual Attention Flow Map

```
Scan 1 (0–200ms): Metric Strip — pending_review count
  — If pending_review > 0: danger token (red count + "Resolve exceptions →" link) resolves
  in peripheral vision immediately. Accountant knows before reading anything else that
  payroll cannot proceed. This is the most operationally critical signal on the page.
  — If pending_review = 0: all counts in neutral/success tokens — accountant knows the period
  is clean and proceeds to read the table.

Scan 2 (200ms–1s): Metric Strip — present and completed counts
  — Accountant verifies the aggregate totals match expectations for the factory headcount.
  "312 present out of 329 assigned" tells the period story in one read.

Scan 3 (1s–3s): Date Range Bar — verify the range is the correct pay period
  — Accountant confirms or adjusts the date range. Quick preset buttons (14d / 30d) handle
  most pay period selections without manual date entry.

Scan 4 (3s+): Daily Breakdown Table — identify anomaly rows
  — Warning-row treatment (left border + background) on rows with pending_review > 0 guides
  the eye to the specific problematic dates. Accountant identifies "29 May" as the anomaly,
  navigates to /attendance/review with that context.

Destructive actions: None — workspace is read-only. The "Resolve exceptions →" link is a
navigation shortcut, not a mutation. No confirmation dialogs, no bulk actions.
```

---

### C. Spacing & Rhythm Visualization

```
DENSE REGIONS (compact — maximum table visibility):
  - Workspace Header Bar: 48px — no internal padding waste
  - Date Range Bar: 52px — single row, 12px field gap
  - Metric Strip: 40px — 5 counts inline, 12px between units
  - Table rows: 36px compact height

BREATHABLE REGIONS (intentional space for readability):
  - Between metric strip and table: 12px — visual separation before the data surface
  - Table cells: 8px horizontal padding — enough breathing room for numeric scanning

VISUAL SILENCE ZONES:
  - Between Date Range Bar and Metric Strip: 8px
    → Minimal gap — these two zones are functionally related (range drives totals)
  - Between Metric Strip and Table: 12px
    → Slightly more space before the primary data surface — signals transition from summary to detail
  - Table right margin: max-w-7xl restraint — workspace does not span 100vw
    → Lateral calm prevents the 8-column table from feeling cramped on ultra-wide monitors
```

---

### D. Component Nesting Hierarchy

```
WorkstationShell ("Attendance reports", compact density, max-w-7xl)
  ├── WorkspaceHeaderBar [sticky, 48px]
  │     ├── WorkspaceTitle ("Attendance reports")
  │     ├── DateRangeLabel (JetBrains Mono — "27 May–03 Jun")
  │     ├── RefreshedTimestamp (JetBrains Mono — "Updated 14:22")
  │     ├── Link + Button ("Review queue" — outline)
  │     ├── [supervisor+ only] Link + Button ("Live board" — outline)
  │     └── Button (Refresh — ghost)
  │
  ├── DateRangeBar [52px]
  │     ├── Label ("Date range" — 13px/500)
  │     ├── Input (dateFrom, type="date")
  │     ├── Input (dateTo, type="date")
  │     ├── Button ("7d" — ghost, compact)
  │     ├── Button ("14d" — ghost, compact)
  │     └── Button ("30d" — ghost, compact)
  │
  ├── MetricStrip [40px, horizontal]
  │     ├── MetricUnit (Present — success token)
  │     ├── MetricUnit (Completed — info token)
  │     ├── MetricUnit (Pending review — danger/muted token)
  │     │     └── [if > 0] Link ("Resolve exceptions →" — danger text link)
  │     ├── MetricUnit (Late — warning token)
  │     ├── MetricUnit (Overtime — warning token)
  │     └── MetricUnit (of N total — neutral)
  │
  ├── [Conditional] MutationErrorBanner
  │
  └── LoadingBoundary
        └── DataTable (AttendanceReportDay, compact)
              └── columns: Date | Assigned | Punched in | Completed | Not punched |
                           Pending review | Late | Overtime
                  (row anomaly: pending_review > 0 → warning token treatment)
```

---

### E. Responsive Collapse Blueprint

```
1440px+ (Full workstation):
┌──────────────────────────────────────────────────────────────────────────────┐
│  HEADER BAR [48px sticky] ────────────────────────────────────────────────── │
│  DATE RANGE BAR [52px] ────────────────────────────────────────────────────  │
│  METRIC STRIP [40px] ──────────────────────────────────────────────────────  │
│  DAILY BREAKDOWN TABLE [full-width, 8 columns, compact rows] ───────────────  │
└──────────────────────────────────────────────────────────────────────────────┘

1024px–1279px (Compact desktop — Overtime column hides):
Same layout. Overtime column hidden below 1100px.
7 columns remain — all operationally critical columns visible.

<768px (Mobile — stacked, horizontal scroll on table):
┌─────────────────────────────────────┐
│  HEADER BAR [48px sticky, compact]   │
│  (title + refresh — links wrap)      │
├─────────────────────────────────────┤
│  DATE RANGE BAR [stacked full-width] │
│  [Date from input — full-width]      │
│  [Date to input — full-width]        │
│  [7d]  [14d]  [30d]  (inline)        │
├─────────────────────────────────────┤
│  METRIC STRIP [2×3 wrap]             │
│  312 Present   298 Completed         │
│  ⚠ 3 Pending   14 Late               │
│  6 Overtime    of 329 total          │
├─────────────────────────────────────┤
│  ERROR BANNER (if error)             │
├─────────────────────────────────────┤
│  TABLE [horizontal scroll]           │
│  Date | Punched | Pending | Late     │
│  ← → (ResponsiveScrollArea wrapper) │
└─────────────────────────────────────┘
All data accessible. Numeric alignment preserved via tabular-nums even on mobile.
Touch targets 44px (date inputs, preset buttons).
```

---

### F. Structural Consistency Validation

```yaml
structural_validation:
  - [x] All zones justified by operational necessity (hero eliminated; Card wrappers eliminated; KPI grid eliminated)
  - [x] Visual dominance matches attention priority (pending_review danger token P:1; table P:1; date controls P:2)
  - [x] Spacing rhythm follows compact density (8px zone gaps; 36px table rows; 12px section gap)
  - [x] Responsive adaptations preserve all operations (date selection, metric reading, table scanning all mobile-accessible)
  - [x] Component nesting matches Section 11
  - [x] No over-zoning — 4 zones (header, date range, metric strip, table) all operationally justified
  - [x] No KPI card explosion (4-card grid → compact metric strip)
  - [x] No duplicate action surfaces (single refresh location; duplicate button eliminated)
  - [x] Blueprint matches FULL-WIDTH COMMAND pattern declared in Section 4.1
```

---

## KIRO TASK CHAINING

```yaml
downstream_tasks:
  task_1:
    name: "Attendance Reports — Zone Scaffold"
    source: Section 4 (Structural Anatomy)
    output: WorkstationShell + 48px sticky header + date range bar + metric strip placeholder + table placeholder

  task_2:
    name: "Attendance Reports — Data Fetching Layer"
    source: Section 3.1, Section 3.4
    output: getAttendanceReportSummary(dateFrom, dateTo). useEffect on [dateFrom, dateTo] with 300ms debounce. canSeeReports role gate. 30s background poll. LoadingBoundary integration.

  task_3:
    name: "Attendance Reports — Header Bar + Date Range Bar"
    source: Section 4.2 (Header Bar + Date Range Bar zones)
    output: 48px sticky header (title, date range label, refreshed time, links, refresh button). 52px date range bar (2x Input, 3x preset ghost buttons, no submit button).

  task_4:
    name: "Attendance Reports — Metric Strip"
    source: Section 4.2 (Metric Strip zone), Section 8.3
    output: 5 inline metric units. Semantic tokens. pending_review danger state when > 0. "Resolve exceptions →" text link (conditional).

  task_5:
    name: "Attendance Reports — Daily Breakdown Table"
    source: Section 6 (Table Strategy)
    output: DataTable (8 columns). Compact density. Sticky header. Sorting. tabular-nums + right-align on numeric columns. JetBrains Mono on date column. Warning row treatment for pending_review > 0. LoadingBoundary empty state.

  task_6:
    name: "Attendance Reports — Error Handling + Permissions"
    source: Section 3.6, Section 5.3, Section 11
    output: MutationErrorBanner for fetch errors. "Refreshing…" state in header bar. canSeeReports role gate screen. Conditional "Live board" link for supervisor+.

  task_7:
    name: "Attendance Reports — Responsive"
    source: Section 10
    output: Overtime column hide at 1100px. Mobile stacked date range bar. Metric strip 2×3 wrap. Table horizontal scroll via ResponsiveScrollArea. Touch targets 44px.
```

---

*Status: COMPLETE — all 13 sections populated, all acceptance criteria met, post-generation validation passed.*
*Phase C progress: 4/8 complete — /approvals ✓, /attendance/live ✓, /attendance/review ✓, /attendance/reports ✓*
*Next: /ocr/scan — Phase C, Item 5.*
