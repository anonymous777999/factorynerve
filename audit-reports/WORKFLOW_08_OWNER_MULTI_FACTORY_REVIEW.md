# Workflow 8: Owner Multi-Factory Review

## Operational Workflow Regression & Friction Audit

**Date:** June 17, 2026
**Auditor:** Buffy
**Workflow ID:** W-08
**Priority:** MEDIUM

---

## Workflow Map

**Start:** Dashboard → `/settings` → Control Tower or `/admin-billing`
**End:** Multi-factory overview reviewed, critical decisions made
**Goal:** Review all factories in the organization, check billing status, monitor anomalies, make owner-level decisions

### Flow Diagram
```
/approvals (owner has full approve power)
  ├── Can approve all item types:
  │     ├── Attendance, DPR, OCR, Stock, Admin
  │     └── Final override authority
  │
/settings
  ├── Control Tower (organization overview)
  │     ├── Factory network (total factories, industry breakdown)
  │     ├── Active users count
  │     └── Plan and billing status
  │
/settings → Factory tab
  ├── Switch between factories (multi-factory management)
  ├── Edit factory settings, workflow templates, industry profile
  ├── Create new factories
  │
/settings → Usage tab
  ├── Plan limits, current usage, billing cycle
  │
/settings → Alerts tab (admin/owner only)
  ├── Manage alert configurations
  │
/admin-billing
  ├── Billing events across all organizations
  ├── Subscription management
  └── Webhook activity audit
```

### Click Count: 5-10 clicks for periodic review
**Efficiency:** 6/10

### Critical Findings

**CRITICAL: No unified multi-factory approval queue**
Each factory has its own approvals queue. Owner switching factories must reload approvals each time. No "view all factories" mode for the approvals page.

**HIGH: Control Tower is buried in Settings**
The organization overview / control tower is accessed via `/settings` → scroll down. No dedicated dashboard page gives a one-glance view of all factories' health (pending approvals, stale items, billing issues).

**MEDIUM: Admin-billing is a separate route**
`/admin-billing` is distinct from `/settings/billing`. The billing page shows events and subscriptions across ALL organizations (superadmin view), not just the owner's org. This is confusing for org-level owners.

**MEDIUM: Factory switching requires full page reload**
Changing active factory via `selectFactory()` triggers a full session refresh. No in-page factory switcher.

### Efficiency Score: 40/80 (50%)

### Recommendations
1. Add "All factories" filter to approvals page (owner sees aggregated queue)
2. Create a dedicated Control Tower dashboard at `/control-tower`
3. Merge admin-billing into settings or add clear navigation context
4. Add in-page factory switcher without full session reload
