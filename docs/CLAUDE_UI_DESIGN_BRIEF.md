# Claude UI Design Brief

Updated: 2026-04-05  
Audience: Claude, designers, product, frontend  
Purpose: generate strong UI/UX design concepts for DPR.ai that we can use as inspiration and then adapt into the current product

## 1. What This Product Is

DPR.ai is a **Factory Intelligence Operating System** for real-world manufacturing teams.

It is not:

- just an OCR tool
- just a dashboard
- just an ERP clone

It combines:

- OCR-based register digitization
- daily factory operations
- attendance and daily shift reporting
- review and approval workflows
- reporting and exports
- anomaly / leakage / owner intelligence
- steel-specific operations such as stock review, invoices, dispatches, and charts

Core product truth:

- OCR gets data in
- operations make data useful
- review makes data trusted
- reports make data usable
- owner intelligence makes data valuable

## 2. Product Goal

The product should help a factory move from:

`paper register / WhatsApp / manual Excel / delayed review`

to:

`capture -> review -> trust -> report -> owner action`

This is a practical industrial product for low-tech but high-stakes environments.

## 3. Who Uses The Product

### Operator

Needs:

- fast daily workflow
- minimum clicks
- mobile-first experience
- simple entry and scan tools

Main tabs:

- dashboard
- shift entry
- attendance
- OCR scan
- work queue

### Supervisor

Needs:

- review queue
- attention signals
- stock or OCR correction flow
- fast approve / reject action

Main tabs:

- approvals
- OCR verify
- attendance review
- stock review
- reports

### Accountant

Needs:

- reports
- attendance reports
- customers / invoices in steel mode
- email summaries

Main tabs:

- reports
- attendance reports
- email summary
- steel customers
- steel invoices

### Manager / Admin

Needs:

- operational control
- review status
- reporting
- factory setup without cluttering core workflow

Main tabs:

- dashboard
- approvals
- reports
- analytics
- steel control
- settings

### Owner

Needs:

- risk, loss, exposure, summary
- very fast signal reading
- not too much low-level operational noise
- premium intelligence and summary view

Main tabs:

- premium dashboard
- control tower
- reports
- AI insights
- email summary
- steel charts

## 4. Real Product Areas

These are the actual major product areas Claude should understand.

### Capture Layer

- OCR scan
- camera upload
- gallery upload
- crop / enhance / process
- OCR preview

### Execution Layer

- dashboard
- attendance
- shift entry
- work queue
- tasks

### Trust Layer

- approvals
- attendance review
- OCR verify
- steel reconciliations

### Reporting Layer

- reports
- attendance reports
- export tools
- email summary

### Intelligence Layer

- analytics
- AI insights
- premium owner dashboard

### Steel Operations Layer

- steel command center
- steel charts
- customers
- invoices
- dispatches
- reconciliations
- batch detail

### Platform Layer

- settings
- attendance admin
- billing
- plans
- profile

## 5. Current Main Routes / Tabs

Design around these routes.

### Today / Daily Work

- `/dashboard`
- `/work-queue`
- `/attendance`
- `/tasks`
- `/entry`
- `/ocr/scan`

### Steel Operations

- `/steel`
- `/steel/charts`
- `/steel/customers`
- `/steel/invoices`
- `/steel/dispatches`

### Review

- `/attendance/review`
- `/approvals`
- `/ocr/verify`
- `/steel/reconciliations`

### Management

- `/attendance/reports`
- `/reports`
- `/analytics`
- `/premium/dashboard`
- `/control-tower`
- `/email-summary`
- `/ai`

### Admin / Account

- `/settings/attendance`
- `/settings`
- `/plans`
- `/billing`
- `/profile`

## 6. Industry Context

The product is built for factories, especially steel factories and similar operations-heavy businesses.

This means the UI must respect:

- low-tech teams
- patchy internet
- mobile usage on the floor
- desktop usage in office
- paper-heavy workflows
- weight, batch, stock, and dispatch realism
- a lot of users who are not "software-native"

This product should feel like:

- practical
- industrial
- reliable
- serious
- fast

It should not feel like:

- crypto dashboard
- startup marketing SaaS
- over-decorated AI toy
- purple glassmorphism demo

## 7. Core UX Problems To Solve

The product already has strong logic and features, but the UI still needs stronger discipline.

Current pain points:

- some screens show too much at once
- some mobile screens still feel like compressed desktop layouts
- primary action is not always obvious enough
- charts and data-heavy screens need better text support
- review and management surfaces can feel dense
- visual hierarchy is uneven across modules

Claude should help solve:

- action clarity
- mobile usability
- desktop density without clutter
- cleaner section hierarchy
- stronger industrial SaaS feel

## 8. Design Principles Claude Should Follow

### Principle 1: Action first

Every screen should quickly answer:

- where am I?
- what matters now?
- what do I do next?

### Principle 2: Mobile is not just smaller desktop

Mobile screens should be restructured, not merely resized.

Expected mobile behavior:

- stacked cards
- sticky action bars
- filter drawers
- table-to-card conversion
- short top sections

### Principle 3: Desktop should use width intentionally

Desktop should support:

- split views
- side summaries
- visible filters
- dense but readable tables
- parallel context where useful

### Principle 4: Trust is part of the design

This product is not only about data entry.

The UI must visibly communicate:

- trusted vs untrusted
- reviewed vs pending
- risk vs safe
- mismatch vs resolved

### Principle 5: Role compression

Different users should feel like the product is made for them.

An operator should not feel the owner complexity.
An owner should not start in low-level entry screens.

## 9. Visual Direction

Claude should design this as a bold, modern industrial SaaS.

Desired visual feel:

- dark industrial base or controlled light industrial theme
- steel / graphite / slate / cobalt / amber / cyan accents
- high contrast without neon overload
- premium but operational
- serious enough for factory owners
- smooth enough for daily repeated use

Avoid:

- too much purple
- generic finance-app look
- childish illustration-heavy style
- too much rounded toy-like softness
- decorative clutter without workflow value

Typography should feel:

- strong
- legible
- data-friendly
- slightly industrial / enterprise

## 10. Responsive Expectations

### Mobile expectations

- no horizontal page scroll
- important tables become cards or stacked rows
- filters become bottom sheet / drawer / accordion
- one strong CTA visible
- forms use sticky bottom bar
- charts include text summary fallback

### Desktop expectations

- dashboards use strong grid logic
- reviews can use split view
- reports keep filters visible
- heavy pages use summary side rail
- wide space should reduce context switching, not increase emptiness

## 11. Most Important Screens To Redesign First

These are the highest-value screens for inspiration work.

### 1. Dashboard

Route:

- `/dashboard`

Purpose:

- role-based home
- next action
- signals
- quick movement into workflow

Need:

- stronger top-level hierarchy
- better mobile stacking
- less competition between sections

### 2. Shift Entry

Route:

- `/entry`

Purpose:

- daily production / DPR entry

Need:

- very strong mobile form design
- clear progress / sectioning
- better submit flow

### 3. OCR Scan

Route:

- `/ocr/scan`

Purpose:

- image capture to structured data

Need:

- camera-first mobile workflow
- simple processing state
- clear next action after scan

### 4. Review Queue

Route:

- `/approvals`

Purpose:

- central review hub

Need:

- mobile-safe queue design
- desktop split-view strength
- clearer urgency and item action

### 5. OCR Verify

Route:

- `/ocr/verify`

Purpose:

- correct OCR rows
- approve or reject

Need:

- image + data review layout
- flagged-cell-first thinking
- better review ergonomics

### 6. Reports

Route:

- `/reports`

Purpose:

- trusted reporting hub
- filter, inspect, export

Need:

- better filter-to-export flow
- mobile card-based reporting
- stronger analytical layout on desktop

### 7. Steel Dispatches

Route:

- `/steel/dispatches`

Purpose:

- real steel dispatch creation
- truck, driver, invoice, quantity, packet

Need:

- practical field ordering
- better readiness summary
- desktop summary rail
- mobile sticky CTA

### 8. Premium Owner Dashboard

Route:

- `/premium/dashboard`

Purpose:

- owner risk and money view

Need:

- decision board layout
- very strong hierarchy
- less visual overload
- fast risk scanning

## 12. What Each Screen Should Feel Like

### Dashboard

Feel:

- live control room
- role-aware
- clear next step

### Entry

Feel:

- guided task flow
- simple
- safe to complete fast

### OCR Scan

Feel:

- camera tool
- focused
- low-friction

### Approvals

Feel:

- command inbox
- high trust
- fast decisions

### Reports

Feel:

- reporting desk
- trustworthy
- useful for exporting and sharing

### Owner Dashboard

Feel:

- money and risk cockpit
- fewer but stronger signals

### Steel Screens

Feel:

- operational realism
- weight and movement awareness
- traceability

## 13. Hard Product Constraints

Claude should not propose redesigns that break these truths:

- OCR review is a trust gate, not just a pretty table
- approved-only OCR should look different from pending
- steel workflows must respect weight / mismatch / dispatch realities
- owner surfaces should highlight risk, not only activity
- role-based navigation should stay compressed
- mobile use matters heavily for scan, entry, and attendance

## 14. What Claude Should Not Do

Claude should not:

- redesign this as a generic ERP
- remove important screens just to make the concept look simple
- treat mobile as an afterthought
- make every page chart-heavy
- make the UI look soft, startup-y, or toy-like
- invent fantasy workflows disconnected from factories

## 15. What Claude Should Produce

Ask Claude to produce:

1. overall visual system
2. mobile + desktop layout direction
3. redesigned concepts for the 8 high-priority screens
4. component patterns we can reuse
5. explanation of why the layout works for factory users

Useful outputs:

- screen descriptions
- layout blocks
- spacing / hierarchy plan
- component system ideas
- color and typography direction
- responsive behavior notes
- optionally React/Tailwind mockups

## 16. Best Prompt To Give Claude

Use this:

```text
You are designing the UI/UX for a product called DPR.ai.

This product is a Factory Intelligence Operating System for real-world manufacturing teams.

It combines:
- OCR-based register digitization
- daily operations
- attendance
- shift/DPR entry
- review and approval workflows
- reports and exports
- owner intelligence
- steel-specific operations like stock review, invoices, dispatches, and charts

This is NOT a generic ERP and NOT just an OCR tool.

The product must feel:
- industrial
- modern
- reliable
- action-first
- mobile-safe
- desktop-efficient

Target users:
- operator
- supervisor
- accountant
- manager/admin
- owner

Important design truths:
- operators need speed and simplicity
- supervisors need review and action clarity
- owners need risk and money visibility
- mobile matters heavily for entry, attendance, and scan
- desktop matters heavily for review, reports, and owner decisions
- trust state must be visible (approved, pending, flagged, mismatched, etc.)

High-priority screens to redesign:
1. dashboard
2. shift entry
3. OCR scan
4. approvals / review queue
5. OCR verify
6. reports
7. steel dispatches
8. premium owner dashboard

Industry context:
- factories are paper-heavy and low-tech
- many users are not software-native
- steel workflows involve weight, mismatch, stock trust, dispatch, invoice linkage, and loss visibility

Do not make this look like:
- a crypto dashboard
- a generic startup SaaS
- a toy AI product
- a purple glassmorphism demo

Do make it feel like:
- a premium industrial SaaS
- a real factory operating system
- serious enough for owners
- simple enough for workers

For each screen, provide:
- screen goal
- mobile layout idea
- desktop layout idea
- section hierarchy
- primary CTA
- key supporting actions
- how trust/risk should be shown

Also provide:
- overall design system direction
- reusable component patterns
- typography and color direction
- responsive rules

Focus on practical, buildable UI ideas, not fantasy concepts.
```

## 17. How We Will Use Claude Output

We are not replacing the app with Claude output directly.

We will use Claude for:

- visual inspiration
- layout inspiration
- hierarchy ideas
- component ideas
- responsive design direction

Then we will modify the current DPR.ai screens using those ideas.

So the output should inspire implementation, not ignore product reality.

## 18. Final One-Line Description

DPR.ai is a factory-first operating system that turns paper-heavy operations into trusted digital workflows, then turns that trusted data into reports, risk visibility, and owner action.
