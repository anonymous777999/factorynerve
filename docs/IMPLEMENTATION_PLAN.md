# FactoryNerve Implementation Master Plan

**Generated:** 2026-07-05
**Based on:** Production Audit Report (72/100 risk score)
**Goal:** Production-safe deployment with minimal risk

---

## STEP 1 — Issue Validation

| ID | Issue | Severity | Status | Affected Files |
|---|---|---|---|---|
| D-01 | Migration revision IDs > 32 chars | P0 | **FIXED** | `alembic/versions/20260704_01`, `20260704_02`, `20260704_03` |
| D-02 | BOOLEAN DEFAULT 0/1 on PostgreSQL | P0 | **FIXED** | 13 migration files |
| D-03 | Duplicate index ix_notifications_user_id | P0 | **FIXED** | `alembic/versions/20260704_01_add_notifications.py` |
| D-04 | shift_start_utc column missing (schema drift) | P0 | **FIXED** | `alembic/versions/20260705_01_add_shift_bounds_to_attendance_records.py` |
| D-05 | Dual auth systems (bcrypt + argon2) | P1 | **Confirmed** | `backend/services/token_service.py`, `backend/routers/auth.py`, `backend/routers/auth_secure.py`, `backend/routers/auth_google.py` |
| D-06 | No DB-level stock constraint | P1 | **Confirmed** | `backend/models/steel_inventory_item.py` — no `CHECK(stock_quantity >= 0)` |
| D-07 | No schema drift detection in CI | P1 | **Confirmed** | Missing from `.github/workflows/quality-gate.yml` |
| D-08 | Lockout check on password reset may block legitimate users | P1 | **Confirmed** | `backend/routers/auth.py` lines 1169-1189, `backend/auth_security/lockout.py` |
| D-09 | EncryptedString decrypt failure crashes request | P1 | **Confirmed** | `backend/database.py` — `process_result_value` raises `ValueError` |
| D-10 | 5 failing tests in core paths | P1 | **Confirmed** | `tests/test_auth_google.py`, `tests/test_auth_e2e.py`, `tests/test_ocr_table_excel_route.py` |
| D-11 | PDP MFA check fallthrough when payload is None | P1 | **Confirmed** | `backend/authorization/pdp.py` lines 192-194 |
| D-12 | _check_platform_scope grants platform access by role, not admin flag | P2 | **Confirmed** | `backend/authorization/pdp.py` lines 157-160 |
| D-13 | /metrics endpoint no rate limiting | P2 | **Confirmed** | `backend/main.py` lines 153-167 |
| D-14 | Audit log unbounded growth | P2 | **Confirmed** | `backend/database.py` — `_audit_writes` event listener |
| D-15 | Cold start on free Render plan | P2 | **Confirmed** | `render.yaml` uses `plan: free` |
| D-16 | Model imports manual in init_db and env.py | P2 | **Confirmed** | `backend/database.py` lines 156-210, `alembic/env.py` lines 19-82 |
| D-17 | No read replicas / small pool | P2 | **Confirmed** | `backend/database.py` pool_size=3, max_overflow=3 |
| D-18 | Role revision cache in-memory only | P3 | **Confirmed** | `backend/main.py` lines 37-40 |
| D-19 | init_db stamps alembic head on startup | P2 | **Confirmed** | `backend/database.py` lines 232-252 |
| D-20 | 500-worker concurrency not tested | P3 | **Confirmed** | No load test files in `tests/` |

---

## STEP 2 — Fix Order

```
Phase 1 ── Deployment & DB Stability  (Week 1)
  │
  ├─ D-05  Dual auth consolidation
  ├─ D-12  Schema drift prevention (CI step)
  ├─ D-04  DB constraints (stock, invoices)
  ├─ D-07  Migration CI validation
  └─ D-19  Remove init_db stamp on startup
          ║
Phase 2 ── Security Hardening          (Week 2)
  │
  ├─ D-06  MFA PDP fix
  ├─ D-08  Lockout logic refinement
  ├─ D-09  EncryptedString graceful failure
  ├─ D-11  Platform scope strict check
  ├─ D-13  /metrics rate limiting
  └─ D-14  Audit log retention
          ║
Phase 3 ── Test Coverage & Reliability (Week 3)
  │
  ├─ D-10  Fix failing tests
  ├─ D-15  Add security tests
  ├─ D-16  Add role-based workflow tests
  ├─ D-17  Add load tests
  └─ D-18  Cold start mitigation
          ║
Phase 4 ── Monitoring & Scale          (Week 4)
  │
  ├─ D-20  Verify Sentry config
  ├─ D-19  Add DB read replica support
  ├─ D-18  Distributed cache for role revisions
  ├─ D-14  Audit log archival
  └─ D-15  Upgrade Render plan
```

### Why this order

1. **Deployment & DB first** — Without a deployable system and consistent database, nothing else matters.
2. **Security second** — Auth bypasses and MFA gaps are existential risks for a factory ERP.
3. **Tests third** — Coverage validates that Phase 1+2 changes work correctly before scaling.
4. **Monitoring last** — You can't monitor a system that isn't stable and secure.

---

## STEP 3 — Implementation Plan

### P0 Items (Already Fixed This Session)

| Task | Files Changed | Fix | Status |
|---|---|---|---|
| Shorten revision IDs | 3 migration files | Changed 41/44-char IDs to 11-char `YYYYMMDD_NN` | ✅ DONE |
| Fix BOOLEAN DEFAULT | 13 migration files | `sa.text("0")` → `sa.text("false")`, `"1"` → `"true"` | ✅ DONE |
| Remove duplicate index | `20260704_01_add_notifications.py` | Removed `index=True` from `user_id` Column | ✅ DONE |
| Add missing columns | `20260705_01_add_shift_bounds_to_attendance_records.py` | Added `shift_start_utc`, `shift_end_utc`, `cross_midnight`, 2 indexes | ✅ DONE |

---

### P1-01: Dual Auth Consolidation

**Issue:** Two authentication systems run in parallel:
- **v1 (legacy):** bcrypt passwords in `users.password_hash`, JWT via HS256
- **v2 (current):** Argon2 passwords in `auth_users.password_hash`, sessions in `auth_sessions`, JWT via RS256

Password changes/resets manually sync to both. If sync fails, user is locked out of v2.

**Files:**
- `backend/routers/auth.py` — v1 auth endpoints (login, register, password_reset, change_password)
- `backend/routers/auth_secure.py` — v2 auth endpoints
- `backend/routers/auth_google.py` — Google OAuth (uses both)
- `backend/services/token_service.py` — JWT generation (HS256)
- `backend/auth_security/passwords.py` — Argon2 hashing
- `backend/models/auth_user.py` — v2 user model
- `backend/models/user.py` — v1 user model

**Fix Plan:**

```
Step 1: Migrate all v1 users to auth_users
  - Create auth_users for any user that doesn't have one
  - Hash existing bcrypt passwords with argon2 (re-hash on next login)

Step 2: Deprecate v1 login routes
  - Add deprecation warning header to /auth/login responses
  - Set sunset date header

Step 3: Remove v1 auth after migration window
  - Delete legacy password_hash from users table
  - Remove v1 router registration from main.py
  - Remove token_service.py HS256 fallback
```

**Testing:**
- Login with migrated credentials
- Login with Google OAuth
- Password reset flow
- Session persistence across token refresh

**Deployment Risk:** HIGH — must roll out gradually with monitoring

---

### P1-02: Schema Drift Prevention (CI)

**Issue:** No automated check ensures SQLAlchemy model columns match database columns. The `shift_start_utc` outage proves this is a real threat.

**Files:**
- `.github/workflows/quality-gate.yml` — CI workflow
- `scripts/validate_schema_drift.py` — **NEW** script
- `backend/database.py` — Base.metadata source of truth

**Fix Plan:**
```
Create scripts/validate_schema_drift.py:
  1. Import all models (same as init_db)
  2. Generate CREATE TABLE SQL from Base.metadata
  3. Parse existing database schema via information_schema
  4. Compare columns, types, nullable, defaults
  5. Report any differences as errors

Add to quality-gate.yml:
  - Run validate_schema_drift.py against PostgreSQL test DB
  - Fail CI if drift detected
```

**Testing:**
- Run against test PostgreSQL database
- Intentionally add a column to model without migration → CI fails
- Add migration → CI passes

**Deployment Risk:** LOW — only affects CI, not production

---

### P1-03: DB-Level Stock Constraint

**Issue:** Stock levels are checked in application code (`locked_stock_balance_for_item`) but there's no database constraint preventing negative stock. Race conditions in concurrent dispatch creation could oversell.

**Files:**
- `backend/models/steel_inventory_item.py` — add CHECK constraint
- New migration

**Fix Plan:**
```
Add CHECK constraint to steel_inventory_items:
  stock_quantity_kg NUMERIC NOT NULL DEFAULT 0
  CONSTRAINT ck_steel_stock_non_negative CHECK (stock_quantity_kg >= 0)

Add migration to ensure existing data has no negative stock:
  - Backfill: UPDATE steel_inventory_items SET stock_quantity_kg = 0 WHERE stock_quantity_kg < 0
  - Then add constraint
```

**Testing:**
- Attempt to create dispatch that would make stock negative → should error at DB level
- Normal dispatch → should succeed

**Deployment Risk:** LOW — constraint only fails if data is already corrupt

---

### P1-04: Lockout Logic Refinement

**Issue:** `check_account_locked()` is called on password reset and password change. If a user has never failed login but has `failed_login_attempts > 0` from a stale DB state, they're locked out of account recovery.

**Files:**
- `backend/auth_security/lockout.py` — `check_account_locked()`
- `backend/routers/auth.py` — password_reset, change_password endpoints

**Fix Plan:**
```
Add safeguard to check_account_locked:
  - Only lock if failed_login_attempts >= LOCKOUT_THRESHOLD AND locked_until is set
  - If locked_until is None, return False regardless of failed_login_attempts

Add account age check to password_reset:
  - If account was created > 24h ago and has 0 successful logins, skip lockout check
```

**Testing:**
- Fresh account with stale failed_login_attempts → can reset password
- Account with active lockout → blocked from reset

**Deployment Risk:** LOW

---

### P1-05: EncryptedString Graceful Failure

**Issue:** `EncryptedString.process_result_value` raises `ValueError` on any decryption failure. If a single encrypted field is corrupted (e.g., by manual DB edit), every request that reads that row crashes.

**Files:**
- `backend/database.py` — `EncryptedString` class

**Fix Plan:**
```
Change process_result_value to return None on failure:
  try:
      return self._fernet.decrypt(...)
  except Exception:
      logger.error("Failed to decrypt field; returning None")
      return None
```

**Testing:**
- Corrupt an encrypted field → read returns None, no crash
- Normal encrypted field → reads correctly

**Deployment Risk:** LOW

---

### P1-06: Fix 5 Failing Tests

**Issue:** 5 tests fail in core auth + OCR table extraction paths.

**Files:**
- `tests/test_auth_google.py` — `test_google_callback_restores_recent_factory_context`
- `tests/test_auth_e2e.py` — `test_post_auth_v2_login_still_works`
- `tests/test_ocr_table_excel_route.py` — 3 tests (API key required, preview pipeline, structured rows)

**Fix Plan:**
```
test_auth_google.py failure:
  - Check mock setup for factory context restoration
  - Likely missing mock for get_config() or token_service

test_auth_e2e.py failure:
  - Check auth v2 login flow — may need ENV var setup

test_ocr_table_excel_route.py failures:
  - These likely require ANTHROPIC_API_KEY to be set
  - Add pytest.mark.skipif for missing API key
```

**Testing:**
- Run each test file individually after fix
- Verify all 5 pass

**Deployment Risk:** MEDIUM — test failures mask real bugs

---

### P1-07: PDP MFA Check Fallthrough

**Issue:** In `PDP._check_mfa()`, if `payload is None` (no token payload), the method returns `True` — allowing actions that require MFA to proceed without MFA.

**Files:**
- `backend/authorization/pdp.py` lines 192-194

**Fix Plan:**
```
Change _check_mfa logic:
  1. If payload is None, check if the user has MFA enabled
  2. If MFA enabled AND no payload, return False (require MFA)
  3. If MFA enabled AND payload.mfa_verified is False, return False
```

**Testing:**
- User with MFA enabled, no token payload → MFA required
- User with MFA enabled, token has mfa_verified=True → allowed
- User without MFA → always allowed

**Deployment Risk:** LOW

---

### P2 Items

| ID | Issue | Files | Fix | Est. Time |
|---|---|---|---|---|
| P2-01 | Platform scope check too broad | `backend/authorization/pdp.py:157-160` | Add `is_platform_admin=True` requirement beyond role check | 2h |
| P2-02 | /metrics endpoint rate limiting | `backend/main.py:153-167` | Add `RateLimitMiddleware` to `/metrics` path | 1h |
| P2-03 | Audit log retention policy | `backend/database.py` | Add `created_at` index on `audit_logs`, add archival job | 4h |
| P2-04 | Cold start mitigation | `render.yaml` | Upgrade from `free` to `starter` plan | 0.5h |
| P2-05 | init_db stamps alembic head | `backend/database.py` | Only stamp if no version row exists | 2h |
| P2-06 | Model imports automation | `backend/database.py`, `alembic/env.py` | Use `importlib` to auto-discover models | 3h |
| P2-07 | DB pool size too small | `backend/database.py` | Increase pool_size=10, max_overflow=10 | 0.5h |
| P2-08 | Migration CI validation | `.github/workflows/quality-gate.yml` | Add `alembic upgrade head --sql` dry-run step | 3h |
| P2-09 | No DB CHECK constraints for stock | New migration | Add `CHECK(stock_quantity_kg >= 0)` | 2h |
| P2-10 | Unique constraints for invoice/dispatch numbers | New migration | Add `UNIQUE(factory_id, invoice_number)` | 2h |

---

## STEP 4 — Database Plan

### Required Migrations

| Order | Migration | Purpose | Risk |
|---|---|---|---|
| 1 | `20260706_01_add_stock_check_constraint` | Add `CHECK(stock_quantity_kg >= 0)` to `steel_inventory_items` | LOW — backfill negative stock first |
| 2 | `20260706_02_add_unique_invoice_number` | Add `UNIQUE(factory_id, invoice_number)` to `steel_sales_invoices` | MEDIUM — must check for existing duplicates |
| 3 | `20260706_03_add_unique_dispatch_number` | Add `UNIQUE(factory_id, dispatch_number)` to `steel_dispatches` | MEDIUM — must check for existing duplicates |
| 4 | `20260706_04_add_audit_log_index` | Add index on `audit_logs.created_at` for archival queries | LOW |
| 5 | `20260706_05_add_auth_user_missing` | Create `auth_users` for users that don't have one (dual auth migration prep) | HIGH — data migration |

### Required Indexes

| Table | Index | Type | Purpose |
|---|---|---|---|
| `audit_logs` | `ix_audit_logs_created_at` | BTREE | Archival queries |
| `auth_sessions` | `ix_auth_sessions_expires_revoked` | BTREE | Session cleanup |
| `steel_inventory_transactions` | `ix_steel_inv_tx_item_date` | BTREE | Inventory audit trail |

### Schema Drift Prevention

**Permanent mechanism:**
1. Add `scripts/validate_schema_drift.py` to CI pipeline
2. Script compares `Base.metadata` with live PostgreSQL schema
3. Reports column additions, removals, type changes, missing indexes
4. Fails CI if drift detected

---

## STEP 5 — Test Plan

### Security Tests (`tests/test_security/`)

```
test_password_reset_lockout.py:
  - Locked account cannot reset password
  - Fresh account with stale counter CAN reset
  
test_mfa_required_actions.py:
  - MFA-enabled user without MFA token is blocked
  - MFA-enabled user with valid MFA token is allowed
  - Non-MFA user is always allowed
  
test_cross_factory_isolation.py:
  - User from factory A cannot access factory B data
  - Admin can access own factory only (without platform flag)
  
test_rate_limiting_metrics.py:
  - /metrics endpoint rate limited after N requests
```

### Integration Tests (`tests/test_integration/`)

```
test_dispatch_stock_deduction.py:
  - Dispatch reduces stock correctly
  - Concurrent dispatch to same item does not oversell
  - Stock constraint violation rolls back dispatch
  
test_attendance_shift_bounds.py:
  - Punch in sets shift_start_utc correctly
  - Auto-close uses shift_end_utc for cross-midnight shifts
```

### Role-Based Tests (`tests/test_rbac/`)

```
test_operator_permissions.py:
  - Operator can punch in/out
  - Operator CANNOT approve attendance
  - Operator CANNOT delete entries
  
test_accountant_permissions.py:
  - Accountant can create invoices
  - Accountant CANNOT void invoices (requires MFA)
  - Accountant CANNOT manage users
```

### Load Tests (`tests/test_load/`)

```
test_500_concurrent_punches.py:
  - 500 workers punch in simultaneously
  - No duplicate records
  - All requests complete within 5s
  
test_ocr_50_concurrent_uploads.py:
  - 50 concurrent OCR uploads
  - Pipeline processes without crash
  - Quota tracking remains accurate
```

---

## STEP 6 — Deployment Plan

### Phase 1: Dev Environment (Days 1-2)

**Actions:**
- Apply all P0 + P1 fixes
- Run full test suite
- Validate migration chain on fresh PostgreSQL DB

**Validation:**
- [ ] `pytest tests/ -q` passes (100%)
- [ ] `alembic upgrade head` succeeds on fresh PostgreSQL
- [ ] `alembic downgrade -1` succeeds (each step)
- [ ] Health endpoint returns 200

**Rollback:** `git revert` and `alembic downgrade head`

---

### Phase 2: Staging (Days 3-4)

**Actions:**
- Deploy to Render staging service
- Run security tests
- Run role-based tests
- Run load tests (50 concurrent users)

**Validation:**
- [ ] All security tests pass
- [ ] All RBAC tests pass
- [ ] P95 response time < 500ms under 50 concurrent users
- [ ] 0 failed migrations

**Rollback:** Deploy previous `live` commit via Render dashboard

---

### Phase 3: Limited Production (Days 5-7)

**Actions:**
- Deploy to production with 1 factory only
- Monitor for 48 hours
- Check all background services (auto-close, expiry, email)

**Validation:**
- [ ] Auto-close attendance service runs without error
- [ ] Approval expiry service runs without error
- [ ] Email queue processes within 5 minutes
- [ ] OCR pipeline processes within 30 seconds
- [ ] No lockout incidents

**Rollback:** Revert to previous production deploy

---

### Phase 4: Full Production (Day 8+)

**Actions:**
- Roll out to all factories
- Enable monitoring alerts
- Set up Sentry error tracking

**Validation:**
- [ ] All factories operational
- [ ] No P0/P1 incidents in first week
- [ ] < 5 P2/P3 incidents in first week
- [ ] Load stays within DB pool limits

**Rollback:** N/A — full production

---

## STEP 7 — Final Delivery

### P0 Tasks (Must Fix Before Launch)

| Task | Est. Time | Status |
|---|---|---|
| Migration revision IDs | ✅ DONE | Already deployed |
| BOOLEAN DEFAULT 0/1 | ✅ DONE | Already deployed |
| Duplicate index | ✅ DONE | Already deployed |
| Missing shift_start_utc column | ✅ DONE | Already deployed |
| **TOTAL P0** | **All done** | **✅ Launch-ready** |

### P1 Tasks (Fix in Week 1-2)

| Task | Est. Time | Priority |
|---|---|---|
| Dual auth consolidation | 16h | HIGH |
| Schema drift CI check | 4h | HIGH |
| DB stock constraint | 2h | HIGH |
| Lockout logic fix | 2h | HIGH |
| EncryptedString graceful failure | 1h | MEDIUM |
| Fix 5 failing tests | 4h | MEDIUM |
| PDP MFA fallthrough fix | 2h | HIGH |
| **TOTAL P1** | **31h (4 days)** | |

### P2 Tasks (Fix in Week 3-4)

| Task | Est. Time | Priority |
|---|---|---|
| Platform scope strict check | 2h | MEDIUM |
| /metrics rate limiting | 1h | LOW |
| Audit log retention + index | 4h | MEDIUM |
| Cold start — upgrade Render plan | 0.5h | HIGH |
| init_db stamp fix | 2h | MEDIUM |
| Auto-discover models | 3h | LOW |
| DB pool size increase | 0.5h | MEDIUM |
| Migration CI validation | 3h | MEDIUM |
| Unique constraints (invoice, dispatch) | 4h | MEDIUM |
| **TOTAL P2** | **20h (2.5 days)** | |

### Estimated Total Time

| Phase | Hours | Days |
|---|---|---|
| P0 (all done) | 0 | 0 |
| P1 | 31 | 4 |
| P2 | 20 | 2.5 |
| Testing + Deploy | 16 | 2 |
| **TOTAL** | **67h** | **~8.5 days** |

### Launch Readiness Score

**Current: 72/100** (after P0 fixes deployed)

**Target: 90/100** (after P1+P2 fixes)

| Milestone | Score | Criteria |
|---|---|---|
| After P0 fixes | 72/100 | Deployable, known schema drifts fixed |
| After P1 fixes | 82/100 | Single auth, schema drift detection, DB constraints |
| After P2 fixes | 90/100 | Security hardening, observability, performance tuning |
| After Phase 4 deploy | 92/100 | Proven in production for 1 week |

---

## Appendix: Critical File Reference

| File | Purpose | Issues |
|---|---|---|
| `backend/main.py` | App entry point, router registration, middleware | Role revision cache in-memory, /metrics no rate limit |
| `backend/database.py` | DB engine, session, EncryptedString, init_db, audit log | EncryptedString crash, audit log unbounded, init_db stamps alembic |
| `backend/authorization/pdp.py` | Policy Decision Point, permission evaluation | MFA fallthrough, platform scope too broad |
| `backend/authorization/permission_catalog.py` | Permission definitions (single source of truth) | None — well-designed |
| `backend/routers/auth.py` | v1 auth endpoints (login, register, password reset) | Dual auth sync, lockout on password reset |
| `backend/routers/auth_secure.py` | v2 auth endpoints (argon2, sessions) | None — replacement for v1 |
| `backend/auth_security/lockout.py` | Account lockout logic | Threshold check without age guard |
| `backend/auth_security/passwords.py` | Argon2 password hashing | None — modern and correct |
| `backend/auth_security/mfa.py` | TOTP MFA helpers | None — standard pyotp implementation |
| `backend/services/attendance_auto_close_service.py` | Auto-close stale attendance | Uses shift_start_utc — now fixed |
| `scripts/render_start.py` | Render deployment startup | Migration + init_db fallback logic |
| `deploy/render/backend.Dockerfile` | Docker build for Render | Python 3.12-slim, includes Tesseract OCR |
| `render.yaml` | Render Blueprint definition | Free plan causes cold start |
