# Final Product System Blueprint

Updated: 2026-04-04
Owner: Product + Engineering
Status: Final working blueprint for finishing DPR.ai

## 0. How To Use This File

Use this file as the source of truth for four things:

1. Product positioning
2. Feature organization
3. UX simplification
4. Build order to finish the product

This file is not asking you to remove your strongest features.
It is telling you how to keep them without letting the product feel fragmented.

Non-negotiable framing:

- DPR.ai is not an OCR-only tool.
- DPR.ai is not a full ERP.
- DPR.ai is a Factory Intelligence Operating System.

Core truth:

- OCR gets data in.
- Operations make data useful.
- Review makes data trusted.
- Intelligence makes data valuable.
- Reports and owner views make data actionable.

## 1. Actual Product Definition

DPR.ai is a factory-first operating system for paper-heavy, low-tech manufacturing teams.

It already combines:

- OCR-based register digitization
- attendance and attendance review
- DPR / shift entry
- work queue and alerts
- review and approval workflows
- reports and exports
- analytics and AI summaries
- anomaly and leakage signals
- steel operations such as stock, batches, invoices, dispatches, and charts
- role, billing, quota, and admin control

This means the real product shape is:

`Capture -> Execute -> Review -> Monitor -> Detect -> Report`

That is the product you have built in reality.

## 2. Product Engines

All major features stay. They just need to live inside a clear system.

### 2.1 Capture Engine

Purpose:
Turn paper, register images, and messy field photos into structured digital data.

Main features:

- mobile camera scan
- gallery upload
- crop and perspective correction
- image enhancement
- OCR preview extraction
- confidence warnings
- OCR templates
- async OCR export jobs

Main routes and files:

- `/ocr/scan`
- `/ocr/verify`
- `backend/routers/ocr.py`
- `web/src/components/ocr-scan-page.tsx`
- `web/src/components/ocr-verification-page.tsx`
- `web/src/lib/ocr.ts`

Main problem solved:
Factories should not have to type register photos into Excel by hand.

### 2.2 Daily Execution Engine

Purpose:
Run the daily factory loop after data is captured or entered.

Main features:

- Today board
- Work Queue
- attendance
- live attendance
- shift / DPR entry
- alerts and reminders
- offline draft queue

Main routes and files:

- `/dashboard`
- `/work-queue`
- `/attendance`
- `/entry`
- `web/src/components/dashboard-home.tsx`
- `web/src/components/work-queue-page.tsx`

Main problem solved:
Daily work should not live in registers, memory, calls, and WhatsApp follow-ups.

### 2.3 Trust Engine

Purpose:
Make factory data safe enough to act on.

Main features:

- OCR verification drafts
- OCR approve / reject flow
- attendance review
- review queue
- stock reconciliation review
- bulk review actions
- SLA lanes
- audit trail behavior

Main routes and files:

- `/approvals`
- `/attendance/review`
- `/ocr/verify`
- `/steel/reconciliations`
- `web/src/components/approvals-page.tsx`

Main problem solved:
Bad data should not become official data.

### 2.4 Reporting Engine

Purpose:
Turn trusted factory data into outputs managers and owners can use fast.

Main features:

- reports and exports
- Excel exports
- PDF jobs
- attendance reports
- scheduled summaries

Main routes and files:

- `/reports`
- `/attendance/reports`
- `/email-summary`
- `backend/routers/reports.py`

Main problem solved:
Teams should not spend time rebuilding routine reports manually.

### 2.5 Intelligence Engine

Purpose:
Find loss, leakage, drift, and abnormal behavior before it becomes expensive.

Main features:

- anomaly preview
- AI summaries
- analytics
- owner dashboard intelligence
- repeated mismatch patterns
- batch risk ranking
- highest-loss signals
- responsibility analytics

Main routes and files:

- `/analytics`
- `/ai`
- `/premium/dashboard`
- `web/src/components/dashboard-home.tsx`
- `web/src/components/analytics-page.tsx`
- `web/src/components/ai-insights-page.tsx`
- `backend/services/steel_service.py`

Main problem solved:
Owners lose money when they can see data but cannot see risk.

### 2.6 Steel Operations Engine

Purpose:
Handle the weight-based, batch-based, dispatch-heavy realities of steel factories.

Main features:

- steel operations command center
- stock overview
- stock reconciliation
- batch production tracking
- steel charts
- customer ledger
- sales invoices
- dispatch workflow
- owner steel summary surfaces

Main routes and files:

- `/steel`
- `/steel/charts`
- `/steel/customers`
- `/steel/invoices`
- `/steel/dispatches`
- `/steel/reconciliations`
- `backend/routers/steel.py`
- `web/src/lib/steel.ts`

Main problem solved:
Generic factory software does not understand weight, batches, yards, dispatch, and loss control.

### 2.7 Platform and Control Engine

Purpose:
Keep the product secure, sellable, role-aware, and commercially manageable.

Main features:

- login and session control
- role-based access
- factory switching
- profile and settings
- attendance admin
- factory admin
- plans
- billing
- OCR usage quotas and add-ons

Main routes and files:

- `/settings`
- `/settings/attendance`
- `/plans`
- `/billing`
- `/profile`
- `backend/plans.py`
- `web/src/components/app-shell.tsx`

Main problem solved:
Without role, billing, and usage control, this cannot operate as a real SaaS.

## 3. Complete Feature Inventory

This is the practical feature list with the business problem each one solves.

### 3.1 Platform and Account

| Feature | Primary User | Problem Solved | Engine | Main Route |
| --- | --- | --- | --- | --- |
| Login and secure session | all users | stops shared-password chaos and unsafe access | Platform | auth flow |
| Role-based access control | owner, admin, manager | stops wrong users from seeing or doing sensitive work | Platform | app-wide |
| Factory switching | multi-factory managers | prevents cross-factory data confusion | Platform | app-wide |
| Profile and settings | all users | lets users manage identity and access safely | Platform | `/profile`, `/settings` |
| Attendance admin | manager, admin | centralizes employee and shift setup | Platform | `/settings/attendance` |
| Factory admin | admin | keeps org configuration in one controlled place | Platform | `/settings` |
| Plans and upgrades | owner, admin | turns feature access into a sellable product structure | Platform | `/plans` |
| Billing and invoices | owner, admin | manages payment trust and subscription lifecycle | Platform | `/billing` |
| OCR quota tracking | owner, admin | controls OCR cost and scan consumption | Platform | plans + usage |
| Multi-language support | floor teams | reduces training friction for mixed-language users | Platform | app-wide |

### 3.2 Daily Operations

| Feature | Primary User | Problem Solved | Engine | Main Route |
| --- | --- | --- | --- | --- |
| Today Board | all users | shows what to do next instead of making users hunt for work | Execution | `/dashboard` |
| Work Queue | operator, supervisor, manager | replaces scattered follow-up with one visible work inbox | Execution | `/work-queue` |
| Alerts and reminders | all users | stops urgent tasks from being forgotten | Execution | dashboard + queue |
| Attendance self punch | workers | replaces paper attendance register | Execution | `/attendance` |
| Live attendance board | supervisor, manager | provides live manpower visibility | Execution | attendance live view |
| Shift / DPR entry | operator, supervisor | replaces manual production and shift logs | Execution | `/entry` |
| Offline draft queue | floor users | keeps work moving during weak network conditions | Execution | entry / client sync |
| My tasks surfaces | assigned users | prevents hidden task ownership | Execution | tasks views |

### 3.3 OCR and Document Digitization

| Feature | Primary User | Problem Solved | Engine | Main Route |
| --- | --- | --- | --- | --- |
| Mobile camera scan | operator, supervisor | lets users digitize a physical register immediately | Capture | `/ocr/scan` |
| Gallery upload | operator, supervisor | brings WhatsApp and stored photos into workflow | Capture | `/ocr/scan` |
| Crop correction | operator, supervisor | improves OCR on badly framed images | Capture | `/ocr/scan` |
| Perspective correction | operator, supervisor | fixes tilted register pages | Capture | `/ocr/scan` |
| Image enhancement | operator, supervisor | improves OCR on low light and faint pages | Capture | `/ocr/scan` |
| OCR preview extraction | operator, supervisor | converts image data into structured rows | Capture | `/ocr/scan` |
| Confidence hints | reviewer | highlights risky cells instead of hiding uncertainty | Capture | `/ocr/scan`, `/ocr/verify` |
| OCR verification draft | supervisor, manager | preserves extracted work before final approval | Trust | `/ocr/verify` |
| OCR review workspace | supervisor, manager | allows correction before data becomes official | Trust | `/ocr/verify` |
| OCR submit / approve / reject | manager and above | creates accountability for extracted data | Trust | `/ocr/verify` |
| OCR templates | manager, admin | supports repeated register types and format reuse | Capture | OCR admin flow |
| OCR async Excel export | operator, supervisor | avoids blocking the UI during file generation | Capture | OCR job flow |
| OCR PDF export | user, reviewer | provides paper-style output when needed | Capture | OCR job flow |
| OCR job tracking | staff, reviewer | helps manage retries, waiting, and failed jobs | Capture | OCR jobs |

### 3.4 Review and Control

| Feature | Primary User | Problem Solved | Engine | Main Route |
| --- | --- | --- | --- | --- |
| Attendance review | supervisor, manager | resolves missed punches and corrections | Trust | `/attendance/review` |
| Review Queue | supervisor, manager, admin | consolidates review work across modules | Trust | `/approvals` |
| Bulk approve / reject | supervisors and up | clears backlog faster | Trust | `/approvals` |
| SLA aging lanes | supervisors and up | shows stale pending work before it becomes a bottleneck | Trust | `/approvals` |
| Stock reconciliation approval | supervisor, manager | creates sign-off on physical vs system stock mismatch | Trust | `/steel/reconciliations` |
| Auditability and review notes | manager, owner | makes corrections traceable | Trust | multi-module |

### 3.5 Reports and Business Output

| Feature | Primary User | Problem Solved | Engine | Main Route |
| --- | --- | --- | --- | --- |
| Reports dashboard | manager, accountant, owner | centralizes report generation | Reporting | `/reports` |
| Excel exports | manager, accountant | removes repeated manual spreadsheet work | Reporting | reports + OCR |
| PDF report jobs | manager, owner | standardizes printable management output | Reporting | reports jobs |
| Attendance reports | manager, HR, owner | measures completion, lateness, and gaps | Reporting | `/attendance/reports` |
| Scheduled email summaries | manager, owner | keeps leadership informed without daily login | Reporting | `/email-summary` |

### 3.6 Analytics and Intelligence

| Feature | Primary User | Problem Solved | Engine | Main Route |
| --- | --- | --- | --- | --- |
| Analytics dashboards | manager, owner | exposes trends instead of isolated daily numbers | Intelligence | `/analytics` |
| AI summaries | manager, owner | converts too much raw data into readable insight | Intelligence | `/ai`, dashboard |
| Anomaly preview | manager, owner | flags unusual behavior before it turns into loss | Intelligence | dashboard, `/ai` |
| Risk ranking for steel batches | manager, owner | identifies likely high-risk process or stock areas | Intelligence | steel dashboards |
| Responsibility analytics | owner, manager | helps trace likely source of loss or abnormal patterns | Intelligence | steel intelligence |
| Highest-loss and mismatch signals | owner | quantifies where money may be leaking | Intelligence | premium / steel boards |
| Owner desk | owner | gives one condensed view of risk, performance, and control | Intelligence | `/premium/dashboard` |

### 3.7 Steel Operations

| Feature | Primary User | Problem Solved | Engine | Main Route |
| --- | --- | --- | --- | --- |
| Steel operations hub | manager, owner | gives one steel-first command surface | Steel | `/steel` |
| Stock overview | manager, owner | tracks weight-based inventory visibility | Steel | `/steel` |
| Stock review / reconciliation | supervisor, manager | detects physical vs system stock mismatch | Steel | `/steel/reconciliations` |
| Batch production tracking | manager, owner | measures yield, output, and loss at batch level | Steel | `/steel` |
| Steel charts | supervisor, manager, owner | gives chart-first visibility into stock, output, and revenue | Steel | `/steel/charts` |
| Customer ledger | accountant, manager | shows outstanding exposure and collection status | Steel | `/steel/customers` |
| Sales invoices | accountant, manager | handles steel billing with weight and line logic | Steel | `/steel/invoices` |
| Dispatch workflow | supervisor, manager | controls truck, driver, gate pass, and line dispatch | Steel | `/steel/dispatches` |
| Dispatch detail and status flow | supervisor, manager | tracks loaded, dispatched, and delivered states | Steel | `/steel/dispatches/[id]` |
| Owner steel summary outputs | owner | gives a concise daily business view of steel operations | Steel | owner summary flow |

## 4. Feature Correlation Map

This is how the features work together as one product instead of many loose modules.

| Source Layer | Feeds Into | Data or Control Passed Forward | Why It Matters |
| --- | --- | --- | --- |
| Capture Engine | Trust Engine | extracted rows, confidence, document context | OCR is useful only if risky data can be reviewed |
| Execution Engine | Trust Engine | attendance exceptions, pending approvals, operational exceptions | daily work creates reviewable decisions |
| Trust Engine | Reporting Engine | approved and corrected records | management reports must come from trusted data |
| Trust Engine | Intelligence Engine | reviewed records, anomaly context, exception history | anomaly signals are only credible on trustworthy data |
| Steel Engine | Trust Engine | stock mismatch, dispatch exceptions, invoice and batch context | steel operations need sign-off on risky actions |
| Steel Engine | Intelligence Engine | batch loss, dispatch flow, stock movement, invoice exposure | this is where owner-value signals come from |
| Reporting Engine | Owner Layer | summaries, exports, scheduled outputs | owners want answers, not raw tables |
| Platform Engine | Every Layer | roles, quotas, plan gating, org boundaries | the same product must feel different per user and plan |

### Final product logic

1. Data enters through OCR or daily operational entry.
2. Risky or important data is reviewed.
3. Trusted data powers reports and dashboards.
4. Trusted data also powers anomaly and leakage logic.
5. Owners use the output to prevent money loss and improve control.

## 5. Core Value Propositions

These are the top product truths that matter commercially.

### 5.1 Paper To Trusted Data

`Turn factory register photos into verified structured data in minutes.`

Why factories care:

- saves clerical typing time
- speeds reporting
- preserves the link between image and extracted rows
- reduces mistakes from manual re-entry

### 5.2 Daily Factory Execution With Visibility

`Make daily factory work visible, assignable, and reviewable.`

Why factories care:

- supervisors stop chasing people manually
- daily work becomes visible in one queue
- attendance and DPR move from paper habit to digital routine

### 5.3 Leakage And Risk Detection

`Use trusted factory data to detect anomalies, mismatch, and likely money leakage early.`

Why factories care:

- this is one of the strongest owner-payment reasons
- it converts the product from admin software into money-protection software

### 5.4 Steel-Specific Operational Control

`Handle weight, batch, stock, invoice, and dispatch workflows the way steel factories actually work.`

Why factories care:

- generic software often fails on tonnage, yield, and dispatch detail
- steel operations are where small data mistakes become large financial loss

## 6. Adoption, Payment, And Owner Value

### 6.1 Adoption-driving features

These are the features that get daily usage.

1. OCR scan and extraction
2. Attendance
3. Shift / DPR entry
4. Work Queue
5. Review Queue

### 6.2 Payment-driving features

These are the features that justify stronger monthly pricing.

1. OCR with review trail and structured output
2. Reports and exports that remove clerical effort
3. Anomaly detection and leakage signals
4. Steel stock, batch, and dispatch control
5. Owner visibility into operational and financial risk

### 6.3 Owner-value features

These are not always the most-used features, but they are among the strongest reasons to pay.

- anomaly detection
- highest-risk batch and loss signals
- repeated mismatch tracking
- responsibility analytics
- stock trust status
- dispatch and invoice visibility
- owner desk
- scheduled summaries
- steel charts

Important product truth:

- daily features create habit
- trust features create confidence
- owner intelligence creates pricing power

## 7. Final Feature Classification

Do not delete strong features. Place them correctly.

### 7.1 Primary workflow features

These should define the product day to day.

- Today
- Work Queue
- Attendance
- Shift Entry
- Document Scan
- Review Queue
- Reports

### 7.2 Secondary support features

These matter, but they should not crowd the main story.

- attendance review
- attendance reports
- OCR templates
- OCR job management
- scheduled email summaries
- steel charts for supervisors and managers

### 7.3 Premium power features

These should be sold as management and owner-value layers.

- analytics
- AI summaries
- anomaly detection
- owner dashboard
- risk ranking
- stock confidence logic
- responsibility analytics
- highest-loss trend signals

### 7.4 Hidden admin and system features

These should stay in product but not dominate normal navigation.

- plans
- billing
- factory admin
- attendance admin
- profile
- quota configuration
- low-level OCR template maintenance

## 8. Final Role-Based Product View

### 8.1 Operator

Should mostly see:

- Today
- Work Queue
- Attendance
- Shift Entry
- Document Scan

Should mostly not see:

- billing
- analytics
- owner intelligence
- advanced admin

### 8.2 Supervisor

Should mostly see:

- Work Queue
- Attendance
- Attendance Review
- Review Queue
- Review Documents
- Stock Review
- Dispatch where relevant

Role summary:
Supervisor is the trust and handoff role.

### 8.3 Manager

Should mostly see:

- all review tools
- reports
- analytics
- steel operations
- invoices and dispatch

Role summary:
Manager is the execution and control role.

### 8.4 Owner

Should mostly see:

- owner desk
- analytics
- anomaly and leakage views
- reports
- scheduled summaries
- billing
- steel financial and risk views

Role summary:
Owner is not the daily entry user.
Owner is the money-protection and decision user.

## 9. Final Navigation Structure

This is the recommended long-term navigation while keeping all major product power.

### 9.1 Main navigation

- Today
- Work Queue
- Attendance
- Shift Entry
- Document Scan
- Review Queue
- Reports

### 9.2 Review group

- Attendance Review
- Review Documents
- Stock Review

### 9.3 Operations group

- Steel Operations
- Customers
- Invoices
- Dispatch

### 9.4 Intelligence group

- Analytics
- AI Insights
- Owner Desk
- Steel Charts

### 9.5 Admin group

- Factory Admin
- Attendance Admin
- Plans
- Billing
- Profile

Rule:
The product should feel small to the current user even if the platform itself is broad.

## 10. Final Connected Workflow

This is the product workflow that should guide all UX decisions.

`Capture -> Process -> Review -> Approve -> Use -> Monitor -> Detect -> Export`

### 10.1 Operator workflow

1. Open Today or Document Scan
2. Capture document or enter attendance / shift data
3. Save draft or submit
4. Move to next assigned task

### 10.2 Supervisor workflow

1. Open Work Queue or Review Queue
2. Review OCR issues, attendance exceptions, or stock mismatches
3. Approve, reject, or correct
4. Push trusted data forward

### 10.3 Manager workflow

1. Open Review Queue, Reports, or Steel Operations
2. Clear exceptions
3. Check production, stock, dispatch, and report outputs
4. Export or escalate

### 10.4 Owner workflow

1. Open Owner Desk or Analytics
2. See summarized business movement
3. Review anomalies, mismatch, and loss signals
4. Act on risk, not on raw data entry

## 11. UX Simplification Rules

These rules let you simplify without removing power.

### 11.1 One obvious next step

Every major screen should answer:
`What should I do next?`

### 11.2 Hide technical OCR choices from normal users

Operators should not be asked to think about columns, model behavior, or template mechanics unless they are in an admin flow.

### 11.3 Keep review fast

Review screens should focus on:

- what is wrong
- what needs approval
- what happens after approval

### 11.4 Compress navigation by role

A worker should never feel they are standing inside an ERP.

### 11.5 Keep power features behind trust

Intelligence is powerful only when the underlying data is believable.

## 12. Architecture Direction

### 12.1 Frontend direction

Recommended module boundaries:

- capture
- execution
- review
- reporting
- intelligence
- steel
- admin

Recommended UI architecture direction:

- fewer duplicate surfaces
- one main entry route per workflow
- reusable queue cards, review cards, status chips, and summary patterns
- role-aware navigation compression

### 12.2 Backend direction

Recommended service boundaries:

- OCR ingestion and preview
- OCR verification and trusted record lifecycle
- export job lifecycle
- daily operations lifecycle
- review and approval lifecycle
- anomaly and intelligence lifecycle
- steel operations lifecycle
- billing and usage lifecycle

Recommended data flow rule:

- approved data should become the trusted source for downstream reports and intelligence

## 13. Biggest Trust And Risk Issues

These are the issues that matter most if you want factories to trust and pay for the product.

### 13.1 Reviewed OCR data vs exported OCR data mismatch

Current risk:
The scan flow creates reviewed data and also starts a separate Excel job path, which creates a real trust gap if the export is not guaranteed to come from corrected rows.

Severity:
Critical

Fix:

- export corrected data directly from approved `reviewed_rows`
- make `Export corrected data` explicit in UX
- keep original OCR output separate from approved output

### 13.2 OCR product story is fragmented

Current risk:
Scan, verify, jobs, templates, and older OCR concepts can feel like separate products.

Severity:
High

Fix:

- keep one main OCR journey
- move advanced OCR controls behind admin or reviewer context

### 13.3 Owner-value features are under-packaged

Current risk:
Anomaly detection, risk ranking, and leakage signals may exist, but they are not yet the clear commercial headline.

Severity:
High

Fix:

- package them as the Owner Intelligence Layer
- quantify money risk where possible

### 13.4 Product breadth can overwhelm low-tech users

Current risk:
Too many modules and surfaces increase training burden.

Severity:
High

Fix:

- tighter role-based navigation
- simpler default home per role
- fewer competing primary actions

### 13.5 Intelligence on weak data reduces trust

Current risk:
Anomalies are only valuable if the underlying data is reviewed or clearly confidence-scored.

Severity:
High

Fix:

- tie anomaly logic to approved or confidence-qualified records
- show evidence behind high-risk signals

## 14. Build Order To Finish Product

Use this order. It keeps all major features but finishes the product in the right sequence.

### Phase 1: Trust foundation

Goal:
Make sure exported, reported, and detected data is trustworthy.

Must finish:

- OCR corrected export path
- review-approved data source for downstream outputs
- clear review notes and auditability

Done when:

- a reviewer can correct OCR data and export the exact corrected result
- reports and intelligence use trusted records

### Phase 2: One connected daily workflow

Goal:
Make the product feel like one system.

Must finish:

- simplify main navigation
- make Today, Work Queue, Document Scan, Review Queue, and Reports the center
- hide non-daily admin clutter

Done when:

- each role has a clear home flow
- users always know what to do next

### Phase 3: Review center hardening

Goal:
Make review the trust engine across attendance, OCR, and stock.

Must finish:

- unified review queue
- bulk decisions
- SLA visibility
- explicit deny and blocked reasons

Done when:

- supervisors can clear pending work quickly and safely

### Phase 4: Owner intelligence packaging

Goal:
Turn anomaly and leakage signals into a sellable owner-value layer.

Must finish:

- anomaly summary with rupee-value framing where possible
- responsibility context
- repeated-risk views
- owner dashboard packaging

Done when:

- owner can see likely risk, likely source, and likely money impact

### Phase 5: Steel operating loop completion

Goal:
Make stock, production, invoice, and dispatch work as one steel system.

Must finish:

- stock trust flow
- batch output and loss visibility
- invoice to dispatch clarity
- chart-first steel visibility

Done when:

- a steel manager can track stock, billing, and dispatch without leaving the module cluster

### Phase 6: Reporting and launch polish

Goal:
Make the product easy to sell and easy to demonstrate.

Must finish:

- stable report exports
- scheduled summaries
- role-based demo flow
- final QA and go-live checklist

Done when:

- you can run a clean customer demo from capture to owner insight without confusion

## 15. Definition Of Done Before Charging Full Price

Before pushing hard on an INR 20K/month pitch, these must be true:

1. OCR corrected export is trustworthy
2. Main user journey is simple
3. Review queue is reliable and fast
4. Owner intelligence shows clear risk value
5. Steel operations feel real, not generic
6. Reports are stable and useful
7. Navigation changes by role and feels smaller per user

## 16. Final Product Positioning

### 16.1 What the product is

DPR.ai is a Factory Intelligence Operating System for paper-heavy and low-tech factories.

### 16.2 Who it is for

- operators and supervisors who need simple daily execution
- managers who need trusted reporting and control
- owners who need visibility into loss, risk, and performance

### 16.3 Why they pay

Because it replaces manual register typing, improves daily operational visibility, and helps detect loss or leakage early enough to matter financially.

### 16.4 Short pitch lines

- Turn factory records into trusted actions, reports, and risk alerts.
- Convert register photos into verified Excel, then use the same data to run the factory.
- Capture data once, review it once, and use it everywhere.

## 17. Final Master Prompt For Future Product Analysis

Use this prompt when you want AI to analyze DPR.ai correctly without reducing it to OCR-only or inflating it into a generic ERP.

```text
You are a senior full-stack engineer, product architect, UX designer, SaaS strategist, and also a real steel factory owner evaluating whether this product is worth paying for.

You have access to my real codebase and current product.

You must act as:
- Developer: clean architecture, modularity, reliability, performance, scalability
- Product owner: decide what is core, what is supporting, what is premium, and how everything connects
- UX designer: simplify flows, reduce clutter, improve usability for low-tech factory teams
- Real client: decide if this product is worth paying INR 20K/month

IMPORTANT PRODUCT CONTEXT

This product is NOT just OCR.
It is a factory operating system with multiple connected engines.

Current feature areas include:
- OCR-based register digitization
- Camera capture, gallery upload, crop, enhance, preview
- OCR review, correction, approval, verification workflow
- Excel/PDF export
- OCR templates and job queue
- Attendance
- DPR / shift entry
- Work queue
- Review and approval workflows
- Reports and exports
- Analytics
- AI summaries
- Anomaly detection / risk detection / intelligence layer
- Steel factory operations
- Inventory / stock review
- Batch production tracking
- Dispatch
- Invoices / customers / payments
- Owner dashboard / management visibility
- Role-based access / billing / plans / admin controls

IMPORTANT RULES

- Do NOT reduce this product to OCR-only
- Do NOT turn it into a full ERP
- Do NOT remove features blindly
- First list ALL important features that currently exist
- Then correlate them into one connected product system
- Identify which features are:
  - core workflow features
  - support features
  - premium intelligence features
  - owner-value features
- Base analysis on the real codebase, routes, screens, flows, and architecture
- Cite specific files/routes/modules when possible
- Be brutally honest
- Think like a paying factory client, not like a developer impressed by many features

STEP 1: REAL PRODUCT AUDIT

Analyze the real codebase and explain:
- what product I have actually built today
- what all major features/modules currently exist
- what each feature does
- which user uses each feature
- which business problem each feature solves

Output format:
- Feature name
- User
- Problem solved
- Current module/route
- Business importance

STEP 2: FEATURE CORRELATION

Take all current features and group them into logical engines.

Example format:
- Data Capture Engine
- Daily Operations Engine
- Review and Approval Engine
- Reporting Engine
- Intelligence Engine
- Steel Operations Engine
- Owner Control Engine
- Platform/Admin Engine

For each engine:
- which features belong to it
- why they belong together
- how they connect to other engines

STEP 3: CORE VALUE IDENTIFICATION

From all existing features, identify:
- top 3 adoption-driving features
- top 3 payment-driving features
- top 3 owner-value features
- top 3 factory-ops trust features

Important:
Do NOT ignore anomaly detection, leakage detection, stock mismatch intelligence, responsibility tracing, or owner-risk signals.
These may not be daily-use features, but they may be among the strongest reasons a factory pays.

STEP 4: CLIENT TRUTH

Act as a steel factory owner and answer:
- what would confuse me immediately?
- what would make me feel this is too complicated?
- which features feel powerful and worth paying for?
- which features feel hidden even though they are valuable?
- what would make me justify INR 20K/month?
- what would stop me from paying?

Also identify:
- trust blockers
- adoption blockers
- pricing blockers

STEP 5: DO NOT REMOVE FEATURES - ORGANIZE THEM

Do NOT delete or dismiss features unless they are genuinely harmful.

Instead classify all features into:
- Primary workflow features
- Secondary supporting features
- Premium/power features
- Hidden/admin/system features

Then explain:
- which features should appear in daily navigation
- which should stay behind role-based access
- which should be owner-only or premium-only
- which should stay in product but not in the main workflow

STEP 6: ONE CONNECTED PRODUCT WORKFLOW

Create one unified product workflow that connects all major value areas.

Goal:
Capture -> Process -> Review -> Approve -> Use in Operations -> Monitor -> Detect Anomalies -> Take Action -> Export / Report

Your workflow must connect:
- OCR
- daily factory operations
- review system
- reports
- anomaly detection
- owner visibility
- steel operations where relevant

The user should always know:
- what to do next
- why this step matters
- what value comes after it

STEP 7: UX SIMPLIFICATION

Redesign product UX without removing power.

Give:
- final navigation structure
- what operators should see
- what supervisors should see
- what managers should see
- what owners should see
- which screens should merge
- which screens should stay separate
- how to reduce clutter while preserving capability

Design for:
- low-tech factory users
- mobile use
- repeated daily use
- minimal training

STEP 8: ARCHITECTURE DIRECTION

Refactor the product conceptually into a clean architecture.

Frontend:
- modules
- screen ownership
- reusable patterns
- predictable state/data flow

Backend:
- OCR jobs
- review lifecycle
- export lifecycle
- anomaly detection lifecycle
- reporting pipeline
- steel operations data flow
- reliability boundaries
- decoupling opportunities

STEP 9: RELIABILITY AND TRUST

List the biggest trust risks in the current product.

Examples:
- reviewed data not matching exported data
- anomaly detection based on weak data
- fragmented workflows
- duplicate OCR surfaces
- confusing role boundaries
- async job complexity
- inconsistent outputs

For each:
- why it matters
- how severe it is
- how to fix it

STEP 10: FINAL FEATURE SYSTEM

Give the final answer in this exact structure:

1. Actual product definition
2. Complete feature inventory
3. Feature correlation map
4. Core value propositions
5. Adoption-driving features
6. Payment-driving features
7. Owner-value features
8. Final feature architecture
9. Final workflow architecture
10. Final role-based product view
11. Final navigation structure
12. UX simplification recommendations
13. Architecture improvements
14. Biggest trust/risk issues
15. Final verdict:
   - Is this worth INR 20K/month?
   - If yes, why?
   - If not yet, what must become true first?

FINAL REQUIREMENT

End with a final one-paragraph product positioning statement:
- what this product is
- who it is for
- what makes it different
- why a factory pays for it
- how all major features work together as one system
```

## 18. Final One-Paragraph Product Positioning Statement

DPR.ai is a Factory Intelligence Operating System for paper-heavy factories that need a practical bridge between shop-floor work and owner-level control. It captures data through OCR and daily operational entry, turns that data into trusted records through review and approval, uses those records to power reports and steel workflows, and then surfaces anomaly, leakage, and performance signals that help managers and owners act early. Factories pay for it because it saves clerical time, improves daily discipline, reduces costly mistakes, and gives visibility into risk that manual registers, Excel, and WhatsApp can never provide as one connected system.
