# DPR.ai Target-State Authorization & Governance Architecture

**For:** CTO, CISO, ERP Program, Engineering, Executive Approval, Enterprise Customer Security Review  
**Scope:** Multi-factory steel manufacturing SaaS, 1 → 1000+ factories  
**Design Standard:** Final target-state, not incremental patching  
**Date:** June 16, 2026  

---

## Executive Position

DPR.ai should adopt a **Scoped Policy-Based Authorization Architecture** with the following non-negotiable formula:

> **Authorization = Role + Permission + Scope + Maker-Checker + Audit**

This architecture deliberately rejects:
- Role hierarchy and rank comparisons
- Implicit inheritance
- "Super admin can do everything" bypasses
- Mixed governance and operations roles

The target state separates:
1. Business execution
2. Business approval
3. Governance administration
4. Security oversight
5. Emergency access
6. Audit assurance

The result is an authorization model that is scalable across 1000+ factories, safe for finance and production coexistence, resistant to permission drift, ready for enterprise customer review, and compatible with procurement, maintenance, vendor portal, and auditor expansion.

---

## Table of Contents

1. [Organizational Governance Model](#1-organizational-governance-model)
2. [Authorization Architecture](#2-authorization-architecture)
3. [Permission Catalog](#3-permission-catalog)
4. [Scope & Tenant Architecture](#4-scope--tenant-architecture)
5. [Approval & Maker-Checker Framework](#5-approval--maker-checker-framework)
6. [Security & Political Risk Assessment](#6-security--political-risk-assessment)
7. [Audit & Compliance Architecture](#7-audit--compliance-architecture)
8. [Migration & Rollout Strategy](#8-migration--rollout-strategy)
9. [Target-State Authorization Schema](#9-target-state-authorization-schema)
10. [Enterprise Readiness Assessment](#10-enterprise-readiness-assessment)

---

# 1. Organizational Governance Model

## 1.1 Governance Design Principles

1. **No rank-based authority** — A role is not "higher" than another. Authority is defined only by explicit permissions at explicit scopes.
2. **Business and governance roles must be separate** — Daily operations must not be mixed with identity/security governance.
3. **Every controlled workflow has a named owner** — No "shared accountability."
4. **Every override is exceptional** — Time-bound, reason-bound, and audit-bound.
5. **Every approval has maker-checker separation** — Same person cannot make and approve the same controlled action.
6. **Tenant boundaries are default-deny** — No cross-factory access unless explicitly assigned.

## 1.2 Target-State Role Model

### Role Families

| Family | Roles |
|--------|-------|
| **A. Factory Operations** | Attendance User, Operator, Supervisor, Accountant, Factory Manager |
| **B. Governance** | Org Admin, Security Admin, Org Owner |
| **C. Assurance / External** | External Auditor, Contractor |
| **D. Emergency** | Break-Glass Access (JIT only, not standing) |

## 1.3 Role Responsibilities and Boundaries

| Role | Primary Purpose | Owns | Can Approve | Cannot Do | Override Authority |
|------|----------------|------|-------------|-----------|--------------------|
| Attendance User | Self-service workforce interaction | Own attendance actions | None | Team attendance, approvals, finance, stock, user mgmt | None |
| Operator | Shop-floor execution | Data capture, production input, gate actions | None | Final approvals, stock reconciliation approval, finance actions | None |
| Supervisor | First-line operational control | Team review, OCR ops review, dispatch progression | Team-level operational approvals | Finance approvals, billing, role governance | Limited workflow exceptions only |
| Accountant | Finance processing | Customers, invoices, payments, finance OCR | Finance document/process approvals | Production approvals, dispatch operational approvals, user governance | Limited finance exceptions |
| Factory Manager | Factory business owner | Operational accountability, cross-functional coordination | Factory-level operational approvals and commercial exceptions | Identity governance, security governance, global billing governance | Controlled factory-level override |
| Org Admin | Identity and tenancy administrator | User lifecycle, factory memberships, non-security admin config | Access provisioning approvals | Operational transaction approvals, finance overrides, security event closure | None on business transactions |
| Security Admin | Security governance authority | Policy governance, audit review, break-glass administration, SoD exceptions | Security exception approvals | Business transaction creation/editing, invoice/payment/dispatch ops | Emergency access governance only |
| Org Owner | Commercial and legal authority | Organization-wide governance, billing, final exception authority | Strategic and exceptional approvals | Routine operational approvals | Final exceptional override |
| External Auditor | Independent assurance | Read-only review of scoped records and audit trails | None | Any create/edit/delete/approve/override | None |
| Contractor | Temporary scoped execution | Narrow task-based actions | None | Governance, approvals, finance, user mgmt | None |
| Break-Glass Access | Emergency intervention | Time-bound emergency remediation | Only emergency corrective actions | Standing access, routine use | Temporary only |

## 1.4 Approval Ownership Model

| Domain | Workflow Owner | Primary Checker | Escalation Approver | Final Override |
|--------|---------------|----------------|--------------------|----------------|
| Attendance | Supervisor | Factory Manager | Org Owner | Org Owner |
| Production Entries | Supervisor | Factory Manager | Org Owner | Org Owner |
| OCR Operational Docs | Supervisor | Factory Manager | Org Owner | Org Owner |
| OCR Finance Docs | Accountant | Factory Manager or second Accountant | Org Owner | Org Owner |
| Inventory | Factory Manager | Factory Manager (different identity) | Org Owner | Org Owner |
| Production Batches | Factory Manager | Supervisor/Factory Manager | Org Owner | Org Owner |
| Dispatch | Factory Manager | Supervisor / Factory Manager | Org Owner | Org Owner |
| Customer Verification | Accountant | Factory Manager / second Accountant | Org Owner | Org Owner |
| Invoices | Accountant | Factory Manager for exceptions | Org Owner | Org Owner |
| Payments | Accountant | Factory Manager for overrides | Org Owner | Org Owner |
| Credit Overrides | Factory Manager | Org Owner | Org Owner | Org Owner |
| User/Factory Access | Org Admin | Security Admin | Org Owner | Org Owner |
| Billing | Org Owner | Security Admin informed | Org Owner | Org Owner |
| Security Exceptions | Security Admin | Org Owner | Org Owner | Org Owner |

## 1.5 Escalation Chains

| Workflow Class | Level 1 | Level 2 | Level 3 |
|---------------|---------|---------|---------|
| Workforce / Attendance | Supervisor | Factory Manager | Org Owner |
| Production / Dispatch / OCR Ops | Supervisor | Factory Manager | Org Owner |
| Finance / Credit / Payment | Accountant | Factory Manager | Org Owner |
| Access / Membership / Factory Governance | Org Admin | Security Admin | Org Owner |
| Security / Break-Glass / SoD Exception | Security Admin | Org Owner | Post-incident review |
| Billing / Subscription | Org Admin | Org Owner | Platform support |

## 1.6 Governance RACI (Decision Rights)

| Governance Decision | Attendance User | Operator | Supervisor | Accountant | Factory Manager | Org Admin | Security Admin | Org Owner | Auditor |
|-------------------|:---:|:---:|:---:|:---:|:---:|:---:|:---:|:---:|:---:|
| Role catalog approval | I | I | C | C | C | R | A | A | I |
| Permission catalog change | I | I | C | C | C | R | A | A | I |
| Factory creation | I | I | I | I | C | R | C | A | I |
| User invite (standard roles) | I | I | I | I | C | R | C | A | I |
| Factory membership change | I | I | I | I | C | R | A | A | I |
| SoD exception approval | I | I | I | I | C | C | R | A | I |
| Break-glass activation | I | I | I | I | I | I | R | A | I |
| High-risk stock override | I | I | C | C | R | I | C | A | I |
| Credit override | I | I | I | R | R | I | C | A | I |
| Post-dispatch invoice edit | I | I | I | C | C | I | C | A | I |
| Billing plan change | I | I | I | I | C | C | C | A/R | I |
| Audit review / export governance | I | I | I | I | I | C | A/R | A | C |

## 1.7 Separation-of-Duties Principles

1. **No self-approval** — for attendance, OCR, inventory reconciliation, production variance, dispatch status, invoice exceptions, or payments
2. **No standing combination of Org Admin and Security Admin** for the same user
3. **No Auditor with mutable permissions**
4. **No Contractor with approval or override permissions**
5. **No same-user maker and checker** on the same workflow instance
6. **No same-user invoice creation and post-dispatch edit** as standing authority
7. **No same-user inventory creation and reconciliation approval** in same factory
8. **No same-user dispatch creation and quantity override** as standing authority
9. **No same-user payment creation and reversal approval**
10. **No break-glass as persistent assignment**

## 1.8 Conflict Prevention Rules

| Conflict | Prevention Rule |
|----------|----------------|
| Factory Manager vs Accountant power overlap | Finance exceptions require dual participation; credit override always needs Factory Manager + Org Owner |
| Admin becoming shadow business owner | Org Admin forbidden from routine operational approvals |
| Owner bottlenecking daily work | Org Owner reserved for exceptions, not normal workflow |
| Supervisor favoritism | Team approvals logged with maker-checker and sampled for review |
| Cross-factory political leakage | No implicit org-wide operational permissions; scopes must be explicit |
| Security overreach | Security Admin cannot mutate business transactions |
| Small factory staffing | Temporary SoD exceptions allowed only with expiry + compensating audit |

---

# 2. Authorization Architecture

## 2.1 Model Comparison

| Model | Strengths | Weaknesses | Fit |
|-------|-----------|------------|-----|
| RBAC | Simple, understandable, easy to administer | Too coarse; role explosion; drift risk | Necessary but insufficient |
| ABAC | Fine-grained, contextual | Hard to reason about, difficult to audit | Useful for conditions only |
| PBAC | Explicit policies, scalable governance, strong auditability | Requires policy discipline | Strong fit |
| Scope-based | Excellent tenant isolation and least privilege | Not enough alone for approvals and SoD | Essential foundation |

## 2.2 Recommended Hybrid Model

> **Scoped Policy-Based RBAC with Contextual ABAC Conditions**

- **RBAC** for baseline job identity (roles define default permission bundles)
- **Scope-based assignment** for tenant isolation (permissions valid within Self/Department/Factory/Organization/Enterprise Group/System)
- **PBAC** for workflow enforcement (maker-checker, state transitions, approvals, overrides, toxic combinations, emergency access)
- **ABAC only for contextual conditions** (resource owner, department match, factory match, employment type, record state, risk threshold, time-bound, session assurance level)

## 2.3 Architecture Components

| Component | Purpose |
|-----------|---------|
| **PAP** (Policy Administration Point) | Manage roles, permissions, approval rules, SoD rules, toxic combos |
| **PDP** (Policy Decision Point) | Central decision service: allow / deny / require approval / require escalation |
| **PEP** (Policy Enforcement Point) | API middleware, job workers, UI action guards, export handlers |
| **PIP** (Policy Information Point) | Supplies user assignments, resource scope, workflow state, risk flags |
| **Audit Sink** | Immutable event capture for all authz and approval activity |

## 2.4 Decision Model

A request is evaluated using:
1. Actor identity
2. Assigned role(s) in current context
3. Permission requested
4. Scope match
5. Workflow state rule
6. Maker-checker rule
7. Toxic-combination rule
8. Session assurance rule (e.g., MFA required for high-risk actions)
9. Audit requirement
10. **Decision output**

Decision outputs: `ALLOW`, `DENY`, `ALLOW_WITH_AUDIT`, `REQUIRE_APPROVAL`, `REQUIRE_ESCALATION`, `REQUIRE_BREAK_GLASS`

## 2.5 Permission Lifecycle Governance

Every permission must have: unique versioned key, domain owner, security owner, risk tier, allowed scopes, allowed roles, SoD rules, audit requirement, quarterly review cadence, and deprecation path.

**Lifecycle Stages**: Draft → Reviewed → Approved → Activated → Certified → Deprecated → Retired

## 2.6 Rules for Future Role Creation

A new role may be created only if:
1. At least 3 stable permissions form a repeatable bundle
2. At least 2 factories or business units need it
3. A business owner is named
4. A security owner signs off
5. Toxic combination review is passed
6. It reduces ambiguity rather than increasing it
7. It is not better solved as scope restriction, approval rule, or temporary exception

## 2.7 Contractor & Auditor Access

- **Contractors**: factory-specific, time-bound, non-approving, non-financial, non-governance, mandatory expiry, no overrides
- **Auditors**: read-only, scope-limited, time-windowed, export-controlled, masked-view capable

## 2.8 Emergency / Break-Glass Access

- Not a standing role
- Approved JIT with dual authorization
- Time-limited with reason code
- Requester ≠ approver
- Security Admin + Org Owner approval for production access
- Auto-expiry, forced MFA, session watermark
- Post-incident review within 24 hours

---

# 3. Permission Catalog

## 3.1 Scope Legend

| Code | Scope |
|------|-------|
| SELF | Own records only |
| DEPT | Department-level |
| FACTORY | Single factory |
| ORG | Organization-wide |
| SYSTEM | Platform/security scope |

## 3.2 Role Legend

- ATT = Attendance User, OPR = Operator, SUP = Supervisor
- ACC = Accountant, FM = Factory Manager
- OA = Org Admin, SA = Security Admin, OO = Org Owner
- AUD = External Auditor, CTR = Contractor, BGA = Break-Glass

## 3.3 Permission Governance Rules

- No direct permanent user-permission grants except audited exceptions
- Roles receive permissions through role_permissions
- Exception grants must expire automatically
- Critical permissions require quarterly certification
- All override permissions require reason + evidence + audit
- All approve permissions must reference an approval rule

## 3.4 Domain Permission Matrices

### attendance.*

| Permission | Risk | Scope | Roles |
|-----------|:----:|-------|-------|
| attendance.self.view | Low | SELF | ATT, OPR, SUP, ACC, FM |
| attendance.self.punch | Med | SELF | ATT, OPR, SUP, ACC, FM, CTR |
| attendance.self.regularization.request | Med | SELF | ATT, OPR, SUP, ACC, FM, CTR |
| attendance.team.view | Med | DEPT, FACTORY | SUP[DEPT], FM[FACTORY] |
| attendance.review.queue.view | Med | DEPT, FACTORY | SUP[DEPT], FM[FACTORY] |
| attendance.review.approve | High | DEPT, FACTORY | SUP[DEPT], FM[FACTORY] |
| attendance.review.reject | High | DEPT, FACTORY | SUP[DEPT], FM[FACTORY] |
| attendance.profile.manage | Med | FACTORY | FM[FACTORY], OA[ORG] |
| attendance.shift_template.manage | Med | FACTORY | FM[FACTORY], OA[ORG] |
| attendance.report.view | Med | DEPT, FACTORY, ORG | SUP[DEPT], FM[FACTORY], OA[ORG], OO[ORG], AUD[ORG] |
| attendance.override | **Critical** | FACTORY, ORG | FM[FACTORY], OO[ORG], BGA[TEMP] |

### production.*

| Permission | Risk | Scope | Roles |
|-----------|:----:|-------|-------|
| production.entry.create | Med | SELF, DEPT | OPR[SELF/DEPT], SUP[DEPT], CTR[DEPT] |
| production.entry.edit_own_draft | Med | SELF | OPR, SUP |
| production.entry.submit | Med | SELF, DEPT | OPR, SUP |
| production.entry.view_team | Med | DEPT | SUP[DEPT] |
| production.entry.view_factory | Med | FACTORY | FM[FACTORY], OA[ORG], OO[ORG], AUD |
| production.entry.review | High | DEPT, FACTORY | SUP[DEPT], FM[FACTORY] |
| production.entry.approve | High | DEPT, FACTORY | SUP[DEPT], FM[FACTORY] |
| production.entry.reject | High | DEPT, FACTORY | SUP[DEPT], FM[FACTORY] |
| production.summary.request | Med | FACTORY | SUP, FM |
| production.override | **Critical** | FACTORY, ORG | FM[FACTORY], OO[ORG], BGA[TEMP] |

### ocr.*

| Permission | Risk | Scope | Roles |
|-----------|:----:|-------|-------|
| ocr.document.upload | Med | DEPT, FACTORY | SUP[DEPT], ACC[FACTORY], FM[FACTORY], CTR[DEPT] |
| ocr.preview.view | Med | DEPT, FACTORY | SUP, ACC, FM |
| ocr.verification.edit | High | DEPT, FACTORY | SUP[DEPT], ACC[FACTORY], FM[FACTORY] |
| ocr.verification.submit | High | DEPT, FACTORY | SUP[DEPT], ACC[FACTORY] |
| ocr.verification.approve_ops | High | DEPT, FACTORY | SUP[DEPT], FM[FACTORY] |
| ocr.verification.approve_finance | High | FACTORY | ACC[FACTORY], FM[FACTORY] |
| ocr.template.view | Med | FACTORY, ORG | SUP, ACC, FM, OA, SA, OO |
| ocr.template.manage | High | FACTORY, ORG | FM[FACTORY], OA[ORG] |
| ocr.job.view | Med | FACTORY, ORG | SUP, ACC, FM, OA, OO, AUD |
| ocr.job.retry | High | FACTORY, ORG | FM[FACTORY], OA[ORG] |
| ocr.override | **Critical** | FACTORY, ORG | FM[FACTORY], OO[ORG], BGA[TEMP] |

### inventory.*

| Permission | Risk | Scope | Roles |
|-----------|:----:|-------|-------|
| inventory.item.view | Low | FACTORY | SUP, ACC, FM, OA, OO, AUD |
| inventory.item.manage | High | FACTORY | FM[FACTORY], OA[ORG] |
| inventory.ledger.view | Med | FACTORY, ORG | SUP, ACC, FM, OA, OO, AUD |
| inventory.transaction.create | High | FACTORY | FM[FACTORY] |
| inventory.reconciliation.submit | High | FACTORY | SUP[FACTORY], FM[FACTORY] |
| inventory.reconciliation.approve | **Critical** | FACTORY | FM[FACTORY], OO[ORG] |
| inventory.reconciliation.reject | High | FACTORY | FM[FACTORY], OO[ORG] |
| inventory.report.view | Med | FACTORY, ORG | ACC, FM, OA, OO, AUD |
| inventory.stock.override | **Critical** | FACTORY, ORG | OO[ORG], BGA[TEMP] |

### customer.*

| Permission | Risk | Scope | Roles |
|-----------|:----:|-------|-------|
| customer.record.view | Med | FACTORY, ORG | ACC, FM, OA, OO, AUD |
| customer.record.manage | High | FACTORY | ACC[FACTORY], FM[FACTORY] |
| customer.verification.request | High | FACTORY | ACC[FACTORY] |
| customer.verification.review | High | FACTORY | ACC[FACTORY], FM[FACTORY] |
| customer.followup.manage | Med | FACTORY | ACC, FM |
| customer.credit.view | High | FACTORY, ORG | ACC, FM, OO, AUD |
| customer.credit.override | **Critical** | FACTORY, ORG | FM[FACTORY], OO[ORG] |

### invoice.*

| Permission | Risk | Scope | Roles |
|-----------|:----:|-------|-------|
| invoice.record.view | High | FACTORY, ORG | ACC, FM, OA, OO, AUD |
| invoice.record.create | High | FACTORY | ACC[FACTORY] |
| invoice.record.edit_pre_dispatch | High | FACTORY | ACC[FACTORY] |
| invoice.record.edit_post_dispatch | **Critical** | FACTORY, ORG | FM[FACTORY], OO[ORG] |
| invoice.record.void | **Critical** | FACTORY, ORG | FM[FACTORY], OO[ORG] |
| invoice.exception.approve | **Critical** | FACTORY, ORG | FM[FACTORY], OO[ORG] |
| invoice.report.view | High | FACTORY, ORG | ACC, FM, OO, AUD |

### payment.*

| Permission | Risk | Scope | Roles |
|-----------|:----:|-------|-------|
| payment.record.view | High | FACTORY, ORG | ACC, FM, OO, AUD |
| payment.record.create | High | FACTORY | ACC[FACTORY] |
| payment.allocation.create | High | FACTORY | ACC[FACTORY] |
| payment.record.edit | High | FACTORY | ACC[FACTORY] |
| payment.allocation.reallocate | **Critical** | FACTORY, ORG | FM[FACTORY], OO[ORG] |
| payment.record.reverse | **Critical** | FACTORY, ORG | FM[FACTORY], OO[ORG] |
| payment.override | **Critical** | ORG | OO[ORG], BGA[TEMP] |

### dispatch.*

| Permission | Risk | Scope | Roles |
|-----------|:----:|-------|-------|
| dispatch.record.view | Med | FACTORY, ORG | OPR, SUP, ACC(limited), FM, OA, OO, AUD |
| dispatch.record.create | High | FACTORY | SUP[FACTORY], FM[FACTORY] |
| dispatch.gate.log | Med | FACTORY | OPR[FACTORY], SUP[FACTORY] |
| dispatch.status.update | High | FACTORY | SUP[FACTORY], FM[FACTORY] |
| dispatch.status.approve | High | FACTORY | FM[FACTORY] |
| dispatch.record.cancel | **Critical** | FACTORY, ORG | FM[FACTORY], OO[ORG] |
| dispatch.quantity.override | **Critical** | FACTORY, ORG | FM[FACTORY], OO[ORG] |

### analytics.* / reporting.* / billing.*

| Permission | Risk | Scope | Roles |
|-----------|:----:|-------|-------|
| analytics.operations.view | Med | DEPT, FACTORY, ORG | SUP, FM, OO, AUD |
| analytics.finance.view | High | FACTORY, ORG | ACC, FM, OO, AUD |
| analytics.anomaly.view | High | FACTORY, ORG | SUP, ACC, FM, OO |
| analytics.ai.query | Med | FACTORY, ORG | FM, OO, ACC(limited) |
| analytics.executive.view | **Critical** | ORG | OO, AUD |
| reporting.finance.export | High | FACTORY, ORG | ACC, FM, OO, AUD |
| reporting.email.summary.send | High | FACTORY, ORG | FM, OA, OO |
| reporting.owner.daily_pdf.export | High | FACTORY, ORG | OO, FM(optional) |
| billing.status.view | Med | ORG | OA, OO, SA(read-only), AUD |
| billing.order.create | High | ORG | OO |
| billing.plan.change | **Critical** | ORG | OO |
| billing.addon.manage | High | ORG | OO, OA |

### user.* / factory.* / audit.*

| Permission | Risk | Scope | Roles |
|-----------|:----:|-------|-------|
| user.directory.view | Med | FACTORY, ORG | FM, OA, SA, OO, AUD |
| user.invite | High | FACTORY, ORG | OA, FM(limited), OO |
| user.role.assign | **Critical** | FACTORY, ORG | OA, OO |
| user.membership.assign | **Critical** | FACTORY, ORG | OA, OO |
| user.deactivate | **Critical** | FACTORY, ORG | OA, OO |
| user.access.certify | **Critical** | ORG | SA, OO |
| user.exception.grant | **Critical** | ORG | SA, OO |
| factory.create | **Critical** | ORG | OA, OO |
| factory.profile.manage | High | FACTORY, ORG | OA, FM(limited), OO |
| factory.department.manage | High | FACTORY, ORG | OA, FM |
| factory.context.switch | Med | FACTORY | All assigned users |
| audit.log.view | High | FACTORY, ORG | SA, OO, AUD |
| audit.log.export | **Critical** | ORG | SA, OO, AUD(explicitly approved) |
| audit.denial.view | High | ORG | SA, OO |
| audit.security_event.view | **Critical** | ORG | SA, OO |

## 3.5 Toxic Permission Combinations

### Static Toxic Combinations (Do Not Assign as Standing Access)

| Combination | Why Toxic | Rule |
|------------|-----------|------|
| user.role.assign + user.access.certify | Same person grants and certifies | **Disallowed** |
| user.membership.assign + audit.override.review | Control access and oversight | **Disallowed** |
| inventory.transaction.create + inventory.reconciliation.approve | Create movement then approve correction | **Disallowed in same factory** |
| invoice.record.create + invoice.record.edit_post_dispatch | Create and retroactively alter | **Disallowed in same factory** |
| payment.record.create + payment.record.reverse | Fabricate and reverse receipts | **Disallowed in same factory** |
| dispatch.record.create + dispatch.quantity.override | Inflate dispatch without check | **Disallowed in same factory** |
| Org Admin + Security Admin | Identity admin and security oversight conflict | **Disallowed** |
| External Auditor + any mutable permission | Auditor independence compromised | **Disallowed** |
| Contractor + any approve or override permission | Temp workers must not approve | **Disallowed** |

### Runtime Toxic Actions (Blocked Per Workflow Instance)

| Runtime Conflict | Rule |
|-----------------|------|
| Maker approves own attendance regularization | Deny |
| Maker approves own OCR verification | Deny |
| Maker approves own inventory reconciliation | Deny |
| Maker approves own production variance | Deny |
| Maker approves own dispatch status escalation | Deny |
| Invoice creator approves own credit override | Deny |
| Payment recorder approves own reallocation/reversal | Deny |
| Break-glass requester approves own break-glass request | Deny |

---

# 4. Scope & Tenant Architecture

## 4.1 Scope Model

```
Enterprise Group → Organization → Factory → Department → Self
```

## 4.2 Tenant Levels

| Level | Meaning | Typical Owner |
|-------|---------|---------------|
| Enterprise Group | Parent corporate with multiple orgs | Group Security |
| Organization | Legal tenant / customer account | Org Owner |
| Factory | Plant / site / workspace | Factory Manager |
| Department | Line/team/function inside factory | Supervisor |
| Self | Personal identity scope | End user |

## 4.3 Assignment Model

A user may have different roles in different factories, different department scopes within a factory, org-wide governance roles without factory operational permissions, and temporary exception access with expiry.

**Examples:**
- User A: SUP in Factory 1 / Rolling Mill dept; OPR in Factory 2 / Dispatch dept
- User B: ACC in Factory 1 and Factory 3
- User C: OA org-wide, no production permissions
- User D: AUD for Org 99 for 14 days only

## 4.4 Enforcement Architecture

**Mandatory Resource Keys:** Every business record must carry `org_id`, `factory_id`, `department_id` (nullable), `created_by_user_id`, workflow state, and approval state.

**Enforcement Layers:**
1. API enforcement — all handlers invoke PDP
2. Query enforcement — list/detail queries filtered by scope
3. Job enforcement — background jobs run with originating actor context
4. Export enforcement — reports inherit source permission scope
5. Audit enforcement — every denial and override captured

## 4.5 Isolation Rules

1. No operational permission is valid outside assigned factory scope
2. Org Admin can manage identities but cannot read factory business records unless separately assigned
3. Security Admin can inspect audit/security signals without operational record mutation
4. Cross-factory analytics requires explicit ORG scope permission
5. Cross-org access requires Enterprise Group scope (exceptional)

## 4.6 Permission Resolution Model

Given actor, active org/factory/department, resource attributes, and permission key, the system resolves:
1. Active assignments for actor
2. Matching scoped roles
3. Permission grants from those roles
4. Resource scope containment
5. Maker-checker constraints
6. Workflow-state policy
7. SoD / toxic combination rules
8. Session assurance requirements
9. **Final decision + audit event**

**No rank. No inheritance by "higher role."**

---

# 5. Approval & Maker-Checker Framework

## 5.1 Approval Matrix by Domain

| Domain | Maker | Checker | Workflow Owner | Escalation | Override Rule |
|--------|-------|---------|----------------|------------|---------------|
| Attendance regularization | Employee / Supervisor | Supervisor / Factory Manager | Supervisor | Factory Manager → Org Owner | Only for disputes |
| Production entry approval | Operator | Supervisor | Supervisor | Factory Manager → Org Owner | Locked/exception only |
| OCR operational verification | Supervisor | Factory Manager or second Supervisor | Supervisor | Factory Manager → Org Owner | Low-confidence auto-routes to checker |
| OCR finance verification | Accountant | Factory Manager or second Accountant | Accountant | Org Owner | High-value docs require checker |
| Inventory reconciliation | Supervisor / FM | FM / Org Owner | Factory Manager | Org Owner | High variance requires Org Owner |
| Production batch variance | Operator / Supervisor | Supervisor / FM | Factory Manager | Org Owner | Severe variance requires escalation |
| Dispatch status progression | Supervisor | Factory Manager | Factory Manager | Org Owner | Quantity override separately controlled |
| Invoice creation exception | Accountant | Factory Manager | Accountant | Org Owner | Post-dispatch edit requires Org Owner |
| Payment reallocation/reversal | Accountant | Factory Manager | Accountant | Org Owner | Locked override requires Org Owner |
| Credit override | FM initiates | Org Owner | Factory Manager | Org Owner | Cannot self-approve |

## 5.2 Quantitative Escalation Rules

| Rule | Threshold | Escalates To |
|------|-----------|--------------|
| Stock variance % | > 3% warning / > 5% high / > 10% critical | FM / Org Owner |
| Invoice credit exceedance | > approved credit limit | Org Owner |
| Dispatch quantity exception | Any excess over remaining invoice qty | FM / Org Owner |
| OCR confidence | < 0.70 | Checker required |
| OCR confidence (finance) | < 0.50 | Escalation required |
| Payment reversal amount | Above configurable amount | Org Owner |
| Dormant privileged account | Any privileged role | Security Admin |

---

# 6. Security & Political Risk Assessment

## 6.1 Threat and Governance Risk Model

| Risk | Likelihood | Impact | Mitigation |
|------|:----------:|:------:|------------|
| Privilege escalation through role drift | High | Critical | Central PDP, no rank logic, quarterly certification |
| Horizontal access across factories | Medium | Critical | Factory-scoped assignments, tenant filters, RLS target |
| Finance vs operations overlap conflict | High | High | Explicit boundary tables, maker-checker, credit ownership |
| Admin becoming shadow business owner | High | High | Org Admin forbidden from routine business approvals |
| Owner bottlenecking operations | Medium | High | Owner reserved for exceptions only |
| Approval abuse / rubber stamping | Medium | High | No self-approval, sampling, aging dashboards |
| Audit bypass | Medium | Critical | PDP + immutable logs + export controls |
| Insider stock/invoice manipulation | Medium | Critical | Toxic combos blocked, post-dispatch locked, dual control |
| Dormant privileged accounts | High | High | Inactivity disablement, recertification, privileged access review |
| Contractor misuse | Medium | High | Time-bound scope, no approvals, no exports |
| Break-glass misuse | Low | Critical | Dual approval, auto-expiry, post-review |
| Cross-factory political spying | Medium | High | No implicit org-wide ops access |
| Auditor independence conflict | Low | High | Read-only and segregated |
| Security admin overreach | Medium | High | No business mutation permissions |

---

# 7. Audit & Compliance Architecture

## 7.1 Target Audit Event Schema

| Field | Type | Required | Description |
|-------|------|:--------:|-------------|
| event_id | UUID | Yes | Unique audit event |
| event_time | timestamp | Yes | UTC timestamp |
| event_type | string | Yes | e.g. AUTHZ_DENY, ROLE_ASSIGN |
| severity | enum | Yes | low/medium/high/critical |
| actor_user_id | bigint | Yes | Acting user |
| actor_role_ids | array | Yes | Active scoped role assignments used |
| session_id | string | Yes | Session linkage |
| request_id | string | Yes | Request correlation ID |
| org_id | string | Yes | Tenant org |
| factory_id | string | Nullable | Tenant factory |
| department_id | string | Nullable | Tenant department |
| permission_key | string | Nullable | Evaluated permission |
| scope_evaluated | string | Nullable | SELF/DEPT/FACTORY/ORG/EG |
| decision | enum | Nullable | allow/deny/escalate/override |
| resource_type | string | Nullable | Invoice, Dispatch, AttendanceRecord |
| resource_id | string | Nullable | Resource identifier |
| workflow_id | string | Nullable | Business workflow reference |
| approval_rule_id | bigint | Nullable | Approval rule used |
| maker_user_id | bigint | Nullable | Workflow maker |
| checker_user_id | bigint | Nullable | Workflow checker |
| override_reason_code | string | Nullable | Controlled reason taxonomy |
| ip_address_hash | string | Nullable | Privacy-safe IP tracking |
| user_agent | string | Nullable | Device/browser evidence |
| mfa_level | string | Nullable | Session assurance |
| policy_version | string | Yes | Policy release version |
| exception_grant_id | bigint | Nullable | If temporary access used |

## 7.2 Compliance Mapping

| Architecture Control | ISO 27001 | SOC 2 | NIST CSF |
|--------------------|:---------:|:-----:|:--------:|
| Scoped least privilege | A.5 / A.8 | CC6 | PR.AC |
| Role/permission governance | A.5.15, A.5.16, A.5.18 | CC6 | ID.GV |
| Privileged access separation | A.8.2 | CC6.1, CC6.2 | PR.AC |
| Logging and monitoring | A.8.15, A.8.16 | CC7 | DE.CM |
| MFA for privileged actions | A.5 | CC6 | PR.AC |
| Break-glass governance | Privileged access + incident response | CC6 + CC7 | PR.PT |
| Audit immutability | A.8.15, A.12.4 | CC7 | DE.CM |

---

# 8. Migration & Rollout Strategy

## 8.1 Four-Phase Rollout

### Phase 1 — Authorization Foundation
**Goal:** Introduce new schema and policy registry without changing user behavior

- Add roles/permissions/role_permissions/approval_rules/audit structures
- Backfill current users into scoped assignments
- Create policy registry and versioning
- Instrument PDP in **shadow mode**
- Begin denial and decision logging

### Phase 2 — Shadow Authorization and Diff Review
**Goal:** Compare old and new decisions safely

- Dual-evaluate all high-risk API calls
- Build decision diff dashboard
- Identify mismatches by module
- Add frontend permission manifest endpoint
- Train admins and managers on new role boundaries

### Phase 3 — Progressive Enforcement by Module
**Goal:** Enforce target-state model in controlled sequence

**Order:** attendance + analytics + reporting → OCR + entries → steel inventory + batches + dispatch → customers + invoices + payments → user/factory governance + billing → audit exports + break-glass

**Controls:** Per-module feature flags, fail-safe rollback to legacy evaluator, parallel audit of all denies

### Phase 4 — Enterprise Hardening
**Goal:** Remove drift and finalize enterprise posture

- Remove rank-based code paths
- Remove generic "admin does everything" assumptions
- Require Postgres target for RLS
- Activate quarterly certification workflows
- Enable auditor/contractor access patterns
- Add break-glass workflow and SoD review console

## 8.2 Rollback & Backward Compatibility

- Feature-flag based, per-module, non-destructive
- Keep new tables intact, switch PDP from ENFORCE to SHADOW
- APIs may return both legacy role label and new permission manifest during transition
- Legacy admin role maps to Org Admin by default, Security Admin only after explicit reclassification

---

# 9. Target-State Authorization Schema

## 9.1 Core Tables

- **users** — with org_id, enterprise_group_id, mfa_required, role_assignment_version
- **roles** — with role_key, role_family (operations/governance/assurance/temporary), is_assignable
- **permissions** — with permission_key, domain, risk_level, allowed_scope_set, requires_maker_checker, requires_audit, requires_mfa, owner_role_key, status, policy_version
- **role_permissions** — maps role_id to permission_id with max_scope, conditions_json, effective dates
- **user_factory_roles** — scoped role assignment with user_id, role_id, org_id, factory_id (nullable), department_id (nullable), scope_level, assignment_type, effective_from/to, assignment approval
- **approval_rules** — domain, resource_type, action_key, maker_checker permissions, scope level, state transitions, thresholds, escalation and override roles
- **audit_logs** — append-only immutable events with full schema from Section 7.1

## 9.2 Conceptual ERD

```
users 1---* user_factory_roles *---1 roles
roles 1---* role_permissions *---1 permissions
approval_rules -> permissions (maker/checker/override refs)
audit_logs -> users (actor)
audit_logs -> user_factory_roles (nullable)
audit_logs -> approval_rules (nullable)
```

---

# 10. Enterprise Readiness Assessment

| Area | Readiness | Notes |
|------|:---------:|-------|
| ISO 27001 | High | Strong access control, logging, privileged access governance |
| SOC 2 | High | Strong CC6/CC7; still depends on SDLC and ops discipline |
| Large steel groups | High | Multi-factory + org + future enterprise-group support |
| Multi-plant operations | High | Different role per factory supported |
| External auditors | High | Auditor role and read-only audit scope supported |
| Procurement module expansion | Med-High | Auth ready; workflow module still needed |
| Maintenance module expansion | Med-High | Auth ready; maintenance policies to be added |
| Vendor portal | Med-High | Contractor/external identity pattern reusable |
| Scalability | High | Central PDP + scoped caching + Postgres/RLS target |
| Performance | High | Permission manifests, assignment versioning, query indexes |
| Auditability | Very High | Unified audit schema and denial capture |
| Operational governance | High | Named owners, SoD, overrides, escalation chains |

## Remaining Non-Authorization Gaps

Even with this architecture, DPR.ai still needs workflow expansion for:
- Procurement / purchase orders
- Vendor management
- Returns / credit notes
- Maintenance work orders
- External vendor/customer portal UX
- Formal incident management workflow
- Enterprise retention and legal hold policy

These are **not authorization blockers**; they are business module completeness gaps.

---

## Final Conclusion

The correct enterprise architecture for DPR.ai is **not** super-admin-centric, role-rank-centric, factory-name-filtered, or workflow-implicit.

The correct architecture is:

> **Scoped Policy-Based RBAC with Contextual ABAC, governed by maker-checker rules, toxic-combination controls, and immutable audit.**

This gives DPR.ai:
- Strong multi-factory isolation
- Clear role boundaries
- Finance/operations separation
- Enterprise-grade auditability
- Future support for procurement, maintenance, vendor access, and external audits
- Scalability from 1 factory to 1000+ factories **without redesign**

---

*End of Architecture Document — Generated June 16, 2026*
