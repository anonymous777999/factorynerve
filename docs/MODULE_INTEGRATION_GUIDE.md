# DPR.ai — Module Integration Guide: Central Approval System

> **⚡ SINGLE SOURCE OF TRUTH** ⚡
>
> This document is the authoritative specification for ALL role, permission, scope, workflow state, maker-checker, SoD, audit, and approval governance decisions in the DPR.ai platform.
>
> **Architecture Formula:** `Role + Permission + Scope + Workflow State + Maker-Checker + Audit`
>
> **Key Principle:** No module implements its own approval logic. Every workflow calls the central Approval Service.
>
> **Implementation Priority:** Always follow this document first. Any code change that contradicts this guide must be flagged during PR review.

---

### Companion Documents

These documents provide supplementary detail referenced by this guide:

| Document | Path | Content |
|----------|------|---------|
| **Workflow State Matrix** | `docs/WORKFLOW_STATE_MATRIX.md` | Full state diagrams, transition tables, all 20 workflows (Section 21-23), audit requirements |
| **Approval Platform Design** | `docs/APPROVAL_MAKER_CHECKER_SOD_PLATFORM.md` | Approval rule engine, database schema, API contracts, service components, compliance mapping |
| **Authorization Migration Plan** | `docs/COMPLETE_AUTHORIZATION_MIGRATION_PLAN.md` | Per-endpoint detail for all ~250 endpoints, test case catalog, rollback plan |
| **Feedback Security Plan** | `docs/FEEDBACK_CHANNEL_SECURITY_PLAN.md` | Data exfiltration controls for the feedback feature (content controls, rate limiting, anomaly detection) |

**How to use:** Need to know the permission key for an endpoint? → Section 3. Need to know what state transitions are legal? → Section 7. Need to know who can approve/escalate/override? → Section 9.5. Need to know the implementation sequence? → Section 6.

---

### Cross-Reference Index

| Concept | Primary Section | Companion Doc |
|---------|:--------------:|:-------------:|
| Permission keys per endpoint | §3 (per-router tables) | Migration Plan §3 |
| Integration patterns (IP-0→IP-5) | §2 | — |
| Code change templates (A-E) | §4 | — |
| Workflow state diagrams | §7.1.1 (summary) | Workflow State Matrix §2-20 |
| State transition constants | §7.1.3 | Workflow State Matrix §2-20 |
| Universal approval state machine | §7 (reference) | Workflow State Matrix §21 |
| Transition permission matrix | — | Workflow State Matrix §22 |
| Maker-checker gaps (G1-G8) | §8.1 | Workflow State Matrix §23 |
| Transition validation gaps (V1-V8) | §8.2 | Workflow State Matrix §23 |
| Audit coverage gaps | §8.3 | Workflow State Matrix §23 |
| SoD conflict register | §8.4 (summary) | Approval Platform §3 |
| Approval authority (who approves) | §9.5 | Approval Platform §1.4 |
| Escalation hierarchy | §9.6 | Approval Platform §1.6 |
| Self-approval prevention (4 layers) | §9.7 | Approval Platform §2.5 |
| Toxic combinations (static) | §9.8 | Approval Platform §3.2 |
| Toxic combinations (dynamic) | §9.9 | Approval Platform §3.3 |
| MFA enforcement points | §9.1 | — |
| Break-glass integration | §9.2 | — |
| Denial audit logging | §9.3 | — |
| Approval engine DB schema | — | Approval Platform §7 |
| Approval API contracts | — | Approval Platform §8 |
| Audit & compliance mapping | — | Approval Platform §9 |
| Security risk register | — | Approval Platform §10 |
| Migration phases & sequencing | §6 | Migration Plan §5 |
| Per-endpoint migration detail | §3 (summary) | Migration Plan §3 |
| Test case catalog | §5 | Migration Plan §6 |
| Rollback plan | §6 (safety) | Migration Plan §7 |
| Feedback security controls | §3.16 | Feedback Security Plan |
| Permission catalog additions needed | §3.14-3.16 | Migration Plan §4.1 |

---

## Table of Contents

1. [Integration Architecture Overview](#1-integration-architecture-overview)
2. [Integration Patterns (IP-0 through IP-5)](#2-integration-patterns)
3. [Router-by-Router Integration Guide](#3-router-by-router-integration-guide)
   - 3.1 Auth Routers (auth.py, auth_secure.py, auth_google.py, phone_auth.py)
   - 3.2 Production Entries (entries.py)
   - 3.3 Attendance (attendance.py)
   - 3.4 OCR Pipeline (ocr.py)
   - 3.5 Steel ERP (steel.py)
   - 3.6 Analytics (analytics.py)
   - 3.7 AI Insights (ai.py)
   - 3.8 Intelligence (intelligence.py)
   - 3.9 Reports & Exports (reports.py)
   - 3.10 Premium (premium.py)
   - 3.11 Email Summaries (emails.py)
   - 3.12 Billing (billing.py)
   - 3.13 Settings & User Management (settings.py)
   - 3.14 Alerts (alerts.py)
   - 3.15 Alert Recipients (alert_recipients.py)
   - 3.16 Feedback (feedback.py)
   - 3.17 Jobs (jobs.py)
   - 3.18 Observability (observability.py)
   - 3.19 Admin Modules (admin_billing.py, admin_ai.py)
   - 3.20 Webhook (whatsapp_webhook.py)
4. [Code Change Templates](#4-code-change-templates)
5. [Testing Strategy](#5-testing-strategy)
6. [Migration Sequence Per Router](#6-migration-sequence-per-router)

---

## 1. Integration Architecture Overview

### 1.1 How a Router Connects to the Approval System

```
┌──────────────────────────────────────────────────────────────────────────┐
│                          CLIENT (Frontend)                               │
└────────────────────────────────┬─────────────────────────────────────────┘
                                 │ HTTP Request
                                 ▼
┌──────────────────────────────────────────────────────────────────────────┐
│                    FASTAPI MIDDLEWARE (PEP Layer)                        │
│                                                                          │
│  ┌──────────────────────────────────────────────────────────────────┐   │
│  │  AuthorizationMiddleware                                         │   │
│  │  • Checks route-to-permission mapping                            │   │
│  │  • Calls PDP.authorize() for permission + scope                   │   │
│  │  • On DENY, returns 403 before router code runs                  │   │
│  └──────────────────────────────────────────────────────────────────┘   │
└────────────────────────────────┬─────────────────────────────────────────┘
                                 │ Passes through
                                 ▼
┌──────────────────────────────────────────────────────────────────────────┐
│                     ROUTER HANDLER (PEP at handler level)                │
│                                                                          │
│  STEP 1: require_permission()  ← replaces require_role()                 │
│  STEP 2: If mutation → call ApprovalService.initiate_approval()          │
│  STEP 3: Check approval decision                                        │
│  STEP 4: If approved → proceed with business logic                      │
│  STEP 5: On completion → ApprovalService.complete_approval()             │
│  STEP 6: Write audit event                                              │
└────────────────────────────────┬─────────────────────────────────────────┘
                                 │
                                 ▼
┌──────────────────────────────────────────────────────────────────────────┐
│                      APPROVAL SERVICE (Central Engine)                   │
│                                                                          │
│  • ApprovalOrchestrator — entry point                                    │
│  • ApprovalRuleResolver — finds applicable rule                          │
│  • ApprovalStepBuilder — builds steps from rule                          │
│  • ApproverEligibilityService — validates approvers                      │
│  • ApprovalActionService — handles approve/reject/escalate               │
│  • ApprovalConflictService — SoD validation                              │
│  • ApprovalAuditService — writes immutable events                        │
└──────────────────────────────────────────────────────────────────────────┘
```

### 1.2 Three Integration Points Per Router

| Integration Point | What Changes | Where | When |
|:-----------------|:-------------|:------|:-----|
| **PDP Permission Check** | Replace `require_role()` / `require_any_role()` / ad-hoc role blocks with `require_permission()` | Top of each handler, before business logic | Phase 2 (permission migration) |
| **Approval Initiation** | Add `ApprovalService.initiate_approval()` call before mutation | After permission check, before DB write | Phase 3 (approval migration) |
| **Approval Completion Callback** | Add `ApprovalService.complete_approval()` or hook approval completion event | After successful mutation | Phase 3 (approval migration) |

### 1.3 Current State per Router

| Router | Current Auth Mechanism | Target Integration Pattern | Approval Needed? | Migration Priority |
|--------|----------------------|--------------------------|:----------------:|:------------------:|
| auth.py (legacy) | Public / `get_current_user` | None (public auth) | No | Phase 4 |
| auth_secure.py | Public / token auth | None (public auth) | No | Phase 4 |
| phone_auth.py | Public | None (public auth) | No | Phase 4 |
| entries.py | Role block + `require_role(SUPERVISOR)` | IP-2 (entry create) + IP-3 (approve/reject) | ✅ | P1 |
| attendance.py | `require_role(SUPERVISOR)` for review | IP-1 (self punch) + IP-2 (regularization review) | ✅ | P1 |
| ocr.py | `_require_ocr_access()` role set | IP-2 (verification approve/reject) + IP-0 (upload) | ✅ | P1 |
| analytics.py | `require_any_role(SUP+)` | IP-0 (read-only, no auth change needed) | No | P3 |
| ai.py | `_ensure_ai_access()` (roles removed) | IP-0 (read queries, no approval) | No | P0 (fix gap) |
| intelligence.py | None (roles removed) | IP-0 (read queries) | No | P0 (fix gap) |
| reports.py | `require_any_role(OPR+)` | IP-0 (read-only, no approval) | No | P3 |
| premium.py | `require_any_role(SUP+)` | IP-0 (read-only with plan check) | No | P3 |
| emails.py | `require_any_role(ACC+)` | IP-0 (read/export, no approval) | No | P3 |
| billing.py | `require_role(ADMIN)` / `require_role(OWNER)` | IP-2 (order create) + IP-3 (downgrade) | ✅ | P1 |
| settings.py | `require_role(MANAGER)` / `require_role(ADMIN)` | IP-3 (factory create) + IP-4 (role assign, user invite) | ✅ | P1 |
| steel.py | Mix of `require_role()`, `require_any_role()`, no-check | IP-2 through IP-5 (see full matrix below) | ✅ | P1 |
| alerts.py | `require_any_role(OPR+)` | IP-0 (read-only) | No | P3 |
| alert_recipients.py | `require_any_role(ADMIN, OWNER)` | IP-2 (CRUD) | No (config) | P2 |
| feedback.py | `get_current_user` | IP-0 (submit/read, no approval) | No | P3 |
| jobs.py | Owner-id check | IP-0 (self-scoped, no approval) | No | P3 |
| observability.py | Public / admin | IP-0 (system, no approval) | No | P3 |
| admin_billing.py | None | IP-3 (admin operations) | ✅ | P2 |
| admin_ai.py | None | IP-3 (admin operations) | ✅ | P2 |
| whatsapp_webhook.py | Webhook signature | IP-0 (external, no approval) | No | N/A |

---

## 2. Integration Patterns (IP-0 through IP-5)

### Pattern IP-0: Read-Only / No Approval Required

**Used for:** GET endpoints, public routes, external webhooks, self-scoped reads.

**Integration:**

```python
# CURRENT:
@router.get("/items")
def list_items(current_user: User = Depends(get_current_user)):
    return items

# TARGET:
@router.get("/items")
def list_items(
    _: None = Depends(RequirePermission("inventory.item.view")),
    current_user: User = Depends(get_current_user),
):
    return items
```

**No approval system call needed.** PDP permission check is sufficient.

### Pattern IP-1: Self-Service / Maker-Only

**Used for:** Self-punch attendance, self-regularization request, feedback submission, profile updates.

**Integration:**

```python
@router.post("/punch")
def punch_attendance(
    _: None = Depends(RequirePermission("attendance.self.punch")),
    ...
):
    # No approval needed — maker creates directly
    # Audit event automatically logged by PEP
    record = AttendanceRecord(...)
    db.add(record)
    db.commit()
```

**No approval system call needed.** Maker creates directly. Audit is automatic.

### Pattern IP-2: Maker-Checker (Single Stage)

**Used for:** Attendance review approve/reject, entry approve/reject, OCR verification approve/reject, inventory reconciliation, payment standard.

**Integration:**

```python
@router.post("/{entry_id}/approve")
def approve_entry(
    entry_id: int,
    _: None = Depends(RequirePermission("production.entry.approve")),
    ...
):
    # 1. PDP already checked permission + scope
    # 2. Call approval service to check maker-checker
    decision = approval_service.initiate_approval(
        actor=current_user,
        workflow_key="production.entry.approve",
        action_key="production.entry.approve",
        resource_type="Entry",
        resource_id=str(entry_id),
        org_id=org_id,
        factory_id=factory_id,
        subject_user_id=entry.user_id,  # maker
        current_workflow_state=entry.status,
    )
    
    if decision.result == "denied":
        raise HTTPException(status_code=403, detail=decision.reason)
    
    if decision.result == "no_approval_required":
        # Direct approval (e.g., Admin/Owner override path)
        entry.status = "approved"
        db.commit()
        return entry
    
    if decision.result == "approval_required":
        return JSONResponse(
            status_code=202,
            content={
                "status": "pending_approval",
                "approval_instance_id": decision.instance_id,
                "message": "Submitted for approval"
            }
        )
    elif decision.result not in ("approved", "no_approval_required"):
        raise HTTPException(status_code=500, detail=f"Unexpected approval result: {decision.result}")
```

### Pattern IP-3: Sequential Two-Stage Approval

**Used for:** Attendance override, production entry correction/override, inventory reconciliation high variance, payment reallocation, factory creation, user role assignment, access assignment.

**Integration:**

```python
@router.post("/inventory/reconciliations/{id}/approve")
def approve_reconciliation(
    reconciliation_id: int,
    request: Request,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
) -> dict:
    factory_id = resolve_factory_id(db, current_user)
    reconciliation = _get_reconciliation_or_404(db, reconciliation_id, factory_id)
    
    # Stage 1: L1 approval initiation
    decision = approval_service.initiate_approval(
        actor=current_user,
        workflow_key="inventory.reconciliation.approve",
        action_key="inventory.reconciliation.approve",
        resource_type="SteelStockReconciliation",
        resource_id=str(reconciliation_id),
        org_id=resolve_org_id(current_user),
        factory_id=factory_id,
        subject_user_id=reconciliation.counted_by_user_id,
        current_workflow_state=reconciliation.status,
        attributes={
            "variance_percent": reconciliation.variance_percent,
            "variance_kg": reconciliation.variance_kg,
        },
        request_context=build_request_context(request),
    )
    
    if decision.result in ("denied",):
        raise HTTPException(status_code=403, detail=decision.reason)
    
    if decision.result == "approval_required":
        # L1 initiated — instance is pending L1 reviewer
        return JSONResponse(
            status_code=202,
            content={
                "status": "pending_l1_approval",
                "approval_instance_id": decision.instance_id,
                "message": "Reconciliation submitted for first-level review."
            }
        )
    
    if decision.result == "pending_l2":
        # L1 approved — escalation to L2 (triggered automatically by approval engine)
        # The handler does NOT mutate state here — the approval completion callback does
        return JSONResponse(
            status_code=202,
            content={
                "status": "pending_l2_approval",
                "approval_instance_id": decision.instance_id,
                "message": "L1 approved. Escalated to L2 for final review."
            }
        )
    
    # Unexpected result — fail safe
    raise HTTPException(status_code=500, detail=f"Unexpected approval decision: {decision.result}")


# L2 approval happens via a separate endpoint that calls advance_approval()
@router.post("/approvals/{instance_id}/advance")
def advance_reconciliation_approval(
    instance_id: str,
    payload: ApprovalActionRequest,
    request: Request,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
) -> dict:
    factory_id = resolve_factory_id(db, current_user)
    
    # Advance the approval instance (approval engine handles L1→L2 transition internally)
    result = approval_service.advance_approval(
        instance_id=instance_id,
        actor=current_user,
        action=payload.action,  # "approve" or "reject"
        reason=payload.reason,
        request_context=build_request_context(request),
    )
    
    if result.result in ("denied",):
        raise HTTPException(status_code=403, detail=result.reason)
    
    if result.result == "approval_required":
        return JSONResponse(
            status_code=202,
            content={"status": "pending_further_approval", "approval_instance_id": instance_id}
        )
    
    # Approval completed — apply the state change via callback
    # The approval engine fires _on_reconciliation_approved() via registration
    return {"status": "completed", "decision": result.decision}
```

### Pattern IP-4: Cross-Domain / Parallel Approval

**Used for:** Customer credit override, post-dispatch invoice edit, invoice void, dispatch quantity override, payment reversal, privileged role assignment.

**Integration:**

```python
@router.post("/invoices/{id}/edit-post-dispatch")
def edit_invoice_post_dispatch(
    invoice_id: int,
    ...
):
    decision = approval_service.initiate_approval(
        workflow_key="invoice.post_dispatch_edit",
        action_key="invoice.record.edit_post_dispatch",
        resource_type="SteelSalesInvoice",
        ...
    )
    # Requires approval from BOTH Accountant AND Factory Manager
    # Approval system tracks both required approvals
    
    if decision.result in ("denied",):
        raise HTTPException(status_code=403, detail=decision.reason)
    
    if decision.result == "approval_required":
        return JSONResponse(
            status_code=202,
            content={
                "status": "pending_approval",
                "instance_id": decision.instance_id,
                "required_approvers": decision.required_approver_roles,
            }
        )
    elif decision.result not in ("approved", "no_approval_required"):
        raise HTTPException(status_code=500, detail=f"Unexpected approval result: {decision.result}")
```

### Pattern IP-5: Critical Exception / Override / Emergency Dual Approval

**Used for:** Billing plan change/downgrade/manual override, SoD exception, break-glass access, security exception, approval rule/policy change.

**Integration:**

```python
@router.post("/billing/downgrade")
def schedule_downgrade(
    ...
):
    decision = approval_service.initiate_approval(
        workflow_key="billing.plan.downgrade",
        action_key="billing.plan.change",
        ...
    )
    # Requires dual approval (Org Owner + Security Admin visibility)
    # MFA required
    # Full audit trail mandatory
    # Post-event review mandatory
```

---

## 3. Router-by-Router Integration Guide

### 3.1 Auth Routers (auth.py, auth_secure.py, auth_google.py, phone_auth.py)

**Integration Pattern:** None (public auth endpoints)

**Current state:** All public endpoints — registration, login, password reset, email verification, Google OAuth, phone verification. No authorization needed.

**Target state:** No change. These remain public endpoints. The `PDP.authorize()` call is skipped for routes matching public prefixes.

**Approval system:** Not applicable.

**Code changes needed:**
- Register public route prefixes in `AuthorizationMiddleware._is_public_route()`
- No other changes

### 3.2 Production Entries (entries.py)

**Key endpoints:** 10 endpoints

| Endpoint | Method | Current Auth | Target Pattern | Target Permission | Approval Call | Priority |
|----------|--------|-------------|:--------------:|:-----------------:|:-------------:|:--------:|
| `/smart` | POST | Role block (ACC, ATT) | IP-1 | `production.entry.create` | No | P2 |
| `/` | POST | Role block (ACC, ATT) | IP-1 | `production.entry.create` | No | P2 |
| `/` | GET | Role filter | IP-0 | `production.entry.view_team` | No | P3 |
| `/{id}/approve` | POST | `require_role(SUPERVISOR)` | IP-2 | `production.entry.approve` | ✅ | P1 |
| `/{id}/reject` | POST | `require_role(SUPERVISOR)` | IP-2 | `production.entry.reject` | ✅ | P1 |
| `/{id}` | GET | Implicit | IP-0 | `production.entry.view_team` | No | P3 |
| `/{id}` | PUT | Complex role logic | IP-2 | `production.entry.edit_own_draft` | Conditional | P2 |
| `/{id}` | DELETE | `require_role(MANAGER)` | IP-2 | `production.entry.delete` | ✅ | P2 |
> **Fix:** Permission key renamed from `production.override` to `production.entry.delete` for naming consistency with other entry permissions. The original `production.override` key appeared only in this single table row with no definition anywhere — it has been replaced with the standard `production.entry.*` naming pattern.
| `/today` | GET | Role filter | IP-0 | `production.entry.view_team` | No | P3 |

**Integration code (approve_entry as example):**

```python
# CURRENT — entries.py line 756
@router.post("/{entry_id}/approve", response_model=EntryResponse)
def approve_entry(
    entry_id: int,
    request: Request,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
) -> EntryResponse:
    require_role(current_user, UserRole.SUPERVISOR)
    entry = get_org_record_or_404_sync(db, Entry, entry_id, current_user)
    if not entry.is_active:
        raise HTTPException(status_code=404, detail="Entry not found.")
    if not _can_view_entry(db, current_user, entry):
        raise HTTPException(status_code=403, detail="Access denied.")
    assert_not_self_approval(entry.user_id, current_user.id)
    entry.status = "approved"
    # ... audit, commit, return

# TARGET
@router.post("/{entry_id}/approve", response_model=EntryResponse)
def approve_entry(
    entry_id: int,
    request: Request,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
) -> EntryResponse:
    # Step 1: PDP permission check
    pdp = PDP(db=db, mode=PDP_MODE)
    request_context = build_request_context(request)
    factory_id = resolve_factory_id(db, current_user)
    org_id = resolve_org_id(current_user)
    pdp.require_permission(
        actor=current_user,
        permission_key="production.entry.approve",
        resource=ResourceContext(factory_id=factory_id),
        request_context=request_context,
    )
    
    entry = get_org_record_or_404_sync(db, Entry, entry_id, current_user)
    if not entry.is_active:
        raise HTTPException(status_code=404, detail="Entry not found.")
    
    # NOTE: _can_view_entry logic is absorbed into the PDP scope check above.
    # The PDP validates factory_id scope which subsumes the previous explicit guard.
    # If cross-factory delegation or archived-entry logic is needed later, it must
    # be added as a resource-level attribute to the PDP call (not re-added here).
    
    # Step 2: Approval service initiation (maker-checker)
    approval_decision = approval_service.initiate_approval(
        actor=current_user,
        workflow_key="production.entry.approve",
        action_key="production.entry.approve",
        resource_type="Entry",
        resource_id=str(entry_id),
        org_id=org_id,
        factory_id=factory_id,
        subject_user_id=entry.user_id,
        current_workflow_state=entry.status,
        requested_change={"new_status": "approved"},
        request_context=request_context,
    )
    
    # Step 3: Handle decision
    if approval_decision.result in ("denied",):
        raise HTTPException(status_code=403, detail=approval_decision.reason)
    
    if approval_decision.result == "approval_required":
        return JSONResponse(
            status_code=202,
            content={
                "status": "pending_approval",
                "approval_instance_id": approval_decision.instance_id,
                "message": "Submitted for approval."
            }
        )
    elif approval_decision.result not in ("approved", "no_approval_required"):
        raise HTTPException(status_code=500, detail=f"Unexpected approval result: {approval_decision.result}")
    
    # Step 4: Proceed with mutation
    entry.status = "approved"
    _write_audit_log(...)
    db.commit()
    db.refresh(entry)
    
    # Step 5: Notify approval system of completion
    if approval_decision.instance_id:
        approval_service.complete_approval(instance_id=approval_decision.instance_id)
    
    return entry
```

### 3.3 Attendance (attendance.py)

**Key endpoints:** 11 endpoints

| Endpoint | Method | Current Auth | Target Pattern | Target Permission | Approval Call | Priority |
|----------|--------|-------------|:--------------:|:-----------------:|:-------------:|:--------:|
| `/me/today` | GET | None | IP-1 | `attendance.self.view` | No | P2 |
| `/punch` | POST | None | IP-1 | `attendance.self.punch` | No | P2 |
| `/live` | GET | `require_role(SUPERVISOR)` | IP-0 | `attendance.team.view` | No | P3 |
| `/settings/employees` | GET/POST | `require_role(MANAGER)` | IP-2 | `attendance.profile.manage` | No (config) | P2 |
| `/settings/shifts` | GET/POST | `require_role(MANAGER)` | IP-2 | `attendance.shift_template.manage` | No (config) | P2 |
| `/me/regularizations` | POST | None | IP-1 | `attendance.self.regularization.request` | No | P2 |
| `/review` | GET | Role set | IP-0 | `attendance.review.queue.view` | No | P3 |
| `/review/{id}/approve` | POST | Role set + self-approval check | IP-2 | `attendance.review.approve` | ✅ | P1 |
| `/review/{id}/reject` | POST | Role set + self-approval check | IP-2 | `attendance.review.reject` | ✅ | P1 |
| `/reports/summary` | GET | Role set including ACC | IP-0 | `attendance.report.view` | No | P3 |

**Key differences from current:**
- Self-punch (`/me/today`, `/punch`) becomes explicit permission-based but does NOT enter approval workflow
- Regularization requests are maker-only (self-service); approval review is maker-checker
- Employee profile management moves from `require_role(MANAGER)` to `attendance.profile.manage`
- Reports shift from role-set to explicit permission

**Integration code (approve review as example):**

```python
@router.post("/review/{attendance_id}/approve", response_model=AttendanceReviewItem)
def approve_attendance_review(
    attendance_id: int,
    payload: AttendanceReviewDecisionRequest,
    request: Request,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
) -> AttendanceReviewItem:
    # Step 1: Permission check
    pdp = PDP(db=db)
    request_context = build_request_context(request)
    pdp.require_permission(
        actor=current_user,
        permission_key="attendance.review.approve",
        resource=ResourceContext(factory_id=resolve_factory_id(db, current_user)),
        request_context=request_context,
    )
    
    factory = _active_factory_or_400(db, current_user)
    org_id = _active_org_or_400(current_user)
    record = (
        db.query(AttendanceRecord)
        .filter(AttendanceRecord.id == attendance_id, ...)
        .first()
    )
    if not record:
        raise HTTPException(status_code=404, detail="Attendance review record not found.")
    
    # Step 2: Approval initiation (maker-checker — self-approval blocked by ApproverEligibilityService)
    decision = approval_service.initiate_approval(
        actor=current_user,
        workflow_key="attendance.review.approve",
        action_key="attendance.review.approve",
        resource_type="AttendanceRecord",
        resource_id=str(attendance_id),
        org_id=org_id,
        factory_id=factory.factory_id,
        subject_user_id=record.user_id,        # the employee who submitted the regularization
        current_workflow_state=record.review_status,
        request_context=request_context,
    )

    if decision.result == "denied":
        raise HTTPException(status_code=403, detail=decision.reason)

    if decision.result == "approval_required":
        return JSONResponse(
            status_code=202,
            content={
                "status": "pending_approval",
                "approval_instance_id": decision.instance_id,
                "message": "Attendance review submitted for approval.",
            }
        )
    elif decision.result not in ("approved", "no_approval_required"):
        raise HTTPException(status_code=500, detail=f"Unexpected approval result: {decision.result}")

    # Step 3: Apply the review decision
    record.review_status = "approved"
    record.reviewed_by = current_user.id
    record.reviewed_at = datetime.now(timezone.utc)
    db.commit()

    # Step 4: Notify approval system of completion
    if decision.instance_id:
        approval_service.complete_approval(instance_id=decision.instance_id)

    return serialized_response
```

### 3.4 OCR Pipeline (ocr.py)

**Key endpoints:** ~20 endpoints

| Endpoint | Method | Current Auth | Target Pattern | Target Permission | Approval Call | Priority |
|----------|--------|-------------|:--------------:|:-----------------:|:-------------:|:--------:|
| `/status` | GET | None | IP-0 | Public | No | P3 |
| `/templates` | GET | `_require_ocr_access` | IP-0 | `ocr.template.view` | No | P2 |
| `/templates` | POST | `_require_ocr_access` | IP-2 | `ocr.template.manage` | No (config) | P2 |
| `/verifications` | GET | Implicit scope | IP-0 | `ocr.job.view` | No | P3 |
| `/verifications` | POST | `_require_ocr_access` | IP-1 | `ocr.document.upload` | No | P2 |
| `/verifications/{id}` | PUT | Implicit | IP-1 | `ocr.verification.edit` | No | P2 |
| `/verifications/{id}/submit` | POST | Implicit | IP-1 | `ocr.verification.submit` | No | P2 |
| `/verifications/{id}/approve` | POST | Implicit | IP-2 | `ocr.verification.approve_ops` / `ocr.verification.approve_finance` | ✅ | P1 |
| `/verifications/{id}/reject` | POST | Implicit | IP-2 | `ocr.verification.reject_ops` / `ocr.verification.reject_finance` | ✅ | P1 |

**Key architectural decision:** OCR verification approval must be domain-split:
- Operations docs → approved by operations role (Supervisor+)
- Finance docs → approved by finance role (Accountant+)
- The approval rule engine resolves which domain is needed based on `doc_type_hint` / `routing_meta`

**Integration code (approve verification):**

```python
@router.post("/verifications/{verification_id}/approve")
def approve_verification(
    verification_id: int,
    payload: OcrVerificationDecisionPayload,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
    request: Request,
) -> dict:
    verification = _get_verification_or_404(db, verification_id, current_user)
    
    # Domain-split: resolve which permission is needed
    doc_type = (verification.doc_type_hint or "").strip().lower()
    is_finance_doc = doc_type in {"invoice", "ledger", "payment", "receipt", "bill"}
    permission_key = (
        "ocr.verification.approve_finance" if is_finance_doc
        else "ocr.verification.approve_ops"
    )
    
    pdp = PDP(db=db)
    pdp.require_permission(
        actor=current_user,
        permission_key=permission_key,
        request_context=build_request_context(request),
    )
    
    # Approval service initiation
    decision = approval_service.initiate_approval(
        workflow_key="ocr.verification.approve",
        action_key=permission_key,
        resource_type="OcrVerification",
        resource_id=str(verification_id),
        org_id=verification.org_id,
        factory_id=verification.factory_id,
        subject_user_id=verification.user_id,
        current_workflow_state=verification.status,
        attributes={
            "doc_type_hint": verification.doc_type_hint,
            "avg_confidence": verification.avg_confidence,
            "is_finance_doc": is_finance_doc,
        },
        request_context=build_request_context(request),
    )
    
    if decision.result in ("denied",):
        raise HTTPException(status_code=403, detail=decision.reason)
    
    verification.status = "approved"
    verification.approved_by = current_user.id
    verification.approved_at = datetime.now(timezone.utc)
    
    # Audit
    _log_ocr_event(db, action="OCR_VERIFICATION_APPROVED", ...
    db.commit()
    
    if decision.instance_id:
        approval_service.complete_approval(instance_id=decision.instance_id)
    
    return _serialize_verification(db, verification)
```

### 3.5 Steel ERP (steel.py)

**Key endpoints:** ~30+ endpoints — the largest module.

#### 3.5.1 Inventory

| Endpoint | Method | Current Auth | Target Pattern | Target Permission | Approval Call | Priority |
|----------|--------|-------------|:--------------:|:-----------------:|:-------------:|:--------:|
| `/overview` | GET | None | IP-0 | `inventory.ledger.view` | No | **P0** |
| `/inventory/items` | GET | Role set (SUP+) | IP-0 | `inventory.item.view` | No | P2 |
| `/inventory/stock` | GET | Role set (SUP+) | IP-0 | `inventory.ledger.view` | No | P2 |
| `/inventory/transactions` | GET | Role set (SUP+) | IP-0 | `inventory.ledger.view` | No | P2 |
| `/inventory/items` | POST | `require_role(MANAGER)` | IP-2 | `inventory.item.manage` | No (config) | P1 |
| `/inventory/transactions` | POST | `require_role(MANAGER)` | IP-2 | `inventory.transaction.create` | Conditional | P1 |
| `/inventory/reconciliations` | POST | `require_role(MANAGER)` | IP-2 | `inventory.reconciliation.submit` | ✅ | P1 |
| `/inventory/reconciliations/summary` | GET | Role set | IP-0 | `inventory.report.view` | No | P3 |
| `/inventory/reconciliations` | GET | Role set | IP-0 | `inventory.report.view` | No | P3 |
| `/inventory/reconciliations/{id}/approve` | POST | `require_any_role(ADMIN, OWNER)` | IP-3 | `inventory.reconciliation.approve` | ✅ | **P0** |
| `/inventory/reconciliations/{id}/reject` | POST | `require_any_role(ADMIN, OWNER)` | IP-3 | `inventory.reconciliation.reject` | ✅ | **P0** |

**Critical issue (P0):** The `/overview` endpoint has NO authorization check. Any authenticated user can view the entire steel overview including financial data (redacted only for non-OWNER). Must add `require_permission("inventory.ledger.view")`.

**Critical issue (P0):** Reconciliations auto-approve for Admin/Owner — bypasses maker-checker entirely.

**Critical issue (P0):** Invoice detail endpoint `GET /invoices/{id}` has NO authorization check (listed as `None` in Section 3.5.3). Any authenticated user can retrieve any invoice by ID. Must add `require_permission("invoice.record.view")`.

#### 3.5.2 Customers

| Endpoint | Method | Current Auth | Target Pattern | Target Permission | Approval Call | Priority |
|----------|--------|-------------|:--------------:|:-----------------:|:-------------:|:--------:|
| `/customers` | GET | Role set (MGR+) | IP-0 | `customer.record.view` | No | P2 |
| `/customers` | POST | Ad-hoc | IP-2 | `customer.record.manage` | No | P2 |
| `/{id}/ledger` | GET | Implicit | IP-0 | `customer.record.view` | No | P3 |
| `/{id}/follow-up-tasks` | CRUD | Implicit | IP-1 | `customer.followup.manage` | No | P2 |
| `/{id}/verification` | POST/GET | Implicit | IP-2 | `customer.verification.request` / `customer.verification.review` | ✅ | P1 |
| `/{id}/verification-documents` | Upload | Implicit | IP-1 | `customer.verification.request` | No | P2 |
| `/{id}/payments` | POST | `require_role(MANAGER)` | IP-2 | `payment.record.create` | Conditional | P1 |

**Integration code (customer verification review):**

```python
@router.post("/customers/{customer_id}/verification/review")
def review_steel_customer_verification(
    customer_id: int,
    payload: SteelCustomerVerificationReviewRequest,
    request: Request,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
) -> dict:
    factory = require_active_steel_factory(db, current_user)
    
    pdp = PDP(db=db)
    pdp.require_permission(
        actor=current_user,
        permission_key="customer.verification.review",
        resource=ResourceContext(factory_id=factory.factory_id),
        request_context=build_request_context(request),
    )
    
    customer = _get_customer_or_404(db, factory_id=factory.factory_id, customer_id=customer_id)
    
    decision = approval_service.initiate_approval(
        workflow_key="customer.verification.review",
        action_key="customer.verification.review",
        resource_type="SteelCustomer",
        resource_id=str(customer_id),
        org_id=factory.org_id,
        factory_id=factory.factory_id,
        subject_user_id=customer.created_by_user_id,
        current_workflow_state=customer.verification_status,
        request_context=build_request_context(request),
    )
    
    if decision.result in ("denied",):
        raise HTTPException(status_code=403, detail=decision.reason)
    
    # Business logic...
    _apply_customer_verification_state(
        customer,
        final_status="verified" if payload.decision == "approve" else "rejected",
        verification_source=payload.verification_source,
        reviewer_user_id=current_user.id,
    )
    db.commit()
    
    if decision.instance_id:
        approval_service.complete_approval(instance_id=decision.instance_id)
    
    return {"customer_id": customer.id, "verification_status": customer.verification_status}
```

#### 3.5.3 Invoices

| Endpoint | Method | Current Auth | Target Pattern | Target Permission | Approval Call | Priority |
|----------|--------|-------------|:--------------:|:-----------------:|:-------------:|:--------:|
| `/invoices` | GET | Role set (ACC+) | IP-0 | `invoice.record.view` | No | P2 |
| `/invoices` | POST | `require_role(MANAGER)` | IP-2 | `invoice.record.create` | Conditional | P1 |
| `/{id}` | GET | None | IP-0 | `invoice.record.view` | No | **P0** |
| `/{id}` | PATCH | Implicit | IP-2 (pre-dispatch) / IP-4 (post-dispatch) | `invoice.record.edit_pre_dispatch` / `invoice.record.edit_post_dispatch` | ✅ | P1 |

> **P0 Critical:** `GET /invoices/{id}` has no authorization check. Any authenticated user can retrieve any invoice by ID. Add `require_permission("invoice.record.view")`.

**Integration code (invoice edit post-dispatch — IP-4):**

```python
@router.patch("/invoices/{invoice_id}")
def update_steel_invoice(
    invoice_id: int,
    ...
):
    invoice = _get_invoice_or_404(db, factory_id=factory.factory_id, invoice_id=invoice_id)
    
    # Determine if pre or post dispatch
    has_dispatch = db.query(SteelDispatch).filter(
        SteelDispatch.invoice_id == invoice_id,
        SteelDispatch.status.in_(["dispatched", "delivered"]),
    ).first() is not None
    
    if has_dispatch:
        # Post-dispatch edit — IP-4 (cross-domain approval)
        permission_key = "invoice.record.edit_post_dispatch"
    else:
        # Pre-dispatch edit — IP-2
        permission_key = "invoice.record.edit_pre_dispatch"
    
    pdp = PDP(db=db)
    pdp.require_permission(actor=current_user, permission_key=permission_key, ...)
    
    decision = approval_service.initiate_approval(
        workflow_key="invoice.edit",
        action_key=permission_key,
        ...
        attributes={
            "has_dispatch": has_dispatch,
            "invoice_amount": float(invoice.total_amount or 0),
        },
    )
    
    if decision.result in ("denied",):
        raise HTTPException(status_code=403, detail=decision.reason)
    
    # Apply edits...
    db.commit()
    
    if decision.instance_id:
        approval_service.complete_approval(instance_id=decision.instance_id)
```

#### 3.5.4 Dispatch

| Endpoint | Method | Current Auth | Target Pattern | Target Permission | Approval Call | Priority |
|----------|--------|-------------|:--------------:|:-----------------:|:-------------:|:--------:|
| `/dispatches` | GET | Role set (OPR+) | IP-0 | `dispatch.record.view` | No | P2 |
| `/dispatches` | POST | `require_role(MANAGER)` | IP-2 | `dispatch.record.create` | No | P1 |
| `/{id}` | GET/PATCH | Implicit | IP-0 / IP-2 | `dispatch.record.view` / `dispatch.status.update` | Conditional | P2 |
| `/{id}/status` | PATCH | Implicit | IP-2 | `dispatch.status.approve` | ✅ | P1 |

#### 3.5.5 Payments

| Endpoint | Method | Current Auth | Target Pattern | Target Permission | Approval Call | Priority |
|----------|--------|-------------|:--------------:|:-----------------:|:-------------:|:--------:|
| `{id}/payments` | POST | `require_role(MANAGER)` | IP-2 (conditional) | `payment.record.create` | Conditional | P1 |
| `{id}/payments/{payment_id}/reallocate` | — | Missing | IP-3 | `payment.record.reallocate` | ✅ | P1 |
| `{id}/payments/{payment_id}/reverse` | — | Missing | IP-4 | `payment.record.reverse` | ✅ | P1 |

**Key architectural point:** Payment creation becomes conditional maker-checker (IP-2) — if the payment is backdated, high-value, or suspicious, the approval engine routes it for review. Standard payments within normal parameters bypass approval.

#### 3.5.6 Production Batches

| Endpoint | Method | Current Auth | Target Pattern | Target Permission | Approval Call | Priority |
|----------|--------|-------------|:--------------:|:-----------------:|:-------------:|:--------:|
| `/batches` | GET | None (implicit factory scope) | IP-0 | `inventory.item.view` | No | **P0** |
| `/batches/{id}` | GET | None | IP-0 | `inventory.item.view` | No | **P0** |
| `/batches` | POST | None | IP-2 | `production.batch.create` | Conditional (variance) | **P0** |
| `/batches/{id}/variance-approve` | POST | Missing — must be created | IP-2 (conditional: only routes to approval if variance exceeds HIGH_VARIANCE_THRESHOLD; standard variance bypasses approval) | `production.batch.variance.approve` | ✅ | P1 |

**Critical issue (P0):** Batch creation has NO authorization check and NO maker-checker for variance approval.

**Pattern decision rationale (IP-2, not IP-3):** Variance approval is already covered by the same conditional threshold logic used for inventory transactions in Template C. IP-3 would require a second `/approvals/{instance_id}/advance` call and a separate L2 reviewer role. For batch variance this overhead is unnecessary — a single Factory Manager sign-off is sufficient.

**Integration code (variance-approve — IP-2 conditional):**

```python
@router.post("/batches/{batch_id}/variance-approve")
def approve_batch_variance(
    batch_id: int,
    payload: BatchVarianceApprovalRequest,
    request: Request,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
) -> dict:
    factory_id = resolve_factory_id(db, current_user)
    org_id = resolve_org_id(current_user)
    request_context = build_request_context(request)

    # Step 1: Load the batch and confirm existence
    batch = _get_batch_or_404(db, batch_id=batch_id, factory_id=factory_id)

    # Step 2: PDP permission check
    pdp = PDP(db=db, mode=PDP_MODE)
    pdp.require_permission(
        actor=current_user,
        permission_key="production.batch.variance.approve",
        resource=ResourceContext(factory_id=factory_id),
        request_context=request_context,
    )

    # Step 3: Conditional IP-2 — high variance routes to approval, standard bypasses
    is_high_variance = batch.variance_percent > HIGH_VARIANCE_THRESHOLD

    decision = approval_service.initiate_approval(
        actor=current_user,
        workflow_key="production.batch.variance.approve",
        action_key="production.batch.variance.approve",
        resource_type="ProductionBatch",
        resource_id=str(batch_id),
        org_id=org_id,
        factory_id=factory_id,
        subject_user_id=batch.created_by_user_id,
        current_workflow_state=batch.status,
        attributes={
            "variance_percent": float(batch.variance_percent),
            "variance_kg": float(batch.variance_kg),
            "is_high_variance": is_high_variance,
        },
        request_context=request_context,
    )

    if decision.result == "denied":
        raise HTTPException(status_code=403, detail=decision.reason)

    if decision.result == "approval_required":
        return JSONResponse(
            status_code=202,
            content={
                "status": "pending_approval",
                "approval_instance_id": decision.instance_id,
                "message": f"Variance of {batch.variance_percent}% exceeds threshold. "
                           f"Submitted for senior review.",
            }
        )
    elif decision.result not in ("approved", "no_approval_required"):
        raise HTTPException(status_code=500, detail=f"Unexpected approval result: {decision.result}")

    # Step 4: Apply variance approval
    batch.variance_approved = True
    batch.variance_approved_by = current_user.id
    batch.variance_approved_at = datetime.now(timezone.utc)
    batch.variance_notes = payload.notes
    db.commit()

    # Step 5: Notify approval system of completion
    if decision.instance_id:
        approval_service.complete_approval(instance_id=decision.instance_id)

    return {
        "batch_id": batch.id,
        "variance_approved": True,
        "variance_percent": float(batch.variance_percent),
        "approved_by": current_user.id,
    }
```

### 3.6 Analytics (analytics.py)

**Key endpoints:** 4 endpoints

| Endpoint | Current Auth | Target Pattern | Target Permission |
|----------|-------------|:--------------:|:-----------------:|
| `/weekly` | `require_any_role(SUP+)` | IP-0 | `analytics.operations.view` |
| `/monthly` | `require_any_role(SUP+)` | IP-0 | `analytics.operations.view` |
| `/trends` | `require_any_role(SUP+)` | IP-0 | `analytics.operations.view` |
| `/manager` | `require_role(MANAGER)` | IP-0 | `analytics.operations.view` |

**Approval system:** Not applicable — read-only data access.

**Code changes needed:**
```python
# Replace:
require_any_role(current_user, {UserRole.SUPERVISOR, UserRole.MANAGER, UserRole.ADMIN, UserRole.OWNER})
# With:
RequirePermission("analytics.operations.view")
```

### 3.7 AI Insights (ai.py)

**Key endpoints:** 8 endpoints

| Endpoint | Current Auth | Target Pattern | Target Permission | Priority |
|----------|-------------|:--------------:|:-----------------:|:--------:|
| `/usage` | `_ensure_ai_access` only | IP-0 | `analytics.ai.query` | **P0** |
| `/suggestions` | `_ensure_ai_access` + blocks ACC | IP-0 | `analytics.ai.query` | **P0** |
| `/anomalies` | `_ensure_ai_access` only | IP-0 | `analytics.anomaly.view` | **P0** |
| `/anomalies/preview` | `_ensure_ai_access` only | IP-0 | `analytics.anomaly.view` | **P0** |
| `/query` | `_ensure_ai_access` only | IP-0 | `analytics.ai.query` | **P0** |
| `/executive-summary` | `_ensure_ai_access` only | IP-0 | `analytics.executive.view` | **P0** |
| `/executive-summary/jobs` | `_ensure_ai_access` only | IP-0 | `analytics.executive.view` | **P0** |
| `/jobs/{job_id}` | `_ensure_ai_access` only | IP-0 | `analytics.ai.query` | **P0** |

**Critical issue (P0):** ALL `require_any_role()` calls were REMOVED from this router in recent git changes. Currently only `_ensure_ai_access()` prevents ATTENDANCE users from accessing AI features. Every other authenticated user has full access to all AI capabilities.

**Code changes needed (immediate — P0):**
```python
# Add to each endpoint handler:
pdp = PDP(db=db)
pdp.require_permission(
    actor=current_user,
    permission_key="analytics.ai.query",  # or analytics.anomaly.view, analytics.executive.view
    request_context=build_request_context(request),
)
```

**Approval system:** Not applicable — read-only AI queries. No maker-checker needed.

### 3.8 Intelligence (intelligence.py)

**Key endpoints:** 4 endpoints

| Endpoint | Current Auth | Target Pattern | Target Permission | Priority |
|----------|-------------|:--------------:|:-----------------:|:--------:|
| POST `/requests` | None (roles removed) | IP-1 | `analytics.ai.query` | **P0** |
| GET `/requests` | None (roles removed) | IP-0 | `analytics.ai.query` | **P0** |
| GET `/requests/{id}` | None (roles removed) | IP-0 | `analytics.ai.query` | **P0** |
| GET `/usage` | None (roles removed) | IP-0 | `analytics.ai.query` | **P0** |

**Same critical gap as AI router.** All `require_any_role()` calls were removed.

**Code changes needed (P0):**
```python
# Add permission check to each endpoint
pdp.require_permission(actor=current_user, permission_key="analytics.ai.query", ...)
```

### 3.9 Reports & Exports (reports.py)

**Key endpoints:** 12 endpoints

| Endpoint | Current Auth | Target Pattern | Target Permission |
|----------|-------------|:--------------:|:-----------------:|
| `/insights` | `require_any_role(SUP+)` | IP-0 | `analytics.operations.view` |
| `/pdf/{entry_id}` | `require_any_role(OPR+)` | IP-0 | `reporting.finance.export` |
| `/excel/{entry_id}` | `require_any_role(OPR+)` | IP-0 | `reporting.finance.export` |
| `/weekly` | `require_any_role(OPR+)` | IP-0 | `analytics.operations.view` |
| `/monthly` | `require_any_role(OPR+)` | IP-0 | `analytics.operations.view` |
| `/excel-range` | `require_any_role(OPR+)` | IP-0 | `reporting.finance.export` |
| `/sample-pdf` | None | IP-0 | Public |
| `/export-jobs/*` | Owner-id scoped | IP-0 | `reporting.finance.export` |

**Approval system:** Not applicable — read/export only. No maker-checker needed.

### 3.10 Premium (premium.py)

**Key endpoints:** 3 endpoints

| Endpoint | Current Auth | Target Pattern | Target Permission | Priority |
|----------|-------------|:--------------:|:-----------------:|:--------:|
| `/dashboard` | `@premium_required` + `require_any_role(SUP+)` | IP-0 | `analytics.premium.view` | P2 |
| `/audit-trail` | `@premium_required` + `require_any_role(SUP+)` | IP-0 | `audit.log.view` | P2 |
| `/executive-pdf` | `@premium_required` + `require_any_role(SUP+)` | IP-0 | `reporting.executive.export` | P2 |

### 3.11 Email Summaries (emails.py)

**Key endpoints:** 3 endpoints

| Endpoint | Current Auth | Target Pattern | Target Permission |
|----------|-------------|:--------------:|:-----------------:|
| `/summary` | `require_any_role(ACC+)` | IP-0 | `reporting.email.summary.view` |
| `/summary/generate` | `require_any_role(ACC+)` | IP-0 | `reporting.email.summary.generate` |
| `/summary/send` | Disabled (410) | IP-0 | N/A |

### 3.12 Billing (billing.py)

**Key endpoints:** 8 endpoints

| Endpoint | Method | Current Auth | Target Pattern | Target Permission | Approval Call | Priority |
|----------|--------|-------------|:--------------:|:-----------------:|:-------------:|:--------:|
| `/config` | GET | `require_role(ADMIN)` | IP-0 | `billing.status.view` | No | P2 |
| `/status` | GET | `require_role(ADMIN)` | IP-0 | `billing.status.view` | No | P2 |
| `/invoices` | GET | `require_role(ADMIN)` | IP-0 | `billing.status.view` | No | P2 |
| `/downgrade` | POST/DELETE | `require_role(OWNER)` | IP-5 | `billing.plan.change` | ✅ | P1 |
| `/orders` | POST | `require_role(OWNER)` | IP-1 | `billing.order.create` | No (external — Razorpay approval callback) | P2 |
| `/orders/{id}/sync` | POST | `require_role(OWNER)` | IP-1 | `billing.order.create` | No (external — Razorpay sync) | P2 |

> **Note:** `/orders` and `/orders/{id}/sync` use IP-1 (maker-only direct write) rather than IP-2. Approval is implicit via Razorpay payment confirmation. The webhook handler (Section 11.2) acts as the completion signal. The pattern label IP-2 in original draft was incorrect — no internal approval service call is made.

**Integration code (downgrade — IP-5):**

```python
@router.post("/downgrade")
def schedule_plan_downgrade(
    payload: DowngradeRequest,
    request: Request,  # REQUIRED for build_request_context()
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
) -> dict:
    request_context = build_request_context(request)
    org_id = resolve_org_id(current_user)
    
    pdp = PDP(db=db)
    pdp.require_permission(
        actor=current_user,
        permission_key="billing.plan.change",
        resource=ResourceContext(org_id=org_id),
        request_context=request_context,
    )
    
    # Critical action — IP-5 (dual approval + MFA)
    decision = approval_service.initiate_approval(
        workflow_key="billing.plan.downgrade",
        action_key="billing.plan.change",
        resource_type="Subscription",
        resource_id=...,
        org_id=org_id,
        subject_user_id=current_user.id,
        current_workflow_state=...,
        attributes={
            "from_plan": current_plan,
            "to_plan": normalized,
            "is_downgrade": True,
        },
        request_context=request_context,
    )
    
    if decision.result in ("denied",):
        raise HTTPException(status_code=403, detail=decision.reason)
    
    if decision.result == "approval_required":
        return JSONResponse(
            status_code=202,
            content={
                "status": "pending_approval",
                "approval_instance_id": decision.instance_id,
                "message": "Downgrade requires MFA-verified dual approval. Queue submitted."
            }
        )
    elif decision.result not in ("approved", "no_approval_required"):
        raise HTTPException(status_code=500, detail=f"Unexpected approval result: {decision.result}")
    
    # Apply downgrade
    sub = schedule_downgrade(db, user_id=current_user.id, plan=normalized)
    db.commit()
    
    if decision.instance_id:
        approval_service.complete_approval(instance_id=decision.instance_id)
    
    return {"pending_plan": sub.pending_plan, "pending_plan_effective_at": sub.pending_plan_effective_at}
```

### 3.13 Settings & User Management (settings.py)

**Key endpoints:** ~20 endpoints

| Endpoint | Method | Current Auth | Target Pattern | Target Permission | Approval Call | Priority |
|----------|--------|-------------|:--------------:|:-----------------:|:-------------:|:--------:|
| `/factory-profiles` | GET | None | IP-0 | Public | No | P3 |
| `/factory` | GET/PUT | `require_role(MANAGER)` | IP-0/IP-2 | `factory.profile.manage` | No (config) | P2 |
| `/factory/templates` | GET | `require_role(MANAGER)` | IP-0 | `factory.profile.manage` | No | P3 |
| `/factories` | GET | `require_role(MANAGER)` | IP-0 | `factory.profile.manage` | No | P2 |
| `/factories` | POST | `require_role(MANAGER)` | IP-3 | `factory.create` | ✅ | P1 |
| `/control-tower` | GET | `require_role(MANAGER)` | IP-0 | `analytics.operations.view` | No | P3 |
| `/users` | GET | `require_role(MANAGER)` | IP-0 | `user.directory.view` | No | P2 |
| `/users/invite` | POST | `require_role(MANAGER)` | IP-3 | `user.invite` | ✅ | P1 |
| `/users/{id}/factory-access` | GET/PUT | `require_role(ADMIN)` | IP-3 | `user.membership.assign` | ✅ | P1 |
| `/users/{id}/role` | PUT | `require_role(MANAGER)` + rank | IP-4 | `user.role.assign` | ✅ | P1 |
| `/users/{id}/plan` | PUT | `require_role(MANAGER)` | IP-3 | `billing.plan.change` | ✅ | P1 |
| `/org/plan` | PUT | `require_role(OWNER)` | IP-5 | `billing.plan.change` | ✅ | P1 |
| `/users/{id}` | DELETE | `require_role(MANAGER)` | IP-3 | `user.deactivate` | ✅ | P1 |
| `/users/lookup` | GET | `_scoped_users_query` | IP-0 | `user.directory.view` | No | P3 |

**Key architectural points for Settings:**
- Factory creation (POST `/factories`) moves from Manager to Org Admin/Owner permission
- User invite, role change, and factory access change ALL require maker-checker via IP-3/IP-4
- Role change is IP-4 (cross-domain: Org Admin + Security Admin)
- Self-role-change prevention must be enforced by approval engine
- **Explicit guard (defense in depth):** Add `if int(user_id) == current_user.id: raise HTTPException(status_code=403, detail="You cannot change your own role.")` before the approval service call

**Integration code (role assignment — IP-4):**

```python
@router.put("/users/{user_id}/role")
def update_user_role(
    user_id: int,
    payload: RoleUpdateRequest,
    request: Request,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
) -> dict:
    pdp = PDP(db=db)
    pdp.require_permission(
        actor=current_user,
        permission_key="user.role.assign",
        scope="ORG",
        request_context=build_request_context(request),
    )
    
    # Cross-domain approval (IP-4): requires Org Admin + Security Admin
    decision = approval_service.initiate_approval(
        workflow_key="user.role.assign",
        action_key="user.role.assign",
        resource_type="User",
        resource_id=str(user_id),
        org_id=resolve_org_id(current_user),
        subject_user_id=user_id,
        current_workflow_state=str(user.role.value),   # FIXED: target user's current role, not the actor's
        attributes={
            "from_role": user.role.value,
            "to_role": payload.role.value,
            "is_downgrade": role_rank(payload.role) < role_rank(user.role),
        },
        request_context=build_request_context(request),
    )
    
    if decision.result in ("denied",):
        raise HTTPException(status_code=403, detail=decision.reason)
    
    if decision.result == "approval_required":
        return JSONResponse(
            status_code=202,
            content={
                "status": "pending_approval",
                "approval_instance_id": decision.instance_id,
                "required_approvers": ["Org Admin", "Security Admin"],
            }
        )
    elif decision.result not in ("approved", "no_approval_required"):
        raise HTTPException(status_code=500, detail=f"Unexpected approval result: {decision.result}")
    
    # Apply role change
    old_role = user.role
    user.role = payload.role
    user.role_revision += 1
    # ... update memberships, audit ...
    db.commit()
    
    if decision.instance_id:
        approval_service.complete_approval(instance_id=decision.instance_id)
    
    return {"message": "Role updated.", "old_role": old_role.value, "new_role": payload.role.value}
```

### 3.14 Alerts (alerts.py)

**Key endpoints:** 2 endpoints

| Endpoint | Current Auth | Target Pattern | Target Permission |
|----------|-------------|:--------------:|:-----------------:|
| `/` GET | `require_any_role(OPR+)` | IP-0 | `ops_alerts.view` |
| `/{id}/read` | `require_any_role(OPR+)` | IP-1 | `ops_alerts.view` |

**Note:** Permission key `ops_alerts.view` is not yet in the target catalog — must be added. **Treat as P0 data task** (must exist before P2 router implementation). Scope level: FACTORY. Default role grants: OPR+ for view, ADMIN/OWNER for manage. MFA requirement: No.

**Note:** Permission key `ops_alerts.manage` is not yet in the target catalog — must be added. **Treat as P0 data task** (must exist before P2 router implementation). Scope level: FACTORY. Default role grants: ADMIN, OWNER.

### 3.15 Alert Recipients (alert_recipients.py)

**Key endpoints:** 6 endpoints

| Endpoint | Method | Current Auth | Target Pattern | Target Permission |
|----------|--------|-------------|:--------------:|:-----------------:|
| `/alert-recipients` | GET | `require_any_role(ADMIN, OWNER)` | IP-0 | `ops_alerts.manage` |
| `/alert-recipients` | POST | `require_any_role(ADMIN, OWNER)` | IP-2 | `ops_alerts.manage` |
| `/{id}` | PATCH | `require_any_role(ADMIN, OWNER)` | IP-2 | `ops_alerts.manage` |
| `/{id}/start-verification` | POST | `require_any_role(ADMIN, OWNER)` | IP-2 | `ops_alerts.manage` |
| `/{id}/confirm-verification` | POST | `require_any_role(ADMIN, OWNER)` | IP-2 | `ops_alerts.manage` |
| `/{id}` | DELETE | `require_any_role(ADMIN, OWNER)` | IP-2 | `ops_alerts.manage` |

**Note:** Permission key `ops_alerts.manage` is not yet in the target catalog — must be added. **Treat as P0 data task** (must exist before P2 router implementation). Scope level: FACTORY. Default role grants: ADMIN, OWNER.

### 3.16 Feedback (feedback.py)

**Security classification:** HIGH RISK — feedback channel is a potential data exfiltration vector. Every user in every org has access. Full security controls defined in the Feedback Channel Security Plan (Section 12).

**Key endpoints:** 6 endpoints

| Endpoint | Method | Current Auth | Target Pattern | Target Permission | Approval Call | Priority |
|----------|--------|-------------|:--------------:|:-----------------:|:-------------:|:--------:|
| `/` | POST | `get_current_user` + rate limit | IP-1 | `feedback.submit` | No | **P1** (reclassified from P2 — security controls must ship before feature is enabled) |
| `/` | GET | Platform admin check | IP-0 | `feedback.manage` | No | P2 |
| `/mine/updates` | GET | `get_current_user` | IP-1 | `feedback.submit` | No | **P1** (reclassified — scope isolation fix is critical) |
| `/export.csv` | GET | Platform admin check | IP-0 | `feedback.manage` | No | P2 |
| `/{id}` | GET | Platform admin check | IP-0 | `feedback.manage` | No | P2 |
| `/{id}` | PATCH | Platform admin check | IP-2 | `feedback.manage` | No | P2 |

**Permission scope definitions:**

- `feedback.submit` — **org-scoped** (FACTORY level). Granted to all authenticated org users by default. Any user with an active org membership can submit and view their own feedback updates. MFA requirement: No.
- `feedback.manage` — **platform-scoped** (not part of the org role hierarchy). Granted only to DPR.ai internal staff via the platform admin role. Org ADMIN and OWNER cannot hold this permission. Set `scope_level = "PLATFORM"` and `is_platform_permission = True` in the permission catalog. This is why the current auth is "Platform admin check" rather than an org role check. MFA requirement: No.

> **Implementation note:** Do not add `feedback.manage` to the org permission catalog that org Admins can assign. It must live in a separate platform permission catalog. If these catalogs are not yet separated in your PDP, create an `is_platform_permission` flag on the permission model and filter org-visible permissions by `is_platform_permission = False`.

### 3.17 Jobs (jobs.py)

**Key endpoints:** 4 endpoints

| Endpoint | Current Auth | Target Pattern | Target Permission | Priority |
|----------|-------------|:--------------:|:-----------------:|:--------:|
| `/` GET | Owner-id scoped | IP-1 | `background_jobs.view` | P3 |
| `/{job_id}` | Owner-id scoped | IP-1 | `background_jobs.view` | P3 |
| `/{job_id}/cancel` | Owner-id scoped | IP-1 | `background_jobs.view` | P3 |
| `/{job_id}/retry` | Owner-id scoped | IP-1 | `background_jobs.view` | P3 |

### 3.18 Observability (observability.py)

**Key endpoints:** 7 endpoints

| Endpoint | Current Auth | Target Pattern | Target Permission |
|----------|-------------|:--------------:|:-----------------:|
| `/ready` | None | IP-0 | Public (health check) |
| `/ai/health` | None | IP-0 | Public |
| `/ai/dashboard` | None | IP-0 | `system.observability.view` | **P1** (reclassified — governance data can expose internal system structure, model choices, and policy configurations) |
| `/ai/governance` | None | IP-0 | `system.observability.view` | **P1** (reclassified — governance data can expose internal system structure, model choices, and policy configurations) |
| `/alerts` | `require_any_role(ADMIN, OWNER)` | IP-0 | `audit.log.view` |
| `/alerts/{ref_id}` | `require_any_role(ADMIN, OWNER)` | IP-0 | `audit.log.view` |
| `/frontend-error` | None | IP-0 | Public |

### 3.19 Admin Modules (admin_billing.py, admin_ai.py)

**Key endpoints:**

| Endpoint | Router | Current Auth | Target Pattern | Target Permission | Priority |
|----------|--------|-------------|:--------------:|:-----------------:|:--------:|
| `/events` | admin_billing | None | IP-0 | `audit.log.view` | P2 |
| `/subscriptions` | admin_billing | None | IP-0 | `audit.log.view` | P2 |
| `/quota` | admin_billing | None | IP-0 | `audit.log.view` | P2 |
| `/reset-quota/{org_id}` | admin_billing | None | IP-3 | `admin.billing.quota.reset` | P1 |
| `/usage` | admin_ai | None | IP-0 | `audit.log.view` | P2 |
| `/cost-summary` | admin_ai | None | IP-0 | `audit.log.view` | P2 |

> **⚠️ Fix:** `POST /reset-quota/{org_id}` is a **mutation** (resets an org's quota) mapped to a **read permission** `audit.log.view`. This is incorrect. Must use dedicated permission `admin.billing.quota.reset` with IP-3 approval pattern.

### 3.20 Webhook (whatsapp_webhook.py)

**Key endpoints:** 2 endpoints

| Endpoint | Method | Current Auth | Target Pattern | Target Permission |
|----------|--------|-------------|:--------------:|:-----------------:|
| `/whatsapp` | GET | Webhook verification | IP-0 | Public (webhook verify) |
| `/whatsapp` | POST | Webhook signature | IP-0 | Public (webhook) |

**No change needed.** These are external-facing webhooks that use their own verification mechanism.

---

## 4. Code Change Templates

### Template A: Replace `require_role()` with `require_permission()`

```python
# BEFORE
from backend.rbac import require_role
require_role(current_user, UserRole.MANAGER)

# AFTER
from backend.services.authorization.pdp import PDP
from backend.services.authorization.context import build_request_context, build_resource_context

pdp = PDP(db=db)
pdp.require_permission(
    actor=current_user,
    permission_key="inventory.item.manage",
    resource=ResourceContext(factory_id=resolve_factory_id(db, current_user)),
    request_context=build_request_context(request),
)
```

### Template B: Replace `require_any_role()` with `require_permission()`

```python
# BEFORE
from backend.rbac import require_any_role
require_any_role(current_user, {UserRole.SUPERVISOR, UserRole.MANAGER, UserRole.ADMIN, UserRole.OWNER})

# AFTER
pdp.require_permission(
    actor=current_user,
    permission_key="analytics.operations.view",
    request_context=build_request_context(request),
)
```

### Template C: Add maker-checker for mutation endpoints

```python
# BEFORE — no approval check
def create_steel_inventory_transaction(...):
    ...
    db.add(transaction)
    db.commit()

# AFTER
def create_steel_inventory_transaction(...):
    pdp.require_permission(
        actor=current_user,
        permission_key="inventory.transaction.create",
        ...
    )
    
    # Check if this transaction needs approval (conditional maker-checker)
    is_high_value = payload.quantity_kg > HIGH_VALUE_THRESHOLD
    is_backdated = datetime.now(timezone.utc).date() != payload_date if hasattr(payload, 'transaction_date') else False
    
    decision = approval_service.initiate_approval(
        workflow_key="inventory.transaction.create",
        action_key="inventory.transaction.create",
        ...
        attributes={
            "quantity_kg": payload.quantity_kg,
            "is_high_value": is_high_value,
            "is_backdated": is_backdated,
        },
    )
    
    if decision.result in ("denied",):
        raise HTTPException(status_code=403, detail=decision.reason)
    
    if decision.result == "approval_required":
        return JSONResponse(
            status_code=202,
            content={"status": "pending_approval", "approval_instance_id": decision.instance_id}
        )
    elif decision.result == "no_approval_required":
        pass  # proceed directly
    else:
        raise HTTPException(status_code=500, detail=f"Unexpected approval result: {decision.result}")
    
    # Proceed with mutation
    db.add(transaction)
    _write_steel_audit(...)
    db.commit()
    
    if decision.instance_id:
        approval_service.complete_approval(instance_id=decision.instance_id)
    
    return {"transaction": {...}}
```

### Template D: Replace ad-hoc role blocks

```python
# BEFORE
if current_user.role == UserRole.ACCOUNTANT:
    raise HTTPException(status_code=403, detail="Accountant role cannot create entries.")
if current_user.role == UserRole.ATTENDANCE:
    raise HTTPException(status_code=403, detail="Attendance role cannot create entries.")

# AFTER
# These blocks are replaced by the PDP permission check upstream.
# The PDP denies if the user's role does not have the required permission.
# No inline role checks needed.
```

### Template E: Replace self-approval assertion

```python
# BEFORE
from backend.rbac import assert_not_self_approval
assert_not_self_approval(entry.user_id, current_user.id)

# AFTER
# The approval engine's ApproverEligibilityService handles this.
# The evaluation occurs inside initiation_approval().
# If self-approval is attempted, the engine returns DENY.
```

---

## 5. Testing Strategy

### 5.1 Per-Endpoint Test Cases

For every endpoint that gains approval integration, write these test cases:

| Test Case | What It Validates |
|-----------|-------------------|
| `test_{endpoint}_no_permission` | User without required permission gets 403 |
| `test_{endpoint}_wrong_scope` | User with permission but wrong factory/org scope gets 403 |
| `test_{endpoint}_maker_approves_own` | Maker trying to approve own record gets DENY from approval engine |
| `test_{endpoint}_maker_can_create` | Maker can create/save without approval |
| `test_{endpoint}_checker_can_approve` | Valid checker can approve and mutation succeeds |
| `test_{endpoint}_checker_can_reject` | Valid checker can reject with reason |
| `test_{endpoint}_escalation` | Checker can escalate to next authority |
| `test_{endpoint}_toxic_combo_blocked` | User with toxic role combination gets DENY |
| `test_{endpoint}_self_target_blocked` | User trying to change own role/access gets DENY |
| `test_{endpoint}_denial_logged` | DENY decision generates audit log entry |
| `test_{endpoint}_approval_logged` | APPROVE action generates audit log entry |
| `test_{endpoint}_scope_enforced` | Cross-factory access attempt gets DENY |

### 5.2 Test File Organization

```
tests/
  authorization/
    test_pdp.py           # Core PDP evaluation tests
    test_scope.py         # Scope resolution tests
    test_maker_checker.py # Maker-checker workflow tests
    test_sod.py           # Static/dynamic toxic combination tests
    test_audit.py         # Denial/approval audit logging tests
    
  integration/
    test_entries_approval.py   # Entry approve/reject with central approval
    test_attendance_approval.py # Attendance review approve/reject
    test_ocr_approval.py        # OCR verification approve/reject
    test_steel_approval.py      # All steel approval workflows
    test_billing_approval.py    # Billing plan change workflow
    test_settings_approval.py   # User invite, role change, factory create
```

---

## 6. Migration Sequence Per Router

### Phase P0 — Critical Security Gaps (Week 1)

> **⚠️ Important Gate:** P1 work on ANY router must NOT be merged until ALL P0 fixes are deployed and confirmed via audit log review. A regression test must assert that each P0 endpoint returns 403 for a `UserRole.ATTENDANCE` user without explicit permission.

| Router | Endpoints | Action | Risk if Skipped |
|--------|-----------|--------|:---------------:|
| `ai.py` | All 8 endpoints | Add `require_permission()` — currently NO authorization | Any non-Attendance user accesses all AI features |
| `intelligence.py` | All 4 endpoints | Add `require_permission()` — currently NO authorization | Any user can submit intelligence requests |
| `steel.py` | `/overview` | Add `require_permission("inventory.ledger.view")` | Any user sees steel overview including financials |
| `steel.py` | `/batches`, `/batches/{id}` | Add permission check | Any user can see batch data including variances |
| `steel.py` | `/inventory/reconciliations/{id}/approve` | Fix approval check from ADMIN/OWNER to FM/OO | Factory Managers can't approve their own reconciliations |
| `steel.py` | `GET /invoices/{id}` | Add `require_permission("invoice.record.view")` | Any authenticated user can retrieve any invoice by ID |

### Phase P1 — Maker-Checker & Steel Financial Ops (Weeks 2-3)

| Router | Endpoints | Action |
|--------|-----------|--------|
| `entries.py` | approve, reject, delete | Replace `require_role()` + add approval initiation |
| `attendance.py` | review approve, review reject | Replace role-set + add approval initiation |
| `ocr.py` | verification approve, verification reject | Add domain-split approval + permission checks |
| `steel.py` | payments create, invoices, dispatch, reconciliations | Add maker-checker for all financial operations |
| `settings.py` | user invite, role change, factory create, deactivate | Add IP-3/IP-4 approval workflows |
| `billing.py` | downgrade, plan change | Add IP-5 critical approval workflow |

### Phase P2 — Permission Migration (Weeks 4-5)

| Router | Endpoints | Action |
|--------|-----------|--------|
| All routers | GET/list endpoints | Replace `require_any_role()` with `require_permission()` |
| `attendance.py` | self-punch, self-view | Add `attendance.self.*` permissions |
| `ocr.py` | template CRUD, verification CRUD | Add `ocr.template.*`, `ocr.verification.*` permissions |
| `settings.py` | factory config, user list | Migrate from role-check to permission-check |
| `steel.py` | customer, invoice, dispatch reads | Add read permissions |

### Phase P3 — Remaining Reads & Admin (Week 6)

| Router | Endpoints | Action |
|--------|-----------|--------|
| `analytics.py` | All 4 | Replace role-set with permission |
| `reports.py` | All export | Replace role-set with permission |
| `premium.py` | All 3 | Replace role-set with permission |
| `emails.py` | All 3 | Replace role-set with permission |
| `alerts.py` | All 2 | Add missing permission |
| `feedback.py` | All 6 | Add missing permissions |
| `jobs.py` | All 4 | Add missing permissions |
| `admin_*.py` | All | Add permission checks |

### Migration Safety & Rollback Strategy

Since the migration spans multiple phases with routers in different states:

1. **Feature flags per router:** Each router gets an `APPROVAL_ENABLED_{ROUTER_NAME}` feature flag. This allows per-router rollback without a full deploy.

2. **Approval service failure mode:** If the approval service is unavailable, PDP returns DENY on all IP-2+ paths. **No fail-open behaviour.** Reads (IP-0/IP-1) continue to work.

3. **Coexistence:** `require_role()` and `require_permission()` can coexist — the old `backend/rbac.py` is not removed until Phase P4. This allows incremental migration.

4. **Rollback a single router:** Toggle its feature flag OFF → restart the service → the old `require_role()`/`require_any_role()` guards (still in code) become the active auth layer again.

### Phase P4 — Cleanup & Audit (Week 7)

| Task | Description |
|------|-------------|
| Remove `backend/rbac.py` | No longer used after full migration |
| Remove `require_role()`, `require_any_role()`, `ROLE_ORDER` | Replace with `RequirePermission` dependency |
| Remove `assert_not_self_approval()` | Replaced by approval engine |
| Remove ad-hoc role blocks | All replaced by permission model |
| Add denial audit retention policy | Configure archival and export |
| Add frontend permission manifest | `GET /auth/permissions` for UI conditional rendering |

---

## Appendix: Integration Decision Flow

```
For each router endpoint:

┌─────────────────────────────────┐
│ Is this a public endpoint?      │
│ (auth, register, login,         │
│  webhook, health, plans)        │
└──────────┬──────────────────────┘
           │ Yes
           ▼
    ┌─────────────┐
    │ No change   │
    │ Skip auth   │
    └─────────────┘
           │ No
           ▼
┌─────────────────────────────────┐
│ Is this a read-only GET?        │
└──────────┬──────────────────────┘
           │ Yes
           ▼
    ┌──────────────────────────────┐
    │ Replace require_role() with │
    │ require_permission()        │
    │ No approval needed          │
    │ No maker-checker            │
    └──────────────────────────────┘
           │ No (mutation)
           ▼
┌─────────────────────────────────┐
│ Is this self-service?           │
│ (punch, regularize, submit,     │
│  profile edit, feedback)        │
└──────────┬──────────────────────┘
           │ Yes
           ▼
    ┌──────────────────────────────┐
    │ require_permission()        │
    │ No approval (maker only)    │
    │ Audit via PEP               │
    └──────────────────────────────┘
           │ No (controlled mutation)
           ▼
┌─────────────────────────────────┐
│ Determine Approval Pattern:     │
│                                 │
│ IP-2: Single maker-checker      │
│ IP-3: Sequential two-stage      │
│ IP-4: Cross-domain/parallel     │
│ IP-5: Critical/emergency        │
└──────────┬──────────────────────┘
           ▼
    ┌──────────────────────────────┐
    │ require_permission()        │
    │ ApprovalService.             │
    │   initiate_approval()       │
    │ Handle decision result       │
    │ ApprovalService.             │
    │   complete_approval()       │
    │ Immutable audit event       │
    └──────────────────────────────┘
```

---

## 7. Workflow State Matrix Integration

### 7.1 Universal State Mapping (WSM → Router)

Every router endpoint that mutates state must map to the universal approval state machine defined in the Workflow State Matrix. This section shows how each module's states map to universal states, and what integration code validates state transitions.

#### 7.1.1 State Mapping Table

| Module | Local State | Universal State | Validated In | Validation Code |
|--------|------------|----------------|--------------|----------------|
| Entries | `submitted` | SUBMITTED | entries.py `approve_entry()` / `reject_entry()` | `entry.status == "submitted"` (implicit) |
| Entries | `approved` | APPROVED | entries.py | Set on approve |
| Entries | `rejected` | REJECTED | entries.py | Set on reject |
| Attendance | `auto` | COMPLETED (auto) | attendance.py | `punch_out_at` set |
| Attendance | `pending_review` | SUBMITTED (for review) | attendance.py | Regularization created |
| Attendance | `approved` (review) | APPROVED | attendance.py `/review/{id}/approve` | `review_status = "approved"` |
| Attendance | `rejected` (review) | REJECTED | attendance.py `/review/{id}/reject` | `review_status = "rejected"` |
| OCR | `draft` | DRAFT | ocr.py | `status == "draft"` |
| OCR | `pending` | SUBMITTED | ocr.py `/submit` | `status ~ "pending"` |
| OCR | `approved` | APPROVED | ocr.py `/approve` | `status == "approved"` |
| OCR | `rejected` | REJECTED | ocr.py `/reject` | `status == "rejected"` |
| Dispatch | `pending` | DRAFT | steel.py | `status == "pending"` |
| Dispatch | `loaded` → `exited` → `dispatched` → `delivered` | APPROVED → COMPLETED (sequential) | steel.py `/status` | `_normalize_dispatch_status()` |
| Dispatch | `cancelled` | REJECTED | steel.py `/status` (cancel) | `status == "cancelled"` |
| Reconciliation | `pending` | SUBMITTED | steel.py | `status == "pending"` |
| Reconciliation | `approved` | APPROVED | steel.py `/approve` | `status == "approved"` |
| Reconciliation | `rejected` | REJECTED | steel.py `/reject` | `status == "rejected"` |
| Batch | `recorded` | COMPLETED | steel.py (single shot) | `status == "recorded"` |
| Customer | `active` / `on_hold` / `blocked` | APPROVED / COMPLETED | steel.py | `status` field |
| Customer Verification | `draft` → `format_valid` → `pending_review` → `verified` / `mismatch` / `rejected` / `expired` | DRAFT → SUBMITTED → UNDER_REVIEW → APPROVED / REJECTED | steel.py + auto-evaluation | `_evaluate_customer_verification()` |
| Follow-Up Task | `open` → `in_progress` → `done` / `cancelled` | DRAFT → SUBMITTED → COMPLETED / CANCELLED | steel.py | Status update |
| Subscription | `trialing` → `active` → `cancelled` / `expired` / `stale` | DRAFT → APPROVED → REJECTED | billing.py + webhook | Status field + webhook events |
| Payment Order | `pending` → `created` → `attempted` → `authorized` → `paid` / `failed` / `cancelled` / `expired` | DRAFT → SUBMITTED → UNDER_REVIEW → APPROVED / REJECTED | billing.py + Razorpay webhook | Status constants + idempotency |
| Feedback | `open` → `triaged` → `resolved` | DRAFT → UNDER_REVIEW → APPROVED | feedback.py | Status enum |
| Ops Alert | `queued` → `dispatched` → `delivered` / `failed` | SUBMITTED → UNDER_REVIEW → COMPLETED / REJECTED | System (background) | Auto-transition |

#### 7.1.2 State Validation Integration Point

Every mutation endpoint must validate the current workflow state **before** calling the approval service. The integration pattern:

```python
# Integration template: state validation + approval initiation
@router.post("/{resource_id}/status")
def update_status(
    resource_id: int,
    payload: StatusUpdateRequest,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
) -> dict:
    # STEP 1: Load resource and verify it exists
    resource = _get_resource_or_404(db, resource_id=resource_id, factory_id=factory_id)
    
    # STEP 2: Validate current state allows transition
    allowed_from_states = ALLOWED_TRANSITIONS.get(payload.target_status, set())
    if resource.status not in allowed_from_states:
        raise HTTPException(
            status_code=400,
            detail=f"Cannot transition from '{resource.status}' to '{payload.target_status}'. "
                    f"Allowed from: {allowed_from_states}"
        )
    
    # STEP 3: PDP permission check
    pdp.require_permission(
        actor=current_user,
        permission_key=TRANSITION_PERMISSION_MAP[(resource.status, payload.target_status)],
        resource=ResourceContext(factory_id=factory_id, workflow_state=resource.status),
        request_context=build_request_context(request),
    )
    
    # STEP 4: Approval initiation (if maker-checker required)
    decision = approval_service.initiate_approval(
        workflow_key=WORKFLOW_KEY,
        action_key=TRANSITION_PERMISSION_MAP[(resource.status, payload.target_status)],
        resource_type=RESOURCE_TYPE,
        resource_id=str(resource_id),
        org_id=org_id,
        factory_id=factory_id,
        subject_user_id=resource.created_by_user_id,
        current_workflow_state=resource.status,
        requested_change={"new_status": payload.target_status},
        request_context=build_request_context(request),
    )
    
    if decision.result in ("denied",):
        raise HTTPException(status_code=403, detail=decision.reason)
    
    if decision.result == "approval_required":
        return JSONResponse(
            status_code=202,
            content={"status": "pending_approval", "approval_instance_id": decision.instance_id}
        )
    elif decision.result not in ("approved", "no_approval_required"):
        raise HTTPException(status_code=500, detail=f"Unexpected approval result: {decision.result}")
    
    # STEP 5: Apply state change
    resource.status = payload.target_status
    resource.updated_at = datetime.now(timezone.utc)
    db.commit()
    
    # STEP 6: Notify approval system
    if decision.instance_id:
        approval_service.complete_approval(instance_id=decision.instance_id)
    
    # STEP 7: Audit transition
    _write_audit(
        db, action=f"{WORKFLOW}_STATUS_UPDATED",
        details=f"from={resource.status} to={payload.target_status}",
        ...
    )
    
    return {"id": resource_id, "status": resource.status}
```

#### 7.1.3 State Transition Constants (Per Module)

Each module must define its allowed transitions as a constant or DB-backed config:

```python
# Example: entries.py
# Key = target_state, Value = set of valid source states (can transition FROM these TO the key)
ENTRY_ALLOWED_TRANSITIONS = {
    "approved": {"submitted"},   # Can only approve from "submitted"
    "rejected": {"submitted"},   # Can only reject from "submitted"
}

# Example: steel.py (dispatches)
# Key = target_state, Value = set of valid source states
DISPATCH_ALLOWED_TRANSITIONS = {
    "loaded": {"pending"},
    "exited": {"pending", "loaded"},
    "dispatched": {"pending", "loaded", "exited"},
    "delivered": {"pending", "loaded", "exited", "dispatched"},
    "cancelled": {"pending", "loaded", "exited", "dispatched"},  # cannot cancel delivered
}

# Example: steel.py (reconciliations)
# Key = target_state, Value = set of valid source states
RECONCILIATION_ALLOWED_TRANSITIONS = {
    "approved": {"pending"},
    "rejected": {"pending"},
}
```

---

## 8. Cross-Cutting Enforcement Register

### 8.1 Maker-Checker Gaps (G1-G8) — Router Mapping

These gaps are identified in the Workflow State Matrix Section 23. Each must be fixed during integration.

| ID | Gap | Router | Endpoint(s) | Current Code | Fix Required | Priority |
|----|-----|--------|-------------|--------------|--------------|:--------:|
| **G1** | OCR verification approve/reject lacks self-approval check | ocr.py | `POST /verifications/{id}/approve`, `/reject` | No `assert_not_self_approval` call | Add identity check in `_get_verification_or_404` or approval service | P1 |
| **G2** | Steel dispatch status update has no maker-checker | steel.py | `POST /dispatches/{id}/status` | `_normalize_dispatch_status()` validates allowed values but no maker-checker | Add maker-checker via approval service for status transitions | P1 |
| **G3** | Steel invoice payment status can be manually overridden | steel.py | `_refresh_invoice_payment_statuses()` | Auto-computed, but no guard against manual override | Add maker-checker for manual payment status changes | P1 |
| **G4** | Admin/OWNER auto-approves own reconciliation | steel.py | `POST /inventory/reconciliations` | `is_admin_or_owner(current_user)` bypass — auto-approves | Remove auto-approval; enforce proper maker-checker for all users | **P0** |
| **G5** | Customer status update (on_hold/blocked) has no maker-checker | steel.py | `PUT /customers/{id}` (status field) | Only input validation; no review required | Add approval service call for status changes | P1 |
| **G6** | Customer verification review has no explicit self-approval check | steel.py | `POST /customers/{id}/verification/review` | No check that reviewer ≠ creator | Add `assert_not_self_approval` or delegate to approval service | P1 |
| **G7** | Inventory item/transaction creation has no maker-checker | steel.py | `POST /inventory/items`, `/inventory/transactions` | Requires MANAGER role but no maker-checker | Add conditional maker-checker (AP-2) for inventory mutations | P1 |
| **G8** | Stock reconciliation counted-by ≠ approved-by not enforced | steel.py | `POST /inventory/reconciliations/{id}/approve` | Model stores both IDs but code doesn't prevent same user | Add `counted_by_user_id != approved_by_user_id` check | **P0** |

### 8.2 Missing Transition Validations (V1-V8) — Router Mapping

| ID | Missing Validation | Router | Impact | Fix | Priority |
|----|--------------------|--------|--------|-----|:--------:|
| **V1** | Cancel dispatch does not reverse inventory | steel.py | Stock discrepancy after cancel | Add `_reverse_dispatch_inventory_movements()` on cancel | **P0** |
| **V2** | No status guard on OCR verification re-submit | ocr.py | Can resubmit already-approved items | Add `status == "draft"` guard before submit | P1 |
| **V3** | No status validation on feedback status changes | feedback.py | Can reopen closed items | Add state machine validation on PATCH | P2 |
| **V4** | No status validation on customer verification re-review | steel.py | Can approve already-verified customers | Add `verification_status not in {"verified", "rejected"}` guard | P1 |
| **V5** | No transition guard on invoice payment status | steel.py | `_refresh_invoice_payment_statuses()` sets status directly | Add state machine validation before status change | P1 |
| **V6** | Production batches no edit/update controls | steel.py | No code prevents edits to recorded batches | Add `is_active` or immutable flag after creation | P2 |
| **V7a** | No MFA enforcement on financial transitions (catalog) | steel.py, billing.py | MFA flag not set on permission keys | Set `requires_mfa=True` in permission catalog for financial keys | P1 (data task) |
| **V7b** | No MFA enforcement on financial transitions (PDP) | steel.py, billing.py | PDP does not enforce MFA | Implement MFA verification in PDP | P3 (code task) |
| **V8a** | No break-glass mechanism (model+enum) | All routers | No break-glass PDP path or approval workflow | Define `REQUIRE_BREAK_GLASS` PDP enum + break-glass data model | P1 (data task) |
| **V8b** | No break-glass mechanism (full implementation) | All routers | No emergency override path | Build full break-glass approval UI + admin tooling | P3 (code task) |

### 8.3 Audit Coverage Gaps — Router Mapping

| Workflow | Audit Exists? | Gap | Router | Fix | Priority |
|----------|:------------:|-----|--------|-----|:--------:|
| Feedback management | ❌ No | **No audit logging at all** | feedback.py | Add `AuditLog` entries for all CRUD operations | P2 |
| Steel customer verification (auto) | ❌ Partial | Only on manual review decisions, not on auto-evaluation | steel.py | Add audit for auto-state changes | P1 |
| Steel customer follow-up | ❌ No | **No audit logging** | steel.py | Add `AuditLog` for follow-up task creation/status changes | P2 |
| Permission/role changes | ❌ No | **No audit logging** | settings.py | Add audit events for role assignment/unassignment | P1 |
| Dispatch cancel / status changes | ✅ Partial | No before/after state recorded | steel.py | Add `from_state` / `to_state` to audit details | P1 |
| All mutations | ✅ Partial | No `from_state` / `to_state` / `mfa_verified` fields | All routers | Enrich audit schema per Section 23 target state | P2 |

### 8.4 Cross-Cutting SoD Conflicts — Router Integration

| Conflict | Affected Routers | Enforcement Point | Integration |
|----------|-----------------|-------------------|-------------|
| `inventory.transaction.create` + `inventory.reconciliation.approve` (same factory) | steel.py | Approval service — `ApprovalConflictService` | Block same user from creating transaction AND approving reconciliation |
| `invoice.record.create` + `invoice.record.edit_post_dispatch` (same factory) | steel.py | PDP + approval service | Static block at permission assignment; dynamic check at runtime |
| `payment.record.create` + `payment.record.reverse` (same factory) | steel.py | PDP + approval service | Static block; separate users required |
| `dispatch.record.create` + `dispatch.quantity.override` (same factory) | steel.py | Approval service | Block same user from creating dispatch AND overriding its quantity |
| Org Admin changes own role/membership | settings.py | `assert_not_self_approval` + PDP self-target check | Hard deny at PEP + approval service |
| Supervisor reviewing own regularization | attendance.py | `assert_not_self_approval` + PDP | `not_self` condition on approval rule |
| OCR uploader is also final approver | ocr.py | Approval service | `not_self` condition + domain-split (operator vs finance) |

---

## 9. PEP & SoD Integration Details

### 9.1 MFA Enforcement Points

The following endpoints require MFA (P3 — implement last, but define contracts now):

| Router | Endpoint | MFA Required For | Permission Key |
|--------|----------|-----------------|----------------|
| billing.py | `POST /billing/downgrade` | Plan downgrade | `billing.plan.change` |
| billing.py | `DELETE /billing/downgrade` | Cancel downgrade | `billing.plan.change` |
| billing.py | `POST /billing/orders` | Create payment order | `billing.order.create` |
| settings.py | `PUT /users/{id}/role` | Privileged role change | `user.role.assign` |
| settings.py | `PUT /users/{id}/factory-access` | Factory access change | `user.membership.assign` |
| settings.py | `DELETE /users/{id}` | User deactivation | `user.deactivate` |
| settings.py | `POST /users/invite` | User invite | `user.invite` |
| steel.py | `POST /customers/{id}/payments/{id}/reverse` | Payment reversal | `payment.record.reverse` |
| steel.py | `POST /customers/{id}/payments/{id}/reallocate` | Payment reallocation | `payment.allocation.reallocate` |
| steel.py | `POST /invoices/{id}/void` | Invoice void | `invoice.record.void` |

**Integration Pattern:**

```python
# PDP automatically checks MFA when permission.requires_mfa == True
# No per-endpoint code change needed beyond using the PDP

@router.post("/billing/downgrade")
def schedule_downgrade(
    payload: DowngradeRequest,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
    request: Request,
) -> dict:
    # Step 1: PDP check — will DENY if MFA not verified for requires_mfa permissions
    pdp = PDP(db=db, mode=PDP_MODE)
    request_context = build_request_context(request)
    pdp.require_permission(
        actor=current_user,
        permission_key="billing.plan.change",  # requires_mfa=True in permission catalog
        resource=ResourceContext(org_id=resolve_org_id(current_user)),
        request_context=request_context,
    )
    
    # Step 2: Approval initiation (IP-5)
    decision = approval_service.initiate_approval(
        workflow_key="billing.plan.downgrade",
        action_key="billing.plan.change",
        ...
        request_context=request_context,
    )
    
    if decision.result in ("denied",):
        raise HTTPException(status_code=403, detail=decision.reason)
    
    if decision.result == "approval_required":
        return JSONResponse(
            status_code=202,
            content={
                "status": "pending_approval",
                "approval_instance_id": decision.instance_id,
                "message": "Downgrade requires MFA-verified dual approval.",
                "mfa_required": True,
            }
        )
    elif decision.result not in ("approved", "no_approval_required"):
        raise HTTPException(status_code=500, detail=f"Unexpected approval result: {decision.result}")
    
    # ... apply downgrade ...
```

### 9.2 Break-Glass Integration

Break-glass provides temporary emergency access when normal authorization would deny.

**Integration Points:**

| Router | Scenario | Permission Key | Break-Glass Duration |
|--------|----------|----------------|:--------------------:|
| steel.py | Urgent dispatch override when checker unavailable | `dispatch.quantity.override` | 2 hours |
| steel.py | Emergency inventory correction | `inventory.transaction.create` | 1 hour |
| settings.py | Unlock user account when admin unavailable | `user.deactivate` | 4 hours |
| billing.py | Emergency plan change to prevent service disruption | `billing.plan.change` | 2 hours |

**Integration Pattern:**

```python
# PDP handles break-glass via decision result REQUIRE_BREAK_GLASS
# Router does not need custom break-glass logic

@router.post("/{resource_id}/emergency-override")
def emergency_override(
    resource_id: int,
    payload: EmergencyOverrideRequest,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
    request: Request,
) -> dict:
    factory_id = resolve_factory_id(db, current_user)
    pdp = PDP(db=db, mode=PDP_MODE)
    request_context = build_request_context(request)
    
    # Normal PDP check — will return REQUIRE_BREAK_GLASS if denied but break-glass available
    decision = pdp.authorize(
        actor=current_user,
        permission_key="dispatch.quantity.override",
        resource=ResourceContext(factory_id=factory_id),
        request_context=request_context,
    )
    
    if decision == PDPDecision.REQUIRE_BREAK_GLASS:
        bg_decision = approval_service.initiate_approval(
            workflow_key="emergency.break-glass",
            action_key="dispatch.quantity.override",
            ...
            attributes={
                "incident_reason": payload.emergency_reason,
                "requested_duration_minutes": 120,
            },
            request_context=request_context,
        )
        
        if bg_decision.result == "approval_required":
            return JSONResponse(
                status_code=202,
                content={
                    "status": "break_glass_pending",
                    "approval_instance_id": bg_decision.instance_id,
                    "message": "Emergency access requires Security Admin approval.",
                }
            )
        elif bg_decision.result == "approved":
            pass  # Proceed to business logic below
        else:
            raise HTTPException(status_code=403, detail=bg_decision.reason)
    elif decision in (PDPDecision.DENY,):
        raise HTTPException(status_code=403, detail=decision.reason)
    elif decision not in (PDPDecision.ALLOW,):
        raise HTTPException(status_code=500, detail=f"Unexpected PDP decision: {decision}")
    
    # ... apply override ...
```

### 9.3 Denial Audit Logging

Every PDP DENY decision must produce an audit event. The router does not need custom denial logging — it is handled by the PDP.

**Audit Event Schema (per Workflow State Matrix Section 23):**

```python
# Written automatically by PDP._log_decision()
authz_decision = AuthzDecision(
    event_id=str(uuid.uuid4()),
    event_time=datetime.now(timezone.utc),
    event_type="AUTHZ_DENY",
    severity="high",
    actor_user_id=current_user.id,
    permission_key=the_permission_key,
    decision="deny",
    request_id=request_context.request_id,
    detail=reason,  # e.g. "No active role assignment covers this action"
)
```

**API Response for DENY:**

```json
HTTP 403
{
    "detail": "Access denied.",
    "authz_event_id": "evt_abc123",
    "denial_reason": "insufficient_permission",
    "required_permission": "inventory.reconciliation.approve",
    "current_roles": ["supervisor"],
    "mfa_required": true
}
```

### 9.4 Toxic Combination Runtime Enforcement

The PDP checks static toxic combinations (at permission assignment time) and dynamic toxic combinations (at runtime). The router only sees the result:

```python
# The PDP checks these automatically:
# Static: Inventory Operator + Inventory Approver blocked at assignment
# Dynamic: Same user tries to create and approve the same record

# In the router, the PDP+Approval service handles it:
pdp.require_permission(actor=current_user, permission_key=..., ...)
# If toxic combo detected, PDP returns DENY with reason
```

**No per-endpoint SoD code needed** beyond calling `require_permission()` and `initiate_approval()`.

---

## 10. Frontend & External Integration

### 10.1 Permission Manifest Endpoint

The frontend uses `GET /auth/permissions` to determine what UI elements to show.

**Contract:**

```http
GET /api/auth/permissions
Authorization: Bearer <token>

Response 200:
{
    "permissions": [
        "attendance.self.punch",
        "attendance.self.view",
        "production.entry.create",
        "production.entry.edit_own_draft",
        "inventory.ledger.view",
        ...
    ],
    "role_keys": ["operator"],
    "user_id": 42,
    "version": 3,  # bump on role/permission change for cache invalidation
    "assignments": [
        {
            "org_id": "org_1",
            "factory_id": "fac_1",
            "role_key": "operator",
            "scope_level": "FACTORY",
            "effective_to": null
        }
    ]
}
```

**Frontend Integration:**

```typescript
// Frontend: read manifest and conditionally render
const { data: permissions } = useQuery({
    queryKey: ['permissions'],
    queryFn: () => fetch('/api/auth/permissions').then(r => r.json()),
    staleTime: 5 * 60 * 1000,  // 5 min cache
})

// Conditional rendering
{permissions?.includes('inventory.ledger.view') && (
    <Link to="/steel/inventory">View Inventory</Link>
)}

// Conditional action buttons
{permissions?.includes('production.entry.approve') && (
    <Button onClick={approveEntry}>Approve</Button>
)}
```

### 10.2 Approval Queue API

The frontend displays the current user's approval queue via:

> **Approval Expiry Policy:** Each approval instance has a TTL derived from the workflow type (default 72h). On expiry:
> - `inventory.reconciliation.*` → auto-escalate to next authority level
> - `dispatch.*` → auto-escalate (time-sensitive business operation)
> - `billing.plan.change` → auto-reject (financial safety)
> - `user.role.assign` → notify requestor and stay pending until action taken
> - All others → notify requestor and expire as `abandoned`
> 
> The `event_type` emitted on expiry is `"approval.expired"` with attributes `instance_id`, `workflow_key`, `elapsed_hours`, and `action_taken`.



```http
GET /api/approvals/queue/me
Authorization: Bearer <token>
Query params: status=pending, page=1, limit=20

Response 200:
{
    "items": [
        {
            "instance_id": "inst_001",
            "workflow_key": "inventory.reconciliation.approve",
            "resource_type": "SteelStockReconciliation",
            "resource_id": "recon_123",
            "summary": "Stock reconciliation for Steel Rod 12mm - variance 2.3%",
            "requested_by": { "user_id": 10, "name": "Ramesh Kumar" },
            "submitted_at": "2026-06-16T10:30:00Z",
            "due_at": "2026-06-17T10:30:00Z",
            "priority": "high",
            "attributes": {
                "variance_percent": 2.3,
                "variance_kg": 45.5,
                "item_name": "Steel Rod 12mm"
            },
            "can_approve": true,
            "can_escalate": false,
            "can_delegate": true
        }
    ],
    "total": 5,
    "page": 1,
    "page_size": 20
}
```

**Frontend Queue Component Integration:**

```typescript
// Frontend: approval queue component
function ApprovalQueue() {
    const { data } = useQuery({
        queryKey: ['approval-queue'],
        queryFn: () => fetch('/api/approvals/queue/me').then(r => r.json()),
        refetchInterval: 30_000,  // poll every 30s
    })
    
    return (
        <div>
            {data.items.map(item => (
                <ApprovalCard
                    key={item.instance_id}
                    approval={item}
                    onApprove={() => approve(item.instance_id)}
                    onReject={() => reject(item.instance_id, reason)}
                    onEscalate={() => escalate(item.instance_id)}
                />
            ))}
        </div>
    )
}
```

### 10.3 Error Response Standards

The frontend must handle these authorization-related responses:

> **Stale-read protection:** When the frontend receives a 403 with a `version` field higher than the cached permission manifest version, it must re-fetch the permission manifest immediately and, if the action is now permitted, re-offer the action to the user. This prevents a ghost-state where the UI shows a button the user can no longer use (or hides one the user now has).

**403 — Access Denied (PDP DENY):**

```json
HTTP 403
{
    "detail": "Access denied.",
    "authz_event_id": "evt_abc123",
    "denial_reason": "insufficient_permission",
    "required_permission": "inventory.reconciliation.approve",
    "current_roles": ["supervisor"],
    "blocked_by_sod": true,
    "mfa_required": true
}
```

**202 — Pending Approval:**

```json
HTTP 202
{
    "status": "pending_approval",
    "approval_instance_id": "inst_001",
    "message": "Submitted for approval.",
    "estimated_wait_minutes": 15,
    "escalation_available": true
}
```

**403 — Maker-Checker Violation:**

```json
HTTP 403
{
    "detail": "You cannot approve your own request.",
    "authz_event_id": "evt_def456",
    "denial_reason": "self_approval_blocked",
    "maker_user_id": 42
}
```

**403 — Break-Glass Required:**

```json
HTTP 403
{
    "detail": "This action requires emergency access approval.",
    "authz_event_id": "evt_ghi789",
    "denial_reason": "break_glass_required",
    "break_glass_endpoint": "/api/approvals/instances/{id}/request-override",
    "requires_mfa": true
}
```

### 10.4 UI State Machine Integration

The frontend should derive available actions from the resource's current state + user's permissions:

```typescript
// Frontend: derive available actions from workflow state
function getAvailableActions(resource, permissions) {
    const state = resource.status;
    const actions = [];
    
    if (state === 'submitted' && permissions.includes('production.entry.approve')) {
        actions.push({ label: 'Approve', action: 'approve', color: 'green' });
        actions.push({ label: 'Reject', action: 'reject', color: 'red' });
    }
    
    if (state === 'draft' && resource.created_by_user_id === currentUserId) {
        actions.push({ label: 'Submit for Review', action: 'submit', color: 'blue' });
    }
    
    if (state === 'pending' && permissions.includes('inventory.reconciliation.approve')) {
        actions.push({ label: 'Review', action: 'review', color: 'blue' });
    }
    
    return actions;
}
```

---

## 11. Background Job & Webhook Integration Patterns

### 11.1 Background Jobs Authorization

Background jobs operate asynchronously and do not have an active HTTP session. Authorization for background jobs must be pre-validated at job creation time or use a system service account.

**Pattern — Pre-Validate at Enqueue Time:**

```python
# At job creation: validate permissions upfront
@router.post("/exports/excel")
def queue_excel_export(
    ...
):
    # Step 1: PDP check NOW (user has active session)
    pdp.require_permission(
        actor=current_user,
        permission_key="reporting.finance.export",
        resource=ResourceContext(factory_id=factory_id),
        request_context=build_request_context(request),
    )
    
    # Step 2: Pass context to background job
    job = create_job(
        kind="excel_export",
        owner_id=current_user.id,
        context={
            "authz": {
                "user_id": current_user.id,
                "org_id": org_id,
                "factory_id": factory_id,
                "permission_validated": "reporting.finance.export",
                "validated_at": datetime.now(timezone.utc).isoformat(),
            },
            "export_params": {...},
        },
    )
    
    return {"job_id": job["job_id"]}


# In the background job runner:
def run_export_job(progress, *, job_context):
    # Step 3: Optionally re-validate if job runs after a delay
    authz = job_context.get("authz", {})
    validated_at = datetime.fromisoformat(authz["validated_at"])
    
    # Re-validate if > 15 minutes have passed
    AUTHZ_REVALIDATION_TTL_SECONDS = 900  # matches access token TTL
    if (datetime.now(timezone.utc) - validated_at).total_seconds() > AUTHZ_REVALIDATION_TTL_SECONDS:
        with SessionLocal() as db:
            user = db.query(User).filter(User.id == authz["user_id"]).first()
            pdp = PDP(db=db, mode=PDP_MODE)
            pdp.require_permission(
                actor=user,
                permission_key=authz["permission_validated"],
                ...
            )
    
    # ... run export ...
```

### 11.2 Webhook / Event-Driven Authorization

Webhooks (Razorpay, WhatsApp) bypass normal authorization because they are external systems.

**Pattern — System Service Account:**

```python
# Webhooks use a system service account for internal operations
WEBHOOK_SYSTEM_USER_ID = os.getenv("WEBHOOK_SYSTEM_USER_ID", "0")

async def razorpay_webhook(request: Request, db: Session = Depends(get_db)):
    # Step 1: Verify webhook signature (external auth)
    utility.verify_webhook_signature(payload, signature, secret)
    
    # Step 2: For internal operations, use system account
    # The webhook handler calls billing services directly — no PDP check needed
    # because the webhook is a trusted system integration
    
    # Step 3: All state transitions triggered by webhooks are audited
    log_billing_event(event_type, org_id, "success", ...)
```

### 11.3 System Cron / Scheduler Authorization

Scheduled tasks (subscription expiry, downgrade application, alert escalation) run as system processes:

```python
# Scheduled tasks use a SYSTEM service context
# They bypass PDP but must still write audit events

def apply_due_downgrades(db: Session):
    """Called by scheduler — no user context."""
    downgrades = db.query(Subscription).filter(...).all()
    for sub in downgrades:
        # Apply downgrade
        sub.status = "cancelled"
        sub.updated_at = datetime.now(timezone.utc)
        
        # Audit with system context
        log_billing_event(
            "subscription.downgrade_applied",
            org_id=sub.org_id,
            detail=f"plan={sub.plan} -> {sub.pending_plan}",
        )
    db.commit()
```

### 11.4 Approval Completion Callbacks

When a background approval completes (e.g., reconciliation gets approved), the originating module needs to know:

```python
# Event-driven callback (via event bus or direct service call)
# registered in the originating module at init time

approval_service.register_callback(
    workflow_key="inventory.reconciliation.approve",
    callback=_on_reconciliation_approved,
)

def _on_reconciliation_approved(instance_id: str, resource_id: str, decision: str):
    """Called when an approval instance completes."""
    if decision != "approved":
        return
    
    with SessionLocal() as db:
        reconciliation = db.query(SteelStockReconciliation).filter(
            SteelStockReconciliation.id == int(resource_id)
        ).first()
        
        if not reconciliation or reconciliation.status != "pending":
            return  # Already processed
        
        # Apply the approved state change
        reconciliation.status = "approved"
        reconciliation.approved_at = datetime.now(timezone.utc)
        
        # Create inventory adjustment transaction
        db.add(SteelInventoryTransaction(
            org_id=reconciliation.org_id,
            factory_id=reconciliation.factory_id,
            item_id=reconciliation.item_id,
            transaction_type="adjustment",
            quantity_kg=float(reconciliation.variance_kg),
            reference_type="steel_reconciliation",
            reference_id=str(reconciliation.id),
            notes=f"Ledger correction from approval #{reconciliation.id}",
        ))
        
        db.commit()
```

---

## Appendix B: Quick Reference — State Matrix → Integration Point

This table maps every workflow state transition from the Workflow State Matrix to the specific integration point in the Module Integration Guide.

| Transition (Workflow.Source→Target) | WSM Section | Integration Section | Integration Pattern | Template |
|--------------------------------------|:-----------:|:------------------:|:-------------------:|:--------:|
| Entry.*→submitted | 2 | 3.2 (E1-E2) | IP-1 | — |
| Entry.submitted→approved | 2 | 3.2 (E7) | IP-2 | Template C (maker-checker) |
| Entry.submitted→rejected | 2 | 3.2 (E8) | IP-2 | Template C |
| Attendance.*→working | 3 | 3.3 (AT2) | IP-1 | Template B (replace role) |
| Attendance.working→completed | 3 | 3.3 (AT2) | IP-1 (auto) | — |
| Attendance.*→approved (review) | 3 | 3.3 (AT10) | IP-2 | Template C + Template E (self-approval) |
| Attendance.*→rejected (review) | 3 | 3.3 (AT11) | IP-2 | Template C + Template E |
| Regularization.*→pending | 4 | 3.3 (AT8) | IP-1 | — |
| Regularization.pending→approved | 4 | 3.3 (AT10) | IP-2 | Template C + Template E |
| Regularization.pending→rejected | 4 | 3.3 (AT11) | IP-2 | Template C + Template E |
| OCR.*→draft | 5 | 3.4 (O6) | IP-1 | — |
| OCR.draft→pending | 5 | 3.4 (O9) | IP-2 | Template C (maker-checker) |
| OCR.pending→approved | 5 | 3.4 (O10) | IP-2 (domain-split) | Template C + domain resolution |
| OCR.pending→rejected | 5 | 3.4 (O11) | IP-2 (domain-split) | Template C + domain resolution |
| Dispatch.*→initial | 6 | 3.5.4 (D2) | IP-1 | — |
| Dispatch.any→any valid (except cancel) | 6 | 3.5.4 (D4) | IP-2 | 7.1.2 State Validation Template |
| Dispatch.any→cancelled | 6 | 3.5.4 (D5) | IP-2 + V1 fix | 7.1.2 + inventory reversal |
| Invoice.*→unpaid | 7 | 3.5.3 (I2) | IP-1 | — |
| Invoice.unpaid/partial→paid/partial | 7 | 3.5.3 (auto) | IP-2 | 7.1.2 (auto via payment) |
| Reconciliation.*→pending | 8 | 3.5.1 (SI6) | IP-2 + G4/G8 fix | Template C + remove auto-approval |
| Reconciliation.pending→approved | 8 | 3.5.1 (SI9) | IP-2 | Template C + G4/G8 fix |
| Reconciliation.pending→rejected | 8 | 3.5.1 (SI10) | IP-2 | Template C |
| Batch.*→recorded | 9 | 3.5.6 (PB3) | IP-0 (conditional AP-2 for high variance) | — |
| Customer.*→active | 10 | 3.5.2 (C2) | IP-1 | — |
| Customer.active→on_hold/blocked/active | 10 | 3.5.2 | IP-2 + G5 fix | Template C |
| Customer.*→verified | 10 | 3.5.2 (CV3) | IP-2 + G6 fix | Template C + Template E |
| Customer.*→rejected (verification) | 10 | 3.5.2 (CV3) | IP-2 + G6 fix | Template C + Template E |
| FollowUp.*→open/in_progress/done/cancelled | 11 | 3.5.5 (CF2-CF3) | IP-0 | — |
| Subscription.trialing→active | 12 | 3.12 | IP-0 (webhook — Razorpay callback acts as completion signal) | 11.2 Webhook pattern |
| Subscription.active→cancelled/expired/stale | 12 | 3.12 (B4-B5) | IP-2 (OWNER initiates, approval service queues) | Template C |
| PaymentOrder.*→created/paid/failed/cancelled | 13 | 3.12 | IP-0 (webhook — Razorpay payment events drive state) | 11.2 Webhook pattern |
| Feedback.*→open/triaged/resolved | 17 | 3.16 | IP-1 (platform admin direct write, no maker-checker) | Template B |
| Intelligence.*→queued/completed/failed | 16 | 3.8 | IP-0 (background async job, no approval needed) | 11.1 Background job pattern |

## Appendix C: File Manifest — Complete Integration

Every integration requires changes to specific files. This manifest covers all phases:

### Phase P0 — Immediate Security Fixes

| File | Change | Router |
|------|--------|--------|
| `backend/routers/ai.py` | Add `pdp.require_permission()` to all 8 endpoints | ai.py |
| `backend/routers/intelligence.py` | Add `pdp.require_permission()` to all 4 endpoints | intelligence.py |
| `backend/routers/steel.py` | Add `pdp.require_permission("inventory.ledger.view")` to `/overview` | steel.py |
| `backend/routers/steel.py` | Add `pdp.require_permission("inventory.item.view")` to `/batches` | steel.py |
| `backend/routers/steel.py` | Remove `is_admin_or_owner` auto-approval in reconciliation create | steel.py |
| `backend/routers/steel.py` | Add `counted_by_user_id != current_user.id` guard in reconciliation approve | steel.py |

### Phase P1 — Maker-Checker & Approval Integration

| File | Change | Pattern |
|------|--------|:-------:|
| `backend/routers/entries.py` | Replace `require_role()` with PDP + approval service on approve/reject | IP-2 |
| `backend/routers/attendance.py` | Replace role-set with PDP on review endpoints | IP-2 |
| `backend/routers/ocr.py` | Add domain-split approval + self-approval check | IP-2 |
| `backend/routers/steel.py` | Add PDP + approval service on all inventory/customer/invoice/dispatch/payment mutations | IP-2→IP-4 |
| `backend/routers/settings.py` | Replace rank-based with PDP + approval service on user/factory management | IP-3→IP-4 |
| `backend/routers/billing.py` | Replace rank-based with PDP + MFA + approval service on plan changes | IP-5 |
| `backend/routers/feedback.py` | Add audit logging | — |
| `backend/routers/steel.py` | Add audit logging for customer follow-up | — |

### Phase P2 — Read Permission Migration

| File | Change | Endpoints |
|------|--------|:---------:|
| `backend/routers/*.py` | Replace all `require_any_role()` with `require_permission()` | All GET endpoints |
| `backend/routers/*.py` | Add `AUTHZ_DENY` audit events to all endpoints | All endpoints |
| `backend/routers/*.py` | Add scope validation on all list/detail endpoints | All GET endpoints |
| `backend/routers/*.py` | Add workflow state validation on all update endpoints | All mutation endpoints |

### Phase P3 — Hardening

| File | Change |
|------|--------|
| `backend/routers/billing.py` | Add MFA enforcement on downgrade/order creation |
| `backend/routers/settings.py` | Add MFA enforcement on role/user changes |
| `backend/routers/steel.py` | Add MFA enforcement on payment reversal |
| `backend/middleware/authorization.py` | Add break-glass PDP path |
| `backend/services/authorization/` | Add break-glass approval service |
| `backend/rbac.py` | Remove entire file (deprecated) |

---

*End of Module Integration Guide — Phase 3 of the Authorization Rollout*  
*Date: June 16, 2026*  
*Next: Implementation-ready code for each router's approval integration*