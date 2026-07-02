# DPR.ai — Approval, Maker-Checker & Separation of Duties Platform

**Design Standard:** Platform-level, reusable, enterprise-grade  
**Authoritative Inputs:** Target-State Authorization Architecture, Authorization Foundation Engineering Spec, Route-to-Permission Audit, Complete Authorization Migration Plan  
**Formula:** **Role + Permission + Scope + Workflow State + Maker-Checker + Audit**  
**Date:** June 16, 2026  

---

## Executive Position

DPR.ai needs a **central Approval Governance Platform** that sits beside the PDP/PEP authorization foundation and governs all controlled workflows through one reusable model.

This platform must:
- Never rely on module-specific approval logic
- Never rely on role hierarchy
- Always enforce: explicit approval ownership, scope-bound approver eligibility, workflow-state controls, maker-checker independence, SoD conflict prevention, immutable audit, escalation and exception governance

### Core Principle

**Authorization Platform** answers: *"May this actor attempt this action?"*  
**Approval Governance Platform** answers: *"What approval path is required before this action becomes effective?"*

---

## Table of Contents

1. [Approval Governance Framework](#1-approval-governance-framework)
2. [Maker-Checker Architecture](#2-maker-checker-architecture)
3. [Separation of Duties Framework](#3-separation-of-duties-framework)
4. [Approval Workflow Catalog](#4-approval-workflow-catalog)
5. [Approval State Machine](#5-approval-state-machine)
6. [Approval Rule Engine](#6-approval-rule-engine)
7. [Database Architecture](#7-database-architecture)
8. [API & Service Architecture](#8-api--service-architecture)
9. [Audit & Compliance](#9-audit--compliance)
10. [Security Review](#10-security-review)

---

# 1. Approval Governance Framework

## 1.1 Governance Objectives

1. **Every controlled workflow has a named owner**
2. **Every approval has an explicit approver model**
3. **Every escalation has a predefined destination**
4. **Every override is exceptional and auditable**
5. **Every delegation is constrained and revocable**
6. **Every approval action is attributable to one individual**
7. **No workflow can be approved by its own maker**
8. **No exception can silently weaken SoD**
9. **No cross-factory approval occurs without scoped entitlement**
10. **All approval logic is rule-driven and versioned**

## 1.2 Approval Authority Model

Approval authority is determined by:
- `permission_key` — must match the action being governed
- `scope_level` — must cover the resource's org/factory/department
- `workflow_key` — must match the workflow being governed
- `workflow_state` — must be a valid transition
- `approval_rule` — must evaluate to eligible
- `SoD evaluation` — must pass static and dynamic checks
- `active assignment` — must be valid and non-expired
- `MFA / session assurance` — must meet requirement
- `delegation validity` — if acting via delegation
- `override / exception status` — if acting via exception path

A user may approve only when **all** are true.

## 1.3 Approval Role Families

| Family | Roles | Approval Use |
|--------|-------|-------------|
| Factory Operations | Attendance User, Operator, Supervisor, Accountant, Factory Manager | Operational and finance workflow execution/approval within scope |
| Governance | Org Admin, Security Admin, Org Owner | Access governance, security exceptions, strategic overrides |
| Assurance | External Auditor | Never approves; read-only assurance |
| Temporary | Contractor | Never approves; execution only |
| Emergency | Break-Glass | No standing approval role; emergency corrective use only |

## 1.4 Who Can Approve / Escalate / Override / Cannot Approve

| Role | Can Approve | Can Escalate | Can Override | Cannot Approve |
|------|------------|-------------|-------------|----------------|
| Attendance User | No | No | No | All controlled workflows |
| Operator | No | No | No | All controlled workflows |
| Supervisor | Team/department operational approvals | Yes, to Factory Manager | Limited workflow exceptions only if rule allows | Finance workflows, access governance, billing, security exceptions |
| Accountant | Finance workflow approvals within scope | Yes, to Factory Manager / Org Owner | Limited finance exception handling where rule allows | Operational approvals, security exceptions, break-glass |
| Factory Manager | Factory-level operational and some commercial approvals | Yes, to Org Owner | Controlled factory override if rule allows | Identity governance, security exception approval, auditor actions |
| Org Admin | Access provisioning approvals only | Yes, to Security Admin / Org Owner | No business override | Operational and finance transaction approvals |
| Security Admin | Security exceptions, SoD exceptions, break-glass governance | Yes, to Org Owner | Security override only | Business transaction approvals |
| Org Owner | Final exceptional approvals | Yes (to platform support) | Final override authority | Routine daily approvals by policy |
| External Auditor | No | No | No | Any mutation / approval / override |
| Contractor | No | No | No | Any approval / exception / override |
| Break-Glass | No standing approval power | No | Temporary corrective action only after approval | Cannot approve own grant |

## 1.5 Approval Ownership Model

Every rule must define:
- **Workflow Owner** — accountable business owner for the workflow
- **Primary Checker** — normal approver
- **Escalation Authority** — receives SLA breach / threshold escalation
- **Override Authority** — exceptional approver for bypass cases
- **Security Owner** — accountable for SoD / exception governance where relevant

### Ownership Layers

| Layer | Responsibility |
|-------|---------------|
| Workflow Owner | Owns process design, SLA, approval quality |
| Rule Owner | Owns approval rule configuration and change control |
| Domain Security Owner | Owns SoD, exception, toxic-combo policy |
| Org Owner | Final authority for critical exceptions |
| Audit Owner | Reviews approval evidence and override usage |

## 1.6 Escalation Hierarchy

Escalation is triggered by: SLA breach, threshold breach, approver unavailable, SoD conflict, insufficient scope, exception request, override need, missing independent checker.

### Standard Escalation Chains

| Workflow Class | L1 | L2 | L3 |
|---------------|----|----|----|
| Attendance / Workforce | Supervisor | Factory Manager | Org Owner |
| Production / Inventory / Dispatch Ops | Supervisor | Factory Manager | Org Owner |
| Finance / Credit / Invoice / Payment | Accountant | Factory Manager | Org Owner |
| Access Governance | Org Admin | Security Admin | Org Owner |
| Security Exception / Break-Glass | Security Admin | Org Owner | Post-incident review |
| Billing / Subscription | Org Admin | Org Owner | Platform support informed |

## 1.7 Delegation Model

Delegation is for approver continuity, not control bypass.

### Delegation Rules
1. Delegation must be explicit, time-bound, scoped, and auditable
2. Delegation does not transfer ownership; only action authority
3. Delegation cannot expand scope beyond delegator's scope
4. Override authority is **not delegable by default**
5. Security exceptions and break-glass approvals require explicit delegation policy
6. Sub-delegation is disabled by default
7. Delegation never bypasses maker-checker or SoD
8. Delegate must independently pass all approver eligibility checks

### Delegation Types

| Type | Use | Max Duration | Approval Required |
|------|-----|:------------:|:-----------------:|
| Planned Leave | Normal continuity | 30 days | Workflow owner or governance owner |
| Emergency | Sudden absence | 72 hours | Security Admin / Org Owner depending class |
| Standing Backup | Named alternate checker | 90 days renewable | Governance review |
| Restricted | Specific workflow only | Rule-defined | Yes |

## 1.8 Exception Model

An exception is a controlled temporary deviation from normal policy.

### Exception Categories
- SoD exception, staffing exception, threshold exception, late approval exception, retrospective approval exception, temporary cross-factory approval exception, emergency continuity exception

### Exception Requirements
- Business justification, risk statement, start/end time, compensating controls, approving authority, review date, mandatory post-use review

## 1.9 Override Model

An override is not routine approval. It is a policy-bounded bypass.

### Override Rules
- Only allowed where rule defines `override_authority`
- Requires: MFA, reason code, free-text justification, evidence attachment where rule requires, immutable audit trail
- Critical overrides require: second-level awareness or approval, post-event review
- Override cannot erase approval history
- Override cannot be hidden from audit or assurance users

---

# 2. Maker-Checker Architecture

## 2.1 Definitions

- **Maker** = the actor who creates, submits, or materially changes a controlled business object
- **Checker** = independent actor who validates, approves, rejects, escalates, or routes exceptions for that object

## 2.2 Maker Responsibilities

- Create truthful record data
- Submit complete evidence
- Declare reason / variance / exception basis
- Not influence checker assignment
- Not approve, override, or certify own item
- Respond to evidence requests
- Accept rejection or resubmit as new revision where policy requires

## 2.3 Checker Responsibilities

- Validate data completeness
- Verify workflow-state legitimacy
- Confirm business-rule compliance
- Assess threshold and risk conditions
- Enforce SoD and self-approval prevention
- Approve, reject, escalate, or request more evidence
- Document rationale for non-standard decisions

## 2.4 Approval Independence Rules

A checker is independent only if **all** below are true:
1. Not the maker
2. Not the requester of exception/override
3. Not the subject of the access change
4. Not acting via invalid or expired delegation
5. Not blocked by static or dynamic toxic-combo rules
6. Has matching scope for the specific org/factory/department
7. Holds required permission for the step
8. Passes MFA if required
9. Is not the previous rejecting checker where rule requires fresh independent review
10. Is not the only actor in a workflow requiring multi-party separation

## 2.5 Self-Approval Prevention (4 Layers)

### A. UI Layer
- Hide approval actions for maker/requester
- Show "not eligible to approve own item"

### B. API / PEP Layer
- Reject self-approval attempt before business mutation

### C. Rule Engine Layer
- Evaluate `maker_user_id != actor_user_id`
- Evaluate `subject_user_id != actor_user_id` for access workflows
- Evaluate distinct-user requirements

### D. Database / Audit Layer
- Persist maker/checker user IDs
- Trigger alert if same user appears as maker + checker on controlled action

## 2.6 Cross-Role Approval Patterns

| Pattern | Description | Use Cases |
|---------|-------------|-----------|
| Same-domain independent checker | Different user, same role family | Attendance, production, OCR ops |
| Cross-domain checker | Different user from different role family | Credit override, invoice exception |
| Sequential approval | L1 operational, L2 managerial | Reconciliation, payment reversal |
| Parallel approval | Two independent approvals required | Critical finance/security exceptions |
| Dual authorization | Governance + business authority | Break-glass, SoD exception, critical billing |

## 2.7 Multi-Factory Considerations

1. Approval scope is bound to originating resource scope
2. User with multiple factory assignments can only approve using assignment valid for that resource
3. Cross-factory operational approval is denied unless explicit org-scoped rule permits it
4. Escalation to org level does not imply operational read/write outside rule scope
5. Audit must record which assignment and scope path was used
6. Factory A maker cannot route to checker in Factory B unless rule explicitly allows org-level escalation

## 2.8 Workflows Requiring Maker-Checker

### Mandatory Maker-Checker
Attendance regularization review, attendance override/dispute, production entry approval, production entry override/delete, OCR verification, inventory reconciliation, production batch variance approval, customer verification review, credit override, post-dispatch invoice edit, invoice void, payment reallocation, payment reversal, dispatch status approval, dispatch quantity override, privileged role assignment, factory access assignment, billing plan change, security exception approval, break-glass activation.

### Conditional Maker-Checker
OCR processing when confidence/sensitivity thresholds triggered, manual inventory transaction above threshold, invoice creation above credit/risk threshold, payment creation if backdated/high-value/suspicious, factory creation if outside standard template or plan constraints.

### Multi-Level Approval Required
Inventory reconciliation above high variance threshold, credit override beyond approved threshold, post-dispatch invoice edit with financial impact, payment reversal above configured amount, billing plan change/downgrade/manual override, SoD exception, break-glass access.

### Independent Review Required
Security exception, break-glass, external-auditor-sensitive actions, privileged access change involving governance roles, overrides affecting financial ledgers or audit posture.

---

# 3. Separation of Duties (SoD) Framework

## 3.1 SoD Design Principles

1. Separate execution from approval
2. Separate access administration from security oversight
3. Separate finance record creation from finance reversal
4. Separate stock movement from stock correction approval
5. Separate emergency access request from emergency approval
6. Separate exception request from exception authorization

## 3.2 Static Toxic Combinations (Standing Assignment Blocks)

| Combination | Risk | Impact | Enforcement | Exception Process |
|------------|:----:|:------:|:-----------:|:-----------------:|
| Org Admin + Security Admin | Admin can grant and validate own access control posture | Critical governance failure | Block at assignment time | Org Owner + Security Admin peer review, time-bound only |
| External Auditor + any mutable permission | Independence compromised | Audit invalidation | Block at assignment time | No exception except explicit investigative role with separate identity |
| Contractor + approve/override permission | Temp worker can control business decisions | High | Block at assignment time | Not allowed |
| `user.role.assign` + `user.access.certify` | Same actor grants and certifies access | Critical | Block | Security-admin exception only, max 7 days, post-review |
| `inventory.transaction.create` + `inventory.reconciliation.approve` (same factory) | Actor can create discrepancy and approve correction | Critical | Block in same factory | Security exception only, max 24h, compensating review |
| `invoice.record.create` + `invoice.record.edit_post_dispatch` (same factory) | Retroactive invoice manipulation | Critical | Block | Org Owner exception only |
| `payment.record.create` + `payment.record.reverse` (same factory) | Fabricate and reverse receipts | Critical | Block | Org Owner exception only |
| `dispatch.record.create` + `dispatch.quantity.override` (same factory) | Dispatch inflation or concealment | Critical | Block | Org Owner exception only |
| `break_glass` standing assignment | Permanent emergency power | Critical | Disallow structurally | Not allowed |

## 3.3 Dynamic Toxic Combinations (Per-Workflow-Instance)

| Conflict | Risk | Impact | Enforcement | Exception |
|----------|:----:|:------:|:-----------:|:---------:|
| Maker approves own submission | Self-approval | Control collapse | Deny at runtime | Not allowed |
| Requester approves own exception | Exception laundering | Critical | Deny | Not allowed |
| Requester approves own break-glass | Emergency abuse | Critical | Deny | Not allowed |
| Role assigner certifies same access change | Access concealment | High | Deny | Separate certifier required |
| Payment recorder approves same reversal/reallocation | Ledger manipulation | Critical | Deny | Escalate to different checker |
| Inventory reconciliation maker approves same record | Stock concealment | Critical | Deny | Escalate |
| Dispatch creator approves own quantity override | Shipment fraud risk | Critical | Deny | Escalate |
| Customer credit requester approves own override | Credit leakage | High | Deny | Org Owner required |
| Delegator approves item via delegate identity chain | Hidden self-approval | High | Deny and alert | Not allowed |

## 3.4 Workflow-Level Conflicts

| Workflow | Conflict | Risk | Enforcement |
|----------|----------|:----:|:-----------:|
| Attendance | Supervisor reviewing own regularization | Payroll/compliance distortion | `not_self` + team scope |
| Production | Operator editing and approving same entry | False production reporting | Maker-checker separation |
| OCR | Same reviewer creates and approves finance extraction | Fraudulent document acceptance | Domain-split and independent approval |
| Inventory | Manual transaction creator approves reconciliation | Stock correction abuse | Dynamic SoD |
| Credit | Accountant and FM collusion through reused identity | Credit leakage | Multi-level approval with Org Owner |
| Invoice | Creator performs post-dispatch edit | Revenue leakage | Static and dynamic SoD |
| Dispatch | Creator overrides quantity | Dispatch fraud | Separate override authority |
| Payment | Creator reverses own payment | Receipt concealment | Separate approver, MFA |
| Access | Org Admin changes own role/membership | Privilege escalation | Self-target block |
| Security | Security Admin approves own exception request | Security bypass | Peer/Org Owner approval |

## 3.5 Financial Control Conflicts

| Conflict | Risk | Impact | Enforcement |
|----------|:----:|:------:|:-----------:|
| Invoice create + credit override | Revenue leakage | Critical | Static block |
| Payment create + reverse | Cash control failure | Critical | Static block |
| Payment create + reallocate | Allocation manipulation | Critical | Static block |
| Customer create + final verification approve | KYC/credit weakness | High | Dynamic block if same instance |
| Billing plan change + quota reset without peer visibility | Commercial abuse | High | Dual-visibility and audit |

## 3.6 Operational Control Conflicts

| Conflict | Risk | Impact | Enforcement |
|----------|:----:|:------:|:-----------:|
| Production entry create + variance approval | Production distortion | High | Dynamic block |
| OCR uploader + final approver | Wrong extraction enters record | High | Dynamic block |
| Dispatch status updater + final approval | Shipment state abuse | High | Sequential control |
| Stock transaction create + stock override | Inventory corruption | Critical | Static block |

## 3.7 SoD Exception Process

A SoD exception must itself be approved through a separate controlled workflow.

### Required Fields
Exception type, affected workflow(s), affected permissions/roles, org/factory scope, requester, justification, start/end date, compensating controls, approving authority, post-review owner.

### Approval Path
Requester → Security Admin review → Org Owner final approve. Critical finance/security exceptions require dual acknowledgement. Auto-expiry mandatory. No silent renewals. Renewal treated as new request.

---

# 4. Approval Workflow Catalog

## 4.1 Approval Pattern Legend

| Pattern | Meaning |
|---------|---------|
| AP-0 | No human approval unless conditional trigger routes into review |
| AP-1 | Single independent checker |
| AP-2 | Maker-checker, one approval stage |
| AP-3 | Sequential two-stage approval |
| AP-4 | Cross-domain or parallel dual approval |
| AP-5 | Critical exception / override / emergency dual approval |

## 4.2 Complete Approval Matrix

| Workflow | Pattern | Workflow Owner | Maker | Checker / L1 | L2 / Independent Review | Escalation Authority | Override Authority | Approval Conditions | Rejection Conditions | Audit |
|----------|:-------:|:-------------:|:-----:|:------------:|:------------------------:|:-------------------:|:------------------:|:-------------------|:--------------------|:------|
| Attendance Regularization | AP-2 | Supervisor | Employee | Supervisor | Factory Manager if escalated | Factory Manager | Org Owner | Record exists, pending discrepancy, within policy window, evidence present if required | Missing evidence, duplicate request, self-review, expired window | Submit, review, approve/reject, evidence, escalation |
| Attendance Override/Dispute | AP-3 | Factory Manager | Supervisor or FM requester | Factory Manager or alternate FM | Org Owner | Org Owner | Org Owner | Disputed/locked record, reason code, evidence | Routine use, requester=self-approver, no dispute basis | All actions + override reason |
| Production Entry Approval | AP-2 | Supervisor | Operator | Supervisor | Factory Manager for escalation | Factory Manager | Org Owner | Entry submitted, valid shift/date, within scope | Incomplete record, duplicate, maker=self-checker | Create, submit, approve/reject |
| Production Entry Correction/Override | AP-3 | Factory Manager | Supervisor/FM requester | Factory Manager | Org Owner if post-lock or high-risk | Org Owner | Org Owner | After cutoff/post-approval/soft delete | Routine edit disguised as override, no reason | Correction reason, before/after values |
| OCR Processing Intake | AP-0/conditional | Domain owner | Uploader | None unless rule triggered | Manager if escalated | Factory Manager | N/A | Only if low confidence/sensitive doc/policy flag routes to verification | Invalid file, unsupported doc type | Upload, extraction result, routing decision |
| OCR Verification — Operations | AP-2 | Supervisor | Ops reviewer/uploader | Supervisor or alternate reviewer | Factory Manager for low confidence/sensitive doc | Factory Manager | Org Owner | Extracted doc pending review, confidence below threshold or manual review required | Self-approval, wrong document class, missing correction rationale | Draft edits, submit, approve/reject |
| OCR Verification — Finance | AP-3 | Accountant | Finance reviewer/uploader | Accountant or second accountant | Factory Manager / Org Owner by threshold | Org Owner | Org Owner | Finance doc pending review, thresholds met, evidence complete | Self-approval, missing supplier/customer evidence, doc mismatch | All review actions + threshold basis |
| Inventory Manual Transaction | AP-0/conditional AP-2 | Factory Manager | Supervisor/FM | Factory Manager when threshold/risk rule triggered | Org Owner for critical thresholds | Org Owner | Org Owner | Manual adjustment/backdated/high-value/high-risk category | Unsupported adjustment, no reason, same-user conflict | Transaction source, reason, before/after qty |
| Inventory Reconciliation | AP-3 | Factory Manager | Supervisor or FM maker | Factory Manager | Org Owner above high variance | Org Owner | Org Owner | Reconciliation submitted, variance explained, count evidence attached | Self-approval, variance unexplained, missing evidence | Count evidence, variance, approver rationale |
| Production Batch/Variance | AP-2/AP-3 by severity | Factory Manager | Operator/Supervisor | Supervisor | Factory Manager / Org Owner if severe | Org Owner | Org Owner | Batch posted, variance threshold checked | Missing raw/finished linkage, severe unexplained variance | Variance basis, yield metrics, approval path |
| Customer Verification | AP-2 | Accountant | Accountant | Alternate accountant or Factory Manager | Org Owner for high-risk cases | Factory Manager / Org Owner | Org Owner | KYC/verification docs complete, customer pending verification | Missing docs, mismatch, self-approval | Doc chain, reviewer notes |
| Customer Credit Override | AP-4 | Factory Manager | Accountant or FM requester | Factory Manager | Org Owner mandatory if limit exceeded | Org Owner | Org Owner | Existing customer, credit exception reason, exposure data | Missing ledger basis, self-approval, no credit analysis | Requested limit, approved limit, risk basis |
| Invoice Creation Exception | AP-2 | Accountant | Accountant | Factory Manager when exception rule triggered | Org Owner if critical | Org Owner | Org Owner | Non-standard terms/threshold/exception flags | No commercial basis, credit issue unresolved | Exception rationale, invoice snapshot |
| Invoice Post-Dispatch Edit | AP-4 | Factory Manager | Accountant/FM requester | Factory Manager | Org Owner mandatory | Org Owner | Org Owner | Linked dispatch exists, correction justified, financial impact assessed | Routine edit, maker=self-approver, audit concern | Before/after invoice, linked dispatch refs |
| Invoice Void | AP-4 | Factory Manager | Accountant/FM requester | Factory Manager | Org Owner mandatory | Org Owner | Org Owner | Open business basis, not hidden reversal, reason code | No void basis, used to bypass credit note policy | Void reason, downstream impacts |
| Dispatch Creation/Status Approval | AP-2 | Factory Manager | Supervisor | Factory Manager | Org Owner if threshold or policy breach | Org Owner | Org Owner | Dispatch created/status transition valid, invoice linkage consistent | Invalid state change, self-approval, over-quantity without rule | Status transitions, weight, gate events |
| Dispatch Quantity Override/Cancel | AP-4 | Factory Manager | Supervisor/FM requester | Factory Manager | Org Owner mandatory for critical excess or late cancel | Org Owner | Org Owner | Excess quantity or cancel requested with reason | Delivered state, no justification, same-user conflict | Delta qty, invoice balance, reason |
| Payment Record Creation (standard) | AP-0/conditional AP-2 | Accountant | Accountant | None unless backdated/high-value/suspicious | Factory Manager if triggered | Org Owner | Org Owner | Triggered only by configured risk rule | Unsupported source, duplicate receipt | Payment source, reference, trigger basis |
| Payment Reallocation | AP-3 | Accountant | Accountant | Factory Manager | Org Owner above threshold | Org Owner | Org Owner | Payment exists, allocation mismatch reason | Creator=self-approver, locked period, no basis | Old/new allocations, customer refs |
| Payment Reversal | AP-4 | Accountant | Accountant | Factory Manager | Org Owner mandatory by threshold/policy | Org Owner | Org Owner | Payment exists, reversal reason, evidence attached | Creator=self-approver, missing evidence | Original payment, reversal impact |
| Privileged User Invite/Role Assignment | AP-3 | Org Admin | Org Admin | Security Admin | Org Owner for critical role scopes | Org Owner | Org Owner | Target role allowed, SoD passes, not self-target, valid scope | Toxic combo, self-assignment, missing justification | Requested role/scope, rule version |
| Factory Access Assignment/Change | AP-3 | Org Admin | Org Admin | Security Admin | Org Owner if high-risk or cross-factory broadening | Org Owner | Org Owner | Membership scope valid, factory exists, not self-target | Factory mismatch, toxic combo, unauthorized broad scope | Old/new access map |
| Factory Creation/Sensitive Profile Change | AP-3 | Org Owner | Org Admin / Org Owner requester | Org Owner or delegated governance approver | Security Admin informed for sensitive settings | Org Owner | Org Owner | Within commercial plan/org rights | Invalid org policy, unsafe template deviation | Creation/config snapshot |
| Billing Plan Change/Downgrade/Manual Override | AP-5 | Org Owner | Org Owner or Org Admin requester | Org Owner | Security Admin visibility/second approver for manual override | Org Owner | Org Owner | Commercial policy satisfied, MFA, impact acknowledged | Lack of authority, insufficient MFA, unsafe manual override | Billing action, commercial impact |
| Security Exception / SoD Exception | AP-5 | Security Admin | Requesting business/governance actor | Security Admin | Org Owner mandatory | Org Owner | Org Owner | Exception scope, duration, compensating controls, risk accepted | Indefinite duration, no controls, self-approval | Full exception package |
| Break-Glass Access | AP-5 | Security Admin | Requester | Security Admin | Org Owner mandatory | Org Owner | Org Owner | Incident/ref code, MFA, time limit, emergency justification | Routine use, requester self-approving, no incident | Request, grant, expiry, post-review |
| Approval Delegation Activation | AP-3 | Workflow Owner / Governance Owner | Delegator | Governance owner or superior approver | Security Admin for critical workflows | Org Owner | No override except governance | Delegate eligible, time-bound, no scope expansion | Invalid delegate, sub-delegation, SoD conflict | Delegator, delegate, scope, expiry |
| Approval Rule/Policy Exception Change | AP-5 | Security Admin | Rule admin requester | Security Admin peer or Org Owner | Org Owner | Org Owner | Org Owner | Documented change, risk assessment, versioning | Unreviewed rule drift, policy conflict | Rule diff, version, approver rationale |

---

# 5. Approval State Machine

## 5.1 Universal Instance States

| State | Meaning | Allowed Transitions | Required Permission Type | Required Approver | Audit Requirement |
|-------|---------|:-------------------:|:------------------------:|:-----------------:|:-----------------:|
| **Draft** | Item prepared but not formally submitted | Submitted, Cancelled | maker/create or edit permission | None | Creation, edits |
| **Submitted** | Maker has formally entered approval flow | Under Review, Cancelled, Rejected (validation fail) | submit permission | System/queue assignment | Submission event |
| **Under Review** | At least one active approval step exists | Approved, Rejected, Escalated, Awaiting Evidence, Awaiting MFA, Exception Requested, Override Requested, Expired | checker/review permission | Assigned checker | Assignment + review actions |
| **Awaiting Evidence** | Checker asked maker/requester for more support | Under Review, Rejected, Cancelled, Expired | checker request-evidence + maker resubmit | Checker then maker | Evidence request + receipt |
| **Awaiting MFA** | High-risk action awaiting strong authentication | Under Review, Rejected, Cancelled, Expired | same as current action + MFA | Current actor | Assurance event |
| **Escalated** | Standard checker cannot close; higher authority required | Under Review, Approved, Rejected, Override Requested, Exception Requested, Expired | escalate or escalated checker permission | Escalation authority | Escalation reason |
| **Exception Requested** | Policy exception needed | Exception Approved, Exception Denied, Cancelled, Expired | exception request allowed by rule | Exception authority | Full exception record |
| **Exception Approved** | Temporary policy relief granted | Under Review, Override Requested, Completed, Expired | original action permission + exception active | Assigned checker | Exception approval audit |
| **Exception Denied** | Exception rejected | Draft, Cancelled | none; maker may revise | Exception authority | Denial reason |
| **Override Requested** | Standard path insufficient; override sought | Override Approved, Override Denied, Cancelled, Expired | override request allowed by rule | Override authority | Override request audit |
| **Override Approved** | Exceptional bypass approved | Completed | override permission | Override authority | Critical audit, reason/evidence |
| **Override Denied** | Override refused | Under Review, Cancelled, Rejected | none | Override authority | Denial reason |
| **Approved** | All required approval steps satisfied | Completed, Override Requested | checker permission completed | Final checker/engine | Final approval event |
| **Rejected** | Workflow denied | Draft (new revision) or Cancelled | reject permission | Checker | Rejection reason mandatory |
| **Completed** | Business effect applied / finalized | Superseded (rare) | system completion callback | None | Completion event |
| **Cancelled** | Withdrawn or terminated | Draft (new revision only) | maker cancel or governance cancel | Authorized actor | Cancel reason |
| **Expired** | Timed out without valid action | Escalated, Cancelled, Draft (new revision) | system or governance | System/escalation authority | Expiry + SLA breach |
| **Superseded** | Replaced by newer revision | terminal | system | None | Chain link to successor |

## 5.2 Step-Level States

| Step State | Meaning |
|-----------|---------|
| Pending | Step defined but not yet active |
| Assigned | Approver(s) assigned and actionable |
| In Review | Approver opened or claimed step |
| Approved | Step approved |
| Rejected | Step rejected |
| Escalated | Step escalated to next authority |
| Delegated | Step reassigned under valid delegation |
| Skipped | Step bypassed by rule condition no longer true |
| Expired | Step breached SLA / no action |
| Cancelled | Instance cancelled before step completion |

## 5.3 Universal Transition Rules

- No transition without rule match
- No transition without permission check
- No transition if actor fails scope
- No transition if actor violates SoD
- No transition if workflow state no longer matches rule
- No transition if rule version retired unless grandfathered
- Terminal actions require immutable audit before commit

---

# 6. Approval Rule Engine

## 6.1 Design Requirements

- Database-configurable
- Policy-versioned
- Scope-aware
- Threshold-aware
- Multi-stage
- Reusable for future workflows
- Independent of router/module logic
- Able to resolve approvers dynamically from role assignments
- Integrated with PDP decisions

## 6.2 Approval Subject Contract

```json
{
  "workflow_key": "invoice.post_dispatch_edit",
  "resource_type": "SteelInvoice",
  "resource_id": "inv_123",
  "action_key": "invoice.record.edit_post_dispatch",
  "org_id": "org_1",
  "factory_id": "fac_3",
  "department_id": null,
  "maker_user_id": 42,
  "subject_user_id": null,
  "current_workflow_state": "submitted",
  "requested_change": {},
  "attributes": {
    "invoice_amount": 125000.00,
    "dispatch_linked": true,
    "over_credit_limit": true,
    "risk_score": 8.1
  }
}
```

## 6.3 Rule Model

A rule must define:
- `workflow_key`, `action_key`, `resource_type`
- `rule_scope` (org_id nullable, factory_id nullable)
- `priority`, `active_from`/`active_to`
- `entry_conditions_json`
- `step_strategy`, `required_distinct_approvers`, `quorum`
- `exception_allowed`, `override_allowed`
- `mfa_required`, `evidence_required`, `sla_hours`
- `escalation_mode`, `version`

## 6.4 Rule Step Model

Each step defines:
- Step order, approval stage type (sequential/parallel/quorum)
- Approver selector, required role key(s), required permission key, required scope level
- Min distinct users, min distinct role families
- Threshold condition, escalation target
- Evidence requirement, MFA requirement
- Auto-skip condition, rejection behavior

### Approver Resolution Strategies

| Selector Type | Meaning |
|--------------|---------|
| ROLE_AT_SCOPE | Any active assignee of role at required scope |
| DISTINCT_ROLE_AT_SCOPE | Same, but different from maker and previous approver |
| FIXED_USER | Specific named user |
| FACTORY_MANAGER | Current factory manager assignment |
| ORG_OWNER | Org owner assignment |
| SECURITY_ADMIN | Security admin assignment |
| SECOND_ACCOUNTANT | Independent accountant in same factory/org |
| SECOND_SUPERVISOR | Independent supervisor in same department/factory |
| GOVERNANCE_CHAIN | Org Admin → Security Admin → Org Owner |
| RULE_DEFINED_GROUP | Preconfigured approval group |

## 6.5 Evaluation Logic

1. Receive approval subject
2. Validate subject completeness
3. Resolve applicable rules by specificity and priority
4. Filter by scope, org, factory, workflow key, action key
5. Evaluate entry conditions
6. Compute approval pattern and required steps
7. Resolve candidate approvers
8. Remove ineligible candidates (maker, requester, subject user, toxic-combo conflicts, wrong scope, expired assignment/delegation)
9. If no valid approver: escalate if rule permits, else require exception
10. Create approval instance + steps
11. On each action, re-evaluate state + SoD + validity
12. On completion, emit completion event to originating module

### Decision Outputs
- No approval required
- Approval required
- Escalation required
- Exception required
- Override required
- Denied due SoD
- Denied due scope
- Denied due invalid state

---

# 7. Database Architecture

## 7.1 Core Entities

### Required
- `approval_rules` — Rule header: workflow/action/scope/policy settings
- `approval_instances` — Runtime approval case tied to business resource
- `approval_steps` — Runtime instantiated steps
- `approval_actions` — Immutable actor actions against steps/instances
- `approval_delegations` — Time-bound delegation records
- `approval_exceptions` — Exception requests and decisions
- `approval_overrides` — Override requests and decisions

### Additional (Enterprise Quality)
- `approval_rule_steps` — Versioned step templates per rule
- `approval_rule_conditions` — Entry/threshold/route conditions
- `approval_evidence` — Files, notes, hashes, URLs linked to instances
- `approval_participants` — Makers, checkers, escalators, delegates, subjects
- `approval_notifications` — Delivery queue and status for notifications
- `approval_conflicts` — SoD conflict detections and outcomes
- `approval_sla_events` — Reminder/escalation/SLA breach events
- `approval_revisions` — New revision chain when rejected/resubmitted

## 7.2 Key Relationships

```
approval_rules 1---* approval_rule_steps
approval_rules 1---* approval_rule_conditions

approval_rules 1---* approval_instances
approval_instances 1---* approval_steps
approval_instances 1---* approval_actions
approval_instances 1---* approval_exceptions
approval_instances 1---* approval_overrides
approval_instances 1---* approval_evidence
approval_instances 1---* approval_notifications
approval_instances 1---* approval_conflicts
approval_instances 1---* approval_revisions

approval_steps 1---* approval_actions
approval_delegations -> approval_steps (optional active delegation)
approval_participants -> approval_instances
approval_sla_events -> approval_steps / approval_instances
```

## 7.3 Recommended Indexing

- `approval_instances(current_state, org_id, factory_id, due_at)`
- `approval_instances(resource_type, resource_id, action_key)`
- `approval_steps(assigned_user_id, state, due_at)`
- `approval_steps(assigned_role_key, state, scope_level)`
- `approval_actions(actor_user_id, created_at desc)`
- `approval_exceptions(state, effective_to)`
- `approval_overrides(state, approved_at)`
- `approval_delegations(delegate_user_id, starts_at, ends_at, state)`
- `approval_conflicts(conflict_type, detected_at desc)`

Partition `approval_actions` monthly for performance.

## 7.4 Key Constraints

| Constraint | Purpose |
|-----------|---------|
| One active rule version per same specificity tuple | Prevent ambiguous rule resolution |
| One open active approval instance per resource/action unless `allow_parallel=true` | Prevent duplicate approval races |
| Maker cannot be approver on same instance | Enforce maker-checker |
| Subject user cannot approve own access/security workflow | Prevent self-target approval |
| Delegation end time mandatory | Prevent indefinite delegation |
| Exception end time mandatory | Prevent permanent exception |
| Override cannot be approved unless override request exists | Integrity |
| Completed/cancelled/rejected terminal states immutable except superseding revision | Audit integrity |
| Step approvers distinct when rule requires distinctness | SoD |
| Rule versions immutable once active | Auditability |

---

# 8. API & Service Architecture

## 8.1 Service Components

| Service | Purpose |
|---------|---------|
| ApprovalOrchestrator | Entry point for workflow approval creation and completion |
| ApprovalRuleResolver | Resolves applicable rule/version |
| ApprovalStepBuilder | Builds runtime steps from rule |
| ApproverEligibilityService | Scope + permission + SoD + delegation validation |
| ApprovalActionService | Handles approve/reject/escalate actions |
| DelegationService | Create/revoke/expire delegations |
| ExceptionService | Request/review exception path |
| OverrideService | Request/review override path |
| ApprovalNotificationService | In-app/email/WhatsApp notifications |
| ApprovalSLAService | Reminder, expiry, auto-escalation |
| ApprovalAuditService | Writes immutable approval audit events |
| ApprovalQueryService | Queue, history, dashboards |
| ApprovalConflictService | Static/dynamic conflict evaluation |

## 8.2 Core Internal Contracts

### `initiate_approval()`

```python
initiate_approval(
    *,
    actor,
    workflow_key: str,
    action_key: str,
    resource_type: str,
    resource_id: str,
    org_id: str,
    factory_id: str | None,
    department_id: str | None,
    subject_user_id: int | None,
    current_workflow_state: str,
    requested_change: dict | None,
    attributes: dict | None,
    request_context: RequestContext,
) -> ApprovalDecision
```

Returns: `ApprovalDecision` with result (no_approval_required/approval_required/escalation_required/exception_required/override_required/denied) + instance_id + rule_id + rule_version + reason.

### `perform_approval_action()`

```python
perform_approval_action(
    *,
    actor,
    approval_instance_id: str,
    action: Literal["approve", "reject", "escalate", "request_exception",
                    "approve_exception", "deny_exception", "request_override",
                    "approve_override", "deny_override", "request_evidence",
                    "submit_evidence", "cancel"],
    comment: str | None,
    reason_code: str | None,
    evidence_refs: list[str] | None,
    request_context: RequestContext,
) -> ApprovalActionResult
```

## 8.3 Public API Surface

| Method | Endpoint | Purpose |
|--------|----------|---------|
| POST | `/approvals/instances` | Create approval instance from generic subject |
| GET | `/approvals/instances/{id}` | View approval instance detail |
| GET | `/approvals/queue/me` | Current actor queue |
| GET | `/approvals/queue/team` | Supervisor/manager queue by scope |
| GET | `/approvals/history` | Historical approvals |
| POST | `/approvals/instances/{id}/submit` | Submit draft |
| POST | `/approvals/instances/{id}/approve` | Approve active step |
| POST | `/approvals/instances/{id}/reject` | Reject active step |
| POST | `/approvals/instances/{id}/escalate` | Escalate |
| POST | `/approvals/instances/{id}/request-evidence` | Ask for more evidence |
| POST | `/approvals/instances/{id}/submit-evidence` | Attach evidence / resubmit |
| POST | `/approvals/instances/{id}/request-exception` | Start exception flow |
| POST | `/approvals/exceptions/{id}/approve` | Approve exception |
| POST | `/approvals/exceptions/{id}/deny` | Deny exception |
| POST | `/approvals/instances/{id}/request-override` | Start override flow |
| POST | `/approvals/overrides/{id}/approve` | Approve override |
| POST | `/approvals/overrides/{id}/deny` | Deny override |
| POST | `/approvals/instances/{id}/cancel` | Cancel |
| POST | `/approvals/delegations` | Create delegation |
| DELETE | `/approvals/delegations/{id}` | Revoke delegation |
| GET | `/approvals/rules` | Rule listing (governance) |
| POST | `/approvals/rules` | Create rule version |
| POST | `/approvals/rules/{id}/activate` | Activate approved rule version |

## 8.4 Event Model

### Required Domain Events
- `APPROVAL_INSTANCE_CREATED`, `APPROVAL_SUBMITTED`, `APPROVAL_STEP_ASSIGNED`
- `APPROVAL_STEP_APPROVED`, `APPROVAL_STEP_REJECTED`, `APPROVAL_ESCALATED`
- `APPROVAL_EVIDENCE_REQUESTED`, `APPROVAL_EVIDENCE_SUBMITTED`
- `APPROVAL_EXCEPTION_REQUESTED`, `APPROVAL_EXCEPTION_APPROVED`, `APPROVAL_EXCEPTION_DENIED`
- `APPROVAL_OVERRIDE_REQUESTED`, `APPROVAL_OVERRIDE_APPROVED`, `APPROVAL_OVERRIDE_DENIED`
- `APPROVAL_COMPLETED`, `APPROVAL_CANCELLED`, `APPROVAL_EXPIRED`
- `APPROVAL_DELEGATION_CREATED`, `APPROVAL_DELEGATION_REVOKED`
- `APPROVAL_CONFLICT_BLOCKED`, `APPROVAL_SLA_BREACHED`

### Consumers
Originating module, notification service, audit service, ops alerting, analytics/reporting, governance dashboards.

## 8.5 Background Workers Required

| Worker | Purpose |
|--------|---------|
| SLA Monitor | Detect overdue steps |
| Escalation Worker | Auto-route escalations |
| Reminder Worker | Send reminders before due_at |
| Delegation Expiry Worker | Revoke expired delegations |
| Exception Expiry Worker | Expire temporary exceptions |
| Override Post-Review Worker | Enforce post-incident review |
| Evidence Integrity Worker | Verify evidence hash/storage references |
| Queue Projection Worker | Materialize dashboards / fast queue views |

---

# 9. Audit & Compliance

## 9.1 Required Audit Actions

Every approval action must produce an audit event: APPROVAL_DRAFT_CREATED, APPROVAL_SUBMITTED, APPROVAL_STEP_ASSIGNED, APPROVAL_STEP_APPROVED, APPROVAL_STEP_REJECTED, APPROVAL_ESCALATED, APPROVAL_EVIDENCE_REQUESTED, APPROVAL_EVIDENCE_SUBMITTED, APPROVAL_EXCEPTION_REQUESTED, APPROVAL_EXCEPTION_APPROVED, APPROVAL_EXCEPTION_DENIED, APPROVAL_OVERRIDE_REQUESTED, APPROVAL_OVERRIDE_APPROVED, APPROVAL_OVERRIDE_DENIED, APPROVAL_DELEGATION_CREATED, APPROVAL_DELEGATION_REVOKED, APPROVAL_CANCELLED, APPROVAL_EXPIRED, APPROVAL_CONFLICT_BLOCKED, APPROVAL_COMPLETED.

## 9.2 Mandatory Audit Metadata

Every event must capture: event_id, event_time, event_type, actor_user_id, actor_assignment_id, actor_role_key, delegator_user_id (nullable), delegate_user_id (nullable), org_id, factory_id, department_id, workflow_key, action_key, resource_type, resource_id, approval_instance_id, approval_step_id (nullable), previous_state, new_state, reason_code, comment, rule_id, rule_version, scope_evaluated, permission_key used, maker_user_id, subject_user_id (nullable), checker_user_id (nullable), escalation_target (nullable), exception_id (nullable), override_id (nullable), conflict_type (nullable), mfa_verified, request_id, session_id, ip hash, user agent, evidence references/hashes.

## 9.3 Evidence Retention

| Category | Retention |
|----------|:---------:|
| Financial approvals, reversals, invoice exceptions, billing | 7 years |
| Security exceptions, break-glass, privileged access approvals | 7 years |
| Inventory/dispatch/production approvals | 3-5 years configurable |
| Attendance approvals | 3 years or local statutory requirement |
| Notification delivery logs | 1 year |
| Delegation records | 3 years |
| SoD conflict events | 7 years |

## 9.4 Compliance Mapping

| Control Area | ISO 27001 | SOC 2 | Internal Audit Expectation |
|-------------|:---------:|:-----:|:--------------------------|
| Least privilege + scoped approval | A.5 / A.8 | CC6 | Approval authority documented |
| Segregation of duties | A.5.3 / A.5.15 | CC6.1 / CC6.2 | Toxic combos prevented and reviewed |
| Privileged access and emergency access | A.8 / A.5 | CC6 / CC7 | Break-glass fully audited |
| Logging and monitoring | A.8.15 / A.8.16 | CC7 | Full approval trail exportable |
| Change governance for rules | A.8 / A.5.18 | CC8 | Rule versions approved and immutable |
| Incident-linked override | A.5 / A.8 | CC7 | Post-override review mandatory |
| Evidence integrity | A.8.15 | CC7 | Attachment chain-of-custody |

## 9.5 Internal Audit Requirements

1. Monthly exception report
2. Monthly override report
3. Quarterly SoD conflict review
4. Quarterly delegated approval review
5. Quarterly dormant approver review
6. Sample review of critical approvals
7. Full export of all actions for selected workflow/resource
8. Rule-version traceability for every completed approval

---

# 10. Security Review

## 10.1 Risk Register

| Risk | Attack Scenario | Detection Strategy | Prevention Strategy |
|------|----------------|-------------------|-------------------|
| Approval bypass | API directly mutates business record without approval instance | Compare mutation logs vs approval completion events | Originating modules must require approval_instance_id for controlled state changes |
| Self-approval | Maker calls approve endpoint on own item | Rule-engine same-user check, conflict event | Deny at PEP + service + DB audit |
| Delegation abuse | Approver delegates to colluding or ineligible user | Delegation anomaly reports, short-cycle review | Scope-bound, time-bound, no override delegation by default |
| Override abuse | Routine actions forced through override path | Override frequency analytics, reason-code outliers | Strict rule gating, MFA, evidence, post-review |
| Escalation abuse | User escalates to friendly approver to bypass normal checker | Unusual escalation patterns, graph analytics | Rule-defined escalation targets only |
| Multi-factory abuse | User uses assignment from Factory A to approve Factory B item | Factory mismatch audit events | Scope-bound approval resolution only |
| Hidden collusion | Same small group repeatedly approve each other's high-risk items | Approval network analysis | Reviewer rotation, recertification, sampling |
| SoD exception laundering | Temporary exception repeatedly renewed | Renewal frequency alerts | No auto-renew, each renewal new approval |
| Privileged access self-targeting | Org Admin changes own role/access | Self-target block logs | Hard deny |
| Queue hijacking | Unauthorized user claims approval task | Invalid assignment claim alerts | Active-step assignee validation |
| Replay/race | Same step approved twice or after rejection | Idempotency keys, optimistic locking | Step state lock/versioning |
| Evidence tampering | Evidence replaced after approval | Evidence hash mismatch | Immutable object store refs / hash verification |
| Break-glass misuse | Emergency access requested for routine work | Incident correlation, post-review | Dual approval, expiry, watermarking |
| Dormant approver risk | Old privileged approver remains active | Dormant-assignment reporting | Recertification and inactivity disablement |

## 10.2 Required Detection Controls

- Real-time alert on self-approval attempt
- Alert on high-risk override
- Alert on cross-factory approval denial
- Alert on repeated exception renewals
- Alert on same approver concentration in critical workflows
- Alert on approval without MFA where required
- Alert on completed mutation without corresponding approval completion event
- Alert on delegation near-expiry or suspicious volume
- Dashboard for overdue approvals and bypass attempts

## 10.3 Required Preventive Controls

1. PDP + approval engine dual gate
2. Immutable action logs
3. Optimistic locking on instance/step state
4. Idempotent action endpoints
5. Delegation constraints
6. Exception expiry
7. Override reason taxonomy
8. MFA for critical approvals
9. Scope resolution using active assignment
10. Rule-version pinning for in-flight instances

---

# 11. Implementation Guidance

## 11.1 How This Fits the Existing Architecture

This platform extends the approved target state cleanly:
- Existing **PDP** still makes permission decisions
- Approval platform handles `REQUIRE_APPROVAL`, `REQUIRE_ESCALATION`, `REQUIRE_BREAK_GLASS`
- Existing `approval_rules` concept from the foundation spec expands into full runtime governance
- Existing route-to-permission audit maps where approval checks must be inserted
- Existing migration plan can treat this as the next platform layer

## 11.2 Module Integration Rule

No module may:
- Decide its own approver list inline
- Perform self-approval checks with ad hoc code only
- Embed threshold logic in routers
- Bypass approval state machine
- Write approval outcome without approval action record

All modules must call the central approval service.

---

## Final Conclusion

DPR.ai should implement approval governance as a **first-class platform service**, not as scattered module code.

The final target state is:

> **Business action → PDP authorization → approval rule evaluation → scoped approver resolution → SoD validation → audited action → completion callback**

This gives DPR.ai:
- Reusable maker-checker across all modules
- Enforceable SoD for finance, operations, and governance
- Enterprise-grade escalation and exception handling
- Auditable override and break-glass control
- Future reuse for procurement, maintenance, vendor, and audit workflows
- Strong multi-factory governance for the next 5+ years

---

*Document: DPR.ai Approval, Maker-Checker & Separation of Duties Platform — Phase 3*  
*Date: June 16, 2026*  
*Next: Implementation-ready SQL schema, FastAPI service contracts, and rule seed catalog*
