# Auth Consolidation Plan — Dual User Model → Single Identity Source

**Status:** Planning  
**Last Updated:** 2026-07-05  
**Priority:** P0 — Launch Blocker  
**Estimated Effort:** 5–7 engineering days  
**Risk:** HIGH — impacts every authenticated endpoint in the system

---

## Table of Contents

1. [Current Architecture](#1-current-architecture)
2. [Target Architecture](#2-target-architecture)
3. [Migration Strategy](#3-migration-strategy)
4. [Phase 1 — Schema Migration](#4-phase-1--schema-migration)
5. [Phase 2 — Auth Service Layer](#5-phase-2--auth-service-layer)
6. [Phase 3 — Router Consolidation](#6-phase-3--router-consolidation)
7. [Phase 4 — Data Backfill & Cutover](#7-phase-4--data-backfill--cutover)
8. [Phase 5 — Cleanup & Deprecation](#8-phase-5--cleanup--deprecation)
9. [Rollback Plan](#9-rollback-plan)
10. [Testing Strategy](#10-testing-strategy)
11. [Risk Register](#11-risk-register)

---

## 1. Current Architecture

### 1.1 The Two Models

| Aspect | `User` (legacy) | `AuthUser` (v2) |
|--------|-----------------|-----------------|
| **Table** | `users` | `auth_users` |
| **PK type** | `int` (auto-increment) | `str` (UUID) |
| **Password hash** | bcrypt (`backend.security`) | argon2 (`backend.auth_security.passwords`) |
| **Sessions** | JWT tokens (`/auth/refresh`) | Cookie sessions (`AuthSession` model) |
| **MFA** | ❌ Not supported | ✅ TOTP via pyotp |
| **Lockout** | ❌ Not supported | ✅ `failed_login_attempts` + `locked_until` |
| **Org/Factory** | ✅ `org_id`, `factory_name` | ❌ Not present |
| **Role** | ✅ `role`, `role_revision` | ❌ Not present |
| **Relationships** | 6+ models (entries, audit, etc.) | ❌ None |
| **References** | 55+ files across codebase | 20+ files (auth-specific) |

### 1.2 The Bridge

`backend/security.py:get_current_user()` is the critical bridge:

```
Request → auth_session cookie → AuthSession token_hash lookup
  → AuthUser lookup by id
    → User lookup by email (THE FRAGILE LINK)
      → Return User with active_factory_id attached
```

**Problems with the bridge:**
- Two DB queries on every authenticated request
- Email is the fragile join key — if it changes on one side, sessions break
- No referential integrity between `users` and `auth_users`
- Password changes must be synced to both tables (already a source of bugs)

### 1.3 Router Duality

| Router | Prefix | Auth Method | Status |
|--------|--------|-------------|--------|
| `auth.py` | `/auth` | v2 cookie (internally) | Deprecated — login returns 410 |
| `auth_secure.py` | `/auth-secure`, `/auth/v2` | v2 cookie | Active — MFA, lockout |
| `auth_google.py` | `/auth` | v2 cookie | Active — OAuth |

All non-auth routers use `current_user: User = Depends(get_current_user)` from `backend/security.py`. **This is the bridge that must be preserved.**

---

## 2. Target Architecture

### 2.1 Single Model: `User` (enhanced)

The `users` table gains AuthUser's fields, and `auth_users` is dropped after migration.

```
users (enhanced)
├── id: int (PK)              ← unchanged
├── org_id: FK → orgs         ← unchanged
├── user_code: int            ← unchanged
├── name: str                 ← unchanged
├── email: str (unique)       ← unchanged
├── password_hash: str        ← SWITCHED to argon2 format
├── password_hash_version: str = "argon2"  ← NEW — detect on login
├── password_changed_at: datetime          ← NEW — from AuthUser
├── mfa_enabled: bool         ← NEW — from AuthUser
├── mfa_secret_encrypted: str | None       ← NEW — from AuthUser (EncryptedString)
├── failed_login_attempts: int             ← NEW — from AuthUser
├── locked_until: datetime | None         ← NEW — from AuthUser
├── is_email_verified: bool   ← NEW — from AuthUser (replaces email_verified_at)
├── ...all existing User columns...
└── created_at, updated_at    ← unchanged
```

### 2.2 Unified Auth Flow

```
Request → auth_session cookie → AuthSession token_hash lookup
  → User lookup by id (direct, no more bridge)
    → Return User with all auth fields
```

### 2.3 Router Consolidation

```
/auth/*          → FULLY REMOVED after migration
/auth-secure/*   → RENAMED to /auth/* (the canonical auth router)
/auth/v2/*       → RENAMED to /auth/* (aliased for backward compat)
```

### 2.4 Password Strategy

- **New registrations + password changes** → argon2hash (from `backend.auth_security.passwords`)
- **Legacy bcrypt hashes** → verified on login, then re-hashed to argon2 on successful login
- **Graceful rehash** — `password_hash` column stores whatever format, and login handler detects bcrypt prefix (`$2b$`) to trigger rehash

---

## 3. Migration Strategy

### 3.1 Principle: Zero-Downtime, Reversible Steps

Each phase is designed so the system continues working after every step. No phase requires a deployment lock.

### 3.2 File Dependency Map

```
                          ┌──────────────────┐
                          │  backend/models/  │
                          │   user.py         │
                          └────────┬─────────┘
                                   │
          ┌────────────────────────┼────────────────────────┐
          ▼                        ▼                        ▼
   ┌─────────────┐         ┌──────────────┐         ┌──────────────┐
   │  backend/   │         │  backend/     │         │  55+ routers │
   │  security.py│         │  auth_security│         │  & services  │
   │  (bridge)   │         │  /passwords.py│         │  (depends on │
   └─────────────┘         │  /sessions.py │         │   User)      │
                            │  /lockout.py  │         └──────────────┘
                            └──────────────┘
```

---

## 4. Phase 1 — Schema Migration (Day 1)

### 4.1 Migration: `add_auth_fields_to_users.py`

**New columns to add:**

```python
op.add_column("users", sa.Column("password_hash_version", sa.String(16), nullable=False, server_default="bcrypt"))
op.add_column("users", sa.Column("password_changed_at", sa.DateTime(timezone=True), nullable=True))
op.add_column("users", sa.Column("mfa_enabled", sa.Boolean(), nullable=False, server_default=sa.false()))
op.add_column("users", sa.Column("mfa_secret_encrypted", sa.Text(), nullable=True))  # EncryptedString
op.add_column("users", sa.Column("failed_login_attempts", sa.Integer(), nullable=False, server_default="0"))
op.add_column("users", sa.Column("locked_until", sa.DateTime(timezone=True), nullable=True))
op.add_column("users", sa.Column("is_email_verified", sa.Boolean(), nullable=False, server_default=sa.false()))
```

**Old `email_verified_at`** stays as-is for backward compatibility during migration. New code reads `is_email_verified`. A post-migration script syncs the two.

**Backfill:**

```python
# Copy existing data from auth_users to users
conn.execute(
    sqlalchemy.text("""
        UPDATE users u
        SET
            password_hash_version = 'argon2',
            password_changed_at = COALESCE(au.password_changed_at, u.created_at),
            mfa_enabled = au.mfa_enabled,
            mfa_secret_encrypted = au.mfa_secret_encrypted,
            failed_login_attempts = au.failed_login_attempts,
            locked_until = au.locked_until,
            is_email_verified = au.is_email_verified
        FROM auth_users au
        WHERE au.email = u.email
          AND u.is_active = TRUE
    """)
)
```

### 4.2 Risk: Large Migration

- **Users without AuthUser**: The `FROM auth_users` join is a LEFT JOIN — existing users without an `auth_users` row get default values (bcrypt, mfa_enabled=false, locked_until=null, etc.)
- **Users with both**: AuthUser values overwrite defaults
- **Rollback**: `downgrade` drops the new columns — all auth data is preserved in the backup

---

## 5. Phase 2 — Auth Service Layer (Day 2-3)

### 5.1 New: `backend/services/auth_service.py`

Extract all auth business logic from the routers into a service layer:

```python
class AuthService:
    """Unified auth operations — single source of truth."""

    def authenticate(self, db, email, password) -> User
    def register(self, db, payload) -> User
    def change_password(self, db, user, old_pw, new_pw)
    def reset_password(self, db, token, new_password)
    def verify_email(self, db, token)
    def setup_mfa(self, db, user) -> dict  # secret + uri
    def verify_mfa(self, db, user, code)
    def disable_mfa(self, db, user, password, code)
    def check_lockout(self, user) -> bool
    def increment_failed_login(self, db, user) -> bool
    def reset_failed_login(self, db, user)
```

### 5.2 Simplify: `backend/security.py`

Replace the bridge with a direct lookup:

```python
def get_current_user(request: Request, db: Session = Depends(get_db)) -> User:
    session = get_v2_session(db, request)
    user = db.query(User).filter(
        User.id == session.user_id,          # Direct FK — no more email bridge
        User.is_active.is_(True),
    ).first()
    if not user:
        raise HTTPException(status_code=401, detail="Not authenticated.")
    # password_changed_at invalidation (moved from sessions.py get_current_user)
    if session.created_at < user.password_changed_at:
        session.revoked_at = datetime.now(timezone.utc)
        raise HTTPException(status_code=401, detail="Session invalidated.")
    setattr(user, "active_factory_id", session.factory_id)
    return user
```

**Change required in `auth_security/sessions.py`:**
- `AuthSession.auth_user_id` → rename to `AuthSession.user_id`
- `create_session()` takes `User` instead of `AuthUser`

```python
def create_session(db, *, user: User, request, response, factory_id=None) -> AuthSession:
    # ... same logic, but user is User, not AuthUser
```

### 5.3 Update: `backend/auth_security/lockout.py`

Change all `AuthUser` references to `User`:

```python
def check_account_locked(user: User) -> bool:  # Was AuthUser
    ...

def increment_failed_login(db, user: User) -> bool:
    ...
```

### 5.4 Update: `backend/authorization/pdp.py`

The `_check_mfa` method queries `AuthUser` by email. Change to query `User` directly:

```python
# Before:
auth_user = db.query(AuthUser).filter(AuthUser.email == actor.email).first()

# After:
auth_user = db.query(User).filter(User.email == actor.email).first()
# Or even simpler — actor IS the user now:
if actor.mfa_enabled and not mfa_verified:
    return False
```

---

## 6. Phase 3 — Router Consolidation (Day 3-4)

### 6.1 Step 1: Port auth_secure.py to use `User` model

**Changes in `backend/routers/auth_secure.py`:**

| Current (AuthUser) | Target (User) |
|--------------------|---------------|
| `db.query(AuthUser).filter(...).first()` | `db.query(User).filter(...).first()` |
| `AuthUser(email=..., password_hash=...)` | `User(email=..., password_hash=...)` with `password_hash_version='argon2'` |
| `user.mfa_enabled` | `user.mfa_enabled` (now on User) |
| `user.failed_login_attempts` | `user.failed_login_attempts` (now on User) |
| `AuthAuditLog` | `AuditLog` (existing report model) — or keep separate audit table |
| `legacy_user = db.query(User)...` | **REMOVED** — no more migration path needed |

**The login migration path becomes a simple rehash:**

```python
# AuthUser query replaced with User query
user = db.query(User).filter(User.email == email, User.is_active.is_(True)).first()

if not user:
    raise _generic_login_error()

# Check if password needs upgrade from bcrypt to argon2
if user.password_hash_version == "bcrypt":
    if not legacy_verify_password(password, user.password_hash):
        raise _generic_login_error()
    # Upgrade on successful login
    user.password_hash = argon2_hash_password(password)
    user.password_hash_version = "argon2"
    user.password_changed_at = datetime.now(timezone.utc)
else:
    if not verify_password(password, user.password_hash):
        # lockout logic...
        raise _generic_login_error()
```

### 6.2 Step 2: Deprecate auth.py endpoints

**Remove from `auth.py` (migrate to `auth_secure.py` or drop):**

| Endpoint | Action |
|----------|--------|
| `/auth/register` | KEEP as-is (it already creates User, just needs to also set argon2 hash) |
| `/auth/login` | ALREADY returns 410 — remove |
| `/auth/logout` | Keep — delegates to v2 sessions |
| `/auth/logout-all` | Keep |
| `/auth/refresh` | ALREADY returns 410 — remove |
| `/auth/change-password` | Move to auth_secure.py |
| `/auth/password/forgot` | Move to auth_secure.py (already has one) |
| `/auth/password/reset` | Move to auth_secure.py (already has one) |
| `/auth/profile` | Move to auth_secure.py |
| `/auth/profile-photo` | Move to auth_secure.py |
| `/auth/email/*` | Keep or move to auth_secure.py |
| `/auth/select-factory` | Move to auth_secure.py |
| `/auth/session-summary` | Move to auth_secure.py |
| `/auth/factories` | ALREADY returns 410 — remove |
| `/auth/admin-only` | Keep — uses PDP |
| `/auth/active-workflow-template` | Move to appropriate router |
| `/auth/users/invite` | KEEP — org-management, not auth |
| `/auth/users/{id}/deactivate` | KEEP — org-management |
| `/auth/users/{id}/reactivate` | KEEP — org-management |

### 6.3 Step 3: Update router mounting in `main.py`

```python
# After consolidation:
app.include_router(auth_secure_router, prefix="/auth")         # Canonical auth
app.include_router(auth_secure_router, prefix="/auth/v2")      # Backward compat alias
app.include_router(auth_google_router, prefix="/auth")
app.include_router(phone_auth_router, prefix="/auth")
# auth_router REMOVED (or kept with only /logout, /profile, /admin-only endpoints)
```

### 6.4 Step 4: Remove duplicate audit logging

`auth_secure.py` uses `AuthAuditLog`. `auth.py` uses `AuditLog` (report model). Consolidate to use only `AuditLog` with an `auth_` action prefix for filtering.

---

## 7. Phase 4 — Data Backfill & Cutover (Day 5)

### 7.1 Pre-Cutover Check

```sql
-- Ensure all active users have corresponding entries in the merged columns
SELECT COUNT(*) FROM users
WHERE is_active = TRUE
  AND password_hash NOT LIKE '$argon2%'
  AND password_hash NOT LIKE '$2b$%';  -- Neither argon2 nor bcrypt — broken
```

### 7.2 Cutover Steps

1. **Deploy Phase 1 + Phase 2 simultaneously** (schema + code changes)
   - New columns added, old ones still exist
   - `security.py` updated to use `User` directly
   - `sessions.py` updated to use `user_id` instead of `auth_user_id`
   - Both old and new code paths work

2. **Run backfill script** — copies `auth_users` data to `users` new columns

3. **Verify** — spot-check 10 users: email, MFA status, lockout state match

4. **Deploy Phase 3** — router consolidation
   - auth_secure.py now operates on `User`
   - auth.py endpoints moved/removed
   - All endpoints continue to work

5. **Drop `auth_users` table** (after 48h monitoring)

### 7.3 Reverse Migration Path

Users created without an `auth_users` record (new registrations or pre-existing legacy users) will have:
- `password_hash_version = 'bcrypt'` (default)
- `mfa_enabled = False`
- `failed_login_attempts = 0`
- `locked_until = NULL`

These users authenticate via the legacy bcrypt path, which auto-upgrades to argon2 on first login after migration.

---

## 8. Phase 5 — Cleanup & Deprecation (Day 6-7)

### 8.1 Remove Deprecated Code

| File | Action |
|------|--------|
| `backend/routers/auth.py` | Remove `/login`, `/register`, `/refresh`, `/factories` endpoints |
| `backend/security.py` | Replace with simplified `get_current_user` (remove bridge logic) |
| `backend/models/auth_user.py` | Remove model (after data migration verified) |
| `backend/models/auth_session.py` | Rename `auth_user_id` → `user_id` |
| `backend/models/auth_password_reset.py` | Merge into `password_reset_token` model |
| `backend/models/auth_audit_log.py` | Remove — use `AuditLog` with action prefix instead |
| `backend/auth_security/tokens.py` | Keep — shared utility |
| `backend/auth_security/passwords.py` | Keep — canonical password hashing |
| `backend/auth_security/sessions.py` | Keep — rename `auth_user_id` → `user_id` |
| `backend/auth_security/lockout.py` | Change `AuthUser` → `User` |

### 8.2 Final `security.py`

```python
"""Simplified auth dependency — single User model."""

def get_current_user(request: Request, db: Session = Depends(get_db)) -> User:
    session = get_v2_session(db, request)
    user = db.query(User).filter(
        User.id == session.user_id,
        User.is_active.is_(True),
    ).first()
    if not user:
        raise HTTPException(status_code=401, detail="Not authenticated.")
    if session.created_at < user.password_changed_at:
        session.revoked_at = datetime.now(timezone.utc)
        raise HTTPException(status_code=401, detail="Session invalidated.")
    setattr(user, "active_factory_id", session.factory_id)
    return user
```

### 8.3 Remaining Files After Cleanup

```
backend/
├── models/
│   ├── user.py              ← Enhanced with all auth fields
│   ├── auth_session.py      ← Renamed auth_user_id → user_id (keep)
│   └── ... (unchanged)
├── routers/
│   ├── auth_secure.py       ← Canonical auth router (at /auth)
│   └── auth.py              ← Only non-auth endpoints (invite, deactivate, etc.)
├── security.py              ← Simplified get_current_user
├── auth_security/
│   ├── passwords.py         ← Argon2 hashing (unchanged)
│   ├── sessions.py          ← Session management (unchanged)
│   ├── lockout.py           ← AuthUser → User (trivial change)
│   ├── mfa.py               ← TOTP helpers (unchanged)
│   ├── rate_limit.py        ← Rate limiting (unchanged)
│   └── tokens.py            ← Token utilities (unchanged)
└── services/
    ├── auth_service.py      ← NEW — unified auth business logic
    └── ... (unchanged)
```

---

## 9. Rollback Plan

### 9.1 Rollback Triggers

Any of the following triggers an immediate rollback:
- >1% error rate on any auth endpoint for 5+ minutes
- Users reporting "can't log in" that traces to migration code
- Failed login rate spikes >500% above baseline
- MFA operations failing

### 9.2 Per-Phase Rollback

| Phase | Rollback Action | Impact |
|-------|----------------|--------|
| Phase 1 (schema) | `alembic downgrade -1` | Drops new columns; auth data still in auth_users |
| Phase 2 (code) | `git revert` security.py + sessions.py | Restores bridge; both User + AuthUser work |
| Phase 3 (routers) | `git revert` router changes | Restores auth.py endpoints |
| Phase 4 (backfill) | Re-run backfill script with old data | Idempotent — re-copies from auth_users |
| Phase 5 (cleanup) | `git revert` deletions | Restores all deleted files |

### 9.3 Emergency Recovery

If users are locked out entirely:

```bash
# 1. Restore auth_users table (Phase 5 revert)
alembic upgrade <pre-migration-revision>

# 2. Revert code changes
git revert HEAD~3..HEAD

# 3. Re-deploy
./scripts/deploy.sh
```

---

## 10. Testing Strategy

### 10.1 Unit Tests (30+ new tests)

**Auth service tests:**
- Register creates User with argon2 hash
- Login with correct credentials returns session
- Login with wrong password increments counter
- Login with locked account returns 423
- MFA setup generates valid TOTP secret
- MFA verify with correct code enables MFA
- MFA verify with wrong code fails
- Password change updates hash and revokes sessions
- Password reset updates hash and revokes sessions

**Bridge removal tests:**
- `get_current_user()` returns User from session.user_id
- Session with old password_changed_at is revoked
- UserFactoryRole lookup on active_factory_id works

**Rolling upgrade tests:**
- Old sessions (with auth_user_id) still work during transition
- New sessions (with user_id) work
- Mixed sessions work simultaneously

### 10.2 Integration Tests

- Full login flow: register → verify email → login → access protected endpoint
- MFA flow: enable → verify → login with code → access MFA-protected endpoint
- Password reset flow: forgot → reset → old sessions invalidated
- Lockout flow: 5 failed attempts → locked → wait → unlocked

### 10.3 Load Tests

- 100 concurrent logins (verify no deadlocks on User row)
- 50 concurrent registrations
- 20 concurrent MFA verifications

### 10.4 Testing the Migration Itself

```bash
# Test migration on copy of production DB
pg_dump production > prod_dump.sql
createdb test_migration
psql test_migration < prod_dump.sql
alembic upgrade head

# Verify counts match
SELECT COUNT(*) FROM users WHERE password_hash_version = 'argon2';
SELECT COUNT(*) FROM auth_users;  # Should match above

# Spot-check specific users
SELECT email, mfa_enabled, failed_login_attempts
FROM users WHERE email IN ('admin@factory.com', 'operator@factory.com');

# Test rollback
alembic downgrade -1
# Verify auth_users table still has all data
```

---

## 11. Risk Register

| # | Risk | Likelihood | Impact | Mitigation |
|---|------|-----------|--------|------------|
| 1 | **Email mismatch** between User and AuthUser breaks bridge | MEDIUM | HIGH | Pre-migration query to find mismatches; auto-repair script |
| 2 | **Users without AuthUser** lose MFA/lockout state on migration | HIGH | MEDIUM | LEFT JOIN defaults to safe values (no MFA, not locked) |
| 3 | **Long-running migration** locks users table | LOW | HIGH | Run migration as non-blocking ALTER TABLE (PostgreSQL); batch UPDATE |
| 4 | **Session invalidation** — all users logged out after password_changed_at migration | HIGH | HIGH | Only set password_changed_at where it existed in auth_users; NULL = "before sessions existed" = no invalidation |
| 5 | **Rollback restores auth_users** but new sessions reference user_id | MEDIUM | HIGH | Keep both `auth_user_id` and `user_id` on AuthSession during transition; write to both |
| 6 | **Frontend expects `/auth/login`** (now 410) | LOW | HIGH | Frontend already uses `/auth/v2/login` — verify in Next.js auth code |
| 7 | **Rate limit state lost** on deploy | LOW | LOW | Rate limits are in-memory; deploy tolerance is expected |
| 8 | **Dual-write bug** — password hash written to one column but not both | MEDIUM | HIGH | Single-write post-migration: only `User.password_hash` is authoritative |

---

## Migration Checklist

```
Phase 1 — Schema
[ ] Create migration `add_auth_fields_to_users.py`
[ ] Add columns to User model
[ ] Run migration on staging
[ ] Run backfill query on staging
[ ] Verify data integrity

Phase 2 — Service Layer
[ ] Create `backend/services/auth_service.py`
[ ] Update `security.py` — remove bridge, use User directly
[ ] Update `sessions.py` — rename auth_user_id → user_id
[ ] Update `lockout.py` — AuthUser → User
[ ] Update `pdp.py` — AuthUser → User
[ ] Update `auth_secure.py` — use User model
[ ] Run all auth tests

Phase 3 — Router Consolidation
[ ] Move change-password to auth_secure.py
[ ] Move profile endpoints to auth_secure.py
[ ] Move select-factory to auth_secure.py
[ ] Remove deprecated /auth/login, /auth/refresh, /auth/factories
[ ] Update main.py router mounting
[ ] Update frontend API calls

Phase 4 — Cutover
[ ] Run pre-cutover data integrity check
[ ] Deploy Phase 1+2 together
[ ] Run backfill on production
[ ] Monitor error rates for 2 hours
[ ] Deploy Phase 3 (router changes)
[ ] Monitor for 48 hours
[ ] Drop auth_users table

Phase 5 — Cleanup
[ ] Remove auth_user.py model
[ ] Remove auth_audit_log.py model
[ ] Remove auth.py deprecated endpoints
[ ] Remove auth_password_reset.py (merged)
[ ] Final code review
[ ] Update API documentation
```

---

## Summary

**Total effort:** 5-7 engineering days  
**Risk level:** HIGH (touches every authenticated request)  
**Key principle:** Each phase is independently reversible  
**Critical path:** Session continuity — users must not be logged out during migration  
**Biggest risk:** Email mismatch between User and AuthUser tables  

The plan avoids a "big bang" cutover by introducing new columns alongside old ones, running both systems in parallel during migration, and providing clear rollback steps for each phase.
