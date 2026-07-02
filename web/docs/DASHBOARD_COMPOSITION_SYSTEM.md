# DPR.ai Dashboard Composition System Specification v1.0

**Date:** June 9, 2026  
**Author:** Dashboard Composition System (Sub-Phase D output)  
**Inputs:** 
- Composition Governance Specification v1.0 (Sub-Phase B — `COMPOSITION_GOVERNANCE_SPEC_v1.md`)
- Cognitive Flow Architecture Specification v1.0 (Sub-Phase C — `COGNITIVE_FLOW_ARCHITECTURE.md`)
- All dashboard page implementations in `web/src/features/dashboard/`

**Purpose:** Define structural governance for all DPR.ai dashboards — metric priority classification, grid composition rules, metric card component hierarchy, and the DashboardLayout container that enforces them architecturally.

---

## Table of Contents

1. [Dashboard Inventory: Pages, Roles, and Current Metrics](#1-dashboard-inventory)
2. [Task 1: Metric Priority Classification System](#2-task-1-metric-priority-classification-system)
3. [Task 2: Dashboard Grid Composition Rules](#3-task-2-dashboard-grid-composition-rules)
4. [Task 3: MetricCard Component Hierarchy](#4-task-3-metriccard-component-hierarchy)
5. [Task 4: DashboardLayout Component Specification](#5-task-4-dashboardlayout-component-specification)
6. [Appendix: All Metrics Register](#6-appendix-all-metrics-register)

---

## 1. Dashboard Inventory: Pages, Roles, and Current Metrics

### 1.1 Dashboard Pages in the Application

| Page | Route | Component | Target Roles | Current Status |
|------|-------|-----------|-------------|----------------|
| **Main Dashboard** | `/dashboard` | `DashboardHome` in `dashboard-home-workspace.tsx` | Manager, Admin, Owner (non-operator) | Active — KPIs component returns `null` (empty) |
| **Operator Dashboard** | `/(workspace)/` | `OperatorDashboardWorkspace` in `operator-dashboard-workspace.tsx` | Operator | Active — shift-focused |
| **Premium Dashboard** | `/premium/dashboard` | Lives at `premium/dashboard/page.tsx` with `premium-dashboard-page.tsx` in deprecated | Owner | Active |
| **Steel Control Dashboard** | `/steel` | Embedded in `steel-command-center-page.tsx` using `IndustrialDashboardData` | Manager, Owner (steel industry) | Active — richest metric set |

### 1.2 Role-to-Dashboard Mapping

| Role | Home Dashboard | Primary Dashboard Purpose | Dashboard Page |
|------|--------------|--------------------------|----------------|
| **Operator** | "today-board" → `/dashboard` | Shift completion, attendance punch, quick tasks | Operator Dashboard |
| **Supervisor** | "approvals" → `/approvals` | Review queue, approvals — no operational dashboard as primary | Main Dashboard (secondary) |
| **Accountant** | "reports-exports" → `/reports` | Reports, invoices — no operational dashboard as primary | Main Dashboard (secondary) |
| **Manager** | "today-board" → `/dashboard` | Operational status, approvals, reports, steel hub | Main Dashboard |
| **Admin** | "factory-admin" → `/settings` | Factory settings, attendance admin — dashboard for health overview | Main Dashboard |
| **Owner** | "owner-desk" → `/premium/dashboard` | Risk, summary, money exposure, factory network | Premium Dashboard, Steel Dashboard |

### 1.3 Current Metrics by Dashboard

#### Main Dashboard (`/dashboard`) — Metrics from `DashboardData` interface

| Metric ID | Metric | Data Source | Current Visual Treatment | Current Location |
|-----------|--------|------------|-------------------------|-----------------|
| `anomalyPreview` | AI anomaly preview | `getAnomalyPreview()` | `DashboardIntelligence` (returns null) | Right rail |
| `attendanceToday` | Today's attendance status | `getMyAttendanceToday()` | `DashboardReminders` (returns null) | Body |
| `alerts` | Unread operational alerts | `listUnreadAlerts()` | `DashboardReminders` + `DashboardFeed` (both null) | Body |
| `usage` | AI/plan usage summary | `getUsage()` | `DashboardIntelligence` (returns null) | Right rail |
| `weeklyAnalytics` | Weekly production/attendance trend | `getWeeklyAnalytics()` | `DashboardIntelligence` (returns null) | Right rail |
| `entries` | Today's production entries | `listEntries()` | `DashboardWorkflows` + `DashboardFeed` (both null) | Left column |
| `ocrSummary` | OCR verification summary | `getOcrVerificationSummary()` | `DashboardReminders` (returns null) | Body |

**⚠️ Critical finding:** All four dashboard sub-components (`DashboardKpis`, `DashboardIntelligence`, `DashboardFeed`, `DashboardReminders`, `DashboardWorkflows`) currently return `null`. The Main Dashboard renders empty placeholder sections. This specification defines the structural container; the data wiring is a separate concern.

#### Operator Dashboard — Metrics from `OperatorDashboardWorkspaceProps`

| Metric ID | Metric | Current Visual Treatment | H-Level |
|-----------|--------|------------------------|---------|
| `factoryName` | Factory name | H0 metric strip item | H0 |
| `completedShifts` | Completed shifts count | H0 metric strip item, sidebar stat | H0, H2 |
| `pendingShifts` | Pending shifts count | H0 metric strip item, sidebar stat | H0, H2 |
| `queueCount` | Offline queue count | H0 metric strip item, sidebar stat | H0, H2 |
| `workerStatus` | Worker status (label + tone) | H0 tone badge + SectionPanel | H0, H1 |
| `workerPrimaryAction` | Primary shift action | SectionPanel with CTA link | H1 |
| `workerQuickActions` | Quick action links | SectionPanel grid of links | H2 |
| `alerts` | Unread alerts | Sidebar SectionPanel + GlassPanel | H2 |
| `todayShiftCards` | Per-shift completion status | Sidebar SectionPanel | H2 |
| `online` | Connection status | H0 status badge | H0 |
| `status/error` | Banner messages | GlassPanel banners | H0/H1 |

#### Steel Dashboard (`/steel`) — Metrics from `IndustrialDashboardData`

| Metric ID | Metric | Tier Classification | Current Visual |
|-----------|--------|--------------------|----------------|
| `totalStock` | Total Stock (KG) | Summary KPI card | Card with severity |
| `todayProduction` | Today Production (KG) | Summary KPI card | Card with trend |
| `todayLoss` | Today Loss (KG) | Summary KPI card | Card with severity (primary) |
| `todayRevenue` | Today Revenue (INR) | Summary KPI card | Card with trend |
| `productionLoss` | Production vs Loss chart | Chart card | ProductionLossChart |
| `inventoryLevels` | Inventory by category | Chart card | InventoryLevelsChart |
| `topLossBatches` | Top 5 loss batches | Chart/list card | TopLossBatchesChart |
| `dispatchTrend` | Dispatch weight trend | Chart card | DispatchTrendChart |
| `revenueTrend` | Revenue over time | Chart card | RevenueChart |
| `kpiRows` | Monthly KPI comparison table | Table card | IndustrialKpiTable |
| `donutSummary` | Loss severity mix | Donut chart (in SmartInsights) | DonutChart |
| `smartInsights` | AI-generated insights | Insight cards | SmartInsightsPanel |

---

## 2. Task 1: Metric Priority Classification System

### 2.1 The Three Tiers

Every metric displayed on any DPR.ai dashboard MUST be classified into one of three priority tiers. These tiers govern visual weight, position, and size across all dashboards.

#### Tier 1 — Critical

| Property | Value |
|----------|-------|
| **Definition** | Metrics that, when in an anomalous state, require immediate operator action. If this number is wrong, something is broken or at risk. |
| **Visual weight** | Full card weight. Spans 2 grid columns (`col-span-2`). Largest value display (2.5× base). High-contrast value. |
| **Anomaly state** | **Structural change required** — not just a color change. Elevated surface (Surface 2→3), border weight increases (0.5px → 2px), value size increases 20%, prominent indicator icon. |
| **Maximum per dashboard** | **3** |
| **Drilldown** | Every Tier 1 card MUST have a direct navigation link to the detail page for investigation. No dead-end anomalies. |

**DPR.ai Tier 1 metrics:**
| Metric | Why Critical | Appears On |
|--------|-------------|------------|
| Today Loss (when anomalous) | Yield loss = direct cost. Critical anomalies need immediate investigation. | Steel Dashboard |
| Active critical alerts count | Operator must know about failures in progress. | Main Dashboard |
| OCR queue backlog beyond threshold | Pending verifications block downstream workflows. | Main Dashboard (OCR) |
| Total Stock (when critically low) | Stockout stops production. Immediate action required. | Steel Dashboard |

#### Tier 2 — Standard

| Property | Value |
|----------|-------|
| **Definition** | Metrics that operators check regularly but that do not require immediate action when anomalous. These inform decisions, not emergencies. |
| **Visual weight** | Standard card weight. 1 grid column (`col-span-1`). Medium value display (1.5× base). Normal contrast. |
| **Anomaly state** | **Color indicator only** — threshold tone (success/warning/danger badge). No structural change. |
| **Maximum per dashboard** | **6** (Tier 1 + Tier 2 combined must not exceed **9** total — Tier 2 fills the remaining slots after Tier 1 allocation) |
| **Drilldown** | Optional — navigation link recommended but not required. |

**DPR.ai Tier 2 metrics:**
| Metric | Why Standard | Appears On |
|--------|-------------|------------|
| Today Production (KG) | Core operational metric — checked regularly, informs decisions | Steel Dashboard |
| Total Stock (normal state) | Core operational metric — checked regularly | Steel Dashboard |
| Today Revenue (INR) | Commercial metric — informs decisions | Steel Dashboard |
| Completed shifts count | Productivity metric — checked regularly | Operator Dashboard |
| Pending shifts count | Work remaining — informs decisions | Operator Dashboard |
| Queue count | Operational hygiene — checked regularly | Operator Dashboard |
| Weekly production % | Trend metric — checked regularly | Main Dashboard |
| Attendance % | People metric — checked regularly | Main Dashboard |
| AI usage/quota | Plan context — checked occasionally | Main Dashboard |
| OCR summary | Pending verifications count | Main Dashboard |

#### Tier 3 — Context

| Property | Value |
|----------|-------|
| **Definition** | Supporting metrics that provide background operational context. Operators consult these occasionally, not at every dashboard visit. |
| **Visual weight** | Reduced. Nested or paired grid (2 per column, `col-span-1` each in a 2-column sub-grid). Small value (base font size). Muted color. |
| **Anomaly state** | **None** — no anomaly highlighting. Context metrics are reference only. |
| **Maximum per dashboard** | **6** (total across all three tiers: **12 metric cards maximum**) |
| **Drilldown** | Prohibited — no navigation links from Tier 3 metrics. |

**DPR.ai Tier 3 metrics:**
| Metric | Why Context | Appears On |
|--------|-------------|------------|
| Historical averages | Reference — consulted occasionally | Steel Dashboard |
| Top loss batches list | Reference — operator checks after seeing anomaly | Steel Dashboard |
| Non-urgent running totals | Reference — supplementary context | Steel Dashboard |
| Revenue trend (monthly) | Reference — consulted for comparison | Steel Dashboard |
| Alert history (non-critical) | Reference — consulted occasionally | Operator Dashboard |
| Factory name | Identification — not a decision metric | Operator Dashboard |

### 2.2 Overflow Rule

**If more than 12 metric cards are needed, the additional metrics belong on a linked analytics page, not the dashboard itself.**

The dashboard communicates **status**. Analytics pages communicate **data**. If a metric does not help answer "is everything OK right now?", it does not belong on the dashboard.

### 2.3 Tier Assignment Process

For every new dashboard metric:
1. **Does this metric, when anomalous, require immediate operator action?** → Tier 1
2. **Is this metric checked regularly and informs operational decisions?** → Tier 2
3. **Is this metric reference/context only, consulted occasionally?** → Tier 3
4. **Does this metric answer "is everything OK right now?"** → Belongs on dashboard
5. **If no to #4** → Belongs on analytics page, not dashboard

### 2.4 Priority Classification Register — All Dashboards

#### Main Dashboard (`/dashboard`)

| Metric | Proposed Tier | Justification | Visual Treatment |
|--------|--------------|---------------|-----------------|
| Active critical alerts count | **Tier 1** | Critical anomalies = immediate action | 2-col wide card, elevated surface on anomaly |
| Anomaly preview | **Tier 1** | AI-detected anomalies = immediate review | 2-col wide card, structural change on anomaly |
| Today's production vs target | **Tier 2** | Core operational check | Standard card, color indicator |
| Attendance today | **Tier 2** | People check, informs decisions | Standard card |
| Weekly production trend | **Tier 2** | Trend check | Standard card |
| AI usage/quota | **Tier 2** | Plan context | Standard card |
| OCR pending verifications | **Tier 2** | Workflow hygiene | Standard card |
| Recent entries feed | **Tier 2** | Activity review | Standard card |
| Alert history (non-critical) | **Tier 3** | Reference only | Paired card, muted |
| Last updated timestamp | **Tier 3** | Context | Text row, muted |

**Count: 2 Tier 1 + 5 Tier 2 + 3 Tier 3 = 10 total (within 12 max)**

#### Operator Dashboard

| Metric | Proposed Tier | Justification | Visual Treatment |
|--------|--------------|---------------|-----------------|
| Worker status / clock-in state | **Tier 1** | If not clocked in, cannot work | 2-col wide card, structural change when not clocked in |
| Pending shifts (if > 0) | **Tier 1** | Incomplete shifts = immediate action | 2-col wide card when pending > 0 |
| Active critical alerts | **Tier 1** | Requires immediate attention | 2-col wide card |
| Completed shifts count | **Tier 2** | Productivity check | Standard card |
| Queue count | **Tier 2** | Offline sync status | Standard card |
| Quick action links | **Tier 2** | Navigation shortcuts | Standard card grid |
| Today shift status cards | **Tier 2** | Per-shift completion | Standard card per shift |
| Factory name | **Tier 3** | Identification | Text, paired |
| Connection status (online/offline) | **Tier 3** | Context | H0 badge only, not a card |

**Count: 3 Tier 1 + 4 Tier 2 + 2 Tier 3 = 9 total (within 12 max)**

#### Steel Dashboard

| Metric | Proposed Tier | Justification | Visual Treatment |
|--------|--------------|---------------|-----------------|
| Today Loss KG (when anomalous) | **Tier 1** | Loss = direct cost, immediate action | 2-col wide card, structural anomaly change |
| Stock critically low | **Tier 1** | Stockout stops production | 2-col wide card, structural anomaly change |
| Today Production KG | **Tier 2** | Core operational metric | Standard card |
| Total Stock KG (normal) | **Tier 2** | Regular operational check | Standard card |
| Today Revenue INR | **Tier 2** | Commercial metric | Standard card |
| Dispatch KG (current window) | **Tier 2** | Logistics metric | Standard card |
| Smart Insights | **Tier 2** | AI decision prompts | Standard insight cards |
| Production vs Loss chart | **Tier 2** | Trend visualization | Standard chart card |
| KPI comparison table | **Tier 2** | Monthly review | Standard table card |
| Inventory levels chart | **Tier 2** | Stock health | Standard chart card |
| Top loss batches list | **Tier 3** | Reference for investigation | Paired, muted |
| Revenue trend (monthly) | **Tier 3** | Historical reference | Paired, muted |

**Count: 2 Tier 1 + 8 Tier 2 + 2 Tier 3 = 12 total (at 12 max — no room for additional metrics)**

---

## 3. Task 2: Dashboard Grid Composition Rules

### 3.1 The Five Rules

#### Rule 1: The First Zone Is Always Sparse

The first visual zone of every dashboard MUST be the H0 orientation zone — a sparse status summary readable in under 3 seconds. This is governed by Sub-Phase B (H0 contract) and Sub-Phase C (Orient stage of the Dashboard flow model).

**This zone contains exactly:**
- Overall system health indicator (green / warning / critical) — implemented as `tone` prop on `WorkstationShell`
- Count of items requiring immediate action (can be zero) — implemented as `toneLabel` or metric strip item
- Timestamp of last data refresh — implemented as detail text on a metric strip item

**This zone does NOT contain:**
- A metric card grid — that belongs in H1
- Filter controls — those belong in H2
- Navigation links — those belong in the sidebar

**Visual specification:**
```
┌─────────────────────────────────────────────────────────────────┐
│   TODAY    ● Live    Manager flow: Use the operations board... │
│   Home                                                          │
│   Quick operational context                                     │
│                                                                │
│   [Critical alerts: 2 ▲  ] [Production: 1,480 KG ✓] [Live]     │
└─────────────────────────────────────────────────────────────────┘
  Height: ~100px (with metric strip), ~60px (title + status only)
  Surface: 0 (bare)
  Density: Sparse
```

#### Rule 2: The 2-3-2 Density Rhythm

Dashboard metric sections follow a 2-3-2 rhythm. A flat equal-column grid from top to bottom is PROHIBITED.

```
┌─────────────────────────────────────────────────────────────────┐
│ H0: Status zone (Sparse)                                        │
├─────────────────────────────────────────────────────────────────┤
│                                                                  │
│ Tier 1 Row (2-wide cards)                                       │
│ ┌──────────────────────────────┐  ┌────────────────────────────┐│
│ │ Active Anomaly               │  │ Today Loss                 ││
│ │ CRITICAL                     │  │ WATCH                      ││
│ │ 3 items requiring action     │  │ 142 KG (↑ 9.7%)           ││
│ │ [Investigate →]              │  │ [Risk Lane →]              ││
│ └──────────────────────────────┘  └────────────────────────────┘│
│                         Breathing (48px)                        │
│ Tier 2 Row (3-standard cards)                                   │
│ ┌────────────────┐ ┌────────────────┐ ┌────────────────────────┐│
│ │ Production     │ │ Total Stock    │ │ Revenue                ││
│ │ 1,480 KG       │ │ 9,840 KG      │ │ INR 78,400             ││
│ │ +6.2% vs yest  │ │ Stable        │ │ +4.9% vs yesterday     ││
│ └────────────────┘ └────────────────┘ └────────────────────────┘│
│                         Structural (24px)                       │
│ Tier 3 Context Row (2-column sub-grid)                          │
│ ┌─────────────┐ ┌─────────────┐   ┌─────────────┐ ┌──────────┐ │
│ │ Top Loss    │ │ Loss Trend  │   │ Rev Trend   │ │ Inv.     │ │
│ │ Batch A     │ │ Chart       │   │ Chart       │ │ Levels   │ │
│ └─────────────┘ └─────────────┘   └─────────────┘ └──────────┘ │
└─────────────────────────────────────────────────────────────────┘
```

**Exact column proportions:**
- **Tier 1 row:** `grid-cols-2` — each card spans 1 column (50% each)
- **Tier 2 row:** `grid-cols-3` — each card spans 1 column (33% each)
- **Tier 3 row:** `grid-cols-2` — context items grouped in 2-column sub-grids

**Gap values:**
- Between rows: `--rhythm-breathing` (48px) between Tier 1→Tier 2 and Tier 2→Tier 3
- Within rows: `--rhythm-structural` (24px) between cards
- Within Tier 3 sub-grids: `--rhythm-tight` (12px) between paired items

**Min/max card heights:**
- Tier 1 cards: min 120px, max 180px (fixed — do not grow with content)
- Tier 2 cards: min 100px, max 140px (fixed — do not grow with content)
- Tier 3 cards: min 60px, max 100px (fixed — do not grow with content)

#### Rule 3: Maximum Metric Card Count

Maximum **12 metric cards** across all visible sections of a dashboard. This is an architectural hard limit enforced by the `DashboardLayout` component.

If more than 12 metrics are needed, the additional metrics belong on a linked analytics page, NOT the dashboard itself.

| Dashboard | Current Cards | Tier 1 | Tier 2 | Tier 3 | Total | Status |
|-----------|--------------|--------|--------|--------|-------|--------|
| Main Dashboard | 0 (all null) | 2 | 5 | 3 | **10** | ✅ Under limit |
| Operator Dashboard | 8 | 3 | 4 | 2 | **9** | ✅ Under limit |
| Steel Dashboard | 12+ | 2 | 8 | 2 | **12** | ⚠️ At hard limit — any new metric requires removing an existing metric to `/steel/charts` |

#### Rule 4: Charts Obey Hierarchy

Charts in a dashboard must follow strict size hierarchy.

| Chart Position | Minimum Height | Maximum Height | Container |
|---------------|---------------|---------------|-----------|
| Primary (H1) | 320px | 400px | Surface 2 (Card with border) |
| Supporting (H2) | 180px | 200px | Surface 1 (zone tint) |

**Rules:**
- Two charts of equal size side-by-side: allowed ONLY if they represent comparative data (e.g., this week vs. last week, production vs. loss).
- Two charts of different sizes side-by-side: the larger MUST be H1, the smaller MUST be H2. Same-level positioning of different sizes creates false hierarchy.
- Charts in the Tier 1 zone: **prohibited**. Tier 1 is for critical metric cards only, not visualizations.
- Charts in the Tier 2 zone: allowed as standard cards (`col-span-1`).
- Charts in the Tier 3 zone: allowed as muted reference visualizations.

#### Rule 5: No Dashboard Section Expansion

Dashboard sections MUST NOT expand inline (accordion, reveal, expand toggle, show-more).

**Why:** Inline expansion is the primary cause of dashboard compression. It starts with one expandable section, then another, until the dashboard silently grows beyond 12 metrics without any structural governance. The operator never sees the original concise dashboard again.

**If more detail is needed, the path is always: navigate to a detail page.** Every actionable metric card MUST have a direct navigation link (`href`). The action link IS the expansion mechanism.

**Exception:** Time range selectors (today / 7d / 30d) that switch the entire dashboard data context are allowed. These are top-level controls in the H0 zone, not inline section expansions.

### 3.2 Anomaly State Visual Specification

When a Tier 1 metric enters an anomalous state, the change must be **structural**, not just a color change.

| Property | Normal State | Anomaly State |
|----------|-------------|---------------|
| **Surface level** | Surface 2 (Card, standard elevation) | Surface 3 (elevated — slightly raised shadow) |
| **Border width** | `--border-default` (0.5px) | `2px` solid `--status-danger-border` (or `--status-warning-border`) |
| **Value font size** | `text-[var(--type-numeric-lg)]` (1.5× base) | `text-[var(--type-numeric-xl)]` (1.8× base — 20% increase) |
| **Value color** | `text-text-primary` | `text-status-danger-fg` (or `text-status-warning-fg`) |
| **Background** | `--surface-2-background` | Subtle tint from status tone (e.g., `--status-danger-bg` at 10% opacity) |
| **Indicator icon** | None | Icon badge top-right: ⚠️ (warning) or 🚨 (critical) |
| **Trend arrow** | `→` with muted color | `↑` or `↓` with status tone color, bold weight |
| **Animation** | None | Subtle border pulse animation for first 5 seconds after state change |

**Structural change summary (Tier 1 anomaly):**
```
Normal:    [Standard Card, thin border, normal text size, no icon]
Anomaly:   [Elevated Card, THICK BORDER, LARGER VALUE, warning icon, tinted bg]
```

For Tier 2 metrics, the anomaly is communicated by color only:
```
Normal:    [Standard Card, thin border, normal text]
Threshold: [Standard Card, thin border, value in status-tone color, trend badge]
```

### 3.3 Drilldown Path Rule

Every Tier 1 card that shows an anomaly MUST have a direct navigation path to the detail page where the operator can investigate and act. No anomaly on a dashboard should be a dead end.

| Tier 1 Metric Anomaly | Drilldown Destination | Link Text |
|----------------------|----------------------|-----------|
| Loss exceeding threshold | `/steel?tab=risk` | "Open Risk Lane" |
| Active critical alert | `/alerts` or alert detail | "View Alerts" |
| OCR queue backlog | `/ocr/verify` | "Review Queue" |
| Pending shift (operator) | `/entry` | "Start Shift" |
| Unclocked worker | `/attendance` | "Punch In" |

---

## 4. Task 3: MetricCard Component Hierarchy

### 4.1 Three Variant Specifications

#### MetricCard.Critical (Tier 1)

```typescript
interface MetricCardCriticalProps {
  /** REQUIRED — Short metric label. "Today Loss", "Critical Alerts" */
  label: string;
  
  /** REQUIRED — The metric value as a display string. "142 KG", "3 items" */
  value: string;
  
  /** REQUIRED — Current status determines visual treatment */
  status: "normal" | "warning" | "critical";
  
  /** REQUIRED — Navigation path to investigate this metric. Must never be empty. */
  drilldownHref: string;
  
  /** REQUIRED — Link text for the drilldown action. "Open Risk Lane", "View Alerts" */
  drilldownLabel: string;
  
  /** OPTIONAL — Trend direction and percentage. "+9.7%", "-3.8%" */
  trend?: { direction: "up" | "down" | "flat"; value: string };
  
  /** OPTIONAL — Comparison period label. "vs yesterday", "vs last week" */
  comparisonLabel?: string;
  
  /** OPTIONAL — Detail text for additional context */
  helperText?: string;
  
  /** PROHIBITED — Sparklines or trend charts. Too much density for Tier 1. */
  // chart?: never;
}
```

**Layout:**
- Spans 2 grid columns (`col-span-2` on desktop)
- Full card height: 120px–180px
- Two-column layout inside: left column has label + value, right column has drilldown button

**States:**
| State | Border | Surface | Value Size | Indicator | Drilldown |
|-------|--------|---------|-----------|-----------|-----------|
| `normal` | `--border-default` (0.5px) | Surface 2 | `--type-numeric-lg` | None | Primary link |
| `warning` | `--status-warning-border` (1px) | Surface 2 + warning tint | `--type-numeric-lg` | ⚠️ icon | Primary link, elevated |
| `critical` | `--status-danger-border` (2px) | Surface 3 + danger tint | `--type-numeric-xl` (+20%) | 🚨 icon | Primary button, prominent |

**Prohibited in MetricCard.Critical:**
- Sparklines or trend charts (insufficient space, too much density)
- Inline actions (no approve/reject buttons — that belongs in detail page)
- Metric comparison rows (no "vs last week" inside the value — that's a separate Tier 2 metric)

#### MetricCard.Standard (Tier 2)

```typescript
interface MetricCardStandardProps {
  /** REQUIRED */
  label: string;
  /** REQUIRED */
  value: string;
  /** REQUIRED — threshold state */
  status: "normal" | "above-threshold" | "below-threshold";
  /** OPTIONAL — Navigation path. Recommended but not required. */
  drilldownHref?: string;
  drilldownLabel?: string;
  /** OPTIONAL — Trend sparkline (max 40px height, SVG only) */
  sparkline?: { data: number[]; color: string };
  /** OPTIONAL — Comparison value */
  comparisonLabel?: string;
  comparator?: { direction: "up" | "down" | "flat"; value: string };
}
```

**Layout:**
- 1 grid column (`col-span-1`)
- Full card height: 100px–140px
- Compact internal layout: label top-left, value prominent center, trend + comparison bottom

**States:**
| State | Visual Change |
|-------|--------------|
| `normal` | Default card, no special treatment |
| `above-threshold` | Value color changes to `--status-success-fg` (positive) |
| `below-threshold` | Value color changes to `--status-warning-fg` or `--status-danger-fg` |

**Optional elements:**
- Sparkline trend: SVG line chart, max 40px height, positioned below the value
- The sparkline must use a single `<path>` element — no axis, no grid, no labels

#### MetricCard.Context (Tier 3)

```typescript
interface MetricCardContextProps {
  /** REQUIRED */
  label: string;
  /** REQUIRED */
  value: string;
  /** PROHIBITED — No status, no anomaly, no drilldown */
  // status?: never;
  // drilldownHref?: never;
}
```

**Layout:**
- 0.5 grid column (paired: two Tier 3 cards in a single `col-span-1` sub-grid)
- Full card height: 60px–100px
- Minimal layout: label left/above, value right/below, all in muted text
- No border, no card background — Surface 0 (bare text) preferred

**States:**
- `normal` only — no anomalous state, no highlighting
- Text is `text-text-tertiary` (muted) by default

### 4.2 Decision Tree: Which MetricCard Variant?

```
Q1: Does this metric require immediate action when anomalous?
    YES → MetricCard.Critical
    NO  → continue

Q2: Is this metric checked at every dashboard visit?
    YES → MetricCard.Standard
    NO  → continue

Q3: Is this metric reference/context only?
    YES → MetricCard.Context
    NO  → Does this metric belong on the dashboard at all?
          If no → move to analytics page
```

### 4.3 Composition Placement Rules

| Tier | Zone in DashboardLayout | Slot | Can Appear With |
|------|------------------------|------|----------------|
| Tier 1 | `critical` zone | Row 1 (2-wide cards) | Only other Tier 1 cards |
| Tier 2 | `primary` zone | Row 2 (3-column grid) | Only other Tier 2 cards |
| Tier 3 | `context` zone | Row 3 (2-column sub-grid) | Only other Tier 3 cards |
| Charts | `charts` zone | Below metric rows | Only other charts |

**Rule:** A Tier 1 metric can NEVER appear in the `context` zone. A Tier 3 metric can NEVER appear in the `critical` zone. The `DashboardLayout` component enforces this at the structural level.

---

## 5. Task 4: DashboardLayout Component Specification

### 5.1 Purpose

`DashboardLayout` is a governed composition container that enforces dashboard rules at the structural level. It is not a grid utility. It is an architectural enforcement boundary.

### 5.2 Zone Definitions

```
┌─────────────────────────────────────────────────────────────────┐
│  status zone (H0) — REQUIRED, always first, always Sparse      │
│  Accepts: health tone, action item count, refresh timestamp    │
├─────────────────────────────────────────────────────────────────┤
│                                                                  │
│  critical zone (H1) — REQUIRED                                  │
│  Only Tier 1 MetricCard components                              │
│  Renders 2-wide cards in <section data-tier="1">                │
│  Max 3 items — warning if exceeded                              │
│                                                                  │
├─────────────────────────────────────────────────────────────────┤
│                                                                  │
│  primary zone (H1) — REQUIRED                                   │
│  Only Tier 2 MetricCard components                              │
│  Renders 3-column grid in <section data-tier="2">               │
│  Max 6 items — warning if exceeded                              │
│                                                                  │
├─────────────────────────────────────────────────────────────────┤
│                                                                  │
│  context zone (H2) — OPTIONAL                                   │
│  Only Tier 3 MetricCard components                              │
│  Renders 2-column sub-grid in <section data-tier="3">           │
│  Max 6 items — warning if exceeded                              │
│                                                                  │
├─────────────────────────────────────────────────────────────────┤
│                                                                  │
│  charts zone (H2) — OPTIONAL                                    │
│  Chart components only — no metric cards                        │
│  Charts obey height hierarchy (H1 min 320px, H2 max 200px)      │
│                                                                  │
└─────────────────────────────────────────────────────────────────┘
```

### 5.3 Prop Interface

```typescript
interface DashboardLayoutProps {
  /** REQUIRED — Status zone content (renders the H0 orientation zone) */
  status: DashboardStatus;

  /** REQUIRED — Tier 1 metrics (renders 2-wide card row, max 3) */
  critical: MetricCardCriticalProps[];

  /** REQUIRED — Tier 2 metrics (renders 3-column grid, max 6) */
  primary: MetricCardStandardProps[];
  
  /** OPTIONAL — Tier 3 context metrics (renders 2-column sub-grid, max 6) */
  context?: MetricCardContextProps[];

  /** OPTIONAL — Chart sections rendered below metric rows */
  charts?: DashboardChart[];

  /** OPTIONAL — Additional className for custom spacing */
  className?: string;
}

interface DashboardStatus {
  /** System health tone shown in the H0 zone */
  healthTone: "success" | "warning" | "critical";
  /** Count of items requiring immediate action */
  actionItemCount: number;
  /** Label for action items. "items requiring attention" */
  actionItemLabel: string;
  /** ISO timestamp of last data refresh */
  lastRefresh?: string;
}
```

### 5.4 Enforcement Rules

#### Rule Enforcement Matrix

| Rule | Enforced By | Enforcement Mechanism | Dev Warning |
|------|------------|----------------------|-------------|
| 2-3-2 rhythm | Structural zones | Layout renders rows in fixed zone order. Developer cannot reorder. | N/A — structural |
| Max 12 metric cards | Runtime check | Sum of all zone arrays | `console.warn("[DashboardLayout] Maximum 12 metric cards exceeded. Found {n}. Move excess metrics to analytics page.")` |
| Tier-to-zone enforcement | TypeScript + runtime | Props accept only the correct tier type per zone | `console.warn("[DashboardLayout] Tier 3 metric '{label}' found in critical zone. Move to context zone.")` |
| Tier 1 anomaly drilldown | Runtime check | Each critical item with non-normal status must have drilldownHref | `console.warn("[DashboardLayout] Critical metric '{label}' in anomaly state has no drilldown path.")` |
| Chart height hierarchy | Runtime check | Primary chart min 320px, supporting chart max 200px | `console.warn("[DashboardLayout] Chart '{id}' height {n}px violates primary min 320px or supporting max 200px.")` |
| No inline expansion | Structural | DashboardLayout does not accept accordion/reveal props | N/A — structural |

### 5.5 Responsive Behavior

The 2-3-2 rhythm degrades at smaller breakpoints:

#### Desktop (≥1280px)
```
[Tier 1: 2-col] [Tier 1: 2-col]
[Tier 2] [Tier 2] [Tier 2]
[Context] [Context] [Context] [Context]
```

#### Tablet (768px–1279px)
```
[Tier 1: full width]
[Tier 1: full width]    ← each Tier 1 stacks to full width
[Tier 2] [Tier 2]
[Tier 2]                ← Tier 2 becomes 2-col, last item centered or full width
[Context] [Context]
[Context] [Context]     ← Context stays 2-col
```

#### Mobile (<768px)
```
[Tier 1: full width]
[Tier 1: full width]
[Tier 2: full width]    
[Tier 2: full width]    ← all items stack to full width
[Tier 2: full width]
[Context]
[Context]               ← Context items in single column
[Context]
[Context]
```

**Responsive spacing:**
- Desktop gaps: `--rhythm-structural` (24px)
- Tablet gaps: `--rhythm-structural` (24px) between cards, `--rhythm-breathing` (48px) between rows
- Mobile gaps: `--rhythm-structural` (24px) between all items (including between rows)

### 5.6 Chart Zone Specification

The optional `charts` zone accepts an array of chart sections:

```typescript
interface DashboardChart {
  id: string;
  title: string;
  /** "primary" = min 320px, "supporting" = max 200px height */
  weight: "primary" | "supporting";
  /** ReactNode for the chart component */
  render: React.ReactNode;
  /** Span width. Default: 1. Use 2 only for comparative pairs. */
  colSpan?: 1 | 2;
  /** If colSpan is 2, pairLabel describes the comparison. */
  pairLabel?: string;
}
```

**Chart zone layout rules:**
```
Primary chart (weight="primary", colSpan=2)     ← full width, 320px+ height
Supporting chart (weight="supporting", colSpan=1)  ← half width, 200px max
Supporting chart (weight="supporting", colSpan=1)  ← half width, 200px max
```

### 5.7 Development-Mode Warnings

The DashboardLayout component fires the following warnings in development mode:

| Warning | Trigger |
|---------|---------|
| `[DashboardLayout] Maximum 12 metric cards exceeded. Found {n} cards. Move excess to analytics page.` | Sum of all zones > 12 |
| `[DashboardLayout] Tier 3 metric '{label}' found in critical zone. Move to context zone.` | Context-typed item passed to critical array |
| `[DashboardLayout] Critical metric '{label}' in anomaly state has no drilldown path.` | Critical item with `status !== "normal"` but no `drilldownHref` |
| `[DashboardLayout] Chart '{id}' height {n}px violates primary min 320px or supporting max 200px.` | Chart height outside allowed range |
| `[DashboardLayout] Critical zone has {n} items (max 3). Excess items will not render.` | critical array > 3 items |
| `[DashboardLayout] Primary zone has {n} items (max 6). Excess items will not render.` | primary array > 6 items |

### 5.8 Implementation Guidance

- The `DashboardLayout` component wraps `WorkstationShell` internally — it does NOT replace it.
- The `status` zone maps to H0 (ShellHeader with metric strip).
- The `critical` + `primary` zones together form H1.
- The `context` + `charts` zones together form H2.
- All spacing between zones uses `--rhythm-breathing` (48px) per Sub-Phase B Contract 3.
- Within zones, cards use `--rhythm-structural` (24px) gaps.

---

## 6. Appendix: All Metrics Register

### Complete Metric Inventory (All Dashboards)

| # | Metric | Dashboard(s) | Tier | Zone | Component | Card Type | Anomaly Treatment | Drilldown |
|---|--------|-------------|------|------|-----------|-----------|------------------|-----------|
| 1 | Active critical alerts | Main | T1 | critical | MetricCard.Critical | 2-col wide | Structural change (surface+border+size) | `/alerts` |
| 2 | Anomaly preview (AI) | Main | T1 | critical | MetricCard.Critical | 2-col wide | Structural change (surface+border+size) | `/ai` |
| 3 | Worker clock-in status | Operator | T1 | critical | MetricCard.Critical | 2-col wide | Red surface when unclocked | `/attendance` |
| 4 | Pending shifts (>0) | Operator | T1 | critical | MetricCard.Critical | 2-col wide | Warning surface when pending >0 | `/entry` |
| 5 | Active critical alerts | Operator | T1 | critical | MetricCard.Critical | 2-col wide | Structural change | `/alerts` |
| 6 | Loss (anomalous) | Steel | T1 | critical | MetricCard.Critical | 2-col wide | Structural change | `/steel?tab=risk` |
| 7 | Stock critically low | Steel | T1 | critical | MetricCard.Critical | 2-col wide | Structural change | `/steel/reconciliations` |
| 8 | Today production | Main, Steel | T2 | primary | MetricCard.Standard | 1-col | Color indicator | Optional |
| 9 | Attendance today | Main, Operator | T2 | primary | MetricCard.Standard | 1-col | Color indicator | `/attendance` |
| 10 | Weekly production trend | Main | T2 | primary | MetricCard.Standard | 1-col | Color indicator | `/analytics` |
| 11 | AI usage / quota | Main | T2 | primary | MetricCard.Standard | 1-col | Color indicator | `/ai` |
| 12 | OCR pending verifications | Main | T2 | primary | MetricCard.Standard | 1-col | Color indicator | `/ocr/verify` |
| 13 | Recent entries feed | Main | T2 | primary | MetricCard.Standard | 1-col | Color indicator | `/entry` |
| 14 | Completed shifts count | Operator | T2 | primary | MetricCard.Standard | 1-col | Color indicator | — |
| 15 | Queue count | Operator | T2 | primary | MetricCard.Standard | 1-col | Color indicator | — |
| 16 | Shift status cards | Operator | T2 | primary | MetricCard.Standard | 1-col each | Color per status | — |
| 17 | Quick action links | Operator | T2 | primary | MetricCard.Standard | 1-col grid | None | Inline |
| 18 | Total Stock (normal) | Steel | T2 | primary | MetricCard.Standard | 1-col | Color indicator | `/steel?tab=inventory` |
| 19 | Today Revenue | Steel | T2 | primary | MetricCard.Standard | 1-col | Color indicator | `/steel/invoices` |
| 20 | Dispatch KG | Steel | T2 | primary | MetricCard.Standard | 1-col | Color indicator | `/steel/dispatches` |
| 21 | Smart Insights | Steel | T2 | primary | MetricCard.Standard | insight cards | Color per tone | Inline links |
| 22 | Production vs Loss | Steel | T2 | charts | Chart | primary chart (320px) | Chart color change | `/steel?tab=risk` |
| 23 | KPI comparison table | Steel | T2 | primary | Table | standard width | Status badges | — |
| 24 | Inventory levels | Steel | T2 | charts | Chart | supporting (200px) | Chart color change | `/steel?tab=inventory` |
| 25 | Alert history (non-critical) | Main | T3 | context | MetricCard.Context | paired, muted | None | Prohibited |
| 26 | Last updated timestamp | Main | T3 | context | MetricCard.Context | text row | None | Prohibited |
| 27 | Factory name | Operator | T3 | context | MetricCard.Context | paired, muted | None | Prohibited |
| 28 | Connection status | Operator | T3 | context | MetricCard.Context | H0 badge only | None | Prohibited |
| 29 | Top loss batches list | Steel | T3 | context | MetricCard.Context | paired, muted | None | Prohibited |
| 30 | Revenue trend (monthly) | Steel | T3 | context | MetricCard.Context | paired, muted | None | Prohibited |

**Total: 30 metrics across 3 dashboards**
**Max per dashboard: 12 (main dashboard = 10, operator = 9, steel = 12 at limit)**

### Metrics Removed from Dashboard (To Analytics Pages)

| Metric | Reason Removed | Destination Page |
|--------|---------------|-----------------|
| Top loss batches detail view | Reference data, not status | `/steel/charts` |
| Full dispatch trend chart | Historical trend, not current status | `/steel/charts` |
| Revenue trend (detailed monthly) | Historical comparison | `/steel/charts` |
| Production loss chart (all ranges) | Only current window belongs on dashboard | `/steel/charts` |
| KPI comparison table (all rows) | Reference comparison, monthly review | `/steel/charts` |
| Usage breakdown by feature | Detailed plan data | `/settings` |
| Full alert history | Historical log | `/settings` |

### Dashboard Metric Count Validation

| Dashboard | T1 | T2 | T3 | Total | Within 12? |
|-----------|----|----|----|-------|-----------|
| Main Dashboard | 2 | 5 | 3 | **10** | ✅ Yes |
| Operator Dashboard | 3 | 4 | 2 | **9** | ✅ Yes |
| Steel Dashboard | 2 | 8 | 2 | **12** | ⚠️ At exact limit |

### Future Capacity Planning

This section documents the known growth margin and future constraints for each dashboard, so architects can plan metric additions without triggering compression.

| Dashboard | Current Count | Room to Grow | First Action When Full |
|-----------|--------------|-------------|----------------------|
| **Main Dashboard** | 10/12 | **2 slots** | Add a new Tier 2 metric (e.g., "Quality yield %") or Tier 3 context metric. No structural change needed. |
| **Operator Dashboard** | 9/12 | **3 slots** | Add shift-specific Tier 2 metrics. No structural change needed. |
| **Steel Dashboard** | 12/12 | **0 slots — AT CAPACITY** | The next new metric (e.g., "Energy consumption per ton") triggers the overflow rule: an existing metric must be demoted to Tier 3 (paired, muted) or moved to `/steel/charts` before the new metric can be added. |

**Future metric candidates (not yet implemented, but anticipated):**

| Candidate Metric | Likely Dashboard | Proposed Tier | Notes |
|-----------------|-----------------|--------------|-------|
| Quality yield % | Main Dashboard | T2 | Standard operational metric. Fits in remaining 2 slots. |
| Energy consumption / ton | Steel Dashboard | T2 | Requires displacing an existing T2 metric to make room. |
| Operator overtime hours | Operator Dashboard | T3 | Context metric. Fits in remaining 3 slots. |
| OCR accuracy rate | Main Dashboard | T2 | Workflow quality metric. Fits in remaining 2 slots. |
| Supplier delivery reliability | Steel Dashboard | T3 | Reference metric. Fits if a T3 slot is free. |

**Governance rule for adding a new metric:**
1. Check the dashboard's current count against the 12-card limit.
2. If count < 12, assign the metric to the correct tier. Add it.
3. If count = 12, identify the lowest-value existing metric. Either:
   - Demote it to Tier 3 (if currently T2) — frees a T1/T2 slot.
   - Move it to the linked analytics page (if already T3 and a T1/T2 slot is needed).
4. If no existing metric can be demoted or removed without loss, do NOT add the metric. Redesign the dashboard surface instead.
