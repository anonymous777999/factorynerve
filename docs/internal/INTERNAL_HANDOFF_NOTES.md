# FactoryNerve — Internal Handoff Notes (tribal knowledge)

**Date:** 2026-07-19
**Purpose:** The stuff that isn't obvious from reading the code cold. Written for future-me / the next engineer. Companion to `PROJECT_READINESS_REPORT.md` (that one is the ranked go/no-go; this one is "why is it like this").

---

## 1. Naming: DPR.ai vs FactoryNerve
Same product, two names. **FactoryNerve is the live public brand**; **DPR.ai is the legacy/internal name.** They are used interchangeably in code:
- Public site, Render services (`factorynerve-api`, `factorynerve-db`), and most UI say **FactoryNerve**.
- 58 leftover **DPR.ai** strings still leak into user-facing pages (`web/src/app` — login prompt, EULA, security-disclosure page with dead `app.dpr.ai`/`api.dpr.ai`/`security@dpr.ai` domains). See report section 5.1. These are the only ones a client would actually see.
- Backend logs, scripts, and code comments freely say "DPR". Don't be alarmed — it's the same thing.

## 2. Dual authentication — how it actually resolves
There are **three** auth-related routers and **two** auth generations. This confuses everyone at first.

**Modern (canonical, use this):** `backend/routers/auth_secure.py`
- Mounted at **three** prefixes in `backend/main.py:330-332`: `/auth`, `/auth-secure`, `/auth/v2` (all the same router — the `/auth` prefix is the canonical one clients use).
- Session-cookie based: cookie name `auth_session` (`AUTH_SESSION_COOKIE`), backed by the `auth_sessions` / `auth_users` tables (`backend/auth_security/sessions.py`).
- Features: bcrypt/argon2 hashing, email verification, MFA, CSRF (`AUTH_CSRF_*`), rate limiting, lockout.

**Legacy (deprecated, demoted):** `backend/routers/auth.py`
- Mounted at **`/auth-legacy`** (`main.py:333`). Old JWT-cookie generation. `log_deprecated_auth_route_warning()` fires; the legacy JWT refresh endpoint is explicitly deprecated (`auth.py:1542`).
- Still present for transition/back-compat and because some registration/lookup helpers reference legacy workspace rows. Do not build new things on it.

**Google + phone:** `auth_google.py` and `phone_auth.py`, both mounted under `/auth`.

**The single source of truth for "who is this request":** `backend/security.py` `get_current_user`.
- It calls `get_current_session` (imported as `get_v2_session`) + `get_current_user` from `auth_security.sessions` (imported as `get_user_from_session`).
- It also derives `active_factory_id` from the session (validated against `UserFactoryRole`) and **sets the Postgres RLS GUCs** (`app.current_org_id`/`user_id`/`factory_id`) via `set_rls_context`. **This function is the linchpin of tenant isolation** — 43 routers depend on it. Touch it with extreme care.

## 3. Tenant isolation is TWO layers (don't remove either)
1. **App-layer:** every tenant query filters by session-derived `org_id`/`factory_id`; cross-tenant returns 404.
2. **DB-layer:** Postgres RLS with `FORCE ROW LEVEL SECURITY` on 56 tables (migration `20260707_01_enable_row_level_security.py`), driven by the GUCs set in `get_current_user`.
**Consequence for tests:** tests run on **SQLite**, where RLS is a no-op. So the test suite only exercises layer 1. In prod, layer 2 is a hard backstop. If you ever see a test "prove" a leak, check whether it's a harness bug before panicking (it was, every time — see report 4.2). If you add a new tenant table, **add it to the RLS migration's Tier 1/Tier 2 list**, or it's protected by layer 1 only.

## 4. What `free-claude-code/` is (and why pytest looked broken)
- `free-claude-code/` is an **unrelated third-party open-source project** (MIT-licensed LLM API proxy by GitHub user Alishahryar1 — "Use Claude Code CLI through your own provider"). It has **nothing to do with FactoryNerve.** Someone dropped/cloned it into the repo root.
- Only 3 of its files are git-tracked (`scripts/ci.sh`, `install.sh`, `uninstall.sh`); the rest is untracked.
- **It is the sole cause of the "43 pytest collection errors."** Its broken `conftest`/`config/settings.py` (has a `NameError: name 'Settings' is not defined`) breaks collection *only* if you run pytest from the repo root without `testpaths`. Running `pytest tests` (the real suite) collects **~1,130 tests cleanly**. Recommendation: delete the folder, or add `testpaths = tests` to a `pytest.ini` so collection never wanders into it.

## 5. Running the tests (gotchas)
- **Real command:** `.venv/Scripts/python.exe -m pytest tests -o addopts="" -q -p no:cacheprovider` from `D:\DPR APP\DPR.ai`. Note it's **`tests`**, not `backend/tests` (that dir doesn't exist — I wasted a run on it).
- Full suite is **~32 minutes** (SQLite, in-process, lots of alembic upgrades in setup).
- **Do NOT use `-x`** for a health check — it stops at first failure and hides the counts.
- **Shared-client cookie pollution is real:** `tests/conftest.py` `http_client` is one shared `httpx.Client`; `register_user` (`tests/utils.py:164`) mutates its cookie jar. Per-request `headers=`/`cookies=` are being deprecated by httpx and the ambient jar wins, so **test order changes results.** Many "failures" in a filtered `-k` run pass when run alone. The proper fix is a per-test client fixture. Current baseline in correct order: **1027 passed / 98 failed**.
- Some tests hit **real external APIs** (Anthropic) and fail on network flakiness (`TableExcelRouteError('Anthropic ... Response ended prematurely')`). Mock them.

## 6. Deployment topology
- **Web (public):** Vercel, `www.factorynerve.online`. Next.js. Reaches the API via a **rewrite** in `web/next.config.ts`: `/api/:path*` -> `${backendOrigin}/:path*` (strips `/api`). On Vercel the default origin is hardcoded `https://factorynerve-api-6ttl.onrender.com` (note the `-6ttl` suffix — the bare `factorynerve-api.onrender.com` is a *different, dead* host; I probed the wrong one at first and got 404s everywhere).
- **API + worker + DB:** Render, blueprint in `render.yaml`. `type: web` = `factorynerve-api` (starter), `type: worker` = `factorynerve-rq-worker` (starter, runs `rq worker dpr:email dpr:attendance dpr:approval dpr:feedback dpr:whatsapp`), `factorynerve-db` (Postgres, **free tier**).
- **Healthcheck:** `healthCheckPath: /observability/ready` -> returns JSON with `database`, `sentry`, `metrics` status.
- **Cold starts:** starter/free services sleep when idle. First request after idle is slow, and `uptime_seconds` resets to 0. Don't mistake that for a crash.

## 7. Schedulers / cron — the confusing part
Background jobs run **two** ways, and this matters for the P0 in the report:
- **In-process daemon threads**, started at boot in `backend/main.py` (~line 250): `initialize_attendance_absence_scheduler`, `initialize_attendance_auto_close_scheduler`, `initialize_approval_expiry_scheduler`, `start_email_processor`, `initialize_whatsapp_sender`. These run *inside the web process*. They stop if the instance sleeps and double-run if you scale to >1 instance.
- **HTTP cron endpoints** in `backend/routers/cron.py`, guarded by the `X-Cron-Secret` header (`CRON_SECRET_TOKEN` env). These are meant to be poked by an external scheduler — but **nothing currently pokes them.** `/cron/daily-maintenance` (which runs `apply_due_downgrades` — the plan-downgrade job) has **no trigger** in render.yaml or GitHub Actions. **This is the P0 revenue bug.** Also: if `CRON_SECRET_TOKEN` is empty, `verify_cron_secret` returns early and the endpoints are **open**.

## 8. Billing model quick map
- `backend/routers/billing.py` — Razorpay order creation (`POST /orders`, idempotent), webhook (`POST /webhook/razorpay`, sig-verified + `WebhookEvent`-idempotent + `FOR UPDATE`-locked + `was_paid`-guarded), and the missed-webhook fallback (`POST /orders/{id}/sync`).
- `backend/services/billing/lifecycle.py` — `process_payment_captured/failed/subscription_*` state machine.
- `backend/services/billing_manager.py` — `schedule_downgrade`, `cancel_scheduled_downgrade`, `apply_due_downgrades` (the one that never runs — see 7).
- `backend/routers/admin_billing.py` — superadmin billing views. **Has the `admin_secret` query-param bypass** (report 5.2): allows `?admin_secret=<ADMIN_API_KEY>` in addition to `is_platform_admin`. Inert while `ADMIN_API_KEY` is unset; a footgun if ever set (secret in URL/logs). Consider deleting the bypass.
- Grace period on failure/cancel = `BILLING_GRACE_DAYS` before the (currently un-applied) downgrade.

## 9. Secrets map (what lives where)
- **Committed but placeholder-only:** all tracked `.env*` files. Safe (test values), but the concrete `DATA_ENCRYPTION_KEY`/`JWT_SECRET_KEY` in `.env.local` and the hardcoded key in `scripts/seed_dev.py:36` are **burned** (public git history) — never reuse in prod.
- **Auto-generated in prod:** `JWT_SECRET_KEY`, `AUTH_RESET_SECRET`, `METRICS_TOKEN` via `generateValue: true` in render.yaml.
- **Manual in Render dashboard (`sync: false`):** `DATA_ENCRYPTION_KEY`, `REDIS_URL`, `SMTP_PASSWORD`, `RESEND_API_KEY`, `GOOGLE_CLIENT_*`, `GROQ/ANTHROPIC/GEMINI/OPENAI_API_KEY`, `SENTRY_DSN`.
- **Required by code but NOT in render.yaml at all** (must add manually or feature dies): `RAZORPAY_KEY_ID/KEY_SECRET/WEBHOOK_SECRET`, `CRON_SECRET_TOKEN`, `WHATSAPP_*`. See report P1.
- **GitHub Actions secrets** (for backups): `DATABASE_URL`, `B2_APPLICATION_KEY_ID`, `B2_APPLICATION_KEY`.
- **MCP key** (`21st_sk_...`): kept only in git-ignored `.mcp.json`. Was exposed earlier — rotate it.

## 10. Backups (the reassuring part)
Real and tested. `.github/workflows/db-backup.yml` = daily `pg_dump` -> Backblaze B2, 14-day retention. `.github/workflows/restore-test.yml` = actually restores a dump into a throwaway Postgres and checks table count. So even though `factorynerve-db` is free-tier (no Render PITR), you have proven offsite restores. `scripts/backup_db.py` is a **local-only dev script** — not the prod path; ignore it when reasoning about prod durability.

## 11. Loose ends worth a cleanup pass (none blocking)
- No `LICENSE` file at root.
- `git remote` is a placeholder `gitlab.com/yourname/factorynerve.git` — set the real one.
- ~8 tracked root scratch scripts (`_fix_*.py`, `*tokens*.py`, `fix_admin.py`, `apply_repair_migration.py`, `bedrock_proxy.py`, `run.py`). I checked — **no secrets** — but they're clutter; move to `scripts/` or delete.
- Untracked WIP `web/src/features/ocr/components/ocr-editor/` (an unzipped `ocr-editor.zip`) is the source of the 3 TS errors; nothing imports it.
- Many untracked scratch/log files at root (`server.log`, `val_*.log`, `_commit_msg*.txt`, `logs.json`, etc.) — never `git add .` blindly.

*End of handoff notes.*
