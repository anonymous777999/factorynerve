# Product Execution Roadmap

Updated: 2026-04-03

This roadmap is the working priority sheet for the DPR.ai web app.

Goal:
- finish the daily factory execution loop first
- then finish the money and movement loop
- then refine management visibility
- then polish admin and account surfaces

Priority legend:
- `P1` = build next
- `P2` = build after core loop is stable
- `P3` = management polish after execution flows
- `P4` = admin/account cleanup last

Effort legend:
- `S` = small polish / limited logic work
- `M` = moderate redesign or workflow cleanup
- `L` = major UX + logic integration

## Phase Order

### Phase 1: Daily Execution Loop
- Today Board
- Work Queue
- Attendance
- Shift Entry
- Document Desk
- Attendance Review
- Review Queue
- Review Documents

### Phase 2: Money + Movement Loop
- Customers
- Sales Invoices
- Dispatch
- Stock Review

### Phase 3: Management Layer
- Attendance Reports
- Reports & Exports
- Performance
- Owner Desk
- Factory Network
- Scheduled Updates
- AI Insights

### Phase 4: Admin + Account
- Attendance Admin
- Factory Admin
- Subscription
- Billing & Invoices
- Profile

## Execution Sheet

| Tab | Route | Priority | Current State | Main Gap | Target UX | Effort |
|---|---|---:|---|---|---|---:|
| Today Board | `/dashboard` | P1 | Strong direction, smart next action, live reminders wired | Needs cleaner role-by-role compression and less secondary noise | One clear next action, tiny quick actions, role-aware summary | M |
| Work Queue | `/work-queue` | P1 | Worker-first queue is strong | Supervisor and manager mode still need a true review inbox feel | Action stack for workers, inbox board for reviewers | M |
| Attendance | `/attendance` | P1 | Strong one-button punch flow | Needs tighter exception handoff and better end-of-shift guidance | One-click punch, live timer, immediate next step after attendance | S |
| Shift Entry | `/entry` | P1 | Strong mobile-first step form | Needs more edge-case polish and tighter completion feedback | Fast guided DPR flow with auto-save, sync clarity, and clean completion state | M |
| Document Desk | `/ocr/scan` | P1 | Strong scanner-style flow | Desktop handoff, export confidence, and review linkage still need polish | Camera-first mobile, focused desktop, clear scan-to-review outcome | M |
| Attendance Review | `/attendance/review` | P1 | Strong phase-1 responsive review board | Needs bulk actions, stronger audit/history, and pattern intelligence | Review table/cards, edit/approve/reject, later bulk and pattern workflows | M |
| Review Queue | `/approvals` | P1 | Functional but not yet the true operations inbox | Needs unification of attendance, DPR, OCR, and stock review decisions | Main supervisor/manager inbox with grouped review work and fast actions | L |
| Review Documents | `/ocr/verify` | P1 | Functional OCR review exists | UX is not yet as clean as the new scan flow | Row correction, approval, confidence cues, and batch-ready review | M |
| Customers | `/steel/customers` | P2 | Logic is improving and lifecycle foundation exists | UI still needs command-center clarity | Customer profile, risk, credit, follow-up, verification in one clear workspace | L |
| Sales Invoices | `/steel/invoices` | P2 | Core invoicing exists | Invoice lifecycle and collection visibility need refinement | Invoice creation, due-state, dispatch progress, payment follow-through | L |
| Dispatch | `/steel/dispatches` | P2 | Real dispatch logic exists | UX should feel like dispatch control instead of entry screens | Load -> dispatch -> delivered workflow with gate-pass clarity | L |
| Stock Review | `/steel/reconciliations` | P2 | Real review data and approval workflow exist | Needs location-wise counting, variance root-cause workflow, and adjustment controls | Factory stock intelligence board focused on physical vs system truth and fast mismatch resolution | L |
| Attendance Reports | `/attendance/reports` | P3 | Useful but secondary | Needs cleaner summaries and manager-ready drilldowns | Report view focused on completion, late signals, review load, and trend | M |
| Reports & Exports | `/reports` | P3 | Functional reporting exists | Needs clearer hierarchy and export workflow polish | One reporting hub for operational summaries and exports | M |
| Performance | `/analytics` | P3 | Exists as insight layer | Needs more intentional management UX and less generic dashboard feel | Trend-first management analytics with clear comparisons and next questions | M |
| Owner Desk | `/premium/dashboard` | P3 | High-level surface exists | Needs tighter owner-specific priorities | Dense but readable owner command center across profit, risk, and plant health | L |
| Factory Network | `/control-tower` | P3 | Useful multi-factory control idea exists | Needs clearer cross-factory comparison and switch flow | Cross-factory status and bottleneck comparison without confusion | M |
| Scheduled Updates | `/email-summary` | P3 | Functional but support-oriented | Needs setup clarity and stronger perceived value | Easy scheduled reporting configuration for managers and owners | S |
| AI Insights | `/ai` | P3 | Strong concept surface | Needs better tie-in with real operational questions | AI layer that explains risk, loss, anomaly, and suggested actions | L |
| Attendance Admin | `/settings/attendance` | P4 | Functional setup area | Needs cleanup, grouping, and role-safe defaults | Employee, shift, and attendance config with less admin friction | M |
| Factory Admin | `/settings` | P4 | Broad factory settings exist | Too much density and mixed concern in one place | Cleaner admin console for factories, roles, templates, and org controls | L |
| Subscription | `/plans` | P4 | Functional | Mostly commercial polish | Cleaner pricing and upgrade decision page | S |
| Billing & Invoices | `/billing` | P4 | Functional | Mostly trust and clarity polish | Clear payment, invoice, and plan-management flow | S |
| Profile | `/profile` | P4 | Strong redesign and profile-photo flow done | Only minor polish remains | Human-centered account page with identity, security, workspace, and activity | S |

## Recommended Next Build Order

1. Review Queue
2. Review Documents
3. Customers
4. Sales Invoices
5. Dispatch
6. Stock Review
7. Attendance Reports
8. Reports & Exports
9. Performance
10. Owner Desk
11. Factory Network
12. Scheduled Updates
13. AI Insights
14. Attendance Admin
15. Factory Admin
16. Subscription
17. Billing & Invoices

## Why This Order

### First win
Finish the loop that workers and supervisors touch every day.

That means:
- attendance
- shift entry
- scan
- review
- queue

If this loop feels complete, the product already feels operationally strong.

### Second win
Finish the business loop that turns production into money movement.

That means:
- customer
- invoice
- dispatch
- stock review

If this loop feels complete, the product starts feeling commercially serious.

### Third win
Give managers and owners clarity without clutter.

That means:
- reports
- analytics
- owner desk
- network
- scheduled updates
- AI

### Final win
Clean up the supporting infrastructure.

That means:
- admin
- billing
- subscription
- account polish

## Current Recommendation

If only one tab is picked next, build:

`Review Queue`

Reason:
- it connects the polished worker flow to supervisor and manager decisions
- it is the missing center of the operational loop
- once it is strong, the app stops feeling like separate screens and starts feeling like one system

## Stock Review Blueprint

Detailed execution plan:

`docs/STOCK_REVIEW_FACTORY_INTELLIGENCE_PLAN.md`

## Product Finish Checklist

Sprint-by-sprint execution sheet:

`docs/PRODUCT_COMPLETION_SPRINT_CHECKLIST.md`
