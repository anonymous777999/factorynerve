# Analytics — Workspace Skeleton Architecture
# FactoryNerve OS | Phase 3 Skeleton Specification | Phase E, Item 2
# Route: /analytics
# Generated: 2026-06-03
# Status: DRAFT

---

## 1. WORKSPACE OVERVIEW

### 1.1 Identity

| Field | Value |
|---|---|
| Route | `/analytics` |
| Workspace Name | Factory Analytics Dashboard |
| Operational Role | Renders overall production efficiency trends, weekly/monthly charts, and performance breakdowns (GET /trends, /weekly, /monthly, /manager). |
| Business Impact | High-level decision monitoring. Tracks output growth and furnace bottlenecks over longer timelines. |
| User Population | Factory Manager, Owner, Accountant. |
| Peak Usage Context | Month-end reviews and strategic operations planning. |
| Predecessor Workspaces | `/reports` |
| Successor Workspaces | `/premium/dashboard` |

### 1.2 Operational Importance

Allows managers to trace long-term trends. Consolidates multi-shift production metrics to display overall efficiency growth and scrap loss curves.

### 1.3 Current State Failures

- **Failure 1: Overlapping chart boundaries.** Responsive resizing is broken, causing charts to overlap containers.
- **Failure 2: Lack of comparative filters.** No easy way to overlay shift efficiency charts for comparison.

---

## 2. WORKSPACE CLASSIFICATION

| Dimension | Classification | Rationale |
|---|---|---|
| Workspace Type | Command Center | TYPE 8 — multi-chart dashboard. |
| Workflow Category | Oversight | Track long-term factory outputs. |
| Operational Behavior | Data-Dense | Renders multiple analytics charts. |
| Data Density | HIGH | Detailed trends. |
| Realtime Complexity | LOW | Page reload queries. |
| AI Complexity | NONE | Database aggregation. |
| Audit Complexity | LOW | Read-only graphs. |
| Decision Pressure | LOW | Trend checking. |

---

## 3. BACKEND OPERATIONAL MAPPING

### 3.1 API Surface

| Endpoint | Method | Purpose | Key Response Fields |
|---|---|---|---|
| `GET /analytics/trends` | GET | Retrieve overall performance trends | `trends` |
| `GET /analytics/weekly` | GET | Load weekly summary aggregates | `weekly_aggregates` |
| `GET /analytics/manager` | GET | Load manager audit scores | `manager_scores` |

---

## 4. WORKSPACE STRUCTURAL ANATOMY

### 4.1 Layout Pattern

**CONTEXT-RAIL + CHARTS GRID**
Left rail: filter panel (Date selector, shift overlay). Main area: Chart cards:
- Weekly Production Yield.
- Material Consumption trends.
- Manager Audit Scores.

---

## 4A. VISUAL STRUCTURAL HIERARCHY BLUEPRINT

### A. Desktop Structural Blueprint (1440px)

```
┌──────────────────────────────────────────────────────────────────────────────┐
│ APPSHELL TOPBAR                                                              │
├──────────────────────────────────────────────────────────────────────────────┤
│ WORKSPACE HEADER: Factory Analytics Dashboard                                │
├───────────────┬──────────────────────────────────────────────────────────────┤
│ CONTEXT RAIL  │ CHARTS GRID                                                  │
│ Range: 90 Days│ ┌───────────────────────────┐  ┌───────────────────────────┐ │
│ Shift: All    │ │ Weekly Production Yield   │  │ Material Consump Trends   │ │
│               │ │ [Line Chart: Yield Tons]  │  │ [Bar Chart: In vs Out]    │ │
│               │ └───────────────────────────┘  └───────────────────────────┘ │
└───────────────┴──────────────────────────────────────────────────────────────┘
```

---

## 5. OPERATIONAL ATTENTION HIERARCHY

- Level 1: Yield line dips indicating bottleneck trends.
- Level 2: Filter selectors.
- Level 3: Individual chart legends.

---

## 6. TABLE & DATA STRATEGY

N/A.

---

## 7. FORM & INPUT STRATEGY

Context rail filters: date range select, shift selector.

---

## 8. AI & AUDIT VISIBILITY STRATEGY

N/A.

---

## 9. DENSITY, SPACING & LAYOUT RHYTHM

- 4px spacing rhythm.
- Chart panels: `var(--surface-card)`.

---

## 10. RESPONSIVE & OPERATOR ADAPTATION

- Charts scale dynamically to fill panels. Stack vertically on mobile.

---

## 11. COMPONENT MAPPING

- Layout: `WorkstationShell`
- Charts: Reusable chart container wrappers

---

## 12. OPERATIONAL PROBLEMS SOLVED

- Fixes layout overlap failures by enforcing strict flex constraints on charting elements.

---

## 13. IMPLEMENTATION HANDOFF

### 13.1 Build Sequence

1. Define base layout shell.
2. Hook `GET /analytics/trends` endpoint.
3. Wire chart components to redraw on filter updates.

### 13.2 Critical Constraints

- Restrict details for unauthorized roles.

---

## ACCEPTANCE CRITERIA (SPEC COMPLETENESS)

- [x] All 13 sections populated.
