# Role & Security Matrix

Last updated: 2026-04-03

## Purpose

This document captures:

- the real roles currently implemented in the codebase
- what each role can do today
- where the current role model is weak or risky
- the recommended target role model before wider launch

Primary source of truth:

- `backend/models/user.py`
- `backend/rbac.py`
- backend route guards in `backend/routers/*`
- frontend role-based navigation in `web/src/components/app-shell.tsx`

## Canonical Roles

The app currently has 7 canonical roles:

1. `attendance`
2. `operator`
3. `supervisor`
4. `accountant`
5. `manager`
6. `admin`
7. `owner`

The backend rank order is:

`attendance < operator < accountant < supervisor < manager < admin < owner`

This order matters anywhere `require_role(...)` is used.

## Current Role Summary

### `attendance`

- Attendance-only worker role
- Public registration default for existing workspaces
- Can use self-service attendance punch and regularization
- Cannot access entries, analytics, OCR, reports, approvals, or settings

### `operator`

- Worker-facing role
- Has worker dashboard mode
- Can use self-service attendance
- Can use OCR scan/submit flows
- Can see own alerts and own scoped data
- Cannot approve entries, run attendance review, or manage settings

### `supervisor`

- Review/shift-lead role
- Can approve/reject entries
- Can see live attendance and review attendance corrections
- Can access analytics and operational reporting
- Does not manage factories, users, or org-level settings

### `accountant`

- Finance/reporting role
- Can access reporting and email summary flows
- Can access steel commercial flows such as invoices, customers, and payments
- Is explicitly blocked from raw entries and smart input
- Is plan-gated when assigning the role

### `manager`

- Factory operations admin role
- Can manage factory settings, attendance settings, users, invites, and factories
- Can access control tower and most management screens
- Is currently strong enough to change roles and plans for scoped users
- Is currently stronger than a normal factory manager would usually be in production SaaS

### `admin`

- Org-level admin role
- Can do manager work plus org-wide factory-access editing
- Can approve/reject steel stock reconciliations
- Frontend treats admin as leadership for plans and billing

### `owner`

- Highest role
- Inherits admin access
- Has a few owner-only powers
- Current owner-only distinction is still thin

## Current Access Matrix

Legend:

- `yes` = allowed
- `self` = only own records
- `factory` = scoped to active factory
- `org` = org-wide
- `ui-only` = visible in frontend, but backend rule is weaker or broader

Note: `attendance` is the new lowest-privilege role and currently follows attendance-self-service behavior only.

| Capability | operator | supervisor | accountant | manager | admin | owner | Current state |
| --- | --- | --- | --- | --- | --- | --- | --- |
| Public self-registration | yes | yes | yes | yes | yes | no | High-risk: registration only blocks `owner` today |
| Worker dashboard mode | yes | no | no | no | no | no | Operator-only simplified home |
| Review dashboard / approvals | no | yes | no | yes | yes | yes | Starts at supervisor |
| Raw production entries | self/factory scope | factory | no | factory/org by scope | org | org | Accountant explicitly blocked |
| Entry approval / rejection | no | yes | no | yes | yes | yes | Starts at supervisor |
| Attendance self punch / regularization | yes | yes | yes if assigned attendance user | yes | yes | yes | Self-service routes use current user + active factory |
| Attendance live board | no | factory | no | factory | factory/org by rank | factory/org by rank | Starts at supervisor |
| Attendance employee + shift settings | no | no | no | factory | factory/org by rank | factory/org by rank | Starts at manager |
| OCR scan / OCR verification submit | yes | yes | no | yes | yes | yes | Accountant excluded from OCR access |
| OCR verification visibility | self | self | no | factory | org | org | Query scope changes by role |
| OCR template access | no direct worker template admin | factory | no | factory | org | org | Admin/owner see org templates; others factory/self |
| Analytics | no | yes | no | yes | yes | yes | Starts at supervisor |
| Reports / email summary | self limited | factory | factory | factory | org | org | Accountant allowed here |
| Alerts | self | self | self | factory | org | org | Backend scoping is real |
| Factory settings | no | no | no | factory | org by rank | org by rank | Starts at manager |
| Create factory | no | no | no | yes | yes | yes | Strong power currently starts at manager |
| Control tower | no | no | no | yes | yes | yes | Starts at manager |
| Invite users | no | no | no | factory | org | org | Strong power currently starts at manager |
| Change user roles | no | no | no | factory | org | org | Strong power currently starts at manager |
| Edit user factory access | no | no | no | no | org | org | Starts at admin |
| View plans page | no in UI | no in UI | no in UI | no in UI | ui-only yes | ui-only yes | Frontend restricts to leadership |
| Billing + checkout routes | yes backend | yes backend | yes backend | yes backend | yes | yes | Backend currently allows any authenticated user |
| Steel commercial flows | limited | yes | yes | yes | yes | yes | Accountant included on invoice/customer/payment routes |
| Steel stock reconciliation review | no | no | no | no | yes | yes | Admin/owner only |
| Steel owner daily PDF export | no | no | no | no | no | yes | Owner only |

## Verified Current Security Risks

### 1. Public registration is now constrained

Current behavior:

- `/auth/register` still blocks `owner` in all cases
- first user in a brand-new workspace is bootstrapped as `admin`
- users joining an existing workspace are assigned `attendance`
- high-role public registration attempts (`manager`, `admin`, etc.) are blocked

Why this matters:

- it keeps public signup at low privilege
- it forces role elevation through manager/admin/owner workflows

Recommended target:

- keep public signup at `attendance`
- promote workers to `operator`/higher only through authorized role update flows
- keep `accountant`, `manager`, `admin`, and `owner` invite/admin-only

### 2. Manager can currently grant too much power

Current behavior:

- manager can invite users
- manager can change user roles
- manager can change user plans
- manager can create factories
- manager can access control-tower-level org controls

Why this is risky:

- a factory manager should usually not be able to create or promote admins
- a compromised manager account can escalate other accounts
- it blurs factory operations vs org administration

Recommended target:

- manager should stay factory-scoped
- manager should manage operators, supervisors, and attendance/factory ops
- manager should not assign `admin` or `owner`
- manager should not edit org billing or global plan state

### 3. Billing backend is weaker than billing frontend

Current behavior:

- frontend nav shows `/plans` and `/billing` only to leadership
- backend billing routes rely on authentication but do not enforce leadership-only role checks

Why this is risky:

- hidden UI is not real authorization
- any authenticated user may be able to trigger billing actions directly if they call the API

Recommended target:

- at minimum restrict billing checkout, downgrade, and order creation to `admin` + `owner`
- for stricter control, make billing write actions `owner` only and billing read actions `admin` + `owner`

### 4. Owner vs admin separation is thin

Current behavior:

- owner mostly behaves like admin with only a few extra actions

Why this matters:

- ownership should represent the final financial and security authority
- if admin and owner are nearly the same, the owner role has little practical meaning

Recommended target:

- keep `owner` for final org control
- move subscription changes, owner assignment, destructive org actions, and exported financial authority to owner
- keep admin as org administrator without final ownership powers

## Recommended Target Role Model

### `operator`

- Public registration allowed
- Self-service attendance
- Self tasks
- OCR scan / submit
- Own alerts
- Own reports only where needed
- No approvals
- No settings

### `supervisor`

- Invite-only
- Factory-scoped review role
- Approvals
- Attendance review
- Live floor visibility
- Operational analytics
- No org admin
- No billing

### `accountant`

- Invite-only
- Finance/reporting role
- Reports
- Email summary
- Steel commercial records
- No raw entry editing
- No smart input
- No floor approvals
- No org billing write access

### `manager`

- Invite-only
- Factory-scoped operations admin
- Factory settings
- Shift/attendance setup
- Team invites for lower roles
- Factory operations dashboard
- No org-wide security administration
- No billing write access
- No admin/owner promotion

### `admin`

- Invite-only
- Org administration role
- Manage factories
- Manage user memberships across factories
- Manage admin-level approval workflows
- Optional billing read access
- No owner assignment

### `owner`

- Invite-only
- Final authority for org, billing, and security
- Billing write access
- Owner assignment
- Critical org-wide exports and override actions

## Recommended Security Implementation Order

### Phase 1: block privilege escalation

1. Restrict public registration roles in `backend/routers/auth.py`
2. Restrict manager role assignment powers in `backend/routers/settings.py`
3. Restrict manager invite powers for high-privilege roles in `backend/routers/settings.py`

### Phase 2: align backend with frontend leadership controls

1. Add backend role guards to billing routes in `backend/routers/billing.py`
2. Decide whether billing should be `admin + owner` or `owner` only
3. Keep frontend nav aligned with backend authorization

### Phase 3: separate factory admin from org admin

1. Decide whether factory creation should remain `manager+` or move to `admin+`
2. Decide whether control tower should remain `manager+` or move to `admin+`
3. Decide whether manual org plan override should be `owner` only

### Phase 4: harden with tests

Add regression tests for:

- public sign-up cannot self-assign `admin`, `manager`, or `accountant`
- manager cannot promote a user to `admin` or `owner`
- non-leadership roles cannot call billing write APIs
- owner-only routes remain owner-only

## Recommended Immediate Decisions

Before changing behavior, confirm these product rules:

1. Should public sign-up create only `operator`, or `operator + supervisor`?
2. Should billing writes be `owner` only, or `admin + owner`?
3. Should manager be allowed to create factories, or should that move to `admin + owner`?
4. Should manager be allowed to invite only lower roles, or also `manager` peers?

## Practical Next Step

The safest next implementation pass is:

1. lock public registration to low-privilege roles
2. move billing writes to leadership-only
3. stop manager from assigning `admin` / `owner`
4. add tests before launch
