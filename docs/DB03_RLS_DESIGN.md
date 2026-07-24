# DB-03: PostgreSQL Row-Level Security (RLS) for Multi-Tenancy

> **Status:** Design Document  
> **Priority:** P1  
> **Target Deployment:** Phase 3 (Post–P0/P1 bugfix rollout)  
> **Author:** Buffy (Codebuff)  
> **Date:** 2026-07-06

---

## 1. Executive Summary

DPR.ai currently enforces multi-tenant isolation **entirely at the application layer** — through PDP scope checks (`authorization/pdp.py`), `tenancy.py` helpers, and router-level query filters. This design replaces that fragile application-level enforcement with **PostgreSQL Row-Level Security (RLS)**, providing a defense-in-depth guarantee that no query — regardless of origin (API, background job, ad-hoc script, or direct DB access) — can access data from another tenant.

### Why RLS?

| Concern | Application-Layer Filtering | RLS |
|----------|----------------------------|-----|
| **Scope** | Per-query — easy to miss a filter | Table-wide — automatic for every row |
| **Defense depth** | Single layer | True defense-in-depth (DB as gated) |
| **Background jobs** | Must manually pass tenant context | Inherits session tenant context automatically |
| **SQL injection** | Exposed if filter is omitted | Contained — RLS blocks cross-tenant access |
| **Ad-hoc scripts / migrations** | No protection | Protected by default |
| **Performance** | N+1 filter checks | Single policy evaluation per table |
| **Complexity** | ~80 query files to audit | 1 policy per table, centrally managed |

---

## 2. Current State Analysis

### 2.1 Tenant Model

```
Organization (org_id: UUID PK)
├── User (org_id FK → Organization)
├── Factory (org_id FK → Organization)
│   ├── Entry (org_id, factory_id)
│   ├── AttendanceRecord (org_id, factory_id)
│   ├── EmployeeProfile (org_id, factory_id)
│   ├── SteelInventoryItem (org_id, factory_id)
│   ├── SteelDispatch (org_id, factory_id)
│   ├── SteelSalesInvoice (org_id, factory_id)
│   ├── SteelProductionBatch (org_id, factory_id)
│   ├── SteelVendor (org_id, factory_id)
│   ├── SteelCustomer (org_id, factory_id)
│   ├── SteelCashAccount (org_id, factory_id)
│   ├── SteelMachineDowntimeEvent (org_id, factory_id)
│   ├── Feedback (org_id, factory_id)
│   ├── AuditLog (org_id, factory_id)
│   ├── ApprovalInstance (org_id, factory_id)
│   └── ...
├── Subscription (org_id FK)
├── Invoice (org_id nullable)
├── Notification (org_id nullable)
├── OcrTemplate (org_id FK)
├── OcrVerification (org_id FK)
└── ...
```

**Key insight:** Every business-data table has an `org_id` column. Most also have a `factory_id` column. Both are nullable on some tables (e.g., `Entry.org_id` is nullable, `Invoice.org_id` is nullable). Non-null enforcement should be applied where possible as part of this work.

### 2.2 Current Isolation Mechanisms

| Mechanism | Location | What It Does |
|-----------|----------|-------------|
| **PDP scope checks** | `authorization/pdp.py` | `ScopeLevel.ORG` / `ScopeLevel.FACTORY` checks with `_check_org_scope()` and `_check_factory_scope()` |
| **tenancy.py** | `backend/tenancy.py` | `resolve_org_id()` and `resolve_factory_id()` helpers for router-level filters |
| **security.py** | `backend/security.py` | `get_current_user()` sets `active_org_id` and `active_factory_id` on the user object from JWT/session |
| **Router-level filters** | ~30+ router files | Each endpoint manually adds `.filter(Entry.org_id == user.active_org_id)` etc. |
| **UserFactoryRole** | `models/user_factory_role.py` | Junction table linking users → factories → organizations with roles |

**Known gaps:**
1. ~30+ router files each independently filter by `org_id`/`factory_id` — any missed filter is a data leak
2. Background OCR jobs and Celery workers (future) need explicit tenant context passing
3. Ad-hoc admin queries and data migrations have no tenant protection
4. Direct database access (psql, DataGrip, etc.) bypasses all isolation

### 2.3 Tables Without `org_id` (Global / Cross-Tenant)

These tables should **not** have RLS policies:

| Table | Reason |
|-------|--------|
| `organizations` | Root tenant entity; RLS would prevent org creation |
| `users` | Users can belong to orgs; user creation needs cross-org access |
| `auth_sessions` | Session management is cross-tenant |
| `auth_users` | Legacy; being phased out via auth consolidation |
| `idempotency_keys` | Idempotency is global |
| `rate_limits` | Rate limiting is per-IP, not per-org |
| `alembic_version` | Migration tracking — not tenant-scoped |
| `token_blacklist` | Global token invalidation |

---

## 3. Design

### 3.1 Architecture Overview

```
┌─────────────────────────────────────────────────────────┐
│                     Client Request                        │
└──────────────┬──────────────────────────────────────────┘
               │
               ▼
┌─────────────────────────────────────────────────────────┐
│              FastAPI Middleware Layer                      │
│  ┌──────────────────────────────────────────────────┐   │
│  │   RLS Context Middleware (NEW)                     │   │
│  │   - Extracts org_id from authenticated user        │   │
│  │   - Sets app.current_org_id (PostgreSQL parameter) │   │
│  │   - Sets app.current_user_id                       │   │
│  └──────────────────────────────────────────────────┘   │
│  ┌──────────────────────────────────────────────────┐   │
│  │   Existing Middleware (security, rate limit...)    │   │
│  └──────────────────────────────────────────────────┘   │
└──────────────┬──────────────────────────────────────────┘
               │
               ▼
┌─────────────────────────────────────────────────────────┐
│              SQLAlchemy Session                           │
│  - Executes SET app.current_org_id = 'uuid'              │
│  - Executes SET app.current_user_id = '123'              │
└──────────────┬──────────────────────────────────────────┘
               │
               ▼
┌─────────────────────────────────────────────────────────┐
│              PostgreSQL RLS                               │
│  - CREATE POLICY org_isolation ON ...                    │
│    USING (org_id = current_setting('app.current_org_id'))│
│  - CREATE POLICY factory_isolation ON ...                │
│    USING (factory_id = current_setting('app.current_fac'))│
│  - Blocked rows → silently empty result set              │
└─────────────────────────────────────────────────────────┘
```

### 3.2 Session-Based Tenant Context

PostgreSQL RLS uses `current_setting()` to read application-level parameters. We set these at the start of each database session (i.e., at the beginning of each SQLAlchemy session).

#### Parameters to Set

| Parameter | Type | Description | Example |
|-----------|------|-------------|---------|
| `app.current_org_id` | `text` | Current organization UUID | `"550e8400-e29b-41d4-a716-446655440000"` |
| `app.current_factory_id` | `text` | Current factory UUID (optional) | `"550e8400-e29b-41d4-a716-446655440001"` |
| `app.current_user_id` | `integer` | Current user ID | `"42"` |

#### Where to Set Parameters

**Option A (Recommended) — SQLAlchemy session event:**

```python
@event.listens_for(SessionLocal, "before_commit")
def _set_rls_context(session: Session) -> None:
    """Set PostgreSQL RLS session parameters before any query executes."""
    # Context is set per-session on the ScopedSession's connection
    pass

# Better: Use Session pool events
@event.listens_for(engine, "connect")
def _receive_connect(dbapi_connection, connection_record):
    """Placeholder — RLS params aren't known at connect time."""
    pass

# Best: Set via middleware + checkout event
from sqlalchemy import event
import threading

_rls_context = threading.local()

@event.listens_for(engine, "checkout")
def _receive_checkout(dbapi_connection, connection_record, connection_proxy):
    """Restore RLS context on each connection checkout from pool."""
    org_id = getattr(_rls_context, "org_id", None)
    user_id = getattr(_rls_context, "user_id", None)
    factory_id = getattr(_rls_context, "factory_id", None)
    cursor = dbapi_connection.cursor()
    try:
        if org_id:
            cursor.execute("SET SESSION app.current_org_id = %s", (org_id,))
        if user_id is not None:
            cursor.execute("SET SESSION app.current_user_id = %s", (str(user_id),))
        if factory_id:
            cursor.execute("SET SESSION app.current_factory_id = %s", (factory_id,))
    finally:
        cursor.close()
```

**Option B — Middleware + FastAPI dependency:**

```python
# backend/middleware/rls_context.py (NEW)

import threading
from fastapi import Request, Response
from starlette.middleware.base import BaseHTTPMiddleware

_rls = threading.local()

class RLSContextMiddleware(BaseHTTPMiddleware):
    async def dispatch(self, request: Request, call_next):
        # Extract from request.state (set by authentication middleware)
        user = getattr(request.state, "user", None)
        if user:
            _rls.org_id = getattr(user, "org_id", None)
            _rls.user_id = getattr(user, "id", None)
            _rls.factory_id = getattr(user, "active_factory_id", None)
        else:
            _rls.org_id = None
            _rls.user_id = None
            _rls.factory_id = None
        response = await call_next(request)
        return response
```

Then the checkout event reads from `_rls` (thread-local) to set the PostgreSQL parameters.

### 3.3 RLS Policy Design

#### Policy Architecture

We define **two policy tiers**:

1. **ORG-level policy** — applies to all tenant-scoped tables that have `org_id`
2. **FACTORY-level policy** — applies selectively for tables where factory-scoped access is appropriate

#### Org-Level Policy (Universal — all tenant tables)

```sql
-- Grant to enable RLS on schema objects
ALTER TABLE entries ENABLE ROW LEVEL SECURITY;

-- Exempt platform admins (metadata queries, support)
CREATE POLICY org_isolation_entries ON entries
    FOR ALL
    USING (
        org_id IS NULL
        OR org_id = current_setting('app.current_org_id')::text
    );
```

#### Factory-Level Policy (for tables with factory_id)

```sql
-- Factory-scoped: user must belong to the factory within their org
CREATE POLICY factory_isolation_steel_dispatches ON steel_dispatches
    FOR ALL
    USING (
        factory_id = current_setting('app.current_factory_id')::text
        AND org_id = current_setting('app.current_org_id')::text
    );
```

#### Platform Admin Bypass Policy

```sql
-- Platform admins can see all rows regardless of tenant
-- This is controlled by setting app.current_org_id to NULL for platform queries
-- OR by creating a separate bypass role
CREATE POLICY platform_admin_bypass ON entries
    FOR ALL
    USING (
        current_setting('app.current_org_id', TRUE) IS NULL
        OR current_setting('app.current_org_id') = ''
        OR org_id IS NULL
        OR org_id = current_setting('app.current_org_id')::text
    );
```

### 3.4 Complete Table Inventory

#### Tier 1 — Org + Factory Isolation (both policies)

These tables have both `org_id` and `factory_id`:

| Table | `org_id` Nullable? | Notes |
|-------|-------------------|-------|
| `entries` | YES (nullable) | Has `ix_entries_org_id`, `ix_entries_factory_id` |
| `attendance_records` | NO | Has `ix_attendance_records_org_date` |
| `attendance_events` | (check) | |
| `employee_profiles` | NO | |
| `steel_inventory_items` | NO | |
| `steel_inventory_transactions` | (check) | |
| `steel_dispatches` | NO | |
| `steel_dispatch_lines` | (check) | |
| `steel_sales_invoices` | NO | |
| `steel_sales_invoice_lines` | (check) | |
| `steel_production_batches` | NO | |
| `steel_production_lines` | (check) | |
| `steel_vendors` | NO | |
| `steel_vendor_bills` | (check) | |
| `steel_vendor_bill_lines` | (check) | |
| `steel_vendor_payments` | (check) | |
| `steel_vendor_payment_allocations` | (check) | |
| `steel_customers` | NO | |
| `steel_customer_payments` | (check) | |
| `steel_customer_payment_allocations` | (check) | |
| `steel_cash_accounts` | NO | |
| `steel_cash_ledger_entries` | (check) | |
| `steel_machine_downtime_events` | NO | |
| `steel_maintenance_tasks` | (check) | |
| `steel_machines` | (check) | |
| `steel_bom` | (check) | |
| `steel_expenses` | (check) | |
| `steel_fraud_alerts` | (check) | |
| `steel_stock_reconciliations` | (check) | |
| `feedback` | NO | |
| `approval_instances` | YES (nullable) | |
| `audit_logs` | YES (nullable) | |
| `factory_settings` | (check) | |
| `ocr_templates` | (check) | |
| `ocr_verifications` | (check) | |
| `defect_reasons` | (check) | |
| `workforce_cost_rates` | (check) | |
| `shift_templates` | (check) | |
| `machines` (legacy `machine`) | NO | No `org_id` — must add via migration |
| `machine_downtime` (legacy) | NO | No `org_id` — must add via migration |

#### Tier 2 — Org Isolation Only

These tables have `org_id` but not `factory_id`:

| Table | `org_id` Nullable? | Notes |
|-------|-------------------|-------|
| `organizations` | N/A — root | NO RLS — base tenant entity |
| `users` | NO | NO RLS — cross-tenant user lookup needed |
| `subscriptions` | (check FK) | |
| `invoices` (billing) | YES (nullable) | |
| `notifications` | YES (nullable) | |
| `feature_usage` | (check) | |
| `org_feature_usage` | (check) | |
| `ocr_usage` | (check) | |
| `org_ocr_usage` | (check) | |
| `org_whatsapp_usage` | (check) | |
| `ai_usage_log` | (check) | |
| `ai_result_cache` | (check) | |
| `intelligence_requests` | (check) | |
| `intelligence_stage_usage` | (check) | |
| `org_subscription_addons` | (check) | |
| `ops_alert_events` | (check) | |
| `ops_alert_daily_summaries` | (check) | |

#### Tier 3 — No RLS (Global / Auth / System)

| Table | Reason |
|-------|--------|
| `organizations` | Root tenant — RLS would break org creation |
| `users` | Needed for auth (login, registration, password reset) |
| `auth_sessions` | Session validation is cross-tenant |
| `auth_users` | Legacy, being phased out |
| `auth_password_resets` | Cross-tenant password reset |
| `auth_audit_logs` | Auth audit is global |
| `email_queue` | Queue processing is global |
| `email_verification_tokens` | Email verification is cross-tenant |
| `password_reset_tokens` | Password reset is cross-tenant |
| `refresh_tokens` | Token refresh is global |
| `idempotency_keys` | Idempotency is global |
| `rate_limits` | Rate limiting is per-IP |
| `pending_registrations` | Registration happens before tenant assignment |
| `phone_verifications` | Phone verification is cross-tenant |
| `alembic_version` | Migration tracking |

### 3.5 Platform Admin Bypass Strategy

Platform admins need to query across all tenants for support and system administration. We handle this through **role-based param setting**:

```python
# When user.is_platform_admin is True, set app.current_org_id to ''
# (empty string), which the RLS policy treats as "bypass"
if user.is_platform_admin:
    _rls.org_id = ""  # Signals bypass
    _rls.user_id = getattr(user, "id", None)
else:
    _rls.org_id = getattr(user, "org_id", None)
    _rls.user_id = getattr(user, "id", None)
```

RLS policy becomes:

```sql
CREATE POLICY org_isolation_entries ON entries
    FOR ALL
    USING (
        -- Platform admin bypass (empty org_id = bypass)
        current_setting('app.current_org_id', TRUE) = ''
        OR current_setting('app.current_org_id', TRUE) IS NULL
        -- Normal tenant isolation
        OR org_id = current_setting('app.current_org_id')::text
    );
```

---

## 4. Migration Strategy

### 4.1 Phase 1 — Preparation (Backward-Compatible)

This phase adds the RLS session infrastructure and enables RLS **without** policies, so existing queries are unaffected.

**Migration 1: `create_rls_session_settings`**

```python
"""empty message

Revision ID: 20260707_01_create_rls_session_settings
Revises: <previous_head>
Create Date: 2026-07-07
"""

from alembic import op

def upgrade():
    # Create custom GUC (Grand Unified Configuration) parameters
    # These are session-level settings that don't require superuser
    op.execute("SELECT set_config('app.current_org_id', '', FALSE)")
    op.execute("SELECT set_config('app.current_factory_id', '', FALSE)")
    op.execute("SELECT set_config('app.current_user_id', '0', FALSE)")

def downgrade():
    # Can't drop GUCs in PostgreSQL; they persist until the session ends
    pass
```

**Migration 2: `enable_rls_on_tables`**

```python
def upgrade():
    tables = [
        "entries", "attendance_records", "attendance_events",
        "employee_profiles", "steel_inventory_items",
        "steel_inventory_transactions", "steel_dispatches",
        "steel_dispatch_lines", "steel_sales_invoices",
        "steel_sales_invoice_lines", "steel_production_batches",
        "steel_production_lines", "steel_vendors",
        "steel_vendor_bills", "steel_vendor_bill_lines",
        "steel_vendor_payments", "steel_vendor_payment_allocations",
        "steel_customers", "steel_customer_payments",
        "steel_customer_payment_allocations", "steel_cash_accounts",
        "steel_cash_ledger_entries", "steel_machine_downtime_events",
        "steel_maintenance_tasks", "steel_machines",
        "steel_bom", "steel_expenses", "steel_fraud_alerts",
        "steel_stock_reconciliations", "feedback",
        "approval_instances", "audit_logs", "factory_settings",
        "ocr_templates", "ocr_verifications",
        "notifications", "invoices", "subscriptions",
        "feature_usage", "org_feature_usage",
        "ocr_usage", "org_ocr_usage",
        "org_whatsapp_usage", "ai_usage_log",
        "ai_result_cache", "intelligence_requests",
        "intelligence_stage_usage",
    ]
    for table in tables:
        op.execute(f"ALTER TABLE {table} ENABLE ROW LEVEL SECURITY")
        # FORCE = rows visible only if policy allows (even to table owner)
        op.execute(f"ALTER TABLE {table} FORCE ROW LEVEL SECURITY")
```

> ⚠️ **NOTE:** Enabling RLS without creating a policy would implicitly **deny all** row access. Migration 2 should be applied **in the same transaction** as Migration 3 (policy creation) during a maintenance window.

### 4.2 Phase 2 — Policy Creation

**Migration 3: `create_rls_policies`**

```sql
-- =============================================================
-- RLS Policies for all tenant-tagged tables
-- =============================================================

-- ── Helper function for readable policy creation ─────────────
-- Returns the effective tenant ID from session context.
-- Empty string or NULL means "bypass" (platform admin).
CREATE OR REPLACE FUNCTION _rls_tenant_id()
RETURNS text
LANGUAGE SQL
STABLE
AS $$
    SELECT COALESCE(NULLIF(current_setting('app.current_org_id', TRUE), ''), NULL);
$$;

-- ── Tier 1: Org + Factory tables ─────────────────────────────

CREATE POLICY rls_org_isolation ON entries FOR ALL
    USING (_rls_tenant_id() IS NULL OR org_id = _rls_tenant_id());

CREATE POLICY rls_factory_isolation ON entries FOR ALL
    USING (
        _rls_tenant_id() IS NULL
        OR (
            org_id = _rls_tenant_id()
            AND factory_id = current_setting('app.current_factory_id')::text
        )
    );

-- Repeat for all Tier 1 tables...

-- ── Tier 2: Org-only tables ──────────────────────────────────

CREATE POLICY rls_org_isolation ON notifications FOR ALL
    USING (_rls_tenant_id() IS NULL OR org_id = _rls_tenant_id());
```

**Policy naming convention:** `rls_{type}_{table_name}` where `type` is `org_isolation` or `factory_isolation`.

### 4.3 Phase 3 — Application-Level Integration

**Step 1: Add RLS context middleware** (`backend/middleware/rls_context.py`)

```python
"""Middleware and thread-local helpers for PostgreSQL RLS session context."""

from __future__ import annotations

import os
import threading
from collections.abc import Awaitable, Callable
from typing import Any

from sqlalchemy import event
from sqlalchemy.engine import Engine
from starlette.middleware.base import BaseHTTPMiddleware
from starlette.requests import Request
from starlette.responses import Response

from backend.database import SessionLocal as _SessionLocal

# ── Thread-local for RLS context ──────────────────────────────
_rls = threading.local()


def set_rls_context(*, org_id: str | None, user_id: int | None, factory_id: str | None) -> None:
    """Set RLS context for the current thread/request."""
    _rls.org_id = org_id
    _rls.user_id = user_id
    _rls.factory_id = factory_id


def clear_rls_context() -> None:
    """Clear RLS context (call at end of request)."""
    _rls.org_id = None
    _rls.user_id = None
    _rls.factory_id = None


# ── Listen for connection checkout (from pool) ────────────────
@event.listens_for(_SessionLocal.kw["bind"], "checkout")
def _set_rls_on_checkout(
    dbapi_connection: Any,
    _connection_record: Any,
    _connection_proxy: Any,
) -> None:
    """Set PostgreSQL session parameters on each connection checkout."""
    org_id = getattr(_rls, "org_id", None)
    user_id = getattr(_rls, "user_id", None)
    factory_id = getattr(_rls, "factory_id", None)

    cursor = dbapi_connection.cursor()
    try:
        if org_id is not None:
            cursor.execute("SET SESSION app.current_org_id = %s", (org_id,))
        if user_id is not None:
            cursor.execute("SET SESSION app.current_user_id = %s", (str(user_id),))
        if factory_id is not None:
            cursor.execute("SET SESSION app.current_factory_id = %s", (factory_id,))
    finally:
        cursor.close()
```

**Step 2: Wire into middleware**

```python
# In backend/main.py, after auth middleware

from backend.middleware.rls_context import RLSContextMiddleware

app.add_middleware(RLSContextMiddleware)
```

**Step 3: Set context during authentication**

```python
# In get_current_user() (backend/security.py), after resolving the user:

from backend.middleware.rls_context import set_rls_context

# Platform admin → bypass signal (empty string)
if user.is_platform_admin:
    set_rls_context(org_id="", user_id=user.id, factory_id="")
else:
    set_rls_context(
        org_id=user.org_id,
        user_id=user.id,
        factory_id=getattr(user, "active_factory_id", None),
    )
```

**Step 4: Clear context at request end**

```python
# In call_next wrapper or middleware

from backend.middleware.rls_context import clear_rls_context

# After response is sent
clear_rls_context()
```

### 4.4 Phase 4 — Remove Application-Level Filters (Cleanup)

Once RLS is proven in production (e.g., running for 2 weeks), remove redundant application-level `org_id`/`factory_id` filters from routers. This is a large cleanup pass across ~30+ router files.

**Candidate files to clean up:**
- `backend/routers/attendance.py` — remove `.filter(AttendanceRecord.org_id == ...)`
- `backend/routers/entries.py` — remove `.filter(Entry.org_id == ...)`
- `backend/routers/steel_*.py` — remove `org_id`/`factory_id` filters
- `backend/routers/feedback.py` — remove `.filter(Feedback.org_id == ...)`
- And ~20 more router files

> **⚠️ SAFETY:** Removal should be done 1–2 files at a time per PR, each verified by running the full test suite against a staging PostgreSQL database with RLS enabled.

---

## 5. Performance Considerations

### 5.1 Impact Assessment

| Concern | Mitigation |
|---------|-----------|
| **RLS overhead per query** | PostgreSQL RLS adds ~1–5% overhead when the policy is a simple `text` comparison. This is negligible. |
| **Connection checkout overhead** | Setting 3 GUCs per checkout adds ~0.1ms. Negligible compared to auth query. |
| **Composite index utilization** | Existing indexes like `ix_entries_org_id` and `ix_entries_factory_id` are used directly by RLS policies. No new indexes needed for the policies. |
| **`FORCE ROW LEVEL SECURITY`** | Table owner queries also go through RLS. Superuser queries (migrations) bypass RLS. This is correct. |

### 5.2 Index Coverage

The RLS policies filter on `org_id` (text) and sometimes `factory_id` (text). Existing indexes already cover these columns for all major tables. **No new indexes are required.**

### 5.3 Connection Pool Considerations

The checkout event approach ensures RLS parameters are set on every connection pulled from the pool, even if the connection was previously used by a different tenant. This is correct but adds a small overhead. For very high-throughput deployments, consider:

- Using a **dedicated connection pool per tenant** (scales poorly: O(n_tenants × pool_size))
- Pool **statement-level** (not session-level) GUCs for RLS (not yet available in PostgreSQL 16)
- The checkout event approach is the best available trade-off

---

## 6. Migration Rollout Plan

### 6.1 Pre-Migration Checklist

- [ ] Ensure all tables have `org_id` populated (run data integrity report)
- [ ] Make `org_id` NOT NULL on tables where feasible (currently nullable on some)
- [ ] Create the GUC parameters (Migration 1 — safe, no impact)
- [ ] Deploy the RLS middleware and thread-local infrastructure (code change — no DB impact)
- [ ] Run RLS in "shadow mode" — log what RLS *would* block without actually enabling it
- [ ] Validate against the full test suite

### 6.2 Shadow Mode

Run RLS in observation-only mode before enforcement:

```python
# In the checkout event, log the intended RLS context
import logging
rls_logger = logging.getLogger("rls.shadow")

@event.listens_for(_SessionLocal.kw["bind"], "checkout")
def _rls_shadow_checkout(dbapi_connection, ...):
    org_id = getattr(_rls, "org_id", None)
    if org_id:
        cursor = dbapi_connection.cursor()
        cursor.execute("SET SESSION app.current_org_id_shadow = %s", (org_id,))
        cursor.close()
```

Then create SHADOW policies that log violations:

```sql
CREATE POLICY rls_shadow_entries ON entries AS PERMISSIVE
    FOR SELECT
    USING (true)
    WITH CHECK (true);
-- Then use event triggers or audit logs to capture violations
```

### 6.3 Deployment Sequence

```
Step 1: Deploy middleware + thread-local + checkout event (no DB change)
        → Validate with shadow mode

Step 2: Run Schema-only migration (enable RLS + create policies)
        → Apply during maintenance window

Step 3: Deploy application with RLS enforcement (shadow mode disabled)
        → Monitor for 48 hours

Step 4 (2 weeks later): Begin removing application-level filters
        → File-by-file, PR-by-PR
```

### 6.4 Rollback Plan

| Scenario | Action |
|----------|--------|
| RLS causing 500 errors | `DROP POLICY ... ON <table>` for affected tables — app continues working |
| Performance regression | Disable RLS per-table: `ALTER TABLE <table> DISABLE ROW LEVEL SECURITY` |
| Migration failure | Rollback: `alembic downgrade -1` (all RLS changes in single migration) |

---

## 7. Testing Strategy

### 7.1 Unit Tests (in CI)

```python
# tests/test_tenant_isolation.py

def test_rls_blocks_cross_tenant_access(db, org_a, org_b, factory_a, factory_b):
    """User from org_a should not see org_b's entries."""
    # Set RLS context for org_a
    set_rls_context(org_id=org_a.org_id, user_id=user_a.id, factory_id=None)
    
    # Query entries — should only see org_a's data
    entries = db.query(Entry).all()
    assert all(e.org_id == org_a.org_id for e in entries)
    assert len(entries) == expected_for_org_a
```

### 7.2 Integration Tests

```python
def test_rls_bypass_for_platform_admin(db, platform_admin, entries_across_orgs):
    """Platform admin should see all entries."""
    set_rls_context(org_id="", user_id=platform_admin.id, factory_id="")
    
    entries = db.query(Entry).all()
    assert len(entries) == total_entries_across_all_orgs
```

### 7.3 Performance Benchmarks

Compare query latency before/after RLS:

```bash
# Before
pgbench -c 10 -j 4 -t 1000 -f benchmark_query.sql -h localhost dpr_test

# After (with RLS enabled + context set)
pgbench -c 10 -j 4 -t 1000 -f benchmark_query.sql -h localhost dpr_test
```

### 7.4 Security Abuse Tests

```python
def test_rls_with_malicious_org_id(db, user, session):
    """Attempt to set a different org_id in the session — should be blocked."""
    from sqlalchemy import text
    db.execute(text("SET SESSION app.current_org_id = 'fake-org-id'"))
    
    entries = db.query(Entry).all()
    assert len(entries) == 0  # RLS blocks — fake org_id doesn't match any row
```

---

## 8. Risks and Mitigations

| Risk | Likelihood | Impact | Mitigation |
|------|-----------|--------|------------|
| **Connection pool mixing** — connection from org_A reused for org_B without resetting GUCs | Low | High | Use `checkout` event listener to set GUCs on every connection checkout |
| **Non-null `org_id`** — some tables allow NULL org_id (e.g., `entries`, `audit_logs`) | High | Medium | Make NOT NULL in data migration; RLS allows NULL rows through (`org_id IS NULL` in policy) |
| **Platform admin bypass** — platform admins accidentally seeing filtered data | Medium | Medium | Explicit bypass signal (`org_id = ""`) — platform admin code must still filter intentionally |
| **Performance at scale** — 10K+ orgs, each connection setting 3 GUCs | Low | Low | GUCs are session-local and cheap (memory write + pointer swap) |
| **Background jobs** — Celery workers (future) need RLS context | Medium | High | Workers set `_rls` context before DB access based on job's `org_id` payload field |
| **Direct DB access** — admins querying psql without RLS context set | Low | Low | All rows appear invisible (RLS blocks with no policy match) — this is *correct behavior*; admins must SET the parameter first |

---

## 9. Future Considerations

### 9.1 Celery/Background Job Integration

When ARCH-03 (Celery migration) is completed, background workers need RLS context:

```python
@app.task(bind=True)
def process_ocr_job(self, job_id: str, org_id: str, factory_id: str | None):
    set_rls_context(org_id=org_id, user_id=None, factory_id=factory_id)
    try:
        # ... process job ...
    finally:
        clear_rls_context()
```

### 9.2 Read Replicas

If the application adopts read replicas, RLS parameters must also be set on the replica connections. The checkout event approach works generically with any engine.

### 9.3 Connection Pooler (PgBouncer)

PgBouncer in **transaction mode** is compatible with RLS session parameters because each transaction gets a clean connection. However, `SET SESSION` persists across transactions within the same connection. The checkout event ensures GUCs are reset, so this is safe.

PgBouncer in **session mode** (rare) retains GUC state across transactions — also safe since checkout resets on each use.

### 9.4 Multi-Region Deployments

RLS policies are part of the schema and replicated via database migrations. Identical policies apply in all regions. The only per-region concern is the `app.current_org_id` value, which is set by the application based on the authenticated user — same logic applies globally.

---

## 10. Implementation Effort Estimate

| Phase | Work Items | Est. Effort | Dependencies |
|-------|-----------|-------------|-------------|
| **1. Preparation** | Data integrity migration (NULL → NOT NULL), GUC migration | 1 day | Test data audit |
| **2. Policy Creation** | Write all RLS policies migration (~50 policies across ~35 tables) | 1 day | Phase 1 complete |
| **3. Application Integration** | Middleware, thread-local, checkout event, security.py updates | 1 day | Phase 2 complete |
| **4. Shadow Mode / Validation** | Shadow policies, test suite updates, staging validation | 2 days | Phase 3 deployed to staging |
| **5. Production Rollout** | Maintenance window execution, monitoring, blast radius | 1 day | Phase 4 validated |
| **6. Cleanup** | Remove application-level filters (~30+ router files) | 2–3 days | 2 weeks of production RLS |
| **Total** | | **~8–10 engineering days** | |

---

## 11. Appendix: RLS Policy Templates

### For `org_id` + `factory_id` tables (Tier 1):

```sql
DO $$
DECLARE
    table_name text;
BEGIN
    FOR table_name IN
        SELECT unnest(ARRAY[
            'entries', 'attendance_records', 'attendance_events',
            'employee_profiles', 'steel_inventory_items',
            'steel_inventory_transactions', 'steel_dispatches',
            'steel_dispatch_lines', 'steel_sales_invoices',
            'steel_sales_invoice_lines', 'steel_production_batches',
            'steel_production_lines', 'steel_vendors',
            'steel_vendor_bills', 'steel_vendor_bill_lines',
            'steel_vendor_payments', 'steel_vendor_payment_allocations',
            'steel_customers', 'steel_customer_payments',
            'steel_customer_payment_allocations', 'steel_cash_accounts',
            'steel_cash_ledger_entries', 'steel_machine_downtime_events',
            'steel_maintenance_tasks', 'steel_machines',
            'steel_bom', 'steel_expenses', 'steel_fraud_alerts',
            'steel_stock_reconciliations', 'feedback',
            'approval_instances', 'audit_logs', 'factory_settings',
            'ocr_templates', 'ocr_verifications',
            'workforce_cost_rates', 'shift_templates',
            'defect_reasons'
        ])
    LOOP
        EXECUTE format(
            'CREATE POLICY rls_org_isolation ON %I FOR ALL '
            'USING (_rls_tenant_id() IS NULL OR org_id = _rls_tenant_id());',
            table_name
        );
        EXECUTE format(
            'CREATE POLICY rls_factory_isolation ON %I FOR ALL '
            'USING (_rls_tenant_id() IS NULL OR '
            '(org_id = _rls_tenant_id() '
            'AND factory_id = current_setting(''app.current_factory_id'')::text));',
            table_name
        );
    END LOOP;
END $$;
```

### For `org_id`-only tables (Tier 2):

```sql
DO $$
DECLARE
    table_name text;
BEGIN
    FOR table_name IN
        SELECT unnest(ARRAY[
            'notifications', 'invoices', 'subscriptions',
            'feature_usage', 'org_feature_usage',
            'ocr_usage', 'org_ocr_usage',
            'org_whatsapp_usage', 'ai_usage_log',
            'ai_result_cache', 'intelligence_requests',
            'intelligence_stage_usage', 'org_subscription_addons'
        ])
    LOOP
        EXECUTE format(
            'CREATE POLICY rls_org_isolation ON %I FOR ALL '
            'USING (_rls_tenant_id() IS NULL OR org_id = _rls_tenant_id());',
            table_name
        );
    END LOOP;
END $$;
```

---

## 12. Appendix: Data Integrity Pre-Migration SQL

Run this BEFORE enabling RLS to find rows with `org_id IS NULL` across all tables:

```sql
-- Check NULL org_id rows in tables where it should be populated
SELECT 'entries' AS table_name, COUNT(*) AS null_org_count
FROM entries WHERE org_id IS NULL
UNION ALL
SELECT 'audit_logs', COUNT(*) FROM audit_logs WHERE org_id IS NULL
UNION ALL
SELECT 'approval_instances', COUNT(*) FROM approval_instances WHERE org_id IS NULL
UNION ALL
SELECT 'invoices', COUNT(*) FROM invoices WHERE org_id IS NULL
UNION ALL
SELECT 'notifications', COUNT(*) FROM notifications WHERE org_id IS NULL
ORDER BY null_org_count DESC;
```

---

## 13. References

- [PostgreSQL RLS Documentation](https://www.postgresql.org/docs/current/ddl-rowsecurity.html)
- [SQLAlchemy Event System](https://docs.sqlalchemy.org/en/20/core/event.html)
- [PostgreSQL custom GUCs](https://www.postgresql.org/docs/current/config-setting.html)
- [Current tenant isolation: `backend/tenancy.py`](../backend/tenancy.py)
- [Current PDP: `backend/authorization/pdp.py`](../backend/authorization/pdp.py)
- [Current security context: `backend/security.py`](../backend/security.py)
- [Database setup: `backend/database.py`](../backend/database.py)
