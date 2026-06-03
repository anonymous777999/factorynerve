# DPR.ai Frontend Modernization Master Blueprint

This document defines the architectural UI/UX blueprint for the frontend modernization of **DPR.ai** (Daily Production Report system). It establishes a unified, dark industrial AI system aesthetic designed specifically for the high-pressure steel manufacturing sector.

---

## Table of Contents
1. [Global Design Identity & Philosophy](#1-global-design-identity--philosophy)
2. [Global Design Tokens](#2-global-design-tokens)
3. [Global Animation Library](#3-global-animation-library)
4. [Steel Factory Atmosphere System](#4-steel-factory-atmosphere-system)
5. [Component Design System](#5-component-design-system)
6. [State & Feedback System](#6-state--feedback-system)
7. [Page-by-Page Specifications](#7-page-by-page-specifications)
   - [Phase A: Access & Auth Workstations](#phase-a-access--auth-workstations)
   - [Phase B: Core Operations Workstations](#phase-b-core-operations-workstations)
   - [Phase C: Document & OCR Pipelines](#phase-c-document--ocr-pipelines)
   - [Phase D: Steel ERP Workstations](#phase-d-steel-erp-workstations)
   - [Phase E: Intelligence & Command Layer](#phase-e-intelligence--command-layer)

---

## 1. GLOBAL DESIGN IDENTITY & PHILOSOPHY

DPR.ai serves operators, furnace engineers, weighbridge inspectors, and plant managers. The system must feel robust, high-precision, and direct. The interface aesthetic is defined as:
> **SpaceX Mission Control x Bloomberg Terminal x Forge.ai**

### Design Principles:
1. **Zero Aesthetic Fluff**: Every visual element must communicate operational state, telemetry details, or system trust.
2. **Context-Aware Density**: Dashboard hubs collapse secondary info, while workstation editors expose inline cells for rapid keyboard traversal.
3. **Calm AI Ambient Cues**: AI signals assist but never distract. Use static, low-profile overlays instead of pulsing glows.

---

## 2. GLOBAL DESIGN TOKENS

These CSS custom properties govern the entire platform.

```css
:root {
  /* Colors - Dark Steel Forge */
  --bg-app: #0D0F12;
  --bg-shell: #111418;
  --surface-panel: #1A1D24;
  --surface-card: #22262F;
  --surface-elevated: #2B303C;
  --border-default: rgba(255, 255, 255, 0.06);
  --border-strong: rgba(255, 255, 255, 0.12);
  
  /* Accents */
  --accent-orange-amber: #F97316; /* Molten Steel */
  --accent-orange-glow: rgba(249, 115, 22, 0.15);
  --accent-blue-electric: #38BDF8; /* Sensor / AI Signal */
  --accent-blue-glow: rgba(56, 189, 248, 0.15);
  
  /* Text */
  --text-primary: #F8FAFC;
  --text-secondary: #94A3B8;
  --text-muted: #64748B;
  
  /* Statuses */
  --status-success-bg: rgba(34, 197, 94, 0.1);
  --status-success-border: #22C55E;
  --status-warning-bg: rgba(245, 158, 11, 0.1);
  --status-warning-border: #F59E0B;
  --status-danger-bg: rgba(239, 68, 68, 0.1);
  --status-danger-border: #EF4444;
  
  /* Spacing Scale (4px Base) */
  --space-1: 4px;
  --space-2: 8px;
  --space-3: 12px;
  --space-4: 16px;
  --space-6: 24px;
  --space-8: 32px;
  
  /* Typography */
  --font-display: 'Barlow Condensed', 'Bebas Neue', sans-serif;
  --font-body: 'DM Sans', sans-serif;
  --font-mono: 'IBM Plex Mono', 'JetBrains Mono', monospace;
  
  /* Transitions */
  --timing-fast: 150ms;
  --timing-default: 300ms;
  --ease-industrial: cubic-bezier(0.16, 1, 0.3, 1); /* Out-quart */
}
```

---

## 3. GLOBAL ANIMATION LIBRARY

| Animation Name | Trigger | CSS/JS Definition | Usage |
|---|---|---|---|
| `fadeSlideUp` | Mount | `transform: translateY(12px); opacity: 0; transition: all 0.4s var(--ease-industrial);` | Content cards loading |
| `glowPulse` | State Loop | `keyframes { 0%, 100% { opacity: 0.4; } 50% { opacity: 1; } }` | Active live data feeds |
| `shimmerSweep` | Loading | `background: linear-gradient(90deg, transparent, rgba(255,255,255,0.03), transparent);` | Skeleton loading state |
| `countUp` | Data Load | JS `requestAnimationFrame` interpolation over 1.2s | Numeric KPI metrics |
| `borderGlow` | Hover | `border-color: var(--accent-orange-amber); box-shadow: 0 0 8px var(--accent-orange-glow);` | Interactive panel focus |
| `scanlineReveal` | Mount | `clip-path: polygon(0 0, 100% 0, 100% 0, 0 0); transition: clip-path 0.6s ease;` | Primary header entrance |
| `modalEntrance`| Mount | `scale(0.95); opacity: 0; transition: all 0.2s cubic-bezier(0.34, 1.56, 0.64, 1);` | Dialog opening |
| `drawerSlideIn`| Mount | `translateY(100%) or translateX(100%); transition: transform 0.3s ease-out;` | Detail slide panels |
| `statusFlash` | Update | `animation: flashGreen 1s ease-out;` | Successful autosave indicator |
| `chartTrace` | Load | `stroke-dashoffset: 0; transition: stroke-dashoffset 1.5s ease-in-out;` | Line chart renders |
| `metricBump` | Update | `transform: scale(1.05); transition: transform 0.1s ease-in;` | Real-time counter ticks |
| `listStagger` | Mount | Stagger delay increment: `80ms * index` | Grid list row mounts |

---

## 4. STEEL FACTORY ATMOSPHERE SYSTEM

To make users feel like they are operating an advanced industrial system, three overlay systems are applied globally:

1. **Background Noise Overlay**: A persistent SVG grain pattern is overlayed on the app wrapper with `mix-blend-mode: overlay` at 2% opacity to give a subtle textured steel feel.
2. **Radial Furnace Glows**: Soft, slow radial gradients are positioned in background corners (e.g. `radial-gradient(circle at 100% 100%, var(--accent-orange-glow), transparent 60%)`) simulating light coming from distant furnaces.
3. **Data Streams**: Monospaced ticker logs and grid lines (rgba(255,255,255,0.015)) render in background layers behind panels.
4. **Scrollbars**: Custom industrial scrollbars: `width: 6px; background: var(--bg-app); thumb: var(--text-muted); thumb-hover: var(--accent-orange-amber)`.

---

## 5. COMPONENT DESIGN SYSTEM

### KPI Metric Card
- **Default State**: Background `var(--surface-card)`, border 1px `var(--border-default)`. Font `var(--font-display)` for values.
- **Hover State**: Border shifts to `var(--border-strong)`. Box shadow adds subtle `var(--accent-blue-glow)`.
- **Active State**: Left-border colored in `var(--accent-orange-amber)`. Background becomes `var(--surface-elevated)`.
- **Loading State**: Displays skeleton fields with `shimmerSweep` animation.

### Data Table
- **Header**: Background `var(--surface-panel)`, font `var(--font-display)` in uppercase sentence case, letter-spacing 0.05em.
- **Row Hover**: Background changes to `var(--surface-elevated)` with a transition duration of `150ms`.
- **Zebra Striping**: Alternating rows receive `background: rgba(255, 255, 255, 0.01)`.

### Form Inputs
- **Default State**: Background `var(--bg-shell)`, border 1px `var(--border-default)`.
- **Focus State**: Border shifts to `var(--accent-blue-electric)` with `borderGlow` shadow active.
- **Error State**: Border shifts to `var(--status-danger-border)` with red background tint.

---

## 6. STATE & FEEDBACK SYSTEM

| State | Visual Treatment |
|---|---|
| **Success** | Green border (`#22C55E`), check icon, green slide-out toast. |
| **Warning** | Amber border (`#F59E0B`), alert icon, warning slide-out toast. |
| **Error** | Red border (`#EF4444`), error icon, red slide-out toast. |
| **Processing** | Spin icon, blue indicator strip (`var(--accent-blue-electric)`) with `glowPulse` active. |
| **Live Sync** | Small green indicator dot pulsing next to "Live Data" text. |

---

## 7. PAGE-BY-PAGE SPECIFICATIONS

---

### Phase A: Access & Auth Workstations

#### LOGIN - ACCESS CONTROL INTAKE
- **What It Does**: Handles user login inputs.
- **Emotional Target**: Operational safety, security, and precision.
- **Layout**: Centered container, maximum width 420px.
- **Color**: Background `var(--bg-app)`, card `var(--surface-card)`. Orange accents on main action.
- **Typography**: Header uses Barlow Condensed, bold, uppercase tracking 0.1em.
- **Animations**: Entrance: centered card fade-slide-up. Odometer ticks on active logins count.
- **Atmosphere**: SVG noise overlay. Background amber furnace glow orb.

#### REGISTER - ACCOUNT PROFILING
- **What It Does**: Direct profile registration page.
- **Emotional Target**: Trust and technical onboarding.
- **Layout**: Centered form, maximum width 480px.
- **Color**: Background `var(--bg-app)`, Card `var(--surface-card)`. Blue accents on indicators.
- **Typography**: sentence case headings, monospace fields.
- **Animations**: Form fields cascade in sequence (`listStagger` delay).

#### FORGOT_PASSWORD & VERIFY_EMAIL
- **What It Does**: Account credential recoveries.
- **Emotional Target**: Calm security.
- **Layout**: Centered card.
- **Color**: Dark surfaces, muted borders.
- **Animations**: Quick fade transition on verify codes.

#### ACCESS & ONBOARDING_FACTORY_REQUIRED
- **What It Does**: Checks active factory profile linkages.
- **Emotional Target**: Gateway clearances.
- **Layout**: Splitscreen options cards list.
- **Color**: Blue-glow accents on selected options.

#### PROFILE & SETTINGS
- **What It Does**: Manage active profiles, factories, and users lists.
- **Emotional Target**: Absolute control.
- **Layout**: Sidebar Navigation pane + Main Settings Grid.
- **Color**: Multi-state borders matching status.
- **Animations**: Slide-out panel transitions.

#### SETTINGS_ATTENDANCE
- **What It Does**: Manage shifts lists and templates.
- **Emotional Target**: Operational planning.
- **Layout**: Splitscreen details layout.

---

### Phase B: Core Operations Workstations

#### DASHBOARD - OPERATIONS CONTROL TOWER
- **What It Does**: Master dashboard showing daily outputs, alerts, and shift metrics.
- **Emotional Target**: Complete factory oversight.
- **Layout**: Grid 3x3 layout. Top: KPI Metric Strip. Center: Output chart + Alerts list.
- **Color**: Dark steel background, radial orange glow behind output widget.
- **Typography**: Bebas Neue values (48px) for tonnage counts.
- **Animations**: Staggered cards entry, count-up odometer on tons output.

#### TASKS & WORK_QUEUE
- **What It Does**: Displays active tasks list and allocations.
- **Emotional Target**: Urgency to act.
- **Layout**: Left Sidebar: Task types list, Right: Tasks ledger table.
- **Color**: Amber warning borders for pending tasks.

#### ATTENDANCE - PUNCH WORKSTATION
- **What It Does**: Operator time punches and shifts tracking.
- **Emotional Target**: Personal record precision.
- **Layout**: Centered punch control card, right-side shifts history table.

---

### Phase C: Document & OCR Pipelines

#### OCR_SCAN - IMMERSIVE INTAKE
- **What It Does**: Ingestion portal for paper logsheets scans.
- **Emotional Target**: Flow efficiency under pressure.
- **Layout**: Splitscreen: Left upload box, Right recent history.
- **Color**: Cold electric blue indicators on extraction stages.

#### OCR_VERIFY - COMPARATIVE VERIFIER
- **What It Does**: Interactive side-by-side verification editor.
- **Emotional Target**: Focused detail verification.
- **Layout**: Left: Source document viewer, Right: Editable spreadsheet grid.
- **Color**: Red cell borders for low confidence coordinates.
- **Animations**: Bounding box matches cursor location in real time.

#### OCR_HISTORY & OCR_JOBS
- **What It Does**: Trace pipeline jobs and download exports.
- **Emotional Target**: Technical confidence.
- **Layout**: Multi-filter ledger table.

---

### Phase D: Steel ERP Workstations

#### STEEL & STEEL_INVENTORY
- **What It Does**: Central steel operations summary and active stock levels ledger.
- **Emotional Target**: Industrial strength.
- **Layout**: Left Context Rail, Right: high-density inventory list.
- **Color**: Deep charcoal background, orange-amber accent line.

#### STEEL_INVENTORY_TRANSACTIONS
- **What It Does**: Stock-in and stock-out ledger table.
- **Emotional Target**: Absolute audit compliance.
- **Layout**: Table list + Right adjustment form.

#### STEEL_PRODUCTION_RECORD
- **What It Does**: Daily heat run recording worksheet.
- **Emotional Target**: Action precision.
- **Layout**: Consumption vs Yield dual input form.
- **Color**: Red warning alerts if material loss exceeds 8.0%.

#### STEEL_BATCHES & STEEL_BATCHES_ID
- **What It Does**: Production batches ledger and single run details.
- **Emotional Target**: Total traceability.
- **Layout**: Details layout displaying raw material breakdowns.

#### STEEL_CUSTOMERS & STEEL_CUSTOMERS_ID
- **What It Does**: Client balances ledger and profile audits.
- **Emotional Target**: Commercial accountability.
- **Layout**: Context rail + Invoices table tabs.

#### STEEL_INVOICES & STEEL_INVOICES_ID
- **What It Does**: Billing registry and sales detail sheets.
- **Emotional Target**: Financial transparency.

#### STEEL_DISPATCHES & STEEL_DISPATCHES_ID
- **What It Does**: Truck loading and gate-pass release clearance.
- **Emotional Target**: Logistics flow speed.
- **Color**: Weight variance flags alert weighbridge operators.

#### STEEL_RECONCILIATIONS
- **What It Does**: Physical stock audit adjustments.
- **Emotional Target**: Balance alignment.

#### STEEL_CHARTS
- **What It Does**: Furnace yield and consumption analytics.
- **Emotional Target**: Trend clarity.

---

### Phase E: Intelligence & Command Layer

#### REPORTS & ANALYTICS
- **What It Does**: Long-term trend analytics and PDF reports export.
- **Emotional Target**: Business intelligence control.
- **Layout**: Options panels + live chart grids.
- **Color**: Electric blue accents.

#### EMAIL_SUMMARY & PLANS
- **What It Does**: Automated report settings and pricing plans.
- **Emotional Target**: Operational continuity.

#### BILLING & PREMIUM_DASHBOARD
- **What It Does**: subscription status and premium overview charts.
- **Emotional Target**: Executive business control.

#### AI & CONTROL_TOWER
- **What It Does**: Natural language search and multi-factory monitor.
- **Emotional Target**: Future-proof control.

---

*Status: DRAFT MASTER SPECIFICATION - Prepared for implementation agent.*
