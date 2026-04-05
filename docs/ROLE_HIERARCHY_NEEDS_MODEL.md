# Role Hierarchy Needs Model

Updated: 2026-04-05  
Owner: Product + UX + Security  
Source references:

- `docs/role_security_matrix.md`
- `docs/FINAL_PRODUCT_SYSTEM_BLUEPRINT.md`
- `web/src/lib/role-navigation.ts`

## Purpose

This file defines the real product hierarchy for DPR.ai:

- who needs what
- how often they need it
- how much information they should see
- how much action power they should have

This is the model we should use for:

- navigation
- dashboard design
- reminder logic
- review routing
- permissions
- mobile vs desktop design

## Core Rule

Do not show users everything they are technically allowed to see.

Show them:

- what they need most
- when they need it
- at the depth they can act on

If a role does not act on a workflow regularly, it should not dominate their UI.

## Hierarchy Lens

We will define roles using 4 dimensions:

1. `Work Type`
2. `Decision Scope`
3. `Information Depth`
4. `Usage Frequency`

## 1. Canonical Role Order

Current product roles:

1. `attendance`
2. `operator`
3. `supervisor`
4. `accountant`
5. `manager`
6. `admin`
7. `owner`

Practical product hierarchy:

1. `attendance` = self-service only
2. `operator` = task execution
3. `supervisor` = review and floor control
4. `accountant` = reporting and commercial clarity
5. `manager` = factory operations control
6. `admin` = system and org administration
7. `owner` = risk, money, and final authority

Important truth:

`admin` is not a daily floor user.  
`owner` is not a daily execution user.

That means they should not receive worker-level reminders or worker-first navigation.

## 2. Information Depth Levels

Use these levels to decide how much a role should see.

### Level 1: Self-only action

The user only needs:

- one current task
- one status
- one action

Example:

- attendance user punching in

### Level 2: Daily execution

The user needs:

- current workload
- next action
- simple alerts
- no dense analysis

Example:

- operator

### Level 3: Review and exception control

The user needs:

- pending items
- mismatch reasons
- queue state
- approval / rejection context

Example:

- supervisor

### Level 4: Factory reporting and coordination

The user needs:

- summaries
- reports
- trends
- team or factory-level visibility
- moderate drill-down

Example:

- accountant, manager

### Level 5: Money and risk control

The user needs:

- condensed business signals
- anomaly / leakage / financial exposure
- evidence with drill-down
- less operational noise

Example:

- owner

## 3. Frequency Levels

Use these labels for every tab.

- `Primary` = used daily or several times a day
- `Secondary` = used often, but not the first place to land
- `Occasional` = important but not part of the main daily loop
- `Hidden` = should exist, but should not be prominent for this role

## 4. Role Definitions

## 4.1 Attendance

### What this role is

Default worker role for self-service attendance only.

### Main goal

Mark presence, punch status, and basic attendance corrections.

### Decision scope

- self only

### Information depth

- Level 1

### UI complexity allowed

- very low

### What this role needs

- attendance
- own attendance status
- own regularization path if needed
- profile

### What this role does not need

- shift entry
- OCR
- review queue
- reports
- analytics
- steel operations
- owner intelligence
- settings

## 4.2 Operator

### What this role is

Worker or floor user doing daily operational tasks.

### Main goal

Complete the next task, submit shift data, capture documents, stay unblocked.

### Decision scope

- self
- limited task-level operational input

### Information depth

- Level 2

### UI complexity allowed

- low

### What this role needs

- dashboard
- work queue
- shift entry
- attendance
- OCR scan

### What this role should see only lightly

- simple alerts
- offline queue
- own draft state

### What this role does not need

- approvals
- attendance review
- reports-heavy screens
- analytics
- billing
- owner desk
- advanced steel reporting

## 4.3 Supervisor

### What this role is

Shift lead / floor controller / review role.

### Main goal

Clear exceptions, review risky work, keep production and attendance moving.

### Decision scope

- team / shift / review lane

### Information depth

- Level 3

### UI complexity allowed

- medium

### What this role needs

- approvals
- work queue
- OCR verify
- attendance review
- reports
- stock review
- dispatch follow-through where relevant

### What this role should see only secondarily

- dashboard
- attendance live context
- steel charts

### What this role does not need

- billing
- plans
- owner desk
- org settings

## 4.4 Accountant

### What this role is

Finance / reporting / commercial clarity role.

### Main goal

Turn trusted data into reporting, customer follow-up, summaries, and commercial visibility.

### Decision scope

- reporting
- commercial review
- no floor approvals

### Information depth

- Level 4

### UI complexity allowed

- medium

### What this role needs

- reports
- attendance reports
- email summary
- steel customers
- steel invoices

### What this role should see only secondarily

- attendance
- customer exposure drill-down

### What this role does not need

- shift entry
- punch reminders
- OCR scan
- approvals
- stock reconciliation review
- factory admin
- owner risk cockpit

## 4.5 Manager

### What this role is

Factory operations controller.

### Main goal

Coordinate execution, clear important reviews, monitor reports, and keep the factory running well.

### Decision scope

- factory level

### Information depth

- Level 4

### UI complexity allowed

- medium-high

### What this role needs

- dashboard
- approvals
- reports
- analytics
- steel control
- work queue

### What this role should see only secondarily

- attendance
- OCR verify
- email summary
- settings

### What this role should not see as a primary daily flow

- billing
- plans
- owner desk as primary home

### Important note

Manager may still need shift entry or punch in some factories, but these should not dominate the UI.

## 4.6 Admin

### What this role is

System / organization administrator, not a daily plant operator.

### Main goal

Maintain users, settings, permissions, configuration, and oversight.

### Decision scope

- org and system control

### Information depth

- Level 4 for system control
- not Level 2 daily execution

### UI complexity allowed

- medium-high

### What this role needs

- dashboard
- approvals
- reports
- settings
- attendance admin
- analytics

### What this role should see only secondarily

- steel operations overview
- operational exceptions

### What this role should not receive

- punch reminders
- shift entry reminders
- worker draft reminders
- offline queue reminders for DPR

### Important note

Admin should monitor and configure the system, not be treated like a floor worker.

## 4.7 Owner

### What this role is

Final commercial and risk authority.

### Main goal

See money, risk, exposure, trust, and action priority fast.

### Decision scope

- org-wide
- financial
- strategic

### Information depth

- Level 5

### UI complexity allowed

- high-density, but only around meaningful business signals

### What this role needs

- premium dashboard
- control tower
- reports
- AI insights
- email summary
- steel charts

### What this role should see only secondarily

- deeper source evidence
- drill-down into review or stock issue when needed

### What this role should not receive

- punch reminders
- shift entry reminders
- worker draft reminders
- daily operator workflow nudges

### Important note

Owner is not the daily entry user.  
Owner is the money-protection and decision user.

## 5. Role Need Matrix By Major Tab

Legend:

- `P` = Primary
- `S` = Secondary
- `O` = Occasional
- `H` = Hidden / not needed in normal UX

| Tab / Route | attendance | operator | supervisor | accountant | manager | admin | owner |
| --- | --- | --- | --- | --- | --- | --- | --- |
| `/dashboard` | H | P | S | H | P | S | H |
| `/work-queue` | H | P | P | H | S | O | H |
| `/attendance` | P | S | O | O | O | H | H |
| `/tasks` | H | S | S | H | H | H | H |
| `/entry` | H | P | O | H | O | H | H |
| `/ocr/scan` | H | P | O | H | O | H | H |
| `/approvals` | H | H | P | H | P | S | O |
| `/attendance/review` | H | H | P | H | O | O | H |
| `/ocr/verify` | H | H | P | H | O | O | H |
| `/steel/reconciliations` | H | H | P | H | O | O | O |
| `/attendance/reports` | H | H | O | P | O | O | H |
| `/reports` | H | H | S | P | P | P | S |
| `/analytics` | H | H | O | H | S | S | S |
| `/premium/dashboard` | H | H | H | H | O | O | P |
| `/control-tower` | H | H | H | H | O | O | P |
| `/email-summary` | H | H | O | P | S | O | P |
| `/ai` | H | H | H | H | O | O | S |
| `/steel` | H | H | O | H | P | O | O |
| `/steel/charts` | H | H | O | H | S | H | P |
| `/steel/customers` | H | H | H | P | S | O | O |
| `/steel/invoices` | H | H | H | P | S | O | O |
| `/steel/dispatches` | H | H | O | H | P | O | H |
| `/settings/attendance` | H | H | H | H | O | P | H |
| `/settings` | H | H | H | H | O | P | O |
| `/plans` | H | H | H | H | H | O | O |
| `/billing` | H | H | H | H | H | O | O |
| `/profile` | P | S | S | S | S | S | S |

## 6. Reminder Hierarchy

This is especially important for UX.

### Attendance reminders should go to

- `attendance`
- `operator`
- `supervisor`
- `manager`

### Shift entry reminders should go to

- `operator`
- `supervisor`
- `manager`

### Review reminders should go to

- `supervisor`
- `manager`
- `admin`
- `owner`

### Reporting reminders should go to

- `accountant`
- `manager`
- `admin`
- `owner`

### Owner-risk reminders should go to

- `owner`
- `manager` where appropriate

### Never send worker-style reminders to

- `admin`
- `owner`

Examples:

- `Punch in is still open` -> not for admin/owner
- `Shift entry is still pending` -> not for admin/owner
- `Saved shift draft is waiting` -> not for admin/owner

## 7. Navigation Rule

Use this simple rule:

### Primary navigation

Only include tabs marked `P`.

### Secondary navigation

Include tabs marked `S`.

### Overflow / contextual navigation

Include tabs marked `O`.

### Hidden

Do not show in normal navigation unless there is a direct reason.

## 8. UI Rule By Role

### Attendance

- one-task UI
- self-only
- no density

### Operator

- action-first
- mobile-first
- minimal analysis

### Supervisor

- queue-first
- exception-first
- safe decision UI

### Accountant

- reporting-first
- clean commercial data
- exports and summaries

### Manager

- control-first
- report + review balance
- cross-workflow visibility

### Admin

- system-first
- config and oversight
- not worker-like

### Owner

- risk-first
- money-first
- summary-first

## 9. Practical Product Decisions From This Model

These are the rules we should follow immediately:

1. `admin` and `owner` should not get punch reminders
2. `admin` and `owner` should not get shift-entry reminders
3. `owner` should land in owner-value surfaces, not operations-first surfaces
4. `attendance` should stay extremely narrow
5. `operator` should stay mobile and action-driven
6. `supervisor` should be the review-first role
7. `accountant` should be reports-first, not floor-first
8. `admin` should be admin-first, not worker-first

## 10. Best Next Use Of This File

Use this file before touching:

- nav
- dashboard hierarchy
- reminders
- role home routes
- primary CTA per role
- mobile tab bar
- review routing

If a future design or feature conflicts with this hierarchy, the hierarchy should win first.
