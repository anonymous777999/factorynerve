# UI/UX Mobile Desktop Fix Matrix

Updated: 2026-04-05  
Owner: Product + Design + Frontend  
Source references:

- `web/src/components/app-shell.tsx`
- `web/src/lib/role-navigation.ts`
- `web/src/components/*-page.tsx`

## Purpose

Use this file as the implementation checklist for fixing DPR.ai screen-by-screen for:

- mobile usability
- desktop usability
- layout consistency
- action clarity
- responsive behavior

This is not a visual moodboard.

This is the practical fix matrix for every major tab in the current product.

## Design Goal

Every tab should feel:

- clear on first load
- usable in under 10 seconds
- touch-friendly on mobile
- dense but readable on desktop
- role-appropriate
- action-first, not clutter-first

## Universal Rules For Every Tab

### Mobile rules

- never allow important data tables to force horizontal page scroll
- keep one primary CTA visible without hunting
- move secondary actions into bottom sheet, overflow menu, or collapsible section
- convert multi-column desktop cards into single-column stacked cards
- use sticky bottom action bars for forms and review actions
- keep filters in drawers or collapsible panels
- charts must have a card/list fallback, not chart-only rendering
- touch targets should feel safe at `44px+`
- long numbers must wrap safely or abbreviate
- empty states must tell the user exactly what to do next

### Desktop rules

- use width for context, not for empty space
- keep filters visible on the same screen when the workflow is analysis-heavy
- keep tables, charts, and detail context side-by-side where it helps decisions
- use sticky headers or sticky action bars for long review tables
- preserve dense data layouts without reducing readability
- keep one clear primary action per screen even on wide layouts

### Common behavior rules

- each screen must answer:
  - where am I?
  - what matters now?
  - what do I do next?
- use consistent section order:
  - summary
  - current action
  - detailed data
  - secondary tools
- loading states must preserve layout shape
- errors must explain recovery path
- empty states must link to the next valid workflow

## Priority Scale

- `P0`: workflow breaks trust or causes user confusion now
- `P1`: workflow works but feels heavy or inefficient
- `P2`: polish and visual consistency

## Fix Order Recommendation

1. `P0` high-frequency tabs
2. `P1` reporting and owner tabs
3. `P2` admin and account tabs

Best starting order:

1. `/dashboard`
2. `/entry`
3. `/ocr/scan`
4. `/approvals`
5. `/reports`
6. `/steel/dispatches`
7. `/premium/dashboard`

---

## Today Tabs

### Today Board

- Route: `/dashboard`
- File: `web/src/components/dashboard-home.tsx`
- Priority: `P0`
- Mobile fixes:
  - keep only one hero CTA and two support cards above the fold
  - collapse advanced insights by default
  - stack alert/trust/quick-action blocks vertically
  - reduce metric clusters from 3-column mini cards into 2 or 1 column cards
  - keep the role guide visible before the heavy data sections
- Desktop fixes:
  - keep hero + Now + Attention + Quick Actions as a strong first screen
  - pin the most role-critical rail section higher for manager and owner
  - reduce visual competition between alerts, trusted OCR, and anomaly sections
  - make advanced insights feel like a second layer, not part of the primary workflow
- Done when:
  - operator sees next action in under 3 seconds
  - owner can spot risk and click deeper in one move

### Work Queue

- Route: `/work-queue`
- File: `web/src/components/work-queue-page.tsx`
- Priority: `P0`
- Mobile fixes:
  - convert any wide queue rows into compact stacked cards
  - keep filters in a slide-down or drawer
  - make queue actions thumb-reachable
  - keep queue counts visible without forcing summary + table + detail at once
- Desktop fixes:
  - use split view if detail context is important
  - keep batch actions visible with sticky controls
  - support denser table rows without losing priority badges
- Done when:
  - queue triage feels fast on phone and on desktop

### Attendance

- Route: `/attendance`
- File: `web/src/components/attendance-page.tsx`
- Priority: `P0`
- Mobile fixes:
  - punch actions must stay above the fold
  - reduce extra explanation blocks around punch flow
  - keep attendance status card large and clear
  - if there are logs/history, move them below the main punch flow
- Desktop fixes:
  - keep self-service attendance at center, not stretched across the page
  - move history to side panel or lower section
  - avoid oversized hero if the page is action-light
- Done when:
  - attendance user can punch without reading the whole page

### My Day

- Route: `/tasks`
- File: `web/src/components/my-tasks-page.tsx`
- Priority: `P1`
- Mobile fixes:
  - show only today-critical tasks first
  - compress task metadata into badges
  - make task completion CTA sticky if task detail is long
- Desktop fixes:
  - support two-pane task list + detail when task volume is high
  - keep task status and owner visible in list view
- Done when:
  - users can process tasks without jumping between multiple screens

### Shift Entry

- Route: `/entry`
- File: `web/src/app/entry/page.tsx`
- Priority: `P0`
- Mobile fixes:
  - break form into clear sections with progress feel
  - use sticky bottom action bar for save/submit
  - reduce grid-heavy inputs into one-column layout
  - keep date, shift, units, and downtime fields early
  - hide secondary analytics/help copy until after the form
- Desktop fixes:
  - use two-column form with summary rail
  - keep validation messages close to the fields
  - show recent entry or conflict context alongside the form
- Done when:
  - a worker can submit entry on mobile with one-hand scrolling

### Document Desk

- Route: `/ocr/scan`
- File: `web/src/components/ocr-scan-page.tsx`
- Priority: `P0`
- Mobile fixes:
  - preserve full camera-first behavior
  - remove non-essential explanatory text from the top
  - keep scan/upload/retake/continue actions fixed and obvious
  - show processing state in large simple steps
  - keep post-scan next action very clear: review, export, or save
- Desktop fixes:
  - support side-by-side image preview and result state
  - keep capture workflow compact instead of wasting wide space
  - show recent scan context or trust note on the right
- Done when:
  - mobile capture feels like the main experience, not a squeezed desktop page

---

## Steel Operations Tabs

### Steel Operations

- Route: `/steel`
- File: `web/src/components/steel-command-center-page.tsx`
- Priority: `P1`
- Mobile fixes:
  - convert dashboard tiles into vertical action cards
  - keep only top operational lanes above the fold
  - reduce simultaneous KPI density
- Desktop fixes:
  - use command-center layout with clear lane separation
  - keep drill-down actions visible near each KPI cluster
- Done when:
  - steel manager knows where to click next without scanning the whole board

### Steel Charts

- Route: `/steel/charts`
- File: `web/src/components/steel-charts-page.tsx`
- Priority: `P1`
- Mobile fixes:
  - do not force chart-only view; provide insight cards below charts
  - use swipe-safe or stacked chart modules
  - keep one chart block open at a time if the page is long
  - add text summaries below every important chart
- Desktop fixes:
  - use multi-panel analytical board
  - maintain chart + commentary + action link grouping
  - prevent charts from feeling visually disconnected
- Done when:
  - users can still understand the page without interacting deeply with charts

### Customers

- Route: `/steel/customers`
- File: `web/src/components/steel-customers-page.tsx`
- Priority: `P1`
- Mobile fixes:
  - change customer tables into summary cards
  - surface overdue amount and next action first
  - keep search/filter compact
- Desktop fixes:
  - support denser customer ledger tables
  - allow quick scan of exposure, overdue, and open invoices
- Done when:
  - the commercial team can identify recovery priority fast

### Sales Invoices

- Route: `/steel/invoices`
- File: `web/src/components/steel-invoices-page.tsx`
- Priority: `P1`
- Mobile fixes:
  - move invoice filters into compact drawer
  - show invoice amount, weight, status, and customer in card form
  - avoid wide commercial tables on small screens
- Desktop fixes:
  - keep linked dispatch visibility near invoice rows
  - allow faster bulk scanning by date and status
- Done when:
  - invoice follow-up does not require horizontal scrolling

### Dispatch

- Route: `/steel/dispatches`
- File: `web/src/components/steel-dispatches-page.tsx`
- Priority: `P0`
- Mobile fixes:
  - keep dispatch readiness and blockers at top
  - use sticky submit area for create/save actions
  - collapse material allocation details until needed
  - make truck/driver/invoice essentials visible first
  - prevent long line-item tables from becoming impossible on mobile
- Desktop fixes:
  - use left form + right summary or checklist rail
  - keep linked invoice and dispatch packet visible while editing
  - preserve weight warnings in visible summary area
- Done when:
  - manager can create dispatch without confusion on both laptop and phone

---

## Review Tabs

### Attendance Review

- Route: `/attendance/review`
- File: `web/src/components/attendance-review-page.tsx`
- Priority: `P1`
- Mobile fixes:
  - replace wide review rows with stacked cards
  - keep approve/reject actions thumb-reachable
  - show employee, date, issue, and required note before metadata
- Desktop fixes:
  - keep fast row processing with side detail
  - allow denser queue with sticky filters
- Done when:
  - supervisor can clear exceptions without opening each item in a new page

### Review Queue

- Route: `/approvals`
- File: `web/src/components/approvals-page.tsx`
- Priority: `P0`
- Mobile fixes:
  - ensure queue list works as card stack, not table
  - move filters, presets, and SLA lanes into collapsible blocks
  - keep bulk selection understandable on touch devices
  - keep item actions visible without opening too many nested sections
- Desktop fixes:
  - keep list + detail split view strong
  - preserve bulk action bar while scrolling
  - keep queue metrics visible without crowding work area
- Done when:
  - mixed review work can be processed safely on desktop and understood on mobile

### Review Documents

- Route: `/ocr/verify`
- File: `web/src/components/ocr-verification-page.tsx`
- Priority: `P0`
- Mobile fixes:
  - stack image preview above editable table or flagged cells
  - focus mobile review on only doubtful rows or fields
  - keep approve/reject/export actions sticky
  - avoid showing full dense table by default if flagged-only review is possible
- Desktop fixes:
  - use image/table split layout
  - keep trust/audit/export source in side rail
  - preserve wide-table editing comfortably
- Done when:
  - OCR review feels like correction work, not spreadsheet punishment

### Stock Review

- Route: `/steel/reconciliations`
- File: `web/src/components/steel-reconciliations-page.tsx`
- Priority: `P0`
- Mobile fixes:
  - show mismatch cards with kg, percent, cause, and action
  - move secondary batch/invoice context behind expanders
  - keep review decision CTA always visible
- Desktop fixes:
  - use mismatch list + detail context
  - show variance, cause, and linked operational impact together
- Done when:
  - stock review answers one question fast: physical vs system mismatch and next action

---

## Management Tabs

### Attendance Reports

- Route: `/attendance/reports`
- File: `web/src/components/attendance-reports-page.tsx`
- Priority: `P1`
- Mobile fixes:
  - compress date filters into one row or drawer
  - convert daily breakdown table into day cards or stacked rows
  - keep the top four KPIs as clean cards
- Desktop fixes:
  - preserve summary + filter + table layout
  - keep daily breakdown readable without excessive row height
- Done when:
  - reports stay scannable on both phone and laptop

### Reports & Exports

- Route: `/reports`
- File: `web/src/components/reports-page.tsx`
- Priority: `P0`
- Mobile fixes:
  - keep reporting hub cards first
  - move heavy filters into collapsible area
  - render result rows as cards, not wide tables
  - ensure export buttons never disappear below long content
- Desktop fixes:
  - keep filter + export + results flow visible without too much scrolling
  - preserve analytical density with good grouping
  - keep trust summary visually tied to exports
- Done when:
  - management can move from filter to export without getting lost

### Performance

- Route: `/analytics`
- File: `web/src/components/analytics-page.tsx`
- Priority: `P1`
- Mobile fixes:
  - avoid too many charts above the fold
  - summarize each section in text before charts
  - use swipable or stacked chart blocks
- Desktop fixes:
  - make comparisons and trend charts live together in a real dashboard grid
  - maintain drill-down clarity
- Done when:
  - analytics feels readable, not like a chart dump

### Owner Desk

- Route: `/premium/dashboard`
- File: `web/src/components/premium-dashboard-page.tsx`
- Priority: `P0`
- Mobile fixes:
  - show top risk, money at risk, and next action first
  - reduce density of lower-priority cards
  - collapse evidence sections until expanded
  - keep drill-down buttons visible per block
- Desktop fixes:
  - keep the board high-density but clearly zoned
  - group risk, evidence, and action so the page reads like a decision board
  - avoid long vertical scroll before the first useful insight
- Done when:
  - owner can identify top risk in under 60 seconds on desktop and under 90 seconds on mobile

### Factory Network

- Route: `/control-tower`
- File: `web/src/components/control-tower-page.tsx`
- Priority: `P1`
- Mobile fixes:
  - show one factory card at a time or stacked cards
  - use compact compare mode instead of multi-wide tables
  - avoid trying to replicate desktop comparison grid on phone
- Desktop fixes:
  - keep comparison-first layout
  - make switching and drill-down obvious
- Done when:
  - multi-factory comparison is still useful on mobile and strong on desktop

### Scheduled Updates

- Route: `/email-summary`
- File: `web/src/components/email-summary-page.tsx`
- Priority: `P1`
- Mobile fixes:
  - keep date range and send-readiness cards above the draft editor
  - make body editor full width
  - move compose links below draft controls
  - keep copy/generate buttons close to the subject/body flow
- Desktop fixes:
  - preserve snapshot left / draft right split
  - keep trust and owner-risk summaries visible beside editing
- Done when:
  - manager can prepare an outbound summary without bouncing between sections

### AI Insights

- Route: `/ai`
- File: `web/src/components/ai-insights-page.tsx`
- Priority: `P1`
- Mobile fixes:
  - keep insight cards short and explain impact first
  - avoid wide query/result panels
  - make follow-up action links clear
- Desktop fixes:
  - support evidence + answer + source links in one view
  - keep filters/questions close to results
- Done when:
  - AI page feels like decisions, not experimentation

---

## Admin And Account Tabs

### Attendance Admin

- Route: `/settings/attendance`
- File: `web/src/components/settings-attendance-page.tsx`
- Priority: `P2`
- Mobile fixes:
  - group setup blocks into accordion sections
  - avoid full admin tables on phone
  - keep save state visible
- Desktop fixes:
  - use settings categories with clear left-to-right hierarchy
  - support denser forms and employee lists
- Done when:
  - admin setup is manageable without becoming the default mobile workflow

### Factory Admin

- Route: `/settings`
- File: `web/src/components/settings-page.tsx`
- Priority: `P2`
- Mobile fixes:
  - treat as secondary workflow, not primary mobile surface
  - group by organization, users, factory, templates
  - push long configuration tables behind detail views
- Desktop fixes:
  - use two-column or tabbed admin layout
  - keep user-role management near factory context
- Done when:
  - admin feels structured, not sprawling

### Subscription

- Route: `/plans`
- File: `web/src/components/plans-page.tsx`
- Priority: `P2`
- Mobile fixes:
  - keep comparison cards stacked
  - reduce long marketing copy
  - keep upgrade CTA visible
- Desktop fixes:
  - support side-by-side plan comparison
  - keep business value callouts above feature lists
- Done when:
  - pricing feels clear and credible on both screen sizes

### Billing & Invoices

- Route: `/billing`
- File: `web/src/components/billing-page.tsx`
- Priority: `P2`
- Mobile fixes:
  - collapse invoice history rows into cards
  - keep payment CTA and current status at top
- Desktop fixes:
  - preserve table view for billing history
  - keep current plan and invoice list visually tied
- Done when:
  - leadership can understand billing state in one glance

### Profile

- Route: `/profile`
- File: `web/src/components/profile-page.tsx`
- Priority: `P2`
- Mobile fixes:
  - keep identity, password, and access blocks separate
  - use one-column forms only
- Desktop fixes:
  - use compact settings card layout
  - keep profile actions close to identity details
- Done when:
  - profile changes feel simple, not admin-heavy

---

## Supporting Screens That Also Need Responsive Review

These are not main tabs, but they must still be checked:

- `/attendance/live`
- `/entry/[id]`
- `/steel/batches/[id]`
- `/steel/customers/[id]`
- `/steel/invoices/[id]`
- `/steel/dispatches/[id]`
- `/login`
- `/register`
- `/forgot-password`
- `/reset-password`

## Implementation Pattern Library To Apply

Use these patterns repeatedly instead of redesigning every page from scratch:

- `Hero + primary CTA + 2 support cards`
- `Filter drawer on mobile / inline filter bar on desktop`
- `Card list on mobile / table or split view on desktop`
- `Sticky bottom action bar for forms on mobile`
- `Summary rail on desktop for review, dispatch, owner, and reporting screens`
- `Chart + text summary pair`
- `Flagged-only edit mode for OCR and review-heavy screens`

## QA Checklist Per Tab

For every tab, confirm:

- no horizontal page scroll on `390px` mobile width
- primary CTA visible without confusion
- filters usable on mobile
- chart sections have text fallback
- tables degrade into cards or stacked rows
- sticky actions do not cover important content
- desktop view uses space intentionally
- loading, empty, and error states still look structured

## Final Recommendation

Do not fix screens randomly.

Run the UX work in this order:

1. all `P0` tabs
2. all `P1` tabs
3. all `P2` tabs

And for every tab, fix:

1. action clarity
2. responsive layout
3. data readability
4. visual polish

That order will improve the real product faster than cosmetic redesign first.
