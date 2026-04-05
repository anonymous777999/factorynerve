# DPR.ai V1 Release Notes

Release date: 2026-04-04  
Release owner: Product + Engineering

## V1 Product Definition

DPR.ai V1 is a factory intelligence operating system that combines:

- OCR-based register digitization
- daily operations capture
- trust through review and approval
- reporting and export workflows
- owner intelligence
- steel workflow depth where relevant

## What Shipped

### 1. OCR Trust Chain

- reviewed OCR data is now the export source
- approved OCR is separated from untrusted OCR
- downstream reporting surfaces use approved-only OCR trust counts
- scan flow can open the exact saved review draft
- OCR review surfaces show trust and audit context

### 2. Role-Compressed Workflow

- role-based home routes are active
- desktop and mobile navigation priorities are compressed by role
- dashboard actions now reflect operator, supervisor, accountant, manager, admin, and owner needs

### 3. Review Center Hardening

- approvals queue handles mixed work with presets and SLA focus
- bulk approve/reject includes guardrails and confirmation
- queue cards show stronger history, decision state, and next actions

### 4. Owner Intelligence Packaging

- owner desk now surfaces money at risk, dispatch exposure, stock trust, and responsibility signals
- email summaries now use owner-facing risk wording
- premium packaging is tied more clearly to loss prevention value

### 5. Steel Operating Loop

- steel reconciliations include structured mismatch causes
- stock view includes derived operational zones and variance in `KG` and `%`
- invoice, dispatch, and customer surfaces are more tightly linked
- steel charts support action drill-down instead of passive KPI viewing

### 6. Reporting And Launch Polish

- `/reports` is now framed as the trusted reporting hub
- `/email-summary` has clearer send-readiness and faster setup flow
- dashboard now includes role-based first-step guidance
- launch docs, demo docs, and support docs are added

## Biggest User-Facing Improvements

- fewer trust gaps between review and export
- clearer role-specific workflow
- better owner story around loss, risk, and action
- stronger reporting handoff from operations to management

## Known Limits

- server-side email sending is intentionally not enabled yet; mail still leaves through the user's own mail client
- steel location visibility is currently derived by operational zone, not exact yard/bin tracking
- final manual role-based smoke sign-off is still recommended before broad paid rollout

## Recommended Demo Story

1. capture one register
2. correct and approve OCR
3. show trusted reporting
4. show owner risk / steel evidence
5. finish with owner update export/email summary

## Quality Gate Snapshot

- backend tests: pass
- frontend lint: pass
- frontend build: pass
- QA matrix: updated

## Upgrade Path After V1

- exact stock-location modeling for steel
- deeper scheduled outbound reporting
- more seeded demo data and live demo toggles
- richer owner-side anomaly evidence ranking
