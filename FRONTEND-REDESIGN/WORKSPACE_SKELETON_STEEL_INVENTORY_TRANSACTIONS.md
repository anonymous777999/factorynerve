# Steel Inventory Transactions — Workspace Skeleton Architecture
# FactoryNerve OS | Phase 3 Skeleton Specification | Phase D, Item 3
# Route: /steel/inventory/transactions
# Generated: 2026-06-03
# Status: DRAFT

---

## 1. WORKSPACE OVERVIEW

### 1.1 Identity

| Field | Value |
|---|---|
| Route | `/steel/inventory/transactions` |
| Workspace Name | Steel Inventory Transactions Ledger |
| Operational Role | Lists all transaction logs (stock-in, stock-out, manual corrections, batch consumptions) in a data-dense table. Includes input form to log new manual adjustments. Gated to steel factories. |
| Business Impact | Accountability for every kilogram of steel. Prevents unaccounted stock leakage and forms the audit trail for inventory valuations. |
| User Population | Factory Manager, Inventory Supervisor, Accountant. |
| Peak Usage Context | Inventory reconciliations at the end of the shift or day. |
| Predecessor Workspaces | `/steel/inventory` |
| Successor Workspaces | `/steel/reconciliations` |

### 1.2 Operational Importance

A clear log of inventory movements is critical to prevent stock discrepancies. This workspace exposes individual transaction events (e.g. scrap ingestion, billet dispatch) to allow Supervisors to track why and when stock changed.

### 1.3 Current State Failures

- **Failure 1: Form and table collision.** The transaction entry form overlaps the ledger table on lower-resolution monitors.
- **Failure 2: Lack of role gating for manual edits.** Operators can log manual stock modifications without supervisor sign-off.

---

## 2. WORKSPACE CLASSIFICATION

| Dimension | Classification | Rationale |
|---|---|---|
| Workspace Type | Entity List | TYPE 4 — transaction history list + manual entry sidebar. |
| Workflow Category | Record | Audit and input individual inventory movements. |
| Operational Behavior | Data-Dense | Renders transaction weights, types, references, and actors. |
| Data Density | HIGH | Detailed metrics per event. |
| Realtime Complexity | LOW | Simple query reload. |
| AI Complexity | NONE | Raw ledger record. |
| Audit Complexity | MEDIUM | Core database transaction entry. |
| Decision Pressure | MEDIUM | Spotting leakage anomalies. |

---

## 3. BACKEND OPERATIONAL MAPPING

### 3.1 API Surface

| Endpoint | Method | Purpose | Key Response Fields |
|---|---|---|---|
| `GET /steel/inventory/transactions` | GET | List history of transactions | `transactions` |
| `POST /steel/inventory/transactions` | POST | Log new manual inventory transaction | `transaction_id`, `status` |

---

## 4. WORKSPACE STRUCTURAL ANATOMY

### 4.1 Layout Pattern

**SPLIT VIEW (Queue / List Left, Form Right)**
Left pane holds the filtered transaction history list table. Right pane renders the manual transaction registration form (collapsible sidebar).

---

## 4A. VISUAL STRUCTURAL HIERARCHY BLUEPRINT

### A. Desktop Structural Blueprint (1440px)

```
┌──────────────────────────────────────────────────────────────────────────────┐
│ APPSHELL TOPBAR                                                              │
├──────────────────────────────────────────────────────────────────────────────┤
│ WORKSPACE HEADER: Inventory Transactions Ledger                               │
├──────────────────────────────────────┬───────────────────────────────────────┤
│ LEDGER TABLE                         │ MANUAL ENTRY FORM                     │
│ ┌────────┬─────────┬────────┬──────┐ │ Item: [ Billet-Gr60 ▾ ]               │
│ │ Date   │ Item    │ Qty(kg)│ Type │ │ Type: [ Manual Adjustment-In ▾ ]      │
│ ├────────┼─────────┼────────┼──────┤ │ Qty (kg): [ 5000 ]                    │
│ │ 04 Jun │ B-102   │ -4,500 │ Cons │ │ Ref: [ Manual Stock Addition ]        │
│ │ 03 Jun │ S-401   │ +1,200 │ Recv │ │                                       │
│ └────────┴─────────┴────────┴──────┘ │ [ Register Transaction (primary) ]   │
└──────────────────────────────────────┴───────────────────────────────────────┘
```

---

## 5. OPERATIONAL ATTENTION HIERARCHY

- Level 1: Outflow transaction spikes.
- Level 2: New transaction input fields.
- Level 3: Transaction metadata search.

---

## 6. TABLE & DATA STRATEGY

- Row height: Compact (36px).
- Date columns rendered using `JetBrains Mono` for precise readability.

---

## 7. FORM & INPUT STRATEGY

The right-hand entry form holds key adjustments fields:
- Item select (primitive drop-down).
- Transaction type (In / Out / Allocation).
- Quantity (Numeric text input with weight validation).

---

## 8. AI & AUDIT VISIBILITY STRATEGY

Surfaces actors (who created the transaction) for compliance audit checks.

---

## 9. DENSITY, SPACING & LAYOUT RHYTHM

- 4px spacing grid.
- Surface: `var(--surface-card)` for ledger tables.

---

## 10. RESPONSIVE & OPERATOR ADAPTATION

- On mobile, transaction input shifts to a pop-up modal drawer.

---

## 11. COMPONENT MAPPING

- Ledger: `DataTable`
- Input: `Input` and `Select` primitives
- Button: `Button` primitive

---

## 12. OPERATIONAL PROBLEMS SOLVED

- Fixes layout overlap failures by splitting the input form into a dedicated sidebar.
- Gates manual transaction creations to supervisor/manager credentials.

---

## 13. IMPLEMENTATION HANDOFF

### 13.1 Build Sequence

1. Set up the split layout.
2. Build the history table list.
3. Wire the manual creation form and hook to `POST /inventory/transactions`.

### 13.2 Critical Constraints

- Manual corrections must validate quantities (no negative inputs).

---

## ACCEPTANCE CRITERIA (SPEC COMPLETENESS)

- [x] All 13 sections populated.
