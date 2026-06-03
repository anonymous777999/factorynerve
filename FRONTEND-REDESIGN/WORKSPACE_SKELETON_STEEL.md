# Steel Command Center — Workspace Skeleton Architecture
# FactoryNerve OS | Phase 3 Skeleton Specification | Phase D, Item 1
# Route: /steel
# Generated: 2026-06-03
# Status: DRAFT

---

## 1. WORKSPACE OVERVIEW

### 1.1 Identity

| Field | Value |
|---|---|
| Route | `/steel` |
| Workspace Name | Steel Command Center |
| Operational Role | The centralized hub for the steel industry domain. Integrates inventory, production batches, customer sales, invoices, dispatches, and risk alerts into a tab-based command workspace. Restricts view to steel factories, gates financial data, and displays key metrics. |
| Business Impact | Direct operational visibility for steel manufacturing. If this workspace fails, production managers cannot monitor batch progress, inventory logs, sales performance, or risk anomalies. |
| User Population | Factory Manager, Production Supervisor, Owner. Restricted gate: `can_view_steel_financials()` and steel factory check. |
| Peak Usage Context | Morning briefing and shift handover — reviewing metrics, inventory levels, sales, and outstanding dispatches. |
| Predecessor Workspaces | `/dashboard`, `/work-queue` |
| Successor Workspaces | `/steel/inventory`, `/steel/batches`, `/steel/dispatches`, `/steel/invoices` |

### 1.2 Operational Importance

The Command Center provides a high-level operational overview of the steel plant. Instead of navigating separate list pages, users have tabs to inspect real-time status: production efficiency, raw stock levels, dispatch delays, and risk anomalies. It brings together isolated data sources (ERP + IoT production inputs) to highlight bottlenecks instantly.

### 1.3 Current State Failures

- **Failure 1: Rendered for all industry types.** Shows empty boxes for chemical or textile factories. Needs industry gating.
- **Failure 2: Lack of financial permission gating.** Non-owners see blank spaces or raw DB errors for revenue figures instead of a clean "Restricted Access" state.
- **Failure 3: Brittle layout splits.** The tab containers use hardcoded pixel widths, causing text truncation on 1080p monitors.

---

## 2. WORKSPACE CLASSIFICATION

| Dimension | Classification | Rationale |
|---|---|---|
| Workspace Type | Command Center | TYPE 8 — multi-tabbed aggregated hub of lists, forms, and alerts. |
| Workflow Category | Oversight | Renders aggregated views of the factory state. |
| Operational Behavior | Data-Dense | Renders KPI cards, active tables, and charts on separate tabs. |
| Data Density | HIGH | Visualizes multiple inventory and batch data points. |
| Realtime Complexity | MEDIUM | Re-fetches tab contents on tab switch. |
| AI Complexity | MEDIUM | Displays anomaly ratings from the background threat system. |
| Audit Complexity | LOW | Information viewing workspace. No direct audit logs created here. |
| Decision Pressure | MEDIUM | Spotting production bottlenecks or dispatch anomalies. |

---

## 3. BACKEND OPERATIONAL MAPPING

### 3.1 API Surface

| Endpoint | Method | Purpose | Key Response Fields |
|---|---|---|---|
| `GET /steel/overview` | GET | Aggregated KPI statistics | `metrics`, `recent_batches`, `anomalies` |
| `GET /steel/inventory/stock` | GET | Active stock levels for the inventory tab | `stock_items` |
| `GET /steel/batches` | GET | List of recent batches for production tab | `batches` |

---

## 4. WORKSPACE STRUCTURAL ANATOMY

### 4.1 Layout Pattern

**CONTEXT-RAIL + TABBED CONTAINER**
A left-hand context rail showing factory details, active plan, and permission status, with a main tabbed content surface showing:
- Overview (metrics cards + recent batches)
- Inventory (stock level table)
- Production (batch logs)
- Sales (customer invoicing summaries)
- Risk (anomaly reports)

---

## 4A. VISUAL STRUCTURAL HIERARCHY BLUEPRINT

### A. Desktop Structural Blueprint (1440px)

```
┌──────────────────────────────────────────────────────────────────────────────┐
│ APPSHELL TOPBAR                                                              │
├──────────────────────────────────────────────────────────────────────────────┤
│ KPI STRIP [4 cards]: Stock: 42T | Batches: 3 | Sales: $120k | Risks: 2       │
├───────────────┬──────────────────────────────────────────────────────────────┤
│ CONTEXT RAIL  │ TABS: [Overview ●] [Inventory] [Production] [Sales] [Risk]   │
│ Factory: F1   ├──────────────────────────────────────────────────────────────┤
│ Plan: Premium │ OVERVIEW CONTENT AREA                                        │
│ Role: Owner   │ ┌───────────────────────────┐  ┌───────────────────────────┐ │
│               │ │ Recent Batches            │  │ Anomaly Alerts            │ │
│               │ │ - B402 (Steel) [Active]   │  │ ⚠ B401 Loss variance: 12% │ │
│               │ │ - B401 (Steel) [Done]     │  │                           │ │
│               │ └───────────────────────────┘  └───────────────────────────┘ │
└───────────────┴──────────────────────────────────────────────────────────────┘
```

---

## 5. OPERATIONAL ATTENTION HIERARCHY

- Level 1: KPI metric strip showing overall health.
- Level 2: Tab navigation matching current focus.
- Level 3: Individual tab tables or forms.

---

## 6. TABLE & DATA STRATEGY

Renders summary tables under the Inventory and Production tabs.
- Density: Compact (row height 36px).
- Row click navigates to corresponding detail sub-route (e.g. `/steel/batches/[id]`).

---

## 7. FORM & INPUT STRATEGY

No direct input forms on the overview page.

---

## 8. AI & AUDIT VISIBILITY STRATEGY

Displays anomalies on the Risk tab. Uses the pre-calculated variance severity scores (`severity_from_variance()`).

---

## 9. DENSITY, SPACING & LAYOUT RHYTHM

- 4px spacing rhythm.
- Spacing: 12px between panels, 16px margins.
- Surface background: `var(--surface-app)`.

---

## 10. RESPONSIVE & OPERATOR ADAPTATION

- Mobile view stacks the context rail to the top.
- Tabs convert to select menu on mobile.

---

## 11. COMPONENT MAPPING

- Layout: `WorkstationShell`
- Tabs: `Tabs` primitive
- Cards: `MetricStrip`

---

## 12. OPERATIONAL PROBLEMS SOLVED

- **Industry Gate**: Checks `factory.industry === 'steel'` before rendering, else shows empty state.
- **Financial Gate**: Checks `can_view_steel_financials()` before rendering the Sales metric or hides sales tab.

---

## 13. IMPLEMENTATION HANDOFF

### 13.1 Build Sequence

1. Implement industry check gate and non-steel empty state.
2. Render context rail with factory profile metadata.
3. Build the core tab system with `?tab=` URL parameter synchronization.
4. Populate individual tab views by routing GET endpoints.

### 13.2 Critical Constraints

- Maintain `?tab=` state in URL.
- Restrict financial stats for non-owners.

---

## ACCEPTANCE CRITERIA (SPEC COMPLETENESS)

- [x] All 13 sections populated.
- [x] Gating logic fully specified.
