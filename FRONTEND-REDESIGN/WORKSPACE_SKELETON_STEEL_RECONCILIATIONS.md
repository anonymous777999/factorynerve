# Steel Reconciliations — Workspace Skeleton Architecture
# FactoryNerve OS | Phase 3 Skeleton Specification | Phase D, Item 11
# Route: /steel/reconciliations
# Generated: 2026-06-03
# Status: DRAFT

---

## 1. WORKSPACE OVERVIEW

### 1.1 Identity

| Field | Value |
|---|---|
| Route | `/steel/reconciliations` |
| Workspace Name | Steel Stock Reconciliations |
| Operational Role | Tracks stock audit runs, updates system balances, and captures physical inventory variations. Gated to steel factories. |
| Business Impact | Direct alignment between ledger weights and warehouse stock. Prevents balance inflation. |
| User Population | Inventory Manager, Accountant, Owner. |
| Peak Usage Context | Monthly stock audit reviews. |
| Predecessor Workspaces | `/steel/inventory` |
| Successor Workspaces | `/steel/inventory/transactions` |

### 1.2 Operational Importance

Verifies active balances. Matches physical audit measurements (e.g. billets count, coil weight) with system figures to record adjustments.

### 1.3 Current State Failures

- **Failure 1: Overlapping panels.** Summary grids block list entries on standard monitor screens.
- **Failure 2: Lack of approval restrictions.** Operators can approve reconciliations. Needs supervisor/manager gate check.

---

## 2. WORKSPACE CLASSIFICATION

| Dimension | Classification | Rationale |
|---|---|---|
| Workspace Type | Entity List | TYPE 4 — reconciliation log list + adjustment creators. |
| Workflow Category | Record | Audit and correct physical stock counts. |
| Operational Behavior | Data-Dense | Renders audit logs, variance percentages, and status items. |
| Data Density | HIGH | Detailed metrics per reconciliation. |
| Realtime Complexity | LOW | Page load query. |
| AI Complexity | NONE | Raw ledger record. |
| Audit Complexity | HIGH | Core database adjustment updates. |
| Decision Pressure | HIGH | Approving multi-ton stock discrepancies. |

---

## 3. BACKEND OPERATIONAL MAPPING

### 3.1 API Surface

| Endpoint | Method | Purpose | Key Response Fields |
|---|---|---|---|
| `GET /steel/inventory/reconciliations` | GET | List historical reconciliations | `reconciliations` |
| `GET /steel/inventory/reconciliations/summary` | GET | Aggregated audit details | `variance_summary` |
| `POST /steel/inventory/reconciliations` | POST | Register new stock audit run | `reconciliation_id` |
| `POST /steel/inventory/reconciliations/{id}/approve` | POST | Approve reconciliation adjustment | `status` |
| `POST /steel/inventory/reconciliations/{id}/reject` | POST | Reject reconciliation adjustment | `status` |

---

## 4. WORKSPACE STRUCTURAL ANATOMY

### 4.1 Layout Pattern

**SPLIT VIEW (Summary Top, Table Bottom, Form Drawer)**
Top zone: Metrics strip of variance summaries. Main area: Table listing current reconciliations. Row click triggers details drawer with Approve/Reject buttons.

---

## 4A. VISUAL STRUCTURAL HIERARCHY BLUEPRINT

### A. Desktop Structural Blueprint (1440px)

```
┌──────────────────────────────────────────────────────────────────────────────┐
│ APPSHELL TOPBAR                                                              │
├──────────────────────────────────────────────────────────────────────────────┤
│ WORKSPACE HEADER: Stock Reconciliations Summary                              │
├──────────────────────────────────────────────────────────────────────────────┤
│ VARIANCE: Net Adjustment: -2,500 kg │ Audited: 01 Jun │ Discrepancies: 3     │
├──────────────────────────────────────────────────────────────────────────────┤
│ RECONCILIATIONS LEDGER TABLE                                                 │
│ ┌────────┬─────────────┬───────────┬──────────────┬────────────────────────┐ │
│ │ AuditID│ Date        │ Item      │ Variance(kg) │ Status                 │ │
│ ├────────┼─────────────┼───────────┼──────────────┼────────────────────────┤ │
│ │ Rec-01 │ 01 Jun 2026 │ B-102     │ -1,200       │ [ Approved ]           │ │
│ │ Rec-02 │ 03 Jun 2026 │ S-401     │ +450         │ [ Pending Review ]     │ │
│ └────────┴─────────────┴───────────┴──────────────┴────────────────────────┘ │
└──────────────────────────────────────────────────────────────────────────────┘
```

---

## 5. OPERATIONAL ATTENTION HIERARCHY

- Level 1: "Pending Review" status tags.
- Level 2: High variance adjustment rows (highlighted).
- Level 3: "New Audit" trigger button.

---

## 6. TABLE & DATA STRATEGY

- Row height: Compact (36px).
- Highlight rows with variance values exceeding 3.0% of standard inventory.

---

## 7. FORM & INPUT STRATEGY

Modal drawer collects:
- Item select.
- Physical counted weight.
- Remarks.

---

## 8. AI & AUDIT VISIBILITY STRATEGY

Tracks approval actors and remarks.

---

## 9. DENSITY, SPACING & LAYOUT RHYTHM

- 4px spacing rhythm.
- Warnings: `var(--status-warning-bg)`.

---

## 10. RESPONSIVE & OPERATOR ADAPTATION

- Stacks vertically on mobile.

---

## 11. COMPONENT MAPPING

- Layout: `WorkstationShell`
- Tables: `DataTable`
- Drawer: `Drawer` primitive

---

## 12. OPERATIONAL PROBLEMS SOLVED

- Restricts approval/rejection triggers to Managers/Admins via `is_manager_or_admin` validation checks.

---

## 13. IMPLEMENTATION HANDOFF

### 13.1 Build Sequence

1. Scaffold ledger + summary panels.
2. Hook query endpoints.
3. Wire the detail drawer.

### 13.2 Critical Constraints

- Non-managers cannot trigger Approve/Reject requests.

---

## ACCEPTANCE CRITERIA (SPEC COMPLETENESS)

- [x] All 13 sections populated.
