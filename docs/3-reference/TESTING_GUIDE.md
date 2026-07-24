# Testing Guide

> How to run automated tests using the QA automation environment.

---

## Overview

This project uses two parallel testing layers:

1. **Playwright Test Runner** (`@playwright/test`) — Node.js-based regression suite for CI/CD pipelines; tests live in `web/e2e/`.
2. **Playwright MCP Agent** — Interactive browser control for Claude Code sessions; used for exploratory testing and debugging.

---

## Prerequisites

- Node.js v24+, npm 11+
- Playwright browsers installed (already done):
  ```bash
  npx playwright install --with-deps
  ```

---

## Running Tests

### Smoke Tests

Quick check that core functionality works:

```bash
cd web
npm test     # or use package.json scripts
```

### Full Regression

```bash
cd web
npx playwright test
```

Run with specific project profile:

```bash
npx playwright test --project=chromium
npx playwright test --project="mobile-320"
npx playwright test --project="android-chrome"
```

### Run a Single Test File

```bash
npx playwright test e2e/mobile-overflow.spec.ts
```

### Run Tests in UI Mode (Interactive)

```bash
npx playwright test --ui
```

### Generate HTML Report

After tests run, view the report:

```bash
npx playwright show-report
```

---

## Test Workspace Layout

```
tests/
├── smoke/          # Quick health-check tests
├── regression/     # Full regression suites
├── accessibility/  # Accessibility audit tests
└── performance/    # Performance benchmarks
```

---

## Auth Handling

For tests that require authentication:

1. **Test credentials** are stored in environment variables (never committed).
2. Login flow is handled via Playwright test fixtures.
3. Example flow:
   ```ts
   // Log in via the UI
   await page.goto('/login');
   await page.fill('[name="email"]', process.env.TEST_USER_EMAIL!);
   await page.fill('[name="password"]', process.env.TEST_USER_PASSWORD!);
   await page.click('button[type="submit"]');
   await page.waitForURL('/dashboard');
   ```

**Security rules:**
- Never use production credentials in tests.
- Never commit `.env` files with real secrets.
- Test credentials go in `.env.testing` (tracked as template) or CI secrets.

---

## Role/Permission Testing Convention

When testing roles and permissions:

1. Define one fixture per role in `tests/fixtures/`.
2. Example structure:
   ```ts
   // tests/fixtures/roles.ts
   export const roles = {
     admin: { email: process.env.ADMIN_EMAIL!, password: process.env.ADMIN_PASS! },
     manager: { email: process.env.MANAGER_EMAIL!, password: process.env.MANAGER_PASS! },
     operator: { email: process.env.OPERATOR_EMAIL!, password: process.env.OPERATOR_PASS! },
   };
   ```
3. Assert that each role can/cannot access specific routes and API endpoints.
4. Run role-based tests in parallel across projects.

---

## Available `npm run` Commands

| Command                | Description                     |
|------------------------|---------------------------------|
| `npm run dev`          | Start dev server                |
| `npm test`             | Run tests                       |
| `npm run test:e2e`     | Run all Playwright e2e tests    |
| `npm run test:smoke`   | Run smoke tests                 |
| `npm run test:regression` | Run full regression suite    |
| `npm run test:a11y`    | Run accessibility audits        |
| `npm run audit:overflow` | Audit mobile overflow issues  |

---

## Artifact Output

Test artifacts (screenshots, videos, traces) are saved to:

- `./screenshots/` — screenshots from test failures
- `./playwright-report/` — HTML report
- `./artifacts/` — raw test artifacts
- `./reports/` — generated summary reports
