# FACTORYNERVE PRODUCTION READINESS PLAN

## Phase-by-Phase Fix Plan for Real Factory Deployment

---

# EXECUTIVE SUMMARY

**Current state:** 391 tests pass, 261 fail, 19 errors. Core auth/OCR/attendance work. Steel module is broken.

**Target state:** All critical tests pass, race conditions eliminated, authorization fully enforced, system survives 2 months of real factory usage with 50+ workers.

**Total effort:** ~3-4 weeks for a single developer, ~2 weeks for a pair

**Dependencies:** Redis (for distributed locks), SQLite→PostgreSQL migration (already planned)

---

# PHASE 0: FOUNDATION — FIX THE BROKEN TESTS

**Goal:** Get tests passing so you can safely refactor without regressions.

**Effort:** 2-3 days

**Risk:** HIGH — everything else depends on this

---

### Task 0.1 — Diagnose Steel Module Test Failures

The 150+ steel test failures are likely caused by one of:
- **Missing env vars** — `STEEL_FACTORY_ID` or factory profile seed data
- **Test server startup** — TestClient doesn't trigger `@app.on_event("startup")` handlers
- **Database isolation** — concurrent test DBs missing seed data for steel factories

**Action:**
```bash
# Isolate one failing test to capture the exact error:
python -m pytest tests/test_steel_module.py::test_steel_overview_rejects_non_steel_factory -v --tb=long 2>&1 | head -50
```

**Check:**
- Does `require_active_steel_factory()` raise `ValueError`?
- Is `current_user.active_factory_id` set?
- Are steel models in `__init__.py` imports?

**Fix:** Update `tests/conftest.py` to seed a steel-type factory, or fix `require_active_steel_factory` to handle missing config gracefully.

---

### Task 0.2 — Fix Pre-existing Non-Steel Test Failures

Other known failures from the audit:
| Test | Likely Cause |
|------|-------------|
| `test_provider_abstraction::test_complete_with_retry_does_not_retry_on_400` | Mock not counting calls correctly — `assert 0 == 1` |
| `test_ocr_table_excel_route::test_table_scan_defaults_to_tesseract` | Env has Anthropic key set, test expects fallback |
| `test_auth_google::*` (1 failure) | Mock mismatch with v2 session flow |

**Fix each with minimal changes:**
- Provider test: fix the FakeProvider call counter
- OCR test: clear env var in fixture or mock `get_config()`
- Google auth test: add `is_email_verified=True` to AuthUser creation

---

### Task 0.3 — Run Full Suite, Confirm Baseline

```bash
python -m pytest tests/ --tb=line -q | tail -5
```

**Target:** ≥ 390 passing, 0 new failures after first fix pass

---

# PHASE 1: CONCURRENCY & RACE CONDITION ELIMINATION

**Goal:** Eliminate every data corruption path identified in the audit.

**Effort:** 3-4 days

**Risk:** HIGH — these are the bugs that cause real factory data loss

---

### Task 1.1 — Distributed Stock Lock (Redis)

**Problem:** Two concurrent dispatches can deduct from the same item's stock, causing negative balance or lost stock.

**Solution:** Add a Redis-based distributed mutex keyed on `factory_id:item_id` for all stock mutations.

**File:** `backend/services/steel_service.py`

```python
import redis.asyncio as redis
from contextlib import asynccontextmanager

STOCK_LOCK_TTL = 5  # seconds

@asynccontextmanager
async def stock_lock(factory_id: str, item_id: int):
    r = redis.from_url(os.getenv("REDIS_URL", "redis://localhost:6379"))
    lock_key = f"steel:stock:lock:{factory_id}:{item_id}"
    acquired = False
    for attempt in range(3):
        acquired = await r.setnx(lock_key, "1")
        if acquired:
            await r.expire(lock_key, STOCK_LOCK_TTL)
            break
        await asyncio.sleep(0.1 * (attempt + 1))
    if not acquired:
        raise HTTPException(429, "Stock is busy. Retry.")
    try:
        yield
    finally:
        await r.delete(lock_key)
```

**Wrap these operations:**
- `create_steel_inventory_transaction`
- `_create_dispatch_inventory_movements`
- `approve_steel_stock_reconciliation` (adjustment transaction)

---

### Task 1.2 — Attendance Bulk Punch (Batch INSERT)

**Problem:** 50 workers punching simultaneously each get individual INSERTs that can race on the unique constraint.

**Solution:** Replace the per-worker IntegrityError catch with a **batch INSERT ... ON CONFLICT DO NOTHING** returning the existing row.

**File:** `backend/routers/attendance.py` — `punch_attendance()`

```python
from sqlalchemy.dialects.sqlite import insert as sqlite_insert

# For PostgreSQL, use postgresql dialect
stmt = sqlite_insert(AttendanceRecord).values(
    org_id=org_id,
    factory_id=factory.factory_id,
    user_id=current_user.id,
    attendance_date=current_date,
    ...
)
stmt = stmt.on_conflict_do_nothing(
    index_elements=["user_id", "factory_id", "attendance_date"]
)
cursor = db.execute(stmt)
if cursor.rowcount == 0:
    # Row already exists — fetch and return
    existing = _record_for_local_day(...)
```

**For PostgreSQL migration (planned):**
```python
from sqlalchemy.dialects.postgresql import insert as pg_insert
stmt = pg_insert(AttendanceRecord).values(...)
stmt = stmt.on_conflict_do_nothing(
    constraint="uq_attendance_user_factory_date"
)
```

---

### Task 1.3 — Add DB-Level CHECK Constraint on Stock

**Problem:** Even with locks, a bug could bypass the application-layer negative stock check.

**Solution:** Add a DB constraint on `steel_inventory_transaction` or a trigger that prevents stock from going below zero.

**File:** `backend/models/steel_inventory_item.py`

Not a direct CHECK (balance is computed), but add a **transaction log** constraint:

```python
# In migration or init_db():
# CREATE TRIGGER prevent_negative_stock
# BEFORE INSERT ON steel_inventory_transaction
# FOR EACH ROW
# BEGIN
#     SELECT RAISE(ABORT, 'Stock cannot go negative')
#     WHERE (
#         SELECT COALESCE(SUM(quantity_kg), 0)
#         FROM steel_inventory_transaction
#         WHERE item_id = NEW.item_id
#     ) + NEW.quantity_kg < 0;
# END;
```

**Alternative (simpler):** Log stock balance after every transaction in a `stock_snapshot` table and add a CHECK on that table.

---

# PHASE 2: AUTHORIZATION & SECURITY HARDENING

**Goal:** Every route has proper PDP enforcement. No permission gaps.

**Effort:** 2-3 days

**Risk:** MEDIUM

---

### Task 2.1 — Fix owner-daily-pdf Permission

**File:** `backend/routers/steel.py`

**Change:**
```python
# BEFORE:
PDP(db=db).require_permission(actor=current_user, permission_key="admin.billing.quota.reset")

# AFTER:
# Owner-only steel financial access
if not _can_view_steel_financials(current_user):
    raise HTTPException(status_code=403, detail="Only factory owners can access owner reports.")
```

**Verify:** Re-run steel tests to confirm the permission change doesn't break anything.

---

### Task 2.2 — Fix select-factory Serialization

**File:** `backend/routers/auth.py` — `select_factory()`

**Before:**
```python
auth_context = _build_auth_context(db, user=current_user, active_factory_id=payload.factory_id)
return {"message": ..., **auth_context}
```

**After:**
```python
auth_context = _build_auth_context(db, user=current_user, active_factory_id=payload.factory_id)
auth_context["user"] = UserReadSchema.model_validate(current_user)
return {"message": ..., **auth_context}
```

---

### Task 2.3 — Audit All Routes for Missing PDP

**Checklist:** Search for every route decorator and verify it has ONE of:
1. `PDP(db=db).require_permission(...)`
2. `Depends(RequirePermission(...))`
3. Explicit public route annotation (e.g., `/health`, `/auth/login`)

**Searches to run:**
```bash
# Find all route definitions with @router.get/post/put/delete
rg "@router\.(get|post|put|delete|patch)\(" backend/routers/ -n | grep -v "test_" | wc -l

# Find those WITHOUT PDP or Depends(RequirePermission)
# Manual audit needed — count ~80 route handlers
```

**Priority routes to add PDP:**
| Route | Current Guard | Missing? |
|-------|--------------|----------|
| `POST /auth/select-factory` | `get_current_user` only | ✅ Missing PDP |
| `PUT /auth/profile` | v2 session + CSRF | ✅ Missing PDP |
| `POST /auth/profile-photo` | v2 session + CSRF | ✅ Missing PDP |
| `DELETE /auth/profile-photo` | v2 session + CSRF | ✅ Missing PDP |
| `POST /auth/change-password` | v2 session + CSRF | ✅ Missing PDP |
| `GET /auth/session-summary` | `get_current_user` only | ✅ Missing PDP |
| `GET /auth/admin-only` | Ad-hoc `is_admin()` | ✅ Should use PDP |

---

### Task 2.4 — Add MFA Requirement to Password Change

**File:** `backend/routers/auth.py` — `change_password()`

**Add:**
```python
# After session/CSRF check, before password verification:
from backend.models.auth_user import AuthUser
auth_user_record = db.query(AuthUser).filter(
    AuthUser.email == current_user.email,
    AuthUser.is_active.is_(True),
).first()
if auth_user_record and auth_user_record.mfa_enabled:
    # Require X-MFA-Code header
    mfa_code = request.headers.get("X-MFA-Code")
    if not mfa_code or not verify_totp(secret=auth_user_record.mfa_secret_encrypted, code=mfa_code):
        raise HTTPException(status_code=403, detail="MFA code required for password change.")
```

---

### Task 2.5 — Fix OCR Rate Limiting (Per-User)

**File:** `backend/middleware/security.py`

**Add per-user OCR rate limit:**
```python
# After auth check in the OCR route path:
ocr_rate_key = f"ocr:user:{current_user.id}" if current_user else f"ocr:ip:{key}"
```

Or add a per-user check in the OCR router directly using `check_rate_limit()`.

---

# PHASE 3: STEEL MODULE RELIABILITY

**Goal:** Steel module works correctly under concurrent factory usage.

**Effort:** 3-4 days

**Risk:** HIGH

---

### Task 3.1 — Add Stock Balance as Computed Column

**Problem:** `stock_balances_for_factory()` runs a SUM query every time. Under load, this is slow and can return stale data.

**Solution:** Add a `current_balance_kg` column to `SteelInventoryItem` that's updated atomically with each transaction.

**File:** `backend/models/steel_inventory_item.py`

```python
class SteelInventoryItem(Base):
    # ... existing fields
    current_balance_kg = Column(Float, default=0.0, nullable=False)
```

**File:** `backend/routers/steel.py`

Update balance atomically in `_create_dispatch_inventory_movements` and `create_steel_inventory_transaction`:

```python
# Atomic UPDATE:
db.execute(
    update(SteelInventoryItem)
    .where(SteelInventoryItem.id == item_id)
    .values(
        current_balance_kg=SteelInventoryItem.current_balance_kg + delta_kg
    )
)
```

---

### Task 3.2 — Add Audit Trail for All Stock Changes

Every stock mutation should create an immutable `SteelInventoryTransaction` record. The following operations currently bypass this:
- Reconciliation approval (creates adjustment — ✅ already done)
- Dispatch inventory posting (creates dispatch_out — ✅ already done)
- Manual transaction creation (✅ already done)

**Verify by searching:**
```bash
rg "SteelInventoryTransaction" backend/ --count
```

Ensure every path that calls `stock_balances_for_factory()` also creates a transaction log.

---

### Task 3.3 — Add Idempotency Keys for Dispatch Creation

**Problem:** Network retry can create duplicate dispatch records with the same dispatch number.

**Solution:** Add an `idempotency_key` column to `SteelDispatch` and check before creating.

**File:** `backend/models/steel_dispatch.py`

```python
idempotency_key = Column(String(64), unique=True, nullable=True)
```

**File:** `backend/routers/steel.py` — `create_steel_dispatch`

```python
# Before creation:
if payload.idempotency_key:
    existing = db.query(SteelDispatch).filter(
        SteelDispatch.idempotency_key == payload.idempotency_key
    ).first()
    if existing:
        return {"dispatch": _serialize_steel_dispatch(...), "idempotent": True}
```

---

# PHASE 4: INFRASTRUCTURE & OPERATIONAL RESILIENCE

**Goal:** System survives network failures, DB blips, and peak load.

**Effort:** 2-3 days

**Risk:** MEDIUM

---

### Task 4.1 — Add Graceful DB Reconnection

**File:** `backend/database.py`

Add exponential backoff retry to `init_db()` and session creation:

```python
from tenacity import retry, stop_after_attempt, wait_exponential

@retry(stop=stop_after_attempt(3), wait=wait_exponential(multiplier=1, min=1, max=10))
def get_db():
    db = SessionLocal()
    try:
        yield db
    except OperationalError:
        db.rollback()
        raise
    finally:
        db.close()
```

---

### Task 4.2 — Add Billing Webhook Auto-Retry

**File:** `backend/services/billing_manager.py` or a new `backend/cron_retry_webhooks.py`

```python
def retry_failed_webhooks(db: Session):
    """Run every 5 minutes via cron. Re-processes webhooks that were not consumed."""
    failed_events = db.query(WebhookEvent).filter(
        WebhookEvent.processed_at.is_(None),
        WebhookEvent.created_at > datetime.now(timezone.utc) - timedelta(hours=24),
        WebhookEvent.retry_count < 5,
    ).all()
    for event in failed_events:
        try:
            process_webhook_event(db, event)
            event.retry_count = (event.retry_count or 0) + 1
            event.processed_at = datetime.now(timezone.utc)
        except Exception:
            event.retry_count = (event.retry_count or 0) + 1
            event.last_error = traceback.format_exc()
```

---

### Task 4.3 — Increase Session Timeout for Long Shifts

**Problem:** 24-hour absolute session timeout hits night-shift workers (12-hour shifts + commute = problem).

**File:** `backend/auth_security/sessions.py`

```python
# Increase from 24 to 48 hours:
SESSION_ABSOLUTE_TIMEOUT_HOURS = int(os.getenv("SESSION_ABSOLUTE_TIMEOUT_HOURS", "48"))
```

**Consideration:** Security tradeoff — longer session window increases risk. Mitigate by making idle timeout shorter (15 min during shift?).

---

### Task 4.4 — Add Rate Limit Cache Invalidation

**File:** `backend/middleware/rate_limit.py`

```python
# Call this after env var changes:
def invalidate_rate_limit_cache() -> None:
    with _ENV_LIMIT_LOCK:
        _ENV_LIMIT_CACHE.clear()
```

Currently exists but is never called. Add a `/admin/reload-rate-limits` endpoint or hook it into a config reload webhook.

---

# PHASE 5: TEST HARDENING

**Goal:** Test suite catches all the failure modes listed above.

**Effort:** 3-4 days

**Risk:** LOW — pure test additions, no production code changes

---

### Task 5.1 — Write Concurrency Tests

**New file:** `tests/test_concurrency.py`

```python
import threading
import concurrent.futures

def test_concurrent_attendance_punch():
    """50 threads all punch in simultaneously. Verify no duplicates and exactly 50 records."""
    with concurrent.futures.ThreadPoolExecutor(max_workers=50) as executor:
        futures = [
            executor.submit(punch_in, user_id=i)
            for i in range(50)
        ]
        results = [f.result() for f in concurrent.futures.as_completed(futures)]
    
    # Verify: 50 unique attendance records, no IntegrityErrors
    assert len(set(r["attendance_id"] for r in results)) == 50

def test_concurrent_dispatch_stock_deduction():
    """2 dispatchers race for same item. Verify stock doesn't go negative."""
    # ...
```

---

### Task 5.2 — Write Race Condition Tests

**New file:** `tests/test_race_conditions.py`

```python
import asyncio

async def test_double_approval_race():
    """2 managers approve the same reconciliation simultaneously.
    Verify only one approval wins and stock adjustment is applied exactly once."""
    async with asyncio.TaskGroup() as tg:
        t1 = tg.create_task(approve_reconciliation(recon_id, user_a))
        t2 = tg.create_task(approve_reconciliation(recon_id, user_b))
    results = await asyncio.gather(t1, t2, return_exceptions=True)
    successes = [r for r in results if isinstance(r, dict) and r.get("status") == "approved"]
    assert len(successes) <= 1  # At most one should succeed

async def test_idempotent_dispatch_creation():
    """Same dispatch request sent twice. Verify only one dispatch record created."""
    response1 = await create_dispatch(payload)
    response2 = await create_dispatch(payload)
    assert response2["idempotent"] == True
    assert response2["dispatch"]["id"] == response1["dispatch"]["id"]
```

---

### Task 5.3 — Write PDP Bypass Tests

**New file:** `tests/security/test_pdp_enforcement.py`

```python
def test_all_steel_routes_have_pdp():
    """Every steel route must have a PDP.check_permission call in its handler."""
    # Parse router decorators and verify each has PDP.require_permission or Depends(RequirePermission)
    
def test_operator_cannot_access_owner_pdf():
    """Operator trying to access owner-daily-pdf gets 403."""
    # ...

def test_cross_factory_isolation():
    """User from Factory A cannot access Factory B's data via any endpoint."""
    # Test every major GET/POST route with factory_id parameter
```

---

### Task 5.4 — Add DB-Level Constraint Tests

```python
def test_negative_stock_trigger():
    """Direct SQL insertion that would cause negative stock must fail."""
    db.execute(text("""
        INSERT INTO steel_inventory_transaction (...) VALUES (...)
    """))
    # Should raise IntegrityError due to trigger or constraint
```

---

# PHASE 6: FINAL VALIDATION

**Goal:** Prove the system works under real factory conditions.

**Effort:** 1-2 days

**Risk:** LOW

---

### Task 6.1 — Run Full Test Suite

```bash
python -m pytest tests/ --tb=line -q
```

**Target:** ≥ 500 tests passing, ≤ 10 pre-existing non-critical failures, 0 regressions from Phases 1-5.

---

### Task 6.2 — Run Load Test

**File:** `scripts/load_test_basic.py` (already exists)

```bash
python scripts/load_test_basic.py
```

**Target:** 100 concurrent users, 500 requests/min, no 5xx errors.

---

### Task 6.3 — Run Security Scan

```bash
# Check for common vulnerabilities
python -m pytest tests/security/ -v --tb=line
```

**Target:** All security tests pass (IDOR, privilege escalation, role hierarchy, tenant isolation).

---

### Task 6.4 — Survival Smoke Test

Run the system with simulated 1-week factory data:
1. Create 50 workers, 5 managers, 10 supervisors
2. Punch all 50 workers in (simulate shift start)
3. Punch all 50 workers out (simulate shift end)
4. Create 40 dispatches with concurrent operators
5. Generate 50 invoices with payment allocations
6. Run 500 OCR scans (with failures injected)
7. **Verify:** No data corruption, no 5xx errors, no deadlocks

---

# PHASE 7: ONGOING — CONTINUOUS SAFETY

**Goal:** Keep the system safe after deployment.

**Effort:** Ongoing (integrated into dev process)

---

### Task 7.1 — Add Pre-commit Hooks

```bash
# .husky/pre-commit
python -m pytest tests/security/ --tb=line -q
python -m pytest tests/test_steel_*.py --tb=line -q
```

---

### Task 7.2 — Add CI Pipeline Checks

```yaml
# .github/workflows/test.yml
jobs:
  test:
    steps:
      - run: python -m pytest tests/ --tb=line -q -x
      - run: python -m pytest tests/security/ -v --tb=line
      - run: python scripts/load_test_basic.py --quick
```

---

### Task 7.3 — Add Production Safety Checklist

Before every production deploy:

- [ ] All steel tests pass (P0)
- [ ] All security tests pass (P0)
- [ ] No new PDP gaps introduced (diff check)
- [ ] Rate limit config validated for expected user count
- [ ] Redis available and configured for distributed locks
- [ ] Database migration tested on staging with full data

---

# TIMELINE SUMMARY

| Phase | Description | Days | Dependency |
|-------|-------------|------|-----------|
| 0 | Fix broken tests | 2-3 | None |
| 1 | Concurrency/race elimination | 3-4 | Phase 0 |
| 2 | Authorization hardening | 2-3 | Phase 0 |
| 3 | Steel module reliability | 3-4 | Phase 1 |
| 4 | Infrastructure resilience | 2-3 | None |
| 5 | Test hardening | 3-4 | Phase 1-3 |
| 6 | Final validation | 1-2 | Phase 0-5 |
| 7 | Ongoing safety | Ongoing | All |

**Total: ~3-4 weeks for a solo developer**

---

# CRITICAL PATH

The minimum viable path to **safe for real factory deployment** in priority order:

```
Week 1: Phase 0 (fix tests) + Phase 2 (auth security)
  → System is testable and permissions are correct

Week 2: Phase 1 (concurrency)
  → Stock and attendance race conditions eliminated

Week 3: Phase 3 (steel reliability) + Phase 4 (infrastructure)
  → Steel module is reliable, system survives failures

Week 4: Phase 5 (test hardening) + Phase 6 (validation)
  → Safety net in place, proven under load
```

**After Week 2, the system is safe for small factories (≤20 workers, single factory).**
**After Week 4, the system is safe for full production.**
