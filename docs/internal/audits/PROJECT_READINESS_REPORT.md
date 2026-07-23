# FactoryNerve — Pre-Launch Readiness Report

**Date:** 2026-07-19
**Auditor:** Claude (automated code + live-system audit)
**Scope:** Full repo — Next.js 16 web (Vercel) + FastAPI/SQLAlchemy/Postgres API & worker (Render), Razorpay billing, WhatsApp Cloud API.
**Method:** Static code reading + **live verification** — ran the full ~1,130-test suite, hit the production API, traced the Razorpay webhook, inspected the RLS migration, and probed tenant isolation.
**Ground rule honored:** Nothing was fixed. This is investigation + verification only.

> **How to read this:** Everything is weighted toward *"what will the paying client actually see, or lose money on."* Where I suspected something and then disproved it by running code, I say so — this doubles as a handoff record so future-me doesn't re-chase dead ends.

---

## 1. VERDICT

**Conditional GO.** The core product is in materially better shape than the prior bug reports imply. The four historically catastrophic backend crashes are **already fixed**, multi-tenant isolation is **genuinely strong (two independent layers)**, and the Razorpay webhook path is **robust**. The live API is **up and healthy**.

There is exactly **one revenue-correctness bug that must be fixed before taking money** (scheduled plan downgrades never run in production), plus a short list of **secret-hygiene and branding** items that are embarrassing-if-noticed but not dangerous. None of the test-suite "failures" I found are real security or data-loss holes — I verified each cluster by hand.

**Do not go live until the P0 in section 3 is fixed and the P1 secrets are set in Render.** Everything else can ship-then-follow.

---

## 2. WHAT I VERIFIED IS SOLID (so we don't second-guess it later)

### 2.1 The 7 known bugs from FIX_GUIDE_FOR_AGENTS.md — ALL ALREADY FIXED
I checked the exact file/line for each. Current `main` already contains every fix:

| Bug | Location | Status in current code |
|-----|----------|------------------------|
| FIX-01 steel invoice 500 | `backend/routers/steel.py` ~4031 | FIXED — `taxable_amount` kwarg removed from `SteelSalesInvoiceLine` |
| FIX-02 dispatch NameError | `backend/routers/steel.py:5,7,80` | FIXED — `import os`, `import logging`, `logger = getLogger(__name__)` present |
| FIX-03 anomaly AttributeError | `backend/services/steel_intelligence.py:506` | FIXED — uses `counted_at` |
| FIX-04 notifications 404 | `backend/main.py:362` | FIXED — `include_router(notifications_router)`, no double prefix |
| FIX-05 owner dashboard 403 | `steel_intelligence.py:180/208`, `steel.py:1776` | FIXED — uses `production.analytics.view` (factory-scoped) |
| FIX-06 factory list 500 | `backend/routers/settings.py` ~451 | FIXED — try/except ValueError, default template fallback |
| FIX-07 AI ReadTimeout | `intelligence/service.py:946`, `entries.py:350/1094`, `emails.py:241`, `coil_theft.py:48` | FIXED — all pass `db=db` |

**Takeaway:** The "969 passed / 140 failed" baseline in FIX_GUIDE is stale. Reality today is **1027 passed / 98 failed** (see section 4).

### 2.2 Multi-tenancy isolation — STRONG, defense in depth [HIGHEST-PRIORITY CHECK]
This was the "single worst thing that can happen" check. It is **two independent layers**, either of which alone would prevent cross-tenant leakage:

1. **Application-layer query scoping.** Every tenant endpoint I traced derives `factory`/`org` from the *session* (`require_active_steel_factory`, `_active_factory_or_400`, `_active_org_or_400`) and filters queries by `factory_id`/`org_id`. Cross-tenant object access returns **404, not the row**. Verified across: steel inventory/dispatch/invoice/customer/batch, attendance review/approve, OCR verifications, notifications, intelligence requests.

2. **Postgres Row-Level Security (RLS).** Migration `alembic/versions/20260707_01_enable_row_level_security.py` enables **`FORCE ROW LEVEL SECURITY`** on **56 tenant tables** (Tier 1 = org+factory, Tier 2 = org-only). `backend/security.py` `get_current_user` sets `app.current_org_id` / `app.current_factory_id` GUCs on **every request** via `set_rls_context`; a SQLAlchemy checkout event applies them per pooled connection. `FORCE` means even the table owner is subject to the policy — only a superuser DB role bypasses. Platform admins get an explicit empty-string bypass signal (intended).

> The one apparent "cross-org leak" test failure (`test_cross_org_steel_isolation`) is a **test-harness bug, not a product hole** — see section 4.2. The product endpoint filters correctly; the test's `_seed_stock` helper ignores its `headers=` argument and posts under the shared client's *ambient* cookie (org2's), so it seeds org1's "data" into org2 and then "discovers" org2 can see it. I read the helper and confirmed this.

### 2.3 Razorpay billing webhook — ROBUST
Traced `POST /webhook/razorpay` (`backend/routers/billing.py:1220`) end to end:
- **Signature verification** via `razorpay.Utility.verify_webhook_signature` against `RAZORPAY_WEBHOOK_SECRET`; failure returns 400 and is logged, before any processing.
- **Idempotency (replay-safe):** `WebhookEvent(provider, event_id)` unique row, looked up `WITH FOR UPDATE`; duplicate returns early `{"idempotent": True}`. Belt-and-suspenders: an `IntegrityError` on concurrent insert is caught and also returns idempotent. **Replaying the same event twice does NOT double-activate.**
- **Double-activation guard:** a `was_paid` check on the `PaymentOrder` skips activation if already paid, even for a new event.
- **Missed/delayed webhook fallback:** `POST /orders/{order_id}/sync` (`billing.py:1160`) polls Razorpay directly, is tenant-scoped (`user_id == current_user.id`), and is itself `was_paid`-guarded. A dropped webhook is recoverable client-side.
- **Failure path:** `payment.failed` marks the order failed, records the failure, and **schedules** a downgrade after `BILLING_GRACE_DAYS`. WARNING: the job that *applies* scheduled downgrades never runs in prod — see section 3 P0.

### 2.4 Per-tenant limits — ENFORCED
`enforce_user_limit` / `enforce_factory_limit` (`backend/plans.py:598/621`) are called at registration and factory creation, count only active tenant-scoped rows, and raise on breach. OCR/AI features are gated by `plan_limit(...)` plus `check_rate_limit(..., db=db)`.

### 2.5 Backups and restore — GOOD (I was initially wrong about this)
- `.github/workflows/db-backup.yml`: **daily 02:00 UTC**, `pg_dump` to **Backblaze B2** (offsite), 14-day retention with automated pruning.
- `.github/workflows/restore-test.yml`: spins a throwaway Postgres, `pg_restore`s a backup, and **verifies table count** — backups are proven *restorable*, not merely written.
- (`scripts/backup_db.py` writes only to a local dir — that's a dev convenience, **not** the prod mechanism. Ignore it for prod.)

### 2.6 Live production system — UP and HEALTHY
- Web: `https://www.factorynerve.online/` returns 200; `/approvals` returns 307 to login (correct when unauthenticated).
- API (real host `factorynerve-api-6ttl.onrender.com`, reached via the Next.js `/api/*` rewrite): `/observability/ready` returns **200 `{"status":"ready","database":"ok","environment":"production"}`**.
- `uptime_seconds: 0` on my probe = Render **cold start** (free/starter tier sleeps). First request after idle is slow (see section 5).

### 2.7 No live secrets committed
Tracked env files (`.env.local`, `.env.production`, `.env.testing`, `.env.example`, etc.) contain **only placeholders / test values** (`whsec_test`, `rzp_te...`, `GROQ_API_KEY=test`, JWT literally `dev-secret-key-do-not-use-in-prod`). No `rzp_live`, `sk-ant-`, `AKIA`, or real webhook secrets in git. `.mcp.json` is correctly git-ignored. Prod secrets are injected via the Render dashboard / `generateValue`.

---

## 3. MUST-FIX BEFORE TAKING MONEY

### P0 — Scheduled plan downgrades never execute in production
- **What:** `payment.failed`, cancellation, and expiry all call `schedule_downgrade(...)`, which writes `pending_plan` + `pending_plan_effective_at`. The job that *applies* those (`apply_due_downgrades`, `backend/services/billing_manager.py:437`) is only reachable via `POST /cron/daily-maintenance` (`backend/routers/cron.py:69`).
- **The gap:** I searched the entire repo — **nothing triggers `/cron/daily-maintenance`.** It is not in `render.yaml` (no `type: cron` service, no schedule), not in any GitHub Actions workflow, and not started as an in-process thread (unlike the attendance/approval/email schedulers, which *are* started at boot in `backend/main.py`).
- **Client-visible impact:** A customer who cancels, or whose card fails, **keeps their paid plan forever.** You lose the downgrade, and a churned customer retains full access. Direct revenue/entitlement correctness bug.
- **Fix options (pick one):** add a Render Cron Job hitting `/cron/daily-maintenance` with the `X-Cron-Secret` header; OR a GitHub Actions scheduled curl; OR start `apply_due_downgrades` on the same daemon-thread scheduler pattern the other jobs use. **Also set `CRON_SECRET_TOKEN`** or the endpoint is unauthenticated-open (see P1).

### P1 — Production secrets that must be set in Render before launch
Required by code at runtime but **NOT declared in `render.yaml`**, so they must be added manually in the Render dashboard or the feature silently fails:
- `RAZORPAY_KEY_ID`, `RAZORPAY_KEY_SECRET`, `RAZORPAY_WEBHOOK_SECRET` (`billing.py:283/284`, webhook `1225`) — **without these, payments and webhooks are dead.**
- `CRON_SECRET_TOKEN` (`cron.py:27`) — **if empty, cron endpoints skip auth entirely** (`verify_cron_secret` returns early when `CRON_SECRET` is falsy). Anyone could trigger maintenance/downgrades.
- `WHATSAPP_*` (access token / phone id) — notifications dead if unset.
- `DATA_ENCRYPTION_KEY` (declared `sync:false`) — must be a real Fernet key; encrypted columns break if wrong.
- Confirm B2 secrets (`DATABASE_URL`, `B2_APPLICATION_KEY_ID`, `B2_APPLICATION_KEY`) are set as **GitHub Actions secrets** or backups silently no-op.

### P1 — Rotate the dev secrets that are committed to a shared repo
Not live keys, but real *values* sitting in git; never reuse in prod:
- `.env.local:28` `DATA_ENCRYPTION_KEY=1A9pNn...C44=`
- `.env.local:31` `JWT_SECRET_KEY=dev-secret-key-do-not-use-in-prod-abc123`
- `scripts/seed_dev.py:36` hardcoded `DATA_ENCRYPTION_KEY=JNIpD1...4LM=`
- Prior 21st.dev MCP API key (kept only in git-ignored `.mcp.json`) — **rotate it**, it was exposed earlier.
Prod uses `generateValue`/dashboard, so these don't reach prod — but treat them as burned.

---

## 4. TEST SUITE — REAL NUMBERS AND WHAT THE FAILURES ACTUALLY ARE

**Full suite (proper order, no `-k` filter): `1027 passed / 98 failed / 5 skipped / 1 xpassed` in 32 min** (SQLite, so the Postgres-RLS layer is inactive in tests — the app-layer scoping is what's under test).

I did **not** take 98 failures at face value. I ran the biggest clusters in isolation and classified them:

### 4.1 Shared-cookie test pollution (NOT product bugs)
`tests/conftest.py` `http_client` is a **single shared `httpx.Client`** whose cookie jar is mutated by `register_user` (`tests/utils.py:164` sets `auth_session` on the client). Many tests pass `headers=`/`cookies=` per-request, but httpx is *deprecating* per-request cookies and the ambient jar wins. Net effect: **later tests inherit the last-registered user's session.** Proof: `test_quality_intelligence_requires_auth` **FAILS in a mixed `-k` run but PASSES when run alone.** This explains the bulk of `*_requires_auth`, `test_factory_context`, `test_tenant_isolation`, and steel-module failures.

### 4.2 `test_cross_org_steel_isolation` — harness bug, product is safe
`_seed_stock(http_client, org1_headers, ...)` **ignores `org1_headers`** and posts with the ambient cookie (org2's, since org2 registered last). So it seeds into org2 and then asserts org2 shouldn't see it, a false "leak." The endpoint `/steel/inventory/stock` -> `_serialize_items_with_stock(db, factory_id=...)` filters by `factory_id` correctly (`steel.py:434`). **No real cross-tenant leak.**

### 4.3 `test_permission_enforcement.py` — 23 failures, real but NOT security holes
These fail even in isolation (not pollution). I classified all 23 by the *actual* status returned vs the 403 expected:
- **11 return 404**, 3 return 402, 3 return 422, 2 return 400 -> **access is still DENIED**, just with a different status code than the test hard-codes. 404-instead-of-403 is arguably *safer* (less info leak). These are **test-expectation drift**, not over-permissioning. (Matches FIX_GUIDE's noted "422-vs-403 ordering, lower priority.")
- **Only 4 return 200** (access actually granted where a block was expected): `test_punch_attendance_role_blocked`, `test_my_attendance_today_attendance_role_blocked` (= FIX_GUIDE **TRIAGE-02**: ATTENDANCE role self-serve, "almost certainly should" be allowed — business decision), `test_inventory_intelligence_operator_blocked`, `test_create_vendor_accountant_blocked` (permission-catalog role-set decisions). **These are documented business-decision items, not silent regressions.** Confirm the intended role matrix with the owner, then align test + catalog.

### 4.4 External-API-dependent failures
A few (`test_report_jobs`, table/Excel routes) fail with `TableExcelRouteError('Anthropic API request failed: Response ended prematurely')` — the test hit a **real Anthropic endpoint** and the network died. Environmental, not a code bug. Should be mocked in CI.

**Bottom line on tests:** No failure I investigated is a data-loss or cross-tenant security defect. The suite needs a harness fix (per-test isolated clients) plus an expectation refresh — tech debt, not a ship blocker.

---

## 5. CAN-WAIT (ship, then follow up)

| # | Item | Why it can wait | Where |
|---|------|-----------------|-------|
| 5.1 | **Branding leak: "DPR.ai" visible to clients** | Cosmetic, but *will* be noticed. 58 occurrences in `web/src/app`. Worst: login page ("New to DPR.ai?"), and the **entire public security-disclosure page** references non-existent `app.dpr.ai`, `api.dpr.ai`, `security@dpr.ai`. Also EULA "Ownership. DPR.ai retains...", a page `<title>`, offline page "DPR Entry", dashboard card "DPR.ai Web Frontend". | `web/src/app/(public)/disclosure`, `/eula`, `/access` |
| 5.2 | **`admin_secret` query-param bypass (latent)** | `require_superadmin` (`admin_billing.py:35`) allows `?admin_secret=<ADMIN_API_KEY>` as an alt to `is_platform_admin`. **Inert today** (`ADMIN_API_KEY` unset). If ever set: any authenticated user knowing it gets superadmin billing, and the secret lands in URLs/access logs. Remove the bypass or never set the var. | `backend/routers/admin_billing.py:35` (4 endpoints) |
| 5.3 | **In-process daemon-thread schedulers** | attendance-absence/auto-close/approval-expiry/email run as threads in the web process. Fine on 1 instance, but they **stop when the instance sleeps** (free/starter cold-start) and **double-run if scaled >1**. Move to a real scheduler eventually. | `backend/main.py` ~250 |
| 5.4 | **Sentry and metrics DISABLED in prod** | `/observability/ready` shows `sentry:disabled, metrics:disabled`. You'll be blind on prod errors. Set `SENTRY_DSN`. | render.yaml `sync:false` |
| 5.5 | **Render free-tier DB + cold starts** | `factorynerve-db` is `plan: free` (no Render-managed PITR — you rely on the B2 dumps in 2.5). Web/worker are `starter` -> sleep when idle -> slow first request. Upgrade DB before real load. | `render.yaml:22` |
| 5.6 | **CI mypy is `continue-on-error: true`** | Type errors don't block deploy (`quality-gate.yml:60`). Intentional debt-burndown, fine for now. | `.github/workflows/quality-gate.yml` |
| 5.7 | **3 TypeScript errors** | All in **untracked WIP** `web/src/features/ocr/components/ocr-editor/` (imports a non-existent `@/components/ocr-scan/types`; the dir is an unzipped `ocr-editor.zip`). Nothing committed imports it. Committed frontend is TS-clean. Delete the WIP folder or finish it. | untracked |
| 5.8 | **14 OCR "mock" downstream-action handlers** | e.g. `create_purchase_order_in_erp` returns `{"po_id":"mock_po_123"}`. I traced them: **never executed** by any endpoint and **not rendered** by any React component (only typed in `web/src/lib/ocr.ts`, no `.tsx` consumer). Dormant, not client-visible. Safe to leave, but don't wire the UI to them until real. | `backend/services/ocr_document_types/__init__.py` |
| 5.9 | **Repo housekeeping** | No `LICENSE`. ~8 tracked root scratch scripts (`_fix_auth.py`, `_fix_steel_race.py`, `_write_tokens.py`, `generate_tokens.py`, `fix_admin.py`, `apply_repair_migration.py`, `bedrock_proxy.py`, `run.py`) — I checked, **no secrets in them**, but clutter. `git remote` is a placeholder `gitlab.com/yourname/factorynerve.git`. `free-claude-code/` (unrelated 3rd-party MIT tool, see handoff) has 3 tracked `.sh` files and pollutes pytest collection. | repo root |

---

## 6. RANKED RISK SUMMARY (the "what will they see / lose money on" list)

1. **P0 — Downgrades never apply** -> churned/failed-payment customers keep paid access forever. *(section 3)*
2. **P1 — Razorpay/CRON/WhatsApp secrets not in render.yaml** -> payments, cron, notifications dead on launch unless set in dashboard. *(section 3)*
3. **P1 — `CRON_SECRET_TOKEN` empty -> cron endpoints open** -> anyone can trigger maintenance. *(section 3)*
4. **Branding: DPR.ai on login + legal pages** -> looks unfinished/confusing; legal pages cite dead domains. *(5.1)*
5. **Sentry/metrics off** -> no prod error visibility. *(5.4)*
6. **Free-tier DB + cold starts** -> slow first load, weaker DB durability guarantees. *(5.5)*
7. **`admin_secret` latent bypass** -> footgun if `ADMIN_API_KEY` ever set. *(5.2)*

**Not on this list (verified NOT problems):** cross-tenant data leakage, webhook double-charging, the 7 historic crash bugs, missing backups, live-secret exposure. All handled.

---

## 7. RECOMMENDED LAUNCH SEQUENCE
1. Fix P0 (schedule `/cron/daily-maintenance`) and set `CRON_SECRET_TOKEN`.
2. Set all P1 secrets in Render, then verify a real Razorpay test-mode payment end to end (create order -> pay -> webhook activates -> refund/cancel -> downgrade applies on next cron).
3. Rotate the burned dev secrets (section 3).
4. Global find/replace **DPR.ai -> FactoryNerve** across `web/src/app` (58 hits); fix the disclosure/EULA domains and support email.
5. Set `SENTRY_DSN`. Upgrade `factorynerve-db` off free tier.
6. Delete the untracked `ocr-editor/` WIP (or fix its import) to clear the 3 TS errors.
7. Ship. Then burn down: test-harness isolation, permission-matrix decisions (TRIAGE-02 etc.), scheduler -> external cron, repo housekeeping.

*End of report. Companion: `INTERNAL_HANDOFF_NOTES.md`.*
