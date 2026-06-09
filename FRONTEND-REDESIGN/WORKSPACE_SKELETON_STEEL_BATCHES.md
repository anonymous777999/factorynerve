# Steel Production Batches Ledger — Workspace Skeleton Architecture
# FactoryNerve OS | Phase 3 Skeleton Specification | Phase D, Item 5
# Route: /steel/batches
# Generated: 2026-06-03
# Status: DRAFT

---

## 1. WORKSPACE OVERVIEW

### 1.1 Identity

| Field | Value |
|---|---|
| Route | `/steel/batches` |
| Workspace Name | Steel Production Batches Ledger |
| Operational Role | Displays all logged production batch runs (GET /batches). Operators and supervisors review batch numbers, efficiency ratios, loss percentages, and timestamps. Gated to steel factories. |
| Business Impact | High-level traceability for all manufacturing outputs. Allows supervisors to identify inefficient shifts or anomalies in heat runs. |
| User Population | Factory Manager, Shift Supervisor, Operator. |
| Peak Usage Context | Daily production reports audit. |
| Predecessor Workspaces | `/steel/production/record` |
| Successor Workspaces | `/steel/batches/[id]` |

### 1.2 Operational Importance

Traceability is key in metallurgy. This workspace lists batches in reverse chronological order to surface batch statistics, grades, and anomalies.

### 1.3 Current State Failures

- **Failure 1: Brittle list height.** Table heights are hardcoded, causing layout clipping on standard factory floor terminals.
- **Failure 2: Lack of status indicator flags.** Inefficient batches (high loss % or low yield) are indistinguishable from normal batches without inspecting individual rows.

---

## 2. WORKSPACE CLASSIFICATION

| Dimension | Classification | Rationale |
|---|---|---|
| Workspace Type | Entity List | TYPE 4 — list of batch runs with filters and search. |
| Workflow Category | Record | Trace historical production outputs. |
| Operational Behavior | Data-Dense | Renders batch efficiency metrics and item breakdowns. |
| Data Density | HIGH | Detailed records of consumption and yields. |
| Realtime Complexity | LOW | Page load query. |
| AI Complexity | NONE | Raw ledger view. |
| Audit Complexity | LOW | Read-only index layout. |
| Decision Pressure | MEDIUM | Spotting high-variance loss runs. |

---

## 3. BACKEND OPERATIONAL MAPPING

### 3.1 API Surface

| Endpoint | Method | Purpose | Key Response Fields |
|---|---|---|---|
| `GET /steel/batches` | GET | List historical batches | `batches` |

---

## 4. WORKSPACE STRUCTURAL ANATOMY

### 4.1 Layout Pattern

**WORKSTATION SHELL + SECTION PANEL**
A high-density table displaying batch number, Shift, Grade, Efficiency, Loss %, and Operator, with filtering and search at the top.

---

## 4A. VISUAL STRUCTURAL HIERARCHY BLUEPRINT

### A. Desktop Structural Blueprint (1440px)

```
┌──────────────────────────────────────────────────────────────────────────────┐
│ APPSHELL TOPBAR                                                              │
├──────────────────────────────────────────────────────────────────────────────┘
│ WORKSPACE HEADER: Production Batches Ledger                                   │
├──────────────────────────────────────────────────────────────────────────────┤
│ FILTERS: [Search batch...]  [Shift ▾]  [Loss Severity ▾]                      │
├──────────────────────────────────────────────────────────────────────────────┤
│ BATCHES TABLE                                                                │
│ ┌──────────┬───────┬─────────────┬────────────┬─────────┬──────────────────┐ │
│ │ Batch ID │ Shift │ Grade       │ Effic (%)  │ Loss (%)│ Operator         │ │
│ ├──────────┼───────┼─────────────┼────────────┼─────────┼──────────────────┤ │
│ │ B-402    │ A     │ Billet-Gr60 │ 95.0%      │ 5.0%    │ Sam Singh        │ │
│ │ ⚠ B-401  │ B     │ Billet-Gr60 │ 88.0%      │ 12.0%   │ Raj Kumar        │ │
│ └──────────┴───────┴─────────────┴────────────┴─────────┴──────────────────┘ │
└──────────────────────────────────────────────────────────────────────────────┘
```

---

## 5. OPERATIONAL ATTENTION HIERARCHY

- Level 1: Anomaly indicator flags (warning triangle next to high-loss batches).
- Level 2: Batch ID links (double click to open detail).
- Level 3: Search and shift filters.

---

## 6. TABLE & DATA STRATEGY

- Row height: Compact (36px).
- Inefficient rows (> 8.0% loss) show a left status warning stripe.
- Click on Batch ID navigates to `/steel/batches/[id]`.

---

## 7. FORM & INPUT STRATEGY

None.

---

## 8. AI & AUDIT VISIBILITY STRATEGY

N/A.

---

## 9. DENSITY, SPACING & LAYOUT RHYTHM

- 4px spacing rhythm.
- Font styling: Sentence case for operators.

---

## 10. RESPONSIVE & OPERATOR ADAPTATION

- Hides operator column on mobile viewports.

---

## 11. COMPONENT MAPPING

- Table: `DataTable`
- Container: `WorkstationShell`

---

## 12. OPERATIONAL PROBLEMS SOLVED

- Integrates visual warnings for high-loss batches to support immediate operational review.

---

## 13. IMPLEMENTATION HANDOFF

### 13.1 Build Sequence

1. Define core batch log table inside `WorkstationShell`.
2. Connect `GET /steel/batches` endpoint.
3. Wire row click deep links.

### 13.2 Critical Constraints

- Highlight batches exceeding standard loss thresholds.

---

## ACCEPTANCE CRITERIA (SPEC COMPLETENESS)

- [x] All 13 sections populated.
- [x] Visual highlights specified.
