# Steel Charts — Workspace Skeleton Architecture
# FactoryNerve OS | Phase 3 Skeleton Specification | Phase D, Item 14
# Route: /steel/charts
# Generated: 2026-06-03
# Status: DRAFT

---

## 1. WORKSPACE OVERVIEW

### 1.1 Identity

| Field | Value |
|---|---|
| Route | `/steel/charts` |
| Workspace Name | Steel Operations Analytics & Charts |
| Operational Role | Operational charting and analytics dashboard for the steel domain. Visualizes batch efficiencies, production yield trends, stock variations, and revenue metrics. Gated to steel factories. |
| Business Impact | Enables supervisors and managers to evaluate shift outputs, identify furnace inefficiencies, and track yield losses. |
| User Population | Factory Manager, Shift Supervisor, Accountant, Owner. |
| Peak Usage Context | Weekly operations review meetings. |
| Predecessor Workspaces | `/steel` (hub) |
| Successor Workspaces | `/analytics` (global) |

### 1.2 Operational Importance

Provides immediate visual performance metrics. Spotting furnace efficiency variations or scrap-to-yield ratio anomalies helps maintain profitability.

### 1.3 Current State Failures

- **Failure 1: Financial information leak.** Non-owner roles can view revenue and profit charts. Needs gating.
- **Failure 2: Lack of responsive resizing.** Charts overlap sidebar panel containers on standard 1080p monitors.

---

## 2. WORKSPACE CLASSIFICATION

| Dimension | Classification | Rationale |
|---|---|---|
| Workspace Type | Command Center | TYPE 8 — multi-chart analytical dashboard. |
| Workflow Category | Oversight | Renders aggregated trend charts. |
| Operational Behavior | Data-Dense | Multiple concurrent charting surfaces. |
| Data Density | HIGH | Detailed trends over time. |
| Realtime Complexity | LOW | Page reload queries. |
| AI Complexity | NONE | Database aggregation. |
| Audit Complexity | LOW | Read-only details. |
| Decision Pressure | MEDIUM | Spotting furnace degradation trends. |

---

## 3. BACKEND OPERATIONAL MAPPING

### 3.1 API Surface

| Endpoint | Method | Purpose | Key Response Fields |
|---|---|---|---|
| `GET /steel/overview` | GET | Load overview and trend data | `metrics`, `historical_efficiency` |

---

## 4. WORKSPACE STRUCTURAL ANATOMY

### 4.1 Layout Pattern

**CONTEXT-RAIL + CHARTS GRID**
Left Context Rail holds filter selectors (furnace code, date range). Main area lists charting panels:
- Furnace Batch Efficiency line chart.
- Scrap vs Billet stock levels bar chart.
- Sales Revenue trends chart (gated).

---

## 4A. VISUAL STRUCTURAL HIERARCHY BLUEPRINT

### A. Desktop Structural Blueprint (1440px)

```
┌──────────────────────────────────────────────────────────────────────────────┐
│ APPSHELL TOPBAR                                                              │
├──────────────────────────────────────────────────────────────────────────────┤
│ WORKSPACE HEADER: Steel Operations Charts                                    │
├───────────────┬──────────────────────────────────────────────────────────────┤
│ CONTEXT RAIL  │ CHARTS GRID                                                  │
│ Furnace: All  │ ┌───────────────────────────┐  ┌───────────────────────────┐ │
│ Range: 30D    │ │ Furnace Batch Efficiency  │  │ Stock Levels Comparison   │ │
│               │ │ [Line Chart: 30D Trend]   │  │ [Bar Chart: Raw vs scrap] │ │
│               │ └───────────────────────────┘  └───────────────────────────┘ │
│               │ ┌───────────────────────────┐                                │ │
│               │ │ Sales Revenue Trends      │                                │ │
│               │ │ [Gated Area Chart]        │                                │ │
│               │ └───────────────────────────┘                                │ │
└───────────────┴──────────────────────────────────────────────────────────────┘
```

---

## 5. OPERATIONAL ATTENTION HIERARCHY

- Level 1: Efficiency drops in line chart.
- Level 2: Filter selectors.
- Level 3: Individual chart data legends.

---

## 6. TABLE & DATA STRATEGY

N/A (Chart-centric layout).

---

## 7. FORM & INPUT STRATEGY

Context rail filters: date range select, furnace selector.

---

## 8. AI & AUDIT VISIBILITY STRATEGY

N/A.

---

## 9. DENSITY, SPACING & LAYOUT RHYTHM

- 4px spacing rhythm.
- Chart panels: `var(--surface-card)`.

---

## 10. RESPONSIVE & OPERATOR ADAPTATION

- Charts scale dynamically to fill panel containers.
- Stack vertically on mobile.

---

## 11. COMPONENT MAPPING

- Layout: `WorkstationShell`
- Charts: Reusable Chart wrappers

---

## 12. OPERATIONAL PROBLEMS SOLVED

- Gated sales revenue trend charts to owner and accountant roles via `can_view_steel_financials()`.

---

## 13. IMPLEMENTATION HANDOFF

### 13.1 Build Sequence

1. Scaffold context rail + main charts panels.
2. Hook `GET /steel/overview` statistics.
3. Bind active filter listeners to chart redraw events.

### 13.2 Critical Constraints

- Hide revenue charts for unauthorized roles.

---

## ACCEPTANCE CRITERIA (SPEC COMPLETENESS)

- [x] All 13 sections populated.
