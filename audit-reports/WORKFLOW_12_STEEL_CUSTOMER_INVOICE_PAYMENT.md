# Workflow 12: Steel Customer → Invoice → Payment/Dispatch Cycle

## Operational Workflow Regression & Friction Audit

**Date:** June 17, 2026
**Auditor:** Buffy
**Workflow ID:** W-12
**Priority:** MEDIUM

---

## Workflow Map

**Start:** Dashboard → `/steel/customers` or `/steel/invoices`
**End:** Invoice created, dispatch linked, payment received, ledger balanced
**Goal:** Manage the complete customer lifecycle: create customer records (with PAN/GST verification), issue invoices, track dispatches against invoices, record payments, and manage follow-ups

### Flow Diagram
```
/steel/customers
  ├── List customers (credit limit, outstanding, risk level)
  ├── Create customer (name, contact, PAN/GST, credit terms)
  ├── Customer detail / ledger
  │     ├── Invoice history
  │     ├── Payment history
  │     ├── Follow-up tasks
  │     ├── Risk alerts (overdue, credit limit breached)
  │     └── Verification workflow
  │           ├── PAN verification (async API check)
  │           ├── GST verification (async API check)
  │           ├── Document upload (PAN/GST proof)
  │           └── Review & approve/reject
  │
  └── /steel/customers → Create payment
        ├── Payment date, amount, mode, reference
        ├── Invoice allocation (split across invoices)
        └── Conditional approval for reversals

/steel/invoices
  ├── List invoices (status, amount, overdue, customer)
  ├── Create invoice (customer, lines, rates, terms)
  │     └── Lines reference items and optionally batches
  ├── Invoice detail
  │     ├── Dispatch summary (dispatched weight vs total)
  │     ├── Linked dispatches
  │     └── Payment status
  └── Invoice → Create dispatch flow
```

### Click Count: 8-15 clicks per customer lifecycle action
**Efficiency:** 5/10

### Critical Findings

**CRITICAL: Customer verification is multi-step with no progress indicator**
Creating a customer with PAN/GST verification requires: create → verify PAN → verify GST → upload documents → review → approve. Each step is a separate API call and page interaction. There's no progress bar showing "2/6 steps complete."

**HIGH: Risk score and credit limit are not recalculated in real-time**
Credit risk score is computed server-side but not refreshed after payment recording. A customer could pay off their entire outstanding but still show "high risk" until the page is manually refreshed.

**HIGH: Invoice ↔ dispatch linkage is read-only in invoice view**
The invoice detail shows which dispatches are linked and how much weight is remaining. But creating a new dispatch from the invoice page requires navigating to `/steel/dispatches` and manually entering the invoice ID.

**MEDIUM: Payment allocation UI is text-based**
When recording a payment, allocations are sent as `{ invoice_id, amount }[]` in raw API payloads. No visual "split payment across these open invoices" interface.

**MEDIUM: Follow-up tasks have no auto-reminder**
Creating a follow-up task with a due date stores it but sends no notification or reminder when the date arrives.

### Efficiency Score: 42/80 (52.5%)

### Recommendations
1. Add multi-step progress indicator for customer verification
2. Refresh risk score after payment recording without page reload
3. Add "Create dispatch from this invoice" button on invoice detail
4. Visual payment allocation with invoice selection and amount sliders
5. Auto-reminder when follow-up task due date is reached
6. Unified credit limit dashboard (show all customers approaching limit)
