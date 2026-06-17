# Workflow 11: Steel Dispatch Workflow

## Operational Workflow Regression & Friction Audit

**Date:** June 17, 2026
**Auditor:** Buffy
**Workflow ID:** W-11
**Priority:** HIGH

---

## Workflow Map

**Start:** Dashboard → `/steel/dispatches`
**End:** Dispatch delivered → inventory posted → invoice linked
**Goal:** Create dispatches against invoices, track truck loading → exit → delivery, update inventory

### Flow Diagram
```
/steel  →  /steel/invoices → Select invoice → Create dispatch
  │
  ├── Create dispatch
  │     ├── Invoice number, truck details, driver info, lines
  │     ├── Status flow: pending → loaded → exited → dispatched → delivered
  │     └── Conditional approval for quantity overrides
  │
  ├── /steel/dispatches (list view)
  │     ├── Status, truck, customer, weight, dates
  │     └── Filter by status
  │
  ├── /steel/dispatches/[id] (detail)
  │     ├── Full dispatch info + lines
  │     ├── Status update buttons
  │     ├── Ledger movements (inventory impact)
  │     └── Audit events
  │
  ├── /steel/dispatches/[id] → Update status
  │     ├── Entry time (loaded)
  │     ├── Exit time (exited)
  │     ├── Delivered (delivered)
  │     └── Cancel (cancelled)
  │
  └── Invoice linkage
        ├── Dispatch lines reference invoice lines
        ├── Dispatched weight reduces invoice remaining weight
        └── Inventory posted at dispatch
```

### Click Count: 8-12 clicks per dispatch
**Efficiency:** 6/10

### Critical Findings

**CRITICAL: Dispatch status transition has no guardrails**
Status transitions are manual API calls (updateSteelDispatchStatus). No state machine validation in the frontend. A user could accidentally dispatch a truck still marked as "loaded" (no exit time). Backend validates but no frontend warning.

**HIGH: Inventory posted at dispatch, not at delivery**
Inventory reduction happens on dispatch creation/exit, not on delivery confirmation. If a truck is dispatched but never delivered, inventory is already reduced — creating a false stockout risk.

**MEDIUM: No bulk dispatch status update**
Each dispatch status update requires opening the detail page. For 10 dispatches ready to mark as "exited", 10 separate page visits needed.

### Efficiency Score: 48/80 (60%)

### Recommendations
1. Add frontend status transition hints (exit time required before dispatched)
2. Add "delivery confirmation" step before final inventory posting
3. Bulk status update from the list view
4. Dispatch-to-invoice progress indicator (dispatched weight vs invoice total)
