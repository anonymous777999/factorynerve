# Control Tower — Workspace Skeleton Architecture
# FactoryNerve OS | Phase 3 Skeleton Specification | Phase E, Item 8
# Route: /control-tower
# Generated: 2026-06-03
# Status: DRAFT

---

## 1. WORKSPACE OVERVIEW

### 1.1 Identity

| Field | Value |
|---|---|
| Route | `/control-tower` |
| Workspace Name | Control Tower |
| Operational Role | Central monitoring board for multi-factory task execution, intelligent request flows, and resource usages (POST /intelligence/requests, GET /intelligence/requests). |
| Business Impact | Direct cross-factory status audits. If this workspace fails, operations managers cannot verify request statuses or task allocations across locations. |
| User Population | Owner, Factory Manager, Admin. |
| Peak Usage Context | Shift closures or multi-factory task allocations. |
| Predecessor Workspaces | `/ai` |
| Successor Workspaces | `/dashboard` |

### 1.2 Operational Importance

Maintains cross-factory tracking. Coordinates request streams, active operators, and factory execution metrics.

### 1.3 Current State Failures

- **Failure 1: Loose layouts.** Task grids are unconstrained, overflowing container boxes.
- **Failure 2: Lack of usage statistics.** No visual representation of resource usage rates.

---

## 2. WORKSPACE CLASSIFICATION

| Dimension | Classification | Rationale |
|---|---|---|
| Workspace Type | Command Center | TYPE 8 — multi-factory control dashboard. |
| Workflow Category | Oversight | Renders cross-factory request data. |
| Operational Behavior | Data-Dense | Renders concurrent execution grids. |
| Data Density | HIGH | Detailed metrics. |
| Realtime Complexity | LOW | Page reload query. |
| AI Complexity | MEDIUM | Tracks intelligent request streams. |
| Audit Complexity | MEDIUM | Core logs on execution actions. |
| Decision Pressure | MEDIUM | Spotting cross-factory bottlenecks. |

---

## 3. BACKEND OPERATIONAL MAPPING

### 3.1 API Surface

| Endpoint | Method | Purpose | Key Response Fields |
|---|---|---|---|
| `GET /intelligence/requests` | GET | List overall execution requests | `requests` |
| `GET /intelligence/requests/{request_id}` | GET | Check single request details | Detailed request JSON |
| `GET /intelligence/usage` | GET | Retrieve overall resource usages | Usage stats |

---

## 4. WORKSPACE STRUCTURAL ANATOMY

### 4.1 Layout Pattern

**CONTEXT-RAIL + REQUESTS GRID**
Left rail: filter panel (Factory selectors, status scopes). Main area:
- Resource Usage gauges.
- Requests Ledger table.

---

## 4A. VISUAL STRUCTURAL HIERARCHY BLUEPRINT

### A. Desktop Structural Blueprint (1440px)

```
┌──────────────────────────────────────────────────────────────────────────────┐
│ APPSHELL TOPBAR                                                              │
├──────────────────────────────────────────────────────────────────────────────┤
│ WORKSPACE HEADER: Control Tower                                              │
├───────────────┬──────────────────────────────────────────────────────────────┤
│ CONTEXT RAIL  │ USAGE GAUGES                                                 │
│ Factory: All  │ F1 Resource: [████████░░] 80%  │ F2 Resource: [████░░░░░░] 40% │
│ Status: Active├──────────────────────────────────────────────────────────────┤
│               │ REQUESTS LEDGER                                              │
│               │ ┌──────────────┬──────────────┬──────────────┬─────────────┐ │
│               │ │ Request ID   │ Factory      │ Type         │ Status      │ │
│               │ ├──────────────┼──────────────┼──────────────┼─────────────┤ │
│               │ │ Req-102      │ Factory 1    │ Data Sync    │ [ Active ]  │ │
│               │ │ Req-105      │ Factory 2    │ Analysis     │ [ Done ]    │ │
│               │ └──────────────┴──────────────┴──────────────┴─────────────┘ │
└───────────────┴──────────────────────────────────────────────────────────────┘
```

---

## 5. OPERATIONAL ATTENTION HIERARCHY

- Level 1: "Active" request logs.
- Level 2: Resource usage graphs.
- Level 3: Factory filtering.

---

## 6. TABLE & DATA STRATEGY

Requests table. Compact row density.

---

## 7. FORM & INPUT STRATEGY

N/A.

---

## 8. AI & AUDIT VISIBILITY STRATEGY

Tracks request execution audit logs.

---

## 9. DENSITY, SPACING & LAYOUT RHYTHM

- 4px spacing rhythm.
- Divider borders: `var(--border-default)`.

---

## 10. RESPONSIVE & OPERATOR ADAPTATION

- Stacks vertically on mobile.

---

## 11. COMPONENT MAPPING

- Layout: `WorkstationShell`
- Tables: `DataTable`

---

## 12. OPERATIONAL PROBLEMS SOLVED

- Fixes layout overflow bugs by enforcing strict flex limits on task grids.
- Integrates resource usage indicators.

---

## 13. IMPLEMENTATION HANDOFF

### 13.1 Build Sequence

1. Define base layout wrappers.
2. Hook `GET /intelligence/requests` and `GET /intelligence/usage` queries.
3. Build the requests tracking grid.

### 13.2 Critical Constraints

- Restrict details for unauthorized accounts.

---

## ACCEPTANCE CRITERIA (SPEC COMPLETENESS)

- [x] All 13 sections populated.
