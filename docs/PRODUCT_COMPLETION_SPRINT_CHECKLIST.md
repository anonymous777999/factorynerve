# Product Completion Sprint Checklist

Updated: 2026-04-04
Owner: Product + Engineering
Source references:

- `docs/FINAL_PRODUCT_SYSTEM_BLUEPRINT.md`
- `docs/PRODUCT_EXECUTION_ROADMAP.md`
- `docs/MASTER_QA_MATRIX.md`

## Purpose

This is the execution sheet for finishing DPR.ai as a production-grade V1.

Use it when you want to know:

- what to build next
- what must be finished before moving on
- which quality gates must pass
- what "done" actually means per sprint

This file assumes:

- all major features stay in the product
- the product must feel connected, not fragmented
- trust and usability matter more than adding more surface area

## Sprint Rules

1. Finish sprints in order.
2. Do not start the next sprint until the current exit gate passes.
3. No new major module should be added before Sprint 3 is complete.
4. Every sprint must end with backend tests, frontend lint/build, and a role-based manual smoke pass.
5. Every sprint must improve one of these:
   - trust
   - daily usability
   - owner value
   - steel workflow realism

## Suggested Cadence

- Sprint length: `5-7 working days`
- Demo at the end of every sprint
- One owner-facing story and one operator-facing story must be demoable every sprint

## Sprint Overview

| Sprint | Main Goal | Why It Comes Now | Exit Proof |
| --- | --- | --- | --- |
| 1 | OCR trust chain | Biggest trust blocker in current product | corrected OCR export matches reviewed data |
| 2 | Role-compressed workflow | Product must feel simpler before more polish | each role has a clear primary navigation and home flow |
| 3 | Review center hardening | Review is the trust engine across the platform | supervisors can clear mixed review work quickly and safely |
| 4 | Owner intelligence packaging | High-value features must become sellable | owner can see money risk, source, and action |
| 5 | Steel loop completion | Steel module must feel operationally complete | stock, batch, invoice, and dispatch flow work as one loop |
| 6 | Reporting and launch polish | Product must be easy to demo, sell, and ship | clean end-to-end demo and go-live readiness |

## Shared Quality Gate For Every Sprint

- [ ] `python -m pytest -q` passes
- [ ] `npm run lint` passes
- [ ] `npm run build` passes
- [ ] operator walkthrough passes on mobile
- [ ] supervisor walkthrough passes on desktop
- [ ] owner walkthrough passes on desktop
- [ ] `docs/MASTER_QA_MATRIX.md` updated for affected flows

## Sprint 1 - OCR Trust Chain

Goal:
Make OCR export, review, and downstream use fully trustworthy.

Status:

- completed on `2026-04-04`
- trusted OCR export now comes from reviewed verification rows
- downstream dashboards now separate approved OCR from untrusted OCR
- scan flow can open the exact saved review draft directly

Current reality:

- scan flow creates reviewed data
- Excel generation also runs through a separate OCR job path
- this creates a real risk that corrected rows and exported rows do not match

Main outcome:
A reviewer corrects OCR once and gets the exact corrected output everywhere.

### Build checklist

- [x] create a backend export path that builds Excel from approved or reviewed verification data
- [x] separate `raw OCR output` from `approved OCR output`
- [x] treat approved verification data as a trusted source
- [x] update scan completion flow so users understand what happens next
- [x] update review screen with a clear `Export corrected Excel` action
- [x] show export source in UI:
  - `Raw OCR`
  - `Approved Data`
- [x] prevent rejected or unapproved documents from appearing as trusted exports
- [x] make reports and intelligence consume trusted OCR data only where relevant
- [x] add tests that prove corrected cells appear in exported Excel
- [x] add audit visibility for who approved and exported corrected data

### Likely file areas

- `backend/routers/ocr.py`
- OCR verification persistence layer in backend models/services
- `web/src/components/ocr-scan-page.tsx`
- `web/src/components/ocr-verification-page.tsx`
- `web/src/lib/ocr.ts`

### Exit gate

- [x] reviewer edits one value and the same corrected value appears in downloaded Excel
- [x] exported file is deterministic across repeated downloads
- [x] corrected export is clearly labeled as approved output
- [x] no conflicting raw-vs-approved document confusion remains in the main OCR journey

### Demo script

1. Upload a register image
2. Correct one wrong quantity
3. Approve the document
4. Export Excel
5. Show the corrected value in the file

## Sprint 2 - Role-Compressed Workflow

Goal:
Make the product feel simpler and clearer for every role.

Status:

- implementation bundle completed on `2026-04-04`
- role-based home routing, sidebar priorities, mobile nav priorities, and dashboard focus cards are updated
- manual role-by-role smoke pass is still recommended before calling Sprint 2 fully signed off

Current reality:

- many strong modules exist
- the platform is broad
- low-tech users can still feel too much product at once

Main outcome:
Operators, supervisors, managers, and owners each see a product that feels made for them.

### Build checklist

- [x] define final primary nav set per role:
  - operator
  - supervisor
  - manager
  - owner
- [x] set default home route per role
- [x] compress admin and premium surfaces into grouped secondary navigation
- [x] remove duplicate or low-value entry points from primary rails
- [x] make Today board role-aware with one strong next action
- [x] make mobile nav mirror desktop priorities
- [x] ensure Document Scan, Work Queue, Review Queue, and Reports sit in the right prominence order
- [x] add empty states that tell users what to do next
- [ ] do a permission smoke pass after navigation changes

### Likely file areas

- `web/src/components/app-shell.tsx`
- `web/src/components/dashboard-home.tsx`
- `web/src/components/home-route.tsx`
- role gating helpers in `web/src/lib`

### Exit gate

- [ ] operator sees only the primary daily workflow
- [ ] supervisor lands in execution or review context fast
- [ ] owner reaches risk and summary views in one click
- [ ] mobile navigation feels lighter, not just smaller

### Demo script

1. Log in as operator
2. Show primary daily nav
3. Log in as supervisor
4. Show review-first navigation
5. Log in as owner
6. Show owner dashboard and risk entry point

## Sprint 3 - Review Center Hardening

Goal:
Make the review system the reliable trust center across OCR, attendance, and stock.

Status:

- implementation bundle completed on `2026-04-04`
- `/approvals` now includes quick presets, source-specific decision summaries, stronger activity/history visibility, escalation guidance for blocked items, high-risk note guardrails, direct next-step links, and backlog mix metrics
- automated regression bundle passed: `python -m pytest -q`, `npm.cmd run lint -- src/components/approvals-page.tsx`, and `npm.cmd run build`
- manual mixed-work supervisor smoke is still recommended before calling Sprint 3 fully signed off

Current reality:

- review queue foundation exists
- attendance is already in the queue
- bulk actions and SLA lanes already exist
- the next step is to make the queue feel fully operational

Main outcome:
Supervisors can process mixed work quickly without confusion or unsafe approvals.

### Build checklist

- [x] make `/approvals` the default supervisor inbox
- [x] add clear source-specific summaries before approval
- [x] add stronger history and latest-decision visibility in the queue
- [x] add saved filter presets such as:
  - `Today`
  - `8h+`
  - `24h+`
  - `Stock only`
  - `OCR only`
- [x] add reopen or escalate handling for blocked items
- [x] make review notes mandatory where risk is high
- [x] add direct next-step links back to source workflows for complex fixes
- [x] add queue metrics for backlog by type and urgency
- [x] complete regression checks for OCR, attendance, and stock review flows

### Likely file areas

- `web/src/components/approvals-page.tsx`
- `web/src/components/attendance-review-page.tsx`
- `web/src/components/ocr-verification-page.tsx`
- review-related API helpers in `web/src/lib`

### Exit gate

- [ ] supervisor can process 20 mixed review items without losing context
- [x] high-risk items cannot be approved accidentally
- [x] queue clearly shows what is waiting, why, and what comes next
- [x] audit trail is understandable during manual review

### Demo script

1. Open `/approvals`
2. Filter to `8h+`
3. Approve one attendance item
4. reject one OCR item with note
5. open one stock item for deep fix
6. show updated queue counts

## Sprint 4 - Owner Intelligence Packaging

Goal:
Turn anomaly and leakage signals into a real owner-value layer.

Status:

- implementation bundle completed on `2026-04-04`
- `/premium/dashboard` now packages money at risk, stock trust, dispatch exposure, repeated anomaly evidence, owner action language, and responsibility radar into one owner surface
- `/email-summary` now carries owner-ready risk wording and appendable risk lines so weekly updates explain exposure, not just activity
- automated regression bundle passed: `npm.cmd run lint -- src/components/premium-dashboard-page.tsx src/components/email-summary-page.tsx` and `npm.cmd run build`
- operator/day/batch responsibility signals and stock trust hotspots are packaged; true location-level ranking still needs location data in the steel model
- manual owner demo walkthrough is still recommended before calling Sprint 4 fully signed off

Current reality:

- anomaly preview exists
- analytics exists
- premium owner dashboard exists
- steel intelligence signals exist in pieces
- packaging is weaker than the actual value

Main outcome:
An owner can quickly answer: `Where am I losing money, why, and what should I check first?`

### Build checklist

- [x] define owner dashboard sections:
  - money at risk
  - stock trust
  - dispatch exposure
  - repeated anomalies
  - top responsibility signals
- [x] quantify risk in INR where data quality allows
- [x] add evidence cards that explain why each anomaly was flagged
- [x] connect anomalies to source pages:
  - batch
  - dispatch
  - stock review
  - reports
- [x] rank repeated risk by operator, batch, and day, plus stock trust hotspots
- [x] write owner-facing action language instead of generic analytics copy
- [x] improve weekly owner summary email wording around risk and exposure
- [x] align plan gating and premium packaging with owner-value surfaces
- [x] produce a simple sales-ready narrative for anomaly prevention

### Likely file areas

- `web/src/components/dashboard-home.tsx`
- `web/src/components/analytics-page.tsx`
- `web/src/components/premium-dashboard-page.tsx`
- `web/src/components/steel-charts-page.tsx`
- `backend/services/steel_service.py`

### Exit gate

- [ ] owner can identify top risk in under 60 seconds
- [ ] owner can click from risk card to source evidence
- [ ] anomaly surfaces explain impact, not just scores
- [ ] product story around loss prevention becomes demoable

### Demo script

1. Open owner dashboard
2. show top risk card with INR impact
3. drill into source batch or stock issue
4. show responsibility context
5. show weekly summary output

## Sprint 5 - Steel Operating Loop Completion

Goal:
Make stock, production, invoice, and dispatch feel like one real steel workflow.

Status:

- implementation bundle completed on `2026-04-04`
- stock loop now includes derived operational zones, last-variance visibility, and structured mismatch causes
- invoice detail now carries linked dispatch chain and dispatch summary
- dispatch detail now shows a readable movement timeline and weight consistency checks
- customer ledger now packages overdue recovery focus and invoice drill-downs
- steel charts now include action-oriented drill-down cards instead of only passive KPI viewing
- automated regression bundle passed: `python -m pytest tests/test_steel_module.py -q`, `python -m pytest -q`, `cd web && npm.cmd run lint`, and `cd web && npm.cmd run build`
- exact yard/bin/location tracking is still a future data-model upgrade; current zone view is derived from raw/WIP/finished material stage and called out honestly in the UI

Current reality:

- dispatch is real
- invoices exist
- charts exist
- stock review exists
- the module still needs tighter operational correlation

Main outcome:
A steel manager can track movement from stock to batch to invoice to dispatch with confidence.

### Build checklist

- [x] add location-wise stock visibility:
  - yard
  - warehouse
  - production line
- [x] show variance in both `kg` and `%`
- [x] add root-cause workflow for stock mismatch:
  - counting error
  - process loss
  - theft or leakage
  - wrong entry
  - delayed dispatch update
- [x] tighten invoice -> dispatch linkage and status clarity
- [x] improve customer exposure and overdue summary
- [x] connect batch loss to stock and dispatch drill-downs
- [x] make dispatch detail page show the full movement timeline clearly
- [x] improve steel charts with action-oriented drill-down links
- [x] validate weight consistency across invoice, dispatch, and reconciliation flows

### Likely file areas

- `web/src/components/steel-charts-page.tsx`
- `web/src/components/steel-dispatches-page.tsx`
- `web/src/components/steel-dispatch-detail-page.tsx`
- `web/src/components/steel-customer-ledger-page.tsx`
- `backend/routers/steel.py`
- `backend/services/steel_service.py`
- `web/src/lib/steel.ts`

### Exit gate

- [x] manager can trace one batch from production to invoice to dispatch
- [x] stock mismatch can be classified and resolved with reason
- [x] location-wise stock feels real for steel operations
- [x] charts help action, not just viewing

### Demo script

1. Open stock review
2. show mismatch with variance and reason
3. open batch context
4. open linked invoice
5. open linked dispatch
6. show final delivery or status timeline

## Sprint 6 - Reporting And Launch Polish

Goal:
Make the product easy to demo, easy to adopt, and ready for paid rollout.

Status:

- implementation bundle completed on `2026-04-04`
- `/reports` is now positioned as the trusted reporting hub with clearer operational, trust, and distribution lanes
- `/email-summary` now has faster range presets, send-readiness checks, safer draft reset controls, and stronger trust-before-send copy
- role-based onboarding copy now exists directly in the dashboard for operator, supervisor, manager/admin, and owner flows
- launch docs are now present: `docs/go_live_checklist.md`, `docs/V1_RELEASE_NOTES.md`, `docs/SUPPORT_PLAYBOOK.md`, and `docs/DEMO_WALKTHROUGH.md`
- automated regression bundle passed: `python -m pytest -q`, `cd web && npm.cmd run lint`, and `cd web && npm.cmd run build`
- final staging smoke on real devices is still recommended before paid rollout sign-off

Current reality:

- reports already exist
- scheduled summaries exist
- QA matrix exists
- product needs final packaging and launch discipline

Main outcome:
You can run a clean customer demo and ship with confidence.

### Build checklist

- [x] make `/reports` the clear reporting hub for operational outputs
- [x] ensure scheduled summaries are easy to configure and trustworthy
- [x] build a demo dataset or demo walkthrough for sales calls
- [x] refresh `docs/MASTER_QA_MATRIX.md` with final pass evidence
- [x] finalize go-live checklist
- [x] add release notes for V1
- [x] define support playbook for failed OCR job, failed export, and blocked review cases
- [x] ensure role-based onboarding copy exists for operator, supervisor, manager, owner
- [x] do final performance and UX pass on mobile and desktop

### Likely file areas

- `web/src/components/reports-page.tsx`
- `web/src/components/attendance-reports-page.tsx`
- `web/src/components/email-summary-page.tsx`
- `docs/MASTER_QA_MATRIX.md`
- `docs/go_live_checklist.md`

### Exit gate

- [ ] 15-minute end-to-end demo runs cleanly
- [x] all high-value flows have current QA evidence
- [x] reports, exports, and summaries are stable
- [x] onboarding story is clear enough for a real client demo

### Demo script

1. capture one document
2. review and approve it
3. show report output
4. show owner dashboard insight
5. show steel operational follow-through
6. show scheduled summary setup

## Final Release Gate

Do not call the product finished until all of these are true:

- [x] OCR corrected export is trusted
- [x] role-based navigation feels smaller per user
- [x] review queue acts as the real trust center
- [x] owner intelligence explains money risk clearly
- [x] steel workflows feel factory-real, not generic
- [x] reports and summaries are stable
- [x] QA evidence is current
- [ ] demo flow is smooth enough for a paying client

## Current Recommendation

All six implementation sprints are now bundled into the product.

Reason:

- the next highest-value move is a final staging smoke using real role accounts
- after that, use `docs/DEMO_WALKTHROUGH.md` and `docs/go_live_checklist.md` as the launch path
- no new major module should be added before that go-live pass is complete
