# Tasks — Workspace Skeleton Architecture
# FactoryNerve OS | Phase 3 Skeleton Specification | Phase B, Item 2
# Route: /tasks
# Generated: 2026-06-03
# Status: DRAFT

---

## 1. WORKSPACE OVERVIEW

### 1.1 Identity

| Field | Value |
|---|---|
| Route | `/tasks` |
| Workspace Name | My Tasks — Daily Worker Board |
| Operational Role | Provides operator and supervisor roles with a single-focus daily task surface: the next pending shift entry (primary task), saved draft resume, offline queue status, and unread alert summary — all computed into a prioritised task list. Auto-refreshes every 25 seconds. |
| Business Impact | If this workspace fails, operators lose their primary navigation point for "what do I do next." The dashboard can serve as a fallback, but `/tasks` is the deliberate shift-worker home for roles that don't need the full management intelligence surface. |
| User Population | operator, supervisor only (`roleEligible` guard). All other roles see a redirect message to the operations board. Frequency: shift start and mid-shift check-ins. |
| Peak Usage Context | Shift start — operator opens tasks to find the next entry CTA. Mid-shift — checks offline queue and alert count. Mobile-first context: many operators access this on a shared phone or tablet. |
| Predecessor Workspaces | `/dashboard` (linked via quick actions) or direct navigation |
| Successor Workspaces | `/entry?date=X&shift=Y` (primary), `/ocr/scan` (capture), `/attendance` (punch status) |

### 1.2 Operational Importance

The tasks workspace is the shift worker's daily checklist. Unlike the dashboard (which presents management intelligence), `/tasks` answers one question: "what is the next thing I must do right now?" The auto-refresh (25s) keeps the board current across a full shift without requiring manual reload. The primary task CTA drives operators directly to the relevant entry form without needing to know their shift schedule or queue state — the system computes it. A broken tasks page means operators have to navigate manually, increasing the chance of missed entries or forgotten offline sync.

### 1.3 Current State Failures

- Hero section uses `rounded-[2rem] border border-[var(--border)] bg-[rgba(20,24,36,0.88)] shadow-2xl backdrop-blur` — same violations as settings and attendance-settings heroes: arbitrary radius, legacy alias border, raw rgba background, forbidden backdrop-blur on a static section, arbitrary shadow
- Hero eyebrow uses `text-sm uppercase tracking-[0.32em] text-[var(--accent)]` — tracking 5.3× maximum; raw alias token; must be `--type-label-dense` sentence case `text-action-primary`
- Hero `h1` uses `text-3xl md:text-4xl` — 30px/36px, far above the 18px ceiling
- Hero description and all text using `text-[var(--muted)]` — forbidden alias (11 instances across the component)
- All text using `text-[var(--text)]` — another legacy alias (6 instances)
- All text using `text-[var(--accent)]` — forbidden alias; the not-signed-in card eyebrow and not-eligible card eyebrow both use this
- `not-eligible` card uses `border border-[var(--border)] bg-[rgba(20,24,36,0.88)]` — legacy alias + raw rgba
- The `highlightCard(enabled)` function returns raw rgba strings: `border-[rgba(62,166,255,0.45)] bg-[rgba(62,166,255,0.12)]` for selected and `border-[var(--border)] bg-[rgba(20,24,36,0.88)]` for default — raw rgba blue and raw rgba dark background; must use `surface-selected border-focus` for selected, `surface-card border-subtle` for default
- The `taskTone(type)` function returns raw color strings: `border-emerald-400/30 bg-[rgba(34,197,94,0.12)] text-emerald-100` (good), `border-amber-400/30 bg-[rgba(245,158,11,0.12)] text-amber-100` (watch), `border-sky-400/30 bg-[rgba(56,189,248,0.12)] text-sky-100` (action) — all raw Tailwind color classes and raw rgba; must map to semantic tokens
- `supportingTasks` uses `<details>/<summary>` for "More tasks" — forbidden pattern; must be always visible (these are tasks the operator needs to act on)
- "Task tools" section uses `<details>/<summary>` — forbidden pattern; the four quick-navigation links should always be visible
- "More alerts" section uses `<details>/<summary>` — same violation; up to 5 additional alerts hidden behind disclosure
- GuidanceBlock step cards use `border-[var(--border)] bg-[var(--card-strong)]` — legacy aliases
- Status tile labels ("Pending shifts", "Saved draft", "Offline queue", "Unread alerts") use `text-xs uppercase tracking-[0.2em] text-[var(--muted)]` — uppercase + tracking violation + forbidden alias; must be `--type-label-dense` sentence case `text-text-tertiary`
- All `CardTitle` components use `text-xl` — above the 16px ceiling; same violation as settings and attendance
- All submitted entry cards and alert cards use `rounded-2xl border border-[var(--border)] bg-[var(--card-strong)]` — legacy aliases and arbitrary radius
- Empty states use `border-dashed border-[var(--border)]` — legacy alias; must be `border-dashed border-border-subtle`
- Error and refreshing banners use `rounded-2xl border border-red-400/30 bg-[rgba(239,68,68,0.12)] text-red-100` — raw color and raw rgba; must use `status-danger-bg/border/fg`; the refreshing banner uses `border-[var(--border)] bg-[var(--card-strong)] text-[var(--muted)]` — legacy aliases
- Loading skeletons use `rounded-[2rem]` and `rounded-2xl` — arbitrary radius; must use `rounded-panel`
- Not-signed-in and not-eligible error state links use `<Link><Button>` nesting — same accessibility violation flagged throughout Phase A
- The "Start now" button in the primary task card uses `<Link><Button>` — same accessibility violation
- All "Open" buttons in entry and alert cards use `<Link><Button>` — same violation pattern repeated
- Primary task card uses `taskTone()` raw color output as a CSS class value: `rounded-3xl border px-5 py-5 ${taskTone(...)}` — arbitrary `rounded-3xl` + raw color injection

---

## 2. WORKSPACE CLASSIFICATION

| Dimension | Classification | Rationale |
|---|---|---|
| Workspace Type | Operational Form Hub (pre-entry checklist) | Worker-first daily task routing surface |
| Workflow Category | Execution | Operator completes a sequential list of shift tasks |
| Operational Behavior | Queue-Based (task priority computed dynamically) | Tasks ordered by urgency: shift entry → draft → sync → alerts |
| Data Density | MEDIUM | 4 status tiles + primary task + supporting tasks + submitted entries + alerts |
| Realtime Complexity | LOW | Auto-refresh polling (setInterval 25s); `subscribeToQueueUpdates`; visibility change handler |
| AI Complexity | NONE | No AI systems |
| Audit Complexity | NONE | No audit events written |
| Decision Pressure | HIGH at shift start | Operator has limited time at shift start; primary task must be findable in <2 seconds |

**Classification Implication:**
A HIGH-decision-pressure, MEDIUM-density worker task board means the primary CTA must dominate visually. The task list is pre-sorted by the system — the operator does not choose; they follow. The two-column grid (task panel left, status tiles right) correctly groups actionable content on the left and context on the right. The main fix need is eliminating all three `<details>/<summary>` disclosures — supporting tasks, task tools, and more alerts are all operational content that should be visible, not hidden.

---

## 3. BACKEND OPERATIONAL MAPPING

### 3.1 API Surface

| Endpoint | Method | Purpose | Permission | Caching |
|---|---|---|---|---|
| `GET /entries` (today filter) | GET | `getTodayEntries()` — current shift submissions | operator, supervisor | 5s |
| `GET /alerts` | GET | `listUnreadAlerts()` — unread factory alerts | Auth | 10s |
| `GET /auth/active-workflow-template` | GET | `getActiveWorkflowTemplate()` — factory template label for hero context chip | Auth | 30s |
| (offline) `countQueuedEntries(userId)` | — | Client-side IndexedDB offline queue count | — | — |
| (offline) `loadDraft(userId)` | — | Client-side saved entry draft | — | — |

**Load strategy:** `Promise.allSettled` — same resilience pattern as dashboard. All 5 tasks run in parallel. First failure sets `state.error` but does not block rendering from partial data.

**Realtime:**
- `setInterval(25_000)` — background refresh (skips when tab is hidden via `document.hidden`)
- `document.visibilitychange` — triggers refresh when tab becomes visible again
- `subscribeToQueueUpdates` — updates `queueCount` when IndexedDB queue changes

### 3.2 Entity Relationship Map

```
User (id, role)
    ├── Entry × today (shift, units_produced, status, created_at)
    ├── AlertItem × unread (id, message, severity, alert_type, created_at)
    ├── EntryDraft (shift, date — client-side IndexedDB)
    ├── queueCount (integer — client-side IndexedDB)
    └── ActiveWorkflowTemplateContext (workflow_template_label, industry_type)
```

**Primary entity:** Derived state — `quickTasks[]` computed from entries + draft + queue + alerts.

### 3.3 Workflow State Machine

```
[PAGE LOAD]
  → if !roleEligible(user.role): render access-denied state
  → Promise.allSettled(5 tasks) → setTodayEntries + setAlerts + setQueueCount + setDraft + setTemplateContext

[TASK PRIORITY RESOLUTION (quickTasks computation)]
  Priority 1: pendingShifts > 0 → "Complete the [shift] shift entry" → /entry?shift=X  (tone: action)
  Priority 2: draft exists AND not already submitted → "Continue your saved draft" → /entry?draft  (tone: watch)
  Priority 3: queueCount > 0 → "Sync the offline queue" → /tasks?focus=offline  (tone: watch)
  Priority 4: alerts.length > 0 → "Review factory alerts" → /dashboard  (tone: action)
  Fallback: "You are clear for now" → /dashboard  (tone: good)

[AUTO-REFRESH CYCLE]
  → setInterval 25s → if !document.hidden: loadTasks({ background: true }) → setRefreshing=true
  → visibilitychange → if tab visible: loadTasks({ background: true })
  → subscribeToQueueUpdates → countQueuedEntries → setQueueCount

[USER ACTIONS]
  → click "Start now" / "Open" → navigate to href
  → click "Refresh Tasks" button → loadTasks({ background: true })
```

### 3.4 Realtime Contracts

| System | Transport | Update Rate | Zones Affected |
|---|---|---|---|
| Auto-refresh | setInterval | 25s | All task content (entries, alerts, queue) |
| Queue subscription | Client event | On IndexedDB write | `queueCount` tile, supporting task item |
| Tab visibility | browser event | Instant on focus | Full task refresh |

### 3.5 AI System Contracts

Not applicable — no AI systems.

### 3.6 Permission Matrix

| Role | Access |
|---|---|
| attendance | ✗ — `canUseTasks=false` → access-denied card (not the task board) |
| operator | ✓ — full task board |
| supervisor | ✓ — full task board |
| accountant | ✗ → access-denied card |
| manager | ✗ → access-denied card |
| admin | ✗ → access-denied card |
| owner | ✗ → access-denied card |

**Permission implication:** The access-denied state must direct non-eligible roles to the operations board (`/dashboard`) and approval inbox (`/approvals`) — the correct destinations for their roles. The current access-denied card eyebrow uses raw `text-[var(--accent)]` alias — must use `text-action-primary`.

---

## 4. WORKSPACE STRUCTURAL ANATOMY

### 4.1 Layout Pattern

```
FULL-WIDTH COMMAND with internal TWO-COLUMN GRID sections
```

- Inside AppShell (sidebar + topbar present)
- Page container: max-width 1280px, standard AppShell padding
- Page structure (top to bottom):
  1. Page header zone
  2. Guidance block (task tips)
  3. Status/error/refresh banners (conditional)
  4. Two-column grid (section A): Primary task card + Today status card
  5. Two-column grid (section B): Submitted entries card + Alerts card

**Structural reduction note:** Three `<details>/<summary>` elements are removed:
- "More tasks" — supporting tasks are operational and must be always visible below the primary task
- "Task tools" — navigation links (Entry, Capture, Steel Ops, Operations) are always useful during shift and must not be hidden
- "More alerts" — up to 5 additional alerts are relevant to the operator; hiding them behind a disclosure is the opposite of the Trust-First principle

---

### 4.2 Zone Definitions

---

#### ZONE: Page Header

| Property | Value |
|---|---|
| Operational Role | Establishes workspace identity, factory context, and refresh timestamp; provides the manual refresh button |
| Attention Priority | 4 |
| Position | top of content |
| Width | full content width |
| Height | content-driven |
| Sticky | not sticky |
| Density | default |
| Existence Justification | Factory name + workflow template context + refresh control + last-updated timestamp |

**Contents:**
- Eyebrow: "Daily work" — `--type-label-dense` (11px/500/`text-action-primary`/sentence case); NOT `uppercase tracking-[0.32em]`
- Title: "My tasks" — `--type-page-title` (18px/600/sentence case); NOT `text-3xl md:text-4xl`
- Subtitle: 14px/400/`text-text-secondary`; NOT `text-[var(--muted)]`
- Context chips: Factory name + Workflow label — `surface-elevated border-subtle rounded-full`, `--type-label-dense` sentence case
- `Button variant="outline"` "Refresh tasks" — `isBusy` when refreshing; sentence case
- Last updated timestamp: `--type-timestamp` (11px/JetBrains Mono); NOT `text-[var(--muted)]`
- Container: `surface-panel border-subtle rounded-panel` — NO `rgba(20,24,36,0.88)`, NO `backdrop-blur`, NO `shadow-2xl`

**Acceptance Criteria:**
- [ ] No backdrop-blur — `surface-panel border-subtle` only
- [ ] Eyebrow 11px/500/sentence case/`text-action-primary`
- [ ] Title 18px/600 — NOT text-3xl
- [ ] Refresh button uses `isBusy` pattern
- [ ] Last-updated timestamp uses `--type-timestamp` (monospace only for timestamps)
- [ ] Context chips use `surface-elevated border-subtle` — NOT `border-[var(--border)]`

---

#### ZONE: Guidance Block

| Property | Value |
|---|---|
| Operational Role | 3-step contextual tips for the task workflow (start next / check saved / clear signals) |
| Attention Priority | 5 |
| Position | below page header |
| Width | full content width |
| Height | content-driven |
| Sticky | not sticky |
| Density | default |
| Existence Justification | `GuidanceBlock` with `surfaceKey="my-tasks"` — shown once per session by default (autoOpenVisits=1) |

**Step cards fix:**
- Currently: `rounded-2xl border border-[var(--border)] bg-[var(--card-strong)]` — legacy aliases, arbitrary radius
- Must be: `surface-panel border-subtle rounded-control`
- Step label: `--type-label` (13px/500/`text-text-primary`) sentence case
- Step detail: `--type-body` (14px/400/`text-text-secondary`)

**Acceptance Criteria:**
- [ ] Step cards use `surface-panel border-subtle rounded-control` — NOT legacy aliases
- [ ] Step labels sentence case — NOT uppercase

---

#### ZONE: Status Banners

| Property | Value |
|---|---|
| Operational Role | Error feedback + background refresh indicator + session error |
| Attention Priority | 1 (when visible) |
| Position | below guidance block, above task grid |
| Width | full content width |
| Height | content-driven when visible |
| Existence Justification | `error`, `refreshing`, `sessionError` states |

**Contents:**
- Error banner: `status-danger-bg border-danger text-status-danger-fg rounded-panel` — NOT raw rgba + raw red
- Refreshing banner: `surface-panel border-subtle text-text-secondary rounded-panel` — NOT `border-[var(--border)] bg-[var(--card-strong)] text-[var(--muted)]`
- Session error: same as error banner

**Acceptance Criteria:**
- [ ] Error uses `status-danger-bg/border/fg` semantic tokens
- [ ] Refreshing uses `surface-panel border-subtle text-text-secondary`

---

#### ZONE: Primary Task Card [P:1]

| Property | Value |
|---|---|
| Operational Role | Shows the computed highest-priority task with a direct action CTA; shows supporting tasks below (always visible — NOT <details>) |
| Attention Priority | 1 |
| Position | left column (section A), ~52% |
| Width | ~52% desktop; 100% mobile |
| Height | content-driven |
| Density | default |
| Existence Justification | `primaryTask` (first of `quickTasks[]`) + `supportingTasks` (remaining) — the core value of the workspace |

**Contents:**
- Section sub-label: "Next task" — `--type-label-dense` (11px/500/`text-text-tertiary`) sentence case; NOT `text-sm text-[var(--muted)]`
- Section title: "Complete the next shift entry" / "You are clear for now" — `--type-panel-title` (16px/600); NOT `text-xl`

**Primary task block (when `primaryTask !== null`):**
- Container: semantic tone surface based on task tone (not `highlightCard()` raw rgba output):
  - tone="action" → `status-processing-bg border-status-processing-border` (maps to sky semantic)
  - tone="watch" → `status-warning-bg border-status-warning-border`
  - tone="good" → `status-success-bg border-status-success-border`
- Radius: `rounded-panel` — NOT `rounded-3xl`
- Task title: 14px/600/`text-text-primary`; NOT `text-[var(--text)]`
- Task detail: 14px/400/`text-text-secondary`; NOT `text-[var(--muted)]`
- "Start now" CTA: `Button variant="primary" asChild` + `Link` — NOT `<Link><Button>`

**Supporting tasks (ALWAYS VISIBLE — NOT <details>):**
- Rendered as a stacked list below the primary task block
- Each supporting task card: `surface-panel border-subtle rounded-control`; semantic tone classes per taskTone
- "Open" button: `Button variant="outline" asChild` + `Link`

**Task tone semantic map (replaces `taskTone()` raw color function):**
```typescript
function taskToneClass(type: "good" | "watch" | "action"): string {
  if (type === "good")   return "bg-status-success-bg border-status-success-border text-status-success-fg";
  if (type === "watch")  return "bg-status-warning-bg border-status-warning-border text-status-warning-fg";
  return "bg-surface-selected border-border-focus text-text-primary";  // action type
}
```

**Acceptance Criteria:**
- [ ] Section title 16px/600 — NOT text-xl
- [ ] Primary task container uses `rounded-panel` — NOT `rounded-3xl`
- [ ] Task tone uses semantic token classes — NOT raw rgba/emerald/amber/sky
- [ ] "Start now" uses `Button asChild + Link` — NOT `<Link><Button>`
- [ ] Supporting tasks ALWAYS VISIBLE — NOT inside `<details>/<summary>`
- [ ] Supporting task "Open" buttons use `Button asChild + Link`
- [ ] `highlightCard(true)` returns `surface-selected border-focus` — NOT raw rgba blue

---

#### ZONE: Today Status Card [P:2]

| Property | Value |
|---|---|
| Operational Role | 4 status tiles (pending shifts, saved draft, offline queue, unread alerts) + task tool links (always visible) |
| Attention Priority | 2 |
| Position | right column (section A), ~48% |
| Width | ~48% desktop; 100% mobile |
| Height | content-driven |
| Density | default |
| Existence Justification | `pendingShifts`, `draft`, `queueCount`, `alerts.length` — 4 operational signals that drive awareness without requiring navigation |

**Contents:**
- Section sub-label: "Today status" — `--type-label-dense` sentence case
- Section title: "Keep the shift moving" — 16px/600

**Status tiles (2×2 grid):**
- Each tile: `surface-card border-subtle rounded-control` (default); `surface-selected border-focus` (when `focus` param matches or tile is active)
- Tile label: `--type-label-dense` (11px/500/`text-text-tertiary`/sentence case) — NOT `text-xs uppercase tracking-[0.2em] text-[var(--muted)]`
- Tile value: 20px/600/tabular-nums/`text-text-primary` — NOT `text-xl text-[var(--text)]`
- Tile detail: 12px/400/`text-text-tertiary`

**Task tools section (ALWAYS VISIBLE — NOT <details>):**
- Subtitle: 13px/400/`text-text-secondary` sentence case
- Navigation buttons: `Button variant="outline"` + `Button variant="ghost"` (Operations); `Button asChild` + `Link` for each
- Conditional: Steel Ops button shown only when `isSteelFactory=true`

**Acceptance Criteria:**
- [ ] Tile labels sentence case `--type-label-dense` — NOT uppercase tracking
- [ ] Tile values 20px/600/tabular-nums — NOT `text-xl text-[var(--text)]`
- [ ] Active tile uses `surface-selected border-focus` — NOT `highlightCard(true)` raw rgba output
- [ ] Default tile uses `surface-card border-subtle` — NOT raw rgba dark bg
- [ ] Task tools ALWAYS VISIBLE — NOT inside `<details>/<summary>`
- [ ] Section title 16px/600 — NOT text-xl
- [ ] All navigation buttons use `Button asChild + Link` pattern

---

#### ZONE: Submitted Entries Card [P:3]

| Property | Value |
|---|---|
| Operational Role | Shows today's submitted shift entries — confirms what has been completed and links to each entry detail |
| Attention Priority | 3 |
| Position | left column (section B), ~52% |
| Width | ~52% desktop; 100% mobile |
| Height | content-driven |
| Density | default |
| Existence Justification | `todayEntries[]` — shows shift completion status; every submitted entry is a reference for the operator |

**Contents:**
- Section sub-label: "Submitted today" — `--type-label-dense` sentence case
- Section title: "Shift progress" — 16px/600
- Entry items: `surface-panel border-subtle rounded-control` — NOT `rounded-2xl border-[var(--border)] bg-[var(--card-strong)]`
  - Shift label: 14px/600/`text-text-primary`; NOT `text-[var(--text)]`
  - Detail (units produced + status): 12px/400/`text-text-tertiary`; NOT `text-[var(--muted)]`
  - "Open" button: `Button variant="outline" asChild + Link` — NOT `<Link><Button>`
- Empty state: `surface-panel border-dashed border-border-subtle rounded-control` + 14px/400/`text-text-secondary`; NOT `border-dashed border-[var(--border)] text-[var(--muted)]`

**Acceptance Criteria:**
- [ ] Section title 16px/600 — NOT text-xl
- [ ] Entry items use canonical surface/border tokens — NOT legacy aliases
- [ ] "Open" buttons use `Button asChild + Link` — NOT `<Link><Button>`
- [ ] Empty state uses `border-border-subtle` — NOT `border-[var(--border)]`

---

#### ZONE: Alerts Card [P:4]

| Property | Value |
|---|---|
| Operational Role | Shows unread factory alerts — top alert visible; all additional alerts always visible below (NOT <details>) |
| Attention Priority | 4 |
| Position | right column (section B), ~48% |
| Width | ~48% desktop; 100% mobile |
| Height | content-driven |
| Density | default |
| Existence Justification | `alerts[]` from `GET /alerts` — operator must be aware of unread factory signals affecting their workflow |

**Contents:**
- Section sub-label: "Attention signals" — `--type-label-dense` sentence case
- Section title: "Current alerts" — 16px/600
- Top alert + additional alerts (up to 5): ALL VISIBLE — NOT inside `<details>/<summary>`
  - Alert item: `surface-panel border-subtle rounded-control`
  - Alert message: 14px/600/`text-text-primary`
  - Meta (severity + type + date): 12px/400/`text-text-tertiary`; formatted date uses `--type-timestamp`
  - "Open board" button: `Button variant="outline" asChild + Link href="/dashboard"`
- Empty state: `surface-panel border-dashed border-border-subtle rounded-control` + 14px/400/`text-text-secondary`

**Acceptance Criteria:**
- [ ] Section title 16px/600 — NOT text-xl
- [ ] ALL alerts visible (up to 5) — NOT inside `<details>/<summary>`
- [ ] Alert items use `surface-panel border-subtle rounded-control` — NOT legacy aliases
- [ ] "Open board" button uses `Button asChild + Link` — NOT `<Link><Button>`
- [ ] Alert meta uses `text-text-tertiary` — NOT `text-[var(--muted)]`

### 4.3 Zone Interaction Rules

```yaml
zone_interactions:
  - trigger: pendingShifts > 0 (highest priority)
    effect: Primary task card title = "Complete the [shift] shift entry"; CTA → /entry?shift=X; tone=action
    reason: incomplete shift entry is the operator's primary daily obligation

  - trigger: draft exists AND not submitted
    effect: Supporting tasks (or primary if no pending shifts) = "Continue your saved draft"; tone=watch
    reason: saved draft represents partial work that must be completed

  - trigger: queueCount > 0
    effect: Supporting task = "Sync the offline queue"; tile highlighted; tone=watch
    reason: offline items must sync before they are lost or create conflicts

  - trigger: alerts.length > 0
    effect: Supporting task = "Review factory alerts"; alerts card shows all alerts; tone=action
    reason: unread alerts may indicate required operator action

  - trigger: all conditions clear (no pending, no draft, no queue, no alerts)
    effect: Primary task = "You are clear for now" (tone=good); no supporting tasks
    reason: shift is complete; system confirms clean state

  - trigger: searchParams.focus === "offline" / "today" / "draft" / "alerts"
    effect: corresponding status tile highlighted with surface-selected border-focus
    reason: deep-link from operator dashboard quick actions — highlights the relevant tile

  - trigger: setInterval 25s (AUTO_REFRESH_MS) + !document.hidden
    effect: loadTasks({ background: true }) → refreshing=true → all data re-fetched
    reason: keeps board current during an active shift without page reload

  - trigger: subscribeToQueueUpdates fires
    effect: queueCount updates; tile value refreshes; supporting task may appear/disappear
    reason: offline queue changes in real-time as entries are synced or added

  - trigger: isSteelFactory === true
    effect: "Steel Ops" button shown in task tools section
    reason: steel-industry operators have direct steel operations access from tasks
```

---

## 5. OPERATIONAL ATTENTION HIERARCHY

### 5.1 Scan Flow

```
SCAN 1 (0–200ms): Primary task title + "Start now" CTA
  WHY: The primary task card is the left column, top section. Its semantic
  tone background (action=blue, watch=amber, good=green) captures attention
  before text is read. The operator knows urgency before reading the label.
  The CTA is always the next action — no decision required.

SCAN 2 (200ms–800ms): 4 status tiles (pending / draft / queue / alerts)
  WHY: The 2×2 tile grid in the right column gives a numeric snapshot of
  the shift state. Operators scan the numbers, not the labels. If a tile
  is highlighted (surface-selected), it confirms which condition drove the
  primary task.

SCAN 3 (800ms–2s): Supporting tasks + submitted entries
  WHY: After acting on the primary task, operators check supporting tasks
  (what else needs attention) and submitted entries (what have I done today).

SCAN 4 (2s+): Alerts + task tools + page header context
  WHY: Alerts are reference context unless they were the primary task driver.
  Task tools (Entry, Capture, Steel Ops) are secondary navigation. Page header
  (refresh, timestamp) is background operational context.
```

### 5.2 Persistent Visibility Requirements

| Element | Reason |
|---|---|
| Primary task CTA | Must be reachable without scroll on standard viewports (shift pressure) |
| Supporting tasks | All tasks must be visible — hiding behind disclosure defeats the trust-first principle |
| Task tools | Navigation links must be immediately accessible after completing primary task |

---

## 6. TABLE & DATA STRATEGY

No tables — workspace uses cards with inline data. Submitted entries are compact card items, not table rows. Row volume is maximum 3 entries per day (morning/evening/night) — no table or virtualization needed.

---

## 7. FORM & INPUT STRATEGY

No forms. The refresh button is the only interactive element on the page besides navigation links. All user actions are navigations to other workspaces (entry form, scan, attendance).

---

## 8. AI & AUDIT VISIBILITY STRATEGY

Not applicable — no AI systems, no audit events written.

---

## 9. DENSITY, SPACING & LAYOUT RHYTHM

### 9.1 Density Mode

```yaml
default_density: default
density_justification: Shift worker context — default density provides comfortable
  touch targets on mobile. The status tiles and task cards need clear visual
  separation for quick scanning under shift pressure.
density_switchable: yes — inherits AppShell
```

### 9.2 Spacing Rhythm

```yaml
spacing:
  page_padding: AppShell standard (24px–40px horizontal)
  zone_gap: 24px (--space-lg) between all page sections
  two_column_gap: 24px (--space-lg) between left and right columns
  card_padding: 20px (--space-5)
  tile_grid_gap: 12px (--space-3)
  tile_padding: 16px (--space-md)
  task_item_gap: 12px (--space-3) between supporting tasks
  entry_item_gap: 12px (--space-3) between submitted entries
  alert_item_gap: 12px (--space-3) between alerts
```

### 9.3 Typography Specification

```yaml
typography:
  page_eyebrow: 11px / 500 / sentence case / text-action-primary
  page_title: 18px / 600 / sentence case
  page_subtitle: 14px / 400 / text-text-secondary
  context_chip: 11px / 500 / sentence case / text-text-secondary
  refresh_timestamp: 11px / 400 / JetBrains Mono (--type-timestamp)
  section_sublabel: 11px / 500 / sentence case / text-text-tertiary
  section_title: 16px / 600 / sentence case  (NOT text-xl)
  task_title: 14px / 600 / text-text-primary
  task_detail: 14px / 400 / text-text-secondary
  tile_label: 11px / 500 / sentence case / text-text-tertiary  (NOT uppercase)
  tile_value: 20px / 600 / tabular-nums / text-text-primary
  tile_detail: 12px / 400 / text-text-tertiary
  entry_label: 14px / 600 / text-text-primary
  entry_meta: 12px / 400 / text-text-tertiary
  alert_message: 14px / 600 / text-text-primary
  alert_meta: 12px / 400 / text-text-tertiary
  guidance_step_label: 13px / 500 / sentence case / text-text-primary
  guidance_step_detail: 14px / 400 / text-text-secondary
  error_message: 13px / 400 / text-status-danger-fg
  refreshing_message: 13px / 400 / text-text-secondary
```

### 9.4 Surface Token Hierarchy

```yaml
surfaces:
  page_background: var(--surface-shell)
  page_header: var(--surface-panel) with border-subtle
  section_card: var(--surface-card) with border-subtle
  tile_default: var(--surface-card) with border-subtle
  tile_active: var(--surface-selected) with border-focus
  primary_task_action: border-border-focus bg-surface-selected  (action tone)
  primary_task_watch: var(--status-warning-bg) with border-status-warning-border
  primary_task_good: var(--status-success-bg) with border-status-success-border
  supporting_task_item: var(--surface-panel) with border-subtle
  entry_item: var(--surface-panel) with border-subtle
  alert_item: var(--surface-panel) with border-subtle
  empty_state: var(--surface-panel) with border-dashed border-border-subtle
  error_banner: var(--status-danger-bg) with border-status-danger-border
  refreshing_banner: var(--surface-panel) with border-subtle
  guidance_step: var(--surface-panel) with border-subtle
```

---

## 10. RESPONSIVE & OPERATOR ADAPTATION

### 10.1 Desktop

```yaml
desktop:
  min_width: 1280px
  section_a: xl:grid-cols-[1.05fr_0.95fr]
  section_b: xl:grid-cols-[1.05fr_0.95fr]
```

### 10.2 Mobile (Primary Use Case)

```yaml
mobile:
  width_range: <768px
  layout: single column; all cards stack
  tile_grid: 2-col preserved (sm:grid-cols-2)
  task_tools: stacked buttons; flex-wrap
  touch_targets: all buttons ≥44px; all CTA links ≥44px
  notes: >
    Many operators access tasks on a shared factory phone. Mobile is high-priority.
    CTA "Start now" button must be ≥44px height on mobile.
    Status tiles must remain 2-col on sm+ for compact overview.
```

---

## 11. COMPONENT MAPPING

```yaml
component_mapping:
  workspace_container:
    component: <main> inside AppShell
    max_width: 1280px

  page_header:
    component: inline section — surface-panel border-subtle rounded-panel
    critical_fix: Remove backdrop-blur + rgba + shadow-2xl

  guidance_block:
    component: GuidanceBlock (existing — preserves autoOpenVisits=1 behavior)
    step_cards_fix: rounded-control + surface-panel/border-subtle — NOT legacy aliases

  primary_task_card:
    component: Card (surface-card/border-subtle)
    primary_task_block: inline div with taskToneClass() semantic tokens + rounded-panel
    primary_cta: Button variant="primary" asChild + Link
    supporting_tasks: always-visible stacked list (NOT <details>)
    supporting_item_cta: Button variant="outline" asChild + Link

  today_status_card:
    component: Card (surface-card/border-subtle)
    tiles: 2×2 grid; surface-card/border-subtle (default) or surface-selected/border-focus (active)
    tile_labels: --type-label-dense sentence case — NOT uppercase tracking
    tile_values: 20px/600/tabular-nums
    task_tools: always-visible flex-wrap row (NOT <details>)
    tool_buttons: Button outline/ghost asChild + Link

  submitted_entries_card:
    component: Card (surface-card/border-subtle)
    entry_items: surface-panel/border-subtle/rounded-control
    open_buttons: Button variant="outline" asChild + Link

  alerts_card:
    component: Card (surface-card/border-subtle)
    alert_items: surface-panel/border-subtle/rounded-control; ALL VISIBLE (NOT <details>)
    open_button: Button variant="outline" asChild + Link href="/dashboard"

  status_banners:
    component: inline div with semantic token classes
    error: status-danger-bg/border/fg
    refreshing: surface-panel/border-subtle/text-text-secondary

  loading_skeletons:
    fix: rounded-panel (NOT rounded-[2rem] or rounded-2xl)

  access_denied_states:
    fix: eyebrow text-action-primary (NOT text-[var(--accent)]);
      text-text-secondary for body (NOT text-[var(--muted)]);
      Button asChild + Link (NOT <Link><Button>)

  task_tone_function:
    fix: return canonical semantic Tailwind class strings (NOT raw rgba/color classes)
    new_implementation: Section 9.4 surface token hierarchy

  highlight_card_function:
    fix: return "bg-surface-selected border-focus" for true;
      "bg-surface-card border-border-subtle" for false (NOT raw rgba)
```

---

## 12. OPERATIONAL PROBLEMS SOLVED

```yaml
problem_resolutions:
  - problem: Three <details>/<summary> elements hiding operational content
    root_cause: Developer used disclosure to reduce visual density for the "more tasks",
      "task tools", and "more alerts" sections; but all three contain operational content
      operators need during their shift
    structural_solution: Section 4.2 zone specs require always-visible content for
      supporting tasks, task tools, and additional alerts; Section 4.3 confirms no collapse
      triggers; Section 11 component mapping removes all three disclosures
    section_reference: Section 4.2 (all four zones), Section 11
    measurable_outcome: All supporting tasks, navigation links, and alerts visible without
      any click; operators complete shift tasks faster with full context visible

  - problem: taskTone() and highlightCard() return raw rgba + raw Tailwind color strings
    root_cause: Helper functions built before semantic token mapping was established;
      inject raw color values as Tailwind class strings
    structural_solution: Section 9.4 provides the canonical semantic token mapping;
      Section 4.2 (Primary Task Card) documents new taskToneClass() implementation
    section_reference: Section 9.4, Section 4.2
    measurable_outcome: Zero raw rgba or raw color Tailwind classes in the component

  - problem: Hero backdrop-blur + raw rgba + shadow-2xl + text-3xl/text-4xl
    root_cause: Same pattern as settings and attendance-settings — glassy hero aesthetic
    structural_solution: Section 9.4 specifies page_header as surface-panel + border-subtle;
      Section 4.2 page header zone specifies 18px/600 title; acceptance criteria explicit
    section_reference: Section 9.4, Section 4.2
    measurable_outcome: Page header is flat surface-panel; title at 18px; consistent with
      all other workspace headers in Phase A/B

  - problem: All text uses var(--muted), var(--text), var(--accent) legacy aliases (17 instances)
    root_cause: Component built on the legacy token alias system; same root cause as profile
    structural_solution: Section 9.3 maps every text style to canonical classes;
      Section 11 documents the canonical classes per element type
    section_reference: Section 9.3, Section 11
    measurable_outcome: Zero legacy alias token references in the component

  - problem: Status tile labels use uppercase tracking-[0.2em] — 3.3× maximum
    root_cause: Same governance confusion as settings users tab — tile labels treated
      as column headers when they are field labels
    structural_solution: Section 9.3 tile_label at 11px/500/sentence case;
      Section 4.2 today status card acceptance criteria require sentence case
    section_reference: Section 9.3, Section 4.2
    measurable_outcome: All tile labels sentence case; zero uppercase in the component

  - problem: <Link><Button> accessibility violation in 8+ locations
    root_cause: Same pattern flagged across all Phase A/B workspaces
    structural_solution: Section 11 specifies Button asChild + Link for every navigation element;
      Section 4.2 acceptance criteria for each zone explicitly require Button asChild
    section_reference: Section 11, Section 4.2 (all zones)
    measurable_outcome: Zero <a><button> nesting in the component
```

---

## 13. IMPLEMENTATION HANDOFF

### 13.1 Build Sequence

```yaml
implementation_sequence:
  step_1: Replace all 17 legacy alias token references (var(--muted), var(--text),
    var(--accent), var(--border), var(--card-strong)) with canonical token classes;
    do this as a batch
  step_2: Fix hero section — remove backdrop-blur/rgba/shadow; surface-panel + border-subtle;
    fix eyebrow/title/description typography
  step_3: Fix taskTone() function — return canonical semantic class strings
  step_4: Fix highlightCard() function — return surface-selected/border-focus or surface-card/border-subtle
  step_5: Remove "More tasks" <details>/<summary> — supporting tasks always visible
  step_6: Remove "Task tools" <details>/<summary> — navigation buttons always visible
  step_7: Remove "More alerts" <details>/<summary> — all alerts (up to 5) always visible
  step_8: Fix all <Link><Button> nesting to Button asChild + Link pattern (8+ locations)
  step_9: Fix all CardTitle from text-xl to 16px/600 (--type-panel-title)
  step_10: Fix status tile labels from uppercase tracking to --type-label-dense sentence case
  step_11: Fix primary task container from rounded-3xl to rounded-panel
  step_12: Fix all item cards (entries, alerts, guidance steps) from legacy aliases to
    surface-panel/border-subtle/rounded-control
  step_13: Fix loading skeletons from rounded-[2rem]/rounded-2xl to rounded-panel
  step_14: Fix access-denied error states — canonical tokens + Button asChild
  step_15: Fix error/refreshing banners — status-danger/surface-panel semantic tokens
  step_16: Verify refresh button uses isBusy pattern; timestamp uses --type-timestamp
```

### 13.2 Critical Constraints

```yaml
critical_constraints:
  - "Supporting tasks, task tools, and additional alerts must ALL be always visible —
     do not replace <details>/<summary> with another collapse mechanism"
  - "Task priority order must be preserved: shift entry → draft → sync → alerts → clear"
  - "AUTO_REFRESH_MS = 25_000 interval must be preserved — skip when document.hidden"
  - "subscribeToQueueUpdates must be preserved for real-time queue count"
  - "Promise.allSettled must be preserved — partial failure is acceptable"
  - "isSteelFactory condition for Steel Ops tool button must be preserved"
  - "All surfaces use canonical CSS token variables — no hex, no rgba"
```

### 13.3 Open Questions

```yaml
open_questions:
  - question: >
      The action task tone currently maps to sky/blue raw colors (rgba(56,189,248,...)).
      The canonical token for "action in progress" is status-processing-* but there is
      no clear "sky blue" semantic in the standard token set. Should action-type tasks
      use surface-selected/border-focus (the interactive selection surface), or should a
      new status-action-* token be requested?
    blocking: no — surface-selected/border-focus is visually appropriate and semantically
      correct for "the thing to act on now"; only matters if there is a strong product
      preference for sky blue vs. the action-primary blue
    owner: product owner / design

  - question: >
      The GuidanceBlock component is used with autoOpenVisits=1 which means it shows
      on first visit and can be dismissed. Should the guidance block be removed entirely
      for a leaner task page, or is it valuable for new operators?
    blocking: no — keeping it is conservative and correct; removal is a UX simplification
    owner: product owner

open_questions_blocking: none
```

---

## ACCEPTANCE CRITERIA (SPEC COMPLETENESS)

- [x] All 13 sections fully populated
- [x] Every zone has documented existence justification and testable acceptance criteria
- [x] Every component mapped to existing primitives
- [x] Every failure from Section 1.3 has a resolution in Section 12
- [x] Reduction audit: 3 <details>/<summary> removed; supporting tasks/tools/alerts always visible
- [x] No anti-patterns in spec
- [x] All spacing 4px scale
- [x] All surfaces canonical tokens
- [x] Typography follows approved system
- [x] Backend API verified (5 endpoints + 2 offline clients confirmed)
- [x] Permission matrix complete (operator + supervisor only)
- [x] No blocking open questions
- [x] 16-step implementation sequence complete

---

## POST-GENERATION SELF-VALIDATION

```yaml
self_validation:
  operational_integrity:
    - [x] All zones traced to backend entities or computed state
    - [x] Every zone justified by operator shift-work need
    - [x] 3 <details>/<summary> disclosures eliminated; operational content always visible
    - [x] 17 legacy alias tokens consolidated into step_1

  law_compliance:
    - [x] Spacing 4px scale
    - [x] All surfaces canonical tokens
    - [x] All labels sentence case
    - [x] Typography from approved system; monospace ONLY for timestamps
    - [x] No AI elements

  kiro_readiness:
    - [x] 16-step implementation sequence
    - [x] All acceptance criteria testable
    - [x] No blocking open questions

  anti_pattern_check:
    - [x] No gradients
    - [x] No glow
    - [x] No pulse
    - [x] No UPPERCASE labels
    - [x] No <details>/<summary>
    - [x] No <Link><Button>
    - [x] No raw hex/rgba
    - [x] No legacy aliases in spec
```

---

## 14. VISUAL STRUCTURAL HIERARCHY BLUEPRINT

---

### 14A. Desktop Blueprint (1440px)

```
┌─[APP TOPBAR 48px]──────────────────────────────────────────────────────────────────┐
│ DPR.ai  ·  Shree Steel Works  ·  My Tasks                        ⚙  [≡ Nav]        │
└────────────────────────────────────────────────────────────────────────────────────┘
┌─[SIDEBAR 220px]─┬─[TASKS WORKSPACE surface-shell max-w-1280px]────────────────────┐
│ ■ Dashboard     │                                                                  │
│ ◉ My Tasks      │  ┌─[PAGE HEADER surface-panel border-subtle rounded-panel]────┐  │
│ ○ Entry         │  │ Daily work  11px/500/action-primary/sentence                │  │
│ ○ Scan          │  │ My tasks   18px/600                                         │  │
│ ○ Attendance    │  │ Start the next task and clear blockers.  14px/secondary     │  │
│                 │  │ [Factory: Shree Steel] [Workflow: Steel Ops]  surface-elev  │  │
│                 │  │ [Refresh tasks ← isBusy]   Updated 13 Jun 08:45 ← 11px mono │  │
│                 │  └────────────────────────────────────────────────────────────┘  │
│                 │  ┌─[GUIDANCE BLOCK — autoOpen 1st visit]──────────────────────┐  │
│                 │  │ ┌─ Start next ────────┐ ┌─ Check saved ─────┐ ┌─ Clear ──┐ │  │
│                 │  │ │ surface-panel/subtle │ │ surface-panel     │ │ surface  │ │  │
│                 │  │ │ Start next  13px/500 │ │ Check saved       │ │ Clear    │ │  │
│                 │  │ │ Complete evening     │ │ Nothing waiting   │ │ No alerts│ │  │
│                 │  │ └─────────────────────┘ └───────────────────┘ └──────────┘ │  │
│                 │  └────────────────────────────────────────────────────────────┘  │
│                 │                                                                  │
│                 │  ┌─[SECTION A xl:grid-cols-[1.05fr_0.95fr]]───────────────────┐  │
│                 │  │                                                              │  │
│                 │  │  ┌─[PRIMARY TASK surface-card]──────────────────────────┐  │  │
│                 │  │  │ Next task  11px/500/tert/sentence                    │  │  │
│                 │  │  │ Complete the evening shift entry  16px/600           │  │  │
│                 │  │  │ ────────────────────────────────────────────────── │  │  │
│                 │  │  │ ┌─[ACTION surface-selected border-focus rounded-panel]│  │  │
│                 │  │  │ │ Complete the evening shift entry  14px/600/primary │  │  │
│                 │  │  │ │ 1 shift slot still open today.  14px/secondary     │  │  │
│                 │  │  │ │                      [Start now ← Button primary] │  │  │
│                 │  │  │ └──────────────────────────────────────────────────┘ │  │  │
│                 │  │  │ ────────────────────────────────────────────────── │  │  │
│                 │  │  │ SUPPORTING TASKS — ALWAYS VISIBLE                    │  │  │
│                 │  │  │ ┌─[surface-warning-bg border-warning rounded-control]┐ │  │
│                 │  │  │ │ Sync the offline queue  14px/600/primary           │ │  │
│                 │  │  │ │ 2 items waiting.  14px/secondary   [Open outline] │ │  │
│                 │  │  │ └───────────────────────────────────────────────────┘ │  │  │
│                 │  │  └──────────────────────────────────────────────────────┘  │  │
│                 │  │                                                              │  │
│                 │  │  ┌─[TODAY STATUS surface-card]───────────────────────────┐  │  │
│                 │  │  │ Today status  11px/500/tert/sentence                  │  │  │
│                 │  │  │ Keep the shift moving  16px/600                       │  │  │
│                 │  │  │ ────────────────────────────────────────────────────  │  │  │
│                 │  │  │ ┌── Pending shifts ─┐ ┌── Saved draft ──────────────┐ │  │  │
│                 │  │  │ │░ Pending shifts    │ │░ Saved draft                │ │  │  │
│                 │  │  │ │  11px/500/tert     │ │  11px/500/tert              │ │  │  │
│                 │  │  │ │       1            │ │      Evening                │ │  │  │
│                 │  │  │ │  20px/600/primary  │ │  20px/600/primary           │ │  │  │
│                 │  │  │ │  Evening is next.  │ │  Saved for 13 Jun.          │ │  │  │
│                 │  │  │ └────────────────────┘ └─────────────────────────────┘ │  │  │
│                 │  │  │ ┌── Offline queue ──┐ ┌── Unread alerts ────────────┐ │  │  │
│                 │  │  │ │░ Offline queue     │ │░ Unread alerts              │ │  │  │
│                 │  │  │ │  11px/500/tert     │ │◉ surface-selected (focus)  │ │  │  │
│                 │  │  │ │       2            │ │  border-focus               │ │  │  │
│                 │  │  │ │  20px/600/primary  │ │       3                     │ │  │  │
│                 │  │  │ │  Sync is waiting.  │ │  Signals waiting.           │ │  │  │
│                 │  │  │ └────────────────────┘ └─────────────────────────────┘ │  │  │
│                 │  │  │ ─────────────────────────────────────────────────────  │  │  │
│                 │  │  │ TASK TOOLS — ALWAYS VISIBLE                            │  │  │
│                 │  │  │ Use for direct jumps after finishing the next task.     │  │  │
│                 │  │  │ [Shift Entry ░] [Capture ░] [Steel Ops ░] [Operations ghost]│  │  │
│                 │  │  └──────────────────────────────────────────────────────┘  │  │
│                 │  └──────────────────────────────────────────────────────────────┘  │
│                 │                                                                     │
│                 │  ┌─[SECTION B xl:grid-cols-[1.05fr_0.95fr]]────────────────────┐   │
│                 │  │  ┌─[SUBMITTED ENTRIES surface-card]────────────────────────┐│   │
│                 │  │  │ Submitted today  11px/500/tert/sentence                 ││   │
│                 │  │  │ Shift progress   16px/600                               ││   │
│                 │  │  │ ┌─ Morning shift ──────────────────────────────────┐   ││   │
│                 │  │  │ │ surface-panel border-subtle rounded-control       │   ││   │
│                 │  │  │ │ Morning shift  14px/600/primary                   │   ││   │
│                 │  │  │ │ 320 units produced · submitted     [Open outline] │   ││   │
│                 │  │  │ └───────────────────────────────────────────────────┘   ││   │
│                 │  │  │ ┌─ Empty state ─────────────────────────────────────┐   ││   │
│                 │  │  │ │░ surface-panel border-dashed border-border-subtle  │   ││   │
│                 │  │  │ │  No evening entry submitted yet.  14px/secondary   │   ││   │
│                 │  │  │ └───────────────────────────────────────────────────┘   ││   │
│                 │  │  └──────────────────────────────────────────────────────────┘│   │
│                 │  │  ┌─[ALERTS surface-card]────────────────────────────────────┐│   │
│                 │  │  │ Attention signals  11px/500/tert/sentence                ││   │
│                 │  │  │ Current alerts     16px/600                              ││   │
│                 │  │  │ ALL ALERTS VISIBLE — NOT <details>                       ││   │
│                 │  │  │ ┌─ Alert 1 ─────────────────────────────────────────┐   ││   │
│                 │  │  │ │ surface-panel border-subtle rounded-control        │   ││   │
│                 │  │  │ │ Auth anomaly detected on 3 accounts  14px/600      │   ││   │
│                 │  │  │ │ HIGH · auth_anomaly · 13 Jun  12px/tert            │   ││   │
│                 │  │  │ │                                  [Open board ░]    │   ││   │
│                 │  │  │ └───────────────────────────────────────────────────┘   ││   │
│                 │  │  │ ┌─ Alert 2 ─────────────────────────────────────────┐   ││   │
│                 │  │  │ │ … (up to 5 alerts, all visible)                   │   ││   │
│                 │  │  │ └───────────────────────────────────────────────────┘   ││   │
│                 │  │  └──────────────────────────────────────────────────────────┘│   │
│                 │  └─────────────────────────────────────────────────────────────┘    │
└─────────────────┴──────────────────────────────────────────────────────────────────────┘

SCAN PATH:
  [1] 0–200ms → Action tone background on primary task card captures eye immediately.
                "Start now" CTA is the only primary-variant button on the page.
  [2] 200ms–800ms → 4 status tiles scan as a unit (numbers at 20px dominate).
                    Highlighted tile (surface-selected) confirms what drove the primary task.
  [3] 800ms–2s → Supporting tasks + submitted entries — what else + what's done.
  [4] 2s+ → Alerts + task tools + page header context (reference only at this point).

DENSITY RULES:
  · Primary task card: generous internal padding (20px) — the most important zone deserves space
  · Supporting tasks: 12px gap — tight enough to read as one related list
  · Status tiles: 2×2 at 12px gap — dense overview, values dominate at 20px
  · Task tools: flex-wrap with 12px gap — compact navigation strip
  · Alert items: 12px gap — dense enough to scan 5 items without excessive scrolling
  · Section A and Section B: 24px gap between the two grid sections
```

---

### 14B. Scan & Attention Visualization

```
ATTENTION WEIGHT MAP (left to right, top to bottom):

  PAGE HEADER:  LOW WEIGHT  (orientation, not action)
      ↓ 24px
  GUIDANCE:     LOW WEIGHT  (tips for new users, collapsed after first visit)
      ↓ 24px
  ┌──────────────────────────────────────┬─────────────────────────────────────┐
  │ PRIMARY TASK CARD                    │ TODAY STATUS CARD                   │
  │ ████████████████ HIGH WEIGHT ████   │ ▓▓▓▓▓▓▓▓▓▓▓▓▓ MEDIUM WEIGHT ▓▓▓  │
  │                                      │                                     │
  │ Action tone bg → eye goes here FIRST│ 4 stat tiles — scan as numbers      │
  │ "Start now" button — one clear CTA  │ Active tile highlighted              │
  │ Supporting tasks below — always on  │ Task tools — always visible below   │
  └──────────────────────────────────────┴─────────────────────────────────────┘
      ↓ 24px
  ┌──────────────────────────────────────┬─────────────────────────────────────┐
  │ SUBMITTED ENTRIES                    │ ALERTS                              │
  │ ░░░░░░░░░░░░░░░ LOWER WEIGHT ░░░░  │ ░░░░░░░░░░░░░ LOWER WEIGHT ░░░░    │
  │                                      │                                     │
  │ What's done today — reference       │ All alerts visible — no disclosure  │
  │ Max 3 entries (3 shifts)             │ Up to 5 alerts inline               │
  └──────────────────────────────────────┴─────────────────────────────────────┘
```

---

### 14C. Component Nesting Hierarchy

```
<main> (AppShell frame, max-w-1280px)
  ├── PageHeader (surface-panel/border-subtle/rounded-panel — NOT rgba backdrop-blur)
  │     ├── Eyebrow (11px/500/action-primary/sentence case)
  │     ├── <h1> (18px/600)
  │     ├── Description (14px/400/secondary)
  │     ├── ContextChips × 2 (surface-elevated/border-subtle)
  │     ├── Button "Refresh tasks" (outline, isBusy)
  │     └── Timestamp (11px/mono — --type-timestamp)
  │
  ├── GuidanceBlock (existing component, surfaceKey="my-tasks")
  │     └── StepCards × 3 (surface-panel/border-subtle/rounded-control)
  │
  ├── StatusBanners (conditional)
  │     ├── ErrorBanner (status-danger-bg/border/fg)
  │     └── RefreshingBanner (surface-panel/border-subtle)
  │
  ├── SectionA (xl:grid-cols-[1.05fr_0.95fr])
  │     ├── PrimaryTaskCard (surface-card/border-subtle)
  │     │     ├── SectionSubLabel (11px/500/tert/sentence)
  │     │     ├── SectionTitle (16px/600)
  │     │     ├── PrimaryTaskBlock (taskToneClass() + rounded-panel)
  │     │     │     ├── TaskTitle (14px/600/primary)
  │     │     │     ├── TaskDetail (14px/400/secondary)
  │     │     │     └── Button "Start now" variant="primary" asChild + Link
  │     │     └── SupportingTaskList (always visible — NOT <details>)
  │     │           └── SupportingTaskItem × N (surface-panel/border-subtle/rounded-control)
  │     │                 ├── TaskTitle + Detail
  │     │                 └── Button "Open" outline asChild + Link
  │     └── TodayStatusCard (surface-card/border-subtle)
  │           ├── SectionSubLabel + SectionTitle
  │           ├── TileGrid (2×2)
  │           │     └── StatusTile × 4 (surface-card or surface-selected per focus param)
  │           │           ├── TileLabel (11px/500/tert/sentence case)
  │           │           ├── TileValue (20px/600/tabular-nums)
  │           │           └── TileDetail (12px/400/tertiary)
  │           └── TaskToolsSection (always visible — NOT <details>)
  │                 └── Button × 3-4 outline/ghost asChild + Link
  │
  └── SectionB (xl:grid-cols-[1.05fr_0.95fr])
        ├── SubmittedEntriesCard (surface-card/border-subtle)
        │     └── EntryItem × ≤3 (surface-panel/border-subtle/rounded-control)
        │           └── Button "Open" outline asChild + Link
        └── AlertsCard (surface-card/border-subtle)
              └── AlertItem × ≤5 (surface-panel/border-subtle/rounded-control) — ALL VISIBLE
                    └── Button "Open board" outline asChild + Link href="/dashboard"
```

---

### 14D. Responsive Blueprint

```
1280px+ (Desktop):
  SectionA: [1.05fr | 0.95fr] — task dominates, status right
  SectionB: [1.05fr | 0.95fr] — entries left, alerts right

<768px (Mobile — primary for operators):
  SectionA: stacked (task card above, status card below)
  SectionB: stacked (entries above, alerts below)
  Tiles: 2-col grid preserved (sm:grid-cols-2)
  All buttons: ≥44px height
  "Start now" CTA: ≥48px height (primary shift action)
  Supporting tasks: stacked, full width, easy touch targets
  Task tools: flex-wrap, all buttons min 44px
```

---

### 14F. Structural Consistency Validation

```yaml
structural_validation:
  - [x] All zones justified by operator shift-work needs
  - [x] Primary task card (P:1) visually dominates via semantic tone background
  - [x] Spacing 24px between sections; 12px within card items
  - [x] Mobile adaptations preserve all actions with ≥44px touch targets
  - [x] No <details>/<summary> anywhere in component
  - [x] Supporting tasks, task tools, alerts all always visible
  - [x] Blueprint matches FULL-WIDTH COMMAND + two-column sections (Section 4.1)
```

---

## KIRO TASK CHAINING

```yaml
downstream_kiro_tasks:
  task_1:
    name: "Tasks — Legacy Token + Alias Batch Fix"
    input: This spec → Section 9.3, Section 9.4, Section 11
    output: All 17 var(--muted)/var(--text)/var(--accent)/var(--border)/var(--card-strong)
      replaced with canonical token classes throughout the component

  task_2:
    name: "Tasks — Hero Section Fix"
    input: This spec → Section 4.2 (Page Header), Section 9.4
    output: backdrop-blur/rgba/shadow removed; surface-panel + border-subtle;
      eyebrow/title/subtitle typography fixed

  task_3:
    name: "Tasks — taskTone() + highlightCard() Semantic Fix"
    input: This spec → Section 4.2 (Primary Task Card), Section 9.4
    output: Both functions return canonical semantic Tailwind class strings;
      zero raw rgba/color in either function

  task_4:
    name: "Tasks — Remove All <details>/<summary> (3 instances)"
    input: This spec → Section 4.2 (all zones), Section 12
    output: Supporting tasks, task tools, additional alerts always visible;
      no disclosure elements in the component

  task_5:
    name: "Tasks — Button asChild + Link Fix (8+ locations)"
    input: This spec → Section 11 (component mapping), Section 4.2
    output: All <Link><Button> nesting replaced with Button asChild + Link;
      all navigation buttons have correct aria semantics

  task_6:
    name: "Tasks — CardTitle + Tile Labels + Card Surfaces Fix"
    input: This spec → Section 9.3, Section 4.2 (all zones)
    output: All CardTitle at 16px/600; tile labels sentence case --type-label-dense;
      all item cards use surface-panel/border-subtle/rounded-control
```

---

*End of WORKSPACE_SKELETON_TASKS.md (Sections 1–14)*
*This file is system-generated architecture. Treat as engineering law until formally amended.*
*Architectural precedents established:*
*- Worker-only workspace (roleEligible guard) — access-denied state must redirect to appropriate role home*
*- Supporting operational content must NEVER be hidden behind <details>/<summary>*
*- taskTone() / highlightCard() pattern: helper functions must return canonical Tailwind class strings*
*- Auto-refresh + subscribeToQueueUpdates combination for real-time worker board state*
*- Status tiles: --type-label-dense sentence case for tile labels (NOT uppercase — tile labels are NOT table headers)*
*- Mobile is primary use case for worker board — ≥44px/48px touch targets required*
