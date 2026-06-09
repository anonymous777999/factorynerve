# Steel Customers — Workspace Skeleton Architecture
# FactoryNerve OS | Phase 3 Skeleton Specification | Phase D, Item 7
# Route: /steel/customers
# Generated: 2026-06-03
# Status: DRAFT

---

## 1. WORKSPACE OVERVIEW

### 1.1 Identity

| Field | Value |
|---|---|
| Route | `/steel/customers` |
| Workspace Name | Steel Customers Ledger |
| Operational Role | Lists all registered commercial steel customers (GET /customers) and allows registration of new customers (POST /customers). Gated to steel factories. |
| Business Impact | Direct order and delivery routing. If this workspace fails, order entries cannot resolve customer profiles. |
| User Population | Sales Manager, Accountant, Owner. |
| Peak Usage Context | Customer registration and credit review. |
| Predecessor Workspaces | `/steel` (hub) |
| Successor Workspaces | `/steel/customers/[id]`, `/steel/invoices` |

### 1.2 Operational Importance

Manages client entities. Exposes active credit limits, pending invoice totals, and contact details.

### 1.3 Current State Failures

- **Failure 1: Open credit values.** Credit values are visible to all roles. Needs financial permission gating (`can_view_steel_financials`).
- **Failure 2: Lack of navigation links.** Deep linking to details is broken.

---

## 2. WORKSPACE CLASSIFICATION

| Dimension | Classification | Rationale |
|---|---|---|
| Workspace Type | Entity List | TYPE 4 — customer directory + creation drawer. |
| Workflow Category | Record | Trace commercial clients. |
| Operational Behavior | Data-Dense | Renders customer names, balances, and credit details. |
| Data Density | MEDIUM | Standard contact and ledger details. |
| Realtime Complexity | LOW | Page load query. |
| AI Complexity | NONE | Raw database record list. |
| Audit Complexity | LOW | Simple logs on profile updates. |
| Decision Pressure | LOW | Credit limit monitoring. |

---

## 3. BACKEND OPERATIONAL MAPPING

### 3.1 API Surface

| Endpoint | Method | Purpose | Key Response Fields |
|---|---|---|---|
| `GET /steel/customers` | GET | List registered customers | `customers` |
| `POST /steel/customers` | POST | Register new customer profile | `customer_id`, `status` |

---

## 4. WORKSPACE STRUCTURAL ANATOMY

### 4.1 Layout Pattern

**WORKSTATION SHELL + DETAIL PANEL**
Main table view listing customers. Row click selects active customer details. Clicking "Register Customer" opens creation modal drawer.

---

## 4A. VISUAL STRUCTURAL HIERARCHY BLUEPRINT

### A. Desktop Structural Blueprint (1440px)

```
┌──────────────────────────────────────────────────────────────────────────────┐
│ APPSHELL TOPBAR                                                              │
├──────────────────────────────────────────────────────────────────────────────┤
│ WORKSPACE HEADER: Customers Directory           │ [ Register Customer (prim)]│
├──────────────────────────────────────────────────────────────────────────────┤
│ CUSTOMERS LIST TABLE                                                         │
│ ┌───────────────┬────────────────────┬─────────────────────┬───────────────┐ │
│ │ Customer Name │ Outstanding Bal    │ Credit Limit        │ Active Orders │ │
│ ├───────────────┼────────────────────┼─────────────────────┼───────────────┤ │
│ │ Apex Steel    │ $45,000            │ $100,000            │ 3             │ │
│ │ Prime Infra   │ $12,000            │ $50,000             │ 1             │ │
│ └───────────────┴────────────────────┴─────────────────────┴───────────────┘ │
└──────────────────────────────────────────────────────────────────────────────┘
```

---

## 5. OPERATIONAL ATTENTION HIERARCHY

- Level 1: Over-credit warning badges.
- Level 2: Customer Name links.
- Level 3: Registration trigger button.

---

## 6. TABLE & DATA STRATEGY

- Row height: Compact (36px).
- Click on customer row navigates to `/steel/customers/[id]`.

---

## 7. FORM & INPUT STRATEGY

Registration form collects:
- Customer Name.
- Credit Limit.
- Contact Number/Address.

---

## 8. AI & AUDIT VISIBILITY STRATEGY

N/A.

---

## 9. DENSITY, SPACING & LAYOUT RHYTHM

- 4px spacing rhythm.
- Font styling: Sentence case.

---

## 10. RESPONSIVE & OPERATOR ADAPTATION

- Tables scroll horizontally on small screens.

---

## 11. COMPONENT MAPPING

- Grid: `DataTable`
- Form: `Dialog` or Drawer primitive

---

## 12. OPERATIONAL PROBLEMS SOLVED

- Restricts credit limit and balance views strictly to owners and financial managers using `can_view_steel_financials()`.

---

## 13. IMPLEMENTATION HANDOFF

### 13.1 Build Sequence

1. Define directory table layout.
2. Connect `GET /steel/customers` API endpoint.
3. Build the customer addition dialog component.

### 13.2 Critical Constraints

- Validate credit limit input fields.

---

## ACCEPTANCE CRITERIA (SPEC COMPLETENESS)

- [x] All 13 sections populated.
