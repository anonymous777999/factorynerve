# Steel Invoices — Workspace Skeleton Architecture
# FactoryNerve OS | Phase 3 Skeleton Specification | Phase D, Item 12
# Route: /steel/invoices
# Generated: 2026-06-03
# Status: DRAFT

---

## 1. WORKSPACE OVERVIEW

### 1.1 Identity

| Field | Value |
|---|---|
| Route | `/steel/invoices` |
| Workspace Name | Steel Invoices Ledger |
| Operational Role | Lists all customer sales invoices (GET /invoices) and allows generation of new sales invoices (POST /invoices). Gated to steel factories. |
| Business Impact | Core revenue accountability. If this workspace fails, sales operations cannot log customer billing, delaying payments. |
| User Population | Sales Manager, Accountant, Owner. |
| Peak Usage Context | Shift closures — auditing and finalizing client invoice balances. |
| Predecessor Workspaces | `/steel` (hub) |
| Successor Workspaces | `/steel/invoices/[id]`, `/steel/customers/[id]` |

### 1.2 Operational Importance

Invoices capture commercial transactions. Tracking invoice statuses (Draft, Sent, Paid, Overdue) ensures accurate cash flow tracking.

### 1.3 Current State Failures

- **Failure 1: Financial exposure.** Invoice details are visible to non-accounting staff without permission check gates.
- **Failure 2: Lack of navigation links.** Deep links from invoice lines to customer profiles are broken.

---

## 2. WORKSPACE CLASSIFICATION

| Dimension | Classification | Rationale |
|---|---|---|
| Workspace Type | Entity List | TYPE 4 – invoice ledger + creator drawer. |
| Workflow Category | Record | Trace commercial transactions. |
| Operational Behavior | Data-Dense | Renders customer names, amounts, tax details, and status. |
| Data Density | HIGH | Detailed financial columns. |
| Realtime Complexity | LOW | Page load query. |
| AI Complexity | NONE | Database record. |
| Audit Complexity | MEDIUM | Core financial entries. |
| Decision Pressure | MEDIUM | Spotting overdue invoice balances. |

---

## 3. BACKEND OPERATIONAL MAPPING

### 3.1 API Surface

| Endpoint | Method | Purpose | Key Response Fields |
|---|---|---|---|
| `GET /steel/invoices` | GET | List registered invoices | `invoices` |
| `POST /steel/invoices` | POST | Generate sales invoice | `invoice_id`, `status` |

---

## 4. WORKSPACE STRUCTURAL ANATOMY

### 4.1 Layout Pattern

**WORKSTATION SHELL + DETAIL PANEL**
Main table view listing invoices. Row click opens details panel. Clicking "Generate Invoice" opens creation modal drawer.

---

## 4A. VISUAL STRUCTURAL HIERARCHY BLUEPRINT

### A. Desktop Structural Blueprint (1440px)

```
┌──────────────────────────────────────────────────────────────────────────────┐
│ APPSHELL TOPBAR                                                              │
├──────────────────────────────────────────────────────────────────────────────┤
│ WORKSPACE HEADER: Invoices Directory             │ [ Generate Invoice (prim)]│
├──────────────────────────────────────────────────────────────────────────────┤
│ INVOICES LIST TABLE                                                          │
│ ┌────────────┬──────────────┬──────────────┬───────────────┬─────────────────┐ │
│ │ Invoice ID │ Customer     │ Net Amount   │ Tax (18%)     │ Status          │ │
│ ├────────────┼──────────────┼──────────────┼───────────────┼─────────────────┤ │
│ │ Inv-982    │ Apex Steel   │ $30,000      │ $5,400        │ [ Overdue ]     │ │
│ │ Inv-985    │ Prime Infra  │ $15,000      │ $2,700        │ [ Paid ]        │ │
│ └────────────┴──────────────┴──────────────┴───────────────┴─────────────────┘ │
└──────────────────────────────────────────────────────────────────────────────┘
```

---

## 5. OPERATIONAL ATTENTION HIERARCHY

- Level 1: "Overdue" status badges.
- Level 2: Invoice ID links.
- Level 3: Creation button.

---

## 6. TABLE & DATA STRATEGY

- Row height: Compact (36px).
- Click on invoice row navigates to `/steel/invoices/[id]`.

---

## 7. FORM & INPUT STRATEGY

Creation form collects:
- Customer select.
- Item sales lines (Item type, quantity, rate).
- Payment terms (days).

---

## 8. AI & AUDIT VISIBILITY STRATEGY

N/A.

---

## 9. DENSITY, SPACING & LAYOUT RHYTHM

- 4px spacing rhythm.
- Font styling: Sentence case.

---

## 10. RESPONSIVE & OPERATOR ADAPTATION

- Horizontal scroll enabled for tables on mobile screens.

---

## 11. COMPONENT MAPPING

- Grid: `DataTable`
- Form: `Drawer` primitive

---

## 12. OPERATIONAL PROBLEMS SOLVED

- Gated invoice views strictly to owners and financial managers using `can_view_steel_financials()`.

---

## 13. IMPLEMENTATION HANDOFF

### 13.1 Build Sequence

1. Define ledger layout.
2. Connect `GET /steel/invoices`.
3. Build the invoice generator dialog component.

### 13.2 Critical Constraints

- Check customer credit status before permitting generation.

---

## ACCEPTANCE CRITERIA (SPEC COMPLETENESS)

- [x] All 13 sections populated.
