# Workflow 5: Attendance Review & Regularization

## Operational Workflow Regression & Friction Audit

**Date:** June 17, 2026
**Auditor:** Buffy
**Workflow ID:** W-05
**Priority:** CRITICAL

---

## Workflow Map

**Start:** Dashboard or sidebar → `/attendance/review`
**End:** Attendance record approved/rejected, closed into payroll
**Goal:** Review missed punches, late arrivals, absent records, and regularization requests → approve or reject with corrected timings

### Flow Diagram
```
/attendance/review
  ├── Queue loads (25s auto-refresh)
  │     ├── Missed punches (critical severity)
  │     ├── Late entries (warning severity)
  │     ├── Absent records (critical severity)
  │     ├── Overtime checks (info severity)
  │     └── Regularization requests (mixed severity)
  │
  ├── "Review next" featured item → Detail panel
  │     ├── Details tab (punch times, worked/late/overtime)
  │     ├── Fix tab (edit punch in/out, final status, note)
  │     └── History tab (request timeline)
  │
  └── Decision
        ├── Approve & Close → record finalized
        └── Reject → must include note
```

### Click Count: 3 clicks + note typing per record
**Efficiency:** 7/10 — Clean design, single page, no page transitions.

### Critical Findings

**CRITICAL: Backlog collapse hides critical issues**
The "Backlog" (remaining items after the featured item) is hidden behind `<details>`. If a critical attendance issue (missed punch, absent) is in the backlog, the supervisor may never see it if they only process the featured item.

**HIGH: No bulk approve/reject for attendance**
Unlike the approvals page (which has bulk actions), the attendance review page processes items one at a time. For 20 late arrivals with similar circumstances, the supervisor must click each individually.

**HIGH: Form notes not persisted across refresh**
`DecisionForm` state is React-only. Accidental F5 loses all typed notes.

**MEDIUM: Auto-refresh (25s) may clear status messages**
After approving, a success message shows, but the 25s background refresh replaces it before the user can read it.

### Efficiency Score: 65/80 (81%)

### Recommendations
1. Bulk approve/reject for attendance (like approvals page)
2. sessionStorage persistence for review notes
3. Auto-expand backlog if critical items exist
4. Beforeunload handler for unsaved form edits
