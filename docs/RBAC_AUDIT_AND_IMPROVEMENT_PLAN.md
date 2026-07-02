# FactoryNerve RBAC Audit & Improvement Plan

> **Date:** June 16, 2026  
> **Scope:** Role Permission Matrix vs Code Implementation  
> **Author:** Codebuff AI (Thinker-GPT Analysis)

---

## Executive Summary

The current **FactoryNerve Role Permission Matrix** is a strong business-facing draft, but the implementation does **not fully match it**. The core architectural problem is that the system is trying to represent a **domain-split permission model** (operations vs finance, team vs factory vs org scope) using a **single linear role hierarchy**. This creates systematic inconsistencies, hidden privilege risks, and policy drift between documentation and code.

**Bottom line:** The project should move from rank-based hardcoded authorization to a **single-source-of-truth, permission-driven RBAC model** with explicit scope, state, and workflow rules.

---

## Section 1: Current State of Roles

| # | Role | Rank (rbac.py) | Rank (user_service.py) | Description |
|---|------|:--------------:|:----------------------:|-------------|
| 0 | ATTENDANCE | 0 | 0 | Bare minimum access. Mark and view own attendance only. |
| 1 | OPERATOR | 1 | 1 | Shop floor. Production batches, gate entry/exit, stock view. |
| 2 | SUPERVISOR | **3** | **2** | Team lead. Approves operator entries, manages dispatch flow. |
| 3 | ACCOUNTANT | **2** | **2** | Finance only. Invoices, payments, customers, financial OCR. |
| 4 | MANAGER | 4 | 3 | Operational authority. Bridges production and finance. |
| 5 | ADMIN | 5 | 4 | System authority. User management, system config, audit logs. |
| 6 | OWNER | 6 | 5 | Absolute authority. Overrides everything, cross-factory, billing. |

**Key Observation:** `rbac.py` ranks Accountant (2) below Supervisor (3), while `user_service.py` and `auth.py` rank them as equals (both = 2). This inconsistency can cause hidden authorization bugs.

---

## Section 2: Documented Modules vs Missing Modules

### Modules Present in Matrix

| # | Module | Coverage |
|---|--------|----------|
| 1 | Attendance & Workforce | ✅ Good |
| 2 | Steel Production | ✅ Good |
| 3 | Steel Inventory | ✅ Good |
| 4 | Steel Sales & Invoicing | ✅ Good |
| 5 | Payments | ✅ Good |
| 6 | Steel Customers | ✅ Good |
| 7 | Steel Dispatch & Logistics | ✅ Good |
| 8 | OCR & Document Intelligence | ✅ Partial |
| 9 | Operations Alerting | ✅ Partial |
| 10 | User & Access Management | ✅ Good |
| 11 | Billing & Subscription | ✅ Good |
| 12 | System & Audit | ✅ Good |

### Modules Missing from Matrix (but exist in code)

| # | Module | Why It Matters |
|---|--------|----------------|
| A | **Factory Settings / Management** | Factory creation, templates, control tower, multi-factory membership — core admin functionality |
| B | **AI & Intelligence** | AI summaries, recommendations, insights, model usage — separate from OCR |
| C | **Reports & Analytics** | Cross-module analytics, KPI dashboards, production reports — currently scattered |
| D | **Communication Services** | WhatsApp, SMS, Email broadcast — needs explicit permission policy |
| E | **Customer Verification / KYC** | PAN/GST document upload, verification states, approval workflow |
| F | **Factory-Scoped Membership Admin** | UserFactoryRole management — matrix mentions multi-factory but not detailed |
| G | **Observability & Compliance** | Denial logs, audit export, security event monitoring |

---

## Section 3: Code-vs-Matrix Mismatch Table

| # | Area | Matrix Says | Code Implements | Severity | Recommendation |
|---|------|-------------|-----------------|----------|----------------|
| 1 | **ROLE_ORDER** | One consistent hierarchy | 3 different rank tables (rbac.py, auth.py, user_service.py) | 🔴 **High** | Unify into one canonical module |
| 2 | **User Management** | Admin/Owner only | `require_role(MANAGER)` on list/invite/update/deactivate | 🔴 **High** | Either tighten code or update matrix |
| 3 | **Inventory Access** | Accountant excluded | Accountant allowed on items/stock/transactions routes | 🔴 **High** | Add "V" for accountant or tighten code |
| 4 | **Frontend Capabilities** | Should match matrix | Uses `role >= threshold` which treats ACCOUNTANT == SUPERVISOR | 🟡 **Medium** | Use named permissions, not rank thresholds |
| 5 | **OCR Permissions** | Operator excluded | Code allows OPERATOR on some OCR routes | 🟡 **Medium** | Tighten OCR route guards |
| 6 | **Alert Permissions** | Accountant excluded | Code allows ACCOUNTANT on alert routes | 🟡 **Medium** | Tighten alert route guards |
| 7 | **Supervisor Inventory** | Supervisor can create inventory txns | Code requires MANAGER+ for manual transactions | 🟢 **Low** | Add "submit request" permission, approve workflow |
| 8 | **Production Batch Guards** | Production access restricted | Routes may lack explicit require_role checks | 🟡 **Medium** | Audit all steel endpoints |
| 9 | **Denial Audit Trail** | Not documented | No logging of permission denials anywhere | 🟡 **Medium** | Add `authorize()` with audit logging |
| 10 | **Factory-Scoped Roles** | Multi-factory exists | RBAC helpers use `user.role` only, not `UserFactoryRole.role` | 🔴 **High** | Authorization must consider membership role |

---

## Section 4: Core Architectural Issues

### 4.1 — Role Hierarchy Used Where Capability-Based Policy Is Needed

**Problem:** The system uses `require_role(user, minimum_role)` which assumes a higher role inherits all lower role permissions. This works for escalation control but fails for:

- Supervisor vs Accountant (domain peers, not rank steps)
- Operations vs Finance (separate domains, should not inherit each other's permissions)
- Team-level vs Factory-wide vs System-wide access (scope is not captured by rank)

### 4.2 — Three Different ROLE_ORDER Definitions

**`backend/rbac.py`:**
```python
ROLE_ORDER = {
    UserRole.ATTENDANCE: 0,
    UserRole.OPERATOR: 1,
    UserRole.ACCOUNTANT: 2,
    UserRole.SUPERVISOR: 3,  # Supervisor above Accountant
    UserRole.MANAGER: 4,
    UserRole.ADMIN: 5,
    UserRole.OWNER: 6,
}
```

**`backend/services/user_service.py`:**
```python
ROLE_ORDER = {
    UserRole.ATTENDANCE: 0,
    UserRole.OPERATOR: 1,
    UserRole.SUPERVISOR: 2,
    UserRole.ACCOUNTANT: 2,   # Equal to Supervisor
    UserRole.MANAGER: 3,
    UserRole.ADMIN: 4,
    UserRole.OWNER: 5,
}
```

**`backend/routers/auth.py`:**
```python
_ROLE_ORDER = {
    UserRole.ATTENDANCE: 0,
    UserRole.OPERATOR: 1,
    UserRole.SUPERVISOR: 2,
    UserRole.ACCOUNTANT: 2,   # Same as user_service.py
    UserRole.MANAGER: 3,
    UserRole.ADMIN: 4,
    UserRole.OWNER: 5,
}
```

**Impact:** Different rank values in different files means hidden behavior mismatches. For example:
- `rbac.py` considers Accountant below Supervisor, so `require_role(SUPERVISOR)` would deny Accountant
- `auth.py` considers them equal, so an Accountant could pass `role >= SUPERVISOR` checks
- `user_service.py` uses a different max rank (5 vs 6), affecting assignment validation

### 4.3 — Permission Legend Is Semantically Overloaded

| Current Symbol | Problem |
|:--------------:|---------|
| `C` | Used for both "Full CRUD" and "View only" actions (e.g., "View own attendance = C") |
| `A` | Used for both "Create" and "Approve" (e.g., "Create production batch = A" for Supervisor) |
| `V` | Used but not distinguished from "C" in view-only cases |
| Missing | No way to express scope (team vs factory vs org) or state-based rules |

**Recommendation:** Replace `C/V/A/O/—` with explicit action columns: **Read / Create / Update / Delete / Approve / Override**

### 4.4 — Scope Is Hidden in Notes, Not Modeled

Critical scope rules are only in notes:
- "Supervisor sees and approves their **team only**"
- "Manager sees **full workforce**"
- "Accountant views for **invoice reconciliation only**"
- "Owner can override **any locked or completed batch**"

These should be first-class properties of the permission model.

### 4.5 — State-Based Permissions Under-Modeled

The matrix partially captures state (pre-dispatch vs post-dispatch for invoices) but misses:
- Production batch: draft → submitted → approved → posted → locked
- Stock reconciliation: pending → approved → rejected
- Dispatch: pending → loaded → exited → dispatched → delivered → cancelled
- OCR: uploaded → extracted → reviewed → approved → rejected
- Customer verification: draft → pending_review → verified → mismatch → rejected

---

## Section 5: Recommended Future RBAC Architecture

### 5.1 — Use Permissions (Not Role Rank) as the Primary Primitive

Define canonical permission keys using a `module.resource.action` naming convention:

**Attendance:**
- `attendance.self.mark`
- `attendance.self.view`
- `attendance.team.view`
- `attendance.team.edit`
- `attendance.team.approve_leave`
- `attendance.report.view`

**Production:**
- `production.batch.view`
- `production.batch.create`
- `production.batch.edit`
- `production.batch.delete`
- `production.batch.approve`
- `production.batch.override`

**Inventory:**
- `inventory.stock.view`
- `inventory.transaction.create`
- `inventory.reconciliation.submit`
- `inventory.reconciliation.approve`
- `inventory.record.delete`
- `inventory.stock.override`

**Finance:**
- `invoice.view`
- `invoice.create`
- `invoice.edit.pre_dispatch`
- `invoice.edit.post_dispatch`
- `invoice.void`
- `credit_limit.view`
- `credit_limit.override`
- `payment.record`
- `payment.allocate`
- `payment.edit`
- `payment.delete`
- `payment.override_allocation`

**Dispatch:**
- `dispatch.view`
- `dispatch.create`
- `dispatch.status.update`
- `dispatch.status.approve`
- `dispatch.gate.log`
- `dispatch.gate_pass.generate`
- `dispatch.delete`
- `dispatch.quantity.override`

**OCR / AI:**
- `ocr.job.upload.production`
- `ocr.job.upload.finance`
- `ocr.job.review`
- `ocr.job.approve.production`
- `ocr.job.approve.finance`
- `ocr.job.delete`
- `ai.summary.view`
- `ai.insight.view`

**Users / System:**
- `users.view`
- `users.invite`
- `users.role.update`
- `users.deactivate`
- `factory_access.manage`
- `factory.settings.view`
- `factory.settings.update`
- `factory.create`
- `audit.view`
- `billing.view`
- `billing.plan.manage`

### 5.2 — Add Scope Separately

Every permission needs a scope dimension:

| Scope | Meaning |
|-------|---------|
| `self` | Own records only |
| `team` | Team/department scope |
| `factory` | Single factory scope |
| `org` | Organization-wide |
| `cross_factory` | Multiple factories/tenants |
| `system` | Platform-level |

### 5.3 — Add Workflow and State Rules

Add a separate rule layer:

```yaml
rules:
  - permission: invoice.edit.post_dispatch
    requires:
      - reason_required
      - roles_any: [admin, owner]

  - permission: attendance.team.approve_leave
    denies_if:
      - self_approval

  - permission: production.batch.override
    requires:
      - state: [locked, completed]
      - roles_any: [owner]
```

---

## Section 6: Immediate Action Items (Priority)

### P0 — Critical (Fix Now)

| # | Action | Rationale | Effort |
|---|--------|-----------|--------|
| 1 | **Unify ROLE_ORDER into one canonical module** | Remove 3 conflicting rank tables | Small |
| 2 | **Fix user-management permission mismatch** | Matrix says Admin/Owner only, code allows Manager | Medium |
| 3 | **Fix inventory route guards for Accountant** | Matrix says excluded, code allows read | Small |

### P1 — High (Fix This Week)

| # | Action | Rationale | Effort |
|---|--------|-----------|--------|
| 4 | Audit all steel endpoints for explicit permission guards | Production batches may be under-guarded | Medium |
| 5 | Fix OCR route guards to exclude Operator | Matrix says excluded | Small |
| 6 | Fix alert route guards to exclude Accountant | Matrix says excluded | Small |
| 7 | Add denial audit logging to `require_role` / `require_any_role` | No audit trail for 403s | Medium |

### P2 — Medium (Fix This Sprint)

| # | Action | Rationale | Effort |
|---|--------|-----------|--------|
| 8 | Fix frontend capability flags to use permissions, not rank thresholds | Accountant inheriting Supervisor capabilities | Medium |
| 9 | Add missing modules to matrix (Factory Mgmt, AI, Reports, Comms, Verification) | Document completeness | Small |
| 10 | Add scope column to permission matrix | Critical auth dimension currently hidden | Medium |

### P3 — Strategic (Next Quarter)

| # | Action | Rationale | Effort |
|---|--------|-----------|--------|
| 11 | Build a policy engine (`authorize()`) to replace scattered hardcoded checks | Long-term maintainability | Large |
| 12 | Generate docs + frontend navigation from policy source of truth | Eliminate drift permanently | Large |
| 13 | Add automated permission regression tests | Prevent future regressions | Medium |
| 14 | Add segregation-of-duties policy documentation | Governance requirement | Small |

---

## Section 7: Implementation Roadmap

### Phase 1 — Stabilize (Week 1)
1. Unify role constants into `backend/rbac.py` (remove duplicates from `auth.py` and `user_service.py`)
2. Freeze policy mismatches — decide intended behavior for each mismatch
3. Patch high-risk route mismatches (user management, inventory, OCR, alerts)

### Phase 2 — Model Permissions (Week 2-3)
4. Define canonical permission catalog
5. Define role-to-permission bundles with scope
6. Define workflow-state constraints

### Phase 3 — Centralize Authorization (Week 3-4)
7. Build `authorize()` function replacing scattered `require_role()` / `require_any_role()` calls
8. Add centralized denial audit logging
9. Update frontend capability derivation

### Phase 4 — Sync All Layers (Week 4-5)
10. Frontend nav visibility from same policy source
11. Generate matrix markdown as derived artifact
12. Add permission regression tests

### Phase 5 — Governance (Ongoing)
13. Permission review checklist for new routes
14. Route-to-permission linting in CI
15. Periodic access audit exports

---

## Section 8: Final Recommendations

### What to Keep
- **7-role structure** — It maps well to real factory roles
- **Approval vs Override distinction** — Important governance concept
- **Operations/Finance separation** — Core architectural principle
- **Multi-factory data model** — Future-proof foundation
- **Audit logging for write actions** — Existing compliance foundation

### What to Change
- **Stop using role rank for domain permissions** — Use named permissions instead
- **Unify all role definitions** — One canonical source only
- **Add scope and state as explicit dimensions** — Not hidden in notes
- **Add denial audit trail** — Every 403 should be logged
- **Generate docs from code** — Not the other way around
- **Treat Supervisor and Accountant as domain peers** — Not linear hierarchy neighbors

### Vision for the "Perfect" Role Matrix

```
[Role Catalog] → [Permission Registry] → [Role→Permission Map] 
                                        → [Scope Map]
                                        → [Workflow Constraint Rules]
                                        → [Generated Markdown]
                                        → [Frontend Nav Config]
                                        → [Backend authorize() calls]
```

---

*End of Report*
