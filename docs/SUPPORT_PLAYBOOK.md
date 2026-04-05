# Support Playbook

Updated: 2026-04-04  
Owner: Support + Engineering

## Purpose

Use this playbook when a customer reports that DPR.ai is not working as expected in a live factory workflow.

The goal is to:

- stabilize the user fast
- protect trust
- avoid asking the customer to repeat work unnecessarily
- route real bugs to engineering with the right evidence

## Support Principles

- do not blame the user
- confirm the exact factory, role, and screen first
- ask what they were trying to do, not just what broke
- protect reviewed data and approved data first
- if trust is unclear, pause distribution/export until the data path is verified

## Minimum Intake Checklist

Before escalating, capture:

- organization name
- factory name
- user role
- screen/route
- exact action attempted
- exact error text if visible
- time of issue
- whether this is blocking current production/reporting

## Case 1: Failed OCR Job

### Symptoms

- scan never completes
- review draft missing after scan
- Excel generation fails

### First checks

- confirm the image upload actually completed
- confirm the user can open `/ocr/verify`
- check whether the draft exists but export failed separately
- confirm whether this is raw OCR failure or reviewed export failure

### User-safe response

- if draft exists: tell user the captured data is safe and move them into review
- if export failed: keep the user on approved/reviewed data path and retry export
- if scan failed before draft creation: ask for one retry with the same image only once

### Escalate when

- repeat failure happens on the same register type
- reviewed rows and exported rows differ
- approval state and trusted OCR summary disagree

## Case 2: Failed Export

### Symptoms

- PDF does not download
- Excel job stalls
- range export fails

### First checks

- confirm exact export type:
  - per-entry PDF
  - per-entry Excel
  - range Excel
- confirm the role is allowed to export
- confirm whether the underlying record still exists and is approved if trust-gated

### User-safe response

- keep the user on the record/report screen
- retry one export
- if still blocked, offer alternate export path if appropriate

### Escalate when

- export job fails repeatedly for the same record/range
- unauthorized/forbidden appears for a role that should have access
- download starts but file content is incorrect

## Case 3: Blocked Review

### Symptoms

- cannot approve
- cannot reject
- note required unexpectedly
- queue item does not disappear after action

### First checks

- confirm role is review-capable
- confirm whether note is mandatory because the item is high risk
- confirm whether the item is actually restricted by role
- refresh queue once before escalating

### User-safe response

- explain whether the item needs a note or a higher role
- route them to the source screen if deep fix is required
- do not tell them to keep retrying blindly

### Escalate when

- valid review role is blocked without a clear reason
- queue count and item state disagree after refresh
- approved item still appears as pending across screens

## Case 4: Role Or Access Problem

### Symptoms

- user cannot see expected tab
- promoted role still sees old access
- steel module missing

### First checks

- confirm the active factory
- confirm actual role in the session
- confirm industry type on the active factory
- confirm the plan allows the feature

### User-safe response

- explain whether this is role, plan, or factory-context based
- if role was just changed, have the user refresh session once

### Escalate when

- session does not pick up valid role change
- factory context is wrong after switch
- feature remains hidden for correct role + plan + factory

## Case 5: Dispatch Or Steel Trust Problem

### Symptoms

- cannot create dispatch
- negative stock warning
- invoice/dispatch weights do not align
- reconciliation mismatch does not resolve

### First checks

- confirm dispatch role permission
- confirm truck/driver and other required fields are filled
- confirm linked invoice/line quantities are valid
- confirm mismatch cause is selected where required

### User-safe response

- explain the exact missing field or blocked reason
- move the user to invoice or reconciliation context if the dispatch is blocked by upstream data

### Escalate when

- valid dispatch is blocked despite complete data
- invoice-dispatch weight consistency is wrong
- reconciliation state and stock summary disagree

## Case 6: Reporting Or Owner Summary Mismatch

### Symptoms

- owner email says one number, report says another
- OCR counts look wrong
- risk summary feels out of sync

### First checks

- confirm date range
- confirm active factory
- confirm whether OCR items are approved or still pending
- confirm whether the user is seeing trusted summary or raw operational data

### User-safe response

- reset to the same date range across reports and email summary
- verify OCR trust status before sending leadership updates

### Escalate when

- same range, same factory, same role still shows inconsistent trusted totals
- approved OCR count differs across trust surfaces

## Engineering Escalation Template

- Issue type:
- Customer:
- Factory:
- Role:
- Route:
- Time observed:
- Severity:
- Current blocker:
- Reproduction steps:
- Screenshots / output:
- Temporary workaround used:
