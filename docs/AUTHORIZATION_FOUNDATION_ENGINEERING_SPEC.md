# Authorization Foundation — Implementation-Ready Engineering Specification

**Status:** Engineering specification (Phase 1 of 4-phase rollout)  
**Target Architecture:** Scoped Policy-Based RBAC with Contextual ABAC  
**Formula:** `Role + Permission + Scope + Maker-Checker + Audit`  
**Date:** June 16, 2026  

---

## Table of Contents

1. [Database Schema](#1-database-schema)
2. [Permission Naming Conventions](#2-permission-naming-conventions)
3. [Permission Lifecycle Model](#3-permission-lifecycle-model)
4. [Role Assignment Model](#4-role-assignment-model)
5. [Scope Hierarchy](#5-scope-hierarchy)
6. [Permission Resolution Algorithm](#6-permission-resolution-algorithm)
7. [Policy Decision Point (PDP) Architecture](#7-policy-decision-point-pdp-architecture)
8. [Policy Enforcement Point (PEP) Architecture](#8-policy-enforcement-point-pep-architecture)
9. [Permission Caching Strategy](#9-permission-caching-strategy)
10. [API Contracts](#10-api-contracts)

---

## Quick Reference

### Installation (Phase 1)

```bash
# 1. Create migration for new tables
alembic revision --autogenerate -m "add_authorization_foundation"
# 2. Seed initial roles and permissions
python scripts/seed_permissions.py
# 3. Backfill existing users into user_factory_roles
python scripts/backfill_user_factory_roles.py
# 4. Enable shadow-mode PDP
# Set env: PDP_MODE=shadow (shadow) or enforce (enforce)
```

### Core Dependency Graph

```
users ──> user_factory_roles ──> roles ──> role_permissions ──> permissions
                                  │                                │
                                  └── permission_conditions ───────┘
approval_rules (standalone, references role_permissions)
authz_decisions (immutable audit log)
```

---

## 1. Database Schema

### 1.1 Table: `roles`

```sql
CREATE TABLE roles (
    id              BIGSERIAL PRIMARY KEY,
    role_key        VARCHAR(64) NOT NULL UNIQUE,       -- e.g. "factory_manager", "org_admin"
    role_family     VARCHAR(32) NOT NULL,              -- "operations" | "governance" | "assurance" | "temporary" | "emergency"
    display_name    VARCHAR(120) NOT NULL,
    description     TEXT,
    is_assignable   BOOLEAN NOT NULL DEFAULT TRUE,      -- FALSE for system-only roles like break-glass
    is_active       BOOLEAN NOT NULL DEFAULT TRUE,
    policy_version  INTEGER NOT NULL DEFAULT 1,         -- bumped on permission change
    created_at      TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at      TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX ix_roles_role_family ON roles(role_family);

COMMENT ON COLUMN roles.role_family IS 'operations|governance|assurance|temporary|emergency';
COMMENT ON COLUMN roles.policy_version IS 'Incremented when the role_permissions mapping changes';
```

**Seed Data:**

| role_key | role_family | display_name | is_assignable |
|----------|-------------|--------------|:-------------:|
| `attendance_user` | operations | Attendance User | TRUE |
| `operator` | operations | Operator | TRUE |
| `supervisor` | operations | Supervisor | TRUE |
| `accountant` | operations | Accountant | TRUE |
| `factory_manager` | operations | Factory Manager | TRUE |
| `org_admin` | governance | Organization Admin | TRUE |
| `security_admin` | governance | Security Admin | TRUE |
| `org_owner` | governance | Organization Owner | TRUE |
| `external_auditor` | assurance | External Auditor | TRUE |
| `contractor` | temporary | Contractor | TRUE |
| `break_glass` | emergency | Break-Glass Access | FALSE |

### 1.2 Table: `permissions`

```sql
CREATE TABLE permissions (
    id                  BIGSERIAL PRIMARY KEY,
    permission_key      VARCHAR(128) NOT NULL UNIQUE,   -- e.g. "attendance.self.punch"
    domain              VARCHAR(64) NOT NULL,            -- e.g. "attendance", "production", "inventory"
    display_name        VARCHAR(200) NOT NULL,
    description         TEXT,
    risk_level          VARCHAR(16) NOT NULL DEFAULT 'low',  -- "low" | "medium" | "high" | "critical"
    allowed_scope_set   VARCHAR(64) NOT NULL,             -- comma-sep: "SELF,DEPT,FACTORY,ORG,SYSTEM"
    requires_maker_checker BOOLEAN NOT NULL DEFAULT FALSE,
    requires_audit      BOOLEAN NOT NULL DEFAULT FALSE,
    requires_mfa        BOOLEAN NOT NULL DEFAULT FALSE,
    owner_role_key      VARCHAR(64),                     -- Domain owner role (e.g. "org_admin" for user.*)
    status              VARCHAR(32) NOT NULL DEFAULT 'active',  -- "draft"|"active"|"deprecated"|"retired"
    policy_version      INTEGER NOT NULL DEFAULT 1,
    created_at          TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at          TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX ix_permissions_domain ON permissions(domain);
CREATE INDEX ix_permissions_status ON permissions(status);
CREATE INDEX ix_permissions_risk_level ON permissions(risk_level);

COMMENT ON COLUMN permissions.allowed_scope_set IS 'Comma-separated scope codes this permission can be granted at';
COMMENT ON COLUMN permissions.owner_role_key IS 'Role responsible for governance of this permission';
```

### 1.3 Table: `role_permissions`

```sql
CREATE TABLE role_permissions (
    id              BIGSERIAL PRIMARY KEY,
    role_id         BIGINT NOT NULL REFERENCES roles(id) ON DELETE CASCADE,
    permission_id   BIGINT NOT NULL REFERENCES permissions(id) ON DELETE CASCADE,
    max_scope       VARCHAR(16) NOT NULL DEFAULT 'SELF',   -- SELF|DEPT|FACTORY|ORG|SYSTEM
    conditions_json JSONB,                                  -- ABAC conditions (optional)
    effective_from  TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    effective_to    TIMESTAMPTZ,                            -- NULL = no expiry
    created_at      TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    UNIQUE (role_id, permission_id)
);

CREATE INDEX ix_role_permissions_role_id ON role_permissions(role_id);
CREATE INDEX ix_role_permissions_permission_id ON role_permissions(permission_id);

COMMENT ON COLUMN role_permissions.max_scope IS 'Maximum scope at which this permission can be exercised for this role';
COMMENT ON COLUMN role_permissions.conditions_json IS 'ABAC conditions as JSON (e.g. {"dept_match": true, "self_only": true})';
```

**Example `conditions_json`**:

```json
// Supervisor can approve attendance only for their own department
{"department_match": true, "not_self": true}

// Accountant can view invoices but only for own factory
{"factory_match": true}
```

### 1.4 Table: `user_factory_roles` (Upgraded)

**Note: This table already exists** as `backend/models/user_factory_role.py`. We extend it with these additional columns.

```sql
ALTER TABLE user_factory_roles ADD COLUMN IF NOT EXISTS role_id BIGINT REFERENCES roles(id);
ALTER TABLE user_factory_roles ADD COLUMN IF NOT EXISTS department_id VARCHAR(64);     -- department-level scope
ALTER TABLE user_factory_roles ADD COLUMN IF NOT EXISTS scope_level VARCHAR(16) NOT NULL DEFAULT 'FACTORY';  -- SELF|DEPT|FACTORY|ORG|SYSTEM
ALTER TABLE user_factory_roles ADD COLUMN IF NOT EXISTS assignment_type VARCHAR(32) NOT NULL DEFAULT 'standard';  -- standard|temporary|exception|audit|contractor
ALTER TABLE user_factory_roles ADD COLUMN IF NOT EXISTS effective_from TIMESTAMPTZ NOT NULL DEFAULT NOW();
ALTER TABLE user_factory_roles ADD COLUMN IF NOT EXISTS effective_to TIMESTAMPTZ;      -- NULL = no expiry
ALTER TABLE user_factory_roles ADD COLUMN IF NOT EXISTS approved_by_user_id BIGINT REFERENCES users(id);
ALTER TABLE user_factory_roles ADD COLUMN IF NOT EXISTS assignment_reason TEXT;
ALTER TABLE user_factory_roles ADD COLUMN IF NOT EXISTS assignment_version INTEGER NOT NULL DEFAULT 1;
ALTER TABLE user_factory_roles ADD COLUMN IF NOT EXISTS updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW();

CREATE INDEX ix_user_factory_roles_scope_level ON user_factory_roles(scope_level);
CREATE INDEX ix_user_factory_roles_effective ON user_factory_roles(effective_from, effective_to);
CREATE INDEX ix_user_factory_roles_role_id ON user_factory_roles(role_id);
```

**Assignment Types:**

| assignment_type | Purpose | Auto-expiry | Can Approve |
|----------------|---------|:-----------:|:-----------:|
| `standard` | Normal standing role assignment | No | Maker-checker |
| `temporary` | Time-bound role (contractor, project) | Yes, `effective_to` | Owner only |
| `exception` | SoD exception or override grant | Yes, max 30 days | Security Admin |
| `audit` | Read-only auditor access | Yes, `effective_to` | Org Owner |
| `break_glass` | Emergency JIT access | Yes, max 24 hours | Dual approval |

### 1.5 Table: `permission_conditions`

```sql
CREATE TABLE permission_conditions (
    id              BIGSERIAL PRIMARY KEY,
    role_permission_id BIGINT NOT NULL REFERENCES role_permissions(id) ON DELETE CASCADE,
    condition_type  VARCHAR(64) NOT NULL,          -- e.g. "resource_owner", "department_match", "factory_match"
    operator        VARCHAR(16) NOT NULL,           -- e.g. "eq", "neq", "in", "not_in", "lt", "gt"
    value           JSONB NOT NULL,
    created_at      TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX ix_permission_conditions_rp_id ON permission_conditions(role_permission_id);
```

**Condition Types:**

| condition_type | operator | value | Description |
|---------------|----------|-------|-------------|
| `resource_owner` | eq | `"current_user"` | Can only act on own records |
| `not_self` | eq | `true` | Cannot act on own records (maker-checker) |
| `department_match` | eq | `true` | Resource department must match user's department |
| `factory_match` | eq | `true` | Resource factory_id must match user's active factory |
| `time_restriction` | in | `["06:00","22:00"]` | Permission only valid during window |
| `mfa_required` | eq | `true` | Session must have MFA |
| `risk_threshold` | lt | `10` | Only if variance % below threshold |
| `workflow_state` | in | `["submitted","pending"]` | Only valid for certain record states |

### 1.6 Table: `approval_rules`

```sql
CREATE TABLE approval_rules (
    id                  BIGSERIAL PRIMARY KEY,
    domain              VARCHAR(64) NOT NULL,       -- e.g. "attendance", "inventory", "dispatch"
    resource_type       VARCHAR(64) NOT NULL,       -- e.g. "AttendanceRecord", "SteelStockReconciliation"
    action_key          VARCHAR(128) NOT NULL,       -- permission key being checked
    maker_permission    VARCHAR(128) NOT NULL,       -- permission for the maker
    checker_permission  VARCHAR(128) NOT NULL,       -- permission for the checker
    maker_role_id       BIGINT REFERENCES roles(id),
    checker_role_id     BIGINT REFERENCES roles(id),
    scope_level         VARCHAR(16) NOT NULL DEFAULT 'FACTORY',
    escalation_role_id  BIGINT REFERENCES roles(id),
    override_role_id    BIGINT REFERENCES roles(id),
    threshold_field     VARCHAR(64),                -- e.g. "variance_percent"
    threshold_operator  VARCHAR(8),                 -- gt, gte, lt, lte
    threshold_value     NUMERIC(14,4),
    requires_reason     BOOLEAN NOT NULL DEFAULT TRUE,
    requires_evidence   BOOLEAN NOT NULL DEFAULT FALSE,
    max_delay_hours     INTEGER,                    -- SLA for approval
    is_active           BOOLEAN NOT NULL DEFAULT TRUE,
    policy_version      INTEGER NOT NULL DEFAULT 1,
    created_at          TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX ix_approval_rules_domain ON approval_rules(domain);
CREATE INDEX ix_approval_rules_resource ON approval_rules(resource_type);
```

### 1.7 Table: `authz_decisions` (Audit Log — New)

```sql
CREATE TABLE authz_decisions (
    id                  BIGSERIAL PRIMARY KEY,
    event_id            UUID NOT NULL DEFAULT gen_random_uuid(),
    event_time          TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    event_type          VARCHAR(64) NOT NULL,        -- e.g. "AUTHZ_ALLOW", "AUTHZ_DENY", "AUTHZ_OVERRIDE"
    severity            VARCHAR(16) NOT NULL,        -- "low" | "medium" | "high" | "critical"
    actor_user_id       BIGINT NOT NULL,
    actor_role_ids      BIGINT[],                    -- active role assignments
    actor_role_keys     TEXT[],                      -- human-readable role keys
    session_id          VARCHAR(128),
    request_id          VARCHAR(128),
    org_id              VARCHAR(64),
    factory_id          VARCHAR(64),
    department_id       VARCHAR(64),
    permission_key      VARCHAR(128),
    scope_evaluated     VARCHAR(16),                 -- SELF|DEPT|FACTORY|ORG|SYSTEM
    decision            VARCHAR(32) NOT NULL,         -- allow|deny|require_approval|require_escalation|require_break_glass
    resource_type       VARCHAR(64),
    resource_id         VARCHAR(128),
    workflow_id         VARCHAR(128),
    approval_rule_id    BIGINT REFERENCES approval_rules(id),
    maker_user_id       BIGINT,
    checker_user_id     BIGINT,
    override_reason_code VARCHAR(64),
    ip_address_hash     VARCHAR(64),
    user_agent          TEXT,
    mfa_level           VARCHAR(16),
    policy_version      INTEGER NOT NULL DEFAULT 1,
    detail              TEXT,
    is_immutable        BOOLEAN NOT NULL DEFAULT TRUE  -- enforced by DB trigger
);

-- Partition by month for performance
CREATE INDEX ix_authz_decisions_event_time ON authz_decisions(event_time DESC);
CREATE INDEX ix_authz_decisions_actor ON authz_decisions(actor_user_id);
CREATE INDEX ix_authz_decisions_permission ON authz_decisions(permission_key);
CREATE INDEX ix_authz_decisions_decision ON authz_decisions(decision);
CREATE INDEX ix_authz_decisions_org ON authz_decisions(org_id);
```

### 1.8 ERD (Text)

```
┌───────────┐       ┌───────────────────┐       ┌─────────────┐
│   users   │1──────*│ user_factory_roles│*──────1│    roles    │
└───────────┘      └───────────────────┘       └──────┬──────┘
                                                       │1
                                                       │
                                                       │*
                                              ┌────────▼────────┐
                                              │ role_permissions │
                                              └────────┬────────┘
                                                       │1
                                                       │*
                                              ┌────────▼────────┐
                                              │   permissions    │
                                              └────────┬────────┘
                                                       │1
                                              ┌────────▼────────┐
                                              │ perm_conditions  │
                                              └─────────────────┘

┌──────────────┐
│ approval_rules│  (standalone, references role_permissions via action_key)
└──────────────┘

┌────────────────┐
│ authz_decisions │  (immutable audit log, references users + approval_rules)
└────────────────┘
```

### 1.9 Migration Script: `backend/models/authz/`

Create new directory and model files:

```
backend/
  models/
    authz/
      __init__.py
      role.py
      permission.py
      role_permission.py
      permission_condition.py
      approval_rule.py
      authz_decision.py
```

---

## 2. Permission Naming Conventions

### 2.1 Format

```
<domain>.<resource>.<action>[.<qualifier>]
```

### 2.2 Rules

1. **Lowercase only** — all segments must be lowercase ASCII
2. **Dot-separated** — exactly 3 or 4 segments
3. **Use present tense** — `create`, `view`, `approve`, not `creating`, `viewing`
4. **Use singular nouns** — `attendance.self.view`, not `attendances.self.view`
5. **Qualifier for overloaded actions** — `invoice.record.edit_pre_dispatch` vs `invoice.record.edit_post_dispatch`

### 2.3 Domain Names

| Domain | Prefix | Example |
|--------|--------|---------|
| Attendance | `attendance.` | `attendance.self.punch` |
| Production | `production.` | `production.entry.create` |
| OCR | `ocr.` | `ocr.document.upload` |
| Inventory | `inventory.` | `inventory.transaction.create` |
| Customer | `customer.` | `customer.record.view` |
| Invoice | `invoice.` | `invoice.record.create` |
| Payment | `payment.` | `payment.record.create` |
| Dispatch | `dispatch.` | `dispatch.record.create` |
| Analytics | `analytics.` | `analytics.operations.view` |
| Reporting | `reporting.` | `reporting.finance.export` |
| Billing | `billing.` | `billing.plan.change` |
| User Management | `user.` | `user.role.assign` |
| Factory | `factory.` | `factory.create` |
| Audit | `audit.` | `audit.log.view` |
| Ops Alerts | `ops_alerts.` | `ops_alerts.configure` |
| Feedback | `feedback.` | `feedback.submit` |
| System | `system.` | `system.observability.view` |

### 2.4 Action Verbs

| Action | Usage |
|--------|-------|
| `view` | Reading/listing records |
| `create` | Creating new records |
| `edit` | Modifying existing records |
| `submit` | Submitting for approval |
| `approve` | Final approval/sign-off |
| `reject` | Rejection |
| `delete` | Permanent removal |
| `cancel` | Cancellation (logical) |
| `void` | Voiding a record |
| `override` | Exceptional override |
| `manage` | Full CRUD + configuration |
| `request` | Requesting an action |
| `review` | Reviewing submissions |
| `retry` | Retrying failed jobs |
| `export` | Data export |
| `send` | Sending communications |
| `configure` | System configuration |
| `certify` | Access certification |
| `switch` | Context switching |

### 2.5 Scope Suffix (Implicit)

Scope is **not** part of the permission key. It is stored in `role_permissions.max_scope` and evaluated at runtime. This allows the same permission key to be granted at different scopes to different roles.

---

## 3. Permission Lifecycle Model

### 3.1 Lifecycle Stages

```
┌───────┐    ┌──────────┐    ┌──────────┐    ┌───────────┐    ┌────────────┐    ┌────────────┐
│ DRAFT │───▶│ REVIEWED │───▶│ APPROVED │───▶│ ACTIVATED │───▶│ DEPRECATED │───▶│  RETIRED   │
└───────┘    └──────────┘    └──────────┘    └───────────┘    └────────────┘    └────────────┘
                                                                                       │
                                                                                       ▼
                                                                                 (Soft delete,
                                                                                  historic only)
```

### 3.2 Stage Transitions

| Transition | Trigger | Who | Validation |
|------------|---------|-----|------------|
| Draft → Reviewed | Permission author completes spec | Domain owner | All required fields filled |
| Reviewed → Approved | Governance review passes | Security Admin | No naming violations; no toxic combinations with existing permissions |
| Approved → Activated | Code merged + deployed | System (CI/CD) | Migration runs; PDP reloads |
| Activated → Deprecated | Replacement permission exists or removal needed | Domain Owner | Migration period announced (min 2 billing cycles) |
| Deprecated → Retired | All role_permissions cleaned up | System | No active references remain |

### 3.3 Required Fields for Each Permission

Every permission must define:

| Field | Required | Description |
|-------|:--------:|-------------|
| `permission_key` | ✅ | Unique dot-notation key |
| `domain` | ✅ | Domain grouping |
| `display_name` | ✅ | Human-readable name |
| `description` | ✅ | Purpose and when to use |
| `risk_level` | ✅ | low/medium/high/critical |
| `allowed_scope_set` | ✅ | Comma-separated (at least one) |
| `requires_maker_checker` | ✅ | Whether approval flow is needed |
| `requires_audit` | ✅ | Whether every evaluation is audited |
| `owner_role_key` | ✅ | Governance owner |

### 3.4 Certification Cadence

| Risk Level | Certification Required | Review By |
|------------|:---------------------:|-----------|
| Low | Annual | Domain Owner |
| Medium | Semi-annual | Domain Owner + Security Admin |
| High | Quarterly | Domain Owner + Security Admin |
| Critical | Quarterly | Security Admin + Org Owner |

### 3.5 Deprecation Policy

1. Deprecated permissions remain in the schema for **90 days minimum**
2. All role_permissions referencing a deprecated permission must be updated within that window
3. PDP logs a warning (but allows) deprecated permission usage
4. After retirement, PDP returns `DENY` for retired permissions
5. A migration script (`scripts/prune_retired_permissions.py`) cleans up retired rows

---

## 4. Role Assignment Model

### 4.1 Assignment Rules

1. A user **must** have at least one `user_factory_roles` assignment to exercise any permission
2. A user **may** have multiple assignments (different roles in different factories)
3. A user **may** have org-wide governance roles without any factory operational assignment
4. All assignments are **explicit** — no implicit inheritance
5. Temporary assignments (contractor, exception) **must** have an `effective_to` value
6. A user cannot hold **both** `org_admin` and `security_admin` standing roles simultaneously

### 4.2 Assignment Flow

```
User Invite/Update
        │
        ▼
┌─────────────────────────┐
│ Validate target role     │
│ • Is role assignable?    │
│ • Does current user have │
│   user.role.assign perm? │
│ • SoD / toxic combo      │
│   check passes?          │
└─────────────────────────┘
        │
        ▼
┌─────────────────────────┐
│ Create assignment        │
│ • user_id                │
│ • role_id                │
│ • org_id                 │
│ • factory_id (nullable)  │
│ • department_id          │
│ • scope_level            │
│ • assignment_type        │
│ • effective_from/to      │
│ • approved_by_user_id    │
└─────────────────────────┘
        │
        ▼
┌─────────────────────────┐
│ Audit log entry          │
│ event_type: ROLE_ASSIGN  │
└─────────────────────────┘
```

### 4.3 Assignment Validation Rules

```python
# pseudocode in backend/services/authorization/assignment_service.py

def validate_assignment(
    *,
    current_user: User,
    target_user: User,
    target_role: Role,
    scope_level: str,
    factory_id: str | None,
) -> ValidationResult:
    # 1. Is the target_role assignable?
    if not target_role.is_assignable:
        return DENY("Role is not assignable")

    # 2. Does current_user have user.role.assign?
    if not has_permission(current_user, "user.role.assign", scope=scope_level):
        return DENY("No permission to assign roles")

    # 3. Check toxic combinations (static)
    existing_roles = get_user_roles(target_user)
    if is_toxic_combination(existing_roles + [target_role.key]):
        return DENY(f"Toxic combination: {target_role.key} conflicts with existing roles")

    # 4. For temporary assignments, effective_to is required
    if target_role.role_family == "temporary" and not assignment.effective_to:
        return DENY("Temporary assignments require an expiry date")

    # 5. For ORG scope, factory_id must be None
    if scope_level == "ORG" and factory_id is not None:
        return DENY("ORG-scoped assignments cannot have a factory_id")

    # 6. For FACTORY scope, factory_id is required
    if scope_level == "FACTORY" and factory_id is None:
        return DENY("FACTORY-scoped assignments require a factory_id")

    return ALLOW
```

### 4.4 Assignment Change Audit Events

| Event | Description | Severity |
|-------|-------------|:--------:|
| `ROLE_ASSIGN` | New role assigned to user | medium |
| `ROLE_UNASSIGN` | Role removed from user | medium |
| `ROLE_CHANGE` | Existing role's scope or expiry changed | high |
| `ROLE_TEMP_GRANT` | Temporary exception grant | high |
| `ROLE_EXPIRY_SOON` | Temporary assignment expiring within 7 days | low (notification) |
| `ROLE_EXPIRED` | Temporary assignment auto-expired | medium |

---

## 5. Scope Hierarchy

### 5.1 Scope Levels

```
Level 0: SYSTEM     — Platform-wide (very few: observability, audit exports)
Level 1: ORG        — Organization-wide (billing, user management, audit)
Level 2: FACTORY    — Single factory (inventory, production, dispatch)
Level 3: DEPT       — Department within a factory (team attendance, team production)
Level 4: SELF       — Personal records only (own attendance, own entries)
```

### 5.2 Containment Rules

- `SYSTEM` contains `ORG` contains `FACTORY` contains `DEPT` contains `SELF`
- A permission granted at `max_scope=FACTORY` is valid for all `DEPT` and `SELF` within that factory
- A permission granted at `max_scope=ORG` is valid for all factories within that org
- A permission granted at `max_scope=DEPT` is **not** valid for other departments
- A permission granted at `max_scope=SELF` is only valid for the user's own records

### 5.3 Scope Resolution

```python
def resolve_scope(
    *,
    resource_org_id: str,
    resource_factory_id: str | None,
    resource_department_id: str | None,
    resource_user_id: int,
    actor_assignments: list[UserFactoryRole],
    permission_max_scope: str,  # from role_permissions
) -> bool:
    """
    Returns True if the actor's assignment scope covers the resource scope.
    
    Hierarchical: SYSTEM > ORG > FACTORY > DEPT > SELF
    """
    # Get the highest scope level from the actor's assignments
    actor_scope = max(a.scope_level for a in actor_assignments)
    
    # Get the scope level of the resource
    if resource_user_id and resource_user_id == actor_assignments[0].user_id:
        resource_scope = "SELF"
    elif resource_department_id:
        resource_scope = "DEPT"
    elif resource_factory_id:
        resource_scope = "FACTORY"
    else:
        resource_scope = "ORG"
    
    # Check containment using hierarchy
    scope_rank = {
        "SYSTEM": 0,
        "ORG": 1,
        "FACTORY": 2,
        "DEPT": 3,
        "SELF": 4,
    }
    
    # The permission's max_scope limits how broad the grant can be
    effective_scope = min(scope_rank[actor_scope], scope_rank[permission_max_scope])
    effective_scope_key = {v: k for k, v in scope_rank.items()}[effective_scope]
    
    # Check if the effective scope covers the resource
    return scope_rank[effective_scope_key] <= scope_rank[resource_scope]
```

### 5.4 Factory Isolation

```python
def validate_factory_isolation(
    *,
    actor: User,
    resource_factory_id: str | None,
    actor_assignments: list[UserFactoryRole],
) -> bool:
    """
    Ensures the actor has an assignment covering the resource's factory.
    - ORG-scoped assignments bypass factory check
    - FACTORY-scoped assignments must match the resource's factory_id
    """
    if not resource_factory_id:
        return True  # No factory context to check
    
    org_scoped = any(a.scope_level == "ORG" for a in actor_assignments)
    if org_scoped:
        return True
    
    factory_scoped = any(
        a.scope_level == "FACTORY" and a.factory_id == resource_factory_id
        for a in actor_assignments
    )
    if factory_scoped:
        return True
    
    # Check department-level assignments
    dept_scoped = any(
        a.scope_level == "DEPT" and a.factory_id == resource_factory_id
        for a in actor_assignments
    )
    return dept_scoped
```

---

## 6. Permission Resolution Algorithm

### 6.1 Full Resolution Pipeline

```python
def resolve(
    *,
    actor: User,
    permission_key: str,
    resource: ResourceContext | None = None,   # optional for read endpoints
    request_context: RequestContext,
) -> Decision:
    """
    Resolve whether an actor can perform an action.
    
    Returns one of:
    - ALLOW
    - DENY (with reason)
    - ALLOW_WITH_AUDIT
    - REQUIRE_APPROVAL (maker-checker needed)
    - REQUIRE_ESCALATION
    - REQUIRE_BREAK_GLASS
    """
    # Step 1: Get active role assignments for the actor
    assignments = get_active_assignments(actor, request_context)
    if not assignments:
        return _deny("No active role assignments", severity="medium")
    
    # Step 2: Get the permission record
    perm = get_permission(permission_key)
    if not perm or perm.status != "active":
        return _deny(f"Permission '{permission_key}' not active", severity="medium")
    
    # Step 3: Find matching role_permissions
    matching_rps = []
    for rp in get_role_permissions([a.role_id for a in assignments]):
        if rp.permission_id == perm.id:
            matching_rps.append(rp)
    
    if not matching_rps:
        return _deny(f"No role has permission '{permission_key}'", severity="low")
    
    # Step 4: Evaluate ABAC conditions for each matching role_permission
    valid_rps = []
    for rp in matching_rps:
        if _evaluate_conditions(rp.conditions_json, actor, resource):
            valid_rps.append(rp)
    
    if not valid_rps:
        return _deny("No matching conditions satisfied", severity="low")
    
    # Step 5: Scope containment check
    scope_check_passed = False
    for rp in valid_rps:
        if _check_scope(rp, assignments, resource):
            scope_check_passed = True
            break
    
    if not scope_check_passed:
        return _deny("Permission not valid at current scope", severity="medium")
    
    # Step 6: Factory isolation check
    if resource and resource.factory_id:
        if not validate_factory_isolation(
            actor=actor,
            resource_factory_id=resource.factory_id,
            actor_assignments=assignments,
        ):
            return _deny("Factory isolation violation", severity="high")
    
    # Step 7: Maker-checker rule evaluation
    if perm.requires_maker_checker and resource:
        maker_checker_result = _evaluate_maker_checker(
            permission_key=permission_key,
            actor=actor,
            resource=resource,
        )
        if maker_checker_result != ALLOW:
            return maker_checker_result
    
    # Step 8: Toxic combination check (runtime)
    if _is_runtime_toxic_combination(actor, permission_key, resource):
        return _deny("Toxic combination blocked at runtime", severity="high")
    
    # Step 9: Session assurance check
    if perm.requires_mfa and not request_context.mfa_verified:
        return _deny("MFA required for this action", severity="high")
    
    # Step 10: Determine if audit is needed
    requires_audit = perm.requires_audit or any(
        rp.permission_id == perm.id for rp in valid_rps if rp.requires_audit
    )
    
    # Step 11: Return decision
    decision = ALLOW_WITH_AUDIT if requires_audit else ALLOW
    
    # Step 12: Log the decision
    _log_decision(
        decision=decision,
        actor=actor,
        permission_key=permission_key,
        resource=resource,
        request_context=request_context,
    )
    
    return decision
```

### 6.2 Context Data Types

```python
@dataclass
class ResourceContext:
    org_id: str
    factory_id: str | None = None
    department_id: str | None = None
    user_id: int | None = None          # resource owner
    workflow_state: str | None = None   # e.g. "submitted", "approved"
    risk_value: float | None = None     # e.g. variance %, amount

@dataclass
class RequestContext:
    request_id: str
    session_id: str
    ip_address: str | None
    user_agent: str | None
    mfa_verified: bool
    active_org_id: str | None
    active_factory_id: str | None
    active_department_id: str | None

@dataclass
class Decision:
    result: Literal["allow", "deny", "require_approval", "require_escalation", "require_break_glass"]
    reason: str | None = None
    audit_event_id: str | None = None
```

### 6.3 Condition Evaluator

```python
def _evaluate_conditions(
    conditions: dict | None,
    actor: User,
    resource: ResourceContext | None,
) -> bool:
    """Evaluate ABAC conditions from role_permissions.conditions_json."""
    if not conditions:
        return True  # No conditions = unconditional access
    
    for cond_type, cond_value in conditions.items():
        if cond_type == "resource_owner":
            if not resource or resource.user_id != actor.id:
                return False
        elif cond_type == "not_self":
            if resource and resource.user_id == actor.id:
                return False
        elif cond_type == "department_match":
            if not resource or not resource.department_id:
                return False
            # Would need to check actor's active department assignment
        elif cond_type == "factory_match":
            if not resource or not resource.factory_id:
                return False
        elif cond_type == "workflow_state":
            if not resource or resource.workflow_state not in cond_value:
                return False
        elif cond_type == "risk_threshold":
            if resource and resource.risk_value is not None:
                if resource.risk_value >= cond_value:
                    return False
    
    return True
```

---

## 7. Policy Decision Point (PDP) Architecture

### 7.1 Core Service: `backend/services/authorization/pdp.py`

```python
"""
Policy Decision Point (PDP)
---------------------------
Central authorization engine. All authz decisions flow through here.

Modes:
  - shadow:   Evaluate + log but never DENY (phase 1)
  - enforce:  Evaluate + log + DENY when unauthorized (phase 3)
  - bypass:   Skip all checks (emergency override, feature flag off)
"""

from __future__ import annotations

import os
import uuid
from dataclasses import dataclass
from datetime import datetime, timezone
from enum import Enum
from functools import lru_cache
from typing import Any

from backend.models.authz.role import Role
from backend.models.authz.permission import Permission
from backend.models.authz.role_permission import RolePermission
from backend.models.authz.authz_decision import AuthzDecision
from backend.models.user import User
from backend.models.user_factory_role import UserFactoryRole


class PDPDecision(str, Enum):
    ALLOW = "allow"
    DENY = "deny"
    ALLOW_WITH_AUDIT = "allow_with_audit"
    REQUIRE_APPROVAL = "require_approval"
    REQUIRE_ESCALATION = "require_escalation"
    REQUIRE_BREAK_GLASS = "require_break_glass"


class PDP:
    """
    Thread-safe, session-scoped PDP instance.
    
    Usage:
        pdp = PDP(db=db, mode=os.getenv("PDP_MODE", "shadow"))
        decision = pdp.authorize(
            actor=current_user,
            permission_key="inventory.transaction.create",
            resource=ResourceContext(factory_id=factory.factory_id),
            request_context=RequestContext(request_id=req_id, ...)
        )
    """

    def __init__(self, db: Any, *, mode: str = "shadow"):
        self.db = db
        self.mode = mode  # "shadow" | "enforce" | "bypass"
        self._policy_cache: dict[str, Any] = {}

    def authorize(
        self,
        *,
        actor: User,
        permission_key: str,
        resource: ResourceContext | None = None,
        request_context: RequestContext,
    ) -> PDPDecision:
        """Main authorization entry point. Returns a decision."""
        
        # Bypass mode = skip all checks
        if self.mode == "bypass":
            return self._log_and_return(
                decision=PDPDecision.ALLOW,
                actor=actor,
                permission_key=permission_key,
                resource=resource,
                request_context=request_context,
                reason="PDP bypass mode",
            )

        # Shadow mode = evaluate + log but never deny
        decision = self._resolve(actor, permission_key, resource, request_context)
        
        if self.mode == "shadow" and decision == PDPDecision.DENY:
            # In shadow mode, log the denial but return ALLOW
            self._log_decision(
                decision=decision,
                actor=actor,
                permission_key=permission_key,
                resource=resource,
                request_context=request_context,
                reason="SHADOW MODE: would have denied",
            )
            return PDPDecision.ALLOW
        
        return decision

    def assert_permission(
        self,
        *,
        actor: User,
        permission_key: str,
        resource: ResourceContext | None = None,
        request_context: RequestContext,
    ) -> None:
        """
        Convenience wrapper that raises HTTPException(403) on DENY.
        To be used as a drop-in replacement for require_role().
        """
        from fastapi import HTTPException
        
        decision = self.authorize(
            actor=actor,
            permission_key=permission_key,
            resource=resource,
            request_context=request_context,
        )
        if decision in (PDPDecision.DENY,):
            raise HTTPException(status_code=403, detail="Access denied.")

    def _resolve(
        self,
        actor: User,
        permission_key: str,
        resource: ResourceContext | None,
        request_context: RequestContext,
    ) -> PDPDecision:
        """
        Core resolution pipeline.
        
        Steps:
        1. Get active role assignments
        2. Get permission record
        3. Find matching role_permissions
        4. Evaluate ABAC conditions
        5. Scope containment check
        6. Factory isolation check
        7. Maker-checker evaluation
        8. Runtime toxic combo check
        9. Session assurance check
        """
        # Step 1
        assignments = self._get_active_assignments(actor, request_context)
        if not assignments:
            return PDPDecision.DENY

        # Step 2
        perm = self._get_permission(permission_key)
        if not perm or perm.status != "active":
            return PDPDecision.DENY

        # Step 3
        matching_rps = self._get_matching_role_permissions(
            [a.role_id for a in assignments], perm.id
        )
        if not matching_rps:
            return PDPDecision.DENY

        # Step 4: Evaluate conditions
        valid_rps = [
            rp for rp in matching_rps
            if self._evaluate_conditions(rp.conditions_json, actor, resource)
        ]
        if not valid_rps:
            return PDPDecision.DENY

        # Step 5: Scope containment
        if not self._check_scope(valid_rps, assignments, resource):
            return PDPDecision.DENY

        # Step 6: Factory isolation
        if resource and resource.factory_id:
            if not self._check_factory_isolation(actor, resource.factory_id, assignments):
                return PDPDecision.DENY

        # Step 7: Maker-checker
        if perm.requires_maker_checker and resource:
            mc_result = self._check_maker_checker(
                permission_key, actor, resource
            )
            if mc_result != PDPDecision.ALLOW:
                return mc_result

        # Step 8: Runtime toxic combo
        if self._is_toxic_combo(actor, permission_key, resource):
            return PDPDecision.DENY

        # Step 9: Session assurance
        if perm.requires_mfa and not request_context.mfa_verified:
            return PDPDecision.DENY

        # Determine audit requirement
        requires_audit = perm.requires_audit or any(
            rp.requires_audit for rp in valid_rps
        )

        return PDPDecision.ALLOW_WITH_AUDIT if requires_audit else PDPDecision.ALLOW

    def _get_active_assignments(
        self, actor: User, ctx: RequestContext
    ) -> list[UserFactoryRole]:
        """Get active role assignments for the current context."""
        now = datetime.now(timezone.utc)
        return (
            self.db.query(UserFactoryRole)
            .filter(
                UserFactoryRole.user_id == actor.id,
                UserFactoryRole.effective_from <= now,
                (UserFactoryRole.effective_to.is_(None) | (UserFactoryRole.effective_to >= now)),
            )
            .all()
        )

    @lru_cache(maxsize=1024)
    def _get_permission(self, key: str) -> Permission | None:
        return (
            self.db.query(Permission)
            .filter(Permission.permission_key == key)
            .first()
        )

    def _get_matching_role_permissions(
        self, role_ids: list[int], permission_id: int
    ) -> list[RolePermission]:
        """Find all role_permissions matching the given roles and permission."""
        return (
            self.db.query(RolePermission)
            .filter(
                RolePermission.role_id.in_(role_ids),
                RolePermission.permission_id == permission_id,
                RolePermission.effective_from <= datetime.now(timezone.utc),
                (RolePermission.effective_to.is_(None) | (RolePermission.effective_to >= datetime.now(timezone.utc))),
            )
            .all()
        )

    def _evaluate_conditions(self, conditions: dict | None, actor: User, resource: ResourceContext | None) -> bool:
        """Evaluate ABAC conditions."""
        if not conditions:
            return True
        # ... (see Section 6.3)
        return True

    def _check_scope(self, role_permissions: list, assignments: list, resource: ResourceContext | None) -> bool:
        """Check scope containment."""
        # ... (see Section 5.3)
        return True

    def _check_factory_isolation(self, actor: User, factory_id: str, assignments: list) -> bool:
        """Verify factory isolation."""
        # ... (see Section 5.4)
        return True

    def _check_maker_checker(self, permission_key: str, actor: User, resource: ResourceContext) -> PDPDecision:
        """Evaluate maker-checker rules."""
        # Check self-approval
        if resource.user_id and resource.user_id == actor.id:
            return PDPDecision.DENY
        
        # Check approval rules
        approval_rule = self._get_approval_rule(permission_key)
        if not approval_rule:
            return PDPDecision.ALLOW
        
        # Check if the resource already has a checker (i.e., this is the maker step)
        if resource.workflow_state in ("pending_approval",):
            return PDPDecision.REQUIRE_APPROVAL
        
        return PDPDecision.ALLOW

    def _is_toxic_combo(self, actor: User, permission_key: str, resource: ResourceContext | None) -> bool:
        """Check runtime toxic combinations."""
        # Implement static and runtime toxic combo checks
        return False

    def _log_decision(
        self, decision: PDPDecision, actor: User, permission_key: str,
        resource: ResourceContext | None, request_context: RequestContext,
        reason: str | None = None,
    ) -> None:
        """Persist an authz decision to the audit log."""
        event_type = f"AUTHZ_{decision.upper()}"
        severity = "low" if decision == PDPDecision.ALLOW else "high"
        
        log_entry = AuthzDecision(
            event_id=str(uuid.uuid4()),
            event_time=datetime.now(timezone.utc),
            event_type=event_type,
            severity=severity,
            actor_user_id=actor.id,
            permission_key=permission_key,
            decision=decision.value,
            request_id=request_context.request_id,
            session_id=request_context.session_id,
            org_id=request_context.active_org_id,
            factory_id=request_context.active_factory_id,
            detail=reason,
        )
        self.db.add(log_entry)
        self.db.flush()
```

### 7.2 PDP Modes

| Mode | Behavior | Used In |
|------|----------|---------|
| `bypass` | Returns ALLOW for everything, no logging | Emergency, development, testing |
| `shadow` | Evaluates + logs all decisions, but returns ALLOW even for DENY | Phase 1 — safe introduction |
| `enforce` | Evaluates + logs + returns actual decision | Phase 3+ — production |

### 7.3 Environment Configuration

```python
# backend/config/authorization.py

PDP_MODE = os.getenv("PDP_MODE", "shadow")           # bypass | shadow | enforce
PDP_CACHE_TTL = int(os.getenv("PDP_CACHE_TTL", "300")) # seconds
AUTHZ_DECISION_LOG_ENABLED = os.getenv("AUTHZ_DECISION_LOG_ENABLED", "1") == "1"
AUTHZ_CACHE_ENABLED = os.getenv("AUTHZ_CACHE_ENABLED", "1") == "1"
DENIAL_LOG_SEVERITY = os.getenv("DENIAL_LOG_SEVERITY", "high")
```

---

## 8. Policy Enforcement Point (PEP) Architecture

### 8.1 FastAPI Middleware

```python
# backend/middleware/authorization.py

import uuid
from fastapi import Request, Response
from starlette.middleware.base import BaseHTTPMiddleware
from starlette.types import ASGIApp

from backend.services.authorization.pdp import PDP, PDPDecision
from backend.services.authorization.context import (
    build_request_context,
    build_resource_context,
)
from backend.config.authorization import PDP_MODE, AUTHZ_DECISION_LOG_ENABLED


class AuthorizationMiddleware(BaseHTTPMiddleware):
    """
    FastAPI middleware that intercepts requests and evaluates authorization.
    
    The middleware:
    1. Extracts the permission key from the route (via route metadata or mapping)
    2. Calls PDP.authorize()
    3. On DENY, returns 403 with audit event
    4. On shadow mode, logs but allows
    
    For endpoints without explicit permission mapping, the middleware
    falls back to the existing require_role() pattern (backward compatible).
    """
    
    # Route-to-permission mapping (initially empty, populated incrementally)
    ROUTE_PERMISSION_MAP: dict[str, dict[str, str]] = {}
    
    def __init__(self, app: ASGIApp):
        super().__init__(app)
        self.pdp = PDP(db=None, mode=PDP_MODE)  # db injected per-request
    
    async def dispatch(self, request: Request, call_next) -> Response:
        # Build context
        request_id = str(uuid.uuid4())
        request.state.request_id = request_id
        
        # Skip PEP for public routes
        if self._is_public_route(request.url.path):
            return await call_next(request)
        
        # Get permission mapping for this route
        perm_key = self._get_permission_for_route(request)
        
        if not perm_key:
            # No explicit mapping — fall through to existing require_role() checks
            return await call_next(request)
        
        # Build context and evaluate
        request_context = build_request_context(request)
        
        decision = self.pdp.authorize(
            actor=request.user,  # populated by get_current_user dependency
            permission_key=perm_key,
            resource=build_resource_context(request),
            request_context=request_context,
        )
        
        if decision in (PDPDecision.DENY,):
            return Response(
                status_code=403,
                content={"detail": "Access denied.", "authz_event_id": request_id},
                media_type="application/json",
            )
        
        # Attach authz metadata to request state
        request.state.authz_decision = decision
        request.state.authz_permission_key = perm_key
        
        response = await call_next(request)
        return response
    
    def _is_public_route(self, path: str) -> bool:
        """Check if route is public (no auth required)."""
        public_prefixes = [
            "/auth/register", "/auth/login", "/auth/google",
            "/auth/password", "/auth/verify-email",
            "/auth_secure/register", "/auth_secure/login",
            "/plans", "/ocr/status",
            "/webhook", "/ready", "/docs", "/openapi.json",
        ]
        return any(path.startswith(prefix) for prefix in public_prefixes)
    
    def _get_permission_for_route(self, request: Request) -> str | None:
        """Look up the permission key for this route."""
        key = f"{request.method}:{request.url.path}"
        return self.ROUTE_PERMISSION_MAP.get(key)
```

### 8.2 Decorator for Endpoint-Level PEP

```python
# backend/decorators/authorization.py

from functools import wraps
from fastapi import HTTPException, Depends
from backend.services.authorization.pdp import PDP
from backend.security import get_current_user
from backend.models.user import User


def require_permission(
    permission_key: str,
    *,
    scope: str | None = None,
    resource_factory: callable = None,
):
    """
    Decorator for route handlers that require a specific permission.
    
    Usage:
        @router.post("/inventory/items")
        @require_permission("inventory.item.manage", scope="factory")
        def create_inventory_item(...):
            ...
    
    Replaces:
        require_role(current_user, UserRole.MANAGER)
    """
    def decorator(func):
        @wraps(func)
        async def wrapper(*args, **kwargs):
            # Extract current_user from kwargs (injected by Depends)
            current_user = kwargs.get("current_user")
            if not current_user:
                raise HTTPException(status_code=401, detail="Authentication required.")
            
            # Build resource context (optional)
            resource = None
            if resource_factory:
                resource = resource_factory(**kwargs)
            
            # Get PDP from request state or create one
            request = kwargs.get("request")
            pdp = getattr(request.state, "pdp", None) if request else None
            if not pdp:
                pdp = PDP(db=None, mode=os.getenv("PDP_MODE", "shadow"))
            
            # Evaluate
            decision = pdp.authorize(
                actor=current_user,
                permission_key=permission_key,
                resource=resource,
                request_context=build_request_context(request),
            )
            
            if decision in (PDPDecision.DENY,):
                raise HTTPException(status_code=403, detail="Access denied.")
            
            return await func(*args, **kwargs)
        return wrapper
    return decorator
```

### 8.3 Permission Manifest Endpoint

```python
# backend/routers/auth.py — add endpoint

@router.get("/permissions")
def get_my_permissions(
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
) -> dict:
    """
    Returns all permissions the current user has, grouped by scope.
    Used by the frontend to conditionally render UI elements.
    """
    pdp = PDP(db=db, mode="enforce")
    assignments = pdp._get_active_assignments(current_user)
    
    if not assignments:
        return {"permissions": [], "role_keys": []}
    
    role_ids = [a.role_id for a in assignments]
    rps = (
        db.query(RolePermission)
        .filter(RolePermission.role_id.in_(role_ids))
        .all()
    )
    permission_ids = [rp.permission_id for rp in rps]
    perms = (
        db.query(Permission)
        .filter(Permission.id.in_(permission_ids), Permission.status == "active")
        .all()
    )
    
    return {
        "permissions": sorted([p.permission_key for p in perms]),
        "role_keys": list(set(
            r.role_key
            for r in db.query(Role).filter(Role.id.in_(role_ids)).all()
        )),
        "user_id": current_user.id,
    }
```

### 8.4 PEP Integration Points

| Layer | PEP Type | Implementation |
|-------|----------|----------------|
| API | Middleware (opt-in) | `AuthorizationMiddleware` — fast path for routes with `ROUTE_PERMISSION_MAP` entries |
| API | Decorator (per-endpoint) | `@require_permission("key")` — explicit per-endpoint |
| API | Manual (inline) | `pdp.assert_permission(actor=..., permission_key=...)` — for complex logic |
| Background Jobs | Manual | Inject actor context from the job payload |
| Exports | Manual | Check permission before generating export |
| Frontend | Manifest endpoint | `GET /auth/permissions` — UI conditional rendering |

---

## 9. Permission Caching Strategy

### 9.1 Cache Layers

```
┌─────────────────────────────────────────────────────────────────┐
│                         Layer 1: In-Memory                      │
│  LRU cache in PDP instance (per-request or short TTL)           │
│  Keys: permission_key → Permission record                       │
│  Keys: role_id → list[RolePermission]                           │
│  TTL: 5 minutes (configurable)                                  │
├─────────────────────────────────────────────────────────────────┤
│                         Layer 2: Redis                          │
│  User permission manifests (pre-computed)                       │
│  Keys: authz:manifest:{user_id}:{org_id}                        │
│  Value: list of (permission_key, max_scope, conditions)         │
│  TTL: 5 minutes, invalidated on role_assignment_version change  │
├─────────────────────────────────────────────────────────────────┤
│                         Layer 3: Database                       │
│  Source of truth                                                │
│  All tables have policy_version column for cache invalidation   │
└─────────────────────────────────────────────────────────────────┘
```

### 9.2 User Permission Manifest (Pre-computed)

```python
def get_user_permission_manifest(
    db: Session,
    user_id: int,
    org_id: str | None,
) -> dict:
    """
    Pre-compute a user's permissions as a flat manifest for fast PDP evaluation.
    
    Cache key: authz:manifest:{user_id}:{org_id}
    Invalidated when: user_factory_roles, role_permissions, or permissions change
    """
    now = datetime.now(timezone.utc)
    
    assignments = (
        db.query(UserFactoryRole)
        .filter(
            UserFactoryRole.user_id == user_id,
            UserFactoryRole.effective_from <= now,
            (UserFactoryRole.effective_to.is_(None) | (UserFactoryRole.effective_to >= now)),
        )
        .all()
    )
    
    if not assignments:
        return {"permissions": [], "version": 0}
    
    role_ids = [a.role_id for a in assignments]
    
    rps = (
        db.query(RolePermission)
        .filter(
            RolePermission.role_id.in_(role_ids),
            RolePermission.effective_from <= now,
            (RolePermission.effective_to.is_(None) | (RolePermission.effective_to >= now)),
        )
        .all()
    )
    
    permission_ids = [rp.permission_id for rp in rps]
    perms = (
        db.query(Permission)
        .filter(Permission.id.in_(permission_ids), Permission.status == "active")
        .all()
    )
    perm_map = {p.id: p for p in perms}
    
    manifest = []
    for rp in rps:
        perm = perm_map.get(rp.permission_id)
        if not perm:
            continue
        manifest.append({
            "permission_key": perm.permission_key,
            "max_scope": rp.max_scope,
            "conditions": rp.conditions_json,
            "risk_level": perm.risk_level,
            "requires_mfa": perm.requires_mfa,
            "requires_maker_checker": perm.requires_maker_checker,
        })
    
    return {
        "permissions": manifest,
        "version": max(
            [a.assignment_version for a in assignments] + [0]
        ),
    }
```

### 9.3 Cache Invalidation Events

| Event | Invalidation Scope | Action |
|-------|--------------------|--------|
| `user_factory_roles` INSERT/UPDATE/DELETE | Specific user + org | Invalidate `authz:manifest:{user_id}:{org_id}` |
| `role_permissions` INSERT/UPDATE/DELETE | All users with that role | Invalidate all manifests containing that role |
| `permissions` status change | All manifests | Invalidate entire permission cache |
| Role assignment version bump | Specific user + org | Invalidate `authz:manifest:{user_id}:{org_id}` |
| User deactivated | Specific user + org | Invalidate + prevent new evaluations |

### 9.4 Cache Key Schema

```python
# Redis cache keys

# User permission manifest (pre-computed flat list)
authz:manifest:{user_id}:{org_id}

# Permission record by key
authz:perm:{permission_key}

# Role data
authz:role:{role_id}

# Role permission mappings
authz:role_perms:{role_id}

# Policy version (global, incremented on any change)
authz:policy_version
```

### 9.5 Cache Performance Targets

| Operation | Target Latency |
|-----------|:--------------:|
| PDP evaluation (warm cache, manifest hit) | < 5ms |
| PDP evaluation (cold cache, full DB resolve) | < 50ms |
| Permission manifest endpoint | < 100ms |
| Cache invalidation propagation | < 1s |

---

## 10. API Contracts

### 10.1 `authorize()`

```python
# backend/services/authorization/pdp.py

def authorize(
    self,
    *,
    actor: User,
    permission_key: str,
    resource: ResourceContext | None = None,
    request_context: RequestContext,
) -> PDPDecision:
    """
    Core authorization function.
    
    Args:
        actor: The user requesting the action
        permission_key: Dot-notation permission key (e.g. "inventory.transaction.create")
        resource: Context about the resource being accessed (optional for views)
        request_context: Request-level context (session, MFA, IP, etc.)
    
    Returns:
        PDPDecision enum value
    
    Raises:
        No exceptions in normal operation.
        Logs all decisions to authz_decisions table.
    
    Example:
        decision = pdp.authorize(
            actor=current_user,
            permission_key="inventory.transaction.create",
            resource=ResourceContext(factory_id=factory.factory_id),
            request_context=RequestContext(request_id="abc", ...),
        )
        if decision == PDPDecision.DENY:
            raise HTTPException(status_code=403)
    """
```

### 10.2 `require_permission()`

```python
# backend/decorators/authorization.py — decorator
# OR
# backend/services/authorization/pdp.py — inline helper

def require_permission(
    self,
    *,
    actor: User,
    permission_key: str,
    resource: ResourceContext | None = None,
    request_context: RequestContext,
) -> None:
    """
    Authorization guard that raises HTTPException(403) on DENY.
    
    This is the primary API for route handlers. 
    Drop-in replacement for require_role() / require_any_role().
    
    Args:
        actor: The user requesting the action
        permission_key: Dot-notation permission key
        resource: Resource context (optional)
        request_context: Request context
    
    Raises:
        HTTPException(403) with "Access denied." if unauthorized
    
    Example:
        pdp.require_permission(
            actor=current_user,
            permission_key="inventory.transaction.create",
            resource=ResourceContext(factory_id=factory.factory_id),
            request_context=build_request_context(request),
        )
        # If we get here, permission is granted
    """
```

### 10.3 `require_permission_set()` — Multi-Permission Check

```python
def require_permission_set(
    self,
    *,
    actor: User,
    permission_keys: list[str],
    logic: Literal["any", "all"] = "any",
    resource: ResourceContext | None = None,
    request_context: RequestContext,
) -> None:
    """
    Check multiple permissions at once.
    
    Args:
        actor: The user
        permission_keys: List of permission keys to check
        logic: "any" = at least one, "all" = all required
        resource: Resource context
        request_context: Request context
    
    Raises:
        HTTPException(403) if the required logic is not satisfied
    """
    results = [
        self.authorize(
            actor=actor,
            permission_key=key,
            resource=resource,
            request_context=request_context,
        )
        for key in permission_keys
    ]
    
    allowed = [
        r in (PDPDecision.ALLOW, PDPDecision.ALLOW_WITH_AUDIT)
        for r in results
    ]
    
    if logic == "any" and not any(allowed):
        raise HTTPException(status_code=403, detail="Access denied.")
    elif logic == "all" and not all(allowed):
        raise HTTPException(status_code=403, detail="Access denied.")
```

### 10.4 `RequirePermission` Dependency — FastAPI Integration

```python
# backend/dependencies/authorization.py

from fastapi import Depends, HTTPException, Request
from backend.security import get_current_user
from backend.models.user import User
from backend.services.authorization.pdp import PDP
from backend.services.authorization.context import build_request_context


class RequirePermission:
    """
    FastAPI dependency class for route-level permission checks.
    
    Usage:
        @router.get("/inventory/items")
        def list_items(
            _: None = Depends(RequirePermission("inventory.item.view")),
            current_user: User = Depends(get_current_user),
            ...
        ):
            ...
    """
    
    def __init__(self, permission_key: str, scope: str | None = None):
        self.permission_key = permission_key
        self.scope = scope
    
    async def __call__(self, request: Request, current_user: User = Depends(get_current_user)) -> None:
        pdp = PDP(db=request.state.db, mode=os.getenv("PDP_MODE", "shadow"))
        pdp.require_permission(
            actor=current_user,
            permission_key=self.permission_key,
            request_context=build_request_context(request),
        )
```

### 10.5 Frontend Permission Manifest API

```http
GET /api/auth/permissions
Authorization: Bearer <token>

Response 200:
{
    "permissions": [
        "attendance.self.punch",
        "attendance.self.view",
        "production.entry.create",
        ...
    ],
    "role_keys": ["operator"],
    "user_id": 42,
    "version": 3
}
```

### 10.6 Denial Audit Event Schema

```json
{
    "event_id": "uuid",
    "event_time": "2026-06-16T10:30:00Z",
    "event_type": "AUTHZ_DENY",
    "severity": "high",
    "actor_user_id": 42,
    "actor_role_keys": ["operator"],
    "session_id": "sess_abc123",
    "request_id": "req_def456",
    "org_id": "org_001",
    "factory_id": "fac_001",
    "permission_key": "inventory.transaction.create",
    "scope_evaluated": "FACTORY",
    "decision": "deny",
    "resource_type": "SteelInventoryTransaction",
    "resource_id": null,
    "detail": "No active role assignment covers this action",
    "policy_version": 1
}
```

---

## Appendix A: Migration Sequence

### Phase 1 — Foundation (This spec)

```
Week 1-2:
├── Create new tables (roles, permissions, role_permissions, permission_conditions)
├── Create authz_decisions table (immutable audit log)
├── Update user_factory_roles with new columns (role_id FK, scope_level, etc.)
├── Seed initial roles and permissions from catalog
├── Backfill existing users into new user_factory_roles schema
├── Implement PDP core (resolve pipeline)
└── Deploy in shadow mode

Week 3-4:
├── Implement PEP middleware (opt-in mapping)
├── Implement @require_permission decorator
├── Add permission manifest endpoint
├── Implement caching (in-memory + Redis)
└── Begin route-to-permission mapping (start with AI/intelligence P0)
```

### Appendix B: File Checklist

```
New files to create:
  backend/models/authz/__init__.py
  backend/models/authz/role.py
  backend/models/authz/permission.py
  backend/models/authz/role_permission.py
  backend/models/authz/permission_condition.py
  backend/models/authz/approval_rule.py
  backend/models/authz/authz_decision.py
  backend/services/authorization/__init__.py
  backend/services/authorization/pdp.py
  backend/services/authorization/context.py
  backend/services/authorization/cache.py
  backend/services/authorization/conditions.py
  backend/services/authorization/scope.py
  backend/decorators/authorization.py
  backend/dependencies/authorization.py
  backend/middleware/authorization.py
  backend/config/authorization.py
  backend/scripts/seed_permissions.py
  backend/scripts/backfill_user_factory_roles.py
  alembic/versions/xxxx_add_authorization_foundation.py

Files to modify:
  backend/rbac.py (deprecate, point to new PDP)
  backend/models/user.py (add role_revision usage)
  backend/models/user_factory_role.py (add new columns)
  alembic/env.py (include new models)
```

---

*End of Engineering Specification — Phase 1 of the 4-phase Authorization Rollout*
