# LEGACY OWNERSHIP MAP

Date: 2026-05-26
Scope: OCR verification workflow inside the production repository at `web/`

## Outcome

Governed OCR now owns the live operational review lane when `workspace=governed` or `NEXT_PUBLIC_USE_GOVERNED_OCR_WORKSPACE=true`.

Transferred ownership now includes:

- manual OCR correction
- inline cell editing
- header correction
- row restore actions
- reviewer notes
- send-back / rejection orchestration
- approval orchestration
- bulk queue advancement
- export actions
- workflow refresh synchronization
- operational keyboard shortcuts

Rollback safety remains in place through the legacy route.

## Fully Governed

- `web/src-v2/workspaces/ocr-execution/governed-ocr-verification-page.tsx`
  - route-level governed owner
  - keyboard flow owner
  - governed panel / correction rail composition owner
- `web/src-v2/workspaces/ocr-execution/use-governed-ocr-verification-controller.ts`
  - draft hydration owner
  - state consolidation owner
  - save / submit / approve / reject owner
  - bulk queue mutation owner
  - refresh subscription owner
  - export / cleanup / row restore owner
- `web/src-v2/workspaces/ocr-execution/components/governed-ocr-action-panel.tsx`
  - selected-field correction owner
  - approval / send-back action owner
  - reviewer note ownership
- `web/src-v2/workspaces/ocr-execution/components/governed-ocr-correction-rail.tsx`
  - governed DataTable correction owner
  - inline editing owner
  - row-level action owner
- `web/src-v2/workspaces/ocr-execution/components/governed-ocr-intake-screen.tsx`
  - governed intake entry owner for step 2
- `web/src-v2/_governed/src/workspaces/OCRExecutionWorkspace/OCRExecutionWorkspace.tsx`
  - slot-enabled governed shell
  - document / side panel / bottom rail composition boundary

## Partially Governed

- `web/src/app/ocr/verify/page.tsx`
  - governed lane is integrated and build-valid
  - feature flag and `workspace=` override still determine live owner
- `web/src-v2/adapters/ocr-verification.ts`
  - governed contract owner on the frontend side
  - backend payload shape remains unchanged
- `web/src/lib/workflow-sync.ts`
  - shared refresh bus remains cross-lane infrastructure during coexistence

## Legacy-Owned

- `web/src/legacy-ui/ocr/ocr-verification-v2-page.tsx`
  - rollback-only OCR review lane
  - still contains the old review workspace composition
- `web/src/legacy-ui/ocr/ocr-verification-page.tsx`
  - pre-governed OCR experience
  - only used when `NEW_OCR_VERIFY` is disabled
- `web/src/components/ocr/verification-v2/*`
- `web/src/components/ocr/ocr-review-table.tsx`
  - legacy support components now only needed by rollback lanes

## Extracted Seams

### Manual Correction

Previous owner:
- `web/src/components/ocr-verification-v2-page.tsx`
- `web/src/components/ocr/ocr-review-table.tsx`

New owner:
- `web/src-v2/workspaces/ocr-execution/components/governed-ocr-correction-rail.tsx`
- `web/src-v2/workspaces/ocr-execution/components/governed-ocr-action-panel.tsx`
- `web/src-v2/workspaces/ocr-execution/use-governed-ocr-verification-controller.ts`

Hidden coupling preserved safely:
- backend still accepts the existing verification update payload
- no OCR API contract changes were introduced

### Approval And Escalation

Previous owner:
- legacy review page action dock

New owner:
- governed action panel
- governed controller mutation orchestration

Backend coupling retained:
- submit endpoint remains submit transport
- approve endpoint remains approval transport
- reject endpoint remains send-back / escalation transport

### Workflow Refresh And State Sync

Previous owner:
- legacy page-local `signalWorkflowRefresh` orchestration

New owner:
- governed controller subscription and refetch handling
- controlled record mapping back into governed workspace records

### Keyboard Flow

Previous owner:
- legacy page `window` shortcut handler

New owner:
- governed page shortcut layer

Shortcuts now governed:
- `Alt+1` queue
- `Alt+2` document viewport
- `Alt+3` correction rail
- `Ctrl/Cmd+S` save draft
- `Ctrl/Cmd+Enter` submit or approve

## Quarantine Actions Completed

- moved rollback lane import boundary from `web/src/components/ocr-verification-v2-page.tsx`
  to `web/src/legacy-ui/ocr/ocr-verification-v2-page.tsx`
- updated `web/src/legacy-ui/README.md`
- kept rollback route alive through `workspace=legacy`

## Remaining Safe Legacy Surface

Legacy remains intentionally preserved for:

- rollback during governed rollout
- incident response
- parity checks against old operational behavior

Legacy should not be removed until:

- governed lane is the default route owner in production
- rollback lane is unused across a stable observation window
- production review operators confirm workflow parity

## Validation

Validated after transfer:

- `npm run typecheck` in `web/`
- `npm run build` in `web/`

Validated behavior by architecture:

- governed route drives real OCR APIs
- adapter boundary preserves backend stability
- correction state is single-owned in governed controller
- queue and detail refresh stay synchronized through the shared workflow refresh bus

## Operational Migration Update

Applied transfer of default OCR workflow ownership into governed systems by making the governed OCR workspace the default experience for `/ocr/verify`.

- `web/src/app/ocr/verify/page.tsx`: default route selection now routes to `GovernedOcrVerificationPage` unless `workspace=legacy` is explicitly requested.
- `web/src/config/featureFlags.ts`: governed OCR workspace is enabled by default unless explicitly disabled with `NEXT_PUBLIC_USE_GOVERNED_OCR_WORKSPACE=false`.
- rollback safety remains explicit by preserving the legacy experience path with `workspace=legacy`.

## Next Cleanup Phase

When governed OCR workspace stability is confirmed in production flows, the next safe removal phase can begin:

1. quarantine `web/src/legacy-ui/ocr/ocr-verification-v2-page.tsx` and `web/src/legacy-ui/ocr/ocr-verification-page.tsx`.
2. retire `NEW_OCR_VERIFY` gating in favor of a single governed owner.
3. remove legacy-only queue and review UI components that are no longer used by the fallback lane.
