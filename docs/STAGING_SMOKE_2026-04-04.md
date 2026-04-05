# Staging Smoke - 2026-04-04

Owner: Engineering  
Goal: final pre-launch smoke using the go-live checklist

## Result

Automated staging smoke is `pass`.

The product is in a strong release state from a code and startup perspective, with one honest remaining gap:

- real human role walkthroughs are still recommended before paid rollout sign-off

## What Was Verified

### Quality Gates

- `python -m pytest -q` -> `106 passed`
- `cd web && npm.cmd run lint` -> `passed`
- `cd web && npm.cmd run build` -> `passed`

### Browser E2E Smoke

- `cd web && npm.cmd run test:e2e` -> `2 passed`

Covered by Playwright:

- mobile render smoke for:
  - `/dashboard`
  - `/entry`
  - `/ocr/scan`
  - `/steel`
  - `/reports`
- Hindi localization stability
- Marathi localization stability

### Production-Style Startup Smoke

Backend launcher and built frontend were started locally and key routes were requested successfully.

Verified:

- backend health: `http://127.0.0.1:8765/health`
- frontend login: `/login`
- dashboard: `/dashboard`
- reports: `/reports`
- email summary: `/email-summary`
- owner desk: `/premium/dashboard`
- steel charts: `/steel/charts`

All checked routes returned `200`.

## Notable Observation

The first production-style request to heavier owner/steel routes needed a longer timeout than the lighter pages.

This did not fail after warmup, but it is worth watching during real deployment:

- `/premium/dashboard`
- `/steel/charts`

Practical meaning:

- the routes are serving correctly
- first-hit warmup on heavier pages may feel slower than the rest of the app

## What Still Needs Human Sign-Off

These are not blockers for code quality, but they are still go-live tasks:

- operator walkthrough on a real mobile device
- supervisor walkthrough on desktop with mixed review items
- owner walkthrough on desktop with real risk/drill-down review
- customer-specific role and plan confirmation
- customer-specific OCR register sample validation

## Final Engineering Verdict

From an engineering smoke perspective, DPR.ai V1 is stable enough to move into final staging/UAT sign-off.

Recommended next step:

1. run the human role walkthroughs from `docs/go_live_checklist.md`
2. use `docs/DEMO_WALKTHROUGH.md` for the launch/demo narrative
