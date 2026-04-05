# Demo Walkthrough

Updated: 2026-04-05  
Audience: Sales, founder demos, pilot calls, paid rollout conversations

## Purpose

Use this file as the live demo runbook for DPR.ai.

The goal is not to show every feature.

The goal is to make the client believe three things:

1. this product fits a real factory workflow
2. this product creates trusted data, not just more screens
3. this product helps management save time, avoid mistakes, and catch money risk

## Core Demo Story

Always tell one connected story:

`Capture -> Review -> Trust -> Report -> Owner Action`

Do not show DPR.ai as:

- a random OCR tool
- a generic ERP
- a collection of disconnected modules

Show it as:

`Factory Intelligence Operating System`

OCR brings data in.  
Review makes data trusted.  
Reports make data usable.  
Owner views make data actionable.

## Non-Negotiable Demo Rules

- do not start from settings
- do not start from billing
- do not start from admin
- do not click around without a story
- do not explain technical implementation first
- do not show screens the buyer will never use daily

Start from the pain the buyer already understands:

- paper register delay
- manual Excel work
- approval bottlenecks
- reporting confusion
- stock or dispatch mismatch
- owner not knowing where loss is happening

## Before The Demo

Check these before the call:

- the app is already running
- `/ocr/scan` loads
- `/ocr/verify` loads
- `/approvals` loads
- `/reports` loads
- `/premium/dashboard` loads
- `/email-summary` loads
- for steel demo:
  - `/steel/reconciliations`
  - `/steel/charts`
  - `/steel/customers`

Also confirm:

- you know which industry type the client belongs to
- you know whether they care more about OCR speed, supervisor control, or owner visibility
- your example numbers are consistent across screens

## Discovery Questions Before You Share Screen

Ask 2-3 short questions first:

1. `Right now, where does most delay happen: register typing, review, or reporting?`
2. `Who feels the pain more every day: supervisor, accounts, or owner?`
3. `In your factory, do losses happen more in stock, dispatch, delay, or wrong entry?`

These answers decide which version of the demo to lead with.

## Recommended 15-Minute Demo

### Minute 0-2: Open With The Problem

Say:

`Most factories already have data, but it is trapped in paper registers, manual Excel typing, delayed approvals, and WhatsApp follow-up. DPR.ai turns that into one trusted operating flow.`

Then say:

`I will not show you every screen. I will show you the exact path from capture to management action.`

### Minute 2-5: Show Data Capture

Open:

- `/ocr/scan`

Say:

`Your team captures the register image here. They do not need to create Excel first. The first win is speed.`

Point out:

- camera/upload simplicity
- fast capture
- clear next action after scan

Do not over-explain OCR providers or technical internals.

### Minute 5-8: Show Review And Trust

Open:

- `/ocr/verify`
- `/approvals`

Say:

`This is the trust layer. OCR, attendance exceptions, and stock issues do not silently become business data. Someone reviews them first.`

Point out:

- approval workflow
- trust labeling
- queue-based review
- audit visibility

This is where you say:

`Most software stops at extraction. DPR.ai continues until the data is trusted.`

### Minute 8-11: Show Reporting Hub

Open:

- `/reports`
- `/attendance/reports` if reporting-heavy client

Say:

`Once data is trusted, it becomes reporting-safe. This is the point where operations becomes management output.`

Point out:

- trusted reporting hub
- exports
- OCR trust visibility
- cleaner handoff to accounts or management

### Minute 11-13: Show Owner Value

Open:

- `/premium/dashboard`
- `/steel/charts` for steel client
- `/email-summary`

Say:

`This is the owner layer. Instead of only seeing activity, the owner sees risk, exposure, and what should be checked first.`

Point out:

- money at risk
- anomaly or leakage signals
- stock trust
- outbound owner-ready summary

### Minute 13-15: Close Commercially

Say:

`DPR.ai is not trying to replace your factory overnight with a giant ERP. It fixes the trust chain first: capture data, review it, report it cleanly, and show management where attention and money risk are building.`

Then ask:

1. `If this worked exactly like this in your factory, where would you deploy it first?`
2. `Would you start with one plant, one process, or one reporting workflow?`

## Exact Click Path For The Main Demo

Use this order:

1. `/ocr/scan`
2. `/ocr/verify`
3. `/approvals`
4. `/reports`
5. `/premium/dashboard`
6. `/email-summary`

Use this steel order:

1. `/ocr/scan`
2. `/approvals`
3. `/steel/reconciliations`
4. `/steel/charts`
5. `/premium/dashboard`
6. `/email-summary`

## 7-Minute Fast Demo

Use this when the owner is impatient.

### Route order

1. `/premium/dashboard`
2. `/reports`
3. `/ocr/verify`
4. `/email-summary`

### Talk track

`Let me show you the end result first. DPR.ai gives the owner trusted risk and summary visibility, but that visibility is backed by a review system, not by raw entries alone.`

## Steel Demo Story

Use this when speaking to steel factory owners or managers.

### Storyline

- register data is captured
- mismatch or exception enters review
- stock trust problem is visible
- linked commercial impact is visible
- owner sees exposure and next action

### Routes

- `/approvals`
- `/steel/reconciliations`
- `/steel/charts`
- `/steel/customers`
- `/premium/dashboard`

### Steel talk track

`In steel, mistakes happen in weight, movement, wrong entry, and delayed updates. DPR.ai helps you see where trust breaks, how it affects invoice and dispatch visibility, and where money could be leaking.`

### Steel value lines

- `Stock mismatch should not stay a note. It should become a tracked decision.`
- `Dispatch and invoice should not drift apart without being visible.`
- `Owners do not just need totals. They need risk with source and likely responsibility.`

## Role-Based Demo Cuts

### Operator Demo

Open:

- `/dashboard`
- `/entry`
- `/ocr/scan`

Say:

`For the floor team, the product is intentionally narrow: do the next shift entry, capture paper fast, and keep work moving.`

### Supervisor Demo

Open:

- `/approvals`
- `/reports`
- `/steel/reconciliations` if steel

Say:

`For supervisors, DPR.ai is a trust and execution desk. Their job is to clear risky work before it becomes reporting or stock confusion.`

### Accountant Demo

Open:

- `/reports`
- `/attendance/reports`
- `/email-summary`

Say:

`For accounts or reporting users, the value is clean output without manual rewriting, scattered Excel correction, or last-minute chasing.`

### Owner Demo

Open:

- `/premium/dashboard`
- `/ai`
- `/email-summary`

Say:

`For owners, the value is not OCR by itself. The value is knowing where money is at risk, what is still untrusted, and what deserves attention first.`

## Demo Sample Numbers

Use one clean narrative like this:

- 3 OCR documents scanned this week
- 2 approved
- 1 pending review
- 1 stock mismatch of `-850 KG`
- `Rs 1.8 lakh` estimated leakage or risk exposure
- 1 overdue customer payment linked to recent dispatch

Do not invent numbers mid-demo. Keep the story consistent across all screens.

## If A Live Step Fails

### If OCR is slow

Say:

`OCR can take a moment depending on image quality, so let me show you the trusted review and reporting path that comes after capture.`

Then jump to:

- `/ocr/verify`
- `/approvals`

### If export is slow

Say:

`The export job runs asynchronously so the team does not get blocked. The more important part for the business is that the trusted reporting layer is already ready here.`

Then jump to:

- `/reports`
- `/email-summary`

### If the buyer is impatient

Jump immediately to:

- `/premium/dashboard`

Then say:

`Let me show the final business outcome first, then I will show where this data comes from.`

## Questions You Will Hear

### Why not just use Excel?

Answer:

`Excel does not give you capture, trust, approval, role control, anomaly visibility, or owner-ready summaries in one connected flow.`

### Why pay monthly?

Answer:

`Because the product saves typing time, reduces avoidable errors, improves reporting speed, and gives visibility into loss and responsibility that manual systems do not catch reliably.`

### Is this only OCR?

Answer:

`No. OCR is the capture engine. The real value comes from review, reporting, and owner action on top of that captured data.`

### Is this an ERP?

Answer:

`No. DPR.ai is not trying to become a giant ERP on day one. It focuses on the trust chain: data capture, review, reporting, and management action.`

## Demo Mistakes To Avoid

- showing too many tabs
- showing settings early
- talking like a developer
- explaining AI models before business value
- switching stories halfway through
- using inconsistent numbers
- claiming perfect anomaly detection without evidence

## Best Closing Lines

Use one of these:

- `If this replaced your manual register-to-report workflow, where would you want to start first?`
- `Would you pilot this first in one department, one factory, or one steel movement workflow?`
- `If this removed one daily pain immediately, which one matters most to you: typing, review delay, or hidden loss?`

## Final Positioning Line

Say:

`DPR.ai turns factory records into trusted business action. It captures data, forces review where risk exists, turns clean information into reporting, and helps owners see where time and money are leaking.`
