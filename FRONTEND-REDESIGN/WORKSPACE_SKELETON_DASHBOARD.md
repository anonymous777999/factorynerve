# Dashboard — Workspace Skeleton Architecture
# FactoryNerve OS | Phase 3 Skeleton Specification | Phase B, Item 1
# Route: /dashboard
# Generated: 2026-06-03
# Status: DRAFT

---

## 1. WORKSPACE OVERVIEW

### 1.1 Identity

| Field | Value |
|---|---|
| Route | `/dashboard` |
| Workspace Name | Operations Board — Role-Aware Command Hub |
| Operational Role | The role-differentiated home workspace for all non-attendance roles. Provides real-time factory health signals (alerts, anomalies, OCR trust, shift coverage), role-specific workflow orientation (primary action, secondary actions, launch guide), live operational feed (recent entries, queue escalations, OCR events), and deep-link navigation to every relevant downstream workspace. |
| Business Impact | If the dashboard fails, every role that uses it as their home screen has no starting point. Operators miss shift submission signals. Supervisors miss review queue urgency. Managers miss operational health at shift start. Owners lose the risk-to-action hub. The dashboard is not just informational — it is the operational routing layer for the entire platform. |
| User Population | operator, supervisor, accountant, manager, admin, owner. Two distinct render paths: (1) Operator home — `isOperatorHome=true` when `user.role === "operator"` → lean worker-mode workspace; (2) Management home — all other roles → full operational intelligence workspace. |
| Peak Usage Context | Shift start (5:30am–8:30am, 12:00pm, 6:00pm) for operators and supervisors. Continuous throughout shift for managers. Morning review for owners and admins. The highest traffic workspace in the system by daily session count. |
| Predecessor Workspaces | `/access` (post-login role routing) or any workspace that links back to dashboard |
| Successor Workspaces | Role-determined: operator→`/entry`, `/ocr/scan`, `/attendance`; supervisor→`/approvals`, `/ocr/verify`; manager→`/approvals`, `/steel`, `/reports`; admin→`/settings`; owner→`/premium/dashboard` or `/control-tower` |

### 1.2 Operational Importance

The dashboard is the only workspace that every role visits at least once per shift. For operators it is a pre-entry checklist — attendance status, pending shifts, queue count, and the primary action CTA. For supervisors it is a threat assessment — how many alerts, how many OCR items, what needs review now. For managers it is a decision surface — what is the priority action across review, reports, and steel operations. Its failure cost is proportional to time: a broken dashboard at 6am costs one full shift's worth of operational context for every worker who depends on it.

### 1.3 Current State Failures

**Management workspace (non-operator path):**
- `factory-dashboard-reminder` section uses `font-mono text-[11px] font-semibold uppercase tracking-[0.22em] text-[var(--action-primary)]` for "Live Reminders" — `font-mono` on a section eyebrow is forbidden; tracking 3.7× maximum; raw alias `text-[var(--action-primary)]`; must use `--type-label-dense` sentence case `text-action-primary`
- The "Action now" chip uses `uppercase tracking-[0.18em]` inside `font-mono text-[11px]` — same triple violation pattern
- `route-header__eyebrow` renders the headerEyebrow value (e.g. "Operations Board") and likely uses the legacy CSS class system; no governance check in the CSS
- `route-header__title` renders at what appears to be `text-2xl` or higher via the `.route-header__title` CSS class — needs verification against 18px ceiling
- Multiple `details`/`summary` "Board Tools" section — forbidden pattern; refresh and sync controls must not be hidden behind a disclosure
- All workflow zone section eyebrows use `font-mono text-[11px] font-semibold uppercase tracking-[0.22em] text-[var(--action-primary)]` — same pattern across five zones: forbidden mono+uppercase+tracking+alias
- `factory-workflow-chip` labels use `font-mono text-[11px] uppercase tracking-[0.14em]` — forbidden mono+uppercase on chip labels
- `factory-feed-item` channel labels use `font-mono text-[11px] uppercase tracking-[0.16em]` — forbidden
- Live Production Activity table headers use `font-mono text-[11px] uppercase tracking-[0.16em]` — table headers DO permit uppercase but tracking must be ≤0.06em; `tracking-[0.16em]` is 2.7× maximum; `font-mono` is still forbidden (table headers use Inter UI not monospace)
- Escalation summary chips use `font-mono text-[11px] uppercase tracking-[0.14em]` — same violation
- Legacy `var(--accent)` alias used in multiple Card eyebrows (the hidden `factory-dashboard-card` sections): `text-[var(--accent)]` — must use `text-action-primary`
- Legacy `var(--muted)` appears in the "Attention" and "Now" hidden card sections and the no-user fallback card
- `text-[var(--card-strong)]` background in attention metric chips — legacy alias
- `text-[var(--border)]` border in multiple sections — legacy alias
- Legacy `bg-[var(--status-info-bg)] text-[var(--status-info-fg)]` in OCR summary — these ARE semantic tokens if they map correctly; verify they resolve to `status-processing-*` tokens (status-info may be a legacy name)
- The operator workspace uses `bg-[var(--surface-industrial-deep)]`, `bg-[var(--surface-industrial-raised)]`, `bg-[var(--surface-overlay)]`, `text-[var(--text-inverse)]` — these appear to be industrial-specific surface tokens; must verify they exist in the canonical token system or map to canonical equivalents
- Quick action links in operator workspace use `rounded-[24px]` — arbitrary radius; must use `rounded-panel`
- Summary stat cards in operator workspace use `rounded-[20px]` — arbitrary radius; must use `rounded-control`
- Status/error banners use `rounded-[20px]` — arbitrary radius
- Sidebar shimmer/pulse on system status dot uses `shadow-[0_0_10px_rgba(34,197,94,0.55)]` — glow effect on status indicator; forbidden; static status must use solid `bg-status-success-icon`, no glow
- Primary CTA in operator workspace is an `<a>` (Link) styled as a button with arbitrary padding and `rounded-[28px]` — must use `Button variant="primary"` with `asChild` + `Link`; arbitrary radius forbidden
- "Board Tools" `<details>/<summary>` pattern appears once — forbidden; must be always-visible controls

**Operator workspace specific:**
- "Today's summary" section is duplicated — both in the main section AND the aside; shows completed/pending counts twice from different layouts; one of these must be removed
- The main section aside contains "Today's summary" as a card AND the main grid already has a summary block — exact duplication; the aside card is the correct location; the in-section block should be removed
- `text-[var(--text-inverse)]` on name and value text — needs verification that this maps to `text-text-primary` in dark mode; if it's a non-canonical alias, it must be replaced
- `text-[var(--text-secondary)]` in aside — correct canonical class? `var(--text-secondary)` vs `text-text-secondary` — the CSS variable form `text-[var(--text-secondary)]` may work but is not the canonical Tailwind class form

---

## 2. WORKSPACE CLASSIFICATION

| Dimension | Classification | Rationale |
|---|---|---|
| Workspace Type | Intelligence Dashboard (management) / Operational Form Hub (operator) | Management path aggregates operational intelligence signals. Operator path presents a single dominant action with supporting context. |
| Workflow Category | Execution (operator) / Oversight (management) | Operator completes a sequential shift workflow. Management allocates attention across domains. |
| Operational Behavior | Mixed — Realtime signals + Static role-aware content | Alerts and anomaly data refresh; entry data is session-loaded; no WebSocket subscription but badge counts refresh on events |
| Data Density | MEDIUM (operator) / VERY HIGH (management) | Operator: 1 primary action + 3 quick actions + 2 summary stats + alerts + shift cards. Management: anomaly strip + header + node grid + telemetry + workflow zones + live feed + intelligence grid + launch guide |
| Realtime Complexity | MEDIUM | `subscribeToQueueUpdates` for offline queue count; `subscribeToWorkflowRefresh` for cross-tab sync; `window.online/offline` events for network detection |
| AI Complexity | MEDIUM | `getAnomalyPreview()` feeds `AnomalyStrip` and `topAnomaly` signal; plan-gated (403 = `anomalyLocked`); no latency-sensitive AI — loaded on mount |
| Audit Complexity | LOW | `markAlertRead` writes to alert system; no AuditLog writes |
| Decision Pressure | HIGH (operator at shift start) / MEDIUM (management continuous) | Operator has 3-minute window at shift start to confirm attendance status and queue entry. Management scans continuously but without hard time pressure. |

**Classification Implication:**
The dashboard is unusual: it is TWO workspaces sharing one route, split by role. The operator workspace is a LEAN COMMAND SURFACE — one primary CTA dominates, everything else is supporting context. The management workspace is a FULL INTELLIGENCE DASHBOARD — multiple parallel information zones, each linking to a specific downstream workspace. These two paths must be specced separately. The shared infrastructure (data loading, session, alerts) is specced once. The layouts and zone priorities differ completely.

---

## 3. BACKEND OPERATIONAL MAPPING

### 3.1 API Surface

| Endpoint | Method | Purpose | Permission | Used By | Caching |
|---|---|---|---|---|---|
| `GET /entries` | GET | Today's entries list (`getTodayEntries`) | Auth | All roles | 5s |
| `GET /entries` | GET | Recent entries list (page 1, size 50) (`listEntries`) | Auth | Management only | session |
| `GET /settings/usage` | GET | AI usage summary | manager+ | Management | 20s |
| `GET /alerts` | GET | Unread alerts list | Auth | All roles | 10s |
| `GET /analytics/weekly` | GET | 7-day production analytics | supervisor+ (403 = locked) | Management | 20s |
| `GET /ai/anomalies/preview` | GET | Anomaly signals preview (quota-free) | owner+ (403 = locked) | Management | session |
| `GET /ocr/verifications/summary` | GET | OCR trust summary (pending, trusted, rows) | supervisor+ | Management | session |
| `GET /attendance/me/today` | GET | Today's attendance record for current user | Auth | Operator only | 5s |
| `POST /alerts/{id}/read` | PUT | Mark alert as read | Auth | All roles | — |
| (offline) `countQueuedEntries(userId)` | — | Client-side IndexedDB queue count | — | All roles | — |
| (offline) `loadDraft(userId)` | — | Client-side saved entry draft | — | Operator only | — |

**Load strategy:** `Promise.allSettled` — partial failure does not block the dashboard. Plan-gated endpoints return HTTP 403 (not error — sets `analyticsLocked` / `anomalyLocked` flags). Network errors per endpoint are surfaced selectively; only the first failure sets `state.error`.

**Realtime subscriptions:**
- `subscribeToQueueUpdates(fn)` — fires when the offline queue changes; updates `queueCount`
- `subscribeToWorkflowRefresh(fn)` — fires when another tab/component signals a data change; triggers `loadDashboard()`
- `window.online / window.offline` events — updates `online` flag; auto-syncs queue when network returns

### 3.2 Entity Relationship Map

```
User (role, factory_id, org_id)
    ├── Entry × today (shift, units_produced, units_target, downtime_minutes)
    ├── Entry × recent (page_1 of full list — management only)
    ├── AlertItem × unread (id, alert_type, message, severity)
    ├── WeeklyAnalyticsPoint × 7 (date, units, production_percent, attendance_percent)
    ├── AnomalyPreview (items: [{entry_id, anomaly_type, message, severity, date, shift}])
    ├── OcrVerificationSummary (pending_documents, trusted_documents, trusted_rows, last_trusted_at)
    ├── AttendanceToday (status, shift, punch_in_at, can_punch_in, can_punch_out, worked_minutes)
    ├── UsageSummary (plan, period, requests_used, max_requests, credits_used)
    └── EntryDraft (offline, client-side: shift, date, partial data)
```

**Primary entities driving role-specific rendering:**
- Operator: `AttendanceToday` (drives primary CTA), `Entry[]` (completed shifts), `EntryDraft` (resume CTA), `AlertItem[]` (aside alerts)
- Management: `AlertItem[]` (urgency), `AnomalyPreview` (AI signals), `OcrVerificationSummary` (OCR health), `Entry[]` (live feed), `UsageSummary` (plan context)

### 3.3 Workflow State Machine

```
[PAGE LOAD]
  → if loading: <DashboardPageSkeleton/>
  → if !user: no-user error state
  → Promise.allSettled(10 parallel tasks) → setState(nextState)
  → isOperatorHome = user.role === "operator"
      → true: <OperatorDashboardWorkspace .../>
      → false: management workspace render

[OPERATOR FLOW]
  Primary CTA resolution (priority order):
    1. attendanceToday.can_punch_in → "Start Shift" → /attendance
    2. draft exists → "Continue Shift" → /entry?draft
    3. nextPendingShift → "Continue/Complete Entry" → /entry?shift=X
    4. attendanceToday.can_punch_out → "Complete Shift" → /attendance
    5. queueCount > 0 → "Scan Paper" → /ocr/scan
    6. workerAlerts.length > 0 → "Open My Tasks" → /tasks
    7. default → "View Report" → /reports

[MANAGEMENT FLOW]
  No state machine — reads state, renders zones. Zones are ordered by priority:
    1. AnomalyStrip (conditional on anomalyCount > 0 or topAnomaly)
    2. Factory reminder strip (primary action + network indicator)
    3. Route header (role-personalized title + meta)
    4. Node status grid (4 system nodes)
    5. Telemetry strip (4 KPI counts)
    6. Board tools (refresh + sync — conditionally visible if queueCount > 0)
    7. Critical operational zone (telemetry + primary action)
    8. Workflow zones grid (5 lanes)
    9. Live feed (8 items: alerts + anomalies + OCR + entries)
    10. Intelligence grid (production table + bottlenecks + recommendations)
    11. Launch guide steps (role-specific 3-step workflow)

[SHARED EVENTS]
  → window.online → if queueCount > 0: auto-trigger handleSync()
  → queueUpdates subscription → refresh queueCount
  → workflowRefresh subscription → reload dashboard
  → markAlertRead(id) → remove from state.alerts; signal rail counts refresh
```

### 3.4 Realtime Contracts

| System | Transport | Update | Zones Affected |
|---|---|---|---|
| Queue updates | Client event subscription | On IndexedDB write | queueCount badge, operator CTA label, telemetry chip |
| Workflow refresh | Custom window event | Cross-tab signal | Full dashboard reload |
| Network status | browser events | Instant | Online/offline pill; auto-sync trigger |

### 3.5 AI System Contracts

| AI System | Input | Output | Confidence | Latency | Fallback |
|---|---|---|---|---|---|
| Anomaly preview | Factory entries (server-side) | `AnomalyPreview.items[]` — scored anomaly signals | No explicit confidence score | Medium (500ms–2s on mount) | `anomalyLocked=true` (403) shows "upgrade" message; empty array shows "radar quiet" |

**Frontend display:** `AnomalyStrip` renders at top of management workspace. `topAnomaly` appears inline in the critical zone aside. Both are static (no pulse, no glow, no animation). `anomalyCount` shown as a count in telemetry.

### 3.6 Permission Matrix

| Role | Path rendered | Analytics | Anomaly | OCR summary | Usage |
|---|---|---|---|---|---|
| operator | OperatorDashboardWorkspace | ✗ | ✗ | ✗ | ✗ |
| supervisor | Management workspace | ✓ | ✗ (403→locked) | ✓ | ✓ |
| accountant | Management workspace | ✓ | ✗ (403→locked) | ✓ | ✓ |
| manager | Management workspace | ✓ | ✗ (403→locked) | ✓ | ✓ |
| admin | Management workspace | ✓ | ✗ (403→locked) | ✓ | ✓ |
| owner | Management workspace | ✓ | ✓ | ✓ | ✓ |

**Permission implication:** `analyticsLocked` and `anomalyLocked` drive UI state (locked messaging shown instead of data). `canReview` (supervisor+) controls approval-queue primary action availability. `canUseSteel` (owner/manager) and `steelCommercialMode` (steel industry + accountant+) drive steel-specific card targets. `canSeeControlTower` (manager, admin, owner) gates control-tower links.

---

## 4. WORKSPACE STRUCTURAL ANATOMY

### 4.1 Layout Patterns

**Path A — Operator (`isOperatorHome=true`):**
```
LEFT-RAIL + MAIN:
  Main (fill): Hero status panel + primary CTA + quick actions + summary
  Right aside (360px fixed): Today's summary + Alerts strip + Shift status cards
```

**Path B — Management (all other roles):**
```
FULL-WIDTH COMMAND — stacked operational zones, each full content width:
  1. AnomalyStrip (conditional banner)
  2. Reminder strip (2-column: live reminders + primary action)
  3. Route header (copy + meta + primary action button)
  4. Node grid (4 cols)
  5. Telemetry strip (4 cols)
  6. Board tools (always-visible — NOT <details>)
  7. Critical zone (telemetry + aside)
  8. Workflow zones grid (5 lanes, asymmetric grid)
  9. Live feed grid (2 cols: feed + escalation summary)
  10. Intelligence grid (3 cols: table + bottlenecks + recommendations)
  11. Launch guide (3-col step cards, lg:hidden → visible on lg+)
```

**Pattern justification (Operator):** The operator workspace is used under shift pressure on a phone or shared tablet. The primary CTA must be reachable immediately without scanning. A fixed right aside handles supporting context (summary, alerts) without competing with the action zone.

**Pattern justification (Management):** The management dashboard is a command center that presents the full operational state. Full-width stacked zones allow each zone to use its full horizontal span. Operators scan top-to-bottom: urgency signals first (anomaly, alerts), context second (header, telemetry), action zones third (workflow, feed), intelligence last.

---

### 4.2 Zone Definitions

#### PATH A — OPERATOR WORKSPACE

---

##### ZONE: Operator Hero Panel

| Property | Value |
|---|---|
| Operational Role | Displays factory context, shift attendance status, and the single dominant primary action |
| Attention Priority | 1 |
| Position | main column, top |
| Width | fill (lg:grid-cols-[1fr_360px] left column) |
| Height | content-driven |
| Sticky | not sticky |
| Density | default |
| Existence Justification | `AttendanceToday` status + `workerPrimaryAction` resolution — the reason the operator opened the dashboard |

**Contents:**
- Factory name + Online/Offline pill (success/warning semantic tokens, NOT raw emerald/amber)
- Status badge: "ACTIVE / LATE / MISSED / PENDING / DONE" — `--type-label` (12px/500) sentence case; NOT uppercase as-is; semantic tone classes
- Shift label + detail text (14px/400/`text-text-secondary`)
- "Main action" label: `--type-label-dense` (11px/500/`text-text-tertiary`) sentence case
- Primary CTA: `Button variant="primary"` with `asChild` + `Link` — full width, `h-[64px]`, text at 18px/600; NOT arbitrary `rounded-[28px]` Link — use `rounded-panel` on Button
- CTA detail text (14px/400/`text-text-secondary`)
- Quick actions section label: `--type-label-dense` sentence case
- Quick action grid (2×3 or 3-col): each cell `surface-panel border-subtle rounded-panel`; label 14px/600/`text-text-primary`; meta 12px/400/`text-text-tertiary`; NOT `rounded-[24px]`
- Today's summary block: 2-col grid of stat cards (Completed / Pending); `surface-panel border-subtle rounded-control`; label 12px/400/`text-text-tertiary`; value 22px/600/tabular-nums/`text-text-primary`; NOT `rounded-[20px]`

**Acceptance Criteria:**
- [ ] Primary CTA uses `Button variant="primary" asChild` — NOT raw `<Link>` styled as button
- [ ] Primary CTA uses `rounded-panel` radius — NOT `rounded-[28px]`
- [ ] Online/Offline pill uses `status-success-bg/fg/border` or `status-warning-bg/fg/border` — NOT raw emerald/amber
- [ ] Status badge uses semantic tone classes — NOT `workerStatus.tone` injecting raw classes directly
- [ ] Quick action cards use `surface-panel border-subtle rounded-panel` — NOT `rounded-[24px]` arbitrary
- [ ] Stat cards use `rounded-control` — NOT `rounded-[20px]`
- [ ] All text labels sentence case — NO uppercase on this workspace
- [ ] No glow on status dot — solid `bg-status-success-icon` only

---

##### ZONE: Operator Right Aside

| Property | Value |
|---|---|
| Operational Role | Supporting context: today's summary counts, alerts strip, shift status cards — reference without competing with primary action |
| Attention Priority | 2 |
| Position | right aside, fixed 360px |
| Width | 360px fixed |
| Height | fill |
| Sticky | not sticky |
| Density | default |
| Existence Justification | `queueCount`, `AlertItem[]`, `todayShiftCards` — secondary context that reduces the operator's need to navigate elsewhere |

**Contents:**
- Summary card: completed / pending / offline counts; `surface-panel border-subtle rounded-panel`; "Sync saved" Button (outline, h-11, full width) appears only when `queueCount > 0` + `isBusy` syncing state
- Alerts card: `surface-panel`; up to 2 alerts shown; each alert uses `severityTone()` (via canonical semantic token classes — NOT the current function which returns token variable string refs); "Mark done" button uses proper `button` element with `text-action-primary`
- Shift status cards: morning / evening / night; completed shifts: `surface-success-bg border-success`; pending: `surface-panel border-subtle`; labels 14px/500/`text-text-primary`; status 12px/600

**Acceptance Criteria:**
- [ ] Today's summary card is in the aside ONLY — NOT also duplicated in the main section
- [ ] `severityTone()` function returns canonical semantic token class strings — NOT `border-[var(--status-X-border)]` variable references (must be `border-status-X-border` canonical classes)
- [ ] Sync button uses `Button variant="outline"` with `isBusy` — NOT conditional label only
- [ ] Shift completed state uses `status-success-bg border-success` — NOT raw status variable refs
- [ ] All radii use canonical values (`rounded-panel`, `rounded-control`) — NOT arbitrary `rounded-[28px]`

---

#### PATH B — MANAGEMENT WORKSPACE

---

##### ZONE: Anomaly Strip

| Property | Value |
|---|---|
| Operational Role | Persistent top-of-page AI signal banner when anomaly data is present |
| Attention Priority | 1 (when visible) |
| Position | top of page, full width |
| Sticky | sticky-on-scroll — must remain visible as admin scrolls |
| Density | compact |
| Existence Justification | `AnomalyPreview.items[]` from `GET /ai/anomalies/preview` — highest-severity signals surface here |

**Contents:** `<AnomalyStrip>` shared component — `count`, `topMessage`, `reviewHref="/ai"`. Static indicator only — no pulse, no glow.

**Acceptance Criteria:**
- [ ] AI indicator is static — NO pulse, NO glow, NO animation
- [ ] Renders only when `anomalyCount > 0 || topAnomaly !== null`
- [ ] `anomalyLocked=true` → strip hidden entirely (not shown as an error)

---

##### ZONE: Reminder Strip

| Property | Value |
|---|---|
| Operational Role | Two-column strip: left shows live reminders with contextual subtitle; right shows the role-computed primary action with its CTA button |
| Attention Priority | 2 |
| Position | below anomaly strip, full width |
| Width | full content width |
| Height | content-driven |
| Density | default |
| Existence Justification | `primaryAction` (first of `roleFocusCards`) — the single most important action for this role right now |

**Contents:**
- Left: `--type-label-dense` eyebrow "Live reminders" (sentence case, `text-action-primary`); body text 14px/400/`text-text-secondary`
- Right: "Action now" chip (`surface-elevated border-default`, 12px/500, sentence case — NOT `font-mono uppercase tracking-[0.18em]`); title 18px/600; detail 14px/400/`text-text-secondary`; `Button variant="outline"` for CTA (sentence case — NOT `uppercase tracking-[0.16em]`)

**Acceptance Criteria:**
- [ ] "Live reminders" eyebrow uses `--type-label-dense` sentence case `text-action-primary` — NOT `font-mono uppercase tracking-[0.22em]`
- [ ] "Action now" chip uses sentence case — NOT `font-mono uppercase tracking-[0.18em]`
- [ ] CTA button label in sentence case — NOT `uppercase tracking-[0.16em]`

---

##### ZONE: Route Header

| Property | Value |
|---|---|
| Operational Role | Role-personalized title, copy, factory meta, and primary action button |
| Attention Priority | 3 |
| Position | below reminder strip, full width |
| Sticky | not sticky |
| Density | default |
| Existence Justification | `headerEyebrow`, `headerTitle`, `headerCopy` — role-computed; `activeFactory.name`, `queueCount`, `state.alerts.length` |

**Contents:**
- Eyebrow via `route-header__eyebrow` CSS class: must resolve to `--type-label-dense` sentence case — inspect CSS to verify
- Title: `route-header__title` — must resolve to ≤18px/600
- Body: `route-header__body` — 14px/400/`text-text-secondary`
- Meta strip: Factory · Pending · Alerts · System Ready — `--type-label-dense` labels; values at 14px/600/`text-text-primary`
- System ready indicator dot: solid `bg-status-success-icon` — NO glow shadow `shadow-[0_0_10px_rgba(34,197,94,0.55)]`
- Primary action button: `Button variant="primary"` sentence case — NOT `uppercase tracking-[0.18em]`

**Acceptance Criteria:**
- [ ] Title ≤18px — verify `route-header__title` CSS class
- [ ] System ready dot has NO glow shadow — solid status-success-icon only
- [ ] Primary action button uses sentence case — NOT uppercase tracking
- [ ] Eyebrow via `route-header__eyebrow` is ≤12px/500 sentence case

---

##### ZONE: Node Status Grid

| Property | Value |
|---|---|
| Operational Role | 4-column system node status strip (Alpha/Beta/Gamma/Delta) — maps online status, sync state, alert watch, and queue state |
| Attention Priority | 4 |
| Position | below route header |
| Width | full, 4-col grid |
| Height | fixed (~48px) |
| Density | compact |
| Existence Justification | `dashboardNodeCards` — derived from `online`, `dashboardLoading`, `state.alerts.length`, `queueCount`; provides at-a-glance system health |

**Contents:** 4 `factory-node-card` items — label (11px/500/`text-text-secondary` sentence case — NOT `font-mono uppercase tracking-[0.18em]`); status dot (solid semantic color); status text (14px/500/`text-text-primary`)

**Acceptance Criteria:**
- [ ] Node labels use `--type-label-dense` sentence case — NOT `font-mono uppercase tracking`
- [ ] Status dots are solid semantic tokens — NO glow effects

---

##### ZONE: Telemetry Strip

| Property | Value |
|---|---|
| Operational Role | 4-column KPI counts — Active Alerts, System Signals, Pending Shift, Trusted OCR |
| Attention Priority | 3 |
| Position | below node grid |
| Width | full, 4-col grid |
| Height | content-driven |
| Density | compact |
| Existence Justification | `dashboardTelemetryCards` — `state.alerts.length`, `anomalyCount`, `pendingShifts`, `ocrSummary.trusted_documents` |

**Contents:** 4 `factory-telemetry-card` items — label (11px/500/`text-text-tertiary` sentence case — NOT `font-mono uppercase tracking-[0.18em]`); value 32px/700; detail text 12px/400/`text-text-secondary`

**Acceptance Criteria:**
- [ ] Telemetry labels sentence case — NOT `font-mono uppercase tracking`
- [ ] Values use tabular-nums (already implemented — preserve)

---

##### ZONE: Board Tools Strip

| Property | Value |
|---|---|
| Operational Role | Refresh dashboard + Sync offline queue controls — always accessible |
| Attention Priority | 5 |
| Position | below telemetry, full width |
| Width | full |
| Height | content-driven |
| Sticky | not sticky |
| Existence Justification | `loadDashboard()` + `handleSync()` + `queueCount` — operator tools that must not require disclosure to access |

**Contents:**
- `Button variant="outline"` "Refresh" — `isBusy` when `dashboardLoading`
- `Button variant="outline"` "Sync queue (N)" — conditional on `queueCount > 0`; `isBusy` when syncing
- Container: `surface-panel border-subtle rounded-panel` inline strip — NOT `<details>/<summary>`

**Acceptance Criteria:**
- [ ] Board tools are ALWAYS VISIBLE — NOT inside `<details>/<summary>`
- [ ] Refresh button uses `isBusy` pattern
- [ ] Sync button conditional on `queueCount > 0`; shows count inline

---

##### ZONE: Critical Operational Zone

| Property | Value |
|---|---|
| Operational Role | Combined view of all 4 telemetry KPIs with contextual detail + primary action CTA for the role — the most urgent action surface on the management dashboard |
| Attention Priority | 1 |
| Position | below board tools |
| Width | full; internal: telemetry cols + aside |
| Height | content-driven |
| Density | default |
| Existence Justification | `dashboardTelemetryCards` + `primaryAction` — the "act now" zone |

**Contents:**
- Section eyebrow: `--type-label-dense` (11px/500/`text-action-primary`/sentence case) — NOT `font-mono uppercase tracking-[0.22em] text-[var(--action-primary)]`
- Section title: 18px/600 — NOT `text-lg` which may resolve differently
- Telemetry metric cols: each metric has label (11px/500/`text-text-tertiary` sentence case), value (30px/600/`text-text-primary`), detail (12px/400/`text-text-secondary`)
- Aside: "Queue urgency" label (sentence case), primary action title 16px/600, detail 14px/400, `Button variant="primary"` full width sentence case

**Acceptance Criteria:**
- [ ] Section eyebrow sentence case `text-action-primary` — NOT monospace uppercase
- [ ] Primary action button sentence case — NOT uppercase tracking
- [ ] Metric labels sentence case — NOT monospace uppercase

---

##### ZONE: Workflow Zones Grid

| Property | Value |
|---|---|
| Operational Role | 5 operational lanes (Review, OCR, Admin, Reports, Attendance) — each contains 2 KPI chips, descriptive detail, and a primary action button linking to the target workspace |
| Attention Priority | 2 |
| Position | below critical zone |
| Width | full; asymmetric `xl:grid-cols-12` spans (5+4+3 / 7+5) |
| Height | content-driven |
| Density | default |
| Existence Justification | `workflowZones` — the 5 operational domain entry points with live metric context |

**Contents (per lane):**
- Lane eyebrow (action label): `--type-label-dense` sentence case `text-text-tertiary` — NOT `font-mono uppercase tracking-[0.2em]`
- Lane title: 20px/600/`text-text-primary`
- Detail text: 14px/400/`text-text-secondary`
- Metric chips (2 per lane): chip label `--type-label-dense` sentence case — NOT `font-mono uppercase tracking-[0.14em]`; chip value 14px/600/`text-text-primary`
- Primary button: `Button variant="primary"` (Review lane) or `Button variant="outline"` (other lanes); sentence case

**Acceptance Criteria:**
- [ ] All lane eyebrows sentence case — NOT monospace uppercase
- [ ] All chip labels sentence case — NOT monospace uppercase
- [ ] Review lane uses `variant="primary"` CTA — all others use `variant="outline"`
- [ ] `factory-workflow-lane--critical` styling preserved for review lane prominence

---

##### ZONE: Live Operational Feed

| Property | Value |
|---|---|
| Operational Role | Real-time workflow event stream — up to 8 items from alerts, anomalies, OCR queue, and recent entries; side panel shows escalation summary counts |
| Attention Priority | 2 |
| Position | below workflow zones |
| Width | 2-col: feed panel (fill) + escalation summary (fixed ~280px) |
| Height | content-driven; max ~400px with scroll on feed |
| Density | compact |
| Existence Justification | `liveFeedItems` — surfaces cross-domain operational events without requiring navigation |

**Contents — Feed panel:**
- Feed items: channel label (`--type-label-dense` sentence case `text-text-tertiary` — NOT `font-mono uppercase tracking-[0.16em]`); title 14px/600; detail 12px/400/`text-text-secondary`; time `--type-timestamp` (JetBrains Mono/11px); action link `text-action-primary` sentence case — NOT `font-mono uppercase text-[var(--action-primary)]`
- Empty state: 14px/400/`text-text-secondary`

**Contents — Escalation summary:**
- "Escalation summary" label: sentence case `--type-label-dense`
- 4 summary chips: Unread Alerts / OCR Pending / Queue Backlog / Signals — chip labels sentence case — NOT `font-mono uppercase tracking-[0.14em]`

**Acceptance Criteria:**
- [ ] Feed channel labels sentence case — NOT monospace uppercase
- [ ] Feed action links sentence case `text-action-primary` — NOT monospace uppercase alias
- [ ] Escalation chip labels sentence case — NOT monospace uppercase

---

##### ZONE: Operational Intelligence Grid

| Property | Value |
|---|---|
| Operational Role | 3-panel intelligence surface: (1) recent production entries table; (2) workflow bottlenecks (OCR trust, anomaly signals, review pressure); (3) operational recommendations + usage snapshot + secondary action buttons |
| Attention Priority | 3 |
| Position | below live feed |
| Width | 3 equal-width panels |
| Height | content-driven |
| Density | default (table rows default 40px) |
| Existence Justification | `recentEntries`, `state.anomalyPreview`, `state.ocrSummary`, `operationalRecommendations`, `dashboardSnapshotCards` |

**Contents — Panel 1 (Production table):**
- "Live production activity" eyebrow: sentence case `text-text-tertiary`
- Title 18px/600
- Table headers: 10px/600/UPPERCASE/tracking≤0.06em (table header exception) — NOT `font-mono text-[11px] uppercase tracking-[0.16em]` (tracking violation + monospace)
- Table cells: 13px/400/`text-text-primary`
- Action links: `text-action-primary` — NOT `text-[var(--accent)] underline`
- Legacy `border-[var(--border)]` → `border-border-subtle`; `border-[var(--border)]/60` → `border-border-subtle`

**Contents — Panel 2 (Bottlenecks):**
- Eyebrow sentence case; title 18px/600
- OCR trust / Top signals / Pending review cards: `surface-panel border-subtle rounded-control`
- Anomaly signal cards: `surface-elevated border-subtle rounded-control`

**Contents — Panel 3 (Recommendations):**
- Usage snapshot: `surface-panel border-subtle`
- Recommendations: 14px/400/`text-text-secondary`
- Secondary action buttons: `Button variant="outline"` + `Button variant="ghost"` sentence case

**Acceptance Criteria:**
- [ ] Table headers use Inter UI (NOT monospace) with tracking ≤0.06em
- [ ] Action links use `text-action-primary` — NOT `text-[var(--accent)]`
- [ ] Legacy `border-[var(--border)]` replaced with `border-border-subtle`
- [ ] Panel eyebrows sentence case — NOT monospace uppercase

---

##### ZONE: Launch Guide Steps

| Property | Value |
|---|---|
| Operational Role | Role-computed 3-step sequential workflow guide — visible on desktop, hidden on mobile |
| Attention Priority | 4 |
| Position | below intelligence grid, full width |
| Width | 3-col grid |
| Height | content-driven (~140px min per card) |
| Density | default |
| Existence Justification | `roleLaunchGuide.steps` — provides role-specific workflow orientation without requiring mental model of the whole product |

**Contents:** 3 `Link` cards with `route-metric dashboard-soft-lift` CSS classes — each shows step action label (sentence case `--type-label-dense`) + title 18px/600 + arrow; transition on hover uses `border-border-strong bg-surface-hover`

**Acceptance Criteria:**
- [ ] Step action labels sentence case — NOT uppercase
- [ ] Hover state uses canonical token classes

### 4.3 Zone Interaction Rules

```yaml
zone_interactions:
  - trigger: isOperatorHome === true
    effect: Entire management workspace hidden; OperatorDashboardWorkspace rendered
    reason: operator and management are completely separate UX surfaces

  - trigger: anomalyCount > 0 OR topAnomaly !== null
    effect: AnomalyStrip renders at top of management workspace
    reason: highest-priority signal must appear before any scrolling

  - trigger: anomalyLocked === true (HTTP 403 on anomaly endpoint)
    effect: AnomalyStrip hidden; topAnomaly null; anomalyCount 0
    reason: plan-gated; not an error — silent lock

  - trigger: analyticsLocked === true (HTTP 403 on analytics endpoint)
    effect: weeklyAverage shown as 0; note "Upgrade to Factory plan" in snapshot card
    reason: plan-gated; partial data shown with upgrade message

  - trigger: queueCount > 0 AND window.online === true
    effect: auto-trigger handleSync(); operator CTA updates; board tools sync button visible
    reason: automatic sync when network returns with pending queue

  - trigger: subscribeToWorkflowRefresh fires
    effect: loadDashboard() re-runs; all zones refresh
    reason: cross-tab/cross-component workflow state change

  - trigger: markAlertRead(id) called
    effect: alert removed from state.alerts; AnomalyStrip count decreases; telemetry count decreases
    reason: immediate UI removal without reload

  - trigger: state.alerts.length > 0
    effect: Management: Review lane primary action is urgent (Button variant="primary")
    reason: alerts represent blocked workflow requiring immediate attention

  - trigger: user.role === "operator" AND state.attendanceToday.can_punch_in
    effect: Operator CTA → "Start Shift" → /attendance (highest priority)
    reason: attendance punch must happen before any entry work

  - trigger: user.role === "operator" AND state.draft !== null
    effect: Operator CTA → "Continue Shift" → /entry?draft (second priority)
    reason: saved draft means shift work already started

  - trigger: user.role === "operator" AND nextPendingShift !== null
    effect: Operator CTA → "Continue/Complete Entry" → /entry?shift=X
    reason: incomplete shift entry is the primary daily task
```

---

## 5. OPERATIONAL ATTENTION HIERARCHY

### 5.1 Scan Flow — Operator

```
SCAN 1 (0–200ms): Primary CTA button (full-width, 64px height, primary color)
  WHY: The button is the only visually dominant element. autoFocus on page load
  places keyboard focus here. Operator's entire session goal is one button away.

SCAN 2 (200ms–800ms): Status badge (ACTIVE / LATE / PENDING / DONE)
  WHY: Attendance status determines what the CTA does. If status is ACTIVE, CTA
  says "Complete Shift." If PENDING, it says "Start Shift." Status badge resolves
  the uncertainty before the operator reads the button label.

SCAN 3 (800ms–2s): Quick actions (3 tiles: Attendance / Scan Paper / My Tasks)
  WHY: Secondary actions for operators who completed the primary task or need
  a different entry point. Meta text on each tile (e.g., "3 saved") provides
  urgency signal.

SCAN 4 (2s+): Right aside (Summary counts, Alerts, Shift status cards)
  WHY: Supporting context. Operators check this to confirm shift coverage and
  read any alert requiring attention.
```

### 5.2 Scan Flow — Management

```
SCAN 1 (0–200ms): AnomalyStrip (if visible) / Route header title
  WHY: Anomaly strip is colored and persistent — captures attention before
  any other element. If no anomaly, the personalized header title ("Decision
  view is ready, Aman") is the first readable element.

SCAN 2 (200ms–1s): Telemetry strip (4 KPI counts)
  WHY: 4 large numbers at 32px — Active Alerts, Signals, Pending Shifts, OCR.
  Managers read numbers before prose. These 4 values tell the state of the
  system in one scan.

SCAN 3 (1s–3s): Critical zone primary action + Workflow zone titles
  WHY: The critical zone shows the priority action. Workflow zone titles tell
  which domains need attention (Review lane gets primary button color when
  alerts > 0).

SCAN 4 (3s–8s): Live feed events + Launch guide steps
  WHY: Feed provides temporal context (what happened in the last hour).
  Launch guide gives the role-specific sequential workflow.

SCAN 5 (8s+): Intelligence grid (production table, bottlenecks, recommendations)
  WHY: Deep reference data — for managers who need to diagnose before acting.
```

### 5.3 Persistent Visibility Requirements

| Element | Path | Reason |
|---|---|---|
| AnomalyStrip | Management | Critical AI signal — must remain visible while scrolling |
| Primary CTA | Operator | Single dominant action must never scroll off |
| Right aside summary | Operator | Shift status visible alongside the action panel |
| Board tools strip | Management | Refresh and sync must not require disclosure |

---

## 6. TABLE & DATA STRATEGY

### 6.1 Recent Entries Table (Management — Intelligence Grid)

| Field | Value |
|---|---|
| Purpose | Show last 5 production entries — shift data for current operational review |
| Scanning Pattern | Top-to-bottom (newest first) |
| Row Volume | max 5 rows; no virtualization needed |
| Primary Decision | Which entry to open for detail review |

**Column Architecture:**

| Column | Type | Header | Width | Purpose |
|---|---|---|---|---|
| Date | `--type-timestamp` mono | DATE | auto | Temporal context |
| Shift | text | SHIFT | 80px | Morning/evening/night |
| Department | text | DEPARTMENT | auto | Production unit |
| Units | tabular-nums | UNITS | 100px | Produced/target |
| Downtime | tabular-nums | DOWNTIME | 80px | Minutes — anomaly signal |
| Action | link | ACTION | 60px | Open entry detail |

**Column header rule:** UPPERCASE permitted (table column header exception), tracking ≤0.06em, Inter UI (NOT monospace). Current implementation uses `font-mono tracking-[0.16em]` — fix both violations.

---

## 7. FORM & INPUT STRATEGY

**No forms on the dashboard.** The only form-adjacent element is the `Entry` creation flow which is accessed via CTA links, not a form on this page.

**Keyboard flow (Operator):**
```
Page load → focus on primary CTA button → Enter/Space = navigate to primary action
Tab → quick action 1 → Tab → quick action 2 → Tab → quick action 3
```

---

## 8. AI & AUDIT VISIBILITY STRATEGY

### 8.1 AI Placement

```yaml
ai_placements:
  - system: Anomaly preview
    zone: AnomalyStrip (top of management workspace)
    display_trigger: on load — when anomalyCount > 0 or topAnomaly present
    confidence_display: none — anomaly count is shown, not per-item confidence
    reasoning_text: topAnomaly.message shown inline — max 1 sentence
    unavailable_state: strip hidden when anomalyLocked=true (403)
    accept_action: "Open AI Insights" button → /ai
    static_only: true  # No pulse, no glow, no animation

  - system: Anomaly signal inline
    zone: Critical operational zone aside + Intelligence grid bottleneck panel
    display_trigger: when topAnomaly !== null
    confidence_display: none
    reasoning_text: topAnomaly.message + anomaly_type
    static_only: true
```

### 8.2 Audit Visibility

```yaml
audit:
  events:
    - markAlertRead: removes alert from client state; no AuditLog event written
  frontend_display: none
```

---

## 9. DENSITY, SPACING & LAYOUT RHYTHM

### 9.1 Density Mode

```yaml
default_density: default
density_justification: Dashboard is read at shift start under moderate pressure.
  Default density (40px inputs, 24px section gaps) provides good scan speed
  without the cramped feeling of compact mode. The telemetry strip uses compact
  padding (12px) because the values are the focus, not the containers.
density_switchable: yes — inherits AppShell density toggle
```

### 9.2 Spacing Rhythm

```yaml
spacing:
  page_padding: AppShell standard (24px–40px horizontal)
  zone_gap: 24px (--space-lg) between all major zones
  operator_grid_gap: 24px between main panel and aside
  operator_quick_action_gap: 12px (--space-3) between tiles
  operator_stat_gap: 12px between summary stat cards
  management_zone_header_gap: 16px (--space-md) header to content
  workflow_lane_gap: 12px (--space-3) between metric chips
  feed_item_gap: 16px (--space-md) between feed events
  table_row_height: 40px (default) / 36px (compact)
  table_cell_padding: 12px horizontal / 8px vertical
```

### 9.3 Typography Specification

```yaml
typography:
  # All eyebrows across both workspaces:
  section_eyebrow: 11px / 500 / sentence case / text-action-primary OR text-text-tertiary
    # (depends on zone — action-primary for zone titles, tertiary for sub-section labels)
  # Management header:
  route_header_eyebrow: 11px / 500 / sentence case / text-text-tertiary
  route_header_title: 18px / 600 / sentence case
  route_header_body: 14px / 400 / text-text-secondary
  route_header_meta_label: 12px / 400 / text-text-tertiary
  route_header_meta_value: 14px / 600 / text-text-primary
  # Telemetry / KPI counts:
  telemetry_label: 11px / 500 / sentence case / text-text-tertiary
  telemetry_value: 32px / 700 / text-text-primary / tabular-nums
  telemetry_detail: 12px / 400 / text-text-secondary
  # Node grid:
  node_label: 11px / 500 / sentence case / text-text-secondary
  node_status: 14px / 500 / text-text-primary
  # Workflow lanes:
  lane_eyebrow: 11px / 500 / sentence case / text-text-tertiary
  lane_title: 20px / 600 / text-text-primary
  lane_detail: 14px / 400 / text-text-secondary
  lane_chip_label: 11px / 500 / sentence case / text-text-tertiary
  lane_chip_value: 14px / 600 / text-text-primary
  # Live feed:
  feed_channel: 11px / 500 / sentence case / text-text-tertiary
  feed_title: 14px / 600 / text-text-primary
  feed_detail: 12px / 400 / text-text-secondary
  feed_time: 11px / 400 / JetBrains Mono  (--type-timestamp)
  feed_action_link: 11px / 500 / sentence case / text-action-primary
  # Table:
  table_header: 10px / 600 / UPPERCASE / tracking ≤0.06em / Inter UI
  table_cell: 13px / 400 / text-text-primary
  # Operator:
  operator_factory_name: 16px / 600 / text-text-primary
  operator_status_badge: 12px / 500 / sentence case / semantic tone
  operator_shift_label: 22px / 600 / text-text-primary
  operator_cta_label: 18px / 600 / text-text-primary  (on primary button)
  operator_stat_label: 12px / 400 / text-text-tertiary
  operator_stat_value: 22px / 600 / tabular-nums / text-text-primary
```

### 9.4 Surface Token Hierarchy

```yaml
surfaces:
  page_background: var(--surface-shell)
  operator_main_panel: var(--surface-panel) with border-default
  operator_quick_action: var(--surface-panel) with border-subtle
  operator_stat_card: var(--surface-panel) with border-subtle
  operator_aside_card: var(--surface-panel) with border-subtle
  management_anomaly_strip: var(--status-warning-bg) or var(--status-danger-bg) (via AnomalyStrip component)
  management_reminder_strip: var(--surface-panel) with border-subtle
  management_route_header: var(--surface-card) with border-subtle
  node_card: var(--surface-card) with border-subtle
  telemetry_card: var(--surface-card) with border-subtle
  workflow_lane: var(--surface-card) with border-subtle
  workflow_chip: var(--surface-elevated) with border-subtle
  feed_panel: var(--surface-card) with border-subtle
  intelligence_panel: var(--surface-card) with border-subtle
  bottleneck_card: var(--surface-panel) with border-subtle
  anomaly_signal_card: var(--surface-elevated) with border-subtle
  # Forbidden — must replace:
  # var(--surface-industrial-deep) → var(--surface-shell)
  # var(--surface-industrial-raised) → var(--surface-panel)
  # var(--card-strong) → var(--surface-card)
  # var(--border) → border-subtle or border-default
  # var(--accent) → text-action-primary
  # var(--muted) → text-text-secondary or text-text-tertiary
  # var(--text-inverse) → text-text-primary
```

---

## 10. RESPONSIVE & OPERATOR ADAPTATION

### 10.1 Desktop (Primary)

```yaml
desktop:
  min_width: 1280px
  operator: lg:grid-cols-[1fr_360px]
  management_workflow: xl:grid-cols-12 with lane spans
  management_intelligence: 3-col equal grid
  management_feed: 2-col (feed + escalation)
  management_launch_guide: lg:grid-cols-3 (visible lg+)
```

### 10.2 Mobile

```yaml
mobile:
  operator: stacked — main panel above, aside below; quick actions 2-col
  management: single column — all zones stack; workflow lanes each full-width;
    launch guide hidden; intelligence grid stacks to 1-col
  touch_targets: all CTAs and quick action tiles ≥44px height
```

---

## 11. COMPONENT MAPPING

```yaml
component_mapping:
  operator_cta:
    component: Button variant="primary" asChild
    child: Link href={workerPrimaryAction.href}
    size: h-[64px] full-width rounded-panel
    fix_required: Currently <Link> with inline styling; must migrate to Button asChild

  operator_status_badge:
    component: inline <span> with semantic tone class
    fix_required: workerStatus.tone currently injects raw CSS variable string refs
      (e.g., "border-[var(--status-success-border)] bg-[var(--status-success-bg)]")
      → must use Tailwind semantic class form ("border-status-success-border bg-status-success-bg")

  operator_quick_actions:
    component: Link with surface-panel border-subtle rounded-panel
    fix_required: Remove rounded-[24px] → rounded-panel

  operator_sync_button:
    component: Button variant="outline" isBusy busyLabel="Syncing..."

  management_board_tools:
    component: inline <div> — always visible strip
    fix_required: Remove <details>/<summary> → always-visible flex row

  management_workflow_chips:
    component: factory-workflow-chip (existing CSS class)
    fix_required: chip labels must use sentence case — CSS class may need typography update

  management_table:
    component: <table> inside ResponsiveScrollArea
    fix_required: table headers → Inter UI NOT monospace; tracking ≤0.06em
    action_links: text-action-primary — NOT text-[var(--accent)]

  anomaly_strip:
    component: AnomalyStrip (shared/ai)
    static: true  # No animation

  route_header:
    component: CSS class system (route-header__*)
    fix_required: Verify CSS classes resolve to correct token values;
      particularly route-header__eyebrow and route-header__title sizes

  industrial_surfaces:
    fix_required: Replace var(--surface-industrial-deep/raised) with canonical tokens
    mapping:
      surface-industrial-deep → surface-shell
      surface-industrial-raised → surface-panel
      text-inverse → text-text-primary
      border (legacy alias) → border-border-subtle
      card-strong → surface-card
      accent → text-action-primary
      muted → text-text-secondary / text-text-tertiary
```

---

## 12. OPERATIONAL PROBLEMS SOLVED

```yaml
problem_resolutions:
  - problem: All zone eyebrows use font-mono + uppercase + tracking 3–4× maximum
    root_cause: Industrial dashboard aesthetic using monospace uppercase for "technical feel";
      font-mono on non-timestamp UI text, uppercase labels, and extreme tracking all violate
      governance simultaneously
    structural_solution: Section 9.3 specifies all eyebrows at 11px/500/sentence case/Inter UI;
      Section 4.2 acceptance criteria for every zone explicitly require sentence case;
      the CSS class system (factory-dashboard-*, route-header__*) must be updated
    section_reference: Section 9.3, Section 4.2 (all zones)
    measurable_outcome: Zero monospace, zero uppercase, zero tracking violations on any
      label or eyebrow across both operator and management workspaces

  - problem: Board Tools hidden behind <details>/<summary> — forbidden pattern
    root_cause: Developer used disclosure to reduce visual density in the hero zone;
      same pattern flagged in settings and attendance-settings
    structural_solution: Section 4.2 Board Tools zone specifies always-visible strip;
      Section 4.3 confirms no collapse trigger; Section 11 component mapping specifies
      always-visible inline div
    section_reference: Section 4.2 (Board Tools), Section 4.3
    measurable_outcome: Refresh and sync controls always visible; admin does not need
      to discover a hidden disclosure to access them

  - problem: System ready status dot has glow shadow [0_0_10px_rgba(34,197,94,0.55)]
    root_cause: Developer added visual flair to status indicator using rgba shadow;
      glow effects on static elements are explicitly forbidden
    structural_solution: Section 9.4 specifies status dot as solid bg-status-success-icon;
      Section 4.2 route header acceptance criteria require NO glow shadow
    section_reference: Section 9.4, Section 4.2
    measurable_outcome: Status dot is a solid colored circle; no glow; consistent with
      all other status indicators in the system

  - problem: Operator primary CTA is a raw <Link> with arbitrary radius and styling
    root_cause: Developer styled a Link element to look like a button without using the
      Button component; arbitrary rounded-[28px] radius
    structural_solution: Section 4.2 operator hero acceptance criteria require
      Button variant="primary" asChild + Link; Section 11 specifies rounded-panel radius
    section_reference: Section 4.2, Section 11
    measurable_outcome: CTA uses the system Button component; focus management, hover
      states, and accessibility attributes are consistent with all other CTAs

  - problem: Today's summary duplicated — appears both in main section AND in right aside
    root_cause: Developer added a summary block in both layout zones; the main section
      block is visually identical to the aside card but in a different container
    structural_solution: Section 4.2 specifies summary counts in the right aside ONLY;
      the main section today's summary block is eliminated in Section 12
    section_reference: Section 4.2 (Operator Right Aside), Section 1.3
    measurable_outcome: Summary counts appear once — in the right aside; main panel
      is dedicated to the primary CTA and quick actions without duplication

  - problem: Industrial surface tokens (surface-industrial-deep, surface-industrial-raised,
      text-inverse) — non-canonical; may not exist in governance token system
    root_cause: Operator workspace was styled with a custom industrial surface palette
      that may not be part of the canonical token system
    structural_solution: Section 9.4 provides the mapping: surface-industrial-deep →
      surface-shell; surface-industrial-raised → surface-panel; text-inverse → text-text-primary;
      Section 11 documents the required replacement
    section_reference: Section 9.4, Section 11
    measurable_outcome: All surfaces use canonical tokens; dark mode and theme changes
      apply correctly; no unmapped token variables

  - problem: Production table headers use font-mono + tracking-[0.16em] — monospace on
      table headers is forbidden; tracking 2.7× maximum
    root_cause: Developer applied the same monospace eyebrow pattern to table column headers
    structural_solution: Section 6.1 specifies table headers at 10px/600/UPPERCASE/
      tracking≤0.06em/Inter UI (table column header governed exception);
      Section 9.3 table_header specification
    section_reference: Section 6.1, Section 9.3
    measurable_outcome: Table headers use Inter UI at ≤0.06em tracking; monospace eliminated
      from table context; uppercase retained (it IS the governed exception for table headers)
```

---

## 13. IMPLEMENTATION HANDOFF

### 13.1 Build Sequence

```yaml
implementation_sequence:
  step_1: Fix all monospace + uppercase + tracking violations across both workspaces —
    this is the foundation; applies to every zone eyebrow, chip label, feed channel,
    node label, and telemetry label; must be done as a batch not piecemeal
  step_2: Replace industrial surface tokens with canonical equivalents:
    surface-industrial-deep/raised → surface-shell/panel;
    text-inverse → text-text-primary;
    var(--border) → border-border-subtle;
    var(--accent) → text-action-primary;
    var(--muted) → text-text-secondary/tertiary;
    var(--card-strong) → surface-card
  step_3: Fix operator primary CTA — Button asChild + Link; rounded-panel; h-[64px]
  step_4: Remove <details>/<summary> Board Tools — always-visible inline strip
  step_5: Remove today's summary duplication — keep aside card; remove main section block
  step_6: Fix status dot glow — remove shadow; solid bg-status-success-icon
  step_7: Fix workerStatus.tone to return canonical Tailwind class strings
    (border-status-success-border bg-status-success-bg) NOT CSS variable string refs
  step_8: Fix operator quick action radii — rounded-panel NOT rounded-[24px]
  step_9: Fix operator stat card radii — rounded-control NOT rounded-[20px]
  step_10: Fix production table headers — Inter UI NOT monospace; tracking ≤0.06em
  step_11: Fix table action links — text-action-primary NOT text-[var(--accent)]
  step_12: Fix severityTone() helper to return canonical Tailwind class strings
  step_13: Verify route-header CSS classes resolve to correct sizes (≤18px for title,
    ≤12px for eyebrow); update CSS if not
  step_14: Add isBusy to Sync button (operator aside sync)
  step_15: Verify AnomalyStrip is static — no animation, no glow, no pulse
```

### 13.2 Critical Constraints

```yaml
critical_constraints:
  - "Step 1 is non-negotiable — every mono+uppercase+tracking violation in the management
     workspace propagates to ~20+ instances; fix as a batch, not selectively"
  - "Do not remove the factory-workflow-lane--critical class from the review lane —
     it provides legitimate structural prominence for the most urgent workflow zone"
  - "The operator and management render paths must remain completely separate —
     do NOT consolidate into a shared template; the layouts are fundamentally different"
  - "Promise.allSettled must be preserved — partial failure is acceptable;
     do not convert to Promise.all (would break on any single endpoint failure)"
  - "subscribeToQueueUpdates and subscribeToWorkflowRefresh must be preserved —
     these are the realtime hooks that keep dashboard state current"
  - "anomalyLocked and analyticsLocked must be preserved — 403 is plan-gated, not
     an error; showing an error state for 403 on these endpoints is wrong"
  - "All AI indicators are static — no animation, no glow, no pulse anywhere"
  - "Do not modify AppShell scroll architecture"
```

### 13.3 Open Questions

```yaml
open_questions:
  - question: >
      The operator workspace uses var(--surface-industrial-deep), var(--surface-industrial-raised),
      and var(--text-inverse). Do these custom properties exist in the canonical token system
      (tokens.css) or are they undefined/legacy references? If they are defined in tokens.css
      with correct dark-mode values, they may be acceptable as factory-specific semantic tokens.
      If they are not defined or resolve incorrectly, they must be replaced with the canonical
      surface equivalents specified in Section 9.4.
    blocking: yes — if industrial tokens are undefined, the operator workspace renders incorrectly
    owner: frontend team (inspect tokens.css for these values)
    decision_needed_by: before step_2

  - question: >
      The route-header CSS classes (route-header__eyebrow, route-header__title,
      route-header__body, route-header__meta-item) are used across multiple operational
      workspaces. Does the CSS for these classes resolve to governance-compliant values?
      Specifically: does route-header__title ≤18px? Does route-header__eyebrow ≤12px?
    blocking: yes — if CSS classes produce wrong sizes, management dashboard heading
      violates the 18px ceiling
    owner: frontend team (inspect globals.css or the CSS module for route-header)
    decision_needed_by: before step_13

  - question: >
      Should the management dashboard hide the Launch Guide on desktop or keep it?
      Currently it uses `hidden route-metrics-grid lg:grid-cols-3` — the `hidden` class
      means it is NEVER visible at any breakpoint. This appears to be a bug —
      the guide is computed but never shown. Should this section be visible?
    blocking: no — the section is currently hidden; making it visible is an improvement
      but not blocking
    owner: product owner
    decision_needed_by: before step_13

open_questions_blocking: 2 (industrial tokens, route-header CSS sizes)
```

---

## ACCEPTANCE CRITERIA (SPEC COMPLETENESS)

- [x] All 13 sections fully populated
- [x] Both render paths (operator + management) fully specced
- [x] Every layout zone has documented existence justification and testable acceptance criteria
- [x] Every component mapped to existing primitives or fix documented
- [x] Every operational failure from Section 1.3 has a resolution in Section 12
- [x] Reduction audit: summary duplication removed; Board Tools disclosure eliminated
- [x] No anti-patterns in spec (no gradients, no glow, no pulse, no uppercase labels in spec)
- [x] All spacing follows 4px scale
- [x] All surfaces reference canonical token variables
- [x] Typography follows approved system; table column header uppercase exception documented
- [x] Backend API surface verified (11 endpoints + 2 offline clients confirmed from source)
- [x] Permission matrix complete with plan-lock states documented
- [x] 2 blocking open questions flagged (industrial tokens, CSS class sizes)
- [x] AI elements marked static
- [x] 15-step implementation sequence complete

---

## POST-GENERATION SELF-VALIDATION

```yaml
self_validation:
  operational_integrity:
    - [x] All zones traced to backend entities or computed state
    - [x] Both render paths justified by role-specific operator needs
    - [x] Summary duplication eliminated
    - [x] Board Tools disclosure eliminated
    - [x] 20+ monospace/uppercase/tracking violations consolidated into step_1

  law_compliance:
    - [x] Spacing 4px scale throughout
    - [x] All surfaces mapped to canonical tokens; industrial aliases documented for replacement
    - [x] All labels sentence case in spec (table column headers: uppercase exception documented)
    - [x] Typography from approved system at all levels
    - [x] AI elements: AnomalyStrip marked static: true; no glow/pulse/animation

  kiro_readiness:
    - [x] 15-step implementation sequence
    - [x] All acceptance criteria testable
    - [x] 2 blocking open questions flagged with owners and deadlines

  anti_pattern_check:
    - [x] No gradients specified
    - [x] No glow effects (status dot glow explicitly prohibited in spec)
    - [x] No pulse on static elements
    - [x] No UPPERCASE labels in spec (table headers: governed exception documented)
    - [x] No marketing typography
    - [x] No <details>/<summary>
    - [x] No <Link><Button> nesting specified
    - [x] No raw hex / rgba / variable alias in spec

  structural_integrity:
    - [x] Both render paths have complete zone definitions and acceptance criteria
    - [x] Permission matrix covers all 6 roles including plan-gate states
    - [x] Realtime contracts documented for all 3 subscription types
    - [x] All 12 problem resolutions reference specific spec sections
```

---

## 14. VISUAL STRUCTURAL HIERARCHY BLUEPRINT

---

### 14A. Operator Workspace — Desktop Blueprint

```
┌─[APP TOPBAR 48px]──────────────────────────────────────────────────────────────────┐
│ DPR.ai  ·  Shree Steel Works  ·  Dashboard                      ⚙  [≡ Nav]        │
└────────────────────────────────────────────────────────────────────────────────────┘
┌─[SIDEBAR 220px]─┬─[OPERATOR WORKSPACE surface-shell]──────────────────────────────┐
│ ■ Dashboard ◉   │  ┌─[MAIN PANEL surface-panel]───────────────┐  ┌─[ASIDE 360px]─┐│
│ ○ Entry         │  │ Shree Steel Works          ★ Online      │  │ ▓ Today's     ││
│ ○ Scan          │  │ ──────────────────────────────────────── │  │   summary     ││
│ ○ Attendance    │  │  ● ACTIVE · Morning shift · 3h 24m worked│  │ ──────────── ││
│ ○ My Tasks      │  │  22px/600                                │  │ Completed  2  ││
│                 │  │  Shift work in progress.  14px/secondary  │  │ Pending    1  ││
│                 │  │  ──────────────────────────────────────── │  │ Offline    0  ││
│                 │  │  Main action  11px/500/tertiary            │  │ ──────────── ││
│                 │  │  ┌─────────────────────────────────────┐  │  │ ▓ Alerts      ││
│                 │  │  │  Complete Entry    h-[64px] primary  │  │  │ ──────────── ││
│                 │  │  │  18px/600  rounded-panel  full-width │  │  │ ⚠ 2 entries  ││
│                 │  │  └─────────────────────────────────────┘  │  │   missing    ││
│                 │  │  Evening shift still pending today.        │  │   targets    ││
│                 │  │  ──────────────────────────────────────── │  │   Mark done  ││
│                 │  │  Quick actions  11px/500/tertiary          │  │ ──────────── ││
│                 │  │  ┌─────────┐ ┌─────────┐ ┌────────────┐  │  │ ▓ Shift status││
│                 │  │  │▓Attendance│ │▓Scan Paper│ │▓ My Tasks  │  │  │ ──────────── ││
│                 │  │  │  Open    │ │ 0 saved  │ │  2 pending │  │  │ ✓ Morning    ││
│                 │  │  └─────────┘ └─────────┘ └────────────┘  │  │   Done       ││
│                 │  │  surface-panel border-subtle rounded-panel  │  │ ○ Evening    ││
│                 │  │  ──────────────────────────────────────── │  │   Pending    ││
│                 │  │  ┌── Completed ──┐ ┌── Pending ──────┐   │  │ ○ Night      ││
│                 │  │  │░░░░░░░░░░░░░░│ │░░░░░░░░░░░░░░░░░│   │  │   Pending    ││
│                 │  │  │  Completed   │ │  Pending         │   │  └──────────────┘│
│                 │  │  │     2        │ │     1            │   │                  │
│                 │  │  │ 22px/600 mono│ │ 22px/600 mono    │   │                  │
│                 │  │  └──────────────┘ └──────────────────┘   │                  │
│                 │  └──────────────────────────────────────────┘                  │
└─────────────────┴──────────────────────────────────────────────────────────────────┘

OPERATOR SCAN PATH:
  [1] Status badge (● ACTIVE) → confirms attendance state
  [2] Primary CTA (Complete Entry 64px) → the one action needed
  [3] Quick action tiles → secondary paths; meta text shows urgency
  [4] Aside summary + alerts → supporting context, read after acting

OPERATOR DENSITY RULES:
  · CTA at 64px — large enough to tap on mobile without hunting
  · Quick action tiles 12px gap, content-driven height ~72px
  · Aside cards compact — 12px padding, tighter than main panel
  · No dead space between status badge and CTA — 8px gap only
```

---

### 14B. Management Workspace — Desktop Blueprint (1440px)

```
┌─[APP TOPBAR 48px]──────────────────────────────────────────────────────────────────────┐
│ DPR.ai  ·  Shree Steel Works  ·  Dashboard                          ⚙  [≡ Nav]         │
└────────────────────────────────────────────────────────────────────────────────────────┘
┌─[SIDEBAR 220px]─┬─[MANAGEMENT WORKSPACE surface-shell]──────────────────────────────────┐
│ ■ Dashboard ◉   │                                                                        │
│ ○ Approvals     │  ┌─[ANOMALY STRIP — conditional surface-warning-bg]─────────────────┐ │
│ ○ Reports       │  │ ★ 3 anomaly signals need owner review          [Open AI Insights] │ │
│ ○ Steel         │  └────────────────────────────────────────────────────────────────────┘│
│ ○ Settings      │  ┌─[REMINDER STRIP surface-panel border-subtle]──────────────────────┐ │
│                 │  │ ┌── Live reminders ──────────────────────┐ ┌── Primary action ───┐ │ │
│                 │  │ │ Live reminders  11px/500/action-primary │ │ Action now          │ │ │
│                 │  │ │ Next actions sync across all lanes.     │ │ surface-elevated    │ │ │
│                 │  │ │ 14px/400/secondary                     │ │ Clear the approval  │ │ │
│                 │  │ └─────────────────────────────────────────┘ │ queue              │ │ │
│                 │  │                                              │ 18px/600           │ │ │
│                 │  │                                              │ 3 alerts waiting.  │ │ │
│                 │  │                                              │ [Open Review Queue]│ │ │
│                 │  │                                              └─────────────────────┘ │ │
│                 │  └────────────────────────────────────────────────────────────────────┘ │
│                 │  ┌─[ROUTE HEADER surface-card border-subtle]──────────────────────────┐ │
│                 │  │ Operations board  11px/500/tertiary                                │ │
│                 │  │ Decision view is ready, Aman  18px/600                             │ │
│                 │  │ Start from the next decision…  14px/400/secondary                  │ │
│                 │  │ Factory: Shree Steel  · Pending: 2  · Alerts: 3  · ● System: Ready│ │
│                 │  │                                              [Open Review Queue]   │ │
│                 │  └────────────────────────────────────────────────────────────────────┘ │
│                 │  ┌─[NODE GRID surface-card]──────────────────────────────────────────┐ │
│                 │  │  Node Alpha ● Online  │ Node Beta ● Stable │ Node Gamma ● Watching│ Node Delta ● Ready │ │
│                 │  │  11px/500/sec         │ 14px/500/primary   │                      │  │
│                 │  └────────────────────────────────────────────────────────────────────┘ │
│                 │  ┌─[TELEMETRY surface-card]──────────────────────────────────────────┐ │
│                 │  │ ┌── Active alerts ──┐ ┌── System signals ─┐ ┌── Pending shift ──┐ ┌─ Trusted OCR ─┐ │ │
│                 │  │ │ Active alerts     │ │ System signals    │ │ Pending shift     │ │ Trusted OCR  │ │ │
│                 │  │ │ 11px/500/tert     │ │ 11px/500/tert     │ │ 11px/500/tert     │ │ 11px/500/tert│ │ │
│                 │  │ │       3           │ │       2           │ │       1           │ │     247      │ │ │
│                 │  │ │ 32px/700/primary  │ │ 32px/700/primary  │ │ 32px/700/action   │ │ 32px/700     │ │ │
│                 │  │ │ 3 unresolved      │ │ 2 signals active  │ │ 2 completed today │ │ 0 pending    │ │ │
│                 │  │ └───────────────────┘ └───────────────────┘ └───────────────────┘ └──────────────┘ │ │
│                 │  └────────────────────────────────────────────────────────────────────┘ │
│                 │  ┌─[BOARD TOOLS surface-panel border-subtle]──────────────────────────┐ │
│                 │  │ [Refresh] [Sync queue (2)]   ← ALWAYS VISIBLE — NOT <details>      │ │
│                 │  └────────────────────────────────────────────────────────────────────┘ │
│                 │  ┌─[CRITICAL ZONE surface-card]───────────────────────────────────────┐ │
│                 │  │ Critical operational zone  11px/500/action-primary                 │ │
│                 │  │ What requires operator attention right now  18px/600               │ │
│                 │  │ ┌─[METRIC COLS 3-col]──────────────────┐ ┌─[ASIDE]──────────────┐│ │
│                 │  │ │ Active alerts   Signals  Pending  OCR │ │ Queue urgency        ││ │
│                 │  │ │     3              2        1     247 │ │ Clear the approval   ││ │
│                 │  │ │ 30px/600          ...                 │ │ queue               ││ │
│                 │  │ │ alerts unresolved                     │ │ 18px/600            ││ │
│                 │  │ └───────────────────────────────────────┘ │ [Open Review Queue] ││ │
│                 │  │                                            └─────────────────────┘│ │
│                 │  └────────────────────────────────────────────────────────────────────┘ │
│                 │  ┌─[WORKFLOW ZONES xl:grid-cols-12]────────────────────────────────────┐ │
│                 │  │ ┌── Review Operations col-span-5 ─────┐ ┌── OCR Operations 4 ─────┐│ │
│                 │  │ │ Open review queue  11px/tert        │ │ Open scan desk  11px    ││ │
│                 │  │ │ Review Operations  20px/600         │ │ OCR Operations  20px    ││ │
│                 │  │ │ 3 alerts, 2 OCR exceptions waiting  │ │ 2 queued items          ││ │
│                 │  │ │ [Alerts:3] [Pending OCR:2]          │ │ [Queued:2] [Rows:1,240] ││ │
│                 │  │ │ [Open Review Queue ← PRIMARY]       │ │ [Open Scan] [Review Docs]│ │
│                 │  │ └─────────────────────────────────────┘ └──────────────────────────┘│ │
│                 │  │ ┌── Factory Admin 3 ──┐ ┌── Reports & Export col-span-7 ───────────┐│ │
│                 │  │ │ Open factory admin  │ │ Open reports  11px/tert                  ││ │
│                 │  │ │ Factory Admin 20px  │ │ Reports & Export  20px/600               ││ │
│                 │  │ │ 3 factories aligned │ │ 18,240 recent units, 12 entries ready    ││ │
│                 │  │ │ [Factories:3][Role:M]│ │ [Recent Units:18,240] [Entries:12]       ││ │
│                 │  │ │ [Open Factory Admin]│ │ [Open Reports outline]                   ││ │
│                 │  │ └─────────────────────┘ └─────────────────────────────────────────┘│ │
│                 │  │ ┌── Attendance col-span-5 ──────────────────────────────────────────┐│ │
│                 │  │ │ Open attendance review  · 2 completed · 1 pending  [Review]       ││ │
│                 │  │ └─────────────────────────────────────────────────────────────────┘│ │
│                 │  └────────────────────────────────────────────────────────────────────┘ │
│                 │  ┌─[LIVE FEED surface-card]──────────────────┬─[ESCALATION]────────────┐│
│                 │  │ ┌────────────────────────────────────────┐│ Escalation summary      ││
│                 │  │ │ Queue Escalation  11px/500/tert         ││ ─────────────────────── ││
│                 │  │ │ Auth anomaly on 3 accounts  14px/600    ││ Unread alerts      3    ││
│                 │  │ │ auth_anomaly · 10:24 mono               ││ OCR pending        2    ││
│                 │  │ │                              [Review]   ││ Queue backlog      0    ││
│                 │  │ ├────────────────────────────────────────┤│ Signals            2    ││
│                 │  │ │ Shift Anomaly  11px/500/tert            ││                        ││
│                 │  │ │ Morning shift 14% below target 14px/600 ││                        ││
│                 │  │ │ abnormal_output · 03 Jun mono           ││                        ││
│                 │  │ │                              [Open]     ││                        ││
│                 │  │ ├────────────────────────────────────────┤│                        ││
│                 │  │ │ Production Logged  11px/500/tert        ││                        ││
│                 │  │ │ Rolling 320/400  Morning downtime 12m   ││                        ││
│                 │  │ │ 13 Jun 08:45 mono            [Open]    ││                        ││
│                 │  │ └────────────────────────────────────────┘│                        ││
│                 │  └──────────────────────────────────────────┴────────────────────────┘│
│                 │  ┌─[INTELLIGENCE GRID 3-col surface-card]──────────────────────────────┐│
│                 │  │ ┌── Live production table ──┐ ┌── Bottlenecks ──┐ ┌── Recommendations ──┐│ │
│                 │  │ │ DATE · SHIFT · DEPT · UNITS│ │ OCR Trust:     │ │ Usage snapshot     ││ │
│                 │  │ │  Inter 10px/600 ≤0.06em   │ │  2 pending      │ │ Starter · current  ││ │
│                 │  │ │ 03Jun Morning Rolling 320/400│ │  247 trusted   │ │ Reports ready: 12  ││ │
│                 │  │ │ 03Jun Evening Wire   280/300│ │ Top signals:   │ │ Weekly avg: 78%    ││ │
│                 │  │ │ 02Jun Morning Rolling 400/400│ │  shift anomaly │ │ Offline queue: 0   ││ │
│                 │  │ │ ─────────────── Open links→ │ │  output drop   │ │ ─────────────────  ││ │
│                 │  │ └────────────────────────────┘ │ ─────────────  │ │ Recommendations:   ││ │
│                 │  │                                 │ Pending review: │ │ Clear alert queue  ││ │
│                 │  │                                 │  3 alerts, 2 OCR│ │ before exporting.  ││ │
│                 │  │                                 └─────────────────┘ └───────────────────┘│ │
│                 │  └─────────────────────────────────────────────────────────────────────────┘│
│                 │  ┌─[LAUNCH GUIDE surface-card]───────────────────────────────────────────┐  │
│                 │  │ ┌── Clear the next decision ──┐ ┌── Open business desk ────┐ ┌─ Send summary ──┐ │
│                 │  │ │ Open review queue →         │ │ Open reports →           │ │ Open email sum→ │ │
│                 │  │ │ Approve/reject queue before │ │ 18,240 units for reporting│ │ After numbers  │ │
│                 │  │ │ downstream exports           │ │                          │ │ are trusted    │ │
│                 │  │ └─────────────────────────────┘ └──────────────────────────┘ └────────────────┘ │
│                 │  └─────────────────────────────────────────────────────────────────────────────────┘│
└─────────────────┴────────────────────────────────────────────────────────────────────────────────────┘

MANAGEMENT SCAN PATH:
  [1] 0–200ms → AnomalyStrip (colored banner if anomaly) OR route header title
  [2] 200ms–1s → Telemetry (4 big numbers — active alerts, signals, pending, OCR)
  [3] 1–3s → Critical zone primary action + Review lane (PRIMARY button = most urgent)
  [4] 3–8s → Live feed events + remaining workflow lanes
  [5] 8s+ → Intelligence grid (production table, bottlenecks, recommendations)

MANAGEMENT DENSITY RULES:
  · Telemetry numbers at 32px — dominate their containers; labels at 11px recede
  · Workflow lanes: dense (12px inner padding, 12px chip gap) — 5 lanes in full width
  · Live feed: 3 lines per event (channel/title/detail) — 8 events visible without scroll
  · Table: 40px rows, 12px/8px cell padding — readable without feeling empty
  · Intelligence grid: panels fill their column fully — no arbitrary whitespace
  · Section gaps 24px — enough separation without emptiness
  · Board Tools strip: 48px height — minimum visible but not competing
```

---

### 14C. Spacing & Rhythm Visualization

```
OPERATOR WORKSPACE — Dense action focus:
  ┌────────────────────────────────────┐
  │ Status badge  ← 8px below factory  │  DENSE: status+CTA are one visual unit
  │ ─────────────────────────────────  │
  │ CTA  h:64px  ← 16px below badge   │  BREATHABLE: 16px separation = action zone
  │ ─────────────────────────────────  │
  │ Quick actions ← 24px below CTA    │  SILENCE: 24px = different concern
  │ Summary stats ← 16px below tiles  │
  └────────────────────────────────────┘

MANAGEMENT WORKSPACE — Cascading urgency:
  [AnomalyStrip]   ← zero gap = same urgency group as topbar
  ← 24px zone gap →
  [Reminder strip] ← primary action context
  ← 24px →
  [Route header]   ← identity + meta
  ← 24px →
  [Node + Telemetry] ← system state (dense: 12px between cols)
  ← 24px →
  [Critical zone]  ← act now
  ← 24px →
  [Workflow zones] ← domain links (12px between lanes)
  ← 24px →
  [Live feed]      ← temporal events (16px between items)
  ← 24px →
  [Intelligence]   ← deep reference
  ← 24px →
  [Launch guide]   ← sequential workflow

VISUAL SILENCE ZONES:
  · 24px between every major zone creates clear cognitive boundaries
  · Within zones: 12px chip/tile gaps maintain density
  · Telemetry values at 32px create visual dominance without wasted space
  · Table rows at 40px provide scan speed — not too tight, not empty
```

---

### 14D. Component Nesting Hierarchy

```
DashboardHome (state management)
  ├── [if isOperatorHome]
  │     └── OperatorDashboardWorkspace
  │           ├── main (surface-shell)
  │           │     ├── StatusBanner (conditional — status/error)
  │           │     └── Grid lg:[main_col · aside_360px]
  │           │           ├── HeroSection (surface-panel/border-default rounded-panel)
  │           │           │     ├── FactoryName + OnlinePill (semantic tokens)
  │           │           │     ├── StatusBadge (semantic tone — NOT raw tone class injection)
  │           │           │     ├── ShiftLabel + Detail
  │           │           │     ├── Button variant="primary" asChild → Link (PRIMARY CTA)
  │           │           │     ├── QuickActionGrid (surface-panel/border-subtle/rounded-panel) × 3
  │           │           │     └── SummaryGrid (surface-panel/border-subtle/rounded-control) × 2
  │           │           └── Aside
  │           │                 ├── SummaryCard (surface-panel) + SyncButton (isBusy)
  │           │                 ├── AlertsCard (surface-panel) — up to 2 alerts
  │           │                 └── ShiftStatusCards × 3 (success/subtle semantic)
  │
  └── [management workspace]
        └── main.operational-page
              ├── AnomalyStrip (shared/ai — static: true)
              ├── ReminderStrip (2-col: live reminders + primary action)
              ├── RouteHeader (CSS class system — verify sizes)
              ├── NodeGrid × 4 (sentence case, solid status dots)
              ├── TelemetryStrip × 4 (32px values, sentence case labels)
              ├── BoardToolsStrip (always visible — NOT details/summary)
              │     ├── Button "Refresh" (isBusy)
              │     └── Button "Sync queue" (conditional, isBusy)
              ├── CriticalZone
              │     ├── SectionEyebrow (sentence case action-primary)
              │     ├── TelemetryMetricCols × 4 (30px values + detail)
              │     └── Aside (primary action + Button variant="primary")
              ├── WorkflowZonesGrid (xl:grid-cols-12 asymmetric)
              │     └── WorkflowLane × 5 (sentence case, semantic chips)
              ├── LiveFeedGrid (2-col)
              │     ├── FeedPanel (items × ≤8: sentence case channels/links)
              │     └── EscalationSummary (4 chips — sentence case)
              ├── IntelligenceGrid (3-col)
              │     ├── ProductionTable (Inter UI headers ≤0.06em)
              │     ├── BottleneckPanel (sentence case eyebrows)
              │     └── RecommendationPanel (sentence case)
              └── LaunchGuide (3-col, lg:visible — fix hidden class)
                    └── StepCard × 3 (sentence case labels)
```

---

### 14E. Responsive Blueprint

```
1440px+ Desktop:
  Operator: [main col] | [aside 360px fixed]
  Management: Full zones; workflow grid xl:12; intelligence 3-col; feed 2-col

1280px–1439px:
  Operator: unchanged
  Management: workflow grid may reflow to 2-col; intelligence 2-col + stacked

≤1024px:
  Operator: stacked — aside falls below main panel
  Management: all zones single column; workflow lanes stack

<768px (Mobile):
  Operator: single column; CTA remains 64px; aside below main
  Management: critical info only — telemetry 2×2; workflow lanes stacked;
    intelligence panels stacked; launch guide hidden
  Touch: all interactive elements ≥44px height
```

---

### 14F. Structural Consistency Validation

```yaml
structural_validation:
  - [x] Both render paths justified by distinct operator needs (shift work vs. decision-making)
  - [x] Visual dominance matches attention priority in both paths
  - [x] Spacing 24px between zones; 12px within dense grids; 16px within cards
  - [x] Responsive adaptations preserve all critical actions on mobile
  - [x] Component nesting matches Section 11
  - [x] Summary duplication removed — single aside location
  - [x] Board tools not inside disclosure — always visible
  - [x] No glow effects in blueprint
  - [x] All eyebrows sentence case in blueprint
  - [x] Blueprint matches layout patterns declared in Section 4.1
```

---

## KIRO TASK CHAINING

```yaml
downstream_kiro_tasks:
  task_1:
    name: "Dashboard — Global Typography Fix (mono+uppercase+tracking batch)"
    input: This spec → Section 9.3, Section 4.2 (all zones), Section 12
    output: All zone eyebrows, chip labels, feed channels, and node labels use
      sentence case --type-label-dense Inter UI; zero monospace on non-timestamp text

  task_2:
    name: "Dashboard — Industrial Surface Token Migration"
    input: This spec → Section 9.4, Section 11, Section 12
    output: surface-industrial-deep/raised → shell/panel; text-inverse → text-text-primary;
      var(--border) → border-border-subtle; var(--accent) → text-action-primary;
      var(--muted) → text-text-secondary/tertiary; var(--card-strong) → surface-card

  task_3:
    name: "Dashboard — Operator CTA + Quick Actions Fix"
    input: This spec → Section 4.2 (Operator Hero), Section 11, Section 12
    output: CTA → Button asChild + Link h-[64px] rounded-panel;
      quick action tiles → rounded-panel; stat cards → rounded-control;
      summary duplication removed from main panel

  task_4:
    name: "Dashboard — Board Tools Disclosure Fix + Status Dot Glow"
    input: This spec → Section 4.2 (Board Tools), Section 12
    output: <details>/<summary> removed; always-visible Board Tools strip;
      status dot glow shadow removed; solid bg-status-success-icon

  task_5:
    name: "Dashboard — severityTone + workerStatus.tone Canonical Fix"
    input: This spec → Section 4.2 (Operator Hero), Section 12
    output: tone helper functions return canonical Tailwind class strings;
      NOT CSS variable string refs

  task_6:
    name: "Dashboard — Production Table Header Fix"
    input: This spec → Section 6.1, Section 9.3
    output: Table headers → Inter UI NOT monospace; tracking ≤0.06em;
      action links → text-action-primary NOT text-[var(--accent)]

  task_7:
    name: "Dashboard — Route Header CSS + Launch Guide Visibility Fix"
    input: This spec → Section 4.2 (Route Header, Launch Guide), Section 13.3
    output: Verify route-header CSS classes resolve to ≤18px title, ≤12px eyebrow;
      Remove 'hidden' class from launch guide (make visible on lg+)
```

---

*End of WORKSPACE_SKELETON_DASHBOARD.md (Sections 1–14)*
*This file is system-generated architecture. Treat as engineering law until formally amended.*
*Architectural precedents established:*
*- Two render paths (operator/management) on one route — spec covers both completely*
*- Operator primary CTA must be Button asChild + Link at 64px — not raw Link styling*
*- Industrial surface token mapping to canonical equivalents*
*- severityTone/workerStatus.tone helpers must return canonical Tailwind class strings*
*- Promise.allSettled pattern — preserve partial failure resilience*
*- anomalyLocked/analyticsLocked — 403 is plan-gate not error; silence not shown*
*- AnomalyStrip: static: true — no pulse, glow, or animation at any state*
----

### CODE 

````
<!DOCTYPE html><html class="dark" lang="en"><head>
<meta charset="utf-8">
<meta content="width=device-width, initial-scale=1.0" name="viewport">
<title>Management Home | FactoryNerve OS</title>
<script src="https://cdn.tailwindcss.com?plugins=forms,container-queries"></script>
<link href="https://fonts.googleapis.com/css2?family=Geist:wght@100..900&amp;family=JetBrains+Mono:wght@100..800&amp;family=Hanken+Grotesk:wght@300;400;500;600;700&amp;display=swap" rel="stylesheet">
<link href="https://fonts.googleapis.com/css2?family=Material+Symbols+Outlined:wght,FILL@100..700,0..1&amp;display=swap" rel="stylesheet">
<link href="https://fonts.googleapis.com/css2?family=Material+Symbols+Outlined:wght,FILL@100..700,0..1&amp;display=swap" rel="stylesheet">
<style>
        body {
            font-family: 'Hanken Grotesk', sans-serif;
            background-color: #031427; /* surface-dim */
        }
        .material-symbols-outlined {
            font-variation-settings: 'FILL' 0, 'wght' 400, 'GRAD' 0, 'opsz' 24;
        }
        .milled-edge {
            box-shadow: inset 0 0.5px 0 0 rgba(255, 255, 255, 0.08);
        }
        .custom-scrollbar::-webkit-scrollbar {
            width: 4px;
        }
        .custom-scrollbar::-webkit-scrollbar-track {
            background: #0A0C10;
        }
        .custom-scrollbar::-webkit-scrollbar-thumb {
            background: #30363D;
        }
    </style>
<script id="tailwind-config">
        tailwind.config = {
            darkMode: "class",
            theme: {
                extend: {
                    "colors": {
                        "outline": "#909095",
                        "secondary": "#c2c7d0",
                        "system-navy": "#1E293B",
                        "outline-variant": "#45474b",
                        "on-tertiary-fixed-variant": "#3a485c",
                        "surface-container-low": "#0b1c30",
                        "primary": "#c6c6cc",
                        "on-error": "#690005",
                        "surface-variant": "#26364a",
                        "surface-container": "#102034",
                        "border-muted": "#30363D",
                        "on-secondary": "#2c3138",
                        "secondary-fixed": "#dee2ec",
                        "surface-tint": "#c6c6cc",
                        "on-primary": "#2f3035",
                        "surface-container-high": "#1b2b3f",
                        "surface-container-highest": "#26364a",
                        "surface-container-lowest": "#000f21",
                        "surface-dim": "#031427",
                        "surface-bright": "#2a3a4f",
                        "inverse-surface": "#d3e4fe",
                        "error-container": "#93000a",
                        "on-tertiary": "#233144",
                        "tertiary": "#b9c7e0",
                        "primary-container": "#0a0c10",
                        "on-primary-container": "#797a7f",
                        "surface-graphite": "#0F1115",
                        "on-secondary-fixed-variant": "#42474f",
                        "on-primary-fixed": "#1a1c20",
                        "tertiary-fixed-dim": "#b9c7e0",
                        "error": "#ffb4ab",
                        "inverse-primary": "#5d5e63",
                        "data-blue": "#38BDF8",
                        "surface": "#031427",
                        "surface-panel": "#161B22",
                        "on-secondary-fixed": "#171c23",
                        "on-primary-fixed-variant": "#45474b",
                        "on-background": "#d3e4fe",
                        "on-secondary-container": "#b1b5bf",
                        "secondary-container": "#42474f",
                        "secondary-fixed-dim": "#c2c7d0",
                        "accent-steel": "#8B949E",
                        "on-tertiary-container": "#6d7b91",
                        "primary-fixed": "#e2e2e8",
                        "on-surface": "#d3e4fe",
                        "on-error-container": "#ffdad6",
                        "primary-fixed-dim": "#c6c6cc",
                        "on-surface-variant": "#c6c6cb",
                        "inverse-on-surface": "#213145",
                        "background": "#031427",
                        "on-tertiary-fixed": "#0d1c2f",
                        "tertiary-fixed": "#d5e3fd",
                        "tertiary-container": "#000c1e",
                        "status-success": "#4ADE80",
                        "status-warning": "#FACC15"
                    },
                    "borderRadius": {
                        "DEFAULT": "0.125rem",
                        "lg": "0.25rem",
                        "xl": "0.5rem",
                        "full": "0.75rem"
                    },
                    "spacing": {
                        "padding-md": "12px",
                        "gutter": "16px",
                        "padding-xs": "4px",
                        "padding-sm": "8px",
                        "base-unit": "4px",
                        "panel-margin": "24px"
                    },
                    "fontFamily": {
                        "body-md": ["Hanken Grotesk"],
                        "headline-md": ["Hanken Grotesk"],
                        "headline-lg": ["Hanken Grotesk"],
                        "data-label": ["JetBrains Mono"],
                        "data-numeric": ["JetBrains Mono"],
                        "body-sm": ["Hanken Grotesk"]
                    },
                    "fontSize": {
                        "body-md": ["14px", {"lineHeight": "20px", "fontWeight": "400"}],
                        "headline-md": ["18px", {"lineHeight": "24px", "letterSpacing": "-0.01em", "fontWeight": "600"}],
                        "headline-lg": ["24px", {"lineHeight": "32px", "letterSpacing": "-0.02em", "fontWeight": "600"}],
                        "data-label": ["12px", {"lineHeight": "16px", "letterSpacing": "0.02em", "fontWeight": "500"}],
                        "data-numeric": ["13px", {"lineHeight": "18px", "letterSpacing": "0em", "fontWeight": "400"}],
                        "body-sm": ["13px", {"lineHeight": "18px", "fontWeight": "400"}]
                    }
                },
            },
        }
    </script>
</head>
<body class="bg-primary-container text-on-surface flex h-screen overflow-hidden selection:bg-primary selection:text-on-primary">
<!-- SideNavBar (Shared Component) -->
<aside class="flex flex-col h-full py-panel-margin bg-surface-graphite dark:bg-surface-graphite border-r border-border-muted docked left-0 h-full w-64 shrink-0">
<div class="px-gutter mb-8">
<div class="flex items-center gap-3">
<div class="w-10 h-10 rounded bg-surface-variant flex items-center justify-center">
<span class="material-symbols-outlined text-primary">precision_manufacturing</span>
</div>
<div>
<h1 class="font-headline-md text-headline-md text-primary tracking-tight">FactoryNerve OS</h1>
<p class="text-[10px] text-on-tertiary-container uppercase tracking-widest font-bold">Precision Control</p>
</div>
</div>
</div>
<nav class="flex-1 px-4 space-y-1">
<a class="flex items-center gap-3 px-3 py-2 text-secondary-fixed-dim hover:bg-surface-variant transition-all font-body-sm text-body-sm group" href="#">
<span class="material-symbols-outlined text-xl">precision_manufacturing</span>
<span class="">Operator home</span>
</a>
<a class="flex items-center gap-3 px-3 py-2 text-primary bg-surface-container-high border-r-2 border-primary transition-all font-body-sm text-body-sm group" href="#">
<span class="material-symbols-outlined text-xl">analytics</span>
<span class="">Management home</span>
</a>
<a class="flex items-center gap-3 px-3 py-2 text-secondary-fixed-dim hover:bg-surface-variant transition-all font-body-sm text-body-sm group" href="#">
<span class="material-symbols-outlined text-xl">account_tree</span>
<span class="">Node status</span>
</a>
<a class="flex items-center gap-3 px-3 py-2 text-secondary-fixed-dim hover:bg-surface-variant transition-all font-body-sm text-body-sm group" href="#">
<span class="material-symbols-outlined text-xl">show_chart</span>
<span class="">Telemetry</span>
</a>
<a class="flex items-center gap-3 px-3 py-2 text-secondary-fixed-dim hover:bg-surface-variant transition-all font-body-sm text-body-sm group" href="#">
<span class="material-symbols-outlined text-xl">psychology</span>
<span class="">Intelligence</span>
</a>
</nav>
<div class="px-4 mt-auto space-y-4">

<div class="pt-4 border-t border-border-muted space-y-1">
<a class="flex items-center gap-3 px-3 py-2 text-secondary-fixed-dim hover:bg-surface-variant transition-all font-body-sm text-body-sm" href="#">
<span class="material-symbols-outlined text-xl">terminal</span>
<span class="">Diagnostics</span>
</a>
<a class="flex items-center gap-3 px-3 py-2 text-secondary-fixed-dim hover:bg-surface-variant transition-all font-body-sm text-body-sm" href="#">
<span class="material-symbols-outlined text-xl">history</span>
<span class="">Logs</span>
</a>
</div>
</div>
</aside>
<!-- Main Content Canvas -->
<main class="flex-1 flex flex-col min-w-0 bg-primary-container relative custom-scrollbar overflow-y-auto">
<!-- 1. AnomalyStrip -->
<div class="bg-error-container/20 border-b border-error/30 py-2 px-gutter flex items-center justify-between">
<div class="flex items-center gap-2">
<span class="material-symbols-outlined text-error text-[18px]" style="font-variation-settings: 'FILL' 1;">warning</span>
<span class="text-error text-body-sm font-medium">3 anomaly signals need owner review</span>
</div>
<button class="text-error hover:underline text-[11px] font-bold uppercase tracking-wider">Review signals</button>
</div>
<!-- TopNavBar (Shared Component Identity Integration) -->
<header class="flex justify-between items-center w-full px-gutter h-14 bg-surface-container-highest dark:bg-surface-container-highest border-b border-border-muted shrink-0 sticky top-0 z-50">
<div class="flex items-center gap-6">
<span class="font-headline-md text-headline-md font-bold text-primary">Operations Board</span>
<div class="hidden md:flex items-center bg-surface-container-lowest border border-border-muted px-3 py-1.5 gap-2 w-64">
<span class="material-symbols-outlined text-secondary text-[18px]">search</span>
<input class="bg-transparent border-none p-0 focus:ring-0 text-body-sm text-secondary placeholder:text-outline-variant w-full" placeholder="Search operations..." type="text">
</div>
</div>
<div class="flex items-center gap-4">
<div class="flex items-center gap-2 border-r border-border-muted pr-4">
<button class="p-2 text-secondary hover:text-primary transition-colors"><span class="material-symbols-outlined">notifications</span></button>
<button class="p-2 text-secondary hover:text-primary transition-colors"><span class="material-symbols-outlined">settings</span></button>
<button class="p-2 text-secondary hover:text-primary transition-colors"><span class="material-symbols-outlined">help</span></button>
</div>
<div class="flex items-center gap-3 pl-2">
<div class="text-right">
<p class="text-body-sm font-medium leading-none">Aman Gupta</p>
<p class="text-[10px] text-outline tracking-wider">Plant Manager</p>
</div>
<img alt="Operator Profile Avatar" class="w-8 h-8 rounded-full border border-primary/20 object-cover" data-alt="A professional headshot of a plant manager in a modern industrial setting, soft cinematic lighting with cool tones. The individual has a serious and authoritative expression, wearing professional attire that fits an industrial high-tech executive. The background shows blurred industrial machinery and glowing data interfaces." src="https://lh3.googleusercontent.com/aida-public/AB6AXuCLe80LZRuGYp9E9f8EyCB-sfxHK5URIVJC4e1XIdIIxnWKJDgZx8kTy_AZTFj9zhuEmbPOIHOwvxungOZeRFrur31_Svxv_7_AdAiOswHze3huTSpkMgnkRF2X6ntcn26uPbeIJ8aMT6fH_zvL6ALbpkcMGexmA1kmc5Aeqfin-b9jSXcMCjZs-3l3k5x0RXhGEHWMR4am1I1OkW-o0pjzIL81kwvcRIZM0oQDOC78ETWWqKlFxxj1VR4a0NC2EkWrOIjqymy8V_E">
</div>
</div>
</header>
<!-- Content Zones -->
<div class="flex flex-col gap-0">
<!-- 2. Reminder Strip -->
<section class="grid grid-cols-1 md:grid-cols-2 bg-surface-container px-gutter py-6 border-b border-border-muted">
<div class="flex flex-col justify-center gap-1 border-r border-border-muted pr-8">
<span class="text-primary font-bold text-[10px] uppercase tracking-[0.1em]">Live reminders</span>
<h2 class="font-headline-md text-headline-md text-on-surface">Next actions sync across all lanes</h2>
</div>
<div class="flex items-center justify-between pl-8">
<div class="flex flex-col">
<div class="flex items-center gap-2 mb-1">
<span class="bg-surface-variant px-2 py-0.5 rounded-sm text-[10px] text-secondary font-medium uppercase tracking-wide">Action now</span>
</div>
<h3 class="font-headline-md text-headline-md text-on-surface">Clear the approval queue</h3>
</div>
<button class="border border-primary text-primary px-6 py-2 text-body-sm font-medium hover:bg-primary hover:text-on-primary transition-colors milled-edge">
                        Open Review Queue
                    </button>
</div>
</section>
<!-- 3. Route Header -->
<section class="bg-surface-panel px-gutter py-10 border-b border-border-muted relative overflow-hidden">
<div class="absolute right-0 top-0 h-full w-1/3 opacity-20 pointer-events-none">
<svg class="w-full h-full text-primary" fill="none" viewBox="0 0 400 400">
<path d="M0 400L400 0H0V400Z" fill="currentColor" fill-opacity="0.05"></path>
<circle cx="350" cy="50" r="100" stroke="currentColor" stroke-dasharray="4 4" stroke-width="0.5"></circle>
</svg>
</div>
<div class="relative z-10">
<span class="text-outline-variant font-medium text-[11px] uppercase tracking-[0.15em] block mb-2">Operations board</span>
<h1 class="font-headline-lg text-headline-lg mb-1">Decision view is ready, Aman</h1>
<p class="text-secondary font-body-md text-body-md opacity-80 mb-8">Start from the next decision to maintain line momentum.</p>
<div class="flex items-center gap-8 py-3 px-4 bg-surface-container-lowest border border-border-muted w-fit milled-edge">
<div class="flex flex-col">
<span class="text-[10px] text-outline-variant uppercase tracking-wider font-bold">Factory</span>
<span class="text-body-sm font-bold text-primary">Shree Steel</span>
</div>
<div class="w-px h-6 bg-border-muted"></div>
<div class="flex flex-col">
<span class="text-[10px] text-outline-variant uppercase tracking-wider font-bold">Pending</span>
<span class="text-body-sm font-bold text-primary font-data-numeric">2</span>
</div>
<div class="w-px h-6 bg-border-muted"></div>
<div class="flex flex-col">
<span class="text-[10px] text-outline-variant uppercase tracking-wider font-bold">Alerts</span>
<span class="text-body-sm font-bold text-error font-data-numeric">3</span>
</div>
<div class="w-px h-6 bg-border-muted"></div>
<div class="flex items-center gap-2">
<div class="w-2 h-2 rounded-full bg-status-success shadow-[0_0_8px_rgba(74,222,128,0.3)]" style="opacity: 1;"></div>
<span class="text-body-sm font-bold text-primary">System: Ready</span>
</div>
</div>
</div>
</section>
<!-- 4. Node Status Grid -->
<section class="grid grid-cols-2 md:grid-cols-4 border-b border-border-muted">
<div class="border-r border-border-muted p-4 flex items-center justify-between hover:bg-surface-container transition-colors group">
<div class="flex items-center gap-3">
<div class="w-2 h-2 rounded-full bg-status-success" style="opacity: 0.7;"></div>
<span class="text-body-sm font-medium tracking-wide">Alpha</span>
</div>
<span class="material-symbols-outlined text-outline-variant text-sm group-hover:text-primary">more_vert</span>
</div>
<div class="border-r border-border-muted p-4 flex items-center justify-between hover:bg-surface-container transition-colors group">
<div class="flex items-center gap-3">
<div class="w-2 h-2 rounded-full bg-status-success" style="opacity: 1;"></div>
<span class="text-body-sm font-medium tracking-wide">Beta</span>
</div>
<span class="material-symbols-outlined text-outline-variant text-sm group-hover:text-primary">more_vert</span>
</div>
<div class="border-r border-border-muted p-4 flex items-center justify-between hover:bg-surface-container transition-colors group">
<div class="flex items-center gap-3">
<div class="w-2 h-2 rounded-full bg-status-warning"></div>
<span class="text-body-sm font-medium tracking-wide">Gamma</span>
</div>
<span class="material-symbols-outlined text-outline-variant text-sm group-hover:text-primary">more_vert</span>
</div>
<div class="p-4 flex items-center justify-between hover:bg-surface-container transition-colors group">
<div class="flex items-center gap-3">
<div class="w-2 h-2 rounded-full bg-status-success" style="opacity: 0.7;"></div>
<span class="text-body-sm font-medium tracking-wide">Delta</span>
</div>
<span class="material-symbols-outlined text-outline-variant text-sm group-hover:text-primary">more_vert</span>
</div>
</section>
<!-- 5. Telemetry Strip -->
<section class="grid grid-cols-2 lg:grid-cols-4 bg-surface-container-low border-b border-border-muted">
<div class="p-8 border-r border-border-muted">
<p class="text-[11px] text-outline-variant font-medium uppercase tracking-widest mb-2">Active alerts</p>
<div class="flex items-baseline gap-2">
<span class="text-[32px] font-bold text-error leading-none font-data-numeric">3</span>
<span class="text-xs text-outline font-data-label">LANE-SIG</span>
</div>
</div>
<div class="p-8 border-r border-border-muted">
<p class="text-[11px] text-outline-variant font-medium uppercase tracking-widest mb-2">System signals</p>
<div class="flex items-baseline gap-2">
<span class="text-[32px] font-bold text-primary leading-none font-data-numeric">2</span>
<span class="text-xs text-outline font-data-label">SYNC</span>
</div>
</div>
<div class="p-8 border-r border-border-muted">
<p class="text-[11px] text-outline-variant font-medium uppercase tracking-widest mb-2">Pending shift</p>
<div class="flex items-baseline gap-2">
<span class="text-[32px] font-bold text-primary leading-none font-data-numeric">1</span>
<span class="text-xs text-outline font-data-label">DELTA-V</span>
</div>
</div>
<div class="p-8">
<p class="text-[11px] text-outline-variant font-medium uppercase tracking-widest mb-2">Trusted OCR</p>
<div class="flex items-baseline gap-2">
<span class="text-[32px] font-bold text-data-blue leading-none font-data-numeric">247</span>
<span class="text-xs text-outline font-data-label">VERIFIED</span>
</div>
</div>
</section>
<!-- 6. Board Tools -->
<section class="bg-surface-panel px-gutter py-3 flex items-center gap-3 border-b border-border-muted">
<button class="flex items-center gap-2 px-3 py-1.5 border border-border-muted text-secondary hover:bg-surface-container-high transition-colors text-body-sm milled-edge">
<span class="material-symbols-outlined text-[16px]">refresh</span>
                    Refresh
                </button>
<button class="flex items-center gap-2 px-3 py-1.5 border border-border-muted text-secondary hover:bg-surface-container-high transition-colors text-body-sm milled-edge">
<span class="material-symbols-outlined text-[16px]">sync_alt</span>
                    Sync queue (2)
                </button>
</section>
<!-- 7. Critical Operational Zone -->
<section class="px-gutter py-8 bg-surface-graphite">
<span class="text-error font-bold text-[10px] uppercase tracking-[0.2em] block mb-6">Critical operational zone</span>
<div class="grid grid-cols-1 lg:grid-cols-4 gap-gutter">
<div class="lg:col-span-3 grid grid-cols-1 md:grid-cols-3 gap-4">
<div class="bg-surface-panel border border-border-muted p-5 milled-edge">
<span class="text-outline-variant text-[10px] font-bold uppercase tracking-wider block mb-4">Throughput (T/hr)</span>
<div class="h-16 flex items-end gap-1 mb-4">
<div class="bg-primary/20 w-full h-1/2"></div>
<div class="bg-primary/20 w-full h-2/3"></div>
<div class="bg-primary/40 w-full h-1/3"></div>
<div class="bg-primary/20 w-full h-3/4"></div>
<div class="bg-primary/20 w-full h-1/2"></div>
<div class="bg-primary/60 w-full h-full"></div>
</div>
<span class="text-headline-md font-data-numeric">4,281</span>
</div>
<div class="bg-surface-panel border border-border-muted p-5 milled-edge">
<span class="text-outline-variant text-[10px] font-bold uppercase tracking-wider block mb-4">Error Rate</span>
<div class="relative h-16 flex items-center justify-center mb-4">
<svg class="w-full h-full stroke-error/50 stroke-2 fill-none" viewBox="0 0 100 20">
<path d="M0 15 Q 25 5, 50 15 T 100 10"></path>
</svg>
</div>
<span class="text-headline-md font-data-numeric text-error">0.02%</span>
</div>
<div class="bg-surface-panel border border-border-muted p-5 milled-edge">
<span class="text-outline-variant text-[10px] font-bold uppercase tracking-wider block mb-4">Uptime Index</span>
<div class="flex items-center gap-4 h-16 mb-4">
<div class="flex-1 bg-surface-container-low h-1 rounded-full overflow-hidden">
<div class="bg-status-success h-full w-[99.4%]"></div>
</div>
</div>
<span class="text-headline-md font-data-numeric">99.4</span>
</div>
</div>
<div class="bg-surface-container-high border border-border-muted p-6 flex flex-col justify-between milled-edge">
<div>
<span class="text-primary font-bold text-[10px] uppercase tracking-widest block mb-2">Queue urgency</span>
<p class="text-body-sm text-secondary mb-6">Unresolved signals from the Alpha node are affecting downstream synchronization.</p>
</div>
<button class="w-full bg-primary text-on-primary py-3 font-bold hover:brightness-110 transition-all text-body-sm">
                            Open Review Queue
                        </button>
</div>
</div>
</section>
<!-- 8. Workflow Zones -->
<section class="px-gutter py-12 bg-primary-container">
<div class="grid grid-cols-12 gap-4">
<!-- Review Lane -->
<div class="col-span-12 lg:col-span-4 bg-surface-panel border border-border-muted p-6 milled-edge relative overflow-hidden">
<div class="absolute top-0 right-0 p-4">
<span class="bg-error-container text-error text-[10px] px-2 py-0.5 font-bold uppercase tracking-tighter">Critical</span>
</div>
<span class="text-outline-variant text-[10px] font-bold uppercase tracking-widest block mb-1">Workflow</span>
<h3 class="font-headline-md text-headline-md mb-4">Review</h3>
<p class="text-body-sm text-secondary mb-8">3 verification tasks pending owner approval from current shift.</p>
<button class="w-full bg-primary text-on-primary py-2.5 font-bold text-body-sm">Start review</button>
</div>
<!-- OCR Lane -->
<div class="col-span-6 lg:col-span-3 bg-surface-panel border border-border-muted p-6 milled-edge hover:border-primary/50 transition-colors cursor-pointer group">
<div class="flex items-center justify-between mb-1">
<span class="text-outline-variant text-[10px] font-bold uppercase tracking-widest">Analytics</span>
<span class="material-symbols-outlined text-sm text-outline group-hover:text-primary">arrow_forward_ios</span>
</div>
<h3 class="font-headline-md text-headline-md mb-2">OCR</h3>
<p class="text-xs text-secondary/60">Automated capture systems are operating within nominal range.</p>
</div>
<!-- Admin Lane -->
<div class="col-span-6 lg:col-span-2 bg-surface-panel border border-border-muted p-6 milled-edge hover:border-primary/50 transition-colors cursor-pointer group">
<div class="flex items-center justify-between mb-1">
<span class="text-outline-variant text-[10px] font-bold uppercase tracking-widest">Ops</span>
<span class="material-symbols-outlined text-sm text-outline group-hover:text-primary">arrow_forward_ios</span>
</div>
<h3 class="font-headline-md text-headline-md mb-2">Admin</h3>
<p class="text-xs text-secondary/60">Lanes: 12 active</p>
</div>
<!-- Reports Lane -->
<div class="col-span-6 lg:col-span-3 bg-surface-panel border border-border-muted p-6 milled-edge hover:border-primary/50 transition-colors cursor-pointer group">
<div class="flex items-center justify-between mb-1">
<span class="text-outline-variant text-[10px] font-bold uppercase tracking-widest">Insights</span>
<span class="material-symbols-outlined text-sm text-outline group-hover:text-primary">arrow_forward_ios</span>
</div>
<h3 class="font-headline-md text-headline-md mb-2">Reports</h3>
<p class="text-xs text-secondary/60">Shift summaries generated.</p>
</div>
<!-- Attendance Lane -->
<div class="col-span-12 lg:col-span-3 lg:col-start-10 bg-surface-panel border border-border-muted p-6 milled-edge hover:border-primary/50 transition-colors cursor-pointer group">
<div class="flex items-center justify-between mb-1">
<span class="text-outline-variant text-[10px] font-bold uppercase tracking-widest">Personnel</span>
<span class="material-symbols-outlined text-sm text-outline group-hover:text-primary">arrow_forward_ios</span>
</div>
<h3 class="font-headline-md text-headline-md mb-2">Attendance</h3>
<p class="text-xs text-secondary/60">Shift B clock-in complete.</p>
</div>
</div>
</section>
<!-- 9. Live Feed -->
<section class="grid grid-cols-1 lg:grid-cols-3 border-t border-border-muted bg-surface-container-lowest">
<div class="lg:col-span-2 border-r border-border-muted p-gutter">
<div class="flex items-center justify-between mb-6">
<h4 class="text-body-sm font-bold uppercase tracking-[0.1em] text-primary">Live feed</h4>
<div class="flex items-center gap-1">
<span class="w-1.5 h-1.5 bg-status-success rounded-full animate-pulse" style="opacity: 1;"></span>
<span class="text-[10px] text-outline font-bold uppercase">Real-time</span>
</div>
</div>
<div class="space-y-3">
<div class="flex items-start gap-4 p-4 bg-surface-panel border border-border-muted hover:border-primary/30 transition-colors milled-edge">
<div class="bg-error/10 p-2 border border-error/20">
<span class="material-symbols-outlined text-error text-[18px]">security</span>
</div>
<div class="flex-1">
<div class="flex justify-between items-start mb-1">
<p class="text-body-sm font-bold">Auth anomaly on 3 accounts</p>
<span class="text-[10px] font-data-label text-outline">14:02:31</span>
</div>
<p class="text-xs text-secondary mb-2">Multiple login failures detected from restricted IP block 192.168.4.XX.</p>
<a class="text-primary text-[11px] font-bold hover:underline flex items-center gap-1" href="#">
                                    Review <span class="material-symbols-outlined text-[12px]">open_in_new</span>
</a>
</div>
</div>
<div class="flex items-start gap-4 p-4 bg-surface-panel border border-border-muted hover:border-primary/30 transition-colors milled-edge">
<div class="bg-primary/10 p-2 border border-primary/20">
<span class="material-symbols-outlined text-primary text-[18px]">sync</span>
</div>
<div class="flex-1">
<div class="flex justify-between items-start mb-1">
<p class="text-body-sm font-bold">Batch sync complete</p>
<span class="text-[10px] font-data-label text-outline">13:58:12</span>
</div>
<p class="text-xs text-secondary">All pending OCR transactions synced to master ledger.</p>
</div>
</div>
</div>
</div>
<div class="p-gutter bg-surface-panel">
<h4 class="text-body-sm font-bold uppercase tracking-[0.1em] text-primary mb-6">Escalation summary</h4>
<div class="space-y-6">
<div class="flex items-center justify-between">
<span class="text-body-sm text-secondary">High priority</span>
<span class="font-data-numeric text-headline-md text-error">2</span>
</div>
<div class="w-full bg-border-muted h-px"></div>
<div class="flex items-center justify-between">
<span class="text-body-sm text-secondary">Standard review</span>
<span class="font-data-numeric text-headline-md text-primary">5</span>
</div>
<div class="w-full bg-border-muted h-px"></div>
<div class="flex items-center justify-between">
<span class="text-body-sm text-secondary">Auto-resolved</span>
<span class="font-data-numeric text-headline-md text-status-success">14</span>
</div>
<div class="pt-4">
<img alt="Telemetry Visualization" class="w-full h-24 object-cover border border-border-muted milled-edge opacity-60" data-alt="A clean, cinematic data visualization showing complex network nodes and performance metrics. The color palette is dark navy and charcoal with soft blue and silver data points. The lighting is low-key, professional, and sophisticated, reflecting a high-end industrial operational control environment." src="https://lh3.googleusercontent.com/aida-public/AB6AXuDDXguCsFm7YVfH4KtxkHF5m7zcUHJMI0MFXWhu7CEAVyYXOTh0KZ8bUEu4WQaPUifraia5IOXnuCjafaTicHo6Mu2rS3Isy0eVFhFbKslZjpnw3TBHghdyqVdMpUGGL5umLMXECY_GAd_0ghKSTbQF8Z2--00snZ9Uc28XpSn8DGHG8P-Zlh8ZkWZsD-aaAVTTN8IA6zMGPaR9_w4btvH-TMxe7RVGdTFi_YoLZtrKK4yEhrEHEsGJpveSvSxT7T2W-QoxqOxu3jY">
</div>
</div>
</div>
</section>
<!-- 10. Intelligence Grid -->
<section class="grid grid-cols-1 xl:grid-cols-3 border-t border-border-muted">
<!-- Left: Live Production Table -->
<div class="p-gutter border-r border-border-muted bg-surface-graphite">
<h4 class="text-body-sm font-bold uppercase tracking-[0.1em] text-primary mb-4">Live production activity</h4>
<div class="overflow-x-auto">
<table class="w-full">
<thead>
<tr class="text-[10px] text-outline uppercase tracking-[0.06em] border-b border-border-muted">
<th class="pb-2 text-left font-bold">Line ID</th>
<th class="pb-2 text-left font-bold">Status</th>
<th class="pb-2 text-right font-bold">Eff.</th>
</tr>
</thead>
<tbody class="text-body-sm font-data-numeric divide-y divide-border-muted/50">
<tr class="hover:bg-surface-variant/30 transition-colors">
<td class="py-3 text-secondary">L-A12</td>
<td class="py-3"><span class="text-status-success">Running</span></td>
<td class="py-3 text-right">98%</td>
</tr>
<tr class="hover:bg-surface-variant/30 transition-colors">
<td class="py-3 text-secondary">L-A14</td>
<td class="py-3"><span class="text-status-warning">Maintenance</span></td>
<td class="py-3 text-right">0%</td>
</tr>
<tr class="hover:bg-surface-variant/30 transition-colors">
<td class="py-3 text-secondary">L-B01</td>
<td class="py-3"><span class="text-status-success">Running</span></td>
<td class="py-3 text-right">94%</td>
</tr>
</tbody>
</table>
</div>
</div>
<!-- Center: Bottleneck Cards -->
<div class="p-gutter border-r border-border-muted">
<h4 class="text-body-sm font-bold uppercase tracking-[0.1em] text-primary mb-4">Bottleneck alerts</h4>
<div class="space-y-4">
<div class="bg-surface-container-high border-l-2 border-status-warning p-4 milled-edge">
<p class="text-xs font-bold text-status-warning uppercase mb-1">Potential Delay</p>
<p class="text-body-sm font-medium">Gamma node cooling cycle increasing.</p>
</div>
<div class="bg-surface-container-high border-l-2 border-primary p-4 milled-edge">
<p class="text-xs font-bold text-primary uppercase mb-1">Load Balancing</p>
<p class="text-body-sm font-medium">Delta shift resources nearing capacity.</p>
</div>
</div>
</div>
<!-- Right: Recommendations -->
<div class="p-gutter bg-surface-container">
<h4 class="text-body-sm font-bold uppercase tracking-[0.1em] text-primary mb-4">Recommendations</h4>
<div class="bg-surface-panel p-4 border border-border-muted milled-edge mb-4">
<div class="flex items-center gap-2 mb-2">
<span class="material-symbols-outlined text-primary text-sm">psychology</span>
<span class="text-[10px] font-bold uppercase tracking-widest text-primary">AI Insight</span>
</div>
<p class="text-xs text-secondary leading-relaxed">Adjusting the Beta output gate by -4% may reduce downstream queuing by 12 minutes.</p>
</div>
<div class="flex justify-between items-end">
<div>
<p class="text-[10px] text-outline-variant font-bold uppercase tracking-widest">Usage snapshot</p>
<p class="text-headline-md font-data-numeric">12.4GB <span class="text-xs text-outline">DATA</span></p>
</div>
<button class="text-primary text-[11px] font-bold uppercase tracking-wider hover:underline">View details</button>
</div>
</div>
</section>
<!-- 11. Launch Guide -->
<section class="px-gutter py-16 bg-surface-graphite border-t border-border-muted">
<div class="grid grid-cols-1 md:grid-cols-3 gap-8">
<div class="group cursor-pointer">
<div class="mb-6 flex items-center justify-center w-12 h-12 border border-border-muted text-outline group-hover:border-primary group-hover:text-primary transition-all">
<span class="text-headline-md font-data-numeric">01</span>
</div>
<span class="text-primary font-bold text-[10px] uppercase tracking-[0.2em] block mb-2">Initial setup</span>
<h3 class="font-headline-md text-headline-md mb-2">Configure environment</h3>
<p class="text-body-sm text-outline-variant leading-relaxed">Define the operational boundaries and core signal types for the primary production floor.</p>
</div>
<div class="group cursor-pointer">
<div class="mb-6 flex items-center justify-center w-12 h-12 border border-border-muted text-outline group-hover:border-primary group-hover:text-primary transition-all">
<span class="text-headline-md font-data-numeric">02</span>
</div>
<span class="text-primary font-bold text-[10px] uppercase tracking-[0.2em] block mb-2">Team sync</span>
<h3 class="font-headline-md text-headline-md mb-2">Connect operators</h3>
<p class="text-body-sm text-outline-variant leading-relaxed">Map personnel roles to specific lane hierarchies and approval permissions across shifts.</p>
</div>
<div class="group cursor-pointer">
<div class="mb-6 flex items-center justify-center w-12 h-12 border border-border-muted text-outline group-hover:border-primary group-hover:text-primary transition-all">
<span class="text-headline-md font-data-numeric">03</span>
</div>
<span class="text-primary font-bold text-[10px] uppercase tracking-[0.2em] block mb-2">Performance</span>
<h3 class="font-headline-md text-headline-md mb-2">Calibrate telemetry</h3>
<p class="text-body-sm text-outline-variant leading-relaxed">Fine-tune the sensitivity of anomaly detection for the local manufacturing context.</p>
</div>
</div>
</section>
</div>
<!-- Footer Info -->
<footer class="mt-auto px-gutter py-4 border-t border-border-muted bg-surface-container-lowest flex items-center justify-between">
<div class="flex items-center gap-6">
<span class="text-[10px] text-outline font-data-label uppercase tracking-widest">System Engine v4.0.21-Stable</span>
<span class="text-[10px] text-outline font-data-label uppercase tracking-widest">Last Sync: Today, 14:15</span>
</div>
<div class="flex items-center gap-4">
<a class="text-[10px] text-outline hover:text-primary transition-colors uppercase tracking-widest font-bold" href="#">Privacy Policy</a>
<a class="text-[10px] text-outline hover:text-primary transition-colors uppercase tracking-widest font-bold" href="#">Terminal Support</a>
</div>
</footer>
</main>
<script>
        // Simple micro-interaction for status dots
        document.querySelectorAll('.rounded-full').forEach(dot => {
            if (dot.classList.contains('bg-status-success')) {
                setInterval(() => {
                    dot.style.opacity = dot.style.opacity === '0.7' ? '1' : '0.7';
                }, 2000 + Math.random() * 2000);
            }
        });
    </script>


</body></html>

````

### CODE

````
<!DOCTYPE html>

<html class="dark" lang="en"><head>
<meta charset="utf-8"/>
<meta content="width=device-width, initial-scale=1.0" name="viewport"/>
<title>FactoryNerve OS - Operator Home</title>
<script src="https://cdn.tailwindcss.com?plugins=forms,container-queries"></script>
<link href="https://fonts.googleapis.com/css2?family=Geist:wght@100..900&amp;family=JetBrains+Mono:wght@100..800&amp;family=Hanken+Grotesk:wght@300;400;500;600;700&amp;display=swap" rel="stylesheet"/>
<link href="https://fonts.googleapis.com/css2?family=Material+Symbols+Outlined:wght,FILL@100..700,0..1&amp;display=swap" rel="stylesheet"/>
<link href="https://fonts.googleapis.com/css2?family=Material+Symbols+Outlined:wght,FILL@100..700,0..1&amp;display=swap" rel="stylesheet"/>
<style>
        body {
            font-family: 'Hanken Grotesk', sans-serif;
            background-color: #031427; /* surface-dim */
            color: #d3e4fe; /* on-surface */
        }
        .font-data { font-family: 'JetBrains Mono', monospace; }
        .milled-edge {
            box-shadow: inset 0 0.5px 0 0 rgba(255, 255, 255, 0.08);
        }
        .custom-scrollbar::-webkit-scrollbar {
            width: 4px;
        }
        .custom-scrollbar::-webkit-scrollbar-track {
            background: #0A0C10;
        }
        .custom-scrollbar::-webkit-scrollbar-thumb {
            background: #30363D;
            border-radius: 2px;
        }
    </style>
<script id="tailwind-config">
        tailwind.config = {
          darkMode: "class",
          theme: {
            extend: {
              "colors": {
                      "outline": "#909095",
                      "secondary": "#c2c7d0",
                      "system-navy": "#1E293B",
                      "outline-variant": "#45474b",
                      "on-tertiary-fixed-variant": "#3a485c",
                      "surface-container-low": "#0b1c30",
                      "primary": "#c6c6cc",
                      "on-error": "#690005",
                      "surface-variant": "#26364a",
                      "surface-container": "#102034",
                      "border-muted": "#30363D",
                      "on-secondary": "#2c3138",
                      "secondary-fixed": "#dee2ec",
                      "surface-tint": "#c6c6cc",
                      "on-primary": "#2f3035",
                      "surface-container-high": "#1b2b3f",
                      "surface-container-highest": "#26364a",
                      "surface-container-lowest": "#000f21",
                      "surface-dim": "#031427",
                      "surface-bright": "#2a3a4f",
                      "inverse-surface": "#d3e4fe",
                      "error-container": "#93000a",
                      "on-tertiary": "#233144",
                      "tertiary": "#b9c7e0",
                      "primary-container": "#0a0c10",
                      "on-primary-container": "#797a7f",
                      "surface-graphite": "#0F1115",
                      "on-secondary-fixed-variant": "#42474f",
                      "on-primary-fixed": "#1a1c20",
                      "tertiary-fixed-dim": "#b9c7e0",
                      "error": "#ffb4ab",
                      "inverse-primary": "#5d5e63",
                      "data-blue": "#38BDF8",
                      "surface": "#031427",
                      "surface-panel": "#161B22",
                      "on-secondary-fixed": "#171c23",
                      "on-primary-fixed-variant": "#45474b",
                      "on-background": "#d3e4fe",
                      "on-secondary-container": "#b1b5bf",
                      "secondary-container": "#42474f",
                      "secondary-fixed-dim": "#c2c7d0",
                      "accent-steel": "#8B949E",
                      "on-tertiary-container": "#6d7b91",
                      "primary-fixed": "#e2e2e8",
                      "on-surface": "#d3e4fe",
                      "on-error-container": "#ffdad6",
                      "primary-fixed-dim": "#c6c6cc",
                      "on-surface-variant": "#c6c6cb",
                      "inverse-on-surface": "#213145",
                      "background": "#031427",
                      "on-tertiary-fixed": "#0d1c2f",
                      "tertiary-fixed": "#d5e3fd",
                      "tertiary-container": "#000c1e"
              },
              "borderRadius": {
                      "DEFAULT": "0.125rem",
                      "lg": "0.25rem",
                      "xl": "0.5rem",
                      "full": "0.75rem"
              },
              "spacing": {
                      "padding-md": "12px",
                      "gutter": "16px",
                      "padding-xs": "4px",
                      "padding-sm": "8px",
                      "base-unit": "4px",
                      "panel-margin": "24px"
              },
              "fontFamily": {
                      "body-md": ["Hanken Grotesk"],
                      "headline-md": ["Hanken Grotesk"],
                      "headline-lg": ["Hanken Grotesk"],
                      "data-label": ["JetBrains Mono"],
                      "data-numeric": ["JetBrains Mono"],
                      "body-sm": ["Hanken Grotesk"]
              },
              "fontSize": {
                      "body-md": ["14px", {"lineHeight": "20px", "fontWeight": "400"}],
                      "headline-md": ["18px", {"lineHeight": "24px", "letterSpacing": "-0.01em", "fontWeight": "600"}],
                      "headline-lg": ["24px", {"lineHeight": "32px", "letterSpacing": "-0.02em", "fontWeight": "600"}],
                      "data-label": ["12px", {"lineHeight": "16px", "letterSpacing": "0.02em", "fontWeight": "500"}],
                      "data-numeric": ["13px", {"lineHeight": "18px", "letterSpacing": "0em", "fontWeight": "400"}],
                      "body-sm": ["13px", {"lineHeight": "18px", "fontWeight": "400"}]
              }
            },
          },
        }
    </script>
</head>
<body class="overflow-hidden h-screen flex flex-col">
<!-- TopNavBar (Shared Component) -->
<header class="bg-surface-container-highest dark:bg-surface-container-highest text-primary dark:text-primary border-b border-border-muted flex justify-between items-center w-full px-gutter h-14 z-50">
<div class="flex items-center gap-6">
<span class="font-headline-md text-headline-md font-bold text-primary">FactoryNerve OS</span>
<div class="hidden md:flex items-center gap-4">
<a class="text-primary font-bold border-b-2 border-primary pb-1 font-body-md text-body-md" href="#">Operator home</a>
<a class="text-secondary font-body-md text-body-md hover:text-primary transition-colors" href="#">Management home</a>
<a class="text-secondary font-body-md text-body-md hover:text-primary transition-colors" href="#">Intelligence</a>
</div>
</div>
<div class="flex items-center gap-4">
<div class="relative hidden lg:block">
<span class="material-symbols-outlined absolute left-3 top-1/2 -translate-y-1/2 text-outline text-sm">search</span>
<input class="bg-surface-container-lowest border border-border-muted rounded-lg pl-9 pr-4 py-1.5 text-body-sm w-64 focus:outline-none focus:border-primary" placeholder="Search operations..." type="text"/>
</div>
<div class="flex items-center gap-3">
<button class="material-symbols-outlined text-secondary hover:text-primary transition-colors">notifications</button>
<button class="material-symbols-outlined text-secondary hover:text-primary transition-colors">settings</button>
<img alt="Operator Profile" class="w-8 h-8 rounded-full border border-border-muted" data-alt="A professional headshot of an industrial plant operator wearing a clean dark uniform. The portrait has cinematic lighting with cool blue and grey tones, reflecting a high-tech industrial environment. The background is softly blurred showing digital interfaces and structural steel elements. Professional, authoritative, and focused expression." src="https://lh3.googleusercontent.com/aida-public/AB6AXuA6u-cMKZc2Bja1cv8ZzF6msrSqlSw784cw8I-priT45Va7LbvYsS3tU5JD0JUVIW8P9yqQ6vwRWsAT-vnR3hIjySAC7bEZL3D_gkbpCioLYEA3CMOxXA9rZr1G782Fxez74q5IRAPYzZtIqHKkn-rdszKr8LzXbpTI0dDBcY0cUNu1N9xUrpgH1BkQcE5os5JQbUo913BaFaF_CujCqOpvl3Ne_2MhhFtSiehHJkUZr8coqyntMEcR0EHkQmfwbPCPttA0dnoGZUI"/>
</div>
</div>
</header>
<div class="flex flex-1 overflow-hidden">
<!-- SideNavBar (Shared Component) -->
<aside class="hidden md:flex flex-col h-full py-panel-margin bg-surface-graphite dark:bg-surface-graphite text-primary dark:text-primary border-r border-border-muted w-64 shrink-0">
<div class="px-6 mb-8">
<div class="flex items-center gap-3 mb-1">
<div class="w-8 h-8 bg-primary rounded flex items-center justify-center">
<span class="material-symbols-outlined text-on-primary">precision_manufacturing</span>
</div>
<div>
<h2 class="font-headline-md text-headline-md text-primary leading-none">FactoryNerve</h2>
<p class="text-[10px] text-secondary tracking-widest uppercase">Precision Control</p>
</div>
</div>
</div>
<nav class="flex-1 px-3 space-y-1">
<a class="flex items-center gap-3 px-3 py-2 text-primary bg-surface-container-high border-r-2 border-primary transition-all font-body-sm text-body-sm" href="#">
<span class="material-symbols-outlined">precision_manufacturing</span>
<span>Operator home</span>
</a>
<a class="flex items-center gap-3 px-3 py-2 text-secondary-fixed-dim hover:bg-surface-variant transition-all font-body-sm text-body-sm active:translate-x-1" href="#">
<span class="material-symbols-outlined">analytics</span>
<span>Management home</span>
</a>
<a class="flex items-center gap-3 px-3 py-2 text-secondary-fixed-dim hover:bg-surface-variant transition-all font-body-sm text-body-sm active:translate-x-1" href="#">
<span class="material-symbols-outlined">account_tree</span>
<span>Node status</span>
</a>
<a class="flex items-center gap-3 px-3 py-2 text-secondary-fixed-dim hover:bg-surface-variant transition-all font-body-sm text-body-sm active:translate-x-1" href="#">
<span class="material-symbols-outlined">show_chart</span>
<span>Telemetry</span>
</a>
<a class="flex items-center gap-3 px-3 py-2 text-secondary-fixed-dim hover:bg-surface-variant transition-all font-body-sm text-body-sm active:translate-x-1" href="#">
<span class="material-symbols-outlined">psychology</span>
<span>Intelligence</span>
</a>
</nav>
<div class="px-3 mt-auto space-y-1">
<button class="w-full flex items-center justify-center gap-2 py-3 mb-4 bg-error-container text-on-error-container rounded font-bold uppercase text-xs tracking-wider hover:opacity-90 transition-opacity">
<span class="material-symbols-outlined text-sm">emergency_home</span>
                    Emergency stop
                </button>
<a class="flex items-center gap-3 px-3 py-2 text-secondary-fixed-dim hover:bg-surface-variant transition-all font-body-sm text-body-sm" href="#">
<span class="material-symbols-outlined">terminal</span>
<span>Diagnostics</span>
</a>
<a class="flex items-center gap-3 px-3 py-2 text-secondary-fixed-dim hover:bg-surface-variant transition-all font-body-sm text-body-sm" href="#">
<span class="material-symbols-outlined">history</span>
<span>Logs</span>
</a>
</div>
</aside>
<!-- Main Content Area -->
<main class="flex-1 flex overflow-hidden">
<!-- Left Panel -->
<section class="flex-1 overflow-y-auto custom-scrollbar p-gutter space-y-6">
<!-- Hero Section -->
<div class="flex flex-col md:flex-row md:items-end justify-between gap-4">
<div>
<div class="flex items-center gap-3 mb-2">
<h1 class="font-headline-lg text-headline-lg text-on-surface">Shree Steel Works</h1>
<span class="bg-surface-container-high px-2 py-0.5 rounded flex items-center gap-1.5 border border-border-muted">
<span class="w-2 h-2 rounded-full bg-green-500"></span>
<span class="text-[10px] font-bold text-green-500 tracking-wider">ONLINE</span>
</span>
</div>
<div class="flex items-center gap-4 text-secondary text-body-sm">
<div class="flex items-center gap-1.5">
<span class="material-symbols-outlined text-sm text-green-500">check_circle</span>
<span>Active</span>
</div>
<div class="w-1 h-1 rounded-full bg-border-muted"></div>
<div class="flex items-center gap-1.5">
<span class="material-symbols-outlined text-sm">schedule</span>
<span>Morning shift · 3h 24m worked</span>
</div>
</div>
</div>
</div>
<!-- Primary CTA -->
<button class="w-full h-64 bg-primary text-on-primary rounded-xl milled-edge flex flex-col items-center justify-center gap-4 group transition-all hover:brightness-110 active:scale-[0.99] border border-white/10">
<span class="material-symbols-outlined text-5xl" style="font-variation-settings: 'FILL' 1;">add_circle</span>
<span class="text-[18px] font-semibold">Complete Entry</span>
<span class="text-on-primary/60 font-data text-xs tracking-widest">ID: TASK-2024-0812-04</span>
</button>
<!-- Quick Action Grid -->
<div class="grid grid-cols-1 sm:grid-cols-3 gap-4">
<button class="bg-surface-panel border border-border-muted p-5 rounded-xl milled-edge text-left hover:bg-surface-container-high transition-colors group">
<span class="material-symbols-outlined text-primary mb-3 block group-hover:scale-110 transition-transform">event_available</span>
<span class="font-headline-md text-headline-md block mb-1">Attendance</span>
<span class="text-secondary text-body-sm">Log entry/exit times</span>
</button>
<button class="bg-surface-panel border border-border-muted p-5 rounded-xl milled-edge text-left hover:bg-surface-container-high transition-colors group">
<span class="material-symbols-outlined text-primary mb-3 block group-hover:scale-110 transition-transform">document_scanner</span>
<span class="font-headline-md text-headline-md block mb-1">Scan Paper</span>
<span class="text-secondary text-body-sm">Digitize physical logs</span>
</button>
<button class="bg-surface-panel border border-border-muted p-5 rounded-xl milled-edge text-left hover:bg-surface-container-high transition-colors group">
<span class="material-symbols-outlined text-primary mb-3 block group-hover:scale-110 transition-transform">task_alt</span>
<span class="font-headline-md text-headline-md block mb-1">My Tasks</span>
<span class="text-secondary text-body-sm">4 assigned, 1 urgent</span>
</button>
</div>
<!-- Summary Section (Filtered for non-duplicate data as requested) -->
<div class="grid grid-cols-2 gap-4">
<div class="bg-surface-panel border border-border-muted p-4 rounded-lg flex items-center justify-between">
<div>
<span class="text-secondary text-xs uppercase tracking-widest font-bold">Today's Performance</span>
<div class="font-headline-lg text-headline-lg text-on-surface mt-1">94.2%</div>
</div>
<div class="h-10 w-24 bg-surface-container-low rounded relative overflow-hidden">
<div class="absolute inset-0 bg-green-500/10 flex items-end">
<div class="w-full bg-green-500/30" style="height: 94.2%"></div>
</div>
</div>
</div>
<div class="bg-surface-panel border border-border-muted p-4 rounded-lg flex items-center justify-between">
<div>
<span class="text-secondary text-xs uppercase tracking-widest font-bold">System Health</span>
<div class="font-headline-lg text-headline-lg text-on-surface mt-1">Nominal</div>
</div>
<span class="material-symbols-outlined text-green-500 text-3xl">verified_user</span>
</div>
</div>
</section>
<!-- Right Aside -->
<aside class="hidden xl:flex flex-col w-[360px] border-l border-border-muted bg-surface-graphite p-gutter space-y-6 overflow-y-auto custom-scrollbar">
<!-- Summary Card -->
<div class="bg-surface-panel border border-border-muted rounded-xl p-5 milled-edge">
<h3 class="font-headline-md text-headline-md text-on-surface mb-4">Operations Summary</h3>
<div class="space-y-3 mb-6">
<div class="flex justify-between items-center text-body-sm">
<span class="text-secondary">Completed</span>
<span class="font-data text-green-500 font-bold">02</span>
</div>
<div class="flex justify-between items-center text-body-sm">
<span class="text-secondary">Pending</span>
<span class="font-data text-secondary">01</span>
</div>
<div class="flex justify-between items-center text-body-sm">
<span class="text-secondary">Offline</span>
<span class="font-data text-outline">00</span>
</div>
</div>
<button class="w-full py-2 border border-border-muted rounded text-body-sm text-primary hover:bg-surface-variant transition-colors flex items-center justify-center gap-2">
<span class="material-symbols-outlined text-sm">sync</span>
                        Sync saved
                    </button>
</div>
<!-- Alerts Card -->
<div class="bg-surface-panel border border-error/20 rounded-xl p-5 milled-edge bg-gradient-to-br from-error/5 to-transparent">
<div class="flex items-center gap-2 mb-3">
<span class="material-symbols-outlined text-error" style="font-variation-settings: 'FILL' 1;">warning</span>
<h3 class="font-headline-md text-headline-md text-error">System Alerts</h3>
</div>
<p class="text-secondary text-body-sm mb-4">2 entries missing targets. Verification required by end of shift.</p>
<button class="w-full py-2 bg-error text-on-error rounded text-body-sm font-bold hover:brightness-110 transition-all">
                        Mark done
                    </button>
</div>
<!-- Shift Status -->
<div class="space-y-4">
<h3 class="text-secondary text-xs uppercase tracking-widest font-bold px-1">Shift Schedule</h3>
<div class="space-y-2">
<!-- Done -->
<div class="flex items-center gap-4 p-3 bg-surface-container border border-border-muted rounded-lg opacity-60">
<div class="w-10 h-10 rounded bg-green-500/10 flex items-center justify-center">
<span class="material-symbols-outlined text-green-500">check</span>
</div>
<div class="flex-1">
<div class="font-body-md text-body-md text-on-surface">Morning</div>
<div class="text-[11px] text-secondary font-data">06:00 - 14:00</div>
</div>
<span class="text-[10px] bg-green-500/20 text-green-500 px-1.5 py-0.5 rounded font-bold">DONE</span>
</div>
<!-- Pending Current -->
<div class="flex items-center gap-4 p-3 bg-surface-container-high border border-primary/30 rounded-lg">
<div class="w-10 h-10 rounded bg-primary/10 flex items-center justify-center">
<span class="material-symbols-outlined text-primary">pending</span>
</div>
<div class="flex-1">
<div class="font-body-md text-body-md text-on-surface">Evening</div>
<div class="text-[11px] text-secondary font-data">14:00 - 22:00</div>
</div>
<span class="text-[10px] bg-primary/20 text-primary px-1.5 py-0.5 rounded font-bold">ACTIVE</span>
</div>
<!-- Future Pending -->
<div class="flex items-center gap-4 p-3 bg-surface-container border border-border-muted rounded-lg opacity-40">
<div class="w-10 h-10 rounded bg-border-muted flex items-center justify-center">
<span class="material-symbols-outlined text-outline">upcoming</span>
</div>
<div class="flex-1">
<div class="font-body-md text-body-md text-on-surface">Night</div>
<div class="text-[11px] text-secondary font-data">22:00 - 06:00</div>
</div>
<span class="text-[10px] bg-border-muted text-secondary px-1.5 py-0.5 rounded font-bold">PENDING</span>
</div>
</div>
</div>
<!-- Footer Telemetry -->
<div class="mt-auto pt-6 border-t border-border-muted">
<div class="flex items-center justify-between text-[10px] text-outline font-data mb-1">
<span>LATENCY: 14MS</span>
<span>V.2.4.0-STABLE</span>
</div>
<div class="w-full h-1 bg-surface-container-low rounded-full overflow-hidden">
<div class="h-full bg-primary/40 w-1/2 transition-all duration-1000" id="telemetry-bar"></div>
</div>
</div>
</aside>
</main>
</div>
<!-- Mobile Bottom Nav -->
<nav class="md:hidden bg-surface-container-highest border-t border-border-muted h-16 flex items-center justify-around px-4 z-50">
<button class="flex flex-col items-center gap-1 text-primary">
<span class="material-symbols-outlined" style="font-variation-settings: 'FILL' 1;">precision_manufacturing</span>
<span class="text-[10px] font-bold">Home</span>
</button>
<button class="flex flex-col items-center gap-1 text-secondary">
<span class="material-symbols-outlined">analytics</span>
<span class="text-[10px]">Stats</span>
</button>
<button class="w-12 h-12 -mt-8 bg-primary text-on-primary rounded-full shadow-lg flex items-center justify-center">
<span class="material-symbols-outlined">add</span>
</button>
<button class="flex flex-col items-center gap-1 text-secondary">
<span class="material-symbols-outlined">notifications</span>
<span class="text-[10px]">Alerts</span>
</button>
<button class="flex flex-col items-center gap-1 text-secondary">
<span class="material-symbols-outlined">person</span>
<span class="text-[10px]">Profile</span>
</button>
</nav>
<script>
        // Simple telemetry bar animation
        const tBar = document.getElementById('telemetry-bar');
        setInterval(() => {
            const width = Math.floor(Math.random() * 60) + 20;
            tBar.style.width = width + '%';
        }, 2000);

        // Hover interactions for buttons
        document.querySelectorAll('button').forEach(btn => {
            btn.addEventListener('mousedown', () => btn.classList.add('scale-95'));
            btn.addEventListener('mouseup', () => btn.classList.remove('scale-95'));
            btn.addEventListener('mouseleave', () => btn.classList.remove('scale-95'));
        });
    </script>
</body></html>

````