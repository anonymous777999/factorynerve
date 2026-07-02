# Workflow 9: Admin User Invite / Role Management / Factory Access

## Operational Workflow Regression & Friction Audit

**Date:** June 17, 2026
**Auditor:** Buffy
**Workflow ID:** W-09
**Priority:** MEDIUM

---

## Workflow Map

**Start:** Dashboard → `/settings?tab=users`
**End:** User invited, role updated, or factory access modified
**Goal:** Manage organization users: invite new users, update roles, control factory access, deactivate users

### Flow Diagram
```
/settings → Users tab
  ├── Users list (table with ID, name, email, role, factory count, plan, active)
  │
  ├── Invite User
  │     ├── Name, Email, Role (dropdown from assignableRoles)
  │     ├── API call → returns user_code, verification link, reset link
  │     └── Links shown in status message (security concern — links in UI)
  │
  ├── Factory Access
  │     ├── Select user → load factory snapshot
  │     ├── Toggle checkboxes for each factory
  │     └── Save → updates user's factory assignments
  │
  ├── Update Role
  │     ├── User Code/ID input
  │     ├── New Role dropdown
  │     ├── Type "DOWNGRADE" to confirm lower roles
  │     └── Approval service invoked (maker-checker for privileged roles)
  │
  └── Deactivate User
        ├── User Code/ID input
        └── Deactivation call
```

### Click Count: 5-8 clicks per user management action
**Efficiency:** 7/10

### Critical Findings

**CRITICAL: Verification/reset links shown in UI status message**
After inviting a user, the `result.verification_link` and `result.reset_link` are displayed in the status message as plain text. These are sent via email and should NOT be displayed in the UI. Anyone looking at the screen (shoulder surf) can see the links.

**HIGH: Role downgrade confirmation uses string typing**
The downgrade confirmation requires typing "DOWNGRADE" in a text input. This is case-sensitive string matching. A user typing "downgrade" (lowercase) will be rejected with no error message — the button just doesn't work.

**HIGH: Deactivation uses numeric ID, not searchable**
The deactivate input requires the numeric user_code or DB id. No search or autocomplete. For orgs with 50+ users, finding the right ID is manual.

**MEDIUM: No confirmation dialog for deactivation**
Deactivation calls the API immediately when the button is clicked, with no "Are you sure?" or "This user will lose access" prompt.

**MEDIUM: Factory access save requires at least one factory**
The system prevents deselecting the last factory. However, if a user is deactivated but left with factory access, stale assignments exist.

### Efficiency Score: 55/80 (68%)

### Recommendations
1. Remove verification/reset links from UI — only show "Invitation sent to email@example.com"
2. Make "DOWNGRADE" comparison case-insensitive
3. Add user search/autocomplete for deactivation and role update
4. Add deactivation confirmation dialog with impact summary
5. Add "deactivated" filter for stale factory access cleanup
