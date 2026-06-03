# Steel Batch Detail — Workspace Skeleton Architecture
# FactoryNerve OS | Phase 3 Skeleton Specification | Phase D, Item 6
# Route: /steel/batches/[id]
# Generated: 2026-06-03
# Status: DRAFT

---

## 1. WORKSPACE OVERVIEW

### 1.1 Identity

| Field | Value |
|---|---|
| Route | `/steel/batches/[id]` |
| Workspace Name | Steel Batch Details |
| Operational Role | Renders the detail view of a single production batch run (GET /batches/{batch_id}). Displays consumption list, yield output, calculated efficiency loss, and audit logs. Gated to steel factories. |
| Business Impact | Traceability audit target. Managers inspect specific batch failures, excessive metal losses, or worker metrics. |
| User Population | Factory Manager, Shift Supervisor. |
| Peak Usage Context | Investigating production variance issues or quality defects. |
| Predecessor Workspaces | `/steel/batches` (list) |
| Successor Workspaces | `/steel/invoices` (tracking batch allocation to orders) |

### 1.2 Operational Importance

A single batch run represents tons of molten steel. Reviewing the inputs and output weights helps maintain yield standards and audit shift performance.

### 1.3 Current State Failures

- **Failure 1: Missing efficiency comparisons.** The batch details do not visually map how inputs compare to outputs.
- **Failure 2: Lack of navigation links.** The page has no back link to the main batches list.

---

## 2. WORKSPACE CLASSIFICATION

| Dimension | Classification | Rationale |
|---|---|---|
| Workspace Type | Entity Detail | TYPE 5 — details of one batch record. |
| Workflow Category | Record | Detail review of a physical transaction. |
| Operational Behavior | Data-Dense | Renders detailed key-value panels. |
| Data Density | HIGH | Detailed logs of consumption and output items. |
| Realtime Complexity | LOW | Page load query. |
| AI Complexity | NONE | Raw ledger detail. |
| Audit Complexity | LOW | Read-only details. |
| Decision Pressure | MEDIUM | Spotting process deviations. |

---

## 3. BACKEND OPERATIONAL MAPPING

### 3.1 API Surface

| Endpoint | Method | Purpose | Key Response Fields |
|---|---|---|---|
| `GET /steel/batches/{batch_id}` | GET | Load single batch details | Detailed batch run JSON |

---

## 4. WORKSPACE STRUCTURAL ANATOMY

### 4.1 Layout Pattern

**FULL-WIDTH COMMAND (centered workspace detail)**
Main workspace details card showing:
- Header (Batch ID, date, status).
- 2-Column Grid (Left: Raw inputs table, Right: Yield outputs table).
- Yield Summary strip (Loss, Yield %, Shift efficiency).

---

## 4A. VISUAL STRUCTURAL HIERARCHY BLUEPRINT

### A. Desktop Structural Blueprint (1440px)

```
┌──────────────────────────────────────────────────────────────────────────────┐
│ APPSHELL TOPBAR                                                              │
├──────────────────────────────────────────────────────────────────────────────┤
│ WORKSPACE HEADER: Batch Details (B-401)  │ ← Back to Batches Ledger          │
├──────────────────────────────────────┬───────────────────────────────────────┤
│ RAW INPUTS CONSUMED                  │ YIELD OUTPUTS PRODUCED                │
│ Item             Weight (kg)         │ Item             Weight (kg)          │
│ Billet-Gr60      12,000              │ Rebar-12mm       11,400               │
├──────────────────────────────────────┴───────────────────────────────────────┤
│ METRICS:                                                                     │
│ Yield: 95.0%  │  Total Loss: 600 kg (5.0%)  │ Shift: B  │ Operator: Raj Kumar│
└──────────────────────────────────────────────────────────────────────────────┘
```

---

## 5. OPERATIONAL ATTENTION HIERARCHY

- Level 1: Yield loss percent and status.
- Level 2: List of input raw materials.
- Level 3: Back button.

---

## 6. TABLE & DATA STRATEGY

- Renders 2 read-only tables.
- Row heights: Compact (36px).

---

## 7. FORM & INPUT STRATEGY

No inputs (read-only view).

---

## 8. AI & AUDIT VISIBILITY STRATEGY

Displays operator and supervisor signatures for safety and quality accountability.

---

## 9. DENSITY, SPACING & LAYOUT RHYTHM

- 4px spacing grid.
- Surface color: `var(--surface-card)`.

---

## 10. RESPONSIVE & OPERATOR ADAPTATION

- Stacks tables vertically on mobile screens.

---

## 11. COMPONENT MAPPING

- Layout: `WorkstationShell`
- Summary: `FactsGrid`

---

## 12. OPERATIONAL PROBLEMS SOLVED

- Integrates easy navigation back to `/steel/batches` list view.

---

## 13. IMPLEMENTATION HANDOFF

### 13.1 Build Sequence

1. Define detail view layout wrapper.
2. Connect `GET /steel/batches/{batch_id}` API endpoint.
3. Map consumption and production lists to grids.

### 13.2 Critical Constraints

- Financial details (if batch costs visible) must check user permissions.

---

## ACCEPTANCE CRITERIA (SPEC COMPLETENESS)

- [x] All 13 sections populated.
