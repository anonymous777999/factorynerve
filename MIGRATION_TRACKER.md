# FactoryNerve UI Migration Tracker

Legend: `[x]` complete · `[~]` partial · `[ ]` not started

Updated after Premium UI rollout (Wave 0–4). See `FRONTEND-REDESIGN/PREMIUM_UI_ENHANCEMENT_SPECIFICATION.md`.

| Route | Token compliant | Shell / queue | LoadingBoundary | Tier B P0 premium |
|-------|-----------------|---------------|-----------------|-------------------|
| `/login` | [~] | [x] Auth | [ ] | [~] |
| `/register` | [~] | [x] Auth | [ ] | [~] |
| `/forgot-password` | [x] | [x] Auth | [ ] | [~] |
| `/reset-password` | [x] | [x] Auth | [ ] | [~] |
| `/verify-email` | [x] | [x] Auth | [ ] | [~] |
| `/onboarding/factory-required` | [x] | [x] Auth | [ ] | [~] |
| `/403` | [x] | [x] Auth | [ ] | [ ] |
| `/offline` | [x] | [x] Recovery | [ ] | [ ] |
| `/dashboard` (operator) | [~] | [x] WS | [ ] | [~] |
| `/dashboard` (management) | [x] | [x] WS | [~] | [x] |
| `/premium/dashboard` | [x] | [x] WS | [ ] | [x] |
| `/work-queue` | [x] | [x] WS | [~] | [x] |
| `/tasks` | [x] | [x] WS | [~] | [x] |
| `/attendance` | [x] | [x] WS | [~] | [x] |
| `/attendance/live` | [x] | [x] WS + live | [x] | [x] |
| `/attendance/review` | [x] | [x] Queue | [~] | [x] |
| `/attendance/reports` | [x] | [x] WS | [~] | [x] |
| `/approvals` | [x] | [x] WS | [~] | [x] |
| `/entry` | [x] | [x] WS | [~] | [x] |
| `/entry/[id]` | [x] | [x] WS | [~] | [x] |
| `/ocr/scan` | [x] | [x] immersive | [~] | [x] |
| `/ocr/verify` | [x] | [x] Queue (V2) | [x] | [x] |
| `/ocr/history` | [x] | [x] WS + FilterBar | [x] | [x] |
| `/ocr/jobs/[jobId]` | [x] | [x] WS | [~] | [x] |
| `/steel` | [x] | [x] WS + TabNav | [~] | [x] |
| `/steel/dispatches` | [x] | [x] WS | [~] | [x] |
| `/steel/customers` | [x] | [x] WS | [~] | [x] |
| `/steel/invoices` | [x] | [x] WS | [~] | [x] |
| `/steel/invoices/[id]` | [x] | [x] WS | [~] | [x] |
| `/steel/dispatches/[id]` | [x] | [x] WS | [~] | [x] |
| `/steel/inventory` | [x] | [x] WS | [~] | [x] |
| `/steel/inventory/transactions` | [x] | [x] WS | [~] | [x] |
| `/steel/batches` | [x] | [x] WS | [~] | [x] |
| `/steel/batches/[id]` | [x] | [x] WS | [~] | [x] |
| `/steel/production/record` | [x] | [x] WS | [~] | [x] |
| `/steel/reconciliations` | [x] | [x] WS | [x] | [x] |
| `/steel/charts` | [x] | [x] WS | [~] | [~] |
| `/reports` | [x] | [x] WS | [~] | [x] |
| `/analytics` | [x] | [x] WS | [~] | [x] |
| `/ai` | [x] | [x] WS | [~] | [x] |
| `/email-summary` | [x] | [x] WS | [~] | [x] |
| `/control-tower` | [x] | [x] WS | [~] | [x] |
| `/settings` | [x] | [x] embedded shell | [~] | [x] |
| `/settings/attendance` | [x] | [x] WS | [~] | [x] |
| `/billing` | [x] | [x] WS + Disclosure | [~] | [x] |
| `/plans` | [x] | [x] WS | [~] | [x] |
| `/profile` | [x] | [x] WS | [~] | [x] |

## Wave 0 foundation (shared)

| Item | Status |
|------|--------|
| Premium tokens (`tokens.css`) | [x] |
| Global utilities (`globals.css`) | [x] |
| Motion primitives (`components/motion/`) | [x] |
| `WorkstationShell` extensions | [x] |
| `OperationalPageShell` | [x] |
| `RouteHeader`, `DisclosurePanel`, `TabNav` | [x] |
| `MIGRATION_TRACKER.md` | [x] |
| `scripts/token-audit.mjs` | [x] |

## OCR verify consolidation

- Production default: `OcrVerificationV2Page` (`USE_GOVERNED_OCR_WORKSPACE = false`).
- Governed workspace opt-in: `?workspace=governed` when flag enabled.
- Legacy override: `?workspace=legacy`.

## Platform (parallel)

- `response_envelope.py`: string and `{ message }` error bodies normalized for client toasts.

## Remaining P1 (not blocking)

- Tier A auth route transitions (`template.tsx` / Framer).
- Full `LoadingBoundary` on every sub-panel.
- `RevealOnView` on chart surfaces (steel charts, analytics).
- ESLint rule for `var(--muted)` in migrated files.
