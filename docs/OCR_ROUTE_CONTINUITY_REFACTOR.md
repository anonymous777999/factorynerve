# OCR Route Continuity Refactor

## Completed in this pass

- OCR scan route state now has a canonical URL model for `step`, `verification_id`, and mobile `panel` state through [`web/src/lib/ocr-scan-route.ts`](D:/DPR APP/DPR.ai/web/src/lib/ocr-scan-route.ts) and [`web/src/hooks/use-ocr-scan-route-state.ts`](D:/DPR APP/DPR.ai/web/src/hooks/use-ocr-scan-route-state.ts).
- OCR verification route state now treats `id`, `step`, queue filters, mobile `pane`, and workspace `tab` as URL-owned state through [`web/src/lib/ocr-verify-route.ts`](D:/DPR APP/DPR.ai/web/src/lib/ocr-verify-route.ts) and [`web/src/hooks/use-ocr-verify-route-state.ts`](D:/DPR APP/DPR.ai/web/src/hooks/use-ocr-verify-route-state.ts).
- OCR scan continuity now restores local draft context after refresh from [`web/src/lib/ocr-ui-state.ts`](D:/DPR APP/DPR.ai/web/src/lib/ocr-ui-state.ts), including extracted headers, rows, column types, language, confidence metadata, status, and draft linkage.
- OCR verification V2 now uses the shared operational primitives for workstation flow:
  - [`WorkstationShell`](D:/DPR APP/DPR.ai/web/src/components/ui/workstation-shell.tsx)
  - [`QueueWorkspaceLayout`](D:/DPR APP/DPR.ai/web/src/components/ui/queue-workspace-layout.tsx)
  - [`SectionPanel`](D:/DPR APP/DPR.ai/web/src/components/ui/section-panel.tsx)
  - [`OperationalTable`](D:/DPR APP/DPR.ai/web/src/components/ui/operational-table.tsx)
  - [`ActionDock`](D:/DPR APP/DPR.ai/web/src/components/ui/action-dock.tsx)
  - [`FilterBar`](D:/DPR APP/DPR.ai/web/src/components/ui/filter-bar.tsx)
  - [`LoadingBoundary`](D:/DPR APP/DPR.ai/web/src/components/ui/loading-boundary.tsx)
- A dedicated OCR queue table wrapper and stories were added in [`web/src/components/ocr/verification-v2/ocr-verification-queue-table.tsx`](D:/DPR APP/DPR.ai/web/src/components/ocr/verification-v2/ocr-verification-queue-table.tsx), [`web/src/components/ocr/verification-v2/ocr-verification-queue-table.stories.tsx`](D:/DPR APP/DPR.ai/web/src/components/ocr/verification-v2/ocr-verification-queue-table.stories.tsx), and [`web/src/components/ocr/verification-v2/ocr-review-workspace.stories.tsx`](D:/DPR APP/DPR.ai/web/src/components/ocr/verification-v2/ocr-review-workspace.stories.tsx).

## Continuity fixes

- Refresh on OCR verification now preserves:
  - active draft id
  - queue search and status filter
  - mobile queue versus workspace pane
  - active workspace tab
- Mobile back-navigation is now route-safe for OCR verification:
  - moving from queue to workspace pushes route state
  - moving back to queue collapses workspace context instead of clearing queue filters
- OCR scan now uses route-backed camera state so mobile camera open/close is part of navigation state instead of purely local component state.
- OCR scan now restores interrupted local work after refresh when a server-side draft has not been created yet.
- OCR scan continues to prefer persisted backend drafts when `savedId` is available, reducing reliance on local-only continuity.

## Verification completed

- `npm run build-storybook` in `/web`: passed.
- `npm run typecheck` in `/web`: OCR changes passed; the only remaining failure is a pre-existing Next 16 route typing issue in [`web/src/app/ocr/jobs/[jobId]/page.tsx`](D:/DPR APP/DPR.ai/web/src/app/ocr/jobs/[jobId]/page.tsx).
- `/web` dev server started successfully on `http://127.0.0.1:3000`.
- In-app browser route checks confirmed OCR route URLs and browser history continuity for:
  - `/ocr/scan?step=processing&panel=camera`
  - `/ocr/verify?id=15&step=3&pane=workspace&tab=fix&status=pending&q=coil`

## Remaining debt

- OCR scan still renders its legacy page composition rather than a full `WorkstationShell` migration. Continuity is improved, but layout unification is incomplete on the scan route.
- Unsaved scan image continuity is intentionally partial. Blob URLs are not durable across refresh, so recovered local drafts restore extracted data and workflow metadata more reliably than image previews.
- Verification continuity is now URL-first, but the older non-V2 OCR verification route still carries parallel workflow behavior and should eventually converge on the same route contract.
- The protected `/ocr/*` preview flow is currently blocked locally by an auth/API failure in the running app, so live workstation validation was limited to guarded route loading and browser-history checks rather than a signed-in end-to-end review.

## Future migration opportunities

- Move OCR scan onto the same workstation shell structure as OCR verification so queue, intake, processing, and export use one operational frame.
- Promote OCR continuity behavior into shared route-state helpers for approvals and reconciliation, since the same mobile pane and URL-owned tab patterns will recur there.
- Replace remaining session-only workflow state with explicit query params where the state is navigation-relevant, and reserve client persistence for true draft content only.
- Consider durable client-side image persistence only if scan refresh recovery needs to preserve raw local imagery without a saved server draft.
