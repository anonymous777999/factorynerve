# Go-Live Checklist

Updated: 2026-04-04  
Owner: Product + Engineering + Support

## Purpose

Use this checklist before any paid rollout, pilot launch, or owner demo that can convert into a real deployment.

This checklist assumes DPR.ai is being sold as a factory intelligence operating system with:

- OCR-driven register digitization
- daily operations capture
- review and approval trust gates
- reporting and owner visibility
- steel workflow depth where relevant

## Release Blockers

Do not go live until all of these are true:

- `python -m pytest -q` passes
- `cd web && npm run lint` passes
- `cd web && npm run build` passes
- `docs/MASTER_QA_MATRIX.md` has all `P0` and `P1` rows marked `pass`
- operator walkthrough has been run on mobile
- supervisor walkthrough has been run on desktop
- owner walkthrough has been run on desktop
- OCR corrected export is verified against reviewed data
- role access is verified for the target factory
- billing/plan gates match the customer contract

## Commercial Readiness

- Plan tier for the customer is confirmed
- Factory count and user count are within plan or contract limits
- OCR quota expectation is understood
- Premium owner surfaces are enabled only if sold
- Demo or sales copy matches the features actually enabled for the customer

## Factory Setup

- Organization record created
- Factory created with correct `industry_type`
- Workflow template selected correctly
- Users invited with the right roles
- At least one manager/admin account verified
- For steel deployments:
  - stock review data path checked
  - dispatch permissions checked
  - invoice/customer visibility checked

## Trust Setup

- OCR scan works on target customer register type
- OCR review queue is reachable by the customer's review role
- Approved OCR appears in trusted exports and reporting
- Rejected/pending OCR does not appear as trusted output
- Attendance review queue works for missed punch flow
- Approval queue opens and bulk actions behave correctly

## Reporting Setup

- `/reports` loads with current factory context
- attendance reports load for reporting roles
- owner summary page loads and generates compose-ready draft
- trusted OCR summary is visible where allowed
- steel risk summary appears only in steel factory mode
- export jobs download successfully:
  - range Excel
  - per-entry PDF
  - per-entry Excel

## Role Walkthroughs

### Operator

- can reach the main daily screen in one click
- can complete entry flow
- can scan a register image
- understands what to do next after scan
- mobile layout is usable

### Supervisor

- lands in approvals or clear execution context
- can process attendance review
- can process OCR review
- can follow stock/reconciliation escalation if steel factory
- can move from queue to source workflow without confusion

### Manager / Admin

- can reach reports quickly
- can move between approvals and reports without losing context
- can access steel control if applicable
- admin-only settings are present but not crowding the daily path

### Owner

- can reach owner desk or control tower in one click
- can identify top risk in under 60 seconds
- can drill into evidence
- can open summary/email page and understand the outbound story

## Demo Readiness

- demo story uses one clean factory narrative
- use `docs/DEMO_WALKTHROUGH.md` as the live call script
- do not start from settings
- do not start from billing
- start from data capture, trust, or owner risk depending on audience
- sample figures are internally consistent across OCR, reports, and steel surfaces
- one fallback path exists if OCR or export takes too long live

## Support Readiness

- `docs/SUPPORT_PLAYBOOK.md` reviewed by whoever will handle customer issues
- escalation owner identified for:
  - OCR failure
  - export failure
  - blocked review
  - role/access problem
  - steel dispatch mismatch

## Launch Day Checks

- production environment variables validated
- AI/OCR provider credentials validated
- storage path validated
- email summary compose links tested in browser
- browser/mobile smoke run on the target device class
- audit logs visible for approvals and OCR review
- one dry-run export completed after deployment

## First Week After Launch

- review OCR trust summary daily
- review approval backlog daily
- confirm no repeated role-access tickets
- confirm exports are being used successfully
- review owner summary usage at least once
- capture top three user confusions and convert them into product or copy fixes

## Final Sign-Off

- Engineering owner:
- Product owner:
- Support owner:
- Launch date:
- Customer / pilot name:
- Approved for paid rollout: `yes / no`
