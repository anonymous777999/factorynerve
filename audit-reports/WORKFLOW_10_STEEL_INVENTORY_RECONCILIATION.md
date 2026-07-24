# Workflow 10: Steel Inventory → Transactions → Reconciliation

## Operational Workflow Regression & Friction Audit

**Date:** June 17, 2026
**Auditor:** Buffy
**Workflow ID:** W-10
**Priority:** HIGH

---

## Workflow Map

**Start:** Dashboard → `/steel` → Inventory tab
**End:** Stock item reconciled → variance approved/rejected → confidence status updated
**Goal:** Track steel stock, record transactions, reconcile physical vs system quantities

### Flow Diagram
```
/steel → /steel/inventory
  ├── View stock list (item, category, balance KG, confidence status)
  │     ├── Green: Trusted (recent reconciliation OK)
  │     ├── Yellow: Check (variance detected)
  │     └── Red: Review (significant variance)
  │
  ├── Create transaction (add/remove stock)
  │     ├── Item selector, quantity, direction (in/out)
  │     └── Approval may be required (conditional maker-checker)
  │
  ├── /steel/inventory/transactions
  │     └── History log with balance before/after
  │
  └── /steel/reconciliations
        ├── List pending/approved/rejected
        ├── Submit physical count → variance calculated
        ├── Confidence status computed
        └── Approve/reject with notes
              └── Approval requires Admin/Owner
```

### Click Count: 10-15 clicks for full reconciliation cycle
**Efficiency:** 5/10

### Critical Findings

**CRITICAL: Reconciliation approval gating blocks supervisors**
Supervisors can see reconciliation items in the approvals queue but cannot approve — only Admin/Owner can. No "Escalate to Admin" button exists. Items sit in pending for days.

**HIGH: "Confidence status" terminology is unclear**
Uses green/yellow/red confidence bands that map to stock trust levels. In the approvals page, these are called "confidence_status" but in OCR they're "confidence_band". Different naming for same concept.

**HIGH: Backend approval service integration is conditional**
The `initiate_approval()` call in steel routes uses conditional maker-checker (IP-2 conditional pattern). Not all transactions trigger approval. This is not documented in the UI — operators don't know if their transaction will need approval.

### Efficiency Score: 45/80 (56%)

### Recommendations
1. Add "Notify Admin" button for reconciliation escalations
2. Unify confidence terminology across OCR, steel, and approvals
3. Show approval requirement indicator on transaction creation UI
4. Batch reconciliation for multi-item physical counts
