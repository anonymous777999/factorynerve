# Steel Invoice Detail — Workspace Skeleton Architecture
# FactoryNerve OS | Phase 3 Skeleton Specification | Phase D, Item 13
# Route: /steel/invoices/[id]
# Generated: 2026-06-03
# Status: DRAFT

---

## 1. WORKSPACE OVERVIEW

### 1.1 Identity

| Field | Value |
|---|---|
| Route | `/steel/invoices/[id]` |
| Workspace Name | Steel Invoice Profile Details |
| Operational Role | Detailed layout of a single client invoice (GET /invoices/{invoice_id}). Shows sales lines, items, tax breakdowns, and payment statuses. Gated to steel factories. |
| Business Impact | Direct transaction auditing. Essential for matching receipts with billing logs. |
| User Population | Sales Manager, Accountant, Owner. |
| Peak Usage Context | Processing order payments and balancing accounts. |
| Predecessor Workspaces | `/steel/invoices` |
| Successor Workspaces | `/steel/customers/[id]` |

### 1.2 Operational Importance

A single invoice details commercial transactions. Auditing line items and checking delivery references before closing bills is crucial.

### 1.3 Current State Failures

- **Failure 1: Missing back navigation.** No link to return to the invoice ledger page.
- **Failure 2: Lack of dispatch mapping.** Invoice detail doesn't link to the matching dispatch truck IDs.

---

## 2. WORKSPACE CLASSIFICATION

| Dimension | Classification | Rationale |
|---|---|---|
| Workspace Type | Entity Detail | TYPE 5 — single invoice details panel. |
| Workflow Category | Record | Commercial billing audit. |
| Operational Behavior | Data-Dense | Renders item pricing sheets. |
| Data Density | HIGH | Detailed sales columns. |
| Realtime Complexity | LOW | Page reload queries. |
| AI Complexity | NONE | Database record. |
| Audit Complexity | LOW | Query-only layout. |
| Decision Pressure | LOW | Billing checks. |

---

## 3. BACKEND OPERATIONAL MAPPING

### 3.1 API Surface

| Endpoint | Method | Purpose | Key Response Fields |
|---|---|---|---|
| `GET /steel/invoices/{invoice_id}` | GET | Load invoice details | Detailed profile JSON |

---

## 4. WORKSPACE STRUCTURAL ANATOMY

### 4.1 Layout Pattern

**FULL-WIDTH COMMAND (centered detail card)**
Focused detail card showing:
- Header (Invoice ID, date, status).
- 2-Column FactsGrid (Left: Customer details, Right: Billing specs).
- Billing Lines Table (Item description, quantity, rate, tax, total).

---

## 4A. VISUAL STRUCTURAL HIERARCHY BLUEPRINT

### A. Desktop Structural Blueprint (1440px)

```
┌──────────────────────────────────────────────────────────────────────────────┐
│ APPSHELL TOPBAR                                                              │
├──────────────────────────────────────────────────────────────────────────────┤
│ WORKSPACE HEADER: Invoice Details (Inv-982)  │ ← Back to invoices            │
├──────────────────────────────────────┬───────────────────────────────────────┤
│ CUSTOMER DETAILS                     │ BILLING SUMMARY                       │
│ Customer: Apex Steel Ltd             │ Net Amount: $30,000                   │
│ Contact: +123456789                  │ Tax (18%):  $5,400                    │
│ Payment Terms: 30 Days               │ Gross Total: $35,400                  │
├──────────────────────────────────────┴───────────────────────────────────────┤
│ BILLING LINES TABLE                                                          │
│ Item             Qty (kg)            Rate ($/kg)        Total                │
│ Rebar-12mm       10,000              3.00               $30,000              │
└──────────────────────────────────────────────────────────────────────────────┘
```

---

## 5. OPERATIONAL ATTENTION HIERARCHY

- Level 1: Payment status badge.
- Level 2: Gross total check.
- Level 3: Billing lines.

---

## 6. TABLE & DATA STRATEGY

Billing lines table. Compact density.

---

## 7. FORM & INPUT STRATEGY

No inputs (read-only view).

---

## 8. AI & AUDIT VISIBILITY STRATEGY

Tracks billing approval logs.

---

## 9. DENSITY, SPACING & LAYOUT RHYTHM

- 4px grid.
- Border dividing lines: `var(--border-default)`.

---

## 10. RESPONSIVE & OPERATOR ADAPTATION

- Stacks tables vertically on mobile.

---

## 11. COMPONENT MAPPING

- Layout: `WorkstationShell`
- Summary: `FactsGrid`
- Tables: `DataTable`

---

## 12. OPERATIONAL PROBLEMS SOLVED

- Gated invoice views strictly to owners and financial managers using `can_view_steel_financials()`.

---

## 13. IMPLEMENTATION HANDOFF

### 13.1 Build Sequence

1. Define details layout wrapper.
2. Hook `GET /steel/invoices/{invoice_id}`.
3. Map line items to table.

### 13.2 Critical Constraints

- Restrict details for unauthorized accounts.

---

## ACCEPTANCE CRITERIA (SPEC COMPLETENESS)

- [x] All 13 sections populated.
