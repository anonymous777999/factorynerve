# FACTORYNERVE MASTER AUDIT REPORT
**Date:** June 26, 2026  
**Audit Type:** Full-stack Release Readiness & Survival Assessment  
**Project:** FactoryNerve — AI-native industrial OS / ERP for Indian factories

---

## EXECUTIVE VERDICT

**VALIDATION READY ONLY**

The product is structurally sound with strong fundamentals in authorization, data modeling, and workflow design. However, it is NOT production-ready and should NOT be shown to paying factory owners without first addressing critical reliability and maintainability issues.

---

## FINAL SCORE

**65 / 100**

---

## CATEGORY SCORES

| Category | Score | Trend |
|----------|-------|-------|
| Architecture | 7/10 | Clean structure with dangerous file bloat |
| Frontend | 6/10 | Modern stack, unknown UX completeness |
| Backend | 7/10 | Comprehensive but bloated |
| Database | 6/10 | Auto-migration is clever but fragile |
| Security | 7/10 | Strong foundations, HS256 concern |
| Workflows | 7/10 | Well-designed approval system |
| Authorization | 8/10 | Best-in-class PDP with catalog |
| Survival | 6/10 | Will survive weeks, not months |

**Weighted average: 6.5/10 = 65/100**

---

## TOP CRITICAL FAILURES

### 🔴 C1 — database.py is a ticking time bomb
**Severity: Critical**

The `init_db()` function and its 20+ `_ensure_*` helpers use raw SQL `ALTER TABLE` statements to repair schema drift at startup. This means:
- **Every startup does schema mutation** — if any ALTER TABLE fails (column already exists, type mismatch, constraint conflict), the entire app fails to start.
- **No rollback capability** — you cannot roll back a bad deployment. The schema is stateful and mutated imperatively.
- **Race condition on startup** — multiple worker processes could try to ALTER TABLE simultaneously in production (though pool_size=3 mitigates).
- **No versioned schema** — there is no way to know what schema version a database is on.

**Fix:** Move all schema changes to Alembic migrations. The `_ensure_*` drift repair should be a safety net, not the primary migration path.

```python
# ❌ Current: database.py has ~2000 lines of raw SQL migrations
# ✅ Fix: Each schema change = one Alembic migration file
```

---

### 🔴 C2 — ocr.py is 160,000+ characters in a single file
**Severity: Critical**

The OCR router (`backend/routers/ocr.py`) is approximately **160,000 characters** in a single file. This file contains:
- Multiple routing endpoints
- Anthropic API client logic
- Image processing utilities
- Excel generation
- Fallback logic
- Validation functions
- JSON normalization helpers

**This file will inevitably cause maintenance nightmares.** It is impossible to review, unit test, or refactor safely.

**Fix:** Split into at least 6-8 files:
- `routers/ocr.py` — only route definitions
- `services/ocr_anthropic.py` — Anthropic API calls
- `services/ocr_excel.py` — Excel generation
- `services/ocr_validation.py` — JSON validation
- `services/ocr_image.py` — Image processing
- `services/ocr_normalization.py` — Data normalization

---

### 🔴 C3 — Dual authentication system creates confusion and attack surface
**Severity: High**

The project has **two parallel auth systems**:
1. **Legacy:** JWT tokens (bcrypt passwords, `backend/security.py`)
2. **v2:** Cookie sessions (Argon2id passwords, `backend/auth_secure.py`)

Both systems are active simultaneously:
```
/auth/login → Legacy (returns JWT)
/auth/v2/login → v2 (sets cookies)
/auth-secure/login → v2 (behind ENABLE_AUTH_SECURE feature flag)
/auth/register → Legacy (creates User + PendingRegistration)
/auth/v2/register → v2 (creates AuthUser)
```

**Password sync** happens in multiple places (change_password, password_reset) but is not guaranteed. If one hash changes and the other doesn't, the user gets locked out of one auth path.

**Fix:** Deprecate and remove the legacy auth system. Route everything through v2. Remove the `ENABLE_AUTH_SECURE` feature flag.

---

### 🔴 C4 — In-memory state is lost on every restart
**Severity: High**

Critical operational state lives in-process memory and is **lost on any restart**:
1. **Rate limiting** — `request_timestamps` dict in middleware/security.py
2. **Login rate limiting** — `_login_attempts` dict in routers/auth.py
3. **Role revision cache** — `_ROLE_REVISION_CACHE` dict in main.py

This means:
- A restart resets all rate limiters (allowing brute force for a window)
- A restart resets login attempt tracking (allowing rapid retries)
- If you scale to multiple workers, each worker has its own disconnected state

**Fix:** Use Redis or the database for rate limiting and caching.

---

### 🔴 C5 — JWT uses HS256 (symmetric signing)
**Severity: High (for production)**

The JWT tokens are signed with `HS256` (HMAC with SHA-256), which uses the same secret for signing and verification. This means:
- Any service or microservice that can verify a token can also forge one
- The secret must be shared with every verifying service
- If the secret is leaked, all tokens can be forged

**Fix:** Migrate to RS256 (RSA-based asymmetric signing) so services can verify without being able to sign.

---

## TOP HIGH-RISK FAILURES

### 🟠 H1 — Broad exception catching throughout the codebase
**Risk: High | Prevalence: ~50+ locations**

The codebase extensively uses `except Exception:` and `except Exception as error:` with `logger.exception()` and `continue`. While this prevents crashes, it also **silently swallows critical failures**. Examples:
- database.py `_ensure_*` functions catch all exceptions and log
- OCR pipeline falls back silently on AI failures
- Auth registration catches `HTTPException` but also broad `Exception`

**Risk:** Silent data corruption or security bypass that goes undetected.

---

### 🟠 H2 — Schema drift repair cannot handle complex changes
**Risk: High**

The `_ensure_*` functions can only ADD columns. They cannot:
- Rename or drop columns
- Change column types
- Add foreign key constraints
- Handle data migrations (e.g., splitting a column)

This means any schema refactoring requires manual SQL, increasing deployment risk.

---

### 🟠 H3 — OCR pipeline has no circuit breaker for Anthropic API
**Risk: High**

The OCR pipeline calls the Anthropic API directly with no circuit breaker pattern. If the API starts returning 429s or 5xx errors:
- Every request will retry multiple models sequentially (up to 5 attempts)
- Each attempt waits for the full timeout (up to 120 seconds)
- A single OCR page could block a request for 10+ minutes
- No backpressure mechanism — all workers could be stuck on OCR retries

**Fix:** Implement a circuit breaker (e.g., using `pybreaker` or a custom state machine) with a cooldown period.

---

### 🟠 H4 — Permission catalog has duplicate keys at import time
**Risk: Medium**

```python
# permission_catalog.py — the code explicitly deduplicates
for k, v in PERMISSION_CATALOG.items():
    PERMISSION_CATALOG_UNIQUE[k] = v
PERMISSION_CATALOG = PERMISSION_CATALOG_UNIQUE
```

This means permissions like `reporting.insights.view` and `reporting.export.view` are **defined twice** in the catalog. The deduplication means the last one wins (by insertion order), but this is implicit and error-prone. If someone adds a new key that accidentally duplicates an existing one, there's no warning.

**Fix:** Add a `@unique` validator or use a dataclass that prevents duplicate keys. Add a startup-time assertion that checks for duplicates and crashes loudly.

---

### 🟠 H5 — No explicit offline/error states in critical web surfaces
**Risk: Medium**

For a mobile-first product targeting factory workers with potentially unreliable networks:
- No service worker with sophisticated offline caching
- No explicit "Offline" banners or stale data indicators visible in the explored files
- The PWA manifest exists but full offline capability isn't verified

---

## WHAT WILL BREAK FIRST?

### 1. Database startup failure (C1)

The most likely failure mode in production: a schema drift repair fails because a column already exists with incompatible types, or a Postgres-specific SQL statement runs on a slightly different version. The entire app fails to start with `RuntimeError("Could not initialize database.")`.

**Time to failure:** First deployment after any schema change.

### 2. OCR pipeline timeout cascade (H3)

Second most likely: 2-3 simultaneous OCR requests hit the Anthropic API during a timeout period. Each blocks a worker process. With pool_size=3 in the DB connection pool, all workers are stuck. New requests queue up. The app appears dead.

**Time to failure:** First busy day with 10+ OCR uploads.

### 3. Permission inconsistency (H4)

Someone adds a new permission key, accidentally duplicates an existing one, the deduplication silently picks the wrong definition, and a user gains or loses access to a feature unexpectedly.

**Time to failure:** Next time someone edits the permission catalog.

---

## CUSTOMER VALIDATION DECISION

**Can founder show this to factories for validation?**

### Answer: YES (with caveats)

**Why YES:** The product is genuinely impressive in scope and design. The authorization system is best-in-class for a startup. The approval workflows are well-designed. The OCR pipeline, while complex, shows serious investment. A factory demo would be compelling.

**Why WITH CAVEATS:**
- Only show the **demo environment**, not production
- Do NOT promise production deployment timelines
- Be transparent that it's still in validation/pre-production
- Highlight the workflow automation, not the infrastructure details
- Do NOT let them upload real OCR data during validation

---

## 1–2 MONTH SURVIVAL DECISION

**Can FactoryNerve survive 1–2 months of real use?**

### Answer: NO

The system would likely survive 2–3 weeks with active monitoring and manual intervention, but would fail before 2 months due to:

1. **OCR pipeline bloat** — the 160K-char file will cause at least one production incident as an edge case in the image processing or Anthropic call path is hit
2. **Database drift issue** — at least one startup will fail, causing downtime
3. **No circuit breaker** — the Anthropic API will eventually rate-limit, causing cascading failures
4. **In-memory state loss** — any restart resets rate limiting, allowing abuse windows
5. **No graceful degradation** — if OCR is down, the app should still function for entry/attendance/reporting, but the tight coupling may prevent this

**With the following minimal fixes, survival becomes likely:**
- Split ocr.py (C2)
- Add circuit breaker for AI APIs (H3)
- Move rate limiting to DB/Redis (C4)
- Add startup health checks with graceful degradation

---

## BRUTAL HONEST OPINION

**If you were a factory owner, would you trust this product with real operations today?**

### Answer: NO

**Why:**

If I were a factory owner, I would be impressed by the demo but terrified by the fragility. My factory runs on real production data — attendance determines payroll, inventory affects procurement, dispatch affects customer commitments. If the system goes down mid-shift, I have 50 workers standing around and angry customers.

The product has **too many unknown unknowns**: the massive OCR file that hasn't been split, the database that repairs itself at startup, the dual auth system that could lock users out, the in-memory rate limiters that reset on restart. I need a system that I can trust will work every single morning at 6 AM when the first shift starts.

**What would make me say YES:**
1. Show me the system has been running for 30+ days without manual intervention
2. Show me what happens when the internet goes down (offline mode)
3. Show me what happens when OCR fails (graceful degradation)
4. Show me that my data can be recovered (tested backup restoration)
5. Show me that errors are caught and monitored (not silently swallowed)

---

## RELEASE BLOCKERS

### P0 — Must Fix Before Any Production Deployment

| # | Blocker | Category |
|---|---------|----------|
| P0.1 | Split database.py migration logic into proper Alembic migrations | Database |
| P0.2 | Split ocr.py into multiple manageable files | Backend |
| P0.3 | Add circuit breaker for Anthropic API calls | Backend |
| P0.4 | Move rate limiting to persistent storage (Redis/DB) | Security |
| P0.5 | Add comprehensive startup health checks with graceful degradation | DevOps |

### P1 — Must Fix Before Customer Validation or Soft Launch

| # | Blocker | Category |
|---|---------|----------|
| P1.1 | Fix permission catalog duplicate key issue at import time | Authorization |
| P1.2 | Replace HS256 JWT with RS256 | Security |
| P1.3 | Remove ENABLE_AUTH_SECURE feature flag, deprecate legacy auth | Auth |
| P1.4 | Add P0-level permission checks to ALL OCR and attendance endpoints | Authorization |
| P1.5 | Verify and fix all broad `except Exception:` handlers | Backend |

### P2 — Fix Within First Month of Launch

| # | Blocker | Category |
|---|---------|----------|
| P2.1 | Add offline PWA support with queue-and-sync for entries | Frontend |
| P2.2 | Add proper loading/error/empty states across all pages | Frontend |
| P2.3 | Add integration tests for OCR verification workflow | Testing |
| P2.4 | Add performance benchmarks for dashboard/analytics queries | Testing |
| P2.5 | Document disaster recovery procedures in runbook | DevOps |

---

## MINIMUM FIXES REQUIRED BEFORE VALIDATION

If the founder must show the product for validation within 2 weeks, these 5 fixes give the highest risk reduction per unit effort:

1. **Add circuit breaker for Anthropic API** — prevents cascading OCR failures. Estimated effort: 1 day.
2. **Fix permission catalog duplicates** — prevent silent auth bypass. Estimated effort: 2 hours.
3. **Move login rate limiting to database** — prevent brute force after restart. Estimated effort: 4 hours.
4. **Add startup health check that verifies OCR dependencies** — fail fast instead of failing mid-request. Estimated effort: 4 hours.
5. **Split ocr.py into 3 files at minimum** — router, service, utils. Estimated effort: 1 day.

---

## DETAILED PHASE-BY-PHASE ANALYSIS

### Architecture (7/10)

```
✅ STRENGTHS:
- Clean FastAPI + Next.js separation
- Well-defined service layer
- Authorization PDP is architecturally sound
- Approval service with IP-2/3/4/5 patterns
- Comprehensive permission catalog (100+ keys)
- Multi-tenant with org/factory isolation

❌ WEAKNESSES:
- database.py is a god module (~2000 lines, 5+ responsibilities)
- Dual auth system (legacy JWT + v2 cookies)
- Some files are dangerously large (ocr.py: 160K chars)
- Self-repairing schema is clever but fragile
- No explicit interface/abstraction layer between modules
```

### Frontend (6/10)

```
✅ STRENGTHS:
- Next.js 16 + React 19 — modern, actively maintained
- TypeScript throughout
- TanStack Query for data fetching
- TanStack Table for data grids
- Tailwind CSS v4 for styling
- Playwright e2e tests exist

❌ WEAKNESSES (from observable evidence):
- Unknown loading/error states coverage
- Heavy third-party dependency bundle
- Mobile responsiveness needs verification for factory workers
- No explicit offline-first PWA patterns
- Need to audit form validation completeness
```

### Backend (7/10)

```
✅ STRENGTHS:
- Comprehensive error logging with structured JSON
- Input validation via Pydantic throughout
- Sentry integration for production monitoring
- Rate limiting at endpoint and global levels
- CSRF protection for cookie auth
- Background job system for long-running tasks
- Billing recovery on startup

❌ WEAKNESSES:
- Massive file sizes (ocr.py, database.py)
- Some services catch all exceptions
- No circuit breaker for external API calls
- Background thread schedulers not visible in monitoring
- Password sync between legacy/v2 is not atomic
```

### Database (6/10)

```
✅ STRENGTHS:
- Good index coverage for common queries
- Foreign key constraints maintain referential integrity
- Unique constraints prevent duplicates
- EncryptedString for sensitive data at rest
- PostgreSQL check in production
- Naming conventions for constraints

❌ WEAKNESSES:
- Auto-migration is the PRIMARY migration path (should be safety net)
- JSON columns with loose schema validation
- String UUIDs as primary keys (performance impact at scale)
- No migration versioning or rollback plan
- init_db() could fail at startup, blocking the entire app
- Broad exception handling in schema repair
```

### Security (7/10)

```
✅ STRENGTHS:
- CSP headers configured
- MFA with TOTP support
- Account lockout on failed logins
- Password strength validation (12+ chars, mixed case, numbers, symbols)
- Token blacklisting for JWT
- IP address hashing in audit logs
- Content-Length validation
- CSRF tokens for cookie auth
- Rate limiting at multiple granularities
- Tenant isolation verified in tests

❌ WEAKNESSES:
- HS256 JWT (symmetric) — service key can forge tokens
- In-memory rate limiting (not shared, lost on restart)
- Broad exception catching could mask security events
- Legacy auth not fully deprecated
- Role revision cache with 5-minute TTL (stale permissions)
- Some PDP checks query DB on every request
```

### Workflows (7/10)

```
✅ STRENGTHS:
- Approval patterns (IP-2/3/4/5) well-defined
- Self-approval prevention
- TTL/expiry with auto-escalate/auto-reject
- Callback system for completion actions
- DB-backed persistence
- Tenant isolation tested

❌ WEAKNESSES:
- OCR workflow is the most complex and fragile
- Approval service may not be integrated with all workflows yet
- Attendance auto-close scheduler reliability unknown
- Some workflows depend on AI (OCR) which is the weakest link
```

### Authorization (8/10)

```
✅ STRENGTHS:
- PDP architecture is well-designed
- Permission catalog is the single source of truth
- Three scope levels (FACTORY, ORG, PLATFORM)
- MFA requirement on sensitive permissions
- Frontend permission manifest endpoint
- Regular P0 role check tests

❌ WEAKNESSES:
- Duplicate permission keys at import time
- Platform scope grants to all ADMIN/OWNER (too broad)
- Some inline role checks not yet migrated to PDP
- DB query on every PDP MFA check
```

### Real-World Survival Test

**Simulation: 1 factory, 50 workers, 5 managers, 500 OCR scans, daily attendance/invoices/dispatch**

```
Week 1: ❌ Likely incidents
- At least 1 OCR timeout cascade (H3)
- At least 1 rate limiter reset during restart (C4)
- Survivable with active monitoring

Week 2: ⚠️ Probable incidents
- Schema issue on new deployment (C1)
- OCR pipeline bug in an edge case (C2)
- Manual intervention required

Month 1: ❌ Likely outage
- Database startup failure (C1)
- No graceful degradation path
- Extended downtime expected

Month 2: ❌ Not survivable
- Cumulative technical debt causes systemic instability
- No safety net for failures
```

---

## FINAL HONEST MESSAGE TO FOUNDER

Talk directly to founder. No sugarcoating.

### Dear Founder,

You've built something genuinely impressive. **The authorization system is world-class for a startup.** The approval workflows show real understanding of factory operations. The multi-tenant isolation is production-grade. The test coverage (70+ test files) is better than 95% of startups at this stage.

**But you have a quality ceiling problem.** The project is held back by three things:

1. **You let files grow too large.** ocr.py at 160K characters will eventually cause an incident. database.py doing raw SQL migrations at startup is one bad deployment away from a full outage. Every week you delay splitting these files, you accumulate technical debt that compounds.

2. **You have a dual personality in auth.** Two authentication systems, two password hashing schemes, two sets of models. Every feature you build has to work with both. This doubles the surface area for bugs and security issues. Pick one—preferably v2—and delete the other.

3. **There's no circuit breaker for your most critical external dependency.** Your OCR pipeline depends on Anthropic's API. When it goes down (and it will), your app doesn't degrade gracefully—it blocks worker processes and creates a cascading failure. A simple circuit breaker that falls back to "OCR unavailable, please retry later" would prevent this.

### My Advice:

**For validation with customers:** Go ahead. Show the demo. The product is impressive and the authorization system will give factory owners confidence. But make it clear this is pre-production.

**For production deployment:** Delay 3-4 weeks and fix the 5 minimum items listed above. Then soft-launch with one factory, one week at a time, with active monitoring.

**For the long term:** Invest in reliability over features for the next 2 months. Every new feature you add while ocr.py is 160K chars and database.py has 2000 lines of raw SQL is another point of failure.

**Would I launch today if this were my startup?** No. I'd fix the critical issues first. But I'd show the demo to every factory owner I could find, because the feedback will tell you what to prioritize next.

— Your AI Auditor
