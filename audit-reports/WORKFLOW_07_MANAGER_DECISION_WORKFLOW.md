# Workflow 7: Manager Decision Workflow

## Operational Workflow Regression & Friction Audit

**Date:** June 17, 2026
**Auditor:** Buffy
**Workflow ID:** W-07
**Priority:** HIGH

---

## Workflow Map

**Start:** Dashboard → `/approvals` or `/work-queue` or `/ocr/verify`
**End:** Decision made (approve/reject/escalate) on a managed item
**Goal:** Process approvals escalated from supervisors, review OCR documents, handle DPR entry approvals, monitor factory performance

### Flow Diagram
```
/approvals (primary entry point)
  ├── Queue loads all pending items (attendance, DPR, OCR, stock)
  ├── Manager can approve:
  │     ├── ✅ Attendance review
  │     ├── ✅ DPR entries
  │     ├── ✅ OCR verifications (unique to manager+)
  │     ├── ❌ Stock reconciliation (admin+ only)
  │     └── ❌ Billing/admin changes (owner only)
  │
  ├── Decision paths:
  │     ├── Single approve/reject with note
  │     ├── Bulk approve/reject with shared note
  │     └── Open source page for deeper investigation
  │
  └── Secondary flows:
        ├── /work-queue → task-based work view
        ├── /ocr/verify → direct OCR review
        ├── /reports → performance insights
        ├── /analytics → trend analysis
        └── /steel → steel operations overview
```

### Click Count: 2-3 clicks per decision (in approvals page)
**Efficiency:** 7/10

### Critical Findings

**CRITICAL: Manager cannot approve stock or billing**
Stock reconciliation requires admin+, billing changes require owner. Manager sees them in the queue as "Escalation needed" with no way to route them forward. Items age in the queue with no notification to admin/owner.

**HIGH: OCR approval bypass throttle**
The approvals page lets managers approve OCR verifications with a note ≥20 chars even if confidence is low (below 60%). No minimum confidence threshold enforcement.

**MEDIUM: No SLA dashboard per approval type**
Manager has no view of "how many items are overdue by type." The approvals page shows total stale items but no breakdown by workflow type with SLA targets.

**MEDIUM: No "assign to me" or claim workflow**
Multiple managers see the same queue. There's no locking — two managers could review the same OCR document independently, and the second one's action fails (item already approved) with no clear error.

### Efficiency Score: 55/80 (68%)

### Recommendations
1. Add escalate-to-admin button for stock/billing items in manager's queue
2. Enforce minimum confidence threshold for OCR approval without override
3. Add per-workflow SLA dashboard (attendance: 24h, OCR: 48h, stock: 72h)
4. Implement claim/lock on queue items (first to open gets precedence)
