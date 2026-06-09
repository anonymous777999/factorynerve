# Work Queue — Workspace Skeleton Architecture
# FactoryNerve OS | Phase 3 Skeleton Specification | Phase B, Item 3
# Route: /work-queue
# Generated: 2026-06-03
# Status: DRAFT

---

## 1. WORKSPACE OVERVIEW

### 1.1 Identity

| Field | Value |
|---|---|
| Route | `/work-queue` |
| Workspace Name | Work Queue — Unified Cross-Domain Priority Queue |
| Operational Role | Aggregates all pending operational items across every domain (shift entries, attendance, OCR verifications, approval entries, stock reconciliations, alerts) into a single priority-sorted queue. Two render paths: (1) Operator/worker mode — simplified task list with 3-section task groups and aside summary; (2) Management mode — full queue with section filter tabs, next-up priority item, remaining items, quick actions, and signal rail with domain counts. Auto-refreshes every 25 seconds. |
| Business Impact | If the work queue fails, supervisors and managers lose their cross-domain "what needs to happen now" view. Without the queue, operators must navigate to each domain separately to check for pending items. The queue is P0 for daily operational coordination — it is the only surface that surfaces pending OCR, entry review, attendance exceptions, and stock issues together. |
| User Population | operator, supervisor, manager, admin, owner. Role-based data loading: operators get attendance + shift entries + offline queue; supervisors and managers additionally get live attendance, pending entries, OCR verifications, attendance review, and (if steel factory) reconciliations. |
| Peak Usage Context | Shift start and mid-shift for operators. Continuous triage throughout shift for supervisors. Morning queue review for managers and admins. |
| Predecessor Workspaces | `/dashboard` (linked from workflow zones + quick actions) |
| Successor Workspaces | `/entry`, `/attendance`, `/attendance/review`, `/attendance/live`, `/ocr/verify`, `/approvals`, `/steel/reconciliations` |

### 1.2 Operational Importance

The work queue is the operational triage surface. It answers "what is the highest-priority unfinished item across all domains right now?" for every role. The priority algorithm sorts items by computed `priority` scores (0–110 range) so the most urgent item is always at the top — missed attendance punch (priority 104) beats a pending OCR review (priority 78). For supervisors who manage multiple operators, the live attendance, pending review items, and OCR queue are aggregated here so they don't need to visit five separate pages to assess the shift state. Auto-refresh keeps the board current without manual intervention.

### 1.3 Current State Failures

**Management workspace (non-operator path):**
- Operational step guide at top uses `text-[0.65rem] uppercase tracking-wide text-text-tertiary` — `text-[0.65rem]` is 10.4px (borderline tiny); uppercase on step label; `tracking-wide` (0.025em) is within bounds for table-header context but this is NOT a table header — it is a step label on a card; must be sentence case `--type-label-dense` (11px)
- Hero section uses `text-sm uppercase tracking-wide text-text-secondary` for "Daily coordination" eyebrow — uppercase on body text; must be `--type-label-dense` sentence case
- Hero `h1` uses `text-3xl md:text-4xl` — same violation as dashboard/tasks/settings; must be 18px/600
- Hero refresh timestamp uses `text-xs text-text-tertiary` — correct; preserved
- Quick-nav "Tools" section wraps the quick action buttons inside a `<details>/<summary>` styled as a `rounded-full border` pill — forbidden pattern; quick actions must always be visible
- "Queue pulse" telemetry section uses `<details>/<summary>` — the 4 KPI cards are hidden behind a disclosure; these counts (total queue items, today count, review count, alerts) are critical operational signals that must be always visible as a summary strip
- The right column "Queue signals" also uses `<details>/<summary>` — the signal rail with domain counts and recent signals is hidden behind a disclosure; this is the most operationally useful context for the management queue view and must be always visible
- "More items" queue list uses `<details>/<summary>` — same pattern as tasks page; remaining queue items are operational content that should be visible (scannable); the disclosure defeats the purpose of having a queue
- All `CardTitle` components in management path use `text-xl` — same violation as previous workspaces; must be `--type-panel-title` (16px/600)
- "Queue snapshot" signal panel labels ("Pending DPR review", "OCR waiting", "Stock reviews", "Open shifts today") use `text-xs uppercase tracking-wide` — uppercase on panel labels; must be `--type-label-dense` sentence case
- "Recent signals" panel labels ("Submitted today", "Latest alert time", "Offline status") use sentence case already — these are compliant; keep
- "Next up" badge and queue item section badges use `tracking-wide` — `tracking-wide` = 0.025em which is within the ≤0.06em limit; only the uppercase is the issue here; must remove uppercase from these badge labels
- Queue filter buttons ("All", "Today", "Review", "Alerts") use `text-xs tracking-wide` — `tracking-wide` on button labels is borderline; sentence case is correct here; buttons are already sentence case ✓
- Operator hero section uses `rounded-[32px]` — arbitrary radius; must use `rounded-panel`
- Operator task section cards use `rounded-[30px]` — arbitrary radius; must use `rounded-panel`
- Operator task item cards use `rounded-[24px]` — arbitrary radius; must use `rounded-control`
- Operator aside stat cards use `rounded-[20px]` — arbitrary; must use `rounded-control`
- Operator aside container cards use `rounded-[28px]` — arbitrary; must use `rounded-panel`
- Operator hero uses `bg-[var(--surface-industrial-deep)]` — industrial alias token; same issue as dashboard; must verify or replace with `surface-shell`
- Operator "All clear" empty state uses `rounded-[30px]` — arbitrary; must use `rounded-panel`
- Operator "All clear" eyebrow: `text-[11px] font-semibold uppercase tracking-wide text-status-success-fg` — uppercase on the "All clear" label; must be sentence case
- Operator today section label: `text-xs uppercase tracking-wide text-text-tertiary` — uppercase; must be sentence case `--type-label-dense`
- Operator alert section label: same uppercase violation
- Worker section badge labels use `tracking-wide` (compliant tracking) but are already labeled with `workerSectionLabel()` which returns sentence case ("Action required" / "Continue work" / "Other tasks") — these are compliant; keep
- Worker queue status `workerQueueStatus.tone` returns canonical semantic Tailwind class strings — this is CORRECT (it uses `border-status-*` classes, not raw rgba); mark as passing
- `sectionErrorEntries` warning panels: operator path uses `rounded-[20px]` — must use `rounded-control`; management path uses `operational-panel` CSS class which should be verified
- Both paths: section error panels' `font-semibold tracking-wide` on section name — tracking-wide (0.025em) is within bounds; sentence case labels; compliant ✓
- The `not-signed-in` error state CardTitle is `text-xl` — must be 16px/600
- `<Link><Button>` nesting appears in management path (quick actions loop, "Next up" CTA, remaining items "Open" buttons, "All clear" state links) and operator path (task item CTAs, "Open Alerts" button, "Open Dashboard"/"View Report" in empty state)

---

## 2. WORKSPACE CLASSIFICATION

| Dimension | Classification | Rationale |
|---|---|---|
| Workspace Type | Realtime Monitoring (management) / Operational Form Hub (operator) | Management: real-time triage across 5 domains. Operator: sequential task execution |
| Workflow Category | Execution (operator) / Verification + Oversight (management) | Operator processes one task at a time. Supervisor clears cross-domain exceptions |
| Operational Behavior | Queue-Based | Priority-sorted item list; items computed and sorted dynamically from cross-domain data |
| Data Density | HIGH (management) / MEDIUM (operator) | Management: 10+ parallel API calls, 5 domain sections, priority-sorted queue. Operator: 3 task groups + aside |
| Realtime Complexity | MEDIUM | Auto-refresh (25s), `subscribeToQueueUpdates`, `subscribeToWorkflowRefresh`, visibility change handler |
| AI Complexity | NONE | No AI systems |
| Audit Complexity | LOW | `markAlertRead` writes to alert system; no AuditLog |
| Decision Pressure | HIGH (shift start) / MEDIUM (continuous) | Priority algorithm surfaces the most urgent item — operator just acts on it; management scans and triages |

**Classification Implication:**
The work queue is the most data-intensive workspace in Phase B — it aggregates data from attendance, entries, OCR, steel reconciliations, and alerts simultaneously. The `Promise.allSettled` with dynamic task index construction is the correct resilience pattern and must be preserved. The primary structural problem is four `<details>/<summary>` disclosures hiding operational content: quick actions, queue pulse counts, queue signals rail, and remaining queue items. All four must be made always-visible. The operator path has a different problem: arbitrary radius values throughout an otherwise well-constructed component.

---

## 3. BACKEND OPERATIONAL MAPPING

### 3.1 API Surface

| Endpoint | Method | Purpose | Permission | Role Gate | Caching |
|---|---|---|---|---|---|
| `GET /alerts` | GET | `listUnreadAlerts()` | Auth | All roles | 10s |
| `GET /attendance/me/today` | GET | `getMyAttendanceToday()` | Auth | All roles | 5s |
| `GET /entries` (today) | GET | `getTodayEntries()` | Auth | `canSubmit` | 5s |
| (offline) `loadDraft(userId)` | — | Client-side draft | — | `canSubmit` | — |
| (offline) `countQueuedEntries(userId)` | — | Client-side queue | — | `canSubmit` | — |
| `GET /attendance/live` | GET | `getLiveAttendance()` | Auth | `canReview` | 5s |
| `GET /entries?status=pending` | GET | `listEntries({status:["pending"]})` | Auth | `canReview` | — |
| `GET /attendance/review` | GET | `listAttendanceReview()` | Auth | `canReview` | 5s |
| `GET /ocr/verifications?status=pending` | GET | `listOcrVerifications({status:"pending"})` | Auth | `canReview` | — |
| `GET /steel/reconciliations?status=pending` | GET | `listSteelReconciliations({status:"pending"})` | Auth | `canReview` AND `isSteelFactory` | — |
| `PUT /alerts/{id}/read` | PUT | `markAlertRead(id)` | Auth | All roles | — |

**Load strategy:** Dynamic `tasks[]` array built per role — only endpoints relevant to the current role are included. Indexed by position in the array so results are mapped correctly. `Promise.allSettled` — partial failure sets per-section error messages, never blocks render.

**Role-based loading matrix:**
- `canSubmit` (operator, supervisor, manager, admin, owner): loads todayEntries, draft, queueCount
- `canReview` (supervisor, manager, admin, owner): loads attendanceLive, pendingEntries, attendanceReview, pendingVerifications, + reconciliations if steel

**Realtime subscriptions:**
- `setInterval(25,000)` — background refresh (skips when `document.hidden`)
- `document.visibilitychange` — refresh when tab becomes active
- `subscribeToQueueUpdates` — updates `queueCount` + `draft` when IndexedDB changes
- `subscribeToWorkflowRefresh` — triggers `loadQueue({background:true})` on cross-tab signal

### 3.2 Entity Relationship Map

```
User (role, factory_id)
    ├── AlertItem × unread            (all roles)
    ├── AttendanceToday               (all roles)
    ├── Entry × today submitted        (canSubmit)
    ├── EntryDraft (offline)           (canSubmit)
    ├── queueCount (offline)           (canSubmit)
    ├── AttendanceLive                 (canReview)
    ├── Entry × pending review         (canReview)
    ├── AttendanceReviewPayload        (canReview)
    ├── OcrVerificationRecord × pending (canReview)
    └── SteelReconciliation × pending  (canReview + isSteelFactory)
```

**Primary derived entity:** `QueueItem[]` — computed from all loaded data, priority-sorted, domain-tagged. This is the core data structure the workspace renders. Each `QueueItem` has: `id`, `section` (today/review/alerts), `title`, `detail`, `href`, `action`, `tone` (action/watch/danger/good), `meta`, `priority` (0–110), optional `alertId`, optional `isOverflow`.

**Priority score mapping:**
| Item | Priority | Tone |
|---|---|---|
| Attendance punch missing (self) | 104 | action |
| Worker primary task (missing shift) | 100 | danger |
| High-severity alert | 96 | danger |
| Red-confidence reconciliation | 94 | danger |
| Worker continue task (draft) | 94 | watch |
| Live attendance not_punched | 90 | watch |
| Attendance review (missed punch) | 88 | danger |
| Worker offline queue | 82 | watch |
| Pending entry review | 86 | action |
| OCR verification low confidence | 82 | watch |
| OCR verification normal | 78 | action |
| Pending reconciliation normal | 80 | watch |
| Medium-severity alert | 84 | watch |
| Low-severity alert | 72 | action |

### 3.3 Workflow State Machine

```
[PAGE LOAD]
  → Promise.allSettled(dynamic tasks array per role)
  → setState → queueItems computed → sorted by priority
  → isWorkerQueue = user.role === "operator"
      → true: OperatorWorkspace (3 task sections + aside)
      → false: ManagementWorkspace (queue list + signal rail)

[QUEUE FILTER (management)]
  → setFilter("all" | "today" | "review" | "alerts")
  → filteredItems recomputed; nextUpItem = filteredItems[0]

[MARK ALERT READ]
  → markAlertAsRead(alertId) → setMarkingAlertIds
  → PUT /alerts/{id}/read
  → remove from state.alerts on success
  → dispatch RAIL_COUNT_REFRESH_EVENT

[AUTO-REFRESH CYCLE]
  → setInterval 25s → if !document.hidden: loadQueue({background:true})
  → visibilitychange → if visible: loadQueue({background:true})
  → subscribeToQueueUpdates → refresh queueCount + draft

[BACKGROUND REFRESH STATE]
  → setRefreshing=true → data refetched → existing data preserved (retainCurrent)
  → setRefreshing=false when complete
```

### 3.4 Realtime Contracts

| System | Transport | Rate | Zones Affected |
|---|---|---|---|
| Auto-refresh | setInterval | 25s | All queue items |
| Queue subscription | Client event | On IndexedDB write | queueCount, draft |
| Workflow refresh | Custom event | Cross-tab signal | Full reload |
| Tab visibility | Browser event | On focus | Full background refresh |

### 3.5 AI System Contracts

Not applicable — no AI systems.

### 3.6 Permission Matrix

| Role | Items loaded | isWorkerQueue | canSubmit | canReview | canSeeControl |
|---|---|---|---|---|---|
| operator | alerts + attendance + today entries + draft + queue | true | true | false | false |
| supervisor | all except reconciliations if not steel | false | true | true | false |
| manager | all + reconciliations if steel | false | true | true | true |
| admin | all + reconciliations if steel | false | true | true | true |
| owner | all + reconciliations if steel | false | true | true | true |

---

## 4. WORKSPACE STRUCTURAL ANATOMY

### 4.1 Layout Patterns

**Path A — Operator (`isWorkerQueue=true`):**
```
FULL-WIDTH COMMAND with aside:
  Main (fill): priority-grouped task sections (danger → watch → normal)
  Aside (320px fixed): summary counts + critical alerts strip
```

**Path B — Management (`isWorkerQueue=false`):**
```
FULL-WIDTH COMMAND — stacked operational zones:
  1. Step guide (3-step card strip)
  2. Hero section (title + context chips + refresh + next-up CTA + quick actions)
  3. Error/refresh banners
  4. Section error panels (conditional)
  5. Queue pulse strip (ALWAYS VISIBLE — 4 KPI cards)
  6. Two-column grid: Queue list (left 52%) + Signal rail (right 48%)
     - Queue list: filter tabs + next-up item + remaining items (ALL VISIBLE)
     - Signal rail: queue snapshot + recent signals (ALWAYS VISIBLE)
```

**Pattern justification:**
- Operator: grouped task sections provide triage clarity (danger tasks first) without needing a priority number; the aside gives a shift summary without competing with tasks.
- Management: queue list and signal rail must both be always visible — the signal rail provides domain-level counts that give context for the queue items. A 52/48 split keeps the queue dominant while signal context is immediately adjacent.

**Structural reduction (4 disclosures eliminated):**
1. "Tools" quick actions pill → always-visible action row below next-up
2. "Queue pulse" telemetry → always-visible 4-card KPI strip above the two-column grid
3. "Queue signals" right rail → always-visible right column (not collapsed)
4. "More items" queue list → all remaining items always visible below next-up item

---

### 4.2 Zone Definitions

---

#### ZONE: Step Guide [Management only]

| Property | Value |
|---|---|
| Operational Role | 3-step operating sequence: Pick focus → Process next → Check load |
| Attention Priority | 5 |
| Position | top of management workspace |
| Width | full, 3-col grid |
| Height | content-driven (~80px) |
| Density | compact |
| Existence Justification | Orients new users to the queue workflow; 3-step pattern inherited from settings guidance |

**Fixes:**
- Step eyebrow "Step 1" label: `text-[0.65rem] uppercase` → `--type-label-dense` (11px/500/sentence case/`text-text-tertiary`)
- Card surface: `operational-panel px-4 py-4 bg-surface-card border-border-subtle` — verify `operational-panel` CSS class produces compliant padding/radius; if not: `surface-card border-subtle rounded-control`

**Acceptance Criteria:**
- [ ] Step eyebrows at 11px/500/sentence case — NOT `text-[0.65rem] uppercase`
- [ ] Step cards use canonical surface token + `rounded-control`

---

#### ZONE: Hero Section [Both paths]

| Property | Value |
|---|---|
| Operational Role | Workspace identity + factory/org context + refresh control + primary next action + quick navigation |
| Attention Priority | 3 (management) / 2 (operator) |
| Position | top of main content |
| Width | full content width |
| Height | content-driven |
| Sticky | not sticky |
| Density | default |
| Existence Justification | Factory context + refresh + next action CTA; the entry point before diving into the queue |

**Management hero fixes:**
- Eyebrow "Daily coordination": `text-sm uppercase tracking-wide text-text-secondary` → `--type-label-dense` (11px/500/sentence case/`text-action-primary`)
- `h1` "Work queue": `text-3xl md:text-4xl` → `--type-page-title` (18px/600)
- Container `operational-hero bg-surface-card border-border-subtle` — verify CSS resolves correctly; must be `surface-card border-subtle rounded-panel` (or equivalent via CSS class)
- Quick actions: currently inside `<details>/<summary>` styled as a pill — must be always-visible inline action row below next-up CTA
- Next-up CTA is already `<Link><Button>` → fix to `Button asChild + Link`

**Operator hero fixes:**
- Container: `rounded-[32px]` → `rounded-panel`
- `bg-[var(--surface-industrial-deep)]` → verify token; if undefined → `surface-shell`
- Eyebrow (factory name): `text-[11px] font-semibold uppercase tracking-wide text-action-primary` — tracking-wide (0.025em) is within bounds; uppercase is the violation; must be sentence case
- `h1` "Work Queue": `text-3xl` → 18px/600
- Worker queue status badge: `workerQueueStatus.tone` already returns canonical semantic class strings (e.g., `border-status-danger-border bg-status-danger-bg text-status-danger-fg`) — COMPLIANT; preserve

**Acceptance Criteria:**
- [ ] Management eyebrow sentence case `--type-label-dense text-action-primary`
- [ ] Both paths: h1 at 18px/600 — NOT text-3xl/text-4xl
- [ ] Quick actions ALWAYS VISIBLE (management) — NOT inside `<details>`
- [ ] Quick action CTAs use `Button asChild + Link` — NOT `<Link><Button>`
- [ ] Operator hero container uses `rounded-panel` — NOT `rounded-[32px]`
- [ ] Operator eyebrow (factory name) sentence case

---

#### ZONE: Queue Pulse Strip [Management only — ALWAYS VISIBLE]

| Property | Value |
|---|---|
| Operational Role | 4 KPI cards: total open items, today count, review count, unread alerts — immediate queue health at a glance |
| Attention Priority | 2 |
| Position | below hero section |
| Width | full, 4-col grid (md:grid-cols-2 xl:grid-cols-4) |
| Height | content-driven (~96px per card) |
| Density | compact |
| Existence Justification | `filterCounts` (all/today/review) + `state.alerts.length` — 4 numbers that tell the queue state before reading any item |

**Contents:**
- 4 `Card` components: `surface-card border-subtle`
- Card sub-labels ("Open items", "Today", "Review", "Unread alerts"): `--type-label-dense` (11px/500/sentence case/`text-text-secondary`) — currently `text-sm text-text-secondary tracking-wide` (correct tokens, check tracking-wide = 0.025em ✓)
- `CardTitle` values: `--type-numeric-md` (18px/600/tabular-nums) — currently `text-text-primary` with no explicit size via CardTitle default styling; must pin to 18px/600
- CardContent detail text: `--type-label-dense` — currently `text-sm text-text-secondary` which is 14px; should be `--type-body` (14px/400) — acceptable ✓

**Acceptance Criteria:**
- [ ] Queue pulse strip ALWAYS VISIBLE — NOT inside `<details>/<summary>`
- [ ] CardTitle pinned to 18px/600 — NOT inheriting default CardTitle size
- [ ] 4-col grid on xl; 2-col on md; 1-col mobile

---

#### ZONE: Queue List [Management — left col 52%]

| Property | Value |
|---|---|
| Operational Role | Primary operational surface: filter tabs + next-up priority item + all remaining items (always visible) |
| Attention Priority | 1 |
| Position | left column of 2-col grid |
| Width | ~52% desktop; 100% mobile |
| Height | content-driven |
| Sticky | not sticky |
| Density | default |
| Existence Justification | `filteredItems` — the sorted priority queue; next-up item is the single most important pending action |

**Contents:**
- Section sub-label: "Queue view" — `--type-label-dense` sentence case; currently `text-sm text-text-secondary tracking-wide` — tracking 0.025em ✓; but `text-sm` is 14px; should be 11px/500 `--type-label-dense`
- `CardTitle` "Process next": `text-xl` → 16px/600

**Filter tabs:**
- 4 `Button` components: filter === key → `variant="primary"`; else → `variant="outline"`
- Labels already sentence case ("All", "Today", "Review", "Alerts") ✓
- Count badges inline with labels: show `filterCounts[key]` in parentheses

**Next-up item card:**
- Container: `rounded-panel border p-4 shadow-xs ${toneClass(nextUpItem.tone)}` — `toneClass()` already returns canonical semantic classes ✓; `rounded-panel` is correct; `shadow-xs` → `var(--shadow-xs)` check
- "Next up" badge: `rounded-full border px-3 py-1 text-[11px] font-semibold tracking-wide ${toneBadgeClass(...)}` — `toneBadgeClass()` canonical ✓; tracking-wide (0.025em) within limit ✓; remove uppercase from badge content if any
- Item title: 18px/600/`text-text-primary`
- Item detail: 14px/400/`text-text-secondary`
- CTA: `Button asChild + Link` — NOT `<Link><Button>`
- "Mark read" button: `Button variant="ghost"` — correct ✓; `isBusy` state shows "Marking..."

**Remaining items (ALWAYS VISIBLE — NOT `<details>`):**
- All `remainingFilteredItems` rendered as a stacked list below next-up
- Each item: `rounded-control border p-4 ${toneClass(item.tone)}` — `rounded-2xl` → `rounded-control`
- Item tone badge: canonical `toneBadgeClass()` ✓
- Item title: 14px/600/`text-text-primary`
- Item detail: 12px/400/`text-text-secondary`
- CTA: `Button variant="outline" asChild + Link` for normal; `variant="primary" asChild + Link` for `isOverflow`
- "Mark read" button for alert items: `Button variant="ghost" isBusy`

**Empty state:**
- `surface-panel border-subtle rounded-control` + 14px/400/`text-text-secondary` ✓ (already correct)

**Acceptance Criteria:**
- [ ] Section sub-label at 11px/500 — NOT text-sm (14px)
- [ ] CardTitle at 16px/600 — NOT text-xl
- [ ] Remaining items ALWAYS VISIBLE — NOT inside `<details>/<summary>`
- [ ] Remaining item containers use `rounded-control` — NOT `rounded-2xl`
- [ ] All CTAs use `Button asChild + Link` — NOT `<Link><Button>`
- [ ] Filter tabs show counts inline

---

#### ZONE: Signal Rail [Management — right col 48% — ALWAYS VISIBLE]

| Property | Value |
|---|---|
| Operational Role | Queue snapshot (domain-level counts) + recent signals (today entries, latest alert, offline status) — always-visible context for the queue list |
| Attention Priority | 2 |
| Position | right column of 2-col grid |
| Width | ~48% desktop; 100% mobile |
| Height | content-driven |
| Sticky | not sticky |
| Density | default |
| Existence Justification | `state.pendingEntryTotal`, `state.pendingVerifications.length`, `state.pendingReconciliations.length`, `missingShifts.length`, `state.todayEntries.length`, `state.alerts[0]`, `state.queueCount` |

**Queue Snapshot card:**
- Sub-label "Queue snapshot": `--type-label-dense` sentence case
- CardTitle "Where work is stacking up": 16px/600 — NOT `text-xl`
- Snapshot stat items ("Pending DPR review", "OCR waiting", "Stock reviews", "Open shifts today"):
  - Label: `--type-label-dense` (11px/500/sentence case) — NOT `text-xs uppercase tracking-wide`
  - Value: `--type-numeric-md` (22px/600/tabular-nums) — currently `text-2xl font-semibold text-text-primary` (22px = text-2xl; close but pin to spec)
- Container items: `surface-panel border-subtle rounded-control` ✓ (already correct)
- Steel Ops item: conditional on `isSteelFactory` ✓

**Recent Signals card:**
- Sub-label "Recent signals": `--type-label-dense` sentence case
- CardTitle "Immediate context": 16px/600 — NOT `text-xl`
- Signal items ("Submitted today", "Latest alert time", "Offline status"):
  - Already sentence case ✓; `text-text-primary` for value labels ✓
  - Latest alert time: format value should use `--type-timestamp` (JetBrains Mono/11px) for the datetime string

**Acceptance Criteria:**
- [ ] Signal rail ALWAYS VISIBLE — NOT inside `<details>/<summary>`
- [ ] Both CardTitle at 16px/600 — NOT text-xl
- [ ] Snapshot stat labels sentence case `--type-label-dense` — NOT uppercase tracking
- [ ] Snapshot stat values use `--type-numeric-md` (22px/600/tabular-nums)
- [ ] Alert time value uses `--type-timestamp` (JetBrains Mono/11px)

---

#### ZONE: Operator Task Sections [Operator only]

| Property | Value |
|---|---|
| Operational Role | 3-section grouped task list: Action required (danger) → Continue work (watch) → Other tasks (normal) |
| Attention Priority | 1 |
| Position | main column |
| Width | fill (xl:grid-cols-[1fr_320px] left col) |
| Height | content-driven |
| Density | default |
| Existence Justification | `workerTaskSections` — role-specific task groups: primary task (attendance/shift), continue tasks (draft/queue), other pending shifts |

**Section cards:**
- Container: `rounded-panel border p-5` + `accent.panel` (canonical via `workerSectionAccent()` which uses `bg-surface-card` + semantic border class) ✓
- `shadow-[0_18px_50px_rgba(3,8,20,0.24)]` — raw rgba shadow; must use `shadow-md` or `var(--shadow-md)` token
- Section badge: canonical via `workerSectionAccent().badge` ✓
- Section badge text: already sentence case via `workerSectionLabel()` ✓
- Section task count label: `text-xs text-text-tertiary` — compliant ✓

**Task item cards:**
- Container: `rounded-[24px] border border-border-subtle bg-surface-panel px-4 py-4` — `rounded-[24px]` → `rounded-control`
- Item title: 18px/600/`text-text-primary` — currently `text-lg font-semibold text-text-primary` (18px) ✓
- Item detail: 14px/400/`text-text-secondary` ✓
- CTA: `<Link><Button>` — fix to `Button variant="primary"/"outline" asChild + Link`

**Empty state "All clear":**
- Container: `rounded-[30px]` → `rounded-panel`
- Eyebrow "All clear": `text-[11px] font-semibold uppercase tracking-wide` — uppercase violation; must be sentence case
- Empty state links: `<Link><Button>` → `Button asChild + Link`

**Section error panels:**
- `rounded-[20px]` → `rounded-control`

**Acceptance Criteria:**
- [ ] Section card shadow uses `var(--shadow-md)` or `shadow-md` — NOT raw rgba
- [ ] Task item containers use `rounded-control` — NOT `rounded-[24px]`
- [ ] All CTAs use `Button asChild + Link` — NOT `<Link><Button>`
- [ ] Empty state uses `rounded-panel` — NOT `rounded-[30px]`
- [ ] "All clear" eyebrow sentence case — NOT uppercase
- [ ] Section error panels use `rounded-control` — NOT `rounded-[20px]`

---

#### ZONE: Operator Aside [Operator only]

| Property | Value |
|---|---|
| Operational Role | Summary counts (pending/completed/critical alerts) + critical alerts strip |
| Attention Priority | 2 |
| Position | right aside, 320px fixed |
| Width | 320px |
| Height | fill |
| Density | default |
| Existence Justification | `workerPendingCount`, `state.todayEntries.length`, `workerCriticalAlerts` |

**Summary card:**
- Container: `rounded-[28px] border-border-subtle bg-surface-card p-5 shadow-[var(--shadow-sm)]` — `rounded-[28px]` → `rounded-panel`; `shadow-[var(--shadow-sm)]` → acceptable if token exists, prefer `shadow-sm` utility
- Section label "Today": `text-xs uppercase tracking-wide text-text-tertiary` — uppercase violation; must be `--type-label-dense` sentence case
- Stat items: `rounded-[20px] border-border-subtle bg-surface-panel px-4 py-3` — `rounded-[20px]` → `rounded-control`
- Stat label ("Pending", "Completed", "Critical alerts"): `text-xs text-text-tertiary` — 12px/400 compliant ✓ but sentence case required
- Stat value: `text-2xl font-semibold text-text-primary` — 24px, above the 18px ceiling for KPI values; should use `--type-numeric-md` (18px/600/tabular-nums) for consistency ✓ or acceptable at 22px; pin to `--type-numeric-md`

**Alerts card:**
- Container: `rounded-[28px] border-border-subtle bg-surface-card p-5` — `rounded-[28px]` → `rounded-panel`
- Section label "Alerts": `text-xs uppercase tracking-wide text-text-tertiary` — uppercase violation; sentence case
- Critical alert items: `rounded-[20px] border-status-danger-border bg-status-danger-bg px-4 py-3` — `rounded-[20px]` → `rounded-control`; semantic tokens ✓
- "Open Alerts" button: `<Link><Button>` → `Button asChild + Link`; isBusy not needed
- Empty alert state: `rounded-[20px]` → `rounded-control`; semantic `status-success-bg` ✓

**Acceptance Criteria:**
- [ ] Aside containers use `rounded-panel` — NOT `rounded-[28px]`
- [ ] Stat items use `rounded-control` — NOT `rounded-[20px]`
- [ ] "Today" and "Alerts" section labels sentence case — NOT uppercase
- [ ] Stat values use `--type-numeric-md` (18px/600)
- [ ] "Open Alerts" button uses `Button asChild + Link` — NOT `<Link><Button>`

### 4.3 Zone Interaction Rules

```yaml
zone_interactions:
  - trigger: isWorkerQueue === true (operator role)
    effect: Management workspace hidden; OperatorWorkspace rendered
    reason: operator needs simplified task-group layout, not a sortable queue

  - trigger: setFilter("today" | "review" | "alerts" | "all")
    effect: filteredItems recomputed; nextUpItem = filteredItems[0]; remaining items update
    reason: filter narrows queue to domain; priority sort preserved within filter

  - trigger: nextUpItem changes (new highest-priority item)
    effect: Next-up card updates to new item and tone
    reason: each auto-refresh may change which item is highest priority

  - trigger: markAlertAsRead(alertId)
    effect: alert removed from state.alerts; filterCounts.alerts decrements;
      RAIL_COUNT_REFRESH_EVENT dispatched; badge in sidebar refreshes
    reason: marking an alert read removes it from queue without full reload

  - trigger: auto-refresh (25s) + !document.hidden
    effect: loadQueue({background: true}) → refreshing=true → retainCurrent data during fetch
    reason: queue stays current during shift; background = no flicker

  - trigger: subscribeToQueueUpdates fires
    effect: queueCount + draft updated; operator missing-shift computation updates
    reason: offline queue changes without page reload

  - trigger: subscribeToWorkflowRefresh fires
    effect: full loadQueue({background: true})
    reason: cross-tab workflow change signals queue reload

  - trigger: isSteelFactory === true
    effect: reconciliations loaded and added to queue items; "Stock reviews" stat visible
    reason: steel factories have inventory reconciliation workflow; general factories do not
```

---

## 5. OPERATIONAL ATTENTION HIERARCHY

### 5.1 Scan Flow — Operator

```
SCAN 1 (0–200ms): First task section (danger tone if attendance or shift missing)
  WHY: Danger-tone section uses status-danger-border — the strongest visual signal.
  Operator reads the section badge ("Action required") before the title.

SCAN 2 (200ms–800ms): Task item CTA (h-11, full width on mobile)
  WHY: The single action button is the next motor action.

SCAN 3 (800ms–2s): Aside stat counts
  WHY: Pending/completed/alerts numbers confirm shift state without navigating.

SCAN 4 (2s+): Remaining task sections (watch/normal tone)
  WHY: Lower-priority tasks read after the urgent one is acted on.
```

### 5.2 Scan Flow — Management

```
SCAN 1 (0–200ms): Queue pulse strip (4 big numbers)
  WHY: Four counts at 18px/600 give the queue health before reading items.
  Zero alerts and zero review = supervisor can work on shift entries.
  High review count = triage needed immediately.

SCAN 2 (200ms–1s): Next-up item (tone-coded card, full width)
  WHY: The single highest-priority item with a direct CTA.
  Tone background communicates urgency before text is read.

SCAN 3 (1s–3s): Remaining queue items + Signal rail counts
  WHY: After acting on next-up, remaining items show what comes next.
  Signal rail provides domain-level context alongside.

SCAN 4 (3s+): Step guide + hero context + section errors
  WHY: Reference content only needed for orientation or error diagnosis.
```

---

## 6. TABLE & DATA STRATEGY

No tables — workspace uses card-based queue item list. Items are ~10–25 in typical use; no virtualization needed. The `ResponsiveScrollArea` wrapper is not present — items stack naturally.

---

## 7. FORM & INPUT STRATEGY

No forms. The only interactive elements are:
- Filter buttons (setFilter state change)
- Queue item CTA buttons (navigation links)
- "Mark read" buttons (async mutation)
- Refresh button (loadQueue trigger)

---

## 8. AI & AUDIT VISIBILITY STRATEGY

No AI systems. `markAlertRead` writes to alert system — not surfaced as an audit event in the UI. The `RAIL_COUNT_REFRESH_EVENT` triggers sidebar badge count refresh as a side effect of marking alerts read.

---

## 9. DENSITY, SPACING & LAYOUT RHYTHM

### 9.1 Density Mode

```yaml
default_density: default
density_justification: Cross-domain triage workspace; default density provides
  adequate card separation for rapid visual scanning. Compact would make the
  tone-coded backgrounds harder to distinguish quickly.
density_switchable: yes — inherits AppShell
```

### 9.2 Spacing Rhythm

```yaml
spacing:
  page_padding: AppShell standard (24px–40px)
  zone_gap: 24px between all major zones
  two_column_gap: 24px
  queue_pulse_grid_gap: 16px (--space-md)
  queue_item_gap: 12px (--space-3) between items
  task_section_gap: 16px (--space-md) between sections (operator)
  task_item_gap: 12px within a section
  aside_card_gap: 16px (--space-md)
```

### 9.3 Typography Specification

```yaml
typography:
  # Management:
  step_eyebrow: 11px / 500 / sentence case / text-text-tertiary
  hero_eyebrow: 11px / 500 / sentence case / text-action-primary
  hero_title: 18px / 600 / sentence case
  hero_subtitle: 14px / 400 / text-text-secondary
  queue_sub_label: 11px / 500 / sentence case / text-text-tertiary  (NOT text-sm)
  section_title: 16px / 600 / sentence case  (NOT text-xl)
  pulse_card_label: 11px / 500 / sentence case / text-text-secondary
  pulse_card_value: 18px / 600 / tabular-nums / text-text-primary
  next_up_badge: 11px / 600 / sentence case / semantic tone fg
  next_up_title: 18px / 600 / text-text-primary
  next_up_detail: 14px / 400 / text-text-secondary
  item_title: 14px / 600 / text-text-primary
  item_detail: 12px / 400 / text-text-secondary
  item_meta: 12px / 400 / text-text-tertiary
  snapshot_label: 11px / 500 / sentence case / text-text-tertiary  (NOT uppercase)
  snapshot_value: 22px / 600 / tabular-nums / text-text-primary
  signal_title: 14px / 600 / text-text-primary
  signal_detail: 13px / 400 / text-text-secondary
  alert_datetime: 11px / 400 / JetBrains Mono  (--type-timestamp)
  # Operator:
  operator_hero_eyebrow: 11px / 500 / sentence case / text-action-primary
  operator_hero_title: 18px / 600 / sentence case
  operator_section_badge: 11px / 600 / sentence case / semantic tone
  operator_item_title: 18px / 600 / text-text-primary
  operator_item_detail: 14px / 400 / text-text-secondary
  operator_aside_label: 11px / 500 / sentence case / text-text-tertiary  (NOT uppercase)
  operator_aside_value: 18px / 600 / tabular-nums / text-text-primary
```

### 9.4 Surface Token Hierarchy

```yaml
surfaces:
  # Management:
  step_card: var(--surface-card) with border-subtle
  hero_section: var(--surface-card) with border-subtle  (verify operational-hero CSS)
  pulse_card: var(--surface-card) with border-subtle
  next_up_card: toneClass() → semantic bg/border tokens ✓ (already canonical)
  queue_item_card: toneClass() → semantic ✓ for tone items; surface-panel border-subtle for normal
  remaining_item_card: toneClass() → semantic ✓; rounded-control
  signal_card: var(--surface-card) with border-subtle
  snapshot_stat: var(--surface-panel) with border-subtle
  # Operator:
  operator_background: var(--surface-shell)  (verify surface-industrial-deep maps here)
  operator_hero_card: var(--surface-card) with border-subtle; rounded-panel
  operator_task_section: accent.panel via workerSectionAccent() → canonical ✓
  operator_task_item: var(--surface-panel) with border-subtle; rounded-control
  operator_aside_card: var(--surface-card) with border-subtle; rounded-panel
  operator_stat_item: var(--surface-panel) with border-subtle; rounded-control
  operator_alert_item: status-danger-bg/border ✓ (already canonical)
```

---

## 10. RESPONSIVE & OPERATOR ADAPTATION

### 10.1 Desktop

```yaml
desktop:
  operator: xl:grid-cols-[1fr_320px]
  management_two_col: xl:grid-cols-[1.08fr_0.92fr]
  management_pulse: xl:grid-cols-4
```

### 10.2 Mobile

```yaml
mobile:
  operator: stacked — main sections above, aside below; CTA buttons full-width h-11 minimum
  management: all zones single-column; pulse grid → 1-col; two-col → stacked
  touch_targets: all buttons ≥44px; queue item CTAs min h-11 (44px)
```

---

## 11. COMPONENT MAPPING

```yaml
component_mapping:
  # Management:
  step_guide_cards: surface-card/border-subtle/rounded-control + sentence case eyebrows
  hero_eyebrow: --type-label-dense sentence case text-action-primary
  hero_title: 18px/600 (NOT text-3xl)
  quick_actions_row: always-visible flex-wrap row; Button asChild + Link each
  queue_pulse_strip: always-visible 4-col grid; CardTitle → 18px/600
  queue_list_card:
    section_sublabel: --type-label-dense (NOT text-sm)
    section_title: 16px/600 (NOT text-xl)
    next_up_cta: Button asChild + Link (NOT <Link><Button>)
    remaining_items: always-visible stacked list (NOT <details>)
    remaining_item_container: rounded-control (NOT rounded-2xl)
    remaining_ctas: Button asChild + Link
  signal_rail:
    section_title: 16px/600 (NOT text-xl)
    snapshot_labels: --type-label-dense sentence case (NOT uppercase)
    snapshot_values: --type-numeric-md (22px/600/tabular-nums)
    alert_time: --type-timestamp (mono/11px)
    always_visible: true (NOT <details>)

  # Operator:
  operator_hero: rounded-panel (NOT rounded-[32px]); sentence case eyebrow
  operator_task_section: shadow via token (NOT raw rgba); accent from workerSectionAccent()
  operator_task_item: rounded-control (NOT rounded-[24px]); Button asChild + Link
  operator_empty_state: rounded-panel; sentence case eyebrow; Button asChild + Link
  operator_aside_containers: rounded-panel (NOT rounded-[28px])
  operator_aside_stats: rounded-control (NOT rounded-[20px]); sentence case label; --type-numeric-md value
  operator_aside_labels: --type-label-dense sentence case (NOT uppercase)
  operator_alert_items: rounded-control (NOT rounded-[20px]); canonical tokens ✓
  operator_open_alerts_btn: Button asChild + Link (NOT <Link><Button>)

  # Shared:
  not_signed_in_card: CardTitle → 16px/600; Button asChild + Link
  section_error_panels: rounded-control (NOT rounded-[20px] or rounded-[28px])
  refreshing_banner: surface-panel border-subtle text-text-secondary (verify surface-muted class)
  mark_read_button: Button variant="ghost" isBusy state ✓ (already correct)
  toneClass_function: returns canonical semantic classes ✓ (already correct — preserve)
  toneBadgeClass_function: returns canonical semantic classes ✓ (already correct — preserve)
  workerSectionAccent_function: returns canonical classes ✓ (already correct — preserve)
  workerQueueStatus_tone: canonical classes ✓ (already correct — preserve)
```

---

## 12. OPERATIONAL PROBLEMS SOLVED

```yaml
problem_resolutions:
  - problem: 4 <details>/<summary> elements hide operational content
      (quick actions, queue pulse, queue signals, more items)
    root_cause: Developer used disclosures to reduce visual density; same root cause
      as settings, tasks, and dashboard
    structural_solution: Section 4.1 structural reduction removes all 4 disclosures;
      Section 4.2 zones specify each as ALWAYS VISIBLE; Section 4.3 confirms no collapse
      triggers for any of them
    section_reference: Section 4.1, Section 4.2 (all management zones)
    measurable_outcome: Quick actions, queue counts, signal rail, and all queue items
      immediately visible; supervisors see the full queue without any click

  - problem: Management h1 uses text-3xl md:text-4xl; operator h1 uses text-3xl
    root_cause: Same pattern as dashboard, tasks, settings — arbitrary heading scale
    structural_solution: Section 9.3 specifies hero_title at 18px/600; Section 4.2
      hero zone acceptance criteria
    section_reference: Section 9.3, Section 4.2
    measurable_outcome: Both paths render h1 at 18px; consistent with all other pages

  - problem: Management step guide eyebrow uses text-[0.65rem] uppercase
    root_cause: Developer used sub-pixel sizing (0.65rem = 10.4px) for the step labels;
      combined with uppercase creates double violation
    structural_solution: Section 9.3 specifies step_eyebrow at 11px/500/sentence case;
      Section 4.2 step guide acceptance criteria
    section_reference: Section 9.3, Section 4.2
    measurable_outcome: Step labels at 11px/500/sentence case; no sub-pixel sizing

  - problem: Signal rail snapshot labels use uppercase tracking — operator aside labels
      also uppercase; multiple locations
    root_cause: Stat-card labels treated as column headers across both paths
    structural_solution: Section 9.3 specifies snapshot_label and operator_aside_label
      at 11px/500/sentence case (--type-label-dense); Section 4.2 acceptance criteria
      per zone explicitly require sentence case
    section_reference: Section 9.3, Section 4.2 (Signal Rail, Operator Aside)
    measurable_outcome: All stat-card labels sentence case throughout both paths

  - problem: Operator task item, aside, stat, and section error containers all use
      arbitrary radius values (rounded-[24px], [28px], [30px], [32px], [20px])
    root_cause: Operator workspace styled with a custom large-radius aesthetic;
      7 distinct arbitrary radius values across the component
    structural_solution: Section 9.4 maps every container to either rounded-panel or
      rounded-control; Section 4.2 acceptance criteria per zone specify the correct value
    section_reference: Section 9.4, Section 4.2 (Operator zones)
    measurable_outcome: Zero arbitrary radius values; consistent rounded-panel/rounded-control

  - problem: Operator task section card uses shadow-[0_18px_50px_rgba(3,8,20,0.24)] — raw rgba
    root_cause: Custom shadow value with raw rgba; forbidden
    structural_solution: Section 9.4 specifies operator_task_section uses shadow token;
      Section 4.2 acceptance criteria require shadow-md or var(--shadow-md)
    section_reference: Section 9.4, Section 4.2 (Operator Task Sections)
    measurable_outcome: Task section cards use system shadow token; no raw rgba shadow

  - problem: <Link><Button> accessibility violation in 10+ locations across both paths
    root_cause: Same pattern flagged throughout Phase A/B
    structural_solution: Section 11 specifies Button asChild + Link for every navigation
      element; Section 4.2 acceptance criteria per zone require Button asChild
    section_reference: Section 11, Section 4.2 (all zones)
    measurable_outcome: Zero <a><button> nesting

  - problem: All CardTitle components use text-xl (20px) — above 16px ceiling
    root_cause: Same governance gap as every other workspace specced so far
    structural_solution: Section 9.3 specifies section_title at 16px/600;
      Section 4.2 zone specs explicitly require this
    section_reference: Section 9.3, Section 4.2
    measurable_outcome: All CardTitle at 16px/600

  - problem: toneClass(), toneBadgeClass(), workerSectionAccent(), workerQueueStatus
      all already return canonical semantic Tailwind class strings — COMPLIANT
    root_cause: This workspace's tone helpers are already correctly implemented
    structural_solution: No fix needed — preserve these functions exactly as they are
    section_reference: Section 11 (component mapping — toneClass/toneBadgeClass ✓)
    measurable_outcome: Zero regressions on these functions during implementation
```

---

## 13. IMPLEMENTATION HANDOFF

### 13.1 Build Sequence

```yaml
implementation_sequence:
  step_1: Remove "Queue pulse" <details>/<summary> — make 4 KPI cards always visible;
    pin CardTitle to 18px/600
  step_2: Remove "Queue signals" right rail <details>/<summary> — make always-visible
    right column; fix both CardTitle to 16px/600; fix snapshot labels to sentence case
    --type-label-dense; fix snapshot values to 22px/600/tabular-nums
  step_3: Remove "More items" <details>/<summary> — all remaining queue items always
    visible below next-up; fix remaining item containers from rounded-2xl to rounded-control
  step_4: Remove "Tools" quick-actions <details>/<summary> — always-visible action row
    below next-up CTA
  step_5: Fix management h1 from text-3xl md:text-4xl to 18px/600 sentence case;
    fix hero eyebrow to --type-label-dense sentence case text-action-primary
  step_6: Fix step guide eyebrows from text-[0.65rem] uppercase to 11px/500 sentence case;
    fix step card surfaces if operational-panel CSS needs update
  step_7: Fix all <Link><Button> nesting to Button asChild + Link pattern (10+ locations
    across both paths — management CTA, remaining items, quick actions, operator task CTAs,
    empty state links, open alerts button)
  step_8: Fix operator h1 from text-3xl to 18px/600 sentence case;
    fix operator hero eyebrow (factory name) from uppercase to sentence case;
    fix operator hero container from rounded-[32px] to rounded-panel
  step_9: Fix operator task item containers from rounded-[24px] to rounded-control;
    fix task section card shadow from raw rgba to var(--shadow-md)
  step_10: Fix operator empty state from rounded-[30px] to rounded-panel;
    fix "All clear" eyebrow from uppercase to sentence case
  step_11: Fix operator aside containers from rounded-[28px] to rounded-panel;
    stat items from rounded-[20px] to rounded-control;
    aside section labels ("Today", "Alerts") from uppercase to sentence case;
    stat values to --type-numeric-md (18px/600)
  step_12: Fix section error panel containers from arbitrary radius to rounded-control
  step_13: Fix not-signed-in error state CardTitle to 16px/600;
    fix its Button links to Button asChild pattern
  step_14: Verify operational-hero, operational-panel, telemetry-rail, surface-muted CSS
    classes produce governance-compliant values; update CSS if not
  step_15: Verify surface-industrial-deep token exists and maps to surface-shell;
    if not: replace with var(--surface-shell) directly
```

### 13.2 Critical Constraints

```yaml
critical_constraints:
  - "toneClass(), toneBadgeClass(), workerSectionAccent(), workerQueueStatus.tone are
     ALREADY CORRECT — do not modify these functions during the fix pass"
  - "Dynamic task index construction (indexes object) must be preserved —
     the Promise.allSettled task building pattern is correct and resilient"
  - "Priority sort (items.sort((a,b) => b.priority - a.priority)) must be preserved"
  - "retainCurrent = shouldBackground pattern must be preserved — background refresh
     keeps existing data visible during the reload"
  - "subscribeToQueueUpdates + subscribeToWorkflowRefresh both must be preserved"
  - "The 4 <details>/<summary> elements removed must NOT be replaced with any other
     collapse mechanism — all four sections contain operational content that must be
     visible on page load"
  - "isSteelFactory conditional for reconciliations must be preserved"
  - "RAIL_COUNT_REFRESH_EVENT dispatch on markAlertRead must be preserved —
     this syncs sidebar badge counts"
```

### 13.3 Open Questions

```yaml
open_questions:
  - question: >
      The CSS classes operational-hero, operational-panel, telemetry-rail, and
      surface-muted are used across the management workspace. Do these classes resolve
      to governance-compliant values (correct surface tokens, correct border, correct
      radius)? Specifically: does operational-hero produce surface-card/border-subtle/
      rounded-panel? Does telemetry-rail produce the correct surface context?
    blocking: yes — if these CSS classes produce non-compliant values (raw hex, arbitrary
      radius, etc.), they must be updated in globals.css before implementation
    owner: frontend team (inspect globals.css / CSS modules)
    decision_needed_by: before step_6 / step_14

  - question: >
      The operator workspace uses bg-[var(--surface-industrial-deep)] as the page
      background. Does this token exist in tokens.css with a correct dark-mode value?
      Same question applies to shadow-[0_18px_50px_rgba(3,8,20,0.24)] — is there a
      system shadow token that maps to this level of depth?
    blocking: yes — same question flagged in dashboard spec; must resolve before
      operator workspace implementation
    owner: frontend team (inspect tokens.css)
    decision_needed_by: before step_9 / step_15

open_questions_blocking: 2
```

---

## ACCEPTANCE CRITERIA (SPEC COMPLETENESS)

- [x] All 13 sections fully populated
- [x] Both render paths (operator + management) fully specced
- [x] Every zone has documented existence justification and testable acceptance criteria
- [x] Every component mapped; compliant tone functions documented as preserved
- [x] Every failure from Section 1.3 has a resolution in Section 12
- [x] 4 <details>/<summary> disclosures eliminated
- [x] No anti-patterns in spec
- [x] All spacing 4px scale
- [x] All surfaces canonical tokens
- [x] Typography follows approved system
- [x] Backend: 11 endpoints + 2 offline clients verified from source
- [x] Permission matrix complete with canSubmit/canReview/canSeeControl/isSteelFactory
- [x] 2 blocking open questions flagged (CSS class verification, industrial token)
- [x] 15-step implementation sequence complete

---

## POST-GENERATION SELF-VALIDATION

```yaml
self_validation:
  operational_integrity:
    - [x] Both render paths traced to backend entities and computed queue state
    - [x] 4 disclosures eliminated; all operational content always visible
    - [x] toneClass/toneBadgeClass/workerSectionAccent correctly identified as passing

  law_compliance:
    - [x] Spacing 4px scale
    - [x] Surfaces canonical tokens (with open questions on CSS classes)
    - [x] All labels sentence case; table-header-only uppercase exception not applicable here
    - [x] Typography from approved system
    - [x] No AI elements

  kiro_readiness:
    - [x] 15-step implementation sequence ordered correctly
    - [x] All acceptance criteria testable
    - [x] 2 blocking open questions flagged

  anti_pattern_check:
    - [x] No gradients
    - [x] No glow effects
    - [x] No pulse on static elements
    - [x] No UPPERCASE labels in spec
    - [x] No <details>/<summary>
    - [x] No <Link><Button>
    - [x] No raw rgba shadows (raw rgba shadow identified on operator task section → fixed)
    - [x] No raw color classes

  structural_integrity:
    - [x] Queue item priority algorithm documented and preserved
    - [x] Both realtime patterns (subscribeToQueueUpdates + subscribeToWorkflowRefresh) documented
    - [x] retainCurrent background-refresh pattern preserved
    - [x] isSteelFactory conditional for reconciliations documented
    - [x] RAIL_COUNT_REFRESH_EVENT side-effect documented
```

---

## 14. VISUAL STRUCTURAL HIERARCHY BLUEPRINT

---

### 14A. Operator Workspace — Desktop Blueprint

```
┌─[APP TOPBAR 48px]──────────────────────────────────────────────────────────────────┐
│ DPR.ai  ·  Shree Steel Works  ·  Work Queue                     ⚙  [≡ Nav]         │
└────────────────────────────────────────────────────────────────────────────────────┘
┌─[SIDEBAR 220px]─┬─[OPERATOR WORK QUEUE surface-shell]──────────────────────────────┐
│ ■ Dashboard     │                                                                   │
│ ◉ Work Queue    │  ┌─[HERO surface-card border-subtle rounded-panel]──────────────┐ │
│ ○ Entry         │  │ Shree Steel Works  11px/500/action-primary/sentence           │ │
│ ○ Scan          │  │ Work queue  18px/600                                          │ │
│ ○ Attendance    │  │  ★ Shift not started  ← status-danger semantic badge         │ │
│                 │  │                [Refresh ← outline, isBusy]  Updated 08:45 mono│ │
│                 │  └────────────────────────────────────────────────────────────────┘ │
│                 │  ┌─[MAIN xl:[1fr 320px]]──────────────────────────────────────────┐ │
│                 │  │ ┌─[TASK SECTIONS]──────────────────────────────────────────┐  │ │
│                 │  │ │ ┌─[surface-card border-status-danger-border rounded-panel]┐ │  │ │
│                 │  │ │ │ [! Action required  status-danger badge]  1 task        │ │  │ │
│                 │  │ │ │ ──────────────────────────────────────────────────────  │ │  │ │
│                 │  │ │ │ ┌─[surface-panel border-subtle rounded-control]──────┐  │ │  │ │
│                 │  │ │ │ │ Attendance punch is still open  18px/600/primary   │  │ │  │ │
│                 │  │ │ │ │ Morning shift ready for punch-in for 13 Jun.       │  │ │  │ │
│                 │  │ │ │ │             [Punch In ← Button primary asChild]    │  │ │  │ │
│                 │  │ │ │ └────────────────────────────────────────────────────┘  │ │  │ │
│                 │  │ │ └──────────────────────────────────────────────────────────┘ │  │ │
│                 │  │ │ ┌─[surface-card border-status-warning-border rounded-panel]─┐ │  │ │
│                 │  │ │ │ [~ Continue work  status-warning badge]  2 tasks          │ │  │ │
│                 │  │ │ │ ┌─[surface-panel border-subtle rounded-control]─────────┐ │ │  │ │
│                 │  │ │ │ │ Saved draft available  18px/600                        │ │ │  │ │
│                 │  │ │ │ │ Evening draft saved for 13 Jun.  14px/secondary        │ │ │  │ │
│                 │  │ │ │ │         [Continue ← outline asChild]                  │ │ │  │ │
│                 │  │ │ │ └────────────────────────────────────────────────────────┘ │ │  │ │
│                 │  │ │ │ ┌─[surface-panel border-subtle rounded-control]─────────┐ │ │  │ │
│                 │  │ │ │ │ Saved offline work is waiting  18px/600               │ │ │  │ │
│                 │  │ │ │ │ 2 items need sync.  14px/secondary                    │ │ │  │ │
│                 │  │ │ │ │         [Open & Sync ← outline asChild]               │ │ │  │ │
│                 │  │ │ │ └────────────────────────────────────────────────────────┘ │ │  │ │
│                 │  │ │ └──────────────────────────────────────────────────────────────┘ │  │ │
│                 │  │ └──────────────────────────────────────────────────────────────┘  │ │
│                 │  │ ┌─[ASIDE 320px surface-card rounded-panel]────────────────────┐  │ │
│                 │  │ │ Today  11px/500/tert/sentence case (NOT uppercase)           │  │ │
│                 │  │ │ ┌── Pending ──┐ ┌── Completed ──┐ ┌── Critical alerts ──┐   │  │ │
│                 │  │ │ │░ rounded-ctrl│ │░ rounded-ctrl │ │░ rounded-ctrl        │   │  │ │
│                 │  │ │ │  Pending     │ │  Completed    │ │  Critical alerts     │   │  │ │
│                 │  │ │ │  11px/tert   │ │  11px/tert    │ │  11px/tert           │   │  │ │
│                 │  │ │ │      3       │ │      1        │ │       2              │   │  │ │
│                 │  │ │ │  18px/600    │ │  18px/600     │ │  18px/600            │   │  │ │
│                 │  │ │ └─────────────┘ └───────────────┘ └─────────────────────┘   │  │ │
│                 │  │ │ ─────────────────────────────────────────────────────────   │  │ │
│                 │  │ │ Alerts  11px/500/tert/sentence case                         │  │ │
│                 │  │ │ ┌─ Alert (status-danger) rounded-control ─────────────────┐ │  │ │
│                 │  │ │ │ Auth anomaly detected  14px/600/danger-fg                │ │  │ │
│                 │  │ │ │ 13 Jun 10:24  12px/tert                                  │ │  │ │
│                 │  │ │ └─────────────────────────────────────────────────────────┘ │  │ │
│                 │  │ │ [Open Alerts ← outline asChild, NOT <Link><Button>]         │  │ │
│                 │  │ └────────────────────────────────────────────────────────────┘  │ │
│                 │  └────────────────────────────────────────────────────────────────┘ │
└─────────────────┴───────────────────────────────────────────────────────────────────┘
```

---

### 14B. Management Workspace — Desktop Blueprint (1440px)

```
┌─[APP TOPBAR 48px]──────────────────────────────────────────────────────────────────────┐
│ DPR.ai  ·  Shree Steel Works  ·  Work Queue                          ⚙  [≡ Nav]        │
└────────────────────────────────────────────────────────────────────────────────────────┘
┌─[SIDEBAR]──┬─[MANAGEMENT QUEUE surface-shell max-w-1440px]────────────────────────────┐
│ ◉ Work Queue│                                                                           │
│            │  ┌─[STEP GUIDE md:grid-cols-3]────────────────────────────────────────┐  │
│            │  │ ┌─ Step 1 ────────────────┐ ┌─ Step 2 ──────────┐ ┌─ Step 3 ────┐ │  │
│            │  │ │░ rounded-control         │ │░ rounded-control  │ │░            │ │  │
│            │  │ │  Step 1  11px/tert/lower  │ │  Step 2  11px/tert│ │  Step 3    │ │  │
│            │  │ │  Pick focus  14px/600     │ │  Process next     │ │  Check load│ │  │
│            │  │ │  description 14px/sec     │ │  14px/sec         │ │  14px/sec  │ │  │
│            │  │ └─────────────────────────┘ └───────────────────┘ └────────────┘ │  │
│            │  └────────────────────────────────────────────────────────────────────┘  │
│            │  ┌─[HERO surface-card border-subtle rounded-panel]────────────────────┐  │
│            │  │ Daily coordination  11px/500/action-primary/sentence               │  │
│            │  │ Work queue  18px/600                                                │  │
│            │  │ See the next task and act fast.  14px/400/secondary                │  │
│            │  │ [Factory: Shree Steel] [Org: Shree Industries]  surface-panel pills│  │
│            │  │ [Refresh queue ← outline isBusy]  Updated 08:45 mono               │  │
│            │  │ ─────────────────────────────────────────────────────────────────  │  │
│            │  │ [Open Review Queue ← primary asChild]  ← next-up CTA              │  │
│            │  │ QUICK ACTIONS — ALWAYS VISIBLE:                                    │  │
│            │  │ [Attendance ░] [New Shift Entry ■] [Upload Document ░]             │  │
│            │  └────────────────────────────────────────────────────────────────────┘  │
│            │  ┌─[QUEUE PULSE — ALWAYS VISIBLE md:grid-cols-2 xl:grid-cols-4]──────┐  │
│            │  │ ┌── Open items ──┐ ┌── Today ────┐ ┌── Review ──┐ ┌── Alerts ──┐ │  │
│            │  │ │░░░░░░░░░░░░░░░│ │░░░░░░░░░░░░│ │░░░░░░░░░░░│ │░░░░░░░░░░░│ │  │
│            │  │ │ Open items     │ │ Today       │ │ Review     │ │ Unread alerts│ │  │
│            │  │ │ 11px/500/sec   │ │ 11px/500/sec│ │ 11px/500   │ │ 11px/500    │ │  │
│            │  │ │     8          │ │      3      │ │     4      │ │      3      │ │  │
│            │  │ │ 18px/600 mono  │ │ 18px/600    │ │ 18px/600   │ │ 18px/600    │ │  │
│            │  │ │ All lanes      │ │ Today only  │ │ Needs review│ │ Unread now  │ │  │
│            │  │ └────────────────┘ └─────────────┘ └────────────┘ └─────────────┘ │  │
│            │  └────────────────────────────────────────────────────────────────────┘  │
│            │  ┌─[TWO-COLUMN xl:[1.08fr_0.92fr]]─────────────────────────────────────┐ │
│            │  │ ┌─[QUEUE LIST surface-card]──────────────────┐ ┌─[SIGNAL RAIL]────┐│ │
│            │  │ │ Queue view  11px/500/tert                   │ │▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓ ││ │
│            │  │ │ Process next  16px/600                      │ │ QUEUE SNAPSHOT   ││ │
│            │  │ │ [All (8)] [Today (3)] [Review (4)] [Alerts] │ │ surface-card     ││ │
│            │  │ │ ─────────────────────────────────────────── │ │ 16px/600         ││ │
│            │  │ │ ┌─[NEXT-UP tone-bg rounded-panel border]──┐ │ │ ┌─ stat ───────┐ ││ │
│            │  │ │ │ [Next up ← tone badge] Today  Review    │ │ │ │░ Pending DPR │ ││ │
│            │  │ │ │ Attendance review waiting  18px/600      │ │ │ │  review      ││ │
│            │  │ │ │ 12 items open, 5 missed punch cases.     │ │ │ │  11px/tert   ││ │
│            │  │ │ │         [Open Review ← primary asChild]  │ │ │ │      12      ││ │
│            │  │ │ └─────────────────────────────────────────┘ │ │ │  22px/600    ││ │
│            │  │ │ ─── REMAINING ITEMS — ALWAYS VISIBLE ──────  │ │ └──────────────┘ ││ │
│            │  │ │ ┌─[tone-bg rounded-control border p-4]────┐ │ │ ┌─ stat ───────┐ ││ │
│            │  │ │ │[watch badge] Review  OCR #42             │ │ │ │░ OCR waiting ││ │
│            │  │ │ │ OCR verification waiting  14px/600       │ │ │ │  11px/tert   ││ │
│            │  │ │ │ 78% confidence  12px/sec                 │ │ │ │       4      ││ │
│            │  │ │ │  [Open OCR Review ░ asChild]             │ │ │ │  22px/600    ││ │
│            │  │ │ └─────────────────────────────────────────┘ │ │ └──────────────┘ ││ │
│            │  │ │ ┌─[tone-bg rounded-control border p-4]────┐ │ │ ┌─ stat ───────┐ ││ │
│            │  │ │ │[action badge] Today  Entry #88           │ │ │ │░ Stock reviews││ │
│            │  │ │ │ Evening entry pending  14px/600          │ │ │ │  11px/tert   ││ │
│            │  │ │ │         [Open Entry ░ asChild]           │ │ │ │       2      ││ │
│            │  │ │ └─────────────────────────────────────────┘ │ │ └──────────────┘ ││ │
│            │  │ │ ┌─[danger rounded-control border p-4]─────┐ │ │ ─────────────── ││ │
│            │  │ │ │[danger badge] Alerts  Alert 1            │ │ │ RECENT SIGNALS  ││ │
│            │  │ │ │ Auth anomaly detected  14px/600          │ │ │ 16px/600        ││ │
│            │  │ │ │ HIGH · auth_anomaly · 08:45 mono         │ │ │ Submitted today ││ │
│            │  │ │ │ [Open Board ░ asChild] [Mark read ghost] │ │ │ 3 entries       ││ │
│            │  │ │ └─────────────────────────────────────────┘ │ │ Latest alert    ││ │
│            │  │ └────────────────────────────────────────────┘ │ │ 08:45 mono      ││ │
│            │  │                                                  │ │ Offline status  ││ │
│            │  │                                                  │ │ 0 items         ││ │
│            │  │                                                  │ └────────────────┘│ │
│            │  └─────────────────────────────────────────────────────────────────────┘ │
└────────────┴───────────────────────────────────────────────────────────────────────────┘

MANAGEMENT SCAN PATH:
  [1] 0–200ms → Queue pulse strip (4 counts at 18px — immediate health signal)
  [2] 200ms–1s → Next-up item (tone-coded — highest priority action)
  [3] 1–3s → Remaining items (scroll through sorted queue) + Signal rail (domain counts)
  [4] 3s+ → Step guide + hero context + quick actions

OPERATOR SCAN PATH:
  [1] 0–200ms → First task section tone (danger background = act immediately)
  [2] 200ms–800ms → Task item CTA (single button; h-11 min; full-width mobile)
  [3] 800ms–2s → Aside stat counts (pending/completed/alerts)
  [4] 2s+ → Continue work + other tasks sections
```

---

### 14C. Spacing & Rhythm Visualization

```
MANAGEMENT RHYTHM — Urgency cascade (top to bottom):
  Step guide (12px padding) — COMPACT: orientation context, not primary
  ↓ 24px
  Hero (20px padding) — BREATHABLE: identity + action
  ↓ 24px
  Queue pulse (16px card padding) — DENSE: 4 numbers, tight grid, fast scan
  ↓ 24px
  Queue list / Signal rail — OPERATIONAL DENSITY:
    Next-up: 16px padding; semantic tone bg; prominent
    Remaining items: 12px padding, 12px gap — dense list, scannable
    Signal stats: 12px padding — numeric focus, labels recede

OPERATOR RHYTHM:
  Hero (20px) — COMPACT: status + refresh
  ↓ 16px
  Task sections (12px gap between sections) — MODERATE
    Section cards: 20px padding; shadow adds depth signal
    Task items: 16px padding, 12px gap — comfortable touch targets
  Aside: parallel to main, dense stat grid (12px padding per stat item)

VISUAL SILENCE:
  24px zone gaps prevent zones from merging visually
  Tone backgrounds on task items create self-contained urgency islands
  Signal rail sits adjacent to queue — same visual plane, different width
```

---

### 14D. Component Nesting Hierarchy

```
WorkQueuePage (state management)
  ├── [if isWorkerQueue] OperatorLayout
  │     ├── ErrorBanners (MutationErrorBanner components)
  │     ├── SectionErrorPanels (rounded-control — NOT rounded-[20px])
  │     ├── HeroCard (surface-card border-subtle rounded-panel — NOT rounded-[32px])
  │     │     ├── FactoryNameEyebrow (11px/500/action-primary/sentence)
  │     │     ├── <h1> (18px/600)
  │     │     ├── StatusBadge (workerQueueStatus.tone ✓ canonical)
  │     │     └── Button "Refresh" (outline, isBusy)
  │     └── Grid xl:[1fr 320px]
  │           ├── TaskSections (main col)
  │           │     └── TaskSectionCard × N (rounded-panel, shadow-md, accent.panel ✓)
  │           │           ├── SectionBadge (accent.badge ✓ canonical)
  │           │           └── TaskItemCard × N (rounded-control — NOT rounded-[24px])
  │           │                 ├── ItemTitle (18px/600)
  │           │                 ├── ItemDetail (14px/400)
  │           │                 └── Button asChild + Link (NOT <Link><Button>)
  │           └── Aside (320px)
  │                 ├── TodaySummaryCard (surface-card border-subtle rounded-panel)
  │                 │     └── StatItem × 3 (rounded-control; sentence case label)
  │                 └── AlertsCard (surface-card border-subtle rounded-panel)
  │                       └── AlertItem × N (rounded-control; status-danger ✓)
  │                             └── Button asChild + Link "Open Alerts"
  │
  └── [else] ManagementLayout
        ├── StepGuide (3-col grid)
        │     └── StepCard × 3 (rounded-control; 11px/500/sentence case eyebrow)
        ├── HeroSection (surface-card border-subtle rounded-panel)
        │     ├── HeroEyebrow (--type-label-dense sentence case action-primary)
        │     ├── <h1> (18px/600)
        │     ├── ContextPills × 2 (surface-panel border-subtle)
        │     ├── Button "Refresh" + timestamp
        │     ├── NextUpCTA (Button asChild + Link)
        │     └── QuickActionsRow (ALWAYS VISIBLE; Button asChild + Link × 3)
        ├── ErrorBanners
        ├── SectionErrorPanels (rounded-control)
        ├── QueuePulseStrip (ALWAYS VISIBLE; 4-col grid)
        │     └── Card × 4 (surface-card border-subtle; CardTitle → 18px/600)
        └── TwoColumnGrid xl:[1.08fr 0.92fr]
              ├── QueueListCard (surface-card border-subtle; left col)
              │     ├── SubLabel (11px/500 -- NOT text-sm)
              │     ├── CardTitle (16px/600 -- NOT text-xl)
              │     ├── FilterButtons × 4 (primary when active)
              │     ├── NextUpCard (toneClass() ✓; rounded-panel)
              │     │     └── Button asChild + Link (primary)
              │     └── RemainingItemsList (ALWAYS VISIBLE)
              │           └── ItemCard × N (toneClass() ✓; rounded-control)
              │                 └── Button asChild + Link; mark-read ghost
              └── SignalRailColumn (right col; ALWAYS VISIBLE)
                    ├── SnapshotCard (surface-card border-subtle)
                    │     ├── CardTitle (16px/600)
                    │     └── StatItem × N (rounded-control; sentence case label; 22px/600 value)
                    └── SignalCard (surface-card border-subtle)
                          ├── CardTitle (16px/600)
                          └── SignalItem × 3 (rounded-control; --type-timestamp for datetime)
```

---

### 14E. Responsive Blueprint

```
1440px+ (Desktop):
  Operator: [main task sections | aside 320px]
  Management: step guide 3-col · hero full · pulse 4-col · [queue 1.08fr | signal 0.92fr]

<1024px:
  Operator: main stacks above aside
  Management: queue and signal col stack; pulse → 2-col

<768px (Mobile):
  Operator: full-width stacks; task CTAs h-11 min; aside below sections
  Management: all zones single-column; pulse 1-col; remaining items visible (no collapse)
  Touch targets: all buttons ≥44px
```

---

### 14F. Structural Consistency Validation

```yaml
structural_validation:
  - [x] All 4 <details> removed; operational content always visible
  - [x] Both render paths justified by distinct role needs (operator task execution vs management triage)
  - [x] Visual dominance: next-up item dominates management queue; danger section dominates operator
  - [x] Spacing 24px between zones; 12px within item lists
  - [x] Responsive adaptations preserve all critical actions
  - [x] Component nesting hierarchy matches Section 11
  - [x] toneClass/toneBadgeClass/workerSectionAccent already canonical — no regressions
  - [x] Blueprint matches both layout patterns declared in Section 4.1
```

---

## KIRO TASK CHAINING

```yaml
downstream_kiro_tasks:
  task_1:
    name: "Work Queue — Remove Queue Pulse + Signal Rail Disclosures"
    input: This spec → Section 4.2 (Queue Pulse, Signal Rail), Section 12
    output: Both sections always visible; CardTitle at 18px/16px; snapshot labels sentence case

  task_2:
    name: "Work Queue — Remove More Items Disclosure + Remaining Items Always Visible"
    input: This spec → Section 4.2 (Queue List), Section 12
    output: All remaining queue items visible below next-up; rounded-control on items;
      all CTAs Button asChild + Link

  task_3:
    name: "Work Queue — Remove Tools Disclosure + Quick Actions Always Visible"
    input: This spec → Section 4.2 (Hero), Section 12
    output: Quick actions always visible inline row; next-up CTA uses Button asChild

  task_4:
    name: "Work Queue — Typography Fix (both paths)"
    input: This spec → Section 9.3, Section 4.2 (all zones)
    output: Both h1 at 18px/600; step eyebrows 11px/500 sentence case;
      hero eyebrows sentence case; queue sub-label 11px (NOT text-sm);
      all CardTitle 16px/600; snapshot labels sentence case;
      operator aside labels sentence case; all uppercase eliminated

  task_5:
    name: "Work Queue — Operator Radius Fix"
    input: This spec → Section 4.2 (Operator zones), Section 9.4, Section 12
    output: All rounded-[24px/28px/30px/32px/20px] → rounded-panel or rounded-control;
      task section shadow → shadow-md or var(--shadow-md); empty state eyebrow sentence case

  task_6:
    name: "Work Queue — <Link><Button> accessibility fix (10+ locations)"
    input: This spec → Section 11, Section 4.2
    output: All navigation elements use Button asChild + Link; zero <a><button> nesting

  task_7:
    name: "Work Queue — CSS Class Governance Verification"
    input: This spec → Section 13.3 (open questions)
    output: operational-hero, operational-panel, telemetry-rail, surface-muted CSS classes
      verified or updated to produce canonical surface/border/radius values
```

---

*End of WORKSPACE_SKELETON_WORK_QUEUE.md (Sections 1–14)*
*This file is system-generated architecture. Treat as engineering law until formally amended.*
*Architectural precedents established:*
*- toneClass()/toneBadgeClass()/workerSectionAccent()/workerQueueStatus.tone are already canonical — do NOT modify*
*- Dynamic Promise.allSettled task index construction — preserved as the correct resilience pattern*
*- retainCurrent background-refresh pattern — preserved to prevent stale-data flicker*
*- Priority score algorithm (0–110) — documented and preserved*
*- 4 <details>/<summary> disclosures removed from one component — largest single-component disclosure count in Phase B*
*- Signal rail and queue pulse are co-equal operational surfaces — both must always be visible*
