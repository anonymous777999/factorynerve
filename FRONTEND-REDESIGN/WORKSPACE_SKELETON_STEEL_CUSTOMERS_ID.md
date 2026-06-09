# Steel Customer Detail — Workspace Skeleton Architecture
# FactoryNerve OS | Phase 3 Skeleton Specification | Phase D, Item 8
# Route: /steel/customers/[id]
# Generated: 2026-06-03
# Status: DRAFT

---

## 1. WORKSPACE OVERVIEW

### 1.1 Identity

| Field | Value |
|---|---|
| Route | `/steel/customers/[id]` |
| Workspace Name | Steel Customer Profile Details |
| Operational Role | Detailed layout of a customer profile (GET /customers/{customer_id}). Handles credit checks, task checklists, and verification actions. Gated to steel factories. |
| Business Impact | Sales and credit auditing. Prevents dispatcher orders for clients with outstanding credit holds. |
| User Population | Sales Manager, Accountant, Owner. |
| Peak Usage Context | Processing order requests or credit releases. |
| Predecessor Workspaces | `/steel/customers` |
| Successor Workspaces | `/steel/invoices` |

### 1.2 Operational Importance

A single account holds critical commercial and logistics details. Reviewing their payment records, verification status, and active tasks before approving delivery is crucial.

### 1.3 Current State Failures

- **Failure 1: Financial data leak.** Credit check results are visible to non-accounting staff.
- **Failure 2: Lack of verification checks.** Missing action to trigger client status validation checks.

---

## 2. WORKSPACE CLASSIFICATION

| Dimension | Classification | Rationale |
|---|---|---|
| Workspace Type | Entity Detail | TYPE 5 — single client profile detail and control workspace. |
| Workflow Category | Record | Commercial audit and operations management. |
| Operational Behavior | Data-Dense | Renders balance grids and document statuses. |
| Data Density | HIGH | Detailed metrics on outstanding balances. |
| Realtime Complexity | LOW | Page reload queries. |
| AI Complexity | NONE | Database record rendering. |
| Audit Complexity | MEDIUM | Core logs created on validation runs. |
| Decision Pressure | MEDIUM | Releasing credit holds. |

---

## 3. BACKEND OPERATIONAL MAPPING

### 3.1 API Surface

| Endpoint | Method | Purpose | Key Response Fields |
|---|---|---|---|
| `GET /steel/customers/{customer_id}` | GET | Load customer details | Detailed profile JSON |
| `POST /steel/customers/{customer_id}/tasks` | POST | Log new account task | `task_id`, `status` |
| `POST /steel/customers/{customer_id}/verification/run-check` | POST | Trigger client validation check | `check_status`, `result` |

---

## 4. WORKSPACE STRUCTURAL ANATOMY

### 4.1 Layout Pattern

**CONTEXT-RAIL + WORKSPACE PANELS**
Left Context Rail shows client summary (Outstanding balance, verification status). Main area contains Tab controls: Invoices, Tasks, and Documents.

---

## 4A. VISUAL STRUCTURAL HIERARCHY BLUEPRINT

### A. Desktop Structural Blueprint (1440px)

```
┌──────────────────────────────────────────────────────────────────────────────┐
│ APPSHELL TOPBAR                                                              │
├──────────────────────────────────────────────────────────────────────────────┤
│ WORKSPACE HEADER: Apex Steel Profile Details                                 │
├───────────────┬──────────────────────────────────────────────────────────────┤
│ CONTEXT RAIL  │ TABS: [Ledger ●] [Tasks] [Verification Docs]                 │
│ Bal: $45,000  ├──────────────────────────────────────────────────────────────┤
│ Credit: $100k │ LEDGER CONTENT                                               │
│ Status: Active│ Outstanding Invoices:                                        │
│ [Run Check]   │ - Inv-982 ($30,000) [Overdue]                                │
│               │ - Inv-985 ($15,000) [Pending]                                │
└───────────────┴──────────────────────────────────────────────────────────────┘
```

---

## 5. OPERATIONAL ATTENTION HIERARCHY

- Level 1: Overdue balance flags (highlighted red).
- Level 2: "Run Check" action button.
- Level 3: Task list completion states.

---

## 6. TABLE & DATA STRATEGY

Summary ledger tables. Compact row density.

---

## 7. FORM & INPUT STRATEGY

Forms to register new tasks or upload verification files.

---

## 8. AI & AUDIT VISIBILITY STRATEGY

Shows verification runs audit logging timeline.

---

## 9. DENSITY, SPACING & LAYOUT RHYTHM

- 4px grid.
- Surface details: `var(--surface-panel)` for side rail.

---

## 10. RESPONSIVE & OPERATOR ADAPTATION

- Context rail moves to the top on mobile.

---

## 11. COMPONENT MAPPING

- Layout: `WorkstationShell`
- Tables: `DataTable`

---

## 12. OPERATIONAL PROBLEMS SOLVED

- Gated credit limit views to users with the owner/accounting role via `can_view_steel_financials()`.

---

## 13. IMPLEMENTATION HANDOFF

### 13.1 Build Sequence

1. Define context rail + main tab layout structures.
2. Hook `GET /steel/customers/{customer_id}`.
3. Add the tasks list update action triggers.

### 13.2 Critical Constraints

- Restrict credit release action buttons for unprivileged accounts.

---

## ACCEPTANCE CRITERIA (SPEC COMPLETENESS)

- [x] All 13 sections populated.
