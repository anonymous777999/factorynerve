# Billing — Workspace Skeleton Architecture
# FactoryNerve OS | Phase 3 Skeleton Specification | Phase E, Item 5
# Route: /billing
# Generated: 2026-06-03
# Status: DRAFT

---

## 1. WORKSPACE OVERVIEW

### 1.1 Identity

| Field | Value |
|---|---|
| Route | `/billing` |
| Workspace Name | Factory Billing Hub |
| Operational Role | Management panel for invoicing, payment histories, and active subscription adjustments (GET /billing/status, GET /billing/invoices, POST /downgrade, POST /orders). |
| Business Impact | Payment processing and business compliance. If this workspace fails, owners cannot settle billing issues, causing accounts to freeze. |
| User Population | Owner, Accountant. Restricted gate: Owner-only for updates. |
| Peak Usage Context | Month-end invoice audit or payment cycles. |
| Predecessor Workspaces | `/plans` |
| Successor Workspaces | `/settings` |

### 1.2 Operational Importance

Manages cash flow operations. Shows active usage levels (e.g. users count, OCR scans completed) against billing package quotas.

### 1.3 Current State Failures

- **Failure 1: Open operations access.** Operators can view invoice logs. Access must be gated to Owner and Accountant roles.
- **Failure 2: Lack of pending payment alerts.** No visual warnings are shown for failed invoice payments.

---

## 2. WORKSPACE CLASSIFICATION

| Dimension | Classification | Rationale |
|---|---|---|
| Workspace Type | Entity Detail | TYPE 5 — billing records detail and payment ledger. |
| Workflow Category | Record | Commercial billing administration. |
| Operational Behavior | Form-Driven | Handles payment executions. |
| Data Density | MEDIUM | Quota metrics, active plans, and invoice tables. |
| Realtime Complexity | LOW | Page load query. |
| AI Complexity | NONE | Database record. |
| Audit Complexity | MEDIUM | Writes payment order entries. |
| Decision Pressure | MEDIUM | Resolving unpaid balances. |

---

## 3. BACKEND OPERATIONAL MAPPING

### 3.1 API Surface

| Endpoint | Method | Purpose | Key Response Fields |
|---|---|---|---|
| `GET /billing/status` | GET | Retrieve active subscription details | Subscription JSON |
| `GET /billing/invoices` | GET | List previous billing invoices | List of invoices |
| `POST /billing/orders` | POST | Register payment order | `order_id`, `amount` |
| `POST /billing/downgrade` | POST | Downgrade package tier | `status` |

---

## 4. WORKSPACE STRUCTURAL ANATOMY

### 4.1 Layout Pattern

**CONTEXT-RAIL + DATA TABLES**
Left Context Rail: Active package info, quota limits, and downgrade actions. Main area: Invoices Ledger table.

---

## 4A. VISUAL STRUCTURAL HIERARCHY BLUEPRINT

### A. Desktop Structural Blueprint (1440px)

```
┌──────────────────────────────────────────────────────────────────────────────┐
│ APPSHELL TOPBAR                                                              │
├──────────────────────────────────────────────────────────────────────────────┤
│ WORKSPACE HEADER: Billing & Subscription                                     │
├───────────────┬──────────────────────────────────────────────────────────────┤
│ CONTEXT RAIL  │ INVOICES LEDGER                                              │
│ Plan: Growth  │ ┌──────────────┬─────────────┬─────────────┬───────────────┐ │
│ Cost: $99/mo  │ │ Invoice ID   │ Date        │ Amount      │ Status        │ │
│ Quota: 8/10   │ ├──────────────┼─────────────┼─────────────┼───────────────┤ │
│ [Downgrade]   │ │ Inv-F1-0982  │ 01 May 2026 │ $99.00      │ [ Paid ]      │ │
│               │ │ Inv-F1-0811  │ 01 Apr 2026 │ $99.00      │ [ Paid ]      │ │
│               │ └──────────────┴─────────────┴─────────────┴───────────────┘ │
└───────────────┴──────────────────────────────────────────────────────────────┘
```

---

## 5. OPERATIONAL ATTENTION HIERARCHY

- Level 1: Quota threshold bars (shown red if usage > 90%).
- Level 2: Invoice rows.
- Level 3: Downgrade links.

---

## 6. TABLE & DATA STRATEGY

Invoices table. Compact row density.

---

## 7. FORM & INPUT STRATEGY

N/A.

---

## 8. AI & AUDIT VISIBILITY STRATEGY

None.

---

## 9. DENSITY, SPACING & LAYOUT RHYTHM

- 4px spacing rhythm.
- Quota meters: standard status values.

---

## 10. RESPONSIVE & OPERATOR ADAPTATION

- Context rail moves to the top on mobile.

---

## 11. COMPONENT MAPPING

- Layout: `WorkstationShell`
- Tables: `DataTable`

---

## 12. OPERATIONAL PROBLEMS SOLVED

- Gates invoice summaries strictly to owners and accountants.
- Warns users if quotas exceed 90%.

---

## 13. IMPLEMENTATION HANDOFF

### 13.1 Build Sequence

1. Define base layout wrappers.
2. Hook `GET /billing/status` query.
3. Wire transaction ledger table parameters.

### 13.2 Critical Constraints

- Downgrade button must only be enabled for owners.

---

## ACCEPTANCE CRITERIA (SPEC COMPLETENESS)

- [x] All 13 sections populated.
